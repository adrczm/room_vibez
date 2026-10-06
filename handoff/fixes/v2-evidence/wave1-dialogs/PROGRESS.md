# B2 Dialogs: running note (agent ws-ui, port 18783)

Updated as work proceeds. "Verified" means checked in headless Chrome through Playwright.

## State
- All seven owned files are written and `npx tsc --noEmit` exits 0 (after the resume).
- HELP POP-UP: VERIFIED in headless Chrome. `ui/check-content.mjs` (all 5 tabs word-for-word identical to deck §2, both sentence variants) and `ui/check-help.mjs` (140 checks pass at 1280x800, 375x812, 375x812 touch; log in `ui/help-run.log`; screenshots `ui/shots/help-*`).
- CONFIRM DIALOG: VERIFIED in headless Chrome. `ui/check-confirm.mjs`: 60 checks pass at 1280x800 and 375x812 (true by click / Tab+Enter / Space; false by cancel click / Enter on open / Esc / backdrop; critical styling 7.67:1; markup shown as text; log `ui/confirm-run.log`; screenshots `ui/shots/confirm-*`).
- STAGE TOAST: VERIFIED in headless Chrome. `ui/check-toast.mjs`: 136 checks pass at 1440x900, 375x812, 1280x800 (inside stage; clear of toolbar and hint, settled gap 9 px above hint; 13 px text; contrast info 13.2, warning 8.82, error 7.67; role status/alert; one text mutation per notify; default timeouts 6 s / 12 s with a controlled clock; no animation under reduced motion; log `ui/toast-run.log`; screenshots `ui/shots/toast-*`). Note: a screenshot taken in the same instant as notify() catches the first fade-in frame (opacity 0); wait for the animation.
- vitest: not yet re-run after the files were added.
- Earlier harness failure was a quoting typo in `ui-harness.html` only (fixed).
- Added after first run: `wireModalDialog` installs one window capture keydown guard so page shortcuts (host Ctrl+Z, Esc) do not fire while an `.app-dialog` modal is open, even when nothing is focused.

- 16:40 Dev server was stopped by its 30-minute background limit; restarted on 18783 (stop it at the end: `lsof -ti tcp:18783 | xargs kill`).
- A stall in `check-confirm.mjs` was a race in the test (it did not wait for the closing dialog to be removed); fixed in the test, components unchanged. All check scripts now have a 150 s watchdog.
- FINAL (16:50): all work done. Final pass after the last source change: check-content 10/10 tab comparisons identical; check-help 141 pass; check-confirm 60 pass (run twice); check-toast 136 pass; check-in-app 36 pass (real page + SwiftShader, components wired at run time, no app file edited). `tsc --noEmit` exit 0; vitest 66/66 (18 files). Scratch production build of the harness OK (`ui/build-check/`). Dev server on 18783 stopped.
- Only files that differ from the wave-0 base in ws-ui: `src/help.ts`, `src/help-content.ts`, `src/help.css`, `src/ui/*` (4 files), `ui-harness.html` (discard).
- NOT checked: screen readers (DOM and Chrome accessibility-tree facts only), Safari, Firefox, real touch devices, real GPU.

## Files (in ws-ui)
- `src/help.ts`, `src/help-content.ts`, `src/help.css`
- `src/ui/confirmDialog.ts`, `src/ui/confirmDialog.css`
- `src/ui/notify.ts`, `src/ui/notify.css`
- `ui-harness.html` (harness only, discard)
- Check scripts in `scratchpad/ui/*.mjs`, screenshots in `scratchpad/ui/shots/`

## Exported API (current)
help.ts
- `initHelp(options?: HelpOptions): void` — `{ storageFailureIsSurfaced?: boolean (default false = interim sentence); startHereOnFirstVisit?: boolean (default true); unseenDot?: boolean (default false); button?: HTMLButtonElement | null }`
- `createHelpButton(): HTMLButtonElement` — id `btn-help`, classes `btn help-btn`, wired to open
- `openHelp(target?: { tab?: HelpTabId; anchor?: HelpAnchor | '#import-plan' | '#plans'; returnFocusTo?: HTMLElement | null }): void`
- `closeHelp(): void`, `isHelpOpen(): boolean`, `HELP_SEEN_KEY = 'catalog3d.helpSeen'`
- types `HelpTabId = 'start'|'product'|'room'|'files'|'built'`, `HelpAnchor = 'import-plan'|'plans'`
confirmDialog.ts
- `confirmDialog(options: { title: string; body: string | Node; confirmLabel: string; cancelLabel: string; destructive?: boolean }): Promise<boolean>`
- `wireModalDialog(dialog: HTMLDialogElement): void` (shared with help.ts)
notify.ts
- `mountNotifier(stage: HTMLElement, options?: { avoid?: HTMLElement[]; dismissLabel?: string }): Notifier`
- `notify(message: string, options?: { kind?: 'info'|'success'|'warning'|'error'; action?: { label: string; onSelect: () => void }; timeoutMs?: number }): void`
- `dismissNotification(): void`

## Strings not from the deck
- notify close button accessible name: `Dismiss` (overridable with `dismissLabel`)
- (everything in the help pop-up is from deck §2; `Topic` is the deck's word for the select)

## Choices the handoffs do not specify
- Confirm: initial focus on the cancel button; cancel left, confirm right.
- Help: first-ever open shows Start here (deck) and later opens follow the workspace (Phase 2); switch off with `startHereOnFirstVisit: false`.
- Help: focus returns to the element that opened it (a Why? link), falling back to the ? button.
- Toast: sits bottom-left, stacked above `#stage-hint`; default timeouts 6 s (info, success) and 12 s (warning, error); `timeoutMs: 0` stays.
- Toast live region is the inner text span, not `#stage-toast` itself; `#stage-toast` has no box when idle instead of using `hidden`.
- ? button is 28 px (Phase 2) and 44 px on coarse pointers (UX-12). Conflicts with the "0 controls under 32 px" gate: to report.

## Deck sentences to report (not rewritten)
- Tab 4: "Allow .mjs files turns this off." (ambiguous: unticking it turns loading off)
- Tab 5 item 10: "loading is opt-in" (the checkbox is ticked by default; `isMjsLoadingEnabled()` is true unless the stored flag is '0')
- Tab 3: "To move something, delete it from the list and place it again." goes stale if UX-09 lands.
