# Validation report: the numbers behind the four handoffs

**For:** the Claude session that applies the combined fix. Reached from `fixes/qa-validation-handoff.md` §1 step 2.
**Skill:** `data:validate-data`, run 2026-10-05.
**Question answered here:** which measured claims in the earlier documents can you build on, which need a caveat, and how far can you trust this session's own numbers?

**Documents checked**

| Short name | File |
|---|---|
| UX | `fixes/ux-improvements-handoff.md` |
| Copy | `fixes/ux-copy-improvements.md`, `docs/ux-copy-deck.md` |
| Picker | `fixes/ux-catalog-picker-handoff.md`, `docs/usability-research-report.md` |
| Stress | `docs/flow-stress-test-report.md` |
| QA | this session's audit (`fixes/qa-evidence/`) |

**Method:** each claim was re-measured in an isolated headless Chrome profile with scripts, then compared. Where the result differed I looked for the cause instead of picking a winner. Correction ids (C1 to C15) are the ones in the handoff §2.

---

## Validation Report

### Overall Assessment

| Document | Rating | In one line |
|---|---|---|
| UX | **Share with noted caveats** | Its measurements reproduce exactly in the environment they were taken in. One headline figure is an offset presented as a distance (C2), one item is under-scoped (C3), one acceptance criterion can't be met by the first option it offers (C5) |
| Copy | **Share with noted caveats** | Every code fact I checked holds. The word-count baseline names two different sets (C11) |
| Picker | **Share with noted caveats** | Its finish test reproduces, with a real pointer and after a reload. Addition A1 would preserve a defect (C15) |
| Stress | **Ready to share** | Reproduced every item I re-ran (K1, R4, R5, E1, UX-01 family). 9 of its 52 observations aren't saved to disk (C14) |
| QA (self) | **Share with noted caveats** | Chromium only, software rendering, emulated mobile, no people. Listed in full below |

Nothing needs revision before the fix starts.

### Methodology Review

