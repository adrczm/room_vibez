# Room Vibez — Platform Stack Research & Advisory

**Document type:** Deep research + architecture advisory  
**Date:** 2026-10-01  
**Authority for product facts:** `internal/room-vibez-requirements-brief.md` only  
**Coohom notes:** Observation context only — not a Room Vibez specification  
**Unknowns:** Explicitly labeled; do not treat as product commitments

---

## 1. Executive recommendation

**Ship a near-ready white-label / API-backed MVP for room edit + catalog commerce, while owning the runtime mesh/material/BOM core and the conversion farm from day one; migrate editor ownership phase by phase.**

Aligned to the brief’s decision criteria (ownership, quality, cost at scale, customization, faster MVP via near-ready then migrate):

| Criterion | Recommendation |
|---|---|
| Faster MVP | Embed / white-label a proven room planner (e.g. Planner 5D B2B, Coohom OpenAPI, Roomle Rubens) for 2D/3D room edit + floor-plan ingest; keep your SKU/BOM and auth as system of record |
| Long-term ownership | Canonical runtime format = **glTF 2.0 / GLB** (PBR); own catalog DB, materials DB, scene graph, conversion jobs, and BOM; treat white-label as a replaceable UX shell |
| Quality | Real-time browser preview on Three.js or Babylon.js with Draco/meshopt + KTX2 + LODs; optional still renders later; use Khronos PBR Neutral tone mapping for catalog color fidelity |
| Cost at scale | Prefer **client WebGL** for consumer preview and designer edit; use **backend conversion** for DWG/IFC/OBJ/PDF; avoid Unreal Pixel Streaming for default traffic (GPU-per-session cost) |
| Customization | Prefer SDK (custom UI) over iframe-only where available (Roomle Rubens SDK, Coohom Viewer SDK); plan exit path to owned editor |

**Do not** attempt native full DWG editing inside the consumer browser as the primary UX. Native DWG-in-browser edit exists mainly via commercial SDKs (ODA Drawings inWEB) or Autodesk APS (view/derivative-centric). For Room Vibez’s multi-sided interior use case, the evidence-backed pattern is: **DWG as source → server derive walls/meshes → edit a lightweight room graph + GLB catalog in browser**.

---

## 2. Requirements restatement (from brief only)

Source: `internal/room-vibez-requirements-brief.md` (user-stated, 2026-10-01).

### Product
- Bridges customers buying/managing interior products, interior designers, architects, and resellers.
- MVP V1: full room editor + materials/lights + models DB (not upload-only).

### Assets & data
- 3D models + materials + BOM owned by furniture/interior-design company client → assume no third-party license friction for those assets.
- Lights: beautify renders; generic starting light OK.
- Formats of existing assets: **unknown** — research must recommend pipelines and ask what they can export.

### File / BIM
- Target: OBJ; DWG for interaction; BIM workflows (not a `.bim` file type); `.swg` was typo.
- Users must manipulate elements, add objects, control materials and lights on DWG-origin content.
- Prefer approaches that keep browser UX light; poly limits OK per use case if researched.

### Editor
- Both 2D floor plan and direct 3D.
- Sketch→room: PDF, DWG, JPG, PNG; want automatic wall detection + manual trace; advise on AI assist.
- Preview: real-time required; still renders optional.

### Constraints / decision criteria
- Browser-only vs backend conversion farm: advise from use cases.
- Budget: report full requirements; team will prioritize later.
- No hard vendor bans — explore all options with detailed pros/cons.
- Optimize for: long-term ownership, quality, cost at scale, future customization.
- Open to near-ready MVP solution with customization now; full owned stack later when budget allows.

---

## 3. Recommended reference architectures (3 options)

### Option A — API-heavy / white-label MVP (fastest path)

```text
[Client web app: auth, commerce, BOM, projects]
        │ iframe / JS SDK
        ▼
[White-label room planner]
  Planner 5D B2B | Coohom OpenAPI | Roomle Rubens
        │
        ├── floor plan AI (vendor)  ← JPG/PNG/PDF/DWG ingest
        ├── catalog sync API        ← your SKUs / materials
        └── project export JSON     ← BOM + placements

[Your backend]
  users · orders · SKU/BOM · asset registry · CDN
```

