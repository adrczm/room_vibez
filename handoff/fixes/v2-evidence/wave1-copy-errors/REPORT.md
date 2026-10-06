# B1 report: copy slice (`src/copy.ts`, `src/errors.ts`)

## 1. Status

| Task | Status |
|---|---|
| Task 1, `src/copy.ts` | **Done and tested.** Deck §3.1 to §3.6, §4.A to §4.F and §5 (viewer rows) are all transcribed. A scratch script compared the 309 deck-group strings with the deck text; the only ones not found verbatim are the variants listed in §5(c). |
| Task 2, `src/errors.ts` | **Done and tested.** `friendlyError` plus the other pure mappers. Tests call the real engine functions where they run in node, and use source literals with `file:line` otherwise. |
| Escalating upload wording (deck §4.A) | **Done and tested**, through `ctx.attempt` or `createUploadEscalation()`. |
| Three parallel engine changes | **Mapped from the deck, not verified against the new engine.** See §5(e). |

No browser check was run: nothing imports these modules yet.

## 2. Files created (all under `$WS = …/scratchpad/ws-copy`)

- `/private/tmp/claude-501/-Users-adrian-Desktop-Room-Vibez/7ac663fe-e0d6-4b3c-af69-487be083d847/scratchpad/ws-copy/src/copy.ts`
- `…/ws-copy/src/errors.ts`
- `…/ws-copy/tests/unit/copy.test.ts` (20 tests)
- `…/ws-copy/tests/unit/errors.test.ts` (68 tests)

A diff against `base-w0` shows only these four files. Scratch tools, not for merging, are in `…/scratchpad/b1-tools/`: `check-deck.mts`, `check-deck-strict.mts`, `PROGRESS.md`.

## 3. Structure and signatures

### `copy` groups

| Group | Deck section |
|---|---|
| `common` | `why`, `technicalDetails`, `delete` (shared by several sections) |
| `helperLines` | §3.1 |
| `topBarAndStage` | §3.2 |
| `stageHints` | §3.3 |
| `productCard` | §3.4 |
| `roomStart` | §3.5 |
| `roomTools` | §3.6 |
| `modelMessages` | §4.A |
| `textureMessages` | §4.B |
| `packMessages` | §4.C |
| `slotWarnings` | §4.D |
| `planMessages` | §4.E |
| `roomMessages` | §4.F |
| `confirm` | §5: `clearRoom`, `replaceRoom`, `deleteTemplate`, `loadMjs` |
| `notInDeck` | Clearly marked section; 50 strings |

Conventions hosts need:
- **Option maps** are keyed by option value or `data-*` value: `roomStart.units`, `.presets`, `.ingress`, `productCard.textureRoles`, `.textureCategories`, `.lightPresets`.
- **Plurals** are `{ one, other }` objects (12 groups), used with `plural()`.
- **Bold markers:** ten keys carry `**bold**` and must go through `rich()` or `plain()`, never straight into `textContent`:
  - `topBarAndStage.overlayNoWebgl`, `topBarAndStage.overlayCouldntStart`
  - `roomStart.sampleBanner`
  - `roomMessages.sizeInvalidField`, `.importFailed`, `.savingBlocked`, `.savedRoomUnreadable`
  - `confirm.clearRoom.body`, `confirm.replaceRoom.body`
  - `notInDeck.sampleBannerBuiltIn`
- **Excluded on purpose:** deck §2 (help content), §6 (prototype) and §7 (alternatives).

### `src/copy.ts` exports

```ts
export const LOCALE = 'en';
export const copy = { … } as const;
export type Copy = typeof copy;
export type CopyShape;                       // same keys, any strings (for a translation)
export type FmtVars<S extends string>;       // placeholder names of a literal template
export interface PluralForms { one: string; other: string; zero?; two?; few?; many? }
export interface RichSegment { text: string; strong: boolean }

export function fmt<S extends string>(template: S, vars: FmtVars<S>): string;
export function plural(n: number, forms: PluralForms): string;
export function plural(n: number, one: string, other: string): string;
export function rich<S extends string>(template: S, vars?: FmtVars<S>): RichSegment[];
export function plain(text: string): string;
```

- `fmt` type-checks placeholders for literals from `copy`; a missing or misspelt one is a compile error. An unfilled placeholder is left visible rather than throwing.
- `plural` uses `Intl.PluralRules` and replaces `{n}` with the count.
- `rich` fills placeholders after splitting on `**`, so a file name with asterisks cannot change the emphasis.

### `src/errors.ts` exports

