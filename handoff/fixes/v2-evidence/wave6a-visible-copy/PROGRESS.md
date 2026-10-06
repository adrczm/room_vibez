# H6a (copy pass, first half) — running note

Started 2026-10-06. Works directly in v2/hackathon-3d-viewer. Snapshot of the start state: $S/base-w5/.

## Plan / order
A. copy.ts notInDeck additions  B. index.html (data-copy attrs, pins, removed paragraphs)  C. main.ts
D. styles.css  E. help-content.ts (task 3)  F. specs  G. measure, screenshots, full e2e, build

## Status
- [ ] read docs (done), baseline measurements
- [ ] §3.1  - [ ] §3.2  - [ ] §3.3 (was done in wave 2)  - [ ] §3.4  - [ ] §3.5  - [ ] §3.6
- [ ] Phase 2 wiring (initHelp, ? button, Why? x3)
- [ ] Task 3 help sentences
- [ ] QA-10  - [ ] QA-14
- [ ] new specs  - [ ] measurements  - [ ] screenshots  - [ ] full e2e + build

## Decisions so far (to report)
- Static strings: index.html elements carry data-copy="group.key" (also data-copy-title / -aria-label / -placeholder); main.ts fills them at boot from src/copy.ts. index.html keeps only <title>, .brand and "Loading…" as pre-script text.
- Scope line with 6b: I do every §3.1–§3.6 label and the state lines drawn by renderImportReview / renderTemplateList / renderUnderlayReview (job status, scale status, template count, trace note). NOT done (6b): #room-status summary with a room (renderRoomUi), all §4 messages, slot warnings, pack panel, renderUserMaterials.

## Checkpoint 1 (app loads, tsc 0, no console errors)
DONE in code (not yet e2e-verified):
- copy.ts: 13 new notInDeck strings under "Copy pass, host wave 6a" (roomStatusEmptyBelow, unitsLabel, presetLabel, stageRegionLabel, ingressGroupLabel, openingTypeLabel, planImagePreviewLabel, planPreviewLabel, templatesListLabel, userMaterialsListLabel, planLabel, slotSwatchesLabel). NOTE: the #import-oda-note technical sentence canNOT live in copy.ts (tests/unit/copy.test.ts forbids team words there) -> stays literal in index.html inside the collapsed details.
- index.html: all static text -> data-copy / data-copy-aria-label / -title / -placeholder / data-unit-label. 5 paragraphs + 3 sub-heads removed. #import-oda-note is now a div (nudge + Why? + <details class="disclosure technical">). #import-extract-banner is a div. New: #parts-note (+Why?), .ingress-badge, .list-nudge, #import-*-heading ids. QA-14: aria-labels dropped on every input/select that has a visible label.
- main.ts: copyAt, richNodes, initStaticCopy, syncUnitLabels, setStatus (friendlyError 'boot'/'product-load'), whyLink, renderImportBanner, candidateRow (two buttons Included / Left out, fixed labels), candidateControlKey, renderImportReview rewritten, renderTemplateList (use-template data-action, deck row/count), renderUnderlayReview (traceNote), renderOpeningList (notInDeck.openingListRow), setWorkspace hints, product meta, slot meta removed, swatch tooltip + group label from copy, presets labels, product option label, Default option, initHelpUi (initHelp + ? button + Why? delegation), boot wiring.
- styles.css: .overlay-message, .why-link, .card-note, .technical-body, .ingress-badge, .import-note, .candidate-toggle, banner variants; .slot-meta rule removed.
SEAMS left for 6b (commented "SEAM" in main.ts): renderRoomUi room summary with a room; renderSlots innerHTML (escape) + "Pack / module keeps…" warning; initHelp storageFailureIsSurfaced:false.
TODO: help-content task 3; specs (edit dwg-plan-import selector; new copy-pass spec; unit staticCopy test); QA-10 measure; measurements; screenshots; full e2e; build.

## Checkpoint 2 (01:25) — tsc 0, unit 340/340 (336 + new staticCopy.test.ts 4), copy-pass.spec.ts 14/14
- help-content.ts: ONE sentence changed (Room tab): "To move something, delete it from the list and place it again." -> "…select it in the list and use the arrow keys." (e2e proves row select + arrow keys: placed-products.spec.ts ~510). All other help sentences read against the app: none plainly false.
- Spec edit: dwg-plan-import.spec.ts selector -> button[data-action="use-template"] (the one permitted).
- New: tests/unit/staticCopy.test.ts (4), tests/e2e/copy-pass.spec.ts (14).
- Banner line is chosen by job.source.kind (mock_fixture -> notInDeck.sampleBannerBuiltIn; dwg/dxf -> deck sampleBanner; json -> no line, technical only).
- Measured (out/measure.json, out/topbar-after.json): top bar 86.58 px both workspaces at 721..1920; 156.52 at 375 (fine pointer), 172.52 at 375 touch (? is 44 px there). Was 86.58/102.77 and 148.8/165. Vocabulary: Product 6 matches (all STUB-… SKU line + Parts list JSON incl. "stub": true), Room empty 0, Import review 0, Room+product 0. Word count: deck's 10 lines = 92 (91 + the Parts-list "Why?"); before 304. 29 aria-pressed buttons, none renamed. F5: 0 mismatches.
- RUNNING: full e2e -> out/e2e-full-1.log. Do not edit src/ or index.html while it runs.
TODO after: screenshots (shots.mjs), build check, final report. Possible: FOUC note (labels empty until script runs).

## Checkpoint 3 (01:38) — tsc 0 · unit 340/340 (30 files) · build OK (same 2 warnings) · copy-pass 14/14 · panel-structure 9/9
- First full e2e (out/e2e-full-1.log): 73/74. The one failure was a PRECONDITION in panel-structure.spec.ts:170 (scroll the Room panel by 60 before switching back): with the diet the Room/no-room panel is exactly 781 px = the panel at 1440x900 and cannot scroll. Spec edited: opens Import plan + Try the sample plan first (panel then 1733 px); the assertion itself is unchanged. REPORT THIS as an existing-spec edit outside the "old visible text" category.
- Added after that run: ? button strings re-applied from copy.topBarAndStage in initHelpUi; e2e for the image ("Trace over your image") form; overlay screenshots (shots/1280-30..33, 375-32).
- Screenshots done: $S/h6a/shots/ (38 + 5 overlay).
- Panel scroll height 1440x900 (overlay scrollbars): Product 1103 (was 1144), Room/no room 781 = fits (no scroll), import tab 827, sample review 1733.
- RUNNING: final full e2e -> out/e2e-full-2.log
REMAINING: read e2e-full-2 result; final report. Nothing else planned in src/.

## DONE (01:55) — final state
tsc 0 · unit 340/340 (30 files) · build OK · e2e 74/74 --workers=1, 6.9 min (out/e2e-full-2.log).
Files changed vs base-w5: index.html, src/main.ts, src/styles.css, src/copy.ts (12 notInDeck strings), src/help-content.ts (1 sentence + header note), tests/e2e/dwg-plan-import.spec.ts (1 selector), tests/e2e/panel-structure.spec.ts (1 precondition), NEW tests/e2e/copy-pass.spec.ts (14), NEW tests/unit/staticCopy.test.ts (4).
Measurements: out/measure.json, out/topbar-after.json, out/before.json. Screenshots: shots/.
Nothing left in progress. Next agent (6b): see the "SEAM" comments in src/main.ts.
