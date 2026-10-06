# Implementation plan: the combined fix, built as a separate v2

**Written:** 2026-10-05 by the implementing Claude session, at Adrian's request ("create a plan for tackling all the tasks, deploy multiple agents as required, create a new version of the app in a separate folder that can be tested by me first, do not invent anything").
**Reads from:** the four handoffs in this folder (`ux-improvements-handoff.md`, `ux-copy-improvements.md`, `ux-catalog-picker-handoff.md`, `qa-validation-handoff.md`) and their companions (`design-qa-checklist.md`, `validation-report.md`, `usability-test-plan.md`, `docs/ux-copy-deck.md`).
**This file adds no findings.** It only orders the work, assigns it, and records which defaults are taken. Where it and a handoff disagree, the handoff wins and this file is wrong.

---

## 1. Where the work happens

| | Original (untouched) | v2 (the fix) |
|---|---|---|
| Viewer | `hackathon-3d-viewer/` on `http://127.0.0.1:18767/` | `v2/hackathon-3d-viewer/` on `http://127.0.0.1:18777/` |
| Prototype | `prototypes/room-vibez-planner-flows/` | `v2/prototypes/room-vibez-planner-flows/` |

- v2 was cloned from the original on 2026-10-05 15:42. At that moment the six fingerprints in the QA handoff §8 matched (`viewer-baseline-2026-10-05`). The only differences at clone time are the port numbers (`package.json`, `playwright.config.ts`, `scripts/launch.sh`, `Start Viewer.bat`, `README.md`, `QUICKSTART.md`, `scripts/capture-room-floor.mjs`, `ASSUMPTIONS.md` row A10).
- A different port means a different browser origin, so v2 has its own `localStorage` and IndexedDB. A room saved in the original does not appear in v2.
- Baseline measured on v2 before any change: `tsc --noEmit` exit 0 · unit 66/66 (18 files) · e2e 9/9 in 48.3 s (scratch-copy method) · `vite build` OK with the same two warnings.
- Rollback: delete `v2/`. Nothing in the original folders is edited by this plan.
- No git (D-QA6 default). A pristine copy of the wave-0 source is kept in the session scratchpad for diffs.

## 2. Rules every agent follows

