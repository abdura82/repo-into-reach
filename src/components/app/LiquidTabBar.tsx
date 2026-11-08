import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import type { LucideIcon } from "./icons";

type Tab = { to: string; label: string; icon: LucideIcon };

/** Clear space between tabs, so a tap in the gap still belongs to the nearest tab. */
const GAP = 6;

function indexFor(tabs: readonly Tab[], pathname: string) {
  const exact = tabs.findIndex((t) => t.to === pathname);
  if (exact >= 0) return exact;
  // Sub-pages (e.g. /talebe/...) belong to the first tab.
  const prefix = tabs.findIndex((t) => t.to !== "/" && pathname.startsWith(t.to));
  return prefix >= 0 ? prefix : 0;
}

/**
 * Bottom tab bar. The indicator is positioned with pure CSS (no measuring of
 * the bar), so it is visible in the very first server render and moves on tap.
 *
 * The whole bar is swipeable (Telegram style): press and slide across the bar,
 * the highlight follows the pointer, releasing navigates to the tab under it.
 * A tap navigates to the tab the finger actually touched (hit-tested), never
 * to a neighbour guessed from the bar's percentage width.
 */
export function LiquidTabBar({ tabs }: { tabs: readonly Tab[] }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const routeIndex = indexFor(tabs, pathname);
  const [tapped, setTapped] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);
  // Continuous bubble position (float, in tab units) so it glides like water.
  const [pos, setPos] = useState<number | null>(null);
  const [settling, setSettling] = useState(false);
  useEffect(() => {
    setTapped(null);
    setDragging(false);
    setPos(null);
    setSettling(false);
  }, [routeIndex]);
  const active = tapped ?? routeIndex;
  const shown = pos ?? active;
  const n = tabs.length;
  const cellRefs = useRef<Array<HTMLAnchorElement | null>>([]);
  const pointerId = useRef<number | null>(null);
  const downX = useRef(0);

  const centers = () =>
    cellRefs.current
      .slice(0, n)
      .map((el) => {
        const r = el?.getBoundingClientRect();
        return r && r.width > 0 ? r.left + r.width / 2 : null;
      });

  /** The tab the finger is on: the cell it touches, else the nearest centre. */
  const tabAt = (x: number, y: number): number | null => {
    const hit = document.elementFromPoint(x, y)?.closest("a[data-tab]") as HTMLAnchorElement | null;
    const hitIndex = Number(hit?.dataset["tab"]);
    if (hit && Number.isInteger(hitIndex)) return hitIndex;
    let best: number | null = null;
    let bestDist = Infinity;
    centers().forEach((c, i) => {
      if (c == null) return;
      const d = Math.abs(c - x);
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    });
    return best;
  };

  /** Continuous bubble position while the finger slides from cell to cell. */
  const glideAt = (x: number): number | null => {
    const cs = centers().filter((c): c is number => c != null);
    if (cs.length < 2) return null;
    if (x <= cs[0]!) return 0;
    const last = cs.length - 1;
    if (x >= cs[last]!) return last;
    for (let i = 0; i < last; i++) {
      const a = cs[i]!, b = cs[i + 1]!;
      if (x <= b) return i + (x - a) / (b - a);
    }
    return last;
  };

  return (
    <>
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-20 mx-auto h-[22px] max-w-md bg-background/95 backdrop-blur-xl"
    />
    <nav className="pointer-events-none fixed inset-x-0 bottom-[18px] z-20 mx-auto max-w-md px-2 pb-0 pt-1 sm:px-3">
      <div
        className="pointer-events-auto touch-none select-none rounded-[2rem] border border-border bg-card p-1.5 shadow-md"
        onPointerDown={(e) => {
          console.log("DBG down", e.pointerType, e.pointerId, "cur", pointerId.current);
          if (pointerId.current !== null) return;
          pointerId.current = e.pointerId;
          downX.current = e.clientX;
          e.currentTarget.setPointerCapture(e.pointerId);
          setDragging(true);
          setSettling(false);
          setTapped(null);
          setPos(glideAt(e.clientX));
        }}
        onPointerMove={(e) => {
          if (pointerId.current !== e.pointerId) return;
          setPos(glideAt(e.clientX));
        }}
        onPointerUp={(e) => {
          console.log("DBG up", e.pointerType, e.pointerId, "cur", pointerId.current);
          if (pointerId.current !== e.pointerId) return;
          const idx = tabAt(e.clientX, e.clientY);
          console.log("DBG idx", idx, "active", active, "x", e.clientX, "y", e.clientY);
          pointerId.current = null;
          setDragging(false);
          setSettling(true);
          setPos(idx ?? active);
          if (idx != null && idx !== active) {
            const tab = tabs[idx];
            if (tab) {
              setTapped(idx);
              navigate({ to: tab.to });
            }
          }
        }}
        onPointerCancel={() => {
          if (pointerId.current === null) return;
          pointerId.current = null;
          setDragging(false);
          setSettling(true);
          setPos(active);
        }}
      >
        <div
          className="relative grid select-none"
          style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))`, gap: `${GAP}px` }}
        >
          <span
            aria-hidden
            className="glass-bubble absolute inset-y-0 left-0 rounded-[1.6rem]"
            style={{
              width: `calc((100% - ${(n - 1) * GAP}px) / ${n})`,
              transform: `translate3d(calc(${shown} * (100% + ${GAP}px)),0,0) scale(${
                dragging ? "1.06, 0.92" : "1, 1"
              })`,
              transition: dragging
                ? "none"
                : settling
                  ? "transform 520ms cubic-bezier(0.22, 1.6, 0.36, 1)"
                  : "transform 380ms cubic-bezier(0.22, 1.45, 0.36, 1)",
              willChange: "transform",
            }}
          />
          {tabs.map(({ to, label, icon: Icon }, i) => {
            const on = i === Math.round(shown);
            return (
              <Link
                key={to}
                to={to}
                data-tab={i}
                draggable={false}
                preload="render"
                aria-current={i === active ? "page" : undefined}
                ref={(el) => {
                  cellRefs.current[i] = el;
                }}
                // Pointer taps navigate from the bar itself, so the link must
                // not fire a second (and possibly different) navigation.
                onClick={(e) => {
                  if (e.detail > 0 && e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) {
                    e.preventDefault();
                  }
                }}
                className={`relative z-10 flex flex-col items-center gap-0.5 rounded-[1.6rem] py-1 text-[13px] transition-[color,transform] duration-200 active:scale-95 ${
                  on ? "font-semibold text-primary" : "text-muted-foreground"
                }`}
              >
                <Icon
                  className={`h-[26px] w-[26px] transition-transform duration-200 ${
                    on ? "scale-110" : ""
                  }`}
                  strokeWidth={on ? 2.4 : 1.8}
                />
                {label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
    </>
  );
}
