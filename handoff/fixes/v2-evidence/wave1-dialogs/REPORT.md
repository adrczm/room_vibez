## Final report: B2 Dialogs (help pop-up, `confirmDialog`, stage toast)

All three components are built and verified in headless Chrome. No host file was edited: a diff against the wave-0 base shows only my owned files plus the harness. The dev server on 18783 is stopped.

Paths below are relative to `WS = /private/tmp/claude-501/-Users-adrian-Desktop-Room-Vibez/7ac663fe-e0d6-4b3c-af69-487be083d847/scratchpad/ws-ui`; check scripts, logs and screenshots are in `…/scratchpad/ui/`.

### 1. Status per task

| Task | Status | How |
|---|---|---|
| **? pop-up** | Verified | `check-content.mjs`: all 5 tabs word-for-word identical to deck §2, in both sentence variants. `check-help.mjs`: 141 checks pass. |
| **`confirmDialog`** | Verified | `check-confirm.mjs`: 60 checks pass, run twice. |
| **Stage toast** | Verified | `check-toast.mjs`: 136 checks pass. |
| All three on the real page | Verified | `check-in-app.mjs`: 36 checks pass against the unmodified `index.html` + `main.ts` (SwiftShader), with the components wired at run time exactly as in section 3. |

Phase 2 acceptance, measured:
- **Opens and closes:** never auto-opens (no `<dialog>` in the page until first open); closes by Esc, close button and backdrop click.
- **Focus:** focus goes back to the **?** after each close. Tab never reached a page control; the native cycle includes one browser-UI stop, which shows as `BODY` in headless Chrome.
- **Tabs:** arrow keys, Home and End move between tabs with roving tabindex. The Topic select replaces the tabs at 860 px and the tabs return at 861 px.
- **Deep links:** both land on their section, scrolled into view, focused and highlighted.
- **Layout:** no horizontal scroll at 375 px. The dialog is 600×680 at 1280×800 and 343×680 at 375×812.

Confirm: resolves `true` by click, Tab+Enter and Space on the confirm button; `false` by cancel click, Enter on a freshly opened dialog, Esc and backdrop.

Toast:
- **Position:** stays inside the stage and clear of the toolbar and hint at 1440×900 and 375×812, settling 9 px above the hint.
- **Legibility:** text is 13 px; contrast is 13.2:1 (info), 8.82:1 (warning), 7.67:1 (error).
- **Announcement:** one text change per `notify()` in one live region; errors are `role="alert"` and carry an icon, a 4 px left edge and weight 550.
- **Timing and motion:** times out as documented; no animation under `prefers-reduced-motion: reduce`.

### 2. Files

Merge these seven (plain copy):
- `src/help.ts`
- `src/help-content.ts`
- `src/help.css`
- `src/ui/confirmDialog.ts`
- `src/ui/confirmDialog.css`
- `src/ui/notify.ts`
- `src/ui/notify.css`

Harness only, discard: `WS/ui-harness.html`.

### 3. API and wiring

**Help** (`src/help.ts`)
```ts
type HelpTabId = 'start' | 'product' | 'room' | 'files' | 'built';
type HelpAnchor = 'import-plan' | 'plans';
interface HelpOptions {
  storageFailureIsSurfaced?: boolean; // default false = interim sentence (Copy §6 A)
  startHereOnFirstVisit?: boolean;    // default true
  unseenDot?: boolean;                // default false
  button?: HTMLButtonElement | null;  // wire an existing button instead of creating one
}
interface OpenHelpOptions { tab?: HelpTabId; anchor?: HelpAnchor | `#${HelpAnchor}`; returnFocusTo?: HTMLElement | null; }
function initHelp(options?: HelpOptions): void;
function createHelpButton(): HTMLButtonElement; // id "btn-help", classes "btn help-btn", already wired
function openHelp(target?: OpenHelpOptions): void;
function closeHelp(): void;
function isHelpOpen(): boolean;
const HELP_SEEN_KEY = 'catalog3d.helpSeen';
```
Host steps, in `boot()`:
1. `initHelp({ storageFailureIsSurfaced: false })`. Flip to `true` only once the saving-blocked banner really appears.
2. `document.querySelector('.topbar')!.append(createHelpButton())`. Nothing goes in `index.html`.
3. For each **Why?** link: `link.addEventListener('click', () => openHelp({ anchor: 'plans', returnFocusTo: link }))`.

**Confirm** (`src/ui/confirmDialog.ts`)
```ts
interface ConfirmDialogOptions { title: string; body: string | Node; confirmLabel: string; cancelLabel: string; destructive?: boolean; }
function confirmDialog(options: ConfirmDialogOptions): Promise<boolean>;
function wireModalDialog(dialog: HTMLDialogElement): void; // shared with help.ts
```
- A string `body` is never parsed as HTML. A line break starts a paragraph and `**words**` render bold, so deck §5 bodies can stay single template strings.
- E2E selectors: `dialog.confirm-dialog [data-action="confirm"]` and `[data-action="cancel"]`.
- For the `.mjs` confirm, split the guard message at the first line break into `title` and `body`.

**Toast** (`src/ui/notify.ts`)
```ts
type NotifyKind = 'info' | 'success' | 'warning' | 'error';
interface NotifyAction { label: string; onSelect: () => void; }
interface NotifyOptions { kind?: NotifyKind; action?: NotifyAction; timeoutMs?: number; }
interface NotifierOptions { avoid?: HTMLElement[]; dismissLabel?: string; }
interface Notifier { readonly element: HTMLElement; notify(message: string, options?: NotifyOptions): void; dismiss(): void; destroy(): void; }
function mountNotifier(stage: HTMLElement, options?: NotifierOptions): Notifier;
function notify(message: string, options?: NotifyOptions): void;
function dismissNotification(): void;
```
Host steps: call `mountNotifier(document.querySelector<HTMLElement>('.stage')!)` once in `boot()`, then `notify(text, { kind })`. It creates `#stage-toast`, or takes over an existing one.

