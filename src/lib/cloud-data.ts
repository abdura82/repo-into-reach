/** What a cloud backup holds: the same four lists the device keeps locally. */
export type Snapshot = {
  students: unknown[];
  tutanaklar: unknown[];
  attendance: unknown[];
  takrirler: unknown[];
};

/** Anything shaped like the device's state; the lists are copied as they are. */
export type SnapshotInput = {
  students?: unknown[];
  tutanaklar?: unknown[];
  attendance?: unknown[];
  takrirler?: unknown[];
};

export type SnapshotCounts = { students: number; tutanaklar: number; attendance: number; takrirler: number; days: number };

/** Device state -> cloud backup shape (missing lists become empty ones). */
export function toSnapshot(s: SnapshotInput | null | undefined): Snapshot {
  return {
    students: s?.students ?? [],
    tutanaklar: s?.tutanaklar ?? [],
    attendance: s?.attendance ?? [],
    takrirler: s?.takrirler ?? [],
  };
}

export function snapshotCounts(s: Partial<Snapshot> | null | undefined): SnapshotCounts {
  return {
    students: s?.students?.length ?? 0,
    tutanaklar: s?.tutanaklar?.length ?? 0,
    attendance: s?.attendance?.length ?? 0,
    takrirler: s?.takrirler?.length ?? 0,
    days: new Set((s?.attendance ?? []).map((r) => (r as { date?: string })?.date)).size,
  };
}

export function isEmptySnapshot(s: Partial<Snapshot> | null | undefined): boolean {
  const c = snapshotCounts(s);
  return !c.students && !c.tutanaklar && !c.attendance && !c.takrirler;
}

/** JSON with object keys in a fixed order, so a round trip through the database still compares equal. */
function canonical(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonical).join(",")}]`;
  if (v && typeof v === "object") {
    const entries = Object.entries(v as Record<string, unknown>).sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
    return `{${entries.map(([k, val]) => `${JSON.stringify(k)}:${canonical(val)}`).join(",")}}`;
  }
  return JSON.stringify(v ?? null);
}

/** True when both sides hold exactly the same records, whatever order the database returned them in. */
export function sameSnapshot(a: Partial<Snapshot> | null | undefined, b: Partial<Snapshot> | null | undefined): boolean {
  return canonical(toSnapshot(a)) === canonical(toSnapshot(b));
}

/** "3 talebe, 12 günlük yoklama, 4 tutanak, 2 takrir" for confirm dialogs. */
export function describeCounts(c: SnapshotCounts): string {
  return `${c.students} talebe, ${c.days} günlük yoklama, ${c.tutanaklar} tutanak, ${c.takrirler} takrir`;
}

export function describeSnapshot(s: Partial<Snapshot> | null | undefined): string {
  return describeCounts(snapshotCounts(s));
}
