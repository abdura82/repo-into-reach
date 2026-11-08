import { describe, expect, it } from "vitest";
import { buildBlankChart, buildChart, chartByMonth, buildReport, fileSlug, filterRows, monthWeeks, periodRange } from "./report";
import type { AttendanceRow, Student } from "./store";

const row = (id: string, date: string, vakitler: string[], ders = false, durum: AttendanceRow["durum"] = "normal"): AttendanceRow => ({ id, studentId: "s1", date, vakitler, ders, durum });
const rows = [
  row("1", "2026-01-15", ["Sabah"]),
  row("2", "2026-10-26", ["Sabah", "Öğle", "İkindi", "Akşam", "Yatsı"], true),
  row("3", "2026-10-28", [], false, "izinli"),
  row("4", "2026-11-02", ["Akşam"], true, "gec"),
];

describe("blank paper attendance", () => {
  it("selects a past month in full", () => {
    const chart = buildBlankChart([], periodRange("aylik", "2025-02-01"));
    expect(chart.days[0]).toBe("2025-02-01");
    expect(chart.days.at(-1)).toBe("2025-02-28");
  });
  it("selects a future month in full", () => {
    const chart = buildBlankChart([], periodRange("aylik", "2027-12-01"));
    expect(chart.days[0]).toBe("2027-12-01");
    expect(chart.days.at(-1)).toBe("2027-12-31");
  });
  it("lists every calendar week of the selected month", () => {
    const weeks = monthWeeks("2026-11");
    expect(weeks).toHaveLength(6);
    expect(weeks[0]).toEqual({ start: "2026-10-26", end: "2026-11-01" });
    expect(weeks[1]).toEqual({ start: "2026-11-02", end: "2026-11-08" });
    expect(weeks[5]).toEqual({ start: "2026-11-30", end: "2026-12-06" });
  });
  it("includes all registered students without any attendance records", () => {
    const chart = buildBlankChart([{ id: "b", name: "Bekir" }, { id: "a", name: "Ali" }], { start: "2026-10-31", end: "2026-11-01" });
    expect(chart.rows.map((s) => s.studentId)).toEqual(["a", "b"]);
    expect(chart.days).toEqual(["2026-10-31", "2026-11-01"]);
  });
  it("leaves all five prayers and lesson cells blank for paper marking", () => {
    const chart = buildBlankChart([{ id: "a", name: "Ali" }], { start: "2026-10-31", end: "2026-10-31" });
    expect(chart.columns).toEqual(["Sabah", "Öğle", "İkindi", "Akşam", "Yatsı", "Ders"]);
    expect(chart.rows[0]?.days).toEqual([["", "", "", "", "", ""]]);
  });
});

describe("report periods", () => {
  it("daily covers only the chosen day", () => {
    expect(periodRange("gunluk", "2026-10-28")).toEqual({ start: "2026-10-28", end: "2026-10-28" });
  });
  it("weekly runs Monday to Sunday", () => {
    expect(periodRange("haftalik", "2026-10-28")).toEqual({ start: "2026-10-26", end: "2026-11-01" });
  });
  it("monthly covers the whole calendar month", () => {
    expect(periodRange("aylik", "2026-02-10")).toEqual({ start: "2026-02-01", end: "2026-02-28" });
  });
  it("yearly covers the whole year", () => {
    expect(periodRange("yillik", "2026-10-28")).toEqual({ start: "2026-01-01", end: "2026-12-31" });
  });
  it("all covers every recorded day", () => {
    expect(periodRange("tumu", "2026-10-28", rows)).toEqual({ start: "2026-01-15", end: "2026-11-02" });
  });
  it("filters rows inside the range", () => {
    expect(filterRows(rows, periodRange("haftalik", "2026-10-28")).map((r) => r.id)).toEqual(["2", "3"]);
  });
});

describe("report summary", () => {
  const students: Student[] = [{ id: "s1", name: "Ali", age: "", group: "", city: "", startDate: "", guardian: "", phone: "", status: "İyi" }];
  it("totals prayers, lessons, late and excused days per student", () => {
    const s = buildReport(students, rows.slice(1)).summary[0]!;
    expect(s).toMatchObject({ gun: 3, kilinan: 6, toplamVakit: 15, namazYuzde: 40, ders: 2, dersYuzde: 67, gec: 1, izinli: 1 });
  });
});