**Fit:** Matches “near-ready MVP with customization now.”  
**Risk:** Editor UX and DWG fidelity owned by vendor; exit cost later.  
**Sources:** Planner 5D B2B API overview; Coohom OpenAPI (design-building / e-commerce); Roomle Rubens SDK docs.

### Option B — OSS-hybrid (recommended mid path)

```text
[Browser]
  Three.js / Babylon.js room editor (owned UI)
  glTF/GLB catalog preview (Draco|meshopt + KTX2 + LOD)
  2D floor-plan canvas (walls as first-class geometry)
        │
        ▼
[API + conversion farm]
  OBJ/FBX/USD → GLB pipeline (obj2gltf / Assimp + glTF-Transform)
  DWG → vector walls / mesh (ODA Drawings SDK server OR APS Model Derivative)
  IFC → Fragments / XKT / GLB (That Open web-ifc · xeokit · Speckle import)
  Sketch AI assist (optional GPU job) → editable wall polylines
  Materials DB (PBR maps) · Models DB (SKU↔GLB↔BOM) · Lights presets
        │
        ▼
[Object storage + CDN]
  source files · derived GLB LODs · thumbnails · HDRI
```

**Fit:** Owns editor UX and catalog economics; buys hard CAD/BIM conversion.  
**Risk:** Floor-plan AI and CAD fidelity still need vendor or R&D.  
**Sources:** Khronos glTF + 3D Commerce guidelines; glTF-Transform; That Open Fragments docs; ODA Drawings inWEB / Drawings SDK; APS Model Derivative.

### Option C — More owned core (later phase)

```text
[Owned editor]
  2D plan + 3D scene graph (walls, openings, placements)
  Parametric materials / lights / colliders
  Optional: ODA Drawings inWEB for architect DWG mode
  Optional: That Open Fragments for IFC review
        │
        ▼
[Owned services]
  Conversion farm (queue workers, GPU optional for AI)
  Catalog CMS · BOM engine · quote sync
  Still-render farm (optional: Blender Cycles / proprietary)
```

**Fit:** Maximum ownership and customization when budget allows.  
**Risk:** Highest build cost; do not start here for V1 unless team already has CAD/3D platform experience.

### Phased path (brief-aligned)

| Phase | What to ship | Own vs buy |
|---|---|---|
| **P0 MVP** | Room create (blank + upload sketch), place catalog models, materials swap, generic lights, real-time preview, BOM list | Buy planner shell **or** thin Three.js room + buy conversion; **own** SKU/BOM/auth |
| **P1** | Designer-grade edit, material catalogs, light presets, LOD/CDN pipeline, reseller catalog admin | Own conversion farm + materials DB; keep or deepen SDK |
| **P2** | Architect DWG/IFC workflows, AI wall assist with human confirm, optional still renders | ODA/APS/That Open modules; optional replace white-label editor |
| **P3** | Full owned editor if vendor limits block differentiation | Migrate scene format → your room graph + GLB |

---

## 4. Topic deep dives

### 4.1 3D model upload pipelines

**Goal:** Validate → convert → optimize → store → link to BOM/SKU.

| Stage | Practice | Sources / notes |
|---|---|---|
| Ingest | Accept source formats client can export (ask them); prioritize OBJ (+MTL/maps), FBX, glTF/GLB, USD/USDZ | Brief: formats unknown |
| Validate | File size, extension allowlist, virus scan, mesh sanity (non-manifold optional warn), missing textures | Ops best practice |
| Normalize | Convert to **glTF 2.0 / GLB** as runtime canonical | Khronos: glTF is the delivery format for web/realtime commerce |
| Optimize | Weld/dedup/prune; Draco **or** meshopt (not both casually); KTX2/Basis or WebP textures; generate LODs | glTF-Transform CLI; KHR_draco / KHR_meshopt |
| Store | Source + derived LODs on object storage; content-addressed hashes; CDN | Standard |
| BOM linkage | `sku_id` ↔ `asset_id` ↔ `glb_uri[]` ↔ material slots ↔ price/qty rules | Product requirement (models DB + BOM) |

**Pipeline sketch (evidence-based tooling):**

1. Upload source → quarantine bucket  
2. Worker: `obj2gltf` / Assimp / vendor CAD converter → raw GLB  
3. `gltf-transform optimize` (meshopt or draco + texture compress + resize)  
4. Emit LOD0/1/2 + thumbnail  
5. Register in Models DB with SKU/BOM metadata  

