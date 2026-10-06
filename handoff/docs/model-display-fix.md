# Catalog 3D — model display fix

**App:** `/Users/adrian/Desktop/Room Vibez/hackathon-3d-viewer` · [http://127.0.0.1:18767/](http://127.0.0.1:18767/)  
**Brand:** Catalog 3D  
**Verified:** Playwright **Chromium** (SwiftShader) first — not Chrome.app.

## Root cause

After a room graph was loaded (Create room / persisted `catalog3d.roomGraph`), switching back to **Product** workspace:

1. Turntable GLB was set visible, but the **room shell stayed visible** and **occluded** the product.
2. Camera stayed on **room framing** (`resetCamera` preferred `frameRoom` whenever `roomGraph` existed).
3. Shadow ground stayed hidden; stage hint still said “Room …”.

Fresh Product load without a room was fine; GLB fetch / WebGL / materials were OK. Regression sits with room ↔ Product workspace interaction (post floor/z-fight + workspace toggle work).

## Fix

| Change | Where |
|--------|--------|
| Catalog mode hides room shell + placements, shows turntable + shadow ground | `RoomVibezViewer.setInteractionMode` |
| `resetCamera` frames the product while `interactionMode === 'catalog'` | `RoomVibezViewer.resetCamera` |
| Product workspace always reframes + updates stage hint | `main.ts` `setWorkspace('catalog')` |

No new features — restore Product turntable display only.

## Verify

- E2E: `tests/e2e/model-display.spec.ts` (Chromium + SwiftShader)
- Also green: `viewer.spec.ts`, `room-floor-extent.spec.ts`
- Screenshots: Project store `media/model-display-fix/` (`00-before-*` occluded, `03`/`06` after fix)

### After (Product ← Room)

- `turntable: true`, `room: false`, `ground: true`, `camDist ≈ 2`
- Canvas wood/colour samples prove lounge chair + side table render
