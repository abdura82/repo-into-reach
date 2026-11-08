import type { AttendanceRow } from "./store";

export const VAKITLER = ["Sabah", "Öğle", "İkindi", "Akşam", "Yatsı"] as const;
export const COLUMNS = [...VAKITLER, "Ders"] as const;

/** One cell of the yoklama (one vakit or the lesson). "yok" = not marked = did not come. */
export type CellStatus = "geldi" | "gec" | "izinli" | "hasta" | "yok";
export type CellNote = "gec" | "izinli" | "hasta";

export const CELL_LETTER = { geldi: "✓", gec: "G", izinli: "İ", hasta: "H", yok: "X" } as const;
export const CELL_LABEL: Record<CellStatus, string> = { geldi: "Geldi", gec: "Geç", izinli: "İzinli", hasta: "Hasta", yok: "Gelmedi" };

/** Status of one vakit/ders cell. Each cell has exactly one status. */
export function cellStatus(r: Pick<AttendanceRow, "vakitler" | "ders" | "durum" | "durumlar"> | undefined, c: string): CellStatus {
  if (!r) return "yok";
  const note = r.durumlar?.[c];
  if (note) return note;
  if (c === "Ders" ? r.ders : r.vakitler.includes(c)) return "geldi";
  // Old records stored İzinli for the whole day.
  if (!r.durumlar && r.durum === "izinli") return "izinli";
  return "yok";
}

export const came = (s: CellStatus) => s === "geldi" || s === "gec";

/** One record per student per day: if a day was saved twice (old backups, imports) the newest (last) one wins. */
export function latestPerDay<T extends Pick<AttendanceRow, "studentId" | "date">>(rows: T[]): T[] {
  const by = new Map<string, T>();
  for (const r of rows) {
    const k = `${r.studentId}|${r.date}`;
    by.delete(k);
    by.set(k, r);
  }
  return [...by.values()];
}

/** A blank record: every cell "yok" until marked. */
export const emptyCells = () => ({ vakitler: [] as string[], ders: false, durum: "normal" as const, durumlar: {} as NonNullable<AttendanceRow["durumlar"]> });

/** Replace one cell, preserving the other cells and normalizing legacy day-wide permission. */
export function setCellStatus(r: Pick<AttendanceRow, "vakitler" | "ders" | "durum" | "durumlar">, c: string, status: CellStatus) {
  const durumlar: NonNullable<AttendanceRow["durumlar"]> = {};
  for (const col of COLUMNS) {
    const current = col === c ? status : cellStatus(r, col);
    if (current === "gec" || current === "izinli" || current === "hasta") durumlar[col] = current;
  }
  const vakitler = VAKITLER.filter((col) => (col === c ? status : cellStatus(r, col)) === "geldi");
  const ders = (c === "Ders" ? status : cellStatus(r, "Ders")) === "geldi";
  return { vakitler, ders, durum: "normal" as const, durumlar };
}

/** Vakit (or ders) the student came to — on time or late. */
export const prayedCount = (r: AttendanceRow) => VAKITLER.filter((v) => came(cellStatus(r, v))).length;

const hasNote = (r: AttendanceRow, n: CellNote) =>
  r.durumlar ? Object.values(r.durumlar).includes(n) : r.durum === n;

/** katıldı = came to at least one cell; katılmadı = came to none and at least one unexcused cell; otherwise excused (neither). */
export function dayResult(r: AttendanceRow | undefined, cols: readonly string[] = VAKITLER): "katildi" | "katilmadi" | "mazeret" {
  const s = cols.map((c) => cellStatus(r, c));
  if (s.some(came)) return "katildi";
  return s.includes("yok") ? "katilmadi" : "mazeret";
}

