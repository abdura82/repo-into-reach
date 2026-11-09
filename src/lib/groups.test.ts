import { describe, expect, it } from "vitest";
import { chartHeading, groupOf, GROUPS, isGroupId, normalizeStudentGroup, replaceGroup, sliceGroup, STUDENT_GROUPS } from "./groups";
import type { Student } from "./store";

const st = (id: string, sinif?: string): Student => ({
  id, name: id, age: "", group: "", city: "", startDate: "", guardian: "", phone: "", status: "İyi", sinif: sinif as Student["sinif"],
});

describe("İbtidai and İhzari classes", () => {
  it("supports both class switches", () => {
    expect(GROUPS.map((g) => g.id)).toEqual(["ibtidai", "ihzari"]);
    expect(isGroupId("ibtidai")).toBe(true);
    expect(isGroupId("ihzari")).toBe(true);
    expect(isGroupId("other")).toBe(false);
  });
  it("keeps unclassified records in İhzari and restores explicit İbtidai records", () => {
    expect(groupOf(st("old"))).toBe("ihzari");
    expect(groupOf(st("a", "ibtidai"))).toBe("ibtidai");
    const state = { students: [st("old"), st("a", "ibtidai"), st("z", "ihzari")], attendance: [], tutanaklar: [] };
    expect(sliceGroup(state, "ihzari").students.map((s) => s.id)).toEqual(["old", "z"]);
    expect(sliceGroup(state, "ibtidai").students.map((s) => s.id)).toEqual(["a"]);
  });
  it("labels charts İhzari", () => {
    expect(chartHeading("ihzari")).toBe("HARAR 5 İHZARİ GRUP YOKLAMA TAKİP ÇİZELGESİ");
  });
  it("offers only the four requested student groups", () => {
    expect(STUDENT_GROUPS).toEqual(["Hazırlık", "İbtidai 1", "İbtidai 2", "İhzari"]);
    expect(normalizeStudentGroup("Hafızlık")).toBe("Hazırlık");
    for (const label of STUDENT_GROUPS) expect(normalizeStudentGroup(label)).toBe(label);
  });
  it("keeps the other class and its records when replacing one class", () => {
    const attendance = ["a", "z"].map((studentId) => ({ id: studentId, studentId, date: "2026-11-09", vakitler: [], ders: false, durum: "normal" as const }));
    const tutanaklar = ["a", "z"].map((studentId) => ({ id: studentId, studentId, title: "", tag: "", date: "2026-11-09", body: "", positive: false, signed: false }));
    const state = { students: [st("a", "ibtidai"), st("z", "ihzari")], attendance, tutanaklar };
    expect(sliceGroup(state, "ibtidai").attendance.map((r) => r.studentId)).toEqual(["a"]);
    expect(sliceGroup(state, "ihzari").tutanaklar.map((r) => r.studentId)).toEqual(["z"]);
    const replaced = replaceGroup(state, "ibtidai", { students: [st("new")], attendance: [], tutanaklar: [] });
    expect(replaced.students.map((s) => [s.id, s.sinif])).toEqual([["z", "ihzari"], ["new", "ibtidai"]]);
    expect(replaced.attendance.map((r) => r.studentId)).toEqual(["z"]);
    expect(replaced.tutanaklar.map((r) => r.studentId)).toEqual(["z"]);
  });
});
