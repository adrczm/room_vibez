# Known gaps

Plainly: what is unfinished in this repository, what is known to be imperfect, and what nobody has checked. Items marked *6b*, *7* or *8* belong to the waves that were skipped on the owner's instruction; the specifications for them are in `handoff/fixes/`.

## Unfinished work (skipped waves)

**Messages (6b).** The engine side and the word mapper (`src/errors.ts`) exist and are unit-tested, but most of the host does not call them yet. So:
- Many error messages after a failed upload, import or placement are still the engine's raw text.
- Nothing tells the user when the browser blocks saving; the help pop-up therefore keeps the interim sentence "your room only lasts while this tab is open".
- A saved room that cannot be read is dropped at boot without a message (the engine moves it aside, but the host does not say so or offer a download).
- A random file named `.dwg` still gets the sample result; the file check exists but is not called.
- The `.mjs` confirm is the browser's native dialog, with the deck's wording.
- Validation errors for the room size do not name the field.
- Long unbroken names (a 64-character template title) push row buttons off-screen.
- Errors are told apart from status only by colour, and announced politely, not as alerts.
- Plurals in the room summary still read `opening(s)` / `placement(s)`.

**Targets and accessibility (7).**
- Controls under 32 px remain (the segmented buttons at 31 px, one summary at 17 px); nothing is 44 px on touch except the swatches, the picker and the **?**.
- The 3D canvas has no `tabindex`, role or label; radio groups have no arrow-key support; two focus-ring styles; input borders at 1.61:1 against a 3:1 target; the pressed tool-button text at 4.24:1 against 4.5:1.
- 33 px of horizontal overflow at 320 px wide.
- On a phone the 3D view scrolls away while you use the Place products step, so "Add to room" acts on a view you cannot see. The sticky stage that would fix it was part of this wave.
- No hover or active states beyond buttons; spacing, radius and weight tokens were not normalised.

**Verification and record (8).** The 72-gate checklist has no "after" values; the QA audit scripts were not re-run on v2; no independent review of the whole diff was made; no completion report was written beyond the handoff files.

## Known imperfections in what was built

- On narrow screens the 3D view's toolbar wraps to two rows and covers the top of the product.
- With a classic 15 px scrollbar (as in some desktop browsers) the room toolbar wraps, putting *Import project* on its own row.
- After *Create room* the stepper opens *Openings*, so the first product takes four clicks against the handoff's target of three.
- Uploaded models and packs allow every material on every slot, so with names under the swatches their Materials card is very tall (an upload with two slots: 809 px).
- On a phone the bottom of the Materials card sits at 1.59 screens from the top against a target of "about 1.5".
- The product picker shows no thumbnail until the pop-up has been opened once; rendering at load blocked the page for over two seconds in testing.
- Arrow keys move a selected product along the room's axes, not the screen's; after orbiting to the far side they run against what you see. There are no on-screen move buttons, so a product cannot be moved on a touch screen.
- The Product panel is 1103 px tall against a target of about 1000.
- Some help text is dated but not false ("Choose a product from the list"; no mention of Add to room or the steps).

## Not verified by anyone

- **People.** No usability test has been run. Severities, step counts and design defaults are expert judgement. The plan for a test is in `handoff/fixes/usability-test-plan.md`.
- **Screen readers.** Only DOM facts (roles, names, live regions) were checked.
- **Safari, Firefox, Windows, Android, iOS, real phones.** Chromium only; phone sizes are Chrome's touch emulation.
- **Real GPU.** All interaction tests ran on software rendering. One look on an Apple M1 Pro after wave 3 is recorded in `handoff/fixes/v2-wave1-handover.md` §11.
- **Real DWG or DXF files.** The project has none; the plan-file check was written from the format's documented header and tested with synthetic files only.
- **The `.mjs` and pack flows** beyond unit tests; **concave rooms** in a browser; performance on large rooms.
