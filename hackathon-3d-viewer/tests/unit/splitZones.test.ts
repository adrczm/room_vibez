import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  Group,
  Mesh,
  MeshStandardMaterial,
  type Object3D,
} from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { discoverSlots } from '../../src/viewer/slots';
import {
  ensurePackZoneSlots,
  inferPackMapping,
  resolveModulePackMeta,
  splitVertexColorZones,
} from '../../src/viewer/packs';

const MODELS = '/Users/adrian/Desktop/Room Vibez/models';

function loadGlbAbs(abs: string): Promise<Object3D> {
  const buf = readFileSync(abs);
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  return new Promise((resolve, reject) => new GLTFLoader().parse(ab, '', (g) => resolve(g.scene), reject));
}

describe('splitVertexColorZones', () => {
  it('splits a COLOR_0 mesh into slot_<zone> children with material_slot_id', () => {
    const cover = new Color('#163c23');
    const gold = new Color('#d9c56e');
    const geo = new BufferGeometry();
    geo.setAttribute(
      'position',
      new BufferAttribute(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0, 2, 0, 0, 3, 0, 0, 2, 1, 0]), 3),
    );
    geo.setAttribute(
      'normal',
      new BufferAttribute(new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1]), 3),
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

    const result = splitVertexColorZones(root, { cover: '#163c23', gold: '#d9c56e', ink: '#3c2b26' });
    expect(result.ok).toBe(true);
    expect(result.zonesCreated).toEqual(['cover', 'gold']);
    expect(result.meshCount).toBe(2);
    expect(result.facesSplit).toBe(2);

    const found = discoverSlots(root);
    expect([...found.slots.keys()].sort()).toEqual(['cover', 'gold']);
    expect(found.untagged).toHaveLength(0);
    expect(found.slots.get('cover')!.meshes[0].name).toBe('slot_cover');
    expect(found.slots.get('cover')!.meshes[0].userData.material_slot_id).toBe('cover');
    expect(found.slots.get('cover')!.meshes[0].geometry.getAttribute('normal')).toBeTruthy();
    // Original mesh replaced
    expect(root.children).toHaveLength(1);
    expect(root.children[0].type).toBe('Group');
  });

  it('is idempotent when children already tagged as packSplitZone', () => {
    const cover = new Color('#163c23');
    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]), 3));
    geo.setAttribute(
      'color',
      new BufferAttribute(new Float32Array([cover.r, cover.g, cover.b, cover.r, cover.g, cover.b, cover.r, cover.g, cover.b]), 3),
    );
    const mesh = new Mesh(geo, new MeshStandardMaterial({ vertexColors: true }));
    const root = new Group();
    root.add(mesh);
    const first = splitVertexColorZones(root, { cover: '#163c23' });
    expect(first.ok).toBe(true);
    const second = splitVertexColorZones(root, { cover: '#163c23' });
    expect(second.ok).toBe(false); // no unsplit COLOR_0 meshes left
    expect(discoverSlots(root).slots.get('cover')!.meshes).toHaveLength(1);
  });
});

describe('core-rulebook GLB smoke (COLOR_0 → slots)', () => {
  it('probes emerald zones and splits into cover/gold/gilt/paper/ribbon', async () => {
    const root = await loadGlbAbs(join(MODELS, 'core-rulebook-4aedc7.glb'));
    const meta = resolveModulePackMeta({
      createAsset: () => new Group(),
      materials: {
        cover: { kind: 'leather', finish: 'grain' },
        gold: { kind: 'metal', finish: 'polished' },
        gilt: { kind: 'metal', finish: 'polished' },
        paper: { kind: 'paper', finish: 'plain' },
        ribbon: { kind: 'fabric', finish: 'cotton' },
        ink: { kind: 'paint', finish: 'matte' },
      },
      params: {
        colorway: { type: 'choice', default: 'emerald', options: ['emerald'] },
        cover: { type: 'color', default: '#163c23' },
        gold: { type: 'color', default: '#d9c56e' },
        gilt: { type: 'color', default: '#b2a15d' },
        paper: { type: 'color', default: '#d3bd92' },
        ribbon: { type: 'color', default: '#277140' },
        ink: { type: 'color', default: '#3c2b26' },
      },
      presets: {
        emerald: {
          cover: '#163c23',
          gold: '#d9c56e',
          gilt: '#b2a15d',
          paper: '#d3bd92',
          ribbon: '#277140',
          ink: '#3c2b26',
        },
      },
    });

    const mapping = inferPackMapping(meta, root);
    expect(mapping.mappingMode).toBe('slots');
    expect(mapping.mappedKeys.sort()).toEqual(['cover', 'gilt', 'gold', 'paper', 'ribbon']);
    expect(mapping.unknownKeys).toEqual(['ink']); // closed book — no ink faces

    const split = ensurePackZoneSlots(root, meta);
    expect(split.ok).toBe(true);
    expect(split.zonesCreated).toEqual(['cover', 'gilt', 'gold', 'paper', 'ribbon']);

    const found = discoverSlots(root);
    expect([...found.slots.keys()].sort()).toEqual(['cover', 'gilt', 'gold', 'paper', 'ribbon']);
    expect(found.untagged).toHaveLength(0);
    for (const id of mapping.mappedKeys) {
      expect([...found.slots.get(id)!.sources]).toContain('extras');
    }
  });
});
