# v2 wave 1: what was built, and how the host wires it

**For:** the Claude agents that continue the host track in `v2/hackathon-3d-viewer/` (waves 2 to 8 in `fixes/implementation-plan.md`).
**Written:** 2026-10-05 by the orchestrating session, from the seven wave-1 agents' final reports. Signatures are copied from those reports; if a signature here and the code disagree, the code wins.
**State of `v2/` when this was written:** host trust fixes applied; `src/copy.ts`, `src/errors.ts`, the data-engine files, the picker and the dialog components merged byte-identical from the agents' workspaces. The 3D engine slice (§6) is merged last; check §6's status line.

Everything below is **built and verified by the agent that built it, but not yet wired into the page** unless it says "in effect".

---

## 1. Host trust fixes (H1) — in effect

Done and verified with real pointer input: UX-01, UX-02 + QA-08, QA-01, QA-06, QA-07, QA-18. `index.html` was not changed.

**`src/main.ts` — new**
- `LENGTH_FIELDS`: the seven length inputs with `minM` / `stepM` read from the HTML at load. **The HTML must keep those `min`/`step` attributes in metres.**
- `fieldUnit`; `fieldMeters(input, unit): number` and `setFieldMeters(input, meters, unit)`: the one read and write path for length fields. `syncLengthFieldLimits(unit)`, `convertLengthFields(from, to)`, `trimNoise(v)`.
- `exitRoomTool(): boolean`: clears `drawSession`, sets mode `room`, calls `setToolButtons(null)`.
- `isTypingTarget(target): boolean`: the shared key guard for Cmd/Ctrl+Z and Esc.

**`src/main.ts` — changed**
- `setWorkspace`: frames the room only when the workspace actually changes (Product → Room).
- `onCreateRoom`: size always comes from the fields; the preset only supplies the name.
- `renderRoomUi`: disables Save-as-template and Clear room when there is no room.
- Ingress and tool handlers switch workspace only when not already in Room; tool handlers read the mode first, so a second click turns the tool off. `keydown` handles Esc.

**`src/styles.css`:** `[hidden] { display: none !important; }`, `.btn:disabled { opacity: 0.5; cursor: default; box-shadow: none; }`, hover rules exclude disabled buttons.

