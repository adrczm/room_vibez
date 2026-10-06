# QA, validation and usability findings: handoff to the implementing Claude

**For:** the Claude session that applies the combined fix. You have no memory of the session that wrote this.
**From:** a QA session on 2026-10-05 (14:40 to 15:40), requested by Adrian. Skills run: `design-ops:design-qa-checklist`, `design-ops:handoff`, `data:validate-data`, `design-research:usability-test-plan`, `designpowers:usability-testing`, `ui-design:aesthetic-usability`.
**Status:** **nothing here is applied.** This session changed no app code. Every number below was measured today unless it is tagged *code-read* or *inferred*.
**Scope:** `hackathon-3d-viewer/` ("Catalog 3D", `http://127.0.0.1:18767/`). The prototype got a light pass only.
**Project root:** `/Users/adrian/Desktop/Room Vibez/` (not a git repo). Paths are relative to it.

---

## 0. This is the fourth document. What it owns

| Document | Owns | Open it when |
|---|---|---|
| `fixes/ux-improvements-handoff.md` (**UX**, items UX-01 to UX-13) | Behaviour, layout, flow | You implement anything structural |
| `fixes/ux-copy-improvements.md` + `docs/ux-copy-deck.md` (**Copy**) | Every user-facing word, the **?** dialog, messages, confirmations | You touch a string |
| `fixes/ux-catalog-picker-handoff.md` (**Picker**, UX-14 to UX-16, A1 to A3) | Thumbnail/list picker, texture options, finishes in the room | You touch the product picker, materials or placement |
| **This document** (**QA**, items QA-01 to QA-19) | (1) corrections to the numbers and claims in the three above, (2) defects none of them lists, (3) the acceptance gates for the combined fix, (4) the usability test protocol | Before you plan, and again before you report |

Three files sit beside this one. Each is reached from a step in §1:

- `fixes/design-qa-checklist.md`: 72 gates with today's result for each. You run it after the fix.
- `fixes/validation-report.md`: which earlier numbers hold, which don't, and why.
- `fixes/usability-test-plan.md`: the protocol for testing with people. Claude cannot run it.

**Words:** the deck wins, as in the other handoffs. New strings this document needs are marked *new string*; write them in the deck's voice, put them in `src/copy.ts`, list them in the completion doc.

---

## 1. Steps

Do them in order. Each ends on a check.

1. **Confirm you are looking at the build that was measured.** Run `shasum -a 256 <file> | cut -c1-12` on the six files in §8 and compare.
   *Done when* all six match, or you have re-run the three audit scripts (§8) and are working from your own output instead of the numbers here.
2. **Read §2 and adjust how you read the other three handoffs.** Fifteen corrections; four change what you build (C2, C3, C5, C15).
   *Done when* your plan names each of those four.
3. **Fold QA-01 to QA-19 (§3) into the combined order.** The "Fold into" column says where each belongs. QA-01 to QA-04 are 🔴 and small; do them with UX Phase A/B.
   *Done when* every QA id appears in your plan as taken, deferred (with reason) or already covered by another item you took.
4. **Build.** Follow the other handoffs' rules (snapshot first, targeted edits, dev server already on `:18767`, e2e by scratch copy).
5. **Run the gates.** Open `fixes/design-qa-checklist.md` and fill the "After" column for all 72 rows. Re-run the audit scripts for the rows marked *script*.
   *Done when* every row has pass, fail or not-run with a reason. A blank row is not done.
6. **Report in the one completion doc** (`docs/ux-fix.md`, UX §8). Add a section "QA gates" with the before/after table, the QA ids you took, the §6 defaults you took, and what you could not verify.
7. **Usability test: prepare, then hand to Adrian.** `fixes/usability-test-plan.md` §9 lists two things Claude can prepare (a plan-image test asset and the success-check snippet). The sessions need people.
   *Done when* the two assets exist and your completion doc tells Adrian the test has not been run.

---

## 2. Corrections to the other handoffs

Full reasoning and the spot-check table are in `fixes/validation-report.md`. **C2, C3, C5 and C15 change what you build.**

