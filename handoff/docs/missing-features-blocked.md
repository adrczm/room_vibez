# Missing features — blocked / do-not-build

**Date:** 2026-10-03  
**Companion:** `missing-features-deep-analysis.md`  
**App:** Catalog 3D · `hackathon-3d-viewer` · http://127.0.0.1:18767/

Items from checklist §B that are **not** in the local build queue, plus what unblocks them. Section §C non-claims listed for completeness (never build as fakes).

---

## Blocked — need external capability

| Checklist item | Need to unblock | Notes |
|---|---|---|
| Server conversion farm | Job runner + object storage + catalog DB register + validator gate | Local `farm-job` script is not a server farm |
| Durable catalog persistence (CDN/DB) | Object storage + catalog DB write API | IndexedDB/export is local-only partial |
| Draco / Meshopt / KTX2 / LOD CDN pipeline | CDN layout + compression targets (U10) + farm stage | |
| Production materials / SKU / material_slot DB | Schema lock (U9) + DB | `catalog.json` / `materials.json` remain stand-ins |
| Real product SKUs and prices | Commerce / ERP SoR | Do not invent prices |
| Broader mesh ingest (FBX, BLEND, …) | Converter toolchain in farm (Assimp/Blender headless) + format policy | |
| AR (USDZ / AR-ready GLB) | USDZ / AR toolchain (U8) | Do not claim AR without it |
| Sandboxed MJS for untrusted uploads (production) | iframe CSP sandbox and/or server review + product policy (U11) | Local confirm+scan is partial only |
| Real ODA Drawings / Architecture SDK extract | ODA membership + SDK on build machine (U3) | Keep mock + `ODA available: no` |
| APS Model Derivative / Viewer | APS credentials + product decision; Extra Derivatives fitness Unknown | |
| ODA inWEB / DWG round-trip architect mode | ODA inWEB + round-trip product decision | |
| Multi-floor / xrefs / Architecture-object fidelity | Product scope + extract fidelity | Unknown must-have |
| Project-backend persistence | Auth + projects API | localStorage/IndexedDB ≠ projects |
| Owned Template CMS (server) | Backend CMS | Local templates remain |
| Auth | Auth backend | Do not fake login |
| Projects (server-backed) | Projects backend | |
| Commerce / ERP / real BOM | ERP / pricing SoR | |
| Multi-user collaboration | Product decision + realtime backend | Explicitly **Unknown** as decision |
| Planner 5D embed + exit adapter | Signed embed docs + RoomGraph mapping | Mapping Unknown until signed |
| Selective Planner Admin catalogue upload | Planner Admin access + package spec | |
| DWG/DXF export from authored graph | Exporter choice + fidelity bar | Fidelity **Unknown** |
| AI floor-plan recognition | AI service + human-confirm UX | Non-goal for Phase 0 scratch/DWG |
| PDF ingest if no rasterizer | `pdfjs` (or farm raster) dependency decision | JPG/PNG underlay can ship without PDF |

---

## Do not build (non-claims / inventing)

| Item | Why |
|---|---|
| Polyfork `createAsset` MJS **codegen from OBJ** | Explicitly not possible honestly; no official exporter evidenced (U12) |
| Rubens / Roomle runtime dependency | Patterns only; not chosen owned-editor path |
| Invented prices / ERP | ASSUMPTIONS non-claim |
| Fake ODA/APS fidelity while mock-only | Checklist §C |
| All checklist §C rows | Native AutoCAD UX, DWG-as-furniture, LibreDWG-as-sole-path, invented DWG→perfect graph, Babylon, auto-perfect BIM, arbitrary `.mjs` as mesh, lights-in-file SoR, Coohom-as-spec, secrets/SLAs |

---

## Partial items — what remains after local MVP

| Partial shipped locally | Still needed for “done” product |
|---|---|
| Local farm job / COLOR_0 bake script | Server queue + CDN register |
| IndexedDB + JSON export/import | Cloud projects + durable asset blobs tied to SKUs |
| MJS confirm + static guardrails | Real sandbox / review pipeline |
| Placeholder door/window meshes | Catalog opening SKUs (U15) |
| Collision soft-warn | Hard policy decision (U17) |
| Orthogonal freeform single room | Multi-room shared-wall topology |
| JPG/PNG underlay + confirm | PDF (if not added) + AI assist (optional, separate) |
| Local template CMS enrichments | Server Template CMS |
| 2D plan polish | Full interactive CAD plan (scope Unknown) |

---

## Unknowns that block decisions (not just code)

- U3 ODA vs APS vs hybrid  
- U8 AR production path  
- U9 / U10 schema and CDN  
- U11 production user `.mjs` policy  
- U12 Polyfork official exporter  
- U13 farm bake vs runtime split (preference)  
- U15 opening SKUs required?  
- U17 hard vs soft collision  
- DWG export fidelity / exporter  
- Planner AI JSON → RoomGraph mapping  
- Multi-user collaboration as a product requirement  
