import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/flows/admin-client";
import {
  loadExternalChannel,
  resolveAuthAccountContext,
} from "@/lib/inbox/service";
import { buildUazapiSseUrl } from "@/lib/inbox/uazapi";
import { ingestUazapiInboundPayload } from "@/lib/inbox/uazapi-ingest";
import { createClient } from "@/lib/supabase/server";
import { decrypt } from "@/lib/whatsapp/encryption";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const encoder = new TextEncoder();

function encodeSse(event: string, data: Record<string, unknown>) {
  return encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

function parseSsePayload(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return { raw };
  }
}

export async function GET(
  request: Request,
  context: { params: Promise<{ channelId: string }> },
) {
  try {
    const supabase = await createClient();
    const authContext = await resolveAuthAccountContext(supabase);

    if (!authContext) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { channelId } = await context.params;
    const channel = await loadExternalChannel(
      supabase,
      authContext.accountId,
      channelId,
    );

    if (!channel || channel.provider !== "uazapi") {
      return NextResponse.json({ error: "Channel not found" }, { status: 404 });
    }

    if (!channel.token_encrypted) {
      return NextResponse.json(
        { error: "UAZAPI token is missing" },
        { status: 400 },
      );
    }

    const upstreamAbort = new AbortController();
    request.signal.addEventListener("abort", () => upstreamAbort.abort(), {
      once: true,
    });

    const upstreamUrl = buildUazapiSseUrl({
      base_url: channel.base_url || "",
      token: decrypt(channel.token_encrypted),
    });

    const upstream = await fetch(upstreamUrl, {
      headers: { Accept: "text/event-stream" },
      signal: upstreamAbort.signal,
    });

    if (!upstream.ok || !upstream.body) {
      return NextResponse.json(
        { error: `UAZAPI SSE failed with HTTP ${upstream.status}` },
        { status: 502 },
      );
    }

    const admin = supabaseAdmin();
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const reader = upstream.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let dataLines: string[] = [];
        let eventName = "message";

        const dispatch = async () => {
          if (dataLines.length === 0) return;

          const raw = dataLines.join("\n");
          const payload = parseSsePayload(raw);
          const dispatchedEventName = eventName;
          dataLines = [];
          eventName = "message";

          try {
            const result = await ingestUazapiInboundPayload(
              admin,
              channel,
              payload,
            );
            controller.enqueue(
              encodeSse("synced", {
                ok: true,
                upstream_event: dispatchedEventName,
                ignored: Boolean(result.ignored),
                duplicate: Boolean(result.duplicate),
                conversation_id: result.conversationId ?? null,
              }),
            );
          } catch (error) {
            const message =
              error instanceof Error ? error.message : "Failed to ingest event";
            console.error("[uazapi/sse] ingest error:", error);
            controller.enqueue(
              encodeSse("ingest_error", { ok: false, error: message }),
            );
          }
        };

        const processLine = async (line: string) => {
          if (line === "") {
            await dispatch();
            return;
          }

          if (line.startsWith(":")) return;

          const separator = line.indexOf(":");
          const field = separator === -1 ? line : line.slice(0, separator);
          const value =
            separator === -1
              ? ""
              : line.slice(separator + 1).replace(/^ /, "");

          if (field === "event") {
            eventName = value || "message";
          }
          if (field === "data") {
            dataLines.push(value);
          }
        };

        controller.enqueue(
          encodeSse("ready", {
            ok: true,
            channel_id: channel.id,
            provider: "uazapi",
          }),
        );

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            let newlineIndex = buffer.search(/\r?\n/);

            while (newlineIndex >= 0) {
              const rawLine = buffer.slice(0, newlineIndex);
              const newlineLength =
                buffer[newlineIndex] === "\r" &&
                buffer[newlineIndex + 1] === "\n"
                  ? 2
                  : 1;
              buffer = buffer.slice(newlineIndex + newlineLength);
              await processLine(rawLine.replace(/\r$/, ""));
              newlineIndex = buffer.search(/\r?\n/);
            }
          }

          if (buffer.length > 0) {
            await processLine(buffer);
          }
          await dispatch();
        } catch (error) {
          if (!upstreamAbort.signal.aborted) {
            const message =
              error instanceof Error ? error.message : "UAZAPI SSE failed";
            console.error("[uazapi/sse] stream error:", error);
            controller.enqueue(
              encodeSse("stream_error", { ok: false, error: message }),
            );
          }
        } finally {
          upstreamAbort.abort();
          controller.close();
        }
      },
      cancel() {
        upstreamAbort.abort();
      },
    });

    return new Response(stream, {
      headers: {
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "Content-Type": "text/event-stream; charset=utf-8",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to open UAZAPI SSE";
    console.error("[uazapi/sse GET] error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
