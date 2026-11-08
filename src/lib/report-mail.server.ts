import type { AttendanceRow, Student } from "./store";
import { absenceEmail, absenceSummary, istanbulToday, kindRange, reportTargets, type ReportKind } from "./absence-report";
import { sendGmail } from "./gmail.server";
import { GROUPS, groupOf } from "./groups";

type Sub = { recipients: string[]; daily_recipients?: string[] | null; students: unknown; attendance: unknown };

export async function sendReportFor(sub: Sub, kind: ReportKind, today = istanbulToday()) {
  const to = reportTargets(kind, sub.recipients, sub.daily_recipients);
  if (!to.length) return;
  const range = kindRange(kind, today);
  const students = sub.students as Student[];
  const rows = sub.attendance as AttendanceRow[];
  const sections = GROUPS.map((g) => ({ label: `${g.label} Grubu`, students: students.filter((s) => groupOf(s) === g.id) }))
    .filter((g) => g.students.length)
    .map((g) => ({ label: g.label, lines: absenceSummary(g.students, rows, range) }));
  const { subject, html } = absenceEmail(kind, range, sections);
  await sendGmail(to, subject, html);
}
