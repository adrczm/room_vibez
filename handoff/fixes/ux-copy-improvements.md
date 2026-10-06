# Handoff to Claude: apply the UX copy improvements

**For:** the Claude session that applies this inside a larger fix. You have no memory of the session that wrote it.
**From:** the `/design:ux-copy` session, 2026-10-05, requested by Adrian.
**Status:** copy is written and reviewed against the code. **Nothing has been applied to app code.**
**Project root:** `/Users/adrian/Desktop/Room Vibez` (not a git repo).

---

## 1. Goal

Make the UI quieter and more honest.

- On screen, keep only **minor nudges**: one short line, mostly state-based.
- Move how-to and "why it was built this way" into one **?** button in the top bar that opens a pop-up dialog.
- Rewrite status and error text into plain 3-part messages (what happened · what was kept · what to do next).
- Add confirmations before the destructive actions that currently have none.

Adrian's direction, verbatim: *"keep only minor nudges visible, with more instructional and clarifying processes for how the user should work and what the development decisions were in a questionmark icon that opens a pop-up."*

Two UIs are in scope:

| UI | Path | Stack |
|---|---|---|
| **Catalog 3D viewer** (primary) | `hackathon-3d-viewer/` (`index.html`, `src/main.ts`, `src/styles.css`, `src/viewer/*`) | Vite + TypeScript + Three.js |
| **Planner prototype** | `prototypes/room-vibez-planner-flows/` (`index.html`, `app.js`, `styles.css`) | Static HTML/JS, no bundler |

---

## 2. Source of truth

