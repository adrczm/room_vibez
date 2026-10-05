// Catalog picker (UX-14, UX-15): a drop-down with a thumbnail view and a list view, mounted on a native <select>.
//
// The <select> stays in the DOM as the state holder (visually hidden, never `hidden` / display:none), so
// `selectOption('#product-select', …)` and every existing `change` handler keep working. Picking an item sets
// `select.value` and dispatches a bubbling `change`.
//
// No visible or accessible string is hard-coded here: the host passes them (from `src/copy.ts`) through `strings`.
// The component never renders a thumbnail itself. In the thumbnail view it asks the host for a missing image
// (`requestThumb`); the list view never asks.
//
// The pure helpers at the top have no DOM access and are unit-tested in `tests/unit/thumbnailPicker.test.ts`.
import './thumbnailPicker.css';

// ───────────────────────────── Types ─────────────────────────────

export type PickerView = 'grid' | 'list';

/** Which remembered view preference a picker uses. `product` and `material` are the two kinds in use. */
export type PickerViewKey = 'product' | 'material' | (string & {});

export interface PickerItem {
  /** Option value. Must equal the `value` of an <option> in the select. */
  id: string;
  /** Visible name. */
  label: string;
  /** Second line, e.g. "Your upload". */
  sublabel?: string;
  /** Image URL (data, blob or http). When absent the tile shows a neutral placeholder; a list row shows text only. */
  thumbUrl?: string;
  /** CSS swatch for materials: `color` multiplied over `map`, as the slot swatches are drawn. */
  swatch?: { color: string; map?: string };
  /** Group tab. Omit when the data has none. */
  group?: string;
}

/** Every visible or accessible string the component shows. The host supplies all of them. */
export interface PickerStrings {
  /** Placeholder and accessible name of the search field, e.g. "Search products". */
  searchPlaceholder: string;
  /** Shown (and announced) when the search matches nothing, e.g. "No products match." */
  noMatches: string;
  /** Accessible name of the close button, e.g. "Close". */
  close: string;
  /** Accessible name of the view toggle, e.g. "View". */
  viewGroupLabel: string;
  /** View toggle, thumbnail option, e.g. "Thumbnails". */
  viewThumbnails: string;
  /** View toggle, list option, e.g. "List". */
  viewList: string;
  /** Accessible name of the group tabs. Used only when at least two groups exist. */
  groupTabsLabel: string;
  /** The tab that shows every group. Used only when at least two groups exist. */
  allGroups: string;
}

export interface ThumbnailPickerOptions {
  /** State holder. Stays in the DOM; the component wraps it. */
  select: HTMLSelectElement;
  /** Accessible name of the trigger, the popup and the listbox, e.g. "Product". */
  label: string;
  /** Read fresh on every open and on `sync()`. */
  getItems: () => PickerItem[];
  /** Which remembered view preference this picker shares (`catalog3d.pickerView.<viewKey>`). */
  viewKey: PickerViewKey;
  strings: PickerStrings;
  /** Search appears when the picker has at least this many items. Default {@link DEFAULT_SEARCH_MIN_ITEMS}. */
  searchMinItems?: number;
  /**
   * Ask the host for a missing thumbnail. Called only while the popup is open **in the thumbnail view**, for an
   * item that has neither `thumbUrl` nor `swatch`, when its tile scrolls into view. Called at most once per item
   * per open, and never while a promise returned for that item is still pending. The host answers either by
   * returning a promise of the URL, or by calling `picker.setThumb(id, url)` later.
   */
  requestThumb?: (id: string) => void | Promise<string | null | undefined>;
  /** Turns a `group` value into its visible tab label. Default: the value as it is. */
  formatGroup?: (group: string) => string;
  /** Element whose right edge the desktop popup lines up with. Default: the trigger. */
  alignTo?: HTMLElement;
}

export interface ThumbnailPicker {
  /** Wrapper holding the trigger and the hidden select. Re-parent this element, not the select. */
  el: HTMLElement;
  /** Re-read `getItems()` and `select.value`. Call after code changes the select's options or value. */
  sync(): void;
  /** Hand a thumbnail to the picker (or `null` to drop it, so it is requested again when next shown). */
  setThumb(id: string, url: string | null): void;
  open(): void;
  close(): void;
  /** Remove the picker and put the select back as it was. */
  destroy(): void;
}

// ───────────────────────────── Pure helpers (no DOM) ─────────────────────────────

/**
 * Search appears when a picker has at least this many items (DT4 leaves the number open).
 * A design default, not evidence: nobody has tested it with people.
 */
export const DEFAULT_SEARCH_MIN_ITEMS = 16;

/** Prefix of the `localStorage` key that remembers a picker kind's view. */
export const PICKER_VIEW_STORAGE_PREFIX = 'catalog3d.pickerView.';

