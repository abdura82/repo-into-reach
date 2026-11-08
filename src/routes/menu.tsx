import { localIso } from "@/lib/utils";
import { Link, createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense, useRef, useState } from "react";
import { Download, Upload, FileDown, UserPlus, Sparkles, Mail, BookOpen} from "@/components/app/icons";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Sheet } from "@/components/app/Sheet";
import { StudentForm, emptyStudent } from "@/components/app/StudentForm";
import { useStore, type State } from "@/lib/store";
import { exportFiles, importFiles } from "@/lib/attachments";
import { groupLabel } from "@/lib/groups";

// Heavy sheets load only when opened, so the Menu page opens instantly.
const EmailReports = lazy(() => import("@/components/app/EmailReports").then((m) => ({ default: m.EmailReports })));
const ReportSheet = lazy(() => import("@/components/app/ReportSheet").then((m) => ({ default: m.ReportSheet })));
const BlankAttendanceSheet = lazy(() => import("@/components/app/BlankAttendanceSheet").then((m) => ({ default: m.BlankAttendanceSheet })));
const CloudBackup = lazy(() => import("@/components/app/CloudBackup").then((m) => ({ default: m.CloudBackup })));
const CloudSummary = lazy(() => import("@/components/app/CloudBackup").then((m) => ({ default: m.CloudSummary })));

