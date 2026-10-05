import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { resolveBindings } from '../../src/viewer/slots';
import type { Catalog, MaterialsLibrary } from '../../src/viewer/types';

const ROOT = join(__dirname, '../..');
const library = JSON.parse(readFileSync(join(ROOT, 'public/assets/library/materials.json'), 'utf8')) as MaterialsLibrary;
const catalog = JSON.parse(readFileSync(join(ROOT, 'public/assets/library/catalog.json'), 'utf8')) as Catalog;
const chair = catalog.products.find((p) => p.id === 'demo-lounge-chair')!;
const DEFAULTS = { frame: 'wood-oak', handles: 'plastic-black', pillow: 'wool-cream' };

describe('resolveBindings', () => {
  it('fills every slot with its default when nothing is requested', () => {
    for (const requested of [undefined, null, {}]) {
      const r = resolveBindings(chair, requested, library);
      expect(r.bindings).toEqual(DEFAULTS);
      expect(r.rejected).toEqual([]);
    }
  });

  it('keeps a valid requested material and defaults the rest', () => {
    const r = resolveBindings(chair, { frame: 'wood-walnut' }, library);
    expect(r.bindings).toEqual({ ...DEFAULTS, frame: 'wood-walnut' });
    expect(r.rejected).toEqual([]);
  });

  it('drops a material the library does not have and keeps the default', () => {
    const r = resolveBindings(chair, { frame: 'wood-does-not-exist', pillow: 'wool-forest' }, library);
    expect(r.bindings).toEqual({ ...DEFAULTS, pillow: 'wool-forest' });
    expect(r.rejected).toEqual([{ slotId: 'frame', materialId: 'wood-does-not-exist', reason: 'unknown-material' }]);
  });

  it('drops a material whose category the slot does not allow', () => {
    // frame allows wood only; wool-cream is a textile.
    const r = resolveBindings(chair, { frame: 'wool-cream', handles: 'metal-brass' }, library);
    expect(r.bindings).toEqual({ ...DEFAULTS, handles: 'metal-brass' });
    expect(r.rejected).toEqual([{ slotId: 'frame', materialId: 'wool-cream', reason: 'category-not-allowed' }]);
  });

  it('drops slots the product does not define', () => {
    const r = resolveBindings(chair, { legs: 'metal-black', frame: 'wood-black' }, library);
    expect(r.bindings).toEqual({ ...DEFAULTS, frame: 'wood-black' });
    expect(Object.keys(r.bindings)).toEqual(['frame', 'handles', 'pillow']);
    expect(r.rejected).toEqual([{ slotId: 'legs', materialId: 'metal-black', reason: 'unknown-slot' }]);
  });

  it('never throws on a damaged saved binding', () => {
    const damaged = { frame: 42, handles: null, pillow: '', extra: { a: 1 } } as unknown as Record<string, unknown>;
    const r = resolveBindings(chair, damaged, library);
    expect(r.bindings).toEqual(DEFAULTS);
    expect(r.rejected.map((x) => [x.slotId, x.reason])).toEqual([
      ['extra', 'unknown-slot'],
      ['frame', 'not-a-string'],
      ['handles', 'not-a-string'],
      ['pillow', 'not-a-string'],
    ]);
    expect(() => resolveBindings(chair, 'nonsense' as unknown as Record<string, unknown>, library)).not.toThrow();
    expect(resolveBindings(chair, [] as unknown as Record<string, unknown>, library).bindings).toEqual(DEFAULTS);
  });

  it('without a library only checks slot ids and value types', () => {
    const r = resolveBindings(chair, { frame: 'anything-goes', legs: 'x' });
    expect(r.bindings).toEqual({ ...DEFAULTS, frame: 'anything-goes' });
    expect(r.rejected).toEqual([{ slotId: 'legs', materialId: 'x', reason: 'unknown-slot' }]);
  });

  it('does not mutate its inputs and returns no slots for a slot-less product', () => {
    const requested = { frame: 'wood-walnut' };
    resolveBindings(chair, requested, library);
    expect(requested).toEqual({ frame: 'wood-walnut' });
    expect(resolveBindings({ slots: [] }, { frame: 'wood-walnut' }, library).bindings).toEqual({});
  });
});
