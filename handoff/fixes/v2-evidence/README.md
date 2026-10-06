# v2 evidence: what each agent measured, ran and reported

**For:** an agent or person checking how a part of `v2/` was verified. Read `fixes/v2-agent-handoff.md` first; come here for the detail behind a claim.
**Moved here:** 2026-10-06, from the orchestrating session's temporary folder, so nothing depends on that folder any more. Each folder below was compared with its source after copying (`diff -r`, no differences).

## Folders

One folder per agent. Each has `REPORT.md` (the agent's final report, taken from its transcript by script), usually `PROGRESS.md` (its running note), its probe and check scripts (`*.mjs`), their output (`out/`, `*.json`, `*.log`) and screenshots (`shots/`).

| Folder | Agent's scope | Plan wave |
|---|---|---|
| `wave1-engine-3d/` | Floor visible on arrival, room bounds, camera on product pick, placement engine, finishes engine, thumbnail spike. `out/` holds before and after measurements | 1 (A1) |
| `wave1-engine-data/` | Saving outcome, unreadable saved room, plan-file check, `.mjs` confirm, the "Clear room returns after reload" defect | 1 (A2) |
| `wave1-copy-errors/` | `src/copy.ts` and `src/errors.ts`; two scripts that compare `copy.ts` with the deck | 1 (B1) |
| `wave1-dialogs/` | Help pop-up, confirm dialog, stage toast | 1 (B2) |
| `wave1-picker/` | The picker component, checked in a test page | 1 (C) |
| `wave1-prototype/` | Planner prototype, Copy Phase 5. `audit-out/` is the QA audit script re-run on v2's prototype | 1 (D) |
| `wave1-host-trust-fixes/` | UX-01, UX-02, QA-01, QA-06, QA-07, QA-08, QA-18 | 1 (H1) |
| `wave2-feedback-guards/` | UX-03, UX-04, UX-06, QA-02, QA-04 | 2 |
| `wave3-panel-structure/` | UX-07, UX-08, QA-03. `measure-before.json` and `measure-after.json` are the UX §6 snippet | 3 |
| `wave4-placed-products/` | UX-09, UX-16 | 4 |
| `wave5-pickers/` | UX-14, UX-15 | 5 |
| `wave6a-visible-copy/` | Copy Phases 1 and 2, QA-10, QA-14 (added when that agent finished) | 6a |
| `harness/` | The two test pages the dialog and picker agents used. To use one, copy it into `v2/hackathon-3d-viewer/` beside `index.html` and open it through the dev server; they import from `/src/…` | 1 |
| `logs/` | The first full e2e run on the merged v2 (26 of 26) | 1 |
| `tools/` | `run-audit.sh` and `capture-final-screenshots.mjs` (below) | |

## What is not here, and where it is instead

- **v2's source after each wave** is the git history inside `v2/` (one commit per wave on top of a baseline commit of the untouched copy). `git -C v2 log --oneline`; `git -C v2 diff <a> <b>` shows exactly what a wave changed.
- **The e2e runner** is part of v2: `v2/hackathon-3d-viewer/scripts/run-e2e-scratch.sh`.
- **The floor-plan image for usability task T3** and the script that drew it: `media/usability-test/`.
- **Not kept, because they can be regenerated:** the agents' isolated working copies of the app (their code is in the wave 1 commit), production build outputs, and the throwaway run folders of each e2e run with the screenshots the original specs write.

## Using the scripts again

The agents' own scripts (`*.mjs` in the wave folders) are **records, not turnkey tools**. They hard-code the temporary folder they ran in, and the wave 1 ones point at per-agent ports (18781 to 18784) and at the DOM as it was then. To reuse one: fix its `import` of Playwright to `v2/hackathon-3d-viewer/node_modules/playwright/index.mjs`, its URL to `http://127.0.0.1:18777/`, its output folder, and, for anything in the Room workspace, open the step before using its controls.

The three scripts that were made to run from the project:

| Script | Does | Checked from this location? |
|---|---|---|
| `v2/hackathon-3d-viewer/scripts/run-e2e-scratch.sh [playwright args]` | Runs the e2e suite from a copy in the OS temp folder, with the specs' hard-coded Cursor paths redirected. Always pass `--workers=1` | See the status log in `fixes/implementation-plan.md` |
| `fixes/v2-evidence/tools/run-audit.sh <script.mjs> [out-dir]` | Runs a `fixes/qa-evidence/` script against v2. Its header says which scripts also need DOM updates first | No. An earlier version with fixed paths was used during the session |
| `fixes/v2-evidence/tools/capture-final-screenshots.mjs` | Ten final-state views at 1440×900 and 375×812 into `media/ux-fix/` | See the status log |

## Caveats that apply to everything here

- All measurements were taken in headless Chrome on software rendering (SwiftShader), with overlay scrollbars. No real phone, no Safari or Firefox, no screen reader, no people.
- Screenshots in the wave 1 to wave 5 folders show the wording as it was at that wave; the deck's wording arrived in wave 6a.
- The only personal-looking strings in these files are the prototype's placeholder addresses (`you@example.com`, `alex@example.com`).
