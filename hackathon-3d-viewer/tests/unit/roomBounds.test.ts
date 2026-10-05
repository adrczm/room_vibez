import { describe, expect, it } from 'vitest';
import { addDrawPoint, commitDrawSession, createDrawSession } from '../../src/viewer/freeformWalls';
import { createRectangularRoom, type RoomGraph, type Vec2 } from '../../src/viewer/roomGraph';
import { pointInFloorPolygon, pointInRoom } from '../../src/viewer/roomCollision';
import { buildRoomScene, DEFAULT_FLOOR_COLOR, wallCutawayPlane } from '../../src/viewer/roomMesh';

const square: Vec2[] = [
  { x: -1, z: -1 },
  { x: 1, z: -1 },
  { x: 1, z: 1 },
  { x: -1, z: 1 },
];
// L-shape (concave): a 4×4 square with the +x/+z quadrant removed.
const lShape: Vec2[] = [
  { x: 0, z: 0 },
  { x: 4, z: 0 },
  { x: 4, z: 2 },
  { x: 2, z: 2 },
  { x: 2, z: 4 },
  { x: 0, z: 4 },
];

describe('pointInFloorPolygon', () => {
  it('accepts points inside and rejects points outside a convex polygon', () => {
    expect(pointInFloorPolygon({ x: 0, z: 0 }, square)).toBe(true);
    expect(pointInFloorPolygon({ x: 0.99, z: -0.99 }, square)).toBe(true);
    expect(pointInFloorPolygon({ x: 1.01, z: 0 }, square)).toBe(false);
    expect(pointInFloorPolygon({ x: 0, z: -5 }, square)).toBe(false);
  });

  it('gives the same answer for either winding', () => {
    const cw = [...square].reverse();
    for (const p of [{ x: 0.5, z: 0.5 }, { x: 3, z: 0 }, { x: -1.2, z: -1.2 }]) {
      expect(pointInFloorPolygon(p, cw)).toBe(pointInFloorPolygon(p, square));
    }
  });

  it('handles a concave polygon', () => {
    expect(pointInFloorPolygon({ x: 1, z: 3 }, lShape)).toBe(true);
    expect(pointInFloorPolygon({ x: 3, z: 1 }, lShape)).toBe(true);
    expect(pointInFloorPolygon({ x: 3, z: 3 }, lShape)).toBe(false); // the removed quadrant
  });

  it('counts the boundary as inside', () => {
    expect(pointInFloorPolygon({ x: 1, z: 0 }, square)).toBe(true);
    expect(pointInFloorPolygon({ x: 1, z: 1 }, square)).toBe(true);
    expect(pointInFloorPolygon({ x: 2, z: 3 }, lShape)).toBe(true);
  });

  it('is never true for a degenerate polygon or a non-finite point', () => {
    expect(pointInFloorPolygon({ x: 0, z: 0 }, [])).toBe(false);
    expect(pointInFloorPolygon({ x: 0, z: 0 }, square.slice(0, 2))).toBe(false);
    expect(pointInFloorPolygon({ x: Number.NaN, z: 0 }, square)).toBe(false);
    expect(pointInFloorPolygon({ x: 0, z: Number.POSITIVE_INFINITY }, square)).toBe(false);
  });
});

describe('pointInRoom', () => {
  const g = createRectangularRoom({ length: 5, width: 4, ceilingHeight: 2.7 });

  it('uses the first room floor polygon (inner wall faces)', () => {
    expect(pointInRoom(g, { x: 0, z: 0 })).toBe(true);
    expect(pointInRoom(g, { x: 2.4, z: 1.9 })).toBe(true);
    // QA-02 reproduce point: the room spans z −2…2, the product landed at z 3.74.
    expect(pointInRoom(g, { x: -0.48, z: 3.74 })).toBe(false);
    // Under the wall solid (centerline + thickness) is not in the room.
    expect(pointInRoom(g, { x: 2.56, z: 0 })).toBe(false);
  });

  it('applies the optional margin to every edge', () => {
    expect(pointInRoom(g, { x: 2.4, z: 0 }, 0.3)).toBe(false);
    expect(pointInRoom(g, { x: 2.1, z: 0 }, 0.3)).toBe(true);
    expect(pointInRoom(g, { x: 0, z: 0 }, 1.9)).toBe(true);
    expect(pointInRoom(g, { x: 0, z: 0 }, 2.1)).toBe(false);
  });

  it('is false when the graph has no usable floor polygon', () => {
    const empty: RoomGraph = { ...g, rooms: [] };
    expect(pointInRoom(empty, { x: 0, z: 0 })).toBe(false);
    const noPoly: RoomGraph = { ...g, rooms: [{ ...g.rooms[0]!, floor_polygon: [] }] };
    expect(pointInRoom(noPoly, { x: 0, z: 0 })).toBe(false);
  });
});