describe("file names", () => {
  it("turns Turkish names into safe file names", () => {
    expect(fileSlug("Ahmet Yılmaz")).toBe("ahmet-yilmaz");
    expect(fileSlug("İsmail Çağrı Öztürk")).toBe("ismail-cagri-ozturk");
  });
});

describe("buildChart (namaz takip çizelgesi)", () => {
  it("exports G, İ, H and X for separate prayer cells", () => {
    const students = [{ id: "s1", name: "Ali" }] as Student[];
    const r = { ...row("new", "2026-11-01", []), durumlar: { Sabah: "gec", Akşam: "izinli", Yatsı: "hasta", Ders: "hasta" } as const };
    expect(buildChart(students, [r]).rows[0]?.days).toEqual([["G", "", "", "İ", "H"]]);
    expect(buildReport(students, [r]).detail[0]).toMatchObject({ vakitler: ["G", "X", "X", "İ", "H"], ders: "H" });
    expect(buildReport(students, [r]).summary[0]).toMatchObject({ kilinan: 1, gec: 1, izinli: 1, hasta: 1 });
  });
  it("fills attended and missed totals including late and mixed excuses", () => {
    const students = [{ id: "s1", name: "Ali" }] as Student[];
    const chart = buildChart(students, [
      { ...row("late", "2026-11-01", []), durumlar: { Akşam: "gec" } },
      { ...row("partial", "2026-11-02", []), durumlar: { Akşam: "izinli" } },
      { ...row("excused", "2026-11-03", []), durumlar: { Sabah: "hasta", Öğle: "izinli", İkindi: "hasta", Akşam: "izinli", Yatsı: "hasta" } },
    ]);
    expect(chart.rows[0]).toMatchObject({ katildi: 1, katilmadi: 0 });
    expect(chartByMonth(chart)[0]?.rows[0]).toMatchObject({ katildi: 1, katilmadi: 0 });
  });
  const st = [{ id: "a", name: "Ali" }, { id: "b", name: "Bekir" }] as never[];
  const chartRow = (studentId: string, date: string, vakitler: string[], durum = "normal") => ({ id: studentId + date, studentId, date, vakitler, ders: false, durum }) as never;
  const c = buildChart(st, [
    chartRow("a", "2026-10-01", ["Sabah", "Öğle"]),
    chartRow("a", "2026-10-02", []),
    chartRow("b", "2026-10-01", [], "izinli"),
    chartRow("a", "2026-10-03", ["Yatsı"]),
  ]);
  it("ticks prayed vakit and marks the rest with X", () => {
    expect(c.rows[0]!.days[0]).toEqual(["✓", "✓", "X", "X", "X"]);
  });
  it("counts prayer times attended and missed", () => {
    expect(c.rows[0]!.katildi).toBe(3);
    expect(c.rows[0]!.katilmadi).toBe(3);
  });
  it("leaves a day with no record blank and counts neither missing nor izinli days as missed", () => {
    expect(c.rows[1]!.days[0]).toEqual(["İ", "İ", "İ", "İ", "İ"]);
    expect(c.rows[1]!.katildi).toBe(0);
    expect(c.rows[1]?.days[1]).toEqual(["", "", "", "", ""]);
    expect(c.rows[1]?.katilmadi).toBe(0);
  });
});

describe("full-period attendance charts with only two recorded days", () => {
  const students = [{ id: "s1", name: "Ali" }, { id: "s2", name: "Bekir" }] as Student[];
  const recorded = [row("first", "2026-11-02", ["Sabah"]), row("second", "2026-11-03", [])];

  it("includes all seven days of a weekly export", () => {
    const chart = buildChart(students, recorded, periodRange("haftalik", "2026-11-03"));
    expect(chart.days).toEqual(["2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05", "2026-11-06", "2026-11-07", "2026-11-08"]);
  });

  it("includes the whole month rather than just its two recorded days", () => {
    const chart = buildChart(students, recorded, periodRange("aylik", "2026-11-03"));
    expect(chart.days).toHaveLength(30);
    expect(chart.days[0]).toBe("2026-11-01");
    expect(chart.days.at(-1)).toBe("2026-11-30");
    expect(chartByMonth(chart)[0]?.days).toEqual(chart.days);
  });

  it("keeps unrecorded days blank without adding absences or diluting recorded totals", () => {
    const chart = buildChart(students, recorded, periodRange("aylik", "2026-11-03"));
    expect(chart.rows[0]?.days[0]).toEqual(["", "", "", "", ""]);
    expect(chart.rows[0]?.days[1]).toEqual(["✓", "", "", "", ""]);
    expect(chart.rows[0]?.days[2]).toEqual(["", "", "", "", ""]);
    expect(chart.rows[0]?.days.slice(3).flat().every((mark) => mark === "")).toBe(true);
    expect(chart.rows[0]).toMatchObject({ katildi: 1, katilmadi: 0 });
    expect(chartByMonth(chart)[0]?.rows[0]).toMatchObject({ katildi: 1, katilmadi: 0 });
    expect(chart.rows[1]?.days.flat()).toEqual(Array(150).fill(""));
    expect(chart.rows[1]).toMatchObject({ katildi: 0, katilmadi: 0 });
    expect(buildReport(students, recorded).summary[0]).toMatchObject({ gun: 2, toplamVakit: 10 });
  });
});

