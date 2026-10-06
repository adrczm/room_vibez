# Room Vibez — From-scratch room authoring feasibility

**Document type:** Research + implementable proposal (no build)  
**Date:** 2026-10-03  
**Audience:** Chong / Room Vibez product + eng  
**Rule:** Cite prior Room Vibez docs and public vendor/tech sources. Do **not** invent features, formats, or vendor capabilities. Label **Unknown** where sources are silent.  
**Scope of this doc:** Create a room **from scratch** (no file upload), mark **door/window** regions, then place **Catalog 3D** furniture. **Not** DWG import; **not** AI floor-plan recognition.

**Prior Room Vibez docs cited:**

| Doc | Relevance |
|---|---|
| `platform-stack-research.md` §4.6–4.7 | From-scratch 2D→3D pattern; sketch path separate |
| `persona-formats-and-planner5d-full-plan.md` §A, §C.2 | Blank/manual draw; `RoomGraph` sketch |
| `format-dwg-vs-obj-planner-gap-plan.md` | Architecture vs furniture pipelines |
| `final-supported-file-formats.md` | Manual draw = MVP always-on fallback |
| `rubens-like-architecture-analysis.md` | Rubens Room Designer vs DWG SoT; owned room editor |
| `obj-engines-planner-ai-qa.md` | Hybrid DWG→room graph; AI is optional assist |
| `hackathon-claude-3d-viewer-prompt.md` | Hackathon viewer = catalog foundation; room editor out of scope there |
| `mjs-loading-in-hackathon-viewer.md` | Catalog placement = GLB (+ optional trusted `.mjs` packs) |

**Locked decisions this proposal must not contradict:**

- Realtime runtime = **Three.js only**
- Imported architecture leans **DWG** (+ PDF/JPG/PNG) → **owned room graph** — that is a **different entry path** from from-scratch
- Furniture runtime = **GLB** (+ optional Polyfork-style `.mjs` packs / material slots) from Catalog 3D
- Own BOM/SKU / materials DB / conversion farm
- Optional Planner 5D embed remains an MVP *shell* option elsewhere; this doc proposes an **owned** from-scratch slice for the Three.js editor direction

---

## 1. Executive proposal

### Verdict

**Yes — implementable on the owned Three.js path**, as a thin **room-graph author** that feeds the same scene used for Catalog 3D placement. Do **not** treat this as DWG authoring, and do **not** depend on Planner 5D / Rubens / Coohom as the runtime answer (honest comparison only below).

### Recommended product slice (accurate, not invented)

1. **Create room from scratch** → user picks **size** (presets + custom length × width × ceiling height + units) → system creates a **closed rectangular room** (four wall segments + floor polygon + ceiling height).  
2. **Mark openings** → user selects a wall face (2D plan or 3D wall) → places a **door** or **window** opening with width / height / sill (door sill = 0) along that wall.  
3. **Place library furniture** → load Catalog 3D **GLB** (existing viewer/placer foundation) onto the floor; optional wall-snap later.  
4. **Persist** a versioned **room graph JSON** (walls, openings, rooms, units, placements). Derive Three.js meshes from that graph; never store triangle-soup as SoT (`platform-stack-research.md` §4.6).

### Why this matches industry + prior RV decisions

