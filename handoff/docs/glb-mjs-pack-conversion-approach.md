# Automated approach to GLB + MJS packs

For Chong / Room Vibez conversion-farm planning. Grounded in the hackathon viewer pack workflow and the Desktop Polyfork sample — **no invented Polyfork exporter APIs**.

**Companion docs:** `mjs-loading-in-hackathon-viewer.md`, `hackathon-glb-material-apply.md`, `final-supported-file-formats.md`, viewer `README.md`.

**Sample inspected:** `/Users/adrian/Desktop/Room Vibez/models/core-rulebook-4aedc7.mjs` + sibling `core-rulebook-4aedc7.glb`.

---

## 1) What a standard pack is

| File | Role |
|---|---|
| `name.glb` | Portable runtime mesh (Khronos glTF binary): positions, normals, UVs, optional `COLOR_0`, optional animations |
| `name.mjs` | Parametric / code materials source (Polyfork-style ES module): `createAsset`, `params`, `presets`, `materials`, … |
| Optional maps | PNG/JPEG/WebP (or KTX2 later) referenced by a materials library — not required inside the GLB for Room Vibez SoR |
| Optional sidecar JSON | `meshOrNodeName → material_slot_id` when DCC cannot embed glTF `extras` |

**Rule:** same basename stem (`core-rulebook-4aedc7.glb` ↔ `core-rulebook-4aedc7.mjs`). The hackathon viewer associates by basename on multi-select, or via a second “pack-mate GLB” upload.

---

## 2) Why both (what we observed)

### GLB = portable runtime mesh

From `core-rulebook-4aedc7.glb` (parsed):

- Nodes: `core-rulebook`, `book`, `cover`, `cover-board`
- Attributes: `POSITION`, `NORMAL`, `COLOR_0` (no `TEXCOORD_0` on this sample)
- One PBR material (roughness 0.85, metalness 0)
- **No** `extras.material_slot_id`, **no** `slot_*` node names
- Decals metadata on root extras (title-band) — informational

This is what a Three.js `GLTFLoader` / catalog CDN should ship for turntable fidelity (slots/UVs/normals when present).

### MJS = parametric / code materials (Polyfork-style)

From `core-rulebook-4aedc7.mjs` header + exports (not invented):

| Export | Observed role |
|---|---|
| `createAsset(userParams?)` | Builds a ready `THREE.Group` (merged geometries, **vertex colors**, optional `cover` rig) |
| `params` | Schema: `colorway`, `state`, `pages`, `bands`, `corners`, color zones `cover`/`gold`/`gilt`/`paper`/`ribbon`/`ink` |
| `presets` | Named colorways (`emerald`, `walnut`, `arcane-violet`, `slate-silver`) → zone hex map |
| `materials` | Zone metadata: `{ kind, finish }` e.g. cover→leather/grain, gold→metal/polished — **not** Three.js `Material` instances |
| `rig`, `view`, `decals`, … | Animation / framing / decal hooks |

Header also points at `https://polyfork.dev/cdn/core-rulebook-4aedc7-params.json` for full option docs (**external catalog**; viewer does not fetch it today).

**Important:** material “zones” in this sample are **color keys in a procedural sink**, baked into `COLOR_0` / vertex colors — they are **not** separate GLB meshes tagged with `material_slot_id`. Mesh names (`book`, `cover-board`) do **not** match zone keys (`cover`, `gold`, …). The viewer therefore reports **Unknown** for slot mapping and uses **vertex-color remap** for colorway changes when a paired GLB is loaded.

---

## 3) Automated pipeline options (real tools only)

### 3.1 DCC / mesh → GLB

Grounded in prior Room Vibez research (`final-supported-file-formats.md`, conversion-farm notes) and common industry tools:

