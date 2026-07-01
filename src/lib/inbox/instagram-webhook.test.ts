import { afterEach, describe, expect, it } from "vitest";

import {
  buildInstagramWebhookUrl,
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
