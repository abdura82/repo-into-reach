import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, Calendar, CalendarCheck, Check, Plus, Trash2 } from "@/components/app/icons";
import { Button } from "@/components/ui/button";
import { useStore } from "@/lib/store";
import { groupLabel } from "@/lib/groups";
import { localIso } from "@/lib/utils";
import { shiftTakrirDate } from "@/lib/takrir";

export const Route = createFileRoute("/takrir")({
  head: () => ({ meta: [
    { title: "Takrir — Kur'an Kursu" },
    { name: "description", content: "Takrir yapılan günleri oluşturun ve talebelerin takrir verdiğini kaydedin." },
    { property: "og:title", content: "Takrir — Kur'an Kursu" },
    { property: "og:description", content: "Takrir günleri ve talebelerin takrir kayıtları." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  validateSearch: (s: Record<string, unknown>): { date?: string } => (typeof s["date"] === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s["date"]) ? { date: s["date"] } : {}),
  component: Takrir,
});

function Takrir() {
  const { students, takrirler, addTakrirDay, markTakrir, removeTakrirDay, group } = useStore();
  const search = Route.useSearch();
  const [date, setDate] = useState(search.date ?? localIso());
  const [filter, setFilter] = useState<"all" | "verdi" | "vermedi">("all");
  const selectDate = (next: string) => { setDate(next); setFilter("all"); };
  const session = takrirler.find((d) => d.date === date);
  const verdiCount = students.filter((s) => session?.results[s.id] === true).length;
  const visibleStudents = filter === "all" ? students : students.filter((s) => (session?.results[s.id] === true) === (filter === "verdi"));

  return <>
    <div className="mt-4 flex items-center justify-between gap-3">
      <div className="min-w-0">
        <h2 className="font-serif text-3xl font-bold">Takrir</h2>
        <p className="mt-1 text-sm text-muted-foreground">{groupLabel(group)} Grubu</p>
      </div>
      <Button variant="ghost" size="sm" asChild className="shrink-0"><Link to="/menu"><ArrowLeft /> Menü</Link></Button>
    </div>
    <div className="mt-5 border-y border-border py-4">
      <label className="block text-xs font-medium text-muted-foreground" htmlFor="takrir-date">Takrir tarihi</label>
      <div className="mt-2 flex min-w-0 flex-wrap items-center gap-2">
      <Button variant="outline" size="icon" className="h-11 w-9 shrink-0" aria-label="Önceki gün" title="Önceki gün" onClick={() => selectDate(shiftTakrirDate(date, -1))}><ArrowLeft /></Button>
      <div className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-lg border border-border bg-card px-3">
        <Calendar className="h-4 w-4 shrink-0 text-muted-foreground" />
        <input id="takrir-date" aria-label="Takrir tarihi" type="date" value={date} onChange={(e) => { if (e.target.value) selectDate(e.target.value); }} className="h-full w-full min-w-0 bg-transparent text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
      </div>
      <Button variant="outline" size="icon" className="h-11 w-9 shrink-0" aria-label="Sonraki gün" title="Sonraki gün" onClick={() => selectDate(shiftTakrirDate(date, 1))}><ArrowLeft className="rotate-180" /></Button>
      </div>
      <div className="mt-3 flex justify-end">
      {session ? <Button variant="outline" size="icon" aria-label="Takriri sil" title="Takriri sil" className="h-11 w-11 shrink-0 text-destructive" onClick={() => { if (confirm("Bu günün takririni silmek istiyor musunuz?")) removeTakrirDay(date); }}><Trash2 /></Button>
        : <Button className="h-11 shrink-0 gap-1.5 px-3 text-xs" disabled={!students.length} onClick={() => addTakrirDay(date)}><Plus className="h-4 w-4" />Takrir Oluştur</Button>}
      </div>
    </div>
    {!students.length || !session ? <div className="flex flex-col items-center gap-3 py-12 text-muted-foreground">
        <CalendarCheck className="h-9 w-9 text-primary/60" strokeWidth={1.5} />
        <p className="text-center text-sm">{!students.length ? "Henüz talebe yok." : "Bu gün takrir yok."}</p>
      </div>
      : <div className="mt-4">
        <div className="mb-3 flex items-center justify-between gap-2 text-sm">
          <Button variant="ghost" size="sm" aria-pressed={filter === "verdi"} onClick={() => setFilter((current) => current === "verdi" ? "all" : "verdi")} className={filter === "verdi" ? "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground" : "text-primary"}>{verdiCount} verdi</Button>
          <Button variant="ghost" size="sm" aria-pressed={filter === "vermedi"} onClick={() => setFilter((current) => current === "vermedi" ? "all" : "vermedi")} className={filter === "vermedi" ? "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground" : "text-muted-foreground"}>{students.length - verdiCount} vermedi</Button>
        </div>
        <div className="overflow-hidden rounded-lg border border-border bg-card">
        {visibleStudents.map((s) => {
          const verdi = session.results[s.id] === true;
          return <div key={s.id} className="flex min-h-16 items-center gap-3 border-t border-border px-3 py-3 first:border-t-0">
            <Link to="/talebe/$name" params={{ name: s.id }} className="min-w-0 flex-1 break-words text-sm font-medium leading-relaxed hover:text-primary hover:underline">{s.name}</Link>
            <Button variant="outline" size="sm" aria-label={`${s.name} Takrir ${verdi ? "Verdi" : "Vermedi"}`} aria-pressed={verdi} onClick={() => markTakrir(date, s.id, !verdi)} className={`relative h-10 w-24 shrink-0 justify-center px-2 ${verdi ? "border-primary bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground" : "text-foreground"}`}>
              <Check className={`absolute left-2 h-4 w-4 ${verdi ? "opacity-100" : "opacity-0"}`} />
              <span className="text-center">{verdi ? "Verdi" : "Vermedi"}</span>
            </Button>
          </div>;
        })}
        </div>
      </div>}
  </>;
}
