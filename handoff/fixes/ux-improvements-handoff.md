# UX improvements (behaviour, layout, flow): handoff to the implementing Claude

**Audience:** the Claude session that applies this as part of one larger fix. Nobody else needs to read it.
**Written:** 2026-10-05, from a live design critique (browser at 1440×900 and 375×812) plus a read of the code.
**Status:** nothing here has been applied. Every item is a proposal with evidence.
**Scope:** `hackathon-3d-viewer/` (the live app, "Catalog 3D", `http://127.0.0.1:18767/`).
**Project root:** `/Users/adrian/Desktop/Room Vibez/` (not a git repo). Paths below are relative to it.

---

## 0. Read this first: there is a sibling handoff

`fixes/ux-copy-improvements.md` (plus `docs/ux-copy-deck.md`, the final copy) was written in a parallel session. It is meant to be applied in the same larger fix.

**Division of labour**

| This document owns | The copy handoff owns |
|---|---|
| Behaviour, layout, task flow, feedback placement, camera/visibility, editing of placed items, targets and accessibility semantics | Every user-facing **word**, the **?** help dialog, status/error messages, confirmation dialogs, `src/copy.ts`, the prototype's copy and state bugs |

**Rule for words:** the deck wins. Do not apply a second set of wording from this file. Where this file needs a string the deck lacks (toasts, empty-state card, "Add to room", numbered list rows), write it in the deck's voice (deck §1), put it in `src/copy.ts`, and list it as "new, not in the deck" in your completion doc.

### 0.1 Where the two documents disagree, and how to resolve it

| Topic | This document (original instinct) | Copy handoff | **Resolution for this pass** |
|---|---|---|---|
| Clear room / Replace room | Make it undoable (`history:'commit'`) | `confirmDialog`; deck §5 body says **"You can't undo it"** | **Follow the deck: confirm dialog, history unchanged.** Copy and behaviour must agree. Undoable is an upgrade, see DECISION D4 (if you take it, the deck §5 bodies must change) |
| `#model-files` visibility | Collapse uploads into a closed disclosure | Hard constraint: **stays visible by default** | **Keep it visible.** Fix the Product mode ordering by putting **Materials above** the compact "Add 3D model" row. Collapse only texture / pack / module (UX-07) |
| "Dispose & remount" | Move into a Developer disclosure | Relabel **Restart 3D view**, keep visible (`viewer.spec.ts:81` clicks `#btn-remount`) | **Relabel and keep it in the stage toolbar** |
| Parts list / Room graph JSON | Developer disclosure | Relabel, keep (`Developer view: room data (JSON)` is already a `<details>`) | **Keep as is**; use the deck's labels |
| Button labels that change with state | (not addressed) | Fixed labels `Add opening` / `Place product` / `Draw walls` + `aria-pressed`; the stage hint carries state | **Follow the deck.** My tool chip *is* that stage hint (UX-04): one element, deck §3.3 text, not two |
| Test edits | Several (§3) | "Only one selector may change" | The structural edits in §3 are **required** by UX-07/08. The "one test edit" rule is for a copy-only pass |
| Running e2e | Hard-coded Cursor paths in a spec | Six specs write there; **do not run them as-is**; copy to scratch with paths redirected | **Use the scratch-copy method** (copy handoff §8) |
| Persistence banner, corrupt-state quarantine, per-field validation, unsupported-file rejection | Out of scope | Phase 4 items 1, 2, 5, 6 | **Copy handoff owns them** |
| Prototype | Quick copy fixes | Phase 5 (full list) | **Copy handoff Phase 5 owns it.** Skip prototype work here |
| Unit switch doesn't convert (K1) | UX-01 | Flagged as adjacent | **Do it here (UX-01)** |
| Imported candidates default state | Leave | Skip | **Leave**, relabel only (D2) |
| `History/` | "Add an entry" | "Append only, tell Adrian" | **Append-only, in the existing format; tell Adrian** |

### 0.2 Suggested order for the combined fix

1. Snapshot + baseline (§1).
2. Copy handoff **Phase 0** (`src/copy.ts` with `copy`, `plural`, `fmt`). Everything new below uses it.
3. This doc **Phase A** (UX-01, UX-02, UX-03). The `confirmDialog` helper from copy Phase 4 item 3 is needed by UX-03: build it once.
4. This doc **Phase B** (UX-04, 05, 06), then **Phase C** (UX-07, 08, 09, 10). Structure first, so the copy pass edits the final DOM.
5. Copy handoff **Phases 1 to 3** (diet, ? dialog, messages), then its Phase 4 leftovers.
6. This doc **Phase D** (UX-12, 13).
7. Verification (§6) and one completion doc (§8).

### 0.3 Working rules

