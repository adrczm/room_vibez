# H1 (host: trust fixes) running note

Updated 2026-10-05 16:25. **All six tasks are fixed and verified. Nothing is half-done.** Only the final report remains.

Snapshot of the three host files before any edit: `h1/snapshot-before/` (index.html, main.ts, styles.css).
Evidence in `h1/`: `probe.mjs` -> `out-before.json`, `out-after.json`, `out-after-qa01.json` (QA-01 with the camera at rest), `out-after-final.json` (QA-06 on the final guard); `extra.mjs` (guard boundaries, pressed+hover, empty field); `drift.mjs` (camera drift after a drag); `reload.mjs`; `shot-room-no-room-disabled.png`; `probe-tool-toggle-before.txt` / `-after.txt` (the QA session's probe); `e2e-full-after.txt` (5 workers, loaded machine), `e2e-full-after-w1.txt` (one worker), `e2e-newspec-against-original.txt`.

## Per task

| Task | Reproduced before | Fixed | Verified after |
|---|---|---|---|
| UX-01 (3 parts) | yes (6 typed -> 3.00 m room; cm -> wall 0.0012 m) | yes | yes (probe + new spec) |
| UX-02 + QA-08 | yes (5 ids; 3 with a room) | yes | yes (`[]` in 4 states; texture target still shows for normal/roughness) |
| QA-01 parts 1-4 | yes (3/3 tools stuck on; camera -24..-28 deg; ingress -31 deg; Esc no-op) | yes | yes (toggle off; delta 0.02..0.08 deg at rest; Product->Room reframes; Esc works) |
| QA-06 | yes (2 -> 1 placements, "Undid last room change") | yes | yes (2 -> 2, field undoes own text; outside a field undo still works) |
| QA-07 | yes (identical computed style) | yes | yes (opacity .5, cursor default, no shadow, no hover change) |
| QA-18 | yes (all three enabled and visible with no room) | yes | yes (two disabled; Download hidden by the [hidden] fix) |

## Files changed
- `src/main.ts` (1879 -> 1983 lines, sha 3fb70ed6eaca), `src/styles.css` (245 -> 250, sha b38db7a4e12b), new `tests/e2e/trust-fixes.spec.ts` (276 lines, 5 tests). `index.html` NOT changed (sha 5e62c14520a8).

## main.ts functions touched
- new: `LENGTH_FIELDS`, `fieldUnit`, `trimNoise`, `fieldMeters`, `setFieldMeters`, `syncLengthFieldLimits`, `convertLengthFields`, `exitRoomTool`, `NON_TYPING_INPUT_TYPES`, `isTypingTarget`
- edited: `syncOpeningDefaultsFromType`, `renderRoomUi`, `setWorkspace`, `readOpeningParamsMeters`, `onCreateRoom`, and in `boot()`: ingress-tab handler, preset `change` handler, new `input` listeners on length/width/ceiling, units `change` handler, the three tool-button handlers, the document `keydown` handler, the field seeding at the end of boot

## Deviations and defaults to flag in the report
- `isTypingTarget` is narrower than the handoff's literal "any input": checkbox/radio/button/submit/reset/file/range/color/image inputs do not count (with the literal guard Esc and Cmd+Z were dead while `#place-wall-snap` had focus). It also ignores keys from inside any `<dialog>`.
- ft-in: min = metric minimum in feet rounded down to 2 decimals, step = `any`. Not in the handoff.
- Field values written by code are trimmed to 6 decimals.
- Hover rules use `:where(:not(:disabled))`.

## Results
- tsc exit 0; vitest 66/66 (18 files).
- e2e `--workers=1`: 14 passed (9 existing unedited + 5 new) in 2.6 min.
- e2e default 5 workers at load average ~104: 7 failed (6 existing specs on screenshot/poll timeouts, 1 new camera test whose wall-clock settle check was then replaced by `restingCamera()`).
- New spec against the unfixed original (:18767, read-only): 5 of 5 fail, each on its own defect.
- `vite build` not run (brief says not to build in place).