describe("chartByMonth", () => {
  const st = [{ id: "a", name: "Ali" }] as never[];
  const row = (date: string, vakitler: string[]) => ({ id: date, studentId: "a", date, vakitler, ders: false, durum: "normal" }) as never;
  const months = chartByMonth(buildChart(st, [row("2026-09-30", ["Sabah"]), row("2026-10-01", []), row("2026-10-02", ["Yatsı"])]));
  it("makes one chart per month in order", () => {
    expect(months.map((m) => m.label)).toEqual(["Eylül 2026", "Ekim 2026"]);
  });
  it("counts prayer times per month only", () => {
    expect(months[0]!.rows[0]).toMatchObject({ katildi: 1, katilmadi: 0 });
    expect(months[1]!.rows[0]).toMatchObject({ katildi: 1, katilmadi: 0 });
  });
});

describe("unmarked vakit stay blank", () => {
  it("leaves vakit nobody was marked for blank instead of X", () => {
    const st = [{ id: "a", name: "Ali" }, { id: "b", name: "Bekir" }] as never[];
    const r = (studentId: string, vakitler: string[]) => ({ id: studentId, studentId, date: "2026-11-02", vakitler, ders: false, durum: "normal" }) as never;
    const c = buildChart(st, [r("a", ["Sabah"]), r("b", [])]);
    expect(c.rows[0]!.days[0]).toEqual(["✓", "", "", "", ""]);
    expect(c.rows[1]!.days[0]).toEqual(["X", "", "", "", ""]);
    expect(c.rows[1]).toMatchObject({ katildi: 0, katilmadi: 1 });
  });
});

describe("report never swaps came / did not come", () => {
  const st = (id: string, name: string) => ({ id, name, age: "", group: "", city: "", startDate: "", guardian: "", phone: "", status: "İyi" as const });
  const studs = [st("a", "Ahmet"), st("b", "Bekir")];
  const range = { start: "2026-11-02", end: "2026-11-02" };

  it("shows ✓ only where the student came and X where he did not", () => {
    const rows = [
      { id: "1", studentId: "a", date: "2026-11-02", vakitler: ["Sabah"], ders: false, durum: "normal" as const, durumlar: {} },
      { id: "2", studentId: "b", date: "2026-11-02", vakitler: [], ders: false, durum: "normal" as const, durumlar: {} },
    ];
    const chart = buildChart(studs, rows, range);
    expect(chart.rows[0]!.days[0]![0]).toBe("✓");
    expect(chart.rows[1]!.days[0]![0]).toBe("X");
    expect(chart.rows[0]!.katildi).toBe(1);
    expect(chart.rows[1]!.katilmadi).toBe(1);
  });

  it("uses the newest record when a day was saved twice", () => {
    const rows = [
      { id: "1", studentId: "a", date: "2026-11-02", vakitler: [], ders: false, durum: "normal" as const, durumlar: {} },
      { id: "2", studentId: "b", date: "2026-11-02", vakitler: ["Sabah"], ders: false, durum: "normal" as const, durumlar: {} },
      { id: "3", studentId: "a", date: "2026-11-02", vakitler: ["Sabah"], ders: false, durum: "normal" as const, durumlar: {} },
    ];
    const chart = buildChart(studs, rows, range);
    expect(chart.rows[0]!.days[0]![0]).toBe("✓");
    expect(chart.rows[0]!.katilmadi).toBe(0);
    expect(buildReport(studs, rows).summary.find((s) => s.name === "Ahmet")!.gun).toBe(1);
  });
});
