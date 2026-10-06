# H6a report: copy pass, first half (Copy Phases 1 and 2, QA-10, QA-14)

Everything in this half is implemented and verified in the real app. Final state of `v2/hackathon-3d-viewer`: `tsc --noEmit` exit 0 · unit 340/340 · e2e 74/74 · build OK. The original app on 18767 was not touched.

## 1. Status per item

**Copy Phase 1** — all verified by `tests/e2e/copy-pass.spec.ts` unless noted.

| Step | Status | How |
|---|---|---|
| 1 Static paragraphs | verified | 5 paragraphs removed, plus the 3 sub-heads under the start tabs (deck §3.5); 9 shortened; Parts list note added. Exact text asserted; the removed five are absent from `body.textContent`. |
| 2 Badges, headings, labels, options | verified | Preview, Placeholder, Sample only, Materials, Lighting, Walls / Floor, Use as / Add to material, Neutral; units, preset, texture options. Handover §10–§13 leftovers included (`#placement-list` is now "Products"). |
| 3 Fixed tool labels | verified | `copy` is the single source: the three buttons are empty in `index.html`, `initStageUi` fills them. |
| 4 Unit labels | verified | New `syncUnitLabels(unit)` at boot and on `#room-units` change. 7 labels read (m) / (cm) / (ft). |
| 5 Banner pin | verified | `#import-extract-banner` is a `<div role="status">`: friendly line, **Why?**, original string in a collapsed *Technical details*. `toContainText('mock_fixture')` and `('ODA available: no')` pass while `innerText` has neither. |
| 6 `#import-oda-note` pin | verified | Now a `<div>`: nudge, **Why?**, pinned sentence unchanged in a collapsed *Technical details*. |
| 7 Template button | verified | `Use template`, `data-action="use-template"`; row and count are the deck's. |
| 8 Overlay errors | verified | Three e2e cases, plus real Chrome launched with `--disable-gpu --disable-3d-apis`. `setStatus` uses `friendlyError(…, 'boot' | 'product-load')`; no raw error text shown. |
| 9 `#btn-remount` | verified | "Restart 3D view" with the deck tooltip; id kept. |
| 10 Candidate toggle | verified | Built as two buttons per row (see §3c). Keyboard focus survives the redraw. |

**Copy Phase 2 acceptance** — verified at 1280×800 and 375×812.

- **Opens / never by itself:** yes. The button is last in `.topbar`, 28×28, 16 px from the right edge, with the deck's `aria-label`, tooltip and `aria-haspopup="dialog"`.
- **Closes three ways:** Esc, close button, backdrop click. A click inside does not close it.
- **Traps focus:** `:modal`; 12 Tab presses never land on a page control.
- **Returns focus:** to **?**, and to each **Why?** link.
- **Right tab:** first-ever open is *Start here*; after that Product → *Product*, Room → *Room*.
- **Deep links:** import nudge → Room tab `#import-plan`; sample banner → Files & saving `#plans`; Parts list note → Product tab.
- **375 px:** Topic select replaces the tabs; page and dialog overflow are 0 on all five topics.
- **Other:** interim "blocks saving" sentence shown (`storageFailureIsSurfaced: false`); *For developers* collapsed; top bar still wraps at ≤ 720 px. The optional unseen dot is not enabled.

**Task 3 (help sentences)** — verified. One sentence was plainly false and was changed (§3b). I read all five tabs against the app and found no other false sentence.

**Task 4 (QA-10)** — verified; no height reservation needed, the Room hint is one line at every width measured.

**Task 5 (QA-14)** — verified. The audit's F5 logic returns 0 mismatches; `toHaveAccessibleName` passes for the five file inputs; the `#texture-target` picker trigger is named "Add to material …".

**Task 6** — measured, below.

## 2. Measurements

**Top bar height (px), Product / Room, with the ? in place**

| Width | Before | After |
|---|---|---|
| 1440, 1024 (same at 721–1920) | 86.58 / 102.77 | 86.58 / 86.58 |
| 375, fine pointer | not measured | 156.52 / 156.52 |
| 375, touch (the ? is 44 px there) | 148.81 / 165 | 172.52 / 172.52 |

On a phone the top bar is now 23.7 px taller in Product than before, because of the 44 px **?**.

**Word count** (deck §8 tokenizer)

| Set | Before | After |
|---|---|---|
| Deck's 14 paragraphs → the 10 lines that remain | 304 (C11, original app); 298 by my count on the wave-5 snapshot | 92 |
| Sidebar subset | 285 (C11); 282 by my count | 77 |

The deck's "91" counts the **Why?** in the import line only; Phase 2 adds one to the Parts list note, hence 92.

**Vocabulary regex on `document.body.innerText`**

