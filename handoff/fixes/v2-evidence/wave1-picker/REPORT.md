# Picker agent (C): final report

The catalog picker is built and passes every check I could run without the real app. Nothing in it has been mounted in the app yet, so the app-level parts of UX-14 are still open.

One thing to know first: the hidden select is **not 1×1**. It is 1 px wide, as tall as the trigger and `opacity: 0`. A 1×1 select is counted as an undersized control by the UX §6 `controlsUnder32px` snippet and by `targets()` in `fixes/qa-evidence/audit-viewer.mjs` (gates G24 and G25). Run with those audit expressions on the harness, four 1×1 selects were flagged in each gate; with the new box, none are. Playwright still sees the select as visible and `selectOption` works.

## 1. UX-14 "Done when", component part

Each harness check ran at 1440×900 and 375×812 in Chrome 154.0.8037.97.

| Requirement | Status |
|---|---|
| One trigger with thumbnail and name; opens a tile grid; picking sets the value | **Verified in harness.** Picking set `select.value` and a bubbling `change` reached listeners on the select and on `document`. Turntable and Materials card (2 slots) changing: **not verified**, needs the mount. |
| Keyboard only: open, arrow, Enter, Esc, focus back on trigger | **Verified.** Tab lands on the trigger, not the hidden select. Enter, Space and ArrowDown open with focus on the selected option. Arrows, Home and End move focus. Enter or Space selects. Esc closes and returns focus, and a page-level Esc handler did not fire. Tab past the listbox closes the popup and lands on the control after the trigger. |
| List: one row per item, selecting works the same | **Verified.** 3 items gave 3 rows, text only, with no placeholder boxes. |
| Choice survives a reload | **Verified.** `catalog3d.pickerView.product = 'list'`; reopened in List after reload. |
| `localStorage` blocked: nothing throws, choice holds for the session | **Verified two ways:** `setItem` throwing, and the `localStorage` getter throwing. 0 page errors; List held on reopen. |
| List view starts no thumbnail render | **Verified at the component boundary.** With 30 items in List there were 0 `requestThumb` calls on open, after scrolling to the end and after a search. Switching to Thumbnails then requested 12 visible tiles, and 22 (desktop) or 24 (375 px) after scrolling, none twice. The real render queue does not exist here. |
| Added model appears with *your upload* and a thumbnail or placeholder | **Verified with a simulated add.** Trigger and tile showed the name, "Your upload" and the placeholder. `setThumb(id, url)` filled both in place. |
| No horizontal scroll at 375 px; popup not clipped | **Verified.** `scrollWidth` 375 = `clientWidth` 375 with the popup open. See §4 for clipping. |
| No existing spec needs a selector change | **Implemented, not verified at spec level.** `isVisible('#product-select')` is true, `selectOption` by value and by `{ index: 1 }` works, and `#room-wall-material option` count is still 14. The existing specs were not run because they need the mount. |
| Tests | Unit tests: **done**. E2E in the app: **not done** (`tests/e2e` is the host's); the harness scripts cover the same assertions. |

Also verified:
- **Group tabs:** none for the two products; All plus five for materials.
- **Material swatches:** drawn in CSS (colour × map, multiply, cover) with no `<img>`.
- **Re-parenting and `destroy()`:** re-parenting `el` keeps everything working; `destroy()` restores the select.
- **Reduced motion:** the popup's transition is `0s` under `prefers-reduced-motion: reduce`.
- **Coarse pointer:** every picker target is at least 44 px.
- **Modal dialogs:** `showModal()` closes an open picker.
- **Production build:** the full check script also passes against a minified build of the harness.

## 2. Files

All under `/private/tmp/claude-501/-Users-adrian-Desktop-Room-Vibez/7ac663fe-e0d6-4b3c-af69-487be083d847/scratchpad/ws-picker/`.

Merge these:
- `src/ui/thumbnailPicker.ts`
- `src/ui/thumbnailPicker.css` (imported by the `.ts`)
- `tests/unit/thumbnailPicker.test.ts`

Harness only, do not merge:
- `picker-harness.html`

A diff against `base-w0` shows only these paths added. Evidence is in `…/scratchpad/picker/`: `results.json`, `results-build.json`, `timings.json`, `extra.json`, `extra2.json`, `audit-replica-{before,after,build}.json`, `shots/` (18 PNGs) and `PROGRESS.md`.

## 3. API

```ts
export type PickerView = 'grid' | 'list';
export type PickerViewKey = 'product' | 'material' | (string & {});

export interface PickerItem {
  id: string; label: string; sublabel?: string; thumbUrl?: string;
  swatch?: { color: string; map?: string }; group?: string;
}

export interface PickerStrings {
  searchPlaceholder: string; // also the search field's accessible name
  noMatches: string;
  close: string;
  viewGroupLabel: string;
  viewThumbnails: string;
  viewList: string;
  groupTabsLabel: string;    // NOT in the handoff's list
  allGroups: string;         // NOT in the handoff's list
}

export interface ThumbnailPickerOptions {
  select: HTMLSelectElement;
  label: string;             // trigger name, popup title, listbox name
  getItems: () => PickerItem[];
  viewKey: PickerViewKey;
  strings: PickerStrings;
  searchMinItems?: number;   // default 16
  requestThumb?: (id: string) => void | Promise<string | null | undefined>;
  formatGroup?: (group: string) => string;
  alignTo?: HTMLElement;     // default: the trigger
}

export interface ThumbnailPicker {
  el: HTMLElement;
  sync(): void;
  setThumb(id: string, url: string | null): void;
  open(): void;
  close(): void;
  destroy(): void;
}

export function createThumbnailPicker(opts: ThumbnailPickerOptions): ThumbnailPicker;

export const DEFAULT_SEARCH_MIN_ITEMS = 16;
export const PICKER_VIEW_STORAGE_PREFIX = 'catalog3d.pickerView.';
export function buildProductItems(
  products: readonly { id: string; name: string; userAdded?: boolean; thumbnailUrl?: string }[],
  opts: { uploadSublabel: string; thumbFor?: (id: string) => string | undefined }): PickerItem[];
export function buildMaterialItems(
  materials: readonly { id: string; name: string; category?: string; color: string; map?: string }[],
  opts?: { defaultLabel?: string }): PickerItem[];
export function normalizeSearchText(text: string): string;
export function filterItems(items: readonly PickerItem[], query: string, group?: string | null): PickerItem[];
export function deriveGroups(items: readonly PickerItem[]): string[];
export function itemHasVisual(item: PickerItem): boolean;
export function defaultView(items: readonly PickerItem[], canGetThumbnails?: boolean): PickerView;
export function parseStoredView(raw: unknown): PickerView | null;
export function resolveView(stored: PickerView | null, items: readonly PickerItem[], canGetThumbnails?: boolean): PickerView;
export function shouldShowSearch(itemCount: number, minItems?: number): boolean;
export function moveIndex(index: number, key: string, count: number, columns: number, view: PickerView): number;
export interface ViewStorage { getItem(key: string): string | null; setItem(key: string, value: string): void; }
export function readStoredView(viewKey: string, storage?: ViewStorage | null): PickerView | null;
export function storeView(viewKey: string, view: PickerView, storage?: ViewStorage | null): void;
export function clearSessionViews(): void;
```

**Differences from the handoff's sketch**
- **Extra options and methods:** `strings`, `searchMinItems`, `requestThumb`, `formatGroup`, `alignTo`; `setThumb`, `open`, `close`. These cover the brief's strings rule, the thumbnail hand-off and DT4.
- **Popup lives in `<body>`, not inside `el`.** Three of the four selects sit inside a `<label class="field">`, and a popup inside a label would forward every click to the trigger. Re-parenting `el` is unaffected.
- **The picker listens for `change` on the select.** After `selectOption` the trigger follows without `sync()`. A plain `.value =` assignment still needs `sync()`.
- **Default-view rule extended.** As written, a product picker with no images yet would start in List and never ask for thumbnails. It now starts in Thumbnails when `requestThumb` is given, and in List only when nothing has an image or swatch and there is no `requestThumb`.
- **No Popover API:** the native select is left visible and working, with no trigger.

**Mounting on `#product-select`** (no `index.html` edit; the component wraps the select in place)
```ts
const productPicker = createThumbnailPicker({
  select: productSelect, label: /* "Product" */, viewKey: 'product', strings: /* from copy.ts */,
  getItems: () => buildProductItems(catalog.products, { uploadSublabel: /* "Your upload" */, thumbFor: (id) => cache.get(id) }),
  requestThumb: (id) => { const p = catalog.products.find((x) => x.id === id); return p ? thumbnails.render(p) : undefined; },
});
```
1. Call `productPicker.sync()` at the end of `refreshProductSelect` and after any `productSelect.value = …`.
2. Re-parent with `target.append(productPicker.el)`, never the select alone.
3. `requestThumb(id)` is called only while the popup is open in the thumbnail view, for an item with no `thumbUrl` and no swatch, when its tile scrolls into view. It is called at most once per item per open, and not while a returned promise is pending.
4. Answer by returning a promise of the URL, or by calling `productPicker.setThumb(id, url)` later.
5. If no image came back, the item is asked for again on the next open, so the host queue must cache by id.
6. Invalidate with `setThumb(id, null)`.
7. The trigger never requests a thumbnail by itself.
8. If the thumbnail spike failed, omit `requestThumb`. The picker then opens in List and the trigger is text only.

**Mounting on a material select**
```ts
const wallPicker = createThumbnailPicker({
  select: roomWallMaterial, label: /* "Wall material" */, viewKey: 'material', strings: /* material strings */,
  getItems: () => buildMaterialItems(library.materials, { defaultLabel: /* "Default" */ }), // no defaultLabel for #texture-target
});
```
- **Sync points:** call `sync()` in `populateMaterialSelects`, `syncMaterialSelectsFromGraph` and `refreshTextureTargetOptions`.
- **Handoff's panel-edge alignment:** pass `alignTo: document.querySelector('.panel')`.
- **Search strings:** search appears on a material picker once it has 16 items (wall and floor have 14 today), so each needs its own `searchPlaceholder` and `noMatches`.

**Test hooks:** `.tpicker[data-picker-for="<select id>"] .tpicker-trigger`; `.tpicker-popup[data-picker-for="<select id>"]` with `data-view="grid|list"` and `data-layout="anchored|sheet"`; `[role=option][data-id="<value>"]`; `[data-view-option="grid|list"]`; `.tpicker-group[data-group="<group>"]` (All is `""`); `.tpicker-search`; `.tpicker-close`; `.tpicker-empty`.

**CSS hooks:** `--tpicker-trigger-visual` (28 px) and `--tpicker-tile-min` (96 px; 88 px for materials).

## 4. `popover` or `<dialog>`

Native `popover="auto"`; no `<dialog>` was needed. At 1440×900 the wall-material popup measured x 730–1250, y 69–549, against the panel at x 1084–1424 with `overflow-y: auto`. It extends 354 px left of the panel, all four corners and the centre hit-test to the popup, and it sits fully inside the viewport. At 375×812 it is a sheet at x 0–375, y 172–812.

- **Outside click:** the browser's own light dismiss.
- **Esc:** handled in the component so it can stop propagation.
- **Trigger click while open:** closes, and it stays closed.
- **Click on the host `<label>`:** opens the popup; a second click closes it without reopening.

## 5. Search threshold and timings

**16 items**, set by `searchMinItems`. It is unvalidated: my reasoning is only "more than about one screenful of the popup". Today neither the 2 products nor the 14 materials show search.

First open with 30 items, 9 fresh page loads each, in ms as median (min–max). Headless Chrome on a shared machine, so indicative only.

| Viewport | View | Click handler | To the frame after first paint |
|---|---|---|---|
| 1440×900 | Thumbnails, placeholders | 4.6 (4.1–4.8) | 13.3 (7.5–18.9) |
| 1440×900 | Thumbnails, 30 images supplied | 5.0 (4.6–5.5) | 11.8 (9.5–22.6) |
| 1440×900 | List, text rows | 4.5 (4.4–5.0) | 6.6 (5.9–18.3) |
| 1440×900 | List, 30 cached images | 5.5 (5.2–5.6) | 10.0 (9.8–17.9) |
| 375×812 | Thumbnails, placeholders | 4.4 (4.1–4.7) | 7.0 (6.2–17.5) |
| 375×812 | Thumbnails, 30 images supplied | 4.8 (4.3–4.9) | 13.5 (8.5–18.3) |
| 375×812 | List, text rows | 4.0 (3.8–4.4) | 7.9 (5.7–23.3) |
| 375×812 | List, 30 cached images | 5.1 (4.5–5.6) | 12.4 (9.2–17.2) |

The second column includes waiting for the next frame, so it is an upper bound. The images were harness test patterns, not real renders.

## 6. tsc and vitest

- `npx tsc --noEmit`: exit 0.
- `npx vitest run`: 19 files, **105 passed** (66 baseline plus 39 new), 0 failed. No existing test was edited.
- Harness: 114/114 on the dev server and 114/114 on a minified build, plus 16/16 extra checks.

## 7. Choices the handoff does not specify, and what was not checked

**New strings (the host must supply them):** `allGroups` and `groupTabsLabel`. The harness used "All", "Category", "Search materials" and "No materials match." as stand-ins only; they are not proposed copy.

**Choices I made**
- **Group tabs:** an All tab comes first and is the default on every open. Items with no group, such as *Default*, show only under All. Starting a search switches to All. Tab labels are the raw `group` value (lowercase "wood") unless `formatGroup` is passed.
- **Search:** matches label, sublabel and group; ignores case and accents; needs every word. Typing on a tile continues in the search field. Enter in the field moves to the first match and does not select it. Without a search field, typing jumps to the next name starting with the typed letters.
- **Popup:** shows `label` as a visible title and always has a Close button. It opens under the trigger when the content fits, otherwise on the side with more room, capped at 480 px high. It closes when focus leaves it and when the trigger scrolls out of the panel. The sheet has a dimmed backdrop.
- **Other:**
  - Selection does not follow focus.
  - Only `change` is dispatched, as the handoff says.
  - Placeholders are hatched and dashed so they cannot pass for a pale swatch.
  - Names wrap and are never truncated.
  - Sizes (28 px trigger image, 96 and 88 px tiles, 36 px rows) are design defaults, like the handoff's own (DT3).
  - There is no "n results" announcement, because it would need another string.
  - Arrow keys assume left-to-right.

**Not checked**
- **Screen readers.** Only Chrome's computed accessibility tree was read (roles, names, selected and checked states). A two-dimensional `listbox` is not a standard pattern.
- **Safari and Firefox.** Cannot be run here.
- **The real app:** the eight existing `selectOption` calls, `loadProduct`, `onRoomMaterialChange`, `#btn-remount`, re-parenting between the real workspaces, and real thumbnails. The engine agent's renderer was not available here.
- **A real touch device.** Coarse pointer was emulated only.
- **A picker inside a modal `<dialog>`.** The popup is in `<body>`, so it would be inert there. No current mount does this.
- **Which view people prefer, the threshold of 16, and all sizes.** No data.
- **Border contrast.** The trigger and popup borders use `--border-strong`, 1.61:1 on white, the same token as `.select`. They stay below 3:1 until the QA-13 token fix. All text pairs the picker adds are at least 4.5:1; the lowest is 5.33.

The servers on port 18784 are stopped, and nothing was copied into the project.
