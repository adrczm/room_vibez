# Prototype agent (D): Copy Phase 5, running note

**Status: COMPLETE. Final report sent.** (last update after all re-runs on the final files)

Files: `v2/prototypes/room-vibez-planner-flows/{index.html,app.js,styles.css}`. Pristine: `$S/base-w0-prototype/` (still identical to the original `prototypes/…`, which was not touched).
Scripts: `$S/proto/*.mjs`. Output: `$S/proto/out/`. Shots: `$S/proto/shots/` (34 files). Audit output: `$S/qa-out-proto/`.

## Phase 5 bullets (all verified in real Chrome by file URL)

| Bullet | Status | Evidence |
|---|---|---|
| Deck §6.1 visible copy | verified | `verify.mjs` 120/120; `strings-diff.mjs`: 107 of 114 new/changed strings are in deck §5-§7 word for word |
| Deck §6.2 toasts | verified | every toast triggered and compared, incl. three 3D fallbacks |
| Research labels + disabled controls removed | verified | `labels-count.mjs`: pristine 17 matches / 7 disabled research controls, v2 0 / 0 |
| Vocabulary | verified | BOM only in the reseller card; no Cart/furniture; one Draw it myself; no #btnManualOnly |
| Bug 1 tick reset + re-disable | reproduced on pristine, fixed | `out/repro-base.json` vs `out/repro-v2.json` |
| Bug 2 skip-demo keeps role | reproduced on pristine, fixed | same |
| Bug 3 starter idempotent | reproduced on pristine (0,2,3,4,5,6), fixed (0,2,2,2,2,2) | same |
| Upload zone label, Enter/Space (A1) | verified | same |
| Start over confirm + count + secondary | verified | verify.mjs |
| Render style kept + honest toast (§7 default 3) | verified | verify.mjs |
| Total line both places | verified | verify.mjs |
| ? dialog (deck §6.3), keyboard | verified | verify.mjs section E, F |

## Decisions and deviations (in the final report)
- ERP "Live stock" item REMOVED (Phase 5 + brief) although deck §6.1 gives a relabel. Conflict flagged.
- Architect note: h3 "Architect · DWG hybrid" not in the deck, left; deck sentence in the paragraph.
- #btnManualOnly deleted per deck: Draw it myself only reachable after a file type is chosen (measured).
- Role pill labels ("Consumer", "Reseller / ops") not in the deck, unchanged.
- Empty project name shows existing fallback "Untitled".
- Deck §6.3 "The chips at the top show where you are": the editor screen has no chips (measured). Copied as written.

## Found, not in the handoffs, fixed (small)
- Toast sat inside the editor stage: invisible on other screens (pristine: 0 client rects on parts list). Moved to app level, fixed position.
- A file-type chip also opened the OS file picker (pristine: filechooser event fired). Guarded.
- 3D caption sat at the bottom of the stage: below the window at 1280x800 (pristine y=904 to 953 of 800) and on the grey floor. Now the same chip and corner as the 2D hint.

## Strings not in the deck (written by me)
- `No role picked, so the demo opens as Interior designer.`
- `This clears your project and 1 placed item.` (singular)
- Dialog title `How this works` (deck §7 tooltip string re-used); `Close`; aria-label `Close help` (Copy handoff Phase 2)
- aria-labels `Tools and products`, `Finishes and parts list`, `Parts list and SKUs`

## Checklist observations
- Badge contrast: fixed, 4.39 -> 5.36:1 (`--warn`). Audit: non-disabled failures 2/1/1 -> 0/0/0.
- Phone overflow: fixed (`.topbar` flex-wrap). 375 plain: 127 to 140 px -> 0. Mobile emulation layout 502 -> 375.
- Third-party hosts: 3, unchanged.
- Type scale: not addressed. 6 / 9 unchanged; parts list reads 7 -> 8 in the audit only because the toast is now visible there (7 once it fades).
