import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { Group, Mesh, BoxGeometry, BufferGeometry, Float32BufferAttribute, MeshBasicMaterial, type Object3D } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import {
  bindUntaggedToFallback,
  discoverSlots,
  ensureMeshNormals,
  meshesMissingUv,
  resolveSlotId,
} from '../../src/viewer/slots';

const ROOT = join(__dirname, '../..');

function loadGlb(rel: string): Promise<Object3D> {
  const buf = readFileSync(join(ROOT, 'public', rel));
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  return new Promise((resolve, reject) => new GLTFLoader().parse(ab, '', (g) => resolve(g.scene), reject));
}

const mesh = (name: string, userData: Record<string, unknown> = {}) => {
  const m = new Mesh(new BoxGeometry(), new MeshBasicMaterial());
  m.name = name;
  Object.assign(m.userData, userData);
  return m;
};

describe('resolveSlotId', () => {
  it('prefers glTF extras over sidecar and name', () => {
    const m = mesh('slot_legs__x', { material_slot_id: 'frame' });
    expect(resolveSlotId(m, { slot_legs__x: 'pillow' })).toEqual({ slotId: 'frame', source: 'extras' });
  });

  it('uses the sidecar before the name convention', () => {
    expect(resolveSlotId(mesh('slot_legs__x'), { slot_legs__x: 'pillow' })).toEqual({ slotId: 'pillow', source: 'sidecar' });
  });

  it('parses the node-name convention slot_<id>__<part>', () => {
    expect(resolveSlotId(mesh('slot_top__tabletop'))?.slotId).toBe('top');
    expect(resolveSlotId(mesh('slot_seat_back__cushion'))?.slotId).toBe('seat_back');
    expect(resolveSlotId(mesh('slot_legs'))?.slotId).toBe('legs');
  });

  it('inherits from the nearest tagged ancestor', () => {
    const g = new Group();
    g.userData.material_slot_id = 'frame';
    const child = mesh('leg');
    g.add(child);
    expect(resolveSlotId(child)).toEqual({ slotId: 'frame', source: 'extras' });
  });

  it('returns null for untagged meshes', () => {
    expect(resolveSlotId(mesh('random_mesh'))).toBeNull();
    expect(resolveSlotId(mesh('slotless'))).toBeNull();
  });
});

describe('upload fallback binding', () => {
  it('binds every untagged mesh to surface with source fallback', () => {
    const root = new Group();
    const a = mesh('Seat');
    const b = mesh('Back');
    const c = mesh('Leg');
    root.add(a, b, c);
    const found = discoverSlots(root);
    expect(found.slots.size).toBe(0);
    expect(found.untagged).toHaveLength(3);

    bindUntaggedToFallback(found, 'surface');
    expect(found.untagged).toHaveLength(0);
    expect(found.slots.get('surface')!.meshes.map((m) => m.name).sort()).toEqual(['Back', 'Leg', 'Seat']);
    expect([...found.slots.get('surface')!.sources]).toEqual(['fallback']);
  });

  it('merges untagged into an existing surface slot without dropping tagged meshes', () => {
    const root = new Group();
    root.add(mesh('slot_top__a'), mesh('loose'));
    const found = discoverSlots(root);
    expect([...found.slots.keys()]).toEqual(['top']);
    expect(found.untagged).toHaveLength(1);
    bindUntaggedToFallback(found, 'surface');
    expect(found.slots.get('top')!.meshes).toHaveLength(1);
    expect(found.slots.get('surface')!.meshes).toHaveLength(1);
  });
});

describe('geometry helpers for library materials', () => {
  it('computes missing normals so MeshStandardMaterial can light', () => {
    const geo = new BufferGeometry();
    geo.setAttribute('position', new Float32BufferAttribute([-1, 0, 0, 1, 0, 0, 0, 1, 0], 3));
    const m = new Mesh(geo, new MeshBasicMaterial());
    m.name = 'tri';
    const root = new Group();
    root.add(m);
    expect(meshesMissingUv(root)).toEqual(['tri']);
    expect(ensureMeshNormals(root)).toEqual(['tri']);
    expect(m.geometry.attributes.normal).toBeTruthy();
    expect(ensureMeshNormals(root)).toEqual([]); // idempotent
  });
});

describe('demo GLBs (pre-baked conversion output)', () => {
  it('lounge chair exposes frame / handles / pillow via extras', async () => {
    const { slots, untagged } = discoverSlots(await loadGlb('assets/models/lounge-chair.glb'));
    expect([...slots.keys()].sort()).toEqual(['frame', 'handles', 'pillow']);
    expect(untagged).toHaveLength(0);
    for (const s of slots.values()) expect([...s.sources]).toEqual(['extras']);
    expect(slots.get('frame')!.meshes.length).toBe(10);
    expect(slots.get('handles')!.meshes.length).toBe(2);
    expect(slots.get('pillow')!.meshes.length).toBe(2);
  });

  it('side table exposes top / legs via node names', async () => {
    const { slots, untagged } = discoverSlots(await loadGlb('assets/models/side-table.glb'));
    expect([...slots.keys()].sort()).toEqual(['legs', 'top']);
    expect(untagged).toHaveLength(0);
    for (const s of slots.values()) expect([...s.sources]).toEqual(['name']);
  });
});
