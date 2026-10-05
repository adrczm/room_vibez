/**
 * Soft collision checks for room placements (U17 — warn only, never hard-block).
 */

import type { Object3D } from 'three';
import { Box3 } from 'three';

import type { PlacementEntity, RoomGraph, Vec2, WallEntity } from './roomGraph';
import { wallLength } from './roomGraph';

function distanceToSegment(p: Vec2, a: Vec2, b: Vec2): number {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const len2 = dx * dx + dz * dz;
  const t = len2 > 0 ? Math.min(1, Math.max(0, ((p.x - a.x) * dx + (p.z - a.z) * dz) / len2)) : 0;
  return Math.hypot(p.x - (a.x + dx * t), p.z - (a.z + dz * t));
}

/**
 * Pure point-in-polygon test in the XZ plane (even-odd rule; any winding, convex or not).
 * A point on the boundary (within `eps` metres) counts as inside.
 * Fewer than 3 vertices, or a non-finite point, is never inside.
 */
export function pointInFloorPolygon(point: Vec2, polygon: readonly Vec2[], eps = 1e-6): boolean {
  const n = polygon.length;
  if (n < 3 || !Number.isFinite(point.x) || !Number.isFinite(point.z)) return false;
  let inside = false;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const a = polygon[i]!;
    const b = polygon[j]!;
    if (distanceToSegment(point, a, b) <= eps) return true;
    if (a.z > point.z !== b.z > point.z && point.x < ((b.x - a.x) * (point.z - a.z)) / (b.z - a.z) + a.x) {
      inside = !inside;
    }
  }
  return inside;
}

/**
 * Is the XZ point on the floor of the room? Uses `rooms[0].floor_polygon`, the same polygon the
 * floor mesh, the ceiling and the 2D plan are built from (inner wall faces).
 * `margin` (metres, default 0) also requires the point to be at least that far from every edge,
 * e.g. half a footprint, so a product centre is not accepted right against a wall.
 */
export function pointInRoom(graph: RoomGraph, point: Vec2, margin = 0): boolean {
  const polygon = graph.rooms[0]?.floor_polygon;
  if (!polygon || polygon.length < 3) return false;
  if (!pointInFloorPolygon(point, polygon)) return false;
  if (margin <= 0) return true;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    if (distanceToSegment(point, polygon[i]!, polygon[j]!) < margin) return false;
  }
  return true;
}

export interface CollisionHit {
  kind: 'furniture' | 'wall';
  id: string;
  label: string;
}

export interface CollisionReport {
  ok: boolean;
  overlaps: CollisionHit[];
}

/** Axis-aligned XZ footprint + optional height (meters). */
export interface Footprint {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  minY?: number;
  maxY?: number;
}

const EPS = 0.02;

export function footprintFromObject(root: Object3D): Footprint {
  root.updateMatrixWorld(true);
  const box = new Box3().setFromObject(root);
  return {
    minX: box.min.x,
    maxX: box.max.x,
    minZ: box.min.z,
    maxZ: box.max.z,
    minY: box.min.y,
    maxY: box.max.y,
  };
}

export function footprintFromPlacement(
  placement: PlacementEntity,
  size: { sx: number; sz: number; sy?: number } = { sx: 0.6, sz: 0.6, sy: 0.8 },
): Footprint {
  const hx = size.sx / 2;
  const hz = size.sz / 2;
  return {
    minX: placement.position.x - hx,
    maxX: placement.position.x + hx,
    minZ: placement.position.z - hz,
    maxZ: placement.position.z + hz,
    minY: 0,
    maxY: size.sy ?? 0.8,
  };
}

function aabbOverlap(a: Footprint, b: Footprint): boolean {
  return (
    a.minX < b.maxX - EPS &&
    a.maxX > b.minX + EPS &&
    a.minZ < b.maxZ - EPS &&
    a.maxZ > b.minZ + EPS
  );
}

/** Approximate wall as a thickened AABB in XZ (centerline = inner; thickness outward). */
export function wallFootprint(wall: WallEntity): Footprint {
  const len = wallLength(wall);
  const dx = wall.b.x - wall.a.x;
  const dz = wall.b.z - wall.a.z;
  const nx = len > 0 ? dz / len : 0; // outward (right of a→b for CCW)
  const nz = len > 0 ? -dx / len : -1;
  const out = wall.thickness + 0.01;
  const inn = 0.01;
  const corners = [
    { x: wall.a.x + nx * out, z: wall.a.z + nz * out },
    { x: wall.a.x - nx * inn, z: wall.a.z - nz * inn },
    { x: wall.b.x + nx * out, z: wall.b.z + nz * out },
    { x: wall.b.x - nx * inn, z: wall.b.z - nz * inn },
  ];
  return {
    minX: Math.min(...corners.map((c) => c.x)),
    maxX: Math.max(...corners.map((c) => c.x)),
    minZ: Math.min(...corners.map((c) => c.z)),
    maxZ: Math.max(...corners.map((c) => c.z)),
  };
}

/**
 * Soft-warn report for a candidate footprint against existing placements + walls.
 * `ignorePlacementId` skips self when moving.
 */
export function checkPlacementCollision(
  graph: RoomGraph,
  footprint: Footprint,
  opts?: {
    ignorePlacementId?: string;
    otherFootprints?: Map<string, Footprint>;
  },
): CollisionReport {
  const overlaps: CollisionHit[] = [];

  for (const pl of graph.placements) {
    if (pl.id === opts?.ignorePlacementId) continue;
    const other =
      opts?.otherFootprints?.get(pl.id) ??
      footprintFromPlacement(pl, { sx: 0.55, sz: 0.55 });
    if (aabbOverlap(footprint, other)) {
      overlaps.push({
        kind: 'furniture',
        id: pl.id,
        label: pl.product_id || pl.sku_id,
      });
    }
  }

  for (const wall of graph.walls) {
    if (aabbOverlap(footprint, wallFootprint(wall))) {
      overlaps.push({ kind: 'wall', id: wall.id, label: `wall ${wall.id}` });
    }
  }

  return { ok: overlaps.length === 0, overlaps };
}

export function formatCollisionWarn(report: CollisionReport): string | null {
  if (report.ok) return null;
  const parts = report.overlaps.map((o) =>
    o.kind === 'wall' ? 'wall' : `furniture (${o.label})`,
  );
  return `Soft overlap warning (placement allowed): ${[...new Set(parts)].join(', ')}`;
}
