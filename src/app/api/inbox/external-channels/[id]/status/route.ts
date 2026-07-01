import { NextResponse } from "next/server";

import { fetchUazapiStatus } from "@/lib/inbox/uazapi";
import {
  loadExternalChannel,
  resolveAuthAccountContext,
} from "@/lib/inbox/service";
import { decrypt } from "@/lib/whatsapp/encryption";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const supabase = await createClient();
    const authContext = await resolveAuthAccountContext(supabase);

    if (!authContext) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    const channel = await loadExternalChannel(supabase, authContext.accountId, id);

    if (!channel) {
      return NextResponse.json({ error: "Channel not found" }, { status: 404 });
    }

    if (channel.provider !== "uazapi") {
      return NextResponse.json(
        { error: "Status checks are only available for UAZAPI channels" },
        { status: 400 },
      );
    }

    if (!channel.token_encrypted) {
      return NextResponse.json(
        { error: "UAZAPI token is missing" },
        { status: 400 },
      );
    }

    const payload = await fetchUazapiStatus({
      base_url: channel.base_url || "",
      external_key: channel.external_key || null,
      token: decrypt(channel.token_encrypted),
    });

    await supabase
      .from("external_inbox_channels")
      .update({
        status: "connected",
        connected_at: new Date().toISOString(),
        last_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", channel.id);

    return NextResponse.json({ connected: true, payload });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to verify channel";
    console.error("[external-channels status GET] error:", error);
    return NextResponse.json({ connected: false, error: message }, { status: 500 });
  }
}
