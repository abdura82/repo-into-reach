import { useEffect, useMemo, useState } from "react";
import { Sheet, Field, inputCls } from "./Sheet";
import { Button } from "@/components/ui/button";
import { Download, FileSpreadsheet, FileText, Loader2 } from "./icons";
import { useStore } from "@/lib/store";
import { chartHeading } from "@/lib/groups";
import { buildBlankChart, monthLabel, monthWeeks, periodRange, rangeLabel } from "@/lib/report";
import { deliverFile, makeBlankPdf, makeBlankXlsx } from "@/lib/report-export";
import { localIso } from "@/lib/utils";

export function BlankAttendanceSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { students, group } = useStore();
  const [period, setPeriod] = useState<"gunluk" | "haftalik" | "aylik">("haftalik");
  const [date, setDate] = useState(localIso);
  const [month, setMonth] = useState(() => localIso().slice(0, 7));
  const [weekIndex, setWeekIndex] = useState(() => monthWeeks(localIso().slice(0, 7)).findIndex((w) => w.start <= localIso() && w.end >= localIso()));
  const [studentId, setStudentId] = useState("");
  const [format, setFormat] = useState<"pdf" | "xlsx">("pdf");
  const [ready, setReady] = useState<{ blob: Blob; name: string; key: string } | null>(null);
  const [error, setError] = useState("");
  const weeks = useMemo(() => monthWeeks(month), [month]);
  const range = useMemo(() => period === "gunluk" ? periodRange("gunluk", date) : period === "aylik" ? periodRange("aylik", `${month}-01`) : weeks[weekIndex] ?? periodRange("haftalik", `${month}-01`), [period, date, month, weeks, weekIndex]);
  const periodTitle = period === "gunluk" ? rangeLabel(range) : `${monthLabel(month)}${period === "haftalik" ? ` · ${weekIndex + 1}. hafta` : " · Aylık"}`;
  const selected = useMemo(() => students.filter((s) => !studentId || s.id === studentId), [students, studentId]);
  const key = JSON.stringify([range, selected, format, group, periodTitle]);
  useEffect(() => {
    setReady(null); setError("");
    if (!open || !selected.length) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const chart = buildBlankChart(selected, range);
        const heading = `${chartHeading(group)} · ${periodTitle}`;
        const blob = format === "pdf" ? await makeBlankPdf(chart, heading) : await makeBlankXlsx(chart, heading);
        if (!cancelled) setReady({ blob, name: `siec-bos-yoklama-${group}-${range.start}_${range.end}.${format}`, key });
      } catch { if (!cancelled) setError("Çizelge hazırlanamadı. Lütfen tekrar deneyin."); }
    }, 150);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [open, selected, range, format, key, group, periodTitle]);
  const file = ready?.key === key ? ready : null;
  return <Sheet open={open} onClose={onClose} title="Boş Yoklama Çizelgesi İndir">
    <Field label="Dönem"><div className="grid grid-cols-3 gap-2">{([['gunluk', 'Günlük'], ['haftalik', 'Haftalık'], ['aylik', 'Aylık']] as const).map(([p, label]) => <Button key={p} aria-label={label} variant={p === period ? "default" : "outline"} onClick={() => setPeriod(p)} aria-pressed={p === period}>{label}</Button>)}</div></Field>
    {period === "gunluk" ? <Field label="Gün"><input aria-label="Çizelge tarihi" type="date" className={inputCls} value={date} onChange={(e) => { if (e.target.value) setDate(e.target.value); }} /></Field> : <>
      <Field label="Ay ve yıl"><input aria-label="Çizelge ayı" type="month" className={inputCls} value={month} onChange={(e) => { if (e.target.value) { setMonth(e.target.value); setWeekIndex(0); } }} /></Field>
      {period === "haftalik" && <Field label="Ayın haftası"><select aria-label="Çizelge haftası" className={inputCls} value={weekIndex} onChange={(e) => setWeekIndex(Number(e.target.value))}>{weeks.map((week, index) => <option key={week.start} value={index}>{index + 1}. hafta · {rangeLabel(week)}</option>)}</select></Field>}
    </>}
    <Field label="Talebe"><select className={inputCls} value={studentId} onChange={(e) => setStudentId(e.target.value)}><option value="">Tüm talebeler</option>{students.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
    <Field label="Biçim"><div className="grid grid-cols-2 gap-2"><Button aria-label="PDF" variant={format === "pdf" ? "default" : "outline"} onClick={() => setFormat("pdf")} aria-pressed={format === "pdf"}><FileText />PDF</Button><Button aria-label="Excel" variant={format === "xlsx" ? "default" : "outline"} onClick={() => setFormat("xlsx")} aria-pressed={format === "xlsx"}><FileSpreadsheet />Excel</Button></div></Field>
    <div className="mb-4 text-sm"><p className="font-semibold">{periodTitle}</p><p className="font-medium">{rangeLabel(range)}</p><p className="text-muted-foreground">{selected.length} talebe · Namaz ve ders</p></div>
    {!selected.length && <p className="mb-3 text-sm text-destructive">Önce talebe ekleyin.</p>}
    {error && <p role="alert" className="mb-3 text-sm text-destructive">{error}</p>}
    <Button className="w-full" disabled={!file} onClick={() => { if (file) void deliverFile(file.blob, file.name); }}>{!file && selected.length > 0 && !error ? <><Loader2 className="animate-spin" />Hazırlanıyor…</> : <><Download />{format === "pdf" ? "PDF" : "Excel"} olarak indir</>}</Button>
  </Sheet>;
}