- **There is no git.** Copy `hackathon-3d-viewer/{index.html,src,tests}` to a timestamped folder outside the project (your scratchpad) before editing. That is the only rollback.
- **Another session edits `src/main.ts` and `src/viewer/RoomVibezViewer.ts`.** Re-read a file right before editing, use targeted edits, never whole-file rewrites. Line numbers below are from 2026-10-05; `grep` the symbol first.
- **The dev server is already running** on `:18767` (`--strictPort`). Don't start a second one; Vite hot-reloads.
- **Reproduce before you fix.** Each item has a "Reproduce" line. If you can't reproduce, say so in your summary rather than guessing.
- **Don't report "done" for anything you didn't check in a browser.**

### What you must not do

- Do not invent features, prices, SKUs, or claims about DWG/ODA fidelity. Honesty labels are policy (`hackathon-3d-viewer/ASSUMPTIONS.md`, "Explicitly NOT claimed"). Rewording is the copy handoff's job. Removing a caveat is nobody's.
- Do not add a second 3D engine or a non-Three.js runtime.
- Do not rename or remove DOM ids that tests use (§3). Moving an element is fine.
- Do not regress the cold-load fix: a cold boot lands on **Product** with the demo chair visible (`docs/model-display-deep-qa-fix.md`, `tests/e2e/model-display-cold-load.spec.ts`).
- Do not touch `chrome-profile-coohom/`, `screenshots/`, `continue-pass*-report.json`, or the Coohom docs.
- Do not decide the open product questions in §5 silently.

---

## 1. Context

**What the app is.** A Three.js furniture viewer plus a room workspace.
- **Product workspace** (default on cold load): turntable for one GLB, material-slot swatches, light presets, uploads (GLB/OBJ/MJS packs).
- **Room workspace**: build a room (from scratch, import a plan, or from a template), mark doors/windows, place catalog products on the floor. One owned `RoomGraph` JSON is the source of truth; meshes are derived from it.

**Files you will touch most**

| File | Size | Role |
|---|---|---|
| `hackathon-3d-viewer/index.html` | 359 lines | The whole side panel: `.panel` holds `#room-card`, `#catalog-card`, then four un-wrapped cards (Material slots, Add texture, Light preset, Parts list) |
| `hackathon-3d-viewer/src/main.ts` | 1879 lines | All UI wiring: `setWorkspace`, `renderRoomUi`, `onCreateRoom`, `onRoomPointer`, `placeCurrentProduct`, `applyRoomGraph`, `renderImportReview` |
| `hackathon-3d-viewer/src/styles.css` | 245 lines | All styles (Polaris-like tokens, light only) |
| `hackathon-3d-viewer/src/viewer/RoomVibezViewer.ts` | 795 lines | Three.js viewer: `frameRoom`, `setInteractionMode`, `raycastRoom`, `attachPlacement` |
| `hackathon-3d-viewer/src/viewer/roomMesh.ts` | 435 lines | Wall/floor/ceiling meshes; shell colours in `defaultMaterials` |
| `hackathon-3d-viewer/src/viewer/roomGraph.ts` | | `updatePlacement` (:467), `removePlacement` (:486), `persistRoomGraph` (:505) |
| `hackathon-3d-viewer/src/viewer/roomHistory.ts` | | 50-deep snapshot undo; `commit(null)` is supported |

**Run it**

```bash
cd "/Users/adrian/Desktop/Room Vibez/hackathon-3d-viewer"
export PATH=~/.nvm/versions/node/v22.23.2/bin:$PATH   # if node is not on PATH
npm run typecheck && npm test && npm run build
```

`docs/flow-stress-test-report.md` recorded 66/66 Vitest tests passing (18 files) on 2026-10-05. Run them yourself for a fresh baseline.

**E2E caution.** Six specs (`model-display-cold-load`, `dwg-plan-import`, `missing-features`, `model-display`, `room-floor-extent`, `room-from-scratch`) write screenshots to hard-coded `~/Library/Application Support/Cursor/AgentStores/…` paths. Don't run them as-is. Copy the spec you need to scratch, point its `MEDIA`/`ARTIFACTS` constants at scratch folders, and run that copy. Only `viewer.spec.ts` is safe to run directly. E2E needs the installed Google Chrome with SwiftShader (about 45 s for the full suite).

`window.__rv` is a test hook (`main.ts:~1847-1870`). Extend it if needed; don't remove members.

---

## 2. Baseline and targets

Measured with a clean `localStorage`, fresh load, 1440×900 (panel client height 781 px), Product mode:

| Metric | Before | Target |
|---|---|---|
| Side-panel scroll height | **3106 px** (4× its visible height) | Product mode ≲ 1000 px |
| Top of panel → **Material slots** | **1835 px** (2.3 panel-heights) | Visible with no panel scroll |
| Top of panel → **Light preset** | 2704 px | A stage control, always visible |
| `#room-card` height | 926 px with no room; **1705 px** with one | Only the active workspace is shown |
| Visible native `<input type=file>` | 5 fresh; **6** with a room (one is the "hidden" `#project-file`) | Only the compact "Add 3D model" input |
| Controls under 32 px tall | 3 fresh (workspace toggle 31 px); list buttons 52×22; checkbox 13×13 | 0 (≥44 px on coarse pointers) |
| Mobile 375×812: scrolls to reach Material slots | **4.3 screens** | ≤1.5 screens |
| Room mode: status line ↔ Place button | **963 px apart** | Feedback on the canvas |
| Dimmed inactive card's muted text | ≈3.4:1 (computed, not measured) | Removed |