interface ProductLike {
  id: string;
  name: string;
  userAdded?: boolean;
  /** Supplied image; wins over a rendered one (UX-14 step 5). */
  thumbnailUrl?: string;
}

interface MaterialLike {
  id: string;
  name: string;
  category?: string;
  color: string;
  map?: string;
}

/**
 * Catalog products → picker items. Name, plus `uploadSublabel` for the user's own uploads.
 * No maker, category, SKU or price line: the data has none (UX-14 step 4).
 * `thumbFor` returns an image the host already has (its cache); `product.thumbnailUrl` wins over it.
 */
export function buildProductItems(
  products: readonly ProductLike[],
  opts: { uploadSublabel: string; thumbFor?: (id: string) => string | undefined },
): PickerItem[] {
  return products.map((p) => {
    const item: PickerItem = { id: p.id, label: p.name };
    if (p.userAdded) item.sublabel = opts.uploadSublabel;
    const thumb = p.thumbnailUrl || opts.thumbFor?.(p.id);
    if (thumb) item.thumbUrl = thumb;
    return item;
  });
}

/**
 * Library materials → picker items with a CSS swatch and `group = category` (UX-15 step 1).
 * `defaultLabel` adds a first item with value `''` (wall and floor); it has no swatch and no group.
 */
export function buildMaterialItems(
  materials: readonly MaterialLike[],
  opts: { defaultLabel?: string } = {},
): PickerItem[] {
  const out: PickerItem[] = [];
  if (opts.defaultLabel !== undefined) out.push({ id: '', label: opts.defaultLabel });
  for (const m of materials) {
    const item: PickerItem = { id: m.id, label: m.name, swatch: m.map ? { color: m.color, map: m.map } : { color: m.color } };
    if (m.category) item.group = m.category;
    out.push(item);
  }
  return out;
}

/** Lower-case, accent-free, trimmed: what search compares. */
export function normalizeSearchText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Items in `group` (or every group when `group` is null) whose label, sublabel or group contains every word of
 * `query`. Order is kept. Items without a group appear only when `group` is null.
 */
export function filterItems(items: readonly PickerItem[], query: string, group: string | null = null): PickerItem[] {
  const words = normalizeSearchText(query).split(/\s+/).filter(Boolean);
  return items.filter((item) => {
    if (group !== null && item.group !== group) return false;
    if (!words.length) return true;
    const hay = normalizeSearchText(`${item.label} ${item.sublabel ?? ''} ${item.group ?? ''}`);
    return words.every((w) => hay.includes(w));
  });
}

/**
 * Distinct `group` values in first-seen order, or `[]` when fewer than two exist
 * (group tabs show only when at least two distinct groups exist).
 */
export function deriveGroups(items: readonly PickerItem[]): string[] {
  const seen: string[] = [];
  for (const item of items) {
    if (item.group && !seen.includes(item.group)) seen.push(item.group);
  }
  return seen.length >= 2 ? seen : [];
}

/** True when the item can show a picture: an image or a swatch. */
export function itemHasVisual(item: PickerItem): boolean {
  return Boolean(item.thumbUrl || item.swatch);
}

/**
 * The view used until the user chooses one (UX-14 step 2b; unvalidated, DT8): thumbnails, or the list when
 * nothing in the picker has an image or swatch. `canGetThumbnails` is true when the host can still supply
 * images for the items that lack one; without it the rule would start a product picker in the list view and
 * never ask for its thumbnails.
 */
export function defaultView(items: readonly PickerItem[], canGetThumbnails = false): PickerView {
  return canGetThumbnails || items.some(itemHasVisual) ? 'grid' : 'list';
}

/** A stored preference, if it is one of the two known views. */
export function parseStoredView(raw: unknown): PickerView | null {
  return raw === 'grid' || raw === 'list' ? raw : null;
}

/** The user's stored choice wins; otherwise {@link defaultView}. */
export function resolveView(stored: PickerView | null, items: readonly PickerItem[], canGetThumbnails = false): PickerView {
  return stored ?? defaultView(items, canGetThumbnails);
}

export function shouldShowSearch(itemCount: number, minItems: number = DEFAULT_SEARCH_MIN_ITEMS): boolean {
  return itemCount >= minItems;
}

/**
 * Where an arrow, Home or End key moves the roving focus. Grid: two dimensions over `columns`; Down from a
 * row that has no item directly below goes to the last item when a lower row exists. List: Up and Down only.
 * Never wraps. Returns -1 when there are no items.
 */
