# Catalog 3D

Owned **Three.js** catalog furniture viewer: load a GLB, spin it on a turntable, swap library materials per `material_slot_id`, switch scene light presets, and watch a stub parts list update. This is the **Catalog placer / 3D Viewer** box of the Room Vibez core architecture.

**Room workspace (MVP):** three create paths share one owned **room graph JSON** (session + `localStorage`); meshes are derived via Shape holes + `ExtrudeGeometry` — DWG is never Three.js SoT.

1. **From scratch** — rectangular room (presets + custom L×W×ceiling), door/window cutouts, place Catalog 3D GLBs. See `../docs/room-from-scratch-feasibility.md`.
2. **Import plan** — upload DWG/DXF (SourceAsset) or candidates JSON → review candidates → confirm → immediate room **or** save as template. ODA/APS unavailable on this machine → labeled **mock fixture extract** (not AutoCAD-class parsing). See `../docs/dwg-plan-import-room-feasibility.md` + `../docs/dwg-plan-import-mvp-build.md`.
3. **From template** — instantiate a saved room-graph seed (local Template CMS).

## Run

Requires Node 18+ (tested with Node 22.23.2 from `~/.nvm`; if `node` is not on your PATH, run `export PATH=~/.nvm/versions/node/v22.23.2/bin:$PATH`).

```bash
npm install
npm run dev          # → http://127.0.0.1:18777/
```

Other scripts:

| Script | What it does |
|---|---|
| `npm run assets` | Regenerates the demo GLBs and textures (stand-in for the conversion farm). Outputs are committed, so this is optional. |
| `npm run farm` | Local farm job queue stub (`scripts/farm-job.mjs`) — not a server farm. |
| `npm run stub-mjs` | Emit thin Room Vibez stub `.mjs` from sidecar JSON. |
| `npm run bake-color0` | Partial COLOR_0 bake metadata into GLB extras (viewer runtime split remains default). |
| `npm test` | Vitest unit tests: slots, packs, room graph/history/collision/plan/underlay, uploads, modules. |
| `npm run test:e2e` | Playwright smoke on local Google Chrome (catalog + room + DWG mock). Screenshots → `tests/e2e/screenshots/`. |
| `npm run build` | Type-check plus production build to `dist/`. |

## Turntable

Drag horizontally on the canvas to **spin the product** (yaw around Y). The camera stays fixed for rotate — OrbitControls rotate is off; scroll zoom and right-drag / two-finger pan still work. The model sits under a scene `turntable` `Object3D`; lights and `RoomEnvironment` IBL stay on the scene (never parented under the turntable), so lighting does not spin with the product. **Reset camera** also zeroes turntable yaw.

## What you can do in the UI

- **Workspace:** Catalog (turntable product) ↔ Room (orbit the shell).
- **Room workspace:** ingress tabs From scratch / Import plan / From template · units m/cm/ft-in · scratch presets + openings (procedural door/window placeholders, not catalog SKUs) · wall/floor materials from local library · undo/redo · orthogonal freeform walls · wall-snap + soft collision warn · 2D plan polish + PNG download · JPG/PNG underlay confirm · DWG/DXF mock/JSON import · local templates · export/import project JSON + IndexedDB · place Catalog GLBs on the floor · room graph JSON inspector. DWG furniture blocks ignored.
- **Product:** *Lounge chair* (3 slots: frame / handles / pillow, tagged via glTF `extras`) or *Side table* (2 slots: top / legs, tagged via node names).
- **Add 3D model:** upload `.glb` (preferred), multi-file `.gltf` + companions, or an **OBJ package** (`.obj` + `.mtl` + texture maps + optional `.slots.json`). The model is **added** to the product dropdown (demos stay). GLB/glTF slots come from `extras.material_slot_id` / node-name `slot_<id>`; OBJ slots come from `usemtl` / object names (+ sidecar). Untagged meshes bind to a fallback `surface` slot. OBJ is converted in-session to a GLB-equivalent blob and MTL finishes become session library materials (best-effort PBR) so the same slot swatches apply — **not** Polyfork `createAsset` MJS codegen. Session **Object URLs** only — refresh clears them.
- **Load pack (.mjs + .glb):** multi-select a Polyfork-style pair (same basename) or attach a pack-mate GLB then the `.mjs`. **Preferred:** GLB on the turntable; MJS as params / materials / presets source. **Primary:** COLOR_0 zones matching MJS `materials` / color keys are **split into real `material_slot` meshes** so library swatches and colorways target each zone. **Fallback:** COLOR_0 vertex remap (UI-labelled) only if split finds no matching faces. Missing GLB → `createAsset()` fallback + “pack incomplete”. Keys with no faces (e.g. `ink` on closed book) stay **Unknown**. Geometry params rebuild via `createAsset()`.
- **Load module (.mjs only):** same as incomplete pack. Routes to pack flow when a pack-mate GLB is pending.
- **Material slots:** swatches are filtered by the slot's allowed categories from the catalog. Each slot changes independently. Uploaded models allow all categories so any library material (including user textures) can apply. Pack products with split/mapped slots accept library swatches; COLOR_0-remap fallback keeps embedded materials display-only.
- **Add texture:** upload PNG / JPEG / WebP into the materials library. **baseColor** creates a new library material; **normal** / **roughness** attach to a chosen existing material. Then apply via slot swatches (materials remain SoR — not embedded in the mesh). Library textures remain usable as overrides where they do not fight an MJS pack (`preserveMaterials`).
- **Light preset:** Studio soft · Warm interior · Neutral (no IBL).
- **Parts list:** a JSON payload emitted on every change (Rubens-like `onPartListUpdate`), also dispatched as a `rv:partlistupdate` window event. It is a stub: STUB SKUs, no prices.
- **Dispose & remount:** tears down the engine completely and rebuilds it, keeping your choices (SPA lifecycle demo).