An earlier summary said slots were "~1,000 px down". That was after the mode switch had auto-scrolled the panel. From a fresh load it is 1835 px.

### Task flows (before → target)

| Task | Today | Target |
|---|---|---|
| First chair in a 5×4 room | Room workspace → Preset → Create room → orbit to find the floor → scroll ~960 px → Place mode → click floor (**7**, with 2 scroll trips and a hidden-state trap) | Room workspace → Create room → **Add to room** (**3**, floor visible, feedback on the canvas) |
| Make the chair walnut | Scroll 1835 px, click a swatch | Swatches visible on arrival |
| Fix a mistake | Undo mid-panel; Clear room destroys history | Confirm before destroy; Undo/Redo always reachable |

---

## 3. Test contract (read before changing the DOM)

Regenerate the selector list with `grep -ho "'#[a-zA-Z0-9_-]*'" tests/e2e/*.ts | sort -u`.

**Ids (keep all):** `#product-select`, `#room-preset`, `#btn-create-room`, `#btn-place-mode`, `#btn-opening-mode`, `#model-files`, `#room-tools`, `#room-plan`, `#import-review`, `#import-extract-banner`, `#import-oda-note`, `#btn-import-fixture`, `#btn-import-plan`, `#btn-import-start-editing`, `#btn-import-save-template`, `#plan-file`, `#underlay-width`, `#underlay-depth`, `#underlay-review`, `#btn-underlay-confirm`, `#template-title`, `#btn-save-template-scratch`, `#room-ingress-import`, `#room-ingress-template`, `#room-wall-material`, `#place-wall-snap`, `#btn-undo`, `#btn-redo`, `#btn-export-project`, `#btn-clear-room`, `#btn-remount`, `#parts-list`.
**Also:** `#workspace-mode button[data-mode=…]`, `#room-ingress button[data-ingress=…]`, `#opening-type button[data-type=…]`, `#presets button[data-preset=…]`, `.slot[data-slot] .swatch[data-material]`, `.brand` (text stays `Catalog 3D`), `[data-testid=parts-list]`, `body[data-viewer-status=ready]`.

**Honesty-guardrail text (keep these substrings):** `#import-oda-note` contains `ODA / APS not available` (`dwg-plan-import.spec.ts:38`); `#import-extract-banner` contains `mock_fixture` and `ODA available: no` (`:42-43`). Playwright's `toContainText` should read `textContent` and so pass on collapsed `<details>`, but the copy handoff flags this as unverified, so confirm it.

**Spec edits this document forces**

| Spec | Why it breaks | Fix |
|---|---|---|
| `room-from-scratch.spec.ts:27-28` | `selectOption('#room-preset')` and `click('#btn-create-room')` run while still in **Product** mode. Once the inactive workspace is hidden these wait forever | Click `#workspace-mode button[data-mode=room]` first (it mirrors what a user does) |
| `room-from-scratch.spec.ts:30-31` | `#room-tools` and `#room-plan` must be visible after create | Keep `#room-tools` as the visible wrapper (steps live inside it), or expand in the test |
| `room-from-scratch.spec.ts:~80-105` | `selectOption('#product-select')` in **Room** mode, then again in **Product** mode | `#product-select` stays one element, visible in both modes (UX-08 re-parents it) |
| `dwg-plan-import.spec.ts:89` | Clicks `#btn-clear-room`, then an ingress tab in the room card | Fine if the user **stays in Room workspace** after Clear (UX-03). If a confirm dialog now appears, the test must confirm it |
| `dwg-plan-import.spec.ts:~97` | `button:has-text("Instantiate")` | The copy handoff changes it to `button[data-action="use-template"]` |

Not affected, because of the §0.1 resolutions: `#model-files` visibility assertions (`room-from-scratch.spec.ts:24`, `dwg-plan-import.spec.ts:33`), `#btn-remount` (`viewer.spec.ts:81`), `#presets` (ids stay).

**Add new tests with the fixes** (each item lists them).

---

## 4. Work items

Severity: 🔴 blocks or misleads a core task · 🟡 slows a task · 🟢 polish. Effort: S ≈ hours, M ≈ a day, L ≈ several days.

### Phase A: trust bugs (do first, independent)

#### UX-01 🔴 S: Typed room size is ignored while a preset is selected

