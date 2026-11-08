import { describe, it, expect } from "vitest";
import { computeStats, daysSinceFirst } from "./stats";
const row = (date: string, vakitler: string[], durumlar = {}) => ({ id: date, studentId: "s", date, vakitler, ders: false, durum: "normal", durumlar }) as any;
describe("prayer counts", () => {
  it("counts prayers joined with the congregation (late counts)", () => {
    expect(computeStats([row("2026-11-01", ["Sabah", "Öğle"]), row("2026-11-02", [], { Yatsı: "gec" })]).namazKilinan).toBe(3);
  });
  it("counts missed prayers, excused and sick vakti included", () => {
    expect(computeStats([row("2026-11-01", ["Sabah"], { Öğle: "izinli" })]).namazKacirilan).toBe(4);
  });
  it("counts days from first record to today inclusive", () => {
    expect(daysSinceFirst([row("2026-11-03", []), row("2026-11-01", [])], new Date(2026, 10, 3))).toBe(3);
  });
});
