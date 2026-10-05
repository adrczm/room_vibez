/**
 * Split COLOR_0 (vertex-color) meshes into per-zone slot meshes.
 *
 * Observed on Polyfork `core-rulebook-4aedc7.glb`: one PBR material, COLOR_0 baked
 * with emerald zone palette (cover/gold/gilt/paper/ribbon; ink absent when closed).
 * MJS `materials` / color params name those zones — they are not glTF material_slot_id tags.
 *
 * This module groups faces by matching COLOR_0 RGB to a known zone palette and emits
 * separate meshes tagged with `userData.material_slot_id` + `slot_<id>` names so the
 * existing slot binder / library swatches / MJS colorway path can target each zone.
 */
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  Group,
  Mesh,
  MeshStandardMaterial,
  type Object3D,
} from 'three';

export interface ZonePaletteEntry {
  key: string;
  hex: string;
  r: number;
  g: number;
  b: number;
}

export interface ZoneVertexHit {
  key: string;
  vertices: number;
  faces: number;
}

export interface ProbeVertexColorZonesResult {
  hasColorAttribute: boolean;
  hits: ZoneVertexHit[];
  unmatchedVertices: number;
  totalVertices: number;
}

export interface SplitZonesResult {
  ok: boolean;
  zonesCreated: string[];
  meshCount: number;
  facesSplit: number;
  unmatchedFaces: number;
  notes: string[];
}

const HEXRE = /^#[0-9a-f]{3,8}$/i;

export function paletteFromZones(zones: Record<string, string>): ZonePaletteEntry[] {
  const out: ZonePaletteEntry[] = [];
  for (const [key, hex] of Object.entries(zones)) {
    if (typeof hex !== 'string' || !HEXRE.test(hex)) continue;
    const c = new Color(hex);
    out.push({ key, hex, r: c.r, g: c.g, b: c.b });
  }
  return out;
}

function matchZone(
  r: number,
  g: number,
  b: number,
  palette: ZonePaletteEntry[],
  tolerance: number,
): string | null {
  for (const z of palette) {
    if (
      Math.abs(r - z.r) <= tolerance &&
      Math.abs(g - z.g) <= tolerance &&
      Math.abs(b - z.b) <= tolerance
    ) {
      return z.key;
    }
  }
  return null;
}

/** Count COLOR_0 vertices that match each zone in the palette (non-mutating probe). */
export function probeVertexColorZones(
  root: Object3D,
  zones: Record<string, string>,
  tolerance = 0.02,
): ProbeVertexColorZonesResult {
  const palette = paletteFromZones(zones);
  const vertCounts = new Map<string, number>(palette.map((z) => [z.key, 0]));
  const faceCounts = new Map<string, number>(palette.map((z) => [z.key, 0]));
  let unmatchedVertices = 0;
  let totalVertices = 0;
  let hasColorAttribute = false;

  root.traverse((o) => {
    if (!(o as Mesh).isMesh) return;
    const mesh = o as Mesh;
    const geo = mesh.geometry;
    if (!geo) return;
    const color = geo.getAttribute('color') as BufferAttribute | undefined;
    if (!color) return;
    hasColorAttribute = true;
    const index = geo.index;

    for (let i = 0; i < color.count; i++) {
      totalVertices++;
      const key = matchZone(color.getX(i), color.getY(i), color.getZ(i), palette, tolerance);
      if (key) vertCounts.set(key, (vertCounts.get(key) ?? 0) + 1);
      else unmatchedVertices++;
    }

    const faceCount = index ? index.count / 3 : Math.floor(color.count / 3);
    for (let f = 0; f < faceCount; f++) {
      const i0 = index ? index.getX(f * 3) : f * 3;
      const i1 = index ? index.getX(f * 3 + 1) : f * 3 + 1;
      const i2 = index ? index.getX(f * 3 + 2) : f * 3 + 2;
      const z0 = matchZone(color.getX(i0), color.getY(i0), color.getZ(i0), palette, tolerance);
      const z1 = matchZone(color.getX(i1), color.getY(i1), color.getZ(i1), palette, tolerance);
      const z2 = matchZone(color.getX(i2), color.getY(i2), color.getZ(i2), palette, tolerance);
      const zone = z0 && z0 === z1 && z1 === z2 ? z0 : z0 ?? z1 ?? z2;
      if (zone) faceCounts.set(zone, (faceCounts.get(zone) ?? 0) + 1);
    }
  });

  const hits: ZoneVertexHit[] = [...vertCounts.entries()]
    .filter(([, v]) => v > 0)
    .map(([key, vertices]) => ({ key, vertices, faces: faceCounts.get(key) ?? 0 }));

  return { hasColorAttribute, hits, unmatchedVertices, totalVertices };
}