**`tests/e2e/trust-fixes.spec.ts`:** 5 tests. It types into `#room-length` while a preset is selected (UX-01's done-when) and pins the exact `min`/`step` strings of the seven fields. **UX-08 item 4 hides those fields behind "Adjust size" unless the preset is Custom: update this spec when that lands** (open the disclosure first).

**Deviations and findings**
- The key guard is narrower than "any input": checkboxes, radios, buttons, file, range and colour inputs do not count as typing targets (otherwise Esc and Cmd+Z did nothing while the snap checkbox had focus). It also ignores keys from inside any `<dialog>`.
- Feet limits are the agent's default: `min` is the metric minimum in feet, `step` is `any`.
- Side effects: re-clicking "Room workspace" while already there no longer re-frames; an ingress tab clicked inside Room no longer switches the active tool off; a unit switch keeps hand-typed opening sizes.
- **The camera keeps drifting after a drag under SwiftShader** (damping): 37.8° at release, 67.6° four seconds later. Any "camera changed by less than 1°" check must let the camera settle first (the spec runs `controls.update()` 400 times). The QA handoff's "51.8°" reading was mid-drift.
- With 5 Playwright workers on a loaded machine, e2e tests time out. Use `--workers=1`.

## 2. Strings: `src/copy.ts` (B1) — merged, not yet used by the page

```ts
export const copy = { … } as const;
export function fmt<S extends string>(template: S, vars: FmtVars<S>): string;   // type-checks placeholder names
export function plural(n: number, forms: { one: string; other: string }): string; // also plural(n, one, other); replaces {n}
export function rich<S extends string>(template: S, vars?: FmtVars<S>): RichSegment[]; // { text, strong }[]
export function plain(text: string): string;                                       // strips ** markers
```

| Group | Deck section | Group | Deck section |
|---|---|---|---|
| `common` | shared (`why`, `technicalDetails`, `delete`) | `modelMessages` | §4.A |
| `helperLines` | §3.1 | `textureMessages` | §4.B |
| `topBarAndStage` | §3.2 | `packMessages` | §4.C |
| `stageHints` | §3.3 | `slotWarnings` | §4.D |
| `productCard` | §3.4 | `planMessages` | §4.E |
| `roomStart` | §3.5 | `roomMessages` | §4.F |
| `roomTools` | §3.6 | `confirm` | §5 (`clearRoom`, `replaceRoom`, `deleteTemplate`, `loadMjs`) |
| `notInDeck` | 50 strings, each commented with the handoff item that asked for it | | |

- Option maps are keyed by option value or `data-*` value: `roomStart.units`, `.presets`, `.ingress`, `productCard.textureRoles`, `.textureCategories`, `.lightPresets`.
- Plurals are `{ one, other }` objects.
- **Ten keys carry `**bold**` and must go through `rich()` or `plain()`, never straight into `textContent`:** `topBarAndStage.overlayNoWebgl`, `.overlayCouldntStart`, `roomStart.sampleBanner`, `roomMessages.sizeInvalidField`, `.importFailed`, `.savingBlocked`, `.savedRoomUnreadable`, `confirm.clearRoom.body`, `confirm.replaceRoom.body`, `notInDeck.sampleBannerBuiltIn`.
- `notInDeck` already holds: `advanced`, `steps.room/.openings/.place/.finish`, `stepChange`, `adjustSize`, `more`, `addToRoom`, `placedProducts.*` (row format `{name} {n}`, rotate, duplicate, selected hint, moved-overlap), `picker.*`, `appliesToNextProduct`, `uploadNotRestored`, `emptyRoom.*` (title, body, three starts, `importProject`), `outsideRoom`, `canvasLabel`, `genericError`, `overlayModelFailed`, `placeFailedOther`, `openingSizeInvalid`, `unitAbbrev.*`, list-row formats. 22 have words given by a handoff; **28 were written by the agent in the deck's voice and nobody has reviewed them.**
- **Add new non-deck strings to `notInDeck`** with a comment naming the handoff item, and list them in your report. Still missing there: the toast's `Dismiss` label, and the picker's `allGroups` and `groupTabsLabel` (§5).

## 3. Messages: `src/errors.ts` (B1) — merged, not yet used by the page

```ts
export function friendlyError(err: unknown, ctx: ErrorWhere | ErrorContext): FriendlyMessage;
// ErrorWhere = 'boot' | 'product-load' | 'model-upload' | 'texture-add' | 'pack-load' | 'module-load' | 'plan-import'
//   | 'plan-image' | 'plan-scale' | 'plan-confirm' | 'template-use' | 'template-save' | 'room-create' | 'opening-add'
//   | 'draw-walls' | 'place' | 'plan-png' | 'project-import'
// ErrorContext = { where; name?; fileName?; attempt?; field?; log? }
// FriendlyMessage = { text; segments; critical; neutral; id; matched }
export function createUploadEscalation(): { map(err, ctx?): FriendlyMessage; reset(): void };  // deck §4.A 1st/2nd/3rd wording
export function slotWarnings(report, product, opts?): { id; text; critical }[];                 // deck §4.D
export function packSummary(status): { mode; text; critical; details: string[] };              // deck §4.C; details = raw notes for the collapsed Details
export function packStatusMessage(input: { name; glbName?; status }): { id; text; critical };
export function friendlyObjNote(note: string): string | null;
export function placedMessage(name, report, productName?): { id; text; overlap };
export function movedOverlapMessage(name, report, productName?): string | null;
export function overlapList(report, productName?): string | null;
export function mjsConfirmContent(scan, fileName): { title; body; bodyParts; confirmLabel; cancelLabel };
export function splitGuardMessage(message: string): { title; body };
export function rawMessage(err: unknown): string;
```

- `text` is plain and safe for `textContent`; `segments` keeps the bold runs.
- `friendlyError` already calls `console.error`; remove the host's own `console.error(err)` beside each call.
- The plan wrong-type sentence needs `ctx.fileName`; the place sentences need `ctx.name`.
- A cancelled `.mjs` load returns `neutral: true`: no error styling.
- `critical` is set per rule, never read from the wording. The handoffs do not say which errors are task-blocking; the agent's rule: `true` when a file was unusable, the app could not do the job, or the error was unrecognised; `false` when the app is waiting for a different choice.
- **To reconcile in the copy pass (wave 6):** the plan-file rejection is matched by two heuristic rules written before the engine message existed. The real message is now `Unsupported plan file type: "<filename>" (expected .dwg, .dxf or .json)` (a `PlanFileError` with `.reason`). Prefer `err instanceof PlanFileError` and `RoomSizeError` over text matching. `mjsConfirmContent` (from `copy`) and the engine's `parseMjsGuardMessage` both produce the deck §5 wording: pick one for the host.
- Engine messages with no deck wording fall to `notInDeck.genericError`. One more is newly reachable: `RoomHistory: failed to clone graph`.

## 4. Data engine (A2) — merged; partly in effect

**Already in effect with no host change:** damaged saved rooms no longer crash boot (but nothing is said and the bad key stays); `.ifc` and `.exe` plans are refused with the raw engine message; the native `.mjs` confirm shows the deck wording.

**Needs host wiring:**

| What | Call |
|---|---|
| **Saving blocked** (Copy P4 item 1) | In `applyRoomGraph()`: `const saved = persistRoomGraph(roomGraph);` (now returns `boolean`). Show deck §4.F *Saving blocked* when `!saved && roomGraph`; hide it when a later call returns `true`. Only then pass `storageFailureIsSurfaced: true` to `initHelp`. |
| **Clear room comes back after reload** (confirmed defect, QA §7) | In `applyRoomGraph()` right after the persist line: `if (!roomGraph) void clearProjectFromIdb();` (`projectIO.ts`; never rejects). |
| **Unreadable saved room** (Copy P4 item 2) | In `boot()`, replace `roomGraph = loadPersistedRoomGraph();` with `const saved = loadPersistedRoomGraphOrQuarantine(); roomGraph = saved.graph;`. If `saved.status === 'unreadable'`: show deck §4.F *Saved room unreadable*, offer `saved.quarantined.raw` as a download, and **skip the `loadProjectFromIdb()` fallback** (otherwise the last exported room loads and "started with an empty one" is false). |
| **Which size field** (Copy P4 item 5) | In the `onCreateRoom` catch: `if (err instanceof RoomSizeError)` → `err.fields[0]` is `'length' \| 'width' \| 'ceilingHeight' \| 'wallThickness'`. |
| **Plan check before the sample path** (Copy P4 item 6) | In the `#btn-import-plan` handler, first: `const check = await checkPlanFile(file);`. `!check.ok` → message for `check.reason` (`'unsupported_type' \| 'pdf_unsupported' \| 'not_dwg' \| 'not_dxf'`), start nothing. `check.kind === 'raster'` → `onStartUnderlay`; otherwise `onStartImport`. Also handle `err instanceof PlanFileError` in the `onStartImport` catch. |
| **`.mjs` dialog** (Copy P4 item 4) | At both `importModuleFile(...)` calls pass `{ confirmFn: (m) => { const { title, paragraphs } = parseMjsGuardMessage(m); return confirmDialog({ title, body: paragraphs.join('\n\n'), confirmLabel, cancelLabel }); } }`. Labels from `copy.confirm.loadMjs`. Only an explicit `true` loads. |

**Exports to add to `src/viewer/index.ts`** (the host imports from `./viewer`):
```ts
export {
  QUARANTINE_STORAGE_KEY, ROOM_SIZE_ERROR_MESSAGE, RoomSizeError, discardQuarantinedRoomGraph,
  invalidRoomSizeFields, loadPersistedRoomGraphOrQuarantine, quarantinePersistedRoomGraph,
  readQuarantinedRoomGraph, roomGraphProblem,
  type PersistedRoomLoad, type QuarantineOutcome, type QuarantineReason, type QuarantinedRoomGraph,
  type RoomSizeField, type StorageLike,
} from './roomGraph';
export {
  IMPORT_NOT_A_ROOM_MESSAGE, PLAN_SNIFF_BYTES, PlanFileError, checkPlanFile, looksLikeDwg, looksLikeDxf,
  type PlanFileCheck, type PlanFileKind, type PlanFileRejection,
} from './dwgImport';
export { clearProjectFromIdb } from './projectIO';
export { MJS_NATIVE_CONFIRM_HINT, mjsGuardPrompt, parseMjsGuardMessage } from './mjsGuardrails';
```

**Caveats and findings**
- The DWG check is only "first six bytes match `AC10` plus two digits"; the DXF check accepts the binary-DXF sentinel or text starting `0`/`SECTION`. **Neither was verified with a real DWG or DXF file** (the project has none).
- The deck has no string for a `.dxf` that fails the check (`not_dxf`).
- **Templates are lost by the same IndexedDB fallback** (measured): save T1 → Export → save T2 → Clear → reload leaves only T1. The clear-on-Clear call fixes that path; boot's `persistTemplates(project.templates)` stays a hazard whenever the fallback fires.
- A candidates JSON whose room has no `ceiling_height` crashes `renderImportReview` (`Cannot read properties of undefined (reading 'toFixed')`). Pre-existing; not in any handoff; not fixed.
- `persistTemplates` (`roomTemplates.ts`) swallows storage failures the same way `persistRoomGraph` did. Not fixed.
- `onCreateRoom` replaces a blank or 0 ceiling height and wall thickness with defaults, so through the host the engine can name those two fields only for negative values.

## 5. Picker: `src/ui/thumbnailPicker.ts` (C) — merged, not mounted

```ts
export function createThumbnailPicker(opts: {
  select: HTMLSelectElement; label: string; getItems: () => PickerItem[]; viewKey: 'product' | 'material' | string;
  strings: PickerStrings;            // searchPlaceholder, noMatches, close, viewGroupLabel, viewThumbnails, viewList, groupTabsLabel, allGroups
  searchMinItems?: number;           // default 16 (DT4; unvalidated)
  requestThumb?: (id: string) => void | Promise<string | null | undefined>;
  formatGroup?: (group: string) => string; alignTo?: HTMLElement;
}): { el: HTMLElement; sync(): void; setThumb(id: string, url: string | null): void; open(): void; close(): void; destroy(): void };
export function buildProductItems(products, opts: { uploadSublabel: string; thumbFor?: (id) => string | undefined }): PickerItem[];
export function buildMaterialItems(materials, opts?: { defaultLabel?: string }): PickerItem[];
```

**Mount on `#product-select`** (no `index.html` edit; the component wraps the select in place):
```ts
const productPicker = createThumbnailPicker({
  select: productSelect, label: copy.notInDeck.picker.productLabel, viewKey: 'product', strings: /* from copy */,
  getItems: () => buildProductItems(catalog.products, { uploadSublabel: /* deck "Your upload" */, thumbFor: (id) => cache.get(id) }),
  requestThumb: (id) => { const p = catalog.products.find((x) => x.id === id); return p ? thumbnails.render(p) : undefined; },
});
```
- Call `productPicker.sync()` at the end of `refreshProductSelect` and after any `productSelect.value = …`.
- **Re-parent `productPicker.el`, never the select alone.**
- `requestThumb(id)` is called only while the popup is open in the thumbnail view, for an item with no image, when its tile scrolls into view; at most once per item per open. The host queue must cache by id. Invalidate with `setThumb(id, null)`. If there is no thumbnail renderer, omit `requestThumb`: the picker then opens in List.

**Mount on a material select:** `getItems: () => buildMaterialItems(library.materials, { defaultLabel })` (no `defaultLabel` for `#texture-target`); `viewKey: 'material'`; call `sync()` in `populateMaterialSelects`, `syncMaterialSelectsFromGraph` and `refreshTextureTargetOptions`; pass `alignTo: document.querySelector('.panel')` for the handoff's panel-edge alignment.

**Facts**
- The hidden select is 1 px wide, as tall as the trigger, `opacity: 0` (a 1×1 select was flagged by the small-target gates G24/G25). Playwright still sees it as visible; `selectOption` works by value and by index.
- The popup uses native `popover="auto"` and lives in `<body>`, not inside `el` (three of the four selects sit inside a `<label>`). It is not clipped by the panel.
- Test hooks: `.tpicker[data-picker-for="<select id>"] .tpicker-trigger`; `.tpicker-popup[data-picker-for="<select id>"]` with `data-view="grid|list"`; `[role=option][data-id="<value>"]`; `[data-view-option="grid|list"]`; `.tpicker-group[data-group="…"]`; `.tpicker-search`; `.tpicker-close`.
- Trigger and popup borders use `--border-strong` (1.61:1), below 3:1 until QA-13 changes the token.
- **Two strings the handoff did not list are required:** `allGroups` and `groupTabsLabel`. Each material picker also needs its own search placeholder and no-match text (`notInDeck.picker.searchMaterials`, `.noMaterialsMatch` exist).
- Not verified: anything in the real app (the eight existing `selectOption` calls, `#btn-remount`, re-parenting between workspaces, real thumbnails), screen readers, Safari, Firefox.

## 6. Dialogs: `src/help.ts`, `src/ui/confirmDialog.ts`, `src/ui/notify.ts` (B2) — merged, not wired

```ts
// help.ts
function initHelp(options?: { storageFailureIsSurfaced?: boolean; startHereOnFirstVisit?: boolean; unseenDot?: boolean; button?: HTMLButtonElement | null }): void;
function createHelpButton(): HTMLButtonElement;   // id "btn-help", already wired
function openHelp(target?: { tab?: 'start'|'product'|'room'|'files'|'built'; anchor?: 'import-plan'|'plans'; returnFocusTo?: HTMLElement | null }): void;
// ui/confirmDialog.ts
function confirmDialog(options: { title: string; body: string | Node; confirmLabel: string; cancelLabel: string; destructive?: boolean }): Promise<boolean>;
// ui/notify.ts
function mountNotifier(stage: HTMLElement, options?: { avoid?: HTMLElement[]; dismissLabel?: string }): Notifier;
function notify(message: string, options?: { kind?: 'info'|'success'|'warning'|'error'; action?: { label: string; onSelect: () => void }; timeoutMs?: number }): void;
function dismissNotification(): void;
```

**Wiring, in `boot()`**
1. `initHelp({ storageFailureIsSurfaced: false })`, then `document.querySelector('.topbar')!.append(createHelpButton())`. Nothing goes in `index.html`.
2. Each **Why?** link: `link.addEventListener('click', () => openHelp({ anchor: 'plans', returnFocusTo: link }))`. The Parts list note has no anchor: `openHelp({ tab: 'product' })`.
3. `mountNotifier(document.querySelector<HTMLElement>('.stage')!)` once; then `notify(text, { kind })`. It creates `#stage-toast`.

**Facts**
- A string `body` in `confirmDialog` is never parsed as HTML; a line break starts a paragraph and `**words**` render bold, so deck §5 bodies can be passed as they are in `copy`.
- E2E selectors: `dialog.confirm-dialog [data-action="confirm"]` and `[data-action="cancel"]`. Initial focus is on Cancel (the agent's choice; the handoffs do not say).
- While a help or confirm dialog is open, key presses do not reach `document` keydown listeners.
- The toast's live region is the inner `.stage-toast-text`. **Do not also write the same message to `#room-status` while that is `role="status"`** (UX-13: one announcer). Errors use `role="alert"`, an icon, a left edge and heavier weight (QA-17).
- `#stage-toast` has no box when idle (it does not use `hidden`). Defaults: 6 s for info and success, 12 s for warning and error, `0` stays.
- `help.css` sets `.topbar .workspace-nav { margin-left: auto }` so the **?** sits at the right end; the top bar grows from 149 to 157 px at 375 px.
- The **?** is 28 px as Copy Phase 2 says (44 px on coarse pointers). That fails UX-12's "0 controls under 32 px" gate; `--help-btn-size` changes it. **The two handoffs conflict here; decide in wave 7 and report it.**
- First-ever open of help shows *Start here* (deck); later opens follow the workspace (Phase 2). `startHereOnFirstVisit: false` gives the literal Phase 2 rule.

## 7. 3D engine (A1) — in effect for the camera, cutaway, bounds and camera-on-pick; the rest needs host wiring

**In effect with no host change (verified by the agent on its own copy, SwiftShader):**

| | Before | After |
|---|---|---|
| In-room floor share of the canvas on arrival, 1440×900 / 375×812 | 0 % / 0 % | 16.1 % / 15.2 % |
| Floor area on screen and unobstructed | 0 % | 100 % at both sizes |
| Raycast through the projected room centre | `wall` | `floor` |
| Place-mode clicks that land outside the room (441-point grid) | 26.3 % | 0 % |
| Camera after picking a product in Room | jumps to a close-up | unchanged |
| Floor:wall contrast, Studio soft / Warm interior / Neutral | 1.01 / 1.01 / 1.27 | 1.76 / 2.53 / 3.43 |

- **Cutaway:** each wall is hidden while the camera is on its outer side (two on arrival) and leaves a flat footprint strip. `raycastRoom` skips hidden meshes. **The near walls cannot be clicked on arrival; to add an opening there the user orbits first.**
- **Camera:** `frameRoom` uses 45° and fits the room to the canvas. It used to ask for 13.7 m and be cut to 8 m by `OrbitControls.maxDistance`, which is why corners were off screen.
- **Floor:** default colour `#b9b0a2` → `#766b5e` (the agent's choice; no contrast target exists in the project).
- **`kind: 'floor'` now always means inside `rooms[0].floor_polygon`** (a hit on the slab strip under the walls is not a floor hit), except in `draw-wall` mode, which behaves as before.
- **Fixed, not in any handoff:** `raycastRoom` picked against stale world matrices right after a graph change (a same-tick pick returned `wall` in the middle of the room).

**New API**
```ts
// types (backward compatible)
interface RoomPointerHit { kind: 'wall' | 'floor' | 'placement'; wallId?: string; placementId?: string; offsetAlongWall?: number; point: { x: number; y: number; z: number } }
interface ViewerOptions { /* existing */ hideProductInEmptyRoom?: boolean }
interface Product { /* existing */ thumbnailUrl?: string }
// RoomVibezViewer
setWallCutaway(enabled: boolean): void          // default on
getWallCutaway(): boolean
getPlacementRoot(placementId: string): Object3D | null
setPlacementPose(placementId: string, position: { x: number; z: number }, rotationY?: number): boolean
setPlacementHighlight(placementId: string | null): boolean
getPlacementHighlight(): string | null
applySlotBindings(root: Object3D, product: Product, bindings?: Record<string, string> | null): Promise<Record<string, string>>
// functions (exported from ./viewer)
pointInFloorPolygon(point: Vec2, polygon: readonly Vec2[], eps = 1e-6): boolean
pointInRoom(graph: RoomGraph, point: Vec2, margin = 0): boolean
resolveBindings(product, requested?, library?): { bindings: Record<string, string>; rejected: { slotId; materialId; reason }[] }
loadProductRoot(product: Product): Promise<Object3D>
createThumbnailRenderer(opts: { loadRoot: (p: Product) => Promise<Object3D>; applyFinish?: (root: Object3D, p: Product) => Promise<unknown> | unknown; size?: number; pixelRatio?: number }):
  { render(p: Product): Promise<string>; peek(p: Product): string | undefined; invalidate(productId?: string): void; dispose(): void; stats(): ThumbnailStats }
```

**Host wiring**
- **QA-02:** `onRoomPointer` already receives `null` for a void click in place mode; show `copy.notInDeck.outsideRoom` there. For "Add to room", test candidate spots with `pointInRoom(roomGraph, { x, z }, margin)`.
- **UX-06:** pass `hideProductInEmptyRoom: true` in `mountViewer`, and in `setWorkspace('room')` call `viewer.setInteractionMode('room')` also when there is no room. With the flag, `setRoomGraph(null)` from a room mode stays in `room`.
- **UX-09:** add a `mode === 'room'` branch in `onRoomPointer`: `hit?.kind === 'placement'` selects `hit.placementId`, anything else deselects. `setPlacementHighlight(id | null)` once per selection change (it survives `reloadAllPlacements`). Nudge or rotate: `setPlacementPose(id, { x, z }, rotY)`, then commit with `updatePlacement` and `applyRoomGraph(next, { frame: false, reloadPlacements: false })`. Never use `attachPlacement` to move. **Drag-to-move was not built.**
- **UX-16, one rule:** `await viewer.applySlotBindings(root, product, bindings)` before `viewer.attachPlacement(...)`. In `placeCurrentProduct` build bindings from `viewer.getSlots()`; in `reloadAllPlacements` pass `pl.slot_bindings`; for 16b call it again on `getPlacementRoot(id)`.
- **UX-14:** one `createThumbnailRenderer({ loadRoot: loadPlacementRoot, applyFinish: (root, p) => viewer!.applySlotBindings(root, p) })`; `render(product)` from the picker's `requestThumb`; `dispose()` with the viewer lifecycle.

**Thumbnail spike: passed** on SwiftShader. A second WebGL context runs beside the viewer's (0 context-lost events; live contexts exactly 2, back to 1 after `dispose()`). 192 px: first render 2.5 s, later 0.57 to 0.80 s; 30 queued took 19.4 s. Real GPU not measured; `.mjs` module products not exercised.

**Host bug found (fix in wave 2 or 3):** `shellMaterialsFromGraph` in `main.ts` passes `library.materials[0]` as the floor when only a wall material is chosen, which turns the floor `#ffffff` and undoes the contrast fix. The engine now accepts `{ wall }` alone; the host should pass only the surface the user chose.

**Not verified:** real GPU; concave rooms in a browser; graphs with more than one room; whether placed products cast visible shadows on the room floor (none seen under Studio soft; not investigated). The agent's e2e specs passed on its own copy with the unedited host, not yet on v2 with the edited host.

## 8. Prototype (D) — in effect in `v2/prototypes/room-vibez-planner-flows/`

Copy Phase 5 applied in full; 120 scripted checks pass; all three state bugs reproduced on the original and fixed. Also fixed: badge contrast (4.39 → 5.36:1) and the phone-width overflow. Not addressed: the uneven type scale; the three third-party hosts (the prototype needs them).

## 9. For the completion doc: decisions and deck problems raised in wave 1

**Decisions for Adrian (taken provisionally, each reversible)**
1. Prototype: the disabled "Live stock" (ERP) control was **removed** as Copy Phase 5 says; the deck relabels it instead.
2. Prototype: deleting the duplicate manual-draw button, as the deck says, leaves *Draw it myself* reachable only after a file type is chosen.
3. Prototype: three small fixes beyond Phase 5 that the new copy depends on (one toast for all screens; the file-type chip no longer opens the file picker; the 3D caption moved inside the window).
4. Viewer: the key guard is narrower than the handoff's "any input" (§1).
5. Viewer: the **?** button size, 28 px (Copy) against 32 px minimum (UX-12) (§6).
6. Viewer: confirm dialogs focus Cancel first (§6).

**Deck problems found (the deck's words were kept; nothing was resolved silently)**
1. Copy §8's vocabulary check cannot pass as written: the deck's own "Not a pack" sentence names `createAsset`, and `\bstub\b` matches the `STUB-SKU-…` text the deck keeps visible.
2. Sample banner: "Your file was kept but not read" is false after *Try the sample plan* (there is no file), and a JSON plan is not a sample.
3. §4.E "Scale: none … Enter a length you know": with no scale hint the engine can never set a scale (`dwgImport.ts`).
4. §4.F "Place failed … Load its pack again" is wrong for a product that is not a pack.
5. §3.5 says "Living room · 5 × 4 m"; §3.6's example says "Living · …".
6. §3.5 and §4.E give two wordings for "no scale".
7. §3.4 keeps the `#model-files` aria-label that QA-14 says fails WCAG 2.5.3.
8. §3.2 overlay error: one sentence in the deck, but Copy Phase 1 step 8 asks to split boot from model.
9. Help tab 4, "**Allow .mjs files** turns this off": ambiguous.
10. Help tab 5, "loading is opt-in": the checkbox is ticked by default.
11. Help tab 3, "To move something, delete it from the list and place it again": **false once UX-09 lands.**
12. Help tab 4 names Meshopt; `README.md` only says Draco may fail.
13. Prototype §6.3: "The chips at the top show where you are", but the editor screen has no chips.
14. (wave 2) §4.F "…delete it from the list below" is now shown as a toast on the stage, while the list is in the side panel.
15. (wave 2) §4.F "Your current room is unchanged." is also shown when no room exists.

---

## 10. Host wave 2 (H2), added 2026-10-05 — in effect

Done and verified with real pointer input at 1440×900 and 375×812: UX-03 (confirm before Clear, Replace, Delete template; stay in Room after Clear), the "Clear room comes back after reload" fix, UX-04 (toast on the stage, fixed tool-button labels, `#stage-hint` as the state line), UX-06 host part (empty Room state), QA-04 (open a project with no room, from the empty-state card), QA-02 host part, and the white-floor bug. After it: `tsc` 0 · unit 315/315 · e2e 32/32 (`--workers=1`, 4.0 min).

**`index.html`:** new `#stage-empty`, `#stage-empty-title`, `#stage-empty-body`, four `button[data-empty-action=scratch|import|template|project]`. `#btn-clear-room` moved into `#room-plan-actions` (the row under the 2D plan) with class `btn btn-danger`, so it is hidden as well as disabled with no room. The three tool buttons have fixed labels and `aria-pressed="false"`.

**`src/main.ts` — new**
- `syncStageState()`: sets the hint text, `data-tool` on `#stage-hint`, and the card's visibility from live state. **Call it after any change of workspace, room, tool, opening type or product.**
- `initStageUi()`: mounts the notifier, sets the tool labels from `copy`, fills and wires the card.
- `notifyProblem(msg)`: maps a `FriendlyMessage` to a toast kind.
- `roomHasContent()`, `confirmReplaceRoom(): Promise<boolean>`, `onClearRoom()`.

**`src/main.ts` — changed**
- `onCreateRoom`, `onImportStartEditing`, `onUnderlayConfirm`, `onImportProjectFile` are **async**: the graph is built or validated first, then `confirmReplaceRoom`. `renderTemplateList` confirms on Use and on Delete.
- `setToolButtons` only sets `aria-pressed`, then calls `syncStageState`.
- `setWorkspace` always calls `setInteractionMode('room')` in Room; `mountViewer` passes `hideProductInEmptyRoom: true`.
- `onRoomPointer`, `placeCurrentProduct`: messages go through `notify` with deck strings; `pointInRoom` guards the requested point.
- `applyRoomGraph` calls `clearProjectFromIdb()` when the room is null. `shellMaterialsFromGraph` returns only the chosen surfaces.

**State line:** `#stage-hint` always shows the deck §3.3 string for the current state. With a tool on it carries `data-tool` and is styled as a chip; with no tool on, the attribute is removed and it is the quiet hint.

**Specs:** new `tests/e2e/feedback-and-guards.spec.ts` (6 tests). Edited: `dwg-plan-import.spec.ts` (confirms the Clear dialog), `missing-features.spec.ts` (confirms a Replace dialog), `room-placement-engine.spec.ts` (a void click moved from the bottom-left to the bottom-right corner, because the toast sits bottom-left and took the click).

**Open points for later waves**
- **The toast takes pointer events while it is open, so it blocks canvas clicks under the bottom-left of the stage.** At 375 px a three- or four-line warning covers the near corner of the floor for up to 12 s. Not yet fixed.
- At 375 px an error toast overlaps the bottom padding of the empty-state card.
- `#room-status` still has `role="status"`, so its summary is announced alongside the toast when a count changes. UX-04 item 1 asks for one live region; left for UX-13 (wave 7).
- `#project-file` still lives inside the hidden `#room-tools`; the card clicks it from there. **Keep one input when the toolbar is built.**
- `trust-fixes.spec.ts` expects `#btn-clear-room` to be disabled with no room.
- The tool labels are in `index.html` and also set from `copy` at boot; the copy pass should pick one source.
- `friendlyError` logs `console.error` for user mistakes (for example an opening that does not fit). A spec asserting "no console errors" would fail on those paths.
- Not verified: the bounds guard on a concave room; the `noModel`, "Place failed" and "walls too short" messages (nothing in the demo catalog triggers them).

---

## 13. Host wave 5 (H5: pickers), added 2026-10-06 — in effect

Done and verified in the real app: UX-14 (product picker with real thumbnails, thumbnail and list views) and UX-15 (wall, floor and texture-target pickers; names under the slot swatches). After it: `tsc` 0 · unit 336/336 · build OK · **e2e 60/60** (`--workers=1`). No existing spec needed a selector change.

**Two layout assertions were adjusted by the orchestrating session** because a name under every swatch (UX-15 step 6, confirmed by Adrian as DT2) makes them impossible:
- `panel-structure.spec.ts`: at 375×812 the **top** of the Materials slots is at 1.00 screens (asserted `< 1.5`, the UX §2 "scrolls to reach" metric). The **bottom** is at 1.59 screens (it was 1.37) and is no longer asserted. UX-07's "within about 1.5 screens" is therefore met for reaching Materials and missed by about 70 px for showing all of them.
- `placed-products.spec.ts`: a test precondition "the card changes height by more than 20 px" became "more than 2 px" (it is 6 px now). The assertion it guards (the clicked row stays under the pointer) is unchanged and passes.

**`main.ts`**
- `initPickers()` creates all four pickers in `boot()` right after the fetch. `sync()` call sites: `refreshProductSelect`; `populateMaterialSelects` and `syncMaterialSelectsFromGraph`; `refreshTextureTargetOptions`.
- `thumbnailRenderer()` creates the one renderer lazily; `requestProductThumb(id)`; `showSelectedProductThumb()`; `invalidateProductThumb`, `invalidateThumbsUsingMaterial`, `resetThumbnails()` (called by Restart 3D view).
- `renderSlots`: each swatch is `label.swatch-tile > button.swatch + span.swatch-name[aria-hidden]`. The button is unchanged.
- `ownsArrowKeys` now includes `[aria-haspopup]`. Test hooks: `__rv.pickers()`, `__rv.thumbnails()`.

**Thumbnails:** real renders in each product's default finish; cached by product id; `thumbnailUrl` wins. **Nothing is rendered until the pop-up is first opened in the thumbnail view** (rendering at load blocked the main thread for 2.35 s under software rendering), so before that the product trigger shows the name with no image. WebGL contexts: 1 at load, 2 after the first thumbnail-view open, still 2 after 22 renders. Under SwiftShader the first render takes 1.8 to 2.7 s and later ones 0.3 to 1.0 s; with 30 products the 12 tiles on screen are drawn in about 8 s. Real GPU not measured.

**Strings added to `notInDeck.picker`:** `allGroups: 'All'`, `groupTabsLabel: 'Category'`. The sublabel is the deck's `copy.productCard.yourUpload` ("your upload", lower case). `picker.triggerName` is unused.

**Left for the copy pass:** the field labels in `index.html` still read "Wall material", "Floor material", "Target material" while the pop-up titles use the deck's "Walls", "Floor", "Add to material".

**Open points**
- **Uploads and packs get very tall Materials cards.** Their slots allow all 13 materials, so each slot is five rows of labelled tiles: an uploaded model with 2 slots went from 341 to 809 px; a pack with 5 slots from 1228 to 2398 px. The picker handoff's DT2 says "revisit when the library outgrows a row"; for every upload it already has. Not changed. **For Adrian.**
- At 1280×800, on opening the Place products step, "Add to room" is 12 px below the fold (1440×900 is fine).
- A pack that came with a `.glb` keeps its default colourway in its thumbnail after a colourway change.
- Queued thumbnail renders keep running after the pop-up closes (the renderer has no cancel).
- Search appears at 16 items (unvalidated; neither list reaches it today).
- **For wave 8:** the audit scripts key tab stops, border contrast and hover on `#product-select`; the visible control is now `.tpicker[data-picker-for=product-select] .tpicker-trigger`.
- One component fix was made: `clip-path` removed from the hidden select (it made Playwright's `toBeInViewport()` report 0).

---

## 12. Host wave 4 (H4: placed products), added 2026-10-05 — in effect

(Placed before §11 by mistake of ordering only; read §11 first.)

Done and verified with real pointer clicks: UX-16 steps 2, 3 and 4 (16b), UX-09 host part, the not-restored-upload message, and the usability snippets. After it: `tsc` 0 · unit 336/336 (29 files) · build OK · **e2e 48/48** (`--workers=1`, 6.0 min). `src/viewer/**` was not changed. Drag-to-move was not built.

**What a user gets**
- A placed product wears the finish chosen in the Materials card (both by floor click and by Add to room); a default placement is oak, not grey; finishes survive reload, undo and redo. Packs and `preserveMaterials` products keep their own materials.
- `#materials-card` (one instance) sits in the Room "Place products" step under the picker, with the line "Applies to the next product you place."; with a placed product selected it shows **that product's** slots and the line "Applies to “{name}”."
- Rows are numbered per product ("Lounge chair (demo) 1/2"). Click a product on the canvas (mode `room`, no tool) or its row to select; the row gets `aria-current="true"` and the engine outline shows.
- A saved room whose product is no longer in the catalog (an upload after a refresh) shows `uploadNotRestored` once as a toast on arrival in Room, and its row carries the same sentence with only Delete.

**Keyboard** (Room workspace, focus not in a typing target, dialog or popover): arrows move the selected product 0.05 m (Shift 0.25 m); R / Shift+R rotate 90°; Delete or Backspace removes; Esc leaves the tool, or deselects when no tool is on. Each press is one Undo step. **Arrow keys are ignored while focus is on a radio group, list box, slider, tab list or menu.**

**`main.ts` and new files**
- New `src/placedProducts.ts` (pure helpers, unit-tested): `placementRows`, `nudgedPosition`, `isNudgeKey`, `quarterTurn`, `finishForPlacing`.
- New ids: `#materials-state` (inside `#materials-card`), `#materials-home-room` (step 3). Rows are `li.placement-row[data-placement-id]` with `button.placement-name[data-action=select]`, `button[data-action=delete]`, and on the selected row `.placement-actions` with `rotate-left` / `rotate-right`; a missing product is `li.placement-missing`. **`fixes/qa-evidence/walkthrough-tasks.mjs` and `audit-viewer.mjs` read the old `li > span` rows and need updating in their retargeted copies.**
- `selectPlacement(id, anchor?)` is the only selection setter. `materialsTarget()` decides what the card shows; `syncMaterialsCard()` redraws it. `renderSlots()` now also runs on every workspace switch.
- `setWorkspace` moves `#materials-card` to `#materials-home-room` in Room and back after `#catalog-card` in Product.
- `isTypingTarget` also treats `[popover]` as owned by the control (checked with a synthetic popover only; **verify with the real picker**).
- `reloadAllPlacements` applies saved bindings and stops when a newer run starts.

**Strings added to `notInDeck` (written by the agent, unreviewed):** `placedProducts.movedOutsideRoom` ("That would put “{name}” outside the room, so it stayed where it is."), `appliesToSelectedProduct` ("Applies to “{name}”.").

**Left for the copy pass:** the card heading still reads "Material slots"; `#placement-list` still has `aria-label="Placements"`; `placedProducts.duplicate` is unused (Duplicate was optional and not built); the help text "To move something, delete it from the list and place it again" (`src/help-content.ts`) is now false.

**Choices the handoffs do not specify (for Adrian)**
- **Nudge directions follow the room's axes, not the screen.** After orbiting to the far side the arrow keys run against what is on screen. Fixing it needs one read-only view-direction getter on the engine.
- A nudge that would leave the room is refused whole, with a warning toast and no Undo step.
- **There are no nudge buttons** (UX-09 gives keys only), so on a touch screen a product can be rotated and deleted but not moved.
- Row numbers are positions and shift after a delete.
- A new placement is not auto-selected.

**Open or unverified:** the not-restored message can only name the product by its placeholder SKU (the name is not saved, and D3 rules out a new field); a finish that used an uploaded texture falls back to the default after reload with only a console warning; nudging in a concave room, `.mjs`-only modules and OBJ uploads in the room were not exercised; every nudge rebuilds the room shell (not measured on large rooms).

---

## 11. Host wave 3 (H3: panel structure), added 2026-10-05 — in effect

Done and verified (headless Chrome, SwiftShader, overlay scrollbars): UX-07 (all five items), QA-03, UX-08 (all six items) with the stepper lines from UX-13, A1 as corrected by C15, A2, QA-09 (inactive tab stops), QA-15 (instant scroll), and the toast click-through fix. After it: `tsc` 0 · unit 315/315 · build OK · **e2e 41/41** (`--workers=1`, 4.2 min).

**Panel structure.** `.panel` holds two groups; `setWorkspace` gives the inactive one `hidden`. `data-workspace-panel` is now on the groups.
- `#panel-catalog`: `#catalog-card` (`#product-picker-home-catalog` > `#product-picker-slot` > `#product-select`, `#product-meta`) → `#materials-card` (`#slots`, `#slot-warnings`) → `#add-model-card` (`#model-files`) → `details#product-advanced` (Add texture, Load pack with `#pack-params`, Load module with `#mjs-enabled`) → `#parts-card`.
- `#panel-room`: `#room-toolbar` (sticky; `#btn-undo`, `#btn-redo`, `#btn-export-project`, `#btn-import-project`, `#project-file`) → `#room-card` (`#room-tools`, then `#room-plan`, `#room-plan-actions` with Download plan PNG and Clear room, the JSON details).
- `#room-tools` holds four `section.step[data-step]` (`room`, `openings`, `place`, `finish`), each `h3.step-title#step-<id>-title[tabindex=-1]` > `button.step-toggle` and `div.step-body#step-<id>-body`. Step `room` has `.step-summary` (`#room-status`, `#btn-step-room-change`), the size fields inside `details#room-size-adjust`, and `details#room-more` (`#template-title`, `#btn-save-template-scratch`). Step `place` has `#product-picker-home-room`, `#place-wall-snap`, new `#btn-add-to-room`, `#btn-place-mode`, `#placement-list`.
- `#presets` is in `.stage-toolbar` with `aria-label="Lighting"`.
- **Picker:** `setWorkspace` appends `#product-picker-slot` to `#product-picker-home-room` or `-catalog`. A picker mounted on the select wraps it in place and travels with the slot. `#materials-card` has an id so it can be moved as a unit; a comment marks its spot in step 3.

**`main.ts` — new:** `setRoomStep(step)`, `stepParts`, `scrollPanelToTop()`, `revealStage()`, `onRoomStarted()` (step 2, panel to top, reveal stage, focus the heading), `syncSizeFields()`, `placementPose`, `footprintAtPose`, `findSpotInRoom`, `onAddToRoom`, `addCurrentProductToRoom`, `initPanelUi()`. **Changed:** `renderRoomUi` (no longer hides `#room-tools`; hides Undo, Redo, Export without a room), `setWorkspace` (hides the inactive group, moves the picker slot, scrolls to top; both `scrollIntoView` calls are gone), `placeCurrentProduct(x, z, prepared?)`.

**Add to room** searches a 0.25 m grid over the floor polygon's bounds, nearest the centre first; each spot must pass `pointInRoom` and show no overlap. If nothing is free the product goes near the centre with the usual overlap warning. Verified in a rectangular and an L-shaped room.

**Measured, before → after (overlay scrollbars)**

| | Before | After |
|---|---|---|
| Product panel scroll height, 1440×900 | 2720 px | 1144 px (target "≲ 1000" **not met**; the long Add-3D-model hint waits for the copy pass) |
| Scroll needed to see the first swatch row | 137 px | 0 px |
| Visible native file inputs, Product / Room | 5 / 5 | 1 / 0 |
| 375×812, two seconds after load: `scrollY`, canvas visible | 1400, 0 % | 0, 100 % |
| 375×812 after Create room: canvas visible | 6 % | 100 % |
| Tab stops in the inactive workspace | 12 (Product), 6 (Room) | 0 |
| A2 script | 2 to 9 ids left rendered | `[]` in all four states |

**Specs:** new `tests/e2e/panel-structure.spec.ts` (9 tests). Eight existing specs edited, each to mirror a step the new layout needs (click Room workspace first; open a step; "Adjust size"; "More"; "Change"). In `feedback-and-guards.spec.ts` one assertion was reversed on purpose: Import project is now visible with no room (C15).

**Open points for later waves**
- **The stage toolbar wraps to two rows on narrow stages and covers the top 30 px of the chair at 375 px** (the presets moved into it). The engine's framing does not know about the toolbar. Not fixed.
- **On a narrow screen, "Add to room" and the tool buttons act on a stage that is off screen**, toast included. Needs the sticky stage from UX-12 (wave 7). The room toolbar is sticky at `top: 0`; with a sticky stage it needs a `top` offset (`--room-toolbar-height` is published on `<html>`).
- After Create room the stepper opens step 2 (Openings), as UX-08 says, so the first chair takes 4 clicks, not the 3 in UX §2.
- Closed `<details>` content kept a layout box in Chrome, so a rule now hides it (`.panel details:not([open]) > :not(summary) { display: none }`).
- `fixes/qa-evidence/*.mjs` click `#btn-place-mode` and similar directly; **the final verification must add "open the step" to its retargeted copies**, or those sections will fail for the wrong reason.
- Messages written to `#room-status` replace the step-1 summary until the next render. Pre-existing; copy pass.
- Remaining controls under 32 px are the existing `.segmented button`s (31.4 px) and the JSON summary (17.4 px): wave 7.
- Not verified: pack and module flows inside Advanced; classic-scrollbar figures; toolbar fit with non-macOS fonts.
- (later note) Wave 4 changed one thing here: opening a step now scrolls the whole step into view, because Add to room had fallen 131 px below the fold once the Materials card joined step 3.
- **Seen on the real GPU after wave 3** (orchestrating session, in-app browser, Chrome 152, Apple M1 Pro / Metal, 1024×768, panel with a 15 px classic scrollbar; a look, not a test): Product loads with Materials visible on arrival; the empty Room card shows; after Create room (Living) the whole floor is visible with the two near walls cut away; the Clear confirm works and leaves the user in Room. **With the classic scrollbar the room toolbar wraps: Undo, Redo and Export project on one row, Import project alone on a second (toolbar 46 px tall).** Wave 7 should make the four fit, or accept the wrap and say so.
