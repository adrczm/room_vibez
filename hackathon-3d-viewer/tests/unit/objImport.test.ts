import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import {
  createProductFromModelFiles,
  createProductFromObjPackage,
  isModelFile,
  isObjFile,
  slotIdFromLabel,
} from '../../src/viewer/uploads';

const FIXTURE = join(dirname(fileURLToPath(import.meta.url)), '../fixtures/obj-stool');

function fileFrom(path: string, type?: string): File {
  const buf = readFileSync(path);
  const name = path.split('/').pop()!;
  return new File([buf], name, { type });
}

describe('OBJ import helpers', () => {
  it('recognizes OBJ vs GLB', () => {
    expect(isObjFile(new File([], 'chair.obj'))).toBe(true);
    expect(isObjFile(new File([], 'chair.glb'))).toBe(false);
    expect(isModelFile(new File([], 'chair.obj'))).toBe(false);
    expect(isModelFile(new File([], 'chair.glb'))).toBe(true);
  });

  it('slugifies material / object names to slot ids', () => {
    expect(slotIdFromLabel('Wall_Down')).toBe('wall-down');
    expect(slotIdFromLabel('Top')).toBe('top');
  });

  it('loads fixture OBJ+MTL+texture into a Product with top/legs slots', async () => {
    const files = [
      fileFrom(join(FIXTURE, 'stool.obj'), 'model/obj'),
      fileFrom(join(FIXTURE, 'stool.mtl'), 'text/plain'),
      fileFrom(join(FIXTURE, 'wood.png'), 'image/png'),
      fileFrom(join(FIXTURE, 'stool.slots.json'), 'application/json'),
    ];
    const { product, sessionUrls, materials, warnings } = await createProductFromObjPackage(files, {
      defaultMaterialId: 'wood-oak',
    });
    try {
      expect(product.name).toBe('stool');
      expect(product.glb.startsWith('blob:')).toBe(true);
      expect(product.userAdded).toBe(true);
      const ids = product.slots.map((s) => s.id).sort();
      expect(ids).toEqual(['legs', 'top']);
      expect(product.slotTagging).toMatch(/obj-usemtl/);
      expect(materials.length).toBeGreaterThanOrEqual(1);
      expect(warnings.missingMtl).toBe(false);
      expect(warnings.meshesWithoutUv.length).toBe(0);
    } finally {
      for (const u of sessionUrls) URL.revokeObjectURL(u);
    }
  }, 30_000);

  it('routes OBJ through createProductFromModelFiles', async () => {
    const files = [
      fileFrom(join(FIXTURE, 'stool.obj')),
      fileFrom(join(FIXTURE, 'stool.mtl')),
      fileFrom(join(FIXTURE, 'wood.png')),
    ];
    const result = await createProductFromModelFiles(files, { defaultMaterialId: 'wood-oak' });
    try {
      expect(result.product.slots.some((s) => s.id === 'top' || s.id === 'legs')).toBe(true);
      expect(result.warnings).toBeDefined();
    } finally {
      for (const u of result.sessionUrls) URL.revokeObjectURL(u);
    }
  }, 30_000);

  it('rejects mixed OBJ + GLB selection', async () => {
    await expect(
      createProductFromModelFiles(
        [new File([new Uint8Array([1])], 'a.obj'), new File([new Uint8Array([1])], 'b.glb')],
        { defaultMaterialId: 'wood-oak' },
      ),
    ).rejects.toThrow(/either an OBJ package or a GLB/);
  });

  it('errors clearly on empty OBJ', async () => {
    await expect(
      createProductFromObjPackage([new File(['   '], 'empty.obj')], { defaultMaterialId: 'wood-oak' }),
    ).rejects.toThrow(/empty|no meshes|Could not parse/i);
  });
});
