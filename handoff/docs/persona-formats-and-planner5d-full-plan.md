# Room Vibez — Persona formats & Planner 5D full plan

**Document type:** Formats advisory + Planner 5D feature inventory + gap architecture  
**Date:** 2026-10-01  
**Decisions affirmed:** Three.js only; **DWG for architecture**; furniture = mesh + library materials; remove old AI-only prototype.  
**Authority for product facts:** `internal/room-vibez-requirements-brief.md`  
**Prior research:** `docs/format-dwg-vs-obj-planner-gap-plan.md`, `docs/obj-engines-planner-ai-qa.md`, `docs/platform-stack-research.md`  
**Rule:** Cite public docs only. Mark **Unknown** where docs do not confirm. Do not invent vendor features or SLAs.

---

## Section A — Best accessible formats by persona

### A.1 Plain answer (Q1)

There is **no single magic format**. Room Vibez should **accept many inputs and normalize**:

| Pipeline | Architecture / rooms | Catalog furniture | Consumer share |
|---|---|---|---|
| **Source of truth / interchange** | **DWG** (+ PDF / JPG / PNG sketches) | **OBJ + sidecar** now → **glTF preferred**; runtime **GLB** | **PDF / PNG** floor plan + optional **GLB** for 3D |
| **Why** | Architect native / CAD interchange | Mesh + named parts for material slots | Easy to open without CAD |

**DWG for rooms aligns with architects.** It does **not** replace glTF/OBJ for furniture. These are two pipelines (see §A.4).

### A.2 What people commonly receive / export (evidence-backed)

#### Regular people (consumers / homeowners)

| They usually have | Why | Room Vibez ingest |
|---|---|---|
| Phone photos / scans of floor plans (JPG/PNG) | Camera / screenshot | Accept → AI assist (async) + **human confirm** + manual draw fallback |
| PDF floor plans from agent / builder | Universal share format | Accept as sketch/raster or vector pages |
| Rarely: DWG from architect | Architect delivers native CAD | Accept as architecture path |
| Rarely: 3D models | Not typical for consumers | Optional later GLB share of *their* design |

**Recommendation for consumers:** Prefer **JPG/PNG/PDF upload** or blank/manual draw. Do not require DWG. Export share: **PDF/PNG** plan + optional **GLB** scene package.

#### Architects

