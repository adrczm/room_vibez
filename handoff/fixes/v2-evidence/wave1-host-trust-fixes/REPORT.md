# H1 final report: host trust fixes

All six tasks are fixed and verified in headless Chrome (SwiftShader) with real pointer input on the canvas and tool buttons. After the resume I re-checked the three files: `tsc --noEmit` exit 0, no half-finished edit. Two things differ from the handoff's letter: the key guard is narrower than "any input", and the feet limits are my own default (both in section 5).

## 1. Per task

| Task | Reproduced before | After the fix (measured) |
|---|---|---|
| **UX-01** part 1 and 2 | Yes. Small bedroom + Length 6 gave a 3.00 m room; preset stayed `small-bedroom` | **Verified.** Room is 6.00 × 3.00 m and the preset reads `custom` ("Custom…") as soon as the field is typed in |
| **UX-01** part 3 | Yes. In cm the fields stayed 3 / 3 / 2.7 / 0.12 and the created wall was 0.0012 m | **Verified.** cm shows 300 / 300 / 270 / 12, openings 90 / 210 / 0; min/step 50/10, 5/1, 20/5, 0/5. Created wall is 0.12 m. m → cm → ft → m returns the starting values |
| **UX-02 + QA-08** | Yes. Five ids overrode `hidden` in fresh Product, Room with no room, and Import tab; three with a room | **Verified.** The snippet returns `[]` in all four states. `#project-file` is `display: none`. Check-after: the target select is `flex` for normal and roughness, `none` for base colour |
| **QA-01** part 1 | Yes. 3 of 3 tools stayed on after three clicks | **Verified.** Each tool goes on / off / on; second click gives `aria-pressed="false"` and mode `room` |
| **QA-01** part 2 | Yes. Orbit then tool: −23.9°, −24.5°, −28.4° | **Verified.** With the camera at rest: +0.02°, +0.04°, +0.04° |
| **QA-01** part 3 | Yes. Ingress tab: −31.2° | **Verified.** 68.19° → 68.27°. Product → Room still frames (21.6°, distance 8) |
| **QA-01** part 4 | Yes. Esc left the tool on | **Verified.** Esc gives mode `room` and `aria-pressed="false"` |
| **QA-06** | Yes. Cmd+Z in Length: placements 2 → 1, "Undid last room change" | **Verified.** Placements stay 2 and the field goes 59 → 5 by itself. Outside a field, undo (2 → 1) and redo still work. Esc in a field leaves the tool on |
| **QA-07** | Yes. Disabled Undo was identical to enabled Export | **Verified.** Differs in opacity (0.5), cursor (`default`) and shadow (none); no hover change. A pressed tool button keeps its pressed colour on hover |
| **QA-18** | Yes. All three were enabled and visible with no room | **Verified.** Save-as-template and Clear room are disabled. Download plan PNG is hidden by the task 2 rule alone, no extra code. All three return once a room exists |

The QA session's `probe-tool-toggle.mjs` now reports `canToggleOff: true` for all three tools. Its two camera readings are no longer informative; see section 5.

## 2. Files changed

- `index.html`: **not changed.**
- `src/styles.css` (245 → 250 lines):
  - added `[hidden] { display: none !important; }`;
  - added `.btn:disabled { opacity: 0.5; cursor: default; box-shadow: none; }`;
  - the two hover selectors became `.btn:hover:where(:not(:disabled))` and `.btn-primary:hover:where(:not(:disabled))`.
- `tests/e2e/trust-fixes.spec.ts`: new, 5 tests, writes no files.
- `src/main.ts` (1879 → 1983 lines):

**New**
- `LENGTH_FIELDS`: the seven length inputs with `minM` / `stepM` read from the HTML at load. The HTML must keep those attributes in metres.
- `fieldUnit`: the unit the fields currently show.
- `trimNoise(v)`: rounds to 6 decimals.
- `fieldMeters(input, unit): number` and `setFieldMeters(input, meters, unit)`: the one read and write path for length fields.
- `syncLengthFieldLimits(unit)`: sets `min` / `step` per unit.
- `convertLengthFields(from, to)`: converts non-empty fields, then syncs limits.
- `exitRoomTool(): boolean`: clears `drawSession`, sets mode `room`, calls `setToolButtons(null)`.
- `isTypingTarget(target): boolean` with `NON_TYPING_INPUT_TYPES`: the shared key guard.

