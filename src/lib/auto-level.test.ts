import { describe, it, expect } from "vitest";
import { autoLevel } from "./stats";
import type { AttendanceRow } from "./store";
const V = ["Sabah", "Öğle", "İkindi", "Akşam", "Yatsı"];
const TODAY = new Date("2026-01-20T09:00:00Z");
const row = (date: string, n: number, durumlar: Record<string, string> = {}): AttendanceRow =>
  ({ id: date, studentId: "a", date, vakitler: V.slice(0, n), ders: false, durum: "normal", durumlar } as AttendanceRow);
const full = (days: number) => Array.from({ length: days }, (_, i) => row(`2026-01-${String(i + 1).padStart(2, "0")}`, 5));
const missing = (k: number) => [...full(5), row("2026-01-10", 5 - k)];
describe("autoLevel (monthly missed prayers)", () => {
  it("0 missed is Çok İyi", () => expect(autoLevel(full(5), TODAY).level).toBe("Çok İyi"));
  it("1 missed is Çok İyi", () => expect(autoLevel(missing(1), TODAY).level).toBe("Çok İyi"));
  it("2 missed is İyi", () => expect(autoLevel(missing(2), TODAY).level).toBe("İyi"));
  it("3 missed is İyi", () => expect(autoLevel(missing(3), TODAY).level).toBe("İyi"));
  it("4 missed is Orta", () => expect(autoLevel(missing(4), TODAY).level).toBe("Orta"));
  it("5 missed is Zayıf", () => expect(autoLevel(missing(5), TODAY).level).toBe("Zayıf"));
  it("a geç prayer caps at İyi", () => expect(autoLevel([...full(4), row("2026-01-09", 5, { Sabah: "gec" })], TODAY).level).toBe("İyi"));
  it("an izinli prayer caps at İyi", () => expect(autoLevel([...full(4), row("2026-01-09", 4, { Yatsı: "izinli" })], TODAY).level).toBe("İyi"));
  it("misses in an earlier month do not count", () => expect(autoLevel([row("2025-12-30", 0), ...full(3)], TODAY).level).toBe("Çok İyi"));
  it("no records this month is Yeni", () => expect(autoLevel([], TODAY).level).toBe("Yeni"));
});