- **Reproduce:** Room workspace, leave "Small bedroom 3×3 m" selected, type `6` in Length, click Create room. The field still says 6; the status says `3.00 m × 3.00 m`. Measured.
- **Cause:** `onCreateRoom` (`main.ts:~926-948`) uses the preset values when `presetId !== 'custom'` and ignores the fields. The preset `change` handler (`main.ts:~1700`) fills the fields, but nothing flips the preset to Custom when the user edits them.
- **Do:**
  1. Make the fields the single source of truth: always read length/width/ceiling from the inputs. Keep the preset only for the room *name*.
  2. On `input` of length/width/ceiling, set `roomPreset.value = 'custom'`.
  3. Same form, same family (stress test K1/F8): the `#room-units` change handler (`main.ts:~1706`) doesn't convert field values. Switching to cm leaves wall thickness at `0.12`, read as 0.12 cm, giving 1.2 mm walls. Track the previous unit and convert length, width, ceiling, thickness and the opening width/height/sill fields via `fromMeters`/`toMeters`. Update each field's `min`/`step` per unit.
- **Done when:** Small bedroom + Length 6 → a 6.00 m room and the preset reads "Custom…". Switch to cm → fields read 300/300/270/12 and the created wall thickness is 0.12 m.
- **Tests:** an e2e or unit check for both cases.

#### UX-02 🟡 S: A native "Choose file" widget shows under Export/Import project

- **Cause:** `<input id="project-file" … hidden>` (`index.html:187`) is overridden by `.file-input { display:block }` (`styles.css:101`). Measured `display:block`, 20 px tall.
- **Do:** add `[hidden] { display: none !important; }` to `styles.css`. Grep for any other element that sets `hidden` and also has a `display` rule.
- **Done when:** with a room present, `getComputedStyle(document.getElementById('project-file')).display === 'none'`.

#### UX-03 🔴 M: "Clear room" destroys work with no guard

- **Cause:** `main.ts:1727-1732` runs `applyRoomGraph(null, { history: 'reset' })` (wipes undo) then `setWorkspace('catalog')`. The button is full-width directly under the primary "Create room" (`styles.css:199`). Template Delete (`main.ts:~451-455`) is unguarded too. The copy handoff counts six flows that reset history and replace work silently: use template (~443), plan → room (~502), image → room (~591), open project (~638), create room (~947), clear (~1730).
- **Default for this pass (matches deck §5):**
  1. Add the shared `confirmDialog({ title, body, confirmLabel, cancelLabel, destructive }): Promise<boolean>` helper (copy handoff Phase 4 item 3; build it once, `<dialog>`-based). Use it for **Clear room**, **Replace room** (only when the room has content: `placements.length || openings.length || roomHistory.canUndo()`), and **Delete template**. Wording comes from deck §5. Destructive button gets critical styling and is not the primary colour.
  2. After Clear, **stay in the Room workspace** (remove the `setWorkspace('catalog')`). UX-06 supplies the empty state. `dwg-plan-import.spec.ts:89` relies on this.
  3. Demote the button: secondary/danger, not full-width under the primary, away from "Create room".
- **Done when:** Clear room opens "Clear this room?" with the counts; "Keep room" changes nothing; "Clear room" empties the room and leaves you in the Room workspace showing the empty state. Same pattern for Replace and Delete template.
- **Upgrade (DECISION D4):** if Adrian prefers undoable, switch those flows to `history:'commit'`. **Then the deck §5 bodies are false ("You can't undo it") and must change**, and `#btn-undo` is hidden when there's no room (`renderRoomUi` sets `roomTools.hidden = !has`), so Undo-after-Clear needs a toast action or a persistent toolbar. Don't ship half of this.
- **Tests:** a clear-with-confirm test; update `dwg-plan-import.spec.ts:89` to accept the dialog.

### Phase B: feedback and discoverability

#### UX-04 🔴 M: Feedback lives 963 px away from the action

- **Cause:** all tool feedback goes to `#room-status` (above the 2D plan). In Place mode, clicking anything that isn't the floor writes "Click the floor inside the room…" there (`main.ts:~800`) while the user is looking at the canvas and the panel is scrolled to the Place button 963 px lower. The only on-canvas text is an 11 px hint.
- **Do:**
  1. Add `<div id="stage-toast" aria-live="polite" hidden>` inside `.stage` and a `notify(message, { kind, action?, timeoutMs })` helper in `main.ts`. Route canvas-originated messages through it: place/opening/draw errors and successes, collision warnings, undo/redo, import errors surfaced from the stage. Keep `#room-status` as the persistent summary but make sure only **one** of them is a live region.
  2. **State line on the stage:** the existing stage hint becomes the single on-canvas state line, using the deck §3.3 strings (e.g. `Click the floor to place “{product}”.`). Make it a visible chip at ≥12 px that disappears when no tool is active. Don't build a second element beside it.
  3. Add an **Esc** handler (the keydown listener at `main.ts:~1782` only handles undo/redo): exit the tool mode via `viewer.setInteractionMode('room')` and `setToolButtons(null)`. Ignore keys while focus is in an input/select/textarea.
  4. The crosshair cursor already exists (`RoomVibezViewer.ts:339`). Don't re-add it.