- **Question framing.** The earlier documents ask "how far away is this control?" and answer with its offset inside the panel. A user's cost is the distance from where the panel *is* when they arrive. The app scrolls the panel itself at boot and on every workspace switch, so the two differ by up to 886 px (C2).
- **Environment is part of the data and wasn't recorded.** Panel heights depend on whether the panel shows a 15 px classic scrollbar. The in-app browser does (`offsetWidth` 340, `clientWidth` 325); headless Chrome doesn't. With 15 px less width more labels wrap: "From template" goes to two lines, which is also why the earlier count of controls under 32 px was 3 where mine is 6. Every one of the UX baseline figures reproduces **to the pixel** once the width is matched (W10).
- **State mixing.** The "4.3 screens" mobile figure matches the with-room state (4.2), not the fresh load it is listed under (3.1). *Inferred* from the arithmetic; I can't see what was on screen then.
- **Metric definition.** The shared snippet's `controlsUnder32px` leaves out file inputs and checkboxes by design. Read alone it understates small targets: nine targets are under 24 px and 59 of 62 are under 44 px at 375 px.
- **Timing.** The boot scroll takes up to about 0.8 s to settle after `data-viewer-status=ready` (F1, F6 traces). A reading taken before that is a mid-animation value. My own first pass did this (S01, S13); F1 and F4 replace them.
- **Test hooks and real input.** The earlier sessions placed products with `window.__rv.simulateRoomPointer`, which skips the raycast and the tool buttons. That is why none of them saw QA-01 (tools can't toggle off, camera resets) or QA-02 (placement outside the room). Both only appear with real pointer input.
- **Population.** Nobody has tested with users. Every "steps" count in every document, including this one, is an expert's count of the shortest path.

### Issues Found

1. **[High] An offset is reported as a scroll distance (C2).** "Scroll 1835 px to make the chair walnut" overstates the arrival cost by about 11 times; it is 159 px at 1440×900. The underlying finding stands: Materials are not visible on arrival.
2. **[High] UX-05's first option can't satisfy UX-05's done-when (C5).** Raising the camera to 48° shows 14.7 % of the canvas as in-room floor, 56° shows 22.7 %, straight down 34.2 %. "Whole floor visible" needs the cutaway.
3. **[High] Picker A1 keeps a defect in place (C15).** Limiting Import project to "a room exists" is today's behaviour, and today a returning user cannot open their file (QA-04).
4. **[Medium] UX-02 covers one of five affected elements (C3).** The proposed fix is right; the listed consequences and the acceptance check are too narrow.
5. **[Medium] Baselines are valid for one scrollbar mode only (C1).** Differences: −2.3 % on panel height (3036 against 3106), −5.6 % on the room card (874 against 926), 6 against 3 small controls.
6. **[Medium] The mobile baseline mixes two states (C7).**
7. **[Medium] The copy "before" figure doesn't match its stated set (C11).** 285 words for the 12 sidebar paragraphs; 304 for the 14 paragraphs the deck lists. A 6.6 % gap, which matters only because the acceptance line says "about 91 words (± a few)".
8. **[Medium] UX-10's fallback sentence would be false.** "Placed products use the product's default finishes": they use grey placeholders (C4).
9. **[Low] A setup line points at a Node version that isn't installed (C10).**
10. **[Low] Nine stress-test results aren't persisted (C14).**
11. **[Low] `README.md:29` says e2e screenshots go to `tests/e2e/screenshots/`.** True for one spec of seven. The handoffs know; the README still says it.
12. **[Low] Picker's baseline used "`localStorage` as left by earlier sessions".** A saved room could have been present. Its offsets match my fresh-profile figures at the same width, so I see no effect.

### Calculation Spot-Checks

"Overlay" and "classic" are the two scrollbar modes. Classic was reproduced by narrowing the panel content by 15 px (W10) and confirmed directly in the in-app browser.

| Claim (source) | Claimed | Re-measured | Verdict |
|---|---|---|---|
| Panel scroll height, Product, fresh (UX §2) | 3106 | 3106 classic · 3036 overlay | **Verified** (classic) |
| Offset of Materials (UX §2) | 1835 | 1835 classic · 1766 overlay | **Verified** (classic) |
| Offset of Light preset (UX §2) | 2704 | 2704 classic · 2635 overlay | **Verified** (classic) |
| Room card height, no room / with room (UX §2) | 926 / 1705 | 926 / 1705 classic · 874 / 1670 overlay | **Verified** (classic) |
| Controls under 32 px, fresh (UX §2) | 3 | 3 classic · 6 overlay | **Verified** (classic) |
| Panel `scrollTop` after switching to Room (UX-07) | 161 | 161 classic · 109 overlay | **Verified** (classic) |
| Panel client height at 1440×900 (UX §2) | 781 | 781 (Product) · 765 (Room) | **Verified**; the Room value is new (QA-10) |
| Scroll needed to reach Materials (UX §2 task flows) | 1835 | 159 (1440×900) · 259 (1280×800) | **Discrepancy** (C2) |
| Visible file inputs, fresh / with room (UX §2) | 5 / 6 | 5 / 6 | **Verified** |
| Status line to Place button (UX §2) | 963 | 964 | **Verified** |
| Place button to product picker (UX-08) | 141 | 141 | **Verified** |
| Mobile screens to Materials (UX §2) | 4.3 | 3.1 fresh · 4.2 with a room | **Discrepancy** in the label (C7) |
| Dimmed muted text contrast (UX §2, UX-13) | ≈ 3.4:1 | 3.37:1 | **Verified** |
| Muted text on white (UX-13) | 6.19:1 | 6.19:1 | **Verified** |
| List button size (UX-12) | 52×22 | 52×22 | **Verified** |
| Checkbox size (UX-12) | 13×13 | 13×13 | **Verified** |
| Segmented button height (UX-12) | 31 | 31 (49 for the light presets) | **Verified**, with an addition |
| Typed length 6 gives a 3.00 m room (UX-01) | 3.00 × 3.00 | 3 × 3 | **Verified** |
| cm switch gives 1.2 mm walls (Stress K1) | 0.0012 m | 0.0012 m | **Verified** |
| `#project-file` renders at 20 px (UX-02) | block, 20 px | block, 310×20 | **Verified**; 4 more elements (C3) |
| Clear room: no guard, history reset, jumps to Product (UX-03) | yes | yes; Cmd+Z restores nothing | **Verified** |
| Overflow at 375 px (Stress A5, UX-12) | 0 | 0 | **Verified**; 33 px at 320 px is new |
| Unit tests (all) | 66 of 66, 18 files | 66 of 66, 18 files | **Verified** |
| Full e2e run takes about 45 s (UX §1) | ~45 s | 46.4 s, 9 of 9 | **Verified** |
| Finish test: bindings are defaults, meshes `placeholder_*`, `#e7e7e7`, no map (Picker §2) | as stated | same; also with a real click and after reload | **Verified** |
| Picker offsets at 1024×768: 982 / 1835 / 2704 / 3106 (Picker §2) | as stated | 1835 / 2704 / 3106 match classic; 982 = card top 938 + 44 | **Verified** by consistency |
| Picker, Room with a room: total 3901 (Picker §2) | 3901 | 3885 classic, with the Living preset | **Within one text line.** Their room used the default preset, whose status line is longer (*inferred*) |
| Static helper text (Copy, deck §8) | 284 words, 14 paragraphs | 285 for 12 sidebar paragraphs · 304 for all 14 | **Discrepancy** in the set (C11) |
| Six flows reset undo: `main.ts` 443, 502, 591, 638, 947, 1730 (Copy) | six | six, at those lines | **Verified** |
| The WebGL error names the wrong launcher (Copy) | wrong file | `Start Viewer.command` has no software-WebGL flag; `Start Viewer (software 3D).command` does | **Verified** |
| Only two `fetch` sites, both local (Copy) | 2 | `main.ts:184`, `dwgImport.ts:212` | **Verified** |
| Close distance 0.35 m; feet are decimal (Copy) | as stated | `freeformWalls.ts:52`; `roomGraph.ts:165` | **Verified** |
| Garbage `.dwg` yields "Accepted" walls (Stress R4) | 3 walls | 4 walls (5.00 / 4.00 / 5.00 / 4.00 m) | **Verified** in substance; the wall count differs |
| Saved scripted observations (Stress §0) | 52 | 43 on disk (27 P + 16 V) | **Partly verifiable** (C14) |
| `toContainText` on collapsed `<details>` (Copy, UX) | believed to pass | passes; fails with `useInnerText` | **Verified** |

**File and line references:** 63 checked (57 from UX and Copy, 6 from Picker). All point at the right code; the ones written with "~" are within 4 lines. Picker's other references (for example `RoomVibezViewer.ts:125`, `:558`, `:591`) were **not** checked.

**Library data** (`public/assets/library/`): 2 products, 5 slots, 13 materials. Every slot default exists in `materials.json` and its category is allowed for that slot. Material ids and SKUs are unique. The four texture files and two model files the JSON names exist.

### Visualization Review

None of the documents contains a chart; all evidence is in tables. One presentation risk: the UX §2 table puts panel offsets and user-facing distances in the same "Before" column, which is how C2 arose. Keep them in separate columns in the completion doc.

### Suggested Improvements

1. **Report two numbers for any "how far" claim:** the offset, and the scroll needed from the arrival state.
2. **Put an environment line above every table:** browser and version, scrollbar mode (`panel.offsetWidth - panel.clientWidth`), viewport, and whether storage was empty.
3. **Wait for the panel to stop moving before measuring.** Two seconds after `ready` was enough here.
4. **Use real pointer input for anything about the canvas or tool buttons.** Keep `simulateRoomPointer` for setting up state.
5. **Save one results file per run** so before and after can be compared line by line. The scripts in `fixes/qa-evidence/` do this.
6. **Keep the before and after in the same scrollbar mode,** or report both.

### Required Caveats for Stakeholders

- **No one has tested this with users.** Severities are judgement. Step counts are shortest-path counts by an expert.
- **Chromium only.** Safari, Firefox, Windows and real phones are untested.
- **Interaction tests ran on software rendering** (SwiftShader). One load on a real GPU was checked.
- **Mobile results are Chrome's touch emulation at 375×812.**
- **Pixel figures move by 2 to 6 % with the scrollbar mode.** Directions and rankings don't.
- **Contrast figures are computed from CSS colours.** For text over the 3D canvas the backdrop is approximated. Floor, wall and background ratios (C5) are averages of up to 60 rendered pixels per surface.

---

## Self-check of this session's audit

| Check | Result |
|---|---|
| A result that confirms the hypothesis exactly (W10 matches seven figures to the pixel) | Expected: layout is deterministic and the code is identical. Confirmed a second way, by reading the in-app browser's panel width directly |
| Sampling | Floor visibility uses a 21×21 grid (441 points) of raycasts, so shares are accurate to about a quarter of a percent of the canvas per point. "First hit" stands in for "visible"; placed products are ignored and the ceiling is hidden by default |
| Population | Three presets, two demo products, one machine locale, default light preset unless stated |
| Superseded measurements | S01 `panelScrollTop` and S13 were sampled before the boot scroll settled; use F1 and F4. F2 changed nothing because headless Chrome hides scrollbars; use W10 |
| Discarded sub-test | W3's "click on empty space" landed on the Reset camera button. Not reported |
| Unstable run | The prototype's phone-width check failed once on a click timeout and passed on re-run. Cause not established. Not reported as a finding |
| Inferred, not measured | Cause of the first-Tab landing (QA-09); the `loadProduct` framing path (QA-05); long CAD file names as a trigger (QA-12); the reading of the 4.3 figure (C7) |
| Code-read only | Delete template has no guard; no room-bounds test in `roomCollision.ts`; sizes in px (G71); no third-party requests (G72); vocabulary in `index.html` (G43) |
| Not run at all | Screen reader, Safari, Firefox, real devices, redo, draw-walls beyond its toggle, `.mjs` and pack flows, performance |