export function moveIndex(index: number, key: string, count: number, columns: number, view: PickerView): number {
  if (count <= 0) return -1;
  const last = count - 1;
  const i = Math.min(Math.max(index, 0), last);
  if (key === 'Home') return 0;
  if (key === 'End') return last;
  if (view === 'list') {
    if (key === 'ArrowDown') return Math.min(i + 1, last);
    if (key === 'ArrowUp') return Math.max(i - 1, 0);
    return i;
  }
  const cols = Math.max(1, Math.floor(columns));
  switch (key) {
    case 'ArrowRight':
      return Math.min(i + 1, last);
    case 'ArrowLeft':
      return Math.max(i - 1, 0);
    case 'ArrowDown':
      if (i + cols <= last) return i + cols;
      return Math.floor(i / cols) < Math.floor(last / cols) ? last : i;
    case 'ArrowUp':
      return i - cols >= 0 ? i - cols : i;
    default:
      return i;
  }
}

/** Minimal part of `Storage` the view preference needs (lets tests pass a fake). */
export interface ViewStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** Session fallback when storage is blocked. Shared by every picker of the same kind. */
const sessionViews = new Map<string, PickerView>();

function browserStorage(): ViewStorage | null {
  try {
    return (globalThis as { localStorage?: ViewStorage }).localStorage ?? null;
  } catch {
    return null; // reading `localStorage` itself can throw when storage is blocked
  }
}

/** The remembered view for a picker kind: this session's choice first, then `localStorage`. Never throws. */
export function readStoredView(viewKey: string, storage: ViewStorage | null = browserStorage()): PickerView | null {
  const inSession = sessionViews.get(viewKey);
  if (inSession) return inSession;
  try {
    return parseStoredView(storage?.getItem(PICKER_VIEW_STORAGE_PREFIX + viewKey));
  } catch {
    return null;
  }
}

/** Remember a view for a picker kind. Kept in memory for the session even when `localStorage` throws. */
export function storeView(viewKey: string, view: PickerView, storage: ViewStorage | null = browserStorage()): void {
  sessionViews.set(viewKey, view);
  try {
    storage?.setItem(PICKER_VIEW_STORAGE_PREFIX + viewKey, view);
  } catch {
    // Blocked or full storage: the session copy above still holds the choice.
  }
}

/** Test seam: forget the in-memory choices. */
export function clearSessionViews(): void {
  sessionViews.clear();
}

// ───────────────────────────── Component ─────────────────────────────

const POPUP_MAX_WIDTH = 520; // design default (DT3), not evidence
const POPUP_MAX_HEIGHT = 480;
const POPUP_MIN_HEIGHT = 200;
const VIEWPORT_MARGIN = 16;
const TRIGGER_GAP = 4;
/** At this width and below the popup is a full-width sheet (CSS has the same query). */
const SHEET_QUERY = '(max-width: 860px)';
const TYPEAHEAD_RESET_MS = 700;
const NAV_KEYS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End']);

let instanceCount = 0;

const CLOSE_ICON =
  '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false"><path d="M4 4l8 8M12 4l-8 8" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/></svg>';

function cssUrl(url: string): string {
  return `url(${JSON.stringify(url)})`;
}

