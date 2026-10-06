# Catalog thumbnail picker, texture options, and finishes in the room: handoff to the implementing Claude

**Audience:** the Claude session that applies this inside the larger fix. You have no memory of the session that wrote it.
**Written:** 2026-10-05 by the `/design:user-research` session, requested by Adrian.
**Status:** **Nothing here has been applied.** Findings marked **M** were measured in the live app. **The proposals are not validated with users** (there was no user research; see `docs/usability-research-report.md` §0).
**Updated:** 2026-10-05, after Adrian confirmed DT1 and DT2 and asked for a **list view** alongside thumbnails (UX-14 step 2b, UX-15 step 7, DT8).
**Scope:** `hackathon-3d-viewer/` ("Catalog 3D", `http://127.0.0.1:18767/`).
**Project root:** `/Users/adrian/Desktop/Room Vibez/` (not a git repo). Paths are relative to it.

---

## 0. Read this first: this is the third document, not a rival

| Document | Owns |
|---|---|
| `fixes/ux-improvements-handoff.md` (the **sibling**, items UX-01 to UX-13) | Behaviour and layout: workspace segmentation (UX-07), Room task order (UX-08), selecting placed products (UX-09), camera and floor (UX-05), empty state (UX-06), targets and accessibility |
| `fixes/ux-copy-improvements.md` + `docs/ux-copy-deck.md` | Every user-facing **word**, the **?** dialog, messages, `src/copy.ts` |
| **This document** (UX-14 to UX-16 and additions A1 to A3) | The **thumbnail picker for the object catalog**, **thumbnail texture options**, and **making a chosen finish real in the room** |

**Rule for words:** the deck wins. New strings go in `src/copy.ts` (created by copy Phase 0), in the deck's voice (deck §1: one short line, state-based, how-to goes in the **?**). List every new string in your completion doc. Candidates are in §4.

### 0.1 Where this document changes the sibling

| Sibling item | What changes | Why |
|---|---|---|
| **UX-10** ("verify first") | **Verified (M).** It is real, and **wider** than it says: bindings ignore the swatch *and* nothing applies library materials to a placed product at all. **Do UX-16 steps 1 and 2 instead of UX-10's "Do".** | UX-10 points at "the existing slot-binding path (`src/viewer/slots.ts`)". That file only **discovers** slots. Applying a material is **private** in `RoomVibezViewer` (`applyMaterial` ~:558, `createMaterial` ~:591) and works on the turntable's `slotMeshes`. A new viewer method is needed. |
| **UX-08 step 5** (persistent Undo/Redo/Export/Import toolbar) | Add the guard in **A1** | "Import project" is an upload. Adrian's rule: room uploads only in the Room workspace. |
| **UX-07** acceptance | Add the DOM check in **A2** | Makes Adrian's rule testable. |
| Everything else | Unchanged | |

### 0.2 Combined order (extends sibling §0.2)

1. Snapshot + baseline (sibling §0.3, §1).
2. Copy handoff **Phase 0** (`src/copy.ts`).
3. Sibling **Phases A and B** (UX-01 to UX-06).
4. Sibling **UX-07 and UX-08** (structure). Apply **A1** and **A2** while you are there.
5. **UX-16 steps 1 and 2** (engine method + host), *instead of* UX-10's Do.
6. Sibling **UX-09** (selection).
7. **UX-14**, then **UX-15**. UX-14 thumbnails need step 5's engine method to show the default finish.
8. **UX-16 step 3** (Materials in the Room step), then **16b** if UX-09 landed.
9. Copy **Phases 1 to 3**, then sibling **Phase D**.
10. Verification (§6) and **one** completion doc (§8).

### 0.3 Working rules (same as the sibling; repeated because you start cold)

- **No git.** Snapshot `hackathon-3d-viewer/{index.html,src,tests}` to your scratchpad before editing.
- **Another session edits `src/main.ts` and `src/viewer/RoomVibezViewer.ts`.** Re-read right before editing; targeted edits only. Locate by function name; line numbers below are from 2026-10-05 ~15:00.
- **Dev server already runs on `:18767`** (`--strictPort`). Don't start another.
- **Don't run `npm run test:e2e` as-is** (six specs write to hard-coded `~/Library/Application Support/Cursor/AgentStores/…`). Copy the spec to scratch and redirect `MEDIA`/`ARTIFACTS`. `viewer.spec.ts` is the only one safe in place.
- **The agent shell cannot write inside the project.** Use your file-edit tools for project files, and run scripts with output pointed at a scratch directory.
- **Cold boot must still land on Product** with the demo chair visible (`docs/model-display-deep-qa-fix.md`).
- **Do not invent.** No made-up product images, categories, makers, prices or SKUs. Honesty labels stay.

