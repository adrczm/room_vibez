/**
 * Soft collision checks for room placements (U17 — warn only, never hard-block).
 */

import type { Object3D } from 'three';
import { Box3 } from 'three';

import type { PlacementEntity, RoomGraph, WallEntity } from './roomGraph';
import { wallLength } from './roomGraph';

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
