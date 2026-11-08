import type { AttendanceRow, Student } from "./store";
import { buildChart, type Range } from "./report";

export type ReportKind = "daily" | "weekly" | "monthly";

export const KIND_LABEL: Record<ReportKind, string> = { daily: "Günlük", weekly: "Haftalık", monthly: "Aylık" };

const pad = (n: number) => String(n).padStart(2, "0");
const key = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;

/** Today's date in Istanbul (UTC+3, no DST). */
export function istanbulToday(now = new Date()) {
  return key(new Date(now.getTime() + 3 * 3600_000));
}

/** Range ending on `today`: that day, Monday–Sunday week, or calendar month. */
export function kindRange(kind: ReportKind, today: string): Range {
  const d = new Date(`${today}T00:00:00Z`);
  if (kind === "daily") return { start: today, end: today };
  if (kind === "weekly") {
    const off = (d.getUTCDay() + 6) % 7;
    return { start: key(new Date(d.getTime() - off * 86400_000)), end: key(new Date(d.getTime() + (6 - off) * 86400_000)) };
  }
  return { start: key(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1))), end: key(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0))) };
}

export const isLastDayOfMonth = (today: string) => kindRange("monthly", today).end === today;

export type AbsenceLine = { name: string; gun: number; vakit: number };

/**
 * Who missed prayers in the range: missed days = days with at least one X and no ✓/G;
 * missed vakit = number of X marks. Unmarked vakit stay blank and never count.
 */
export function absenceSummary(students: Student[], rows: AttendanceRow[], range: Range): AbsenceLine[] {
  const chart = buildChart(students, rows, range);
  return chart.rows
    .map((r) => ({
      name: r.name,
      vakit: r.katilmadi,
      gun: r.days.filter((m) => m.includes("X") && !m.includes("✓") && !m.includes("G")).length,
    }))
    .filter((l) => l.vakit > 0)
    .sort((a, b) => b.vakit - a.vakit || a.name.localeCompare(b.name, "tr"));
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
const fmt = (s: string) => `${s.slice(8, 10)}.${s.slice(5, 7)}.${s.slice(0, 4)}`;

export type EmailSection = { label: string; lines: AbsenceLine[] };

const sectionHtml = ({ label, lines }: EmailSection) => {
  const body = lines.length
    ? `<table style="border-collapse:collapse;font-size:14px"><tr style="background:#e5f1eb"><th style="border:1px solid #999;padding:6px 10px;text-align:left">Adı Soyadı</th><th style="border:1px solid #999;padding:6px 10px">Katılmadığı Gün</th><th style="border:1px solid #999;padding:6px 10px">Katılmadığı Vakit</th></tr>${lines
        .map((l) => `<tr><td style="border:1px solid #999;padding:6px 10px">${esc(l.name)}</td><td style="border:1px solid #999;padding:6px 10px;text-align:center">${l.gun}</td><td style="border:1px solid #999;padding:6px 10px;text-align:center;color:#c43434;font-weight:bold">${l.vakit}</td></tr>`)
        .join("")}</table>`
    : `<p>Bu dönemde namaza katılmayan talebe yok.</p>`;
  return `<h3 style="color:#22634a;margin:20px 0 6px">${esc(label)}</h3><p>Namaza katılmayan talebeler: <b>${lines.length}</b></p>${body}`;
};

/** One email for all groups; each group gets its own section. */
export function absenceEmail(kind: ReportKind, range: Range, sections: EmailSection[]) {
  const period = range.start === range.end ? fmt(range.start) : `${fmt(range.start)} – ${fmt(range.end)}`;
  const subject = `${KIND_LABEL[kind]} Yoklama Raporu · ${period}`;
  const body = sections.length ? sections.map(sectionHtml).join("") : `<p>Kayıtlı talebe yok.</p>`;
  const html = `<div style="font-family:Arial,sans-serif;color:#222"><h2 style="color:#22634a">${esc(subject)}</h2>${body}<p style="color:#888;font-size:12px">Talebe Takip Paneli tarafından otomatik gönderildi.</p></div>`;
  return { subject, html };
}

export function parseEmails(text: string) {
  return [...new Set(text.split(/[\s,;]+/).map((s) => s.trim().toLowerCase()).filter((s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)))];
}

/** Who gets a report: weekly/monthly always go to everyone; daily goes to the chosen teachers (empty/null choice = everyone). */
export function reportTargets(kind: ReportKind, recipients: string[], daily: string[] | null | undefined): string[] {
  if (kind !== "daily" || !daily || !daily.length) return recipients;
  const chosen = recipients.filter((r) => daily.includes(r));
  return chosen.length ? chosen : recipients;
}
