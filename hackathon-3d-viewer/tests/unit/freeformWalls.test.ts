import { describe, expect, it } from 'vitest';
import {
  addDrawPoint,
  closeDistance,
  commitDrawSession,
  createDrawSession,
} from '../../src/viewer/freeformWalls';

describe('freeformWalls', () => {
  it('commits an orthogonal rectangle', () => {
    let s = createDrawSession({ orthogrid: true });
    s = addDrawPoint(s, { x: -2, z: -1.5 });
    s = addDrawPoint(s, { x: 2, z: -1.5 });
    s = addDrawPoint(s, { x: 2, z: 1.5 });
    s = addDrawPoint(s, { x: -2, z: 1.5 });
    expect(closeDistance(s, { x: -2, z: -1.5 })).toBe(true);
    const g = commitDrawSession(s);
    expect(g.walls.length).toBe(4);
    expect(g.rooms[0]?.floor_polygon.length).toBe(4);
  });
});