**Unknown:** Client’s native export formats, units, and whether materials are embedded PBR or proprietary shaders.

---

### 4.2 Browser 3D preview / rendering

#### Efficient patterns (industry standard)

| Pattern | Why | Source |
|---|---|---|
| Deliver **GLB** for commerce | Single file, web-friendly | Khronos 3D Commerce Asset Creation Guidelines |
| Compress geometry | Draco: max static compression; meshopt: fast decode + morph/animation | Khronos KHR_draco, KHR_meshopt; Needle gltf-progressive docs |
| Compress textures | KTX2/Basis (GPU-native) or WebP | Khronos guidelines; glTF-Transform |
| LODs | Discrete LODs; prefer screen-density / coverage over distance-only | Khronos LOD explainer; Needle progressive |
| Instancing | Repeat chairs/lights via GPU instancing / EXT_mesh_gpu_instancing | glTF extension ecosystem |
| Progressive load | Low LOD + low-res textures first | Needle / commerce practice |
| Texture budgets | Power-of-two; 1K–2K per map by target; ORM packed maps | Khronos publishing targets |
| Tone mapping | Khronos **PBR Neutral** for catalog color fidelity | Khronos blog (Google Store / PBR Neutral, 2024) |

#### Engine comparison (this multi-sided interior use case)

| Engine | Pros | Cons | Fit for Room Vibez |
|---|---|---|---|
| **Three.js** | Largest ecosystem; React Three Fiber; easy glTF; That Open / Speckle / Roomle also Three-based — talent & OSS reuse | You assemble editor systems yourself | **Strong default** for owned editor + catalog |
| **Babylon.js** | Full engine: materials, GUI, XR, Inspector; good PBR/IBL | Larger bundle; less “React-native” ecosystem than R3F | Strong if team wants batteries-included engine |
| **PlayCanvas** | Cloud visual editor; team collab; used in interactive interiors | Editor SaaS coupling; community smaller; historically tight poly guidance for interiors (~150k scene cite in studio writeups — treat as practice note, not standard) | Good for marketing scenes / product stages; weaker as full multi-sided SaaS core |
| **Filament (WASM)** | Excellent PBR; used in Google Store via model-viewer lineage | Not a full room-editor framework; WASM weight; thinner editor tooling | Great for **SKU product viewers**; not primary room editor |
| **model-viewer** | Drop-in product display + AR | Not an editor | PDP / reseller product cards |
| **Unity WebGL** | Familiar tooling for game teams | Large downloads, memory limits, mobile pain | Risky for consumer web; possible designer desktop |
| **Unreal Pixel Streaming** | Highest fidelity (Lumen/Nanite on server) | GPU instance per session; latency; cost at scale | Optional **premium still/walkthrough**, not default real-time |

**Recommendation:** Owned runtime on **Three.js** (or Babylon if team prefers engine structure). Use **model-viewer / Filament** only for lightweight product pages. Keep Unreal streaming out of MVP hot path.

---

### 4.3 Materials DB — load / apply (PBR)

| Concern | Guidance | Source |
|---|---|---|
| Material model | glTF metallic-roughness PBR (baseColor, metallicRoughness/ORM, normal, emissive, occlusion) | Khronos glTF 2.0 / 3D Commerce |
| Catalog storage | Material records: maps URIs, tiling, scale, display name, supplier codes, linked SKUs | Brief: materials owned by client |
| Apply in editor | Swap material on mesh / material slot; keep UV tiling consistent | Standard configurator pattern |
| Color accuracy | Author linear workflows; preview with PBR Neutral under controlled IBL | Khronos PBR Neutral |
| Non-PBR sources | Phong/OBJ MTL → approximate conversion (lossy); prefer re-author or bake | Conversion tooling caveats |

**Unknown:** Whether client materials are already PBR map sets or CAD/procedural only.

---

### 4.4 Lights / scenes

Brief: generic starting light OK; beautify renders; still renders optional.

| Phase | Approach |
|---|---|
| MVP | 1–3 directional/point lights + soft ambient **or** single HDRI IBL; fixed camera exposure |
| Next | Named presets (“Showroom”, “Daylight”, “Evening”) = IBL + key/fill/rim recipes |
| Later | Per-fixture photometric lights for designers; optional path-traced stills offline |

