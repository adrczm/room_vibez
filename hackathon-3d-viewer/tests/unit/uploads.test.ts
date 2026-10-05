import { describe, expect, it } from 'vitest';
import {
  attachTextureToMaterial,
  createMaterialFromTexture,
  isModelFile,
  isTextureFile,
} from '../../src/viewer/uploads';
import type { LibraryMaterial } from '../../src/viewer/types';

describe('session uploads', () => {
  it('recognizes model and texture extensions', () => {
    expect(isModelFile(new File([], 'chair.glb'))).toBe(true);
    expect(isModelFile(new File([], 'chair.gltf'))).toBe(true);
    // OBJ is a separate package path (isObjFile), not glTF model/gltf
    expect(isModelFile(new File([], 'chair.obj'))).toBe(false);
    expect(isTextureFile(new File([], 'wood.png'))).toBe(true);
    expect(isTextureFile(new File([], 'wood.webp'))).toBe(true);
    expect(isTextureFile(new File([], 'wood.gif'))).toBe(false);
  });

  it('creates a library material with baseColor Object URL', () => {
    const file = new File([new Uint8Array([1, 2, 3])], 'oak-plank.png', { type: 'image/png' });
    const { material, objectUrl } = createMaterialFromTexture(file, { category: 'wood', name: 'Oak plank' });
    expect(material.category).toBe('wood');
    expect(material.name).toBe('Oak plank');
    expect(material.map).toBe(objectUrl);
    expect(material.sku.startsWith('STUB-MAT-USER-')).toBe(true);
    URL.revokeObjectURL(objectUrl);
  });

  it('attaches normal/roughness maps onto an existing material', () => {
    const mat: LibraryMaterial = {
      id: 'wood-oak',
      name: 'Natural oak',
      category: 'wood',
      sku: 'STUB',
      color: '#ffffff',
      roughness: 0.5,
      metalness: 0,
    };
    const n = attachTextureToMaterial(mat, new File([], 'n.png', { type: 'image/png' }), 'normalMap');
    const r = attachTextureToMaterial(mat, new File([], 'r.png', { type: 'image/png' }), 'roughnessMap');
    expect(mat.normalMap).toBe(n.objectUrl);
    expect(mat.roughnessMap).toBe(r.objectUrl);
    URL.revokeObjectURL(n.objectUrl);
    URL.revokeObjectURL(r.objectUrl);
  });
});
