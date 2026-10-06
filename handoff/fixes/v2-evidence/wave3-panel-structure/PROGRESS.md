# H3 (host wave 3: structure) — running note

Work dir: `/Users/adrian/Desktop/Room Vibez/v2/hackathon-3d-viewer` (dev server :18777, do not restart).
Snapshot to diff or restore from: `$S/base-w2/`.
Scripts: `$S/h3/lib.mjs` (helpers), `$S/h3/measure.mjs <label>` → `$S/h3/measure-<label>.json`, `$S/h3/shots.mjs` → `$S/h3/shots/`.

## Before (measured on the wave-2 state, headless Chrome, overlay scrollbars = 0 px)
File: `measure-before.json`.

| State | panelScrollH | slotsTop | file inputs | <32px | topbar | notes |
|---|---|---|---|---|---|---|
| 1440 Product fresh | 2720 | 1511 | 5 | 6 | 87 | panel settled at scrollTop 654; first swatch row needs 137 px, all slots 379 px; A2 lists btn-create-room, room-preset; 43 tab stops, 12 in the inactive group |
| 1440 Room no room | 2720 | 1511 | 5 | 6 | 103 | A2 lists the 4 product uploads |
| 1440 Room with room | 3679 | 2470 | 5 | 8 | 103 | 59 tab stops, 6 in inactive group |
| 1440 Product with room | 3679 | 2470 | 5 | 8 | 87 | A2 lists 9 ids |
| 375 Product fresh | 2845 | 1637 | 5 | 6 | 149 | scrollY 1400, canvas 0 % visible; slots at 2.79 screens |
| 375 Room no room | 2845 | 1637 | 5 | 6 | 165 | scrollY 0, canvas 100 % |
| 375 Room with room | 3929 | 2720 | 5 | 8 | 165 | scrollY 604, canvas 6 % visible |
| 375 Product with room | 3929 | 2720 | 5 | 8 | 149 | scrollY 2484, canvas 0 % |

overflowX 0 everywhere.

## Status (update after each task)
- [x] 1 UX-07 code in place (HTML, main.ts, styles.css). tsc 0. First screenshots OK. NOT yet measured "after"; specs NOT yet updated.
- [x] 2 QA-03 code in place (`revealStage`, no boot scroll). Not yet measured.
- [x] 3 UX-08 code in place (steps, toolbar, picker slot, Add to room, Adjust size, More, units). Not yet tested by spec.
- [ ] 4 acceptance checks (run `node measure.mjs after`)
- [x] 5 toast click-through: CSS in `src/ui/notify.css` (container no longer takes pointer; buttons do). Not yet verified by a real click.
- [ ] specs: NONE edited yet. All 13 existing specs need review; new spec file to add: `tests/e2e/panel-structure.spec.ts`.

## What moved in index.html
- `.panel` now holds two groups: `#panel-catalog[data-workspace-panel=catalog]` and `#panel-room[data-workspace-panel=room]` (room has `hidden` in HTML). `data-workspace-panel` is no longer on the cards.
- Product group order: `#catalog-card` (h2, `#product-picker-home-catalog` > `#product-picker-slot` > `#product-select`, `#product-meta`) → `#materials-card` (`#slots`, `#slot-warnings`) → `#add-model-card` (`#model-files`) → `details#product-advanced` (summary `#product-advanced-summary`; Add texture block, Load pack block with `#pack-params`, Load module block with `#mjs-enabled`) → `#parts-card`.
- `#presets` moved to `.stage-toolbar` (after `#btn-remount`). The "Light preset" card is gone.
- Room group: `#room-toolbar` (Undo, Redo, Export project, Import project, `#project-file`) → `#room-card` (h2, intro p, `#room-tools` with 4 `section.step[data-step=room|openings|place|finish]`, then `#room-plan`, `#room-plan-actions`, JSON details).
- Step 1: `h3.step-title#step-room-title` > `button.step-toggle`; `.step-summary` (`#room-status`, `#btn-step-room-change`); `#step-room-body` (units field, `#room-ingress`, the three ingress panels, `.step-alt` with Draw walls); `details#room-more` (`#template-title`, `#btn-save-template-scratch`).
- Scratch form: size fields now inside `details#room-size-adjust` (summary `#room-size-adjust-summary`).
- Step 3: `#product-picker-home-room`, `#place-wall-snap`, new `#btn-add-to-room`, `#btn-place-mode`, `#placement-list`.
- Heading levels: ingress subheads h3→h4, their nested ones h4→h5.

