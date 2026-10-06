# Changes in v2, wave by wave

The history of this repository is the record: one commit per wave on top of a baseline of the untouched app. `git log --oneline` lists them; `git diff <a> <b>` shows exactly what a wave changed. Each wave was verified in a browser before the next started; the agent's report and measurements for each are in `handoff/fixes/v2-evidence/`.

| Commit | Wave | What changed | Checks after it |
|---|---|---|---|
| `fd58dbe` | Baseline | The app as copied on 2026-10-05, with only the ports changed (18777 / 18778) so it could run beside the original | tsc 0 · unit 66/66 · e2e 9/9 |
| `385a5f0` | 1 | **Engine:** wall cutaway and a 45° arrival camera, so the floor is visible from the first frame (it was 0 % of the canvas); floor hits only inside the room; the camera no longer jumps when a product is picked; placement hit kind, pose and highlight; `applySlotBindings`; a thumbnail renderer. **Data:** saving failures reported, unreadable saved rooms quarantined, a plan-file check, async `.mjs` confirm, the failing size field named, `clearProjectFromIdb`. **New modules:** `src/copy.ts` with every deck string, `src/errors.ts`, the help pop-up, confirm dialog and toast, the picker component. **Host:** typed room size respected, unit conversion, tools toggle off and Esc, undo ignores typing, disabled buttons look disabled, `[hidden]` honoured. **Prototype:** Copy Phase 5 | unit 315/315 · e2e 26/26 |
| `6f90781` | 2 | Clear, Replace and Delete template ask first; a cleared room no longer returns after a reload (a confirmed defect); feedback as a toast on the 3D view; fixed tool-button labels; the empty Room state with four ways to start, including opening a project file; clicks outside the room refused with a message; the white-floor bug | e2e 32/32 |
| `ac168ac` | 3 | Only the active workspace's controls rendered; Materials lead the Product panel; texture, pack and module uploads in a closed Advanced section; lighting on the 3D view; the Room workspace as four steps; **Add to room**; Undo/Redo/Export/Import toolbar (Import works with no room); the 3D view stays on screen on phone-size screens; the toast no longer blocks canvas clicks | e2e 41/41 |
| `0a15b00` | 4 | Placed products wear the chosen finish (they were flat grey) and keep it through reload, undo and redo; the Materials card in the Place products step; select from canvas or list, numbered rows, arrow-key nudge, R to rotate, Delete; the selected product's own finish; a message when a saved room's uploaded model is gone | unit 336/336 · e2e 48/48 |
| `a576d25` | 5 | Product picker with rendered thumbnails and a list view; wall, floor and texture-target pickers with category tabs; names under the slot swatches | e2e 60/60 |
| `262d64f` | 6a | Every static word from the deck via `src/copy.ts` (helper text 304 → 92 words); the **?** button and help wired; honesty pins kept in collapsed *Technical details*; the top bar keeps one height; six accessible names fixed; `scripts/run-e2e-scratch.sh` | unit 340/340 · e2e 74/74 |

## Measured before and after

Figures from the agents' reports (headless Chrome, software rendering, overlay scrollbars). The "before" is the baseline commit.

| | Before | After |
|---|---|---|
| Floor visible on arrival after Create room, 1440×900 and 375×812 | 0 % of the floor | 100 % |
| Place-mode clicks on arrival that land outside the room | 26.3 % | 0 % |
| Side-panel scroll height in Product, 1440×900 | 2720 px | 1103 px (target was about 1000) |
| Scroll needed to see the first material swatches | 137 px | 0 px |
| Visible native file inputs, Product / Room | 5 / 5 | 1 / 0 |
| Phone (375×812): page scroll two seconds after load, canvas visible | 1400 px, 0 % | 0 px, 100 % |
| Tab stops inside the inactive workspace | 12 (Product), 6 (Room) | 0 |
| Floor-to-wall contrast, three light presets | 1.01 / 1.01 / 1.27 | 1.76 / 2.53 / 3.43 |
| Static helper text (the deck's 14 paragraphs) | 304 words | 92 words |
| Finish on a placed product | grey placeholder | the chosen finish |

## Not changed

Waves 6b, 7 and 8 were skipped on the owner's instruction. [Known gaps](known-gaps.md) lists what that leaves.
