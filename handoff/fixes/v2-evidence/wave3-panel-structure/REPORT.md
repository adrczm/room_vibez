# H3 (host wave 3: structure) — final report

All five tasks are done and verified in headless Chrome (SwiftShader). Final state of `$V`: `tsc --noEmit` exit 0 · unit 315/315 (28 files, none edited) · `vite build` OK (same two warnings) · e2e **41/41** with `--workers=1`, 4.2 min (32 existing + 9 new).

Every pixel figure below was measured with **overlay scrollbars (0 px)**; classic-scrollbar mode was not measured.

## 1. Per task and per "Done when"

**Task 1 — UX-07 (all five items): verified**

| Done-when | Result |
|---|---|
| Materials fully visible at 1440×900 with no panel scroll | Verified. Panel `scrollTop` 0, `#slots` and all three swatch rows inside the panel. Scroll needed: 0 px (before: 137 px to the first row, 379 px to all). |
| Within about 1.5 screens at 375×812 | Verified. Slots span 0.99 to 1.37 screens from the page top (before: 2.79 to 3.17). |
| Only visible native file input is `#model-files` | Verified with the §6 snippet: `["model-files"]` in Product, `[]` in Room. |
| Items 1 + 4 together (C2), instant scroll (QA-15) | Verified. Panel positions sampled per frame across a switch: `[300, 0]`, with and without reduced motion. |
| Item 3, presets on the stage with the deck's name | Verified. `#presets` is in `.stage-toolbar`, `aria-label="Lighting"`. |
| Item 2 order, Advanced closed, `#model-files` keeps `accept` | Verified by spec. |
| Item 5 | `#btn-remount` stays in the stage toolbar; the JSON `<details>` is unchanged. |
| Target "Product panel ≲ 1000 px" | **Not met: 1144 px** (was 2720). The long "Add 3D model" hint was left for the copy pass. |

**Task 2 — QA-03 at 375×812 (touch emulation): verified**
- Two seconds after `ready`: `scrollY` 0, canvas 100 % visible (before: 1400, 0 %).
- After tapping Room workspace: canvas 100 %.
- After Create room: `scrollY` 177, canvas 100 % (before: 604, 6 %).
- Boot no longer scrolls at all. The stage is brought into view instantly on a real workspace switch and when a room is created or loaded.

**Task 3 — UX-08 (all six items) plus the two UX-13 stepper lines: verified**
- After Create room at 1440×900: panel `scrollTop` 0, the "3 Place products" header is in view (y 560–600). One click opens it; picker, Add to room and Place product are all in view with 0 px scroll.
- In Room, no Product-card control is rendered except the picker.
- `#room-tools` is always visible in Room.
- Stepper: exactly one `aria-current="step"`. After Create room, step 2 is open and `document.activeElement` is `h3#step-openings-title`.
- Toolbar (A1 + C15): Product shows none; Room with no room shows Import project only; Room with a room shows all four. One `#project-file`, used by both the toolbar button and the empty-state card's fourth entry (file chooser checked for each).
- **Add to room, how the free spot is searched:**
  - Candidates are a grid over the floor polygon's bounds, 0.25 m apart (finer in small rooms: at least 8 steps per side), tried nearest the bounds centre first.
  - Each candidate becomes the pose a click would give, including "Snap to nearest wall" if ticked.
  - It must pass `pointInRoom`, then `checkPlacementCollision` must report no overlap twice: once with the default stand-in boxes, once with the real footprints from `viewer.getPlacementFootprint`.
  - If nothing is free, the product goes to the on-floor candidate nearest the centre that is at least half the product's smaller side from every wall, and the usual overlap warning follows.
  - Clicks are queued so two quick clicks cannot pick the same spot.
  - Verified: first chair at (0, 0) in the 5×4 room; three chairs and a table with no overlap; L-shaped room (bounds centre off the floor) places on the floor twice with no warning; snap on gives (0, −1.65) then (0, 1.65) rotated π; a 3×3 room takes 9 chairs, the 10th goes to the centre with the overlap warning.