export function createThumbnailPicker(opts: ThumbnailPickerOptions): ThumbnailPicker {
  const { select, strings } = opts;
  const doc = select.ownerDocument;
  const win = doc.defaultView!;
  const uid = `tpicker-${++instanceCount}`;
  const searchMin = opts.searchMinItems ?? DEFAULT_SEARCH_MIN_ITEMS;

  const make = <K extends keyof HTMLElementTagNameMap>(tag: K, className?: string): HTMLElementTagNameMap[K] => {
    const node = doc.createElement(tag);
    if (className) node.className = className;
    return node;
  };

  // Wrapper: takes the select's place and holds trigger + select, so the host re-parents one element.
  const el = make('div', 'tpicker');
  el.dataset.pickerKind = opts.viewKey;
  if (select.id) el.dataset.pickerFor = select.id;
  if (select.parentNode) select.before(el);

  // Without the Popover API the native select stays as it is: visible, working, unenhanced.
  if (typeof el.showPopover !== 'function') {
    el.dataset.enhanced = 'false';
    el.append(select);
    return {
      el,
      sync() {},
      setThumb() {},
      open() {},
      close() {},
      destroy() {
        if (el.parentNode) el.replaceWith(select);
      },
    };
  }
  el.dataset.enhanced = 'true';

  // ── Trigger ──
  const trigger = make('button', 'tpicker-trigger');
  trigger.type = 'button';
  trigger.setAttribute('aria-haspopup', 'dialog');
  trigger.setAttribute('aria-expanded', 'false');
  trigger.setAttribute('aria-controls', `${uid}-popup`);
  const triggerVisual = make('span', 'tpicker-visual');
  triggerVisual.setAttribute('aria-hidden', 'true');
  const triggerText = make('span', 'tpicker-text');
  const triggerName = make('span', 'tpicker-name');
  triggerName.id = `${uid}-value`;
  const triggerSub = make('span', 'tpicker-sub');
  triggerSub.id = `${uid}-sub`;
  triggerText.append(triggerName, triggerSub);
  const chevron = make('span', 'tpicker-chevron');
  chevron.setAttribute('aria-hidden', 'true');
  const triggerLabel = make('span', 'tpicker-sr');
  triggerLabel.id = `${uid}-label`;
  triggerLabel.textContent = opts.label;
  trigger.append(triggerVisual, triggerText, chevron, triggerLabel);

  // ── Native select: visually hidden, still rendered ──
  const prevAriaHidden = select.getAttribute('aria-hidden');
  const prevTabindex = select.getAttribute('tabindex');
  select.classList.add('tpicker-native');
  select.setAttribute('aria-hidden', 'true');
  select.tabIndex = -1;
  // Trigger first: inside a <label> the first labelable descendant is the labelled control.
  el.append(trigger, select);

  // ── Popup (top layer). Lives in <body> so a host <label> around the picker never sees its clicks. ──
  const popup = make('div', 'tpicker-popup');
  popup.id = `${uid}-popup`;
  popup.setAttribute('popover', 'auto');
  popup.setAttribute('role', 'dialog');
  popup.setAttribute('aria-labelledby', `${uid}-title`);
  popup.tabIndex = -1;
  popup.dataset.pickerKind = opts.viewKey;
  if (select.id) popup.dataset.pickerFor = select.id;
  // Makes the trigger the popup's invoker: clicks on it are not "outside" clicks, and Tab leaves the popup
  // for the control after the trigger.
  trigger.popoverTargetElement = popup;

  const head = make('div', 'tpicker-head');
  // The popup can cover its trigger (sheet, or opened upwards), so it says which picker it belongs to.
  const title = make('span', 'tpicker-title');
  title.id = `${uid}-title`;
  title.textContent = opts.label;
  const search = make('input', 'tpicker-search text-input');
  search.type = 'search';
  search.autocomplete = 'off';
  search.spellcheck = false;
  search.placeholder = strings.searchPlaceholder;
  search.setAttribute('aria-label', strings.searchPlaceholder);
  search.setAttribute('aria-controls', `${uid}-list`);

  const viewToggle = make('div', 'tpicker-view segmented cols-2');
  viewToggle.setAttribute('role', 'radiogroup');
  viewToggle.setAttribute('aria-label', strings.viewGroupLabel);
  const viewButtons = (['grid', 'list'] as const).map((v) => {
    const b = make('button');
    b.type = 'button';
    b.setAttribute('role', 'radio');
    b.dataset.viewOption = v;
    b.textContent = v === 'grid' ? strings.viewThumbnails : strings.viewList;
    viewToggle.append(b);
    return b;
  });

  const closeBtn = make('button', 'tpicker-close');
  closeBtn.type = 'button';
  closeBtn.setAttribute('aria-label', strings.close);
  closeBtn.innerHTML = CLOSE_ICON; // static icon markup, no host text
  head.append(title, viewToggle, closeBtn, search);

  const groupTabs = make('div', 'tpicker-groups');
  groupTabs.setAttribute('role', 'radiogroup');
  groupTabs.setAttribute('aria-label', strings.groupTabsLabel);

  const list = make('div', 'tpicker-list');
  list.id = `${uid}-list`;
  list.setAttribute('role', 'listbox');
  list.setAttribute('aria-labelledby', title.id);

  const empty = make('p', 'tpicker-empty');
  empty.setAttribute('role', 'status');

  popup.append(head, groupTabs, list, empty);
  doc.body.append(popup);

  // ── State ──
  let items: PickerItem[] = [];
  let byId = new Map<string, PickerItem>();
  let shown: PickerItem[] = [];
  let optionEls: HTMLElement[] = [];
  let groups: string[] = [];
  let query = '';
  let activeGroup: string | null = null;
  let view: PickerView = 'grid';
  let tabStopId: string | null = null;
  let destroyed = false;
  let dismissedInThisTask = false;
  let closingByCode = false;
  let frame = 0;
  let typeahead = '';
  let typeaheadAt = 0;
  let observer: IntersectionObserver | null = null;
  const thumbCache = new Map<string, string>();
  const askedThisOpen = new Set<string>();
  const pendingThumbs = new Set<string>();

  const isOpen = () => popup.matches(':popover-open');
  const thumbOf = (item: PickerItem) => item.thumbUrl || thumbCache.get(item.id);
  const needsThumb = (item: PickerItem) => !thumbOf(item) && !item.swatch;
  const canGetThumbnails = () => Boolean(opts.requestThumb) || thumbCache.size > 0;

  function paintVisual(box: HTMLElement, item: PickerItem | undefined) {
    box.replaceChildren();
    box.style.backgroundColor = '';
    box.style.backgroundImage = '';
    const thumb = item ? thumbOf(item) : undefined;
    if (item && thumb) {
      box.dataset.kind = 'thumb';
      const img = make('img');
      img.alt = '';
      img.decoding = 'async';
      img.draggable = false;
      img.addEventListener('error', () => {
        // A broken image falls back to the neutral placeholder; nothing is drawn in its place.
        if (img.parentNode === box) {
          box.replaceChildren();
          box.dataset.kind = 'none';
        }
      });
      img.src = thumb;
      box.append(img);
    } else if (item?.swatch) {
      box.dataset.kind = 'swatch';
      box.style.backgroundColor = item.swatch.color;
      if (item.swatch.map) box.style.backgroundImage = cssUrl(item.swatch.map);
    } else {
      box.dataset.kind = 'none';
    }
  }

  function readItems() {
    items = opts.getItems();
    byId = new Map(items.map((item) => [item.id, item]));
    for (const id of thumbCache.keys()) if (!byId.has(id)) thumbCache.delete(id); // forget removed items
    el.dataset.hasVisuals = String(canGetThumbnails() || items.some(itemHasVisual));
  }

  function renderTrigger() {
    const current = byId.get(select.value);
    triggerName.textContent = current ? current.label : (select.selectedOptions[0]?.textContent ?? '');
    const sub = current?.sublabel ?? '';
    triggerSub.textContent = sub;
    triggerSub.hidden = !sub;
    trigger.setAttribute('aria-labelledby', sub ? `${triggerLabel.id} ${triggerName.id} ${triggerSub.id}` : `${triggerLabel.id} ${triggerName.id}`);
    paintVisual(triggerVisual, current);
    trigger.disabled = select.disabled;
  }

  function setRadios(buttons: HTMLElement[], isChecked: (b: HTMLElement) => boolean) {
    for (const b of buttons) {
      const on = isChecked(b);
      b.setAttribute('aria-checked', String(on));
      b.tabIndex = on ? 0 : -1;
    }
  }

  function renderChrome() {
    search.hidden = !shouldShowSearch(items.length, searchMin);
    groups = deriveGroups(items);
    if (activeGroup !== null && !groups.includes(activeGroup)) activeGroup = null;
    groupTabs.hidden = groups.length === 0;
    groupTabs.replaceChildren();
    if (groups.length) {
      for (const g of [null, ...groups]) {
        const b = make('button', 'tpicker-group');
        b.type = 'button';
        b.setAttribute('role', 'radio');
        b.dataset.group = g ?? '';
        b.textContent = g === null ? strings.allGroups : (opts.formatGroup?.(g) ?? g);
        groupTabs.append(b);
      }
      syncGroupTabs();
    }
    popup.dataset.view = view;
    setRadios(viewButtons, (b) => b.dataset.viewOption === view);
  }

  function syncGroupTabs() {
    setRadios(Array.from(groupTabs.querySelectorAll<HTMLElement>('[role=radio]')), (b) => (b.dataset.group || null) === activeGroup);
  }

  function renderList() {
    const hadFocus = list.contains(doc.activeElement);
    const focusedId = hadFocus ? ((doc.activeElement as HTMLElement).dataset.id ?? null) : null;
    shown = filterItems(items, search.hidden ? '' : query, activeGroup);
    const frag = doc.createDocumentFragment();
    optionEls = shown.map((item, i) => {
      const o = make('div', 'tpicker-option');
      o.id = `${uid}-opt-${i}`;
      o.setAttribute('role', 'option');
      o.setAttribute('aria-selected', String(item.id === select.value));
      o.dataset.id = item.id;
      o.tabIndex = -1;
      const visual = make('span', 'tpicker-visual');
      visual.setAttribute('aria-hidden', 'true');
      paintVisual(visual, item);
      const text = make('span', 'tpicker-text');
      const name = make('span', 'tpicker-name');
      name.textContent = item.label;
      text.append(name);
      if (item.sublabel) {
        const sub = make('span', 'tpicker-sub');
        sub.textContent = item.sublabel;
        text.append(sub);
      }
      o.append(visual, text);
      frag.append(o);
      return o;
    });
    list.replaceChildren(frag);
    list.hidden = shown.length === 0;
    empty.textContent = shown.length === 0 ? strings.noMatches : '';
    empty.hidden = shown.length !== 0;

    // Roving tabindex: the option that had focus, else the current value, else the first one.
    const keep = [focusedId, tabStopId, select.value].find((id) => id !== null && shown.some((s) => s.id === id));
    const stop = Math.max(0, keep === undefined ? 0 : shown.findIndex((s) => s.id === keep));
    setTabStop(stop);
    if (hadFocus) {
      if (optionEls[stop]) optionEls[stop].focus({ preventScroll: true });
      else (search.hidden ? popup : search).focus({ preventScroll: true });
    }
    watchThumbs();
  }

  function setTabStop(index: number) {
    optionEls.forEach((o, i) => (o.tabIndex = i === index ? 0 : -1));
    tabStopId = shown[index]?.id ?? null;
  }

  function focusOption(index: number) {
    const o = optionEls[index];
    if (!o) return;
    setTabStop(index);
    o.focus({ preventScroll: true });
    o.scrollIntoView({ block: 'nearest', inline: 'nearest' }); // instant: no smooth scrolling to honour reduced motion
  }

  function columnCount(): number {
    if (view === 'list' || optionEls.length === 0) return 1;
    const top = optionEls[0].offsetTop;
    let n = 0;
    while (n < optionEls.length && optionEls[n].offsetTop === top) n++;
    return Math.max(1, n);
  }

  // ── Thumbnails: only the thumbnail view asks, and only for tiles that are on screen ──
  function ask(id: string) {
    if (destroyed || !opts.requestThumb || view !== 'grid' || !isOpen()) return;
    if (askedThisOpen.has(id) || pendingThumbs.has(id)) return;
    const item = byId.get(id);
    if (!item || !needsThumb(item)) return;
    askedThisOpen.add(id);
    let answer: void | Promise<string | null | undefined>;
    try {
      answer = opts.requestThumb(id);
    } catch {
      return; // the host's failure must not break the picker; the tile keeps its placeholder
    }
    if (answer && typeof answer.then === 'function') {
      pendingThumbs.add(id);
      answer.then(
        (url) => {
          pendingThumbs.delete(id);
          if (url) setThumb(id, url);
        },
        () => {
          pendingThumbs.delete(id);
        },
      );
    }
  }

  function watchThumbs() {
    observer?.disconnect();
    observer = null;
    if (!opts.requestThumb || view !== 'grid' || !isOpen()) return;
    const waiting = optionEls.filter((_, i) => needsThumb(shown[i]));
    if (!waiting.length) return;
    if (typeof win.IntersectionObserver !== 'function') {
      waiting.forEach((o) => ask(o.dataset.id!));
      return;
    }
    const io = new win.IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          io.unobserve(entry.target);
          ask((entry.target as HTMLElement).dataset.id!);
        }
      },
      { root: list, rootMargin: '48px 0px' },
    );
    observer = io;
    waiting.forEach((o) => io.observe(o));
  }

  function setThumb(id: string, url: string | null) {
    if (destroyed) return;
    if (url) thumbCache.set(id, url);
    else {
      thumbCache.delete(id);
      askedThisOpen.delete(id);
    }
    const item = byId.get(id);
    if (!item) return;
    el.dataset.hasVisuals = String(canGetThumbnails() || items.some(itemHasVisual));
    const index = shown.findIndex((s) => s.id === id);
    const box = index >= 0 ? optionEls[index]?.querySelector<HTMLElement>('.tpicker-visual') : null;
    if (box) paintVisual(box, item);
    if (select.value === id) paintVisual(triggerVisual, item);
    if (!url) watchThumbs();
  }

  // ── View ──
  function applyView(next: PickerView, remember: boolean) {
    view = next;
    popup.dataset.view = view;
    setRadios(viewButtons, (b) => b.dataset.viewOption === view);
    if (remember) storeView(opts.viewKey, view);
    watchThumbs(); // starts asking in the thumbnail view, stops in the list view
  }

  // ── Position: anchored under (or over) the trigger; the sheet layout is CSS ──
  let placeBelow = true;
  function position(chooseSide: boolean) {
    const s = popup.style;
    if (win.matchMedia(SHEET_QUERY).matches) {
      popup.dataset.layout = 'sheet';
      s.left = s.right = s.top = s.bottom = s.maxHeight = '';
      delete popup.dataset.side;
      return;
    }
    popup.dataset.layout = 'anchored';
    const r = trigger.getBoundingClientRect();
    const edge = (opts.alignTo ?? trigger).getBoundingClientRect().right;
    const vw = doc.documentElement.clientWidth;
    const vh = doc.documentElement.clientHeight;
    const width = Math.min(POPUP_MAX_WIDTH, vw - 2 * VIEWPORT_MARGIN);
    const right = Math.max(VIEWPORT_MARGIN, Math.min(vw - edge, vw - width - VIEWPORT_MARGIN));
    const below = vh - r.bottom - TRIGGER_GAP - VIEWPORT_MARGIN;
    const above = r.top - TRIGGER_GAP - VIEWPORT_MARGIN;
    if (chooseSide) {
      // Under the trigger when the content fits there; otherwise wherever there is more room.
      // The side then stays put while the popup is open.
      s.maxHeight = `${POPUP_MAX_HEIGHT}px`;
      const wanted = popup.offsetHeight;
      placeBelow = wanted <= below || below >= above;
    }
    const room = placeBelow ? below : above;
    s.left = 'auto';
    s.right = `${right}px`;
    s.top = placeBelow ? `${r.bottom + TRIGGER_GAP}px` : 'auto';
    s.bottom = placeBelow ? 'auto' : `${vh - r.top + TRIGGER_GAP}px`;
    s.maxHeight = `${Math.max(POPUP_MIN_HEIGHT, Math.min(POPUP_MAX_HEIGHT, room))}px`;
    popup.dataset.side = placeBelow ? 'below' : 'above';
  }

  /** True when the trigger is not rendered, or has scrolled out of a clipping ancestor (the panel) or the viewport. */
  function triggerOutOfSight(): boolean {
    const r = trigger.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) return true;
    let top = 0;
    let bottom = doc.documentElement.clientHeight;
    for (let p = el.parentElement; p && p !== doc.body; p = p.parentElement) {
      if (win.getComputedStyle(p).overflowY === 'visible') continue;
      const box = p.getBoundingClientRect();
      top = Math.max(top, box.top);
      bottom = Math.min(bottom, box.bottom);
    }
    return r.bottom <= top || r.top >= bottom;
  }

  function onViewportChange(e: Event) {
    if (e.target instanceof win.Node && popup.contains(e.target)) return; // the list's own scrolling
    if (frame) return;
    frame = win.requestAnimationFrame(() => {
      frame = 0;
      if (!isOpen()) return;
      // An anchored popup follows its trigger, and closes once the trigger is scrolled out of sight.
      // The sheet does not depend on where the trigger is (asked live: a resize may just have crossed 860 px).
      if (!win.matchMedia(SHEET_QUERY).matches && triggerOutOfSight()) close();
      else position(false);
    });
  }

  // ── Open / close ──
  function open() {
    if (destroyed || isOpen() || trigger.disabled) return;
    if (!popup.isConnected) doc.body.append(popup);
    readItems();
    query = '';
    search.value = '';
    activeGroup = null;
    tabStopId = null;
    typeahead = '';
    askedThisOpen.clear();
    view = resolveView(readStoredView(opts.viewKey), items, canGetThumbnails());
    renderTrigger();
    renderChrome();
    renderList();
    // `source` names the trigger as the invoker (where supported), which keeps Tab order sensible.
    popup.showPopover({ source: trigger });
    position(true); // measured and placed in the same task as the show, so nothing is painted in between
    trigger.setAttribute('aria-expanded', 'true');
    win.addEventListener('scroll', onViewportChange, { capture: true, passive: true });
    win.addEventListener('resize', onViewportChange);
    watchThumbs();
    const stop = optionEls.findIndex((o) => o.tabIndex === 0);
    if (stop >= 0) focusOption(stop);
    else (search.hidden ? popup : search).focus({ preventScroll: true });
  }

  function close(returnFocus = false) {
    if (isOpen()) {
      closingByCode = true;
      try {
        popup.hidePopover();
      } finally {
        closingByCode = false;
      }
    }
    if (returnFocus && !destroyed) trigger.focus();
  }

  function afterClose() {
    trigger.setAttribute('aria-expanded', 'false');
    win.removeEventListener('scroll', onViewportChange, { capture: true });
    win.removeEventListener('resize', onViewportChange);
    if (frame) win.cancelAnimationFrame(frame);
    frame = 0;
    observer?.disconnect();
    observer = null;
    askedThisOpen.clear();
  }

  function choose(id: string) {
    const changed = select.value !== id;
    if (changed) select.value = id;
    const took = select.value === id;
    close(true);
    if (changed && took) select.dispatchEvent(new Event('change', { bubbles: true }));
    else renderTrigger();
  }

  function sync() {
    if (destroyed) return;
    readItems();
    renderTrigger();
    if (isOpen()) {
      view = resolveView(readStoredView(opts.viewKey), items, canGetThumbnails());
      renderChrome();
      renderList();
    }
  }

  // ── Events ──
  const onTriggerClick = (e: MouseEvent) => {
    e.preventDefault(); // the component opens the popover itself, so it can fill and place it first
    if (isOpen()) close();
    // A click on a host <label> first closes the popup as an outside click, then lands here in the same
    // task: don't reopen it.
    else if (!dismissedInThisTask) open();
  };
  const onTriggerKey = (e: KeyboardEvent) => {
    if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && !isOpen()) {
      e.preventDefault();
      open();
    } else if (e.key === 'Escape' && isOpen()) {
      e.preventDefault();
      e.stopPropagation();
      close(true);
    }
  };
  const onSelectChange = () => sync();
  trigger.addEventListener('click', onTriggerClick);
  trigger.addEventListener('keydown', onTriggerKey);
  select.addEventListener('change', onSelectChange);

  popup.addEventListener('beforetoggle', (e) => {
    if ((e as ToggleEvent).newState !== 'closed') return;
    if (!closingByCode) {
      dismissedInThisTask = true;
      win.setTimeout(() => (dismissedInThisTask = false), 0);
    }
    afterClose();
  });
  popup.addEventListener('toggle', () => trigger.setAttribute('aria-expanded', String(isOpen())));

  popup.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    // Handled here so a page-level Esc handler (room tools) does not also act on it.
    e.preventDefault();
    e.stopPropagation();
    close(true);
  });
  popup.addEventListener('focusout', (e) => {
    const to = e.relatedTarget;
    if (!(to instanceof win.Node)) return; // window blur, or a click on something that takes no focus
    if (popup.contains(to) || to === trigger) return;
    close();
  });
  closeBtn.addEventListener('click', () => close(true));

  search.addEventListener('input', () => {
    const next = search.value;
    if (!query.trim() && next.trim() && activeGroup !== null) {
      activeGroup = null; // a new search looks in every group
      syncGroupTabs();
    }
    query = next;
    renderList();
  });
  search.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowDown' && e.key !== 'Enter') return;
    e.preventDefault();
    const stop = optionEls.findIndex((o) => o.tabIndex === 0);
    if (stop >= 0) focusOption(stop);
  });

  function wireRadioGroup(group: HTMLElement, pick: (button: HTMLElement) => void) {
    group.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('[role=radio]');
      if (b && group.contains(b)) pick(b);
    });
    group.addEventListener('keydown', (e) => {
      const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
      if (!step) return;
      const radios = Array.from(group.querySelectorAll<HTMLElement>('[role=radio]'));
      const at = radios.indexOf(doc.activeElement as HTMLElement);
      if (at < 0) return;
      e.preventDefault();
      e.stopPropagation();
      const next = radios[(at + step + radios.length) % radios.length];
      pick(next);
      next.focus();
    });
  }
  wireRadioGroup(viewToggle, (b) => applyView(b.dataset.viewOption === 'list' ? 'list' : 'grid', true));
  wireRadioGroup(groupTabs, (b) => {
    activeGroup = b.dataset.group || null;
    syncGroupTabs();
    renderList();
  });

  list.addEventListener('click', (e) => {
    const o = (e.target as HTMLElement).closest<HTMLElement>('.tpicker-option');
    if (o && list.contains(o)) choose(o.dataset.id!);
  });
  list.addEventListener('keydown', (e) => {
    const o = (e.target as HTMLElement).closest<HTMLElement>('.tpicker-option');
    if (!o) return;
    const index = optionEls.indexOf(o);
    if (index < 0 || e.ctrlKey || e.metaKey || e.altKey) return;
    if (NAV_KEYS.has(e.key)) {
      e.preventDefault();
      e.stopPropagation();
      focusOption(moveIndex(index, e.key, optionEls.length, columnCount(), view));
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      e.stopPropagation();
      choose(o.dataset.id!);
    } else if (e.key.length === 1) {
      e.preventDefault();
      e.stopPropagation();
      if (!search.hidden) {
        // Typing on an option continues in the search field.
        search.focus({ preventScroll: true });
        search.value += e.key;
        search.dispatchEvent(new Event('input', { bubbles: true }));
      } else {
        // No search field: jump to the next option whose name starts with what was typed.
        const now = win.performance.now();
        typeahead = now - typeaheadAt > TYPEAHEAD_RESET_MS ? e.key : typeahead + e.key;
        typeaheadAt = now;
        const needle = normalizeSearchText(typeahead);
        const from = typeahead.length === 1 ? index + 1 : index;
        for (let step = 0; step < shown.length; step++) {
          const at = (from + step) % shown.length;
          if (normalizeSearchText(shown[at].label).startsWith(needle)) {
            focusOption(at);
            break;
          }
        }
      }
    }
  });

  readItems();
  renderTrigger();

  return {
    el,
    sync,
    setThumb,
    open,
    close: () => close(),
    destroy() {
      if (destroyed) return;
      close();
      destroyed = true;
      afterClose();
      trigger.removeEventListener('click', onTriggerClick);
      trigger.removeEventListener('keydown', onTriggerKey);
      select.removeEventListener('change', onSelectChange);
      popup.remove();
      select.classList.remove('tpicker-native');
      if (prevAriaHidden === null) select.removeAttribute('aria-hidden');
      else select.setAttribute('aria-hidden', prevAriaHidden);
      if (prevTabindex === null) select.removeAttribute('tabindex');
      else select.setAttribute('tabindex', prevTabindex);
      if (el.parentNode) el.replaceWith(select);
    },
  };
}