```ts
export type ErrorWhere = 'boot' | 'product-load' | 'model-upload' | 'texture-add' | 'pack-load'
  | 'module-load' | 'plan-import' | 'plan-image' | 'plan-scale' | 'plan-confirm' | 'template-use'
  | 'template-save' | 'room-create' | 'opening-add' | 'draw-walls' | 'place' | 'plan-png'
  | 'project-import';
export type RoomSizeField = 'length' | 'width' | 'ceilingHeight' | 'wallThickness';
export interface ErrorContext { where: ErrorWhere; name?: string; fileName?: string;
  attempt?: number; field?: RoomSizeField; log?: (...args: unknown[]) => void }
export interface FriendlyMessage { text: string; segments: RichSegment[]; critical: boolean;
  neutral: boolean; id: string; matched: boolean }

export function friendlyError(err: unknown, ctx: ErrorWhere | ErrorContext): FriendlyMessage;
export function rawMessage(err: unknown): string;
export function createUploadEscalation(): {
  map(err: unknown, ctx?: Omit<ErrorContext, 'where' | 'attempt'>): FriendlyMessage; reset(): void };

export function slotWarnings(report: SlotReportLike, product: WarningProductLike,
  opts?: { slotLabel?: (slotId: string) => string }): SlotWarning[];   // { id, text, critical }[]

export type PackPanelMode = 'split' | 'slots' | 'fallback' | 'unknown';
export function packPanelMode(status: PackStatusLike): PackPanelMode;
export function packSummary(status: PackStatusLike):
  { mode: PackPanelMode; text: string; critical: boolean; details: string[] };
export function packStatusMessage(input: { name: string; glbName?: string | null; status: PackStatusLike }):
  { id: string; text: string; critical: boolean };

export function friendlyObjNote(note: string): string | null;

export function overlapList(report: CollisionReportLike, productName?: (hit: { id: string; label: string }) => string): string | null;
export function placedMessage(name: string, report: CollisionReportLike, productName?): { id: string; text: string; overlap: boolean };
export function movedOverlapMessage(name: string, report: CollisionReportLike, productName?): string | null;

export function mjsConfirmContent(scan: MjsScanLike, fileName: string):
  { title: string; body: string; bodyParts: string[]; confirmLabel: string; cancelLabel: string };
export function splitGuardMessage(message: string): { title: string; body: string };
```

The `…Like` input types are structural, so the engine's `SlotReport`, `Product`, `PackStatus`, `CollisionReport` and `MjsScanResult` fit without `errors.ts` importing engine files.

What the host needs to know when wiring:
- **Output:** `text` is plain and safe for `textContent`; `segments` keeps the bold runs.
- **Logging:** `friendlyError` already calls `console.error('[where]', err)` (not for a cancel), so the hosts' own `console.error(err)` beside each call would duplicate it.
- **Required context:** the plan wrong-type sentence needs `ctx.fileName`, and the place sentences need `ctx.name`. Without them the generic message is used.
- **Cancelled `.mjs`:** returns `neutral: true`; no error styling.
- **`critical` flag:** set per rule and never read from the wording (tested against the old `/unknown|incomplete/i` regex). The handoffs do not say which errors are task-blocking, so I used one rule:
  - `false` when the app is waiting for a different choice or input.
  - `true` when a file was found unusable, the app could not do the job, or the error was unrecognised.
  - It is one boolean per row if you want it changed.
- **Pack notes:** `slotWarnings` no longer repeats the raw pack notes; they move to `packSummary().details` for the collapsed *Details*.
- **Split detection:** the engine has three mapping modes. The deck's fourth summary ("split") is `slots` mode with a `COLOR_0 zone split` note, the same test `renderPackParams` uses today.

## 4. "Not in the deck" strings (50)

**Given by a handoff (22)**

| Key | String | Asked by |
|---|---|---|
| `advanced` | Advanced | UX-07 item 2 |
| `steps.room` / `.openings` / `.place` / `.finish` | Room / Openings / Place products / Wall and floor finish | UX-08 item 1 |
| `stepChange` | Change | UX-08 item 2 |
| `adjustSize` | Adjust size | UX-08 item 4 |
| `more` | More | UX-08 item 6 |
| `addToRoom` | Add to room | UX-08 item 3 |
| `placedProducts.row` | {name} {n} | UX-09 item 2 (format given) |
| `picker.productLabel` | Product | UX-14 step 7 |
| `picker.searchProducts` | Search products | UX-14 step 7 |
| `picker.noProductsMatch` | No products match. | UX-14 step 7 |
| `picker.close` | Close | UX-14 step 7 |
| `picker.viewLabel` / `.thumbnails` / `.list` | View / Thumbnails / List | UX-14 step 7 |
| `picker.defaultMaterial` | Default | UX-15 step 1 |
| `appliesToNextProduct` | Applies to the next product you place. | UX-16 step 3 |
| `uploadNotRestored` | “{name}” isn't available after a refresh, so it wasn't placed back. Add the model again to use it. | Copy §6 C |
| `packDetails` | Details | Copy Phase 3 |

