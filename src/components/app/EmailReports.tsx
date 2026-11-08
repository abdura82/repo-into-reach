import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Sheet } from "@/components/app/Sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useStore } from "@/lib/store";
import { sendReportNow, syncReportData } from "@/lib/report-mail.functions";
import { KIND_LABEL, type ReportKind } from "@/lib/absence-report";

const SEND_KINDS: ReportKind[] = ["daily", "weekly", "monthly"];

const CFG_KEY = "kuran-kursu-report-mail-v1";
export const MAX_RECIPIENTS = 50;
/** daily: teachers who get the daily report; null = everyone. */
type Cfg = { key: string; recipients: string[]; daily: string[] | null };

function newKey() {
  const a = new Uint8Array(20);
  crypto.getRandomValues(a);
  return Array.from(a, (b) => b.toString(16).padStart(2, "0")).join("");
}
function readCfg(): Cfg | null {
  try {
    const c = JSON.parse(localStorage.getItem(CFG_KEY) ?? "") as Cfg;
    if (/^[a-z0-9]{24,64}$/.test(c.key)) return { key: c.key, recipients: c.recipients ?? [], daily: c.daily ?? null };
  } catch { /* new */ }
  return null;
}
function loadCfg(): Cfg {
  const c = readCfg() ?? { key: newKey(), recipients: [], daily: null };
  localStorage.setItem(CFG_KEY, JSON.stringify(c));
  return c;
}
const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

type Row = { email: string; daily: boolean };

/** Lets the user edit teacher emails and choose who gets the daily report. */
export function EmailReports({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { all: { students, attendance } } = useStore();
  const sync = useServerFn(syncReportData);
  const send = useServerFn(sendReportNow);
  const [cfg, setCfg] = useState<Cfg | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [all, setAll] = useState(true);
  const [draft, setDraft] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const c = loadCfg();
    setCfg(c);
    setAll(!c.daily);
    setRows(c.recipients.map((email) => ({ email, daily: !c.daily || c.daily.includes(email) })));
  }, []);

  const push = (c: Cfg) => sync({ data: { key: c.key, recipients: c.recipients, dailyRecipients: c.daily, students, attendance } });

  const add = () => {
    const list = draft.split(/[\s,;]+/).map((s) => s.trim().toLowerCase()).filter(Boolean);
    const bad = list.filter((s) => !isEmail(s));
    if (bad.length) return setMsg(`Geçersiz adres: ${bad.join(", ")}`);
    const fresh = list.filter((e) => !rows.some((r) => r.email === e));
    if (rows.length + fresh.length > MAX_RECIPIENTS) return setMsg(`En fazla ${MAX_RECIPIENTS} adres ekleyebilirsiniz.`);
    setRows([...rows, ...fresh.map((email) => ({ email, daily: true }))]);
    setDraft("");
    setMsg("");
  };

  const save = async () => {
    if (!cfg) return;
    const recipients = rows.map((r) => r.email);
    const chosen = rows.filter((r) => r.daily).map((r) => r.email);
    if (!all && recipients.length && !chosen.length) return setMsg("Bugünkü rapor için en az bir hoca seçin.");
    const c: Cfg = { ...cfg, recipients, daily: all ? null : chosen };
    setBusy(true);
    try {
      await push(c);
      localStorage.setItem(CFG_KEY, JSON.stringify(c));
      setCfg(c);
      setMsg(recipients.length ? "Kaydedildi. Raporlar otomatik gönderilecek." : "Adresler silindi; otomatik gönderim kapalı.");
    } catch (e) { setMsg(`Kaydedilemedi: ${(e as Error).message}`); } finally { setBusy(false); }
  };

  const sendNow = async (kind: ReportKind) => {
    if (!cfg) return;
    setBusy(true);
    try {
      await push(cfg);
      const r = await send({ data: { key: cfg.key, kind } });
      setMsg(`${KIND_LABEL[kind]} rapor ${r.count} adrese gönderildi.`);
    } catch (e) { setMsg(`Gönderilemedi: ${(e as Error).message}`); } finally { setBusy(false); }
  };

  return (
    <Sheet open={open} onClose={onClose} title="Otomatik Rapor E-postası">
      <div className="flex gap-2">
        <Input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} placeholder="hoca@ornek.com" type="email" />
        <Button variant="outline" onClick={add}>Ekle</Button>
      </div>

      {rows.length > 0 && (
        <>
          <div className="mt-4 flex rounded-xl bg-surface p-1 text-sm">
            <button onClick={() => setAll(true)} className={`flex-1 rounded-lg py-2 ${all ? "bg-card font-semibold shadow-sm" : "text-muted-foreground"}`}>Bugünkü rapor: Herkese</button>
            <button onClick={() => setAll(false)} className={`flex-1 rounded-lg py-2 ${!all ? "bg-card font-semibold shadow-sm" : "text-muted-foreground"}`}>Seçtiklerime</button>
          </div>
          <ul className="mt-3 max-h-72 space-y-2 overflow-y-auto">
            {rows.map((r, i) => (
              <li key={r.email} className="flex items-center gap-3 rounded-xl border border-border p-3 text-sm">
                {!all && (
                  <input type="checkbox" aria-label={`${r.email} bugünkü raporu alsın`} checked={r.daily} className="h-4 w-4 accent-primary"
                    onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, daily: e.target.checked } : x)))} />
                )}
                <span className="min-w-0 flex-1 truncate">{r.email}</span>
                <button onClick={() => setRows(rows.filter((_, j) => j !== i))} className="text-xs text-destructive">Sil</button>
              </li>
            ))}
          </ul>
        </>
      )}

      <Button className="mt-4 w-full" onClick={save} disabled={busy || !cfg}>Kaydet</Button>

      <p className="mt-5 text-sm font-semibold">İstediğiniz zaman şimdi gönderin</p>
      <p className="text-xs text-muted-foreground">Haftalık bu haftayı (Pzt–Paz), aylık bu ayı kapsar.</p>
      <div className="mt-2 grid grid-cols-3 gap-2">
        {SEND_KINDS.map((k) => (
          <Button key={k} variant="outline" onClick={() => sendNow(k)} disabled={busy || !cfg?.recipients.length}>
            {KIND_LABEL[k]}
          </Button>
        ))}
      </div>
      {!cfg?.recipients.length && <p className="mt-1 text-xs text-muted-foreground">Göndermek için önce hoca e-postası ekleyip kaydedin.</p>}
      {msg && <p className="mt-3 text-center text-sm text-primary">{msg}</p>}
    </Sheet>
  );
}

/** Mounted once in the app shell: copies data to Cloud a few seconds after any change, once teachers are saved. */
export function ReportAutoSync() {
  const { all: { students, attendance } } = useStore();
  const sync = useServerFn(syncReportData);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => {
    const c = readCfg();
    if (!c?.recipients.length) return;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      sync({ data: { key: c.key, recipients: c.recipients, dailyRecipients: c.daily, students, attendance } }).catch((e) => console.error("Rapor verisi kopyalanamadı", e));
    }, 3000);
    return () => clearTimeout(timer.current);
  }, [students, attendance, sync]);
  return null;
}