**Task 4 — acceptance checks: run**
- **A2:** `[]` in Product fresh, Room no room, Room with room, and Product with room, at both sizes. Before: 2 ids fresh, 9 with a room, 4 in Room.
- **QA-09:** tab stops inside the hidden group: 0 (before: 12 in Product, 6 in Room). Totals 43 → 23 and 59 → 24. The first Tab on a fresh load now lands on the Product toggle.
- **QA-10 (measure only):** top bar 87 / 103 px (Product / Room) from 721 to 1920 px wide; 149 / 165 px at 375. Unchanged.
- **UX §6 snippet:** see section 6.

**Task 5 — toast: verified with a real click**
- At 375×812, with a warning toast open, `elementFromPoint` returned the canvas at all 72 sampled points under the toast text.
- A real mouse click on a floor point under the text placed the product; the close button still closes the toast and places nothing.
- CSS only, in `notify.css`: the open toast no longer takes the pointer; its buttons do.

## 2. Panel structure

`.panel` now holds two groups; `setWorkspace` gives the inactive one `hidden`. `data-workspace-panel` moved from the cards to the groups.

**`#panel-catalog`**, in order:
1. `#catalog-card`: h2, `#product-picker-home-catalog` > `#product-picker-slot` > `#product-select`, then `#product-meta`
2. `#materials-card`: `#slots`, `#slot-warnings`
3. `#add-model-card`: `#model-files`
4. `details#product-advanced` (summary `#product-advanced-summary`): Add texture, Load pack (with `#pack-params`), Load module (with `#mjs-enabled`)
5. `#parts-card`

**`#panel-room`**, in order:
1. `#room-toolbar` (sticky): `#btn-undo`, `#btn-redo`, `#btn-export-project`, `#btn-import-project`, `#project-file`
2. `#room-card`: h2, intro paragraph, `#room-tools`, then `#room-plan`, `#room-plan-actions` (Download plan PNG, Clear room), JSON details

**`#room-tools`** holds four `section.step[data-step]`, each with `h3.step-title#step-<id>-title[tabindex=-1]` > `button.step-toggle` and `div.step-body#step-<id>-body`:
- **room:** `.step-summary` (`#room-status`, `#btn-step-room-change`); body with `#room-units`, `#room-ingress`, the three ingress panels and Draw walls; then `details#room-more` (`#template-title`, `#btn-save-template-scratch`). In the scratch form the size fields sit in `details#room-size-adjust` (summary `#room-size-adjust-summary`).
- **openings:** `#opening-type`, the three fields, `#btn-opening-mode`, `#opening-list`
- **place:** `#product-picker-home-room`, `#place-wall-snap`, new `#btn-add-to-room`, `#btn-place-mode`, `#placement-list`
- **finish:** `#room-wall-material`, `#room-floor-material`

`#presets` is now in `.stage-toolbar`, after `#btn-remount`.

**Picker re-parenting:** `setWorkspace` appends `#product-picker-slot` to `#product-picker-home-room` or `#product-picker-home-catalog`. A picker mounted on the select wraps it in place, so it lands inside the slot and travels with it. `#materials-card` has an id so the next agent can move it as a unit; a comment marks the spot in step 3.

## 3. `main.ts`

**New**
- `stepParts(step)`: the elements of one step.
- `setRoomStep(step)`: opens one step, sets `aria-current`, `aria-expanded`, `hidden`, disables toggles 2–4 without a room, shows or hides "Change", and exits an active tool when the step changes.
- `scrollPanelToTop()`, `revealStage()`: instant; the second scrolls the page the minimum to show the whole stage.
- `onRoomStarted()`: step 2, panel to top, reveal stage, focus the heading with `preventScroll`.
- `syncSizeFields()`: Custom versus "Adjust size".
- `placementPose`, `footprintAtPose`, `findSpotInRoom`, `onAddToRoom`, `addCurrentProductToRoom`.
- `initPanelUi()`: fills labels from `copy` and wires steps, Change, Adjust size and Add to room; runs before any fetch.

