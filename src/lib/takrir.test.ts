import { describe, it, expect } from "vitest";
import { createTakrirDay, setTakrir, takrirStats, shiftTakrirDate, takrirReportRange } from "./takrir";

describe("takrir", () => {
  it("a new takrir day starts everyone as vermedi", () => {
    const d = createTakrirDay([], "x", "2026-01-05", ["a", "b"]);
    expect(takrirStats(d, "a")).toEqual({ verdi: 0, vermedi: 1 });
  });
  it("marking verdi counts as a verdi day", () => {
    const d = setTakrir(createTakrirDay([], "x", "2026-01-05", ["a"]), "2026-01-05", "a", true);
    expect(takrirStats(d, "a")).toEqual({ verdi: 1, vermedi: 0 });
  });
  it("unmarked students count as vermedi without a second mark", () => {
    const d = setTakrir(createTakrirDay([], "x", "2026-01-05", ["a", "b"]), "2026-01-05", "a", true);
    expect(takrirStats(d, "b")).toEqual({ verdi: 0, vermedi: 1 });
  });
  it("toggling verdi off restores vermedi", () => {
    let d = createTakrirDay([], "x", "2026-01-05", ["a"]);
    d = setTakrir(d, "2026-01-05", "a", true);
    d = setTakrir(d, "2026-01-05", "a", false);
    expect(takrirStats(d, "a")).toEqual({ verdi: 0, vermedi: 1 });
  });
  it("days without a takrir session are not counted", () => {
    let d = createTakrirDay([], "x", "2026-01-05", ["a"]);
    d = createTakrirDay(d, "y", "2026-01-09", ["a"]);
    d = setTakrir(d, "2026-01-09", "a", true);
    expect(takrirStats(d, "a")).toEqual({ verdi: 1, vermedi: 1 });
  });
  it("creating the same day twice keeps one session", () => {
    const d = createTakrirDay(createTakrirDay([], "x", "2026-01-05", ["a"]), "y", "2026-01-05", ["a"]);
    expect(d).toHaveLength(1);
  });
});

import { takrirRange, takrirDaysInRange } from "./takrir";
describe("takrir geçmiş", () => {
  const sun = new Date(2026, 10, 8); // Pazar 8 Kasım 2026
  it("dünden önceki gün seçilebilir", () => expect(shiftTakrirDate("2026-11-08", -2)).toBe("2026-11-06"));
  it("önceki ve sonraki gün yıl sınırını geçer", () => {
    expect(shiftTakrirDate("2026-01-01", -1)).toBe("2025-12-31");
    expect(shiftTakrirDate("2025-12-31", 1)).toBe("2026-01-01");
  });
  it("günlük PDF yalnızca seçilen günü içerir", () => expect(takrirReportRange("2026-11-07", "day")).toEqual({ from: "2026-11-07", to: "2026-11-07" }));
  it("haftalık PDF seçilen tarihin haftasını içerir", () => expect(takrirReportRange("2026-11-01", "week")).toEqual({ from: "2026-10-26", to: "2026-11-01" }));
  it("dün = bir önceki gün", () => expect(takrirRange("dun", sun)).toEqual({ from: "2026-11-07", to: "2026-11-07" }));
  it("bu hafta Pazartesi–Pazar", () => expect(takrirRange("bu-hafta", sun)).toEqual({ from: "2026-11-02", to: "2026-11-08" }));
  it("geçen hafta", () => expect(takrirRange("gecen-hafta", sun)).toEqual({ from: "2026-10-26", to: "2026-11-01" }));
  it("aralıktaki günler yeniden eskiye", () => {
    const days = ["2026-10-30", "2026-11-03", "2026-10-28"].map((date) => ({ id: date, date, results: {} }));
    expect(takrirDaysInRange(days, "2026-10-26", "2026-11-01").map((d) => d.date)).toEqual(["2026-10-30", "2026-10-28"]);
  });
});

import { weekStart, weekEnd, takrirWeeks } from "./takrir";
describe("takrir haftası", () => {
  it("Pazar gününün haftası Pazartesi başlar", () => expect(weekStart("2026-11-08")).toBe("2026-11-02"));
  it("hafta Pazar biter", () => expect(weekEnd("2026-11-02")).toBe("2026-11-08"));
  it("takrir olan haftalar yeniden eskiye, tekrar etmeden", () => {
    const days = ["2026-10-27", "2026-11-03", "2026-10-29"].map((date) => ({ id: date, date, results: {} }));
    expect(takrirWeeks(days)).toEqual(["2026-11-02", "2026-10-26"]);
  });
});