Things the host needs to know:
- **Top bar CSS:** `help.css` has two rules on a host element, `.topbar .workspace-nav { margin-left: auto }` and `order: 1` at 720 px and below, so the **?** sits at the right end. The top bar stays 87 px wide; at 375 px it grows from 149 to 157 px.
- **Selected tab style:** `.segmented.help-tabs button[aria-selected='true']` copies the `.segmented` selected style. If QA-13 changes that style, mirror it.
- **Page shortcuts:** while a help or confirm dialog is open, key presses do not reach `document` keydown listeners (the host's undo/redo handler lives there). This is intended.
- **Live region:** the live region is the inner `.stage-toast-text`, so don't write the same message to `#room-status` while it is still `role="status"`.
- **Idle toast:** `#stage-toast` has no box when idle rather than carrying `hidden`. `toBeVisible()` and `toContainText()` work when it shows.
- **Small screens:** at 860 px and below the toast is only on screen when the stage is. Today the workspace switch scrolls the stage away (QA-03), so this depends on the sticky stage from UX-12.
- **Other stage controls:** `avoid` defaults to `.stage-toolbar` and `#stage-hint`; pass more elements if new stage controls are added.

### 4. Strings not from the deck

- `Dismiss`: the toast close button's accessible name, overridable with `dismissLabel`. It should move to the "not in the deck" section of `src/copy.ts`.
- One developer-only console message: `[notify] no .stage to show the message in:`.

Everything in the pop-up is deck text, including `?`, `How this works`, `Help: how this works`, `Close help` and `Topic`.

### 5. Checks

- `npx tsc --noEmit`: exit 0. `npx vitest run`: 66 passed, 18 files.
- A scratch production build of the harness succeeds; the only animation in my CSS is inside the reduced-motion query.

| Script | Sizes |
|---|---|
| `check-help.mjs` | 1280×800, 375×812, 375×812 touch, plus 860 and 861 px wide |
| `check-confirm.mjs` | 1280×800, 375×812 |
| `check-toast.mjs` | 1440×900, 375×812, 1280×800 |
| `check-in-app.mjs` | 1280×800, 1440×900, 375×812 |

There are 62 screenshots in `…/scratchpad/ui/shots/` and a running note in `…/scratchpad/ui/PROGRESS.md`.

### 6. Choices, doubts, not checked

**Choices the handoffs do not specify**
- **Confirm focus:** initial focus is on the cancel button, always. Cancel sits left, confirm right.
- **Destructive button:** uses the existing soft critical look (`--critical-soft`, `--critical`, border `#f0b6ae`), not a solid fill.
- **First open of help:** the deck says "first visit → Start here"; Phase 2 says "otherwise Start here". The default follows the deck: the first-ever open shows Start here, later opens follow the workspace. A fresh-context acceptance test will therefore see Start here first; `startHereOnFirstVisit: false` gives the literal Phase 2 rule.
- **Focus return:** focus goes back to whatever opened the pop-up (a **Why?** link), falling back to the **?**. Phase 2 literally says "to the ? button".
- **Why? mapping:** the spec names three links but two anchors. I left the mapping to the host; the Parts list note has no anchor, so `openHelp({ tab: 'product' })` lands on the tab only.
- **? button size:** 28 px as Phase 2 says, 44 px on coarse pointers per UX-12. At 28 px it fails UX-12's "0 controls under 32 px" gate; one variable, `--help-btn-size`, changes it.
- **Toast position and timing:** bottom-left, stacked above the hint. Default timeouts are 6 s (info, success) and 12 s (warning, error); `0` stays. The countdown pauses on hover and focus.
- **Extras:** the optional unseen dot is implemented but off by default. The seen flag is stored under `catalog3d.helpSeen`.
- **Not built:** no page scroll lock behind the dialog, and no fallback if `showModal` is missing.

**Deck sentences I doubt (shipped as written, not rewritten)**
- Tab 4, "**Allow .mjs files** turns this off": ambiguous. Unticking it turns loading off; it does not turn off the confirm.
- Tab 5 item 10, "loading is opt-in": the checkbox is ticked by default. `ASSUMPTIONS.md` A17 uses "opt-in", so this holds only in the per-file-confirm sense.
- Tab 3, "To move something, delete it from the list and place it again": goes stale if UX-09 lands. "Product list" and "from the list" likewise if UX-08 or UX-14 change the picker.
- Tab 4, Meshopt: `README.md` only says Draco may fail.
- Tab 4, "reopens without that product": the deck marks it as inferred, and I did not run it either.

**Not checked**
- Screen readers. Only DOM and Chrome accessibility-tree facts were checked; nothing was listened to, including the status-to-alert role switch and the repeat-message re-announcement.
- Safari, Firefox, real touch devices, real GPU.
- 320 px width and 200 % zoom.
- The final host DOM after later waves; I tested against the wave-0 page.
