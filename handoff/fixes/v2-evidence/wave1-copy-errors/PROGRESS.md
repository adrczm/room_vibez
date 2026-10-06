# B1 (copy + errors) running note

Workspace: scratchpad/ws-copy. Owned files: src/copy.ts, src/errors.ts, tests/unit/copy.test.ts, tests/unit/errors.test.ts.

## State (update as work proceeds)
- [x] src/copy.ts written in full; tsc clean. Deck §3.1–§3.6, §4.A–§4.F, §5 ALL transcribed (viewer only; §2 help and §6 prototype excluded on purpose).
- [x] Verbatim check vs deck: scratchpad/b1-tools/check-deck.mts (+ check-deck-strict.mts). 309 deck-group strings; misses are only the listed "variant" forms.
- [x] src/errors.ts written in full; tsc clean. friendlyError + createUploadEscalation + slotWarnings + packPanelMode/packSummary/packStatusMessage + friendlyObjNote + overlapList/placedMessage/movedOverlapMessage + mjsConfirmContent/splitGuardMessage.
- [x] copy.ts small fixes done: notInDeck.packDetails added; comment fixed.
- [x] tests/unit/copy.test.ts written: 20 tests pass, tsc clean (incl. @ts-expect-error placeholder checks).
- [x] tests/unit/errors.test.ts written: 68 tests pass (real engine calls; 3 'to reconcile after merge' blocks).
- [x] final: tsc --noEmit exit 0; vitest 154 passed / 20 files (66 baseline + 20 copy + 68 errors). Only 4 files differ from base-w0.
- [x] final report sent to the coordinator. ALL WORK DONE. notInDeck has 50 strings.

## Not in the deck (so far) — see copy.notInDeck for the item that asked for each
given: advanced, steps.{room,openings,place,finish}, stepChange, adjustSize, more, addToRoom, placedProducts.row (format),
       picker.{productLabel,searchProducts,noProductsMatch,close,viewLabel,thumbnails,list,defaultMaterial},
       appliesToNextProduct, uploadNotRestored, packDetails
written: emptyRoom.{title,body,fromScratch,importPlan,fromTemplate,importProject}, placedProducts.{rotateLeft,rotateRight,duplicate,selectedHint,movedOverlap},
       canvasLabel, picker.{triggerName,searchMaterials,noMaterialsMatch}, outsideRoom, genericError, overlayModelFailed, placeFailedOther,
       openingSizeInvalid, unitAbbrev.{m,cm,ft-in}, roomSizeFeet, importWallRow, importRoomRow, openingListRow, sampleBannerBuiltIn, jobStatusSample

## Deck problems found
1. Bold is used both as UI emphasis and as "this label changed" highlighting. Kept ** only inside sentences (9 keys); dropped on labels; italics dropped.
2. §3.2 overlay "anything else" has one string; Copy Phase 1 step 8 asks for a split (boot vs model). Wrote notInDeck.overlayModelFailed.
3. §3.2 "(With quarantine, see §4.F)": after quarantine lands, "your saved room may be damaged" is stale. Kept as written.
4. §3.4 slot meta "moves to the swatch tooltip" vs next row "Swatch tooltip (unchanged)". Used unchanged tooltip.
5. §3.4 #model-files aria-label "unchanged" vs QA-14 (accessible name must contain visible label).
6. §3.5 one sample banner: false after "Try the sample plan" (no file); JSON plans are not samples at all.
7. §3.5 Job status = file name; for the sample it is "sample-plan.candidates.json".
8. §3.5 only the opening row is reworded; wall row (wc_s · A-WALL) and room row have no deck string. §3.6 no opening-list row.
9. §3.5/§3.6 "({unit})": deck shows (m), (cm) only; no feet form. Room summary only in metres.
10. §3.5 preset "Living room · 5 × 4 m" vs §3.6 status example "Living · 5.00 × 4.00 m" (engine preset label is "Living").
11. §4.C "Not a pack" contains "createAsset"; Copy §8 regex and Phase 3 acceptance forbid createAsset in visible text. Also \bstub\b/i matches STUB-SKU-… that the deck keeps visible.
12. §4.E "Scale: none → Enter a length you know": with no scale hint the engine can never set a scale (dwgImport.ts:333), so the advice cannot work. §3.5 has a second, slightly different wording for the same state.
13. §4.F "Place failed → Load its pack again": wrong for non-pack products. Wrote notInDeck.placeFailedOther.
14. §4.A: "OBJ file is empty" and the sidecar-shape message reach the host wrapped ("Could not parse OBJ (x): OBJ file is empty", "Invalid sidecar JSON (x): Sidecar must be…"). Mapper handles both.
15. §4.D UV row is singular only ("x has no UV mapping"); added plural "have".
16. No generic fallback string in the deck. Wrote notInDeck.genericError.

## Engine messages with no deck wording
- roomGraph.ts:389 "Opening width and height must be positive" -> notInDeck.openingSizeInvalid
- objImport.ts:541 "Slots from sidecar only (n)" -> friendlyObjNote returns null
- objImport.ts:474 "Meshes without UVs — …" (OBJ note) -> reuses §4.D UV string
- generic fallback: roomGraph.ts:379/391/426 (Unknown wall / Offset / Unknown opening), roomTemplates.ts:77, roomHistory.ts:69, RoomVibezViewer.ts:281/283/285/299/560/733, projectIO idb (63/72/82/93, never reach UI), main.ts "Materials library is empty"

## To reconcile after merge (A2 engine changes)
1. Room-size per-field (Phase 4 item 5): roomSizeField() accepts ctx.field, err.field, or a message naming exactly one field.
2. formatMjsGuardMessage rewrite (Phase 4 item 4): mjsConfirmContent() from copy vs splitGuardMessage(engine text).
3. Plan-file rejection (Phase 4 item 6): two heuristic rules at plan call sites (notADwg, wrongType).
