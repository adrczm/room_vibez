# H5 (host wave 5: catalog pickers) — running note

Work dir: `/Users/adrian/Desktop/Room Vibez/v2/hackathon-3d-viewer` (dev server :18777, do not restart).
Snapshot to diff or restore from: `$S/base-w4/`. Scripts + outputs: `$S/h5/` (lib.mjs, probe*.mjs, shots/).
RULE: never edit project files while a full e2e run is in progress (Vite reloads under the test).

## Status
- [x] read handoffs
- [~] Task 3 strings: `notInDeck.picker.allGroups` ('All'), `.groupTabsLabel` ('Category') ADDED to src/copy.ts
- [x] Task 1 UX-14 mount + thumbnails: IN PLACE and verified ad hoc (verify1/verify2/timing .mjs + .out.json)
- [x] Task 2 UX-15 material pickers + swatch names: IN PLACE, verified ad hoc (measure1.out.json)
- [ ] Task 4 wave-4 interplay (ownsArrowKeys now includes [aria-haspopup]; verify with real picker) -> verify3.mjs
- [~] Task 5 Picker §7 list: A2, keyboard, sync, upload, thumbnailUrl, 30 items both views, 375 list, remembered view, blocked storage, list draws nothing, contexts = DONE (see below). TODO: remount, invalidation, pack thumbnail, interplay.
- [ ] new spec tests/e2e/catalog-pickers.spec.ts; full e2e; build; screenshots; report

## Baseline numbers (measure0.out.json, wave-4 state, overlay scrollbars)
- 1440x900 Product: panel 103..884 (781), scrollHeight 1144, materials card 233..595 (362 tall), swatch rows 34 px each.
- 1440x900 Room, Place step open: panel 119..884 (765), sticky toolbar 46; step 228..884 (656 tall); picker 328; card 370..748 (378); Add to room 790..823; Place product 831..863.
  => budget before `#btn-place-mode` leaves the panel when the step heading is at the top (177): 72 px. Swatch names add ~105 px to the chair card (3 name lines + handles row wraps to 2). placed-products.spec.ts:304 asserts picker, #slots, Add to room, Place product all in viewport.

## main.ts so far
- imports: createThumbnailRenderer, loadProductRoot, ThumbnailRenderer, ThumbnailStats; buildMaterialItems, buildProductItems, createThumbnailPicker, PickerStrings, ThumbnailPicker
- state: productPicker, wallMaterialPicker, floorMaterialPicker, textureTargetPicker, thumbnails
- NEW: thumbnailRenderer(), requestProductThumb(id), showSelectedProductThumb(), invalidateProductThumb(id, redraw=true), invalidateThumbsUsingMaterial(id), resetThumbnails(), initPickers()
- CHANGED: populateMaterialSelects (+sync x2), syncMaterialSelectsFromGraph (+sync x2), refreshProductSelect (+sync), refreshTextureTargetOptions (+sync), ownsArrowKeys (+[aria-haspopup]), loadProduct (+showSelectedProductThumb after load), onPackParamChange (invalidate thumb, both branches), onAddTexture attach branch (invalidateThumbsUsingMaterial), boot (initPickers before populate), #btn-remount handler (resetThumbnails), import.meta.hot.dispose (thumbnails + pickers), window.__rv (+pickers(), +thumbnails())

## Decisions (report all)
- Thumbnail root via engine `loadProductRoot` (handles multi-file glTF resourceMap + module factory), not host `loadPlacementRoot`.
- Trigger image: selected product rendered after each loadProduct (not gated on ready; independent of view). Tiles: only on open in grid view. List view asks for none.
- Remount: thumbnails disposed + all picker images dropped; trigger redrawn by loadProduct; tiles on next open.
- Picker labels from copy: product 'Product'; wall copy.roomTools.wallsLabel 'Walls'; floor 'Floor'; texture target copy.productCard.textureAddToMaterialLabel 'Add to material'. Visible field spans still say "Wall material"/"Floor material"/"Target material" until the copy pass.
- Sublabel = copy.productCard.yourUpload = 'your upload' (lower case, as in copy.ts/deck).
- Group tab labels via copy.productCard.textureCategories (Wood, Textile, ...).

