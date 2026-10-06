# Room Vibez — Format choice, OBJ vs DWG, Planner 5D gap plan

**Document type:** Advisory follow-up (evidence-based)  
**Date:** 2026-10-01  
**Decision locked:** Realtime mesh engine = **Three.js only** (not Babylon dual).  
**Authority for product facts:** `internal/room-vibez-requirements-brief.md`  
**New product facts:** Furniture geometry only in exports; **materials/textures from a library**; **lights via render presets** (not embedded in furniture files).  
**Prior research:** `docs/obj-engines-planner-ai-qa.md`, `docs/platform-stack-research.md`  
**Rule:** Cite public docs. Mark **Unknown** where docs do not confirm. Do not invent vendor features.

---

## 1) Better format when textures & lights are NOT in the model file

### Plain-language answer

When maps and lights live in **your** libraries/presets, the furniture file only needs to carry **geometry + stable part IDs** (named meshes/groups that map to `material_slot_id`). The “heavy OBJ” complaint is mostly about **runtime packaging and MTL mismatch**, not about missing textures in the file — because you were never going to ship textures in the chair package anyway.

**Canonical runtime (Room Vibez / Three.js):** still **glTF 2.0 / GLB** with geometry + material **slot IDs** (or empty/default materials). At load time, resolve slots from the **materials DB**. Apply **scene light presets** separately. Do not bake catalog lights into furniture assets.

