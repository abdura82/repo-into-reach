import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Avatar } from "@/components/app/AppShell";
import { BlankAttendanceSheet } from "@/components/app/BlankAttendanceSheet";
import { Button } from "@/components/ui/button";
import { useStore } from "@/lib/store";
import { COLUMNS, CELL_LABEL, CELL_LETTER, cellStatus, setCellStatus, type CellStatus } from "@/lib/stats";
import { localIso } from "@/lib/utils";
import { analyzePaperAttendance, type PaperRow } from "@/lib/paper-ai.functions";
import { Calendar, FileText, Camera, ImagePlus, Sparkles, Save, Check } from "@/components/app/icons";

export const Route = createFileRoute("/kagit")({
  head: () => ({
    meta: [
      { title: "Kâğıt Yoklama — Kur'an Kursu" },
      { name: "description", content: "Kâğıt yoklamanın fotoğrafını yükleyin, yapay zekâ kayıtları çıkarsın." },
      { property: "og:title", content: "Kâğıt Yoklama — Kur'an Kursu" },
      { property: "og:description", content: "Kâğıt yoklamanın fotoğrafını yükleyin, yapay zekâ kayıtları çıkarsın." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Kagit,
});

const fmt = (s: string) => new Date(s + "T12:00").toLocaleDateString("tr-TR", { day: "numeric", month: "short", year: "numeric" });
const monthStart = () => { const n = new Date(); return localIso(new Date(n.getFullYear(), n.getMonth(), 1)); };
const MAX_FILES = 6;
/** Tapping a cell cycles through every possible mark. */
const NEXT: Record<CellStatus, CellStatus> = { geldi: "yok", yok: "gec", gec: "izinli", izinli: "hasta", hasta: "geldi" };
const cellCls: Record<CellStatus, string> = {
  geldi: "bg-primary text-primary-foreground",
  yok: "bg-destructive/10 text-destructive",
  gec: "bg-amber-soft text-warn",
  izinli: "bg-sky-soft text-info",
  hasta: "bg-destructive/20 text-destructive",
};

/** Shrink a photo to max 1600px JPEG so uploads stay fast on phones. */
async function toDataUrl(file: File): Promise<string> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * scale);
  c.height = Math.round(bmp.height * scale);
  const context = c.getContext("2d");
  if (!context) { bmp.close(); throw new Error("Fotoğraf hazırlanamadı."); }
  context.drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close();
  return c.toDataURL("image/jpeg", 0.85);
}

/** Quick ranges; the date boxes above still allow any custom start/end. Weeks start on Monday. */
function rangePresets() {
  const n = new Date();
  const y = n.getFullYear(), m = n.getMonth(), d = n.getDate();
  const dow = (n.getDay() + 6) % 7;
  const iso = (yy: number, mm: number, dd: number) => localIso(new Date(yy, mm, dd));
  return [
    { label: "Bu Hafta", start: iso(y, m, d - dow), end: iso(y, m, d - dow + 6) },
    { label: "Geçen Hafta", start: iso(y, m, d - dow - 7), end: iso(y, m, d - dow - 1) },
    { label: "Bu Ay", start: iso(y, m, 1), end: iso(y, m + 1, 0) },
    { label: "Geçen Ay", start: iso(y, m - 1, 1), end: iso(y, m, 0) },
  ];
}

function DateField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="mt-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="mt-2 flex items-center gap-3">
        <Calendar className="h-4 w-4 text-muted-foreground" />
        <input type="date" value={value} onChange={(e) => e.target.value && onChange(e.target.value)}
          className="flex-1 rounded-xl border border-border bg-background px-3 py-3 text-center text-base" />
      </div>
      <p className="mt-1 text-center text-xs text-muted-foreground">{fmt(value)}</p>
    </div>
  );
}

