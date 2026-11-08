// Keeps the app at one size: no pinch-zoom, no double-tap zoom, no ctrl+wheel zoom.
// iOS Safari ignores `user-scalable=no`, so the gestures themselves are blocked here.

let installed = false;

export function installNoZoom() {
  if (typeof window === "undefined" || installed) return;
  installed = true;

  // WebKit (iOS) fires gesture* events for a page pinch-zoom.
  const blockGesture = (event: Event) => {
    if (event.cancelable) event.preventDefault();
  };
  for (const type of ["gesturestart", "gesturechange", "gestureend"]) {
    document.addEventListener(type, blockGesture, { passive: false });
  }

  // Two-finger pinch on every browser.
  document.addEventListener(
    "touchmove",
    (event: TouchEvent) => {
      if (event.touches.length > 1 && event.cancelable) event.preventDefault();
    },
    { passive: false },
  );

  // Double-tap zoom: a second tap close to the first one in time and place.
  const DOUBLE_TAP_MS = 350;
  const DOUBLE_TAP_PX = 32;
  let lastTapAt = 0;
  let lastTapX = 0;
  let lastTapY = 0;

  document.addEventListener(
    "touchend",
    (event: TouchEvent) => {
      const tap = event.changedTouches[0];
      if (!tap) return;
      const now = Date.now();
      const isDouble =
        now - lastTapAt < DOUBLE_TAP_MS &&
        Math.abs(tap.clientX - lastTapX) < DOUBLE_TAP_PX &&
        Math.abs(tap.clientY - lastTapY) < DOUBLE_TAP_PX;

      if (isDouble) {
        if (event.cancelable) event.preventDefault();
        lastTapAt = 0;
        return;
      }

      lastTapAt = now;
      lastTapX = tap.clientX;
      lastTapY = tap.clientY;
    },
    { passive: false },
  );

  // Desktop: ctrl/cmd + mouse wheel zooms the whole page.
  document.addEventListener(
    "wheel",
    (event: WheelEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.cancelable) event.preventDefault();
    },
    { passive: false },
  );
}
