import { describe, expect, it } from "vitest";
import { describeCounts, describeSnapshot, isEmptySnapshot, sameSnapshot, snapshotCounts, toSnapshot } from "./cloud-data";

const students = [{ id: "a", name: "Ahmet", sinif: "ihzari" }];
const attendance = [{ id: "x", studentId: "a", date: "2026-11-08", vakitler: ["sabah"], ders: true, durum: "normal" }];
const tutanaklar = [{ id: "t1", studentId: "a", title: "Ders", tag: "Ödev", date: "2026-11-08", body: "", positive: true, signed: false }];
const takrirler = [{ id: "d1", date: "2026-11-08", results: { a: true } }];

describe("toSnapshot", () => {
  it("keeps every list and fills in the missing ones", () => {
    const s = toSnapshot({ students, attendance });
    expect(s.students).toHaveLength(1);
    expect(s.attendance).toHaveLength(1);
    expect(s.tutanaklar).toEqual([]);
    expect(s.takrirler).toEqual([]);
  });

  it("survives a null state", () => {
    expect(isEmptySnapshot(toSnapshot(null))).toBe(true);
  });
});

describe("sameSnapshot", () => {
  it("says the cloud and the device match even when the database reordered keys", () => {
    const device = toSnapshot({ students, attendance, tutanaklar, takrirler });
    const cloud = toSnapshot({ takrirler, tutanaklar, attendance, students: [{ name: "Ahmet", sinif: "ihzari", id: "a" }] });
    expect(sameSnapshot(device, cloud)).toBe(true);
  });

  it("notices a changed record", () => {
    const device = toSnapshot({ students, attendance, tutanaklar, takrirler });
    const cloud = toSnapshot({ students: [{ id: "a", name: "Mehmet", sinif: "ihzari" }], attendance, tutanaklar, takrirler });
    expect(sameSnapshot(device, cloud)).toBe(false);
  });

  it("notices an extra attendance row", () => {
    const device = toSnapshot({ students, attendance, tutanaklar, takrirler });
    const cloud = toSnapshot({ students, attendance: [...attendance, { ...attendance[0], id: "y", date: "2026-11-07" }], tutanaklar, takrirler });
    expect(sameSnapshot(device, cloud)).toBe(false);
  });
});

describe("describeSnapshot", () => {
  it("counts talebe, yoklama days, tutanak and takrir", () => {
    const s = toSnapshot({ students, attendance: [...attendance, { ...attendance[0], id: "y", date: "2026-11-07" }], tutanaklar, takrirler });
    expect(describeSnapshot(s)).toBe("1 talebe, 2 günlük yoklama, 1 tutanak, 1 takrir");
  });

  it("counts the lists it is given", () => {
    expect(snapshotCounts(toSnapshot({ students, attendance, tutanaklar, takrirler }))).toEqual({ students: 1, tutanaklar: 1, attendance: 1, takrirler: 1, days: 1 });
  });

  it("describes counts without needing the records themselves", () => {
    expect(describeCounts(snapshotCounts(toSnapshot({ students, attendance: [...attendance, { ...attendance[0], id: "y", date: "2026-11-07" }], tutanaklar, takrirler })))).toBe("1 talebe, 2 günlük yoklama, 1 tutanak, 1 takrir");
  });
});
