import { NextResponse } from "next/server";

import { listInboxChannels, resolveAuthAccountContext } from "@/lib/inbox/service";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();
    const context = await resolveAuthAccountContext(supabase);

    if (!context) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const channels = await listInboxChannels(supabase, context.accountId);
    return NextResponse.json({ channels });
  } catch (error) {
    console.error("[inbox/channels GET] unexpected error:", error);
    return NextResponse.json(
      { error: "Failed to fetch inbox channels" },
      { status: 500 },
    );
  }
}