## main.ts functions
New: `stepParts`, `setRoomStep`, `scrollPanelToTop`, `revealStage`, `onRoomStarted`, `syncSizeFields`, `placementPose`, `footprintAtPose`, `findSpotInRoom`, `onAddToRoom`, `addCurrentProductToRoom`, `initPanelUi`.
Changed: `renderRoomUi` (no longer hides #room-tools; toolbar buttons; draw-walls disabled; calls setRoomStep), `setWorkspace` (groups hidden, picker slot re-parented, instant scroll to top, revealStage on change), `placeCurrentProduct` (optional `prepared`), `renderPresets` (aria-label), `initStageUi` (ResizeObserver → `--stage-toolbar-bottom`, `--room-toolbar-height`), `boot` (initPanelUi first; roomStep='openings' when a room is restored), the four room-starting flows + project import call `onRoomStarted()`, preset/size handlers call `syncSizeFields()`.

## Strings
None added to `notInDeck` so far. Used: `notInDeck.advanced`, `.steps.*`, `.stepChange`, `.adjustSize`, `.more`, `.addToRoom`, `productCard.lightingHeading`.

## Log
- (start) read handoffs, measured before.
- HTML/TS/CSS for tasks 1, 2, 3, 5 written; tsc 0; screenshots in `shots/` look right at both sizes.
- NEXT: run vitest; `node measure.mjs after`; edit specs; write new spec; run e2e; build.
- Spec edits done (see list below); new spec `tests/e2e/panel-structure.spec.ts` (9 tests) passes alone 9/9.
- Fixes found on the way: closed `<details>` content gets `display:none` (Chrome leaves offsetParent set otherwise, so the handoff's file-input count read 5); "Adjust size" state is tracked on the summary's click, not the late `toggle` event; step number and name separated by a space (accessible name "1 Room").
- Toast click-through verified by real click at 375x812 (probe2.mjs and the new spec).
- After-measurements: `measure-after.json` (re-run at the end).
- NEXT: full e2e run (`e2e-full-*.log`), build, final measure + screenshots, report.

## Spec edits (existing specs)
- room-from-scratch: click Room workspace before the room form; open step 3 before product-select/Place.
- dwg-plan-import: click Room workspace before the ingress tab; open step 3 before product-select/Place.
- missing-features: open step 4 before wall material; open step 3 before snap/select/place; open "More" before template title; click "Change" before the Import plan tab.
- room-floor-extent: click Room workspace before the room form.
- room-product-stage: open step 3 after Create room (two tests) because pick() uses #product-select in Room.
- room-placement-engine: open step 3 after Create room (helper roomWithTwoProducts).
- trust-fixes: openStep before each tool button (3 loops); "Adjust size" before typing Length (2 tests); "Change" before Units after create and before the Length field.
- feedback-and-guards: #btn-import-project now visible with no room (C15) + Export hidden; "Change" before measuring Create vs Clear; "Change" before each repeat Create room; "Adjust size" before Length; "More" before template title; openStep before Place/Add opening/wall material.
- unchanged: viewer, model-display, model-display-cold-load, room-floor-visible, room-place-bounds.

## FINAL STATE (all tasks done)
- tsc exit 0 · vitest 315/315 (28 files) · vite build OK (same two warnings) · e2e 41/41 with --workers=1, 4.2 min (`e2e-full-2.log`; 32 existing + 9 new).
- After-measurements: `measure-after.json`. Headless Chrome, overlay scrollbars (0 px).
  - 1440 Product: panelScrollH 1144 (was 2720), slotsTop 174 (was 1511), file inputs 1 (was 5), <32px 5 (was 6), panel scrollTop 0 (was 654), Materials need 0 px scroll (was 137 / 379).
  - 1440 Room no room: 861 / file inputs 0 / <32px 9 (was 6: the three presets now count, 31.4 px, no longer wrapped to 49 px).
  - 1440 Room with room: 919 (was 3679) / 0 / 8.
  - 375 Product: scrollY 0, canvas 100 % (was 1400, 0 %); slots at 0.99–1.37 screens (was 2.79–3.17).
  - 375 after Create room: scrollY 177, canvas 100 % (was 604, 6 %).
  - A2: [] in all four states at both sizes. Tab stops in hidden group: 0 (was 12 / 6). First Tab → Product toggle.
  - Top bar: 87 / 103 px at 1440; 149 / 165 at 375 (unchanged; QA-10 is the copy pass's).
  - QA-15: panel positions across a switch [300, 0] with and without reduced motion.
- Probes: probe2 (toast click-through, real click), probe4 (widths 320–1920), probe5 (UX-08 done-when), probe6 (Add to room with snap; full room fallback).
- Screenshots: `shots/` (1440x900-* and 375x812-* 1 product arrival, 2 room no room, 3 place step, 4 advanced open, 5 after Add to room; extra-*).
- Nothing half-done. No strings added to notInDeck.
