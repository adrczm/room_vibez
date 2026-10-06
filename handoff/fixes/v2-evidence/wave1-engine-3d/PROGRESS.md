# A1 Engine 3D: running note (ws-engine, port 18781)

Updated: 2026-10-05 16:12. main.ts unedited (sha f0137e8f1c9f). tsc 0, vitest 66/66 at this point.

## Baseline measured before any change (out-engine/floor-before.json, probe-pick-before.txt)
- Arrival after Create room (Living 5x4), no camera input:
  - 1440x900: F8 in-room floor 0 %, walls 57.1 %, elevation 21.2 deg, floor area visible 0 %, corners on screen 3/4, room-centre raycast = wall, camDist 8.00 (frameRoom asked for 13.7 m, OrbitControls.maxDistance=8 clamped it).
  - 375x812: F8 floor 0 %, walls 75.5 %, floor area visible 0 %, corners on screen 1/4, centre raycast = wall.
- Contrast W12 method (orbit down 100 px, first 60 cells): studio-soft F/W 1.01, F/BG 1.19; warm-interior 1.01, 1.71; neutral 1.27, 2.21.
- QA-05 probe: camera (4.72,3.83,5.77) -> (0.78,0.74,1.04) on product pick in Room.

## Code state (all compiles)
- roomCollision.ts: `pointInFloorPolygon(point, polygon, eps=1e-6)`, `pointInRoom(graph, point, margin=0)`. DONE, unit test NOT yet written.
- roomMesh.ts: `wallCutawayPlane`, `buildWallFootprint`, `BuiltRoomScene.wallFootprints`, `DEFAULT_FLOOR_COLOR='#766b5e'` (was #b9b0a2), `DEFAULT_WALL_COLOR`, `buildRoomScene(graph, mats?: Partial<RoomMeshMaterials>)`.
- slots.ts: `resolveBindings(product, requested?, library?) -> { bindings, rejected }`. Unit test NOT yet written.
- RoomVibezViewer.ts: cutaway (`updateCutaway`, `setWallCutaway/getWallCutaway`, ceiling follows), new `frameRoom` (45 deg, exact fit, raises maxDistance), `raycastRoom` (skips hidden, floor only inside polygon except draw-wall, placement kind in mode room, place fallback inside polygon only), `getPlacementRoot`, `setPlacementPose`, `setPlacementHighlight`, `getPlacementHighlight`, `applySlotBindings`, `ViewerOptions.hideProductInEmptyRoom`, QA-05 (`seatModel` + `framePending`), exported `loadProductRoot`.
- index.ts: exports added for all of the above.

## Measured after (first pass, floor colour not yet final at that time)
- 1440x900 arrival: F8 floor 16.1 %, walls 16.3 %, elevation 45, floor area visible 100 %, corners 4/4, centre raycast floor, camDist 11.04, 2 walls hidden.
- 375x812 arrival: F8 floor 15.2 %, floor area visible 100 %, corners 4/4, centre floor, camDist 15.23.
- Floor colour #766b5e on arrival (tune run): studio-soft F/W 1.72 F/BG 2.07; warm 2.36 / 3.85; neutral 2.54 / 4.74.

## Still to do
1. Re-run measure-floor.mjs with final colour ("after2"); e2e spec for UX-05.
2. Unit tests: pointInFloorPolygon, resolveBindings, wallCutawayPlane.
3. E2E specs: QA-02 void click (real pointer), QA-05, UX-06 engine flag, UX-09 engine, UX-16 engine.
4. QA-05 probe re-run.
5. Thumbnails spike (thumbnails.ts, Product.thumbnailUrl).
6. Full e2e (9 existing) + new.
7. Drag-to-move: not started (optional).

## 16:25 update
- Task 1 UX-05: VERIFIED. Final floor colour #766b5e. out-engine/floor-after2.json:
  - arrival 1440x900: F8 floor 16.1 % (was 0), walls 16.3 % (was 57.1), elevation 45.0, floor area visible 100 % (was 0), corners 4/4, centre raycast floor, camDist 11.04, 2 walls hidden, ceiling hidden.
  - arrival 375x812: F8 floor 15.2 % (was 0), walls 15.9 % (was 75.5), floor area visible 100 %, corners 4/4 (was 1/4), centre floor, camDist 15.23.
  - small-bedroom / studio at 1440: floor 11.1 % / 15.2 %, visible 100 %, corners 4/4.
  - contrast W12 method (orbit 100 px, first 60): studio F/W 1.81 F/BG 2.15; warm 2.54 / 4.28; neutral 3.54 / 6.18. (before 1.01/1.19, 1.01/1.71, 1.27/2.21)
  - contrast on arrival (first 60): studio 1.70 / 2.02; warm 2.40 / 4.00; neutral 2.57 / 4.58. Wall vs background unchanged (1.19 / 1.67 / 1.78).
  - spec tests/e2e/room-floor-visible.spec.ts: 4 passed (1440, 375, cutaway on/off + orbit, ceiling).
- Unit tests written: tests/unit/roomBounds.test.ts, tests/unit/slotBindings.test.ts. vitest 86/86 (20 files).
- Next: QA-02 spec, QA-05 spec + probe, UX-06, UX-09, UX-16 specs, thumbnails.

## 16:40 update
- Task 2 QA-02 engine: VERIFIED. spec tests/e2e/room-place-bounds.spec.ts 1 passed (real clicks). out-engine/qa02-after.json: place-mode 21x21 grid on arrival: outside 0 % (was 26.3), wall 16.3 % (was 57.1), in-room floor 16.1 % (was 0); real void click -> 0 placements, unedited host shows "Click the floor inside the room to place furniture." (error class); canvas-centre click -> 1 placement at (-0.60,-0.73), inside.
  Choice: floor-mesh hit outside floor_polygon (slab strip under walls) is NOT a floor hit; ray continues; null if nothing else. Exception: mode draw-wall returns any slab hit as before.
- Task 3 QA-05: VERIFIED. probe after: camera stays (4.94, 8.75, 6.04) through both picks (before: -> (0.78,0.74,1.04) and (1.13,1.15,1.5)). spec room-product-stage.spec.ts tests 1+2 pass.
- Task 4 UX-06 engine: VERIFIED at engine level (spec tests 3+4). API: ViewerOptions.hideProductInEmptyRoom?: boolean. Host must pass it in mountViewer and call setInteractionMode('room') in setWorkspace('room') also when no room. With flag: setRoomGraph(null) in a non-catalog mode stays in 'room'.
- Next: UX-09 spec, UX-16 spec, thumbnails, full e2e.

## 16:55 update
- NOTE: dev server was killed by the background time limit at ~16:50; restarted (2 h limit). Stop it at the end: lsof -ti tcp:18781 | xargs kill
- Task 5 UX-09 engine: VERIFIED (spec tests/e2e/room-placement-engine.spec.ts test 1, real clicks). Drag-to-move: NOT done so far.
- Task 6 UX-16 step 1: VERIFIED at engine level (same spec, test 2): walnut on 10 frame meshes of a really placed chair, defaults on others, map wood-walnut.png, re-apply frees old material once, texture cache unchanged, bad bindings -> defaults + 4 console warnings, preserveMaterials untouched, detach frees 3 library materials.
  createMaterial already sets material.userData.libraryId (confirmed in code; asserted in spec).
- Specs so far (all pass, run one file at a time with --workers=1): room-floor-visible (4), room-place-bounds (1), room-product-stage (4), room-placement-engine (2).
- Next: thumbnails spike; then full e2e (9 existing + 11 new), tsc, vitest; final report.

## after thumbnails spike
- Task 7 UX-14 step 5 spike: PASSED (out-engine/thumb-spike.json, shots/thumb-*.png). src/viewer/thumbnails.ts `createThumbnailRenderer({ loadRoot, applyFinish?, size?, pixelRatio? })` -> { render(product), peek(product), invalidate(id?), dispose(), stats() }; `Product.thumbnailUrl?: string`; exported `loadProductRoot(product)`.
  - 2nd WebGL context next to the viewer: works; viewer context not lost (0 lost events), viewer pixels unchanged.
  - live contexts: boot 1; after first render 2 (viewer + one detached 192x192); after 30 renders 2; after #btn-remount 2; after dispose 1.
  - SwiftShader times at 192 px: cold first render 2477 ms; warm 571-795 ms (5 runs); queue of 30: 19.4 s total = 646 ms each; pixelRatio 2 (384 px): cold 1427, warm 495 ms. Real GPU not measured.
  - memory: thumbnail context three counters stay 11 geometries (PMREM internals) / 5 textures across 30 renders; 0/0 after dispose; viewer counters unchanged 26/5. 30 cached PNG data URLs = 736 KB of strings (21 KB chair, 15.8 KB table).
  - thumbnailUrl wins (no render); broken GLB rejects and the queue continues; dispose() while 5 queued -> all 5 reject, context gone.
- Next: full e2e, final tsc/vitest, (maybe) drag-to-move, final report, stop server.

## FOUND + FIXED (not in handoffs): stale world matrices in raycastRoom
- Symptom: UX-09 spec flaked 4/18 under load: rays over the chair returned `wall` hits at z=0 in the middle of the room.
- Cause: setRoomGraph rebuilds wall meshes on every graph change; three.js only refreshes matrixWorld at render; raycastRoom before the next frame picked the new walls at the origin. Same mechanism exists in the original code (code-read).
- Fix: raycastRoom now calls camera/roomBuilt.root/placementsRoot.updateMatrixWorld() first. After fix 18/18 under load.
- Regression test: room-place-bounds.spec.ts "a pick in the same tick as a room rebuild..." -> fails ("wall") with the two lines removed, passes with them.
- Drag-to-move: decided NOT done (optional; touches the shared orbit/pointer pipeline; needs host commit path).

## FINAL (all tasks closed; dev server on 18781 stopped)
- tsc --noEmit exit 0. vitest 87/87 (20 files; baseline 66/18). e2e 21/21 (9 existing + 12 new; main.ts unedited, sha f0137e8f1c9f). vite build OK (JS 779.99 kB / 207.53 kB gzip; baseline 773 / 205).
- Trial merge of my 7 engine files + 2 unit tests onto a scratch copy of live v2 (main.ts sha 3fb70ed6eaca at 16:40): tsc 0, vitest 315/315. No e2e run against live v2.
- Final measure (out-engine/floor-final.json) equals after2 for arrival; contrast W12 method final run: studio F/W 1.76 F/BG 2.15, warm 2.53/4.30, neutral 3.43/6.18 (after2 run: 1.81/2.15, 2.54/4.28, 3.54/6.18).
- Host finding measured (engine/shell-fallback.mjs): choosing only a wall material makes the unedited host pass floor = library.materials[0] colour #ffffff ("room:floor:default"), which undoes the floor contrast. Engine now accepts Partial<RoomMeshMaterials>; host should pass only the chosen surface.
- Files changed vs wave-0: src/viewer/{RoomVibezViewer,roomMesh,roomCollision,slots,types,index}.ts; new src/viewer/thumbnails.ts; new tests/unit/{roomBounds,slotBindings}.test.ts; new tests/e2e/{room-floor-visible,room-place-bounds,room-product-stage,room-placement-engine}.spec.ts. presets.ts untouched.
- Drag-to-move: not done.
