import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { StartupSplash } from "./StartupSplash";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("Opening logo lifecycle", () => {
  it("keeps the opening logo legible briefly even when fonts are ready", async () => {
    vi.useFakeTimers();
    render(<StartupSplash />);
    await act(async () => { await Promise.resolve(); });
    act(() => { vi.advanceTimersByTime(899); });
    expect(screen.queryByRole("status")).not.toBeNull();
    act(() => { vi.advanceTimersByTime(181); });
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("never restarts when the shared root rerenders for a page change", async () => {
    vi.useFakeTimers();
    const view = render(<StartupSplash />);
    await act(async () => { await Promise.resolve(); });
    act(() => { vi.advanceTimersByTime(1080); });
    view.rerender(<StartupSplash />);
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("still opens when fonts do not finish loading", () => {
    vi.useFakeTimers();
    const original = Object.getOwnPropertyDescriptor(document, "fonts");
    Object.defineProperty(document, "fonts", { configurable: true, value: { ready: new Promise(() => {}) } });
    try {
      render(<StartupSplash />);
      expect(screen.queryByRole("status")).not.toBeNull();
      act(() => { vi.advanceTimersByTime(1680); });
      expect(screen.queryByRole("status")).toBeNull();
    } finally {
      if (original) Object.defineProperty(document, "fonts", original);
      else Reflect.deleteProperty(document, "fonts");
    }
  });
});