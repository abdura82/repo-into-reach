import { useCallback, useEffect, useMemo, useRef, type ReactNode } from "react";
import { dataSupabase } from "@/integrations/data-supabase/client";
import { useStore, type State } from "./store";
import { isEmptySnapshot, mergeSnapshots, sameSnapshot, toSnapshot, type Snapshot } from "./cloud-data";

const SYNCED_FLAG = "shared-data-joined-v2";

const load = async (): Promise<{ snapshot: Snapshot; updatedAt: string } | null> => {
  const { data, error } = await dataSupabase.rpc("shared_get", { p_pin: null });
  if (error) throw error;
  if (data === null) return null;
  if (!data || typeof data.updated_at !== "string" || !data.data ||
    !["students", "tutanaklar", "attendance", "takrirler"].every((key) => Array.isArray(data.data[key]))) {
    throw new Error("Invalid shared snapshot");
  }
  return { snapshot: toSnapshot(data.data), updatedAt: data.updated_at };
};

/**
 * Keeps every device on one shared copy of the data, no sign-in needed.
 * First visit merges this device's records in; after that the shared copy wins
 * and local changes are pushed a moment after they happen.
 */
export function CloudSyncProvider({ children }: { children: ReactNode }) {
  const { all, replaceAll, ready } = useStore();
  const snapshot = useMemo(() => toSnapshot(all), [all]);
  const last = useRef<Snapshot | null>(null); // what the shared copy holds as far as we know
  const updatedAt = useRef<string | null>(null);
  const started = useRef(false);
  const pending = useRef(false);
  const channel = useRef<ReturnType<typeof dataSupabase.channel> | null>(null);
  const save = useCallback(async (data: Snapshot) => {
    const { data: version, error } = await dataSupabase.rpc("shared_save", { p_data: data, p_pin: null });
    if (error) throw error;
    if (typeof version !== "string") throw new Error("Invalid shared save version");
    updatedAt.current = version;
    void channel.current?.send({ type: "broadcast", event: "changed", payload: {} })
      .then((status) => { if (status !== "ok") console.warn("Paylaşılan veri bildirimi gönderilemedi", status); })
      .catch((e) => console.warn("Paylaşılan veri bildirimi gönderilemedi", e));
  }, []);

  const apply = useCallback(
    (s: Snapshot) => {
      last.current = s;
      replaceAll(s as unknown as State);
    },
    [replaceAll],
  );

  const pull = useCallback(async (checkVersion = false) => {
    if (pending.current) return;
    try {
      if (checkVersion) {
        const { data: version, error } = await dataSupabase.rpc("shared_version", { p_pin: null });
        if (error) throw error;
        if (version !== null && typeof version !== "string") throw new Error("Invalid shared version");
        if (version === updatedAt.current || pending.current) return;
      }
      const res = await load();
      if (!res || pending.current) return;
      const remote = res.snapshot;
      updatedAt.current = res.updatedAt;
      if (!sameSnapshot(remote, last.current)) apply(remote);
    } catch (e) {
      console.warn("Paylaşılan veriler alınamadı", e);
    }
  }, [apply]);

  useEffect(() => {
    if (!ready || started.current) return;
    started.current = true;
    (async () => {
      try {
        const res = await load();
        const local = toSnapshot(all);
        const joined = localStorage.getItem(SYNCED_FLAG) === "1";
        if (!res) {
          last.current = local;
          if (!isEmptySnapshot(local)) await save(local);
        } else {
          const remote = res.snapshot;
          updatedAt.current = res.updatedAt;
          const next = joined || isEmptySnapshot(local) ? remote : mergeSnapshots(remote, local);
          apply(next);
          if (!sameSnapshot(next, remote)) await save(next);
        }
        localStorage.setItem(SYNCED_FLAG, "1");
      } catch (e) {
        console.warn("Paylaşılan veriler yüklenemedi", e);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  // Push local changes shortly after they happen.
  useEffect(() => {
    if (!ready || !last.current || sameSnapshot(snapshot, last.current)) return;
    pending.current = true;
    const t = setTimeout(async () => {
      try {
        await save(snapshot);
        last.current = snapshot;
      } catch (e) {
        console.warn("Paylaşılan veriler kaydedilemedi", e);
      } finally {
        pending.current = false;
      }
    }, 250);
    return () => clearTimeout(t);
  }, [snapshot, ready, save]);

  // Pick up other devices' changes.
  useEffect(() => {
    if (!ready) return;
    const ch = dataSupabase
      .channel("shared-data")
      .on("broadcast", { event: "changed" }, () => void pull())
      .subscribe();
    channel.current = ch;
    const visible = () => document.visibilityState === "visible";
    // Periodic check is a fallback only: once a minute, and only while the page is shown.
    const id = setInterval(() => {
      if (visible()) void pull(true);
    }, 60000);
    const onFocus = () => void pull(true);
    const onVisibility = () => {
      if (visible()) void pull(true);
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      clearInterval(id);
      channel.current = null;
      void dataSupabase.removeChannel(ch).catch((e) => console.warn("Paylaşılan veri kanalı kapatılamadı", e));
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [ready, pull]);

  return <>{children}</>;
}
