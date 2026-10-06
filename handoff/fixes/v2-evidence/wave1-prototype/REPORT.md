# Final report: planner prototype, Copy Phase 5

Phase 5 is applied in full to `/Users/adrian/Desktop/Room Vibez/v2/prototypes/room-vibez-planner-flows/` (`index.html`, `app.js`, `styles.css`), and every bullet is verified in real Chrome by file URL. The original `prototypes/room-vibez-planner-flows/` is byte-identical to the pristine copy.

After the resume I re-read all three files (no half-finished edit) and loaded the page: 0 page errors and 0 failed requests. The only console output was warnings: a Three.js deprecation notice plus software-GL messages from headless Chrome.

Three things need the merging session's decision; they are flagged as **Decision** below.

## 1. Per Phase 5 bullet

All checks are in `$S/proto/verify.mjs` (120/120 passed on the final files) unless another script is named.

| Bullet | Status | How |
|---|---|---|
| Deck §6.1 visible copy | Verified | 107 of 114 new or changed strings are word for word in deck §5 to §7 (`strings-diff.mjs`); the other 7 are in section 3. |
| Deck §6.2 toasts | Verified | Every toast was triggered and compared: all 9 finishes, 3 lighting, 3 render styles, 3 exports, and 3 forced 3D failures (CDN blocked, renderer throws, no context). |
| Research labels and disabled controls removed | Verified | Label matches in `document.body.innerText` across the five screens: 17 before, 0 after. Disabled research controls: 7 before, 0 after (`labels-count.mjs`). |
| Vocabulary | Verified | *BOM* appears once, in the reseller card. No *Cart* or *furniture*. One *Draw it myself* button; `#btnManualOnly` is deleted. |
| Three state bugs | Verified | See section 2. |
| Upload zone | Verified | Label is `Choose a file` with no "Drop". Enter and Space now open the picker (A1; both failed on pristine). |
| *Start over* | Verified | A `<dialog>` with the deck §5 words, e.g. `This clears your project and 4 placed items.` Esc and *Keep working* keep everything and return focus; confirming clears the project. The page button is no longer `primary` (white). The confirm button is `rgb(139, 58, 47)`; focus starts on *Keep working*. |
| Render style (§7 default 3) | Verified | Control kept, with the toast `Render style set to Contrast+. It doesn't change the image yet.` |
| Total line | Verified | `Total (placeholder prices): €856` in both the sidebar and the full screen. |
| **?** pop-up (deck §6.3) | Verified, keyboard only | Tab reaches it in one press and Enter or Space opens a modal. Arrow keys, Home and End move through the four tabs, and Tab stays inside. Esc and its Close button close it with focus back on the **?**. All 7 paragraphs and bullets match the deck. It fits at 375 px. Plain JS, nothing from the viewer. |

Brand, title and the honesty labels are unchanged and visible. The ids the audit script uses (`#btnSkipDemo`, `#btnOpenBom`, `#btnRestart`, `#rolePill`) are kept.

## 2. The three state bugs

All three reproduced on the pristine copy and are fixed on v2 (`repro-base.mjs`; results in `$S/proto/out/repro-base.json` and `repro-v2.json`).

| Bug | Pristine | v2 |
|---|---|---|
| "I've checked the dimensions" (R2) | After a new chip or a new file, the box stays ticked and the confirm button stays enabled. | Unticked and disabled at once, and still so when the new result shows. |
| *Skip to a demo project* (K3) | Consumer, Architect, Reseller and no role all become Interior designer. | Each chosen role is kept. With no role it becomes Interior designer and a toast says so. |
| *Add starter products* (A9) | Item count over five clicks: 0, 2, 3, 4, 5, 6. | 0, 2, 2, 2, 2, 2. The button reads `Starter products added` and is disabled. |

## 3. Strings

