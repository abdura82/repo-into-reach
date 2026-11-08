<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Project rules
- Takrir UI and its single PDF/print area live only on the Menu-linked Takrir route; date navigation and export ranges use pure takrir helpers and the existing store so saved sessions and profile counts stay intact.
- Blank chart month/week selectors use the pure report calendar helpers; weeks retain Monday–Sunday boundaries and period titles are shared by screen and exports to keep dates consistent.
- Both tutanak AI functions resolve categories through the pure shared helper, preserving manually typed categories over model suggestions so both creation forms follow the same rule.
- The opening logo is React-owned inside the shared root, never removed by inline DOM scripts; use a short legibility interval, font readiness, a bounded fallback and React-owned dismissal so navigation cannot restart it or break hydration.
- Attendance cells are read and changed through pure helpers in `src/lib/stats.ts`; all views and exports reuse them so per-cell notes and day totals cannot diverge.
- Attendance report export (PDF via jspdf, Excel via xlsx-js-style because plain SheetJS cannot write borders/rotated text for the namaz takip çizelgesi) lives in `src/lib/report-export.ts` and loads those libraries with dynamic `import()` so they never slow app startup; period/summary logic stays pure in `src/lib/report.ts` with tests.
- ReportSheet passes the selected range into the shared buildChart model so PDF and Excel enumerate the same calendar days; missing student-day records produce blank marks without invoking absence totals.
- Trial students are explicitly added from Menu using stable identifiers and a pure helper, preserving existing records and preventing duplicates without seeding on page load.
- Blank paper charts use a separate pure model in report.ts and the shared BlankAttendanceSheet; six prayer/lesson columns have empty cells and export in 15-day blocks of up to 54 students per A4 page so missing records are never printed as absences and one class fits one sheet.
- PDFs embed the subset DejaVu fonts in `public/fonts/` because jsPDF's built-in fonts cannot render Turkish letters (ğ, ş, ı, İ).
- App data lives in browser localStorage via `src/lib/store.tsx`; Lovable Cloud only keeps a copy of students/attendance plus teacher emails (`report_subscriptions`) for automatic report emails.
- Students carry a class (`sinif`, missing = first group); `useStore()` exposes only the active class's students and their rows via pure helpers in `src/lib/groups.ts`, while `all`/`replaceAll` cover backups and report emails, so pages stay group-agnostic and the email setup is shared.
- Lazily imported npm deps must be listed in `optimizeDeps.include` in `vite.config.ts`, because runtime re-optimization breaks lazy route imports in open tabs; `src/lib/chunk-reload.ts` reloads once on any chunk-load failure as a safety net.
- App code imports icons only from `src/components/app/icons.ts` (per-icon lucide files), never the `lucide-react` barrel, because the barrel is a multi-MB file in the dev preview that made phones slow to open; `vite.config.ts` pre-bundles the icons listed there automatically.
- The app shell (header + bottom tab bar) is rendered once in `src/routes/__root.tsx` around `<Outlet />`; pages must not wrap themselves in `AppShell`, because remounting it per page made tab switches slow and reset the tab highlight.
- AI features call the Lovable AI Gateway only from server functions in `src/lib/*-ai.functions.ts` via `src/lib/ai-gateway.server.ts`; prompt building and reply parsing stay pure (e.g. `src/lib/ai-tutanak.ts`) with tests, so the server-only key never reaches the browser.
- Paper-photo attendance is read per cell (geldi/gelmedi/gec/izinli/hasta + doubtful cells) with the prompt and parser in `src/lib/paper-ai.ts` (tested); X always means "gelmedi", because the app's own blank chart uses ✓/X and the old prompt counted X as present.
- The Yoklama page saves the whole day on every tap (Save button only confirms), so a forgotten save, date change or page change never loses marks; reports use `latestPerDay` so a day saved twice counts once with its newest record.
- Phone numbers become dialer links only through `telHref()` in `src/lib/phone.ts`, which strips spaces/brackets and refuses non-numbers, so every number shown (talebe's and the guardian's) stays tappable and no view hand-builds a `tel:` string.
