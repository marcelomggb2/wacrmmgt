import { afterEach, describe, expect, it } from "vitest";

import {
  buildInstagramWebhookUrl,
  extractBrazilianWhatsapp,
  extractInstagramCommentEvents,
  extractInstagramMessageEvents,
  isInstagramKeywordComment,
  summarizeInstagramWebhookPayload,
} from "./instagram-webhook";

describe("buildInstagramWebhookUrl", () => {
  const originalOrigin = process.env.NEXT_PUBLIC_INSTAGRAM_WEBHOOK_ORIGIN;
  const originalSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;

  afterEach(() => {
    process.env.NEXT_PUBLIC_INSTAGRAM_WEBHOOK_ORIGIN = originalOrigin;
    process.env.NEXT_PUBLIC_SITE_URL = originalSiteUrl;
  });

  it("prefers the dedicated Instagram webhook origin", () => {
    process.env.NEXT_PUBLIC_INSTAGRAM_WEBHOOK_ORIGIN =
      "https://ig-hooks.example.com/";
    process.env.NEXT_PUBLIC_SITE_URL = "https://crm.example.com";

    expect(buildInstagramWebhookUrl("abc123")).toBe(
      "https://ig-hooks.example.com/api/instagram/webhook/abc123",
    );
  });

  it("falls back to the current origin when no env override exists", () => {
    delete process.env.NEXT_PUBLIC_INSTAGRAM_WEBHOOK_ORIGIN;
    delete process.env.NEXT_PUBLIC_SITE_URL;

    expect(
      buildInstagramWebhookUrl("abc123", "https://app.localhost:3000/"),
    ).toBe("https://app.localhost:3000/api/instagram/webhook/abc123");
  });
});

describe("Instagram webhook extraction", () => {
  it("extracts comment events from Meta changes payloads", () => {
    const comments = extractInstagramCommentEvents({
      object: "instagram",
      entry: [
        {
          id: "ig_business_1",
          changes: [
            {
              field: "comments",
              value: {
                id: "comment_1",
                text: "INTEGRAR",
                from: { id: "ig_user_1", username: "lead" },
                media: { id: "media_1", media_product_type: "REELS" },
                timestamp: "2026-07-01T16:50:00+0000",
              },
            },
          ],
        },
      ],
    });

    expect(comments).toHaveLength(1);
    expect(comments[0]).toMatchObject({
      id: "comment_1",
      text: "INTEGRAR",
      fromId: "ig_user_1",
      username: "lead",
      mediaId: "media_1",
      mediaProductType: "REELS",
    });
  });

  it("extracts Instagram DM events from messaging payloads", () => {
    const messages = extractInstagramMessageEvents({
      object: "instagram",
      entry: [
        {
          id: "ig_business_1",
          messaging: [
            {
              sender: { id: "igsid_1" },
              recipient: { id: "ig_business_1" },
              timestamp: 1782920200123,
              message: {
                mid: "mid_1",
                text: "11 99999-9999",
              },
            },
          ],
        },
      ],
    });

    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({
      senderId: "igsid_1",
      recipientId: "ig_business_1",
      messageId: "mid_1",
      text: "11 99999-9999",
    });
  });

  it("normalizes the campaign keyword and Brazilian WhatsApp numbers", () => {
    expect(isInstagramKeywordComment("  integrar  ")).toBe(true);
    expect(isInstagramKeywordComment("ÍNTEGRAR")).toBe(true);
    expect(extractBrazilianWhatsapp("me chama no (11) 99999-9999")).toBe(
      "5511999999999",
    );
    expect(extractBrazilianWhatsapp("+55 21 98888-7777")).toBe(
      "5521988887777",
    );
    expect(extractBrazilianWhatsapp("manda no 11 9 9999 9999")).toBe(
      "5511999999999",
    );
    expect(extractBrazilianWhatsapp("zap: (11) 9 9999-9999")).toBe(
      "5511999999999",
    );
  });
});

describe("summarizeInstagramWebhookPayload", () => {
  it("collects the main webhook metadata", () => {
    const summary = summarizeInstagramWebhookPayload({
      object: "instagram",
      entry: [
        {
          time: 1719862800,
          changes: [
            { field: "messages" },
            { field: "messaging_postbacks" },
          ],
          messaging: [{ id: "m_1" }, { id: "m_2" }],
        },
      ],
    });

    expect(summary.object).toBe("instagram");
    expect(summary.entryCount).toBe(1);
    expect(summary.changedFields).toEqual([
      "messages",
      "messaging_postbacks",
    ]);
    expect(summary.messageCount).toBe(2);
    expect(summary.lastEntryTime).toBe("2024-07-01T19:40:00.000Z");
  });
});
