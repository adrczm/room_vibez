# DWG plan import — Catalog 3D MVP build note

**Date:** 2026-10-03  
**App:** `/Users/adrian/Desktop/Room Vibez/hackathon-3d-viewer` · [Catalog 3D](http://127.0.0.1:18767/)  
**Spec:** `dwg-plan-import-room-feasibility.md` Phase 0 (honest MVP)  
**Shared SoT:** same `RoomGraph` as from-scratch (`roomGraph.ts`)  
**Preserved:** Catalog 3D branding · OBJ upload / material path · Room from-scratch workspace

## What works

1. **Upload / SourceAsset** — accept `.dwg` / `.dxf` / `.json` candidates; store `SourceAsset` (uri, sha256 for uploads, units guess, layout id, extract_path). Original kept conceptually; not used as Three.js SoT.
2. **Derive candidates** — wall / opening / room candidates with accept toggles + SVG overlay + scale confirm (known length vs extract hint).
3. **Human confirm → RoomGraph** — `confirmImportToRoomGraph` writes the **same** graph schema (`rooms` / `walls` / `openings` / `placements` / `source_assets` / `provenance`). Placements empty; DWG furniture ignored.
4. **Immediate room** — “Start editing” attaches confirmed graph to session → existing opening tools + Catalog 3D floor place.
5. **Template** — “Save as template” persists graph seed in local Template CMS (`catalog3d.roomTemplates`); “From template → Instantiate” clones via `template_instance` provenance.
6. **Mock extract path (explicit)** — ODA Drawings / APS Model Derivative **not available** on this machine. DWG/DXF uploads still become SourceAssets, but candidates come from the labeled mock fixture (`public/fixtures/dwg-import/`). Banner states `ODA available: no`. JSON candidates payloads parse directly (honest non-ODA path).

## How to try

```bash
cd "/Users/adrian/Desktop/Room Vibez/hackathon-3d-viewer"
npm run dev   # http://127.0.0.1:18767/
```

Room → **Import plan** → **Load mock fixture** → review / scale → **Start editing** (or **Save as template** → From template → Instantiate) → Place mode + Lounge chair.

## Code

| File | Role |
|---|---|
| `src/viewer/roomGraph.ts` | Shared SoT; `SourceAsset`; `provenance` object; `normalizeRoomGraph`; `cloneRoomGraphSeed` |
| `src/viewer/dwgImport.ts` | Import job, mock/JSON extract, scale, confirm → graph |
| `src/viewer/roomTemplates.ts` | Template CMS (localStorage) |
| `public/fixtures/dwg-import/*` | Mock candidates JSON + SVG preview |
| `src/main.ts` / `index.html` / `styles.css` | Ingress UI + review + outcomes |
| `tests/unit/dwgImport.test.ts` / `roomTemplates.test.ts` | Unit coverage |
| `tests/e2e/dwg-plan-import.spec.ts` | Chrome smoke + screenshots |

## Screenshots

- `media/dwg-plan-import/01-import-review.png`
- `media/dwg-plan-import/02-immediate-room.png`
- `media/dwg-plan-import/03-template-instantiate.png`

(Project store: AgentStores `bc-8afce985-…/files/media/dwg-plan-import/`)

## Limits / Unknowns (from feasibility — not invented)

| Topic | Status in this build |
|---|---|
| ODA Drawings / Architecture SDK | **Unavailable** — mock fixture only; farm gap documented |
| APS Model Derivative / Viewer | **Unavailable** — not wired |
| LibreDWG / DIY DWG parse | **Not used** (non-goal as sole fidelity path) |
| AutoCAD-class entity fidelity | **Not claimed** |
| Multi-floor / xrefs / Architecture objects | Out of MVP |
| DWG as furniture / Catalog packs | Forbidden — ignored |
| DWG as Three.js SoT | Forbidden |
| U10 default ceiling / thickness when absent | Fixture uses 2.7 m / 0.12 m (same as from-scratch defaults) |
| U11 template seeded placements | Shell-only (placements cleared on save) |

## Non-goals respected

- No fake ODA fidelity  
- No invented open-source DWG→perfect RoomGraph  
- No DWG chairs into Catalog 3D  
- No auto-perfect BIM without confirm  