function Kagit() {
  const { students, saveDay } = useStore();
  const analyze = useServerFn(analyzePaperAttendance);
  const [start, setStart] = useState(monthStart);
  const [end, setEnd] = useState(() => localIso());
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [rows, setRows] = useState<PaperRow[] | null>(null);
  const [saved, setSaved] = useState(false);
  const [blankOpen, setBlankOpen] = useState(false);
  const nameOf = (id: string) => students.find((s) => s.id === id)?.name ?? "?";

  const saveRows = (list: PaperRow[]) => {
    const byDate: Record<string, PaperRow[]> = {};
    for (const r of list) (byDate[r.date] ??= []).push(r);
    for (const [date, l] of Object.entries(byDate)) saveDay(date, l.map((r) => ({ studentId: r.studentId, vakitler: r.vakitler, ders: r.ders, durum: "normal" as const, durumlar: r.durumlar ?? {} })));
    setSaved(true);
  };

  // Photos are analysed and written into Yoklama automatically as soon as they are added.
  const run = async (list: File[] = files) => {
    if (!list.length || !students.length) return;
    setBusy(true); setError(""); setRows(null); setSaved(false);
    try {
      if (start > end) throw new Error("Başlangıç tarihi bitişten sonra olamaz.");
      const images = await Promise.all(list.map(toDataUrl));
      const res = await analyze({ data: { images, students: students.map((s) => ({ id: s.id, name: s.name })), start, end } });
      if (!res.ok) setError(res.error);
      else if (!res.rows.length) setError("Fotoğrafta kayıtlı talebelerle eşleşen yoklama bulunamadı.");
      else { setRows(res.rows); saveRows(res.rows); }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analiz yapılamadı. Lütfen tekrar deneyin.");
    } finally {
      setBusy(false);
    }
  };

  const addFiles = (fl: FileList | null) => {
    const next = [...files, ...Array.from(fl ?? [])].slice(0, MAX_FILES);
    setFiles(next);
    setRows(null); setSaved(false); setError("");
    void run(next);
  };

  const toggle = (i: number, c: string) => {
    setRows((rs) => rs?.map((r, j) => j !== i ? r : { ...r, ...setCellStatus(r, c, NEXT[cellStatus(r, c)]), supheli: r.supheli.filter((x) => x !== c) }) ?? null);
    setSaved(false);
  };
  const doubtful = (rows ?? []).reduce((a, r) => a + r.supheli.length, 0);

  const save = () => saveRows(rows ?? []);

  return (
    <>
      <h2 className="mt-7 font-serif text-3xl font-bold">Kâğıt Yoklama</h2>
      <Button variant="outline" onClick={() => setBlankOpen(true)} className="mt-4 h-auto w-full whitespace-normal py-3"><FileText />Boş Yoklama Çizelgesi İndir (PDF / Excel)</Button>
      <BlankAttendanceSheet open={blankOpen} onClose={() => setBlankOpen(false)} />
      <p className="mt-2 text-sm text-muted-foreground">Haftalık veya aylık kâğıt yoklamanın fotoğrafını yükleyin — yapay zekâ kayıtları çıkarır, otomatik olarak Yoklama'ya kaydedilir; gerekirse düzeltip tekrar kaydedebilirsiniz.</p>
      <div className="mt-5 rounded-2xl border border-border bg-card p-5">
        <h3 className="flex items-center gap-3 font-serif text-lg font-bold"><FileText className="h-5 w-5 text-primary" /> Kâğıt Yoklama (Haftalık / Aylık)</h3>
        <DateField label="Başlangıç Tarihi" value={start} onChange={setStart} />
        <DateField label="Bitiş Tarihi" value={end} onChange={setEnd} />
        <div className="mt-4 grid grid-cols-2 gap-2">
          {rangePresets().map((p) => (
            <button key={p.label} onClick={() => { setStart(p.start); setEnd(p.end); }}
              className={`rounded-xl border py-2 text-sm ${start === p.start && end === p.end ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}>
              {p.label}
            </button>
          ))}
        </div>
        <p className="mt-5 text-xs text-muted-foreground">Çizelge Fotoğrafları (en fazla {MAX_FILES})</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <label className="flex items-center gap-3 rounded-xl border border-dashed border-border px-5 py-2 text-sm text-muted-foreground">
            <Camera className="h-4 w-4" /> Fotoğraf Çek
            <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
          </label>
          <label className="flex items-center gap-3 rounded-xl border border-dashed border-border px-5 py-2 text-sm text-muted-foreground">
            <ImagePlus className="h-4 w-4" /> Galeriden Seç
            <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
          </label>
        </div>
        {files.length > 0 && (
          <p className="mt-2 flex items-center gap-3 text-xs text-primary">
            {files.length} fotoğraf seçildi
            <button onClick={() => { setFiles([]); setRows(null); }} className="underline">Temizle</button>
          </p>
        )}
        {students.length === 0 && <p className="mt-3 text-xs text-destructive">Analiz için önce Menü'den talebe ekleyin.</p>}
        <button onClick={() => run()} disabled={!files.length || !students.length || busy} className="mt-4 flex items-center gap-3 rounded-xl bg-primary px-6 py-2.5 text-sm text-primary-foreground disabled:opacity-50">
          <Sparkles className={`h-4 w-4 ${busy ? "animate-pulse" : ""}`} /> {busy ? "Analiz ediliyor… (1 dk sürebilir)" : "AI ile Analiz Et"}
        </button>
        {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
      </div>

      {rows && (
        <div className="mt-5 rounded-2xl border border-border bg-card p-4">
          <h3 className="font-serif text-lg font-bold">Kontrol Tablosu</h3>
          <p className="mt-1 text-xs text-muted-foreground">Her hücreyi kâğıtla karşılaştırın. Yanlış okunan hücreye dokundukça değişir: ✓ Geldi → X Gelmedi → G Geç → İ İzinli → H Hasta. Aynı gün için önceki yoklama üzerine yazılır.</p>
          {doubtful > 0 && <p className="mt-2 rounded-lg border-2 border-warn bg-amber-soft px-3 py-2 text-xs font-medium text-warn">Sarı çerçeveli {doubtful} hücreyi yapay zekâ net okuyamadı. Lütfen kâğıda bakıp kontrol edin.</p>}
          <div className="mt-3 space-y-2">
            {rows.map((r, i) => (
              <div key={r.studentId + r.date} className="rounded-xl border border-border p-3">
                <div className="flex items-center gap-3">
                  <Avatar name={nameOf(r.studentId)} size="sm" />
                  <p className="min-w-0 flex-1 truncate text-sm font-semibold">{nameOf(r.studentId)}</p>
                  <span className="text-xs text-muted-foreground">{fmt(r.date)}</span>
                </div>
                <div className="mt-2 grid grid-cols-6 gap-1">
                  {COLUMNS.map((c) => {
                    const st = cellStatus(r, c);
                    const doubt = r.supheli.includes(c);
                    return (
                      <button key={c} onClick={() => toggle(i, c)} aria-label={`${nameOf(r.studentId)} ${c} ${CELL_LABEL[st]}`} title={`${c}: ${CELL_LABEL[st]}`} className={`flex flex-col items-center rounded-lg py-1 text-[10px] leading-tight ${cellCls[st]} ${doubt ? "ring-2 ring-warn ring-offset-1" : ""}`}>
                        <span>{c}</span>
                        <span className="text-sm font-bold">{CELL_LETTER[st]}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          <button onClick={save} disabled={saved} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm text-primary-foreground disabled:opacity-60">
            {saved ? <><Check className="h-4 w-4" /> Kaydedildi</> : <><Save className="h-4 w-4" /> {rows.length} Kaydı Yoklamaya Kaydet</>}
          </button>
        </div>
      )}
    </>
  );
}
