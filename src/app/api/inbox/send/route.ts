import { NextResponse } from "next/server";

import { sendConversationMessage } from "@/lib/inbox/send";
import { resolveAuthAccountContext } from "@/lib/inbox/service";
import {
  checkRateLimit,
  RATE_LIMITS,
  rateLimitResponse,
} from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const supabase = await createClient(request);
    const context = await resolveAuthAccountContext(supabase);

    if (!context) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const limit = checkRateLimit(`send:${context.userId}`, RATE_LIMITS.send);
    if (!limit.success) {
      return rateLimitResponse(limit);
    }

    const body = await request.json();
    const result = await sendConversationMessage(supabase, context.accountId, {
      conversationId: body.conversation_id,
      messageType: body.message_type,
      contentText: body.content_text,
      mediaUrl: body.media_url,
      filename: body.filename,
      templateName: body.template_name,
      templateLanguage: body.template_language,
      templateParams: body.template_params,
      templateMessageParams: body.template_message_params,
      replyToMessageId: body.reply_to_message_id,
    });

    return NextResponse.json({
      success: true,
      message_id: result.messageId,
      whatsapp_message_id: result.providerMessageId,
      provider: result.provider,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to send message";
    const status =
      /Unauthorized/i.test(message) ? 401 :
      /required|Invalid|not found|not linked|missing|prepared/i.test(message) ? 400 :
      /Conversation not found/i.test(message) ? 404 :
      /Meta API/i.test(message) ? 502 :
      500;

    console.error("[inbox/send POST] error:", error);
    return NextResponse.json({ error: message }, { status });
  }
}
