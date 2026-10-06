# Testing

All figures are from the last commit on `main`. Run everything from `hackathon-3d-viewer/`.

| Check | Command | Last result |
|---|---|---|
| Types | `npm run typecheck` | exit 0 |
| Unit tests (Vitest, `tests/unit/`) | `npm test` | 340 passed in 30 files |
| End-to-end (Playwright, `tests/e2e/`) | `scripts/run-e2e-scratch.sh --workers=1` | 74 passed, about 7 minutes (as reported by the agent that ran it after the last change) |
| Production build | `npm run build` | OK; two long-standing warnings (a chunk over 500 kB, and `mjsGuardrails.ts` imported both statically and dynamically) |

## End-to-end tests: read this before running them

**Use the script, not `npm run test:e2e`.** Six of the original specs write screenshots to hard-coded paths under `~/Library/Application Support/Cursor/…` on the author's machine. `scripts/run-e2e-scratch.sh` copies the specs to the OS temp folder, redirects those paths there, refuses to run if any remain, and runs Playwright against the dev server, which must already be up on port 18777 (`RV_BASE_URL` overrides).

**One worker.** Playwright drives the installed Google Chrome with SwiftShader (software WebGL). With the default five workers, tests time out and look like regressions; `--workers=1` is reliable.

**The camera drifts.** After a drag, OrbitControls' damping keeps the camera moving for seconds. A test that reads the camera lets it settle first (the trust-fixes spec runs `controls.update()` many times).

**The Room panel is a stepper.** A test opens a step (`.step[data-step="place"] .step-toggle`) before using that step's controls; `tests/e2e/panel-structure.spec.ts` and `placed-products.spec.ts` show the pattern.

**Hot reload breaks a running test.** Editing `src/main.ts` or `index.html` while the suite runs makes Vite reload the page under the test.

**Storage is per origin.** Each spec uses a fresh browser context; a test that checks persistence reloads within its own context.

## What the suites cover

- Unit: the engine's pure logic (room graph, history, collision, bounds, plan, underlay, uploads, modules, packs, slot bindings), the copy module and error mapper, the picker's pure helpers, placed-product helpers, static copy keys.
- E2E: the original seven specs (cold load, product display, room from scratch, plan import, floor extent, missing features, the viewer smoke test) plus one spec per wave of the fix (trust fixes, feedback and guards, panel structure, placed products, pickers, copy pass, and four engine specs). Canvas interaction is tested with real pointer clicks, not only the `__rv.simulateRoomPointer` hook, because two defects only showed with real input.

## What no test covers

Real GPU rendering, screen readers, Safari, Firefox, Windows, real phones (the 375 × 812 tests are Chrome's touch emulation), the `.mjs` and pack upload flows beyond unit tests, concave rooms in the browser, and anything involving people. The 72-gate design QA checklist in `handoff/fixes/design-qa-checklist.md` has "before" values only; the "after" column was never filled.

## Audit scripts from the QA session

`handoff/fixes/qa-evidence/*.mjs` measured the app before the fix. They are wired to the original app and the old DOM; `handoff/fixes/v2-evidence/tools/run-audit.sh` retargets one at this repository, and its header says which scripts also need the stepper and new row selectors before their numbers mean anything.
