import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/flows/admin-client";
import {
  findOrCreateContact,
  findOrCreateConversation,
} from "@/lib/inbox/service";
import { normalizeUazapiWebhookPayload } from "@/lib/inbox/uazapi";
import { decrypt } from "@/lib/whatsapp/encryption";

function resolveSecret(request: Request): string | null {
  return (
    request.headers.get("x-uazapi-secret") ||
    request.headers.get("x-webhook-secret") ||
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
    new URL(request.url).searchParams.get("secret")
  );
}

function normalizeContentType(mediaType: string) {
  if (mediaType === "image") return "image";
  if (mediaType === "video") return "video";
  if (mediaType === "audio") return "audio";
  if (mediaType === "document") return "document";
  return "text";
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
    const normalized = normalizeUazapiWebhookPayload(payload);

    if (!normalized || normalized.fromMe) {
      return NextResponse.json({ ok: true, ignored: true });
    }

    const contactOutcome = await findOrCreateContact(admin, {
      accountId: channel.account_id,
      userId: channel.created_by,
      phone: normalized.phone,
      name: normalized.contactName,
    });

    const conversation = await findOrCreateConversation(admin, {
      accountId: channel.account_id,
      userId: channel.created_by,
      contactId: contactOutcome.contact.id,
      provider: "uazapi",
      externalChannelId: channel.id,
    });

    if (normalized.providerMessageId) {
      const { data: existing } = await admin
        .from("messages")
        .select("id")
        .eq("conversation_id", conversation.id)
        .eq("message_id", normalized.providerMessageId)
        .maybeSingle();

      if (existing) {
        return NextResponse.json({ ok: true, duplicate: true });
      }
    }

    const contentType = normalizeContentType(normalized.mediaType);
    const { error: messageError } = await admin.from("messages").insert({
      conversation_id: conversation.id,
      sender_type: "customer",
      content_type: contentType,
      content_text: normalized.text,
      media_url: normalized.mediaUrl,
      message_id: normalized.providerMessageId,
      status: "delivered",
      created_at: normalized.createdAt,
    });

    if (messageError) {
      throw messageError;
    }

    await admin
      .from("conversations")
      .update({
        last_message_text: normalized.text || "[Attachment]",
        last_message_at: normalized.createdAt,
        unread_count: (conversation.unread_count || 0) + 1,
        updated_at: new Date().toISOString(),
        channel_provider: "uazapi",
        external_channel_id: channel.id,
      })
      .eq("id", conversation.id);

    return NextResponse.json({ ok: true, conversation_id: conversation.id });
  } catch (error) {
    console.error("[uazapi/webhook POST] error:", error);
    return NextResponse.json(
      { error: "Failed to process webhook" },
      { status: 500 },
    );
  }
}