type AttrBags = {
  position: number[];
  normal: number[] | null;
  uv: number[] | null;
  color: number[] | null;
};

function emptyBags(hasNormal: boolean, hasUv: boolean, hasColor: boolean): AttrBags {
  return {
    position: [],
    normal: hasNormal ? [] : null,
    uv: hasUv ? [] : null,
    color: hasColor ? [] : null,
  };
}

function pushVertex(
  bags: AttrBags,
  geo: BufferGeometry,
  vi: number,
): void {
  const pos = geo.getAttribute('position') as BufferAttribute;
  bags.position.push(pos.getX(vi), pos.getY(vi), pos.getZ(vi));
  const nrm = geo.getAttribute('normal') as BufferAttribute | undefined;
  if (bags.normal && nrm) bags.normal.push(nrm.getX(vi), nrm.getY(vi), nrm.getZ(vi));
  const uv = geo.getAttribute('uv') as BufferAttribute | undefined;
  if (bags.uv && uv) bags.uv.push(uv.getX(vi), uv.getY(vi));
  const col = geo.getAttribute('color') as BufferAttribute | undefined;
  if (bags.color && col) bags.color.push(col.getX(vi), col.getY(vi), col.getZ(vi));
}

function geometryFromBags(bags: AttrBags): BufferGeometry {
  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(new Float32Array(bags.position), 3));
  if (bags.normal?.length) geo.setAttribute('normal', new BufferAttribute(new Float32Array(bags.normal), 3));
  else geo.computeVertexNormals();
  if (bags.uv?.length) geo.setAttribute('uv', new BufferAttribute(new Float32Array(bags.uv), 2));
  if (bags.color?.length) geo.setAttribute('color', new BufferAttribute(new Float32Array(bags.color), 3));
  return geo;
}

/**
 * Replace each COLOR_0 mesh with a Group of per-zone child meshes.
 * Children are named `slot_<zone>` and tagged `userData.material_slot_id = zone`.
 * Original mesh geometry/material are disposed after a successful split of that mesh.
 */
