# Room Vibez — Final supported file formats

**Document type:** Final formats decision (evidence-based)  
**Date:** 2026-10-01  
**Rule:** Cite public Planner 5D / Khronos / prior Room Vibez project docs only. Mark **Unknown** where sources do not confirm. Do not invent vendor features, SLAs, or undocumented formats.

**Prior project docs:**  
- `docs/persona-formats-and-planner5d-full-plan.md`  
- `docs/format-dwg-vs-obj-planner-gap-plan.md`  
- `docs/obj-engines-planner-ai-qa.md`  
- `internal/room-vibez-requirements-brief.md`  

**Public pages re-checked 2026-10-01:**  
- [Planner 5D B2B API technical overview](https://support.planner5d.com/en/articles/15189751-planner-5d-b2b-api-technical-overview)  
- [3D product catalogue](https://planner5d.com/business/3d-product-catalogue) (FAQ format list)  
- [Business](https://planner5d.com/business) (PATH 01 abbreviated format list)  
- [Admin Tool user guide](https://planner5d.com/business/help-admin-tool) (prep guidance; no exclusive format allow-list on that page)  
- [Khronos glTF PBR](https://www.khronos.org/gltf/pbr) · [glTF 2.0](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html)

**Locked product decisions (preferences / prior plans):** Three.js only; architecture interchange **DWG**; furniture = mesh + library materials → runtime **GLB**.

---

## 1) Decision: accept the persona ingest set and normalize

### Plain answer

**Yes.** Room Vibez should **allow the persona-oriented ingest set** (many inputs) and **normalize** into owned pipelines:

| Pipeline | Accept (persona set) | Normalize to |
|---|---|---|
| Architecture / rooms | **DWG**, **DXF**, **PDF**, **JPG/JPEG**, **PNG** | Owned **room graph** (+ keep source files); optional Planner AI recognition job when used |
| Catalog furniture | **OBJ** (+sidecar) now; prefer **glTF/GLB** when vendor can; accept broader mesh exports over time | Validated package → owned conversion farm → **GLB** + `material_slot_id` map |
| Consumer share out | — | **PDF/PNG** plan + optional **GLB** scene package |

This matches prior advisory: there is **no single magic format**; accept many, normalize (`persona-formats-and-planner5d-full-plan.md` §A.1; `format-dwg-vs-obj-planner-gap-plan.md` bottom line; requirements brief: sketch→room from PDF/DWG/JPG/PNG; furniture OBJ target).

### Critical caveat — Planner 5D does not natively cover every Room Vibez ingest format the same way

| Reality | Implication |
|---|---|
| Planner **AI floor-plan recognition** publicly accepts **JPEG, PNG, PDF, DWG, DXF** only ([B2B API overview](https://support.planner5d.com/en/articles/15189751-planner-5d-b2b-api-technical-overview)) | Room Vibez may accept the same set for AI *and* still need **manual draw** + human confirm. Extra sketch types (e.g. HEIC) need **pre-convert** before Planner AI — or stay Room-Vibez-only. |
| Planner **Admin / self-upload catalogue** documents a **wide 3D format list** (see §2) | Those formats are for **partner catalogue upload into Planner**, not a promise that the Room Vibez **Three.js** runtime can load them raw. |
| Room Vibez owns **BOM, materials DB, conversion farm, Three.js exit** (prior plans) | Even when a format is uploadable to Planner, Room Vibez still runs a **conversion farm** for owned GLB CDN + slot validation, and may **selectively upload** only Planner-ready packages to Admin. |
| Native AutoCAD-class **DWG editing** inside Planner embed | **Unknown** / not claimed as native CAD authoring in public docs (AI ingest ≠ CAD editor; CAD **export** IFC/DWG/DXF is **beta**). |

**Product rule:** Room Vibez UX can say “upload your plan / model.” Internally: **detect → validate → normalize (farm) → either feed Planner (selective) or keep on owned path.** Do not imply every accepted extension is editable natively inside Planner without conversion or human review.

---

## 2) Support matrix — Planner 5D (public) vs Room Vibez

Legend:  
- **P5D:** documented in public Planner pages (as of re-check)  
- **RV:** Room Vibez product stance in this final list  
- **Farm:** Room Vibez conversion / normalize job required for owned runtime or to prepare a Planner package  
- **Unknown:** not confirmed in cited public docs

### 2.1 Floor-plan / architecture inputs

| Format | Planner 5D (public) | Room Vibez | Path |
|---|---|---|---|
| **JPEG / JPG** | **Yes** — AI recognition ([B2B overview](https://support.planner5d.com/en/articles/15189751-planner-5d-b2b-api-technical-overview)) | **Yes** — MVP ingest | Planner AI *and/or* manual trace; always human confirm |
| **PNG** | **Yes** — AI recognition | **Yes** — MVP ingest | Same |
| **PDF** | **Yes** — AI recognition | **Yes** — MVP ingest | Same; vector vs scanned page handling depth **Unknown** without signed docs |
| **DWG** | **Yes** — AI recognition input; CAD **export** DWG also listed (**beta**) | **Yes** — architecture SoT / interchange (MVP) | Keep source; derive room graph; optional Planner AI; native in-browser DWG edit = **Unknown** / optional later (ODA/APS) |
| **DXF** | **Yes** — AI recognition; CAD export (**beta**) | **Yes** — MVP sibling to DWG | Same as DWG path |
| **IFC** | CAD **export** lists IFC (**beta**); **ingest** as AI input **not** listed in B2B recognition formats | **Optional / later** for BIM review — not MVP required | Own BIM review path if needed; do **not** claim Planner AI accepts IFC |
| **HEIC** (phone) | **Not** listed for AI recognition | Accept later via **pre-convert → JPG** — or reject until farm supports | Farm / client convert |
| Blank / manual draw | Product has room planner; not a “file format” | **Yes** — MVP always-on fallback | No Planner file upload |

### 2.2 Catalog / furniture 3D (Admin upload vs Room Vibez)

Planner catalogue FAQ lists self-upload formats:  
`.blend`, `.obj`, `.fbx`, `.ply`, `.gltf`, `.glb`, `.stl`, `.stp`, `.igs`, `.usd`, `.usdc`, `.usdz`, `.uzda`, `.vrm`, `.max`  
([3D product catalogue FAQ](https://planner5d.com/business/3d-product-catalogue)).  

Business PATH 01 cites a **shorter** illustrative list (`.blend`, `.obj`, `.fbx`, `.gltf`, `.glb`, `.stl`, `.stp`, `.usdz`) — treat the **FAQ list as the fuller public allow-list**; anything beyond either list = **Unknown**.

Admin Tool documents mesh/material **preparation** (one mesh per customizable area, UVs, etc.) but does **not** replace the catalogue FAQ for the format allow-list ([Admin Tool](https://planner5d.com/business/help-admin-tool)).

| Format | Planner Admin upload (public FAQ) | Room Vibez stance | Farm? |
|---|---|---|---|
| **OBJ** (+ typically MTL/textures) | **Yes** | **MVP Required** source (furniture company today) + **sidecar JSON** for slots | **Yes** → GLB for Three.js; also package for Planner per Admin prep |
| **glTF / GLB** | **Yes** | **MVP Required** accept; **canonical runtime** = **GLB** ([Khronos glTF](https://www.khronos.org/gltf/pbr)) | Optimize/validate (gltf-transform); may pass-through to Planner |
| **FBX** | **Yes** | **Necessary / later** ingest (common DCC) | **Yes** → GLB |
| **BLEND** | **Yes** | Later ingest | **Yes** → GLB (or ask vendor to export glTF/OBJ) |
| **STL** | **Yes** | Later — geometry-only; weak for multi-material slots | Farm possible; usually poor for commerce configurator |
| **STP / STEP** | **Yes** (`.stp`) | Later — CAD solid; not web runtime | **Yes** → mesh/GLB if product needs it |
| **IGS / IGES** | **Yes** (`.igs`) | Later | Farm if needed |
| **PLY** | **Yes** | Later | Farm if needed |
| **USD / USDC / USDZ** | **Yes** | Later — not MVP Three.js catalog runtime | Farm / selective; Apple AR path for USDZ is separate concern |
| **UZDA** | Listed in FAQ as `.uzda` | Treat as **Planner-documented string**; semantic relation to USDA/USD **Unknown** without further Planner clarification | Do not invent handling |
| **VRM** | **Yes** | Later / niche | Farm if needed |
| **MAX** | **Yes** (`.max`) | Later ingest only if vendors ship native Max | Farm / DCC export preferred over shipping Max to browser |
| **MTL** | Not a standalone catalog format; accompanies OBJ | Accept as part of OBJ package; **not** finish SoT when materials are library-side (`format-dwg-vs-obj-planner-gap-plan.md`) | Maps may be ignored or used as hints |
| **Sidecar JSON** (`mesh → material_slot_id`) | **Not** a Planner format — Room Vibez invention | **MVP Required** for OBJ-era catalog | Stays owned |
| SketchUp **SKP** | **Not** in FAQ list | **Unknown** as direct Admin upload; accept only if vendor exports listed mesh format | Prefer OBJ/glTF/FBX export from SketchUp |

### 2.3 Exports / outputs (not the same as ingest)

| Output | Planner 5D (public) | Room Vibez |
|---|---|---|
| CAD export **IFC / DWG / DXF** | Documented async; **currently in beta** ([B2B overview](https://support.planner5d.com/en/articles/15189751-planner-5d-b2b-api-technical-overview)) | Do **not** depend for MVP architect delivery; optional when beta acceptable (**Unknown** prod readiness) |
| Photoreal / 360 / walkthrough | Documented as usage / add-on | Optional product features — not file-ingest policy |
| Room Vibez share **PDF / PNG** (+ optional **GLB**) | N/A (owned) | **MVP** consumer/share outs per persona plan |

### 2.4 Who does the work when formats diverge

```text
User uploads (persona set)
        │
        ├─ Floor plan family (JPG/PNG/PDF/DWG/DXF)
        │     ├─ Optional → Planner AI recognition (async poll)  [same formats]
        │     ├─ Always → human confirm + manual edit
        │     └─ Keep source + room graph on Room Vibez
        │
        └─ Furniture family (OBJ/glTF/… )
              ├─ Room Vibez farm → GLB + slots (owned CDN / Three.js)
              └─ Selective upload → Planner Admin package (formats Planner lists)
```

---

## 3) Final lists — Required (MVP) vs Necessary / later

### 3.1 Required (MVP) — Room Vibez must accept / produce

#### Architecture / sketch ingest

| Format | Why MVP | Planner-native? |
|---|---|---|
| **JPG / JPEG** | Consumer / designer photos & scans | **Yes** — AI recognition |
| **PNG** | Same | **Yes** — AI recognition |
| **PDF** | Universal share from agents / architects / print | **Yes** — AI recognition |
| **DWG** | Architect SoT / interchange (locked preference) | **Yes** as AI input; **not** confirmed as native AutoCAD-class editor |
| **DXF** | Common CAD interchange sibling | **Yes** as AI input |

Plus: **manual draw** (no file) as mandatory fallback.

#### Furniture / catalog ingest

| Format | Why MVP | Planner-native? |
|---|---|---|
| **OBJ** (+ package hygiene + **sidecar JSON** for slots) | Furniture company exports OBJ today (`obj-engines-planner-ai-qa.md`) | **Yes** Admin upload; farm still required for owned GLB |
| **GLB** / **glTF** | Khronos web delivery; Three.js runtime canonical | **Yes** Admin upload; still validate/optimize |

#### MVP outputs

| Format | Audience |
|---|---|
| **PDF** and/or **PNG** floor-plan share | Consumers / sales |
| **GLB** (optional scene or product package) | 3D share / owned runtime |

#### MVP infrastructure (not a file type, but required)

- **Conversion farm** (OBJ±sidecar → GLB; validate named meshes / UVs / units)  
- **Materials DB** binding by `material_slot_id` (not embedded lights in furniture files)  
- **Selective Planner upload** of Admin-ready packages when using embed

### 3.2 Necessary / later — accept when farm & ops ready (not MVP blockers)

| Format / capability | Rationale | Notes |
|---|---|---|
| **FBX** | Common designer/DCC interchange; Planner Admin lists it | Farm → GLB |
| **BLEND**, **MAX**, **STL**, **STP**, **IGS**, **PLY**, **USD/USDC/USDZ**, **VRM** | Planner FAQ lists them; widen vendor onboarding | Prefer asking vendors for **glTF/OBJ** when possible; STL/STEP weak for multi-slot commerce |
| **IFC** ingest for BIM review | Architects/BIM workflows in brief | **Not** in Planner AI recognition list |
| **HEIC → JPG** | Phone camera reality | Pre-convert before Planner AI |
| Planner **CAD export** consume (IFC/DWG/DXF) | Architect handoff | **Beta** — Unknown GA |
| Optional **ODA Drawings inWEB** / **APS Viewer** | Native DWG view/edit | Open decision in prior Q&A — not formats policy alone |
| SketchUp **SKP** direct | Designers use SketchUp | **Unknown** direct Admin support — require export to listed mesh format |

### 3.3 Explicitly out of scope / do not treat as Room Vibez runtime

| Item | Status |
|---|---|
| Raw **OBJ** as browser runtime | **No** — convert to GLB (`obj-engines-planner-ai-qa.md`) |
| **DWG** as furniture catalog format | **No** — wrong pipeline (`format-dwg-vs-obj-planner-gap-plan.md`) |
| Embedding catalog **lights** in furniture files | **No** — light presets owned (`format-dwg-vs-obj-planner-gap-plan.md`) |
| Invented “`.bim`” file type | **No** — brief: BIM workflows, not a `.bim` format |
| Claiming Planner public **SLA** for AI latency/accuracy | **Unknown** / not published — do not invent |

---

## 4) Answers checklist (this task)

| # | Question | Answer |
|---|---|---|
| 1 | Should Room Vibez allow the persona ingest set and normalize? | **Yes.** Caveat: Planner may not natively support every format the same way → **conversion farm** + **selective upload** to Planner; AI recognition limited to JPEG/PNG/PDF/DWG/DXF. |
| 2 | Explicit Planner vs Room Vibez matrix? | See **§2**. |
| 3 | Final MVP vs later lists? | See **§3**. |

---

## 5) Sources

### Planner 5D (public)
- [B2B API technical overview](https://support.planner5d.com/en/articles/15189751-planner-5d-b2b-api-technical-overview) — AI recognition: JPEG, PNG, PDF, DWG, DXF; CAD export IFC/DWG/DXF beta  
- [3D product catalogue](https://planner5d.com/business/3d-product-catalogue) — FAQ self-upload format list  
- [Business](https://planner5d.com/business) — PATH 01 abbreviated upload formats; AI floor plan recognition (capability)  
- [Admin Tool](https://planner5d.com/business/help-admin-tool) — mesh-per-area prep; upload processing (no exclusive format table on page)

### Khronos / web 3D
- [glTF PBR](https://www.khronos.org/gltf/pbr)  
- [glTF 2.0 specification](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html)

### Prior Room Vibez docs
- `docs/persona-formats-and-planner5d-full-plan.md`  
- `docs/format-dwg-vs-obj-planner-gap-plan.md`  
- `docs/obj-engines-planner-ai-qa.md`  
- `internal/room-vibez-requirements-brief.md`

---

## Document control

| Version | Date | Change |
|---|---|---|
| 1.0 | 2026-10-01 | Final supported formats: decision, Planner vs RV matrix, MVP vs later |