---

## 1. What Adrian asked, and where each part is handled

Verbatim:

> "maybe it would be a good idea to segment options based on user flow. whatever is for Room creation or upload to be available only in the Room workspace"
> "Looking through the object catalog should be a thumbnail view drop down with texture options."
> "combine patterns from ROOMLE and Planner 5D to make the most of the options available."

Adrian's answers to the two interpretation calls (2026-10-05):

> "Yes, room files, plans and sketches for rooms only."
> "Yes, thumbnail pickers. Maybe take into consideration switching from thumbnails to lists, for ease of use under more use cases"

| Ask | Where |
|---|---|
| Segment by flow; room creation and **room** uploads only in Room | **Sibling UX-07/08**, plus **A1, A2** here. Rule check below. |
| Catalog browsing = thumbnail drop-down, **with a switch to a list view** | **UX-14** (view toggle: step 2b) |
| "with texture options" | **UX-15** (material lists) and **UX-16** (so the choice is real in the room) |
| Roomle and Planner 5D patterns | §3 (what is adopted and deferred); evidence in `docs/usability-research-report.md` §5 |

**Rule check: which controls are Room-only** (`R1`). **Confirmed by Adrian:** *upload* means room files, plans and sketches for rooms only. Product uploads (model, pack, module, texture) stay in Product (DT1). `#plan-file` already accepts plans and sketches: DWG, DXF, JSON, PNG, JPG, WebP, PDF (`index.html:114-116`).

| Control | Must be in | Sibling plan | Status |
|---|---|---|---|
| Ingress tabs, scratch form, `#btn-create-room`, templates | Room | UX-07 | ✔ |
| `#plan-file`, `#btn-import-plan`, `#btn-import-fixture`, underlay review | Room | UX-07 | ✔ |
| `#project-file`, `#btn-import-project`, `#btn-export-project` | Room | UX-07 | ✔, **but** UX-08 step 5 adds a toolbar → **A1** |
| `#btn-clear-room`, Undo/Redo, Draw walls, Openings, Place | Room | UX-07/08 | ✔ |
| `#stage-empty` (UX-06) | Room | UX-06 | ✔ by its own condition |
| `#model-files`, `#pack-files`, `#module-file`, `#texture-file` | Product | UX-07 | ✔ |

---

## 2. Evidence you can rely on

All **M**, measured 2026-10-05 in the in-app browser at 1024×768 (sidebar 649 px tall in Product, 633 px in Room), from the app as it stood at ~14:40. Re-measure with the script in `docs/usability-research-report.md` §8.

| What | Value |
|---|---|
| Product workspace, first sidebar card | `room-card` |
| Product picker / Materials / Light preset / Parts list, offsets | 982 / 1,835 / 2,704 / 2,831 px; total 3,106 px |
| Room workspace with a room: Draw walls / Openings / **Place** / **product picker** | 1,207 / 1,440 / **1,602** / **1,777** px; total 3,901 px |
| Inactive card opacity | 0.72 |
| Wall and floor material selects | 14 text options each, no preview |
| Product picker | `<select>`, 2 options: "Lounge chair (demo)", "Side table (demo)" |
| `Product` type | no `thumbnail`, `category` or `maker` field (`src/viewer/types.ts`) |
| Thumbnail capability | none (`preserveDrawingBuffer:false` at `RoomVibezViewer.ts:125`; no `toDataURL`/`toBlob` in `src/` or `scripts/`) |
| **Finish test** | Frame set to Walnut (card shows "Walnut"); room created; chair placed via `__rv.simulateRoomPointer`. Result: `slot_bindings = {frame:'wood-oak', handles:'plastic-black', pillow:'wool-cream'}`; the placed chair's 14 meshes use `placeholder_frame`, colour `#e7e7e7`, **no map** |
| Options per slot (demo catalog) | chair: frame 3, handles 6, pillow 3; table: top 4, legs 6 |

**Not measured:** how the placed chair looks under a real pointer click; behaviour at 375 px; performance with many products; whether a second WebGL context is acceptable here.

---

## 3. Roomle and Planner 5D: what is adopted, what is deferred