export function splitVertexColorZones(
  root: Object3D,
  zones: Record<string, string>,
  tolerance = 0.02,
): SplitZonesResult {
  const palette = paletteFromZones(zones);
  const notes: string[] = [];
  if (!palette.length) {
    return {
      ok: false,
      zonesCreated: [],
      meshCount: 0,
      facesSplit: 0,
      unmatchedFaces: 0,
      notes: ['Split failed: empty zone palette.'],
    };
  }

  const zoneMeshCount = new Map<string, number>();
  let facesSplit = 0;
  let unmatchedFaces = 0;
  let meshCount = 0;
  const toReplace: { mesh: Mesh; group: Group }[] = [];

  root.traverse((o) => {
    if (!(o as Mesh).isMesh) return;
    // Skip meshes we already tagged as split slots (idempotent).
    if (typeof o.userData?.material_slot_id === 'string' && o.userData?.packSplitZone) return;
    const mesh = o as Mesh;
    const geo = mesh.geometry;
    if (!geo) return;
    const color = geo.getAttribute('color') as BufferAttribute | undefined;
    const position = geo.getAttribute('position') as BufferAttribute | undefined;
    if (!color || !position) return;

    const hasNormal = !!geo.getAttribute('normal');
    const hasUv = !!geo.getAttribute('uv');
    const index = geo.index;
    const faceCount = index ? index.count / 3 : Math.floor(position.count / 3);
    if (!Number.isInteger(faceCount) || faceCount <= 0) return;

    const bags = new Map<string, AttrBags>();
    let localUnmatched = 0;
    let localSplit = 0;

    for (let f = 0; f < faceCount; f++) {
      const i0 = index ? index.getX(f * 3) : f * 3;
      const i1 = index ? index.getX(f * 3 + 1) : f * 3 + 1;
      const i2 = index ? index.getX(f * 3 + 2) : f * 3 + 2;
      const z0 = matchZone(color.getX(i0), color.getY(i0), color.getZ(i0), palette, tolerance);
      const z1 = matchZone(color.getX(i1), color.getY(i1), color.getZ(i1), palette, tolerance);
      const z2 = matchZone(color.getX(i2), color.getY(i2), color.getZ(i2), palette, tolerance);
      // Prefer unanimous face; otherwise first matching corner (faces are usually uniform after Polyfork bake).
      const zone = z0 && z0 === z1 && z1 === z2 ? z0 : z0 ?? z1 ?? z2;
      if (!zone) {
        localUnmatched++;
        continue;
      }
      let bag = bags.get(zone);
      if (!bag) {
        bag = emptyBags(hasNormal, hasUv, true);
        bags.set(zone, bag);
      }
      pushVertex(bag, geo, i0);
      pushVertex(bag, geo, i1);
      pushVertex(bag, geo, i2);
      localSplit++;
    }

    if (!bags.size) {
      unmatchedFaces += localUnmatched;
      return;
    }

    const group = new Group();
    group.name = mesh.name ? `${mesh.name}__zones` : 'zones';
    group.userData.packSplitParent = true;
    group.position.copy(mesh.position);
    group.quaternion.copy(mesh.quaternion);
    group.scale.copy(mesh.scale);

    for (const [zone, bag] of bags) {
      const childGeo = geometryFromBags(bag);
      const mat = new MeshStandardMaterial({
        name: `pack-split:${zone}`,
        color: new Color(zones[zone]),
        roughness: 0.85,
        metalness: 0,
        flatShading: true,
      });
      mat.userData.packZone = zone;
      const child = new Mesh(childGeo, mat);
      child.name = `slot_${zone}`;
      child.userData.material_slot_id = zone;
      child.userData.packSplitZone = true;
      child.castShadow = mesh.castShadow;
      child.receiveShadow = mesh.receiveShadow;
      group.add(child);
      zoneMeshCount.set(zone, (zoneMeshCount.get(zone) ?? 0) + 1);
      meshCount++;
    }

    facesSplit += localSplit;
    unmatchedFaces += localUnmatched;
    toReplace.push({ mesh, group });
  });

  for (const { mesh, group } of toReplace) {
    const parent = mesh.parent;
    if (!parent) continue;
    parent.add(group);
    parent.remove(mesh);
    mesh.geometry?.dispose();
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const m of mats) m?.dispose();
  }

  const zonesCreated = [...zoneMeshCount.keys()].sort();
  const ok = zonesCreated.length > 0;
  if (ok) {
    notes.push(
      `Split COLOR_0 into ${meshCount} slot mesh(es) for zones: ${zonesCreated.join(', ')} ` +
        `(${facesSplit} faces).`,
    );
    if (unmatchedFaces) {
      notes.push(`Unmatched faces kept out of slots: ${unmatchedFaces}.`);
    }
  } else {
    notes.push(
      'Split failed: no COLOR_0 faces matched the MJS zone palette — falling back to vertex-color remap if available.',
    );
  }

  return { ok, zonesCreated, meshCount, facesSplit, unmatchedFaces, notes };
}
