// Pure helpers of the catalog picker (UX-14, UX-15). Environment: node, no DOM.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_SEARCH_MIN_ITEMS,
  PICKER_VIEW_STORAGE_PREFIX,
  buildMaterialItems,
  buildProductItems,
  clearSessionViews,
  defaultView,
  deriveGroups,
  filterItems,
  itemHasVisual,
  moveIndex,
  normalizeSearchText,
  parseStoredView,
  readStoredView,
  resolveView,
  shouldShowSearch,
  storeView,
  type PickerItem,
  type ViewStorage,
} from '../../src/ui/thumbnailPicker';

const ROOT = join(__dirname, '../..');
const readJson = <T>(rel: string): T => JSON.parse(readFileSync(join(ROOT, 'public', rel), 'utf8')) as T;

interface LibraryFile {
  materials: { id: string; name: string; category: string; color: string; map?: string }[];
}
interface CatalogFile {
  products: { id: string; name: string; userAdded?: boolean }[];
}
const library = readJson<LibraryFile>('assets/library/materials.json');
const catalog = readJson<CatalogFile>('assets/library/catalog.json');

describe('module', () => {
  it('loads without a DOM', () => {
    expect(typeof document).toBe('undefined');
    expect(typeof buildProductItems).toBe('function');
  });
});

describe('buildProductItems', () => {
  it('maps the shipped catalog to name-only items (no image, no sublabel, no group)', () => {
    const items = buildProductItems(catalog.products, { uploadSublabel: 'Your upload' });
    expect(items).toEqual([
      { id: 'demo-lounge-chair', label: 'Lounge chair (demo)' },
      { id: 'demo-side-table', label: 'Side table (demo)' },
    ]);
  });

  it('adds the upload sublabel only to user-added products', () => {
    const items = buildProductItems(
      [
        { id: 'a', name: 'Demo' },
        { id: 'b', name: 'Mine', userAdded: true },
        { id: 'c', name: 'Not mine', userAdded: false },
      ],
      { uploadSublabel: 'Your upload' },
    );
    expect(items.map((i) => i.sublabel)).toEqual([undefined, 'Your upload', undefined]);
  });

  it('never invents a maker, category, SKU or price line', () => {
    const product = { id: 'a', name: 'Chair', sku: 'STUB-SKU-CHAIR-001', maker: 'x', price: 1, category: 'y', userAdded: true };
    const [item] = buildProductItems([product], { uploadSublabel: 'Your upload' });
    expect(Object.keys(item).sort()).toEqual(['id', 'label', 'sublabel']);
  });

  it('uses the host cache for thumbnails, and lets product.thumbnailUrl win', () => {
    const cache: Record<string, string> = { a: 'blob:rendered-a', b: 'blob:rendered-b' };
    const items = buildProductItems(
      [
        { id: 'a', name: 'A' },
        { id: 'b', name: 'B', thumbnailUrl: '/supplied/b.png' },
        { id: 'c', name: 'C' },
      ],
      { uploadSublabel: 'Your upload', thumbFor: (id) => cache[id] },
    );
    expect(items.map((i) => i.thumbUrl)).toEqual(['blob:rendered-a', '/supplied/b.png', undefined]);
    expect('thumbUrl' in items[2]).toBe(false);
  });
});

