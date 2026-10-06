# Room from scratch — Catalog 3D MVP build note

**Date:** 2026-10-03  
**App:** `/Users/adrian/Desktop/Room Vibez/hackathon-3d-viewer` · [Catalog 3D](http://127.0.0.1:18767/)  
**Spec:** `room-from-scratch-feasibility.md` Phase 0 only  
**Preserved:** Catalog 3D branding · OBJ upload / material path (`objImport.ts`, uploads accept `.obj`)

## What works

1. **Create room** — units `m` / `cm` / `ft-in` (store meters); presets Small bedroom 3×3, Living 5×4, Studio 6×4; custom L×W×ceiling + wall thickness (default 0.12 m).
2. **Room graph SoT** — `Room` + 4 `Wall`s + `Opening`s + `Placement`s; `source_assets` empty; `provenance: authored`. Persist in-session + `localStorage` (`catalog3d.roomGraph`). Meshes rebuilt from graph.
3. **Meshing** — Approach A: wall `Shape` + opening `Path` holes + `ExtrudeGeometry`; floor thin extrude; optional ceiling plane (hidden by default).
4. **Openings** — Door | Window · click wall · W/H/sill · validate against wall length/height · **empty cutouts** (no door/window SKUs — U2).
5. **Place Catalog 3D** — select product → place mode → click floor (Y snap 0). Demo GLBs + session uploads/packs that expose a loadable root.
6. **Catalog path intact** — workspace toggle Catalog ↔ Room; GLB / glTF / OBJ / MJS pack flows unchanged.

## Out of scope (not built)

Freeform pencil walls · multi-room · collision · DWG export · AI floorplan · styled door/window meshes · undo/redo.

## How to try

```bash
cd "/Users/adrian/Desktop/Room Vibez/hackathon-3d-viewer"
npm run dev   # http://127.0.0.1:18767/
```

Room panel → Living preset → Create room → Opening mode → click wall → Place mode → click floor with Lounge chair selected.

## Code

| File | Role |
|---|---|
| `src/viewer/roomGraph.ts` | Graph SoT, presets, units, openings, placements, localStorage |
| `src/viewer/roomMesh.ts` | Shape holes + ExtrudeGeometry rebuild |
| `src/viewer/RoomVibezViewer.ts` | Room mode, raycast, placements attach |
| `src/main.ts` / `index.html` | Host UI |
| `tests/unit/roomGraph.test.ts` / `roomMesh.test.ts` | Unit coverage |
| `tests/e2e/room-from-scratch.spec.ts` | Chrome smoke + screenshots |

## Screenshots

- `media/room-from-scratch/01-room-create.png`
- `media/room-from-scratch/02-opening-mark.png`
- `media/room-from-scratch/03-furniture-place.png`

(Project store: AgentStores `bc-8afce985-…/files/media/room-from-scratch/`)

## Limits / Unknowns (from feasibility)

| ID | Status in this build |
|---|---|
| U1 wall thickness / ceiling defaults | Assumed 0.12 m / 2.7 m |
| U2 door/window SKUs | Empty cutouts only |
| U3 GLB unit/pivot hygiene | Assume meters; floor snap by AABB min Y |
| U4 collision | Non-goal — overlap allowed |
| U5 DWG export | Not built |