| Stage | Tooling (examples that exist) | Notes |
|---|---|---|
| OBJ / FBX / glTF → glTF | [glTF-Transform](https://gltf-transform.dev/), [obj2gltf](https://github.com/CesiumGS/obj2gltf), Assimp (`assimp export … glb`) | Prefer glTF 2.0 + embed buffers → `.glb` |
| Optimize | glTF-Transform (`dedup`, `weld`, `resample`, optional Draco/Meshopt) | Room Vibez already lists glTF-Transform in format docs |
| Validate | [gltf-validator](https://github.khronos.org/glTF-Validator/) | Gate farm jobs on errors |
| Normals / UVs | DCC export settings; farm QA warn if missing | Viewer can `computeVertexNormals` as a last resort; **does not invent UVs** |

### 3.2 Slot tagging

| Method | When |
|---|---|
| glTF `extras.material_slot_id` on mesh or ancestor node | Preferred for owned catalog |
| Node name `slot_<id>` / `slot_<id>__<part>` | Hackathon viewer convention |
| Sidecar JSON `name → material_slot_id` | OBJ-era / farm post-pass |
| **Do not invent** slot ids from MJS `materials` keys unless they match the above | Sample zones ≠ mesh names |

Post-process with glTF-Transform script or a small farm step that writes extras from sidecar.

### 3.3 Generating or updating `.mjs`

| Question | Status |
|---|---|
| Official Polyfork “exporter” that emits `.mjs` from DCC? | **Unknown** — not evidenced in-repo; sample reads as **hand-authored / catalog-generated** TypeScript-style source (procedural geometry + params schema), licensed Polyfork asset |
| Full Polyfork codegen in Room Vibez farm? | **Do not assume** without Polyfork product docs / partnership |
| Practical automation | Generate a **thin MJS wrapper** from sidecar JSON (see below), **or** ship GLB + materials DB only and skip MJS for non-Polyfork SKUs |

**Thin MJS wrapper (proposed — Room Vibez owned, not Polyfork):**

```js
// Auto-generated stub — does NOT claim Polyfork compatibility unless createAsset matches.
export const params = { /* from sidecar.params */ };
export const presets = { /* from sidecar.presets */ };
export const materials = { /* from sidecar.materials meta */ };
export function createAsset() {
  throw new Error('Geometry lives in the paired GLB; createAsset is unavailable for this SKU');
}
```

For Polyfork assets you **license as `.mjs`**, keep the vendor file as SoR for params; pair with the vendor `.glb`. Do not reverse-engineer their generator as a commercial product (see sample license notice).

### 3.4 Validation checklist (farm gate)

- [ ] gltf-validator clean (or waived warnings listed)
- [ ] Normals present (or flagged)
- [ ] UVs present when library textures will bind
- [ ] Slot coverage: every catalog `material_slot_id` resolves to ≥1 mesh; unknown tags reported
- [ ] Basename pack integrity: `sku.glb` + optional `sku.mjs` + sidecar
- [ ] If MJS present: `createAsset` contract resolves **or** thin wrapper marked `geometry: glb-only`
- [ ] Security: MJS execution only in trusted / sandboxed contexts (see §5)

---

## 4) Recommended Room Vibez farm stages

### MVP

1. Ingest OBJ/FBX/glTF (+ textures) or vendor GLB  
2. Normalize → **GLB** (glTF-Transform / obj2gltf / Assimp)  
3. Apply slot tags (extras or sidecar)  
4. Validate normals / UVs / slots / gltf-validator  
5. Register SKU → GLB URI + `material_slot_id[]` + materials DB defaults  
6. **Optional:** attach licensed Polyfork `.mjs` as pack mate (basename); viewer prefers GLB + MJS params  

### Later

- Auto thin-MJS from sidecar for parametric colorways without vendor code  
- KTX2 / Draco / Meshopt LODs  
- CI pack diff (slot coverage, palette hash)  
- Sandboxed MJS worker (iframe CSP) if untrusted uploads ever allowed  
- Fetch Polyfork `*-params.json` only if product/legal clears CDN use  

---

## 5) Security note — executing MJS

`.mjs` is **executable JavaScript**. Dynamic `import()` in the viewer runs with page origin privileges (DOM, `fetch`, storage).

- Hackathon: **opt-in**, trusted local files only  
- Production: prefer GLB + materials DB; restrict MJS to first-party / reviewed assets, or sandbox (iframe + tight CSP), or server-side review  
- Never treat arbitrary user `.mjs` as a mesh container  

---

## 6) Open questions for Chong

1. Should production catalog SKUs **require** an `.mjs`, or is GLB + materials DB enough for non-Polyfork furniture?  
2. Is there an **official Polyfork pack exporter / params JSON schema** Room Vibez should integrate, or only hand-dropped store assets?  
3. For Polyfork vertex-color assets (no `material_slot_id`): **viewer SoR is runtime COLOR_0 zone split** into slots (Chong). Farm pre-bake of the same split before CDN remains open. COLOR_0 remap is last-resort fallback only.  
4. Should geometry params (`state` / `pages` / …) be supported in commerce UI (forces `createAsset` rebuild), or lock GLB as immutable snapshot?  
5. Who owns legal review for executing / redistributing Polyfork `.mjs` in a Room Vibez cloud pipeline?  
6. Preferred slot SoR long-term: glTF extras vs sidecar vs `slot_*` names?

---

## 7) Hackathon viewer behavior (implemented)

App: [http://127.0.0.1:18767/](http://127.0.0.1:18767/) · code: `hackathon-3d-viewer/src/viewer/packs.ts` + `splitZones.ts`  
Detail: [mjs-pack-material-slot-split.md](./mjs-pack-material-slot-split.md)

- Load pack: multi-select or pack-mate GLB + MJS  
- Prefer GLB on turntable; MJS drives params / presets / materials  
- Mapping (Chong SoR): existing slots → apply; else **COLOR_0 zone split** into `material_slot` meshes; else COLOR_0 remap **fallback**; else Unknown  
- Incomplete pack (no GLB): `createAsset()` + status warning  
- Library textures apply on split/mapped slot packs (`preserveMaterials` false)

**`core-rulebook` closed GLB:** runtime split → slots `cover`, `gold`, `gilt`, `paper`, `ribbon`; `ink` Unknown (no faces). Mesh names ≠ zone keys (unchanged observation).
