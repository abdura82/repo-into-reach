import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useStore, type State } from "./store";
import { useAuth } from "./auth";
import { loadCloudData, saveCloudData } from "./cloud-data.functions";
import { isEmptySnapshot, sameSnapshot, snapshotCounts, toSnapshot, type Snapshot, type SnapshotCounts, type SnapshotInput } from "./cloud-data";
export type CloudStatus = "signedOut" | "loading" | "ready" | "error";

type Cloud = {
  status: CloudStatus;
  /** Last failure, shown as-is so the teacher can retry. */
  message: string;
  /** What the backup in the database holds, or null when there is none yet. */
  cloud: (SnapshotCounts & { updatedAt: string }) | null;
  /** When this device last wrote to the backup. */
  lastSavedAt: string | null;
  /** Device and backup hold different data: the teacher chooses which one wins. */
  conflict: boolean;
  busy: boolean;
  pushNow: () => Promise<void>;
  pullNow: () => Promise<void>;
};

const CloudContext = createContext<Cloud | null>(null);

const errText = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** The backup travels as text; turn it back into the four lists, tolerating anything odd. */
const parseCloud = (json: string): Snapshot => {
  try {
    return toSnapshot(JSON.parse(json) as SnapshotInput);
  } catch {
    return toSnapshot(null);
  }
};

export function CloudSyncProvider({ children }: { children: ReactNode }) {
  const { all, replaceAll, ready } = useStore();
  const { user } = useAuth();
  const load = useServerFn(loadCloudData);
  const save = useServerFn(saveCloudData);

  const [status, setStatus] = useState<CloudStatus>("signedOut");
  const [message, setMessage] = useState("");
  const [cloud, setCloud] = useState<Cloud["cloud"]>(null);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const [busy, setBusy] = useState(false);

  /** Latest device data without re-running the one-off sign-in check. */
  const allRef = useRef(all);
  allRef.current = all;
  /** Set when the device has just been filled from the backup, so it is not pushed straight back. */
  const skipPush = useRef(false);
  const resolvedFor = useRef<string | null>(null);

  const snapshot = useMemo(() => toSnapshot(all), [all]);

  const push = useCallback(
    async (s: Snapshot) => {
      setBusy(true);
      try {
        const res = await save({ data: s as never });
        setLastSavedAt(res.savedAt);
        setMessage("");
        setStatus("ready");
      } catch (e) {
        setMessage(errText(e));
      } finally {
        setBusy(false);
      }
    },
    [save],
  );

  // Once per sign-in: compare the device with the backup and pick a starting point.
  useEffect(() => {
    if (!user) {
      setStatus("signedOut");
      setCloud(null);
      setConflict(false);
      setMessage("");
      resolvedFor.current = null;
      return;
    }
    if (!ready || resolvedFor.current === user.id) return;
    resolvedFor.current = user.id;
    let alive = true;
    setStatus("loading");
    (async () => {
      try {
        const res = await load();
        if (!alive) return;
        const local = toSnapshot(allRef.current);
        if (!res) {
          setCloud(null);
          setConflict(false);
          setStatus("ready");
          if (!isEmptySnapshot(local)) void push(local);
          return;
        }
        const remote = parseCloud(res.json);
        setCloud({ ...snapshotCounts(remote), updatedAt: res.updatedAt });
        if (isEmptySnapshot(local)) {
          skipPush.current = true;
          replaceAll(remote as unknown as State);
          setStatus("ready");
          return;
        }
        if (sameSnapshot(local, remote)) {
          setStatus("ready");
          return;
        }
        setConflict(true);
        setStatus("ready");
      } catch (e) {
        if (!alive) return;
        setStatus("error");
        setMessage(errText(e));
      }
    })();
    return () => {
      alive = false;
    };
  }, [user, ready, load, replaceAll, push]);

  // Keep the backup in step with the device: a few seconds after any change.
  useEffect(() => {
    if (!user || !ready || status !== "ready" || conflict) return;
    if (skipPush.current) {
      skipPush.current = false;
      return;
    }
    const t = setTimeout(() => void push(snapshot), 2500);
    return () => clearTimeout(t);
  }, [snapshot, user, ready, status, conflict, push]);

  const pushNow = useCallback(async () => {
    setConflict(false);
    await push(toSnapshot(allRef.current));
  }, [push]);

  const pullNow = useCallback(async () => {
    setBusy(true);
    try {
      const res = await load();
      if (!res) {
        setMessage("Bulutta yedek yok.");
        return;
      }
      const remote = parseCloud(res.json);
      skipPush.current = true;
      replaceAll(remote as unknown as State);
      setCloud({ ...snapshotCounts(remote), updatedAt: res.updatedAt });
      setConflict(false);
      setMessage("");
      setStatus("ready");
    } catch (e) {
      setMessage(errText(e));
    } finally {
      setBusy(false);
    }
  }, [load, replaceAll]);

  const value = useMemo<Cloud>(
    () => ({ status, message, cloud, lastSavedAt, conflict, busy, pushNow, pullNow }),
    [status, message, cloud, lastSavedAt, conflict, busy, pushNow, pullNow],
  );

  return <CloudContext.Provider value={value}>{children}</CloudContext.Provider>;
}

export function useCloud() {
  const ctx = useContext(CloudContext);
  if (!ctx) throw new Error("useCloud must be used within CloudSyncProvider");
  return ctx;
}
