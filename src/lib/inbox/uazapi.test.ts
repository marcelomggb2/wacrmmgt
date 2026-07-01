import { describe, expect, it, vi } from "vitest";

import {
  buildUazapiSseUrl,
  fetchUazapiStatus,
  normalizeUazapiWebhookPayload,
  normalizeUazapiBaseUrl,
  sendUazapiMediaMessage,
  sendUazapiTextMessage,
} from "@/lib/inbox/uazapi";

describe("UAZAPI client", () => {
  it("normalizes UAZAPI base URLs from subdomains and full URLs", () => {
    expect(normalizeUazapiBaseUrl()).toBe("https://api.uazapi.com");
    expect(normalizeUazapiBaseUrl("api")).toBe("https://api.uazapi.com");
    expect(normalizeUazapiBaseUrl("free")).toBe("https://free.uazapi.com");
    expect(normalizeUazapiBaseUrl("custom.uazapi.com/")).toBe(
      "https://custom.uazapi.com",
    );
    expect(normalizeUazapiBaseUrl("https://api.uazapi.com/")).toBe(
      "https://api.uazapi.com",
    );
  });

  it("sends token header without instance key on status checks", async () => {
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
    expect(requestUrl.searchParams.get("instanceKey")).toBeNull();
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

  it("uses UAZAPI media payload field names from the official docs", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ messageid: "provider-media-123" }),
    });

    const result = await sendUazapiMediaMessage(
      {
        base_url: "api",
        external_key: "ignored-instance-key",
        token: "secret-token",
      },
      {
        number: "5511999999999",
        type: "document",
        url: "https://example.com/contract.pdf",
        caption: "Contract",
        fileName: "contract.pdf",
      },
      fetchImpl,
    );

    const [, init] = fetchImpl.mock.calls[0] as [URL, RequestInit];
    expect(JSON.parse(String(init.body))).toMatchObject({
      number: "5511999999999",
      type: "document",
      file: "https://example.com/contract.pdf",
      text: "Contract",
      docName: "contract.pdf",
      track_source: "wacrm",
    });
    expect(result.messageId).toBe("provider-media-123");
  });

  it("builds a server-side SSE URL without exposing instance keys", () => {
    const url = buildUazapiSseUrl({
      base_url: "free",
      token: "instance-token",
    });

    expect(url.toString()).toBe(
      "https://free.uazapi.com/sse?token=instance-token&events=messages&excludeMessages=wasSentByApi%2CfromMeYes%2CisGroupYes",
    );
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

  it("normalizes an SSE message event into the inbox shape", () => {
    const payload = {
      type: "message",
      data: {
        id: "3EB0538DA65A59F6D8A251",
        from: "5511999999999@s.whatsapp.net",
        text: "Ola!",
        timestamp: 1672531200000,
      },
    };

    expect(normalizeUazapiWebhookPayload(payload)).toMatchObject({
      providerMessageId: "3EB0538DA65A59F6D8A251",
      phone: "5511999999999",
      chatId: "5511999999999@s.whatsapp.net",
      text: "Ola!",
      mediaType: "text",
    });
  });
});
