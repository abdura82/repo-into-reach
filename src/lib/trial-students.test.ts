import { describe, expect, it } from "vitest";
import { withTrialStudents } from "./trial-students";

describe("55 trial students", () => {
  it("adds exactly 55 trial students", () => {
    expect(withTrialStudents([])).toHaveLength(55);
    expect(new Set(withTrialStudents([]).map((student) => student.id)).size).toBe(55);
  });
  it("preserves existing students and does not duplicate trial students", () => {
    const original = withTrialStudents([])[0];
    if (!original) throw new Error("Expected a trial student");
    const existing = { ...original, id: "real-student", name: "Ali" };
    const added = withTrialStudents([existing]);
    expect(added[0]).toEqual(existing);
    expect(added).toHaveLength(56);
    expect(withTrialStudents(added)).toEqual(added);
  });
});