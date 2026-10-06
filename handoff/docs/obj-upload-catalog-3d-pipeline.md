# OBJ upload → Catalog 3D display + material swap

**Date:** 2026-10-03  
**App:** `/Users/adrian/Desktop/Room Vibez/hackathon-3d-viewer` · [Catalog 3D](http://127.0.0.1:18767/)  
**Based on:** `obj-dwg-auto-glb-mjs-feasibility.md` (honest pipeline — no invented Polyfork MJS)

## What was built

1. **Add 3D model** accepts OBJ packages: `.obj` + optional `.mtl` + texture maps + optional `*.slots.json`.
2. In-browser path (`src/viewer/objImport.ts`):
   - Three.js `OBJLoader` / `MTLLoader`
   - Multi-material meshes split per `usemtl`
   - Slots from `usemtl` / object names / sidecar → `material_slot_id` + `slot_<id>__…` names
   - Normals computed when missing; UV / missing-texture warnings
   - MTL → session **library materials** (best-effort PBR from Kd / Ns / map_Kd)
   - Export session **GLB** via `GLTFExporter` (geometry + slot tags; maps stay on library SoR)
3. Host wires MTL materials into the materials library so **existing slot swatches** change finishes — same UX as GLB uploads / packs.
4. Empty / bad OBJ, failed MTL, missing maps/UVs: upload status errors or slot warnings; demos unchanged.
5. Existing GLB / glTF / MJS / pack flows unchanged.

## What was not built

- Polyfork `createAsset` MJS export from OBJ  
- DWG upload  
- Server conversion farm / durable catalog persistence (still session Object URLs)  
- Room editor  

## How to try

```bash
cd "/Users/adrian/Desktop/Room Vibez/hackathon-3d-viewer"
npm run dev   # http://127.0.0.1:18767/
```

Upload fixture: `tests/fixtures/obj-stool/` (multi-select `stool.obj`, `stool.mtl`, `wood.png`, `stool.slots.json`) → product with slots **top** / **legs** → change swatches independently.

Larger sample (geometry only if textures missing): `models/20-livingroom_obj/InteriorTest.obj` + `.mtl`.

## Limits / Unknowns

| Topic | Status |
|---|---|
| MTL → PBR | Approximate (Blinn-Phong hint), not materials DB SoR forever |
| Multi-slot without named `usemtl` | Falls back to object names or single `surface` |
| Missing UVs | Warned; not invented |
| Production farm (obj2gltf + validate + CDN) | Still the long-term path per feasibility doc |
| Auto Polyfork MJS | Not possible honestly — do not claim |

## Code

- `src/viewer/objImport.ts` — OBJ package → Product  
- `src/viewer/uploads.ts` — routes OBJ vs GLB/glTF  
- `tests/unit/objImport.test.ts` + `tests/fixtures/obj-stool/`  

## Screenshots (verified Chrome / Playwright)

- `/Users/adrian/Library/Application Support/Cursor/AgentStores/cursor_agent_stores/bc-8afce985-5ced-40f9-8185-0e7758d59d72/files/media/obj-upload-catalog-3d/01-obj-loaded-slots.png`
- `/Users/adrian/Library/Application Support/Cursor/AgentStores/cursor_agent_stores/bc-8afce985-5ced-40f9-8185-0e7758d59d72/files/media/obj-upload-catalog-3d/02-obj-material-swap.png`
