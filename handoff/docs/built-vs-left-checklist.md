# Room Vibez / Catalog 3D — Built vs Left checklist

**Date:** 2026-10-03  
**Rule:** Facts only from existing Desktop `Room Vibez` docs, `History/conversation-log.md`, and `hackathon-3d-viewer` README / ASSUMPTIONS. **Do not invent.** Where docs are silent → **Unknown**.  
**App (do not change for this doc):** `/Users/adrian/Desktop/Room Vibez/hackathon-3d-viewer` · [http://127.0.0.1:18767/](http://127.0.0.1:18767/)

**How to read**

| Checkbox | Meaning |
|---|---|
| `- [x]` | Documented as implemented in the hackathon / local MVP (or research deliverable complete) |
| `- [ ]` | Documented as not built, deferred, Phase 1+, or production gap |
| **Unknown** | Docs do not settle status |

---

## A. Built (hackathon / local MVP)

### A.1 Catalog 3D viewer — furniture turntable

Sources: `hackathon-3d-viewer/README.md`, `ASSUMPTIONS.md`, `docs/mjs-loading-in-hackathon-viewer.md`, `docs/mjs-pack-material-slot-split.md`, `docs/obj-upload-catalog-3d-pipeline.md`, `History/conversation-log.md`

- [x] Owned Three.js catalog viewer (Catalog placer / 3D Viewer IA box)
- [x] Load demo GLBs (lounge chair 3 slots; side table 2 slots)
- [x] Turntable yaw (drag); camera fixed for rotate; zoom/pan; lights/IBL not under turntable; Reset camera zeroes yaw
- [x] Material slots via `extras.material_slot_id` / sidecar / `slot_<id>` names; independent slot swatches; category filter from catalog
- [x] Untagged uploads → fallback `surface` slot; compute missing normals; warn missing UVs; shared-material dispose safety
- [x] Session upload GLB / multi-file glTF + companions (Object URLs; refresh clears)
- [x] Session OBJ package upload (`.obj` + optional `.mtl` + maps + optional `*.slots.json`) → in-browser → session GLB + MTL→session library materials — **not** Polyfork MJS codegen (`obj-upload-catalog-3d-pipeline.md`)
- [x] Add texture PNG/JPEG/WebP → materials library (baseColor new material; normal/roughness attach)
- [x] Light presets: Studio soft · Warm interior · Neutral (no IBL)
- [x] Stub parts list + `onPartListUpdate` / `rv:partlistupdate` (STUB SKUs, no prices)
- [x] Dispose & remount engine (SPA lifecycle demo)
- [x] Load `.mjs` opt-in: Polyfork-style `createAsset()` / default Object3D; bare `three` rewrite; trusted local only
- [x] Load pack `.mjs` + `.glb` (basename / pack-mate): prefer GLB on turntable; MJS params/presets/materials
- [x] COLOR_0 zone → real `material_slot` mesh split (Chong SoR); COLOR_0 remap labeled fallback; zero-face keys stay Unknown (e.g. `ink`)
- [x] Incomplete pack (MJS only) → `createAsset()` + “pack incomplete”
- [x] UI chrome branded **Catalog 3D** (`mjs-pack-material-slot-split.md`)
- [x] Unit tests + Playwright e2e smoke (README scripts)
- [x] Conversion-farm **stub** only: `scripts/build-assets.mjs` pre-bakes demo GLBs (not a server farm)

### A.2 Room workspace (owned room graph)

Sources: `docs/room-from-scratch-mvp-build.md`, `docs/dwg-plan-import-mvp-build.md`, README “Room workspace (MVP)”, `ASSUMPTIONS.md` A19–A25, `History/conversation-log.md`

- [x] Workspace toggle Catalog ↔ Room
- [x] Three ingress tabs: From scratch / Import plan / From template
- [x] From scratch: rectangular room; units m/cm/ft-in; presets Small bedroom 3×3, Living 5×4, Studio 6×4; custom L×W×ceiling + wall thickness (defaults 0.12 m / 2.7 m)
- [x] Openings: Door | Window · click wall · W/H/sill · validate; **empty cutouts** (no door/window SKUs)
- [x] Meshing Approach A: Shape holes + `ExtrudeGeometry`; floor; optional ceiling (hidden by default)
- [x] Place Catalog 3D GLBs on floor (place mode + floor click); Y snap 0
- [x] Room graph JSON SoT (`rooms` / `walls` / `openings` / `placements` / `source_assets` / `provenance`); meshes derived from graph
- [x] Persist session + `localStorage` (`catalog3d.roomGraph`)
- [x] Room graph JSON inspector in UI (README)
- [x] Import plan: upload DWG/DXF as SourceAsset **or** candidates JSON; review accept/reject + SVG overlay + scale confirm
- [x] Human confirm → **same** `RoomGraph` as from-scratch; placements empty; DWG furniture blocks ignored
- [x] Immediate room (“Start editing”) + Save as template / From template instantiate (`catalog3d.roomTemplates`)
- [x] Mock fixture extract when ODA/APS unavailable; banner `ODA available: no` (`dwg-plan-import-mvp-build.md`)

### A.3 Research / analysis done (docs exist; not product code)

Sources: `History/conversation-log.md`, store `docs/`, Desktop `docs/`

- [x] Platform / stack advisory (`platform-stack-research.md`)
- [x] Final supported file formats lock (`final-supported-file-formats.md`)
- [x] Persona / Planner 5D / format-gap plans (`persona-formats-and-planner5d-full-plan.md`, `format-dwg-vs-obj-planner-gap-plan.md`, `obj-engines-planner-ai-qa.md`)
- [x] Rubens-like architecture analysis (`rubens-like-architecture-analysis.md`)
- [x] MJS loading + pack conversion approach + COLOR_0 split docs
- [x] OBJ/DWG → GLB+MJS feasibility (`obj-dwg-auto-glb-mjs-feasibility.md`)
- [x] Room-from-scratch feasibility (`room-from-scratch-feasibility.md`)
- [x] DWG plan import feasibility (`dwg-plan-import-room-feasibility.md`)
- [x] Coohom observation capture (store `docs/coohom-analysis/`; observation-only, not RV spec — `History/conversation-log.md`)

---

## B. Left to build (product / farm / production)

### B.1 Catalog 3D / conversion farm

Sources: `obj-upload-catalog-3d-pipeline.md`, `obj-dwg-auto-glb-mjs-feasibility.md`, `glb-mjs-pack-conversion-approach.md`, `final-supported-file-formats.md`, README Known limitations, `ASSUMPTIONS.md`, `missing-features-deep-analysis.md`

- [ ] Server conversion farm (OBJ±sidecar → validated GLB + slot map + catalog register) — local `npm run farm` job stub only (not a server)
- [ ] Durable catalog persistence (object storage / CDN / catalog DB write) — model Object URLs still session-only; room graph has local JSON/IndexedDB partial
- [ ] Draco / Meshopt / KTX2 / LOD / texture-compression CDN pipeline
- [ ] Production materials / SKU / material_slot DB (beyond `catalog.json` / `materials.json` stand-ins)
- [ ] Real product SKUs and prices (parts list remains stub)
- [ ] Polyfork `createAsset` MJS **codegen from OBJ** — explicitly not possible honestly; do not build as invented
- [x] Thin Room Vibez stub `.mjs` from sidecar — `scripts/emit-stub-mjs.mjs` / `npm run stub-mjs` (owned stub; not Polyfork)
- [x] Farm pre-bake of COLOR_0 zones — **partial** local `scripts/bake-color0.mjs` writes zone-map extras; full mesh split remains viewer runtime (U13 open)
- [x] Untrusted-MJS **guardrails** (confirm + static scan + enable flag) — **not** a production sandbox/iframe CSP
- [ ] Broader mesh ingest farm (FBX, BLEND, …) per formats “Necessary / later”
- [ ] AR (USDZ / AR-ready GLB) — not implemented; U8
- [x] Polyfork params UI beyond colorway — full schema controls (`choice`/`range`/`toggle`/`color` + geometry rebuild) already in `#pack-params`; `describe` help shown

### B.2 Room workspace (beyond Phase 0 MVP)

Sources: `room-from-scratch-mvp-build.md` “Out of scope”, `room-from-scratch-feasibility.md` Phase 1–3, `dwg-plan-import-*`, `missing-features-deep-analysis.md`

- [x] Freeform / pencil walls — **partial**: orthogonal draw → one closed room; multi-room adjacency / shared-wall topology still out
- [x] Door/window **placeholder** meshes in openings (procedural; **not** catalog SKUs — U15 still open)
- [x] Wall/floor materials from **local** materials library on room shell (not production Materials DB)
- [x] Furniture–furniture / furniture–wall collision **soft-warn** (non-blocking; U17 policy still open)
- [x] Wall-snap / docking for placements (toggle)
- [x] Undo/redo for graph ops
- [x] Dedicated 2D plan polish / dimension labels — per-wall dims, door swing / window ticks, scale bar, PNG download
- [ ] DWG/DXF **export** from authored graph — not built; fidelity Unknown (U5)
- [x] Plan PNG share-out from 2D plan (SVG→PNG); print-quality PDF share still out
- [x] JPG / PNG **room ingest** with human confirm → same RoomGraph underlay path; **PDF** blocked without rasterizer (see `missing-features-blocked.md`)
- [ ] AI floor-plan recognition path (optional assist elsewhere; non-goal for scratch/DWG Phase 0)
- [ ] Real ODA Drawings / Architecture SDK entity extract (replace mock fixture)
- [ ] APS Model Derivative / Viewer (optional architect mode — unavailable / not wired)
- [ ] ODA Drawings inWEB / DWG round-trip architect mode (Phase 2 optional)
- [ ] Multi-floor / xrefs / Architecture-object fidelity
- [ ] Project-backend persistence for room graph — server projects still out; **local** durable: `localStorage` + IndexedDB + export/import JSON
- [x] Owned Template CMS **local** enrichments (save-from-scratch, title/tags) — server CMS still out

### B.3 Auth / multi-user / commerce (named in prior docs)

Sources: `platform-stack-research.md` (auth, projects, BOM, commerce), README IA map (“Auth · projects · commerce · BOM/SKU UI | Stub”), `obj-dwg-auto-glb-mjs-feasibility.md` §5.4 persistence gap

- [ ] Auth
- [ ] Projects (server-backed)
- [ ] Commerce / ERP / real BOM pricing
- [ ] Multi-user collaboration — **Unknown** as an explicit product decision; platform research names projects/auth/commerce ownership but not a multi-user realtime design

### B.4 Planner 5D / vendor shells (optional product paths)

Sources: formats + platform + feasibility docs

- [ ] Optional Planner 5D embed shell + exit adapter to owned room graph (mapping Unknown until signed docs)
- [ ] Selective Planner Admin catalogue upload packages
- [ ] Rubens / Roomle runtime dependency — explicitly **not** the chosen path for owned editor (patterns only)

---

## C. Explicitly out of scope / deferred / non-claims

Sources: `ASSUMPTIONS.md` “Explicitly NOT claimed”, MVP build non-goals, formats §3.3, History “Explicit non-claims”

- [ ] Native AutoCAD-class DWG viewing/editing as default consumer Three.js UX
- [ ] DWG as furniture / Catalog 3D packs; DWG as Three.js SoT
- [ ] LibreDWG / DIY DWG as sole production fidelity path
- [ ] Invented open-source “DWG → perfect RoomGraph”
- [ ] Babylon or dual-engine runtime
- [ ] Fake ODA/APS fidelity while mock-only
- [ ] Auto-perfect BIM without human confirm
- [ ] Invented Polyfork commercial asset generator / MJS from OBJ
- [ ] Claiming arbitrary `.mjs` is a mesh format
- [ ] Embedding lights in furniture files as SoR
- [ ] Real secrets / vendor SLAs / invented prices
- [ ] Coohom as Room Vibez product spec (observation only)

---

## D. Open product decisions / Unknowns

Sources: `ASSUMPTIONS.md` U1–U17, feasibility Unknown tables, `glb-mjs-pack-conversion-approach.md` §6, History “Open items”, `notes.md`

| ID / topic | Status |
|---|---|
| U1 Real DCC export quality / named groups | Unknown |
| U2 Production glTF `material_slot_id` extras vs naming only | Unknown |
| U3 ODA vs APS vs hybrid; wait on ODA membership? | Unknown |
| U4 Embed Planner / Rubens long-term vs owned viewer | Sprint assumes owned; long-term Unknown |
| U5 Production poly budgets | Soft target only |
| U8 AR / USDZ pipeline | Not built; how to produce Unknown |
| U9 Final Materials / material_slot / SKU schema | `types.ts` is minimal guess |
| U10 Texture resolution / compression / CDN layout | Unknown |
| U11 Fuller Polyfork params UI vs default `createAsset`; production user `.mjs` policy | Params UI **shipped**; production `.mjs` policy still Open |
| U12 Official Polyfork DCC→`.mjs` exporter / pack schema | Unknown |
| U13 Farm bake COLOR_0 split vs keep runtime split | Open — local bake-extras option + runtime split default |
| U14 Exact wall thickness / ceiling product defaults | Assumed 0.12 / 2.7; not locked |
| U15 Door/window SKUs in openings required? | Procedural placeholders only (not SKUs) |
| U16 Catalog GLB unit/pivot hygiene | Unknown |
| U17 Collision policy | Soft-warn MVP (still soft; not hard-block) |
| DWG export fidelity / exporter choice | Unknown |
| Planner AI JSON → RoomGraph mapping | Unknown until signed |
| APS pricing / Extra Derivatives production fitness | Unknown |
| Ghost-render DWG furniture blocks vs always hide | Unknown |
| Multi-floor / curved-wall tolerance / DWG round-trip must-have | Unknown |
| Client DWG corpus (Architecture objects vs 2D lines) | Unknown |
| Geometry params (`state` / `pages`) in commerce UI vs immutable GLB | Open (pack conversion §6) |
| Legal review for Polyfork `.mjs` in cloud pipeline | Open |
| Long-term slot SoR: extras vs sidecar vs `slot_*` | Open |

---

## E. Quick scan for Chong

| Area | Built (local MVP) | Left (product) |
|---|---|---|
| Catalog turntable + slots + lights + stub BOM | Yes | Real SKUs/prices, CDN, AR |
| GLB / glTF / OBJ session upload | Yes | Durable farm + catalog DB |
| MJS + GLB packs + COLOR_0 split | Yes (+ params UI; confirm/scan guardrails; stub-mjs + partial bake script) | Production MJS sandbox policy; full farm mesh bake; CDN |
| Room from scratch + openings + place furniture | Yes + undo/redo, materials, placeholders, snap, soft-warn, freeform ortho, plan polish | Multi-room topology, opening SKUs, hard collision, DWG export |
| DWG / raster import | Mock/JSON + JPG/PNG underlay confirm → same graph | Real ODA/APS; PDF rasterizer |
| Templates | localStorage CMS (+ save-from-scratch) | Server Template CMS |
| Conversion farm | Bake + local farm-job / stub-mjs / bake-color0 | Server queue + validate + register |
| Persistence | localStorage + IndexedDB + export/import JSON | Auth / cloud projects |
| Auth / projects / commerce | Stub parts list only | Own auth, projects, BOM |

**README (2026-10-03):** IA table + Known limitations updated for room MVP, OBJ runtime, IndexedDB/export, mock DWG. See also `missing-features-deep-analysis.md` / `missing-features-blocked.md`.
