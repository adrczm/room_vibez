## Wave 4 (H4, placed products): final report

All five tasks are done and verified in headless Chrome (SwiftShader) with real pointer clicks on the canvas. Final state: `tsc` 0 · unit 336/336 · e2e 48/48 (`--workers=1`, 6.0 min) · build OK. The engine (`src/viewer/**`) is byte-identical to `base-w3`. Drag-to-move was not built, as instructed.

Running note: `$S/h4/PROGRESS.md`. Probe scripts and outputs: `$S/h4/*.mjs`, `*.out.json`. Screenshots: `$S/h4/shots/`.

---

### 1. Per task and "Done when" line

**Reproduced first on the wave-3 state** (`repro1.mjs`, real pointer click):
- **Finish:** card says Walnut; placed by floor click and by Add to room → `slot_bindings.frame = wood-oak`, meshes `placeholder_frame/_handles/_pillow`, `#e7e7e7`, no map; same after reload. `#slots` not visible in Room.
- **Selection:** two rows both "Lounge chair (demo)" + Delete; a real click on the chair → highlight null; R / ArrowLeft / Delete change nothing.
- **Upload gap:** uploaded `side-table.glb`, Add to room, reload → row `STUB-SKU-UPLOAD-UPLOAD-…` + Delete, no model in 3D, no toast, no console line.

**Task 1, UX-16 step 2: verified**

| Done-when | Result |
|---|---|
| Walnut then place → `slot_bindings.frame === 'wood-walnut'`, every frame mesh `libraryId 'wood-walnut'` | Verified by floor click and by Add to room: the frame meshes carry `wood-walnut` with `wood-walnut.png`; 0 meshes at `#e7e7e7` |
| Default placement is oak, not grey | Verified: 14 meshes, `frame wood-oak` / `handles plastic-black` / `pillow wool-cream`, 0 grey |
| Survives reload | Verified (walnut + black-ash chairs, and a 16b change) |
| Pack / `preserveMaterials` keeps its own materials | Verified two ways: a demo product flagged `preserveMaterials` in an e2e test (all meshes `embedded:*`), and the real pack `models/core-rulebook-4aedc7` in a probe (keeps its vertex-colour material). A `.mjs`-only module was not exercised |
| Undo / redo of placements unaffected; unit tests unedited | Verified; finishes are intact after undo, redo |

**Task 2, UX-16 step 3: verified.** One `#materials-card` (count 1), parent `#materials-home-room` in Room, under the picker and above Add to room, state line "Applies to the next product you place." A swatch in Room changes the hidden turntable only: the placed chair stays oak and Redo stays disabled. Back in Product the card order is unchanged and the line is hidden.

**Task 3, UX-09 host: verified**
- Rows "Lounge chair (demo) 1/2", "Side table (demo) 1".
- Real click on chair 2 → row 2 `aria-current="true"`, engine outline on it, hint "Arrow keys to move · R to rotate · Delete to remove".
- R → −1.5708, Shift+R → 0; arrows ±0.05 m, Shift ±0.25 m; the model follows the graph.
- Six Ctrl/Cmd+Z reverse six steps one by one; Delete and Backspace remove, Undo restores.
- Row click, hover outline, Rotate buttons, row Delete all work; `simulateRoomPointer({kind:'placement'}, 'room')` selects.
- Overlap after a move: "“Lounge chair (demo) 2” overlaps “Lounge chair (demo) 1”. You can leave it, or move it again." It closes on the next clear move.
- **Not-restored upload:** after reload nothing is said on the Product stage. On arrival in Room one warning toast shows `uploadNotRestored`, once per placement per page load. The row is `.placement-missing` with the same sentence and only Delete; it cannot be selected.

**Task 4, 16b: verified.** With the picker on the side table and chair 2 selected, the card shows frame/handles/pillow and "Applies to “Lounge chair (demo) 2”." Walnut changes that placement's bindings and meshes only; chair 1 and the turntable are untouched. Undo and Redo step one change at a time and the card follows. Esc returns to the picker's product and the "next product" line. The change survives reload.

**Task 5, snippets: both run verbatim, no change needed** (`snippets.out.json`). After a real T4 flow the outcome check returns 2 placements, both `demo-lounge-chair`, both `inside: true`, exactly one `finish.frame: "wood-walnut"`, `tool: "room"`. T1 values also hold.
- The logger read `scrollPx: 225` after T4. That is the app's own scroll when the step opens, so the logger counts app scrolls too.
- On screens ≤ 860 px the page scrolls, not `.panel`, so the logger's `scrollPx` stays 0 there (from the layout CSS; not run at that width).

---

### 2. `main.ts`