Evidence tags: **O** observed first-hand (Roomle editor via a public shared plan, no login); **D** documented on the vendor's official page; **U** unknown. **Planner 5D's editor was not observed** (sign-up wall). Details: `docs/usability-research-report.md` §5.

**Adopted**

| Pattern | Source | Lands as |
|---|---|---|
| Browse by **labelled thumbnail tiles** (thumbnail, then name) | Roomle **O** | UX-14 |
| Catalog split by **task** (Build / Furnish) | Roomle tabs **O**; Planner 5D left menu **D** | Sibling UX-08 already does this. No change; it supports it. |
| **Search** only where the list is long | Roomle **O**; Planner 5D **D** | UX-14 (hidden until the list is long; threshold undecided, DT4) |
| **List view** as an alternative to thumbnails | **Adrian** (2026-10-05), **not from the competitors**: Roomle showed thumbnail grids only (**O**); Planner 5D is **U** | UX-14 step 2b, DT8 |
| **Select an item, then a "Style" step** | Planner 5D **D**; Roomle **D** | UX-16b |
| Single **?** for help | Roomle **O** | Already the copy handoff's direction |

**Deferred (not in this pass; reason given)**

| Pattern | Reason |
|---|---|
| Doors and windows as thumbnail catalog items ("Construction") | Openings are empty cutouts with procedural placeholders; whether they host real products is open (`ASSUMPTIONS.md` A20, U15). |
| 2D / 3D / walk as canvas modes | Our 2D plan is a small SVG in the sidebar. A stage-level 2D view is a new camera mode, not scoped by anyone. |
| Category rail, "Show all", Brands tab | `Product` has no category or maker data. Don't invent it. The picker shows groups only when the data has them. |
| Favorites | Not requested. |
| Catalog state in the URL | Not requested. |

---

## 4. Work items

Severity: 🔴 blocks or misleads a core task · 🟡 slows a task · 🟢 polish. Effort: S ≈ hours, M ≈ a day, L ≈ several days. **Effort for anything touching the viewer or thumbnails is a guess; spike first.**

### UX-14 🔴 L: The object catalog as a drop-down with thumbnail and list views

