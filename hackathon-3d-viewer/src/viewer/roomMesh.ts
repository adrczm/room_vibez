/**
 * Derive Three.js meshes from a RoomGraph (Approach A: Shape holes + ExtrudeGeometry).
 * Graph remains SoT — call rebuild whenever the graph changes.
 */

import {
  BoxGeometry,
  DoubleSide,
  ExtrudeGeometry,
  Group,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Path,
  Shape,
  ShapeGeometry,
  Vector2,
  Vector3,
  type Material,
} from 'three';

import type { OpeningEntity, RoomGraph, WallEntity } from './roomGraph';
import { wallLength } from './roomGraph';

/** Floor slab thickness (meters). */
export const FLOOR_SLAB_DEPTH_M = 0.02;

/**
 * Floor top sits this far below y=0 so it is not coplanar with wall bottom caps
 * when the slab extends under the walls (avoids orbit z-fighting).
 */
export const FLOOR_TOP_EPS_M = 0.002;

/** @deprecated Use FLOOR_TOP_EPS_M — kept as alias for call sites/tests. */
export const WALL_FOOT_EPS_M = FLOOR_TOP_EPS_M;

export interface RoomMeshMaterials {
  wall: MeshStandardMaterial;
  floor: MeshStandardMaterial;
  ceiling?: MeshStandardMaterial;
}

/**
 * Wall-local basis: +X along a→b, +Y up, +Z inward (right-handed).
 * Extrusion uses negative local Z so thickness grows outward from the centerline.
 */
function wallBasis(wall: WallEntity): { basis: Matrix4; dir: Vector3; inward: Vector3; outward: Vector3 } {
  const dx = wall.b.x - wall.a.x;
  const dz = wall.b.z - wall.a.z;
  const dir = new Vector3(dx, 0, dz).normalize();
  const up = new Vector3(0, 1, 0);
  // dir × up = inward for a CCW floor loop viewed from +Y.
  const inward = new Vector3().crossVectors(dir, up).normalize();
  const outward = inward.clone().multiplyScalar(-1);
  const basis = new Matrix4().makeBasis(dir, up, inward);
  return { basis, dir, inward, outward };
}

function defaultMaterials(): RoomMeshMaterials {
  return {
    wall: new MeshStandardMaterial({
      color: '#d8d4cc',
      roughness: 0.92,
      metalness: 0,
      side: DoubleSide,
      name: 'room:wall',
    }),
    floor: new MeshStandardMaterial({
      color: '#b9b0a2',
      roughness: 0.85,
      metalness: 0,
      name: 'room:floor',
    }),
    ceiling: new MeshStandardMaterial({
      color: '#efefef',
      roughness: 0.95,
      metalness: 0,
      side: DoubleSide,
      name: 'room:ceiling',
      transparent: true,
      opacity: 0.35,
    }),
  };
}

function openingsForWall(graph: RoomGraph, wallId: string): OpeningEntity[] {
  return graph.openings.filter((o) => o.wall_id === wallId);
}

/** Build a vertical wall mesh: shape in wall-local (x along length, y up), extruded by thickness. */
export function buildWallMesh(
  wall: WallEntity,
  openings: OpeningEntity[],
  material: MeshStandardMaterial,
): Mesh {
  const length = wallLength(wall);
  const height = wall.height;
  const thickness = wall.thickness;

  const shape = new Shape();
  shape.moveTo(0, 0);
  shape.lineTo(length, 0);
  shape.lineTo(length, height);
  shape.lineTo(0, height);
  shape.closePath();

  for (const op of openings) {
    const x0 = op.offset_along_wall;
    const x1 = op.offset_along_wall + op.width;
    const y0 = op.sill_height;
    const y1 = op.sill_height + op.height;
    const hole = new Path();
    hole.moveTo(x0, y0);
    hole.lineTo(x1, y0);
    hole.lineTo(x1, y1);
    hole.lineTo(x0, y1);
    hole.closePath();
    shape.holes.push(hole);
  }

  const geo = new ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false, curveSegments: 1 });
  // Shape extrusion is +local Z. Wall basis maps +Z → inward, so shift by -thickness
  // so the solid occupies [-thickness, 0] = outward from the centerline / inner face.
  geo.translate(0, 0, -thickness);

  const mesh = new Mesh(geo, material);
  mesh.name = `wall:${wall.id}`;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData.wallId = wall.id;
  mesh.userData.kind = 'wall';

  const { basis } = wallBasis(wall);
  mesh.matrixAutoUpdate = true;
  mesh.position.set(wall.a.x, 0, wall.a.z);
  mesh.quaternion.setFromRotationMatrix(basis);

  return mesh;
}

