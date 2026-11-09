import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { toSnapshot } from "./cloud-data";

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(), send: vi.fn(), removeChannel: vi.fn(), replaceAll: vi.fn(),
  store: { all: { students: [], tutanaklar: [], attendance: [], takrirler: [] } as ReturnType<typeof toSnapshot>, ready: true },
  changed: undefined as (() => void) | undefined,
}));
vi.mock("@/integrations/data-supabase/client", () => ({
  dataSupabase: {
    rpc: mocks.rpc,
    channel: vi.fn((name) => {
      expect(name).toBe("shared-data");
      const ch = {
        on: vi.fn((_type, _filter, callback) => { mocks.changed = callback; return ch; }),
        subscribe: vi.fn(() => ch), send: mocks.send,
      };
      return ch;
    }),
    removeChannel: mocks.removeChannel,
  },
}));
vi.mock("./store", () => ({ useStore: () => ({ ...mocks.store, replaceAll: mocks.replaceAll }) }));
import { CloudSyncProvider } from "./cloud-sync";

const remote = toSnapshot({ students: [{ id: "remote", name: "Remote" }] });
const flush = async () => { await act(async () => { await Promise.resolve(); }); };
const mount = () => render(<CloudSyncProvider><span /></CloudSyncProvider>);
const calls = (name: string) => mocks.rpc.mock.calls.filter(([rpc]) => rpc === name);

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  localStorage.clear();
  mocks.store.all = toSnapshot(null);
  mocks.changed = undefined;
  Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
  mocks.rpc.mockImplementation(async (name) => ({
    data: name === "shared_get" ? { data: remote, updated_at: "v1" } : name === "shared_save" ? "v2" : "v1",
    error: null,
  }));
  mocks.send.mockResolvedValue("ok");
  mocks.removeChannel.mockResolvedValue("ok");
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });

describe("external shared data sync", () => {
  it("merges device records once using the new v2 flag, ignoring the old flag", async () => {
    localStorage.setItem("shared-data-joined", "1");
    mocks.store.all = toSnapshot({ students: [{ id: "local" }] });
    mount(); await flush();
    const merged = toSnapshot({ students: [...remote.students, { id: "local" }] });
    expect(mocks.replaceAll).toHaveBeenCalledWith(merged);
    expect(mocks.rpc).toHaveBeenCalledWith("shared_save", { p_data: merged, p_pin: null });
    expect(localStorage.getItem("shared-data-joined-v2")).toBe("1");
    expect(mocks.send).toHaveBeenCalledWith({ type: "broadcast", event: "changed", payload: {} });
  });

  it("uses the shared copy after this device has joined v2", async () => {
    localStorage.setItem("shared-data-joined-v2", "1");
    mocks.store.all = toSnapshot({ students: [{ id: "local" }] });
    mount(); await flush();
    expect(mocks.replaceAll).toHaveBeenCalledWith(remote);
    expect(calls("shared_save")).toHaveLength(0);
  });

  it("checks the version every 60 seconds, not every 5, without downloading unchanged data", async () => {
    mount(); await flush();
    await act(async () => { await vi.advanceTimersByTimeAsync(59999); });
    expect(calls("shared_version")).toHaveLength(0);
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(mocks.rpc).toHaveBeenCalledWith("shared_version", { p_pin: null });
    expect(calls("shared_get")).toHaveLength(1);
  });

  it("skips periodic pulls entirely when hidden", async () => {
    mount(); await flush();
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
    await act(async () => { await vi.advanceTimersByTimeAsync(120000); });
    expect(calls("shared_version")).toHaveLength(0);
    expect(calls("shared_get")).toHaveLength(1);
  });

  it("checks immediately on focus and on becoming visible, but not on hiding", async () => {
    mount(); await flush();
    window.dispatchEvent(new Event("focus")); await flush();
    document.dispatchEvent(new Event("visibilitychange")); await flush();
    expect(calls("shared_version")).toHaveLength(2);
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
    document.dispatchEvent(new Event("visibilitychange")); await flush();
    expect(calls("shared_version")).toHaveLength(2);
  });

  it("downloads only when version changes and remembers the downloaded version", async () => {
    mount(); await flush();
    mocks.rpc.mockImplementation(async (name) => ({ data: name === "shared_get" ? { data: remote, updated_at: "v3" } : "v3", error: null }));
    window.dispatchEvent(new Event("focus")); await flush();
    window.dispatchEvent(new Event("focus")); await flush();
    expect(calls("shared_version")).toHaveLength(2);
    expect(calls("shared_get")).toHaveLength(2);
  });

  it("pulls immediately for realtime changed even when hidden, without a version check", async () => {
    mount(); await flush();
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
    mocks.changed?.(); await flush();
    expect(calls("shared_get")).toHaveLength(2);
    expect(calls("shared_version")).toHaveLength(0);
  });

  it("retains the 250 ms save delay, pending protection, broadcast and saved version", async () => {
    const view = mount(); await flush();
    const changed = toSnapshot({ students: [{ id: "remote", name: "Changed" }] });
    mocks.store.all = changed;
    view.rerender(<CloudSyncProvider><span /></CloudSyncProvider>);
    mocks.changed?.(); await flush();
    expect(calls("shared_get")).toHaveLength(1);
    await act(async () => { await vi.advanceTimersByTimeAsync(249); });
    expect(calls("shared_save")).toHaveLength(0);
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(mocks.rpc).toHaveBeenCalledWith("shared_save", { p_data: changed, p_pin: null });
    expect(mocks.send).toHaveBeenCalledTimes(1);
    mocks.rpc.mockResolvedValue({ data: "v2", error: null });
    window.dispatchEvent(new Event("focus")); await flush();
    expect(calls("shared_get")).toHaveLength(1);
  });

  it("does not replace local data or mark joined when the initial RPC fails", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    mocks.store.all = toSnapshot({ students: [{ id: "local" }] });
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "offline" } });
    mount(); await flush();
    expect(mocks.replaceAll).not.toHaveBeenCalled();
    expect(calls("shared_save")).toHaveLength(0);
    expect(localStorage.getItem("shared-data-joined-v2")).toBeNull();
    expect(console.warn).toHaveBeenCalled();
  });

  it("does not clear local records on invalid remote data", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    mocks.rpc.mockResolvedValue({ data: { data: {}, updated_at: "v1" }, error: null });
    mount(); await flush();
    expect(mocks.replaceAll).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalled();
  });

  it("does not download or overwrite local data when a version call fails", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    mount(); await flush(); mocks.replaceAll.mockClear();
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "offline" } });
    window.dispatchEvent(new Event("focus")); await flush();
    expect(calls("shared_get")).toHaveLength(1);
    expect(mocks.replaceAll).not.toHaveBeenCalled();
  });

  it("keeps an empty local snapshot when nothing is saved remotely without saving empty data", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: null });
    mount(); await flush();
    expect(calls("shared_save")).toHaveLength(0);
    expect(mocks.replaceAll).not.toHaveBeenCalled();
    expect(localStorage.getItem("shared-data-joined-v2")).toBe("1");
  });
});