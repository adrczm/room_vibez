import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  NUDGE_BIG_STEP_M,
  NUDGE_STEP_M,
  finishForPlacing,
  isNudgeKey,
  nudgedPosition,
  placementRows,
  quarterTurn,
} from '../../src/placedProducts';
import type { Catalog, MaterialsLibrary } from '../../src/viewer/types';

const ROOT = join(__dirname, '../..');
const library = JSON.parse(readFileSync(join(ROOT, 'public/assets/library/materials.json'), 'utf8')) as MaterialsLibrary;
const catalog = JSON.parse(readFileSync(join(ROOT, 'public/assets/library/catalog.json'), 'utf8')) as Catalog;
const chair = catalog.products.find((p) => p.id === 'demo-lounge-chair')!;
const table = catalog.products.find((p) => p.id === 'demo-side-table')!;
const CHAIR_DEFAULTS = { frame: 'wood-oak', handles: 'plastic-black', pillow: 'wool-cream' };

const placement = (id: string, product_id: string, sku_id = `SKU-${product_id}`) => ({ id, product_id, sku_id });

describe('placementRows (UX-09 item 2: rows numbered per product)', () => {
  it('numbers the placements of one product in list order', () => {
    const rows = placementRows([placement('a', chair.id), placement('b', chair.id)], catalog.products);
    expect(rows.map((r) => r.label)).toEqual(['Lounge chair (demo) 1', 'Lounge chair (demo) 2']);
    expect(rows.map((r) => [r.id, r.name, r.n, r.inCatalog])).toEqual([
      ['a', 'Lounge chair (demo)', 1, true],
      ['b', 'Lounge chair (demo)', 2, true],
    ]);
  });

  it('counts each product on its own, whatever the order in the list', () => {
    const rows = placementRows(
      [placement('a', chair.id), placement('b', table.id), placement('c', chair.id), placement('d', table.id)],
      catalog.products,
    );
    expect(rows.map((r) => r.label)).toEqual([
      'Lounge chair (demo) 1',
      'Side table (demo) 1',
      'Lounge chair (demo) 2',
      'Side table (demo) 2',
    ]);
  });

  it('numbers a single placement too, and gives an empty list for no placements', () => {
    expect(placementRows([placement('a', table.id)], catalog.products)[0]!.label).toBe('Side table (demo) 1');
    expect(placementRows([], catalog.products)).toEqual([]);
  });

  it('moves the rows behind a deleted one up: the numbers are positions, not ids', () => {
    const all = [placement('a', chair.id), placement('b', chair.id), placement('c', chair.id)];
    const afterDelete = placementRows(all.filter((p) => p.id !== 'a'), catalog.products);
    expect(afterDelete.map((r) => [r.id, r.label])).toEqual([
      ['b', 'Lounge chair (demo) 1'],
      ['c', 'Lounge chair (demo) 2'],
    ]);
  });

  it('names a placement whose product is not in the catalog by its SKU and marks it', () => {
    const rows = placementRows(
      [placement('a', chair.id), placement('b', 'upload-gone', 'STUB-SKU-UPLOAD-X'), placement('c', 'upload-gone', 'STUB-SKU-UPLOAD-X')],
      catalog.products,
    );
    expect(rows[1]).toEqual({ id: 'b', name: 'STUB-SKU-UPLOAD-X', n: 1, label: 'STUB-SKU-UPLOAD-X 1', inCatalog: false });
    expect(rows[2]!.label).toBe('STUB-SKU-UPLOAD-X 2');
    expect(rows[0]!.inCatalog).toBe(true);
  });

  it('never gives two rows the same label when two products share a name', () => {
    const products = [
      { id: 'upload-1', name: 'stool' },
      { id: 'upload-2', name: 'stool' },
    ];
    const rows = placementRows([placement('a', 'upload-1'), placement('b', 'upload-2'), placement('c', 'upload-1')], products);
    expect(rows.map((r) => r.label)).toEqual(['stool 1', 'stool 2', 'stool 3']);
  });
});