describe('buildMaterialItems', () => {
  it('maps the shipped library to swatch items grouped by category', () => {
    const items = buildMaterialItems(library.materials);
    expect(items).toHaveLength(library.materials.length);
    expect(items[0]).toEqual({
      id: 'wood-oak',
      label: 'Natural oak',
      swatch: { color: '#ffffff', map: '/assets/textures/wood-oak.png' },
      group: 'wood',
    });
    const black = items.find((i) => i.id === 'plastic-black')!;
    expect(black.swatch).toEqual({ color: '#1e1e1e' });
    expect(items.every(itemHasVisual)).toBe(true);
    expect(items.every((i) => i.sublabel === undefined && i.thumbUrl === undefined)).toBe(true);
  });

  it('puts a Default item with value "" first when asked (wall and floor)', () => {
    const items = buildMaterialItems(library.materials, { defaultLabel: 'Default' });
    expect(items).toHaveLength(library.materials.length + 1);
    expect(items[0]).toEqual({ id: '', label: 'Default' });
    expect(buildMaterialItems(library.materials)[0].id).not.toBe('');
  });

  it('yields the five category groups, so group tabs appear', () => {
    expect(deriveGroups(buildMaterialItems(library.materials, { defaultLabel: 'Default' }))).toEqual([
      'wood',
      'plastic',
      'textile',
      'stone',
      'metal',
    ]);
  });
});

describe('deriveGroups', () => {
  const item = (id: string, group?: string): PickerItem => (group === undefined ? { id, label: id } : { id, label: id, group });

  it('returns nothing for the two shipped products (no group data)', () => {
    expect(deriveGroups(buildProductItems(catalog.products, { uploadSublabel: 'Your upload' }))).toEqual([]);
  });

  it('needs at least two distinct groups', () => {
    expect(deriveGroups([])).toEqual([]);
    expect(deriveGroups([item('a', 'wood'), item('b', 'wood'), item('c')])).toEqual([]);
    expect(deriveGroups([item('a', 'wood'), item('b', 'metal')])).toEqual(['wood', 'metal']);
  });

  it('keeps first-seen order, without duplicates, and ignores empty groups', () => {
    expect(deriveGroups([item('a', 'stone'), item('b', ''), item('c', 'wood'), item('d', 'stone'), item('e')])).toEqual(['stone', 'wood']);
  });
});

describe('filterItems', () => {
  const items: PickerItem[] = [
    { id: '', label: 'Default' },
    { id: 'oak', label: 'Natural oak', group: 'wood' },
    { id: 'walnut', label: 'Walnut', group: 'wood' },
    { id: 'wool', label: 'Wool — cream', group: 'textile' },
    { id: 'up', label: 'Café table', sublabel: 'Your upload' },
  ];
  const ids = (list: PickerItem[]) => list.map((i) => i.id);

  it('returns everything, in order, for an empty or blank query', () => {
    expect(filterItems(items, '')).toEqual(items);
    expect(filterItems(items, '   ')).toEqual(items);
  });

  it('ignores case and accents', () => {
    expect(ids(filterItems(items, 'WALNUT'))).toEqual(['walnut']);
    expect(ids(filterItems(items, 'cafe'))).toEqual(['up']);
    expect(normalizeSearchText('  Crème BRÛLÉE ')).toBe('creme brulee');
  });

  it('needs every word, in any order', () => {
    expect(ids(filterItems(items, 'oak natural'))).toEqual(['oak']);
    expect(ids(filterItems(items, 'natural walnut'))).toEqual([]);
  });

  it('also looks in the sublabel and the group', () => {
    expect(ids(filterItems(items, 'upload'))).toEqual(['up']);
    expect(ids(filterItems(items, 'wood'))).toEqual(['oak', 'walnut']);
  });

  it('narrows to one group; ungrouped items show only under "all"', () => {
    expect(ids(filterItems(items, '', 'wood'))).toEqual(['oak', 'walnut']);
    expect(ids(filterItems(items, '', null))).toEqual(['', 'oak', 'walnut', 'wool', 'up']);
    expect(ids(filterItems(items, 'wal', 'wood'))).toEqual(['walnut']);
    expect(ids(filterItems(items, 'wal', 'textile'))).toEqual([]);
  });

  it('does not change its input', () => {
    const copy = structuredClone(items);
    filterItems(items, 'oak', 'wood');
    expect(items).toEqual(copy);
  });
});