| # | Earlier claim | Measured today | What to do |
|---|---|---|---|
| C1 | Panel scroll height 3106 px; Materials at 1835; Light preset 2704; room card 926 / 1705; 3 controls under 32 px; scrollTop 161 after switching to Room (UX §2) | **Exact** when the panel has a 15 px classic scrollbar: the in-app browser has one (`offsetWidth` 340, `clientWidth` 325). With overlay scrollbars (headless Chrome): 3036 / 1766 / 2635 / 874 / 1670 / **6** controls / 109 | Record which scrollbar mode you measured in. Compare like with like. Targets are unchanged |
| **C2** | "Make the chair walnut: scroll 1835 px" (UX §2 task flows) | Boot calls `setWorkspace('catalog')`, which smooth-scrolls the panel to the Product card (settles at scrollTop **886**, or 938 with a classic scrollbar). From there the first swatch row needs **159 px** of scroll at 1440×900 and **259 px** at 1280×800; all three slots need 402 / 502 px (overlay scrollbars). 1835 is an offset inside the panel, not a distance anyone scrolls | The problem stands (Materials are not visible on arrival). Size it as 159 px in your before/after table. **UX-07 item 1 and item 4 must ship together:** replacing the boot `scrollIntoView` with `scrollTo({top:0})` while the Room card is still first would hide the Product card below the fold |
| **C3** | UX-02: one element (`#project-file`) ignores `hidden` | **Five** do. See QA-08 | Same one-line fix. Re-measure the UX §2 table after it lands; the room card gets shorter |
| C4 | UX-10 "verify first"; Picker UX-16 "verified with the test hook" | Confirmed again with a **real pointer click** and **after a reload**: placed products have materials `placeholder_frame / _handles / _pillow`, colour `#e7e7e7`, no map. Stored `slot_bindings` are the defaults, which match neither the screen nor the user's choice. A swatch click in the Room workspace changes only the hidden turntable product | Follow Picker UX-16. Don't ship UX-10's fallback sentence ("placed products use the product's default finishes"): today they use neither |
| **C5** | UX-05: "raise the default elevation to roughly 45–55° so the floor shows from the first frame"; done-when "whole floor visible" | In-room floor share of the canvas (Living 5×4, 21×21 raycast grid): **0 %** today at 21.2°; 7.0 % at 40°; 14.7 % at 48°; 22.7 % at 56°; 34.2 % looking straight down. Walls still cover 42 to 57 % of the canvas at those three angles (36 % straight down) | Elevation alone cannot meet the done-when. The cutaway (UX-05 item 2) is required. Rendered floor-vs-wall contrast today: **1.01:1** (Studio soft), 1.02:1 (Warm interior), 1.28:1 (Neutral) |
| C6 | UX-13: arrow keys on radio groups "not tested"; Esc assumed missing | Both **verified missing**. ArrowRight on the workspace toggle changes nothing; no roving tabindex on any of the 4 groups; Esc leaves `aria-pressed="true"` | UX-13 and UX-04 item 3 as written |
| C7 | Mobile: 4.3 screens to Materials (UX §2) | **3.1** screens on a fresh load (2523 px); **4.2** once a room exists (3444 px). The 4.3 figure matches the with-room state (*inferred*). The bigger mobile problem is QA-03 | Use 3.1 as "before" for a fresh load |
| C8 | "The e2e suite was not run" (all three handoffs, stress test) | **Run today by the scratch-copy method: 9/9 passed in 46.4 s.** Unit 66/66 (18 files). `tsc --noEmit` exit 0. `vite build` OK (JS 773 kB, 205 kB gzip, one chunk, two warnings) | This is your regression baseline |
| C9 | Copy §Not verified: does `toContainText` pass on collapsed `<details>`? | **Yes** (Playwright 1.63, default `textContent`). It fails with `{ useInnerText: true }` | Copy Phase 1 steps 5 and 6 are safe |
| C10 | `export PATH=~/.nvm/versions/node/v22.23.2/bin:$PATH` (UX §1) | That directory does not exist. Installed: v24.17.0, v24.21.0. `node` on PATH is v24.21.0 | Skip the line |
| C11 | "284 → 91 words", "the 14 paragraphs" (Copy, deck §3.1, §8) | The 12 sidebar paragraphs total **285** words. The 14 paragraphs the deck lists total **304** with the same tokenizer (the deck's own per-row counts 58 / 54 / 41 match mine 57 / 54 / 41) | State which set you count. For all 14, "before" is 304 |
| C12 | Dimmed card text "≈3.4:1 (computed, not measured)" | **3.37:1** muted text on the card; 3.08:1 on the grey track and badge; 3.07:1 white on the dimmed primary button. 15 failing text elements in Product mode, all in the dimmed card | Removed by UX-07 |
| C13 | Picker §2 "not measured: real pointer click; 375 px"; "not verified: real GPU; `popover`" | Real pointer: C4. 375 px: QA-03. Real GPU: the Product workspace loads and renders on Apple M1 Pro (Metal) in the in-app browser, Chrome 152 (read-only check, nothing else exercised). `popover`, `showPopover`, `<dialog>.showModal` and `Intl.PluralRules` exist there (feature detection only; behaviour inside the scrolling panel not tested) | Still test the picker itself |
| C14 | Stress test: "52 scripted observations" | 43 are saved in `docs/stress-test/out/*/results.json` (27 P, 16 V). The 9 F results exist only as script output | Re-run the follow-up scripts to see them |
| **C15** | Picker **A1**: the Undo/Redo/Export/**Import project** toolbar shows "only when Room workspace **and a room exists**" | With no room, Import project is already unreachable today (QA-04). A1 as written keeps that defect | Scope **Import project** to "Room workspace", with or without a room. Adrian's rule (room uploads only in Room) still holds. See D-QA2 |

**Line references:** I checked 63 file:line references against the current files (57 from UX and Copy, 6 from Picker). All point at the right code; those written with "~" are within 4 lines. Picker's remaining references were not checked.

---

## 3. Work items

Severity and effort use the UX handoff's scale. Evidence ids (S, F, W, P) are sections of the audit scripts in `fixes/qa-evidence/`.

| ID | Sev. | Title | Fold into |
|---|---|---|---|
| QA-01 | 🔴 S | Room tools can't be switched off; choosing a tool resets the camera | UX-04 (before UX-05) |
| QA-02 | 🔴 S | Place mode drops products outside the room and reports success | UX-04 / UX-05 |
| QA-03 | 🔴 S | At ≤ 860 px the page scrolls the 3D view out of sight | UX-07 item 4, UX-12 |
| QA-04 | 🔴 S | "Import project" can't be reached until a room exists | UX-06, UX-08 step 5, Picker A1 |
| QA-05 | 🟡 S | Picking a product in the Room workspace moves the camera | UX-08 step 3, Picker UX-14 step 6 |
| QA-06 | 🟡 S | Cmd/Ctrl+Z in a field undoes a room change | UX-04 item 3 |
| QA-07 | 🟡 S | Disabled buttons look enabled | UX-12 |
| QA-08 | 🟡 S | `hidden` is overridden on five elements | UX-02 |
| QA-09 | 🟡 M | Keyboard order and focus indication | UX-07, UX-13 |
| QA-10 | 🟡 S | The page jumps 16 px on every workspace switch | Copy Phase 1 |
| QA-11 | 🟡 S | 33 px horizontal overflow at 320 px | UX-12 |
| QA-12 | 🟡 S | Long unbroken names push row buttons off-screen | Copy Phase 3 |
| QA-13 | 🟡 S | Three contrast failures | UX-12, UX-13 |
| QA-14 | 🟡 S | Six accessible names don't contain the visible label | Copy Phase 1 |
| QA-15 | 🟡 S | Reduced-motion preference is ignored | UX-07 item 4, UX-13 |
| QA-16 | 🟢 S | Hover and active states missing | UX-12 |
| QA-17 | 🟢 S | Errors differ from status only by colour, and are announced politely | Copy Phase 3, UX-13 |
| QA-18 | 🟢 S | Three controls are enabled when they can't work | UX-08 item 6 |
| QA-19 | 🟢 M | Visual consistency: heights, spacing, weights, raw colours | Phase D, after structure |

### QA-01 🔴 S: Room tools can't be switched off; choosing a tool resets the camera

- **Reproduce:** Room workspace → Create room (Living 5×4) → drag the stage down about 100 px so the floor shows (elevation 51.8°) → click "Click floor to place product". The camera snaps back toward the arrival view (51.8° → 26.7° measured 0.6 s after the click; `frameRoom` sets the 21.2° arrival position, floor hidden). Click the button again: it stays on. Three clicks in a row leave mode `place`, `aria-pressed="true"`. Same for the opening button and the draw-walls button. Clicking an ingress tab resets the camera too (66.4° → 27.2° after 0.6 s).
- **Effect:** once Place is on, every floor click adds another product until the user picks a different tool or leaves the workspace. A user who orbits first, then picks the tool, loses the view they just set up. Working order today is tool first, then orbit (W4).
- **Cause:** the three tool handlers call `setWorkspace('room')` before they read the mode (`main.ts:1750`, `:1758`, `:1765`). `setWorkspace('room')` runs `viewer.setInteractionMode('room')` and `viewer.frameRoom()` whenever a room exists (`main.ts:755-758`), so `viewer.getInteractionMode()` is always `'room'` by the time the toggle is computed. The ingress handler calls it as well (`main.ts:1671`).
- **Do:**
  1. In the three tool handlers, read the current mode first, then switch workspace only if `workspace !== 'room'`.
  2. In `setWorkspace('room')`, frame the room only when the workspace actually changes (Product → Room). Keep that case: `model-display.spec.ts` and `model-display-cold-load.spec.ts` depend on it.
  3. Same guard for the ingress-tab handler.
  4. Esc exits the tool (UX-04 item 3 already asks for it).
- **Done when:** a second click on each tool button gives `aria-pressed="false"` and mode `room`; orbit, then click a tool, and the camera elevation changes by less than 1°.
- **Tests:** no spec covers toggle-off today (they assert `aria-pressed="true"` after one click: `room-from-scratch.spec.ts:38`, `:83`). Add toggle-off and camera-kept assertions.

### QA-02 🔴 S: Place mode drops products outside the room and reports success

- **Reproduce:** Create room (Living 5×4) → Place mode → click the empty stage near the bottom-left corner. Status: `Placed “Lounge chair (demo)” on the floor`. The placement is at x −0.48, z 3.74; the room spans z −2 to 2.
- **Measured (S05):** on arrival in Place mode, of 441 sampled canvas points, **26.3 %** place a product outside the room, **57.1 %** hit a wall (error text the user can't see, UX-04) and **0 %** place inside the room.
- **Cause:** `raycastRoom` falls back to the infinite ground plane in Place mode (`RoomVibezViewer.ts:444-451`). Nothing checks the point against `rooms[0].floor_polygon`. `roomCollision.ts` has no room-bounds test (*code-read*: grep found none).
- **Do:** accept a placement only when the point is inside the floor polygon. Outside: no placement and a visible message (*new string*). Keep the fallback for points inside the polygon (it exists for clicks that miss the extruded floor mesh). See D-QA1.
- **Done when:** a void click in Place mode adds nothing and shows the message on the stage; audit section S05 reports `placedOutsideRoom: false`.

### QA-03 🔴 S: At ≤ 860 px the page scrolls the 3D view out of sight

- **Reproduce (375×812, touch emulation, F6):** cold load. Two seconds after `ready` the page has scrolled itself to `scrollY` **1643**. The canvas is **0 % visible**; the top of the screen is the Product card. Tap **Room workspace**: `scrollY` 648, canvas 0 % visible. Tap **Create room**: the room is built off-screen (canvas still 0 % visible).
- **Cause:** the two `scrollIntoView` calls (`main.ts:752`, `:764`) and the boot call `setWorkspace('catalog')` (`main.ts:1842`). At ≤ 860 px `.panel` is `overflow: visible` (`styles.css:242`), so the document scrolls instead of the panel.
- **Do:** UX-07 item 4 replaces both calls with `panel.scrollTo({ top: 0 })`, which also fixes this (the panel is not the scroller at these widths). The acceptance check is here because UX-07's done-when is desktop-only. After Create room on a small screen, bring the stage into view, or rely on the sticky stage from UX-12. Mind C2.
- **Done when:** at 375×812, two seconds after `ready`, `scrollY === 0` and the canvas is at least 90 % visible; after tapping Room workspace and after Create room, at least half the canvas is visible.
- **Also measured:** a touch swipe that starts on the canvas does not scroll the page (`touch-action: none`, 0 px). In the first screen the canvas takes 455 of 812 px; the top bar (149 px) and a 196 px strip below are the only places a swipe scrolls. UX-12's 44vh sticky stage changes this budget; re-measure.

### QA-04 🔴 S: "Import project" can't be reached until a room exists

- **Reproduce (W7):** fresh profile → Room workspace. `#btn-import-project` is not visible. It sits inside `#room-tools` (`index.html:179-188`), which `renderRoomUi` hides when there is no room (`main.ts:316`). After **Clear room** the app also switches to Product (`main.ts:1731`), verified for both "room exists" and "no room".
- **Effect:** someone who exported a project and opens the app in another browser has no visible way to load it. The workaround is to create a throwaway room first, which Import then replaces without warning.
- **Do:** make "open a project file" available in the Room workspace when no room exists. The UX-06 empty-state card is the natural place: a fourth entry beside scratch, import a plan and template (*new string*). Export stays room-only. This overrides Picker A1 for the Import button only (C15).
- **Done when:** on a fresh profile the Room workspace shows a control that opens the project picker; importing a file exported from a room with one placed product restores that product (verified today through the hidden input: 1 placement restored).

### QA-05 🟡 S: Picking a product in the Room workspace moves the camera

- **Reproduce:** with a room on stage, choose "Side table (demo)" in `#product-select`. The camera jumps from (4.72, 3.83, 5.77) to (0.78, 0.74, 1.04): a close-up from inside the room. The turntable product it framed is hidden in this workspace.
- **Cause:** `loadProduct` frames the turntable model regardless of interaction mode (`RoomVibezViewer.ts:251`; *inferred from the camera change, the method was not read line by line*).
- **Do:** in the room interaction modes, skip `frameModel` on product load. Keep it for catalog mode and for `resetCamera`.
- **Done when:** selecting a product in the Room workspace leaves `camera.position` unchanged.
- **Why now:** UX-08 step 3 and Picker UX-14 step 6 move the picker into the Place step, so every product choice would trigger this.

### QA-06 🟡 S: Cmd/Ctrl+Z in a field undoes a room change

- **Reproduce (F9):** room with two placed products → click into Length → type `9` → Cmd+Z. Placements go from 2 to 1, status reads `Undid last room change`, and the field keeps the typed value.
- **Cause:** the document `keydown` handler (`main.ts:1782-1793`) does not look at the event target.
- **Do:** return early when the target is an input, select, textarea or contenteditable. UX-04 item 3 asks for the same guard on Esc; share it.
- **Done when:** the repro leaves 2 placements and the field undoes its own text.

### QA-07 🟡 S: Disabled buttons look enabled

- **Evidence (S15):** `#btn-undo` with `disabled` has the same computed colour, background, border, opacity and `cursor: pointer` as the enabled `#btn-export-project`.
- **Cause:** `.btn` sets `color` and `cursor` (`styles.css:84-88`), which override the browser's disabled styling. There is no `:disabled` rule.
- **Do:** add one (§4.2 has the proposed values).
- **Done when:** a disabled `.btn` differs from an enabled one in at least two of colour, opacity and cursor.

### QA-08 🟡 S: `hidden` is overridden on five elements (extends UX-02)

| Element | Overriding rule | What the user sees |
|---|---|---|
| `#room-plan` (`index.html:174`) | `.room-plan { display: grid }` (`styles.css:222`) | With no room: an empty 310×140 box |
| `#room-plan-actions` (`:175`) | `.btn-row { display: flex }` (`:204`) | With no room: a "Download plan PNG" button that does nothing when clicked, and one extra tab stop |
| `#project-file` (`:187`) | `.file-input { display: block }` (`:101`) | With a room: a native "Choose file" row (UX-02) |
| `#pack-params` (`:283`) | `.pack-params { display: flex }` (`:154`) | Always: an 11 px stub with a dashed line |
| `#texture-target-wrap` (`:335`) | `.field { display: flex }` (`:107`) | Always: the "Target material" select, even for the base-colour role where it has no meaning |

- **Do:** UX-02's `[hidden] { display: none !important; }` covers all five.
- **Check after:** the Add texture flow for the normal and roughness roles still shows the target select (`syncTextureRoleUi` toggles `hidden`).
- **Done when:** this returns `[]` in four states (fresh Product, Room with no room, Room with a room, Import tab):
  ```js
  [...document.querySelectorAll('[hidden]')].filter(e => getComputedStyle(e).display !== 'none').map(e => e.id)
  ```

### QA-09 🟡 M: Keyboard order and focus indication

- **Measured (F3), starting from the first control:**
  - Product workspace: 47 tab stops. **19 come before the product picker**, 15 of them inside the inactive Room card. 25 before the first swatch, 43 before lighting.
  - Room workspace with a room and one product: 63 stops, 32 before the Place button.
  - On a fresh load the first Tab lands on `#product-select`; the workspace toggle and the stage buttons are behind it (Shift+Tab). Cause not established (*inferred*: Chrome moves its focus starting point after the boot `scrollIntoView`).
  - Two focus-ring styles: the 2 px accent outline on 32 stops, the browser default on 14 (text and number inputs, file inputs, checkboxes, `summary`, the scrollable `pre`).
- **Do:** UX-07 removes the 15 inactive stops by hiding the group. Extend the focus rule (`styles.css:115-117`) to `.text-input`, `.file-input`, `summary` and checkboxes. Roving tabindex and arrow keys per UX-13.
- **Done when:** no tab stop sits inside a hidden workspace group; from a fresh load the first Tab lands on the first top-bar control; every stop shows the accent ring.

### QA-10 🟡 S: The page jumps 16 px on every workspace switch

- **Measured (S14):** the top bar is 87 px in Product and 103 px in Room at every width from 721 to 1920 px, and 149 / 165 px at 375 px. The Room hint wraps to two lines inside `max-width: 360px` (`styles.css:46-48`), so the stage and the panel move.
- **Do:** the deck's Room hint ("Build a room, then place products in it.") is shorter. After Copy Phase 1, measure; if it still wraps anywhere, reserve the height.
- **Done when:** `.topbar` has the same height in both workspaces at 1440, 1024 and 375 px.

### QA-11 🟡 S: 33 px horizontal overflow at 320 px (WCAG 1.4.10 Reflow)

- **Measured (S14, F7):** `overflowX` is 0 at every tested width from 375 to 1920 px, and **33 px at 320×568** in both workspaces.
- **Cause:** the single-column grid track is `1fr`, whose floor is min-content, and the Parts list `pre.code` (`white-space: pre`) sets that floor at 337 px. Probed with injected CSS, not applied: either `grid-template-columns: minmax(0, 1fr)` or `.panel { min-width: 0 }` brings it to 0.
- **Done when:** `overflowX === 0` at 320×568 in both workspaces.

### QA-12 🟡 S: Long unbroken names push row buttons off-screen

- **Reproduce (S16):** save a template titled with 64 characters and no spaces. The row's content is 922 px wide inside a 310 px row. Instantiate and Delete render at x = 2021 on a 1440 px screen. The panel gains a horizontal scrollbar (`scrollWidth` 937 against 340). The status line overflows the card too.
- **Likely real trigger (*inferred, not measured*):** template rows also print the source file name (`main.ts:431-432`), and CAD file names often have no spaces.
- **Do:** let the text span shrink and wrap (`min-width: 0; overflow-wrap: anywhere`), keep the action buttons at their own width, and wrap `.upload-status`. Copy Phase 3 rebuilds these rows with DOM nodes; do it there.
- **Done when:** the repro shows both buttons inside the card and `panel.scrollWidth === panel.clientWidth`.

### QA-13 🟡 S: Three contrast failures

| Where | Pair | Ratio | Needed |
|---|---|---|---|
| Pressed tool button text (`styles.css:229-231`) | `#008060` on `#e3f1ec`, 13 px | **4.24:1** | 4.5:1 (WCAG 1.4.3) |
| Border of text inputs and selects (`--border-strong`) | `#c9cccf` on `#ffffff` | **1.61:1** | 3:1 (WCAG 1.4.11): the border is the only thing that marks a white field on a white card |
| Selected segment against its track | `#ffffff` on `#f1f1f1` | **1.13:1** | State cue. The text colour change (`#303030` against `#616161`) carries the state today |

- **Passing, keep:** muted text 6.19:1 on white and 5.48:1 on the page; white on the primary button 4.93:1; placeholder 4.61:1; error text 8.93:1; focus ring 4.93:1 on white and 4.37:1 on the page.
- **Do:** §4.2 has proposed values. They are a design call (D-QA3).
- **Done when:** audit section S12 reports zero failing text elements outside disabled controls, and the input border is at least 3:1.

### QA-14 🟡 S: Six accessible names don't contain the visible label (WCAG 2.5.3)

| Field | Visible label | `aria-label` |
|---|---|---|
| `#plan-file` | Plan file (.dwg / .dxf / .json / .png / .jpg / .pdf) | Upload DWG, DXF, candidates JSON, raster underlay, or PDF |
| `#model-files` | Add 3D model | Upload GLB, glTF, or OBJ package |
| `#pack-files` | Load pack (.mjs + .glb) | Load MJS and optional GLB pack |
| `#pack-glb-mate` | Or attach pack-mate GLB | Pack mate GLB |
| `#module-file` | Load module (.mjs only) | Load ES module .mjs |
| `#texture-target` | Target material | Target library material |

- **Do:** Copy Phase 1 rewrites these labels. Where a `<label for>` exists, drop the `aria-label`; otherwise start it with the visible text.
- **Done when:** audit section F5 reports 0 mismatches.

### QA-15 🟡 S: Reduced-motion preference is ignored

- **Measured (F4):** with `prefers-reduced-motion: reduce` emulated, the workspace-switch panel scroll still animates (10 intermediate positions sampled; 11 without the preference). `styles.css` has no reduced-motion query. Two CSS transitions exist (`:72`, `:173-175`).
- **Do:** when you replace the scroll calls (UX-07 item 4), scroll instantly. Wrap the transitions, and any new toast or dialog animation, in a reduced-motion query.
- **Done when:** F4 under `reduce` shows at most 2 distinct scroll positions.

### QA-16 🟢 S: Hover and active states missing

- **Measured (S15):** only `.btn` changes on hover. Segmented radios, swatches, list buttons, selects and inputs don't. There is no `:active` rule anywhere.
- **Do:** §4.2.

### QA-17 🟢 S: Errors differ from status only by colour, and are announced politely

- **Measured (S12, S11):** an error line is `#8e1f0b`, a status line `#616161`. Both pass against white, but they differ from each other by only 1.44:1 and nothing else marks the error (no icon, no prefix). All 11 live regions are `role="status"`; none is `role="alert"`.
- **Do:** Copy Phase 3's `friendlyError` already plans `{ text, critical }`. Give task-blocking errors the existing `.warning.critical` treatment and `role="alert"`. Keep one live region per message (UX-13).

### QA-18 🟢 S: Three controls are enabled when they can't work

With no room: **Save current room as template** (shows "Create or load a room first."), **Clear room** (switches the user to the Product workspace) and **Download plan PNG** (nothing happens; visible only because of QA-08). UX-08 item 6 covers the first. Disable or hide the other two until a room exists.

### QA-19 🟢 M: Visual consistency

Measured in the Room workspace with a room and one placed product (S17). The specification and the proposals are in §4.

| What | Today |
|---|---|
| Control heights | button 33 px, swatch 34, select 34, text and number input 35, segmented 31, **segmented 49** (the three light presets, because "Neutral (no IBL)" wraps), list button 22, file input 20, `summary` 17 |
| Spacing values in `styles.css` | 10 distinct: 2, 3, 4, 6, 7, 8, 10, 12, 14, 16 px. No spacing token |
| Font weights in use | 6: 400, 450, 550, 600, 650, 700 (four declared, two from browser defaults) |
| Font sizes | 4: 11, 12, 13, 14 px. 31 of 103 text elements are 11 px |
| Radius | tokens for 12 and 8; `6px` typed raw 6 times |
| Colours outside `:root` | 11 distinct hex values, 15 uses, including two near-identical caution palettes (`.warning` and `.import-banner`) |
| Button widths in the Room card | 2 full-width (Create room and, directly under it, Clear room) and 9 auto-width at 9 different widths (58 to 218 px) |
| Native file inputs on screen | 5 fresh, 6 with a room |
| Inline styles set from `main.ts` | 6 |

**Why it matters (the aesthetic-usability effect):** people read consistent spacing, alignment and control sizing as a sign that a product is reliable, and they forgive small friction more readily when it is there. Here the roughest surfaces sit on the first screen: native file inputs, an inactive card at 72 % opacity, developer badges. **The risk runs the other way too:** polishing this panel before QA-01 to QA-04 and UX-01 to UX-10 land would make a tool that misplaces furniture look more trustworthy than it is. Do structure and trust bugs first, QA-19 last.

---

## 4. Specification for the items above

There is no design file in this folder (no Figma link in any doc; no mock-ups). The specification is `styles.css`, the copy deck, and the other handoffs' done-when lines. Values marked **proposal** are mine and are not validated with anyone.

### 4.1 Tokens

| Group | Exists today (`styles.css:2-19`) | Missing, in use as raw values | Proposal |
|---|---|---|---|
| Colour | `--bg`, `--surface`, `--surface-hover`, `--border`, `--border-strong`, `--text`, `--text-muted`, `--accent`, `--accent-soft`, `--critical`, `--critical-soft` | accent hover `#006e52`; caution `#fff8db` / `#4f4700` / `#f0e3a6` and `#fff6e8` / `#5c3d10` / `#e8c48a`; critical border `#f0b6ae`; code background `#fafafa` | Name them: `--accent-hover`, `--caution-soft`, `--caution-text`, `--caution-border`, `--critical-border`, `--surface-sunken`. Use one caution palette for both `.warning` and `.import-banner` |
| Radius | `--radius` 12, `--radius-sm` 8 | 6 px (6 uses), 999 px, 50 % | Add `--radius-xs: 6px` |
| Shadow | `--shadow` | none | Keep |
| Type | `--font`; sizes typed raw | 11 / 12 / 13 / 14 px; weights 450 / 550 / 600 / 650 | Name four sizes. Reduce to three weights (450, 550, 650): map 600 → 650 and `strong` → 650. **How these weights render on Windows is not tested** |
| Spacing | none | 2, 3, 4, 6, 7, 8, 10, 12, 14, 16 px | D-QA3. Default: introduce tokens for the values already used most (4, 8, 12, 16; 2 and 6 for tight insets) and move 3 → 4, 7 → 8, 14 → 12. Leave 10 alone in this pass (18 uses; changing it shifts the whole panel) |
| Control height | none | 33 / 34 / 35 px | One value for button, select and text input (34 px is the middle one today). UX-12 separately raises the small ones to 32 px and coarse pointers to 44 px |

### 4.2 Interaction states

✔ exists · — missing · n/a not applicable. "Proposal" columns reuse existing tokens.

| Component | Default | Hover | Focus-visible | Active | Pressed / checked | Disabled |
|---|---|---|---|---|---|---|
| `.btn` | ✔ | ✔ `--surface-hover` | ✔ 2 px accent | — | ✔ accent-soft fill, accent border and text (4.24:1, QA-13) | — (QA-07) |
| `.btn-primary` | ✔ | ✔ `#006e52` | ✔ | — | n/a | — |
| `.segmented button` | ✔ | — | ✔ | — | ✔ white pill and shadow (1.13:1 against the track) | n/a |
| `.swatch` | ✔ | — | ✔ | — | ✔ double ring | n/a |
| `.room-list button` | ✔ | — | browser default | — | n/a | n/a |
| `.select`, `.text-input` | ✔ border 1.61:1 | — | select ✔; text input browser default | n/a | n/a | — |
| `.file-input` (native) | ✔ | browser | browser default | browser | n/a | n/a |
| Checkbox (13×13 native) | ✔ | browser | browser default | browser | browser | n/a |

**Proposals**
- **Disabled `.btn`:** `opacity: 0.5; cursor: default; box-shadow: none`.
- **Pressed tool button text:** `#006e52` on `--accent-soft` computes to **5.39:1**; `--text` on `--accent-soft` to 11.35:1.
- **Text-input and select border:** any grey at or darker than `#949494` gives 3:1 on white (computed 3.03:1; `#8a8a8a` gives 3.45:1).
- **Hover** for segmented buttons, swatches and list buttons: `--surface-hover`, or a 1 px `--border-strong` ring on swatches. **Active** on `.btn`: one step darker than hover.
- **Motion:** existing transitions are 0.15 to 0.2 s. Keep new ones in that range and inside a reduced-motion query.

### 4.3 Layout and breakpoints (as built)

| Width | Layout | Top bar | Stage | Notes |
|---|---|---|---|---|
| ≥ 861 px | two columns, panel fixed at 340 px, panel scrolls | 87 px (Product) / 103 px (Room) | fills the rest; 1052×781 at 1440×900 | QA-10 |
| 721 to 860 px | one column, page scrolls | 87 / 103 px | `min-height: 56vh` | QA-03 |
| ≤ 720 px | one column, top bar wraps | 149 / 165 px | 343×455 at 375×812 | QA-03, QA-11 |
| 320 px | one column | 165 px | 337×318 | 33 px overflow, QA-11 |
| 720×450 (a 1440×900 window at 200 % zoom) | one column | 149 px, a third of the height | 688×252 | Usable by page scroll; no overflow |

### 4.4 Content rules the fix must hold

- Product names, template titles and file names can be long and unbroken: wrap them, never widen the row (QA-12). A 55-character upload name at 375 px caused no overflow today (W9).
- Number fields show the browser locale's decimal mark (`2,7`) while status lines print `2.70 m` (seen today; stress test C4).
- Empty, loading and error wording is the deck's (§3, §4). Today's strings, as measured, are in the checklist §4.

---

## 5. Review readiness

Gates from `design-ops:design-review-process`, assessed honestly for the whole fix, not only for this document.

| Gate | Status | Why |
|---|---|---|
| 1 Concept | **Partly met** | The problem is defined across the four handoffs. **No research with users exists** (`docs/usability-research-report.md` §0; the blueprint says "not yet validated with anyone"). Two UIs exist and which is canonical is undecided (UX D1) |
| 2 Design | **Partly met** | Copy is written (deck). No brand or visual standard is documented; two brands are in use. Tokens are partial (§4.1). Responsive behaviour is defined by two breakpoints only |
| 3 Pre-handoff | **Met for implementation** | States: empty (UX-06 specified), loading (exists), error (deck §4), disabled (QA-07 specified), success (toast, UX-04). Edge cases: stress test plus S16. Accessibility requirements are listed, not met. Four handoffs exist. A walkthrough with a developer does not apply |
| 4 Implementation QA | **Baseline taken, failing** | 72 gates: 20 pass, 48 fail, 4 not run (checklist summary). This is the before state |

**Verdict:** ready to implement. Not ready to ship. The usability test comes after the fix, not before it (`fixes/usability-test-plan.md` §2).

**Version being handed off:** there is no git, so the version is the fingerprint set in §8, labelled `viewer-baseline-2026-10-05`. Record the new fingerprints in your completion doc.

---

## 6. Decisions: take the default, flag it

| ID | Question | Default | Why this default |
|---|---|---|---|
| D-QA1 | A click outside the room in Place mode: reject, or clamp to the nearest point inside? | **Reject, with a message** | Clamping invents a position the user didn't choose |
| D-QA2 | Import project with no room: allowed (QA-04) or room-only (Picker A1)? | **Allowed, in the Room workspace** | Otherwise a returning user cannot open their file. Adrian's rule concerns the workspace, not whether a room exists (*my reading*) |
| D-QA3 | Token work: name the values in use with no visual change, or normalise spacing and heights? | **Name them, plus the three small moves in §4.1 and one control height** | Larger normalisation changes density across the panel and nobody has asked for it |
| D-QA4 | Accessibility target | **WCAG 2.2 AA is the yardstick this document uses** | No target is recorded anywhere in the project (stress test §7 Q8 lists it as open) |
| D-QA5 | Supported browsers and devices | **Unknown. Tested: Chromium only** | The docs name Google Chrome for tests and nothing for users |
| D-QA6 | Use git instead of scratch snapshots | **Keep snapshots for this fix** | A repo is Adrian's call; the folder holds a Chrome profile and binaries that would need ignoring |

---

## 7. Not verified

- **Anything with people.** No usability session was run. `fixes/usability-test-plan.md` says so on every table.
- **Screen readers.** DOM facts only (roles, names, live regions). Nothing was listened to.
- **Safari, Firefox, Windows, Android, iOS.** Only Chromium is automatable here (Playwright has no Firefox or WebKit build installed; Safari automation is off). Mobile results are Chrome's touch emulation, not a phone.
- **Real GPU beyond a load.** One read-only check in the in-app browser (C13). All interaction tests ran on SwiftShader.
- **Draw-walls beyond its toggle,** real DWG or DXF files, the `.mjs` and pack flows, redo, storage-blocked behaviour (stress test F3 covers that one).
- **A possible defect seen only in code:** Export project also writes a copy to IndexedDB (`main.ts:628`), and boot loads that copy when `localStorage` has no room (`main.ts:1632-1639`). Clear room followed by a reload may therefore bring back the last exported room. Not run. Check it when you do UX-03.
- **Font rendering off macOS,** OS text-size settings (every size is in px, so browser default-size changes don't scale the UI: *code-read*), high-contrast modes, dark mode (the app declares `color-scheme: light` on purpose).
- **The cause of the first-Tab landing** (QA-09) and **the `loadProduct` framing path** (QA-05) are inferred from behaviour.
- **Performance.** One build size only. No load timing, no frame rate.
- **The prototype** got three automated checks (P01 to P03), not a full pass.

---

## 8. Evidence and how to re-run

**Fingerprints of the measured build** (`shasum -a 256 <file> | cut -c1-12`):

| File | sha256 (first 12) | Modified |
|---|---|---|
| `hackathon-3d-viewer/index.html` | `5e62c14520a8` | 2026-10-03 11:41 |
| `hackathon-3d-viewer/src/main.ts` | `f0137e8f1c9f` | 2026-10-05 13:51 |
| `hackathon-3d-viewer/src/styles.css` | `3293c72797fa` | 2026-10-03 11:41 |
| `hackathon-3d-viewer/src/viewer/RoomVibezViewer.ts` | `408ad32619f5` | 2026-10-05 13:51 |
| `hackathon-3d-viewer/src/viewer/roomGraph.ts` | `482f5dfc14f0` | 2026-10-03 16:43 |
| `hackathon-3d-viewer/src/viewer/roomMesh.ts` | `ba206749296e` | 2026-10-03 16:48 |

**Environment:** macOS 27.0.1; Node v24.21.0; Playwright 1.63 driving the installed Google Chrome 154.0.8037.97, headless, SwiftShader; a fresh browser profile for every block.

**Scripts** (`fixes/qa-evidence/`). They read the running app and write only to the output directory. The agent shell cannot write inside the project, so point `RV_QA_OUT` at your scratchpad.

```bash
cd "/Users/adrian/Desktop/Room Vibez/fixes/qa-evidence"
export RV_QA_OUT="<your scratchpad>/qa-out"
node audit-viewer.mjs            # S01–S20, took 134 s
node audit-viewer-followup.mjs   # F1–F10, took 121 s
node walkthrough-tasks.mjs       # W2–W12, took 91 s
node audit-prototype.mjs         # P01–P03, not timed
```

The two probes behind QA-01 and QA-05 are `probe-tool-toggle.mjs` and `probe-product-pick-camera.mjs` in the same folder. They print to the terminal and write no files: `node probe-tool-toggle.mjs`.

Two cautions when you read their output:
- **S01 and S13 sample too early** (the boot scroll has not settled). Use **F1 and F4** for those two questions.
- **F2 is void** (headless Chrome hides scrollbars, so its classic-scrollbar test changed nothing). **W10** answers that question.

**Raw results and screenshots from today** are in `fixes/qa-evidence/out/`: four results files (`viewer-results.json`, `viewer-followup-results.json`, `walkthrough-results.json`, `prototype-results.json`), the e2e run log, and 34 screenshots in `shots/` named by section. The most useful to open first: `S04-room-created-1440-no-camera-input.png` (floor hidden on arrival), `W4-placed-products-in-room.png` (grey placed products), `F6-mobile-cold-load-settled.png` (no 3D view on a phone-size load), `F10-empty-plan-box-and-download-button-with-no-room.png`, `S16-long-template-title.png`, `S15-disabled-undo-vs-enabled-export.png`. Three screenshots were left out because the camera I set missed the subject.

**E2E by scratch copy** (what C8 used): copy `tests/e2e/*.spec.ts` to a scratch folder, replace the `…/Cursor/AgentStores/cursor_agent_stores` prefix with a scratch path, symlink the project's `node_modules` beside them, copy `playwright.config.ts` without its `webServer` block, and run the project's `node_modules/.bin/playwright test --config <scratch config>` from that folder.

**Not touched by this session:** app source, tests, `docs/`, `History/`, the other three handoffs. The in-app browser was only read from.
