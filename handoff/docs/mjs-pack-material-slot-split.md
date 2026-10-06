# COLOR_0 zone → material_slot split (SoR)

Chong chose **split materials** (real slots) over COLOR_0-only remap for GLB+MJS packs.

**App:** [http://127.0.0.1:18767/](http://127.0.0.1:18767/) · `hackathon-3d-viewer`  
**Sample:** `models/core-rulebook-4aedc7.mjs` + `.glb`  
**AgentStores copy:** Project store `docs/mjs-pack-material-slot-split.md`

## How split works

1. Read MJS `materials` / color params → zone palette (via `presets` + defaults; sample default colorway `emerald`).
2. Probe GLB `COLOR_0` RGB against that palette (tolerance 0.02).
3. If faces match → **primary** `mappingMode: 'slots'`: at load, `splitVertexColorZones()` replaces each COLOR_0 mesh with a Group of children named `slot_<zone>`, tagged `userData.material_slot_id = zone`. UVs/normals preserved when present; normals computed if missing.
4. Library swatches and MJS colorway / color params apply **per slot** (`applyPackSlotColors`).
5. If no faces match → **fallback** `mappingMode: 'vertex-colors'` with UI label (in-place COLOR_0 remap). Never invent empty slots.

Code: `src/viewer/splitZones.ts`, wired from `packs.ts` / `main.ts` (`preparePackRoot` before slot bind).

## Slot names observed (`core-rulebook` closed GLB)

| Zone (MJS key) | Faces / verts (emerald bake) | Slot after split |
|---|---|---|
| `cover` | 390 verts | `slot_cover` · `material_slot_id=cover` |
| `gold` | 930 verts | `slot_gold` |
| `gilt` | 126 verts | `slot_gilt` |
| `paper` | 12 verts | `slot_paper` |
| `ribbon` | 114 verts | `slot_ribbon` |
| `ink` | 0 (closed book) | **Unknown** — not invented |

GLB mesh names (`book`, `cover-board`) are **not** zone ids; zones come only from COLOR_0 + MJS palette.

## Limitations / Unknowns

- Closed GLB snapshot has no `ink` faces; open state needs `createAsset()` geometry rebuild (then split against the current baked palette).
- Mixed-zone faces (rare after Polyfork bake) use unanimous match, else first matching corner.
- Vendor GLB still ships one material + COLOR_0; split is **runtime** in the viewer (farm pre-bake still open).
- No invented Polyfork APIs; Babylon not used.

## UI chrome (same app)

Header is **Catalog 3D** only — green “Hackathon prototype” pill and RV accent mark removed.
