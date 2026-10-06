# A1 Engine 3D: final report

All seven tasks are closed: six verified in a browser, the thumbnail spike passed, and optional drag-to-move was not done. `src/main.ts` in `ws-engine` is unedited (sha `f0137e8f1c9f`) and still typechecks. The dev server on 18781 is stopped (the exit-143 notice is my own kill). It was also killed once mid-session by the background time limit and restarted.

`WS` = `/private/tmp/claude-501/-Users-adrian-Desktop-Room-Vibez/7ac663fe-e0d6-4b3c-af69-487be083d847/scratchpad/ws-engine`. Evidence is in `…/scratchpad/out-engine/` (`floor-before.json`, `floor-final.json`, `qa02-after.json`, `probe-pick-*.txt`, `thumb-spike.json`, `shots/`). Scripts and a running note are in `…/scratchpad/engine/` (`PROGRESS.md`).

## 1. Per task

### Task 1. UX-05 with C5: verified
Living 5×4, no camera input after Create room, SwiftShader. Measured with the F8 grid code copied verbatim, plus a floor-area sample.

| | Before | After |
|---|---|---|
| 1440×900: in-room floor share of canvas (F8) | 0 % | **16.1 %** |
| 1440×900: wall share (F8) | 57.1 % | 16.3 % |
| 375×812: in-room floor share (F8) | 0 % | **15.2 %** |
| 375×812: wall share (F8) | 75.5 % | 15.9 % |
| Floor area on screen and unobstructed (15×15 points) | 0 % at both sizes | **100 %** at both sizes |
| Floor corners on canvas | 3/4 (1440), 1/4 (375) | 4/4 at both |
| Raycast through projected room centre | `wall` | `floor` |
| Camera elevation / distance (1440) | 21.2° / 8.00 m | 45.0° / 11.04 m |

Small bedroom and Studio at 1440×900 also show 100 % of the floor with 4/4 corners (floor share 11.1 % and 15.2 %).

What does it:
- **Cutaway.** Each wall is hidden while the camera is on its outer side; two walls are hidden on arrival. Opening placeholders hide with their wall, and a hidden wall leaves a flat footprint strip in the wall material. The outer side is worked out from the floor polygon, not from wall winding, because imported walls have no fixed direction.
- **Raycast.** `raycastRoom` skips hidden meshes.
- **Camera.** `frameRoom` now uses 45° and an exact fit of the room box to the canvas shape.
- **Floor colour.** Default floor `#b9b0a2` → `#766b5e`. Walls and `presets.ts` are unchanged.
- **Ceiling.** Hidden by default and the host never shows it. If shown with `setCeilingVisible(true)`, it is now hidden while the camera is above it.

Contrast (no target exists; no standard is claimed):

| Preset | Floor:wall before | after | Floor:background before | after |
|---|---|---|---|---|
| Studio soft | 1.01 | **1.76** | 1.19 | **2.15** |
| Warm interior | 1.01 | **2.53** | 1.71 | **4.30** |
| Neutral | 1.27 | **3.43** | 2.21 | **6.18** |

- These use the W12 method (orbit down 100 px, first 60 cells). The mouse drag is the same but the start elevation differs (21° before, 45° after). A second run gave 1.81 / 2.54 / 3.54 for floor:wall.
- On arrival with no input (not measurable before, no floor was visible): floor:wall 1.70 / 2.40 / 2.57, floor:background 2.02 / 4.00 / 4.58.
- Wall:background is unchanged at 1.19 / 1.67 / 1.78. Walls are still faint against the Studio soft background; that was not asked for.

Spec: `tests/e2e/room-floor-visible.spec.ts`, 4 tests (1440×900, 375×812, cutaway on/off plus a real orbit drag, ceiling).

