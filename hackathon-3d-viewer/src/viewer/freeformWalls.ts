/**
 * Orthogonal freeform wall drawing → one closed room (Partial local MVP).
 * Not multi-room shared-wall topology.
 */

import {
  DEFAULT_CEILING_HEIGHT_M,
  DEFAULT_WALL_THICKNESS_M,
  type DisplayUnit,
  type RoomGraph,
  type RoomEntity,
  type Vec2,
  type WallEntity,
} from './roomGraph';

export interface DrawSession {
  points: Vec2[];
  orthogrid: boolean;
  ceilingHeight: number;
  wallThickness: number;
  displayUnit: DisplayUnit;
  name?: string;
}

export function createDrawSession(opts?: Partial<DrawSession>): DrawSession {
  return {
    points: [],
    orthogrid: opts?.orthogrid ?? true,
    ceilingHeight: opts?.ceilingHeight ?? DEFAULT_CEILING_HEIGHT_M,
    wallThickness: opts?.wallThickness ?? DEFAULT_WALL_THICKNESS_M,
    displayUnit: opts?.displayUnit ?? 'm',
    name: opts?.name ?? 'Freeform room',
  };
}

/** Snap to axis-aligned relative to previous point. */
export function snapOrthogonal(prev: Vec2 | undefined, point: Vec2): Vec2 {
  if (!prev) return { ...point };
  const dx = Math.abs(point.x - prev.x);
  const dz = Math.abs(point.z - prev.z);
  if (dx >= dz) return { x: point.x, z: prev.z };
  return { x: prev.x, z: point.z };
}

export function addDrawPoint(session: DrawSession, point: Vec2): DrawSession {
  const prev = session.points[session.points.length - 1];
  const p = session.orthogrid ? snapOrthogonal(prev, point) : { ...point };
  if (prev && Math.hypot(p.x - prev.x, p.z - prev.z) < 0.05) return session;
  return { ...session, points: [...session.points, p] };
}

export function closeDistance(session: DrawSession, point: Vec2, threshold = 0.35): boolean {
  if (session.points.length < 3) return false;
  const first = session.points[0];
  return Math.hypot(point.x - first.x, point.z - first.z) <= threshold;
}

function polygonArea(poly: Vec2[]): number {
  let a = 0;
  for (let i = 0; i < poly.length; i++) {
    const j = (i + 1) % poly.length;
    a += poly[i].x * poly[j].z - poly[j].x * poly[i].z;
  }
  return a / 2;
}

/** Ensure CCW when viewed from +Y. */
export function ensureCcw(poly: Vec2[]): Vec2[] {
  if (polygonArea(poly) >= 0) return poly.map((p) => ({ ...p }));
  return [...poly].reverse().map((p) => ({ ...p }));
}

let idSeq = 0;
function nid(prefix: string): string {
  idSeq += 1;
  return `${prefix}_${Date.now().toString(36)}_${idSeq.toString(36)}`;
}

/**
 * Commit a closed orthogonal polygon (≥3 corners) to a RoomGraph.
 * Last point may equal first; duplicates collapsed.
 */
export function commitDrawSession(session: DrawSession): RoomGraph {
  let pts = session.points.map((p) => ({ ...p }));
  if (pts.length >= 3) {
    const first = pts[0];
    const last = pts[pts.length - 1];
    if (Math.hypot(first.x - last.x, first.z - last.z) < 0.08) pts = pts.slice(0, -1);
  }
  if (pts.length < 3) throw new Error('Need at least 3 corners to close a room');
  pts = ensureCcw(pts);

  const ceiling = session.ceilingHeight;
  const thickness = session.wallThickness;
  const roomId = nid('room');
  const walls: WallEntity[] = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    if (Math.hypot(b.x - a.x, b.z - a.z) < 0.05) continue;
    walls.push({
      id: nid('wall'),
      a: { ...a },
      b: { ...b },
      thickness,
      height: ceiling,
      connected_room_ids: [roomId],
    });
  }
  if (walls.length < 3) throw new Error('Degenerate polygon — walls too short');

  const room: RoomEntity = {
    id: roomId,
    name: session.name ?? 'Freeform room',
    floor_polygon: pts,
    ceiling_height: ceiling,
    wall_ids: walls.map((w) => w.id),
  };

  return {
    schema_version: 1,
    units: 'm',
    rooms: [room],
    walls,
    openings: [],
    placements: [],
    source_assets: [],
    provenance: { kind: 'authored', confirm_status: 'confirmed' },
    display_unit: session.displayUnit,
    label: session.name ?? 'Freeform room',
  };
}