1. **Do not invent.** No new features, product data (images, categories, makers, prices, SKUs), claims about DWG/ODA fidelity, or decisions the handoffs leave open. Honesty labels stay visible. If something is unknown or could not be checked, say so in the report; do not guess.
2. **Words:** `docs/ux-copy-deck.md` wins. Copy its strings exactly. A string the deck lacks is written in the deck's voice (deck §1), goes in the "not in the deck" section of `src/copy.ts`, and is listed in the report.
3. **QA corrections override the earlier handoffs** (QA handoff §2). The four that change what is built: **C2** (UX-07 items 1 and 4 ship together), **C3** (`hidden` is overridden on five elements, not one), **C5** (the wall cutaway is required; camera elevation alone cannot show the floor), **C15** (Import project must be reachable in the Room workspace with no room).
4. **Test contract:** keep every id, `data-*`, class and aria state listed in UX §3, Picker §6 and Copy §4. Existing **unit tests are never edited**; if one fails, the code is wrong. Existing e2e specs change only as UX §3 and Copy Phase 1 step 7 say. New test files are welcome.
5. **Cold boot lands on Product with the demo chair visible** (`docs/model-display-deep-qa-fix.md`).
6. **No new dependencies. No second 3D engine. Light theme only.**
7. **Stay in your files.** Each agent has an ownership list (§4). Do not edit a file you do not own; report what you need from its owner instead.
8. **Do not touch:** the original `hackathon-3d-viewer/` and `prototypes/`, anything in `fixes/` (read-only), `History/`, `chrome-profile-coohom/`, `screenshots/`, the Coohom reports. Never start or stop anything on port 18767.
9. **Verify before you claim.** Typecheck and unit tests always. Behaviour is checked in a real browser (headless Chrome through the project's Playwright, SwiftShader flags as in `playwright.config.ts`). Canvas and tool-button behaviour is checked with **real pointer input**, not only `__rv.simulateRoomPointer` (validation report, "Test hooks and real input").
10. **Report per item:** *verified* (how, with the measured value) · *implemented, not verified* (why) · *not done* (why). Also: files changed, new strings, new public functions with signatures, anything found that is not in the handoffs.

**Shell limits in this project.** The agent shell cannot create folders inside the project folder (`mkdir` gives "Operation not permitted"); the Write and Edit tools can. Scripts write to the scratchpad. E2E and audit scripts run through two helpers in `<scratchpad>/tools/`:
- `run-e2e.sh <viewer-root> <base-url> [playwright args]` copies the specs to scratch with the hard-coded Cursor paths redirected, then runs them. It refuses to run if any spec still points into Cursor's app data.
- `run-audit.sh <script.mjs> <viewer-root> <base-url> <out-dir>` runs a scratch copy of a `fixes/qa-evidence/` script retargeted at v2. The originals are not edited.

## 3. Waves

Three files hold most of the UI (`index.html`, `src/main.ts`, `src/styles.css`). Only **one agent at a time** edits them (the "host" track, in order). Everything that can live in other files is built in parallel in isolated copies and merged by file.

| Wave | Agent | Works in | Takes |
|---|---|---|---|
| 0 | this session | `v2/` | Clone, ports, baseline, helpers. **Done.** |
| 1 (parallel) | **A1 Engine 3D** | isolated copy | UX-05 (with C5), UX-06 engine part, QA-02 engine part, QA-05, UX-09 engine part, UX-16 step 1, UX-14 step 5 (thumbnail spike) |
| 1 | **A2 Engine data** | isolated copy | Copy Phase 4 items 1, 2, 4, 5, 6 (engine side); the IndexedDB "Clear then reload" question (QA §7) |
| 1 | **B1 Copy and errors** | isolated copy | Copy Phase 0 (`src/copy.ts`), every viewer string from deck §3 to §5, `src/errors.ts` (`friendlyError`) |
| 1 | **B2 Dialogs** | isolated copy | Copy Phase 2 component (**?** dialog, deck §2), `confirmDialog` (Copy Phase 4 item 3), stage toast (`notify`, UX-04 item 1) |
| 1 | **C Picker** | isolated copy | UX-14 steps 1 to 4 (component with thumbnail and list views), item rendering for UX-15 |
| 1 | **D Prototype** | `v2/prototypes/…` | Copy Phase 5 |
| 1 | **H1 Host: trust fixes** | `v2/` | UX-01, UX-02 + QA-08, QA-01, QA-06, QA-07, QA-18 |
| 2 | **H2 Host: feedback and guards** | `v2/` | UX-03, UX-04, UX-06 host part, QA-02 host part, QA-04 |
| 3 | **H3 Host: structure** | `v2/` | UX-07, UX-08, A1 (as corrected by C15), A2, QA-03, QA-09 (inactive tab stops), QA-15 (scroll), spec edits from UX §3 |
| 4 | **H4 Host: placed products** | `v2/` | UX-09 host part, UX-16 steps 2 and 3, 16b if UX-09 lands |
| 5 | **H5 Host: pickers** | `v2/` | UX-14 mount and thumbnails, UX-15 |
| 6 | **H6 Host: copy pass** | `v2/` | Copy Phases 1, 2 (wiring), 3 (wiring), 4 (host side); QA-10, QA-12, QA-14, QA-17 |
| 7 | **H7 Host: targets and accessibility** | `v2/` | UX-12, UX-13, QA-09 (focus), QA-11, QA-13, QA-15 (CSS), QA-16, QA-19 last |
| 8 | **V Verification** + this session | `v2/` | 72 gates, the audit scripts, full e2e, usability-test assets, an independent code review, the one completion doc `docs/ux-fix.md`, `History/` append |

After every wave this session merges, then runs typecheck, unit tests and e2e before the next wave starts.

**Status log**
- 2026-10-05 16:48: **wave 1 finished and merged into `v2/`.** All seven agents reported (six were cut off once by the usage limit and resumed from where they stopped). 36 files were merged from the agents' isolated copies and each was checked byte-identical by sha256. After the merge: `tsc --noEmit` exit 0 · unit 315/315 (28 files; 66 original, unedited, plus 249 new) · `vite build` OK. What each slice built, its exact API and the host wiring steps are in `fixes/v2-wave1-handover.md`.
- 2026-10-05: **wave 2 (H2, feedback and guards) done**: `tsc` 0 · unit 315/315 · e2e 32/32. **Wave 3 (H3, panel structure) done**: `tsc` 0 · unit 315/315 · build OK · e2e 41/41. Details in `fixes/v2-wave1-handover.md` §10 and §11.
- 2026-10-05 22:59: resumed after a usage-limit stop (v2 intact; original app's fingerprints unchanged). **Wave 4 (H4, placed products) done**: `tsc` 0 · unit 336/336 · build OK · e2e 48/48. Details in the handover §12. **Wave 5 (H5, pickers) started.**
- 2026-10-06: **Wave 5 (H5, pickers) done**: `tsc` 0 · unit 336/336 · build OK · e2e 60/60 after two layout assertions were adjusted (handover §13 says which and why). **Wave 6 is split in two**: 6a (visible copy and the **?** pop-up: Copy Phases 1 and 2, QA-10, QA-14) started; 6b (messages and the behaviour they depend on: Copy Phases 3 and 4, QA-12, QA-17) follows it.
- 2026-10-06 01:10: **Adrian's instructions: skip waves 6b, 7 and 8; "merge everything into v2/"; commit to git when done.** "Merge" means into `v2/`; the original app is not replaced. So these stay not done: Copy Phases 3 and 4 on the host side, QA-12, QA-17 (6b); UX-12, UX-13, QA-09 focus, QA-11, QA-13, QA-15 CSS, QA-16, QA-19 (7); the 72 gates, the audit scripts, the independent review, the completion doc `docs/ux-fix.md` and the `History/` entry (8).
- 2026-10-06 01:55: **Everything useful was moved out of the session's temporary folder** at Adrian's request. A git repository now exists **inside `v2/` only** (his choice): a baseline commit of the untouched copy, then one commit per wave for waves 1 to 5. Agents' reports, notes, scripts, measurements and screenshots are in `fixes/v2-evidence/` (see its README). The e2e runner is `v2/hackathon-3d-viewer/scripts/run-e2e-scratch.sh`. A handoff for agents in other tools is `fixes/v2-agent-handoff.md`.
- 2026-10-06 02:10: **Wave 6a (visible copy and the ? pop-up) done and committed** in `v2/` as `5d0fd81`: `tsc` 0 · unit 340/340 (30 files) · build OK · e2e 74/74 as reported by the wave's agent (`--workers=1`, 6.9 min; not re-run by the orchestrating session). Working tree clean. Then, on 2026-10-06 10:15: `dist/` built in place (ignored by git), wave 6a's final report saved to `fixes/v2-evidence/wave6a-visible-copy/REPORT.md`, and twenty final-state screenshots captured into `media/ux-fix/` (0 page errors). **This is the final state of the session**; the working tree in `v2/` is clean at `5d0fd81`.
- 2026-10-06 10:16: **pushed to GitHub** at Adrian's request: `https://github.com/adrczm/room_vibez` (public). The seven local commits were rebased onto the repository's own "Initial commit" (a README), so the hashes changed: the tip is now `262d64f` (wave 6a); `git log` in `v2/` is the reference. The original app folder is still untracked and unchanged.
- **Not started and not planned: wave 6b, wave 7, wave 8** (see the 01:10 entry). If work stops again: read the handover file and the newest `<scratchpad>/h<N>/PROGRESS.md`, then continue on `v2/` as it stands.
- The shell lost all write access to the project folder during wave 1 (earlier it could write files into existing folders). From here every project write goes through the Write and Edit tools, and screenshots stay in the session scratchpad until Adrian copies them.

## 4. File ownership in wave 1

| Agent | Owns (may create or edit) |
|---|---|
| A1 | `src/viewer/RoomVibezViewer.ts`, `roomMesh.ts`, `presets.ts`, `roomCollision.ts`, `slots.ts`, `types.ts`, `index.ts`, new `src/viewer/thumbnails.ts` and other new files under `src/viewer/`, new unit and e2e test files |
| A2 | `src/viewer/roomGraph.ts`, `modules.ts`, `mjsGuardrails.ts`, `dwgImport.ts`, `projectIO.ts`, new unit test files. Needs exports added to `index.ts`: list them in the report |
| B1 | `src/copy.ts`, `src/errors.ts`, new unit test files |
| B2 | `src/help.ts`, `src/help-content.ts`, `src/ui/confirmDialog.ts`, `src/ui/notify.ts`, their CSS files |
| C | `src/ui/thumbnailPicker.ts`, its CSS file, new unit test files |
| D | `v2/prototypes/room-vibez-planner-flows/*` |
| H1 | `index.html`, `src/main.ts`, `src/styles.css`, `tests/e2e/*` |

## 5. Every item, and where it lands

**UX handoff**

| ID | Wave | Note |
|---|---|---|
| UX-01 | 1 (H1) | |
| UX-02 | 1 (H1) | Covers all five elements (C3, QA-08) |
| UX-03 | 2 | Default D4: confirm dialog, history unchanged, stay in Room |
| UX-04 | 2 | Esc itself lands in wave 1 with QA-01 and QA-06 |
| UX-05 | 1 (A1) | Cutaway required (C5) |
| UX-06 | 1 (A1) engine, 2 host | |
| UX-07 | 3 | Items 1 and 4 together (C2) |
| UX-08 | 3 | Toolbar scope per C15 |
| UX-09 | 1 (A1) engine, 4 host | Drag-to-move is optional in the handoff; taken only if it is cheap, reported either way |
| UX-10 | not done as written | Replaced by UX-16 steps 1 and 2 (Picker §0.1, C4). Its fallback sentence is false and is not shipped |
| UX-11 | not done here | Superseded by the copy handoff |
| UX-12 | 7 | |
| UX-13 | 7 | |

**Picker handoff**

| ID | Wave | Note |
|---|---|---|
| UX-14 | 1 (C component, A1 thumbnail spike), 5 mount | If the spike fails: placeholder tiles plus `thumbnailUrl`, said plainly |
| UX-15 | 5 | Slot swatches stay inline and get visible names (DT2) |
| UX-16 | 1 (A1) step 1, 4 steps 2 and 3, 16b | |
| A1 | 3 | Import project: Room workspace, with or without a room (C15, D-QA2). Undo, Redo, Export: Room workspace and a room exists |
| A2 | 3 | Run as an acceptance check in both workspaces |
| A3 | none | Supporting evidence only |

**Copy handoff**

| Phase | Wave | Note |
|---|---|---|
| 0 | 1 (B1) | |
| 1 | 6 | The one permitted selector edit (`data-action="use-template"`) |
| 2 | 1 (B2) component, 6 wiring | Interim "Files & saving" sentence until Phase 4 item 1 is wired and verified (Copy §6 A) |
| 3 | 1 (B1) mapper, 6 wiring | |
| 4 | 1 (A2 engine, B2 `confirmDialog`), 2 (item 3 in use), 6 (items 1, 2, 4, 5, 6 host side) | |
| 5 | 1 (D) | |

**QA handoff**

| ID | Wave | ID | Wave |
|---|---|---|---|
| QA-01 | 1 (H1) | QA-11 | 7 |
| QA-02 | 1 (A1) engine, 2 message | QA-12 | 6 |
| QA-03 | 3, re-measured in 7 | QA-13 | 7 |
| QA-04 | 2, toolbar scope in 3 | QA-14 | 6 |
| QA-05 | 1 (A1) | QA-15 | 3 (scroll), 7 (CSS) |
| QA-06 | 1 (H1) | QA-16 | 7 |
| QA-07 | 1 (H1) | QA-17 | 6 |
| QA-08 | 1 (H1) | QA-18 | 1 (H1), UX-08 item 6 in 3 |
| QA-09 | 3 and 7 | QA-19 | 7, last (after structure and trust bugs, as the handoff asks) |
| QA-10 | 6, re-measured in 7 | | |

Corrections C1, C7, C11 change how numbers are reported (scrollbar mode stated; 3.1 screens as the mobile "before"; 304 words as "before" for all 14 paragraphs). C6, C8, C9, C12, C13, C14 confirm or inform. C10: the Node PATH line is skipped. C4: see UX-10.

## 6. Defaults taken (each handoff says "take the default, flag it")

None of these is settled by this plan. They are the handoffs' defaults, applied in v2 so Adrian can see them and reverse them.

| ID | Default taken |
|---|---|
| D1 | The viewer is the product; the prototype is not merged in |
| D2 / Copy 5 | Imported candidates still start included; relabel only |
| D3 | Only the existing `slot_bindings` field is persisted; no BOM or variant schema |
| D4 | Clear, Replace and Delete template ask first; history is not made undoable |
| D5 | `.mjs` pack and module controls stay, inside the Advanced disclosure |
| Copy 1 | Developer controls relabelled and kept |
| Copy 2 | Superseded by UX-07 (UX §0.1): texture, pack and module go in Advanced; `#model-files` stays visible |
| Copy 3 | Prototype render-style control kept with the honest toast |
| Copy 4 | "Did you mean" size message skipped |
| Copy 6 | Escalating upload wording only if cheap; otherwise first wording, noted |
| DT1, DT2 | Confirmed by Adrian on 2026-10-05 (Picker §1) |
| DT3 | Anchored popup; full-width sheet at 860 px and below |
| DT4 | Search appears when the list is long. The number is chosen during the build, recorded, and marked unvalidated |
| DT5 | Runtime offscreen thumbnail render if the spike passes |
| DT6 | Materials card shown in the Room "Place products" step |
| DT7 | Deferred patterns not done |
| DT8 | Thumbnails and list, with a toggle; no evidence on which people prefer |
| D-QA1 | A click outside the room is rejected with a message |
| D-QA2 | Import project allowed in the Room workspace with no room |
| D-QA3 | Name the tokens in use, three small spacing moves, one control height |
| D-QA4 | WCAG 2.2 AA as the yardstick (the project has set no target) |
| D-QA5 | Browser support unknown; tested in Chromium only |
| D-QA6 | No git; v2 folder plus scratch snapshot |

Left for Adrian: D-UT1 to D-UT3 (who to test with, on which build, where).

## 7. Verification at the end

1. `tsc --noEmit`, unit tests, `vite build`, full e2e (existing specs with the listed edits, plus new specs).
2. The four audit scripts and two probes from `fixes/qa-evidence/`, retargeted at v2. Their output fills the After column of the 72 gates. Scrollbar mode is stated with every pixel figure (C1).
3. A2 DOM check, UX §6 snippet and golden path, Copy §8 vocabulary regex and word count, Picker §7 checks.
4. An independent review of the full diff by an agent that did not write it.
5. One load of v2 in the in-app browser (real GPU) for both workspaces.

## 8. What this plan cannot deliver

- **No usability test with people.** Claude prepares the assets in `usability-test-plan.md` §9; the sessions need Adrian.
- **No screen-reader pass, no Safari, Firefox, Windows, Android or iOS check.** Only Chromium can be automated here.
- **Interaction tests run on software rendering.** Real-GPU checks are limited to what the in-app browser allows.
- **Which picker view people prefer, and whether the borrowed Roomle and Planner 5D patterns suit this audience, is unknown.**
- **Effort is unknown in advance.** The handoffs rate several items "L" and call their own estimates guesses. Any item that does not land is listed in `docs/ux-fix.md` as not done, with the reason.
