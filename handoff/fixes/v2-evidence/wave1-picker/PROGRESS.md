# Picker agent (C): running note — STATE: FINISHED, final report sent

Nothing is half-done. Dev and preview servers on 18784 are stopped.

## Files (in ws-picker) — to merge
- `src/ui/thumbnailPicker.ts` (component + pure helpers, 982 lines)
- `src/ui/thumbnailPicker.css` (imported by the .ts, 203 lines)
- `tests/unit/thumbnailPicker.test.ts` (39 tests)
- NOT merged: `picker-harness.html` (workspace root, harness only)
- Workspace diff vs `base-w0`: exactly those paths added; nothing else touched.

## Exported API (thumbnailPicker.ts)
- `createThumbnailPicker(opts: ThumbnailPickerOptions): ThumbnailPicker`
  - opts: `select, label, getItems, viewKey, strings, searchMinItems?, requestThumb?, formatGroup?, alignTo?`
  - returns `{ el, sync(), setThumb(id, url|null), open(), close(), destroy() }`
- strings: `searchPlaceholder, noMatches, close, viewGroupLabel, viewThumbnails, viewList, groupTabsLabel, allGroups`
  (`groupTabsLabel`, `allGroups` are NOT in the handoff's list: new strings the host must supply)
- pure helpers: `buildProductItems`, `buildMaterialItems`, `normalizeSearchText`, `filterItems`, `deriveGroups`,
  `itemHasVisual`, `defaultView`, `parseStoredView`, `resolveView`, `shouldShowSearch`, `moveIndex`,
  `readStoredView`, `storeView`, `clearSessionViews`
- constants: `DEFAULT_SEARCH_MIN_ITEMS = 16`, `PICKER_VIEW_STORAGE_PREFIX = 'catalog3d.pickerView.'`

## Decisions
- Native `popover="auto"` (not `<dialog>`), Chrome 154.0.8037.97: top layer, not clipped by the scrolling panel.
  Popup element lives in `<body>`. No Popover API → the native select is left visible and working.
- Search threshold 16 items (`searchMinItems`), UNVALIDATED (DT4).
- Default view: thumbnails; list when nothing has an image/swatch AND the host gave no `requestThumb`.
- Hidden select: clip pattern, but 1 px wide × trigger height and `opacity: 0` (not 1×1), so the project's own
  audits (UX §6 `controlsUnder32px`, gates G24/G25 `targets()`) do not report it as an undersized control.
  Measured with the audit's own expressions: before, 4 selects flagged in each gate; after, 0.

## Results on the final source
- `tsc --noEmit` exit 0; `vitest run` 19 files, 105 passed (66 baseline + 39 new)
- `verify.mjs`: 114/114 on the dev server (`results.json`) and 114/114 on a minified production build (`results-build.json`)
- `extra.mjs` 8/8, `extra2.mjs` 8/8, `build-check.mjs` passed, `audit-replica.mjs` (before / after / build JSON)
- 30-item first open (`timings.json`, 9 fresh loads each, ms, median (min–max)):

  | viewport | view | click handler | to the frame after first paint |
  |---|---|---|---|
  | 1440x900 | thumbnails, placeholders | 4.6 (4.1–4.8) | 13.3 (7.5–18.9) |
  | 1440x900 | thumbnails, 30 images supplied | 5.0 (4.6–5.5) | 11.8 (9.5–22.6) |
  | 1440x900 | list, text rows | 4.5 (4.4–5.0) | 6.6 (5.9–18.3) |
  | 1440x900 | list, 30 cached images | 5.5 (5.2–5.6) | 10.0 (9.8–17.9) |
  | 375x812 | thumbnails, placeholders | 4.4 (4.1–4.7) | 7.0 (6.2–17.5) |
  | 375x812 | thumbnails, 30 images supplied | 4.8 (4.3–4.9) | 13.5 (8.5–18.3) |
  | 375x812 | list, text rows | 4.0 (3.8–4.4) | 7.9 (5.7–23.3) |
  | 375x812 | list, 30 cached images | 5.1 (4.5–5.6) | 12.4 (9.2–17.2) |

- Screenshots: `shots/` (18 files)

## Not checked (cannot be, here)
Screen readers, Safari, Firefox, a real touch device, the real app mount (existing e2e specs, real change
handlers, #btn-remount, real thumbnails from A1's renderer), which of the two views people prefer.