## Uploaded GLBs — why materials looked wrong (and what we fixed)

**Root cause (evidence):** the `surface` fallback *did* bind every untagged mesh and assign one library `MeshStandardMaterial` to all of them. What failed visually on typical raw DCC uploads was geometry quality, not slot wiring:

1. **Missing normals** — many exports omit `NORMAL`. The engine swaps the GLB placeholder for `MeshStandardMaterial` (library SoR). Without normals that material lights as flat/black, so a swatch change looks like “texture didn’t apply.” **Fix:** `ensureMeshNormals()` runs on every `loadProduct` and computes vertex normals when absent; the UI warns which meshes were fixed.
2. **Missing UVs** — without `TEXCOORD_0`, baseColor maps cannot display (solid tint only). **Fix:** UI warns `Meshes without UVs…`. Re-export with UVs from the DCC tool; we do not invent UVs.
3. **Shared GLB materials + `dispose()`** — uploads often share one embedded material across meshes. The old apply loop disposed that instance on the first mesh (and would throw on `Material[]`). **Fix:** assign first, dispose each unique placeholder once only if nothing still references it; handle material arrays.
4. **Misleading `via sidecar` label** on upload fallback — cosmetic; now reported as `fallback`.

**Not a bug (by design):** one `surface` slot for untagged uploads means the whole model shares one library material. Independent parts need conversion-farm tags.

### What your GLB needs for multi-slot materials

| Goal | Asset requirement |
|---|---|
| Whole-model material swap | Any mesh GLB (untagged → `surface`) + **normals** + **UVs** if you use textured library materials |
| Per-part materials (frame / legs / …) | Each mesh or ancestor tagged with glTF `extras.material_slot_id`, **or** node name `slot_<id>` / `slot_<id>__<part>` |
| Textured library swatches look correct | `TEXCOORD_0` UVs on those meshes |

Demos: lounge chair uses `extras`; side table uses `slot_top__…` / `slot_legs__…` names.

### OBJ package upload (hackathon slice)

| Input | Behavior |
|---|---|
| `.obj` + optional `.mtl` + maps | Parse with Three.js OBJ/MTL loaders → tag slots from `usemtl` / `o` names → export session GLB → same turntable + library swatches |
| `*.slots.json` | Optional map of mesh/MTL name → `material_slot_id` (overrides slugified names) |
| Missing MTL / textures / UVs | Geometry still loads when possible; UI status + slot warnings (no invented UVs) |
| Empty / invalid OBJ | Clear error in upload status; demos unchanged |

Fixture for tests: `tests/fixtures/obj-stool/` (`stool.obj` + `stool.mtl` + `wood.png` + `stool.slots.json` → slots `top` / `legs`).

## Module contract (.mjs) and GLB+MJS packs

`.mjs` is **JavaScript (ES modules)**, not GLB/OBJ. Full write-ups:
- `../docs/mjs-loading-in-hackathon-viewer.md`
- `../docs/glb-mjs-pack-conversion-approach.md` (automated pack pipeline)

**Accepted exports** (from the real Polyfork sample on Desktop, not invented):

1. `export function createAsset(params?) { return /* THREE.Object3D */; }` (preferred)
2. `export default` that same function, or a ready `Object3D`
3. Also observed on the sample (used by the pack UI when present): `params`, `presets`, `materials`, `rig`, `view`, `decals`, …

Otherwise the UI errors and lists export keys. Bare `three` / `three/addons/` imports are rewritten to this app’s Vite-served `node_modules` URLs before `import()`.

### Pack workflow (Chong: GLB + MJS are connected)

| Step | Behavior |
|---|---|
| Multi-select `name.mjs` + `name.glb` | Associated by basename; GLB loads into the turntable |
| Pack-mate GLB input | Second upload pairs with the next `.mjs` |
| MJS only | `createAsset()` mesh + status **pack incomplete** |
| Materials | From MJS `params` / `presets` / `materials` onto GLB: existing slots/`slot_*`/mesh-name match → slot materials; else **COLOR_0 zone split** into `material_slot` meshes (SoR); else COLOR_0 remap **fallback**; else **Unknown** (no invented slot ids) |
| Param changes | Colorways update per-slot materials when split/mapped; geometry params rebuild via `createAsset()` |