**New file:** `src/placedProducts.ts` (pure helpers; `main.ts` cannot be imported by vitest): `placementRows`, `nudgedPosition`, `isNudgeKey`, `quarterTurn`, `finishForPlacing`, `NUDGE_STEP_M` 0.05, `NUDGE_BIG_STEP_M` 0.25.

**New element ids:** `#materials-state` (inside `#materials-card`), `#materials-home-room` (step 3, under `#product-picker-home-room`). Rows are `li.placement-row[data-placement-id]` holding `button.placement-name[data-action=select]`, `button[data-action=delete]`, and on the selected row `.placement-actions` with `rotate-left` / `rotate-right`. A missing product is `li.placement-missing`. The old `li > span` is gone; `fixes/qa-evidence/walkthrough-tasks.mjs:94,100` and `audit-viewer.mjs:666-667` read these rows.

**Added**
- Selection: `selectPlacement(id, anchor?)` is the only setter. Also `syncPlacementOutline`, `placementRowsNow`, `placementLabel`, `initPlacedProductsUi` (click delegation on the list, hover by a document-level `pointerover`).
- Actions: `moveSelectedPlacement`, `nudgeSelectedPlacement`, `rotateSelectedPlacement`, `deletePlacement`, `onSelectedPlacementKey`, `ownsArrowKeys`, `notifyMove`, `clearMoveNotice`.
- Finish: `finishToPlace`, `keepsOwnMaterials` (`preserveMaterials || pack`), `applyFinish`, `queueFinishSync`, `setPlacementFinish`.
- Card: `materialsTarget`, `materialsSignature`, `syncMaterialsCard`, `swatchKey`.
- Other: `announceMissingProducts`, `keepingFocus`, `keepingInPlace`, `focusedBelowMaterials`, and a local `notify` wrapper that remembers the last toast text.

**Changed**
- `placeCurrentProduct`: `prepared` now carries `finish`; the finish is applied before attach.
- `onAddToRoom` / `addProductToRoom` (was `addCurrentProductToRoom`): product and finish are fixed at click time.
- `reloadAllPlacements`: applies saved bindings, stops when a newer run starts or the viewer is replaced, and attaches at the graph's current pose.
- `renderPlacementList`, `renderSlots`, `renderRoomUi`, `setWorkspace`, `setToolButtons`, `syncStageState`, `onRoomPointer` (new `mode === 'room'` branch), `mountViewer` (restores the outline after Restart 3D view).
- `isTypingTarget` now also treats `[popover]` as owned by the control.
- `reapplyMaterialIfBound` also refreshes placed products wearing that material.
- The keydown handler, the `#product-select` change handler, the `#btn-place-mode` handler.
- The step-toggle handler in `initPanelUi` now scrolls the whole step into view.

**How the card moves:** `setWorkspace` appends `#materials-card` to `#materials-home-room` in Room and does `catalogCard.after(materialsCard)` in Product.

**What decides what it shows** (`materialsTarget`):
- Room with a selected placement whose product is in the catalog → that product's slots from its `slot_bindings`; a swatch calls `setPlacementFinish`.
- Otherwise → the turntable product's slots; a swatch calls `viewer.setSlotMaterial`.
- The state line shows in Room only. For a pack or `preserveMaterials` product it reads the deck's `slotWarnings.keepsOwnMaterials` instead.

---

### 3. Keyboard map

Active in the Room workspace when focus is not in a typing target, a dialog or a popover.

| Key | Effect | Extra condition |
|---|---|---|
| Arrow keys | Move 0.05 m; Left −x, Right +x, Up −z, Down +z | A product is selected; focus not on a radio group, list box, slider, tab list or menu |
| Shift + arrow | Move 0.25 m | Same |
| R | Rotate right 90° (clockwise from above) | A product is selected; no Ctrl/Cmd/Alt |
| Shift+R | Rotate left 90° | Same |
| Delete, Backspace | Remove the selected product | Same |
| Esc | Leave the active tool; with no tool on, deselect | — |
| Ctrl/Cmd+Z, Shift+Z, Y | Undo / redo | Unchanged |

Each press, including key auto-repeat, is one history step (history is 50 deep).

---

### 4. Strings

**Added to `notInDeck`** (both written by me, unreviewed):
- `placedProducts.movedOutsideRoom`: "That would put “{name}” outside the room, so it stayed where it is."
- `appliesToSelectedProduct`: "Applies to “{name}”."

**No existing string was reworded.** What users now see differently:
- Rows are numbered.
- The placed-overlap toast names the other product by its row ("“Lounge chair (demo) 1”").
- A missing product's row shows the sentence instead of a SKU.
- The stage hint shows the keys while a product is selected.

**Left for the copy pass:**
- The card heading still reads "Material slots" (UX-16 step 3 asks for "Materials").
- `#placement-list` still has `aria-label="Placements"`.
- `placedProducts.duplicate` is unused.
- Help text at `src/help-content.ts:104`, "To move something, delete it from the list and place it again", is now false.