**Changed**
- `renderRoomUi`: no longer hides `#room-tools`; hides Undo, Redo and Export without a room; disables Draw walls without a room; calls `setRoomStep`.
- `setWorkspace`: hides the inactive group, moves the picker slot, scrolls the panel to top, reveals the stage on a real switch. Both `scrollIntoView` calls are gone.
- `placeCurrentProduct(x, z, prepared?)`: optional preloaded product, root and pose.
- `renderPresets`: sets the group's `aria-label`.
- `initStageUi`: a ResizeObserver writes `--stage-toolbar-bottom` and `--room-toolbar-height`.
- `boot`: calls `initPanelUi` first; opens on step 2 when a room is restored.
- Create room, Use template, Create from plan, Create from image and Import project all call `onRoomStarted()`.

## 4. Strings

- **Added to `notInDeck`: none.**
- Used from `copy`: `notInDeck.advanced`, `.steps.*`, `.stepChange`, `.adjustSize`, `.more`, `.addToRoom`, and `productCard.lightingHeading`.
- **Existing visible text that changed:**
  - "Shell materials" is now the step title "Wall and floor finish".
  - "Place furniture" is now "Place products".
  - The "Light preset" card heading is gone; the group's `aria-label` went from "Light preset" to "Lighting".
  - Step titles carry numbers 1–4.
- Nothing else was reworded.

## 5. Specs

**Existing specs edited** (each edit mirrors a user step the new layout requires)

| Spec | Edit |
|---|---|
| `room-from-scratch` | Click Room workspace before the form; open step 3 before picker and Place. |
| `dwg-plan-import` | Same two edits. |
| `missing-features` | Open step 4 before wall material; step 3 before snap, picker, Place; "More" before template title; "Change" before the Import plan tab. |
| `room-floor-extent` | Click Room workspace before the form. |
| `room-product-stage` (2 tests) | Open step 3 after Create room. |
| `room-placement-engine` (helper) | Open step 3 after Create room. |
| `trust-fixes` | Open the step before each tool button; "Adjust size" before typing Length (assertions kept, plus hidden-before and visible-after); "Change" before Units and before Length once a room exists. |
| `feedback-and-guards` | `#btn-import-project` is now visible with no room and Export hidden (C15 reverses the old assertion); "Change" before each repeat Create room and before comparing Create with Clear; "Adjust size"; "More"; open the step before Place, Add opening and wall material. |

Unedited: `viewer`, `model-display`, `model-display-cold-load`, `room-floor-visible`, `room-place-bounds`.

**New: `tests/e2e/panel-structure.spec.ts` (9 tests)**
1. A2 in four states, file-input count, Advanced contents, no tab stop in the hidden group, first Tab.
2. Materials on arrival at 1440×900, group order, presets on the stage, instant scroll to top on a switch.
3. QA-03's three conditions with touch emulation.
4. Stepper: disabled steps, Adjust size, More, `aria-current`, focus, tool off on step change, Change, Clear, restored room.
5. One picker that travels and keeps its choice.
6. Add to room: centre, free spots, keyboard, second product, Undo.
7. Add to room in an L-shaped room.
8. Toolbar rules, single file input, sticky.
9. Toast click-through.

## 6. Results

tsc exit 0 · vitest 315/315 · build OK · e2e 41/41 (4.2 min).

**UX §6 snippet, before → after**

| State | `panelScrollH` | `slotsTopInPanel` | File inputs | Controls < 32 px | `overflowX` |
|---|---|---|---|---|---|
| 1440 Product fresh | 2720 → 1144 | 1511 → 174 | 5 → 1 | 6 → 5 | 0 → 0 |
| 1440 Room, no room | 2720 → 861 | 1511 → not rendered | 5 → 0 | 6 → 9 | 0 → 0 |
| 1440 Room, with room | 3679 → 919 | 2470 → not rendered | 5 → 0 | 8 → 8 | 0 → 0 |
| 1440 Product, with room | 3679 → 1144 | 2470 → 174 | 5 → 1 | 8 → 5 | 0 → 0 |
| 375 Product fresh | 2845 → 1144 | 1637 → 174 | 5 → 1 | 6 → 5 | 0 → 0 |
| 375 Room, with room | 3929 → 982 | 2720 → not rendered | 5 → 0 | 8 → 8 | 0 → 0 |

