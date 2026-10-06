# Design QA checklist: Catalog 3D viewer

**For:** the Claude session that applies the combined fix. Reached from `fixes/qa-validation-handoff.md` §1 step 5.
**What this is:** 72 gates, each with how to check it and today's result. Today's column is the **before** state, measured 2026-10-05 on the build fingerprinted in the handoff §8. You fill the **After** column.
**Skill:** `design-ops:design-qa-checklist`.

**Completion criterion:** every row has `pass`, `fail` or `not run: <reason>` in After. Write the measured value beside it, not just the word.

**Today:** 20 pass · 48 fail · 4 not run.

| Section | Gates | Pass | Fail | Not run |
|---|---|---|---|---|
| 1 Visual accuracy | 8 | 1 | 7 | 0 |
| 2 Layout | 10 | 3 | 7 | 0 |
| 3 Interaction | 20 | 4 | 16 | 0 |
| 4 Content | 13 | 3 | 10 | 0 |
| 5 Accessibility | 11 | 3 | 7 | 1 |
| 6 Cross-platform and regression | 10 | 6 | 1 | 3 |

## How to use it

- **What it is checked against.** There is no design file in the project (no Figma link, no mock-ups). The reference is `src/styles.css` tokens, `docs/ux-copy-deck.md`, and the done-when lines of the four handoffs. For accessibility the yardstick is WCAG 2.2 AA, which is this checklist's assumption: the project has not set a target (handoff D-QA4).
- **"script Sxx / Fxx / Wxx"** means a section of the audit scripts in `fixes/qa-evidence/` (run instructions: handoff §8). **"manual"** means look in a browser at 1440×900 and 375×812. **"code"** means read the source.
- **Owner** is the item that fixes the gate: `UX-nn` and `A-n` live in the UX and Picker handoffs, `Copy Pn` is a phase of the copy handoff, `QA-nn` is in the QA handoff.
- A gate that passes today can still regress. Re-check all 72, not only the failures.
- **Process:** (1) you self-review against this list; (2) Adrian does the visual pass, which Claude cannot stand in for; (3) each failure goes in the completion doc with a screenshot; (4) rank by the severities in the handoffs; (5) re-run after each fix.

---

## 1. Visual accuracy

| ID | Gate | Check | Today | Owner | After |
|---|---|---|---|---|---|
| G01 | Colours come from tokens | script S17 `rawHexOutsideRoot` | **fail**: 11 distinct raw hex values, 15 uses, incl. two caution palettes | QA-19 | |
| G02 | Type sizes stay on the 4-step scale (11 / 12 / 13 / 14 px) | S17 `fontSizes` | **pass**: 4 sizes. 31 of 103 text elements are 11 px (UX-12 raises instruction text to 12) | UX-12 | |
| G03 | At most 4 font weights in use | S17 `fontWeights` | **fail**: 6 (400, 450, 550, 600, 650, 700) | QA-19 | |
| G04 | Spacing values come from one scale | S17 `spacingPxValuesUsed` | **fail**: 10 values (2, 3, 4, 6, 7, 8, 10, 12, 14, 16 px), no token | QA-19 | |
| G05 | Radius values come from tokens | S17 `radiusDecls` | **fail**: `6px` typed raw 6 times | QA-19 | |
| G06 | Button, select and text input share one height | S17 `controlHeights` | **fail**: 33 / 34 / 35 px; segmented 31 px, and 49 px for the light presets | QA-19, UX-12 | |
| G07 | Native file inputs appear only where agreed (`#model-files`; the rest inside Advanced) | S01 `visibleFileInputs` | **fail**: 5 on a fresh load, 6 with a room | UX-07, QA-08 | |
| G08 | No control is shown dimmed while still live | S01 `dimmedRoomCardOpacity` | **fail**: inactive card at opacity 0.72, fully operable | UX-07 | |

No icons or raster images are part of the UI today (the favicon is an inline SVG; swatches are CSS backgrounds), so the skill's icon and image checks have nothing to test. They start to apply when Picker UX-14 adds thumbnails.

## 2. Layout