/**
 * Procedural placeholder door/window meshes (NOT catalog SKUs).
 * Sit in the opening cutout for visual presence only.
 */
export function buildOpeningPlaceholder(wall: WallEntity, opening: OpeningEntity): Group {
  const group = new Group();
  group.name = `opening-placeholder:${opening.id}`;
  group.userData.kind = 'opening-placeholder';
  group.userData.openingId = opening.id;
  group.userData.wallId = wall.id;

  const len = wallLength(wall);
  const dx = wall.b.x - wall.a.x;
  const dz = wall.b.z - wall.a.z;
  const { basis } = wallBasis(wall);

  const midAlong = opening.offset_along_wall + opening.width / 2;
  const cx = wall.a.x + (dx / (len || 1)) * midAlong;
  const cz = wall.a.z + (dz / (len || 1)) * midAlong;
  const cy = opening.sill_height + opening.height / 2;

  group.position.set(cx, cy, cz);
  group.quaternion.setFromRotationMatrix(basis);

  if (opening.type === 'door') {
    const frameMat = new MeshStandardMaterial({
      color: '#6b5b4b',
      roughness: 0.75,
      metalness: 0.05,
      name: 'placeholder:door-frame',
    });
    const leafMat = new MeshStandardMaterial({
      color: '#8a7355',
      roughness: 0.7,
      metalness: 0,
      name: 'placeholder:door-leaf',
    });
    const jambT = 0.04;
    const depth = Math.max(0.06, wall.thickness * 0.85);
    // Left / right jambs + head
    const left = new Mesh(new BoxGeometry(jambT, opening.height, depth), frameMat);
    left.position.set(-opening.width / 2 + jambT / 2, 0, 0);
    const right = new Mesh(new BoxGeometry(jambT, opening.height, depth), frameMat);
    right.position.set(opening.width / 2 - jambT / 2, 0, 0);
    const head = new Mesh(new BoxGeometry(opening.width, jambT, depth), frameMat);
    head.position.set(0, opening.height / 2 - jambT / 2, 0);
    const leaf = new Mesh(
      new BoxGeometry(Math.max(0.1, opening.width - jambT * 2), Math.max(0.1, opening.height - jambT), 0.04),
      leafMat,
    );
    leaf.position.set(0, -jambT / 2, -depth * 0.15);
    for (const m of [left, right, head, leaf]) {
      m.castShadow = true;
      m.receiveShadow = true;
      m.userData.kind = 'opening-placeholder';
      group.add(m);
    }
  } else {
    const frameMat = new MeshStandardMaterial({
      color: '#5a6570',
      roughness: 0.55,
      metalness: 0.15,
      name: 'placeholder:window-frame',
    });
    const glassMat = new MeshStandardMaterial({
      color: '#c5dde8',
      roughness: 0.15,
      metalness: 0,
      transparent: true,
      opacity: 0.45,
      name: 'placeholder:window-glass',
    });
    const depth = Math.max(0.05, wall.thickness * 0.7);
    const frameT = 0.035;
    const outer = new Mesh(new BoxGeometry(opening.width, opening.height, depth), frameMat);
    const glass = new Mesh(
      new BoxGeometry(Math.max(0.08, opening.width - frameT * 2), Math.max(0.08, opening.height - frameT * 2), 0.02),
      glassMat,
    );
    glass.position.z = 0.01;
    // Mullion
    const mullion = new Mesh(new BoxGeometry(frameT, opening.height - frameT * 2, depth * 0.9), frameMat);
    for (const m of [outer, glass, mullion]) {
      m.castShadow = true;
      m.receiveShadow = true;
      m.userData.kind = 'opening-placeholder';
      group.add(m);
    }
  }

  return group;
}