**Written by me, not in the deck**
- `No role picked, so the demo opens as Interior designer.` Phase 5 asks for this toast; the deck has no words for it.
- `This clears your project and 1 placed item.` The singular of the deck sentence, via `Intl.PluralRules`.
- Dialog title `How this works` (the deck §7 tooltip string, reused), close button `Close` with aria-label `Close help` (the copy handoff's Phase 2 wording).
- aria-labels `Tools and products`, `Finishes and parts list`, `Parts list and SKUs`, replacing ones that said *catalog* and *BOM*.

**Deck strings changed or not used**
- **Decision:** `Live stock` / `Not available yet` is not used. Phase 5 and the brief say to remove the disabled ERP control; the deck relabels it instead. I removed it. Restoring it is four lines of HTML.
- No deck string was reworded.

**Where the deck was wrong or silent**
- §6.3 says "The chips at the top show where you are." The editor screen (step 4) has no chips. Copied as written.
- The architect card heading `Architect · DWG hybrid` is not in the deck. I left it and put the deck sentence in the paragraph.
- The role pill labels `Consumer` and `Reseller / ops` are not in the deck. Left unchanged, so they no longer match the new card titles.
- `Drawing from scratch.` also shows after *Skip to a demo project*, where a template chair is already placed. Flow unchanged from pristine.
- With the pre-filled project name removed, an empty name shows the existing fallback `Untitled`.
- **Decision:** deleting `#btnManualOnly`, as the deck says, means *Draw it myself* is only reachable after a file type is chosen. Before that the plan screen offers only the four chips and *Back* (measured).

**Decision: three fixes beyond the letter of Phase 5.** Each is small and the new copy depends on it; revert any you do not want.
- The toast sat inside the editor stage, so toasts fired on other screens were never visible (pristine: zero client rects on the parts list). Without this the export buttons lose their "(stub)" label and show nothing. It is now one fixed-position toast for all screens.
- Clicking a file-type chip also opened the OS file picker (reproduced on pristine). Guarded, since the new label says "Pick a type to see the flow."
- The 3D caption sat at the bottom of the stage, below the window at 1280×800 (pristine: y = 904 to 953). It now uses the 2D hint's chip and corner, and is inside the window at both sizes.

## 4. The four checklist observations

| Observation | Status |
|---|---|
| Badge contrast 4.39:1 | Fixed with one token: `--warn` `#8a6a1f` → `#7a5d1a`, 5.36:1 by my calculation. The audit now reports no non-disabled failures. |
| 502 px layout under 375 px | Fixed with `flex-wrap` on `.topbar`. Plain 375 px viewport: overflow was 127 to 140 px on every screen, now 0. Mobile emulation lays out at 375, not 502. |
| Three third-party hosts | Unchanged: `fonts.googleapis.com`, `fonts.gstatic.com`, `unpkg.com`. |
| Uneven type scale | Not addressed. Counts are unchanged at 6 (sign-up) and 9 (editor). |

## 5. Audit script, before and after

Before is `fixes/qa-evidence/out/prototype-results.json`; after is `$S/qa-out-proto/prototype-results.json`. No script errors.

| Measure | Before | After |
|---|---|---|
| Sign-up contrast failures (all / not disabled) | 3 / 2 | 1 / 0 |
| Editor contrast failures (all / not disabled) | 5 / 1 | 0 / 0 |
| Parts list contrast failures (all / not disabled) | 2 / 1 | 0 / 0 |
| Sign-up font sizes | 6 | 6 |
| Editor font sizes | 9 | 9 |
| Parts list font sizes | 7 | 8 |
| Sign-up targets (total / under 44 px / under 24 px) | 7 / 3 / 0 | 8 / 4 / 0 |
| Editor targets (total / under 32 px) | 24 / 0 | 22 / 0 |
| Sign-up tab stops | 6 | 7 |
| *Start over* class and background | `primary`, green | none, white |
| Role pill after skip with no role | Interior designer | Interior designer, now with a toast |
| Mobile layout viewport | 502 × 1087 | 375 × 812 |
| External hosts | 3 | 3 |
| Page errors, failed requests | 0, 0 | 0, 0 |

- **Parts list 7 → 8:** the eighth size is the toast, which the audit now catches on that screen 500 ms after opening. It is 7 once the toast fades (measured), and the toast's size is unchanged.
- **Targets and tab stops +1:** the added one is the **?** button, 32 × 32 px.

## 6. Not checked, and left alone

- **Cannot be checked here:** screen readers, Safari, Firefox, Windows, real phones and touch input. Everything ran in headless Chrome with software rendering.
- **Native file dialog:** the tests see the file-chooser event, not the dialog itself.
- **Not addressed, because Phase 5 does not list them, and not re-tested by me:**
  - State leak from template to blank project (K2).
  - Very long project names (C4).
  - Wrong file types getting a result (R4).
  - No URL per screen (A6).
  - Role cards without `aria-selected`.
  - The upload zone being a `role="button"` that contains buttons.
- **Stress script:** `docs/stress-test/stress-prototype.mjs` clicks `#btnManualOnly` and reads old labels, so it will fail if pointed at v2. I did not run it.
- **No `<dialog>` fallback:** on a browser without `showModal`, the **?** and *Start over* do nothing.

Screenshots (34: five screens, four **?** tabs, the *Start over* dialog and toasts, at 1280×800 and 375 px) are in `$S/proto/shots/` for the merging session to copy. Scripts are in `$S/proto/`, and the running note is `$S/proto/PROGRESS.md`.