- The remaining controls under 32 px are all existing `.segmented button`s (31.4 px) and the existing JSON summary (17.4 px).
- Room-no-room went from 6 to 9 because the three presets no longer wrap to 49 px.
- `overflowX` is 0 from 375 to 1920 px. At 320×568 it is 33 px in Product (unchanged, QA-11) and 0 in Room.

## 7. Findings, choices, and doubts

**Found, not in the handoffs**
- **Chrome keeps a layout box for closed `<details>` content.** `offsetParent` stays non-null, so the handoffs' own snippet counted 5 file inputs with Advanced closed. I added `.panel details:not([open]) > :not(summary) { display: none }`.
- **The `toggle` event arrives late under SwiftShader**, after the next user action. "Adjust size" state is tracked on the summary's click instead.
- **The stage toolbar wraps to two rows on narrow stages and covers the top of the chair.** At 375 px it is 80 px tall; its bottom is at 93 px and the framed chair's top at 63 px, so the presets cover the top 30 px (before: toolbar bottom 46 px, no overlap). It also wraps at 861 px wide. The engine's framing does not know about the toolbar; I did not touch it.
- **On a narrow screen, "Add to room" and the tool buttons act on a stage that is off screen**, toast included. This needs the sticky stage (UX-12).
- **The room toolbar is sticky at `top: 0` at all widths.** With UX-12's sticky stage it will need a `top` offset. `--room-toolbar-height` is published on `<html>` for that.
- **`fixes/qa-evidence/*.mjs` will need the same "open a step" edits** when retargeted; they click `#btn-place-mode` and similar directly.
- **Messages written to `#room-status` replace the step-1 summary** until the next render ("Instantiated template…", "Saved template…"). Pre-existing; left for the copy pass.

**Choices the handoffs do not specify**
- "Open the next step" after Create room means step 2, as written. The golden path is therefore 4 clicks, not the 3 in UX §2.
- Exactly one step is always open; clicking the open step's header does nothing. I did not use `aria-disabled` because Playwright treats it as disabled.
- Changing step turns off an active tool, so no pressed button is hidden.
- Draw walls is disabled with no room (its handler already required one). Closing a drawn polygon does not advance the step.
- A restored room opens on step 2.
- Focus goes to the `<h3>` itself, not the toggle. "Change" also moves focus to step 1's heading.
- The 2D plan and its row (Download, Clear room) sit below the steps.
- The toolbar is a sticky panel header, not on the stage, with 12 px buttons so four fit in 340 px (about 5 px spare on macOS; it wraps otherwise).
- "More" is always present; its Save button is disabled without a room.
- Units is only reachable while step 1 is open.
- "Adjust size" remembers a manual open across preset changes.
- Add to room honours the snap checkbox.
- `#pack-params` stays inside Advanced, so it is hidden while Advanced is closed.
- `#btn-opening-mode` is now primary.
- Heading levels inside step 1 and Advanced dropped one level.
- The toast's countdown now pauses only over its buttons, and a very long toast can no longer be wheel-scrolled.

**Not verified**
- Real GPU, screen readers, Safari, Firefox, a real phone.
- Pack and module flows inside Advanced (no test loads a pack).
- Classic-scrollbar figures.
- Toolbar fit with non-macOS fonts.

**Files**
- App: `index.html`, `src/main.ts`, `src/styles.css`, `src/ui/notify.css`, `src/ui/notify.ts` (comments only), the eight specs above, and the new `tests/e2e/panel-structure.spec.ts`, all under `/Users/adrian/Desktop/Room Vibez/v2/hackathon-3d-viewer/`.
- Evidence in `/private/tmp/claude-501/-Users-adrian-Desktop-Room-Vibez/7ac663fe-e0d6-4b3c-af69-487be083d847/scratchpad/h3/`: `PROGRESS.md`, `measure-before.json`, `measure-after.json`, `e2e-full-2.log`, `shots/` (24 screenshots), `probe*.mjs`.
