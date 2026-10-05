import { describe, expect, it } from 'vitest';
import { Box3 } from 'three';
import { addOpening, createRectangularRoom } from '../../src/viewer/roomGraph';
import {
  buildRoomScene,
  FLOOR_SLAB_DEPTH_M,
  FLOOR_TOP_EPS_M,
  floorPolygonBounds,
  outerFloorPolygon,
  wallCenterlinePolygon,
} from '../../src/viewer/roomMesh';

describe('roomMesh', () => {
  it('builds wall + floor meshes from a rectangular graph with opening holes', () => {
    let g = createRectangularRoom({ length: 4, width: 3, ceilingHeight: 2.7 });
    g = addOpening(g, {
      wall_id: g.walls[0]!.id,
      type: 'door',
      offset_along_wall: 1.2,
    });
    const built = buildRoomScene(g);
    expect(built.wallMeshes.size).toBe(4);
    expect(built.floor).toBeTruthy();
    expect(built.floor!.userData.kind).toBe('floor');
    for (const [id, mesh] of built.wallMeshes) {
      expect(mesh.userData.wallId).toBe(id);
      expect(mesh.userData.kind).toBe('wall');
      expect(mesh.geometry.getAttribute('position').count).toBeGreaterThan(0);
    }
    built.dispose();
  });

  it('floor mesh XZ footprint matches outer wall footprint (inner graph + thickness)', () => {
    const length = 5;
    const width = 4;
    const thickness = 0.12;
    const g = createRectangularRoom({ length, width, ceilingHeight: 2.7, wallThickness: thickness });
    const polyBounds = floorPolygonBounds(g.rooms[0]!.floor_polygon);
    expect(polyBounds.sizeX).toBeCloseTo(length, 6);
    expect(polyBounds.sizeZ).toBeCloseTo(width, 6);

    const centerline = wallCenterlinePolygon(g.walls);
    expect(centerline).toBeTruthy();
    const clBounds = floorPolygonBounds(centerline!);
    expect(clBounds.minX).toBeCloseTo(polyBounds.minX, 6);
    expect(clBounds.maxX).toBeCloseTo(polyBounds.maxX, 6);

    const outer = outerFloorPolygon(g.rooms[0]!.floor_polygon, g.walls);
    const outerBounds = floorPolygonBounds(outer);
    expect(outerBounds.sizeX).toBeCloseTo(length + 2 * thickness, 5);
    expect(outerBounds.sizeZ).toBeCloseTo(width + 2 * thickness, 5);

    const built = buildRoomScene(g);
    expect(built.floor).toBeTruthy();
    built.root.updateMatrixWorld(true);
    const floorBox = new Box3().setFromObject(built.floor!);
    expect(floorBox.max.x - floorBox.min.x).toBeCloseTo(length + 2 * thickness, 4);
    expect(floorBox.max.z - floorBox.min.z).toBeCloseTo(width + 2 * thickness, 4);
    expect(floorBox.min.x).toBeCloseTo(outerBounds.minX, 4);
    expect(floorBox.max.x).toBeCloseTo(outerBounds.maxX, 4);
    expect(floorBox.min.z).toBeCloseTo(outerBounds.minZ, 4);
    expect(floorBox.max.z).toBeCloseTo(outerBounds.maxZ, 4);
    // Floor top just below y=0 (wall feet), slab below that
    expect(floorBox.max.y).toBeCloseTo(-FLOOR_TOP_EPS_M, 5);
    expect(floorBox.min.y).toBeCloseTo(-FLOOR_SLAB_DEPTH_M - FLOOR_TOP_EPS_M, 5);

    // Walls extrude outward only: outer AABB matches floor outer footprint in XZ
    const wallUnion = new Box3();
    for (const mesh of built.wallMeshes.values()) {
      wallUnion.union(new Box3().setFromObject(mesh));
    }
    expect(wallUnion.max.x - wallUnion.min.x).toBeCloseTo(length + 2 * thickness, 4);
    expect(wallUnion.max.z - wallUnion.min.z).toBeCloseTo(width + 2 * thickness, 4);
    expect(wallUnion.min.x).toBeCloseTo(floorBox.min.x, 4);
    expect(wallUnion.max.x).toBeCloseTo(floorBox.max.x, 4);
    expect(wallUnion.min.z).toBeCloseTo(floorBox.min.z, 4);
    expect(wallUnion.max.z).toBeCloseTo(floorBox.max.z, 4);
    // Wall bottoms at y=0 sit above floor top (no coplanar fight)
    expect(wallUnion.min.y).toBeCloseTo(0, 4);
    expect(floorBox.max.y).toBeLessThan(wallUnion.min.y);

    built.dispose();
  });

  it('wall bottoms sit at y=0 above recessed floor top', () => {
    const g = createRectangularRoom({ length: 5, width: 4, ceilingHeight: 2.7, wallThickness: 0.12 });
    const built = buildRoomScene(g);
    built.root.updateMatrixWorld(true);
    const floorBox = new Box3().setFromObject(built.floor!);
    for (const mesh of built.wallMeshes.values()) {
      const box = new Box3().setFromObject(mesh);
      expect(box.min.y).toBeCloseTo(0, 4);
      expect(box.min.y).toBeGreaterThan(floorBox.max.y);
    }
    built.dispose();
  });
});