| Real pattern | Evidence | Room Vibez fit |
|---|---|---|
| Predefined room shapes + numeric wall lengths + pencil draw | Planner 5D Help: [How to add a room](https://support.planner5d.com/en/articles/16902413-how-to-add-a-room); [Creating Your First Floor (Web)](https://support.planner5d.com/en/articles/5876744-creating-your-first-floor-web) (square / rectangle / free form / ceiling height / wall thickness) | MVP = **box room + size**; freeform wall draw = later |
| Doors/windows as construction items on walls, then edit W/H/height-from-floor | Planner 5D Help: [How to Add Windows (Android)](https://support.planner5d.com/en/articles/12906280-how-to-add-windows-android) | Parametric **openings** on wall segments — not freeform “paint holes” without dimensions |
| Rooms configurable; wall/floor/door/window materials via tags | Roomle Rubens Room Designer docs ([Products getting started](https://docs.roomle.com/rubens/rubens-products/rubens-room-designer/getting-started)); SDK `getPlanner()` + `insertObject` ([SDK Room Designer](https://docs.roomle.com/rubens/rubens-sdk/rubens-room-designer/getting-started)) | Steal **capability class** (multi-object room + openings materials); **do not** adopt Roomle WASM/API as runtime |
| Blank / BIM create path separate from upload | Coohom observation: Blank interior BIM vs Upload floor plan (`docs/coohom-analysis/platform-overview.md`) | From-scratch ≠ import |
| Manual draw always-on | `final-supported-file-formats.md`, `persona-formats…` | From-scratch **is** that always-on path, specialized for Chong’s “size + mark openings + place library” ask |
| Single room graph for 2D + 3D | `platform-stack-research.md` §4.6; `obj-engines…` (same graph, not dual engines) | One JSON → plan view + extruded 3D |

### Honest vendor comparison (not the solution)

| Option | What it gives | Why it is **not** the answer here |
|---|---|---|
| **Planner 5D embed** | Mature room create / openings / catalog place; public B2B iframe API | Editor UX owned by vendor; exit needs room-graph adapter (**Unknown** schema until signed — prior RV docs). Locked direction is owned Three.js editor. |
| **Rubens Room Designer** | Documented planner module on Three.js; insert catalog objects; room materials | Vendor kernel/API; rooms ≠ DWG SoT (`rubens-like-architecture-analysis.md`). Patterns OK; dependency not OK as primary. |
| **Coohom blank BIM** | Observed blank create vs upload | Observation only — not a Room Vibez spec; APIs not verified for this ask |
| **Owned Three.js + room graph** | Aligns locks; reuses Catalog 3D GLB placer; same graph later for DWG-derived walls | **Recommended** for this capability |

---

## 2. UX proposal (implementable)

### Entry: distinguish three room-create paths

Keep UX labels honest (prior formats matrix):

| Path | User intent | This doc |
|---|---|---|
| **From scratch** | No plan file; set size; mark openings; place furniture | **In scope** |
| **Import plan** | DWG/DXF/PDF/JPG/PNG → derive/edit room graph | **Out of scope** (existing hybrid path) |
| **AI assist** (optional vendor) | Async recognition → human confirm | **Non-goal** for this slice (already advised as optional elsewhere) |

### Flow A — Room size (MVP)

Industry default is **shape first, then dimensions** (Planner: square / rectangle / multi-corner / freeform; ceiling height + wall thickness on room select).

**MVP UI (owned editor):**

1. **Units toggle:** `m` / `cm` / `ft-in` (store canonical **meters** in graph; display in chosen unit).  
2. **Presets** (examples — product may rename; values are UX defaults, not magic): e.g. Small bedroom 3×3 m, Living 5×4 m, Studio 6×4 m — plus **Custom**.  
3. **Custom fields:** Length (X), Width (Z), **Ceiling height** (Y), optional **wall thickness** (default e.g. 0.1–0.15 m — product pick).  
4. Confirm → create one `Room` + four `Wall` segments + floor polygon. Show **2D plan** with dimensions; optional immediate **3D** orbit of empty shell.

**Defer (later, still standard):**

- Pencil / freeform corner-by-corner walls (Planner Pencil / free-form room)
- Multi-room adjacency / shared walls
- Room name taxonomy beyond a free-text label

### Flow B — Click-to-mark door / window

User asked: *“areas to click and mark as door or window.”* Accurate industry UX is **place an opening on a wall**, then edit parameters — not unstructured region painting without width/height.

**MVP interaction (accurate):**

1. Mode: **Add opening** → choose type **Door** | **Window**.  
2. Click a **wall** (2D wall segment or 3D wall mesh).  
3. Place opening center (or start/end) along wall length; snap to wall centerline.  
4. Inspector defaults (typical residential — adjustable; not vendor claims):  
   - Door: width ~0.9 m, height ~2.1 m, sill = 0  
   - Window: width ~1.2 m, height ~1.2 m, sill ~0.9 m  
5. Drag along wall; edit W / H / sill; delete / duplicate.  
6. Visual: plan shows opening symbol; 3D shows **cutout** (+ optional simple door/window mesh later).

**What “click and mark” means technically:** raycast → wall id → parameter `t` along wall length → create `Opening` record. Not a freehand polygon on the wall texture (that is harder, uncommon for planners, and poor for export).

**Defer:**

- Catalog of styled door/window GLBs (can start as empty cutouts)
- Opening materials (Rubens documents door/window material tags — pattern only)
- Arched / multi-pane parametric geometry

### Flow C — Place library furniture (after shell exists)

Order that matches Planner-class advice (“add doors/windows … before moving on to styling” — [How to add a room](https://support.planner5d.com/en/articles/16902413-how-to-add-a-room)):

1. Exit opening mode → **Catalog 3D** browse (existing GLB + slots / optional `.mjs` pack path).  
2. Click floor to place; drag to move; rotate (Y).  
3. Bind materials via existing slot UI.  
4. Persist `Placement` with transform + slot bindings (`persona-formats…` §C.2).

Hackathon status: catalog viewer/placer foundation exists; **full room editor was out of scope** (`hackathon-claude-3d-viewer-prompt.md`). This proposal is the next owned rung after that foundation — not a rewrite of Catalog 3D.

### 2D vs 3D

| Mode | Primary jobs |
|---|---|
| **2D plan** | Size, wall select, opening placement along walls, furniture XZ position |
| **3D** | Preview extrusions/cutouts, orbit, vertical sense of sill/height, furniture review |

Same room graph drives both (`platform-stack-research.md` §4.6).

---

## 3. Data model (must store)

Extend the existing sketch — do not replace pipelines:

```text
RoomGraph {                # from persona-formats §C.2 — refine fields below
  schema_version
  units: "m"               # canonical; UI may display cm/ft
  rooms[]
  walls[]
  openings[]
  placements[]             # furniture from Catalog 3D
  source_assets[]          # empty for from-scratch; filled on DWG/PDF/JPG import
  light_preset_id?
}
```

### Required entities for Three.js preview + later export

| Entity | Fields (minimum) | Why |
|---|---|---|
| **Room** | `id`, `name?`, `floor_polygon` (2D points, CCW), `ceiling_height`, `wall_ids[]` | Floor/ceiling meshes; area metrics later |
| **Wall** | `id`, `a`/`b` endpoints (2D), `thickness`, `height` (usually = ceiling), `connected_room_ids[]` | Extrude / box walls; opening host |
| **Opening** | `id`, `wall_id`, `type: door\|window`, `offset_along_wall` (m from `a`), `width`, `height`, `sill_height`, `host_side?` | Cutouts + symbols; export dims |
| **Placement** | `id`, `sku_id`, `asset_ref` (glb uri / pack id), `position`, `rotation_y`, `scale` (default 1), `slot_bindings{}` | Catalog 3D SoR link |
| **SourceAsset** | only when import path used | Distinguishes from-scratch (`source_assets` empty or `provenance: authored`) |

### Conventions (implementable defaults)

- Coordinates: Y-up, meters, floor at y=0 (Three.js common).  
- Wall representation: **centerline** segment + thickness (standard for plan editors) **or** inner/outer edges — pick one and stick; centerline is simpler for MVP.  
- Opening validity: `offset + width ≤ wall.length`; `sill + height ≤ wall.height`; reject or clamp with UI feedback.  
- Do not store only baked wall meshes as SoT — regenerate from graph (`platform-stack-research.md` §4.6: “Do not store only a triangle soup”).

### DWG / export — what this graph enables vs Unknown

| Target | Feasibility from this graph | Notes |
|---|---|---|
| Three.js preview | **Yes** | Extrude walls; cut openings; floor polygon |
| PDF/PNG plan share | **Yes** (later) | Prior MVP share outs |
| DWG/DXF **export** | **Partial / Unknown fidelity** | Graph → simple wall polylines + opening blocks is a known CAD export pattern; production CAD quality and layer conventions **Unknown** without a chosen exporter (Planner CAD export is **beta** per prior docs — do not depend). From-scratch rooms are **authored graph**, not reverse-DWG. |
| IFC export | **Later / Unknown** | Not required for this ask |
| Round-trip DWG SoT | **N/A for from-scratch** | Import path keeps source DWG separately (`format-dwg-vs-obj…`) |

---

## 4. Three.js implementation approaches (real)

All approaches assume: **edit graph → rebuild meshes** (or invalidate dirty walls).

### Approach A — Box room + opening cutouts via `Shape` holes + `ExtrudeGeometry` (**MVP recommended**)

For each wall: build a vertical rectangle `THREE.Shape` in wall-local coords; push each opening as a `THREE.Path` in `shape.holes`; `ExtrudeGeometry` with `depth = thickness`, `bevelEnabled: false`.

- Documented community pattern: [three.js discourse — window/door openings](https://discourse.threejs.org/t/how-to-create-window-and-door-openings-in-the-wall/20473) (Shapes + Extrude; CSG alternative).  
- Built-in API: [`ExtrudeGeometry`](https://threejs.org/docs/#api/en/geometries/ExtrudeGeometry), [`Shape`](https://threejs.org/docs/#api/en/extras/core/Shape) holes.

**Fidelity limits:** Axis-aligned rectangular openings on straight walls excel. Slanted tops, arches, multi-wall corner windows, or non-manifold joins need more work. Interior hole faces may need careful materials / `DoubleSide` depending on camera (known Extrude+holes caveat in discourse).

### Approach B — CSG subtraction (`three-bvh-csg` or similar)

Wall solid minus opening boxes. Real library: [gkjohnson/three-bvh-csg](https://github.com/gkjohnson/three-bvh-csg) (experimental; manifold/watertight constraints).

**When:** Irregular cutters or boolean stacks. **Cost:** Heavier; rebuild cost; export quirks (`drawRange` noted in that repo). Prefer A for MVP rectangular openings.

### Approach C — Simple boxes without real cutouts (**prototype only**)

Four `BoxGeometry` walls + overlay door/window frames **without** holes. Fast demo; wrong for walkthrough / light / honest openings. Acceptable only as a spike, not product MVP.

### Approach D — Full freeform wall draw → extrude plan

Draw polylines in 2D → wall segments → same A/B meshing. Matches Planner Pencil / free-form room. **Phase 2+** after box room ships.

### Floor / ceiling

- Floor: `ShapeGeometry` / extruded thin slab from `floor_polygon`.  
- Ceiling: optional plane at `ceiling_height` (hide in plan mode).  
- Lights: existing **scene presets** (not in furniture files) — prior lock.

### Fidelity summary

| Capability | MVP (A + box room) | Later |
|---|---|---|
| Rect room size | Yes | L-shape / freeform |
| Door/window rect cutouts | Yes | Catalog door/window meshes |
| Multi-room shared walls | No | Topology / junctions |
| Curved walls | No | Special geometry |
| Construction-doc DWG | No | Separate export pipeline |

---

## 5. Interaction with Catalog 3D library placement

### What already exists (do not reinvent)

- GLB load + orbit + `material_slot_id` binding + light presets (hackathon viewer).  
- Optional trusted `.mjs` `createAsset()` packs (`mjs-loading-in-hackathon-viewer.md`).  
- Furniture must **not** be DWG; place mesh into rooms later (hackathon prompt lock).

### Placement rules for from-scratch rooms

| Concern | MVP stance | Later / Unknown |
|---|---|---|
| **Scale** | Assume catalog GLB authored in **meters** (Khronos / commerce practice); show world units in UI | Per-SKU unit metadata if vendor packages disagree — **Unknown** until catalog hygiene enforced |
| **Floor snap** | Project placement onto y=0 (or floor plane); keep Y from asset pivot | Pivot conventions per SKU — validate in conversion farm |
| **Wall snap** | Optional: snap AABB back edge to nearest wall | Docking graphs (Rubens-style) — out of scope unless product asks |
| **Collision** | **Unknown / non-goal for MVP** — soft overlap OK with visual feedback optional | Physics or AABB vs walls/furniture — product decision, not claimed here |
| **Openings clearance** | Do not auto-block furniture in door swings (MVP) | Optional keep-out volumes later |
| **BOM** | Placement → owned BOM lines (prior plans) when commerce wired | Unchanged ownership |

### Sequencing

```text
RoomGraph shell (size + openings)
        → Three.js room meshes
        → Catalog 3D place GLB / optional .mjs
        → slot materials + light preset
        → persist placements on same Project
```

Do not mix Catalog 3D conversion farm with room authoring (`obj-dwg-auto-glb-mjs-feasibility.md`: DWG/rooms ≠ Catalog 3D job).

---

## 6. Phased proposal (honest)

> No calendar estimates. Scope by subsystem only.

### Phase 0 — MVP (answers Chong’s ask)

- From-scratch **rectangular** room: presets + custom L×W×ceiling (+ wall thickness).  
- Units display; store meters.  
- Opening tool: click wall → door/window → edit W/H/sill.  
- Meshing: Approach A (`Shape` holes + extrude).  
- Catalog 3D place on floor (reuse viewer).  
- Persist room graph on project.  
- Empty / loading / error: no room yet; invalid opening dims; GLB load fail (mirror catalog viewer states).

**Explicitly not in Phase 0:** AI floor plans, DWG import, freeform pencil walls, multi-floor, collision, CAD export, styled door/window SKUs.

### Phase 1 — Editor deepen

- Pencil / freeform closed polygon rooms.  
- Multi-room adjacency (still graph-first).  
- Optional door/window **catalog meshes** in openings.  
- Wall/floor material from materials DB (Rubens-like *capability*, owned data).  
- 2D dimension labels polish; undo/redo for graph ops.

### Phase 2 — Import convergence

- DWG/PDF/JPG import populates **same** room graph (`source_assets` filled).  
- Human confirm for AI/vector derive (existing advice).  
- From-scratch and import become two **ingresses**, one editor.

### Phase 3 — Export / architect

- PDF/PNG share; optional GLB scene package (prior share outs).  
- DWG/DXF export spike if product requires — fidelity **Unknown** until exporter chosen.  
- Optional ODA/APS architect mode remains orthogonal (prior DWG hybrid).

### Planner 5D role (optional, not required for this slice)

If product still uses embed for speed: from-scratch can live inside Planner UX temporarily, with owned BOM — but **exit ramp** still needs room-graph ownership (`format-dwg-vs-obj…` Phase 2). For Chong’s Three.js-owned direction, prefer Phase 0 above over “just embed Planner.”

---

## 7. Unknowns / non-goals

### Unknowns (do not pretend resolved)

| ID | Unknown |
|---|---|
| U1 | Exact default wall thickness / ceiling height product wants (common ranges known; RV defaults not locked) |
| U2 | Whether openings must host real door/window **SKUs** in MVP or empty cutouts suffice |
| U3 | Catalog GLB unit/pivot hygiene across all SKUs |
| U4 | Furniture–furniture / furniture–wall **collision** policy |
| U5 | DWG/DXF **export** fidelity and tooling choice from authored graph |
| U6 | Planner project JSON ↔ Room Vibez room graph mapping (still Unknown until signed docs — prior) |
| U7 | Rubens/Roomle internal wall/opening schema (not public — do not reverse-engineer) |
| U8 | Coohom blank-BIM API surface for third parties (not verified) |
| U9 | Shared-wall topology rules for multi-room (thickness split, openings on shared walls) |

### Non-goals (this proposal)

- AI floor-plan magic / auto-detect from photo  
- Native AutoCAD-class DWG editing in browser  
- Replacing Catalog 3D with a second furniture pipeline  
- Babylon or dual-engine runtime  
- Claiming Planner/Rubens/Coohom undocumented features  
- Building the feature in this research task  

### Tradeoff if contradicting a lock

| If someone proposes… | Tradeoff |
|---|---|
| “Ship only Planner embed for from-scratch” | Faster UX; delays owned room graph; exit cost remains (prior docs) |
| “Author rooms as GLB shells only” | Breaks editable openings/walls SoR; conflicts with room-graph advice |
| “Use DWG as runtime for scratch rooms” | Wrong tool; heavy; contradicts hybrid DWG→graph for browser UX |

---

## 8. Recommendation (one paragraph)

Ship an **owned from-scratch room author** that writes the same **room graph** already sketched in Room Vibez plans: box room from size inputs → parametric door/window openings on walls → Catalog 3D GLB placement — meshed in Three.js via extruded wall shapes with holes. Keep **DWG import** and **AI recognition** as separate ingresses into that graph. Use Planner/Rubens/Coohom only as UX references (and optional interim embed), not as the long-term runtime for this capability.

---

## References (external)

- Planner 5D: [How to add a room](https://support.planner5d.com/en/articles/16902413-how-to-add-a-room)  
- Planner 5D: [Creating Your First Floor (Web)](https://support.planner5d.com/en/articles/5876744-creating-your-first-floor-web)  
- Planner 5D: [How to Add Windows (Android)](https://support.planner5d.com/en/articles/12906280-how-to-add-windows-android)  
- Roomle Rubens: [Room Designer (Products)](https://docs.roomle.com/rubens/rubens-products/rubens-room-designer/getting-started)  
- Roomle Rubens: [Room Designer (SDK)](https://docs.roomle.com/rubens/rubens-sdk/rubens-room-designer/getting-started)  
- three.js: [ExtrudeGeometry](https://threejs.org/docs/#api/en/geometries/ExtrudeGeometry), [Shape](https://threejs.org/docs/#api/en/extras/core/Shape)  
- Discourse: [How to create window and door openings in the wall?](https://discourse.threejs.org/t/how-to-create-window-and-door-openings-in-the-wall/20473)  
- CSG option: [three-bvh-csg](https://github.com/gkjohnson/three-bvh-csg)  
- Khronos: [glTF 2.0](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html) (furniture runtime context)
