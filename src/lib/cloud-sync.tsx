import { useCallback, useEffect, useMemo, useRef, type ReactNode } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useStore, type State } from "./store";
import { loadCloudData, saveCloudData } from "./cloud-data.functions";
import { isEmptySnapshot, mergeSnapshots, sameSnapshot, toSnapshot, type Snapshot, type SnapshotInput } from "./cloud-data";

const SYNCED_FLAG = "shared-data-joined";

const parseCloud = (json: string): Snapshot => {
  try {
    return toSnapshot(JSON.parse(json) as SnapshotInput);
  } catch {
    return toSnapshot(null);
  }
};

/**
 * Keeps every device on one shared copy of the data, no sign-in needed.
 * First visit merges this device's records in; after that the shared copy wins
 * and local changes are pushed a moment after they happen.
 */
export function CloudSyncProvider({ children }: { children: ReactNode }) {
  const { all, replaceAll, ready } = useStore();
  const load = useServerFn(loadCloudData);
  const save = useServerFn(saveCloudData);

  const snapshot = useMemo(() => toSnapshot(all), [all]);
  const last = useRef<Snapshot | null>(null); // what the shared copy holds as far as we know
  const started = useRef(false);
  const pending = useRef(false);
  const channel = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const ring = () => void channel.current?.send({ type: "broadcast", event: "changed", payload: {} });

  const apply = useCallback(
    (s: Snapshot) => {
      last.current = s;
      replaceAll(s as unknown as State);
    },
    [replaceAll],
  );

  const pull = useCallback(async () => {
    if (pending.current) return;
    try {
      const res = await load();
      if (!res || pending.current) return;
      const remote = parseCloud(res.json);
      if (!sameSnapshot(remote, last.current)) apply(remote);
    } catch (e) {
      console.warn("Paylaşılan veriler alınamadı", e);
    }
  }, [load, apply]);

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
          if (!isEmptySnapshot(local)) await save({ data: local as never });
        } else {
          const remote = parseCloud(res.json);
          const next = joined || isEmptySnapshot(local) ? remote : mergeSnapshots(remote, local);
          apply(next);
          if (!sameSnapshot(next, remote)) await save({ data: next as never });
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
        await save({ data: snapshot as never });
        last.current = snapshot;
        ring();
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
    const ch = supabase
      .channel("shared-data")
      .on("broadcast", { event: "changed" }, () => void pull())
      .subscribe();
    channel.current = ch;
    const id = setInterval(() => void pull(), 5000);
    const onFocus = () => void pull();
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(id);
      channel.current = null;
      void supabase.removeChannel(ch);
      window.removeEventListener("focus", onFocus);
    };
  }, [ready, pull]);

  return <>{children}</>;
}
