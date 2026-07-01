import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/flows/admin-client";
import {
  summarizeInstagramWebhookPayload,
} from "@/lib/inbox/instagram-webhook";
import { ingestInstagramWebhookPayload } from "@/lib/inbox/instagram-leads";
import {
  decrypt,
  encrypt,
  isLegacyFormat,
} from "@/lib/whatsapp/encryption";
import { verifyMetaWebhookSignature } from "@/lib/whatsapp/webhook-signature";

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

async function loadInstagramChannel(channelId: string) {
  const admin = supabaseAdmin();
  const { data } = await admin
    .from("external_inbox_channels")
    .select("*")
    .eq("id", channelId)
    .maybeSingle();

  if (!data || data.provider !== "instagram") {
    return null;
  }

  return data;
}

async function markChannelConnected(
  channelId: string,
  settingsPatch: Record<string, unknown>,
) {
  const admin = supabaseAdmin();
  const { data } = await admin
    .from("external_inbox_channels")
    .select("connected_at, settings")
    .eq("id", channelId)
    .maybeSingle();

  const settings = {
    ...asRecord(data?.settings),
    ...settingsPatch,
  };

  await admin
    .from("external_inbox_channels")
    .update({
      status: "connected",
      connected_at: data?.connected_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
      last_error: null,
      settings,
    })
    .eq("id", channelId);
}

async function markChannelError(channelId: string, error: unknown) {
  const message =
    error instanceof Error ? error.message : "Instagram webhook processing failed";

  await supabaseAdmin()
    .from("external_inbox_channels")
    .update({
      status: "error",
      last_error: message,
      updated_at: new Date().toISOString(),
    })
    .eq("id", channelId);
}

export async function GET(
  request: Request,
  context: { params: Promise<{ channelId: string }> },
) {
  try {
    const { channelId } = await context.params;
    const channel = await loadInstagramChannel(channelId);

    if (!channel) {
      return NextResponse.json({ error: "Channel not found" }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const mode = searchParams.get("hub.mode");
    const challenge = searchParams.get("hub.challenge");
    const verifyToken = searchParams.get("hub.verify_token");

    if (mode !== "subscribe" || !challenge || !verifyToken) {
      return NextResponse.json(
        { error: "Missing verification parameters" },
        { status: 400 },
      );
    }

    if (!channel.webhook_secret_encrypted) {
      return NextResponse.json(
        { error: "Verify token is not configured for this channel" },
        { status: 403 },
      );
    }

    let expectedToken: string;
    try {
      expectedToken = decrypt(channel.webhook_secret_encrypted);
    } catch (error) {
      console.error("[instagram/webhook GET] failed to decrypt verify token:", error);
      return NextResponse.json(
        { error: "Stored verify token is invalid" },
        { status: 500 },
      );
    }

    if (expectedToken !== verifyToken) {
      return NextResponse.json(
        { error: "Verification token mismatch" },
        { status: 403 },
      );
    }

    if (isLegacyFormat(channel.webhook_secret_encrypted)) {
      await supabaseAdmin()
        .from("external_inbox_channels")
        .update({ webhook_secret_encrypted: encrypt(verifyToken) })
        .eq("id", channelId);
    }

    await markChannelConnected(channelId, {
      last_verified_at: new Date().toISOString(),
    });

    return new Response(challenge, {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  } catch (error) {
    console.error("[instagram/webhook GET] error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ channelId: string }> },
) {
  try {
    const { channelId } = await context.params;
    const channel = await loadInstagramChannel(channelId);

    if (!channel) {
      return NextResponse.json({ error: "Channel not found" }, { status: 404 });
    }

    const rawBody = await request.text();
    const signature = request.headers.get("x-hub-signature-256");

    if (!verifyMetaWebhookSignature(rawBody, signature)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    let payload: unknown;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const summary = summarizeInstagramWebhookPayload(payload);

    await markChannelConnected(channelId, {
      last_webhook_at: new Date().toISOString(),
      last_webhook_object: summary.object,
      last_webhook_entry_count: summary.entryCount,
      last_webhook_fields: summary.changedFields,
      last_webhook_message_count: summary.messageCount,
      last_webhook_entry_time: summary.lastEntryTime,
    });

    let ingestResult = null;
    try {
      ingestResult = await ingestInstagramWebhookPayload(
        supabaseAdmin(),
        channel,
        payload,
      );
    } catch (error) {
      console.error("[instagram/webhook POST] ingest error:", error);
      await markChannelError(channelId, error);
      throw error;
    }

    return NextResponse.json({
      ok: true,
      received: {
        object: summary.object,
        entries: summary.entryCount,
        fields: summary.changedFields,
      },
      processed: ingestResult,
    });
  } catch (error) {
    console.error("[instagram/webhook POST] error:", error);
    return NextResponse.json(
      { error: "Failed to process webhook" },
      { status: 500 },
    );
  }
}
