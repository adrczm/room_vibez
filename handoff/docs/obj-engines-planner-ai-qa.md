# Room Vibez — OBJ / Engines / ODA / Planner 5D / AI Floor-Plan Q&A

**Document type:** Evidence-based advisory Q&A  
**Date:** 2026-10-01  
**Client fact (new):** Furniture company exports **OBJ only**; Room Vibez defines the efficient ingest standard (MTL/texture packing → GLB).  
**Authority for product facts:** `internal/room-vibez-requirements-brief.md`  
**Prior research:** `docs/platform-stack-research.md`  
**Rule:** Claims cite official docs/pages. **Unknown** where docs do not confirm. No invented vendor features or benchmarks.

---

## Q1 — OBJ-only implications (for a product / tech lead)

### Plain-language verdict

OBJ is a fine **source** format for a furniture catalog. It is a poor **runtime** format for a browser room planner. Room Vibez should treat every OBJ package as raw input, convert once on a **conversion farm**, and store/serve **glTF 2.0 / GLB** with PBR materials, compression, and LODs.

That is exactly what Khronos positions glTF for: efficient delivery of 3D assets with a standardized PBR material model ([Khronos glTF PBR](https://www.khronos.org/gltf/pbr); [glTF 2.0 spec](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html)).

### What OBJ + MTL can / can’t carry vs glTF PBR

| Concern | Classic Wavefront OBJ + MTL | glTF 2.0 / GLB (Khronos) |
|---|---|---|
| Geometry | Vertices, faces, groups/objects, UVs, normals | Meshes, primitives, accessors, scene graph |
| Materials | Phong-style: `Ka`/`Kd`/`Ks`/`Ns`, dissolve `d`, optional maps (`map_Kd`, `map_Ks`, `bump`, etc.) ([LOC MTL FDD](https://www.loc.gov/preservation/digital/formats/fdd/fdd000508.shtml); [Paul Bourke MTL reference](https://paulbourke.net/dataformats/mtl/index.html)) | Core **metallic-roughness PBR**: baseColor, metallic, roughness, normal, occlusion, emissive; plus extensions (clearcoat, sheen, transmission, volume, …) ([Khronos glTF PBR](https://www.khronos.org/gltf/pbr)) |
| Texture packing | Separate image files next to `.mtl` | Often packed into GLB; recommended KTX2/Basis or WebP in commerce pipelines ([glTF-Transform CLI](https://gltf-transform.dev/cli); Khronos 3D Commerce guidelines) |
| Catalog color fidelity | Depends on exporter/renderer approximations | Designed for consistent PBR; Khronos **PBR Neutral** tonemap for e-commerce fidelity ([Khronos PBR page](https://www.khronos.org/gltf/pbr)) |
| Animation / morph / instancing | Limited / nonstandard | First-class in glTF ecosystem |
| Web delivery | Multi-file; no standard Draco/KTX2 story | Single GLB + `KHR_draco_mesh_compression` / `KHR_meshopt_compression` |

**Implication:** An OBJ export that “looks fine” in CAD/DCC does **not** automatically look correct under glTF PBR. Diffuse (`map_Kd`) can map roughly to baseColor; specular/gloss (`Ks`/`Ns`) must be **converted or re-authored** into metallic/roughness (lossy). Nonstandard “PBR MTL extensions” (`Pr`/`Pm`/etc.) are **not** the Wavefront baseline — treat as Unknown unless the furniture company’s exporter documents them and converters consume them.

### Multipart products (chair wood + plastic handles + wool pillow)

OBJ supports multiple materials via `usemtl` / groups / objects. That is the right *geometry* pattern. For Room Vibez (and for Planner 5D-class catalogs), **one sellable SKU should usually ship as one OBJ package with separate meshes/groups per independently customizable / BOM-relevant part**, each with its own material + UVs — not one merged mesh with one texture atlas that paints wood, plastic, and wool together.

Evidence from Planner 5D’s own import guidance (same principle applies to an owned pipeline): *“Planner 5D applies colors and textures to individual meshes — each mesh is treated as a separate material area… Create a separate mesh for every part… that should be customizable independently”* ([Admin Tool – 3D model preparation](https://planner5d.com/business/help-admin-tool)).

**Recommended product breakdown (chair example):**

| Mesh / group name | Material role | Typical maps |
|---|---|---|
| `chair_frame_wood` | Wood finish slot | baseColor (+ optional normal/roughness after convert) |
| `handles_plastic` | Plastic slot | baseColor / roughness |
| `pillow_wool` | Fabric slot | baseColor / normal / sheen (sheen is glTF extension — Unknown if needed at MVP) |

**One OBJ vs many OBJs:** Prefer **one product OBJ** (or one archive) with named groups for assembly, transform, and BOM. Separate OBJs per part are OK for manufacturing but cost more glue work (pivots, relative transforms, collision). **Unknown:** whether the furniture company’s DCC can export named groups reliably — ask them to prove with a sample chair.

### Conversion farm → GLB + Draco/meshopt + KTX2 + LOD

```text
OBJ (+ MTL + textures)
    → validate (size, missing maps, UV presence, units)
    → convert to glTF/GLB   (e.g. CesiumGS obj2gltf — https://github.com/CesiumGS/obj2gltf)
    → optimize              (gltf-transform: weld/dedup/prune; Draco OR meshopt; texture compress; simplify LODs)
    → validate              (gltf-validator + size/tris gates)
    → register              (asset_id ↔ sku_id ↔ material slots ↔ BOM lines ↔ CDN URIs)
```

| Stage | Practice | Source |
|---|---|---|
| Convert | OBJ → glTF/GLB | [CesiumGS obj2gltf](https://github.com/CesiumGS/obj2gltf) |
| Optimize | `gltf-transform optimize` / `draco` / `meshopt` / `etc1s`/`uastc` / `webp` / `simplify` | [glTF-Transform CLI](https://gltf-transform.dev/cli) |
| Compress geometry | Draco **or** meshopt (pick one strategy per asset class; don’t casually stack without measuring) | Khronos `KHR_draco_mesh_compression`, `KHR_meshopt_compression` |
| Compress textures | KTX2/Basis (ETC1S/UASTC) or WebP | glTF-Transform; Khronos 3D Commerce |
| LOD budgets | Planning-tool tier ≈ **40k tris / item**, **1 MB**, **1K** maps when many items share a room | [Khronos 3DC Publishing Targets](https://github.com/KhronosGroup/3DC-Asset-Creation/blob/main/asset-creation-guidelines-1.0/full-version/sec99_PublishingTargets/PublishingTargets.md) |
| Single-item catalogue | Up to ~150k tris / 3 MB / 2K (mobile AR / 3D web catalogue row) | Same Khronos table |

**Room Vibez recommendation:** Own this farm from day one even if the room editor is white-label later. Catalog economics and exit cost live here.

### BOM linkage implications

OBJ has **no BOM**. Linkage is metadata you invent:

1. Stable `group` / mesh names in OBJ → `material_slot_id`  
2. `material_slot_id` → allowed finishes (materials DB)  
3. Optional: removable parts (pillow) → optional BOM lines / accessories  
4. Whole product → `sku_id` (+ variants if finishes change SKU)

If the furniture company merges everything into one mesh / one material, you cannot:

- Swap only the pillow fabric  
- Price handles as an accessory  
- Show accurate part-level BOM  

**Unknown:** Whether their BOM is sellable SKUs only vs parts/cut-list (open question in prior research).

### Recommended export checklist for the furniture company

Give them this as the Room Vibez **OBJ ingest standard** (efficient path to GLB):

1. **Package:** `ProductSKU/` with `ProductSKU.obj`, `ProductSKU.mtl`, and textures in `textures/` (relative paths only; no absolute Windows paths).  
2. **Units:** meters (or declare cm explicitly in a sidecar README); apply scale before export.  
3. **Pivot:** bottom on ground, centered on origin, +Y or +Z up — **pick one axis convention and document it** (Unknown which their DCC defaults to).  
4. **Meshes:** one mesh/group per independently finished or BOM-relevant part; clear names (`frame_wood`, `handle_plastic`, `cushion_fabric`).  
5. **One material per mesh** (matches Planner 5D guidance and simplifies slot mapping).  
6. **UVs:** non-overlapping (or intentional atlas), no severe stretch; every textured mesh has UVs.  
7. **Textures:** power-of-two preferred; ship **baseColor/diffuse** as PNG/JPEG; if they have PBR maps (normal, roughness, metallic, AO), export them as separate files with naming convention `*_basecolor`, `*_normal`, `*_roughness`, `*_metallic`, `*_ao` — even if classic MTL cannot fully express them (sidecar maps beat silent loss).  
8. **MTL minimum:** `newmtl` + `Kd`/`map_Kd` for every material; opacity via `d`/`map_d` where needed.  
9. **No embedded proprietary shaders**; no missing texture references.  
10. **Target poly:** aim toward Khronos planner tier (~40k tris) for room-placed items; hero PDP assets may be heavier then simplified in farm.  
11. **LOD sources (optional):** if they can export `_LOD0` / `_LOD1` / `_LOD2`, do it; else farm generates via `simplify`.  
12. **Sample gate:** deliver one multi-material chair package for pipeline QA before bulk.

### Risks if they ship bad UVs / no MTL

| Failure | User-visible result | Cost |
|---|---|---|
| No MTL / missing `map_Kd` | Gray plastic look; wrong brand colors | Re-export or manual material authoring |
| Broken texture paths | Same as missing maps | Ops thrash |
| No / bad UVs | Stretching, seams, “smeared wood” | Cannot fix reliably in farm without re-unwrap |
| One mesh, one material | Cannot configure wood vs plastic vs wool independently | Blocks configurator + part BOM |
| Huge unoptimized meshes / 8K maps | Slow rooms, mobile OOM | Must downscale/simplify; visual QA risk |
| Wrong units/pivot | Floating furniture, wrong BOM dimensions | Manual fix or reject |

---

## Q2 — Three.js + Babylon.js dual-engine?

### Pros / cons: dual runtime vs single

| Approach | Pros | Cons |
|---|---|---|
| **Single engine** (Three **or** Babylon) | One material/lighting mental model; one loader/LOD stack; one hiring/skill path; smaller bundle & QA surface | Must accept that engine’s gaps |
| **Dual** (Three for “simple”, Babylon for “heavy”) | Theoretical best-tool-per-job | **Two** PBR/IBL pipelines, two inspectors, two loader quirks, duplicated editor systems, harder white-label exit, higher regression cost |

Neither Three.js nor Babylon.js publishes an official “use Three for light / Babylon for heavy” split. Treat dual-engine as an **architecture choice**, not a vendor recommendation.

### What each engine actually is (docs / official site — no benchmarks invented)

| Engine | Official positioning (high level) | Notes relevant to Room Vibez |
|---|---|---|
| **Three.js** | JavaScript 3D library ([threejs.org](https://threejs.org/)) | You assemble scene graph, materials, editor UX. Large ecosystem; many AEC/commerce tools sit on Three (That Open, Speckle viewer lineage, Roomle Rubens — per prior research citations). |
| **Babylon.js** | Full web rendering **engine** with playground, inspector, materials, GUI, XR, etc. ([babylonjs.com](https://www.babylonjs.com/)) | Batteries-included. Official site showcases interior/configurator experiences (e.g. Target College Room Planner, Macy’s 3D Room Planner, MillerKnoll chair configurator — listed on Babylon home as notable experiences). **Not** a claim that Room Vibez must use Babylon; only that Babylon is proven in adjacent product classes. |

**Unknown / do not invent:** FPS comparisons, poly limits, or “Babylon is X% faster.” Profile *your* scenes after a spike.

### Proposed splits people discuss — do they make sense for Room Vibez?

| Split idea | Sense for Room Vibez? | Why |
|---|---|---|
| Three = product cards; Babylon = full room editor | Weak | Two stacks for one catalog of GLBs; prefer **model-viewer**/lightweight Three for PDP if needed, one room engine |
| Three = 2D plan overlay; Babylon = 3D | Weak | 2D plan should share the **same room graph**; engine dualism doesn’t help wall editing |
| Three = consumer; Babylon = designer “pro” mode | Weak | Duplicate feature parity forever |
| Babylon only (engine systems) **or** Three only (library + R3F) | **Strong** | Matches ownership + cost-at-scale criteria from the brief |
| Separate CAD viewer (ODA / APS) + one mesh engine | **Strong** | Different problem (DWG) — not Three vs Babylon |

### Recommendation

**Pick one realtime mesh engine for all GLB room/catalog UX.** Dual Three+Babylon is not justified by public docs for this product shape.

Default aligned with prior stack research: **Three.js** if you want max OSS/ecosystem overlap with AEC viewers and thinner DIY; **Babylon.js** if the team wants an engine with Inspector/GUI/XR and likes its configurator precedent. Either must speak **glTF PBR** well (both do in practice; Khronos lists PBR Neutral adoption including Three.js and Babylon.js on the [PBR page](https://www.khronos.org/gltf/pbr)).

### Decision grill for Chong (Q2)

1. Does the team already ship production code in Three, Babylon, or neither?  
2. Is the V1 editor **owned** or **white-label** (Planner 5D iframe)? If white-label, engine choice can wait for the owned runtime phase — don’t dual-invest now.  
3. Do we need React Three Fiber specifically, or is vanilla/engine GUI fine?  
4. Will architect DWG mode be a **separate viewer** (ODA/APS) anyway? (If yes, that removes a reason to “need Babylon for CAD.”)  
5. Bundle/mobile budget: are we optimizing for shoppers on mid phones? (Argue for **one** optimized path.)  
6. Can we staff one engine deeply for 12+ months? If not, dual is a non-starter.

**Open decision:** Single Three vs single Babylon vs defer (white-label first). **Not** dual.

---

## Q3 — ODA Drawings inWEB for Room Vibez

**Use case framing:** Architects interact with DWG; materials/lights/furniture live elsewhere (room graph + GLB). Matches brief: DWG interaction + light browser UX for non-architects.

### What ODA documents

| Claim | Source |
|---|---|
| Drawings inWEB: create, edit, view, save DWG/DXF in browser via WASM; JS API; private cloud / Azure / AWS deploy; no third-party CAD service required for the SDK itself | [ODA announcement Oct 2024](https://www.opendesign.com/blog/2024/october/drawings-inweb-sdk-oda); [Drawings product](https://www.opendesign.com/products/drawings) |
| Features listed: zoom/pan/orbit, primitives, constraints, dynamic blocks, fonts, incremental save, MT loading, recover, etc. | Same announcement |
| Web/SaaS redistribution requires **Sustaining** or **Founding** membership (Commercial: Web/SaaS = No) | [ODA Membership](https://www.opendesign.com/oda-membership); [2026 pricing PDF](https://www.opendesign.com/agreements/2026/en/ODA%20Membership%20&%20Extension%20pricing.pdf) |
| Sustaining list price (public page/PDF): first year **$7,500**, renewal **$4,500** (company membership, not per developer) | Same |
| DrawingWeb docs state **beta / not intended for ready-made production**; docs incomplete; use desktop Drawings SDK docs as stand-in | [DrawingWeb Documentation](https://cloud.opendesign.com/docs/drawingapi/index.html) |
| Drawings inWEB supports DWG/DXF for now (datasheet: broader Drawings SDK also does DGN etc.) | [Drawings Datasheet PDF](https://www.opendesign.com/datasheets/2025/en/Drawings%20Datasheet.pdf) |

**Unknown:** Exact production readiness date; full feature parity with desktop Drawings SDK; mobile browser performance for large architectural sheets; whether interior “materials/lights” workflows are in scope (ODA is CAD-centric — assume **no** commerce PBR editor inside inWEB).

### Pros / cons for Room Vibez

| Pros | Cons |
|---|---|
| True DWG round-trip in browser (create/edit/save) | Membership cost + Sustaining floor for SaaS |
| Private deployment (data residency) | CAD UX≠ consumer/designer room UX |
| Avoids sending DWG to Autodesk cloud if that is a blocker | WASM weight; architect-only audience |
| Aligns with “architect mode” module | Official web docs still beta-labeled — schedule risk |
| Complements mesh editor instead of replacing it | You still build materials/lights/BOM on GLB side |

### vs Autodesk APS Viewer + Model Derivative

| | **ODA Drawings inWEB** | **APS Model Derivative + Viewer** |
|---|---|---|
| Primary job | Native DWG edit/view in your web app | Translate designs → SVF/SVF2; view in Viewer SDK; extract hierarchy/properties; optional partial OBJ | 
| Edit DWG | Yes (per ODA) | Viewer is view/interact — **not** positioned as full AutoCAD edit |
| Hosting | Private cloud possible | Autodesk Platform Services (cloud translation) |
| Outputs | DWG/DXF stay native | Derivatives: SVF/SVF2, thumbnails; field guide also lists DWG/FBX/IFC/OBJ/… as derivative output types ([Model Derivative field guide](https://aps.autodesk.com/en/docs/model-derivative/v2/developers_guide/field-guide); [Viewer SDK](https://aps.autodesk.com/developer/overview/viewer-sdk)) |
| Pricing | ODA membership (public tiers above) | **Unknown** in this memo — APS is usage/subscription based; get quote |
| Fit | Architect DWG workspace | Architect **view** + metadata; gateway to meshes |

### vs hybrid DWG → derived room graph only (recommended default in prior research)

```text
DWG (source of truth for architects)
   → server parse (ODA Drawings SDK server-side OR APS)
   → walls / openings / rooms as lightweight JSON
   → browser edits room graph + places GLB furniture
   → materials / lights on mesh runtime
```

| Pros | Cons |
|---|---|
| Light consumer/designer UX | Two representations to sync |
| Poly budgets work | Not full DWG editing for architects |
| Materials/lights owned | Some CAD fidelity loss |

### Decision options for Chong (pick A / B / C — no decision pretended)

**Option A — Hybrid only (no native DWG editor in V1–V2)**  
DWG/DXF ingest on conversion farm → editable room graph + GLB. Architects download/upload DWG via desktop CAD.  
*Best when:* data residency OK with your farm; round-trip DWG edit not required; fastest multi-sided MVP.

**Option B — APS for architect view + hybrid mesh for design/commerce**  
Use Model Derivative + Viewer for DWG review/metadata; room edit stays on owned/SDK planner.  
*Best when:* Autodesk fidelity/metadata matter; comfortable with APS cloud + commercial terms (**pricing Unknown here — obtain quote**).

**Option C — ODA Drawings inWEB as Architect Mode + hybrid/mesh elsewhere**  
Sustaining membership; embed inWEB for DWG create/edit/save; keep materials/lights/furniture in Room Vibez mesh editor. Treat inWEB as **beta-risk** until ODA removes that label in docs.  
*Best when:* private DWG edit is a hard requirement; team can absorb CAD UX + membership.

**Grill unknowns before picking:** Must architects **save DWG back**? Data residency ban on Autodesk cloud? Sheet size / xref complexity? Budget for Sustaining vs APS usage?

---

## Q4 — Planner 5D deep feature check

Sources: [B2B API technical overview](https://support.planner5d.com/en/articles/15189751-planner-5d-b2b-api-technical-overview), [Admin Tool user guide](https://planner5d.com/business/help-admin-tool), [Business page](https://planner5d.com/business), [Configurator page](https://planner5d.com/configurator), [3D catalogue page](https://planner5d.com/business/3d-product-catalogue). Full endpoint schemas are **behind signing** — mark Unknown where only marketing language exists.

### Capability matrix (named Room Vibez concerns)

| Concern | What public docs confirm | Gap / Unknown |
|---|---|---|
| **Room editor** | White-label embed via iframe; JS API: sessions, 2D/3D view mode, project open, UI config, cart events, product list from session | Exact wall-edit feature list in API terms: **Unknown** (product has room planner; detailed editor ops not in public overview) |
| **Model manager** | Admin Tool Product List: upload, review/configure, submit, publish; analytics (tris, materials, textures, dimensions) | Internal processing rules: partially documented in prep guide |
| **Texture / materials manager** | Materials tab: replace textures, change colors; prep guide: mesh = material area; UV requirements | Whether full PBR map sets (metallic/roughness/normal) are first-class in Admin: **Unknown** (docs emphasize color/texture/base color) |
| **Template manager** | **Unknown** as a named “template manager” in Admin/API overview | Business pages discuss AI room designer / auto-furnish as add-on — not the same as user template CMS |
| **SKU manager** | CSV columns for SKU Number, name, links, price, availability, category; REST catalogue access returns SKU metadata/thumbnails | Variant matrix UI depth: marketing says variants supported; exact multi-SKU BOM rules: **Unknown** without signed docs |
| **BOM manager** | **No public doc of a dedicated “BOM manager.”** Integration path: cart listener + product list payload → your cart/CRM/ERP; project metrics (floor area, item counts/dimensions) for pricing logic | Part-level BOM, cut-lists, accessory explosions: **Unknown** — plan to **own BOM** in Room Vibez and treat Planner product list as placement output |

### Multi-material / configurable products (wood chair + plastic handles + wool pillow)

**What Planner 5D documents clearly:**

- Independently customizable parts **must be separate meshes**, one material each ([Admin Tool – How editable areas are created](https://planner5d.com/business/help-admin-tool)).  
- Chair-like example in their docs uses separate meshes for seat / backrest / legs.  
- Category/model settings can enable/disable **Materials** (and Position/Rotation/Size/Built/Show in catalog).  
- Business/configurator marketing: products can change by size, finish, material, module, accessory, rule-based logic; specs/SKUs/qty/price can hand off to cart/CRM/ERP ([configurator](https://planner5d.com/configurator), [business](https://planner5d.com/business)).

**What is Unknown without signed API docs / scoping call:**

- Whether removable pillow is a **separate catalog SKU**, a **configurator accessory**, or only a material slot.  
- Rule engine limits (compatibility, price formulas).  
- Whether one uploaded OBJ with three meshes is enough for commerce-grade configuration or needs Planner’s professional modeling service.

**Practical mapping for the chair:**

| Part | Export as | Planner-side treatment (documented pattern) |
|---|---|---|
| Wood frame | Mesh `frame_wood` | Material-customizable area |
| Plastic handles | Mesh `handles_plastic` | Separate material area |
| Wool pillow | Mesh `pillow_wool` **or** separate SKU if sold alone | Material area or add-on product — **decide with Planner scoping** |

### Brief compare: Roomle Rubens / Coohom (multi-material only)

| Vendor | Documented multi-material approach | Source |
|---|---|---|
| **Roomle Rubens** | Convert static product → Level 2 **material configurator**; parameters come from 3D **layers**; materials assigned via **tags** to parameter groups; deeper logic via Roomle Script components | [Convert to material configurator](https://docs.roomle.com/rubens/quick-start-guides/convert-your-static-product-into-a-material-configurator); [configuration types](https://docs.roomle.com/rubens/rubens-sdk/rubens-configurator/different-types-of-configurations) |
| **Coohom** | Help center: select model → Material Editor → select **part** (click or Location panel) → assign material | [Change the model material](https://www.coohom.com/helpcenter/model-materials-change-the-model-material) — UI doc; OpenAPI depth for the same: treat as **Unknown** unless open.coohom endpoints are reviewed in a dedicated pass |
| **Planner 5D** | Mesh-per-area materials in Admin; configurator marketing for modules/accessories | Admin Tool + business pages above |

**Takeaway:** All three expect **part-aware meshes** (or layers). OBJ-only is fine **if** the furniture company splits meshes. Room Vibez should still **own** SKU↔slot↔BOM truth even when using a vendor editor.

---

## Q5 — AI floor-plan / sketch flow (end-to-end)

### User steps (recommended product pattern)

1. User creates a project → chooses **Upload plan** (PDF / DWG / DXF / JPG / PNG) or **Draw manually**.  
2. System shows upload progress → **async job** (“Recognizing walls…”).  
3. On completion, show **overlay**: detected walls/openings on top of the source image (or vector).  
4. User **confirms / edits** polylines, wall thickness, room labels, scale (set known dimension).  
5. System extrudes confirmed 2D graph → 3D room shell.  
6. User places catalog items; materials/lights as usual.  
7. Optional: re-run recognition or replace source file → new draft, keep human edits where possible.

### What AI does vs what humans must do

| AI / automation | Human confirm (mandatory) |
|---|---|
| Detect wall lines / junctions | Fix missed/extra walls |
| Guess doors/windows/icons | Correct openings |
| Segment rooms / labels (when model supports) | Rename rooms; merge/split |
| Propose scale from drawing annotations (**often unreliable**) | Enter one known length |
| Vendor path: return editable 3D project | Review before commerce / construction use |

### Confidence & failure modes

| Failure mode | Typical cause | Mitigation |
|---|---|---|
| Missing walls | Hand-drawn, low contrast, cluttered title blocks | Manual draw tool always available |
| Extra walls | Furniture lines, hatching, dimensions mistaken as walls | Overlay delete; confidence thresholds |
| Wrong openings | Icons outside training distribution | Snap/edit openings |
| Bad scale | No calibrated dimension | Dimension confirm UX |
| Domain shift | Model trained on Nordic CAD-style rasters (CubiCasa lineage) vs commercial sheets | Expect drop; fine-tune later |
| Liability | User treats AI dims as survey-grade | Copy: “Draft only — verify measurements” |

### PDF / DWG / JPG / PNG differences

| Input | Better automatic path | Notes |
|---|---|---|
| **DWG / DXF** | Vector parse (ODA/APS) **or** vendor AI that accepts CAD | Prefer geometry over vision when possible |
| **PDF** | If vector: extract paths; if scanned: rasterize → vision AI | Mixed difficulty — detect type |
| **JPG / PNG** | Vision segmentation / keypoint models | CubiCasa-class research; vendor recognition APIs |
| **Planner 5D AI** | Docs: JPEG, PNG, PDF, DWG, DXF → structured editable 3D project; **async**; **usage-priced separately** | [B2B API overview](https://support.planner5d.com/en/articles/15189751-planner-5d-b2b-api-technical-overview) |

### Reliable approaches / models / vendors (cited)

| Approach | What it is | Citation |
|---|---|---|
| **Planner 5D AI floor plan recognition** | Enterprise API capability; submit image/CAD; poll; get editable project | Planner 5D B2B API overview |
| **CubiCasa5K research stack** | 5k annotated floorplans; multi-task CNN (rooms, icons, interest-point heatmaps) → polygon post-process | [arXiv:1904.01920](https://ar5iv.labs.arxiv.org/html/1904.01920); [CubiCasa5k GitHub](https://github.com/CubiCasa/CubiCasa5k) |
| **Open derivatives / community models** | Implementations and HF datasets building on CubiCasa | e.g. community repos/datasets — treat quality as **research**, not SLA |
| **Manual trace baseline** | Always ship | Requirements brief: automatic + manual |

**Do not conflate** with LiDAR scan-to-plan apps (different input modality).

### Interaction UX patterns

| Pattern | When |
|---|---|
| **Async job + poll/webhook** | All server/GPU or vendor recognition (Planner 5D documents async) |
| **Overlay edit** | Always — treat AI output as draft geometry |
| **Dimension confirm** | Before extrude / area metrics / quotes |
| **Side-by-side source vs 3D** | Builds trust; speeds correction |
| **Confidence heat (optional)** | Only if model exposes scores — else skip fake meters |

### Limitations in plain language

AI can **draft** a room from a clean residential floor-plan image or help ingest CAD. It will **fail** on messy sketches, unusual drawing standards, and poor scans. It does **not** replace surveying. Dimensions used for quotes or construction need a human-entered scale check. The reliable product is: **manual edit is the product; AI is acceleration.**

---

## Open decision prompts (Chong)

### Dual-engine (from Q2)

- Single **Three.js**, single **Babylon.js**, or **defer** until after white-label MVP?  
- Confirm: no dual runtime unless a spike proves an unshared capability (unlikely for GLB rooms).

### ODA / DWG (from Q3)

- Pick **A Hybrid / B APS+hybrid / C ODA inWEB+hybrid**.  
- Hard requirements checklist: DWG round-trip? Private cloud? Budget for ODA Sustaining vs APS quote?

### OBJ pipeline (from Q1)

- Approve furniture-company export checklist as contract for catalog onboarding?  
- Own conversion farm in P0 — yes/no?

### Planner 5D (from Q4)

- Accept Planner as room shell while Room Vibez owns BOM?  
- Schedule signed-doc review for template manager + part-level configuration rules?

### AI sketch (from Q5)

- V1: manual-only vs vendor AI assist?  
- Who owns dimension liability in ToS?

---

## Sources

### Formats / pipeline
- [Khronos glTF PBR](https://www.khronos.org/gltf/pbr)  
- [glTF 2.0 Specification](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html)  
- [Library of Congress — MTL format](https://www.loc.gov/preservation/digital/formats/fdd/fdd000508.shtml)  
- [Paul Bourke — MTL reference](https://paulbourke.net/dataformats/mtl/index.html)  
- [CesiumGS obj2gltf](https://github.com/CesiumGS/obj2gltf)  
- [glTF-Transform CLI](https://gltf-transform.dev/cli)  
- [Khronos 3D Commerce Publishing Targets](https://github.com/KhronosGroup/3DC-Asset-Creation/blob/main/asset-creation-guidelines-1.0/full-version/sec99_PublishingTargets/PublishingTargets.md)

### Engines
- [threejs.org](https://threejs.org/)  
- [babylonjs.com](https://www.babylonjs.com/)

### DWG / CAD
- [ODA Drawings inWEB announcement](https://www.opendesign.com/blog/2024/october/drawings-inweb-sdk-oda)  
- [ODA Drawings product](https://www.opendesign.com/products/drawings)  
- [ODA Membership / pricing](https://www.opendesign.com/oda-membership) · [2026 pricing PDF](https://www.opendesign.com/agreements/2026/en/ODA%20Membership%20&%20Extension%20pricing.pdf)  
- [DrawingWeb docs (beta notice)](https://cloud.opendesign.com/docs/drawingapi/index.html)  
- [Drawings Datasheet PDF](https://www.opendesign.com/datasheets/2025/en/Drawings%20Datasheet.pdf)  
- [APS Model Derivative overview](https://aps.autodesk.com/developer/overview/model-derivative-api) · [Field guide](https://aps.autodesk.com/en/docs/model-derivative/v2/developers_guide/field-guide)  
- [APS Viewer SDK](https://aps.autodesk.com/developer/overview/viewer-sdk)

### Planner 5D / peers
- [Planner 5D B2B API technical overview](https://support.planner5d.com/en/articles/15189751-planner-5d-b2b-api-technical-overview)  
- [Admin Tool user guide](https://planner5d.com/business/help-admin-tool)  
- [Planner 5D Business](https://planner5d.com/business) · [Configurator](https://planner5d.com/configurator) · [3D catalogue](https://planner5d.com/business/3d-product-catalogue)  
- [Roomle — material configurator conversion](https://docs.roomle.com/rubens/quick-start-guides/convert-your-static-product-into-a-material-configurator)  
- [Coohom — change model material](https://www.coohom.com/helpcenter/model-materials-change-the-model-material)

### Floor-plan AI
- CubiCasa5K paper [arXiv:1904.01920](https://ar5iv.labs.arxiv.org/html/1904.01920) · [GitHub](https://github.com/CubiCasa/CubiCasa5k)  
- Planner 5D AI recognition (same B2B API overview)

### Internal
- `internal/room-vibez-requirements-brief.md`  
- `docs/platform-stack-research.md`  
- `internal/followup-obj-engines-planner-ai.md`