## Measured (SwiftShader, headless Chrome) — after the change
- THUMBNAILS WORK in the real app (real renders, default finish). First render 2.3-2.7 s (context + PMREM), later 0.29-1.0 s.
- A proactive render right after load blocked the main thread 2.35 s; a test saw `ready` 2.4 s late (probe2.out.json: 4.0 s vs 1.7 s).
  => CHANGED TO LAZY: nothing is drawn until the popup is first opened in the thumbnail view (`thumbnailsInUse`).
  After that, showSelectedProductThumb() keeps the trigger's image up to date (upload, select set in code, remount), unless the view is List.
  Trigger before first use = name only (styles.css hides the empty visual of the product trigger).
- Contexts (getContext patched): load 1 live; after grid open 2 live (viewer + 1 thumbnail), stays 2 after 22 renders.
- 30 products, thumbnail view first open: open() 3.2-3.6 ms; first frame 7-38 ms; first image 1.8-2.6 s (main thread blocked till then); 12 tiles on screen drawn after 7.7-8.4 s; second open (cached) 27 ms to 2nd frame. Tiles off screen are not drawn until scrolled to (22 of 30 after scrolling to the end).
- 30 products, list view first open: open() 3.2-3.3 ms; first frame 6-18 ms; second frame 46-60 ms; thumbnails() === null (no renderer, 1 live context).
- Search shows at >=16 items (component default, DT4 unvalidated): 30 -> shown; 14 materials -> hidden.
- A2 = [] in 5 states. Keyboard path OK. sync() OK. Upload shows "your upload". thumbnailUrl wins (0 renders).
- View remembered across reload for product and material (localStorage catalog3d.pickerView.product/.material = list). Blocked storage: no error, holds in session.
- 375x812: sheet 0..375 x 172..812, overflowX 0 closed/grid/list/after pick; list rows 44 px, 11 visible.
- Swatch names (measure1.out.json): Product 1440x900 card 362 -> 491 px (+129), all 3 swatch rows in view, panel scrollTop 0, panel scrollHeight 1144 -> 1274.
  Room Place step: step 656 -> 787 px (> 765 panel). New rule in initPanelUi: if #btn-place-mode is below the fold after the step-nearest scroll, scroll #product-picker-slot to the top (block start).
  1440x900: picker 171.., Add 763-796?, Place ..837 (re-measure after scroll-margin -6) all in view. 1280x800: Add to room cut by ~18 px (was fully visible before; Place was already cut).
- coarse pointer (isMobile): swatch 44x44, trigger 44.

## Extra code since first note
- main.ts: `thumbnailsInUse`, `belowTheFold(el)`, renderSlots (label.swatch-tile > button.swatch + span.swatch-name[aria-hidden]), initPanelUi step toggle (place: picker to top when buttons below fold); import readStoredView.
- styles.css: .swatch-tile, .swatch-name, coarse 44px swatch, .step-body .product-picker-slot scroll-margin-top -6px, product trigger hides empty visual.

## 00:25 — verified ad hoc (verify3, verify3b, verify4 .out.json)
- Remount: before 2 live contexts; after 2 live / 4 created; trigger image redrawn by a new renderer; frame stayed walnut; tiles redrawn on reopen; Room remount + wall picker OK.
- Invalidation: normal map added to wood-oak -> chair thumbnail redrawn (renders 2 -> 3, image changed). New colour texture appears in wall/floor/target pickers with a blob: swatch.
- Pack (models/core-rulebook-4aedc7 .mjs+.glb, sourceKind glb, mapping slots): thumbnail = its own model (green/gold). Colourway change does NOT change the thumbnail (drawn from the .glb). mjs-only module NOT exercised.
- Task 4 interplay: 11 keys inside product popup -> pose/selection unchanged; Esc closes popup only; ArrowDown/Up on trigger opens without nudge; Enter same item no change; Enter other product -> selection dropped by wave-4 rule (product change), pose unchanged; wall picker keys + Enter -> wall changed, product untouched; control nudge works with popup closed.
- NEW SPEC tests/e2e/catalog-pickers.spec.ts (12 tests). First run alone: 11/12 (the 1 failure was a wrong expectation in the spec, fixed).
- NEXT: full e2e (h5/e2e-full-1.log) — DO NOT EDIT PROJECT FILES WHILE IT RUNS. Then build, unit tests, screenshots (shots.mjs), OBJ upload thumbnail check, final report.