Evidence for glTF as web/runtime delivery: [Khronos glTF PBR](https://www.khronos.org/gltf/pbr), [glTF 2.0 spec](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html). Three.js loads GLB as first-class ([threejs.org](https://threejs.org/)).

### Why OBJ *feels* heavy — vs what actually matters here

| Complaint people mean by “heavy OBJ” | What it really is | Matters when textures are library-side? |
|---|---|---|
| Multi-file package (`.obj` + `.mtl` + many images) | Runtime fetch fan-out; broken relative paths | **Less** — you may drop MTL/maps and keep geometry + sidecar |
| Bad browser runtime | No standard Draco/KTX2 story; slow parse; awkward scene graph | **Yes** — still convert to GLB for Three.js |
| MTL ≠ modern PBR | Phong-style `Kd`/`map_Kd` vs metallic-roughness ([LOC MTL FDD](https://www.loc.gov/preservation/digital/formats/fdd/fdd000508.shtml); [Paul Bourke MTL](https://paulbourke.net/dataformats/mtl/index.html)) | **Less for embedded maps** — but still a trap if anyone assumes MTL is “source of truth” for finishes |
| Units / pivots / merged meshes | Export hygiene, not format magic | **Yes** — slots & BOM depend on named parts |

**What actually matters for your model:**

1. Stable **named meshes/groups** per independently finishable / BOM-relevant part.  
2. Valid **UVs** if library materials are textured (UVs live on the mesh even when maps live in the DB).  
3. A **sidecar or glTF extras** mapping `mesh_name → material_slot_id`.  
4. Conversion farm → compressed **GLB** for Three.js.  
5. Lights as **scene presets**, not per-SKU files.

Planner 5D’s Admin guidance matches the mesh-per-area pattern: separate mesh per independently customizable part ([Admin Tool – 3D model preparation](https://planner5d.com/business/help-admin-tool)).

### Ideal source asks (furniture company)

| Priority | Ask them | Why |
|---|---|---|
| **Preferred (later)** | Export **glTF/GLB** with named meshes; put `material_slot_id` in mesh `extras` or a consistent naming convention | One file, web-native, slots travel with geometry |
| **Acceptable now** | Keep **OBJ** with named `g`/`o` groups + **sidecar JSON** `{ "chair_frame_wood": "slot.wood.oak01", ... }` | Unblocks catalog without waiting on DCC pipeline change |
| **Avoid** | One merged mesh + one atlas that paints wood/plastic/fabric together | Blocks slot swaps and part BOM |
| **Do not ask** | Embedding HDRI / studio lights in furniture files | Lights are render presets (your product fact) |

**Unknown:** Whether their DCC can export named groups reliably and whether they already maintain a materials library with IDs you can reuse — confirm with a sample chair + materials CSV.

### Comparison table (honest, brief)

| Format | Geometry + slots story | Textures in file? | Web / Three.js runtime | When to use |
|---|---|---|---|---|
| **OBJ + sidecar JSON** | Named groups OK; slots in sidecar you invent | Optional MTL — **ignore for library model** | Poor as runtime; convert → GLB ([obj2gltf](https://github.com/CesiumGS/obj2gltf)) | Transitional **source** while vendor stays on OBJ |
| **glTF / GLB + slot IDs** | Named nodes + `extras` / material placeholders | Can embed maps **or** leave empty and bind at load | **Best** canonical runtime | Target **source + runtime** |
| **FBX** | Rich DCC exchange; materials often proprietary | Often embeds or references maps | Not a browser runtime; convert via farm (Assimp / DCC) | Acceptable **ingest** if DCC prefers FBX; still normalize to GLB |
| **USD / USDZ** | Strong composition / scene intent | Materials via UsdPreviewSurface / MaterialX (ecosystem-dependent) | USDZ has Apple AR path; full USD in browser is heavier / immature vs glTF for commerce editors | Long-term AEC/composition interest; **not** MVP runtime for Room Vibez catalog |

### Implications for Three.js + conversion farm

```text
Source (OBJ+sidecar | GLB+extras | FBX)
    → validate (named parts, UVs, units, sidecar completeness)
    → convert / normalize to GLB geometry (empty or placeholder materials)
    → optimize (gltf-transform: weld/prune; Draco OR meshopt; LODs)
    → register: sku_id ↔ glb_uri[] ↔ material_slot_id[] ↔ BOM lines
Runtime (Three.js):
    GLTFLoader → bind materials DB by slot → apply scene light preset
```

| Layer | Own / buy | Note |
|---|---|---|
| Conversion farm | **Own from day one** | Catalog economics + exit cost ([prior Q&A](obj-engines-planner-ai-qa.md)) |
| Materials DB | **Own** | Library is the finish truth |
| Light presets | **Own** (or vendor scene defaults while embedded) | Not in furniture files |
| Three.js editor | Own later; optional white-label shell first | Decision: Three.js only |

Tooling citations: [CesiumGS obj2gltf](https://github.com/CesiumGS/obj2gltf), [glTF-Transform CLI](https://gltf-transform.dev/cli), Khronos [publishing targets](https://github.com/KhronosGroup/3DC-Asset-Creation/blob/main/asset-creation-guidelines-1.0/full-version/sec99_PublishingTargets/PublishingTargets.md) (~40k tris / ~1 MB / 1K maps for planner-tier items).

---

## 2) Why DWG came up if furniture models are OBJ — clear separation

These are **two different pipelines**. DWG is not an alternative to OBJ for chairs.

| Pipeline | Typical inputs | What users do | Runtime representation |
|---|---|---|---|
| **Catalog furniture** | OBJ / GLB / FBX meshes + **materials library** | Place/configure products; swap finishes; BOM/cart | GLB + slot materials + light presets in Three.js (or vendor embed) |
| **Architecture / floor plans** | **DWG / DXF / PDF / JPG / PNG** | Create or import rooms/walls/openings; BIM-ish review | Room graph (walls JSON) ± optional CAD viewer (ODA / APS) |

**Why DWG appears in requirements:** Architects and BIM-adjacent workflows need to **interact with floor plans and walls**, not with chair meshes ([requirements brief](../internal/room-vibez-requirements-brief.md): “DWG for interaction”; sketch→room from PDF/DWG/JPG/PNG).

**Why OBJ appears:** Furniture company exports **geometry** for catalog items.

```text
Architect sheet (DWG/PDF/JPG) ──► walls / openings / rooms
Furniture catalog (OBJ/GLB)   ──► placeable products + material slots
Lights                        ──► scene / render presets
Materials                     ──► materials DB (not inside chair.obj)
```

**Do not:** Convert chairs to DWG, or expect DWG to carry commerce PBR finishes.  
**Do:** Keep hybrid pattern from prior research — DWG as architect **source** → derive editable room graph; furniture stays mesh/GLB ([platform-stack-research §4.8](platform-stack-research.md)).

---

## 3) Planner 5D route — feasible plan for missing functionality

### What public docs actually confirm

Sources: [B2B API technical overview](https://support.planner5d.com/en/articles/15189751-planner-5d-b2b-api-technical-overview), [Admin Tool](https://planner5d.com/business/help-admin-tool), [Business](https://planner5d.com/business), [Configurator](https://planner5d.com/configurator), [3D catalogue](https://planner5d.com/business/3d-product-catalogue). Full endpoint schemas are **behind signing** → many details remain **Unknown**.

| Capability | Public docs say | Gap for Room Vibez |
|---|---|---|
| White-label embed | iframe + JS API: sessions, 2D/3D mode, project open, UI config, **cart events**, **product list** | Editor ops depth: **Unknown** |
| Auth model | Your auth; Planner session token per user via REST | Own auth shell |
| Catalogue / SKU | Admin Product List; CSV SKU fields; REST catalogue metadata/thumbnails | Deep variant/BOM rules: **Unknown** |
| Materials in Admin | Replace textures/colors; mesh = material area | Full PBR library sync as first-class: **Unknown** |
| AI floor plan | Async JPEG/PNG/PDF/DWG/DXF → editable 3D project; **usage-priced separately** | SLA timings: **not published** — do not invent |
| CAD export | IFC/DWG/DXF async; **beta** | Production readiness: **Unknown** |
| Template manager | **Unknown** as a named Admin/API feature | Own CMS or ask sales |
| BOM manager | **No dedicated public BOM manager** | **Own BOM** fed by cart/product-list |

### Ownership map (recommended)

| Concern | Who owns | How |
|---|---|---|
| **BOM manager** | **Room Vibez** (system of record) | Listen to Planner cart + product-list payload → normalize to `project_id` / lines / qty / SKU / optional part slots → ERP/cart |
| **Template manager** | **Own CMS** until Planner documents otherwise (**Unknown**) | Save “starter rooms” / style packs as your projects or JSON; open via Planner project API if available post-signing |
| **SKU / variant rules** | **Own** commerce rules; mirror what Planner can express | Price, availability, compatibility matrix in your DB; push catalogue subset to Planner |
| **Material library** | **Own DB**; sync **subset** into Planner Admin **or** apply only in owned Three.js later | During embed phase: push finishes Planner can render; on exit: bind slots in Three.js only |
| **Conversion farm** | **Own** | OBJ(+sidecar)/FBX → GLB; also feed Planner upload package per their prep guide |
| **Auth / commerce shell** | **Own** | Per B2B overview: your login; configurable action button → your endpoint |
| **Room editor UX** | Planner (MVP) → **Three.js** (exit) | Decision: Three.js only for owned runtime |

### Phased plan

#### Phase 0 — MVP (embed + owned BOM/SKU) — *estimate 6–12 weeks*

- Iframe embed + session token flow ([B2B overview](https://support.planner5d.com/en/articles/15189751-planner-5d-b2b-api-technical-overview)).  
- Catalogue load (CSV/Admin) for pilot SKUs with mesh-per-slot OBJ packages.  
- Cart listener → **owned BOM service** (idempotent upsert).  
- Basic SKU/price feed (CSV/XML/API — docs mention scheduled pricing feed).  
- Optional: AI floor-plan recognition as usage add-on (async poll) + hard UX: human review.  
- Conversion farm v0: validate OBJ+sidecar → GLB archive for *your* CDN; separately package for Planner upload.

#### Phase 1 — Deepen — *estimate 8–16 weeks (overlaps sales scoping)*

- Variant / accessory rules in **your** configurator service; only expose Planner-supported surface.  
- Template CMS (own): branded starter projects.  
- Materials sync job: library → Planner materials where API/Admin allows (**Unknown** automation depth — may stay semi-manual).  
- Project metrics → quote helpers (floor area, item counts — documented metrics endpoint).  
- Harden BOM: part-level lines when mesh slots map to accessories.

#### Phase 2 — Exit ramp to owned Three.js editor — *estimate 12–24+ weeks after Phase 1 stable*

- Room graph export/import adapter (Planner project JSON → your schema). **Unknown** until signed schema reviewed.  
- Three.js editor: walls + GLB placements + materials DB + light presets.  
- Keep BOM/SKU/auth/conversion farm unchanged (already owned).  
- Retire iframe when feature parity for your personas is enough; keep Planner AI recognition only if still cheaper than owned vision (**optional**).

> Week ranges are **planning estimates, not commitments or vendor SLAs**.

### Milestone table (estimates)

| Milestone | Range (weeks) | Outcome | Exit criteria |
|---|---|---|---|
| M1 Embed hello-world | 1–3 | Auth + iframe session on staging | User opens blank project |
| M2 Pilot catalogue | 3–6 | 20–50 SKUs, multi-mesh chair | Place + material swap in Planner |
| M3 Owned BOM v1 | 4–8 | Cart/product-list → BOM API | Quote line items match placements |
| M4 AI plan assist (optional) | 6–12 | Upload → poll → review UX | Human confirms dims before quote |
| M5 Template CMS | 8–14 | Own starters open in embed | Designer creates from template |
| M6 Materials sync | 10–18 | Library IDs ↔ Planner finishes | **Unknown** automation % — measure |
| M7 Three.js spike | 10–16 | Same GLB+slots in owned viewer | Slot bind + light preset demo |
| M8 Editor exit MVP | 20–36 | Replace iframe for core flow | BOM unchanged; no dual engines |

### Risks & dependencies

| Risk | Mitigation |
|---|---|
| Signed API lacks part-level BOM | Own BOM; treat Planner list as placement events only |
| Template manager doesn’t exist | Own CMS (default assumption) |
| Materials Admin ≠ full PBR library | Accept visual approx in embed; fidelity in owned Three.js |
| AI recognition cost/quality | Manual draw always available; draft-only copy |
| CAD export beta | Don’t depend for V1 architect delivery |
| Exit lock-in | Own farm + BOM + slot IDs from day one |
| Furniture OBJ without named parts | Reject sample; enforce checklist |

### Open questions for Planner sales / engineering scoping call

1. Exact **product-list / cart payload** schema (part mesh IDs? material IDs? variant SKUs?).  
2. Is there any **template / project clone** API beyond copy project?  
3. Can materials be **bulk-updated via API**, or Admin-only?  
4. Rule engine limits for accessories (removable pillow as SKU vs material slot).  
5. AI recognition: rate limits, failure modes, **no public SLA** — what contractual latency/accuracy apply?  
6. Data residency / project export completeness for exit.  
7. Whether partner catalog can stay private-only (no Planner public marketplace bleed).  
8. Commercial: seat vs usage (AI, renders, AI room designer add-ons).

---

## Bottom line

1. **Library materials + preset lights** → optimize for **geometry + slot IDs**, not embedded maps in furniture files.  
2. **Runtime canonical:** GLB + slots → materials DB; lights from presets; **Three.js only**.  
3. **Source today:** OBJ + named groups + sidecar JSON; **ask** for glTF later.  
4. **DWG ≠ OBJ substitute** — architecture/floor-plan pipeline vs catalog furniture pipeline.  
5. **Planner 5D MVP:** embed + **own BOM/SKU/auth/farm**; deepen; exit to owned Three.js when ready.

---

## Sources

- [Khronos glTF PBR](https://www.khronos.org/gltf/pbr) · [glTF 2.0](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html)  
- [LOC MTL FDD](https://www.loc.gov/preservation/digital/formats/fdd/fdd000508.shtml) · [Paul Bourke MTL](https://paulbourke.net/dataformats/mtl/index.html)  
- [obj2gltf](https://github.com/CesiumGS/obj2gltf) · [glTF-Transform](https://gltf-transform.dev/cli)  
- [Khronos 3DC publishing targets](https://github.com/KhronosGroup/3DC-Asset-Creation/blob/main/asset-creation-guidelines-1.0/full-version/sec99_PublishingTargets/PublishingTargets.md)  
- [Planner 5D B2B API overview](https://support.planner5d.com/en/articles/15189751-planner-5d-b2b-api-technical-overview)  
- [Planner 5D Admin Tool](https://planner5d.com/business/help-admin-tool)  
- [threejs.org](https://threejs.org/)  
- Internal: `docs/obj-engines-planner-ai-qa.md`, `docs/platform-stack-research.md`, `internal/room-vibez-requirements-brief.md`, `internal/followup-format-planner-prototype.md`
