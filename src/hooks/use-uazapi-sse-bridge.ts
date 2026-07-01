"use client";

import { useEffect, useRef } from "react";

type ExternalChannelRow = {
  id: string;
  provider: "uazapi" | "instagram";
  status: "connected" | "disconnected" | "setup_pending" | "error";
};

interface UseUazapiSseBridgeOptions {
  enabled?: boolean;
  onSynced?: () => void;
}

export function useUazapiSseBridge({
  enabled = true,
  onSynced,
}: UseUazapiSseBridgeOptions = {}) {
  const onSyncedRef = useRef(onSynced);

  useEffect(() => {
    onSyncedRef.current = onSynced;
  });

  useEffect(() => {
    if (!enabled || typeof EventSource === "undefined") return;

    let cancelled = false;
    const sources: EventSource[] = [];

    async function connect() {
      const response = await fetch("/api/inbox/external-channels", {
        cache: "no-store",
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload?.error || "Failed to load UAZAPI channels");
      }

      const channels = ((payload.channels ?? []) as ExternalChannelRow[]).filter(
        (row) => row.provider === "uazapi" && row.status === "connected",
      );

      if (cancelled) return;

      for (const channel of channels) {
        const source = new EventSource(`/api/uazapi/sse/${channel.id}`);
        source.addEventListener("synced", (event) => {
          try {
            const data = JSON.parse((event as MessageEvent).data);
            if (data?.conversation_id && !data?.ignored && !data?.duplicate) {
              onSyncedRef.current?.();
            }
          } catch {
            onSyncedRef.current?.();
          }
        });
        source.addEventListener("ingest_error", (event) => {
          console.warn("[uazapi/sse] ingest error:", (event as MessageEvent).data);
        });
        source.addEventListener("stream_error", (event) => {
          console.warn("[uazapi/sse] stream error:", (event as MessageEvent).data);
        });
        sources.push(source);
      }
    }

    connect().catch((error) => {
      console.warn("[uazapi/sse] failed to connect:", error);
    });

    return () => {
      cancelled = true;
      for (const source of sources) {
        source.close();
      }
    };
  }, [enabled]);
}
