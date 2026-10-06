# Feasibility: upload OBJ / DWG → auto GLB + MJS → Catalog 3D

**Document type:** Research / feasibility only (no implementation)  
**Date:** 2026-10-03  
**Audience:** Chong / Room Vibez  
**Rule:** Cite real tools and prior Room Vibez docs. Mark **Unknown** where evidence is missing. Do not invent Polyfork exporters, ODA features, or APS SLAs.

**Companion docs:** `glb-mjs-pack-conversion-approach.md`, `mjs-loading-in-hackathon-viewer.md`, `mjs-pack-material-slot-split.md`, `final-supported-file-formats.md`, `format-dwg-vs-obj-planner-gap-plan.md`, `obj-engines-planner-ai-qa.md`, hackathon viewer `README.md` / `ASSUMPTIONS.md`.

**Locked decisions (do not reopen here):** Three.js runtime only; rooms lean **DWG**; furniture lean **GLB**; **MJS** = Polyfork-style ES module materials/params (not a mesh codec); pack = GLB display + MJS materials; label Unknowns; do not invent.

**Viewer under discussion:** `/Users/adrian/Desktop/Room Vibez/hackathon-3d-viewer` (Catalog 3D on `:18767`). Today: loads GLB, MJS, GLB+MJS packs, material slots; session uploads only (Object URLs); **no** OBJ/DWG runtime load; **no** conversion farm.

---

## 1) Executive verdict

| Path | Auto → GLB | Auto → Polyfork-style MJS | Auto-register into Catalog 3D |
|---|---|---|---|
| **OBJ (+ MTL/textures ± sidecar)** | **Yes — feasible** with mature open toolchains | **No — not honestly automatic** | **Yes — after farm** (architecture sketch only; app today is session-only) |
| **DWG as furniture catalog upload** | **Wrong pipeline** (locked: furniture ≠ DWG) | **No** | **Do not** |
| **DWG as rooms / architecture → display mesh GLB** | **Partially possible** via commercial ODA / APS (not open-source) | **No** (and usually wrong goal) | **Not Catalog 3D’s job** — room graph / architect path |

**One-sentence answer:** You can automate **OBJ → validated GLB + slot map + catalog entry** for furniture; you **cannot** magically emit a real Polyfork-style `.mjs` (`createAsset` / params / presets) from OBJ or DWG; DWG→GLB for the **catalog** app is the wrong target and, for architecture meshes, only **partially** achievable under commercial CAD SDKs with material/fidelity caveats.

**Honest end-to-end for “upload → convert → pack → catalog”:**

- **OBJ → GLB + catalog:** **Possible** (recommended MVP farm).
- **OBJ → GLB + MJS pack:** **Partially possible** only if “MJS” means a **thin Room Vibez stub** (params/presets/materials metadata) or a **licensed Polyfork file** attached by humans — **not** codegen of procedural `createAsset` geometry.
- **DWG → GLB + MJS → Catalog 3D:** **Not honestly possible** as a furniture pack path; architecture DWG belongs on the **room** pipeline.

---

## 2) OBJ → GLB — findings

### 2.1 What you get

