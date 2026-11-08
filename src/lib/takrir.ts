/** A takrir session the teacher creates on a day when takrir happens; not every day has one. */
export type TakrirDay = {
  id: string;
  date: string;
  /** studentId -> gave takrir? Students present at creation start as "vermedi". */
  results: Record<string, boolean>;
};

export function createTakrirDay(days: TakrirDay[], id: string, date: string, studentIds: string[]): TakrirDay[] {
  if (days.some((d) => d.date === date)) return days;
  return [...days, { id, date, results: Object.fromEntries(studentIds.map((s) => [s, false])) }];
}

export function setTakrir(days: TakrirDay[], date: string, studentId: string, verdi: boolean): TakrirDay[] {
  return days.map((d) => (d.date === date ? { ...d, results: { ...d.results, [studentId]: verdi } } : d));
}

/** Counts only takrir days where the student is listed, so days without takrir never count. */
export function takrirStats(days: TakrirDay[], studentId: string): { verdi: number; vermedi: number } {
  let verdi = 0, vermedi = 0;
  for (const d of days) {
    if (!(studentId in d.results)) continue;
    if (d.results[studentId]) verdi++;
    else vermedi++;
  }
  return { verdi, vermedi };
}

export type TakrirRange = "dun" | "bu-hafta" | "gecen-hafta";

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Calendar-day navigation, including month/year boundaries and daylight-saving days. */
export function shiftTakrirDate(date: string, offset: number): string {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() + offset);
  return iso(d);
}

export function takrirReportRange(date: string, period: "day" | "week"): { from: string; to: string } {
  const from = period === "day" ? date : weekStart(date);
  return { from, to: period === "day" ? date : weekEnd(from) };
}

/** Inclusive [from, to] ISO dates; weeks run Monday–Sunday. */
export function takrirRange(range: TakrirRange, today: Date): { from: string; to: string } {
  const d = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  if (range === "dun") { d.setDate(d.getDate() - 1); return { from: iso(d), to: iso(d) }; }
  const monday = new Date(d); monday.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  if (range === "gecen-hafta") monday.setDate(monday.getDate() - 7);
  const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6);
  return { from: iso(monday), to: iso(sunday) };
}

/** Takrir days inside the range, newest first. */
export function takrirDaysInRange(days: TakrirDay[], from: string, to: string): TakrirDay[] {
  return days.filter((d) => d.date >= from && d.date <= to).sort((a, b) => b.date.localeCompare(a.date));
}

/** Monday (ISO) of the week containing the given ISO date. */
export function weekStart(dateIso: string): string {
  const d = new Date(`${dateIso}T12:00:00`);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return iso(d);
}

export function weekEnd(mondayIso: string): string {
  const d = new Date(`${mondayIso}T12:00:00`);
  d.setDate(d.getDate() + 6);
  return iso(d);
}

/** Distinct weeks (Monday ISO) that have takrir days, newest first. */
export function takrirWeeks(days: TakrirDay[]): string[] {
  return [...new Set(days.map((d) => weekStart(d.date)))].sort((a, b) => b.localeCompare(a));
}