describe('default view rule (UX-14 step 2b)', () => {
  const plain: PickerItem[] = [{ id: 'a', label: 'A' }, { id: 'b', label: 'B', sublabel: 'Your upload' }];

  it('is the list when no item has an image or swatch and no thumbnail can be supplied', () => {
    expect(defaultView(plain)).toBe('list');
    expect(defaultView([])).toBe('list');
  });

  it('is thumbnails as soon as one item has an image or a swatch', () => {
    expect(defaultView([...plain, { id: 'c', label: 'C', thumbUrl: 'blob:x' }])).toBe('grid');
    expect(defaultView([...plain, { id: 'c', label: 'C', swatch: { color: '#fff' } }])).toBe('grid');
  });

  it('is thumbnails when the host can still supply images', () => {
    expect(defaultView(plain, true)).toBe('grid');
  });

  it('is thumbnails for materials, which always have a colour', () => {
    expect(defaultView(buildMaterialItems(library.materials, { defaultLabel: 'Default' }))).toBe('grid');
  });

  it('gives way to the stored choice', () => {
    expect(resolveView('list', [{ id: 'c', label: 'C', thumbUrl: 'blob:x' }])).toBe('list');
    expect(resolveView('grid', plain)).toBe('grid');
    expect(resolveView(null, plain)).toBe('list');
    expect(resolveView(null, plain, true)).toBe('grid');
  });

  it('accepts only the two known stored values', () => {
    expect(parseStoredView('grid')).toBe('grid');
    expect(parseStoredView('list')).toBe('list');
    for (const bad of [null, undefined, '', 'GRID', 'thumbnails', 1, {}]) expect(parseStoredView(bad)).toBeNull();
  });
});

describe('view preference storage', () => {
  beforeEach(() => clearSessionViews());

  const memoryStorage = (initial: Record<string, string> = {}) => {
    const data = { ...initial };
    const storage: ViewStorage = {
      getItem: (k) => (k in data ? data[k] : null),
      setItem: (k, v) => {
        data[k] = v;
      },
    };
    return { data, storage };
  };
  const throwing: ViewStorage = {
    getItem: () => {
      throw new Error('blocked');
    },
    setItem: () => {
      throw new Error('blocked');
    },
  };

  it('writes and reads catalog3d.pickerView.<kind>', () => {
    const { data, storage } = memoryStorage();
    storeView('product', 'list', storage);
    expect(PICKER_VIEW_STORAGE_PREFIX).toBe('catalog3d.pickerView.');
    expect(data).toEqual({ 'catalog3d.pickerView.product': 'list' });
    clearSessionViews(); // a new page load
    expect(readStoredView('product', storage)).toBe('list');
    expect(readStoredView('material', storage)).toBeNull();
  });

  it('keeps the two kinds apart', () => {
    const { storage } = memoryStorage();
    storeView('product', 'list', storage);
    storeView('material', 'grid', storage);
    clearSessionViews();
    expect(readStoredView('product', storage)).toBe('list');
    expect(readStoredView('material', storage)).toBe('grid');
  });

  it('ignores a stored value it does not know', () => {
    const { storage } = memoryStorage({ 'catalog3d.pickerView.product': 'carousel' });
    expect(readStoredView('product', storage)).toBeNull();
  });

  it('does not throw when storage throws, and holds the choice for the session', () => {
    expect(() => storeView('product', 'list', throwing)).not.toThrow();
    expect(readStoredView('product', throwing)).toBe('list');
    expect(() => readStoredView('material', throwing)).not.toThrow();
    expect(readStoredView('material', throwing)).toBeNull();
    clearSessionViews(); // a reload loses it: nothing could be saved
    expect(readStoredView('product', throwing)).toBeNull();
  });

  it('works with no storage at all', () => {
    expect(() => storeView('product', 'grid', null)).not.toThrow();
    expect(readStoredView('product', null)).toBe('grid');
    expect(readStoredView('material', null)).toBeNull();
  });

  it("prefers this session's choice over an older stored one", () => {
    const { storage } = memoryStorage({ 'catalog3d.pickerView.product': 'grid' });
    const readOnly: ViewStorage = {
      getItem: storage.getItem,
      setItem: () => {
        throw new Error('quota');
      },
    };
    storeView('product', 'list', readOnly);
    expect(readStoredView('product', readOnly)).toBe('list');
  });

  it('uses whatever the runtime offers by default without throwing', () => {
    expect(() => readStoredView('product')).not.toThrow();
    expect(() => storeView('unit-test-kind', 'list')).not.toThrow();
    expect(readStoredView('unit-test-kind')).toBe('list');
  });
});

