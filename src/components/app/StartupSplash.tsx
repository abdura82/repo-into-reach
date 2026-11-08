import { useEffect, useState } from "react";

/** Lives in the shared root, so changing pages cannot restart the opening logo. */
export function StartupSplash() {
  const [visible, setVisible] = useState(true);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    let active = true;
    let ready = false;
    let minimumElapsed = false;
    let dismissing = false;
    let removal: number | undefined;
    const hide = () => {
      if (!active || dismissing) return;
      dismissing = true;
      setLeaving(true);
      removal = window.setTimeout(() => { if (active) setVisible(false); }, 180);
    };
    // Keep the logo legible briefly, without waiting for background requests.
    const minimum = window.setTimeout(() => {
      minimumElapsed = true;
      if (ready) hide();
    }, 900);
    const timeout = window.setTimeout(hide, 1500);
    const fontsReady = document.fonts?.ready ?? Promise.resolve();
    const onReady = () => {
      ready = true;
      if (minimumElapsed) hide();
    };
    void fontsReady.then(onReady, onReady);
    return () => {
      active = false;
      window.clearTimeout(timeout);
      window.clearTimeout(minimum);
      window.clearTimeout(removal);
    };
  }, []);

  if (!visible) return null;
  return (
    <div id="app-splash" className={leaving ? "app-splash-leaving" : undefined} role="status" aria-label="Uygulama açılıyor">
      <img src="/logo.png" alt="" width={112} height={112} />
    </div>
  );
}