| State | Matches | Source |
|---|---|---|
| Product, default | 6, all `stub` | `STUB-SKU-CHAIR-001` in `#product-meta` (deck §3.4 keeps it); 5 lines of the Parts list JSON: `"stub": true`, `productSku`, three `materialSku` (deck §10 keeps the JSON unchanged) |
| Room, no room | 0 | |
| Import plan review, sample | 0 | With *Technical details* opened by the user: 4 (`fixture` ×2, `Candidates`, `mock`), all from the engine string the pin requires |
| Room with a room and a placed product | 0 | |

`createAsset` from the deck's "Not a pack" sentence does not occur in these states. `opening(s)` and `placement(s)` are still in the room summary (left for 6b).

**`button[aria-pressed]`:** 29 buttons seen across 8 state snapshots, 0 renamed.

**Also measured**
- Panel scroll height at 1440×900: Product 1103 px (was 1144; the "≲ 1000" target is still not met). Room with no room is 781 px and now fits without scrolling.
- Labels are filled about 10–15 ms after first paint in dev (2 of 3 runs).

## 3. Strings and deck issues

**(a) Not in the deck — 12 new `notInDeck` strings**
- `roomStatusEmptyBelow`: "No room yet. Pick a way to start below."
- `unitsLabel` "Units", `presetLabel` "Preset" (today's labels; the deck lists only their options)
- `stageRegionLabel` "3D viewer", `openingTypeLabel` "Opening type", `planLabel` "2D plan", `slotSwatchesLabel` "{part} materials" (today's `aria-label`s, kept)
- `ingressGroupLabel` "Way to start" (was "Room create path")
- `planImagePreviewLabel` "Preview of your image" (was "Underlay preview")
- `planPreviewLabel` "Plan preview" (was "Plan preview + candidates")
- `templatesListLabel` "Templates" (was "Room templates")
- `userMaterialsListLabel` "Materials you added" (was "Session materials")

One sentence is a literal in `index.html`, not in `copy.ts`: the pinned "ODA / APS not available here — DWG/DXF use a clearly labeled mock fixture extract, not real entity parsing." `tests/unit/copy.test.ts` forbids team vocabulary in `copy.ts`, and unit tests may not be edited.

**(b) Deck strings changed, and why**
1. Help, Room tab: "To move something, delete it from the list and place it again." → "To move something, **select it in the list and use the arrow keys**." A placed product can now be moved; `placed-products.spec.ts` proves row-select then arrow keys.
2. §3.1 #14: "…Pick a way to start **above**." → "…**below**." Since UX-08 the line sits above the start tabs. The deck key is untouched and unused.
3. §3.4 `#model-files` `aria-label` ("unchanged" in the deck): removed, as QA-14 requires. `productCard.addModelAriaLabel` is now unused.

**(c) Deck wrong or ambiguous, beyond handover §9**
1. Candidate toggle "(with `aria-pressed`)" contradicts §3.6 and Copy §8 (fixed labels). I built two fixed-label buttons, Included and Left out, with the pressed one as the state. **This changes each row from one button to two.**
2. §3.4 says slot meta "moves to the swatch tooltip" but also "Swatch tooltip (unchanged)". I removed the meta line and left the tooltip as it was.
3. §3.5 removes the "Import plan" sub-head but keeps its badge. The badge now stands alone at the top of the form. "Sample only" also overstates: images are really traced.
4. Phase 2 names two anchors for three **Why?** links without assigning them. My mapping is in §1.
5. Sample banner (extends §9 item 2): the line is chosen by `job.source.kind`. A DWG or DXF upload gets the deck line; *Try the sample plan* gets `notInDeck.sampleBannerBuiltIn`; a JSON plan gets no friendly line, only *Technical details*, without caution colours.
6. The "91 words" figure (see §2).
7. Help text that is dated but not false, left as is: "Choose a product from the list" (it is now a picker); no mention of Add to room, Rotate, the steps or Advanced.
8. The new help sentence cannot be followed on a touch-only device (there are no nudge buttons).

§9 items 3, 5, 6, 9, 10, 12 are kept as the deck has them and stay on Adrian's list.

## 4. Specs

**Existing specs edited**
- `dwg-plan-import.spec.ts`: `button:has-text("Instantiate")` → `button[data-action="use-template"]` (the permitted edit).
- `panel-structure.spec.ts`, "Product on arrival at 1440×900…": **this edit is outside the "old visible text" rule.** The test scrolls the Room panel by 60 before switching back, but with the shorter copy that panel can no longer scroll. I added three lines that open Import plan → Try the sample plan first. The assertions are unchanged.

**New**
- `tests/e2e/copy-pass.spec.ts`, 14 tests:
  - the pop-up (3): open and close, focus, tab per workspace; the three **Why?** links; 375 px
  - the two honesty pins, including DWG, JSON and image uploads
  - QA-10 at three widths (3)
  - QA-14
  - unit labels
  - static words, removed paragraphs, the vocabulary regex in four states, Included / Left out
  - swatches keep their names
  - the three overlay errors (3)
- `tests/unit/staticCopy.test.ts`, 4 tests: every `data-copy*` key in `index.html` resolves in `copy.ts`; no visible words typed into the markup.

## 5. Left for 6b

Seams are marked `SEAM` in `src/main.ts`.

- **`renderRoomUi`:** the room summary with a room is still today's string (`opening(s)`, `placement(s)`, provenance). Two specs pin "5.00 m × 4.00 m" and "6.00 m × 3.00 m" there.
- **`renderSlots`:** the `innerHTML` template (escaping) and the "Pack / module keeps…" warning.
- **`initHelpUi`:** `storageFailureIsSurfaced: false`.
- **Untouched:** every `roomStatus.textContent = …` message, all `String((err as Error)?.message ?? err)` sites, `renderWarnings`, `renderPackParams`, `buildParamField`, `onPackParamChange`, `renderUserMaterials`, the model, pack, module and texture status lines, the `#btn-import-plan` handler messages, long-name wrapping, Copy Phase 4.
- **Done here although Phase 3 lists "§3.5 status rows":** job status, scale status and trace note (in `renderImportReview` / `renderUnderlayReview`), and the template count (in `renderTemplateList`). The Import review measurement needed them.
- **New in `main.ts`:**
  - `copyAt(path)`
  - `richNodes(segments)`
  - `initStaticCopy()`
  - `syncUnitLabels(unit)`
  - `setStatus(status, detail?, where = 'product-load')`
  - `whyLink(target)`
  - `renderImportBanner(banner, job)`
  - `candidateRow(kind, id, text, accepted)`
  - `candidateControlKey(el)`
  - `initHelpUi()`
- **New DOM hooks:** `data-copy`, `data-copy-aria-label`, `data-copy-title`, `data-copy-placeholder`, `data-unit-label`; `.why-link[data-help-anchor|data-help-tab]`; `#parts-note`; `details.disclosure.technical > .technical-body`; `#import-extract-banner[data-kind]`; `li[data-candidate-id] button[data-include]`.
- **For wave 8:** the `fixes/qa-evidence` scripts that read candidate rows as `li > button` need updating.

## 6. Results

| Check | Result |
|---|---|
| `tsc --noEmit` | exit 0 |
| `vitest run` | 340/340 (336 unedited + 4 new) |
| e2e, `--workers=1` | 74/74 in 6.9 min (60 existing + 14 new) |
| `vite build` | OK, same two warnings as before |

Files changed: `index.html`, `src/main.ts`, `src/styles.css`, `src/copy.ts` (`notInDeck` only), `src/help-content.ts` (one sentence and a header note), the two specs above, and the two new test files.

Everything is in `/private/tmp/claude-501/-Users-adrian-Desktop-Room-Vibez/7ac663fe-e0d6-4b3c-af69-487be083d847/scratchpad/h6a/`: screenshots in `shots/` (43 files; the five tabs, the three **Why?** deep links and the overlay errors included), measurements in `out/`, running note in `PROGRESS.md`.

## 7. Unsure, for Adrian or the orchestrator

1. **Two buttons per candidate row** is my reading of a deck contradiction. The alternative is one self-renaming button, which fails Copy §8.
2. **"above" → "below"** is a deck string changed on a visible line; the brief only named help sentences for this.
3. **Seven `aria-label`s beyond QA-14's six** were removed (`#texture-file`, `-category`, `-role`, `#room-units`, `#room-preset`, wall and floor selects). They were literals not in the deck, and each control has a visible label. Names are shorter, e.g. "Category" instead of "Texture category".
4. **`index.html` now has no labels before the script runs.** The alternative is a checked mirror of the text in the markup.
5. **The ? on touch is 44 px**, which costs 23.7 px of top bar on a phone. This is the Copy-versus-UX-12 size conflict the handover leaves for wave 7.
6. **Scale status with no hint** still says "Enter a length you know to set it", which the engine cannot honour (§9 item 3). Kept as the deck has it.
7. **Room names used as data** are still literals in `main.ts`: "Custom room", "Freeform room", "Room template", "Imported plan".
8. **Unused `copy` keys:** `helperLines.roomStatusEmpty`, `helperLines.stageHintDefault`, `productCard.addModelAriaLabel`, `notInDeck.placedProducts.duplicate`, `notInDeck.picker.triggerName`.
9. **Not checked:** screen readers, Safari, Firefox, real GPU.
