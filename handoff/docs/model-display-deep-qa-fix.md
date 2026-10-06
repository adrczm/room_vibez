# Catalog 3D — model display deep QA fix

**App:** `/Users/adrian/Desktop/Room Vibez/hackathon-3d-viewer` · [http://127.0.0.1:18767/](http://127.0.0.1:18767/)  
**Brand:** Catalog 3D  
**Prior fix:** [model-display-fix.md](./model-display-fix.md) (room shell hide on Product switch) — **insufficient** for Chong’s cold-load blank.  
**Verified:** Playwright **Chromium** (SwiftShader) + headed **Chrome.app** (real GPU path).

## Root cause(s)

Chong’s blank on **app open** was not a GLB 404 / WebGL / material / overlay bug.

1. **Cold boot auto-entered Room workspace** whenever `catalog3d.roomGraph` (or IndexedDB project) restored a graph:
   - `boot()` → `if (roomGraph) setWorkspace('room')`
   - Turntable demos stayed loaded but **`turntable.visible = false`**
   - Stage showed an **empty room shell** (no wood pixels) — felt like “models missing”
2. **`setRoomGraph` always forced room interaction** when called from catalog mode, so restore-on-mount hid the product before the host could land on Product.
3. Prior fix only covered **in-session Product ← Room** switches; e2e cleared `localStorage` before the “fresh product” path, so cold-load-with-persist never failed CI.

### Ruled out (this QA)

| Check | Result |
|-------|--------|
| GLB 404 / CORS | `lounge-chair.glb` / `side-table.glb` → **200** |
| JS exceptions / failed imports | none |
| WebGL context lost | none |
| Zero-size canvas / CSS overlay | canvas ~890×679, `elementFromPoint` → canvas |
| Black-on-black materials | fresh Product wood samples OK |
| Frustum / camera (Product) | `camDist ≈ 2` after fix |
| Empty catalog / wrong product | demos still selected; meshCount 14 on turntable |

## Fix

| Change | Where |
|--------|--------|
| Cold boot **always** lands on **Product** (`setWorkspace('catalog')`) | `main.ts` `boot()` |
| Persisted room graph still restored into viewer, but **`activate: false`** so shell stays hidden until user opens Room | `RoomVibezViewer.setRoomGraph` + `mountViewer` |
| Remount preserves catalog mode (no yank into Room) | `main.ts` remount handler |

No new features — Product is the honest default landing; Room data remains available.

## Before → after (persisted room cold load)

| | Before | After |
|--|--------|-------|
| workspace | `room` | `catalog` |
| turntable | hidden | visible |
| room shell | visible (empty) | hidden |
| wood pixels | **0** | **~794** |
| meshCount (turntable) | 14 (invisible) | 14 (visible) |
| camDist | ~8 (room) | ~2 (product) |

## QA matrix

| Case | Browser | Result |
|------|---------|--------|
| Fresh storage cold load | Chromium + SwiftShader | Product + wood pixels |
| Create room → hard reload | Chromium + SwiftShader | Product + wood + meshCount>5; graph still in LS |
| Product ← Room after create | Chromium + SwiftShader | prior e2e still green |
| Room workspace after Product landing | Chromium + SwiftShader | shell visible, turntable hidden |
| Remount / floor z-fight / room-from-scratch / viewer | Chromium + SwiftShader | green |
| Cold load after persist | **Headed Chrome.app** | Product + wood **802** (matches SwiftShader; not GPU-only) |

**Unknown:** Chong’s exact machine GPU driver vs this headed Chrome — headed check matched SwiftShader here.

## Tests

- `tests/e2e/model-display-cold-load.spec.ts` — **pixels + mesh count** on cold start with persisted room
- Also green: `model-display.spec.ts`, `viewer.spec.ts`, `room-floor-extent.spec.ts`, `room-from-scratch.spec.ts`
- `npm run typecheck`

## Screenshots

Store + Desktop: `media/model-display-deep-qa/`

- **Before (blank product):** `04-cold-reload-with-room-persist.png`, `06-cold-again.png` (empty room shell)
- **After:** `11-cold-load-after-fix.png`, `20-after-cold-load-canvas.png`, `21-after-cold-load-full.png`
- Probe JSON: `probe-before-fix.json`, `cold-load-verify.json`

## URL

[http://127.0.0.1:18767/](http://127.0.0.1:18767/) — server left running.