export const Route = createFileRoute("/menu")({
  head: () => ({
    meta: [
      { title: "Menü — Kur'an Kursu" },
      { name: "description", content: "Kur'an kursu verilerini yedekleyin ve geri yükleyin." },
      { property: "og:title", content: "Menü — Kur'an Kursu" },
      { property: "og:description", content: "Kur'an kursu verilerini yedekleyin ve geri yükleyin." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Menu,
});

function Menu() {
  const { students, tutanaklar, attendance, importAll, addStudent, all, replaceAll, group } = useStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState("");
  const [reportOpen, setReportOpen] = useState(false);
  const [blankOpen, setBlankOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [mailOpen, setMailOpen] = useState(false);
  const [exportAsk, setExportAsk] = useState(false);
  const [importAsk, setImportAsk] = useState(false);
  const [pending, setPending] = useState<{ name: string; data: State & { files?: Parameters<typeof importFiles>[0] } } | null>(null);

  // Backups always hold both groups.
  const exportData = async () => {
    const ids = all.tutanaklar.flatMap((t) => [t.photoId, t.docId]).filter((x): x is string => Boolean(x));
    const files = ids.length ? await exportFiles(ids).catch(() => ({})) : {};
    const blob = new Blob([JSON.stringify({ ...all, files }, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `kuran-kursu-yedek-${localIso()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  // Restoring is two-step: read and summarise the file first, replace data only after confirmation.
  const importData = async (f?: File) => {
    if (!f) return;
    try {
      const data = JSON.parse(await f.text()) as State & { files?: Parameters<typeof importFiles>[0] };
      if (!Array.isArray(data.students)) throw new Error("bad");
      setPending({ name: f.name, data });
    } catch {
      setMsg("Dosya okunamadı. Lütfen bu uygulamadan indirilen yedek dosyasını seçin.");
    }
  };
  const confirmImport = async () => {
    if (!pending) return;
    const { data } = pending;
    setPending(null);
    await importFiles(data.files).catch(() => undefined);
    replaceAll({ students: data.students ?? [], tutanaklar: data.tutanaklar ?? [], attendance: data.attendance ?? [] });
    setMsg("Yedek geri yüklendi.");
  };
  const count = (s: Partial<State>) => `${s.students?.length ?? 0} talebe, ${new Set((s.attendance ?? []).map((a) => a.date)).size} günlük yoklama, ${s.tutanaklar?.length ?? 0} tutanak`;
  const btn = "flex w-full items-center gap-3 rounded-2xl border border-border bg-card p-4 text-left text-sm";

  return (
    <>
      <h2 className="mt-7 font-serif text-3xl font-bold">Menü</h2>
      <p className="mt-1 text-sm text-muted-foreground">{groupLabel(group)} Grubu</p>
      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        {[["Talebe", students.length], ["Yoklama", attendance.length], ["Tutanak", tutanaklar.length]].map(([l, v]) => (
          <div key={l} className="rounded-2xl bg-surface p-3"><p className="font-serif text-2xl font-bold">{v}</p><p className="text-xs text-muted-foreground">{l}</p></div>
        ))}
      </div>
      <div className="mt-5 space-y-3">
        <button onClick={() => setAddOpen(true)} className={`${btn} border-primary bg-primary text-primary-foreground`}><UserPlus className="h-5 w-5" /> Talebe Ekle</button>
        <Sheet open={addOpen} onClose={() => setAddOpen(false)} title={`Yeni Talebe · ${groupLabel(group)}`}>
          <StudentForm initial={emptyStudent} onSubmit={(s) => { addStudent(s); setAddOpen(false); setMsg(`${s.name} eklendi.`); }} />
        </Sheet>
        {students.some((st) => st.id.startsWith("trial-")) && <Button variant="outline" onClick={() => {
          if (!confirm("Tüm deneme talebeleri ve kayıtları silinsin mi?")) return;
          const keep = students.filter((st) => !st.id.startsWith("trial-"));
          importAll({ students: keep, attendance: attendance.filter((a) => !a.studentId.startsWith("trial-")), tutanaklar });
          setMsg(`${students.length - keep.length} deneme talebesi silindi.`);
        }} className="h-auto w-full justify-start whitespace-normal py-4 text-destructive">
          <UserPlus /> Deneme talebelerini sil
        </Button>}
        <Link to="/ai-tutanak" className={btn}><Sparkles className="h-5 w-5 text-primary" /> AI ile Tutanak Hazırla</Link>
        <Button variant="outline" asChild className="h-auto w-full justify-start whitespace-normal py-4"><Link to="/takrir"><BookOpen className="text-primary" /> Takrir</Link></Button>
        <button onClick={() => setReportOpen(true)} className={btn}><FileDown className="h-5 w-5 text-primary" /> Yoklama Raporu İndir (PDF / Excel)</button>
        <button onClick={() => setMailOpen(true)} className={btn}><Mail className="h-5 w-5 text-primary" /> Otomatik Rapor E-postası</button>
        <Suspense fallback={null}>
          {mailOpen && <EmailReports open onClose={() => setMailOpen(false)} />}
          {reportOpen && <ReportSheet open onClose={() => setReportOpen(false)} />}
          {blankOpen && <BlankAttendanceSheet open onClose={() => setBlankOpen(false)} />}
        </Suspense>
        <Button variant="outline" onClick={() => setBlankOpen(true)} className="h-auto w-full justify-start whitespace-normal py-4"><FileDown className="text-primary" /> Boş Yoklama Çizelgesi İndir (PDF / Excel)</Button>
        <button onClick={() => setExportAsk(true)} className={btn}><Download className="h-5 w-5 text-primary" /> Verileri Yedekle (indir)</button>
        <button onClick={() => setImportAsk(true)} className={btn}><Upload className="h-5 w-5 text-primary" /> Yedeği Geri Yükle</button>
        <Suspense fallback={null}><CloudBackup /></Suspense>
        <input ref={fileRef} type="file" accept="application/json" className="hidden" onChange={(e) => { importData(e.target.files?.[0]); e.target.value = ""; }} />

        <AlertDialog open={exportAsk} onOpenChange={setExportAsk}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Yedek indirilsin mi?</AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-2 text-left">
                  <p>Bu cihazdaki <b>tüm grupların</b> verileri tek bir dosyaya kaydedilecek: {count(all)} (tutanak fotoğrafları ve belgeleri dahil).</p>
                  <p>Dosya telefonunuzun <b>İndirilenler</b> klasörüne "kuran-kursu-yedek-tarih.json" adıyla iner. Uygulamadaki verilerinizde hiçbir şey değişmez.</p>
                  <p>Bu dosyada talebe isimleri ve kişisel bilgiler var; güvenli bir yerde saklayın, başkalarıyla paylaşmayın.</p>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Vazgeç</AlertDialogCancel>
              <AlertDialogAction onClick={() => { void exportData(); setMsg("Yedek indirildi."); }}>Evet, İndir</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={importAsk} onOpenChange={setImportAsk}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Yedek geri yüklensin mi?</AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-2 text-left">
                  <p>Bir sonraki adımda daha önce indirdiğiniz yedek dosyasını (.json) seçeceksiniz.</p>
                  <p>Dosyayı seçince <b>hemen yüklenmez</b>; önce içinde ne olduğunu gösterip son kez onayınızı isteyeceğiz.</p>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Vazgeç</AlertDialogCancel>
              <AlertDialogAction onClick={() => fileRef.current?.click()}>Dosya Seç</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={!!pending} onOpenChange={(o) => !o && setPending(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Dikkat: Mevcut veriler silinecek</AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-2 text-left">
                  <p><b>Seçilen dosya:</b> {pending?.name}<br />İçinde: {pending && count(pending.data)}</p>
                  <p><b>Şu an bu cihazda:</b> {count(all)}</p>
                  <p className="font-semibold text-destructive">Onaylarsanız bu cihazdaki tüm talebeler, yoklamalar ve tutanaklar silinip yerine yedekteki bilgiler gelecek. Bu işlem geri alınamaz.</p>
                  <p>Emin değilseniz önce "Vazgeç"e basıp "Verileri Yedekle" ile şu anki verilerinizi indirin.</p>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Vazgeç</AlertDialogCancel>
              <AlertDialogAction onClick={() => void confirmImport()} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Evet, Eminim — Yükle</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        {msg && <p className="text-center text-sm text-primary">{msg}</p>}
        <Suspense fallback={null}><CloudSummary /></Suspense>
      </div>
    </>
  );
}
