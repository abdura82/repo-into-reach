import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx-js-style";
import { buildChart, buildReport, periodRange } from "./report";
import { makePdf, makeXlsx } from "./report-export";
import type { AttendanceRow, Student } from "./store";

const student = (id: string, name: string): Student => ({
  id, name, age: "12", group: "A", city: "İstanbul", startDate: "2026-09-01", guardian: "Veli", phone: "0", status: "İyi",
});
const students = [student("s1", "Ali"), student("s2", "Veli")];
const rows: AttendanceRow[] = [
  { id: "1", studentId: "s1", date: "2026-11-02", vakitler: ["Sabah", "Öğle"], ders: true, durum: "normal" },
  { id: "2", studentId: "s2", date: "2026-11-03", vakitler: [], ders: false, durum: "normal" },
];

const input = () => {
  const range = periodRange("aylik", "2026-11-05", rows);
  return {
    report: buildReport(students, rows),
    chart: buildChart(students, rows, range),
    title: "Aylık Yoklama Raporu",
    rangeText: "Kas 2026",
    fileBase: "yoklama",
  };
};

/** jsdom'un Blob'u arrayBuffer() desteklemediği için dosyayı FileReader ile oku. */
const readBlob = (blob: Blob) =>
  new Promise<Uint8Array>((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(new Uint8Array(fr.result as ArrayBuffer));
    fr.onerror = () => reject(fr.error);
    fr.readAsArrayBuffer(blob);
  });

describe("report downloads", () => {
  it("Excel workbook holds only the namaz takip çizelgesi sheet", async () => {
    const blob = await makeXlsx(input());
    const wb = XLSX.read(await readBlob(blob), { type: "array" });
    expect(wb.SheetNames).toEqual(["Kasım 2026"]);
  });

  it("PDF holds only the çizelge pages, no özet page", async () => {
    const original = globalThis.fetch;
    globalThis.fetch = async (url: RequestInfo | URL) =>
      new Response(readFileSync(String(url).includes("Bold") ? "public/fonts/DejaVuSans-Bold.ttf" : "public/fonts/DejaVuSans.ttf"));
    try {
      const blob = await makePdf(input());
      const text = Buffer.from(await readBlob(blob)).toString("latin1");
      const counts = [...text.matchAll(/\/Count\s+(\d+)/g)].map((m) => Number(m[1]));
      // Kasım: 30 gün, sayfa başına 15 gün = 2 çizelge sayfası; özet sayfası eklenseydi 4 olurdu.
      expect(Math.max(...counts)).toBe(2);
    } finally {
      globalThis.fetch = original;
    }
  });
});

describe("group heading in downloads", () => {
  it("Excel çizelge starts with the group heading", async () => {
    const blob = await makeXlsx({ ...input(), heading: "HARAR 5 İHZARİ GRUP YOKLAMA TAKİP ÇİZELGESİ" });
    const wb = XLSX.read(await readBlob(blob), { type: "array" });
    const ws = wb.Sheets[wb.SheetNames[0]!]!;
    expect(String(ws["A1"]?.v)).toMatch(/^HARAR 5 İHZARİ GRUP YOKLAMA TAKİP ÇİZELGESİ/);
  });
});
