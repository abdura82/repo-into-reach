import { describe, expect, it } from "vitest";
import { telHref } from "./phone";

describe("telHref", () => {
  it("keeps a local number callable after dropping spaces", () => {
    expect(telHref("0555 111 22 33")).toBe("tel:05551112233");
  });

  it("keeps a country code when the number starts with +", () => {
    expect(telHref("+90 (555) 111-22-33")).toBe("tel:+905551112233");
  });

  it("refuses to build a call link for something that is not a number", () => {
    expect(telHref("123456789")).toBe("");
    expect(telHref("")).toBe("");
    expect(telHref(undefined)).toBe("");
  });
});