/** Shape XY → XZ floor: use (x, -z) so rotateX(-π/2) lands on +Z correctly. */
function floorShape(polygon: { x: number; z: number }[]): Shape {
  return new Shape(polygon.map((p) => new Vector2(p.x, -p.z)));
}

/**
 * World-space XZ AABB of a closed floor polygon (graph SoT).
 * Used by tests to assert mesh footprint matches wall centerlines / inner faces.
 */
export function floorPolygonBounds(polygon: { x: number; z: number }[]): {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  sizeX: number;
  sizeZ: number;
} {
  let minX = Infinity,
    maxX = -Infinity,
    minZ = Infinity,
    maxZ = -Infinity;
  for (const p of polygon) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minZ = Math.min(minZ, p.z);
    maxZ = Math.max(maxZ, p.z);
  }
  if (!Number.isFinite(minX)) {
    return { minX: 0, maxX: 0, minZ: 0, maxZ: 0, sizeX: 0, sizeZ: 0 };
  }
  return { minX, maxX, minZ, maxZ, sizeX: maxX - minX, sizeZ: maxZ - minZ };
}

/**
 * Closed wall centerline polygon from ordered walls (a→b chained).
 * Returns null if walls do not form a simple closed loop.
 */
export function wallCenterlinePolygon(walls: WallEntity[]): { x: number; z: number }[] | null {
  if (walls.length < 3) return null;
  const pts: { x: number; z: number }[] = [];
  for (let i = 0; i < walls.length; i++) {
    const w = walls[i]!;
    const next = walls[(i + 1) % walls.length]!;
    pts.push({ x: w.a.x, z: w.a.z });
    if (Math.hypot(w.b.x - next.a.x, w.b.z - next.a.z) > 1e-4) return null;
  }
  return pts;
}

/**
 * Outer floor footprint: offset the CCW inner (wall-centerline) polygon outward
 * by each wall's thickness so the slab sits under the wall solids (no end gaps).
 */
export function outerFloorPolygon(
  inner: { x: number; z: number }[],
  walls: WallEntity[],
): { x: number; z: number }[] {
  if (inner.length < 3) return inner.map((p) => ({ ...p }));
  const n = inner.length;
  const out: { x: number; z: number }[] = [];
  for (let i = 0; i < n; i++) {
    const prev = inner[(i - 1 + n) % n]!;
    const cur = inner[i]!;
    const next = inner[(i + 1) % n]!;
    const e0x = cur.x - prev.x;
    const e0z = cur.z - prev.z;
    const e1x = next.x - cur.x;
    const e1z = next.z - cur.z;
    const len0 = Math.hypot(e0x, e0z) || 1;
    const len1 = Math.hypot(e1x, e1z) || 1;
    // Outward normals for CCW edges (right of a→b from +Y): (dz, -dx)
    const n0x = e0z / len0;
    const n0z = -e0x / len0;
    const n1x = e1z / len1;
    const n1z = -e1x / len1;
    const wallPrev = walls[(i - 1 + walls.length) % walls.length];
    const wallCur = walls[i % walls.length];
    const t0 = wallPrev?.thickness ?? walls[0]?.thickness ?? 0.12;
    const t1 = wallCur?.thickness ?? t0;
    // Miter join: offset = t * (n0+n1) / (1 + n0·n1)
    const dot = n0x * n1x + n0z * n1z;
    const denom = 1 + dot;
    if (Math.abs(denom) < 1e-6) {
      // Nearly opposite edges — fall back to average outward
      const t = (t0 + t1) / 2;
      out.push({ x: cur.x + ((n0x + n1x) * t) / 2, z: cur.z + ((n0z + n1z) * t) / 2 });
    } else {
      // Use max thickness at the corner so both wall feet stay covered.
      const t = Math.max(t0, t1);
      out.push({
        x: cur.x + (t * (n0x + n1x)) / denom,
        z: cur.z + (t * (n0z + n1z)) / denom,
      });
    }
  }
  return out;
}

