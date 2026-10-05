import { Group, Mesh, BoxGeometry, MeshBasicMaterial } from 'three';
import { describe, expect, it } from 'vitest';
import {
  ModuleContractError,
  createProductFromModuleAsset,
  getModuleFactory,
  resolveModuleAsset,
  rewriteThreeBareImports,
  unregisterModuleFactory,
} from '../../src/viewer/modules';

describe('mjs module contract', () => {
  it('rewrites bare three and three/addons imports to absolute URLs', () => {
    const src = `
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
`;
    const out = rewriteThreeBareImports(src, {
      three: 'http://127.0.0.1:18767/node_modules/three/build/three.module.js',
      addonsBase: 'http://127.0.0.1:18767/node_modules/three/examples/jsm/',
    });
    expect(out).toContain("from 'http://127.0.0.1:18767/node_modules/three/build/three.module.js'");
    expect(out).toContain(
      "from 'http://127.0.0.1:18767/node_modules/three/examples/jsm/utils/BufferGeometryUtils.js'",
    );
    expect(out).not.toMatch(/from 'three'/);
  });

  it('resolves named createAsset factory (Polyfork-style)', () => {
    const g = new Group();
    g.name = 'asset';
    const createAsset = () => g.clone(true);
    const resolved = resolveModuleAsset({ createAsset, params: {}, default: createAsset });
    expect(resolved.via).toBe('createAsset');
    expect(resolved.createAsset().isObject3D).toBe(true);
    expect(resolved.exportKeys).toContain('createAsset');
  });

  it('resolves default Object3D', () => {
    const mesh = new Mesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial());
    const resolved = resolveModuleAsset({ default: mesh });
    expect(resolved.via).toBe('default-object3d');
    expect(resolved.createAsset().isObject3D).toBe(true);
  });

  it('lists export keys when contract is missing', () => {
    try {
      resolveModuleAsset({ params: {}, materials: {} });
      expect.unreachable('should throw');
    } catch (err) {
      expect(err).toBeInstanceOf(ModuleContractError);
      expect((err as ModuleContractError).exportKeys).toEqual(['materials', 'params']);
      expect(String(err)).toMatch(/Exports: materials, params/);
    }
  });

  it('registers a product factory for remount', () => {
    const createAsset = () => new Group();
    const product = createProductFromModuleAsset('book.mjs', {
      createAsset,
      exportKeys: ['createAsset', 'default'],
      via: 'createAsset',
    }, { defaultMaterialId: 'wood-oak' });
    expect(product.sourceKind).toBe('mjs-module');
    expect(product.preserveMaterials).toBe(true);
    expect(product.glb.startsWith('module://')).toBe(true);
    expect(getModuleFactory(product.id)?.()).toBeTruthy();
    unregisterModuleFactory(product.id);
    expect(getModuleFactory(product.id)).toBeUndefined();
  });
});
