import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/flows/admin-client";
import { ingestUazapiInboundPayload } from "@/lib/inbox/uazapi-ingest";
import { decrypt } from "@/lib/whatsapp/encryption";

function resolveSecret(request: Request): string | null {
  return (
    request.headers.get("x-uazapi-secret") ||
    request.headers.get("x-webhook-secret") ||
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
    new URL(request.url).searchParams.get("secret")
  );
}

export async function POST(
  request: Request,
  context: { params: Promise<{ channelId: string }> },
) {
  try {
    const { channelId } = await context.params;
    const admin = supabaseAdmin();
    const { data: channel } = await admin
      .from("external_inbox_channels")
      .select("*")
      .eq("id", channelId)
      .maybeSingle();

    if (!channel || channel.provider !== "uazapi") {
      return NextResponse.json({ error: "Channel not found" }, { status: 404 });
    }

    if (channel.webhook_secret_encrypted) {
      const expected = decrypt(channel.webhook_secret_encrypted);
      const provided = resolveSecret(request);
      if (!provided || provided !== expected) {
        return NextResponse.json({ error: "Invalid webhook secret" }, { status: 401 });
      }
    }

    if (!channel.created_by) {
      return NextResponse.json(
        { error: "Channel is missing an owner user" },
        { status: 400 },
      );
    }

    const payload = await request.json();
    const result = await ingestUazapiInboundPayload(admin, channel, payload);

    return NextResponse.json({
      ok: true,
      ignored: result.ignored,
      duplicate: result.duplicate,
      conversation_id: result.conversationId,
    });
  } catch (error) {
    console.error("[uazapi/webhook POST] error:", error);
    return NextResponse.json(
      { error: "Failed to process webhook" },
      { status: 500 },
    );
  }
}
