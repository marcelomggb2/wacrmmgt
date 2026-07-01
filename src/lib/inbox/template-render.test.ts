import { describe, expect, it } from "vitest";

import { renderTemplateBody } from "@/lib/inbox/template-render";

describe("renderTemplateBody", () => {
  it("replaces numbered placeholders with provided params", () => {
    expect(
      renderTemplateBody("Hello {{1}}, your code is {{2}}.", ["Ana", "1234"]),
    ).toBe("Hello Ana, your code is 1234.");
  });

  it("keeps placeholders when a value is missing", () => {
    expect(renderTemplateBody("Hello {{1}} {{2}}", ["Ana"])).toBe(
      "Hello Ana {{2}}",
    );
  });
});