## 00:55 — full e2e run 1 (h5/e2e-full-1.log): 57/60, 7.6 min. Three failures in EXISTING specs:
1. placed-products.spec.ts:306 `#product-select` toBeInViewport ratio 0 -> REAL MOUNT DEFECT in component CSS: `clip-path: inset(50%)` on the hidden select makes IntersectionObserver see nothing (probe3.mjs: ratio 0 -> 1 without clip-path). FIXED in src/ui/thumbnailPicker.css (clip-path removed; opacity 0 stays). Test added in catalog-pickers.spec.ts (toBeInViewport on #product-select, #room-wall-material, #room-floor-material).
2. panel-structure.spec.ts:244 `slots.bottomScreens < 1.5` at 375x812 -> 1.585 (names + 44 px swatches + wrapped handles row make #slots 472 px tall, was ~303). NOT a mount problem. Top of #slots is at 1.005 screens. UNAVOIDABLE with names under every swatch; I DID NOT EDIT THE SPEC.
3. placed-products.spec.ts:388 precondition "card did change height" `> 20` -> 6.03 px (table-next vs chair-selected cards are now nearly the same height: both have 4 rows of tiles). Independent of tile metrics (algebra: diff = 6). NOT EDITED.
- Scratch copy with ONLY those two numbers relaxed (1.5 -> 1.7; 20 -> 2): panel-structure + placed-products 16/16 (h5/e2e-patched-1.log, h5/patched-root/). So nothing else in those tests fails.
- NEXT: verify5 (OBJ), shots.mjs, vitest, build, final full e2e on the unedited specs, final measure, report.
- 01:10 tsc 0, vitest 336/336, build OK. Final full e2e started (h5/e2e-full-2.log). DO NOT EDIT PROJECT FILES WHILE IT RUNS.

## 01:25 — FINAL STATE (all work done; report written from this)
- tsc 0 · vitest 336/336 (29 files) · vite build OK (same 2 warnings) · e2e FINAL (h5/e2e-full-2.log): 58/60 in 7.1 min, `--workers=1`.
- The 2 failing are EXISTING assertions invalidated by the swatch names (UX-15 step 6); I did NOT edit them:
  - panel-structure.spec.ts:244 `expect(slots.bottomScreens).toBeLessThan(1.5)` at 375x812 -> 1.585 (with this wave's additions switched off in the page: 1.366). Top of #slots: 1.004.
  - placed-products.spec.ts:388 `...toBeGreaterThan(20); // the card did change height` -> 6.03.
  - With only those two numbers relaxed in a scratch copy (h5/patched-root: 1.5 -> 1.7, 20 -> 2) both spec files pass 16/16 (h5/e2e-patched-1.log).
- New spec tests/e2e/catalog-pickers.spec.ts: 12/12.
- Files changed vs base-w4: src/main.ts, src/styles.css, src/copy.ts (2 strings), src/ui/thumbnailPicker.css (clip-path removed), tests/e2e/catalog-pickers.spec.ts (new). index.html NOT changed.
- Final layout numbers: h5/measure2.out.json; uploads/packs: measure3 output (upload 2 slots x 13 tiles: card 341 -> 809 px; pack 5 slots: 1228 -> 2398 px).
- Screenshots: h5/shots/final-*.png (20 files, 1440x900 and 375x812).
- Nothing half-done.
