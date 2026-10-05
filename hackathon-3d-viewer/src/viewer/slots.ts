import type { Mesh, Object3D } from 'three';
import type { SlotSource } from './types';

/** Node-name convention: `slot_<slotId>__<partName>` (or just `slot_<slotId>`). */
const NAME_CONVENTION = /^slot_([a-z0-9-]+(?:_[a-z0-9-]+)*?)(?:__.*)?$/i;

export interface ResolvedSlot {
  slotId: string;
  source: SlotSource;
}

/** Slot id from a node's own tags only (no ancestors). */
function ownSlot(obj: Object3D, sidecar?: Record<string, string>): ResolvedSlot | null {
  const extra = obj.userData?.material_slot_id;
  if (typeof extra === 'string' && extra.length > 0) return { slotId: extra, source: 'extras' };

  if (sidecar && obj.name && sidecar[obj.name]) return { slotId: sidecar[obj.name], source: 'sidecar' };

  const m = obj.name ? NAME_CONVENTION.exec(obj.name) : null;
  if (m) return { slotId: m[1], source: 'name' };

  return null;
}

/**
 * Resolve the material_slot_id for an object: its own tag first, then the nearest tagged ancestor.
 * Precedence per node: glTF `extras.material_slot_id` → sidecar mapping → name convention.
 */
export function resolveSlotId(obj: Object3D, sidecar?: Record<string, string>): ResolvedSlot | null {
  for (let o: Object3D | null = obj; o; o = o.parent) {
    const hit = ownSlot(o, sidecar);
    if (hit) return hit;
  }
  return null;
}

export interface DiscoveredSlots {
  slots: Map<string, { meshes: Mesh[]; sources: Set<SlotSource> }>;
  untagged: Mesh[];
}

export function discoverSlots(root: Object3D, sidecar?: Record<string, string>): DiscoveredSlots {
  const slots: DiscoveredSlots['slots'] = new Map();
  const untagged: Mesh[] = [];
  root.traverse((obj) => {
    if (!(obj as Mesh).isMesh) return;
    const mesh = obj as Mesh;
    const hit = resolveSlotId(mesh, sidecar);
    if (!hit) {
      untagged.push(mesh);
      return;
    }
    let entry = slots.get(hit.slotId);
    if (!entry) slots.set(hit.slotId, (entry = { meshes: [], sources: new Set() }));
    entry.meshes.push(mesh);
    entry.sources.add(hit.source);
  });
  return { slots, untagged };
}

/**
 * Bind meshes with no resolvable slot id to `fallbackSlotId` (session uploads without conversion-farm tags).
 * Mutates `found` in place; clears `found.untagged`.
 */
export function bindUntaggedToFallback(found: DiscoveredSlots, fallbackSlotId: string): void {
  if (!found.untagged.length) return;
  let entry = found.slots.get(fallbackSlotId);
  if (!entry) {
    entry = { meshes: [], sources: new Set() };
    found.slots.set(fallbackSlotId, entry);
  }
  for (const mesh of found.untagged) {
    entry.meshes.push(mesh);
    entry.sources.add('fallback');
  }
  found.untagged = [];
}

/**
 * Ensure meshes can be lit by MeshStandardMaterial: compute vertex normals when missing.
 * Returns names of meshes that needed normals (for host warnings).
 */
export function ensureMeshNormals(root: Object3D): string[] {
  const fixed: string[] = [];
  root.traverse((obj) => {
    if (!(obj as Mesh).isMesh) return;
    const mesh = obj as Mesh;
    const geo = mesh.geometry;
    if (!geo || geo.attributes.normal) return;
    geo.computeVertexNormals();
    fixed.push(mesh.name || '(unnamed)');
  });
  return fixed;
}

/** Meshes that lack UVs — baseColor/normal maps will sample incorrectly or look flat. */
export function meshesMissingUv(root: Object3D): string[] {
  const missing: string[] = [];
  root.traverse((obj) => {
    if (!(obj as Mesh).isMesh) return;
    const mesh = obj as Mesh;
    if (!mesh.geometry?.attributes.uv) missing.push(mesh.name || '(unnamed)');
  });
  return missing;
}