Roomle documents light presets keyed by furniture type (e.g. `ls: "shelf"` / `"sofa"`) — useful pattern for catalog configurators ([Roomle Rubens getting started](https://docs.roomle.com/rubens/rubens-sdk/rubens-configurator/getting-started)).

---

### 4.5 3D model DB — editor + commerce

Minimum schema (logical, not prescribed product schema):

- `sku` / `variant` / price / availability  
- `asset` versions (source hash, GLB LODs, thumbnails)  
- `materials` allowed on slots  
- `bom_components` (parts, qty, optional cut-list)  
- `placement_rules` (snap, clearance — optional later)  
- `commerce_hooks` (add-to-cart payload)

Editor loads by SKU → streams LOD1 → upgrades to LOD0. Commerce reads same BOM graph from the project scene.

---

### 4.6 Create rooms from scratch — 2D + 3D patterns

Industry pattern (Planner 5D, Coohom-class tools, Roomle Planner — observational):

1. **2D plan mode:** draw walls as centerline or double-line; set thickness/height; openings as parametric cutters  
2. **Extrude to 3D:** walls become meshes or CSG solids; floor/ceiling slabs  
3. **3D direct mode:** orbit, place catalog items, paint materials, tweak lights  
4. **Single scene graph** shared by 2D and 3D views (avoid dual sources of truth)

**MVP advice:** Treat walls/openings/placements as first-class JSON; render meshes from that graph. Do not store only a triangle soup.

---

### 4.7 Room from architectural sketch (PDF / DWG / JPG / PNG)

| Input | Automatic path | Manual path | Notes |
|---|---|---|---|
| **DWG/DXF** | Server parse geometry → wall candidates | Trace/adjust in 2D | Prefer vector CAD over raster AI when available (ODA / APS) |
| **PDF** | If vector PDF: extract paths; if scanned: rasterize → AI | Manual trace overlay | Mixed difficulty |
| **JPG/PNG** | Semantic segmentation (walls/doors/windows) | Manual polyline trace | Accuracy domain-dependent |

#### AI assist — realistic advisory

| Claim | Evidence | Implication |
|---|---|---|
| Wall segmentation can be high on **in-distribution** plans | CubiCasa5K-trained models report high val mIoU (e.g. Hugging Face floorplan-to-3d-walls self-reports 0.983 on CubiCasa val); MitUNet paper reports ~76% mIoU on CubiCasa test in one config | Good assist for clean residential CAD-style rasters |
| Multiclass / construction drawings harder | WallNetv2 paper ~70% mIoU multiclass walls | Expect failures on commercial sheets |
| Domain shift hurts | HF model card: Nordic CAD style; hand-drawn / different conventions miss elements | Always require **human confirm / edit** |
| Vendor APIs exist | Planner 5D B2B: async AI floor-plan recognition for JPEG/PNG/PDF/DWG/DXF (usage-priced) | Fastest MVP path for sketch→room |
| Scan-to-plan ≠ sketch-to-plan | MagicPlan LiDAR wall mode is device scan, not PDF parse | Don’t conflate |

**Recommendation:** Ship **manual trace** as reliable baseline; add AI as **assist with mandatory review**. Do not promise architectural accuracy from JPG alone.

**Cost/risk:** GPU inference jobs + labeling for domain fine-tune; liability if dimensions trusted for construction without survey. Keep AI output as “draft walls.”

---

### 4.8 Formats: OBJ, DWG interactive, BIM (IFC)

#### OBJ
- Widely exchangeable; poor modern PBR story (MTL is limited).  
- Treat as **ingest**, convert to GLB for runtime.  
- Brief targets OBJ — good as client export ask.

#### DWG interactive — native browser edit is rare

| Approach | What you get | Pros | Cons |
|---|---|---|---|
| **A. Autodesk APS Model Derivative + Viewer** | Server translates DWG→SVF/SVF2; browser views hierarchy/properties; can export partial OBJ | Mature; Autodesk fidelity; metadata | Not a full interior editor; SaaS dependency; licensing/cost; editing is limited vs native CAD |
| **B. ODA Drawings SDK (server) + mesh runtime** | Full DWG read/write on server; derive walls/entities; browser edits room graph + GLB | Private cloud possible; strong DWG fidelity | Membership/licensing; you still build UX |
| **C. ODA Drawings inWEB (WASM)** | Native DWG/DXF create/edit/view in browser (JS API) | Closest to “DWG in browser”; private deploy | Commercial ODA membership; CAD UX ≠ consumer UX; heavy for shoppers |
| **D. Hybrid CAD + mesh (recommended default)** | Keep DWG as **source of truth** for architects; runtime is room graph + GLB | Light browser UX; poly budgets work; materials/lights on mesh side | Two representations to sync |
| **E. That Open / IFC path** | IFC→Fragments; Three.js BIM viewer | Open BIM; good for large buildings | IFC ≠ DWG; interior materials historically weaker than commerce GLB |
| **F. Speckle** | AEC data hub + Three.js viewer; IFC import | Collaboration / connectors | Texture/material support historically limited (community + docs); not a commerce PBR editor |
| **G. xeokit** | High-perf BIM viewer (XKT/GLB), IFC via converters | Large models, double precision | Viewer-centric; license review for commercial |

**Explicit finding:** Full AutoCAD-class DWG editing in a light consumer SPA is uncommon. ODA’s Oct 2024 Drawings inWEB is the clearest “native DWG in browser” SDK announcement; APS is the clearest “view Autodesk derivatives in browser” stack. For Room Vibez multi-sided UX, prefer **D (hybrid)** for most users and **C or A** for architect-grade modes.

#### BIM workflows
- Use **IFC** as open BIM exchange (not `.bim`).  
- Convert once server-side to Fragments/XKT/GLB; don’t parse huge IFC on every page load (That Open docs: runtime IFC load too slow for production — convert to `.frag`).

---

### 4.9 In-browser only vs backend conversion farm

| Use case | Browser-only | Backend farm | Advice |
|---|---|---|---|
| Consumer preview SKU | ✓ GLB + Draco/meshopt | Optional thumbnail gen | Browser |
| Designer edit room | ✓ scene graph + GLBs | Asset optimize on upload | Browser + farm for uploads |
| Architect DWG | ✗ heavy | ✓ ODA/APS convert | Farm |
| Reseller catalog ingest | ✗ | ✓ batch convert + QA | Farm |
| Sketch JPG/PDF AI | Possible tiny models | ✓ better GPUs, queue, audit | Farm (or vendor API) |
| IFC large models | Limited | ✓ Fragments/XKT | Farm |
| Photoreal stills | ✗ | ✓ optional | Farm later |

**Verdict:** Real-time interaction stays in browser; **all CAD/BIM/AI/heavy optimize jobs stay on a conversion farm**.

---

### 4.10 Build from scratch vs customize OSS / API / white-label

| Strategy | Ownership | Quality | Cost at scale | Customization | Time-to-MVP |
|---|---|---|---|---|---|
| White-label iframe (Planner 5D / Coohom) | Low editor ownership | High (mature UX) | Vendor seat/usage fees | Branding + catalog APIs | **Fastest** |
| SDK customize UI (Roomle Rubens, Coohom Viewer SDK) | Medium | High for configurator | License + your FE work | High UI | Fast |
| OSS hybrid (Three.js + That Open + glTF-Transform + ODA/APS modules) | High on runtime | Depends on team | Infra + eng | Very high | Medium |
| Full build | Highest | Slow to match incumbents | High eng; low per-unit later | Unlimited | Slowest |
| Unity/Unreal web | Medium | High fidelity possible | WebGL limits or streaming $ | High if skilled | Medium–slow |

**Phased (brief):** near-ready now → owned core later. Prefer **SDK/white-label for editor shell** + **owned catalog/BOM/conversion** so migration does not rewrite commerce.

---

## 5. Full comparison tables (expanded)

### 5.1 Engines (expanded)

| Factor | Three.js | Babylon.js | PlayCanvas | Filament WASM | Unity WebGL | Unreal Pixel Streaming |
|---|---|---|---|---|---|---|
| License | MIT | Apache-2.0 | Engine MIT; editor commercial tiers | Apache-2.0 | Unity terms | Epic terms |
| Editor systems | DIY | Built-in | Cloud editor | Viewer-level | Full editor desktop | Full UE |
| glTF/PBR | Excellent | Excellent | Good | Excellent PBR | Good | Excellent (native) |
| Interior SaaS fit | Best OSS base | Excellent | Good for scenes | PDP viewer | Heavy | Premium only |
| Mobile web | Good if optimized | Good | Strong focus | Good | Often painful | Works (video) |
| Cost model | Eng time | Eng time | Seats + eng | Eng time | Eng + build size | **GPU/session** |
| Ecosystem overlap | That Open, Speckle, Roomle | Strong samples | Smaller | model-viewer adjacent | Game talent | Archviz talent |

### 5.2 DWG / BIM strategies (expanded)

| Strategy | Browser UX weight | Edit materials/lights | Keep DWG SoT | Vendor lock | Best role |
|---|---|---|---|---|---|
| APS Viewer + derivatives | Medium | Limited / custom overlay | Source in APS OSS | High Autodesk | Architect view + metadata |
| ODA server convert → mesh | Light | Full on mesh | Yes | ODA membership | Default production |
| ODA Drawings inWEB | Heavy CAD | CAD-native; lights via your layer | Yes (native) | ODA | Architect edit mode |
| IFC + That Open Fragments | Medium | Improving; commerce PBR separate | IFC SoT | Low (OSS) | BIM review |
| Speckle hub | Medium | Textures historically weak | Stream SoT | Low–medium | AEC collab |
| xeokit | Medium | Viewer/BIM | Converted XKT | License check | Large BIM view |
| Pure browser DWG parser DIY | High risk | Poor | Fragile | None | **Avoid** |

### 5.3 Convert farm vs browser-only (expanded)

| Dimension | Browser-only | Conversion farm |
|---|---|---|
| Latency to first paint | Can be worse on large CAD | Better (precomputed GLB) |
| Device variance | High | Controlled derivatives |
| Secrets / licenses | Hard to protect converters | Easier server-side |
| Cost | Bandwidth + CDN | Workers + storage (+ GPU for AI) |
| Offline CAD fidelity | Weak | Strong |
| MVP complexity | Lower if only GLB | Higher ops |

### 5.4 Build vs buy / customize (expanded)

| Option | Pros | Cons | Exit strategy |
|---|---|---|---|
| Coohom OpenAPI / white-label | Full planner, catalog, rendering, Viewer SDK | Dependency; pricing opaque publicly | Sync projects/BOM out; rebuild UI later |
| Planner 5D B2B | Documented iframe + JS + REST; AI floor-plan recognition | Vendor roadmap | Export projects via API |
| Roomle Rubens SDK | Custom UI; Three.js based; configurator + room designer modules | Content in Roomle Script; update ownership | Reuse GLB mindset; rebuild planner |
| That Open stack | Open BIM; Fragments performance | Not a furniture commerce suite | Keep as BIM module |
| APS | DWG/RVT fidelity | Cost/lock-in; not interior commerce | Use only for CAD gateway |
| ODA | Native DWG web/server | Membership; CAD-centric | Keep as CAD gateway |
| Full custom Three.js | Ownership | Rebuild years of planner UX | N/A (destination) |

### 5.5 AI assist — yes / no / when

| Decision | When | Why |
|---|---|---|
| **No AI in V1** | If manual trace + DWG vector import covers 80% users | Lowest risk/cost |
| **Yes, vendor AI** | Need sketch→room for consumers fast | Planner 5D-class async recognition |
| **Yes, owned model** | High volume + distinctive drawing styles | Fine-tune on CubiCasa-like data + your corpus; still human confirm |
| **Never auto-trust dims** | Always | Research shows domain shift; legal/quality risk |

---

## 6. Suggested poly / LOD budgets by role

**Guidance only** — derived from Khronos 3D Commerce publishing targets and reputable practice notes. **Not** Room Vibez product rules. Tune after device telemetry.

### Per-item budgets (Khronos 3D Commerce publishing targets, guidelines 1.0)

| Publishing target | Max file size | Max triangles | Draw calls (target) | Max bitmap res |
|---|---|---|---|---|
| Mobile AR / 3D web catalogue (single item) | 3 MB | 150,000 | <20 (up to ~500) | 2K |
| Single-item desktop 3D web | 3 MB | 250,000 | <100 (up to ~800) | 2K |
| Web-based planning tool (**one of many items**) | 1 MB | 40,000 | <5 (up to ~50) | 1K |
| Banner ad | 500 KB | 30,000 | <5 (up to ~100) | 512 |
| Offline rendering | No limit | No limit | No limit | No limit |

Source: [Khronos 3DC Asset Creation — Publishing Targets](https://github.com/KhronosGroup/3DC-Asset-Creation/blob/main/asset-creation-guidelines-1.0/full-version/sec99_PublishingTargets/PublishingTargets.md).

Earlier summary guidance also cites ~100k triangles and ideally <5 MB before widespread Draco/KTX2 — see Khronos Real-time Asset Creation Guidelines PDF.

### Role mapping (advisory)

| Role | Scene / item guidance | Rationale |
|---|---|---|
| **Consumer preview** (single SKU PDP) | Up to ~150k tris / item, 2K maps, Draco/meshopt, IBL | Khronos mobile/web catalogue |
| **Consumer room** (many items) | Prefer **~40k tris / placed item** planner tier; aggressive LOD1/LOD2; atlas where possible | Khronos “planning tool” row assumes multiple items share budget |
| **Designer edit** | LOD0 on selected item; LOD1 elsewhere; total scene budget start ~0.5–1.5M tris on desktop, lower on mobile — **validate empirically** | Extrapolation; mark as unknown until profiled |
| **Architect DWG view** | Don’t render raw CAD polys in WebGL; show derived wall meshes + selected detailed objects; or APS/ODA viewer mode | CAD poly counts routinely exceed realtime budgets |
| **Reseller catalog QA** | Enforce Khronos planner + catalogue gates in CI (`gltf-validator` + size/tris checks) | Operationalizing guidelines |

### LOD suggestion (practice)

| LOD | Use | Typical reduction (order-of-magnitude practice) |
|---|---|---|
| LOD0 | Selected / hero / close camera | Full catalog budget |
| LOD1 | Default in room | ~25–50% tris; 1K textures |
| LOD2 | Distant / mobile / list | ~10–20% tris; 512–1K; maybe skip normals |

Exact ratios: **unknown pending asset corpus** — generate with glTF-Transform `simplify` and visual QA.

---

## 7. Open questions still needing the client

1. **Export formats** from the furniture company: OBJ only? FBX? glTF? USD? Max/Maya/Blender? CAD solids?  
2. Are materials already **PBR map sets** (baseColor/ORM/normal) or proprietary?  
3. Typical **SKU count** and average mesh size (tris, textures)?  
4. Must architects **round-trip DWG** (save back to DWG) or is one-way import enough?  
5. IFC required at MVP or later? Which IFC versions?  
6. Target devices (mobile shoppers vs desktop designers)?  
7. Still-render quality bar (realtime IBL vs offline path trace)?  
8. BOM depth: sellable SKUs only vs parts/cut-list?  
9. White-label acceptable for V1 (branded iframe/SDK) vs must be fully owned UI?  
10. Data residency / private cloud requirements (affects APS vs ODA self-host)?  
11. Who owns dimension liability when users upload sketches?  
12. Existing PIM/ERP/e-commerce APIs for price/stock sync?

---

## 8. Architecture sketch (evidence-labeled)

```text
                 ┌──────────────────────────────┐
                 │  Room Vibez Web (owned shell) │
                 │  auth · commerce · BOM UI     │
                 └──────────────┬───────────────┘
                                │
        ┌───────────────────────┼───────────────────────┐
        ▼                       ▼                       ▼
┌───────────────┐     ┌─────────────────┐     ┌──────────────────┐
│ Realtime view │     │ Room editor     │     │ Architect mode   │
│ Three/Babylon │     │ 2D plan + 3D    │     │ APS Viewer and/or│
│ GLB+LOD+PBR   │     │ (owned or SDK)  │     │ ODA Drawings     │
└───────▲───────┘     └────────▲────────┘     └────────▲─────────┘
        │                      │                       │
        └──────────────┬───────┴───────────────────────┘
                       ▼
            ┌─────────────────────┐
            │ Conversion farm     │
            │ OBJ→GLB optimize    │
            │ DWG/IFC derive      │
            │ Sketch AI (optional)│
            └──────────┬──────────┘
                       ▼
            ┌─────────────────────┐
            │ Models · Materials  │
            │ Lights · Projects   │
            │ Object storage/CDN  │
            └─────────────────────┘
```

Label: **advisory reference**, not an implemented Room Vibez system.

---

## 9. Sources (selected)

### Official / vendor docs
- Khronos glTF 2.0 extensions: [KHR_draco_mesh_compression](https://github.com/KhronosGroup/glTF/tree/main/extensions/2.0/Khronos/KHR_draco_mesh_compression), [KHR_meshopt_compression](https://github.com/KhronosGroup/glTF/tree/main/extensions/2.0/Khronos/KHR_meshopt_compression)
- Khronos 3D Commerce Asset Creation Guidelines & [Publishing Targets](https://github.com/KhronosGroup/3DC-Asset-Creation/blob/main/asset-creation-guidelines-1.0/full-version/sec99_PublishingTargets/PublishingTargets.md); [PDF guidelines](https://registry.khronos.org/3DCommerce/AssetCreation/specs/1.0/AssetCreationGuidelines.pdf)
- Khronos blog: [Google Store / PBR Neutral](https://www.khronos.org/blog/how-google-store-transformed-product-education-with-gltf-3d-models)
- [glTF-Transform](https://gltf-transform.dev/) / [CLI](https://gltf-transform.dev/cli)
- Autodesk APS: [Model Derivative API](https://aps.autodesk.com/developer/overview/model-derivative-api), [Viewer SDK](https://aps.autodesk.com/developer/overview/viewer-sdk), [Field Guide](https://aps.autodesk.com/en/docs/model-derivative/v2/developers_guide/field-guide)
- ODA: [Drawings inWEB announcement](https://www.opendesign.com/blog/2024/october/drawings-inweb-sdk-oda), [Drawings product](https://www.opendesign.com/products/drawings), [inWEB](https://www.opendesign.com/products/inweb), [Drawings datasheet PDF](https://www.opendesign.com/datasheets/2025/en/Drawings%20Datasheet.pdf)
- That Open: [web-ifc](https://github.com/thatopen/engine_web-ifc/), [IfcLoader tutorial](https://docs.thatopen.com/Tutorials/Components/Core/IfcLoader), [@thatopen/fragments](https://www.npmjs.com/package/@thatopen/fragments)
- [xeokit-bim-viewer](https://xeokit.github.io/xeokit-bim-viewer/)
- Speckle: [server repo](https://github.com/specklesystems/speckle-server), [viewer docs](https://docs.speckle.systems/developers/viewer/overview), [IFC integration](https://speckle.systems/integrations/ifc/)
- Planner 5D: [Business / white-label](https://planner5d.com/business), [B2B API technical overview](https://support.planner5d.com/en/articles/15189751-planner-5d-b2b-api-technical-overview)
- Coohom OpenAPI: [design-building](https://open.coohom.com/pub/saas/open-platform/design-building), [e-commerce](https://open.coohom.com/pub/saas/open-platform/e-commerce), [Viewer SDK reference](https://coohom.readme.io/reference/api) — **competitive context only**
- Roomle Rubens: [SDK overview](https://docs.roomle.com/rubens/rubens-sdk/overview), [getting started](https://docs.roomle.com/rubens/rubens-sdk/getting-started.md)
- Filament npm / web platform docs; Google model-viewer lineage via Khronos blog

### Research / engineering articles
- Needle [gltf-progressive](https://engine.needle.tools/docs/gltf-progressive/) (LOD + compression practice)
- Engine comparisons (Three / Babylon / PlayCanvas): [Utsubo 2026 comparison](https://www.utsubo.com/blog/threejs-vs-babylonjs-vs-playcanvas-comparison), MDN-oriented summaries
- Floor-plan AI: CubiCasa5K lineage; [MitUNet arXiv](https://arxiv.org/html/2512.02413); [HF floorplan-to-3d-walls](https://huggingface.co/Yytsi/floorplan-to-3d-walls); WallNetv2 JEI paper
- Unreal Pixel Streaming cost/latency practice: Epic forums; industry explainers (GPU per session)

### Internal context (not requirements)
- `docs/coohom-analysis/` — observed Coohom workbench behavior only
- `internal/room-vibez-requirements-brief.md` — authoritative product brief

---

## 10. Bottom line for decision makers

1. **Canonical runtime = GLB + PBR + LOD + conversion farm.**  
2. **MVP:** white-label/SDK room planner + owned catalog/BOM, **or** thin owned Three.js room if team can staff it — both valid; first is faster.  
3. **DWG:** hybrid (DWG SoT → derived editable room + mesh); ODA inWEB or APS only for architect-grade modes.  
4. **AI sketch assist:** optional, always human-confirmed; vendor API for speed.  
5. **Migrate** vendor editor later without rewriting commerce if you own SKU/BOM/assets from day one.
