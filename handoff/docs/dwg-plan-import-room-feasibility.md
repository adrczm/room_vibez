# Room Vibez — DWG plan import → room template / immediate room

**Document type:** Research + implementable proposal (no build)  
**Date:** 2026-10-03  
**Audience:** Chong / Room Vibez product + eng  
**Rule:** Cite prior Room Vibez docs and public vendor/tech sources. Do **not** invent features, formats, vendor capabilities, or conversion fidelity. Label **Unknown** where sources are silent.  
**Scope:** Possibility of importing a **DWG plan**, then using it as (1) a **room template**, or (2) an **immediate room** into which the user adds Catalog 3D objects.  
**Out of scope for this task:** Building, editing app code (including parallel `hackathon-3d-viewer` from-scratch work), AI floor-plan magic as the primary answer.

**Prior Room Vibez docs cited:**

| Doc | Relevance |
|---|---|
| `platform-stack-research.md` §4.6–4.8, §5.2 | Hybrid DWG→room graph; ODA/APS roles; farm vs browser |
| `obj-engines-planner-ai-qa.md` Q3, Q5 | ODA vs APS vs hybrid; sketch→room UX; human confirm |
| `format-dwg-vs-obj-planner-gap-plan.md` | Architecture ≠ furniture pipelines |
| `final-supported-file-formats.md` | DWG/DXF MVP architecture ingest; furniture ≠ DWG |
| `persona-formats-and-planner5d-full-plan.md` §A, §C.2 | Personas; `RoomGraph` + `Template` + `SourceAsset` sketch |
| `room-from-scratch-feasibility.md` | Owned room-graph schema + Catalog placement rules (same SoT) |
| `obj-dwg-auto-glb-mjs-feasibility.md` | DWG≠Catalog 3D; commercial convert limits; open-source gap |
| `rubens-like-architecture-analysis.md` | Rubens Room Designer ≠ DWG SoT; owned room editor pattern |
| `internal/room-vibez-requirements-brief.md` | DWG for interaction; sketch→room from PDF/DWG/JPG/PNG |

**Locked decisions this proposal must not contradict:**

- Realtime runtime = **Three.js only**
- Editable rooms SoT = **owned room graph** (not triangle soup, not DWG-as-runtime)
- Imported architecture leans **DWG** (+ PDF/JPG/PNG as other ingresses)
- Furniture = **GLB** (+ optional trusted `.mjs` packs) from Catalog 3D — **furniture ≠ DWG**
- Own BOM/SKU / materials DB / conversion farm

---

## 1. Executive verdict

### Short answer

**Yes — both product modes are implementable**, but only if import means: **DWG (kept as source) → derive / confirm → populate the same owned room graph** that from-scratch authoring writes, then place Catalog 3D GLBs into that graph. Do **not** treat the DWG as the editable Three.js scene, and do **not** auto-convert DWG furniture into catalog packs.

### Accurate product stance

| Mode | What it is | Feasibility |
|---|---|---|
| **Immediate room** | One import job → one editable `Project` / room session with a filled `RoomGraph` + `source_assets` | **Yes — primary MVP of DWG import** |
| **Room template** | Same derive pipeline → persist a **reusable seed** (`Template` / graph snapshot without session placements, or with optional default placements) → instantiate into new projects | **Yes — same pipeline + owned CMS layer** (already sketched as `Template` in `persona-formats…` §C.2) |

### One pipeline, two persistence outcomes

```text
DWG/DXF upload
  → store SourceAsset (keep original)
  → farm: parse / derive wall & opening candidates (+ optional vendor AI assist)
  → human confirm / edit (mandatory)
  → RoomGraph (same schema as from-scratch)
       ├─→ Immediate: attach to Project → open editor → place Catalog 3D
       └─→ Template: save as Template seed → later “New from template” clones graph
```

### What is *not* honest

- Perfect auto-BIM from any architect sheet  
- Open-source “DWG → room graph” with AutoCAD-class fidelity  
- DWG as furniture for Catalog 3D  
- Native AutoCAD editing inside the consumer Three.js editor as the default UX  

