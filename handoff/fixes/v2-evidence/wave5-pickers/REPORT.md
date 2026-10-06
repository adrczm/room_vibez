The pickers are mounted and working in the real app with real thumbnails, but the e2e suite is 58/60: two existing layout assertions fail because of the swatch names, and I did not edit them. That needs your decision before wave 6.

## The decision needed

Both failures are layout assertions (not selectors, not the mount) that cannot hold with a name under every swatch:

| Existing assertion | Now | Was | Why it cannot hold |
|---|---|---|---|
| `panel-structure.spec.ts:244` `slots.bottomScreens < 1.5` at 375×812 | 1.585 | 1.366 (this wave's CSS switched off in the page) | `#slots` is 472 px, was 303: names, 44 px circles, and the handles row wraps to two. Top of `#slots` is at 1.004 screens. |
| `placed-products.spec.ts:388` card height changes by `> 20` px (a precondition) | 6.03 px | > 20 | Table (2 slots) and chair (3 slots) each now have four rows of tiles; the difference is 6 px whatever the tile metrics. |

With only those two numbers relaxed in a scratch copy (1.5 → 1.7, 20 → 2), both spec files pass 16/16 (`$S/h5/e2e-patched-1.log`, `$S/h5/patched-root/`). The row-stays-under-the-pointer assertion after line 388 still passes.

## 1. Done-when lines and Picker §7 checks

**UX-14**

| Line | Status |
|---|---|
| One trigger with thumbnail and name; grid; picking Side table changes turntable and Materials (2 slots) | Verified (spec test 1), with one caveat: the trigger shows its thumbnail only after the pop-up has been opened once in thumbnail view. Before that it shows the name alone. See §2. |
| Keyboard only | Verified: Arrow Down opens, focus on current tile, Arrow Right, Enter selects, focus back on trigger, Esc closes. |
| List view, survives reload, blocked storage | Verified for both picker kinds (`catalog3d.pickerView.product` / `.material`). With `setItem` throwing from before load: no error, choice holds for the session. |
| List view starts no render | Verified: with 30 items, `__rv.thumbnails()` is null and one WebGL context is alive. |
| Uploaded model with *your upload* | Verified: tile shows name plus "your upload", placeholder then real thumbnail. An OBJ package (`tests/fixtures/obj-stool`) also draws. |
| No horizontal scroll at 375 px; not clipped | Verified: overflow 0 closed, grid, list, after a pick. At 1440 the pop-up is 520 px wide, right edge on the panel's, on top over the stage. |
| No existing spec needs a selector change | Verified: none needed. One real mount defect found and fixed (§7.1). |

**UX-15**: verified.
- Wall and floor open a grid of 14 items with CSS swatches, names and tabs All / Wood / Plastic / Textile / Stone / Metal.
- A pick goes through `onRoomMaterialChange` into `__rv.roomGraph()`.
- Native selects keep 14 options and `selectOption({ index: 1 })` still works.
- Undo re-syncs the triggers.
- `#texture-target` stays inside `#texture-target-wrap` (13 items, no Default) and hides with the map role.
- `#texture-category` and `#texture-role` are native.
- All 12 chair swatches are `BUTTON`, 34×34, with a one-line name under each, none cut; the tooltip is unchanged (`Natural oak (STUB-MAT-WOOD-OAK)`).
- Swatches are 44×44 on a coarse pointer.
- `viewer.spec.ts` passes unedited.

**Materials on arrival at 1440×900**: still fully visible, panel scrollTop 0. The card grew from 362 to 491 px; panel scroll height 1144 → 1274.

**Picker §7**

| Check | Result |
|---|---|
| A2 script | `[]` in five states (Product and Room, with and without a room, Place step open) |
| Keyboard path | Verified |
| Programmatic value plus `sync()` | Trigger unchanged before `sync()`, correct after |
| Upload with *your upload* | Verified |
| 30 products, thumbnail view | `open()` 3.2–3.6 ms; first frame 7–38 ms; first image 1.8–2.6 s (main thread blocked until then); the 12 tiles on screen drawn by 7.7–8.4 s. Off-screen tiles are not drawn until scrolled to. Second open 27 ms. |
| 30 products, list view | `open()` 3.2–3.3 ms; first frame 6–18 ms; second frame 46–60 ms |
| List at 375 px with 30 items | Full-width sheet 0–375 × 172–812, 44 px rows, 11 visible, last item selectable |
| View remembered across reload | Verified, both kinds |
| `setItem` throwing | Verified |
| Finish test | Passing (`room-placement-engine.spec.ts:237`, `placed-products.spec.ts:171` and `:239`) |
| WebGL contexts | 1 at load; 2 after the first thumbnail-view open; still 2 after 22 renders |
| Remount | Verified in both workspaces: 2 alive / 4 created; trigger image redrawn; finish kept; picker, swatches and wall picker work |
| Copy §8 vocabulary grep | Not run: it is for after everything lands. The two new strings do not match it. |

**Task 4 (wave-4 interplay)**: verified with the real picker. With a placed product selected, eleven keys inside the pop-up (arrows, Home, End, r, Shift+R, Delete, Backspace) leave pose, selection and outline unchanged. Esc closes the picker only. Picking a different product does drop the selection; that is wave 4's own rule in the select's `change` handler, and the placed product is untouched.

## 2. Thumbnails

- **They work**: real renders in the default finish. A black-ash swatch on the turntable does not show in the thumbnail (spec checks pixels: 66 % warm oak, 3 % dark). A pack shows its own materials.
- **Render times (SwiftShader)**: first 1.8–2.7 s, later 0.29–1.0 s.
- **Not drawn at load.** I first drew the trigger's image right after load. That blocked the main thread for 2.35 s and a test saw `ready` at 4.0 s instead of 1.7 s (`$S/h5/probe2.out.json`). Now nothing is drawn until the pop-up is first opened in thumbnail view. After that, the trigger's image is kept current for uploads, selects set in code and remount, unless the picker is set to List.
- **Cache**: by product id (PNG data URL, 192 px × DPR). `thumbnailUrl` wins and is never drawn.
- **Invalidated when**:
  - a normal or roughness map is added to a library material that is a slot default of the product (verified: renders 2 → 3, image changed);
  - a pack's geometry parameter rebuilds the model, or any parameter of an `mjs-module` product changes (not exercised: no such file here);
  - Restart 3D view, which drops everything.
- **Limit**: a pack that came with a `.glb` is drawn from that file, so its thumbnail keeps the default colourway after a colourway change (observed).
- **Remount**: the renderer is disposed with the viewer and a new one is created on the next request.

## 3. `main.ts`

**New**
- `thumbnailRenderer()`: creates the one renderer lazily (`loadRoot: loadProductRoot`, default finish through the host's `applyFinish`).
- `requestProductThumb(id)`: resolves a URL or null.
- `showSelectedProductThumb()`: draws the trigger's image under the rule in §2.
- `invalidateProductThumb(id, redraw = true)`, `invalidateThumbsUsingMaterial(id)`, `resetThumbnails()`.
- `initPickers()`: creates all four pickers, called in `boot()` right after the fetch.
- `belowTheFold(el)`.
- State: four picker variables, `thumbnails`, `thumbnailsInUse`.
- `__rv.pickers()` and `__rv.thumbnails()` as test hooks.

**Changed**
- `ownsArrowKeys`: now includes `[aria-haspopup]`. By reading the code, Arrow Down on a picker trigger would otherwise also have nudged the selected product; the spec asserts the fixed behaviour.
- `loadProduct`: calls `showSelectedProductThumb()` after the load.
- `renderSlots`: each swatch is `label.swatch-tile > button.swatch + span.swatch-name[aria-hidden]`. The button is unchanged; a click on the name presses it.
- `onPackParamChange` and `onAddTexture`: invalidation.
- `#btn-remount` handler: `resetThumbnails()`.
- `import.meta.hot.dispose`: also disposes thumbnails and destroys pickers.
- Step toggle in `initPanelUi`: for "Place products", if `#btn-place-mode` is below the fold after the usual scroll, the panel starts at the picker instead.

**`sync()` call sites**
- `refreshProductSelect` (product).
- `populateMaterialSelects` and `syncMaterialSelectsFromGraph` (wall, floor).
- `refreshTextureTargetOptions` (target).

No other code assigns these selects.

## 4. Strings

- Added to `notInDeck.picker`: `allGroups: 'All'`, `groupTabsLabel: 'Category'`.
- Existing visible strings changed: none.
- Pop-up titles come from existing copy ("Product", "Walls", "Floor", "Add to material"). The field labels in `index.html` still read "Wall material", "Floor material", "Target material" until the copy pass.
- The sublabel is `copy.productCard.yourUpload`, which is lower case ("your upload").
- `picker.triggerName` is unused; the component builds the name with `aria-labelledby`.

## 5. Specs

- Existing specs edited: none.
- New: `tests/e2e/catalog-pickers.spec.ts`, 12 tests, covering every item in the UX-14 and UX-15 "Tests" lists plus the interplay, context count, remount, `thumbnailUrl`, and 375 px.

## 6. Results

- `tsc --noEmit`: exit 0.
- Unit: 336/336 (29 files).
- `vite build`: OK, same two warnings.
- E2E, `--workers=1`: 58/60 in 7.1 min; the two failures are above; new spec 12/12.

## 7. Findings, choices, unverified

1. **Component defect, fixed.** `clip-path: inset(50%)` on the hidden select made `toBeInViewport()` report ratio 0, which failed `placed-products.spec.ts:306`. Removed from `src/ui/thumbnailPicker.css`; `opacity: 0` keeps it unseen. The new spec asserts it for three selects.
2. **Uploads and packs get very tall Materials cards.** Their slots allow all 13 materials, so each slot is five rows of labelled tiles (310 px, was 76). An uploaded model with 2 slots: 341 → 809 px. The pack with 5 slots: 1228 → 2398 px. This is DT2's "revisit when the library outgrows a row", already true for every upload. Not changed.
3. **Place step at 1280×800** with the chair: "Add to room" is 12 px below the fold on opening (was visible), "Place product" 53 px (was 28). At 1440×900 everything is in view; the step heading scrolls under the toolbar.
4. **Trigger without image before first use**: a CSS rule in `styles.css` hides the empty box on the product trigger. Drawing it at load is a one-line change if a real GPU makes it cheap; I could not measure that.
5. Thumbnail renders already queued keep running after the pop-up closes; the renderer has no cancel.
6. Search appears at 16 items (component default, unvalidated).
7. The thumbnail root uses the engine's `loadProductRoot`, not the host's `loadPlacementRoot`, which ignores `resourceMap` for multi-file glTF (an existing gap for placements, not touched).
8. For wave 8: the audit scripts in `fixes/qa-evidence/` key tab stops, border contrast and hover on `#product-select`. The control is now `.tpicker[data-picker-for=product-select] .tpicker-trigger`.
9. **Not checked**: real GPU, screen readers, Safari, Firefox, a classic-scrollbar layout, `.mjs`-only modules. Everything ran in headless Chrome 154 on SwiftShader.

Screenshots (20) are in `$S/h5/shots/final-*.png`; the running note is `$S/h5/PROGRESS.md`.
