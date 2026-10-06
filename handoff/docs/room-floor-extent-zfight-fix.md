# Room floor extent + orbit z-fight fix

**App:** Catalog 3D · `/Users/adrian/Desktop/Room Vibez/hackathon-3d-viewer` · [http://127.0.0.1:18767/](http://127.0.0.1:18767/)  
**Verified:** Playwright **Chromium** (SwiftShader) — not Chrome.app first, per Chong policy.

## Root causes

1. **Floor shorter than walls** — `buildWallMesh` used `makeBasis(dir, up, outward)`. For a CCW floor, `outward = -(dir × up)`, so that basis is **left-handed (det −1)**. `quaternion.setFromRotationMatrix` then collapses (effectively identity), so every wall stayed axis-aligned along +X from its `a` point. Walls no longer followed the closed centerline; the beige floor (correct inner rectangle) looked short vs misoriented wall solids.
2. **Orbit streaking / z-fighting** — Room floor top sat at **y = 0** with the product **shadow-ground** plane also at **y = 0**. Coplanar depth fighting produced horizontal streaking while orbiting. Expanding the floor under walls would also make wall bottom caps coplanar with the floor top.

## Fix (geometry first)

| Change | Where |
|--------|--------|
| Right-handed wall basis: +X along a→b, +Y up, +Z **inward** (`dir × up`); extrude then `translate(0,0,-thickness)` so thickness grows **outward** from the centerline | `src/viewer/roomMesh.ts` `wallBasis` / `buildWallMesh` |
| Same basis for opening placeholders | `buildOpeningPlaceholder` |
| Floor **mesh** uses `outerFloorPolygon` (miter offset by wall thickness) so the slab matches the **outer** wall footprint; graph `floor_polygon` stays the inner/centerline SoT | `outerFloorPolygon` + `buildFloorMesh` |
| Floor top recessed to `y = -FLOOR_TOP_EPS_M` (2 mm) so it is not coplanar with wall feet | `buildFloorMesh` |
| Hide shadow-ground while a room is loaded; restore for product mode | `RoomVibezViewer.setRoomGraph` |
| Snap / soft wall AABB assume outward thickness (inner = centerline) | `roomSnap.ts`, `roomCollision.ts` |
| Slightly stronger shadow bias | `RoomVibezViewer` light setup |

## Evidence

- Unit: `tests/unit/roomMesh.test.ts` — outer floor AABB equals wall union; floor top below wall min Y.
- E2E: `tests/e2e/room-floor-extent.spec.ts` — live Chromium checks footprint + hidden ground.
- Screenshots: Project store `media/room-floor-fix/` (`before-*`, `after-*`, `after-aabb.json`).

### After AABB (live Chromium, Living 5×4, t=0.12)

- Floor: 5.24 × 4.24, `footprint: outer`, maxY ≈ −0.002  
- Walls: 5.24 × 4.24, minY = 0  
- Shadow ground: `visible: false`  
- Overhang ≈ 0

## Branding / flows

Catalog 3D branding and Product ↔ Room workspace flows unchanged. Geometry/rendering only.
