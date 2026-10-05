import { BufferAttribute, BufferGeometry, Color, Group, Mesh, MeshStandardMaterial } from 'three';
import { describe, expect, it } from 'vitest';
import {
  associatePackFiles,
  defaultsFromMeta,
  finishToPbr,
  inferPackMapping,
  remapVertexColors,
  resolveModulePackMeta,
  resolvePackColors,
} from '../../src/viewer/packs';
import { registerModuleFactory, unregisterModuleFactory } from '../../src/viewer/modules';
import { createProductFromPack } from '../../src/viewer/packs';

describe('pack association', () => {
  it('pairs mjs + glb by basename stem', () => {
    const mjs = new File([], 'core-rulebook-4aedc7.mjs');
    const glb = new File([], 'core-rulebook-4aedc7.glb');
    const other = new File([], 'readme.txt');
    const r = associatePackFiles([mjs, glb, other]);
    expect(r.association).toBe('basename');
    expect(r.mjs?.name).toBe('core-rulebook-4aedc7.mjs');
    expect(r.glb?.name).toBe('core-rulebook-4aedc7.glb');
  });

  it('marks mjs-only when GLB absent', () => {
    const r = associatePackFiles([new File([], 'book.mjs')]);
    expect(r.association).toBe('single-mjs');
    expect(r.glb).toBeNull();
  });
});

describe('Polyfork-shaped pack meta (observed exports)', () => {
  it('reads params, presets, materials without inventing fields', () => {
    const createAsset = () => new Group();
    const mod = {
      createAsset,
      default: createAsset,
      params: {
        colorway: {
          type: 'choice',
          default: 'emerald',
          options: ['emerald', 'walnut'],
          label: 'Colorway',
        },
        cover: { type: 'color', default: '#163c23', label: 'Cover' },
        state: { type: 'choice', default: 'closed', options: ['closed', 'open'], affects: 'geometry' },
      },
      presets: {
        emerald: { cover: '#163c23', gold: '#d9c56e' },
        walnut: { cover: '#533820', gold: '#d9c56e' },
      },
      materials: {
        cover: { kind: 'leather', finish: 'grain' },
        gold: { kind: 'metal', finish: 'polished' },
      },
    };
    const meta = resolveModulePackMeta(mod);
    expect(meta.via).toBe('createAsset');
    expect(meta.params.map((p) => p.key).sort()).toEqual(['colorway', 'cover', 'state']);
    expect(meta.presets?.walnut.cover).toBe('#533820');
    expect(meta.materials).toHaveLength(2);
    expect(meta.colorZones.sort()).toEqual(['cover', 'gold']);
    expect(finishToPbr(meta.materials[1]).metalness).toBeGreaterThan(0.5);

    const colors = resolvePackColors(meta, { colorway: 'walnut' });
    expect(colors.cover.toLowerCase()).toBe('#533820');
  });
});

