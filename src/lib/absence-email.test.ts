import { describe, expect, it } from "vitest";
import { absenceEmail } from "./absence-report";

const range = { start: "2026-11-02", end: "2026-11-02" };

describe("report email with two groups", () => {
  it("puts each group's absent students under its own heading in one email", () => {
    const { html } = absenceEmail("daily", range, [
      { label: "İbtidai Grubu", lines: [{ name: "Ali", gun: 1, vakit: 2 }] },
      { label: "İhzari Grubu", lines: [{ name: "Veli", gun: 1, vakit: 1 }] },
    ]);
    const ib = html.indexOf("İbtidai Grubu");
    const ih = html.indexOf("İhzari Grubu");
    expect(ib).toBeGreaterThan(-1);
    expect(ih).toBeGreaterThan(ib);
    expect(html.indexOf("Ali")).toBeGreaterThan(ib);
    expect(html.indexOf("Ali")).toBeLessThan(ih);
    expect(html.indexOf("Veli")).toBeGreaterThan(ih);
  });
});
