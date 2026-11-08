import { useState } from "react";
import { Button } from "@/components/ui/button";
import { PdfButton } from "@/components/app/PdfButton";
import { useStore } from "@/lib/store";
import { groupLabel } from "@/lib/groups";
import { takrirDaysInRange, takrirReportRange } from "@/lib/takrir";
import { Printer } from "@/components/app/icons";

const fmt = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("tr-TR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
const short = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("tr-TR", { day: "numeric", month: "long" });

/** One export area anchored to the same date as the daily marks. */
export function TakrirHistory({ date }: { date: string }) {
  const { students, takrirler, group } = useStore();
  const [period, setPeriod] = useState<"day" | "week">("day");
  const [printing, setPrinting] = useState(false);
  const [error, setError] = useState("");
  const { from, to } = takrirReportRange(date, period);
  const days = takrirDaysInRange(takrirler, from, to);
  const hasRecords = days.some((d) => students.some((s) => s.id in d.results));

  const make = async () => {
    const { makeTakrirPdf } = await import("@/lib/takrir-pdf");
    const blob = await makeTakrirPdf(students, days, from, to, groupLabel(group));
    return { blob, name: `takrir-raporu-${from}-${to}.pdf` };
  };
  const print = async () => {
    const w = window.open("", "_blank");
    setPrinting(true);
    setError("");
    try {
      const { blob } = await make();
      const url = URL.createObjectURL(blob);
      if (w) w.location.href = url; else window.location.href = url;
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      w?.close();
      setError("Rapor hazırlanamadı. Lütfen tekrar deneyin.");
    } finally { setPrinting(false); }
  };

  return <section aria-label="Takrir raporu" className="mt-6 space-y-3 border-t border-border py-4">
      <h3 className="text-sm font-semibold">Takrir Raporu</h3>
      <div className="grid grid-cols-2 gap-1 rounded-lg bg-surface p-1">
        {([ ["day", "Seçili Gün"], ["week", "Seçili Hafta"] ] as const).map(([value, label]) => <Button key={value} variant="ghost" size="sm" aria-pressed={period === value} onClick={() => setPeriod(value)} className={period === value ? "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground" : "text-muted-foreground"}>{label}</Button>)}
      </div>
      <p className="text-xs text-muted-foreground">{period === "day" ? fmt(from) : `${short(from)} – ${short(to)} ${to.slice(0, 4)}`}</p>
      {!hasRecords && <p className="text-xs text-muted-foreground">Bu dönemde takrir kaydı yok.</p>}
      <div className="grid grid-cols-2 gap-2">
        {hasRecords ? <PdfButton key={`${group}-${from}-${to}`} make={make} depsKey={`${group}-${from}-${to}-${JSON.stringify(days)}-${JSON.stringify(students)}`} label="PDF İndir" className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-border bg-background text-sm font-medium hover:bg-accent disabled:opacity-50" /> : <Button variant="outline" className="h-11" disabled>PDF İndir</Button>}
        <Button variant="outline" className="h-11" disabled={!hasRecords || printing} onClick={() => void print()}><Printer />{printing ? "Hazırlanıyor…" : "Yazdır"}</Button>
      </div>
      {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
  </section>;
}
