import { describe, expect, it } from 'vitest';
import { createRectangularRoom } from '../../src/viewer/roomGraph';
import { exportProjectJson, parseProjectJson, serializeProject } from '../../src/viewer/projectIO';

describe('projectIO', () => {
  it('round-trips export JSON', () => {
    const graph = createRectangularRoom({ length: 3, width: 3, ceilingHeight: 2.7 });
    const exp = exportProjectJson({ graph, templates: [], label: 'test' });
    const parsed = parseProjectJson(JSON.parse(serializeProject(exp)));
    expect(parsed.room_graph?.rooms[0]?.ceiling_height).toBe(2.7);
    expect(parsed.schema_version).toBe(1);
  });
});
