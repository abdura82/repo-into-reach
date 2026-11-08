import { useState } from "react";
import "@lovable.dev/cloud-auth-js/styles.css";
import { useAuth } from "@/lib/auth";
import { useCloud } from "@/lib/cloud-sync";
import { describeCounts, describeSnapshot } from "@/lib/cloud-data";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Cloud, Download, Loader2, LogOut, Upload } from "@/components/app/icons";

const time = (iso: string) =>
  new Date(iso).toLocaleString("tr-TR", { day: "2-digit", month: "long", hour: "2-digit", minute: "2-digit" });

/** Google's own branding: multicolour "G", white button, grey border, dark label. */
function GoogleButton({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex w-full items-center justify-center rounded-2xl border bg-card py-3 text-sm font-medium transition-opacity disabled:opacity-50"
      style={{ borderColor: "#747775", color: "#1F1F1F", background: "#FFFFFF", paddingLeft: 12, paddingRight: 12 }}
    >
      <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" style={{ marginRight: 10 }}>
        <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z" />
        <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z" />
        <path fill="#FBBC05" d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z" />
        <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z" />
      </svg>
      <span>Google ile devam et</span>
    </button>
  );
}

/** Sign-in, cloud status and the two manual backup buttons. */
export function CloudBackup() {
  const { user, ready, signIn, signOut } = useAuth();
  const { status, message, cloud, lastSavedAt, conflict, busy, pushNow, pullNow } = useCloud();
  const { all } = useStore();
  const [err, setErr] = useState("");
  const [pullAsk, setPullAsk] = useState(false);
  const [pushAsk, setPushAsk] = useState(false);

  const start = async (p: "lovable" | "google") => {
    setErr("");
    const e = await signIn(p);
    if (e) setErr(e);
  };

  if (!ready) return <p className="text-center text-xs text-muted-foreground">Hesap durumu kontrol ediliyor…</p>;

  if (!user) {
    return (
      <div className="rounded-2xl border border-border bg-card p-4">
        <p className="flex items-center gap-2 text-sm font-semibold"><Cloud className="h-5 w-5 text-primary" /> Buluta yedekleme</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Verileriniz şu anda yalnızca bu cihazda. Bir hesapla giriş yapıp yedeklerseniz telefonunuzu değiştirdiğinizde veya
          tarayıcı verilerini sildiğinizde talebeler, yoklamalar ve tutanaklar kaybolmaz.
        </p>
        <div className="mt-4 space-y-2">
          <button type="button" className="lovable-auth-button w-full" onClick={() => void start("lovable")}>
            Lovable ile devam et
          </button>
          <GoogleButton onClick={() => void start("google")} />
        </div>
        {err && <p className="mt-3 text-center text-sm text-destructive">{err}</p>}
        <p className="mt-3 text-xs text-muted-foreground">Tutanak fotoğrafları ve belgeleri buluta gitmez; onlar için yedek dosyasını indirin.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className="flex items-center gap-2 text-sm font-semibold"><Cloud className="h-5 w-5 text-primary" /> Buluta yedekleme</p>
      <p className="mt-1 text-xs text-muted-foreground">Giriş: {user.email}</p>

      <p className="mt-3 text-sm">
        {status === "loading" && "Bulut kontrol ediliyor…"}
        {status === "error" && <span className="text-destructive">Buluta ulaşılamadı: {message}</span>}
        {status === "ready" && conflict && <span className="font-semibold text-primary">Bu cihaz ile buluttaki yedek farklı. Hangisini kullanacağınıza siz karar verin.</span>}
        {status === "ready" && !conflict && cloud && lastSavedAt && `Buluttaki yedek güncel. Son kayıt: ${time(lastSavedAt)}`}
        {status === "ready" && !conflict && cloud && !lastSavedAt && `Bulutta yedek var: ${describeCounts(cloud)}.`}
        {status === "ready" && !conflict && !cloud && "Bulutta henüz yedek yok. İlk kayıt birazdan otomatik yapılır."}
      </p>
      {message && status !== "error" && <p className="mt-1 text-sm text-destructive">{message}</p>}

      <div className="mt-4 space-y-2">
        <Button variant="outline" className="h-auto w-full justify-start whitespace-normal py-3" onClick={() => setPushAsk(true)} disabled={busy}>
          <Upload className="text-primary" /> Bu cihazdakileri buluta gönder
        </Button>
        <Button variant="outline" className="h-auto w-full justify-start whitespace-normal py-3" onClick={() => setPullAsk(true)} disabled={busy || !cloud}>
          <Download className="text-primary" /> Buluttakileri bu cihaza yükle
        </Button>
        <Button variant="ghost" className="h-auto w-full justify-start whitespace-normal py-3 text-muted-foreground" onClick={() => void signOut()} disabled={busy}>
          <LogOut /> Çıkış yap
        </Button>
      </div>

      <AlertDialog open={pushAsk} onOpenChange={setPushAsk}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Buluttaki yedek güncellensin mi?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-left">
                <p>Bu cihazdaki veriler buluta gönderilecek: {describeSnapshot(all)}</p>
                {cloud && <p>Buluttaki eski yedek bununla değiştirilecek: {describeCounts(cloud)}</p>}
                <p>Yalnızca talebeler, yoklamalar, tutanaklar ve takrirler gider; fotoğraflar ve belgeler bu cihazda kalır.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Vazgeç</AlertDialogCancel>
            <AlertDialogAction onClick={() => void pushNow()}>Evet, gönder</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={pullAsk} onOpenChange={setPullAsk}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Dikkat: Bu cihazdaki veriler silinecek</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-left">
                <p><b>Bulutta:</b> {cloud ? describeCounts(cloud) : "yedek yok"}</p>
                <p><b>Bu cihazda:</b> {describeSnapshot(all)}</p>
                <p className="font-semibold text-destructive">Onaylarsanız bu cihazdaki talebeler, yoklamalar ve tutanaklar silinip buluttaki yedek yüklenir. Bu işlem geri alınamaz.</p>
                <p>Emin değilseniz önce "Vazgeç"e basıp "Bu cihazdakileri buluta gönder" ile mevcut verilerinizi buluta aktarın.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Vazgeç</AlertDialogCancel>
            <AlertDialogAction onClick={() => void pullNow()} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Evet, eminim — yükle</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={conflict} onOpenChange={(o) => !o && undefined}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>İki farklı kayıt var — hangisi kalsın?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-left">
                <p><b>Bulutta:</b> {cloud ? describeCounts(cloud) : "yedek yok"}{cloud ? ` (son kayıt ${time(cloud.updatedAt)})` : ""}</p>
                <p><b>Bu cihazda:</b> {describeSnapshot(all)}</p>
                <p>Seçtiğiniz kayıt diğerinin yerine geçer. Emin değilseniz önce "Bu cihazdakileri buluta gönder"i seçip yedeğinizi koruyun.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="sm:grid sm:grid-cols-2 sm:gap-2">
            <Button variant="outline" onClick={() => void pullNow()} disabled={busy}>Buluttakileri yükle</Button>
            <Button onClick={() => void pushNow()} disabled={busy}>Bu cihazdakileri gönder</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {busy && <p className="mt-2 flex items-center justify-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" /> İşleniyor…</p>}
    </div>
  );
}

/** Small line for the Menu footer: where the data lives right now. */
export function CloudSummary() {
  const { user, ready } = useAuth();
  const { status, cloud, lastSavedAt } = useCloud();
  if (!ready || !user) return <p className="text-center text-xs text-muted-foreground">Veriler bu cihazda saklanır.</p>;
  if (status === "loading") return <p className="text-center text-xs text-muted-foreground">Bulut kontrol ediliyor…</p>;
  if (cloud && lastSavedAt) return <p className="text-center text-xs text-muted-foreground">Veriler bu cihazda ve bulutta yedekli · son kayıt {time(lastSavedAt)}</p>;
  if (cloud) return <p className="text-center text-xs text-muted-foreground">Veriler bu cihazda ve bulutta yedekli ({cloud.students} talebe).</p>;
  return <p className="text-center text-xs text-muted-foreground">Buluta yedekleniyor…</p>;
}
