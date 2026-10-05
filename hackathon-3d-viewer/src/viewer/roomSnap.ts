/**
 * Wall-snap / docking helpers for floor placements.
 * Projects XZ to nearest wall centerline and faces the placement into the room.
 */

import type { RoomGraph, Vec2, WallEntity } from './roomGraph';
import { wallLength } from './roomGraph';

export interface SnapResult {
  x: number;
  z: number;
  rotation_y: number;
  wall_id: string;
  distance: number;
}

function inwardNormal(wall: WallEntity): Vec2 {
  const dx = wall.b.x - wall.a.x;
  const dz = wall.b.z - wall.a.z;
  // Outward = right of a→b for CCW floor; inward = opposite.
  const outward = { x: dz, z: -dx };
  const len = Math.hypot(outward.x, outward.z) || 1;
  return { x: -outward.x / len, z: -outward.z / len };
}

/**
 * Snap a floor point to the nearest wall, offset inward by `depth` (meters).
 * Rotation faces along the inward normal (back against wall).
 */
export function snapPlacementToWall(
  graph: RoomGraph,
  point: Vec2,
  depth = 0.35,
): SnapResult | null {
  if (!graph.walls.length) return null;
  let best: SnapResult | null = null;

  for (const wall of graph.walls) {
    const len = wallLength(wall);
    if (len < 1e-6) continue;
    const dx = wall.b.x - wall.a.x;
    const dz = wall.b.z - wall.a.z;
    const t = ((point.x - wall.a.x) * dx + (point.z - wall.a.z) * dz) / (len * len);
    const tc = Math.min(Math.max(t, 0), 1);
    const px = wall.a.x + dx * tc;
    const pz = wall.a.z + dz * tc;
    const dist = Math.hypot(point.x - px, point.z - pz);
    const n = inwardNormal(wall);
    // Wall centerline is the inner face (thickness extrudes outward) — offset inward by depth only.
    const x = px + n.x * depth;
    const z = pz + n.z * depth;
    const rotation_y = Math.atan2(n.x, n.z);
    if (!best || dist < best.distance) {
      best = { x, z, rotation_y, wall_id: wall.id, distance: dist };
    }
  }
  return best;
}
