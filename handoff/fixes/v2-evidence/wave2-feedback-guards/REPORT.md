# H2 report: feedback and guards (host wave 2)

All six tasks are implemented and verified in headless Chrome (SwiftShader) with real pointer input at 1440×900 and 375×812. Final state: `tsc` exit 0 · unit 315/315 · e2e 32/32.

## 1. Per task

| Task | Reproduced before? | Result | Measured after |
|---|---|---|---|
| **1 UX-03** confirm before destroying | Yes: Create room over a room with a product, Clear and Delete template all gave 0 dialogs; Clear ended in `catalog`; Clear was 310 px wide, 8 px under Create room | **Verified** | Clear dialog reads "Clear this room?" / "This removes the walls, 1 opening and 1 placed product. **You can't undo it.** …", buttons Keep room · Clear room (`btn-critical`), focus on Keep. Keep and Esc change nothing (1 product, 1 opening, Undo still enabled). Confirm gives room null, workspace `room`, card shown, focus on the card's first button. Replace is asked for Create room, Use template, plan → room, image → room and Open project when the room has content, and not asked for an untouched room. An invalid size is reported before any dialog. Delete template reads "Delete “T-one”?". Clear is now 95 px wide, 243 px below Create room. |
| **1 defect** Clear returns after reload | Yes: create → Export → Clear → reload gave 4 walls back | **Verified** | The IndexedDB `project` key is present after Export and gone after a confirmed Clear; after reload there is no room. Keep room leaves the copy. |
| **2 UX-04** feedback on the stage | Yes: a wall click in Place mode wrote only to `#room-status`, 918 px above the Place button; no toast element; tool labels renamed themselves | **Verified** | Toast is inside the stage, above the hint, below the toolbar, 13 px, visible with the panel scrolled to 1150. `#room-status` keeps the room summary. Labels stay `Add opening` / `Place product` / `Draw walls` with `aria-pressed`. |
| **3 UX-06** empty Room state | Yes: mode `catalog`, chair visible, hint was the orbit text, no card | **Verified** | Mode `room`, turntable hidden, 0 wood pixels, hint "Create or import a room to start.", card inside the stage and clear of toolbar and hint (400×180 at 1440; 317×221 at 375), overflowX 0. Product before and after: 1072 wood px (1440), 232 (375), camera distance 1.996. Also correct after remount, after a product pick in the empty Room, and on cold load with a saved room. |
| **4 QA-04** open a project with no room | Yes: `#btn-import-project` not visible | **Verified** | The card's fourth button opens the file chooser. A file exported from a room with one real-click placement, opened in a fresh context, restores 1 placement at (0.799, −0.501) with 14 meshes in the scene. A bad file gives an error toast (`role="alert"`) and changes nothing. |
| **5 QA-02** host part | Yes: void click message only in the panel; a hook floor hit at (−0.48, 3.74) was placed and reported "Placed" | **Verified** | A real void click places nothing and shows `outsideRoom` as a warning toast. A real wall click shows "Click the floor inside the room." The same hook hit now places nothing. |
| **6** wall finish turns floor white | Yes: floor `#766b5e` → `#ffffff` | **Verified** | Wall only: floor stays `#766b5e`. Floor only: wall stays `#d8d4cc`. Holds after reload. |

**State line (the UX-04 / deck conflict).** `#stage-hint` is the only state element and always shows the deck §3.3 string for the current state (six states). With a tool on it gets `data-tool` and is styled as a chip: 13 px, weight 550, `--accent-soft` fill, `--accent` border, `--text`. With no tool on, the attribute is removed and it is the quiet 11 px nudge with the deck's idle, empty-room or Product hint. So the chip disappears; the element and the deck's no-tool hints do not. The Place chip names the selected product; the opening chip names door or window.

## 2. Files changed

- `index.html`
  - New ids: `#stage-empty`, `#stage-empty-title`, `#stage-empty-body`, plus four `button[data-empty-action=scratch|import|template|project]`.
  - `#btn-clear-room` moved into `#room-plan-actions` (the row under the 2D plan) with class `btn btn-danger`.
  - Fixed labels and `aria-pressed="false"` on the three tool buttons; `#stage-hint` initial text is the deck Product hint.
- `src/styles.css`: `.hint[data-tool]`, `.stage-empty*`, `.btn.btn-danger`; `#btn-clear-room` is `margin-left: auto` instead of full width.
- `src/copy.ts`: one `notInDeck` string.
- `src/main.ts`, added:
  - `notifyProblem(msg)`: maps a `FriendlyMessage` to a toast kind.
  - `roomHasContent()` and `confirmReplaceRoom(): Promise<boolean>`.
  - `onClearRoom()`.
  - `syncStageState()`: sets hint text, `data-tool` and card visibility from live state. Call it after workspace, room, tool, opening type or product changes.
  - `initStageUi()`: mounts the notifier, sets tool labels, fills and wires the card.
- `src/main.ts`, changed:
  - `shellMaterialsFromGraph`: returns only the chosen surfaces.
  - `applyRoomGraph`: calls `clearProjectFromIdb()` when the room is null.
  - `onUndo`, `onRedo`: toast instead of `#room-status`.
  - `renderRoomUi`: calls `syncStageState`.
  - `renderTemplateList`: confirm on Use and on Delete.
  - `onCreateRoom`, `onImportStartEditing`, `onUnderlayConfirm`, `onImportProjectFile`: async; the graph is built or validated first, then `confirmReplaceRoom`. Project import asks before `persistTemplates`.
  - `setToolButtons`: only `aria-pressed`, then `syncStageState`.
  - `setWorkspace`: always `setInteractionMode('room')` in Room; dismisses the toast on a real change.
  - `onRoomPointer`, `placeCurrentProduct`: `notify` with deck strings; `pointInRoom` guard on the requested point; a wall snap is kept only if it lands inside the room.
  - `mountViewer`: `hideProductInEmptyRoom: true`.
  - `loadProduct` and the opening-type handler: call `syncStageState`.
  - `boot`: `initStageUi()`, Clear handler.