Those remain **non-goals** or **later optional architect modes** (ODA inWEB / APS Viewer), per prior research.

---

## 2. DWG reality — what a “plan” actually contains

### 2.1 Typical interior / architectural DWG floor plans are mostly **2D**

Industry practice for residential and commercial **floor plans** is overwhelmingly **2D model-space geometry** at full scale, organized by layers, with doors/windows/furniture often as **blocks**, and shared sheets/floors often as **xrefs** — not a single watertight 3D solid building. Layer conventions commonly follow AIA / National CAD Standard patterns (e.g. `A-WALL`, `A-DOOR`, `A-GLAZ`, `A-FURN`, `A-ANNO-DIMS`, `A-ROOM-IDEN`) ([Seidler Studio — AIA layer names](https://seidlerstudio.com/lesson/autocad-standard-layer-names-floor-plans-2025/); institutional CAD manuals such as [UH CAD standards](https://www.uh.edu/facilities-planning-construction/vendor-resources/cad-standards/cad_standard_manual-update-10282011.pdf) document space polylines + room tags).

| Content class | Typical representation | Extractable to room graph? |
|---|---|---|
| **Walls** | Parallel lines, polylines, or wall objects (if AutoCAD Architecture) | **Candidates yes** — centerline + thickness heuristics, or Architecture wall entities when present |
| **Openings (doors/windows)** | Blocks / door symbols / Architecture door-window objects / gaps in wall lines | **Partial** — high when Architecture objects or clear block conventions; ambiguous when only swing arcs + lines |
| **Rooms / spaces** | Closed space polylines + room tags (when standards-compliant); else implied by wall loops | **Partial** — reliable only when closed space polylines or clean wall topology exist |
| **Layers** | Named layer table | **Yes as metadata** — useful filters; naming is **not standardized across all firms** |
| **Dimensions / text** | Dimension entities, MText | Scale hints **sometimes**; treat as assist, not truth without human confirm |
| **Furniture / fixtures already in DWG** | Blocks on `A-FURN` / similar | **Do not auto-import as Catalog 3D** — ignore or show as non-editable overlay (product choice) |
| **3D solids / AEC objects** | Possible but less common for “floor plan” deliverables | **Unknown mix per client** — do not assume every DWG is 3D |
| **Xrefs** | External drawings referenced by path | **Fragile** — missing xref = incomplete geometry; resolve or fail closed |
| **Multi-floor** | Separate files / layouts / z-levels / xrefs per floor | **Later** — MVP = one floor / one sheet selection |

### 2.2 Two DWG “flavors” that matter for extraction

| Flavor | What you get | Implication for Room Vibez |
|---|---|---|
| **Vanilla AutoCAD 2D plan** | Lines, polylines, arcs, hatches, blocks, layers | Need **geometry heuristics** + layer filters + human edit. No guaranteed wall/door object model. |
| **AutoCAD Architecture objects** (or similar AEC objects inside DWG) | Smart walls / doors / windows / styles | Can use **ODA Architecture SDK** (public: access walls, doors, windows, relationships, styles — [ODA Architecture](https://www.opendesign.com/products/architecture)) for higher-fidelity entity import — **only when those objects exist** |

**Unknown without sample client files:** share of Architecture-object DWGs vs dumb 2D polylines; layer naming adherence; units (`INSUNITS`); model-space vs paper-space only sheets.

### 2.3 Honest extractability summary

| Target entity (owned graph) | Can honestly extract? | Notes |
|---|---|---|
| Wall segments | **Often, as candidates** | Prefer vector over raster AI when DWG is available (`platform-stack-research.md` §4.7) |
| Wall thickness | **Heuristic / Architecture property** | Double-line offset; Architecture thickness; else product default |
| Door / window openings | **Partial** | Blocks vs Architecture objects vs line gaps — confirm UI required |
| Room polygons | **Partial** | Closed loops or space polylines; else user closes rooms |
| Ceiling height | **Usually not in 2D plan** | Default / user input (same as from-scratch) |
| Units | **Often in header; not always correct** | Human scale confirm (known length) — prior Q5 pattern |
| Catalog furniture placements | **No (from DWG)** | Place from Catalog 3D after shell exists |

---

## 3. Ingest toolchains (real)

### 3.1 Recommended default — hybrid farm (matches prior RV lock)

Prior verdict stands (`platform-stack-research.md` §4.8 **D**; `obj-engines…` Option A):

```text
Keep DWG as SourceAsset (architect SoT / archive)
  → server parse (commercial SDK or carefully scoped DXF path)
  → wall / opening / room candidates
  → human confirm
  → RoomGraph JSON
  → Three.js meshes from graph (same as from-scratch)
```

Do **not** make raw CAD polys the consumer WebGL scene (`platform-stack-research.md` §4.9: architect DWG → farm).

### 3.2 Commercial paths

| Toolchain | Documented capability | Useful outputs for Room Vibez | Limits / cost |
|---|---|---|---|
| **ODA Drawings SDK** | Read/write/edit DWG/DXF; access entity data; export includes **PDF, SVG, DAE, STL, Three.js, raster**, etc. ([Drawings product](https://www.opendesign.com/products/drawings); [2025 datasheet](https://www.opendesign.com/datasheets/2025/en/Drawings%20Datasheet.pdf)) | Entity walk → custom **wall/opening JSON**; optional SVG/PDF preview; optional mesh preview | Membership: Commercial ~$3k first year (**Web/SaaS = No**); Sustaining ~$7.5k first year (**Web/SaaS = Yes**) ([ODA membership](https://www.opendesign.com/oda-membership); [2026 pricing PDF](https://www.opendesign.com/agreements/2026/en/ODA%20Membership%20&%20Extension%20pricing.pdf)). Exact “walls API” for vanilla 2D = **your code on entities**. |
| **ODA Architecture SDK** | Native Architecture objects: walls, doors, windows, styles, relationships ([Architecture product](https://www.opendesign.com/products/architecture)) | Best path when files use Architecture objects | Extension to Drawings; still membership; useless if file is dumb lines only |
| **ODA Drawings inWEB** | Browser create/edit/view/save DWG/DXF (WASM) ([Oct 2024 announcement](https://www.opendesign.com/blog/2024/october/drawings-inweb-sdk-oda)) | Optional **architect mode** later — not required for room-graph MVP | Sustaining+ for SaaS; docs historically **beta**-labeled (`obj-engines…` Q3) |
| **ODA File Converter** | DWG↔DXF version normalize ([guest converter](https://www.opendesign.com/guestfiles/oda_file_Converter)) | Version hygiene before parse | **Not** a room-graph or GLB exporter |
| **Autodesk APS Model Derivative** | Translate designs → **SVF/SVF2** (+ other derivatives per field guide) for Viewer + properties ([MD overview](https://aps.autodesk.com/developer/overview/model-derivative-api); [field guide](https://aps.autodesk.com/en/docs/model-derivative/v2/developers_guide/field-guide)) | Architect **view** + hierarchy/properties; optional mesh derivatives (e.g. OBJ listed in prior RV cites of field guide) | Cloud dependency; **pricing Unknown — quote required**; Viewer ≠ full AutoCAD edit; materials often reduced to CAD colors |
| **APS Extra Derivatives** (community/experimental) | Post-process viewables → glTF/glb/USDZ ([aps-extra-derivatives](https://github.com/autodesk-platform-services/aps-extra-derivatives)) | Experimental preview mesh only | **Not** a production promise; still not a room graph |
| **Planner 5D AI recognition** | Async JPEG/PNG/PDF/**DWG**/**DXF** → editable 3D project; usage-priced ([B2B overview](https://support.planner5d.com/en/articles/15189751-planner-5d-b2b-api-technical-overview)) | Fastest **assist** if embed/exit strategy still includes Planner | Output schema → owned `RoomGraph` mapping **Unknown** until signed docs; no public SLA |

### 3.3 Open-source limits (do not oversell)

| Project | Reality |
|---|---|
| **LibreDWG** | Read/write DWG/DXF; exports JSON/DXF/SVG/etc. **No** production DWG→catalog GLB; 3D solids / custom objects limited ([LibreDWG](https://github.com/LibreDWG/libredwg)) |
| **Assimp** | **No DWG** ([assimp#1816](https://github.com/assimp/assimp/issues/1816)) |
| DIY **DXF** parsers | Viable for **simple** 2D polyline plans → candidates; fails on complex DWG-only objects, xrefs, Architecture entities |
| Pure browser DWG DIY | Explicitly **Avoid** (`platform-stack-research.md` §5.2) |

**Verdict:** There is **no honest open-source “drop DWG → perfect RoomGraph”** path. MVP either licenses **ODA** (or APS), uses **Planner AI as assist** with adapter risk, or starts with **DXF-simple + heavy human trace** (weak for real architect sheets).

### 3.4 Output classes — what to ask the farm for

| Output | Role | Prefer for MVP? |
|---|---|---|
| **Candidate RoomGraph JSON** (walls/openings/rooms) | SoT for editor | **Yes — primary** |
| Source DWG bytes + hash | Archive / re-derive / architect handback | **Yes** |
| SVG / PDF / PNG preview of selected model space | Review overlay under candidates | **Yes** |
| Tessellated mesh (OBJ/GLB/SVF) of whole sheet | Optional underlay / architect view | **Optional** — not SoT |
| IFC | BIM review path | **Later / optional** — IFC ≠ DWG ingest (`final-supported-file-formats.md`) |
| Furniture GLB from DWG blocks | Catalog | **No** |

---

## 4. Mapping DWG → owned room graph

### 4.1 Same schema as from-scratch

Reuse the entities in `room-from-scratch-feasibility.md` / `persona-formats…` §C.2 — **do not invent a second room model**:

```text
RoomGraph {
  schema_version
  units: "m"                 # canonical
  rooms[]
  walls[]
  openings[]
  placements[]               # Catalog 3D only; empty at import time unless template defaults
  source_assets[]            # filled on import (dwg|dxf|…)
  light_preset_id?
  provenance: {
    kind: "dwg_import" | "authored" | "template_instance"
    import_job_id?
    template_id?
    confirm_status: "draft" | "confirmed"
  }
}
```

| Entity | Mapping from DWG | MVP rule |
|---|---|---|
| **Wall** | Line/polyline pair → centerline + thickness; or Architecture wall → endpoints + thickness | Reject zero-length; allow non-rectilinear polylines as multi-segment walls (editor must support segments — Phase 0 may restrict to straight segments) |
| **Opening** | Door/window block insert → wall projection + width; Architecture door/window → host wall + width/height | If height/sill missing → residential defaults (same as from-scratch) + flag `inferred: true` |
| **Room** | Closed space polyline / wall-loop flood | If ambiguous → single outer room or unlabeled regions until user names |
| **Placement** | — | **Empty** after import (Catalog 3D only) |
| **SourceAsset** | Uploaded DWG/DXF uri + sha256 + units guess + selected layout/model-space id | Always keep |

### 4.2 Derive algorithm (implementable sketch — not code)

1. **Normalize:** version convert if needed (ODA File Converter / SDK); resolve or report missing **xrefs**.  
2. **Select sheet:** pick model-space / layout / layer set (UX).  
3. **Units:** read `INSUNITS` / insert units → meters; ask user if Unknown or absurd bbox.  
4. **Filter layers:** default hide annotation/furniture/hatch layers; allow user toggles.  
5. **Wall candidates:** parallel-line pairing or Architecture walls → `Wall{a,b,thickness,height}`.  
6. **Opening candidates:** block names / Architecture openings / wall gaps → `Opening{wall_id,…}`.  
7. **Room candidates:** closed loops → `Room{floor_polygon, ceiling_height default}`.  
8. **Review UI:** overlay candidates on SVG/PNG of source; edit; set known dimension.  
9. **Commit:** `confirm_status: confirmed` → editable in Three.js via same meshing as from-scratch (`Shape` holes + extrude — `room-from-scratch-feasibility.md` §4).

### 4.3 Fidelity limits (explicit)

| Topic | Honest limit |
|---|---|
| **Units** | Wrong `INSUNITS` / unitless drawings common → mandatory scale confirm |
| **Layers** | Heuristics on AIA-like names; custom firm layers need mapping UI or manual |
| **Non-rectilinear walls** | Polylines OK as segment chains; curves/arcs → approximate as segments (**Unknown** product tolerance) |
| **Blocks** | Doors as blocks: map by name dictionary (configurable); unknown blocks = ignore or mark as “symbol” |
| **Xrefs** | Must package or fail; do not silently drop walls |
| **Doors as lines** | Weak auto-detect; human places openings (from-scratch tool) |
| **Multi-floor** | Out of MVP; one floor per import job |
| **Furniture in DWG** | **Ignore for Catalog** (locked). Optional ghost overlay — product flag |
| **Round-trip DWG save** | Not required for MVP hybrid; needs ODA inWEB / desktop CAD (`obj-engines…` grill unknowns) |

---

## 5. Template vs immediate room

### 5.1 Shared pipeline (do not fork convert logic)

| Stage | Shared? |
|---|---|
| Upload + virus/size validate | Shared |
| Farm parse → candidates | Shared |
| Human confirm → `RoomGraph` | Shared |
| Three.js mesh rebuild from graph | Shared |
| Catalog 3D placement rules | Shared |

### 5.2 What differs

| Concern | **Immediate room** | **Room template** |
|---|---|---|
| **User intent** | “Furnish this plan now” | “Reuse this shell for many projects” |
| **Persistence** | `Project` + `RoomGraph` + `source_assets` | Owned **Template CMS** record (`Template` in `persona-formats…` §C.2): title, preview, tags, `room_graph` seed (or `project_seed_id`) |
| **Placements** | User adds Catalog items in session | Seed usually **shell-only**; optional **default placements** as SKU refs (advanced) |
| **Mutability of source** | Edits live on the project graph | Instantiation **clones** graph into a new project; template remains immutable until template edit flow |
| **UX entry** | Create → Upload DWG → Review → Editor | Create → From template → (optional still attach new DWG later) **or** Import → “Save as template” |
| **BOM** | Project BOM from placements | Template has no live BOM until instantiated |

### 5.3 Recommended UX distinction (honest labels)

Keep three create paths (`room-from-scratch-feasibility.md` §2), and split import outcomes:

1. **From scratch** — size + openings (parallel work; same graph).  
2. **Import plan → Start editing** — immediate room.  
3. **Import plan → Save as template** / **New from template** — template mode.

Do **not** invent a separate “DWG template format.” The template **is** a versioned room-graph seed (+ metadata), optionally pointing at the original DWG for re-derive.

### 5.4 Planner / Rubens / Coohom (comparison only)

| Vendor pattern | Evidence | Room Vibez take |
|---|---|---|
| Planner AI DWG→editable project | Public B2B AI formats include DWG | Optional assist; adapter to owned graph **Unknown** |
| Planner “templates” | Named Admin **template manager** **Unknown** (`persona-formats…`) | Own CMS default |
| Rubens Room Designer | Rooms configurable; insert catalog objects | Capability class; **not** DWG SoT (`rubens-like-architecture-analysis.md`) |
| Coohom Blank vs Upload | Observed in coohom-analysis | Pattern validation only |

---

## 6. Interaction with Catalog 3D placement

After import (either mode once instantiated), placement is **identical** to from-scratch (`room-from-scratch-feasibility.md` §5; `mjs-loading-in-hackathon-viewer.md`):

| Concern | Stance |
|---|---|
| Asset type | Catalog **GLB** (+ optional trusted `.mjs`); never DWG chairs |
| Floor snap | Place on floor plane from graph (`y=0` / room floor); meters |
| Walls | Extruded from graph; openings cut out — furniture does not edit DWG |
| Scale | Catalog authored in meters; DWG units already normalized in graph |
| DWG furniture blocks | Do not become placements; user re-places from Catalog if needed |
| Materials / lights | Materials DB + scene light presets — unchanged |

Sequencing:

```text
Confirmed RoomGraph (from DWG or scratch or template clone)
  → Three.js room meshes
  → Catalog 3D place GLB
  → slot materials + light preset
  → BOM lines from placements
```

Do not route DWG through the Catalog 3D conversion farm (`obj-dwg-auto-glb-mjs-feasibility.md`).

---

## 7. Phased proposal (honest; no calendar promises)

> Scope by subsystem only.

### Phase 0 — MVP (answers Chong’s ask)

- Accept **DWG + DXF** upload; store `SourceAsset`.  
- Farm path: **prefer ODA Drawings (server) entity extract** *or*, if membership deferred, **Planner AI assist** *only* with clear “draft” labeling + manual edit — do not claim equal fidelity.  
- Review UI: overlay + edit walls/openings + scale confirm.  
- Commit to **owned RoomGraph**; open **immediate room** editor (Three.js).  
- Catalog 3D place on floor.  
- **Save as template** = persist graph seed in owned Template CMS (can ship right after immediate, same data).  
- Explicitly out: native in-browser DWG edit, multi-floor, auto furniture from DWG, IFC, perfect Architecture-object support without samples.

### Phase 1 — Extraction quality

- Layer mapping presets (AIA-like + custom).  
- Xref packaging rules.  
- Non-rectilinear multi-segment walls in editor (align with from-scratch freeform).  
- Door/window block dictionary per client.  
- ODA **Architecture SDK** path when files warrant it.  
- Template defaults: optional starter placements (SKU refs).

### Phase 2 — Architect modes (optional)

- APS Viewer for fidelity review **and/or** ODA Drawings inWEB for DWG round-trip (`obj-engines…` Options B/C).  
- Still keep commerce edit on room graph + GLB.  
- PDF/JPG ingest remains parallel (vision/AI + manual) — not a substitute for DWG vector when DWG exists.

### Phase 3 — Convergence polish

- From-scratch, DWG import, PDF/JPG, and templates = four ingresses, one editor.  
- Re-derive from updated DWG with merge strategy (**Unknown** conflict UX — design later).  
- Optional DWG/DXF **export** from graph — fidelity **Unknown** until exporter chosen (`room-from-scratch-feasibility.md` U5).

### Licensing / cost Unknowns

| Item | What is public | What remains Unknown |
|---|---|---|
| ODA Sustaining | ~$7.5k first year / ~$4.5k renew (public PDF) for Web/SaaS | Negotiation, Architecture addon pricing, production support terms |
| ODA Commercial | ~$3k first year — **no** Web/SaaS redistribution | Whether server-only farm without shipping ODA to browsers fits Commercial — **confirm with ODA** |
| APS | Usage/subscription | **Quote required** (prior docs) |
| Planner AI | Usage-priced separately | Rate limits, accuracy, contractual SLA — **not published** |

---

## 8. Unknowns / non-goals

### Unknowns

| ID | Unknown |
|---|---|
| U1 | Client DWG corpus: % Architecture objects vs 2D lines; layer discipline; xref usage |
| U2 | Whether MVP can wait on ODA membership vs temporary Planner AI assist |
| U3 | Exact Planner AI project JSON → Room Vibez graph mapping (signed docs) |
| U4 | APS pricing and whether Extra Derivatives are production-acceptable |
| U5 | Product policy: ghost-render DWG furniture blocks vs hide always |
| U6 | Arc/curved wall approximation tolerance |
| U7 | Multi-floor / multi-sheet selection UX details |
| U8 | Must architects **round-trip save DWG**? (changes Option A vs B/C) |
| U9 | Data residency ban on Autodesk cloud? |
| U10 | Default ceiling height / wall thickness when absent from DWG |
| U11 | Template: shell-only vs allow seeded Catalog placements |

### Non-goals / do-not-pretend

- DWG as **furniture** or Catalog 3D pack source  
- Auto-perfect BIM / construction-document dimensions from import  
- Native AutoCAD-class editing as the default consumer UX  
- Open-source LibreDWG as sole production fidelity path  
- Treating tessellated whole-sheet GLB as editable room SoT  
- Claiming Rubens/Coohom undocumented DWG import features  
- Building this feature in the research task  
- Inventing conversion fidelity percentages without a spike on real client files  

### Tradeoffs if contradicting a lock

| Proposal | Tradeoff |
|---|---|
| “Edit the DWG live in Three.js” | Wrong runtime; contradicts hybrid + poly budgets |
| “Import DWG chairs into Catalog” | Wrong pipeline; no commerce slots |
| “Skip human confirm” | Liability + broken topology; prior AI advisory forbids |
| “Template = keep only DWG file” | Instantiation still needs graph; slow re-parse every time |

---

## 9. Recommendation (implementable)

Ship **one DWG ingest farm** that produces a **confirmed owned RoomGraph** (same SoT as from-scratch). Expose two product outcomes on that graph: **immediate project** (edit + Catalog 3D now) and **template seed** (owned CMS clone-on-create). Prefer **ODA server-side entity extraction** for vector fidelity when licensing allows; keep **APS Viewer** / **ODA inWEB** as optional architect modes, not the commerce editor. Always require human confirm for scale/walls/openings; ignore DWG furniture for Catalog placement. Spike one real client floor-plan DWG through the chosen toolchain before locking extraction heuristics.

---

## References

### Prior Room Vibez

- `docs/platform-stack-research.md`  
- `docs/obj-engines-planner-ai-qa.md`  
- `docs/format-dwg-vs-obj-planner-gap-plan.md`  
- `docs/final-supported-file-formats.md`  
- `docs/persona-formats-and-planner5d-full-plan.md`  
- `docs/room-from-scratch-feasibility.md`  
- `docs/obj-dwg-auto-glb-mjs-feasibility.md`  
- `docs/rubens-like-architecture-analysis.md`  
- `internal/room-vibez-requirements-brief.md`

### External (public)

- Autodesk: [DWG format compatibility](https://www.autodesk.com/support/technical/article/caas/sfdcarticles/sfdcarticles/AutoCAD-drawing-file-format.html)  
- ODA: [Drawings](https://www.opendesign.com/products/drawings) · [Architecture](https://www.opendesign.com/products/architecture) · [inWEB announcement](https://www.opendesign.com/blog/2024/october/drawings-inweb-sdk-oda) · [Membership](https://www.opendesign.com/oda-membership) · [2026 pricing PDF](https://www.opendesign.com/agreements/2026/en/ODA%20Membership%20&%20Extension%20pricing.pdf) · [File Converter](https://www.opendesign.com/guestfiles/oda_file_Converter) · [Datasheet PDF](https://www.opendesign.com/datasheets/2025/en/Drawings%20Datasheet.pdf)  
- APS: [Model Derivative](https://aps.autodesk.com/developer/overview/model-derivative-api) · [Field guide](https://aps.autodesk.com/en/docs/model-derivative/v2/developers_guide/field-guide) · [Viewer SDK](https://aps.autodesk.com/developer/overview/viewer-sdk) · [Extra Derivatives (experimental)](https://github.com/autodesk-platform-services/aps-extra-derivatives)  
- Planner 5D: [B2B API overview](https://support.planner5d.com/en/articles/15189751-planner-5d-b2b-api-technical-overview)  
- LibreDWG: [GitHub](https://github.com/LibreDWG/libredwg)  
- Assimp DWG: [issue #1816](https://github.com/assimp/assimp/issues/1816)  
- Layer practice: [AIA-style floor plan layers](https://seidlerstudio.com/lesson/autocad-standard-layer-names-floor-plans-2025/) · [UH CAD standards PDF](https://www.uh.edu/facilities-planning-construction/vendor-resources/cad-standards/cad_standard_manual-update-10282011.pdf)  
- Blocks vs xrefs (practice): [cadblockdwg explainer](https://cadblockdwg.com/blog/blocks-vs-xrefs-vs-groups-which-to-use)

---

## Document control

| Version | Date | Change |
|---|---|---|
| 1.0 | 2026-10-03 | Feasibility: DWG plan → room template / immediate room (research only, no build) |
