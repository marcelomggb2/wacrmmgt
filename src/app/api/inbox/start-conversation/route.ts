import { NextResponse } from "next/server";

import { sendConversationMessage } from "@/lib/inbox/send";
import { isSendableInboxProvider } from "@/lib/inbox/channels";
import {
  findOrCreateContact,
  findOrCreateConversation,
  getApprovedTemplate,
  loadConversationForSend,
  resolveAuthAccountContext,
  syncContactTags,
} from "@/lib/inbox/service";
import { renderTemplateBody } from "@/lib/inbox/template-render";
import {
  checkRateLimit,
  RATE_LIMITS,
  rateLimitResponse,
} from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";

interface StartConversationBody {
  contact_id?: string;
  contact?: {
    name?: string;
    phone?: string;
    email?: string;
  };
  tag_ids?: string[];
  channel?: {
    provider?: string;
    id?: string;
  };
  template?: {
    name?: string;
    language?: string;
    body?: string[];
    headerText?: string;
    buttonParams?: Record<number, string>;
  };
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const context = await resolveAuthAccountContext(supabase);

    if (!context) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const limit = checkRateLimit(
      `start-conversation:${context.userId}`,
      RATE_LIMITS.send,
    );
    if (!limit.success) {
      return rateLimitResponse(limit);
    }

    const body = (await request.json()) as StartConversationBody;
    const provider = body.channel?.provider;
    const channelId = body.channel?.id;
    const templateName = body.template?.name;

    if (!provider || !channelId || !templateName) {
      return NextResponse.json(
        { error: "channel and template are required" },
        { status: 400 },
      );
    }

    if (!isSendableInboxProvider(provider as "whatsapp_official" | "uazapi")) {
      return NextResponse.json(
        { error: "Selected channel cannot start conversations yet" },
        { status: 400 },
      );
    }

    const template = await getApprovedTemplate(
      supabase,
      context.accountId,
      templateName,
      body.template?.language,
    );

    if (!template || template.status !== "APPROVED") {
      return NextResponse.json(
        { error: "Approved template not found" },
        { status: 404 },
      );
    }

    let contactId = body.contact_id;
    let contactRecord = null;

    if (contactId) {
      const { data, error } = await supabase
        .from("contacts")
        .select("*")
        .eq("id", contactId)
        .eq("account_id", context.accountId)
        .maybeSingle();

      if (error || !data) {
        return NextResponse.json({ error: "Contact not found" }, { status: 404 });
      }

      contactRecord = data;
    } else {
      const phone = body.contact?.phone?.trim();
      if (!phone) {
        return NextResponse.json(
          { error: "contact.phone is required when contact_id is not provided" },
          { status: 400 },
        );
      }

      const created = await findOrCreateContact(supabase, {
        accountId: context.accountId,
        userId: context.userId,
        phone,
        name: body.contact?.name,
        email: body.contact?.email,
      });

      contactRecord = created.contact;
      contactId = created.contact.id;
    }

    if (!contactId || !contactRecord) {
      return NextResponse.json(
        { error: "Failed to resolve contact" },
        { status: 400 },
      );
    }

    await syncContactTags(supabase, contactId, body.tag_ids ?? []);

    const conversation = await findOrCreateConversation(supabase, {
      accountId: context.accountId,
      userId: context.userId,
      contactId,
      provider: provider as "whatsapp_official" | "uazapi",
      whatsappConfigId: provider === "whatsapp_official" ? channelId : null,
      externalChannelId: provider === "uazapi" ? channelId : null,
    });

    const renderedBody = renderTemplateBody(
      template.body_text,
      body.template?.body ?? [],
    );

    await sendConversationMessage(supabase, context.accountId, {
      conversationId: conversation.id,
      messageType: "template",
      contentText: renderedBody,
      templateName: template.name,
      templateLanguage: template.language,
      templateParams: body.template?.body ?? [],
      templateMessageParams: {
        body: body.template?.body ?? [],
        headerText: body.template?.headerText,
        buttonParams: body.template?.buttonParams,
      },
    });

    const hydratedConversation = await loadConversationForSend(
      supabase,
      context.accountId,
      conversation.id,
    );

    return NextResponse.json({
      success: true,
      conversation: hydratedConversation,
      contact: contactRecord,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to start conversation";
    console.error("[inbox/start-conversation POST] error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