- Specs: three edited, one added (section 4).

## 3. Strings

- **Added to `notInDeck`:** `toastDismiss: 'Dismiss'` (accessible name of the toast's close button, UX-04 item 1).
- **Existing `notInDeck` strings now on screen:** `emptyRoom.*` (six) and `outsideRoom`. `placeFailedOther`, `openingSizeInvalid` and `genericError` can appear through `friendlyError`.
- **Visible strings changed, all from `copy`:**
  - Tool buttons: both old states of each → `Add opening`, `Place product`, `Draw walls`.
  - Stage hint: all six states → deck §3.3.
  - Canvas messages → deck §4.F: `clickWall`, `clickFloor`, `clickCorner`, `openingAddedDoor/Window`, `openingTooWide/TooTall`, `drawProgress`, `drawClosed`, `drawTooFew`, `noModel`, `placing`, `placed`, `placedOverlap`, `undid`, `redid`, `importOk`, `importOkUnnamed`, `importFailed`.
  - Confirm dialogs → deck §5.
- **Not changed:** the `#room-status` summary and every panel-originated message, and the "Clear room" label.

## 4. Specs

Edited:
- `dwg-plan-import.spec.ts:89`: confirms the Clear dialog, then asserts room null and workspace `room`.
- `missing-features.spec.ts:110`: confirms the Replace dialog after `#btn-underlay-confirm` (the room has an opening and a product).
- `room-placement-engine.spec.ts:125`: the void click moved from the bottom-left to the bottom-right corner, because the "Placed …" toast now sits bottom-left and takes the click.

New, `tests/e2e/feedback-and-guards.spec.ts` (6 tests; all 6 fail when pointed at the unfixed original on :18767, page loads only):
1. Empty Room state: card, four entries, hint, layout, the three starts, the file chooser, Product unaffected.
2. Clear with confirm: Keep and Esc change nothing; confirm empties and stays in Room; Export → Clear → reload stays empty.
3. Replace: asked with content, not asked without, size error first, template and plan flows, Delete template.
4. Place mode on the stage: fixed labels, chip, `simulateRoomPointer(null, 'place')` toast, real void click, real wall click, outside point through the hook, real floor click, overlap, undo, Esc.
5. QA-04 round trip in a fresh context.
6. Wall-only and floor-only finish.

## 5. Results

- `tsc --noEmit`: exit 0.
- vitest: 315/315 (28 files), none edited.
- e2e with `--workers=1`: 32/32 in 4.0 min (26 existing + 6 new).
- `vite build` to scratch: OK, same two warnings; JS 819.78 kB (gzip 220.99).
- Top bar heights are unchanged by `help.css` now loading through `confirmDialog`: 87 / 103 px at 1440 and 1024, 149 / 165 px at 375.

## 6. Findings, choices, open points

**Found**
- The toast takes pointer events while open, so it blocks canvas clicks under the bottom-left of the stage. At 375 px a three- or four-line warning covers the near corner of the floor for up to 12 s, or until dismissed. I did not change the component in `src/ui`.
- At 375 px an error toast overlaps the bottom padding of the empty-state card.
- Two deck sentences read wrongly in their new place:
  - "…delete it from the list below" is now shown on the stage, while the list is in the side panel.
  - "Your current room is unchanged." is also shown when no room exists.
- `friendlyError` logs `console.error` for user mistakes such as an opening that does not fit. A spec that asserts no console errors would fail on those paths; none hits them today.
- Header comments in `room-product-stage.spec.ts` and `room-place-bounds.spec.ts` still say the host does not pass the option or is unchanged. I left them.

**Choices the handoffs do not specify**
- **Live regions:** each message goes to exactly one element, as your brief says. `#room-status` keeps `role="status"`, so its summary is still announced when a count changes, alongside the toast. UX-04 item 1 literally asks for only one of the two to be a live region; that is left for UX-13.
- **Clear room position:** in the row under the 2D plan, so it is hidden as well as disabled when no room exists. From the Product workspace, Clear leaves the user in Product.
- **Toast kinds:** warning for missed clicks and non-critical errors, error when `critical`, success and info otherwise, with the component's default timeouts. A toast is dismissed on a real workspace change and after a confirmed Clear.
- **Card buttons:** the three starts call `setRoomIngress` and focus that tab, which scrolls it into view. All four are secondary buttons; Import project sits under a divider.
- **Tool labels** are in `index.html` and also set from `copy` at boot. Wave 6 should pick one source.

**For the next host agent**
- `#project-file` still lives inside the hidden `#room-tools`; the card clicks it from there. Keep one input when building the toolbar.
- `trust-fixes.spec.ts` expects `#btn-clear-room` to be disabled with no room.

**Not verified**
- Real GPU, screen readers, Safari and Firefox.
- The bounds guard on a concave room.
- The `noModel`, "Place failed" and "walls too short" messages (no way to trigger them with the demo catalog).

Screenshots are in `$S/h2/shots/`, the running note is `$S/h2/PROGRESS.md`, and raw outputs are in `$S/h2/out/`.
