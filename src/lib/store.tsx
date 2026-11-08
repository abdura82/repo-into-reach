import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { isGroupId, replaceGroup, sliceGroup, type GroupId } from "./groups";
import { createTakrirDay, setTakrir, type TakrirDay } from "./takrir";
import type { DevelopmentSummary } from "./development";

export type Student = {
  id: string;
  name: string;
  age: string;
  group: string;
  city: string;
  startDate: string;
  guardian: string;
  /** Guardian phone; the number next to "Veli". */
  phone: string;
  /** The student's own phone; optional so old records stay valid. */
  talebePhone?: string | undefined;
  status: "İyi" | "Orta";
  /** Class the student belongs to; missing on old records = İbtidai. */
  sinif?: GroupId | undefined;
  developmentNotes?: string;
  developmentSummary?: DevelopmentSummary & { createdAt: string; notes: string; history: string };
};

export type Tutanak = {
  id: string;
  studentId: string;
  title: string;
  tag: string;
  date: string;
  body: string;
  positive: boolean;
  signed: boolean;
  /** Attachment ids in IndexedDB (see attachments.ts). */
  photoId?: string | undefined;
  docId?: string | undefined;
  /** Student portrait shown top-right of the tutanak. */
  studentPhotoId?: string | undefined;
};

export type AttendanceRow = {
  id: string;
  studentId: string;
  date: string;
  /** Vakit the student came to on time. */
  vakitler: string[];
  /** Came to the lesson on time. */
  ders: boolean;
  /** Whole-day status from old records; new records keep "normal" and use `durumlar`. */
  durum: "normal" | "izinli" | "gec";
  /** Per vakit/"Ders" status: Geç, İzinli or Hasta. A cell is never both here and in `vakitler`. */
  durumlar?: Partial<Record<string, "gec" | "izinli" | "hasta">>;
};

type Store = {
  /** The active group's students (and below, only their attendance and tutanak). */
  students: Student[];
  tutanaklar: Tutanak[];
  attendance: AttendanceRow[];
  addStudent: (s: Omit<Student, "id">) => void;
  updateStudent: (id: string, s: Partial<Student>) => void;
  removeStudent: (id: string) => void;
  addTutanak: (t: Omit<Tutanak, "id">) => void;
  removeTutanak: (id: string) => void;
  addAttendance: (a: Omit<AttendanceRow, "id">) => void;
  removeAttendance: (id: string) => void;
  updateTutanak: (id: string, t: Partial<Tutanak>) => void;
  saveDay: (date: string, rows: Omit<AttendanceRow, "id" | "date">[]) => void;
  /** Replaces only the active group's data. */
  importAll: (s: State) => void;
  /** Every group's data (backups, report emails). */
  all: State;
  /** Replaces every group's data (backup restore). */
  replaceAll: (s: State) => void;
  /** True once the device's saved data has been read (never during SSR). */
  ready: boolean;
  group: GroupId;
  setGroup: (g: GroupId) => void;
  takrirler: TakrirDay[];
  addTakrirDay: (date: string) => void;
  markTakrir: (date: string, studentId: string, verdi: boolean) => void;
  removeTakrirDay: (date: string) => void;
};

const uid = () => Math.random().toString(36).slice(2, 10);

const KEY = "kuran-kursu-store-v2";
const GROUP_KEY = "kuran-kursu-active-group";

export type State = { students: Student[]; tutanaklar: Tutanak[]; attendance: AttendanceRow[]; takrirler?: TakrirDay[] };

function load(): State {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw) as Partial<State>;
      return { students: s.students ?? [], tutanaklar: s.tutanaklar ?? [], attendance: s.attendance ?? [], takrirler: s.takrirler ?? [] };
    }
  } catch {
    /* ignore */
  }
  return { students: [], tutanaklar: [], attendance: [] };
}

const StoreContext = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>({ students: [], tutanaklar: [], attendance: [] });
  const [ready, setReady] = useState(false);
  const [group, setGroupState] = useState<GroupId>("ihzari");

  useEffect(() => {
    setState(load());
    const g = localStorage.getItem(GROUP_KEY);
    if (isGroupId(g)) setGroupState(g);
    setReady(true);
  }, []);

  const setGroup = (g: GroupId) => {
    setGroupState(g);
    localStorage.setItem(GROUP_KEY, g);
  };
  const view = useMemo(() => sliceGroup(state, group), [state, group]);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch (e) {
      console.error("Veriler kaydedilemedi", e);
      alert("Veriler kaydedilemedi: cihaz hafızası dolu olabilir. Lütfen Menü'den yedek alın.");
    }
  }, [state, ready]);

  const store: Store = {
    ...view,
    takrirler: state.takrirler ?? [],
    addTakrirDay: (date) => setState((p) => ({ ...p, takrirler: createTakrirDay(p.takrirler ?? [], uid(), date, view.students.map((s) => s.id)) })),
    markTakrir: (date, studentId, verdi) => setState((p) => ({ ...p, takrirler: setTakrir(p.takrirler ?? [], date, studentId, verdi) })),
    removeTakrirDay: (date) => setState((p) => ({ ...p, takrirler: (p.takrirler ?? []).filter((d) => d.date !== date) })),
    all: state,
    ready,
    group,
    setGroup,
    addStudent: (s) => setState((p) => ({ ...p, students: [...p.students, { ...s, sinif: s.sinif ?? group, id: uid() }] })),
    updateStudent: (id, s) => setState((p) => ({ ...p, students: p.students.map((x) => (x.id === id ? { ...x, ...s } : x)) })),
    removeStudent: (id) =>
      setState((p) => ({
        ...p,
        students: p.students.filter((x) => x.id !== id),
        tutanaklar: p.tutanaklar.filter((x) => x.studentId !== id),
        attendance: p.attendance.filter((x) => x.studentId !== id),
      })),
    addTutanak: (t) => setState((p) => ({ ...p, tutanaklar: [...p.tutanaklar, { ...t, id: uid() }] })),
    removeTutanak: (id) => setState((p) => ({ ...p, tutanaklar: p.tutanaklar.filter((x) => x.id !== id) })),
    addAttendance: (a) => setState((p) => ({ ...p, attendance: [...p.attendance, { ...a, id: uid() }] })),
    removeAttendance: (id) => setState((p) => ({ ...p, attendance: p.attendance.filter((x) => x.id !== id) })),
    updateTutanak: (id, t) => setState((p) => ({ ...p, tutanaklar: p.tutanaklar.map((x) => (x.id === id ? { ...x, ...t } : x)) })),
    saveDay: (date, rows) =>
      setState((p) => {
        const ids = new Set(rows.map((r) => r.studentId));
        return {
          ...p,
          attendance: [
            ...p.attendance.filter((x) => !(x.date === date && ids.has(x.studentId))),
            ...rows.map((r) => ({ ...r, date, id: uid() })),
          ],
        };
      }),
    importAll: (s) =>
      setState((p) => ({ ...replaceGroup(p, group, { students: s.students ?? [], tutanaklar: s.tutanaklar ?? [], attendance: s.attendance ?? [] }), takrirler: s.takrirler ?? p.takrirler ?? [] })),
    replaceAll: (s) => setState({ students: s.students ?? [], tutanaklar: s.tutanaklar ?? [], attendance: s.attendance ?? [], takrirler: s.takrirler ?? [] }),
  };

  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}