**Edited**
- `syncOpeningDefaultsFromType`, `readOpeningParamsMeters`: use the two field helpers.
- `renderRoomUi`: sets `disabled = !has` on `#btn-save-template-scratch` and `#btn-clear-room`.
- `setWorkspace`: computes `changed` first; the Room branch calls `frameRoom()` only when `changed`. Still sets mode `room` unconditionally when a room exists. Catalog branch untouched.
- `onCreateRoom`: size always comes from the fields; the preset only supplies the name.
- In `boot()`:
  - ingress handler calls `setWorkspace('room')` only when `workspace !== 'room'`;
  - preset `change` handler writes through `setFieldMeters`;
  - new `input` listeners on length, width and ceiling set the preset to `custom`;
  - units `change` handler converts instead of resetting the opening fields;
  - the three tool handlers read the mode first, then switch workspace only if needed (kept as three handlers);
  - `keydown` returns early on `isTypingTarget`, then handles `Escape`;
  - end-of-boot seeding sets `fieldUnit` and the limits.

## 3. User-facing strings

None added or changed.

## 4. Test results

- `tsc --noEmit`: exit 0.
- `vitest run`: 66 passed, 18 files.
- E2E with `--workers=1`: **14 passed** in 2.6 min (9 existing, unedited, plus 5 new).
- E2E with the default 5 workers, at load average about 104: 7 failed, 7 passed. Six were existing specs timing out on `page.screenshot` or a 5 s poll. The seventh was my camera test, which I then fixed (see section 5).
- The new spec run read-only against the unfixed original on 18767: all 5 fail, each on its own defect.
- `vite build` was not run.

## 5. Not in the handoffs, and what I am unsure about

**Decisions that go beyond the handoff**
- **The key guard is narrower than "any input".** With the literal guard, Esc and Cmd+Z did nothing while the "Snap placement to nearest wall" checkbox had focus (measured: 2 → 2). So checkbox, radio, button, submit, reset, file, range, color and image inputs do not count as typing targets. To go back to the literal list, replace the body of `isTypingTarget` with one `closest('input, select, textarea, dialog')` check.
- **The guard also ignores keys from inside any `<dialog>`.** This anticipates the confirm and help dialogs; none exists yet, so it is untested.
- **Feet limits are my default.** `min` is the metric minimum in feet rounded down to 2 decimals (1.64, 0.16, 0.65, 0) and `step` is `any`, so spinner arrows move by 1 ft. Centimetres are the metric values × 100.
- **Values the code writes are trimmed to 6 decimals.** A 3 m preset in feet shows 9.84252 (it was 9.84251968503937).

**Behaviour that changed as a side effect**
- Re-clicking "Room workspace" while already there no longer re-frames the camera. "Reset camera" still does.
- Tool and ingress clicks inside Room no longer run the `scrollIntoView` in `setWorkspace`.
- An ingress tab clicked inside Room no longer switches the active tool off.
- A unit switch keeps hand-typed opening sizes; it used to reset them to the door or window defaults.

**Findings**
- **The camera keeps drifting after a drag under SwiftShader.** With no click at all, a 100 px drag read 37.8° at release and 67.6° four seconds later, still moving. So:
  - the QA handoff's "51.8°" was a mid-drift reading;
  - the QA probe's post-fix "49.1° → 54.9°" is drift, not a reset;
  - its ingress reading is pinned at 90°;
  - any "less than 1°" check has to wait for the camera to stop.
  
  My spec handles this by running `controls.update()` 400 times before reading. Not measured on a real GPU.
- Code-read only, not run: the Units `change` handler updates `roomGraph.display_unit` in memory without persisting it. This was already so.

**For the next host agent**
- The new spec types into `#room-length` while a preset is selected, as UX-01's done-when requires. UX-08 item 4 would hide that field unless the preset is Custom; one of the two has to give.
- The spec pins the exact `min` / `step` strings of the seven fields.
- The spec reads `viewer.camera` and `viewer.controls` like the existing specs do, and expects Product → Room to return to the arrival view within 0.15 m. If the engine agents change `frameRoom`, re-run it.

**Not checked**
- Anything outside headless Chromium.
- `:where()` support in other browsers.
- Form-state restoration in a normal browser session (a Playwright reload restored nothing).

Evidence and a running note are in `<scratchpad>/h1/`; start with `PROGRESS.md`. The pre-edit copies of the three files are in `h1/snapshot-before/`.
