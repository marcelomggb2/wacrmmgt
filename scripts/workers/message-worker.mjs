import net from "node:net";
import { setTimeout as sleep } from "node:timers/promises";

const REDIS_URL = process.env.REDIS_URL || "redis://127.0.0.1:6379/0";
const QUEUES = (process.env.MESSAGE_QUEUE_NAMES || "meta:webhooks")
  .split(",")
  .map((queue) => queue.trim())
  .filter(Boolean);
const DEAD_LETTER_QUEUE =
  process.env.MESSAGE_DEAD_LETTER_QUEUE || "meta:webhooks:dead";
const WORKER_ENDPOINT =
  process.env.INTERNAL_WORKER_ENDPOINT ||
  `${process.env.INTERNAL_APP_ORIGIN || "http://127.0.0.1:3000"}/api/internal/workers/messages`;
const WORKER_TOKEN = process.env.INTERNAL_WORKER_TOKEN || "";
const BRPOP_TIMEOUT_SECONDS = Number(process.env.MESSAGE_QUEUE_TIMEOUT_SECONDS || 5);

let shuttingDown = false;

process.on("SIGTERM", () => {
  shuttingDown = true;
});

process.on("SIGINT", () => {
  shuttingDown = true;
});

function encodeCommand(parts) {
  return Buffer.from(
    `*${parts.length}\r\n${parts
      .map((part) => {
        const value = String(part);
        return `$${Buffer.byteLength(value)}\r\n${value}\r\n`;
      })
      .join("")}`,
  );
}

function parseLine(buffer, offset) {
  const end = buffer.indexOf("\r\n", offset, "utf8");
  if (end === -1) return null;
  return {
    value: buffer.toString("utf8", offset, end),
    offset: end + 2,
  };
}

function parseReply(buffer, offset = 0) {
  if (offset >= buffer.length) return null;

  const prefix = String.fromCharCode(buffer[offset]);
  const line = parseLine(buffer, offset + 1);
  if (!line) return null;

  if (prefix === "+") return { value: line.value, offset: line.offset };
  if (prefix === ":") return { value: Number(line.value), offset: line.offset };
  if (prefix === "-") throw new Error(`Redis error: ${line.value}`);

  if (prefix === "$") {
    const length = Number(line.value);
    if (length === -1) return { value: null, offset: line.offset };
    const end = line.offset + length;
    if (buffer.length < end + 2) return null;
    return {
      value: buffer.toString("utf8", line.offset, end),
      offset: end + 2,
    };
  }

  if (prefix === "*") {
    const count = Number(line.value);
    if (count === -1) return { value: null, offset: line.offset };
    const values = [];
    let nextOffset = line.offset;

    for (let index = 0; index < count; index += 1) {
      const item = parseReply(buffer, nextOffset);
      if (!item) return null;
      values.push(item.value);
      nextOffset = item.offset;
    }

    return { value: values, offset: nextOffset };
  }

  throw new Error(`Unsupported Redis reply prefix: ${prefix}`);
}

class RedisConnection {
  constructor(url) {
    this.url = new URL(url);
    this.buffer = Buffer.alloc(0);
    this.pending = null;
  }

  async connect() {
    const port = Number(this.url.port || 6379);
    const host = this.url.hostname || "127.0.0.1";

    this.socket = net.createConnection({ host, port });
    this.socket.on("data", (chunk) => {
      this.buffer = Buffer.concat([this.buffer, chunk]);
      this.flushPending();
    });
    this.socket.on("error", (error) => {
      if (this.pending) {
        this.pending.reject(error);
        this.pending = null;
      }
    });

    await new Promise((resolve, reject) => {
      this.socket.once("connect", resolve);
      this.socket.once("error", reject);
    });

    if (this.url.password) {
      await this.command("AUTH", decodeURIComponent(this.url.password));
    }

    const database = this.url.pathname.replace("/", "");
    if (database && database !== "0") {
      await this.command("SELECT", database);
    }
  }

  close() {
    this.socket?.destroy();
  }

  async command(...parts) {
    if (this.pending) {
      throw new Error("RedisConnection only supports one in-flight command");
    }

    const result = new Promise((resolve, reject) => {
      this.pending = { resolve, reject };
    });

    this.socket.write(encodeCommand(parts));
    this.flushPending();
    return result;
  }

  flushPending() {
    if (!this.pending || this.buffer.length === 0) return;

    try {
      const reply = parseReply(this.buffer);
      if (!reply) return;

      this.buffer = this.buffer.subarray(reply.offset);
      const pending = this.pending;
      this.pending = null;
      pending.resolve(reply.value);
    } catch (error) {
      const pending = this.pending;
      this.pending = null;
      pending.reject(error);
    }
  }
}

async function postJob(queue, payload) {
  const response = await fetch(WORKER_ENDPOINT, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(WORKER_TOKEN ? { "x-internal-worker-token": WORKER_TOKEN } : {}),
    },
    body: JSON.stringify({ queue, payload }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Worker endpoint returned ${response.status}: ${body}`);
  }
}

async function moveToDeadLetter(redis, queue, rawPayload, error) {
  await redis.command(
    "LPUSH",
    DEAD_LETTER_QUEUE,
    JSON.stringify({
      queue,
      payload: rawPayload,
      error: error instanceof Error ? error.message : String(error),
      failed_at: new Date().toISOString(),
    }),
  );
}

async function run() {
  if (QUEUES.length === 0) {
    throw new Error("MESSAGE_QUEUE_NAMES must contain at least one queue");
  }

  console.log(
    `[message-worker] starting; queues=${QUEUES.join(",")} endpoint=${WORKER_ENDPOINT}`,
  );

  while (!shuttingDown) {
    let redis;

    try {
      redis = new RedisConnection(REDIS_URL);
      await redis.connect();

      while (!shuttingDown) {
        const reply = await redis.command(
          "BRPOP",
          ...QUEUES,
          String(BRPOP_TIMEOUT_SECONDS),
        );

        if (!reply) continue;
        const [queue, rawPayload] = reply;

        try {
          const payload = JSON.parse(rawPayload);
          await postJob(queue, payload);
          console.log(`[message-worker] processed job from ${queue}`);
        } catch (error) {
          console.error("[message-worker] job failed:", error);
          await moveToDeadLetter(redis, queue, rawPayload, error);
        }
      }
    } catch (error) {
      console.error("[message-worker] redis loop failed:", error);
      await sleep(2000);
    } finally {
      redis?.close();
    }
  }

  console.log("[message-worker] stopped");
}

run().catch((error) => {
  console.error("[message-worker] fatal:", error);
  process.exitCode = 1;
});
