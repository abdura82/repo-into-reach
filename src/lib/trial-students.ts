import type { Student } from "./store";
import type { GroupId } from "./groups";

/** Id prefix of a group's trial students (İbtidai keeps the original ids). */
export const trialPrefix = (group: GroupId = "ihzari") => (group === "ihzari" ? "trial-ihzari-" : "trial-student-");

/** Stable trial identifiers make repeated additions harmless to existing data. */
export function withTrialStudents(students: Student[], group: GroupId = "ihzari"): Student[] {
  const existing = new Set(students.map((student) => student.id));
  const trial = Array.from({ length: 55 }, (_, index): Student => ({
    id: `${trialPrefix(group)}${index + 1}`,
    name: `Deneme Talebesi ${String(index + 1).padStart(2, "0")}`,
    age: "", group: "Deneme", city: "", startDate: "", guardian: "", phone: "", status: "İyi", sinif: group,
  }));
  return [...students, ...trial.filter((student) => !existing.has(student.id))];
}
