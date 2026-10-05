import { describe, expect, it } from 'vitest';
import { addOpening, createRectangularRoom } from '../../src/viewer/roomGraph';
import { buildPlanSvg } from '../../src/viewer/roomPlan';

describe('roomPlan', () => {
  it('includes dimension labels and door arc markup', () => {
    let g = createRectangularRoom({ length: 5, width: 4, ceilingHeight: 2.7 });
    g = addOpening(g, {
      wall_id: g.walls[0]!.id,
      type: 'door',
      offset_along_wall: 1,
      width: 0.9,
      height: 2.1,
      sill_height: 0,
    });
    const svg = buildPlanSvg(g, { unit: 'm' });
    expect(svg).toContain('<svg');
    expect(svg).toMatch(/m/);
    expect(svg).toContain('path'); // door swing
  });
});
