import { describe, expect, it } from 'vitest';
import { createRectangularRoom } from '../../src/viewer/roomGraph';
import { RoomHistory } from '../../src/viewer/roomHistory';
import { addOpening } from '../../src/viewer/roomGraph';

describe('RoomHistory', () => {
  it('undo/redo restores graph tips', () => {
    const h = new RoomHistory();
    const a = createRectangularRoom({ length: 4, width: 3, ceilingHeight: 2.7 });
    h.reset(a);
    const b = addOpening(a, {
      wall_id: a.walls[0]!.id,
      type: 'door',
      offset_along_wall: 0.5,
      width: 0.9,
      height: 2.1,
      sill_height: 0,
    });
    h.commit(b);
    expect(h.canUndo()).toBe(true);
    const undone = h.undo();
    expect(undone?.openings).toHaveLength(0);
    const redone = h.redo();
    expect(redone?.openings).toHaveLength(1);
  });
});