- **Done when:** in Place mode, clicking a wall shows a toast inside the stage bounds that is readable without scrolling the panel; Esc leaves Place mode and `#btn-place-mode`'s `aria-pressed` returns to false.
- **Tests:** enter Place mode, `simulateRoomPointer(null, 'place')`, expect `#stage-toast` visible with text.

#### UX-05 🔴 M: The floor is invisible on arrival, so Place mode looks broken

- **Cause:** `frameRoom` (`RoomVibezViewer.ts:389-413`) places the camera at direction `(0.9, 0.55, 1.1)` outside the room, and the two near walls are opaque. Walls (`#d8d4cc`), floor (`#b9b0a2`), ceiling (`#efefef`) and the stage background (`#F1F1F1`) are all pale and close (`roomMesh.ts:62-75`, `presets.ts:33`). In my run the first two floor clicks hit a wall, and I had to orbit before the floor appeared.
- **Do:**
  1. **Camera:** raise the default elevation to roughly 45–55° so the floor shows from the first frame.
  2. **Cutaway (preferred):** hide walls that face the camera. Each wall mesh has `userData.kind === 'wall'` and `userData.wallId` (`roomMesh.ts:130-131`), and `wallBasis` already computes an `outward` vector (`roomMesh.ts:47-56`). Store it in `userData.outward`, and in the render loop toggle `mesh.visible` when `dot(outward, cameraPos − wallCentre) > 0`.
     - **Watch out:** three.js `Raycaster.intersectObjects` does *not* skip `visible=false` objects. Filter on `o.visible` when building `targets` in `raycastRoom` (`RoomVibezViewer.ts:~416-430`), or clicks still hit hidden walls.
     - The wall material may be one shared instance. Toggle `visible` or clone materials; don't set per-wall opacity on a shared one.
  3. **Contrast:** make the floor read clearly against the walls and background (slightly darker/warmer floor and/or a thin outline). Check it under **both** "Studio soft" and "Neutral" (background `#FFFFFF`). Check the ceiling isn't washing out the view (`setCeilingVisible`, `RoomVibezViewer.ts:385`).
  4. **Optional:** a ghost footprint under the cursor in Place mode (`pointermove` raycast; `footprintFromObject` is already imported in `main.ts`).
- **Done when:** right after "Create room", with no camera input, a screenshot at 1440×900 **and** 375×812 shows the whole floor, and a raycast through the projected room centre returns `kind: 'floor'` (add a test hook if needed).
- **Tests:** a Playwright raycast check; don't rely on screenshots alone.

#### UX-06 🟡 S–M: Room workspace with no room shows a chair and no guidance

- **Cause:** `setInteractionMode` sets `turntable.visible = catalog || !this.roomGraph` (`RoomVibezViewer.ts:333`), so with no room the demo chair stays on stage. `setWorkspace('room')` only calls `setInteractionMode('room')` when a graph exists (`main.ts:~758`). `setToolButtons` overwrites the correct hint with the orbit text whenever `workspace === 'room'`, even with no room (`main.ts:~728-733`).
- **Do:**
  1. When `workspace === 'room' && !roomGraph`, hide the turntable and show an empty-state card over the stage (`#stage-empty`) with three buttons wired to `setRoomIngress`: create from scratch, import a plan, use a template (strings: new, deck voice).
  2. Fix the hint branch so the orbit text only shows when a room exists. The no-room hint is `Create or import a room to start.` (deck §3.3).
  3. Must not regress Product: Room → Product still shows the chair (`model-display.spec.ts`, `model-display-cold-load.spec.ts`).
- **Done when:** Room workspace + no room → card, no chair, correct hint. Product workspace unchanged.

### Phase C: structure (largest; update the specs in the same change)

#### UX-07 🔴 L: One workspace's controls at a time; Product mode leads with its main task

