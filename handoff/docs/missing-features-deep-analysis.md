# Missing features — deep analysis

**Date:** 2026-10-03  
**App:** `/Users/adrian/Desktop/Room Vibez/hackathon-3d-viewer` · [http://127.0.0.1:18767/](http://127.0.0.1:18767/) · brand **Catalog 3D**  
**SoT checklist:** `docs/built-vs-left-checklist.md`  
**Rule:** Facts from Desktop docs, History, README, ASSUMPTIONS, and current source. **Unknown** when unsettled. Do not invent product backends or vendor fidelity.

**Cross-check audit:** Project store `internal/hackathon-3d-viewer-feature-gap-audit.md` (code-level gap map).

---

## Legend — Buildability

| Label | Meaning |
|---|---|
| **Build now** | Honest local/MVP implementation possible with existing stack |
| **Partial local MVP** | Useful slice without claiming production completeness |
| **Blocked (need X)** | Cannot ship honestly until X exists |
| **Do not build (non-claim)** | Explicitly out of scope / would fake a claim |
| **Already done** | Checklist still unchecked but code already ships (docs stale) |

---

## C. Non-claims (section C) — do not build

Every item in checklist §C remains a **non-claim**. No implementation work. Brief note only:

| Item | Note |
|---|---|
| Native AutoCAD-class DWG as consumer Three.js UX | Hybrid SourceAsset → confirm → room graph only |
| DWG as furniture / Catalog packs / Three.js SoT | Furniture blocks ignored |
| LibreDWG as sole production fidelity | Not a production path |
| Invented open-source DWG → perfect RoomGraph | Forbidden |
| Babylon / dual-engine | Three.js only |
| Fake ODA/APS fidelity while mock-only | Keep banner `ODA available: no` |
| Auto-perfect BIM without human confirm | Confirm gate mandatory |
| Invented Polyfork MJS from OBJ | OBJ → session GLB + slots only |
| Arbitrary `.mjs` as mesh format | `createAsset` contract only |
| Lights embedded in furniture as SoR | Scene presets SoR |
| Real secrets / vendor SLAs / invented prices | Stub SKUs only |
| Coohom as RV product spec | Observation only |

---

## B.1 Catalog 3D / conversion farm

### B.1.1 Server conversion farm (OBJ±sidecar → validated GLB + slot map + catalog register)

- **Means:** Production queue that ingests meshes, validates, writes CDN GLB + catalog rows. Today only `scripts/build-assets.mjs` procedural bake stub.
- **Dependencies:** Object storage, job runner, catalog DB write path, validator toolchain.
- **Risks:** Claiming “farm” without persistence/register invents architecture.
- **Buildability:** **Partial local MVP** — local job script/queue that improves the bake stub (OBJ→GLB validate steps, COLOR_0 bake option) without a server.
- **Unknown:** Production hosting choice.

### B.1.2 Durable catalog persistence (object storage / CDN / catalog DB)

- **Means:** Uploads survive refresh and multi-user; not Object URLs.
- **Dependencies:** Backend + storage credentials.
- **Risks:** Fake “cloud save” with only `localStorage` misleads.
- **Buildability:** **Partial local MVP** — IndexedDB + export/import JSON for local durability; **Blocked (need object storage + catalog DB)** for true CDN/DB.
- **Unknown:** Final schema (U9).

### B.1.3 Draco / Meshopt / KTX2 / LOD / texture-compression CDN pipeline

- **Means:** Delivery optimization farm stage.
- **Dependencies:** Farm + CDN + decoder hosting policy (U10).
- **Buildability:** **Blocked (need CDN/farm policy + U10 targets)**.
- **Unknown:** Compression targets / layout (U10).

### B.1.4 Production materials / SKU / material_slot DB

- **Means:** Replace `catalog.json` / `materials.json` stand-ins.
- **Dependencies:** Schema lock (U9), backend.
- **Buildability:** **Blocked (need schema + DB)**. Local JSON stand-ins stay.

### B.1.5 Real product SKUs and prices

- **Means:** Parts list leaves stub.
- **Dependencies:** Commerce / ERP / pricing SoR.
- **Buildability:** **Do not build (non-claim)** — inventing prices forbidden. **Blocked (need commerce/ERP)**.

### B.1.6 Polyfork `createAsset` MJS codegen from OBJ

- **Means:** Auto-generate Polyfork-compatible parametric modules from OBJ.
- **Dependencies:** Official Polyfork exporter / partnership (U12) — not evidenced.
- **Buildability:** **Do not build (non-claim)**.

### B.1.7 Thin Room Vibez stub `.mjs` from sidecar

- **Means:** Owned thin wrapper (`params`/`presets`/`materials` + `createAsset` throws “geometry in GLB”) per `glb-mjs-pack-conversion-approach.md` §3.3.
- **Dependencies:** Sidecar JSON shape; pack load path already exists.
- **Risks:** Must not claim Polyfork compatibility.
- **Buildability:** **Build now** (script + optional load).

### B.1.8 Farm pre-bake of COLOR_0 zones into `material_slot_id` meshes

- **Means:** Move runtime `splitVertexColorZones` to bake time (U13 open).
- **Dependencies:** Split logic already in `splitZones.ts`; farm script hook.
- **Buildability:** **Partial local MVP** — local bake script option; viewer may skip runtime split when tagged.
- **Unknown:** Whether production prefers farm bake vs runtime (U13).

### B.1.9 Sandboxed / reviewed MJS for untrusted uploads

- **Means:** Safe execution of arbitrary `.mjs` (today: trusted local only).
- **Dependencies:** Production policy (U11); ideally iframe CSP sandbox or server review.
- **Risks:** Static deny-list is best-effort, not a sandbox.
- **Buildability:** **Partial local MVP** — confirm modal + static pattern guardrails + opt-in flag; **Blocked (need sandbox/policy)** for untrusted production uploads.

### B.1.10 Broader mesh ingest farm (FBX, BLEND, …)

- **Means:** Formats lock “Necessary / later”.
- **Dependencies:** Farm + converters (Assimp / Blender headless).
- **Buildability:** **Blocked (need farm converters + format decision)**.

### B.1.11 AR (USDZ / AR-ready GLB)

- **Means:** Quick Look / Scene Viewer.
- **Dependencies:** USDZ toolchain (U8).
- **Buildability:** **Blocked (need USDZ/AR toolchain)** — **Do not build** without it.

### B.1.12 Polyfork params UI beyond colorway / pack controls

- **Means:** Checklist/notes still open (U11).
- **Code fact:** `renderPackParams` already renders **all** schema params (`choice`/`range`/`toggle`/`color`), including geometry (`state`/`pages`/`bands`/`corners`).
- **Buildability:** **Already done** (mark checklist). **Partial local MVP** polish: show `describe` help text; refresh stale notes.

---

## B.2 Room workspace

### B.2.1 Freeform / pencil walls; multi-room adjacency; shared-wall topology

- **Means:** Beyond rectangular `createRectangularRoom`.
- **Dependencies:** Graph ops for segments + closed polygon; multi-room topology is harder.
- **Risks:** Fake multi-room without shared-wall model.
- **Buildability:** **Partial local MVP** — orthogonal pencil / segment walls for one closed room; multi-room adjacency **Blocked (need topology design)** / later.
- **Unknown:** Curved-wall tolerance product need.

### B.2.2 Door/window catalog SKUs / styled meshes

- **Means:** U15 — cutouts only today.
- **Dependencies:** Catalog SKUs for openings (product decision).
- **Buildability:** **Partial local MVP** — placeholder procedural door/window meshes (not commercial SKUs). Real SKUs **Blocked (need U15 + catalog SKUs)**.

### B.2.3 Wall/floor materials from materials DB on room shell

- **Means:** Apply library materials to shell.
- **Dependencies:** Schema fields + `buildRoomScene(mats)` (API exists but unused) + `setRoomGraph` wiring.
- **Buildability:** **Build now** (local library ids on graph; not production materials DB).

### B.2.4 Furniture–furniture / furniture–wall collision policy

- **Means:** U17 soft overlap MVP today.
- **Dependencies:** AABB helpers; product hard-block policy Unknown.
- **Buildability:** **Partial local MVP** — soft-warn only (non-blocking), honest to U17.

### B.2.5 Wall-snap / docking for placements

- **Means:** Optional later in feasibility.
- **Dependencies:** Wall centerline + outward normal; `rotation_y` on placements.
- **Buildability:** **Build now** (toggle + snap helper).

### B.2.6 Undo/redo for graph ops

- **Means:** Out of scope in Phase 0 MVP note; standard editor need.
- **Dependencies:** Snapshot or command stack around `applyRoomGraph`.
- **Buildability:** **Build now**.

### B.2.7 Dedicated 2D plan polish / dimension labels

- **Means:** Feasibility Phase 1; basic SVG exists (`renderPlanSvg`).
- **Dependencies:** Existing plan SVG + wall lengths.
- **Buildability:** **Partial local MVP** — per-wall dims, door swing / window ticks, scale bar. Interactive CAD plan **Unknown** scope.

### B.2.8 DWG/DXF export from authored graph

- **Means:** Not built; fidelity Unknown (U5 / DWG export Unknown).
- **Dependencies:** Exporter choice + fidelity bar.
- **Buildability:** **Blocked (need exporter choice + fidelity decision)** — **Unknown** fidelity.

### B.2.9 PDF/PNG plan share outs

- **Means:** Formats MVP outputs; not evidenced in hackathon.
- **Dependencies:** Render/export pipeline for share.
- **Buildability:** **Partial local MVP** — download 2D plan SVG/PNG from current plan; print-quality PDF share **Unknown** / later.

### B.2.10 PDF / JPG / PNG room ingest with human confirm

- **Means:** Formats lock MVP; DWG MVP covers DWG/DXF mock + JSON only.
- **Dependencies:** Underlay display; human confirm gate (reuse import pattern). PDF raster needs library or farm.
- **Buildability:** **Partial local MVP** — JPG/PNG underlay + scale + manual confirm into same `RoomGraph`. PDF: **Partial** if `pdfjs` added, else **Blocked (need PDF rasterizer)**.
- **Unknown:** AI assist path (non-goal for Phase 0).

### B.2.11 AI floor-plan recognition

- **Means:** Optional assist elsewhere; non-goal for scratch/DWG Phase 0.
- **Buildability:** **Do not build (non-claim)** for this slice / **Blocked (need AI service + confirm UX)**.

### B.2.12 Real ODA Drawings / Architecture SDK entity extract

- **Means:** Replace mock fixture.
- **Dependencies:** ODA membership / SDK on machine (A24, U3).
- **Buildability:** **Blocked (need ODA SDK + membership)**. Keep mock + banner.

### B.2.13 APS Model Derivative / Viewer

- **Means:** Optional architect mode.
- **Dependencies:** APS credentials / Extra Derivatives fitness Unknown.
- **Buildability:** **Blocked (need APS credentials + product decision)**.

### B.2.14 ODA Drawings inWEB / DWG round-trip architect mode

- **Means:** Phase 2 optional.
- **Buildability:** **Blocked (need ODA inWEB + round-trip product decision)**.

### B.2.15 Multi-floor / xrefs / Architecture-object fidelity

- **Means:** Beyond single-floor MVP.
- **Buildability:** **Blocked (need product scope + extract fidelity)** — **Unknown** must-have.

### B.2.16 Project-backend persistence for room graph

- **Means:** A21 — localStorage only today.
- **Dependencies:** Auth + projects backend.
- **Buildability:** **Partial local MVP** — IndexedDB / export-import; server projects **Blocked (need project backend)**.

### B.2.17 Owned Template CMS beyond localStorage seeds

- **Means:** Real CMS vs `catalog3d.roomTemplates`.
- **Dependencies:** Server CMS for production.
- **Buildability:** **Partial local MVP** — richer local CMS (save-from-scratch, tags, preview SVG polish). Server CMS **Blocked (need backend)**.

---

## B.3 Auth / multi-user / commerce

| Item | Means | Buildability |
|---|---|---|
| Auth | Login / identity | **Blocked (need auth backend)** / **Do not fake** |
| Projects (server-backed) | Multi-device project store | **Blocked (need projects backend)** |
| Commerce / ERP / real BOM pricing | Real prices | **Do not build (non-claim)** / **Blocked (need ERP)** |
| Multi-user collaboration | Realtime co-edit | **Unknown** as product decision; **Blocked (need collab design + backend)** |

---

## B.4 Planner 5D / vendor shells

| Item | Buildability |
|---|---|
| Planner 5D embed + exit adapter | **Blocked (need signed docs / mapping Unknown)** — **Do not fake** |
| Selective Planner Admin catalogue upload | **Blocked (need Planner Admin access + package spec)** |
| Rubens / Roomle runtime dependency | **Do not build (non-claim)** — patterns only |

---

## D. Open product decisions / Unknowns (status only)

Do not “resolve” by inventing. Buildables below treat these as open:

| ID | Status for this work |
|---|---|
| U1 DCC export quality | Unknown — no change |
| U2 extras vs naming SoR | Open — keep all three resolution paths |
| U3 ODA vs APS | Unknown — keep mock |
| U4 Planner/Rubens long-term | Sprint = owned; long-term Unknown |
| U5 Production poly budgets | Soft target only |
| U8 AR/USDZ | Not built; blocked |
| U9 Final materials/SKU schema | Minimal `types.ts` guess; room material ids are local extension |
| U10 Texture CDN | Unknown — blocked |
| U11 Fuller params UI / user `.mjs` policy | Params UI **already done**; user `.mjs` policy still Open — guardrails partial |
| U12 Official Polyfork exporter | Unknown — no codegen |
| U13 Farm vs runtime COLOR_0 split | Open — offer local bake option; keep runtime default |
| U14 Wall/ceiling defaults | Keep 0.12 / 2.7 |
| U15 Door/window SKUs required? | Placeholders only (not SKUs) |
| U16 Catalog unit/pivot hygiene | Unknown — keep AABB floor snap |
| U17 Collision policy | Soft-warn MVP (still soft) |
| DWG export fidelity | Unknown — do not build exporter |
| Planner AI → RoomGraph | Unknown — do not build |
| APS pricing fitness | Unknown |
| Ghost-render DWG furniture blocks | Unknown — keep ignore |
| Multi-floor / curved / round-trip must-have | Unknown |
| Client DWG corpus | Unknown |
| Geometry params in commerce UI | Open — keep createAsset rebuild |
| Legal review Polyfork `.mjs` in cloud | Open — trusted local + guardrails |
| Long-term slot SoR | Open — keep extras/sidecar/name |

---

## Dependency-ordered build queue

Only **Build now** / **Partial local MVP** / doc fixes. Already-done items are checklist/docs only.

| # | Item | Class | Depends on |
|---|---|---|---|
| 0 | Fix README stale IA / OBJ lines; mark params UI done in notes/checklist | Build now (docs) | — |
| 1 | Room graph undo/redo stack + UI/hotkeys | Build now | graph mutation path |
| 2 | Wall/floor `material_id` on graph + shell materials from library | Build now | (1) preferred |
| 3 | Placeholder door/window meshes (procedural, not SKUs) | Build now | roomMesh rebuild |
| 4 | Collision soft-warn (AABB) | Partial | placements + bounds |
| 5 | Wall-snap toggle for placements | Build now | walls + placements |
| 6 | 2D plan polish (dims, door/window symbols, scale) | Partial | plan SVG |
| 7 | Orthogonal freeform wall draw → one closed room | Partial | graph wall ops |
| 8 | Richer local Template CMS (save-from-scratch, tags) | Partial | templates API |
| 9 | JPG/PNG plan underlay + human confirm → same RoomGraph; PDF if pdfjs feasible | Partial | import confirm gate |
| 10 | Export/import project JSON + best-effort IndexedDB | Partial | normalizeRoomGraph |
| 11 | Thin RV stub `.mjs` emitter from sidecar | Build now | pack load (exists) |
| 12 | Local farm job script/queue (+ optional COLOR_0 pre-bake) | Partial | splitZones + build-assets |
| 13 | Untrusted-MJS guardrails (confirm + static scan + flag) | Partial | modules.ts |
| 14 | Pack params `describe` help text polish | Partial | renderPackParams |
| 15 | Plan SVG/PNG download share-out | Partial | plan polish |

**Explicitly not in queue:** server farm/CDN/DB, real ODA/APS, auth/projects/commerce, AR/USDZ, Polyfork codegen, Planner embed, DWG export, AI floorplan, section C.

---

## Risks / honesty rules for build phase

1. Prefer correct partials over invented “complete” product.
2. Keep ODA mock banner; never claim real entity extract.
3. Placeholders ≠ catalog door/window SKUs.
4. Soft-warn ≠ hard collision policy lock (U17 still open).
5. IndexedDB ≠ cloud projects.
6. Stub MJS ≠ Polyfork commercial generator.
7. Static MJS guardrails ≠ sandbox.
