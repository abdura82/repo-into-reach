import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2, Check } from "./icons";
import { useStore, type Student } from "@/lib/store";
import { studentTakrirHistory } from "@/lib/development";
import { summarizeDevelopment } from "@/lib/development-ai.functions";

export function DevelopmentPanel({ student }: { student: Student }) {
  const { takrirler, updateStudent } = useStore();
  const history = studentTakrirHistory(takrirler, student.id);
  const generate = useServerFn(summarizeDevelopment);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const notes = student.developmentNotes ?? "";
  const saved = student.developmentSummary;
  const stale = saved && (saved.notes !== notes || saved.history !== JSON.stringify(history));
  const run = async () => {
    setBusy(true); setError("");
    try {
      const reply = await generate({ data: { notes, history } });
      if (reply.ok) updateStudent(student.id, { developmentSummary: { ...reply.result, createdAt: new Date().toISOString(), notes, history: JSON.stringify(history) } });
      else setError(reply.error);
    } catch { setError("Gelişim özeti hazırlanamadı. Notlarınız korundu."); }
    finally { setBusy(false); }
  };
  return <section className="mt-5 space-y-4">
    <h3 className="font-serif text-2xl font-bold">Gelişim Takibi</h3>
    <label className="block text-sm font-medium">Öğretmen Notları
      <textarea aria-label="Öğretmen Notları" value={notes} maxLength={6000} disabled={busy} onChange={(e) => updateStudent(student.id, { developmentNotes: e.target.value })} className="mt-2 min-h-40 w-full resize-y rounded-lg border border-border bg-card p-3 text-sm leading-relaxed text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
    </label>
    <div className="flex justify-between text-xs text-muted-foreground"><span className="inline-flex items-center gap-1"><Check className="h-3 w-3" /> Notlar kaydedildi</span><span>{notes.length}/6000</span></div>
    <div className="border-y border-border py-3">
      <div className="flex items-center justify-between"><h4 className="text-sm font-semibold">Takrir Geçmişi</h4><Button variant="ghost" size="sm" asChild><Link to="/takrir">Takrir</Link></Button></div>
      <p className="text-sm text-muted-foreground">{history.filter((h) => h.verdi).length} verdi · {history.filter((h) => !h.verdi).length} vermedi</p>
      {history.length ? <details className="mt-2 text-sm"><summary className="cursor-pointer text-primary">{history.length} günlük kayıt</summary><ul className="mt-2 max-h-48 overflow-y-auto">{[...history].reverse().map((h) => <li key={h.date} className="flex justify-between border-b border-border py-2"><span>{new Date(h.date + "T12:00").toLocaleDateString("tr-TR")}</span><span className={h.verdi ? "text-good" : "text-muted-foreground"}>{h.verdi ? "Verdi" : "Vermedi"}</span></li>)}</ul></details> : <p className="mt-2 text-xs text-muted-foreground">Kayıtlı takrir günü yok.</p>}
    </div>
    <p className="text-xs text-muted-foreground">Değerlendirme için notlar ve takrir tarihleri AI ile paylaşılır; isim ve iletişim bilgileri gönderilmez.</p>
    <Button onClick={run} disabled={busy || !notes.trim()} className="w-full">{busy ? <Loader2 className="animate-spin" /> : <Sparkles />}{busy ? "Değerlendiriliyor…" : saved ? "Gelişim Özetini Yenile" : "Gelişim Özeti Hazırla"}</Button>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {saved && <div className="space-y-4 border-t border-border pt-4" aria-label="Gelişim değerlendirmesi">
      {stale && <p className="text-xs text-warn">Notlar veya takrir geçmişi değişti; bu özet önceki kayıtlara aittir.</p>}
      <p className="text-xs text-muted-foreground">{new Date(saved.createdAt).toLocaleString("tr-TR")}</p>
      <h4 className="font-serif text-xl font-bold">Gelişim Özeti</h4><p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{saved.summary}</p>
      <h4 className="font-semibold">Güçlü Yönler</h4><ul className="list-disc space-y-2 pl-5 text-sm">{saved.strengths.map((s, i) => <li key={i} className="break-words">{s}</li>)}</ul>
      <h4 className="font-semibold">Takip Önerileri</h4><ul className="list-disc space-y-2 pl-5 text-sm">{saved.followUp.map((s, i) => <li key={i} className="break-words">{s}</li>)}</ul>
      <p className="text-xs text-muted-foreground">AI değerlendirmesi öğretmen gözleminin yerine geçmez.</p>
    </div>}
  </section>;
}