export function computeStats(rows: AttendanceRow[]) {
  const vakit = Object.fromEntries(VAKITLER.map((v) => [v, rows.filter((r) => came(cellStatus(r, v))).length])) as Record<string, number>;
  return {
    toplam: rows.length,
    ders: rows.filter((r) => came(cellStatus(r, "Ders"))).length,
    gec: rows.filter((r) => hasNote(r, "gec")).length,
    izinli: rows.filter((r) => hasNote(r, "izinli")).length,
    hasta: rows.filter((r) => hasNote(r, "hasta")).length,
    katilmadi: rows.filter((r) => dayResult(r, COLUMNS) === "katilmadi").length,
    namazGun: rows.filter((r) => prayedCount(r) > 0).length,
    /** Prayers (vakit cells) attended with the congregation, on time or late. */
    namazKilinan: rows.reduce((a, r) => a + prayedCount(r), 0),
    /** Prayers (vakit cells) not attended with the congregation: gelmedi, izinli or hasta. */
    namazKacirilan: rows.reduce((a, r) => a + VAKITLER.filter((v) => !came(cellStatus(r, v))).length, 0),
    /** Lesson days attended (on time or late) vs not attended (any other status). */
    dersKatilmadi: rows.filter((r) => !came(cellStatus(r, "Ders"))).length,
    /** Vakit cells (prayers only) by note. */
    gecVakit: rows.reduce((a, r) => a + VAKITLER.filter((v) => cellStatus(r, v) === "gec").length, 0),
    izinliVakit: rows.reduce((a, r) => a + VAKITLER.filter((v) => cellStatus(r, v) === "izinli").length, 0),
    hastaVakit: rows.reduce((a, r) => a + VAKITLER.filter((v) => cellStatus(r, v) === "hasta").length, 0),
    vakit,
  };
}

/** Days from the student's first record up to today, both inclusive (0 when no records). */
export function daysSinceFirst(rows: Pick<AttendanceRow, "date">[], today: Date = new Date()): number {
  if (!rows.length) return 0;
  const first = rows.map((r) => r.date).sort()[0] ?? "";
  const [y = 0, m = 1, d = 1] = first.split("-").map(Number);
  const start = Date.UTC(y, m - 1, d);
  const end = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.max(0, Math.round((end - start) / 86400000)) + 1;
}

const AYLAR = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];

export function monthly(rows: AttendanceRow[]) {
  const by: Record<string, AttendanceRow[]> = {};
  for (const r of rows) (by[r.date.slice(0, 7)] ??= []).push(r);
  return Object.keys(by)
    .sort()
    .slice(-6)
    .map((k) => {
      const list = by[k] ?? [];
      const vakitSum = list.reduce((a, r) => a + prayedCount(r), 0);
      return {
        key: k,
        ay: AYLAR[Number(k.slice(5, 7)) - 1] ?? k,
        namaz: Math.round((vakitSum / (list.length * 5)) * 100),
        ders: Math.round((list.filter((r) => came(cellStatus(r, "Ders"))).length / list.length) * 100),
      };
    });
}

export type AutoLevel = "Çok İyi" | "İyi" | "Orta" | "Zayıf" | "Yeni";
export const LEVEL_ORDER: Record<AutoLevel, number> = { "Çok İyi": 0, "İyi": 1, "Orta": 2, "Zayıf": 3, "Yeni": 4 };

/** Automatic status from all prayer + lesson cells; İzinli/Hasta cells are not counted against the student. */
/**
 * Monthly level from missed prayers (namaz only, ders excluded) in the given month:
 * 0–1 missed = Çok İyi, 2–3 = İyi, 4 = Orta, 5+ = Zayıf.
 * Any geç / hasta / izinli prayer that month caps the result at İyi.
 */
export function autoLevel(rows: AttendanceRow[], today: Date = new Date()): { level: AutoLevel; rate: number; missed: number } {
  const month = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul", year: "numeric", month: "2-digit" }).format(today);
  const monthRows = latestPerDay(rows).filter((r) => r.date.slice(0, 7) === month);
  let missed = 0, total = 0, came_ = 0, flagged = false;
  for (const r of monthRows) for (const c of VAKITLER) {
    const s = cellStatus(r, c);
    total++;
    if (s === "yok") missed++;
    else if (s === "geldi") came_++;
    else { flagged = true; if (s === "gec") came_++; }
  }
  if (total === 0) return { level: "Yeni", rate: 0, missed: 0 };
  let level: AutoLevel = missed <= 1 ? "Çok İyi" : missed <= 3 ? "İyi" : missed === 4 ? "Orta" : "Zayıf";
  if (flagged && level === "Çok İyi") level = "İyi";
  return { level, rate: came_ / total, missed };
}
