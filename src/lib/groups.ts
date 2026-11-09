import type { State, Student } from "./store";

export type GroupId = "ihzari" | "ibtidai";

export const GROUPS: { id: GroupId; label: string }[] = [
  { id: "ibtidai", label: "İbtidai" },
  { id: "ihzari", label: "İhzari" },
];

export const STUDENT_GROUPS = ["Hazırlık", "İbtidai 1", "İbtidai 2", "İhzari"] as const;
export const normalizeStudentGroup = (value: string) =>
  STUDENT_GROUPS.find((label) => label === value) ?? STUDENT_GROUPS[0];

export const groupLabel = (g: GroupId) => GROUPS.find((x) => x.id === g)?.label ?? "İhzari";

/** Top line of every downloaded çizelge (PDF, Excel and blank paper). */
export const chartHeading = (g: GroupId) => `HARAR 5 ${groupLabel(g).toLocaleUpperCase("tr")} GRUP YOKLAMA TAKİP ÇİZELGESİ`;

/** Preserve unclassified records in the previously active İhzari class. */
export const groupOf = (s: Pick<Student, "sinif">): GroupId => s.sinif === "ibtidai" ? "ibtidai" : "ihzari";

export const isGroupId = (v: unknown): v is GroupId => v === "ihzari" || v === "ibtidai";

/** One group's students plus only the attendance and tutanak rows of those students. */
export function sliceGroup(state: State, g: GroupId): State {
  const students = state.students.filter((s) => groupOf(s) === g);
  const ids = new Set(students.map((s) => s.id));
  return {
    students,
    attendance: state.attendance.filter((r) => ids.has(r.studentId)),
    tutanaklar: state.tutanaklar.filter((t) => ids.has(t.studentId)),
  };
}

/** Replaces one group's data with `slice`, leaving the other group untouched. */
export function replaceGroup(state: State, g: GroupId, slice: State): State {
  const oldIds = new Set(state.students.filter((s) => groupOf(s) === g).map((s) => s.id));
  return {
    students: [...state.students.filter((s) => groupOf(s) !== g), ...slice.students.map((s) => ({ ...s, sinif: g }))],
    attendance: [...state.attendance.filter((r) => !oldIds.has(r.studentId)), ...slice.attendance],
    tutanaklar: [...state.tutanaklar.filter((t) => !oldIds.has(t.studentId)), ...slice.tutanaklar],
  };
}