describe('wall cutaway plane', () => {
  const g = createRectangularRoom({ length: 5, width: 4, ceilingHeight: 2.7 });
  const poly = g.rooms[0]!.floor_polygon;

  it('points away from the room for every wall of a rectangular room', () => {
    for (const wall of g.walls) {
      const c = wallCutawayPlane(wall, poly)!;
      expect(Math.hypot(c.nx, c.nz)).toBeCloseTo(1, 6);
      const mx = (wall.a.x + wall.b.x) / 2;
      const mz = (wall.a.z + wall.b.z) / 2;
      // The room centre (0,0) is on the negative side; a point far outside along the normal is positive.
      expect(c.nx * (0 - c.px) + c.nz * (0 - c.pz)).toBeLessThan(0);
      expect(pointInFloorPolygon({ x: mx + c.nx * 0.05, z: mz + c.nz * 0.05 }, poly)).toBe(false);
    }
  });

  it('does not depend on the wall a→b direction', () => {
    for (const wall of g.walls) {
      const flipped = { ...wall, a: wall.b, b: wall.a };
      const c = wallCutawayPlane(wall, poly)!;
      const f = wallCutawayPlane(flipped, poly)!;
      expect(f.nx).toBeCloseTo(c.nx, 6);
      expect(f.nz).toBeCloseTo(c.nz, 6);
    }
  });

  it('points away from the room for every wall of a concave (L-shaped) drawn room, either drawing direction', () => {
    for (const points of [lShape, [...lShape].reverse()]) {
      let session = createDrawSession({ orthogrid: false });
      for (const p of points) session = addDrawPoint(session, p);
      const drawn = commitDrawSession(session);
      const drawnPoly = drawn.rooms[0]!.floor_polygon;
      expect(drawn.walls.length).toBe(6);
      for (const wall of drawn.walls) {
        const c = wallCutawayPlane(wall, drawnPoly)!;
        const mx = (wall.a.x + wall.b.x) / 2;
        const mz = (wall.a.z + wall.b.z) / 2;
        expect(pointInFloorPolygon({ x: mx + c.nx * 0.05, z: mz + c.nz * 0.05 }, drawnPoly)).toBe(false);
        expect(pointInFloorPolygon({ x: mx - c.nx * 0.05, z: mz - c.nz * 0.05 }, drawnPoly)).toBe(true);
      }
    }
  });

  it('never cuts a wall that has room on both sides, and falls back without a polygon', () => {
    const partition = { ...g.walls[0]!, a: { x: 0, z: -1 }, b: { x: 0, z: 1 } };
    expect(wallCutawayPlane(partition, poly)).toBeNull();
    const c = wallCutawayPlane(g.walls[0]!, undefined)!;
    expect(Math.hypot(c.nx, c.nz)).toBeCloseTo(1, 6);
  });

  it('buildRoomScene tags walls, adds hidden footprints, and keeps a default for a missing material', () => {
    const built = buildRoomScene(g);
    expect(built.wallFootprints.size).toBe(4);
    for (const [id, mesh] of built.wallMeshes) {
      expect(mesh.userData.cutaway).toBeTruthy();
      const fp = built.wallFootprints.get(id)!;
      expect(fp.visible).toBe(false);
      expect(fp.userData.kind).toBe('wall-footprint');
      expect(fp.userData.wallId).toBe(id);
    }
    expect(`#${built.materials.floor.color.getHexString()}`).toBe(DEFAULT_FLOOR_COLOR);
    built.dispose();

    const wallOnly = buildRoomScene(g, { wall: built.materials.wall.clone() });
    expect(`#${wallOnly.materials.floor.color.getHexString()}`).toBe(DEFAULT_FLOOR_COLOR);
    expect(wallOnly.ceiling).toBeNull();
    wallOnly.dispose();
  });
});