### Task 2. QA-02 engine part: verified
- **Place-mode grid on arrival (441 points):** outside the room 26.3 % → **0 %**, wall 57.1 % → 16.3 %, in-room floor 0 % → 16.1 %.
- **Real void click (the audit's point):** 0 placements. The unedited host shows its existing "Click the floor inside the room to place furniture." A canvas-centre click places at (−0.60, −0.73), inside.
- **Floor-mesh hit outside `floor_polygon` (my choice):** a hit on the slab strip under the walls is not a floor hit. The ray carries on and the result is `null` if nothing else qualifies. So `kind: 'floor'` always means inside `rooms[0].floor_polygon`.
- **One exception:** in `draw-wall` mode any slab hit is still returned, so that mode behaves as before.
- **Fallback:** the place-mode ground-plane fallback is kept but only answers inside the polygon.
- **Tests:** `tests/e2e/room-place-bounds.spec.ts` (real clicks) and `tests/unit/roomBounds.test.ts`.

### Task 3. QA-05: verified
- Probe before: camera (4.72, 3.83, 5.77) → (0.78, 0.74, 1.04) on pick.
- Probe after: stays at (4.94, 8.75, 6.04) through both picks.
- `loadProduct` no longer frames the model while the turntable is off stage. It frames it when the turntable is next shown, so Product still gets the usual framing.
- Spec: `room-product-stage.spec.ts`, tests 1 and 2.

### Task 4. UX-06 engine part: verified at engine level
- New option `hideProductInEmptyRoom`, default off. Without it nothing changes.
- With it, a room mode with no room hides the product and its shadow ground. Mode `catalog` always shows the product.
- The host does not pass the option yet, so the spec sets it on the live viewer (`room-product-stage.spec.ts`, tests 3 and 4, including a pixel check that the chair shows in Product).

### Task 5. UX-09 engine part: verified
- Real clicks in mode `room` reach `onRoomPointer` as `{ kind: 'placement', placementId }`. In `place`, `opening` and `draw-wall` the same screen points return no placement hit.
- `setPlacementPose` keeps the same root with nothing disposed.
- The highlight follows pose changes and returns after Undo/Redo reloads the placements.
- Spec: `room-placement-engine.spec.ts`, test 1.
- **Drag-to-move: not done.** It is not small enough: it needs changes in the pointer pipeline shared with orbit, plus a host commit path. `setPlacementPose` is safe to call per drag step if someone adds it.

### Task 6. UX-16 step 1: verified at engine level, on a chair placed by a real click
- Before: 14 meshes with grey placeholders, no `libraryId`.
- After `applySlotBindings(root, chair, { frame: 'wood-walnut' })`: all 10 frame meshes have `material.userData.libraryId === 'wood-walnut'` with the walnut map; handles and pillow get their defaults.
- Re-applying frees the replaced material once and the texture cache does not grow.
- A bad binding set (unknown material, disallowed category, non-string, unknown slot) gives defaults and 4 console warnings, with no throw.
- A `preserveMaterials` product is untouched. Detaching frees the 3 library materials.
- `createMaterial` already sets `userData.libraryId`; confirmed in code and asserted.
- Not verifiable here (host part): `slot_bindings` built from current choices, and "survives reload".
- Tests: `room-placement-engine.spec.ts` test 2, `tests/unit/slotBindings.test.ts`.

### Task 7. UX-14 step 5 thumbnail spike: passed
Driven from Playwright through `import('/src/viewer/index.ts')`; the host does not use it yet.

- **Second WebGL context alongside the viewer's:** works. 0 context-lost events; viewer pixels unchanged.
- **Live context count:** 1 at boot, exactly 2 after the first render, 2 after 30 renders, 2 after `#btn-remount`, 1 after `dispose()`.
- **Time under SwiftShader, 192 px:** first render 2477 ms (context, environment, shader compile); later renders 571 to 795 ms; a queue of 30 took 19.4 s (646 ms each). At pixel ratio 2: 1427 ms cold, 495 ms warm. Real GPU not measured.
- **Disposal:** each temporary root's geometries, materials and own textures are freed after its shot; shared library textures are left alone. The thumbnail context's counters stay flat across 30 renders and are 0 after `dispose()`. Viewer counters are unchanged.
- **Cache size:** 30 cached PNG data URLs are 736 KB of strings.
- **Other behaviour:** `thumbnailUrl` wins with no render. A broken GLB rejects and the queue continues. `dispose()` with 5 queued rejects all 5.
- **Not exercised:** `.mjs` module products, and behaviour with many distinct real products.

## 2. Files (relative to `WS`; nothing else differs from the wave-0 snapshot)

Changed:
- `src/viewer/RoomVibezViewer.ts`
- `src/viewer/roomMesh.ts`
- `src/viewer/roomCollision.ts`
- `src/viewer/slots.ts`
- `src/viewer/types.ts`
- `src/viewer/index.ts`

New:
- `src/viewer/thumbnails.ts`
- `tests/unit/roomBounds.test.ts`
- `tests/unit/slotBindings.test.ts`
- `tests/e2e/room-floor-visible.spec.ts`
- `tests/e2e/room-place-bounds.spec.ts`
- `tests/e2e/room-product-stage.spec.ts`
- `tests/e2e/room-placement-engine.spec.ts`

`presets.ts` is untouched.

`index.ts` only gained exports: `loadProductRoot`, `resolveBindings`, `BindingRejectReason`, `ResolvedBindings`, `buildWallFootprint`, `wallCutawayPlane`, `WallCutawayPlane`, `DEFAULT_FLOOR_COLOR`, `DEFAULT_WALL_COLOR`, `pointInFloorPolygon`, `pointInRoom`, `createThumbnailRenderer`, `ThumbnailRenderer`, `ThumbnailRendererOptions`, `ThumbnailStats`. Live v2's `index.ts` was still identical to wave-0 at 16:40, so a file copy is safe as of then; add A2's exports on top.

## 3. Public API and how the host calls it

**Changed types (backward compatible)**
```ts
interface RoomPointerHit {
  kind: 'wall' | 'floor' | 'placement';
  wallId?: string; placementId?: string; offsetAlongWall?: number;
  point: { x: number; y: number; z: number };
}
interface ViewerOptions { /* existing */ hideProductInEmptyRoom?: boolean }
interface Product { /* existing */ thumbnailUrl?: string }
setRoomGraph(graph: RoomGraph | null, opts?: { frame?: boolean; materials?: Partial<RoomMeshMaterials>; activate?: boolean }): void
buildRoomScene(graph: RoomGraph, mats?: Partial<RoomMeshMaterials>): BuiltRoomScene   // BuiltRoomScene gains wallFootprints: Map<string, Mesh>
```

**New on `RoomVibezViewer`**
```ts
setWallCutaway(enabled: boolean): void          // default on; the host need not call it
getWallCutaway(): boolean
getPlacementRoot(placementId: string): Object3D | null
setPlacementPose(placementId: string, position: { x: number; z: number }, rotationY?: number): boolean
setPlacementHighlight(placementId: string | null): boolean
getPlacementHighlight(): string | null
applySlotBindings(root: Object3D, product: Product, bindings?: Record<string, string> | null): Promise<Record<string, string>>
```

**New functions**
```ts
// roomCollision.ts
pointInFloorPolygon(point: Vec2, polygon: readonly Vec2[], eps = 1e-6): boolean   // boundary counts as inside
pointInRoom(graph: RoomGraph, point: Vec2, margin = 0): boolean                   // rooms[0] only
// slots.ts
resolveBindings(product: Pick<Product, 'slots'>, requested?: Record<string, unknown> | null, library?: MaterialsLibrary): ResolvedBindings
interface ResolvedBindings { bindings: Record<string, string>; rejected: { slotId: string; materialId: string; reason: BindingRejectReason }[] }
type BindingRejectReason = 'unknown-slot' | 'unknown-material' | 'category-not-allowed' | 'not-a-string'
// roomMesh.ts
wallCutawayPlane(wall: WallEntity, floorPolygon: readonly Vec2[] | undefined): WallCutawayPlane | null
buildWallFootprint(wall: WallEntity, material: MeshStandardMaterial): Mesh
DEFAULT_FLOOR_COLOR = '#766b5e'; DEFAULT_WALL_COLOR = '#d8d4cc'
// RoomVibezViewer.ts
loadProductRoot(product: Product): Promise<Object3D>
// thumbnails.ts
createThumbnailRenderer(opts: { loadRoot: (p: Product) => Promise<Object3D>; applyFinish?: (root: Object3D, p: Product) => Promise<unknown> | unknown; size?: number; pixelRatio?: number }): ThumbnailRenderer
interface ThumbnailRenderer { render(p: Product): Promise<string>; peek(p: Product): string | undefined; invalidate(productId?: string): void; dispose(): void; stats(): ThumbnailStats }
```

**Host wiring**
- **UX-05:** nothing to call.
- **QA-02 (wave 2):**
  - `onRoomPointer` already gets `null` for a void click in place mode; show the message there.
  - For keyboard "Add to room", test candidate spots with `pointInRoom(roomGraph, { x, z }, margin)`.
- **UX-06 (wave 2):**
  - Pass `hideProductInEmptyRoom: true` in `mountViewer`.
  - In `setWorkspace('room')` call `viewer.setInteractionMode('room')` also when there is no room.
  - With the flag, `setRoomGraph(null)` from a room mode stays in `room`. Product needs nothing.
- **UX-09 (wave 4):**
  - Add a `mode === 'room'` branch in `onRoomPointer`: `hit?.kind === 'placement'` selects `hit.placementId`, anything else deselects.
  - Call `setPlacementHighlight(id | null)` once per selection change. It survives `reloadAllPlacements`.
  - For a nudge or rotate, call `setPlacementPose(id, { x, z }, rotY)`, then commit with `updatePlacement` and `applyRoomGraph(next, { frame: false, reloadPlacements: false })`.
  - Do not use `attachPlacement` to move.
- **UX-16 (wave 4), one rule:** `await viewer.applySlotBindings(root, product, bindings)` before `viewer.attachPlacement(...)`.
  - In `placeCurrentProduct`, build bindings from `viewer.getSlots()`.
  - In `reloadAllPlacements`, pass `pl.slot_bindings`.
  - For 16b, call it again on `getPlacementRoot(id)`.
  - `attachPlacement` is unchanged.
- **UX-14 (wave 5):**
  - Create one `createThumbnailRenderer({ loadRoot: loadPlacementRoot, applyFinish: (root, p) => viewer!.applySlotBindings(root, p) })`.
  - Call `render(product)` when the popup opens in thumbnail view and show a placeholder until it resolves.
  - Call `dispose()` with the viewer lifecycle.

## 4. Check results
- **`npx tsc --noEmit`:** exit 0, with `main.ts` unedited.
- **`npx vitest run`:** 87 passed, 20 files (baseline 66 / 18; +21 tests in 2 new files). No existing test edited.
- **E2E, scratch-copy runner:** 21 passed (9 existing + 12 new) on the final engine code. Two spec files had small spec-only edits afterwards and were re-run: 6/6.
- **`vite build`:** OK. JS 779.99 kB / 207.53 kB gzip; same two warnings as baseline.
- **Trial merge:** my 7 engine files and 2 unit tests on a scratch copy of live v2 (its `main.ts` sha `3fb70ed6eaca` at 16:40) gave tsc 0 and vitest 315/315. No e2e was run against live v2.

## 5. Found outside the handoffs, and what I am unsure of

**Found and fixed**
- **`frameRoom` never got its distance.** It asked for 13.7 m and `OrbitControls.maxDistance = 8` cut it to 8.00, which is why corners were off screen before. `frameRoom` now raises the limit per room; Product framing resets it to 8.
- **`raycastRoom` picked against stale world matrices.** Every graph change rebuilds the wall meshes, and three.js only refreshes their world matrices on the next rendered frame. A pick before that frame hit walls at the origin.
  - Seen as a UX-09 spec flake: 4 of 18 runs under load.
  - Reproduced deterministically: a same-tick pick returned `wall` in the middle of the room.
  - The original code has the same mechanism by code reading; I did not run it there.
  - Fixed by refreshing matrices before every pick. Regression test in `room-place-bounds.spec.ts` fails without the two lines and passes with them.

**Found, not mine to fix (host)**
- **`shellMaterialsFromGraph` undoes the floor contrast.** Choosing only a wall material makes it pass the floor as `library.materials[0]`. Measured: the floor becomes `#ffffff`. The engine now accepts `{ wall }` alone and keeps its default floor; the host should pass only the chosen surface.

**Decisions that are mine and unvalidated**
- Floor colour `#766b5e`.
- 45° elevation.
- The footprint strip for cut walls.
- Sticky highlight id.
- `resolveBindings` returning `{ bindings, rejected }` rather than a plain map.

**Behaviour change to know about**
- With the cutaway, the near walls cannot be clicked on arrival. To add an opening on one, the user orbits first.

**Not verified**
- Real GPU. Everything ran on SwiftShader.
- Concave rooms in a browser. The cutaway normal is unit-tested on an L-shape only.
- Graphs with more than one room. Only `rooms[0]` is used, as the floor mesh does.
- E2E after merge with the edited host. My specs rely on `#workspace-mode`, `#room-preset`, `#btn-create-room`, `#product-select`, `#btn-undo`, `#btn-redo`, `window.__rv`, and private viewer fields.
- Whether placed products cast clear shadows on the room floor. I saw none in the Studio soft screenshots and did not investigate.