describe('nudgedPosition (UX-09 item 3: arrow keys, 5 cm, Shift = 25 cm)', () => {
  it('has the two step sizes of the handoff', () => {
    expect(NUDGE_STEP_M).toBe(0.05);
    expect(NUDGE_BIG_STEP_M).toBe(0.25);
  });

  it('moves along the room axes of the 2D plan: Left and Right on x, Up and Down on z', () => {
    const from = { x: 1, z: 2 };
    expect(nudgedPosition(from, 'ArrowLeft')).toEqual({ x: 0.95, z: 2 });
    expect(nudgedPosition(from, 'ArrowRight')).toEqual({ x: 1.05, z: 2 });
    expect(nudgedPosition(from, 'ArrowUp')).toEqual({ x: 1, z: 1.95 });
    expect(nudgedPosition(from, 'ArrowDown')).toEqual({ x: 1, z: 2.05 });
  });

  it('takes the big step with Shift', () => {
    const from = { x: -0.5, z: 0 };
    expect(nudgedPosition(from, 'ArrowLeft', true)).toEqual({ x: -0.75, z: 0 });
    expect(nudgedPosition(from, 'ArrowRight', true)).toEqual({ x: -0.25, z: 0 });
    expect(nudgedPosition(from, 'ArrowUp', true)).toEqual({ x: -0.5, z: -0.25 });
    expect(nudgedPosition(from, 'ArrowDown', true)).toEqual({ x: -0.5, z: 0.25 });
  });

  it('leaves no float noise after many steps, and a step back undoes a step', () => {
    let p = { x: 0.1, z: 0 };
    for (let i = 0; i < 20; i++) p = nudgedPosition(p, 'ArrowRight')!;
    expect(p).toEqual({ x: 1.1, z: 0 });
    expect(nudgedPosition(nudgedPosition({ x: 0.8, z: -0.5 }, 'ArrowUp')!, 'ArrowDown')).toEqual({ x: 0.8, z: -0.5 });
  });

  it('does not change the object it is given', () => {
    const from = { x: 0, z: 0 };
    nudgedPosition(from, 'ArrowRight', true);
    expect(from).toEqual({ x: 0, z: 0 });
  });

  it('returns null for every other key', () => {
    for (const key of ['r', 'R', 'Delete', 'Backspace', 'Enter', ' ', 'a', 'Left', 'toString', 'constructor']) {
      expect(nudgedPosition({ x: 0, z: 0 }, key), key).toBeNull();
      expect(isNudgeKey(key), key).toBe(false);
    }
    for (const key of ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']) expect(isNudgeKey(key)).toBe(true);
  });
});

describe('quarterTurn (UX-09 item 3: rotate by 90 degrees)', () => {
  it('turns left counter-clockwise and right clockwise, a quarter each', () => {
    expect(quarterTurn(0, 'left')).toBeCloseTo(Math.PI / 2, 12);
    expect(quarterTurn(0, 'right')).toBeCloseTo(-Math.PI / 2, 12);
    expect(quarterTurn(0.3, 'left')).toBeCloseTo(0.3 + Math.PI / 2, 12);
  });

  it('is undone by the opposite turn', () => {
    for (const start of [0, 0.3, -1.2, Math.PI / 2, Math.PI]) {
      expect(quarterTurn(quarterTurn(start, 'left'), 'right')).toBeCloseTo(start, 12);
      expect(quarterTurn(quarterTurn(start, 'right'), 'left')).toBeCloseTo(start, 12);
    }
  });

  it('comes back to the start after four turns, and to exactly 0 from 0', () => {
    for (const direction of ['left', 'right'] as const) {
      let a = 0;
      for (let i = 0; i < 4; i++) a = quarterTurn(a, direction);
      expect(a).toBe(0);
      let b = 0.7;
      for (let i = 0; i < 4; i++) b = quarterTurn(b, direction);
      expect(b).toBeCloseTo(0.7, 12);
    }
  });

  it('keeps the angle within (-π, π]', () => {
    for (const direction of ['left', 'right'] as const) {
      let a = 0.1;
      for (let i = 0; i < 25; i++) {
        a = quarterTurn(a, direction);
        expect(a).toBeGreaterThan(-Math.PI);
        expect(a).toBeLessThanOrEqual(Math.PI);
      }
    }
    expect(quarterTurn(Math.PI / 2, 'left')).toBeCloseTo(Math.PI, 12); // π itself is kept, not turned into -π
    expect(quarterTurn(-Math.PI / 2, 'right')).toBeCloseTo(Math.PI, 12);
  });
});

describe('finishForPlacing (UX-16 step 2: the chosen finish is the finish placed)', () => {
  const shown = (productId: string | undefined, choices: Record<string, string>) => ({
    productId,
    slots: Object.entries(choices).map(([id, materialId]) => ({ def: { id }, materialId })),
  });

  it('uses the choices on the Materials card when they belong to the product', () => {
    expect(finishForPlacing(chair, shown(chair.id, { ...CHAIR_DEFAULTS, frame: 'wood-walnut' }), library)).toEqual({
      ...CHAIR_DEFAULTS,
      frame: 'wood-walnut',
    });
  });

  it('has one entry per slot of the product, also for a slot the card does not list', () => {
    expect(finishForPlacing(chair, shown(chair.id, { pillow: 'wool-terracotta' }), library)).toEqual({
      ...CHAIR_DEFAULTS,
      pillow: 'wool-terracotta',
    });
  });

  it('gives the default finish while the card still shows another product, or nothing', () => {
    expect(finishForPlacing(chair, shown(table.id, { top: 'wood-walnut', legs: 'metal-black' }), library)).toEqual(CHAIR_DEFAULTS);
    expect(finishForPlacing(chair, shown(undefined, { frame: 'wood-walnut' }), library)).toEqual(CHAIR_DEFAULTS);
    expect(finishForPlacing(chair, null, library)).toEqual(CHAIR_DEFAULTS);
    expect(finishForPlacing(chair, undefined, library)).toEqual(CHAIR_DEFAULTS);
  });

  it('falls back to the default for a material the library lacks or the slot does not allow', () => {
    expect(
      finishForPlacing(chair, shown(chair.id, { frame: 'no-such-material', handles: 'wool-cream', pillow: 'wool-terracotta' }), library),
    ).toEqual({ ...CHAIR_DEFAULTS, pillow: 'wool-terracotta' });
  });

  it('ignores a slot the product does not define', () => {
    expect(finishForPlacing(table, shown(table.id, { top: 'wood-walnut', ghost: 'wood-oak' }), library)).toEqual({
      top: 'wood-walnut',
      legs: 'metal-brass',
    });
  });
});