| ID | Gate | Check | Today | Owner | After |
|---|---|---|---|---|---|
| G09 | No horizontal scroll from 375 to 1920 px, both workspaces | S14 | **pass**: 0 px at all 13 widths | keep | |
| G10 | No horizontal scroll at 320 px | S14, F7 | **fail**: 33 px | QA-11 | |
| G11 | Reflows at 200 % zoom (720×450, 640×400) | S14 | **pass**: no overflow, nothing clipped. The top bar takes 149 of 450 px | keep | |
| G12 | Survives the WCAG 1.4.12 text-spacing override | S18 | **pass**: nothing clipped; segmented labels wrap to two lines | keep | |
| G13 | Top bar keeps its height when the workspace changes | S14 `topbarH` | **fail**: 87 → 103 px (149 → 165 at 375 px) | QA-10 | |
| G14 | ≥ 861 px: Materials are visible on arrival with no scroll | F1 `scrollNeededToFullyShowFirstSlotSwatches` | **fail**: 159 px at 1440×900, 259 px at 1280×800 | UX-07 | |
| G15 | ≤ 860 px: the 3D stage is visible two seconds after load | F6 `coldLoad` | **fail**: page at `scrollY` 1643, canvas 0 % visible | QA-03 | |
| G16 | ≤ 860 px: the stage and the active tool can be seen together | F6, S09 | **fail**: Place button is 1867 px below the stage (2.3 screens); canvas not visible when the button is | UX-12, QA-03 | |
| G17 | Nothing carrying `hidden` is rendered | F10; snippet in QA-08 | **fail**: 5 elements | UX-02, QA-08 | |
| G18 | A 64-character unbroken name keeps row buttons on-screen | S16 `longTemplateTitle` | **fail**: buttons at x = 2021 on a 1440 px screen; panel scrolls sideways | QA-12 | |

## 3. Interaction

| ID | Gate | Check | Today | Owner | After |
|---|---|---|---|---|---|
| G19 | Every clickable control has a hover state | S15 `hover` | **fail**: only `.btn` | QA-16 | |
| G20 | Every tab stop shows a focus indicator | F3 | **pass**: 46 of 46 | keep | |
| G21 | One focus-ring style | F3 `focusRingStyles` | **fail**: accent ring on 32 stops, browser default on 14 | QA-09 | |
| G22 | Buttons have an active (pressed-down) state | code: `:active` in `styles.css` | **fail**: none | QA-16 | |
| G23 | A disabled button looks disabled | S15 `disabled.visuallyIdentical` | **fail**: identical to enabled, cursor still a pointer | QA-07 | |
| G24 | Targets are at least 24×24 px (WCAG 2.5.8) | S09 `targetsUnder24`, S15 | **fail**: checkboxes 13×13, `summary` 17 px, file inputs 20 px, list Delete buttons 52×22 | UX-12 | |
| G25 | Targets are at least 44 px on coarse pointers | S09 `targetsUnder44` | **fail**: 59 of 62 | UX-12 | |
| G26 | Each canvas action has a keyboard path (place, add opening, draw) | F3, S10 `canvas` | **fail**: pointer only; canvas has no `tabindex`, role or name | UX-08 "Add to room", UX-13 | |
| G27 | No tab stop sits in the inactive workspace | F3 `byZone` | **fail**: 15 Room-card stops before the product picker in Product mode | UX-07 | |
| G28 | Arrow keys move within each radio group | S10 `radioArrowRight` | **fail**: no effect; no roving tabindex on any of 4 groups | UX-13 | |
| G29 | Esc leaves a tool mode | S10 `escapeLeavesPlaceMode…` | **fail**: `aria-pressed` stays `true` | UX-04 | |
| G30 | A tool button toggles off, and choosing a tool keeps the camera | probe in QA-01 | **fail**: 3 of 3 tools can't be turned off; elevation 51.8° → 26.7° within 0.6 s of the click, heading for the 21.2° arrival view | QA-01 | |
| G31 | Cmd/Ctrl+Z inside a field edits the field only | F9 `undoWhileTypingInLengthField` | **fail**: removed a placed product | QA-06 | |
| G32 | Clear room, replacing a room and deleting a template ask first (or can be undone) | S07, F9 | **fail**: no dialog; undo history reset. Delete template is *code-read* (`main.ts:451-457`) | UX-03, Copy P4 | |
| G33 | A product can only be placed inside the room | S05 `voidClick` | **fail**: placed at z 3.74, room ends at z 2; status says success | QA-02 | |
| G34 | Choosing a product in the Room workspace leaves the camera alone | probe in QA-05 | **fail**: camera jumps to the turntable framing | QA-05 | |
| G35 | Workspace toggle works by click and by Space | S10 | **pass** | keep | |
| G36 | Undo reverses a placement | F9 | **pass** (redo not exercised) | keep | |
| G37 | Motion stops under `prefers-reduced-motion` | F4 | **fail**: panel scroll still animates (10 positions) | QA-15 | |
| G38 | Touch: the page scrolls outside the canvas and the canvas doesn't scroll it | F6 `swipes` | **pass**: 0 px on the canvas, 235 px below it. First screen: 149 px top bar, 455 px canvas, 196 px left | re-measure after UX-12 | |