describe('shouldShowSearch', () => {
  it('uses the default threshold of 16 items', () => {
    expect(DEFAULT_SEARCH_MIN_ITEMS).toBe(16);
    expect(shouldShowSearch(15)).toBe(false);
    expect(shouldShowSearch(16)).toBe(true);
  });

  it('hides search for the lists that exist today', () => {
    expect(shouldShowSearch(catalog.products.length)).toBe(false);
    expect(shouldShowSearch(library.materials.length + 1)).toBe(false);
  });

  it('takes a host threshold', () => {
    expect(shouldShowSearch(5, 5)).toBe(true);
    expect(shouldShowSearch(4, 5)).toBe(false);
    expect(shouldShowSearch(10_000, Infinity)).toBe(false);
  });
});

describe('moveIndex', () => {
  // 10 items in 4 columns:  0 1 2 3 / 4 5 6 7 / 8 9
  const grid = (index: number, key: string) => moveIndex(index, key, 10, 4, 'grid');
  const list = (index: number, key: string) => moveIndex(index, key, 10, 4, 'list');

  it('moves in two dimensions in the grid', () => {
    expect(grid(1, 'ArrowRight')).toBe(2);
    expect(grid(1, 'ArrowLeft')).toBe(0);
    expect(grid(1, 'ArrowDown')).toBe(5);
    expect(grid(5, 'ArrowUp')).toBe(1);
  });

  it('stops at the edges instead of wrapping', () => {
    expect(grid(0, 'ArrowLeft')).toBe(0);
    expect(grid(9, 'ArrowRight')).toBe(9);
    expect(grid(2, 'ArrowUp')).toBe(2);
    expect(grid(8, 'ArrowDown')).toBe(8);
    expect(grid(3, 'ArrowRight')).toBe(4); // next row, like reading order
  });

  it('goes to the last item when the row below is shorter', () => {
    expect(grid(6, 'ArrowDown')).toBe(9);
    expect(grid(7, 'ArrowDown')).toBe(9);
    expect(grid(5, 'ArrowDown')).toBe(9);
    expect(grid(4, 'ArrowDown')).toBe(8);
  });

  it('moves up and down only in the list', () => {
    expect(list(3, 'ArrowDown')).toBe(4);
    expect(list(3, 'ArrowUp')).toBe(2);
    expect(list(3, 'ArrowLeft')).toBe(3);
    expect(list(3, 'ArrowRight')).toBe(3);
    expect(list(0, 'ArrowUp')).toBe(0);
    expect(list(9, 'ArrowDown')).toBe(9);
  });

  it('handles Home and End in both views', () => {
    for (const move of [grid, list]) {
      expect(move(5, 'Home')).toBe(0);
      expect(move(5, 'End')).toBe(9);
    }
  });

  it('leaves the index alone for other keys, clamps bad input, and copes with no items', () => {
    expect(grid(5, 'a')).toBe(5);
    expect(grid(99, 'ArrowLeft')).toBe(8);
    expect(grid(-3, 'ArrowRight')).toBe(1);
    expect(moveIndex(0, 'ArrowDown', 0, 4, 'grid')).toBe(-1);
    expect(moveIndex(0, 'ArrowDown', 3, 0, 'grid')).toBe(1); // a column count of 0 is treated as 1
    expect(moveIndex(0, 'ArrowDown', 1, 4, 'grid')).toBe(0);
  });
});