---

### 5. Specs

**Existing specs edited (3)**
- `room-placement-engine.spec.ts`: the "Before" assertion expected grey placeholders from the host; it now expects the default finish. Two comments updated.
- `feedback-and-guards.spec.ts`: the overlap toast is now "It overlaps “Lounge chair (demo) 1”." This follows from numbered rows plus the `errors.ts` contract ("the row name"); it is a one-line revert if unwanted.
- `panel-structure.spec.ts`: `slots` removed from the "hidden in Room" list, and it now asserts the card is in the step (DT6).

`viewer.spec.ts` is unedited and passes.

**New**
- `tests/e2e/placed-products.spec.ts`, 7 tests:
  1. Finish by Add to room and by floor click, including a swatch-then-place race and `preserveMaterials`.
  2. Finish survives undo, redo, reload.
  3. One Materials card and where it sits.
  4. Numbered rows and selection by canvas click, row, hover, Esc, tool, picker, workspace, including "the clicked row stays under the pointer".
  5. Rotate, nudge, delete by key and button, Undo of each, the typing guard, the overlap warning, the room edge.
  6. 16b with Undo, Redo, reload.
  7. The not-restored upload message.
- `tests/unit/placedProducts.test.ts`, 21 tests.

---

### 6. Results

- `tsc --noEmit`: exit 0.
- vitest: 336/336 in 29 files (315 existing, unedited, plus 21 new).
- e2e: 48/48 (41 existing + 7 new); log `$S/h4/e2e-full-2.log`.
- `vite build`: OK, same two warnings.

An earlier full run showed 46/48. One failure was mine: I edited `main.ts` mid-run and Vite reloaded the page under a test. The other was the real layout defect listed first in §7.

---

### 7. Findings, choices and open points

**Found and fixed on the way**
- **The list jumped under the pointer.** Selecting a row while the picker holds another product changed the card's height (2 ↔ 3 slots), the list moved about 32 px, and the pointer ended on the neighbouring row. A second click could have hit Add to room. `selectPlacement` now scrolls by however far its anchor moved.
- **Add to room fell below the fold.** With the card in the step, it sat 131 px below the fold at 1440×900. Opening a step now scrolls the whole step into view. This changes H3's step-open behaviour.
- **A fast swatch-then-place got the old finish**, because `getSlots()` updates only after textures load. Placing now waits for pending swatch clicks.

**Choices the handoffs do not specify**
- **Nudge axes are the room's, not the screen's.** The host has no public camera accessor and I did not edit the engine. In the default view Right moves right-and-nearer and Up moves away; once the user orbits to the far side the keys run against the screen. Fixing it needs one read-only view-direction getter on the engine.
- **Nudge at the room edge.** A step whose new floor point fails `pointInRoom` (the test a Place click must pass) is refused whole: the product stays, a warning toast says so, and no history step is added. The wall line itself is allowed. A product already outside may move freely. Wall overlap stays a soft warning.
- **No nudge buttons.** UX-09 gives nudge keys only and there are no strings, so on touch a product can be rotated and deleted but not moved.
- **What clears the selection:** an empty-canvas click, Esc, any tool turning on, Add to room, choosing a product in the picker, leaving Room, or the placement disappearing. A new placement is not auto-selected. Selecting a row while a tool is on leaves the tool.
- **Row numbers are positions, counted per displayed name.** They shift after a delete.
- **Packs keep their own materials in the room** even when `preserveMaterials` is false; their bindings are saved as defaults.
- **Overlap check** uses the same call as the placed-product warning (0.55 m stand-in boxes for the other products), so the two messages cannot contradict each other.
- **Toast wins over "Opened project".** After a project is opened with a missing product, the not-restored toast replaces the "Opened project …" toast.
- **Hover uses the same outline as selection** (the engine has one).

**Open or unverified**
- The not-restored message can only name the product by its placeholder SKU: the name is not saved, and D3 rules out a new field. Its "after a refresh" wording is also shown for an imported project with an unknown product.
- A finish that used an uploaded texture falls back to the default after reload with only a console warning. This is by the UX-16 spec; I did not surface or test it.
- Not exercised: real GPU, Safari and Firefox, nudging in a concave room, `.mjs`-only modules, OBJ uploads in the room. The `[popover]` guard was checked with a synthetic popover only, since no picker is mounted yet.
- Every nudge rebuilds the room shell through `applyRoomGraph`. Fine in the demo room; not measured on large rooms.
- For the next agent: `renderSlots()` now also runs on every workspace switch. Arrow keys are deliberately ignored on `[role=radiogroup]` / `[role=listbox]`, so a selected product will not move while focus sits on a light preset or a picker.