## 4. Content

| ID | Gate | Check | Today | Owner | After |
|---|---|---|---|---|---|
| G39 | A 55-character upload name fits at 375 px | W9 | **pass**: no overflow | keep | |
| G40 | Empty states say what to do, on the stage as well as in the panel | S02, manual | **fail**: Room workspace with no room shows the demo chair; the hint says "drag to orbit" while a drag spins the product; opening and product lists are blank when empty | UX-06 | |
| G41 | Error messages are plain and name the problem | S16 | **fail**: see the table below | Copy P3 | |
| G42 | A loading state shows while the viewer starts | manual, `index.html:34` | **pass**: centred "Loading…" overlay | keep | |
| G43 | No team vocabulary in visible text | Copy handoff §8 regex | **fail** (*code-read*, `index.html`): SoT, MVP, stub, mock, candidates, Polyfork, SourceAsset | Copy P1 | |
| G44 | Honesty labels are present | S16 `garbageDwg.banner`; e2e | **pass**: banner contains `mock_fixture` and `ODA available: no` | keep (Copy P1 steps 5, 6) | |
| G45 | Numbers use one format in fields and status lines | manual | **fail**: fields show `2,7` and `0,12`, status shows `2.70 m` (this machine's locale) | open (stress test C4) | |
| G46 | Switching units converts the field values | S08 | **fail**: fields unchanged; created wall is 0.0012 m thick | UX-01 item 3 | |
| G47 | The room created matches the size typed | S03, W2 | **fail**: typed 5.5 × 4, got 3 × 3 while a preset was selected | UX-01 | |
| G48 | Plurals read correctly | S04 status text | **fail**: `0 opening(s) · 0 placement(s)`, `1 template(s)` | Copy P3 | |
| G49 | A file that isn't a plan is refused | S16 `garbageDwg` | **fail**: 512 random bytes named `.dwg` produce four "Accepted" walls | Copy P4 item 6 | |
| G50 | Feedback appears where the user is looking | S05, W3, W4 `visibleInPanel` | **fail**: after a click on the canvas the status line is scrolled out of the panel in every case tested (5 of 5) | UX-04 | |
| G51 | A placed product shows a finish | S06, F9, W4 | **fail**: grey placeholder materials, also after reload | Picker UX-16 | |

**Today's strings, as measured** (the copy deck §4 has the replacements):

| Trigger | Text shown | Error style? |
|---|---|---|
| A `.glb` that isn't one | `Could not load model (broken.glb): Unexpected token 'h', "this is not a glb" is not valid JSON` | yes |
| An `.fbx` file | `Select a .glb, .gltf, or .obj file (include .mtl + textures with OBJ when available)` | yes |
| Add texture with no file | `Choose an image first` | yes |
| Import plan with no file | `Choose a plan file, or use Load mock fixture.` | yes |
| A PDF plan | `PDF plan ingest needs a rasterizer (e.g. pdf.js) or a pre-rendered PNG/JPG. Upload PNG/JPG for underlay confirm.` | yes |
| Length left blank | `Room size must be positive (length, width, ceiling height, wall thickness)` | yes |
| Click a wall in Place mode | `Click the floor inside the room to place furniture.` | yes |
| Save template with no room | `Create or load a room first.` | yes |
| No room | `No room yet — from scratch, import plan, or template.` | no |
| No templates | `No templates yet — import a plan and choose “Save as template”.` | no |
| Door added | `Added door on wall · procedural placeholder mesh (not a catalog SKU)` | no |
| Room from a plan image | `Room from underlay · client-plan.png · place Catalog 3D GLBs` | no |

## 5. Accessibility

| ID | Gate | Check | Today | Owner | After |
|---|---|---|---|---|---|
| G52 | Page has `lang` and a title | S11 | **pass**: `en`, "Catalog 3D" | keep | |
| G53 | One `h1`; headings in order | S11 `headings` | **fail**: no `h1`; `h2` and `h3` are in order | UX-13 | |
| G54 | Landmarks are named | S11 `landmarks` | **fail**: the `aside` has no name (header, nav "Workspace", main, section "3D viewer" are fine) | UX-13 | |
| G55 | Every field has an accessible name | S11 `fieldsWithoutAccessibleName` | **pass**: 0 without | keep | |
| G56 | The accessible name contains the visible label (2.5.3) | F5 | **fail**: 6 of 15 | QA-14 | |
| G57 | Text contrast is at least 4.5:1 in the active UI (1.4.3) | S12 | **fail**: 15 elements in Product mode, all in the dimmed card (3.07 to 3.37:1); pressed tool button 4.24:1. (The script also lists the fading "Loading…" overlay; ignore it) | UX-07, QA-13 | |
| G58 | Field borders and state cues reach 3:1 (1.4.11) | S12 `nonText` | **fail**: input border 1.61:1; selected segment 1.13:1 against its track | QA-13 | |
| G59 | The canvas has a name and a described alternative | S10 `canvas` | **fail**: no `tabindex`, role or `aria-label` (the section around it is named "3D viewer") | UX-13 | |
| G60 | Errors are marked by more than colour and announced as alerts | S12 `errorStatus`, S11 | **fail**: colour only; 11 `role="status"` regions, 0 `role="alert"` | QA-17 | |
| G61 | No duplicate ids, no keyboard trap, images have text alternatives | S11, F3 | **pass**: 0 duplicates; Tab runs through all 47 stops to the end; the plan SVG has `role="img"` and a label | keep | |
| G62 | A screen-reader pass (VoiceOver) of both workspaces | manual | **not run**: this session can't operate a screen reader | open | |

## 6. Cross-platform and regression

| ID | Gate | Check | Today | Owner | After |
|---|---|---|---|---|---|
| G63 | `npx tsc --noEmit` exits 0 | command | **pass** | keep | |
| G64 | Unit tests | `npx vitest run` | **pass**: 66 of 66, 18 files | keep (don't edit tests) | |
| G65 | E2E on headless Chrome with SwiftShader | scratch-copy method, handoff §8 | **pass**: 9 of 9 in 46.4 s | update specs per UX §3 | |
| G66 | Production build | `npx vite build --outDir <scratch> --emptyOutDir` | **pass**: JS 773 kB (205 kB gzip), one chunk. Two warnings: chunk over 500 kB; `mjsGuardrails.ts` is imported both statically and dynamically | keep | |
| G67 | Loads and renders on a real GPU | in-app browser, read the canvas | **pass** for a load only: Apple M1 Pro (Metal), Chrome 152, WebGL 2, Product workspace | re-check Room | |
| G68 | Safari | manual | **not run**: no automation available | D-QA5 | |
| G69 | Firefox | manual | **not run**: not installed | D-QA5 | |
| G70 | A real phone or tablet | manual | **not run**: Chrome touch emulation only | D-QA5 | |
| G71 | The UI follows the browser's default font size | code | **fail** (*code-read*): every size is in px. Page zoom works (G11) | open, low | |
| G72 | The viewer makes no third-party requests | code: `fetch(` and URLs in `src/` | **pass** (*code-read*): two `fetch` sites, both local | keep | |

---

## Prototype (`prototypes/room-vibez-planner-flows/`): three checks, not gates

The copy handoff's Phase 5 owns the prototype. These are observations for whoever takes it.

| Check | Result |
|---|---|
| Type scale (P01, P02) | 6 sizes on the sign-up screen, **9** on the editor (11.5 to 18.4 px, plus a 48 px headline) |
| Contrast (P01, P02) | The "Simulated…" and "Click-through prototype" badges are 4.39:1 at 11.5 px (need 4.5). Everything else that fails is a disabled control |
| Third-party requests (P01) | `fonts.googleapis.com`, `fonts.gstatic.com`, `unpkg.com` (Three.js). The viewer makes none |
| Phone width (P03) | Under 375 px device width the page lays out 502 px wide and is shrunk to fit. Consistent with the stress test's 140 px overflow |
| Known items re-observed | "Open demo project" sets the role to Interior designer; "Start over" carries the primary style |