| App | Common export / native | Evidence |
|---|---|---|
| **AutoCAD** | Native **DWG**; interchange **DXF**; share **PDF** | Autodesk: DWG is native AutoCAD drawing format ([drawing format compatibility](https://www.autodesk.com/support/technical/article/caas/sfdcarticles/sfdcarticles/AutoCAD-drawing-file-format.html)); PDF via EXPORTPDF/PLOT ([About Exporting to PDF](https://help.autodesk.com/cloudhelp/2026/ENU/AutoCAD-Core/files/GUID-EC9C6D47-814E-476D-840F-04104CF72B78.htm)); EXPORT supports DXF and others ([EXPORT command](https://help.autodesk.com/cloudhelp/2026/ENU/AutoCAD-Core/files/GUID-A72DB257-3410-4792-B548-6B9FC1DED72B.htm)) |
| **Revit** | Export **DWG / DXF**; **IFC**; **PDF** (native export since Revit 2022); also OBJ/SAT/STEP/STL from CAD export list | [Exporting to CAD Formats](https://help.autodesk.com/cloudhelp/2026/ENU/Revit-DocumentPresent/files/GUID-7C1AC4B7-1EEA-4025-ADEB-CE1CBB974132.htm); [About Exporting to CAD](https://help.autodesk.com/cloudhelp/2025/ENU/Revit-DocumentPresent/files/GUID-EA2B51E1-C28A-4410-AF01-836377581968.htm); [IFC Export Setup](https://help.autodesk.com/cloudhelp/2026/ENU/Revit-DocumentPresent/files/GUID-E029E3AD-1639-4446-A935-C9796BC34C95.htm); [PDF export options](https://www.autodesk.com/support/technical/article/caas/sfdcarticles/sfdcarticles/Revit-PDF-export-print-options.html) |
| **Rhino** | 3DM native; common exports include DWG/DXF, OBJ, FBX, glTF — **exact menu set version-dependent** → treat full matrix as **Unknown** without scoping a Rhino version | Confirm with sample exports in scoping |
| Phone / Illustator / PDF | Annotated floor sheets | Accept PDF/PNG as sketch path |

**Recommendation for architects:** **DWG as architecture SoT / interchange**; accept **DXF** and **PDF** as siblings; treat **IFC** as optional BIM review path (not furniture). Native browser DWG edit is **optional future** (ODA Drawings inWEB / APS) — hybrid: import/view + editable room graph; **do not fake native AutoCAD**.

#### Interior designers

| They usually have | Sources | Room Vibez |
|---|---|---|
| PDF / JPG mood + plan sheets | Architect / client / Illustrator | Sketch ingest |
| SketchUp models / exports | Common ID tool; OBJ/FBX/glTF depending on version & plugins | Furniture/scene ingest via conversion farm → GLB |
| Blender / 3ds Max / Rhino assets | OBJ, FBX, glTF/GLB, MAX (Max native not a browser runtime) | Normalize to GLB |
| Material boards (PDF/PNG) | Branding | Materials DB references, not mesh |

**Recommendation for designers:** Accept sketch formats + mesh catalogs; prefer **glTF/GLB** when available; keep **OBJ+sidecar** for furniture vendors who only ship OBJ.

### A.3 App → format cheat sheet (ingest matrix)

| Source app / channel | Commonly accessible outs | Room Vibez accept | Normalize to |
|---|---|---|---|
| AutoCAD | DWG, DXF, PDF, raster plots | Yes (arch) | Room graph (+ keep DWG source) |
| Revit | DWG, DXF, IFC, PDF, OBJ (CAD export list) | DWG/PDF primary; IFC optional | Room graph / BIM review |
| SketchUp | SKP native; exports vary (OBJ/FBX/glTF by version) | Mesh if exportable | GLB |
| Blender | glTF/GLB, OBJ, FBX, blend | Prefer glTF; accept OBJ/FBX | GLB |
| 3ds Max | MAX native; OBJ/FBX/glTF common | Accept mesh exports | GLB |
| Rhino | 3DM; DWG/DXF/OBJ/FBX/glTF (confirm version) | Arch + mesh as applicable | Room graph / GLB |
| Illustrator / print | PDF, PNG, JPG | Sketch | Room graph via AI+manual |
| Phone scan / photo | JPG, PNG, HEIC→JPG | Sketch | Same |
| Furniture vendor | Often **OBJ** (+MTL) | Yes + sidecar | GLB + slots |
| Consumer share out | — | — | **PDF/PNG** + optional **GLB** |

### A.4 Explicit Q1 alignment: DWG for rooms ≠ furniture format

```text
Architect sheet (DWG / DXF / PDF / JPG)
        → walls / openings / rooms
Furniture catalog (OBJ+sidecar → glTF; runtime GLB)
        → placeable products + material_slot_id
Materials DB (owned)
        → finish truth (wood / plastic / wool …)
Lights
        → scene / render presets (not in furniture files)
```

| Question | Answer |
|---|---|
| Does choosing **DWG for architecture** align with best accessible formats? | **Yes** for architects (AutoCAD native; Revit export to DWG). Consumers still use PDF/JPG. |
| Does DWG replace OBJ/glTF for furniture? | **No.** Different pipeline. |
| Canonical furniture runtime? | **GLB** in Three.js |
| Catalog source now? | **OBJ + sidecar JSON** mapping mesh names → `material_slot_id`; prefer glTF when vendor can |

Evidence for mesh-per-customizable-part (Planner Admin, same principle for owned farm): [Admin Tool – 3D model preparation](https://planner5d.com/business/help-admin-tool).  
Evidence for glTF web delivery: [Khronos glTF PBR](https://www.khronos.org/gltf/pbr); [glTF 2.0](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html).

### A.5 Recommended Room Vibez ingest matrix (summary)

| Role | Accept (many) | Prefer asking for | Runtime / SoT |
|---|---|---|---|
| Consumer | JPG, PNG, PDF; blank draw | Clear photo of plan | Room graph; share PDF/PNG ± GLB |
| Interior designer | PDF/JPG + mesh exports | glTF/GLB or clean OBJ+sidecar | GLB + materials DB |
| Architect | **DWG**, DXF, PDF; optional IFC | DWG plan sheets | DWG source + derived room graph; future ODA/APS optional |
| Reseller / ops | Same + catalog packages | Named meshes + SKU CSV | Owned BOM + SKU |

---

## Section B — Full Planner 5D feature inventory (public docs only)

**Sources used (public):**  
- [Business](https://planner5d.com/business)  
- [Admin Tool user guide](https://planner5d.com/business/help-admin-tool)  
- [B2B API technical overview](https://support.planner5d.com/en/articles/15189751-planner-5d-b2b-api-technical-overview)  
- [Configurator](https://planner5d.com/configurator)  
- [3D product catalogue](https://planner5d.com/business/3d-product-catalogue)  

Full REST/JS schemas are **behind signing** → many depths remain **Unknown**.

### B.1 Inventory table

| Feature | Available (Yes / Partial / Unknown) | Evidence link | Notes |
|---|---|---|---|
| White-label iframe embed | **Yes** | [B2B API overview](https://support.planner5d.com/en/articles/15189751-planner-5d-b2b-api-technical-overview); [Business](https://planner5d.com/business) | Your brand / catalogue / journey |
| JS API: sessions | **Yes** | B2B overview | Session tokens per user; not persistent |
| JS API: 2D/3D view mode | **Yes** | B2B overview | Read/set editor mode |
| JS API: project open events | **Yes** | B2B overview | Listen for open |
| JS API: configure editor UI | **Yes** | B2B overview | UI elements configurable — depth **Unknown** until signed docs |
| JS API: cart / action button events | **Yes** | B2B overview | Primary commerce hook; button destination is yours |
| JS API: product list from session | **Yes** | B2B overview | Item-level data; part/slot schema **Unknown** until signing |
| REST: user management | **Yes** | B2B overview | Create/auth/update; map to your user IDs |
| REST: project CRUD / copy / archive | **Yes** | B2B overview | Summary + detailed levels |
| REST: project metrics | **Yes** | B2B overview | Floor area, item counts, item dimensions |
| REST: catalogue access | **Yes** | B2B overview | Metadata, SKU, thumbnails |
| Partner catalogue / Admin Product List | **Yes** | [Admin Tool](https://planner5d.com/business/help-admin-tool); [Catalogue](https://planner5d.com/business/3d-product-catalogue) | Upload, review, categories, publish |
| Self-upload formats (.obj, .fbx, .gltf, .glb, .blend, .stl, .stp, .usdz, …) | **Yes** | Catalogue page FAQ | Wide format list documented |
| Mesh = separate material area | **Yes** | Admin Tool prep guide | One mesh per independently customizable part |
| Materials/textures replace in Admin | **Yes** | Admin Tool | Colors/textures per mesh area |
| Variants / finishes in catalogue | **Partial** | Catalogue + Configurator | Documented as supported; rule depth / API automation **Unknown** |
| Rule-based product configurator | **Yes** (product marketing) | [Configurator](https://planner5d.com/configurator) | Dimensions, materials, components, invalid combo blocking; implementation scoped per project |
| Configurator inside room planner | **Yes** | Configurator page | Standalone PDP **or** in-room |
| Dynamic / live pricing | **Partial** | Business + Configurator + B2B “pricing feed” | Live updates claimed; exact rule engine API **Unknown** |
| Pricing feed (CSV/XML/API scheduled) | **Yes** | B2B overview “Additional capabilities” | Sync on schedule |
| Cart / CRM / ERP / CPQ handoff | **Partial** | Business + B2B | Via cart listener / your endpoint — **your** systems own checkout |
| Dedicated public **BOM manager** | **Unknown** / not documented as named product | — | No dedicated “BOM manager” page found; product list ≠ owned BOM SoT |
| Template / starter-room CMS (named Admin feature) | **Unknown** | Business mentions “templates” in workflows | Treat as **Unknown** as first-class Admin/API; own CMS unless sales confirms |
| Project clone/copy | **Yes** (REST) | B2B overview | Copy projects — may partially cover starters |
| AI floor plan recognition | **Yes** | B2B overview; Business | JPEG/PNG/PDF/DWG/DXF → editable 3D project; **async poll**; **usage-priced separately**; **no public SLA** |
| AI Smart Wizard (auto-furnish) | **Yes** (marketing) | Business | Dimensions + style → catalogue layout; add-on framing |
| AI room designer (API add-on) | **Yes** (listed) | B2B overview additional | Configurable add-on |
| AI Home Scan | **Partial** / marketing | Business | Scan → editable 2D/3D; technical API depth **Unknown** |
| AI 3D from product photos | **Yes** (marketing) | Catalogue | Starting-point models |
| Photoreal 4K renders | **Yes** | B2B + Business | Usage-based |
| 360° / walkthrough / panoramas | **Yes** | B2B + Business | Add-on within embed |
| CAD export IFC/DWG/DXF | **Partial** | B2B overview | Async queue; **currently in beta** |
| UTM forwarding | **Yes** | B2B overview | Conversion tracking |
| Auth: your login (no Planner end-user account) | **Yes** | B2B overview | Session token from REST |
| Unlimited users / no per-seat (license marketing) | **Partial** | Business / Configurator marketing | Commercial terms **Unknown** without contract |
| Design Battle campaign | **Yes** (offer) | Business | Marketing campaign product |
| Native DWG CAD editor inside embed | **Unknown** / not claimed as AutoCAD-class | AI ingest accepts DWG; CAD **export** beta | Do not assume native DWG authoring |
| Part-level BOM / mesh IDs in cart payload | **Unknown** | — | Ask on scoping call |
| Bulk materials sync via API | **Unknown** | Admin is UI-documented | May be Admin-only |
| Data residency / full project exit schema | **Unknown** | — | Behind contract / signed docs |
| Public SLA for AI recognition latency/accuracy | **Unknown** | Explicitly not published | Do not invent waits |

### B.2 What Room Vibez should assume is *not* covered by public docs

- Owned multi-tenant **BOM** as system of record with ERP lineage  
- Full **SKU compatibility matrix** beyond what Configurator scoping delivers  
- **Materials DB** as first-class PBR library with bidirectional sync  
- **Conversion farm** (OBJ→GLB) ownership — Planner processes uploads, but Room Vibez still needs farm for owned Three.js exit + CDN  
- Pixel-perfect official Planner UI replication (prototype must label simulation)

---

## Section C — Architecture for missing features

### C.1 Ownership map

| Concern | Owner | Interface to Planner (public) |
|---|---|---|
| Room editor UX (MVP) | Planner embed | iframe + JS API sessions / 2D·3D / UI config |
| Auth shell | **Room Vibez** | REST session token per user |
| Commerce / checkout | **Room Vibez** | Cart event → your endpoint; product list pull |
| **BOM SoT** | **Room Vibez** | Normalize cart/product-list → `bom_line` |
| **SKU / price / availability rules** | **Room Vibez** (+ mirror subset to Planner) | Pricing feed; catalogue Admin/API |
| **Template CMS** | **Room Vibez** (until proven otherwise) | Open/copy project via REST if usable |
| **Materials DB** | **Room Vibez**; subset sync to Planner | Admin materials / **Unknown** API bulk |
| **Conversion farm** | **Room Vibez** | Feed Planner upload package + own GLB CDN |
| AI floor-plan assist | Planner usage API | Async submit/poll + **human confirm** UX |
| Architect DWG hybrid | Import via AI/CAD path; optional ODA/APS later | No fake native CAD |
| Owned Three.js editor | **Room Vibez** (exit) | Replace iframe; keep BOM/SKU/farm |

### C.2 Data model sketch

```text
User { id, role: consumer|designer|architect|reseller, auth_subject }
Project { id, owner_id, title, planner_project_id?, room_graph_uri?, status }
RoomGraph { walls[], openings[], rooms[], units, source_assets[] }
SourceAsset { id, type: dwg|pdf|jpg|png|dxf, uri, sha256 }
Sku { id, code, title, price, currency, active, planner_item_id? }
Material { id, code, family: wood|plastic|wool|…, maps{}, pbr{} }
MaterialSlot { id, sku_id, mesh_name, allowed_material_ids[] }
AssetPackage { sku_id, source_obj_uri?, glb_uri, lod[], checksum }
Placement { id, project_id, sku_id, transform, slot_bindings{ slot_id → material_id } }
BomDocument { id, project_id, currency, revised_at }
BomLine { id, bom_id, sku_id, qty, unit_price, slot_summary?, source: planner_cart|manual }
Template { id, title, preview_uri, project_seed_id, tags[] }   # owned CMS
LightPreset { id, title, params }
ConversionJob { id, source_uri, status, glb_uri?, errors[] }
AiRecognitionJob { id, source_asset_id, vendor_job_id?, status, result_project_id? }
```

### C.3 Interface sketch (Planner events → Room Vibez)

```text
[Your Auth] --REST create session--> [Planner REST]
[Your App]  --iframe + JS init-----> [Planner Embed]
                | cart click / product list
                v
        [BOM Service] upsert BomDocument + BomLine (idempotent)
                |
                v
        [Commerce / Quote / ERP]

[Upload DWG/PDF/JPG] --> [Planner AI recognition async]
                | poll
                v
        [Review UI] human confirm dims --> open project

[Owned CMS Template] --> create/copy Planner project OR open seed
[Materials DB] --> (manual/Admin sync now) --> later API if confirmed
[Conversion Farm] --> GLB CDN (exit) + Planner-ready package (embed phase)
```

### C.4 Phased build plan (week ranges = **non-binding estimates**)

> Not commitments. Not vendor SLAs. AI waits in UX are illustrative only.

#### Phase 0 — Embed + owned BOM/SKU shell — *~6–12 weeks*

- Auth + iframe hello-world + domain allowlisting  
- Pilot catalogue (20–50 SKUs) with multi-mesh chair (wood/plastic/wool)  
- Cart listener → **owned BOM v1**  
- Pricing feed stub  
- Conversion farm v0: OBJ+sidecar → GLB archive  
- Optional AI recognition + mandatory human confirm + manual draw  

#### Phase 1 — Deepen commerce & CMS — *~8–16 weeks*

- SKU/variant rules service (own); expose only Planner-supported surface  
- Template CMS (own starters)  
- Materials sync job (semi-manual OK if API Unknown)  
- Metrics → quote helpers  
- Reseller BOM/SKU views  

#### Phase 2 — Architect hybrid harden — *~6–14 weeks (can overlap)*

- DWG/PDF ingest UX polish; keep source files  
- CAD export consumption only if beta acceptable (**Unknown** prod readiness)  
- Spike ODA Drawings inWEB **or** APS Viewer (optional) — membership/cost decision  

#### Phase 3 — Three.js exit ramp — *~12–24+ weeks after Phase 1 stable*

- Room graph adapter from Planner project JSON (**Unknown** schema until signed)  
- Three.js editor: walls + GLB + materials DB + light presets  
- Retire iframe when persona parity enough; optionally keep Planner AI as usage add-on  

### C.5 Milestone table (non-binding)

| Milestone | Weeks (est.) | Outcome |
|---|---|---|
| M1 Embed session | 1–3 | Blank project opens under your auth |
| M2 Pilot catalogue | 3–6 | Multi-slot chair place + material swap |
| M3 Owned BOM v1 | 4–8 | Cart → BOM lines match placements |
| M4 AI + human confirm | 6–12 | Upload → poll → confirm → edit |
| M5 Template CMS | 8–14 | Designer starts from owned template |
| M6 Materials sync | 10–18 | Library IDs ↔ Planner finishes (automation % Unknown) |
| M7 Three.js viewer spike | 10–16 | Same GLB+slots outside iframe |
| M8 Editor exit MVP | 20–36 | Core flow without iframe; BOM unchanged |

### C.6 Risks

| Risk | Mitigation |
|---|---|
| Cart payload lacks part/slot IDs | Own BOM; treat Planner list as placement events; enrich from your SKU DB |
| No template manager in Planner | Own CMS default |
| Materials Admin ≠ full PBR library | Visual approx in embed; fidelity in Three.js exit |
| AI cost/quality / no SLA | Always offer manual draw; draft-only copy; no invented timings |
| CAD export beta | Don’t depend for V1 architect delivery |
| Exit lock-in | Own farm + BOM + slot IDs from day one |
| Bad furniture meshes (merged parts) | Reject samples; enforce Admin-like checklist |

### C.7 Scoping-call questions (Planner sales / engineering)

1. Exact **product-list / cart payload** schema (mesh IDs? material IDs? variant SKUs?).  
2. Template / project-clone patterns beyond `copy`?  
3. Materials **bulk API** vs Admin-only?  
4. Configurator rule limits for accessories (pillow as SKU vs material slot).  
5. AI recognition: rate limits, failure modes, **contractual** latency/accuracy (none public).  
6. Project export completeness for Three.js exit / data residency.  
7. Private catalogue guarantees (no public marketplace bleed).  
8. CAD export beta → GA criteria; IFC/DWG fidelity expectations.  
9. Whether partner can drive materials entirely from external ID mapping.  
10. Commercial: usage pricing for AI / 4K renders / walkthroughs.

### C.8 Prototype note

Interactive flows live at `docs/prototypes/room-vibez-planner-flows/` (mirrored on Desktop). UI is labeled **“Simulated Planner 5D–style UI (not official)”**. Features not confirmed in public docs are greyed **Unknown / not in public Planner docs**. BOM panel is explicitly **Room Vibez–owned**.

---

## Document control

| Version | Date | Change |
|---|---|---|
| 1.0 | 2026-10-01 | Initial formats advisory + full Planner inventory + gap architecture |
