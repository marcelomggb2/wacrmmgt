import { NextResponse } from "next/server";

import { encrypt } from "@/lib/whatsapp/encryption";
import { createClient } from "@/lib/supabase/server";
import { resolveAuthAccountContext } from "@/lib/inbox/service";

function sanitizeChannel(row: Record<string, unknown>) {
  const {
    token_encrypted,
    webhook_secret_encrypted,
    ...safe
  } = row;

  return {
    ...safe,
    has_token: Boolean(token_encrypted),
    has_webhook_secret: Boolean(webhook_secret_encrypted),
  };
}

export async function GET() {
  try {
    const supabase = await createClient();
    const context = await resolveAuthAccountContext(supabase);

    if (!context) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("external_inbox_channels")
      .select("*")
      .eq("account_id", context.accountId)
      .order("created_at", { ascending: true });

    if (error) throw error;

    return NextResponse.json({
      channels: (data ?? []).map((row) => sanitizeChannel(row as Record<string, unknown>)),
    });
  } catch (error) {
    console.error("[external-channels GET] error:", error);
    return NextResponse.json(
      { error: "Failed to fetch external channels" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const context = await resolveAuthAccountContext(supabase);

    if (!context) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const provider = body.provider as string | undefined;

    if (provider !== "uazapi" && provider !== "instagram") {
      return NextResponse.json({ error: "Invalid provider" }, { status: 400 });
    }

    const payload: Record<string, unknown> = {
      account_id: context.accountId,
      created_by: context.userId,
      provider,
      label: body.label?.trim() || null,
      status:
        provider === "instagram"
          ? "setup_pending"
          : body.status || "disconnected",
      base_url: body.base_url?.trim() || null,
      external_key: body.external_key?.trim() || null,
      display_identifier: body.display_identifier?.trim() || null,
      settings:
        body.settings && typeof body.settings === "object" ? body.settings : {},
      last_error: null,
      updated_at: new Date().toISOString(),
    };

    if (body.token && typeof body.token === "string" && body.token.trim()) {
      payload.token_encrypted = encrypt(body.token.trim());
    }

    if (
      body.webhook_secret &&
      typeof body.webhook_secret === "string" &&
      body.webhook_secret.trim()
    ) {
      payload.webhook_secret_encrypted = encrypt(body.webhook_secret.trim());
    }

    if (payload.status === "connected") {
      payload.connected_at = new Date().toISOString();
    }

    const id = typeof body.id === "string" ? body.id : null;
    const mutation = id
      ? supabase
          .from("external_inbox_channels")
          .update(payload)
          .eq("id", id)
          .eq("account_id", context.accountId)
          .select("*")
          .single()
      : supabase
          .from("external_inbox_channels")
          .insert(payload)
          .select("*")
          .single();

    const { data, error } = await mutation;
    if (error) throw error;

    return NextResponse.json({ channel: sanitizeChannel(data as Record<string, unknown>) });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to save external channel";
    console.error("[external-channels POST] error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const supabase = await createClient();
    const context = await resolveAuthAccountContext(supabase);

    if (!context) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const { error } = await supabase
      .from("external_inbox_channels")
      .delete()
      .eq("id", id)
      .eq("account_id", context.accountId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[external-channels DELETE] error:", error);
    return NextResponse.json(
      { error: "Failed to remove external channel" },
      { status: 500 },
    );
  }
}
