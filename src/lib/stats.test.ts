import { describe, expect, it } from "vitest";
import { CELL_LETTER, COLUMNS, cellStatus, computeStats, dayResult, monthly, setCellStatus } from "./stats";

const rows = [
  { id: "1", studentId: "s", date: "2026-10-21", vakitler: [], ders: false, durum: "izinli" as const },
  { id: "2", studentId: "s", date: "2026-10-22", vakitler: ["Sabah", "Öğle", "İkindi", "Akşam", "Yatsı"], ders: true, durum: "normal" as const },
  { id: "3", studentId: "s", date: "2026-10-23", vakitler: ["Akşam"], ders: false, durum: "gec" as const },
];

describe("stats", () => {
  const empty = { vakitler: [], ders: false, durum: "normal" as const, durumlar: {} };
  it("permission for Akşam does not affect other prayers or lesson", () => {
    const r = setCellStatus(empty, "Akşam", "izinli");
    expect(COLUMNS.map((c) => CELL_LETTER[cellStatus(r, c)])).toEqual(["X", "X", "X", "İ", "X", "X"]);
  });
  it("late replaces attendance without requiring a tick", () => {
    const r = setCellStatus(setCellStatus(empty, "Akşam", "geldi"), "Akşam", "gec");
    expect(r.vakitler).toEqual([]);
    expect(cellStatus(r, "Akşam")).toBe("gec");
    expect(dayResult({ ...r, id: "late", studentId: "s", date: "2026-11-01" })).toBe("katildi");
  });
  it("permission replaces attendance", () => {
    const r = setCellStatus(setCellStatus(empty, "Akşam", "geldi"), "Akşam", "izinli");
    expect(r.vakitler).toEqual([]);
    expect(cellStatus(r, "Akşam")).toBe("izinli");
  });
  it("attendance replaces late and permission notes", () => {
    for (const status of ["gec", "izinli"] as const) {
      const r = setCellStatus(setCellStatus(empty, "Akşam", status), "Akşam", "geldi");
      expect(r.vakitler).toEqual(["Akşam"]);
      expect(r.durumlar).toEqual({});
    }
  });
  it("sickness marks only the selected cell with H", () => {
    const r = setCellStatus(empty, "Ders", "hasta");
    expect(COLUMNS.map((c) => CELL_LETTER[cellStatus(r, c)])).toEqual(["X", "X", "X", "X", "X", "H"]);
  });
  it("unmarked cells are X", () => {
    expect(COLUMNS.map((c) => CELL_LETTER[cellStatus(undefined, c)])).toEqual(["X", "X", "X", "X", "X", "X"]);
  });
  it("normalizes old permission while keeping untouched cells", () => {
    const r = setCellStatus({ vakitler: [], ders: false, durum: "izinli" }, "Akşam", "yok");
    expect(COLUMNS.map((c) => CELL_LETTER[cellStatus(r, c)])).toEqual(["İ", "İ", "İ", "X", "İ", "İ"]);
  });
  it("counts days by type", () => {
    const s = computeStats(rows);
    expect([s.toplam, s.ders, s.gec, s.izinli, s.vakit["Akşam"]]).toEqual([3, 1, 1, 1, 2]);
  });
  it("monthly percentages", () => {
    expect(monthly(rows)[0]).toMatchObject({ namaz: 40, ders: 33 });
  });
});
