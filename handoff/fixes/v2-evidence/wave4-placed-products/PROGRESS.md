# H4 (host wave 4: placed products) — running note

Work dir: `/Users/adrian/Desktop/Room Vibez/v2/hackathon-3d-viewer` (dev server :18777, do not restart).
Snapshot to diff or restore from: `$S/base-w3/`.
Scripts: `$S/h4/lib.mjs` (helpers), `$S/h4/repro*.mjs`, `$S/h4/probe*.mjs`; screenshots in `$S/h4/shots/`.

## Status
- [ ] read handoffs (done), reproduce defects (repro1.mjs) — IN PROGRESS
- [ ] Task 1 UX-16 step 2 (finish reaches the room)
- [ ] Task 2 UX-16 step 3 (Materials card in Place step)
- [ ] Task 3 UX-09 host (select, move, rotate, remove) + uploadNotRestored
- [ ] Task 4 16b (selected product's finish)
- [ ] Task 5 usability snippets
- [ ] specs, e2e full, build, screenshots, report

## Log
- 23:05 REPRODUCED all three on the wave-3 state (`repro1.mjs` → `repro1.out.json`, real pointer click):
  - Finish: card says Walnut; placed by floor click AND by Add to room → `slot_bindings.frame = wood-oak`, meshes `placeholder_frame/_handles/_pillow`, `#e7e7e7`, no map; same after reload. `#slots` not visible in Room.
  - Selection: two rows both "Lounge chair (demo)" + Delete, no aria-current; real click on the chair → highlight null, hint unchanged; R / ArrowLeft / Delete change nothing.
  - Upload gap: uploaded side-table.glb, Add to room, reload → row "STUB-SKU-UPLOAD-UPLOAD-MUVONLI3" + Delete, no root in 3D, no toast, no console line.
- 23:10 NEW FILE `src/placedProducts.ts` (pure helpers: placementRows, nudgedPosition, isNudgeKey, quarterTurn, finishForPlacing, NUDGE_STEP_M 0.05, NUDGE_BIG_STEP_M 0.25) + `tests/unit/placedProducts.test.ts` (21 tests pass). tsc 0.

## Design decisions taken (report all)
- Arrow keys move along ROOM axes (Left −x, Right +x, Up −z, Down +z = the 2D plan's axes), not screen axes: host has no public camera accessor; engine not edited.
- R = rotate right (clockwise from above, −90°), Shift+R = rotate left.
- Nudge that would take the product's point outside the floor polygon (pointInRoom, same test as placing) is refused with a toast (new string); product stays. If it is already outside (old data) moves are allowed.
- Selection cleared by: click on empty canvas, Esc (no tool on), a tool turning on, Add to room / placing, picking a product in the picker, leaving Room, placement gone (delete/undo/clear).
- Selecting from the list while a tool is on leaves the tool.
- No nudge buttons (UX-09 gives keys only; no strings). No Duplicate. No drag-to-move.
- Overlap message names other products by numbered row label → feedback-and-guards.spec.ts:432 needs "(demo) 1".
- Missing-product placements: row shows the uploadNotRestored sentence + Delete (not selectable); one warning toast on arrival in Room / after reload, once per placement per page load. {name} = the placement's SKU (product name is not saved; D3 forbids adding a field).
- 23:40 CODE IN PLACE for tasks 1–4 (tsc 0; NOT yet verified in a browser):
  - index.html: `#materials-state` (p, hidden) inside `#materials-card`; `#materials-home-room` in step 3 under the picker home.
  - copy.ts notInDeck: `placedProducts.movedOutsideRoom`, `appliesToSelectedProduct`.
  - styles.css: `.materials-home`, `.step-body #materials-card`, `.materials-state`, `.placement-row`, `.placement-name`, `.placement-actions`, `.placement-missing`.
  - main.ts NEW: state (selectedPlacementId, hoveredPlacementId, outlinedPlacementId, lastMoveNotice, announcedMissing, slotApplyPending, finishQueue, reloadRun, renderedMaterials); placementRowsNow, placementLabel, keepingFocus, placementControlKey, placementListButton, syncPlacementOutline, selectPlacement, deletePlacement, clearMoveNotice, notifyMove, moveSelectedPlacement, nudgeSelectedPlacement, rotateSelectedPlacement, ownsArrowKeys, onSelectedPlacementKey, announceMissingProducts, initPlacedProductsUi, finishToPlace, addProductToRoom (was addCurrentProductToRoom), queueFinishSync, setPlacementFinish, materialsTarget, materialsSignature, syncMaterialsCard, swatchKey.
  - main.ts CHANGED: renderRoomUi, renderPlacementList, setToolButtons, syncStageState, setWorkspace, isTypingTarget (+[popover]), onRoomPointer (mode room branch), onAddToRoom, placeCurrentProduct, reloadAllPlacements, mountViewer, renderSlots, reapplyMaterialIfBound, keydown handler, productSelect change handler, initPanelUi.
- NEXT: probe1.mjs (verify all in browser) → fix → specs → e2e → build → screenshots → snippets.
- 00:05 VERIFIED in headless Chrome (probe1/2/3/4 .mjs, outputs probe1.out.json, probe3.out.json), tsc 0:
  - T1: floor click with Walnut chosen → bindings.frame wood-walnut, 10 frame meshes libraryId wood-walnut + wood-walnut.png; Add to room right after an oak swatch click → wood-oak (not grey); after page reload both keep their finish. Undo/redo keep finish.
  - T2: `#materials-card` parent `#materials-home-room` in Room, count 1, state "Applies to the next product you place."; back in Product order catalog-card, materials-card, add-model-card, product-advanced, parts-card; state hidden.
  - T3: rows "Lounge chair (demo) 1/2"; real canvas click selects (outline, aria-current, hint with keys, focus→body); R −90°, Shift+R back, ArrowLeft −0.05 x, Shift+ArrowDown +0.25 z; root follows; 4× Ctrl+Z reverses each; Delete removes, Ctrl+Z restores; Esc / empty click / tool on / picker change / leaving Room deselect; row select while tool on leaves the tool; hover outlines; Rotate buttons keep focus.
    Nudge bounds: from x=0, ten Shift+Right reach x=2.5 (the wall line, allowed), the 11th is refused with toast "That would put “Lounge chair (demo) 1” outside the room, so it stayed where it is."; a step back shows the wall-overlap warning.
    Upload gap: after reload, arrival in Room shows warning toast with uploadNotRestored (name = SKU), once; row is `.placement-missing` with the sentence + Delete; not selectable; Delete works.
  - T4 (16b): selected chair 2 → walnut swatch → that placement's bindings + meshes walnut, turntable stays oak; Ctrl+Z → oak again; card shows the selected product's slots even when the picker shows another product.
  - Pack (real pack `models/core-rulebook-4aedc7`, mappingMode slots, preserveMaterials false): placed model keeps its own vertex-colour material, bindings = defaults, state line = slotWarnings.keepsOwnMaterials; swatch click on the selected pack → toast, nothing changes.
  - Extra change: opening a step now scrolls the whole step into view (`el.scrollIntoView nearest`) because with the card "Add to room" was 131 px below the fold at 1440×900 (top 896 vs panel 765). After: panel scrollTop 225, Add to room and Place product in view.
  - keepsOwnMaterials(product) = preserveMaterials || pack → applySlotBindings skipped, bindings saved as defaults.
- NEXT: spec edits (room-placement-engine: 2 places; feedback-and-guards:432; panel-structure:420), new spec tests/e2e/placed-products.spec.ts, full e2e, build, screenshots, usability snippets.
- 00:40 Specs: NEW `tests/e2e/placed-products.spec.ts` (7 tests) passes alone 7/7 (1.2 min). EDITED existing: room-placement-engine.spec.ts (header comment; comment line ~135; "Before" assertion now expects the default finish instead of grey placeholders), feedback-and-guards.spec.ts (overlap toast names “Lounge chair (demo) 1”), panel-structure.spec.ts (`#slots` no longer in the hidden-in-Room list; asserts the card is in the step).
  - Fixes found by the spec: hover tracking moved to a document-level `pointerover` (rows rebuilt under the pointer got no leave event → stale outline); move-toast clearing now compares with `lastToast` kept by a local `notify` wrapper (the notifier blanks its text for 80 ms before repeating a message); `pendingSlotChoices` so a card redraw during a swatch's texture load shows the clicked swatch.
  - Also: `keepsOwnMaterials` / `applyFinish` (packs), step-open scroll.
- NEXT: full e2e (`h4/e2e-full-1.log`), then usability snippets (snippets.mjs), final screenshots (shots.mjs), report.
- 01:05 Full e2e run 1 (`h4/e2e-full-1.log`): 46/48. The 2 failures:
  (a) missing-features.spec.ts — NOT a product failure: I edited main.ts while the suite ran and Vite reloaded the page mid-test. RULE: do not edit project files while e2e runs.
  (b) placed-products test 4 — REAL defect found: selecting a row when the picker holds another product changes the Materials card's height (2 slots ↔ 3 slots), the list under it moves ~32 px and the pointer ends on the neighbouring row. FIXED: `keepingInPlace(anchor, change)` + `focusedBelowMaterials()`; `selectPlacement(id, anchor?)` scrolls by however far the anchor moved (list row / Add to room / Place product / focused control). Also the slot-meta line is now shown for a selected placement when the picker holds the same product (same card height in both modes).
  Also removed the redundant deselect inside placeCurrentProduct.
- NEXT: rerun placed-products spec, then the full suite untouched; then snippets.mjs, shots.mjs; report.
- 01:20 placed-products spec 7/7 again (with the "row stays under the pointer" assertion). Task 5 DONE: `snippets.mjs` → `snippets.out.json`: both snippets run verbatim; T4 values hold (2 placements, demo-lounge-chair, both inside, one finish.frame wood-walnut; models carry oak / walnut); logger scrollPx 225 after T4 (that is the app's own step-open scroll, not a user scroll), wrongWorkspaceClicks []. Screenshots DONE (`shots.mjs`): shots/walnut-chair-in-room-*, selected-product-*, selected-product-finish-*, materials-in-place-step-* at 1440x900 and 375x812.
- Full e2e run 2 STARTED (h4/e2e-full-2.log). DO NOT EDIT PROJECT FILES WHILE IT RUNS (Vite reloads the page under the tests).
- Still to do after it: final tsc + vitest + build, report. Optional not done: probe for reapplyMaterialIfBound → placed products (code in place, unverified).
- 01:40 FINAL STATE (no project file changed after this run): tsc 0 · vitest 336/336 (29 files; 315 old unedited + 21 new) · e2e 48/48 `--workers=1` 6.0 min (`h4/e2e-full-2.log`; 41 existing + 7 new; viewer.spec.ts unedited) · build OK (same two warnings). Engine (`src/viewer/**`) byte-identical to base-w3.
- probe5: roughness map added to wood-oak reaches placed chairs; arrows left alone on a radio group; Cmd/Alt+R not taken; Delete by key moves focus to the neighbour row.
- ALL TASKS DONE. Only the final report remains (written as the agent's last message).