describe('pack mapping inference', () => {
  it('maps when mesh names match materials keys', () => {
    const root = new Group();
    const cover = new Mesh(new BufferGeometry(), new MeshStandardMaterial());
    cover.name = 'cover';
    root.add(cover);
    const meta = resolveModulePackMeta({
      createAsset: () => new Group(),
      materials: { cover: { kind: 'leather' }, gold: { kind: 'metal' } },
      params: {},
    });
    const m = inferPackMapping(meta, root);
    expect(m.mappedKeys).toContain('cover');
    expect(m.unknownKeys).toContain('gold');
  });

  it('prefers COLOR_0 zone split (slots) when palette matches and keys do not match meshes', () => {
    const cover = new Color('#163c23');
    const gold = new Color('#d9c56e');
    const geo = new BufferGeometry();
    // Two triangles, non-indexed: cover then gold
    geo.setAttribute(
      'position',
      new BufferAttribute(
        new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0, 2, 0, 0, 3, 0, 0, 2, 1, 0]),
        3,
      ),
    );
    geo.setAttribute(
      'color',
      new BufferAttribute(
        new Float32Array([
          cover.r, cover.g, cover.b, cover.r, cover.g, cover.b, cover.r, cover.g, cover.b,
          gold.r, gold.g, gold.b, gold.r, gold.g, gold.b, gold.r, gold.g, gold.b,
        ]),
        3,
      ),
    );
    const mesh = new Mesh(geo, new MeshStandardMaterial({ vertexColors: true }));
    mesh.name = 'book';
    const root = new Group();
    root.add(mesh);
    const meta = resolveModulePackMeta({
      createAsset: () => new Group(),
      materials: { cover: { kind: 'leather' }, gold: { kind: 'metal' }, ink: { kind: 'paint' } },
      params: {
        colorway: { type: 'choice', default: 'emerald', options: ['emerald'] },
        cover: { type: 'color', default: '#163c23' },
        gold: { type: 'color', default: '#d9c56e' },
        ink: { type: 'color', default: '#3c2b26' },
      },
      presets: { emerald: { cover: '#163c23', gold: '#d9c56e', ink: '#3c2b26' } },
    });
    const m = inferPackMapping(meta, root);
    expect(m.mappingMode).toBe('slots');
    expect(m.mappedKeys.sort()).toEqual(['cover', 'gold']);
    expect(m.unknownKeys).toEqual(['ink']);
    expect(m.notes.some((n) => /COLOR_0 zone split/i.test(n))).toBe(true);
  });

  it('falls back to vertex-colors when COLOR_0 present but palette does not match', () => {
    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]), 3));
    geo.setAttribute('color', new BufferAttribute(new Float32Array([0.9, 0.1, 0.1, 0.9, 0.1, 0.1, 0.9, 0.1, 0.1]), 3));
    const mesh = new Mesh(geo, new MeshStandardMaterial({ vertexColors: true }));
    mesh.name = 'book';
    const root = new Group();
    root.add(mesh);
    const meta = resolveModulePackMeta({
      createAsset: () => new Group(),
      materials: { cover: { kind: 'leather' }, gold: { kind: 'metal' } },
      params: {
        cover: { type: 'color', default: '#163c23' },
        gold: { type: 'color', default: '#d9c56e' },
      },
    });
    const m = inferPackMapping(meta, root);
    expect(m.mappingMode).toBe('vertex-colors');
    expect(m.unknownKeys.sort()).toEqual(['cover', 'gold']);
    expect(m.notes.some((n) => /fallback/i.test(n))).toBe(true);
  });

  it('remaps vertex colors between palettes', () => {
    const fromHex = '#163c23';
    const toHex = '#533820';
    const c = new Color(fromHex);
    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]), 3));
    geo.setAttribute('color', new BufferAttribute(new Float32Array([c.r, c.g, c.b, c.r, c.g, c.b, c.r, c.g, c.b]), 3));
    const mesh = new Mesh(geo, new MeshStandardMaterial({ vertexColors: true }));
    const root = new Group();
    root.add(mesh);
    const r = remapVertexColors(root, { cover: fromHex }, { cover: toHex });
    expect(r.remappedVertices).toBe(3);
    expect(r.zonesHit).toEqual(['cover']);
    const out = mesh.geometry.getAttribute('color');
    const want = new Color(toHex);
    expect(out.getX(0)).toBeCloseTo(want.r, 4);
    expect(out.getY(0)).toBeCloseTo(want.g, 4);
    expect(out.getZ(0)).toBeCloseTo(want.b, 4);
  });
});

describe('createProductFromPack', () => {
  it('marks mjs-only incomplete and registers factory', () => {
    const createAsset = () => new Group();
    const meta = resolveModulePackMeta({ createAsset, params: {}, materials: {} });
    const { product, status, initialParams } = createProductFromPack({
      mjsFile: new File([], 'demo.mjs'),
      glbFile: null,
      meta,
      defaultMaterialId: 'wood-oak',
    });
    expect(status.completeness).toBe('mjs-only');
    expect(product.sourceKind).toBe('mjs-module');
    expect(product.pack?.hasGlb).toBe(false);
    expect(defaultsFromMeta(meta)).toEqual(initialParams);
    expect(registerModuleFactory).toBeTruthy();
    unregisterModuleFactory(product.id);
  });
});
