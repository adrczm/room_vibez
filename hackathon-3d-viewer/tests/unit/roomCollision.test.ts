import { describe, expect, it } from 'vitest';
import { createRectangularRoom, addPlacement } from '../../src/viewer/roomGraph';
import { checkPlacementCollision, footprintFromPlacement, formatCollisionWarn } from '../../src/viewer/roomCollision';
import { snapPlacementToWall } from '../../src/viewer/roomSnap';

describe('room collision + snap', () => {
  it('soft-warns overlapping furniture footprints', () => {
    let g = createRectangularRoom({ length: 5, width: 4, ceilingHeight: 2.7 });
    g = addPlacement(g, {
      sku_id: 'STUB',
      asset_ref: 'x',
      product_id: 'p1',
      position: { x: 0, y: 0, z: 0 },
      rotation_y: 0,
      scale: 1,
      slot_bindings: {},
    });
    const fp = footprintFromPlacement(g.placements[0]!, { sx: 1, sz: 1 });
    const report = checkPlacementCollision(g, fp, { ignorePlacementId: 'nope' });
    expect(report.ok).toBe(false);
    expect(formatCollisionWarn(report)).toMatch(/Soft overlap/);
  });

  it('snaps toward nearest wall with inward offset', () => {
    const g = createRectangularRoom({ length: 5, width: 4, ceilingHeight: 2.7 });
    const snap = snapPlacementToWall(g, { x: 0, z: -1.8 }, 0.3);
    expect(snap).toBeTruthy();
    expect(snap!.wall_id).toBeTruthy();
    expect(Number.isFinite(snap!.rotation_y)).toBe(true);
  });
});
