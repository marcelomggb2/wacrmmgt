import { describe, expect, it, vi } from "vitest";

import {
  fetchUazapiStatus,
  normalizeUazapiWebhookPayload,
  sendUazapiTextMessage,
} from "@/lib/inbox/uazapi";

describe("UAZAPI client", () => {
  it("sends token header and instance key on status checks", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: "ok" }),
    });

    await fetchUazapiStatus(
      {
        base_url: "https://uazapi.example.com/",
        external_key: "instance-a",
        token: "secret-token",
      },
      fetchImpl,
    );

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [requestUrl, init] = fetchImpl.mock.calls[0] as [
      URL,
      RequestInit,
    ];
    expect(requestUrl.toString()).toContain("/instance/status");
    expect(requestUrl.searchParams.get("instanceKey")).toBe("instance-a");
    expect(init.headers).toMatchObject({
      token: "secret-token",
      Accept: "application/json",
    });
  });

  it("extracts provider message id from text sends", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ messageId: "provider-123" }),
    });

    const result = await sendUazapiTextMessage(
      {
        base_url: "https://uazapi.example.com",
        external_key: null,
        token: "secret-token",
      },
      { number: "5511999999999", text: "Hello there" },
      fetchImpl,
    );

    expect(result.messageId).toBe("provider-123");
  });

  it("normalizes a webhook payload into the inbox shape", () => {
    const payload = {
      event: "message.received",
      body: {
        messageId: "wamid-1",
        chatid: "5511999999999@s.whatsapp.net",
        fromMe: false,
        senderName: "Maria",
        text: "Oi!",
        timestamp: 1719800000,
      },
    };

    expect(normalizeUazapiWebhookPayload(payload)).toMatchObject({
      providerMessageId: "wamid-1",
      phone: "5511999999999",
      chatId: "5511999999999@s.whatsapp.net",
      fromMe: false,
      text: "Oi!",
      mediaType: "text",
      contactName: "Maria",
    });
  });
});