**Smoke pair:** `Room Vibez/models/core-rulebook-4aedc7.mjs` + `.glb` — GLB nodes `book` / `cover-board`, COLOR_0 emerald zones → split slots `cover`, `gold`, `gilt`, `paper`, `ribbon` (`ink` Unknown on closed snapshot). Mapping mode = `slots` (`mjs-pack-color0-split`).

**Security:** loading `.mjs` executes the file in the page. Trusted local files only.
## Layout

```text
src/viewer/            engine (owns the canvas) — import only from src/viewer/index.ts
  RoomVibezViewer.ts   init / loadProduct / setSlotMaterial / setLightPreset / room modes / dispose
  slots.ts             material_slot_id resolution (extras → sidecar → name convention)
  library.ts           library filtering, catalog validation, parts list
  uploads.ts           session GLB/glTF/OBJ + texture → Product / LibraryMaterial helpers
  objImport.ts         OBJ(+MTL/maps/sidecar) → session GLB + slots from usemtl
  modules.ts           opt-in .mjs createAsset() import + contract resolution
  mjsGuardrails.ts     confirm + static scan (not a sandbox)
  packs.ts             GLB+MJS pack association, params/presets/materials, COLOR_0 split + color apply
  splitZones.ts        COLOR_0 → per-zone material_slot mesh splitter
  roomGraph.ts         owned room graph SoT + localStorage
  roomMesh.ts          Shape holes + ExtrudeGeometry + opening placeholders
  roomHistory.ts       undo/redo snapshots
  roomCollision.ts     soft-overlap warn
  roomSnap.ts          wall-snap placements
  roomPlan.ts          2D plan SVG polish
  freeformWalls.ts     orthogonal pencil → one closed room
  planUnderlay.ts      JPG/PNG underlay + human confirm
  dwgImport.ts         DWG/DXF mock extract + candidates confirm
  roomTemplates.ts     local Template CMS
  projectIO.ts         export/import JSON + IndexedDB
  presets.ts           light presets (scene-level, never in the GLB)
  types.ts             data contracts mirroring the owned DB tables
src/main.ts            host UI (Polaris-like), talks to the engine via the public API only
public/assets/models   demo GLBs (pre-baked)
public/assets/library  materials.json (materials DB stand-in), catalog.json (SKU + slot definitions stand-in)
public/assets/textures baseColor PNGs
scripts/build-assets.mjs  pre-bake script (conversion-farm stub)
scripts/farm-job.mjs / emit-stub-mjs.mjs / bake-color0.mjs  local farm partials
tests/unit, tests/e2e
```

## How this maps to Room Vibez core architecture

| Core IA box | In this prototype |
|---|---|
| Auth · projects · commerce · BOM/SKU UI | Stub: parts-list panel + `onPartListUpdate` callback. No pricing or ERP. |
| Room editor (Three.js) | **MVP built** — from scratch / import plan (DWG mock + JPG/PNG underlay) / templates → owned room graph; openings with procedural placeholders; place Catalog GLBs; undo/redo; local export/import + IndexedDB. |
| **Catalog placer / 3D Viewer** | **Built** (`src/viewer`). |
| Architect mode (DWG → room graph) | **Mock/JSON + human confirm** (ODA/APS unavailable). DWG is never furniture / never Three.js SoT. |
| Conversion farm | `scripts/build-assets.mjs` demo bake + local `npm run farm` / `bake-color0` / `stub-mjs` stubs (not a server farm). |
| DBs: SKU · material_slot · materials · presets | `catalog.json`, `materials.json`, `presets.ts`. Session uploads mutate in-memory copies; project JSON/IndexedDB for room graph best-effort. |

Rubens patterns used: the host owns the UI and the engine owns the canvas; a parts-list event for commerce; the Viewer → Configurator → Planner module ladder (this is the Viewer rung). We avoided a vendor WASM kernel, vendor catalog APIs, and materials as SoR inside the mesh.

See **ARCHITECTURE.md** for data flow and slot mechanics, and **ASSUMPTIONS.md** for every assumption and open Unknown (including why AR was not built).

## Known limitations

- Demo models are procedural stand-ins, not real products.
- **Model uploads are session-only** (Object URLs). Room graph: `localStorage` + best-effort IndexedDB / export-import JSON (not cloud projects).
- **No Draco / Meshopt decoder farm** in this prototype — Draco-compressed GLBs may fail unless the browser path already includes decoders.
- **OBJ packages load at runtime** in-browser (`objImport.ts` → session GLB). Not Polyfork MJS codegen; production farm can still replace this.
- **`.mjs` is not a mesh format** — Polyfork-style `createAsset()` + optional pack mate `.glb`. Trusted local only + confirm/static guardrails (not a sandbox). Prefer **Load pack** when both files exist.
- No AR, LODs, texture compression, or CDN. No real ODA/APS DWG extract (mock fixture + banner).
- Quick start on another computer: see `QUICKSTART.md`.
- Headless e2e uses SwiftShader (software WebGL), so the full test takes about 45 s.