OBJ is a mesh interchange format (positions, optional normals/UVs, groups/`o`/`g`/`usemtl`). Companion **MTL** is historically Blinn-Phong (`Kd`, `map_Kd`, …), not glTF metallic-roughness ([LOC MTL FDD](https://www.loc.gov/preservation/digital/formats/fdd/fdd000508.shtml); [Paul Bourke MTL](https://paulbourke.net/dataformats/mtl/index.html)). Room Vibez already treats furniture finishes as **materials DB + `material_slot_id`**, so MTL is a **hint at best**, not SoR (`format-dwg-vs-obj-planner-gap-plan.md`).

### 2.2 Toolchains (real)

| Tool | Role | Automation | License / cost (public) | Fidelity notes |
|---|---|---|---|---|
| **[CesiumGS obj2gltf](https://github.com/CesiumGS/obj2gltf)** | OBJ(+MTL) → glTF/GLB | CLI / Node — farm-ready | **Apache-2.0** | Good geometry + named nodes from groups; MTL→PBR is **approximate** unless `--metallicRoughness` / `--specularGlossiness` / CLI texture overrides ([README](https://github.com/CesiumGS/obj2gltf/blob/main/README.md)) |
| **[Assimp](https://www.assimp.org/)** (`assimp export … glb`) | Broad mesh import/export | CLI/library — farm-ready | **Modified 3-clause BSD** | Strong for OBJ/FBX/etc.; **no DWG** (maintainers: unlikely — [assimp#1816](https://github.com/assimp/assimp/issues/1816)) |
| **Blender / `bpy` headless** | Import OBJ → export glTF 2.0 | Scriptable; heavier image | Blender GPL; pipeline scripts typically your IP | Best control over normals/UVs/materials QA; slower cold start; ops cost |
| **[glTF-Transform](https://gltf-transform.dev/)** | Optimize / weld / Draco / Meshopt / KTX2 | CLI — farm stage 2 | MIT (project) | Not a primary OBJ importer; post-process after obj2gltf/Assimp/Blender |
| **[gltf-validator](https://github.khronos.org/glTF-Validator/)** | Gate jobs | CLI/CI | Apache-2.0 | Fail closed on structural errors |
| **Online convert APIs** (various SaaS) | Convenience | HTTP job | Vendor ToS + cost; data residency | Fine for spikes; weak as production SoR without contracts |

**Recommended furniture farm (industry-standard, already outlined in prior RV docs):**

```text
OBJ (+ MTL + textures) + optional sidecar JSON (mesh → material_slot_id)
  → validate (named parts, UVs, units, package hygiene)
  → obj2gltf or Assimp or Blender → GLB
  → optional: write glTF extras.material_slot_id from sidecar (glTF-Transform script)
  → glTF-Transform optimize (+ Draco XOR Meshopt; texture compress)
  → gltf-validator + tris/size gates
  → register SKU ↔ glb_uri ↔ slots ↔ materials defaults
```

### 2.3 Fidelity checklist (what automation can / cannot fix)

| Concern | Automatic? | Notes |
|---|---|---|
| Positions / topology | Usually yes | Depends on export quality |
| Normals | Often recoverable | Viewer already `computeVertexNormals` as last resort; farm should prefer authored normals |
| UVs | **No invent** | Missing `TEXCOORD_0` → textured library materials fail; warn/reject |
| Named groups → slots | **Semi** | Needs consistent `g`/`o` names + sidecar or farm mapping UI; merged single-mesh OBJ blocks multi-slot commerce |
| MTL → library PBR | **Hint only** | Approximate PBR conversion ≠ Room Vibez materials DB |
| Units / pivot | Semi (heuristics) | Prefer declared sidecar; wrong units = floating furniture |

### 2.4 Automation readiness & cost

- **Ready for a conversion farm today** with open-source stack (obj2gltf + glTF-Transform + validator). No ODA membership required.
- **Cost:** mostly engineering + GPU/CPU workers + storage/CDN. Tool licenses are free (Apache/BSD/MIT) for the core path. Blender adds container weight, not license fees for automation use (still respect GPL if you redistribute Blender itself).
- **Human gates that remain:** slot taxonomy, UV QA, reject merged meshes, materials DB binding.

---

## 3) DWG → GLB — findings

### 3.1 Product framing (locked)

| Use | DWG role | Catalog 3D role |
|---|---|---|
| **Rooms / architecture** | Source / interchange (with PDF/JPG/PNG) → **owned room graph**; optional CAD viewer later | **Out of scope** for furniture placer |
| **Furniture catalog** | **Not** the source format | GLB (+ slots / optional MJS) |

Prior docs are explicit: do **not** convert chairs to DWG or expect DWG to carry commerce PBR finishes (`format-dwg-vs-obj-planner-gap-plan.md`, `final-supported-file-formats.md`, preferences).

### 3.2 Commercial toolchains

| Vendor / product | What it does | → GLB? | Materials / geometry you actually get | Licensing |
|---|---|---|---|---|
| **ODA Drawings SDK** (historically “Teigha”) | Read/write/edit DWG/DXF; import/export several formats | Drawings product page lists export to **DAE, STL, Three.js, PDF, raster**, etc. — **not a simple documented one-click “DWG→GLB” guestfile**. Core package also includes **STEP SDK** with **GLTF/GLB export** and DWG/DXF import in STEP datasheet samples — path may be **DWG→STEP/mesh pipeline → GLB**, fidelity **Unknown** without member docs/spike | CAD entities, layers, Architecture objects (with Architecture SDK); commerce PBR slots **not** native | Membership: Commercial ~$3k first year (**Web/SaaS = No**); Sustaining ~$7.5k (**Web/SaaS = Yes**) ([ODA membership](https://www.opendesign.com/oda-membership); [Drawings product](https://www.opendesign.com/products/drawings); [2025 Drawings datasheet](https://www.opendesign.com/datasheets/2025/en/Drawings%20Datasheet.pdf)) |
| **ODA File Converter** | DWG↔DXF **version** conversion | **No** glTF/GLB | Version normalize only | Guest converter ([ODA File Converter](https://www.opendesign.com/guestfiles/oda_file_Converter)) |
| **ODA Drawings inWEB** | Browser create/edit/view DWG | Not a catalog GLB exporter | CAD UX, not furniture pack | Sustaining/Founding for Web/SaaS; readiness nuances in prior Q&A |
| **Autodesk APS Model Derivative** | Translate designs → SVF/SVF2 (+ listed derivatives e.g. OBJ/STL/STEP/… per field guide) for Viewer + metadata | **Native MD output is not “ship GLB for Three.js catalog” as first-class.** Community / **experimental** [APS Extra Derivatives](https://github.com/autodesk-platform-services/aps-extra-derivatives) post-processes viewables → glTF/glb/USDZ — treat as **experimental**, not a production promise | Tessellated view meshes + properties; DWG material fidelity often reduced (layer colors / limited materials — do not assume glTF PBR slots) | APS cloud usage/subscription — **quote required** ([Model Derivative overview](https://aps.autodesk.com/developer/overview/model-derivative-api)) |

**Teigha:** brand retired into **ODA** SDK family; treat “Teigha” mentions as historical for ODA Drawings.

### 3.3 Open-source limits

| Project | Reality |
|---|---|
| **LibreDWG** (GPL-3) | Read/write DWG/DXF; export JSON/DXF/SVG/PS/GeoJSON. **No** production DWG→OBJ/GLB mesh exporter. 3D solids often ACIS/SAT extract only; custom objects skipped ([LibreDWG README](https://github.com/LibreDWG/libredwg); [issue #1071](https://github.com/LibreDWG/libredwg/issues/1071); [discussion #1028](https://github.com/LibreDWG/libredwg/discussions/1028)) |
| **Assimp** | **No DWG** |
| DIY DXF parsers | Fine for simple 2D polylines → room graph; **not** a furniture GLB farm |

**Verdict:** There is **no honest open-source “drop DWG → get catalog-ready GLB”** path.

### 3.4 Rooms vs furniture — what GLB would mean

| If you tessellate DWG → GLB… | Useful for? | Problems |
|---|---|---|
| Whole sheet as one mesh | Preview / bounce light mock | Huge; no walls as editable graph; poor for Room Vibez planner SoR |
| Filtered 3D furniture blocks inside DWG | Rare “architect embedded chair” | Unstable naming; no `material_slot_id`; wrong commerce model |
| Walls as mesh only | Decorative | Breaks openings/BOM/edit; prefer **room graph** |

**Recommendation (unchanged):** DWG → **derive walls/openings** (vector/AI/hybrid) ± optional ODA/APS **viewer**; keep Catalog 3D on **GLB furniture**. Do not sell “upload DWG to Catalog 3D pack.”

---

## 4) Anything → MJS — generation reality

### 4.1 What MJS is in this project

From the Desktop Polyfork sample (`models/core-rulebook-4aedc7.mjs`) and viewer docs:

- **Executable ES module**, not a mesh container.
- Contract: `createAsset(userParams?)` → `THREE.Group`; also `params`, `presets`, `materials`, … (`mjs-loading-in-hackathon-viewer.md`).
- Sample materials are **zone metadata** + **vertex-color / COLOR_0** sinks — mesh names do **not** equal zone keys; viewer SoR is **COLOR_0 zone → `material_slot` split** when possible, else remap fallback, else **Unknown** (`mjs-pack-material-slot-split.md`, `glb-mjs-pack-conversion-approach.md`).
- License on sample: personal/commercial **use** OK; **do not** resell the file or use it to build a **commercial asset generator** / reproduce Polyfork’s catalogue pipeline as a product ([polyfork.dev/licensing](https://polyfork.dev/licensing) via sample header).

### 4.2 How packs are authored today (evidence)

| Source | Pattern |
|---|---|
| **Polyfork sample** | Hand-authored / store-generated TypeScript-style source + sibling `.glb`; external `*-params.json` on CDN |
| **Roomle / Rubens** (public docs) | Admin + Roomle Script / tags → configurator; static GLB → material configurator via **mesh layers + tags** — **not** “export `.mjs` from OBJ” ([Roomle material configurator guide](https://docs.roomle.com/rubens/quick-start-guides/convert-your-static-product-into-a-material-configurator); prior `rubens-like-architecture-analysis.md`) |
| **Catalog 3D demos** | Procedural GLBs from `scripts/build-assets.mjs` (Node bake) — **not** Polyfork MJS |

**Unknown:** Official Polyfork DCC→`.mjs` exporter / pack schema for third parties (U12 in viewer `ASSUMPTIONS.md`). **Do not assume** one exists for Room Vibez automation.

### 4.3 Can MJS be *generated* from OBJ / DWG / MTL / textures?

| Artifact | From OBJ/MTL/textures | From DWG | Automatic? |
|---|---|---|---|
| **Procedural `createAsset` geometry** (Polyfork-class) | **No** — that is authoring / codegen product IP | **No** | **Not possible** without inventing a generator (and Polyfork license forbids commercial generator cloning from their assets) |
| **Thin MJS stub** (`params` / `presets` / `materials` meta; `createAsset` throws or proxies GLB) | **Yes** from sidecar JSON | N/A for catalog | **Yes** — Room Vibez–owned, not Polyfork-compatible |
| **COLOR_0 zone palette** | Only if GLB already has matching vertex colors + human/zone map | Unlikely from DWG | **Semi** — farm bake open; viewer does runtime split today |
| **`material_slot_id` on meshes** | From named groups + sidecar → glTF extras | Not from DWG layers alone | **Semi** — needs mapping rules or human confirm |
| **Full params schema** (state/open/pages/…) | **Cannot infer** from static mesh | **Cannot infer** | **Human / product design** |

### 4.4 COLOR_0 vs `material_slot` — what cannot be inferred

| Need | Infer from OBJ? | Infer from DWG? |
|---|---|---|
| Which faces are “cover” vs “gold” | **No** (unless already painted / separate meshes + naming) | **No** |
| Allowed finish categories per slot | **No** — commerce taxonomy | **No** |
| Presets / colorways | **No** — brand design | **No** |
| Geometry params that rebuild mesh | **No** — requires `createAsset` authoring | **No** |
| “Unknown” keys with zero faces | Runtime observation only | N/A |

**Bottom line:** MJS in the Polyfork sense is **authoring**, not conversion. Conversion farms produce **GLB + metadata**; they do not invent parametric Three.js programs.

---

## 5) GLB + MJS pack pairing & Catalog 3D ingest — architecture sketch only

### 5.1 What the app already does (plug-in points)

Read-only observation of hackathon-3d-viewer:

| Capability | Where | Today’s limit |
|---|---|---|
| GLB/glTF upload → session `Product` | `src/viewer/uploads.ts` → `createProductFromModelFiles` | Object URLs; refresh clears; no disk/CDN |
| MJS + optional GLB pack | `src/viewer/packs.ts` → `createProductFromPack` | Basename pairing; trusted local files; executes JS |
| Catalog SoR shape | `public/assets/library/catalog.json` | Static JSON; demos only |
| Slot discovery | `slots.ts` (extras / `slot_*` / sidecar lookup) | Untagged → `surface` fallback |

**No server, no job queue, no OBJ/DWG accept path** (ASSUMPTIONS A14–A16).

### 5.2 Target flow (sketch — do not build yet)

```text
[Catalog 3D UI]
   │  drop OBJ package  |  (DWG → reject for catalog / route to rooms)
   ▼
[Ingest API]  validate MIME, size, virus scan, package layout
   ▼
[Conversion farm job]
   ├─ OBJ → GLB (obj2gltf/Assimp/Blender)
   ├─ apply sidecar → extras.material_slot_id
   ├─ optimize + validate
   ├─ optional: attach licensed Polyfork .mjs OR emit thin RV stub .mjs
   └─ write artifacts: /assets/models/{sku}.glb [+ {sku}.mjs] [+ maps]
   ▼
[Catalog registry]
   append/update product row: id, sku, name, glb URI, slots[], optional pack.mjs URI
   ▼
[Catalog 3D]
   fetch catalog → GLTFLoader / pack loader (existing paths)
```

### 5.3 Pairing rules (already established)

- Same basename: `sku.glb` ↔ `sku.mjs`.
- Runtime preference: **GLB on turntable**; MJS for params/presets/materials; COLOR_0 split when zones match (`packs.ts` / pack docs).
- Security: `.mjs` = **code execution** — production must sandbox or restrict to first-party reviewed assets (`glb-mjs-pack-conversion-approach.md` §5).

### 5.4 Persistence gap

Hackathon session uploads prove **UX** for “add to dropdown.” Production needs: object storage, catalog DB/JSON write path, auth, idempotent job status, and a **non-executing** default for untrusted uploads (GLB-only).

---

## 6) End-to-end feasibility & effort (order-of-magnitude)

| Scenario | Verdict | Rough effort *if Chong later asks to build* |
|---|---|---|
| **OBJ → GLB → catalog register** (no real MJS) | **Possible** | **S–M**: farm worker + validate + catalog write + UI “upload OBJ” that polls job; reuse existing GLB product loader |
| **OBJ → GLB + thin MJS stub pack** | **Partially possible** | **M**: above + stub codegen + pack UI wiring; still **not** Polyfork `createAsset` |
| **OBJ → Polyfork-class MJS** | **Not honestly possible** | **XL / product company** — parametric authoring toolchain; legal risk if cloning Polyfork |
| **DWG → GLB furniture pack** | **Not appropriate** | Avoid |
| **DWG → room graph (± optional mesh preview)** | **Partially possible** | **L–XL**: ODA Sustaining or APS + hybrid editor; separate from Catalog 3D |
| **DWG → auto MJS** | **Not possible** | — |

Effort labels are **relative engineering scope** (components, licenses, ops), not calendar promises.

### Blockers

1. **MJS magic** — largest misconception; executable parametric modules ≠ converted meshes.  
2. **Slot authorship** — OBJ without named parts / sidecar cannot yield multi-slot commerce.  
3. **DWG open-source gap** — no reliable free DWG→GLB.  
4. **Licensing** — ODA Web/SaaS needs Sustaining+; APS usage quote; Polyfork generator prohibition.  
5. **Security** — auto-registering user `.mjs` into the app is dangerous without review/sandbox.  
6. **Viewer persistence** — farm output must land on durable URIs; session Object URLs are not a product path.

---

## 7) Alternatives that get close (without pretending MJS appears)

| Alternative | What user gets | Honest label |
|---|---|---|
| **GLB-only upload** (already in Catalog 3D) | Turntable + `surface` or tagged slots | Ship now; best near-term |
| **OBJ upload → farm → GLB-only catalog row** | Same as native GLB after job | Recommended furniture MVP |
| **OBJ + sidecar → GLB with `material_slot_id`** | Real multi-slot library materials | Recommended commerce path |
| **MTL → temporary PBR bake into GLB** | Pretty default look | **Not** materials SoR; still bind library later |
| **Farm-baked COLOR_0 / slot meshes** | Pre-split zones for Polyfork-like assets | Only when palette known; still needs human zone map |
| **Thin MJS stub from JSON** | Params UI shell without `createAsset` geometry | Optional; mark `geometry: glb-only` |
| **Attach licensed Polyfork `.mjs` by basename** | True pack experience | Manual/curated ingest, not auto from OBJ/DWG |
| **Roomle-style Admin tags on static GLB** | Material configurator without `.mjs` | Own materials DB + slots (Room Vibez lock) — conceptually similar capability class |

---

## 8) Recommendations

1. **Furniture ingest:** Automate **OBJ(+sidecar) → GLB → catalog**; prefer vendors shipping GLB when possible.  
2. **Do not** promise auto **MJS** from OBJ/DWG. Keep MJS for **curated Polyfork / first-party modules**.  
3. **DWG:** Keep on **architecture / rooms** pipeline; never as Catalog 3D pack source.  
4. **If a “pack” is required for non-Polyfork SKUs:** generate a **thin Room Vibez stub** or skip MJS entirely (GLB + materials DB is enough per prior open questions).  
5. **Catalog 3D next build (when asked):** farm job + durable assets + catalog mutation; keep executing MJS **opt-in / trusted-only**.  
6. **Spike before ODA/APS spend:** one real architect DWG through APS Extra Derivatives *and/or* ODA trial — measure mesh usefulness vs room-graph need; do not block furniture farm on that spike.

---

## 9) Unknowns

| # | Unknown |
|---|---|
| U1 | Official Polyfork pack exporter / schema for partners |
| U2 | Whether production SKUs **require** `.mjs` or GLB + materials DB is enough |
| U3 | Furniture vendor’s real OBJ hygiene (named groups, UVs, units) — need sample packages |
| U4 | Exact ODA Drawings→glTF/GLB path fidelity for typical interior sheets (member docs / trial) |
| U5 | APS Extra Derivatives production readiness and pricing for DWG→glb |
| U6 | Whether farm should **pre-bake** COLOR_0 zone splits into CDN GLBs (viewer already splits at runtime) |
| U7 | Legal review for executing / redistributing third-party `.mjs` in a cloud pipeline |
| U8 | Long-term slot SoR: glTF extras vs sidecar vs `slot_*` names only |

---

## 10) Sources

### Room Vibez (prior)

- `docs/glb-mjs-pack-conversion-approach.md`  
- `docs/mjs-loading-in-hackathon-viewer.md`  
- `docs/mjs-pack-material-slot-split.md`  
- `docs/final-supported-file-formats.md`  
- `docs/format-dwg-vs-obj-planner-gap-plan.md`  
- `docs/obj-engines-planner-ai-qa.md`  
- `docs/rubens-like-architecture-analysis.md`  
- `hackathon-3d-viewer/README.md`, `ASSUMPTIONS.md`, `src/viewer/uploads.ts`, `packs.ts`  
- Desktop sample: `models/core-rulebook-4aedc7.mjs` (+ sibling `.glb`)

### External (public)

- [CesiumGS obj2gltf](https://github.com/CesiumGS/obj2gltf) · Apache-2.0  
- [Assimp](https://www.assimp.org/) · BSD-style; [no DWG](https://github.com/assimp/assimp/issues/1816)  
- [glTF-Transform](https://gltf-transform.dev/) · [gltf-validator](https://github.khronos.org/glTF-Validator/)  
- [ODA Drawings](https://www.opendesign.com/products/drawings) · [Membership](https://www.opendesign.com/oda-membership) · [File Converter](https://www.opendesign.com/guestfiles/oda_file_Converter)  
- [LibreDWG](https://github.com/LibreDWG/libredwg)  
- [APS Model Derivative](https://aps.autodesk.com/developer/overview/model-derivative-api) · [Extra Derivatives (experimental)](https://github.com/autodesk-platform-services/aps-extra-derivatives)  
- [Roomle material configurator](https://docs.roomle.com/rubens/quick-start-guides/convert-your-static-product-into-a-material-configurator)  
- Khronos [glTF 2.0](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html) · [PBR](https://www.khronos.org/gltf/pbr)

---

## Document control

| Version | Date | Change |
|---|---|---|
| 1.0 | 2026-10-03 | Feasibility research: OBJ/DWG → GLB+MJS → Catalog 3D (no implementation) |