- **Evidence:** UR6 in the report. The picker is `<select id="product-select">` (`index.html:243`), filled by `refreshProductSelect` (`main.ts:~1301`) with `name` or `name (upload)`. It has 2 options, no images, and `Product` has no data for images.
- **Do:**

  1. **Component.** New `src/ui/thumbnailPicker.ts` (engine code stays in `src/viewer/`; the file name says thumbnail but the component also provides the list view, so rename it if you prefer). Sketch, adjust as needed:
     ```ts
     export interface PickerItem {
       id: string;                 // option value
       label: string;              // visible name
       sublabel?: string;          // e.g. "Your upload"
       thumbUrl?: string;          // data/blob URL; placeholder when absent
       swatch?: { color: string; map?: string };  // CSS swatch for materials (UX-15)
       group?: string;             // category tab; omit when no data
     }
     export function createThumbnailPicker(opts: {
       select: HTMLSelectElement;  // state holder; stays in the DOM
       label: string;              // accessible name of the trigger
       getItems: () => PickerItem[];   // read fresh on open and on sync()
       viewKey: 'product' | 'material'; // which remembered view preference this picker uses (step 2b)
     }): { el: HTMLElement; sync(): void; destroy(): void };
     ```
  2. **Behaviour.**
     - A **trigger button** shows the current item (thumbnail, name, chevron). `aria-haspopup`, `aria-expanded`, accessible name = `label` + current name.
     - The popup shows the items in the **current view** (step 2b). **Thumbnail view:** a grid of tiles, thumbnail then name (`sublabel` under it). **List view:** one row per item. In both, items are `role="option"` in a `role="listbox"`, `aria-selected` on the current one, **roving tabindex** (arrow keys in two dimensions in the grid, up and down in the list), Home/End, Enter/Space selects, **Esc closes and returns focus to the trigger**, outside click closes.
     - If you include a search box, the popup is a `role="dialog"` containing the input and the listbox. **Search shows only when the list is long** (DT4). **Group tabs show only when at least two distinct `group` values exist.** Today there are none, so neither appears.
     - Prefer the native **`popover`** attribute (top layer, so the scrolling `.panel` can't clip it; Esc and outside-click built in). **Confirm it works in the project's Chrome**; if not, a non-modal `<dialog>`. No new dependencies.
     - **Size:** desktop popup width `min(520px, 100vw - 32px)`, aligned to the panel's right edge, allowed to overlay the stage. At ≤ 860 px it becomes a full-width sheet. These are design defaults, not evidence (DT3). Tiles ≥ 44 px on coarse pointers (sibling UX-12). Honour `prefers-reduced-motion`.
  2b. **View toggle: thumbnails or list** (Adrian: "switching from thumbnails to lists, for ease of use under more use cases").
     - **Why, as far as I can support it:** (a) thumbnails may not exist. The spike in step 5 can fail, and a tile for an upload with no image carries no information, so the list is then the only view that is still useful. (b) A list shows more names per screen and is quicker to scan by name. (c) It copes better with a narrow popup. **I have no evidence that users prefer either view.** Roomle (**O**) showed thumbnail grids only and I saw no list view there; Planner 5D is **U**. The validation plan (`docs/usability-research-report.md` §7) has a probe for it.
     - **Control:** a two-button segmented control in the popup header, next to search: **Thumbnails** · **List**. Reuse `.segmented.cols-2` with `role="radiogroup"` and `aria-checked`, as the Workspace toggle does. Text labels are required (icons optional). Keyboard operable.
     - **One data path, one DOM.** Both views are the same `listbox` of `option` elements; `data-view="grid|list"` on the popup switches the layout in CSS. A list row is one line: a small image or swatch (32 to 40 px is a suggestion), the name, then `sublabel`. **Rows without an image render as text only**, with no placeholder box. Selection, search and group tabs behave identically in both views.
     - **The list view is the zero-image path.** It **does not trigger new thumbnail renders** and shows cached images only. It therefore works if the thumbnail spike fails, and costs nothing.
     - **Remembered choice:** per picker kind (`viewKey`: `product`, `material`), stored in `localStorage` under `catalog3d.pickerView.<kind>`, **inside try/catch**. The app already tolerates blocked storage; if it is blocked, keep the choice in memory for the session. Defaults (**unvalidated**, DT8): thumbnails; **list when no item in the picker has an image or swatch**, until the user chooses.
     - The trigger button looks the same in both views.
  3. **Select sync (important).**
     - Picking a tile does `select.value = id; select.dispatchEvent(new Event('change', { bubbles: true }))`. The existing `productSelect` change handler (`main.ts:~1644`) then runs unchanged.
     - **Setting `.value` in code does not fire `change`.** Call `picker.sync()` wherever code changes the select: `refreshProductSelect` (after every upload and at boot), and anything else that assigns `productSelect.value`. `grep -n "productSelect" src/main.ts`.
     - The native `<select id="product-select">` **stays rendered**: visually hidden (the usual clip pattern), `aria-hidden="true"`, `tabindex="-1"`. **Not `hidden`, not `display:none`**: `selectOption('#product-select', …)` is called 8 times across 6 specs, including `viewer.spec.ts:87`. Playwright must still find it visible.
  4. **Tile data rules (no inventing).** Tile = thumbnail + `product.name`; `sublabel` = *your upload* when `product.userAdded` (deck §3.4). **No maker line, category, SKU or price.** None exist in the data. If `thumbUrl` is missing, show a neutral placeholder tile; never fabricate an image.
  5. **Thumbnails: spike first, then decide.** Default design:
     - New `src/viewer/thumbnails.ts`. **One** lazily created offscreen `WebGLRenderer` (`alpha`, `preserveDrawingBuffer: true`) at a small fixed size (about 192 px is a suggestion), a simple light rig, a perspective camera framed from a three-quarter angle with `Box3`. `render(product): Promise<string>` returns a blob or data URL.
     - Load the root the same way `loadPlacementRoot` does (`main.ts:~900`), including `mjs-module` products via `getModuleFactory`. **Apply the product's default finish with UX-16's `applySlotBindings`** (a flat grey thumbnail for a "Natural oak" product would be misleading). **Skip library bindings when `product.preserveMaterials`.**
     - **Serial queue, one at a time, lazy:** render on first open of the popup **in the thumbnail view** and when a product is added. Cache by `product.id`; invalidate when the product's own materials change. **Dispose** every temporary geometry, material and texture after each render. Dispose the renderer with the viewer lifecycle (`#btn-remount` and `import.meta.hot.dispose` already exercise disposal).
     - **Never gate `body[data-viewer-status=ready]` on thumbnails.** Tiles show the placeholder until the image arrives.
     - Add optional `thumbnailUrl?: string` to `Product` (`types.ts`). When present it **wins** over rendering (lets a build script or conversion farm supply images later). **No such pipeline is defined**; the nearest open item is `ASSUMPTIONS.md` U10 (texture and CDN targets).
     - **Unknowns to resolve in the spike:** whether a second WebGL context is acceptable alongside the viewer's (browsers limit live contexts; the limit here is **Unknown**), render time under SwiftShader (tests), and memory with many products. **If the spike fails, ship placeholder tiles plus the `thumbnailUrl` field and say so in the completion doc.**
  6. **Where it mounts.** Sibling UX-07: first card of the Product group. Sibling UX-08 step 3: the single picker is re-parented into the Room "Place products" step. **Re-parent the whole picker element (trigger + hidden select), not just the select**, so there is one instance and `selectOption` keeps working in both workspaces.
  7. **Words.** Trigger label: *Product*. New strings (deck voice, in `src/copy.ts`): search placeholder *Search products*, empty result *No products match.*, close label *Close*, view toggle *Thumbnails* and *List* (group label *View*). No instruction paragraphs. *Your upload* already exists in the deck.
- **Done when:**
  - Product workspace: one trigger with thumbnail and name; opening it shows a tile grid; picking *Side table (demo)* changes the turntable and the Materials card (2 slots).
  - Keyboard only: open, arrow to a tile, Enter selects, Esc closes, focus returns to the trigger.
  - **List** shows one row per item and selecting works the same. The choice survives a reload. With `localStorage` blocked (make `setItem` throw before load) nothing throws and the choice holds for the session.
  - The list view starts no thumbnail render (watch the queue).
  - After adding a model, the new product appears in the grid with *your upload* and a thumbnail or placeholder.
  - No horizontal scroll at 375 px; the popup is not clipped by the panel.
  - **No existing spec needs a selector change** because of this item.
- **Tests:** unit tests for pure helpers (item building, filtering, group derivation). E2E: open, pick a tile, assert `#product-select` value and `.slot` count; keyboard path; programmatic `.value` followed by `sync()` updates the trigger; toggle to List and back; the choice persists across reload; blocked storage does not throw.

### UX-15 🟡 M: Texture options as thumbnails

- **Evidence:** UR7. Wall and floor are `<select>`s with 14 text options each (`populateMaterialSelects`, `main.ts:278`). The Add-texture target is another text select (`refreshTextureTargetOptions`, `:1311`). Slot swatches are 34 px circles with the name only in a tooltip (`renderSlots`, `:1002`).
- **Do:**
  1. **Pickers on the long text selects.** Instances of the UX-14 component on `#room-wall-material`, `#room-floor-material` and `#texture-target`. Items from `library.materials`; wall and floor also get a first *Default* item with value `''`. `swatch = { color, map }`, rendered as CSS exactly as `renderSlots` does (`:1024-1025`); **no WebGL needed here**. `group = category`: five exist today (wood, plastic, textile, stone, metal), so group tabs appear. Session textures use Object URLs, which work in CSS.
  2. **Sync points.** `populateMaterialSelects` (`:278`), `syncMaterialSelectsFromGraph` (`:~295`, sets `.value` in code) and `refreshTextureTargetOptions` (`:1311`). New textures appear in every picker after "Add to library" (`:1602-1603`).
  3. **Existing handlers still fire.** `onRoomMaterialChange` listens for `change` on both shell selects (`:1735-1736`). The picker dispatches `change`. **Verify.**
  4. **Keep the native selects' options intact.** `missing-features.spec.ts:57-59` counts `#room-wall-material option` and calls `selectOption({ index: 1 })`.
  5. **`#texture-target` lives in `#texture-target-wrap`**, which is shown or hidden by map role. Keep the picker inside that wrapper. `#texture-category` (5 options) and `#texture-role` (3) stay native.
  6. **Slot swatches stay inline, but labelled.** In `renderSlots`, keep `button.swatch` with `data-material`, `aria-pressed`, the background and the click behaviour (including the `preserveMaterials` warning). Add a **visible one-line name** under each swatch (the tooltip keeps `Natural oak (STUB-MAT-WOOD-OAK)`, deck §3.4), and make the tile ≥ 44 px on coarse pointers.
     - **Why not a dropdown here:** `viewer.spec.ts:54,56,90` click `.slot[...] .swatch[data-material=...]` with nothing opened first. A closed dropdown would break the only e2e spec that is safe to run in place, and each slot has only 3 to 6 options today (§2). **Revisit when the library outgrows a row** (DT2).
  7. **The list view applies to these pickers too** (UX-14 step 2b, `viewKey: 'material'`). A list row is a small swatch chip plus the name. Materials are visual by nature, so **thumbnails stay the default** here; the "list when nothing has an image" rule never fires for materials, because every material has a `color` (`types.ts`). **Slot swatches are not affected by the toggle.**
- **Done when:** wall and floor open a tile grid with swatches, names and category tabs (or one-line rows in the List view); picking one changes the room's material through the existing handler; the native selects still have 14 options; slot swatches show names; `viewer.spec.ts` passes unedited.
- **Tests:** e2e: pick a wall material through the picker and read `__rv.roomGraph()`; unit tests for item building.

### UX-16 🔴 M–L: Make the chosen finish real in the room (replaces UX-10's "Do")

- **Evidence (M):** §2 "Finish test", and UR8 in the report. Two separate defects:
  1. `placeCurrentProduct` (`main.ts:~850-905`) stores `slot_bindings[s.id] = s.default` (`:876-877`), ignoring the current choices.
  2. **Nothing applies library materials to a placed root.** `loadPlacementRoot` (`:~900`) returns a fresh GLB clone with its embedded placeholder materials; `attachPlacement` (`RoomVibezViewer.ts:456`) doesn't touch materials; `reloadAllPlacements` (`:~911`) ignores `pl.slot_bindings`. Even the *default* finish is not what you see.
  - The design docs say a placement carries `slot_bindings` (`docs/room-from-scratch-feasibility.md:126,165`). `updatePlacement` (`roomGraph.ts:467`) exists and is exported (`viewer/index.ts:80`) but `main.ts` never calls it.
- **Do:**
  1. **Engine.** Add to `RoomVibezViewer` a method such as `async applySlotBindings(root: Object3D, product: Product, bindings: Record<string, string>): Promise<void>`. Reuse:
     - `discoverSlots(root, product.sidecar)` and `bindUntaggedToFallback(found, product.fallbackSlotId)` from `slots.ts` (same as `bindSlots`, `:531`);
     - the private `createMaterial(def)` (`:591`) and the shared texture cache, so repeated placements don't reload textures.
     - **Don't** reuse `this.slotMeshes` / `this.slotState`; they belong to the turntable.
     - Only touch slot ids defined in `product.slots`. Respect `allowedCategories` as `setSlotMaterial` does (`:284`). **Skip entirely when `product.preserveMaterials`.** An unknown or disallowed material **keeps the default for that slot and logs a warning**; it must not throw, because a bad saved binding must never block placing.
     - Dispose each replaced placeholder material once. Copy the shared-material care from `applyMaterial` (`:558-590`): GLB materials are often shared across meshes.
     - Extract a small **pure** helper (for example `resolveBindings(product, requested)`) that fills defaults and drops invalid entries, so it can be unit-tested.
     - Call it from `attachPlacement` through an optional parameter, or `await` it in the host before attaching. Pick one and keep it consistent.
  2. **Host.** In `placeCurrentProduct`, build `slot_bindings` from the current choices: `viewer.getSlots()` mapped to `def.id → materialId` (the shape the remount handler reads, `main.ts:~1797`). `currentProduct` is the product being placed, so this is the right source. Pass them to the engine method before attaching. In `reloadAllPlacements`, pass `pl.slot_bindings`.
  3. **UI: choose a finish while furnishing.** Once UX-07 hides the Materials card in the Room workspace, there is no way to choose a finish without switching workspace and back (UR10, **predicted, not observed**). Show the **Materials** card (`#slots`, `#slot-warnings`) in the Room "Place products" step, under the picker. **One instance only** (re-parent it, or place it with CSS `order` if you split cards). Heading per the deck (*Materials*). One short state line (new string): *Applies to the next product you place.* In Room, a swatch change affects the **next** placement (and the hidden turntable), not products already placed, until 16b.
  4. **16b (optional; needs sibling UX-09's selection).** With a placed product selected, show its slot choices with the same swatch tiles, bound to that placement: `updatePlacement(graph, id, { slot_bindings })`, then `applySlotBindings` on that root, then `applyRoomGraph(..., history commit)` so Undo works. Pattern: Planner 5D's context toolbar **Style** (D), Roomle's "select any item … configuration" (D). **If UX-09 hasn't landed, skip and say so.**
- **Persist only the existing `slot_bindings` field.** Don't invent a BOM or variant schema (stress test A8; `ASSUMPTIONS.md` U9, U13). The sibling's D3 stands.
- **Known gap, don't fix silently:** placements of session-uploaded products vanish after a refresh, because `reloadAllPlacements` skips products missing from the catalog while the list still shows the entry (sibling UX-09 note; copy handoff §6C).
- **Done when:**
  - Frame = Walnut, then place the chair: `slot_bindings.frame === 'wood-walnut'`, and every frame-slot mesh of the placed root has `material.userData.libraryId === 'wood-walnut'`.
  - A default placement is visibly the **oak** finish, not flat grey `#e7e7e7`.
  - Reload the page: the placement comes back with the same finish.
  - A pack or `preserveMaterials` product keeps its own materials.
  - Undo and redo of placements are unaffected. Existing unit tests pass unedited.
- **Tests:** e2e "finish carries into the room" and "finish survives reload"; a unit test for `resolveBindings`.

### Additions to sibling items

**A1. Guard for UX-08 step 5.** The persistent toolbar (Undo, Redo, Export project, **Import project**) must show **only when `body[data-workspace='room']` and a room exists**. A room can exist while Product is active (the graph is restored on cold boot with `activate: false`; see `mountViewer`). Import project is an upload, which Adrian wants in Room only. If any part of the toolbar sits in the stage, scope it with the same body attribute.

**A2. Make the rule testable (extend UX-07's "Done when").** Paste in the console in each workspace. Both blocks must print `[]`.
```js
// Returns the ids that are still rendered. A missing element is not listed.
const gone = ids => ids.filter(id => { const el = document.getElementById(id); return el && el.offsetParent !== null; });
// Product workspace: room creation and room uploads must not be rendered
document.body.dataset.workspace === 'catalog' && gone(['btn-create-room','room-preset','plan-file','btn-import-plan',
  'btn-import-fixture','project-file','btn-import-project','btn-export-project','btn-clear-room','btn-draw-wall-mode',
  'btn-opening-mode','btn-place-mode','room-wall-material']);
// Room workspace: product uploads must not be rendered
document.body.dataset.workspace === 'room' && gone(['model-files','pack-files','module-file','texture-file']);
```
(`#project-file` is `hidden` and currently still renders because of `.file-input { display:block }`; sibling UX-02 fixes that.) `#room-wall-material` is in the Product list because its picker lives in the Room group.

**A3. UX-06 empty-state card.** Its three start choices mirror the app's three ingress paths and Planner 5D's documented starts (template, blank canvas, upload a plan; **D**, marketing page). No change. It is supporting evidence.

---

## 5. Decisions: implement the default, flag it, don't pretend it's settled

| ID | Question | Default | Cost to reverse |
|---|---|---|---|
| **DT1** | "Room creation or upload": does *upload* mean room files only? | **Yes. Confirmed by Adrian (2026-10-05):** room files, plans and sketches for rooms only. Product uploads (model, pack, module, texture) stay in Product (sibling UX-07). | Move one attribute. |
| **DT2** | "thumbnail drop-down with texture options": which lists? | **Confirmed by Adrian (2026-10-05).** Picker for the object catalog **and** wall, floor and texture-target. **Slot swatches stay inline, labelled.** | If Adrian later wants a dropdown for slots too, `viewer.spec.ts:54,56,90` each need an "open the picker" step first. |
| **DT3** | Popup style: anchored popup, or a full-screen overlay like Roomle's? | **Anchored popup** (sheet at ≤ 860 px). | Revisit when products have categories or fill more than a screen. |
| **DT4** | When does search appear? | **When the list is long.** I did not pick a number; choose one, record it, and mark it unvalidated. | None. |
| **DT5** | Thumbnail source | **Runtime offscreen render** (spike), with `thumbnailUrl` override and a placeholder fallback. | Replace with pre-rendered images when a pipeline exists. |
| **DT6** | Materials card in the Room step | **Yes** (UX-16 step 3). | Remove the card from the step. |
| **DT7** | Deferred patterns (§3) | Not done. | — |
| **DT8** | Thumbnails or list? (Adrian asked to consider switching, "for ease of use under more use cases") | **Both, with a toggle** (UX-14 step 2b). Default thumbnails; list when nothing in the picker has an image. Remembered per picker kind. **Unvalidated:** there is no data on which view users prefer, and the report §7 has a probe for it. | Remove the toggle. The two views share one DOM, so it costs one control. |

---

## 6. Test contract (what this work touches)

**Keep all ids** (sibling §3). The `$()` helper is `document.getElementById(id) as T` with no null check, so a removed id throws at boot. Moving elements is fine.

| Pinned by tests | How these items respect it |
|---|---|
| `#product-select` via `selectOption` (`viewer.spec.ts:87`, `missing-features.spec.ts:68`, `dwg-plan-import.spec.ts:69`, `model-display.spec.ts:105,114`, `room-from-scratch.spec.ts:80,93,113`) | Stays rendered (visually hidden), value-synced, in both workspaces |
| `#room-wall-material option` count and `selectOption({index:1})` (`missing-features.spec.ts:57-59`) | Native select keeps all options |
| `.slot[data-slot=…] .swatch[data-material=…]` click, `.slot` count (`viewer.spec.ts:31,54,56,89,90`; `room-from-scratch.spec.ts:115`) | Slot swatches stay inline buttons |
| `#model-files` visible and `accept` (`room-from-scratch.spec.ts:24,118`; `dwg-plan-import.spec.ts:33`) | Unchanged (sibling keeps it visible) |
| `body[data-viewer-status=ready]` | Not gated on thumbnails |

**Spec edits for segmentation** (`room-from-scratch.spec.ts:27-28`, `room-floor-extent.spec.ts:29-30`, `dwg-plan-import.spec.ts:36-40`, which use Room controls without switching workspace): **owned by the sibling's §3.** Not repeated. Those three are my prediction from reading the specs; **no one has run them against a hidden-workspace build.**

**This work should need no other spec edits.** If one fails, fix the host, not the test.

---

## 7. Verification

**Always:** `npm run typecheck`, `npm test` (same count as your baseline; **unit tests must not need edits**), `npx playwright test viewer.spec.ts`, and scratch-copy runs of the others (sibling §1, §6).

**In a browser, at 1440×900 and 375×812.** Save screenshots to `media/ux-fix/` (the sibling's folder):
- Product workspace with the picker open.
- Room "Place products" step with the picker open and the Materials card visible.
- Wall-material picker open.
- A walnut chair placed in the room and visible in 3D.

**Checks to run**
1. **A2** DOM script in both workspaces (both print `[]`).
2. **Picker:** keyboard path; set `#product-select` programmatically then `sync()`; add a model and see it listed with *your upload*; open with 30 duplicated test products and **record** how long the first open takes (no threshold is set; the number is the result).
   - **List view:** toggle both pickers; reload and confirm the choice is remembered; make `localStorage.setItem` throw before load and confirm no error; confirm the list view starts no thumbnail render; open a 30-item list at 375 px width.
3. **Finish:** the §2 test, now expecting `wood-walnut` in both bindings and meshes; then reload and re-check.
4. **WebGL contexts:** exactly one thumbnail renderer plus the viewer's.
5. **Remount:** click `#btn-remount` (it disposes and recreates the viewer); the picker, thumbnails and Materials card still work.
6. Re-run the copy handoff's vocabulary grep (copy §8) after everything lands.

**Not verified by the author (don't assume it works):** the native `popover` attribute in the project's Chrome; a second WebGL context alongside the viewer; screen-reader behaviour of the picker; Safari and Firefox; real-GPU rendering; how the placed chair looks under a real pointer click; **which view (thumbnails or list) users prefer** (no data).

---

## 8. Deliver

1. The code changes for the items you took.
2. **No second completion doc.** Add a section "Catalog picker and finishes" to the **one** completion doc the sibling asks for (`docs/ux-fix.md`; sibling §8). In it: which of UX-14, UX-15, UX-16 (and 16b) you took and which defaults (§5) you took; the spike result for thumbnails; before and after of the §2 numbers; test results (counts, which specs you ran and how); links to `media/ux-fix/`; open items.
3. List **every string you wrote that is not in the deck** (candidates: *Search products*, *No products match.*, *Close*, *Applies to the next product you place.*, *Thumbnails*, *List*, *View*, plus the aria labels).
4. `History/`: append only, in its existing format, and tell Adrian.
5. **Not yours:** running the usability test (`docs/usability-research-report.md` §7 needs people).

### Out of scope

New product data (categories, makers, prices, SKUs), real DWG parsing, a BOM or variant schema, moving or rotating placed products beyond the sibling's UX-09, door and window thumbnails, a stage-level 2D view, favorites, and anything in the deferred list (§3).
