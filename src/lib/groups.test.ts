import { describe, expect, it } from "vitest";
import { chartHeading, groupOf, GROUPS, sliceGroup } from "./groups";
import type { Student } from "./store";

const st = (id: string, sinif?: string): Student => ({
  id, name: id, age: "", group: "", city: "", startDate: "", guardian: "", phone: "", status: "İyi", sinif: sinif as Student["sinif"],
});

describe("single İhzari group", () => {
  it("has no İbtidai group", () => {
    expect(GROUPS.map((g) => g.id)).toEqual(["ihzari"]);
  });
  it("moves old İbtidai and group-less students into İhzari", () => {
    expect(groupOf(st("old"))).toBe("ihzari");
    expect(groupOf(st("a", "ibtidai"))).toBe("ihzari");
    const state = { students: [st("old"), st("a", "ibtidai"), st("z", "ihzari")], attendance: [], tutanaklar: [] };
    expect(sliceGroup(state, "ihzari").students.map((s) => s.id)).toEqual(["old", "a", "z"]);
  });
  it("labels charts İhzari", () => {
    expect(chartHeading("ihzari")).toBe("HARAR 5 İHZARİ GRUP YOKLAMA TAKİP ÇİZELGESİ");
  });
});