**Written by me in the deck's voice (28), not reviewed by anyone**

| Key | String | Asked by |
|---|---|---|
| `emptyRoom.title` | No room yet | UX-06 item 1 |
| `emptyRoom.body` | Pick a way to start. | UX-06 item 1 |
| `emptyRoom.fromScratch` / `.importPlan` / `.fromTemplate` | From scratch / Import plan / From template (the deck's tab labels) | UX-06 item 1 |
| `emptyRoom.importProject` | Import project (the deck's button label) | QA-04 |
| `placedProducts.rotateLeft` / `.rotateRight` | Rotate left / Rotate right | UX-09 item 3 |
| `placedProducts.duplicate` | Duplicate | UX-09 item 3 (optional action) |
| `placedProducts.selectedHint` | Arrow keys to move · R to rotate · Delete to remove | UX-09 item 3 |
| `placedProducts.movedOverlap` | “{name}” overlaps {what}. You can leave it, or move it again. | UX-09 item 3 |
| `canvasLabel` | 3D view | UX-13 |
| `picker.triggerName` | {label}: {name} | UX-14 step 2 |
| `picker.searchMaterials` / `.noMaterialsMatch` | Search materials / No materials match. | UX-15 step 1 |
| `outsideRoom` | That spot is outside the room, so nothing was placed. Click the floor inside the room. | QA-02 |
| `genericError` | Something went wrong. Try again. | Copy Phase 3 (generic fallback) |
| `overlayModelFailed` | This product's 3D model couldn't be loaded. Choose another product, or reload the page. | Copy Phase 1 step 8 |
| `placeFailedOther` | Couldn't place “{name}”. Try again. | deck gap, §4.F |
| `openingSizeInvalid` | Width and height need to be above 0. | engine `roomGraph.ts:389` |
| `unitAbbrev.m` / `.cm` / `.ft-in` | m / cm / ft | deck gap, §3.5 `({unit})` |
| `roomSizeFeet` | {length} × {width} | deck gap, §3.6 |
| `importWallRow` | Wall {n} · {length} | deck gap, §3.5 |
| `importRoomRow` | {name} · ceiling {height} | deck gap, §3.5 |
| `openingListRow` | {type} · {width} × {height} · sill {sill} | deck gap, §3.6 |
| `sampleBannerBuiltIn` | **Sample plan.** These walls come from a built-in example. | deck gap, §3.5 |
| `jobStatusSample` | Sample plan | deck gap, §3.5 |

UX-04 needed no new string: its toasts and state line use deck §3.3 and §4.F.

## 5. Deck problems, unmapped messages, and what to reconcile

### (a) Ambiguous or contradictory; the deck's words were kept and nothing was resolved silently

1. **Bold has two meanings in the deck:** UI emphasis inside sentences, and "this label changed". I kept `**` only inside sentences (the ten keys above), dropped it on labels and buttons, and dropped italics (so `*(rebuilds model)*` is plain text).
2. **§3.2 overlay error vs Copy Phase 1 step 8:** the deck gives one sentence for "anything else"; the handoff asks to split boot from model. Boot uses the deck sentence; product load uses `notInDeck.overlayModelFailed`.
3. **§3.2 "(With quarantine, see §4.F.)":** once quarantine lands, "your saved room may be damaged" in the boot sentence looks stale. Kept as written.
4. **§3.4 swatch tooltip:** the slot meta "moves to the swatch tooltip", but the next row says the tooltip is unchanged. I used the unchanged tooltip.
5. **§3.4 vs QA-14:** the deck keeps the `#model-files` aria-label ("Upload GLB, glTF, or OBJ package"); QA-14 says it fails WCAG 2.5.3 and should be dropped. The string is in `copy`; the host decides.
6. **§3.5 vs §3.6:** the preset reads "Living room · 5 × 4 m" but the status example reads "Living · …" (the engine preset label is `Living`).
7. **§3.5 vs §4.E:** two wordings for "no scale": "…Enter a length you know to set it." and "…Enter a length you know." Both are in `copy`.
8. **§4.C vs Copy §8:** the deck's "Not a pack" sentence names `createAsset`, which Copy Phase 3 acceptance and the §8 regex forbid in visible text. Separately, `\bstub\b` with `/i` matches the `STUB-SKU-…` text the deck keeps visible. The §8 check cannot return false as written.

### (b) Apparently wrong

9. **§3.5 sample banner:** "Your file was kept but not read" is false after *Try the sample plan* (no file), and a JSON plan is not a sample at all. I wrote `sampleBannerBuiltIn` for the first case; the deck has nothing for JSON.
10. **§3.5 Job status:** the "file name" for the built-in sample is `sample-plan.candidates.json`. I wrote `jobStatusSample`.
11. **§4.E "Scale: none":** with no scale hint the engine can never set a scale (`dwgImport.ts:333`), so "Enter a length you know" cannot work.
12. **§4.F "Place failed":** "Load its pack again" is wrong for a product that is not a pack. The deck sentence is used only for the missing-factory error; everything else uses `placeFailedOther`.
13. **§4.A wrapped messages:** "OBJ file is empty" and the sidecar-shape message never reach the host bare; the engine wraps them (`Could not parse OBJ (x): OBJ file is empty`, `Invalid sidecar JSON (x): Sidecar must be…`). The mapper handles both forms.

### (c) Variants of deck strings (deck's words, a form it does not spell out; marked `// variant` in the file)

- Window twins: `stageHints.addOpeningWindow`, `roomMessages.openingAddedWindow`. The deck writes `{door / window}`; each type has a full sentence.
- `textureMessages.roughnessMapAdded` and the lower-case `categoryInSentence`.
- `packMessages.notAPackNoExports` (the exports sentence left out).
- `slotWarnings.noUv.other` ("have").
- Singular or plural partners in every `{ one, other }` group.
- `modelMessages.added` (no .mtl part), `roomStart.openingRow` (no "estimated"), `roomMessages.importOkUnnamed`, `roomMessages.sizeFields`.

Three strings are kept from today rather than from a deck "Visible now" cell:
- `roomTools.undoTooltip` / `redoTooltip`
- `roomStart.sampleBannerTechnical` (the e2e-pinned original)
- `topBarAndStage.helpAriaLabel` (deck §2). B2 may define the help-button strings too; keep one copy.

### (d) Engine messages with no deck wording

- `roomGraph.ts:389` "Opening width and height must be positive" maps to `notInDeck.openingSizeInvalid`.
- `objImport.ts:541` "Slots from sidecar only (n)": `friendlyObjNote` returns null.
- `objImport.ts:474` (UV note) reuses the §4.D UV sentence.
- These fall to the generic message:
  - `roomGraph.ts:379`, `:391`, `:426`
  - `roomTemplates.ts:77`
  - `roomHistory.ts:69`
  - `RoomVibezViewer.ts:281`, `:283`, `:285`, `:299`, `:560`, `:733`
  - `main.ts` "Materials library is empty"
- `RoomVibezViewer.ts:749` and `:751` get the product-load overlay sentence.
- The IndexedDB errors (`projectIO.ts:63–93`) and `dwgImport.ts:213` are swallowed and never reach the UI.
- Not triggerable in node, tested from literals: `uploads.ts:130` (GLTFLoader hangs), `objImport.ts:448` and `:589`, `roomPlan.ts:136` and `:143`.

### (e) To reconcile after merge

Each has a describe block named "to reconcile after merge" in `errors.test.ts`. They pass on the wave-0 engine and are written to keep passing after the change. If one fails after the merge, the engine's new message is not recognised.

1. **Room size names the field (Copy Phase 4 item 5).**
   - Today's message maps to the fallback sentence.
   - The mapper also accepts `ctx.field`, a `field` property on the error, or a message that names exactly one of length, width, ceiling, thickness.
   - The test calls the real `createRectangularRoom` for each field and requires `matched: true`.
   - Check that the host or engine actually delivers the field in one of those shapes.
2. **`formatMjsGuardMessage` rewrite (item 4).**
   - `mjsConfirmContent(scan, fileName)` builds the deck §5 wording from `copy`.
   - `splitGuardMessage()` splits an engine message into first line (title) and rest (body).
   - Once the engine title starts with "Run code from", the test asserts the two agree, ignoring whitespace.
   - Decide which one the host uses.
3. **Plan-file rejection (item 6).**
   - The engine messages are unknown, so two heuristic rules at the plan call sites recognise likely wording (unsupported or not supported; "not a … DWG").
   - The tests call the real `startImportJob` with an `.ifc` and with random bytes named `.dwg`. They assert the deck sentence only if it rejects; today it does not.
   - Replace the heuristics with the real messages once they exist.

## 6. Check results (in `$WS`)

- `npx tsc --noEmit`: exit 0.
- `npx vitest run`: **20 files passed, 154 tests passed** (baseline 18 files / 66 tests, plus `copy.test.ts` 20 and `errors.test.ts` 68). No existing test was edited.
