import { describe, expect, it } from 'vitest';
import {
  DEFAULT_DOOR,
  DEFAULT_WINDOW,
  addOpening,
  createRectangularRoom,
  openingOffsetFromHit,
  toMeters,
  validateOpening,
  wallLength,
} from '../../src/viewer/roomGraph';

describe('roomGraph', () => {
  it('creates a rectangular room with four walls and empty openings/placements', () => {
    const g = createRectangularRoom({ length: 5, width: 4, ceilingHeight: 2.7, wallThickness: 0.12 });
    expect(g.schema_version).toBe(1);
    expect(g.units).toBe('m');
    expect(g.provenance).toEqual({ kind: 'authored', confirm_status: 'confirmed' });
    expect(g.source_assets).toEqual([]);
    expect(g.rooms).toHaveLength(1);
    expect(g.walls).toHaveLength(4);
    expect(g.openings).toHaveLength(0);
    expect(g.placements).toHaveLength(0);
    expect(g.rooms[0]!.ceiling_height).toBe(2.7);
    expect(g.rooms[0]!.floor_polygon).toHaveLength(4);
    for (const w of g.walls) {
      expect(w.height).toBe(2.7);
      expect(w.thickness).toBe(0.12);
      expect(wallLength(w)).toBeGreaterThan(0);
    }
  });

  it('rejects non-positive sizes', () => {
    expect(() => createRectangularRoom({ length: 0, width: 4, ceilingHeight: 2.7 })).toThrow(/positive/i);
  });

  it('validates and adds door/window openings on a wall', () => {
    const g = createRectangularRoom({ length: 5, width: 4, ceilingHeight: 2.7 });
    const wall = g.walls[0]!;
    const door = validateOpening(g, {
      wall_id: wall.id,
      type: 'door',
      offset_along_wall: 1,
      ...DEFAULT_DOOR,
    });
    expect(door.ok).toBe(true);
    const withDoor = addOpening(g, {
      wall_id: wall.id,
      type: 'door',
      offset_along_wall: 1,
    });
    expect(withDoor.openings).toHaveLength(1);
    expect(withDoor.openings[0]!.type).toBe('door');
    expect(withDoor.openings[0]!.sill_height).toBe(0);

    const win = validateOpening(withDoor, {
      wall_id: wall.id,
      type: 'window',
      offset_along_wall: 2.5,
      ...DEFAULT_WINDOW,
    });
    expect(win.ok).toBe(true);

    const tooWide = validateOpening(g, {
      wall_id: wall.id,
      type: 'door',
      offset_along_wall: wallLength(wall) - 0.2,
      width: 0.9,
      height: 2.1,
      sill_height: 0,
    });
    expect(tooWide.ok).toBe(false);
  });

  it('computes opening offset from a wall hit', () => {
    const g = createRectangularRoom({ length: 4, width: 3, ceilingHeight: 2.7 });
    const wall = g.walls[0]!; // south: (-2,-1.5) → (2,-1.5)
    const mid = { x: 0, z: -1.5 };
    const offset = openingOffsetFromHit(wall, mid, 0.9);
    expect(offset).toBeCloseTo(2 - 0.45, 5);
  });

  it('converts display units to meters', () => {
    expect(toMeters(100, 'cm')).toBe(1);
    expect(toMeters(1, 'm')).toBe(1);
    expect(toMeters(10, 'ft-in')).toBeCloseTo(3.048, 5);
  });
});