- **Cause:** `.panel` is a single 3106 px column holding both workspaces; the inactive one is only dimmed (`opacity:.72`, `styles.css:172-188`). In Product mode the Room card is first (926 px), the Product card with three upload blocks is next, and **Material slots**, the product's main interaction, sits at 1835 px.
- **Do:**
  1. Wrap panel content in two groups, `data-workspace-panel="catalog"` and `="room"`, and give the inactive group `hidden`. Delete the dimming rules.
  2. **Product group order:** Product picker + meta → **Materials** (+ slot warnings) → compact **Add 3D model** (`#model-files`, **stays visible**) → one closed **Advanced** disclosure holding Add texture, Load pack, Load module and the `.mjs` enable checkbox (copy handoff open question #2 skipped it only as "layout, not copy"; it's a layout call and it's made here) → Parts list.
  3. **Light preset:** move `#presets` into the stage toolbar beside Reset camera and Restart 3D view. It applies to both workspaces and the card costs 114 px for three buttons. Give the group an accessible name from the deck (`Lighting`). The toolbar already wraps (`flex-wrap`); check 375 px.
  4. **Scroll on mode switch:** replace the two `scrollIntoView({ block: 'nearest' })` calls (`main.ts:752`, `:764`) with `panel.scrollTo({ top: 0 })`. Today they leave the panel mid-form (scrollTop 161 after switching to Room, clipping the header and ingress tabs).
  5. Leave `#btn-remount` in the stage toolbar and `Developer view: room data (JSON)` as the `<details>` it already is (§0.1).
- **Done when:** at 1440×900 in Product mode Materials is fully visible without scrolling the panel; at 375×812 it is within about 1.5 screens; the only visible native file input is `#model-files`.
- **Tests:** update the specs in §3. Keep `#model-files`'s `accept` attribute (`room-from-scratch.spec.ts:118` reads it).

#### UX-08 🔴 L: Room workspace organised by task, with the product picker where it is used

- **Cause:** the Room card order is create form → Clear → status → plan → Undo/Redo/Export/Import → Shell materials → Draw walls → Openings → Place furniture. "Place furniture" says "Select a Catalog product", but the picker lives in another card 141 px lower (and dimmed). "Save current room as template" sits above the primary CTA before any room exists.
- **Do** (step titles use the deck's vocabulary: *product*, not *furniture*):
  1. Inside `#room-tools`, make a four-step accordion (one open at a time, `aria-current="step"`): **1 Room** (create tabs + form, with "Draw walls" moved here as the alternative way to shape the room) · **2 Openings** · **3 Place products** · **4 Wall and floor finish**.
  2. After Create room / Import confirm / Use template: collapse step 1 into a one-line summary with a "Change" link and open the next step. Primary-button styling only on the current step's main action.
  3. **Place products step:** holds the product picker, "Snap to nearest wall", and the products list. Re-parent the **single** `#product-select` into this step when `workspace === 'room'` and back into the Product card when `workspace === 'catalog'`, so `selectOption('#product-select')` keeps working in both modes. Add an **Add to room** button (primary) that places the selected product at the first free spot or the room centre with no pointer needed; keep `Place product` (the pointer mode) as secondary. This is also the keyboard and mobile path. *New string, deck voice.*
  4. Show the length/width/ceiling/thickness fields only when the preset is Custom (collapsed "Adjust size" otherwise). Works with UX-01.
  5. A persistent toolbar (stage top-right, or a sticky panel header) with **Undo, Redo, Export project, Import project** whenever a room exists. Keep the hidden `#project-file`.
  6. Move "Save as template" out of the create form (into the step-1 summary or a "More" menu) and enable it only when a room exists. Move the units select to a small control in step 1.
- **Done when:** after Create room at 1440×900, the user can pick a product and place it without scrolling the panel by more than one viewport (or with one click on **Add to room**); in Room mode no Product-card controls appear except the picker.
- **Tests:** keep `#room-tools` visible after create; update specs per §3.

#### UX-09 🔴 L: Placed products can't be selected, moved or rotated

- **Cause:** `renderPlacementList` (`main.ts:701-719`) renders a name and Delete. Two chairs are two identical rows with no link to the 3D object; the only correction is Delete + re-place. A canvas click with no tool active does nothing (`onRoomPointer` has no branch for mode `room`).
- **Do:**
  1. **Viewer:** extend `RoomPointerHit` (`RoomVibezViewer.ts:53`) with `{ kind: 'placement', placementId }`. In `raycastRoom`, test `placementsRoot` meshes first and walk up to the root with `userData.placementId` (set at `:468`). Add `setPlacementPose(id, {x,z}, rotationY)` that mutates the existing root. **Do not reuse `attachPlacement`**: it calls `detachPlacement`, which disposes the root (`:456-478`). Add `setPlacementHighlight(id | null)` (a `Box3Helper` outline is enough).
  2. **Host:** `selectedPlacementId` in `main.ts`. In Room mode with no tool active, a canvas click on a product selects it; empty space deselects. Rows are numbered per product ("Lounge chair 1", "Lounge chair 2"; the list label is `Products`, deck §3.6), clicking a row selects, hovering highlights, and the selected row has `aria-current`.
  3. **Actions on the selected product:** rotate ±90° (button, and `R` / `Shift+R`), nudge with arrow keys (5 cm, `Shift` = 25 cm), Delete (button + `Delete`/`Backspace`), optional Duplicate. Each goes through `updatePlacement` (`roomGraph.ts:467`) and `applyRoomGraph` with history `commit`, so Undo works. After a move, re-run `checkPlacementCollision` and show the soft warning in the toast.
  4. **Optional:** drag-to-move in select mode (disable orbit controls while dragging).
  5. Extend the keydown handler (`main.ts:~1782`).
- **Known adjacent gap (from the copy handoff §6C, inferred, not run):** `reloadAllPlacements` silently skips products missing from the catalog (e.g. a session-uploaded model after a refresh) while the list still shows the entry. If you touch that code, surface it rather than hiding it.
- **Done when:** place two chairs → rows "Lounge chair 1/2"; click chair 2 on the canvas → row 2 highlighted and the chair outlined; `R` rotates it; arrows nudge; Delete removes; Ctrl+Z reverses each step.
- **Tests:** e2e via `simulateRoomPointer({ kind: 'placement', placementId }, 'room')`; unit-test pure helpers.

#### UX-10 🔴 M: Finishes chosen in Product mode are probably not carried into the room (VERIFY FIRST)

- **Evidence (code only, not run in a browser):** `placeCurrentProduct` stores `slot_bindings[s.id] = s.default` (`main.ts:877`), and `loadPlacementRoot` (`main.ts:903-911`) returns a fresh `GLTFLoader` clone. Neither applies the swatch picked in Product mode. `reloadAllPlacements` ignores `pl.slot_bindings` too.
- **Reproduce first:** Product → set Frame to Walnut → Room workspace → place the chair. Does it come out walnut? If yes, close this item and say so.
- **If confirmed, minimal honest fix:** at placement time snapshot the current slot choices (`viewer.getSlots()`, the shape the remount handler reads at `main.ts:1797`) into `slot_bindings`, and apply them to the placed root through the existing slot-binding path (`src/viewer/slots.ts`). Apply `pl.slot_bindings` in `reloadAllPlacements` as well.
- **Do not** invent a BOM or variant schema (stress test A8; unknowns U9/U13 in `ASSUMPTIONS.md`). Persist only the existing `slot_bindings` field.
- **Per-item re-materialing** (select a placed chair, change its swatches) depends on UX-09; see D3. If you can't do it in this pass, say so in the UI (deck voice): placed products use the product's default finishes.

### Phase D: targets and accessibility

#### UX-11: Copy pass

**Not done here.** Superseded by `fixes/ux-copy-improvements.md` + `docs/ux-copy-deck.md`. This critique's findings that motivated it (developer vocabulary such as "SoT", "SourceAsset", "IBL", `material_slot_id`, `wc_s · A-WALL`; raw JSON in the Parts list; the "Instantiate" button; "Dispose & remount") are all covered there. Don't apply a second set of wording.

#### UX-12 🟡 S–M: Target sizes, type size, mobile layout

- `.room-list button` (`styles.css:218-221`; measured 52×22) → `min-height: 32px`, and `@media (pointer: coarse)` → 44 px. Same for `.btn`, `.segmented button` (31 px today) and `summary`.
- `.swatch` is 34×34: keep on desktop, 44×44 on coarse pointers.
- Checkbox 13×13 → 18×18 with `accent-color: var(--accent)`; keep the whole label clickable.
- Instruction text at 11 px (`.hint`, `.workspace-nav-label`, `.field > span`) → 12 px minimum. Only four font sizes are in use (11/12/13/14).
- **Mobile (`@media (max-width: 860px)`):** make the stage sticky (`position: sticky; top: 0; height: 44vh; min-height: 260px; z-index: 5`) so tools and canvas are visible together. Add `scroll-padding-top` so focused controls aren't hidden behind it. Keep `overflowX = 0` at 375 px (it is 0 today).
- **Done when:** the §6 snippet reports 0 controls under 32 px on desktop; at 375×812 the stage stays visible while the panel scrolls.

#### UX-13 🟡 M: Accessibility semantics

- There is no `<h1>`. Make `.brand` an `<h1>` (text stays `Catalog 3D`) or add a visually hidden one.
- The canvas has no `tabindex`, role or label, and placement is pointer-only. Add `tabindex="0"`, an `aria-label`, `aria-describedby` pointing at the stage hint, plus the keyboard paths from UX-09 and **Add to room** (UX-08). Check the copy handoff's **?** dialog doesn't trap focus away from it.
- Live regions: one polite announcer (the toast). Don't leave two `role="status"` elements announcing the same message.
- The `role="radio"` segmented groups: **I did not test arrow-key behaviour.** Verify it; if missing, add roving `tabindex` + arrow keys.
- `aria-current="step"` on the stepper; move focus to the next step's heading after Create room.
- Honour `prefers-reduced-motion` for any new toast or scroll animation.
- Muted text passes AA today (6.19:1). Keep new toast/chip colours ≥4.5:1. Removing the 0.72 dimming (UX-07) fixes the ≈3.4:1 case.

---

## 5. Open decisions: implement the default, flag it, don't pretend it's settled

| ID | Question | Default for this pass | Source |
|---|---|---|---|
| D1 | Which UI is canonical: the prototype's three-column shell or the viewer's? | Keep the viewer as the product. Borrow the prototype's layout ideas in UX-07/08. **Don't merge the codebases.** | stress test §7 Q9 |
| D2 | Imported candidates start **Accepted** (today) or **Unreviewed**? | Unchanged; relabel only (copy handoff) | stress test E4/R2, Q3 |
| D3 | Per-placement materials, and how they reach a BOM | Persist existing `slot_bindings` only (UX-10); no BOM schema | `ASSUMPTIONS.md` U9/U13; stress test A8 |
| D4 | Clear/Replace room: **confirm** (deck §5) vs **undoable** | **Confirm**, so behaviour matches the already-written deck copy. Undoable is the better long-term UX but forces a copy change and a persistent Undo | UX-03 |
| D5 | `.mjs` pack/module UI in the end-user panel | Keep, inside the Advanced disclosure, with the trust confirm rewritten per deck §5 (copy handoff Phase 4 item 4) | `ASSUMPTIONS.md` U11 |

**Already decided by the copy handoff; don't reopen:** a single **?** (no per-card icons); honesty labels stay visible; stable button labels with `aria-pressed`; *Parts list*, *product*, *sample* vocabulary; the Workspace toggle labels (`docs/catalog-room-toggle-ux.md`); brand names unchanged; all ids unchanged.

---

## 6. Verification

### Commands

```bash
cd "/Users/adrian/Desktop/Room Vibez/hackathon-3d-viewer"
npm run typecheck && npm test && npm run build
npx playwright test tests/e2e/viewer.spec.ts      # the only spec safe to run in place
# for the others: scratch copies with MEDIA/ARTIFACTS redirected (see §1)
```

Unit tests must not need edits. If one fails, a pinned string or behaviour changed; fix the host, not the test.

### Measurement snippet

Paste in the console (fresh load, `localStorage` cleared, at 1440×900 then 375×812). Compare with §2.

```js
(() => {
  const panel = document.querySelector('.panel');
  const pr = panel.getBoundingClientRect();
  const inPanel = el => el ? Math.round(el.getBoundingClientRect().top - pr.top + panel.scrollTop) : null;
  const controls = [...document.querySelectorAll('button,select,input:not([type=file]):not([type=checkbox]),summary')]
    .filter(e => e.offsetParent !== null);
  return {
    viewport: [innerWidth, innerHeight],
    mode: document.body.dataset.workspace,
    panelClientH: panel.clientHeight,
    panelScrollH: panel.scrollHeight,
    slotsTopInPanel: inPanel(document.getElementById('slots')),
    visibleFileInputs: [...document.querySelectorAll('input[type=file]')]
      .filter(e => e.offsetParent !== null && getComputedStyle(e).display !== 'none').length,
    controlsUnder32px: controls.filter(e => e.getBoundingClientRect().height < 32).length,
    overflowX: document.documentElement.scrollWidth - innerWidth,
  };
})()
```

### Manual golden path (real browser, both sizes)

1. Fresh load, `localStorage` cleared → Product workspace, chair visible, Materials visible without panel scroll.
2. Click a walnut swatch → the chair updates.
3. Room workspace → empty-state card, no chair on stage, hint "Create or import a room to start."
4. Pick Living 5×4, edit Length to 6 → Create room → 6 m long, whole floor visible with no camera input.
5. **Add to room** → a chair appears. Enter **Place product**, click a wall → a toast appears on the canvas. Click the floor → a second chair.
6. Click chair 2 → row 2 highlighted, outline shown. `R`, arrows, Delete, Ctrl+Z each behave.
7. Clear room → confirm dialog with counts → "Keep room" changes nothing; confirm empties the room and you stay in Room workspace.
8. Import plan → sample plan → the banner still shows `mock_fixture` and `ODA available: no`.
9. Back to Product → chair visible, panel scrolled to the top.
10. 375×812: no horizontal scroll; the stage stays visible while the panel scrolls.

Also run the copy handoff's §8 vocabulary grep after both are applied.

### What I did not verify (don't assume it works)

Draw-walls mode in practice; undo/redo in practice; real DWG/DXF files; the `.mjs` and pack flows; screen readers; arrow keys on the radio groups; Safari/Firefox; real-GPU WebGL (I used the Claude desktop in-app browser). My browser tool's synthetic clicks on the canvas were unreliable, so I confirmed placement with dispatched pointer events. UX-10 is code-read only.

---

## 7. Evidence

- `docs/flow-stress-test-report.md`: behavioural and error audit (66/66 unit tests, 52 scripted observations); scripts in `docs/stress-test/`, outputs in `docs/stress-test/out/`.
- `fixes/ux-copy-improvements.md` and `docs/ux-copy-deck.md`: the sibling handoff and final copy.
- `hackathon-3d-viewer/ASSUMPTIONS.md`, `ARCHITECTURE.md`, `README.md`: constraints and the "not claimed" list.
- `docs/model-display-deep-qa-fix.md`, `docs/model-display-fix.md`, `docs/catalog-room-toggle-ux.md`: earlier workspace-toggle fixes. **Read these before UX-06/07**; the Product ↔ Room switch has regressed before.

---

## 8. Deliver

1. The code changes for the items you took.
2. **One** completion doc, `docs/ux-fix.md`, following `docs/model-display-fix.md`. If you also applied the copy handoff, cover both there and name which items/phases you took, which §5 and copy-handoff defaults you took, and which you skipped and why. Include test results (counts, which specs you ran and how), before/after §2 measurements, links to screenshots in `media/ux-fix/`, and open items. List every string you wrote that isn't in the deck.
3. `History/`: append only, in its existing format, and tell Adrian.
