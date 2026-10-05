import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildPartsList, materialsForSlot, validateProduct } from '../../src/viewer/library';
import { LIGHT_PRESETS } from '../../src/viewer/presets';
import type { Catalog, MaterialsLibrary } from '../../src/viewer/types';

const PUBLIC = join(__dirname, '../../public');
const library: MaterialsLibrary = JSON.parse(readFileSync(join(PUBLIC, 'assets/library/materials.json'), 'utf8'));
const catalog: Catalog = JSON.parse(readFileSync(join(PUBLIC, 'assets/library/catalog.json'), 'utf8'));

describe('materials library + catalog', () => {
  it('has unique material ids and every texture file exists', () => {
    const ids = library.materials.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const m of library.materials) {
      for (const tex of [m.map, m.normalMap, m.roughnessMap]) if (tex) expect(existsSync(join(PUBLIC, tex)), tex).toBe(true);
    }
  });

  it('every product validates against the library and its GLB exists', () => {
    for (const p of catalog.products) {
      expect(validateProduct(p, library)).toEqual([]);
      expect(existsSync(join(PUBLIC, p.glb)), p.glb).toBe(true);
    }
  });

  it('chair has at least two independently switchable slots with >1 option each', () => {
    const chair = catalog.products.find((p) => p.id === 'demo-lounge-chair')!;
    expect(chair.slots.length).toBeGreaterThanOrEqual(2);
    for (const s of chair.slots) expect(materialsForSlot(library, s).length).toBeGreaterThan(1);
  });

  it('validateProduct reports a bad default', () => {
    const p = { ...catalog.products[0], slots: [{ id: 'x', label: 'X', allowedCategories: ['wood'], default: 'nope' }] };
    expect(validateProduct(p, library)[0]).toMatch(/not in library/);
  });

  it('buildPartsList emits a stub payload with SKUs and no prices', () => {
    const chair = catalog.products[0];
    const parts = buildPartsList(
      chair,
      library,
      chair.slots.map((def) => ({ def, materialId: def.default, meshCount: 1, sources: ['extras'] })),
      new Date('2026-01-01T00:00:00Z'),
    );
    expect(parts.stub).toBe(true);
    expect(parts.productSku).toBe(chair.sku);
    expect(parts.parts.map((p) => p.slotId)).toEqual(chair.slots.map((s) => s.id));
    expect(parts.parts.every((p) => p.materialSku.startsWith('STUB-'))).toBe(true);
    expect(JSON.stringify(parts)).not.toMatch(/price/i);
  });

  it('ships 2–3 light presets with unique ids', () => {
    expect(LIGHT_PRESETS.length).toBeGreaterThanOrEqual(2);
    expect(LIGHT_PRESETS.length).toBeLessThanOrEqual(3);
    expect(new Set(LIGHT_PRESETS.map((p) => p.id)).size).toBe(LIGHT_PRESETS.length);
  });
});