function buildFloorMesh(graph: RoomGraph, material: MeshStandardMaterial): Mesh | null {
  const room = graph.rooms[0];
  if (!room?.floor_polygon?.length) return null;
  // Mesh uses the outer wall footprint so wall bottoms sit on the slab (graph polygon stays inner SoT).
  const outer = outerFloorPolygon(room.floor_polygon, graph.walls);
  const geo = new ExtrudeGeometry(floorShape(outer), {
    depth: FLOOR_SLAB_DEPTH_M,
    bevelEnabled: false,
    curveSegments: 1,
  });
  geo.rotateX(-Math.PI / 2);
  const mesh = new Mesh(geo, material);
  // Extrusion +Z → +Y after rotate; place so top is at -FLOOR_TOP_EPS_M (below wall feet).
  mesh.position.y = -FLOOR_SLAB_DEPTH_M - FLOOR_TOP_EPS_M;
  mesh.name = `floor:${room.id}`;
  mesh.receiveShadow = true;
  mesh.userData.kind = 'floor';
  mesh.userData.roomId = room.id;
  mesh.userData.footprint = 'outer';
  return mesh;
}

function buildCeilingMesh(graph: RoomGraph, material: MeshStandardMaterial): Mesh | null {
  const room = graph.rooms[0];
  if (!room?.floor_polygon?.length) return null;
  const geo = new ShapeGeometry(floorShape(room.floor_polygon));
  geo.rotateX(-Math.PI / 2);
  const mesh = new Mesh(geo, material);
  mesh.position.y = room.ceiling_height;
  mesh.name = `ceiling:${room.id}`;
  mesh.userData.kind = 'ceiling';
  mesh.visible = false; // hide by default (plan / orbit clarity); host may toggle
  return mesh;
}

export interface BuiltRoomScene {
  root: Group;
  wallMeshes: Map<string, Mesh>;
  floor: Mesh | null;
  ceiling: Mesh | null;
  materials: RoomMeshMaterials;
  dispose: () => void;
}

/** Rebuild an entire room shell Group from the graph. */
export function buildRoomScene(graph: RoomGraph, mats?: RoomMeshMaterials): BuiltRoomScene {
  const materials = mats ?? defaultMaterials();
  const root = new Group();
  root.name = 'room-shell';
  const wallMeshes = new Map<string, Mesh>();

  for (const wall of graph.walls) {
    const wallOpenings = openingsForWall(graph, wall.id);
    const mesh = buildWallMesh(wall, wallOpenings, materials.wall);
    wallMeshes.set(wall.id, mesh);
    root.add(mesh);
    for (const op of wallOpenings) {
      root.add(buildOpeningPlaceholder(wall, op));
    }
  }

  const floor = buildFloorMesh(graph, materials.floor);
  if (floor) root.add(floor);

  const ceiling = materials.ceiling ? buildCeilingMesh(graph, materials.ceiling) : null;
  if (ceiling) root.add(ceiling);

  return {
    root,
    wallMeshes,
    floor,
    ceiling,
    materials,
    dispose: () => {
      const seen = new Set<Material>();
      root.traverse((o) => {
        const m = o as Mesh;
        if (!m.isMesh) return;
        m.geometry?.dispose();
        const mats = Array.isArray(m.material) ? m.material : [m.material];
        for (const mat of mats) {
          if (!mat || seen.has(mat)) continue;
          seen.add(mat);
          mat.dispose();
        }
      });
      root.clear();
    },
  };
}

/** Sync MeshStandardMaterial from a local library row (color/PBR; maps optional). */
export function meshStandardFromLibrary(
  def: { id: string; color: string; roughness: number; metalness: number; name?: string },
  opts?: { side?: typeof DoubleSide; name?: string },
): MeshStandardMaterial {
  return new MeshStandardMaterial({
    name: opts?.name ?? `lib:${def.id}`,
    color: def.color,
    roughness: def.roughness,
    metalness: def.metalness,
    side: opts?.side,
  });
}
