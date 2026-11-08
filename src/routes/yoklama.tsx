import { localIso } from "@/lib/utils";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Calendar, Save, Check } from "@/components/app/icons";
import { Avatar } from "@/components/app/AppShell";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/app/Sheet";
import { useStore, type AttendanceRow } from "@/lib/store";
import { VAKITLER, COLUMNS, CELL_LABEL, CELL_LETTER, cellStatus, came, setCellStatus, type CellStatus } from "@/lib/stats";

export const Route = createFileRoute("/yoklama")({
  head: () => ({ meta: [
    { title: "Günlük Yoklama — Kur'an Kursu" },
    { name: "description", content: "Beş vakit namaz ve ders yoklamasını işaretleyip kaydedin." },
    { property: "og:title", content: "Günlük Yoklama — Kur'an Kursu" },
    { property: "og:description", content: "Beş vakit namaz ve ders yoklamasını işaretleyip kaydedin." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: Yoklama,
});

type Row = Pick<AttendanceRow, "vakitler" | "ders" | "durum" | "durumlar">;
const emptyRow = (): Row => ({ vakitler: [], ders: false, durum: "normal", durumlar: {} });
const notes = ["gec", "izinli", "hasta"] as const;
const statusClass = (status: CellStatus) => status === "geldi" ? "border-primary bg-primary text-primary-foreground" : status === "gec" ? "border-warn bg-amber-soft text-warn" : status === "izinli" ? "border-info bg-sky-soft text-info" : status === "hasta" ? "border-destructive bg-destructive/10 text-destructive" : "border-border bg-surface text-muted-foreground";

function Yoklama() {
  const { students, attendance, saveDay } = useStore();
  const [date, setDate] = useState(localIso());
  const [marks, setMarks] = useState<Record<string, Row>>({});
  const [saved, setSaved] = useState(false);
  const [mode, setMode] = useState<"hepsi" | "tek">("hepsi");
  const [tek, setTek] = useState<string>(VAKITLER[0]);
  const [selected, setSelected] = useState<{ id: string; column: string } | null>(null);

  useEffect(() => {
    const m: Record<string, Row> = {};
    for (const a of attendance.filter((x) => x.date === date)) m[a.studentId] = { vakitler: a.vakitler, ders: a.ders, durum: a.durum, ...(a.durumlar ? { durumlar: a.durumlar } : {}) };
    setMarks(m);
  }, [date, attendance]);

  const d = new Date(date + "T12:00");
  const label = d.toLocaleDateString("tr-TR", { day: "numeric", month: "short", year: "numeric" });
  const day = d.toLocaleDateString("tr-TR", { weekday: "long" });
  const get = (id: string): Row => marks[id] ?? emptyRow();
  /** Every tap is saved at once, so a forgotten "Kaydet" or a date/page change never loses marks. */
  const commit = (next: Record<string, Row>) => {
    setMarks(next);
    saveDay(date, students.map((s) => ({ studentId: s.id, ...(next[s.id] ?? emptyRow()) })));
    setSaved(true);
  };
  const change = (id: string, column: string, status: CellStatus) => commit({ ...marks, [id]: setCellStatus(get(id), column, status) });
  const markAll = () => {
    const allOn = students.every((s) => came(cellStatus(get(s.id), tek)));
    const next = { ...marks };
    for (const s of students) next[s.id] = setCellStatus(get(s.id), tek, allOn ? "yok" : "geldi");
    commit(next);
  };
  const tekCount = students.filter((s) => came(cellStatus(get(s.id), tek))).length;
  const save = () => commit(marks);

  return (
    <>
      <h2 className="mt-4 font-serif text-2xl font-bold">Günlük Yoklama</h2>
      <div className="mt-2 flex items-center justify-between gap-2">
        <label className="relative flex min-w-0 items-center gap-1.5 rounded-lg border border-border px-2.5 py-2 text-xs" title={day}>
          <Calendar className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span>{label} <span className="hidden text-muted-foreground sm:inline">· {day}</span></span>
          <input aria-label="Yoklama tarihi" type="date" value={date} onChange={(e) => { if (e.target.value) { setDate(e.target.value); setSaved(false); } }} className="absolute inset-0 w-full opacity-0" />
        </label>
        <Button onClick={save} disabled={!students.length} size="sm" className="shrink-0">{saved ? <Check /> : <Save />} {saved ? "Kaydedildi" : "Yoklamayı Kaydet"}</Button>
      </div>
      <p className="mt-1.5 text-[11px] text-muted-foreground">Her işaret anında otomatik kaydedilir. İşaretlenmeyen hücre X (gelmedi) sayılır.</p>
      <div className="mt-2 grid grid-cols-2 gap-1 rounded-lg bg-surface p-1 text-sm">
        {([["hepsi", "Tüm Vakitler"], ["tek", "Tek Namaz"]] as const).map(([k, l]) => (
          <Button key={k} variant="ghost" size="sm" onClick={() => setMode(k)} aria-pressed={mode === k} className={mode === k ? "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground" : "text-muted-foreground"}>{l}</Button>
        ))}
      </div>
      {mode === "tek" && <div className="mt-2 grid grid-cols-6 gap-1">{COLUMNS.map((c) => <Button key={c} variant="outline" size="sm" onClick={() => setTek(c)} aria-pressed={tek === c} className={`px-0 ${tek === c ? "border-primary bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground" : "border-border bg-card text-foreground"}`}>{c}</Button>)}</div>}
      {students.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-border bg-card p-6 text-center text-sm text-muted-foreground">Yoklama almak için önce <Link to="/" className="font-medium text-primary underline">talebe ekleyin</Link>.</div>
      ) : mode === "tek" ? (
        <div className="mt-3 overflow-hidden rounded-2xl border border-border bg-card">
          <div className="flex items-center justify-between gap-2 bg-brand-soft px-3 py-3">
            <span className="text-sm font-semibold">{tek} <span className="font-normal text-muted-foreground">· {tekCount}/{students.length} geldi</span></span>
            <Button variant="outline" size="sm" onClick={markAll}>{students.every((s) => came(cellStatus(get(s.id), tek))) ? "Hepsini Kaldır" : "Hepsi Geldi"}</Button>
          </div>
          {students.map((s) => {
            const status = cellStatus(get(s.id), tek);
            return <div key={s.id} className="flex items-center gap-2 border-t border-border px-3 py-3">
              <span className="hidden sm:block"><Avatar name={s.name} size="xs" /></span>
              <Link to="/talebe/$name" params={{ name: s.id }} title={`${s.name} — profil ve bilgiler`} className="min-w-0 flex-1 break-words text-sm leading-snug hover:text-primary hover:underline">{s.name}</Link>
              <Button variant="ghost" size="icon" onClick={() => change(s.id, tek, status === "geldi" ? "yok" : "geldi")} aria-label={`${s.name} ${tek} Geldi`} aria-pressed={status === "geldi"} title={CELL_LABEL[status]} className={`h-8 w-8 shrink-0 border ${statusClass(status)}`}>{status === "geldi" ? <Check /> : CELL_LETTER[status]}</Button>
              {notes.map((note) => <Button key={note} variant="ghost" size="sm" onClick={() => change(s.id, tek, status === note ? "yok" : note)} aria-label={`${s.name} ${tek} ${CELL_LABEL[note]}`} aria-pressed={status === note} className={`h-8 w-10 shrink-0 border px-0 text-[11px] ${status === note ? statusClass(note) : "border-border bg-surface text-muted-foreground"}`}>{CELL_LABEL[note]}</Button>)}
            </div>;
          })}
        </div>
      ) : (
        <div className="mt-3 overflow-hidden rounded-2xl border border-border bg-card">
          <div className="flex items-center gap-2 bg-brand-soft px-3 py-2 text-muted-foreground">
            <span className="min-w-0 flex-1 text-[11px] font-semibold">Adı Soyadı</span>
            <div className="flex shrink-0 gap-[3px]">{COLUMNS.map((c) => <span key={c} className="w-7 text-center text-[8px] leading-none">{c}</span>)}</div>
          </div>
          {students.map((s) => <div key={s.id} className="flex items-center gap-2 border-t border-border px-3 py-2.5">
            <div className="flex min-w-0 flex-1 items-center gap-2"><span className="hidden sm:block"><Avatar name={s.name} size="xs" /></span><Link to="/talebe/$name" params={{ name: s.id }} title={`${s.name} — profil ve bilgiler`} className="min-w-0 flex-1 break-words text-xs leading-snug hover:text-primary hover:underline">{s.name}</Link></div>
            <div className="flex shrink-0 gap-[3px]">{COLUMNS.map((c) => {
              const status = cellStatus(get(s.id), c);
              return <Button key={c} variant="ghost" size="icon" onClick={() => setSelected({ id: s.id, column: c })} aria-label={`${s.name} ${c} ${CELL_LABEL[status]}`} title={`${c}: ${CELL_LABEL[status]}`} className={`h-8 w-7 shrink-0 border text-xs ${statusClass(status)}`}>{status === "geldi" ? <Check /> : CELL_LETTER[status]}</Button>;
            })}</div>
          </div>)}
        </div>
      )}
      <Sheet open={selected !== null} onClose={() => setSelected(null)} title={`${students.find((s) => s.id === selected?.id)?.name ?? ""} · ${selected?.column ?? ""}`}>
        <div className="grid grid-cols-2 gap-2">{(["geldi", "gec", "izinli", "hasta", "yok"] as const).map((status) => <Button key={status} variant="outline" aria-pressed={selected ? cellStatus(get(selected.id), selected.column) === status : false} className={`h-11 ${statusClass(status)}`} onClick={() => { if (selected) change(selected.id, selected.column, status); setSelected(null); }}>{CELL_LETTER[status]} · {CELL_LABEL[status]}</Button>)}</div>
      </Sheet>
    </>
  );
}