- **Strings:** [`docs/ux-copy-deck.md`](../docs/ux-copy-deck.md). **Copy every string from it exactly. Do not paraphrase.**
- **This file:** the plan, constraints and verification. If this file and the deck disagree on *words*, the deck wins. On *process or safety*, this file wins.
- **Pop-up content:** deck §2, tab by tab. It is already written as final copy.
- **Background (optional):** `docs/flow-stress-test-report.md` (why each message changed; IDs like R6, E2, K1 below refer to it), `hackathon-3d-viewer/ASSUMPTIONS.md` and `ARCHITECTURE.md` (the source for the pop-up's "How it's built" claims).

**Project rule:** *do not invent.* The pop-up may only state what the docs or code support, and must say "undecided" where the docs say Unknown. If you need copy the deck doesn't have, write it in the deck's voice (§1 of the deck), and **list it in your completion doc** as new.

---

## 3. Read before you touch anything

1. **Snapshot first.** There is no git. Copy `hackathon-3d-viewer/{index.html,src,tests}` and `prototypes/room-vibez-planner-flows/` to a timestamped folder **outside the project** (your scratchpad). That's your only rollback.
2. **Another session edits these files.** `src/main.ts` and `src/viewer/RoomVibezViewer.ts` were last changed 2026-10-05 13:51 (a cold-boot fix: boot always lands on **Product**; see `docs/model-display-deep-qa-fix.md`). Re-read a file right before editing. Use targeted edits, never whole-file rewrites. Don't undo the cold-boot behavior.
3. **The dev server is already running** on `http://127.0.0.1:18767/` (HTTP 200 when checked). Don't start a second one (`--strictPort` would fail). Vite hot-reloads your edits.
4. **Do not run `npm run test:e2e` as-is.** Six specs write screenshots to hardcoded paths under `~/Library/Application Support/Cursor/AgentStores/…` (`model-display-cold-load`, `dwg-plan-import`, `missing-features`, `model-display`, `room-floor-extent`, `room-from-scratch`). That directory exists, and `mkdirSync({recursive:true})` would create folders inside Cursor's app data. **Only `viewer.spec.ts` is safe** (it writes to `tests/e2e/screenshots/`). See §8 for how to verify the rest.
5. **Establish a baseline before editing:** `npm run typecheck` and `npm test` (`vitest run`). `docs/flow-stress-test-report.md` (2026-10-05) recorded 66/66 passing across 18 files. The copy session did not re-run them.
6. **Line numbers go stale.** The ones below were true at the 13:51 version of `main.ts`. Locate by function name.

---

## 4. Hard constraints

1. **Keep every element id, `data-*` attribute, class used by tests, and `aria-checked` / `aria-pressed` semantics.** Tests find things by those, not by label text. Used (each confirmed present in the e2e specs): `#btn-remount`, `#btn-place-mode`, `#btn-opening-mode`, `#btn-create-room`, `#btn-import-fixture`, `#btn-import-start-editing`, `#opening-type`, `#presets button[data-preset]`, `#room-preset`, `#room-ingress button[data-ingress]`, `#workspace-mode`, `#product-select`, `#model-files` (**must stay visible by default**; don't put it inside a disclosure), `.slot`, `.swatch`, `.brand`, `[data-testid=…]`, `data-viewer-status`.
2. **The only permitted test edit** is one selector (see §5, Phase 1, step 6). Every other test-pinned string must stay in the DOM or engine. See the table in deck §10.
3. **Don't edit engine messages in `src/viewer/**`** except the two cases in Phase 4 (§5). Unit tests pin several (`/not entity-parsed/i`, `/Soft overlap/`, `Exports: materials, params`, `/not in library/`, `label` contains `mock`). Do the translation in the host with a mapper (Phase 3).
4. **All user-facing strings go in `src/copy.ts`**, keyed by id, as full sentences with `{placeholders}`. There are zero i18n hooks today. No inline literals for anything you add or rewrite. Use a real plural helper (`Intl.PluralRules`), never `(s)`.
5. **Honesty labels, errors and confirmations stay visible.** Only instruction and rationale move into the pop-up.
6. **Don't hold the pop-up to claims the code can't back up yet.** One sentence is currently false (§6 item A). Ship the interim wording until Phase 4 item 1 lands.
7. **Reuse existing CSS tokens and classes** (`--accent`, `--border`, `.btn`, `.btn-primary`, `.muted`, `.small`, `.segmented`, `.warning`, `.warning.critical`, `.upload-status.error`, `.btn[aria-pressed='true']`). The app is light-only on purpose. No new dependencies.
8. **Don't rename the brand.** The viewer says *Catalog 3D* and the prototype says *Room Vibez*. That's an open question, not yours to settle.

---

## 5. Phases

Each phase can land alone. If the larger fix already covers part of one, skip that part and say so in your completion doc.

### Phase 0: Prep

- Snapshot, baseline tests (§3).
- Create `src/copy.ts` exporting a typed `copy` object plus `plural(n, one, other)` and `fmt(template, vars)`. Put in it the strings you migrate in Phases 1 to 3.

### Phase 1: Visible copy diet (no behavior change)

**Deck:** §3.1 to §3.6. **Files:** `index.html`, `src/main.ts`, `src/styles.css`. Targets: viewer static helper text **284 → 91 words** (10 lines; the deck's §3.1 table is the exact list).

1. **Static paragraphs (deck §3.1).** Delete the 5 that the deck marks *(removed)* (room-card intro, scratch subtext, template intro, draw-walls hint, place-furniture hint). Shorten the other 9, plus the new Parts list note. Before deleting an element, grep `main.ts` for its id. Paragraphs without ids aren't referenced.
2. **Badges and headings (deck §3.4 to §3.6):** `MVP` → `Preview`, `stub · onPartListUpdate` → `Placeholder`, `Material slots` → `Materials`, `Light preset` → `Lighting`, `Shell materials` → `Wall and floor finish`, `Place furniture` → `Place products`, and the field and option labels in the deck tables.
3. **Stable button labels.** Today `setToolButtons()` rewrites the labels of `#btn-opening-mode`, `#btn-place-mode` and `#btn-draw-wall-mode` per state. Set fixed labels (`Add opening`, `Place product`, `Draw walls`), keep `aria-pressed` (already styled by `.btn[aria-pressed='true']`), and let the stage hint carry the state. Update the stage hints per deck §3.3 (they now name the selected product, door/window type, and so on).
4. **Unit-suffixed labels.** Dimension labels read `Length ({unit})`, `Width ({unit})`, and so on, from the Units select. Add a `syncUnitLabels()` called at boot and on the `room-units` change.
5. **Import banner pin.** `#import-extract-banner` is a `<p>` set with `textContent` in `renderImportReview()`. Change it to a `<div>` (same id and class `import-banner`, `role="status"`). Fill it with the friendly line from the deck (`Sample result. Your file was kept but not read…` + a **Why?** link), and put the **original technical string unchanged** inside a collapsed `<details><summary>Technical details</summary>…</details>`. The e2e asserts `toContainText('mock_fixture')` and `('ODA available: no')`. Playwright's `toContainText` reads `textContent`, so collapsed content passes, but **verify** (§8).
6. **`#import-oda-note` pin** (`dwg-plan-import.spec.ts:38` expects `ODA / APS not available`). Keep that sentence inside the element in a `<details>Technical details</details>`, with the new one-line visible nudge above it.
7. **Template button.** Rename `Instantiate` → `Use template` (deck §3.5), add `data-action="use-template"` to the button in `renderTemplateList()`, and change `dwg-plan-import.spec.ts:97` from `button:has-text("Instantiate")` to `button[data-action="use-template"]`. **This is the one permitted test edit.**
8. **Overlay errors (deck §3.2).** Fix the WebGL message. It currently tells people to run `Start Viewer.command`, which is the normal launcher. The correct file is `Start Viewer (software 3D).command` (`QUICKSTART.md` agrees). Split the generic "Could not load model:" so a boot failure doesn't say "model".
9. **`#btn-remount`:** relabel to `Restart 3D view` with the new tooltip. Keep the id.
10. **Candidate toggle:** `Accepted/Rejected` → `Included/Left out`, with `aria-pressed`.

**Acceptance:** typecheck and unit tests as baseline; nothing visible regresses; the §8 checks pass.

### Phase 2: The ? pop-up

**Deck:** §2 (final copy for all 5 tabs) and the **Behavior** list at the top of it. **Files:** `index.html`, `src/styles.css`, new `src/help.ts` and `src/help-content.ts` (or put the content in `copy.ts`), wire-up in `main.ts` `boot()`.

- **Button:** 28 × 28 px circular **?** at the right end of `.topbar`, after `.workspace-nav`. Tooltip `How this works`, `aria-label="Help: how this works"`, `aria-haspopup="dialog"`. Check the topbar still wraps at ≤ 720 px (the existing media query).
- **Dialog:** native `<dialog>` opened with `showModal()` (gives focus trap and Esc). `aria-labelledby` → the title `How Catalog 3D works`. A close button with `aria-label="Close help"`. **Return focus to the ? button on close.**
- **Tabs:** a `role="tablist"` with roving tabindex and arrow-key support: Start here · Product · Room · Files & saving · How it's built. At ≤ 860 px, show a *Topic* `<select>` instead. Don't reuse `.segmented` as is (it's a 3-column grid); add a `.help-tabs` variant.
- **Context-aware open:** Product workspace → *Product*, Room workspace → *Room*, otherwise *Start here*. Read the workspace from `document.body.dataset.workspace`.
- **Deep links:** `openHelp({ tab, anchor })` with anchors `#import-plan` (Room tab) and `#plans` (Files & saving). Add **Why?** links beside the import nudge, the sample banner, and the Parts list note. They call `openHelp`.
- **"For developers"** is a collapsed `<details>` at the bottom of *How it's built*.
- **Never auto-open.** Optional dot on the ? until first opened, stored in `localStorage` inside try/catch (storage can be blocked; the app already copes).
- **Content is static authored HTML, not user input.** Render it from the content module, never from anything a user typed.
- **Interim wording:** use the §6 item A replacement in the *Files & saving* tab.
- **CSS:** dialog, backdrop, tabs and content typography using existing tokens. Test at 1280 × 800 and 375 px wide.

**Acceptance:** opens, closes (Esc, button, backdrop click), traps focus, returns focus, opens on the right tab per workspace, deep links land on the right section, no horizontal scroll at 375 px.

### Phase 3: Messages

**Deck:** §4 (A to F), §3.5/§3.6 status rows. **Files:** `main.ts`, new `src/errors.ts`.

- Add `friendlyError(err, ctx)`. It matches engine messages with anchored regexes built from the **"Today" column** of deck §4, returns the new copy, and falls back to a generic plain message while `console.error`-ing the raw error. To list every engine throw site: `grep -n -E "Error\(" src/viewer/*.ts`.
- Replace every `String((err as Error)?.message ?? err)` in `main.ts` with it (18 sites, plus the `String(err?.message ?? err)` in the boot `.catch`). Keep raw detail in `console.error` or a `title`, never in the visible text.
- **Slot warnings:** `renderWarnings()` flags "critical" with `/unknown|incomplete/i` on the message text. The rewritten strings no longer contain those words, so styling would silently stop. Return `{text, critical}` objects instead and key styling off the flag.
- **Pack panel notes:** replace the raw `status.notes` display with the deck's four summaries by `mappingMode`. Keep the raw notes in a collapsed *Details*.
- **Pluralization:** rewrite `opening(s)`, `placement(s)`, `slot(s)`, `template(s)`, `MTL material(s)`, `point(s)`.
- **Escalation (optional):** a per-session counter so a 2nd and 3rd upload failure show the 2nd and 3rd wording (deck §4.A). Skip if it complicates things and note it.
- **Escape user text.** Several lines interpolate user-controlled text into `innerHTML`: `renderTemplateList` (`tpl.title`, filenames), `renderUserMaterials` (`m.name`, from user texture names and `.mtl` material names), `renderWarnings` (mesh names from uploaded files), `renderSlots` (slot labels). You're rewriting these templates anyway, so **build them with `textContent` or DOM nodes** instead. An imported project file or a hostile `.mtl` name can otherwise inject markup. Low severity in a local app, but free to fix here.

**Acceptance:** no raw parser text, `normalizeRoomGraph`, `COLOR_0`, `createAsset`, `SoR`, or `(s)` appears in any visible message. The §8 grep passes.

### Phase 4: Behavior the copy depends on

The words are ready for these. The behavior doesn't exist yet. **If the larger fix already includes them, you only wire up the copy.**

| # | Change | Copy | Where | Stress-test ref |
|---|---|---|---|---|
| 1 | `persistRoomGraph()` swallows storage failures (`roomGraph.ts:512`). Return a boolean or fire an event, and show the banner | Deck §4.F *Saving blocked*. **Unlocks the pop-up sentence in §6 item A.** | `roomGraph.ts`, `main.ts` | E2, F3 |
| 2 | Boot quarantines a bad `catalog3d.roomGraph` (move it to a backup key, start empty, say so, offer download). Harden `normalizeRoomGraph` (finite numbers, ≥ 3 polygon points, positive thickness and ceiling) | Deck §4.F *Saved room unreadable* | `roomGraph.ts`, `main.ts` `boot()` | R6 |
| 3 | A `confirmDialog({title, body, confirmLabel, cancelLabel, destructive}): Promise<boolean>` helper (reuse the help `<dialog>` styles). Use it for **Clear room**, **Replace room**, **Delete template**. Show Replace only when the room has content: `placements.length \|\| openings.length \|\| roomHistory.canUndo()`. Destructive button gets critical styling and is not the primary color | Deck §5 | `main.ts` | E3 |
| 4 | `.mjs` confirm: change `confirmFn` in `modules.ts:132` from `(m) => boolean` to `(m) => boolean \| Promise<boolean>` and `await` it at `:154`. Rewrite `formatMjsGuardMessage` (`mjsGuardrails.ts:51`) to the deck §5 wording: first line = dialog title, the rest = body. Pass a dialog-backed `confirmFn` from `main.ts` at the two `importModuleFile(...)` calls (about `:1398`, `:1547`). `mjsGuardrails.test.ts` checks only the scan, so this is test-safe | Deck §5 *Load .mjs* | `modules.ts`, `mjsGuardrails.ts`, `main.ts` | K4 (keep the guardrail) |
| 5 | Per-field validation: name the field in the error. `createRectangularRoom` throws one generic message for four fields | Deck §4.F *Size invalid* | `roomGraph.ts` (message) + host mapping | R5 |
| 6 | Reject unsupported plan types and files that aren't real DWGs **before** the mock path (`.ifc`, `.exe` and random bytes currently get a plausible result) | Deck §4.E | `dwgImport.ts`, `main.ts` | R3, R4 |

Six flows reset undo history and replace work with no warning: `main.ts` ≈ 443 (use template), 502 (plan → room), 591 (image → room), 638 (open project), 947 (create room), 1730 (clear). Item 3's confirmations guard these.

**Adjacent fixes in the same files** (not copy, but the larger fix probably wants them; flag, don't assume): **K1** (switching units to cm leaves wall thickness at `0.12` → 1.2 mm walls; length, width and ceiling fields also don't convert) and **E4** (import candidates start *accepted*).

### Phase 5: Planner prototype

**Deck:** §6.1 (visible copy), §6.2 (toasts), §6.3 (its 4-tab pop-up), §5 *Start over*. **Files:** `prototypes/room-vibez-planner-flows/{index.html,app.js,styles.css}`. It's plain JS with no bundler, so it can't import from the viewer's `src/`. Write a small vanilla `<dialog>` for its **?**. Don't copy the viewer's code across.

- Apply deck §6.1 and §6.2 exactly. Remove every research label: any visible `Unknown / not in public Planner docs`, `Partial / beta in public Planner docs`, `stub`, `(owned)`, `CMS`, `Planner BOM manager`, and the disabled CAD, ERP, 4K and official-template-hub controls.
- **Vocabulary:** *Parts list* (not BOM / Cart), *product* (not furniture), *Draw it myself* (one manual-draw button, delete the duplicate `#btnManualOnly`).
- **State bugs the copy depends on** (stress test K3, R2, A9):
  - "I've checked the dimensions" must reset whenever a new file is chosen, and `#btnConfirmPlan` must re-disable.
  - *Skip to a demo project* must keep the user's chosen role, and only default to Designer if none was picked, with a toast saying so.
  - *Add starter products* is idempotent. After the first use it says `Starter products added`.
- **Upload zone:** remove "Drop" from the label (there are no drag-and-drop handlers). Optionally add Enter/Space activation (A1).
- **Start over:** use the deck §5 confirm, style the button as secondary, and show the number of placed items.
- **Render-style control:** use the default in §7 (keep it, with the honest toast).
- **Total:** `Total (placeholder prices): €498`, in both the sidebar and the full screen.

**Acceptance:** `document.body.innerText` has none of the research labels above, every toast matches the deck, and the pop-up opens and closes with the keyboard.

---

## 6. Copy that must not ship as written

**A. One false sentence.** Deck §2, tab 4 (*Files & saving*), last paragraph: *"If your browser blocks saving, the app tells you."* **This is false until Phase 4 item 1 lands**, because the failure is swallowed silently. Until then use:

> If your browser blocks saving, your room only lasts while this tab is open. Use **Export project** to keep your work.

**B. Don't add claims the deck doesn't make.** In particular, don't write anything that says switching units converts your numbers (K1 breaks that), or that products you uploaded come back after a refresh.

**C. One inferred gap, not run:** a saved room that used an uploaded product reopens without it, because `reloadAllPlacements()` silently skips products missing from the catalog, while the placement list still shows the entry. The pop-up already warns about it in prose. If you fix it, surface it, for example: *“{name}” isn't available after a refresh, so it wasn't placed back. Add the model again to use it.* (This string is new and isn't in the deck; list it in your completion doc.)

---

## 7. Decisions already made, and open ones with defaults

**Already made. Don't re-ask or redo:** the single **?** (no per-card icons); honesty labels stay visible; stable button labels with `aria-pressed`; *Parts list*, *product* and *sample* as the shared vocabulary; **Workspace** toggle labels stay as they are (decided in `docs/catalog-room-toggle-ux.md`); brand names unchanged; all ids unchanged.

**Open. Take the default unless Adrian says otherwise, and record which you took:**

| # | Question | Default |
|---|---|---|
| 1 | Developer controls on the main screen (*Restart 3D view*, *Developer view: room data*, the Parts list JSON) | Relabel and keep. Don't move into ? › For developers |
| 2 | Wrap *Load pack* and *Load module* in an *Advanced* disclosure | **Skip.** It's layout, not copy, and `#model-files` must stay visible |
| 3 | Prototype *Render style* control | Keep, with the honest toast (deck §6.2) |
| 4 | "That's 1 mm, did you mean…?" implausible-size message | **Skip** until min/max sizes are decided. Implement only the non-positive per-field messages |
| 5 | Import candidates start *Not reviewed* | **Skip.** Keep today's accepted-by-default with the Included / Left out toggle |
| 6 | Escalating wording on repeated upload failures | Implement if cheap; otherwise use the 1st wording and note it |

---

## 8. Verification

**Always:**
1. `npm run typecheck`, then `npm test`. Same pass count as your baseline. **Unit tests must not need edits.** If one fails, your change broke a pinned string. Fix the host mapping, not the test.
2. `npx playwright test viewer.spec.ts` (the only spec that doesn't write outside the project).

**For the specs you can't run as-is:** copy `dwg-plan-import.spec.ts` (and any other you need) to your scratchpad, **point its `MEDIA` and `ARTIFACTS` constants at scratch folders**, and run that copy. At minimum these assertions must pass: `.brand` = `Catalog 3D`; `#import-oda-note` contains `ODA / APS not available`; `#import-extract-banner` contains `mock_fixture` and `ODA available: no`; the template step with your new `data-action="use-template"` selector; `#btn-place-mode` and `#btn-opening-mode` toggle `aria-pressed`.

**In a browser** (`http://127.0.0.1:18767/`, headed or the in-app browser), at **1280 × 800** and **375 px** wide. Save screenshots to `media/ux-copy/` (the project's convention: `media/<fix-name>/`):
- Product workspace (cold load, nothing selected)
- Room workspace, no room
- Room workspace, with a room and a placed product (including an overlap warning)
- Import plan → sample plan review (sample banner visible, Technical details collapsed)
- Each of the 5 **?** tabs, plus a deep link from a **Why?**
- Clear room and Replace room confirmations
- One of each error: bad model file, PDF plan, bad project file (confirm *your current room is unchanged*), `.mjs` confirm
- The prototype's five screens and its **?**

**Grep and DOM checks (run in the page console after boot):**
```js
// Visible text must not leak team vocabulary. innerText skips closed <dialog> and collapsed <details>.
/(SoT|SoR|MVP|\bstub\b|ingress|candidates|fixture|Polyfork|material_slot_id|\bmock\b|createAsset|COLOR_0|normalizeRoomGraph|Unknown \/ not in public)/i
  .test(document.body.innerText)   // expect: false
```
Also check: no `(s)` plurals in visible text; every `button[aria-pressed]` keeps a fixed label across its states; the **?** has an accessible name; Esc closes the dialog; focus returns to the **?**.

**Measure the diet:** re-count the static `<p>` text in `index.html` with the tokenizer in deck §8 (skip bare `·` and `—`). Expect about 91 words in 10 lines (± a few) in the default Product state.

---

## 9. Out of scope

- Engine rewrites or new features beyond Phases 0 to 5. No new materials, no real DWG parsing.
- The Coohom captures (`screenshots/`, `diagrams/`, `chrome-profile-coohom/`, `continue-pass*.json`).
- Rewriting other docs. Exception: your completion doc.
- Choosing which UI is canonical (the viewer's room workspace vs the prototype). That's an open question (stress test §7).
- Touching `History/`. It's a running log from earlier sessions. If you append, append only, in its existing format, and tell Adrian.

---

## 10. Deliver

1. The code changes (Phases you took).
2. `docs/ux-copy-fix.md`, following the project's precedent (`docs/model-display-fix.md`, `docs/room-floor-extent-zfight-fix.md`): what changed and why, which phases and which §7 defaults you took, the measured word count before and after, test results (counts, plus which specs you ran and how), links to `media/ux-copy/`, and **open items**.
3. In that doc, list: (a) every string you wrote that is **not** in the deck; (b) every deck string you changed and why; (c) anything in the deck that turned out to be wrong.
4. If you find a user-facing string the deck missed, find them all with:
   `grep -n -E "textContent *=|innerHTML *=|\.title *=|\.placeholder *=|alert\(|confirm\(|Error\(" src/main.ts src/viewer/*.ts index.html`

### Known facts, already verified (don't re-derive)

- The WebGL message names the wrong launcher file (§5, Phase 1, step 8).
- Nothing leaves the browser: the only `fetch` calls load local library JSON and the sample plan (`main.ts:184`, `dwgImport.ts:212`).
- Wall drawing snaps to right angles and closes within 0.35 m of the first corner (`freeformWalls.ts`).
- Unlabeled uploads get one slot named **Surface** (`uploads.ts:152`).
- Feet inputs are decimal (`toMeters`: `value * 0.3048`); labels render as `9' 10.1"` (`formatLength`).
- Placed products can't be moved in the viewer. Only delete and re-place.
- Undo/redo: Ctrl/Cmd+Z, Shift+Z, Y (`main.ts` ≈ 1782 to 1793).
- FBX, USDZ and `.blend` are rejected by the model upload with a "Select a .glb…" message (measured by the stress test).

### Not verified

- That Draco/Meshopt GLBs fail to load (from `README.md`, not tested).
- That Playwright's `toContainText` passes on collapsed `<details>` content. I believe it uses `textContent`; **confirm in §8** before relying on it.
- The full e2e suite (never run by the copy session, see §3 item 4).
