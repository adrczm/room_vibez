# Data-engine slice (A2): final report

All six tasks are done on the engine side and checked in headless Chrome. `main.ts`, `index.html`, `styles.css`, `index.ts` and all existing tests are untouched. Dev server on 18782 is stopped.

## 1. Per task

| # | Status | How it was checked |
|---|---|---|
| 1 `persistRoomGraph` outcome | **Verified** | It now returns `boolean`. Unit tests, plus Chrome: `true` normally; `false` with `Storage.prototype.setItem` throwing (the stress test's F3 method) and with the `window.localStorage` getter throwing. The app stays `ready` and the room stays in memory. |
| 2 Harden `normalizeRoomGraph` + quarantine | **Verified** (engine); host wiring not done | Baseline: 12 of 22 poisoned saved rooms booted into `data-viewer-status=error`. After: all boot `ready` with no room and no errors. Quarantine in Chrome with real `localStorage`: the F1 poison moved to the backup key, main key removed, next load `none`, and the downloaded text was byte-identical to the original. |
| 3 `.mjs` confirm | **Verified** | `mjsGuardrails.test.ts` passes unedited. Chrome: an async `confirmFn` resolving `false` rejects and the code never ran; resolving `true` loaded the module. Through the unedited UI, the native confirm shows the deck wording; dismiss cancels, accept loads. Against the original `modules.ts` the new async tests fail, as they should. |
| 4 Which size field | **Verified** | `createRectangularRoom` throws `RoomSizeError` with `.fields`; the message text is unchanged, so the pinned `/positive/i` test still passes. Chrome: width 0 and thickness −1 give `fields: ['width','wallThickness']`. |
| 5 Plan check before the mock path | **Verified with synthetic files only** | `checkPlanFile` in Chrome: `.ifc`/`.exe` → `unsupported_type`; random, exe-content and empty `.dwg` → `not_dwg`; random `.dxf` → `not_dxf`; PDF → `pdf_unsupported`; PNG, JSON, and files starting `AC1032` or `0/SECTION` pass. Sample fixture and image underlay still work (e2e). |
| 6 IndexedDB | **Verified: the defect is real.** Engine fix verified; host call not wired | See below. |

**Task 5 caveat.** The DWG rule is only "first six bytes match `AC10` plus two digits". It was not verified with a real DWG file. The DXF rule accepts the `AutoCAD Binary DXF` sentinel, or text whose first group after `999` comments is `0`/`SECTION` or `0`/`EOF`. That rule comes from my own knowledge of the format and was not verified with a DXF from a CAD program. Neither parses the drawing.

**Task 6 result.** Create room → Export project → Clear room → reload brings the room back (4 walls, "Living"), and again on every later reload. It is the snapshot from export time: a door added after the export was missing. Without an export, the room stays gone. Calling `clearProjectFromIdb()` after Clear keeps it gone, including when export and clear fire back to back.

## 2. Files (relative to `$WS`)

Changed:
- `src/viewer/roomGraph.ts`
- `src/viewer/modules.ts`
- `src/viewer/mjsGuardrails.ts`
- `src/viewer/dwgImport.ts`
- `src/viewer/projectIO.ts`

New:
- `tests/unit/roomPersistence.test.ts`
- `tests/unit/roomGraphValidation.test.ts`
- `tests/unit/mjsConfirm.test.ts`
- `tests/unit/planFileCheck.test.ts`
- `tests/unit/projectIdbClear.test.ts`

A diff against `base-w0` shows exactly these ten and nothing else.

## 3. Public API

### `roomGraph.ts`

```ts
export const QUARANTINE_STORAGE_KEY = 'catalog3d.roomGraph.unreadable';
export interface StorageLike { getItem(key: string): string | null; setItem(key: string, value: string): void; removeItem(key: string): void }

export type RoomSizeField = 'length' | 'width' | 'ceilingHeight' | 'wallThickness';
export const ROOM_SIZE_ERROR_MESSAGE = 'Room size must be positive (length, width, ceiling height, wall thickness)';
export class RoomSizeError extends Error { readonly fields: RoomSizeField[] }   // name = 'RoomSizeError'
export function invalidRoomSizeFields(input: RoomSizeInput): RoomSizeField[];   // form order; [] = valid

export function roomGraphProblem(raw: unknown): string | null;                  // developer-facing, not UI copy
export function normalizeRoomGraph(raw: unknown): RoomGraph | null;             // same signature, now strict

export function persistRoomGraph(graph: RoomGraph | null, storage?: StorageLike): boolean;   // was void
export function loadPersistedRoomGraph(storage?: StorageLike): RoomGraph | null;             // no side effects

export type QuarantineReason = 'not_json' | 'invalid_graph' | 'render_failed';
export interface QuarantinedRoomGraph { raw: string; reason: QuarantineReason; detail: string; quarantined_at: string }
export interface QuarantineOutcome { quarantined: QuarantinedRoomGraph; backedUp: boolean; removed: boolean }
export type PersistedRoomLoad =
  | { status: 'none'; graph: null }
  | { status: 'ok'; graph: RoomGraph }
  | ({ status: 'unreadable'; graph: null } & QuarantineOutcome)
  | { status: 'storage_unavailable'; graph: null };
export function loadPersistedRoomGraphOrQuarantine(storage?: StorageLike, now?: () => Date): PersistedRoomLoad;
export function quarantinePersistedRoomGraph(reason: QuarantineReason, detail: string, storage?: StorageLike, now?: () => Date): QuarantineOutcome | null;
export function readQuarantinedRoomGraph(storage?: StorageLike): QuarantinedRoomGraph | null;
export function discardQuarantinedRoomGraph(storage?: StorageLike): boolean;
```

- **What `normalizeRoomGraph` now rejects:**
  - no rooms, or a room or wall that is not an object;
  - a floor polygon with fewer than 3 points or a non-finite point;
  - ceiling height, wall thickness or wall height that is not a finite number above 0;
  - non-finite wall end points;
  - an opening with a non-finite `offset_along_wall`, `width`, `height` or `sill_height`;
  - a placement with a non-finite `position.x`, `position.z` or `rotation_y` (`position.y` and `scale` only if present and non-finite).
- **Not checked:** ids, `wall_ids`/`wall_id` references, materials, source assets, underlay. `walls: []` is still accepted.
- **Backup behaviour:** the main key is removed only after the backup write succeeds. A newer quarantine replaces the older backup.
- **`createRectangularRoom` also rejects `Infinity` now** (it was accepted before).

### `dwgImport.ts`

```ts
export type PlanFileRejection = 'unsupported_type' | 'pdf_unsupported' | 'not_dwg' | 'not_dxf';
export type PlanFileKind = 'raster' | 'dwg' | 'dxf' | 'json_candidates';
export type PlanFileCheck =
  | { ok: true; kind: PlanFileKind; filename: string }
  | { ok: false; reason: PlanFileRejection; filename: string; extension: string };
export class PlanFileError extends Error { readonly reason: PlanFileRejection; readonly filename: string }  // name = 'PlanFileError'
export function looksLikeDwg(head: Uint8Array): boolean;
export function looksLikeDxf(head: Uint8Array): boolean;
export const PLAN_SNIFF_BYTES = 4096;
export async function checkPlanFile(file: File): Promise<PlanFileCheck>;
export const IMPORT_NOT_A_ROOM_MESSAGE = 'Import candidates are not a usable room';
```

`startImportJob` still does not look inside a `.dwg`/`.dxf`, because `dwgImport.test.ts` feeds it a 4-byte stub and expects the mock result. `checkPlanFile` is the gate the host must call first.

### `projectIO.ts`

```ts
export function clearProjectFromIdb(): Promise<boolean>;   // never rejects; false = IndexedDB unavailable or delete failed
```

`persistProjectToIdb` keeps its signature. It and the clear now run in call order, so a clear issued right after an un-awaited export still lands after it.

### `mjsGuardrails.ts` and `modules.ts`

```ts
export function mjsGuardPrompt(scan: MjsScanResult, fileName: string): { title: string; paragraphs: string[] };
export function formatMjsGuardMessage(scan: MjsScanResult, fileName: string): string;   // title + '\n\n' + paragraphs joined by '\n\n'
export function parseMjsGuardMessage(message: string): { title: string; paragraphs: string[] };
export const MJS_NATIVE_CONFIRM_HINT = 'Choose OK to load, or Cancel to stop.';
// importModuleFile opts:
confirmFn?: (message: string) => boolean | Promise<boolean>;
```

- **Deck §5 wording, copied exactly:**
  - Title: `Run code from “{file}”?`
  - Body: `An .mjs file is a program, not a model. It runs in this page and can do anything the page can. Only continue if you trust where it came from.`
  - If the scan flagged something: `A quick scan flagged: {risks joined by ", "}. These are unusual for a furniture pack.`
  - If not pack-like: `This file doesn't look like a furniture pack.`
- **Line breaks are mine.** The deck gives the body as one cell; I split it into paragraphs.
- **Strict yes.** Only an explicit `true` loads; the check is now `ok !== true`.
- **Fallback.** With no `confirmFn`, `window.confirm` is used and the deck's OK/Cancel sentence is appended.

### Export lines needed in `src/viewer/index.ts`

Compile-checked in a scratch copy, together with the host call patterns below.

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

### How the host should call each

- **Saving blocked (Task 1).** In `applyRoomGraph()`: `const saved = persistRoomGraph(roomGraph);`. Show the deck §4.F *Saving blocked* banner when `!saved && roomGraph`, and hide it when a later call returns `true`.
- **Clear and IndexedDB (Task 6).** In `applyRoomGraph()`, right after the `persistRoomGraph` line: `if (!roomGraph) void clearProjectFromIdb();`. This covers `#btn-clear-room` and Import project of a file with no room. The minimum is the `#btn-clear-room` handler, after `applyRoomGraph(null, { history: 'reset' })`.
- **Boot (Task 2).** In `boot()`, replace `roomGraph = loadPersistedRoomGraph();` with:
  ```ts
  const saved = loadPersistedRoomGraphOrQuarantine();
  roomGraph = saved.graph;
  ```
  - If `saved.status === 'unreadable'`, show deck §4.F *Saved room unreadable*.
  - The download button calls `downloadTextFile('<name>.json', saved.quarantined.raw)`.
  - In that case **skip the `loadProjectFromIdb()` fallback**. Otherwise the last exported room loads and the deck sentence "started with an empty one" is false. This is a host decision; I recommend skipping.
  - Optional: wrap the first room render in try/catch and call `quarantinePersistedRoomGraph('render_failed', String(err))`.
- **`.mjs` dialog (Task 3).** At both `importModuleFile(...)` calls:
  ```ts
  importModuleFile(file, undefined, { confirmFn: (m) => {
    const { title, paragraphs } = parseMjsGuardMessage(m);
    return confirmDialog({ title, body: paragraphs.join('\n\n'), confirmLabel: 'Load and run', cancelLabel: "Don't load" });
  } })
  ```
- **Size field (Task 4).** In the `onCreateRoom` catch: `if (err instanceof RoomSizeError)`, map `err.fields[0]` to the field label for deck §4.F *Size invalid*.
- **Plan check (Task 5).** In the `#btn-import-plan` handler, call `const check = await checkPlanFile(file)` before anything else.
  - `!check.ok` → show the message for `check.reason` and start nothing.
  - `check.kind === 'raster'` → `onStartUnderlay`.
  - Otherwise → `onStartImport`.
  - As a backstop, also handle `err instanceof PlanFileError` in the `onStartImport` catch.

### Thrown messages

- **New:** `Unsupported plan file type: "<filename>" (expected .dwg, .dxf or .json)`. Thrown as `PlanFileError` with reason `unsupported_type` by `startImportJob`.
- **New:** `Import candidates are not a usable room: <detail>`. Thrown by `confirmImportToRoomGraph`; match on the prefix. Example detail: `walls[0].thickness is not a number above 0`.
- **Existing text, new trigger:** `Candidates payload must be a JSON object` is now also thrown for a `.json` that does not parse (it was a raw `SyntaxError`).
- **Existing text, now a typed error:** `Room size must be positive (length, width, ceiling height, wall thickness)`.
- **Unchanged:** `MJS load cancelled by user`, `room_graph failed normalizeRoomGraph` (now thrown for more files), and every other message.
- **Newly reachable, not mine:** `RoomHistory: failed to clone graph` (`roomHistory.ts`) now fires when a damaged graph is applied, for example a template whose stored graph is damaged. The copy mapper should cover it.

## 4. Results

- `tsc --noEmit`: exit 0.
- `vitest run`: **167 passed, 23 files** (66 existing unedited, 101 new in 5 files).
- e2e: **9 passed** on the final code with default workers. An earlier parallel run had 5 timeouts at load average ~91; the `--workers=1` re-run passed 9/9.

Browser scripts are in `$S/data/` (`idb-clear-reload.mjs`, `poison-boot.mjs`, `verify-engine.mjs`, `verify-bad-candidates.mjs`), with output in `$S/data/out/`.

## 5. Found beyond the handoffs, and what I am unsure of

- **Templates are lost by the same IndexedDB fallback (measured).** Save T1 → Export → save T2 → Clear → reload: the template list becomes `[T1]` and T2 is gone. Boot's `persistTemplates(project.templates)` overwrites the current list. `clearProjectFromIdb()` on Clear fixes this path, but that boot line stays a hazard whenever the fallback fires.
- **After an IndexedDB fallback the room is not written back to `localStorage`,** so IndexedDB remains the source until the next edit.
- **Already in effect with the unedited host:**
  - poisoned saved rooms no longer crash boot, but the bad key stays and nothing is said;
  - `.ifc`/`.exe` are refused with the raw engine message;
  - the `.mjs` native confirm shows the new wording.
- **Not in effect until the host is wired:**
  - the saving-blocked banner;
  - quarantine with its message and download;
  - the field name in the size error;
  - the not-a-DWG refusal (a random `.dwg` through the UI still gets the mock result);
  - Clear followed by the IndexedDB clear.
- **The deck has no string for a `.dxf` that fails the check** (`not_dxf`). It needs a new string, or reuse of the DWG one.
- **`onCreateRoom` hides two fields from the engine.** By code reading, it replaces a blank or 0 ceiling height and wall thickness with defaults (`|| DEFAULT_…`) and ignores all four fields unless Preset is Custom. Through today's host the engine can only name those two fields for negative values. I ran only the width 0 case in the UI.
- **A candidates JSON whose room has no `ceiling_height` crashes the host's `renderImportReview`** and shows `Cannot read properties of undefined (reading 'toFixed')`. This predates my change and is not in the Phase 4 table. Not done.
- **Not done, not in the table:**
  - `persistTemplates` in `roomTemplates.ts` (no wave-1 owner) swallows storage failures the same way;
  - `parseProjectJson` does not validate `templates` entries (this feeds R8).
