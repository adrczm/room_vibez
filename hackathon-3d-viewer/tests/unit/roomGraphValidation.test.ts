import { describe, expect, it } from 'vitest';
import { confirmImportToRoomGraph, startImportJob } from '../../src/viewer/dwgImport';
import { addDrawPoint, commitDrawSession, createDrawSession } from '../../src/viewer/freeformWalls';
import { confirmUnderlayToRoomGraph, startUnderlayJob } from '../../src/viewer/planUnderlay';
import { parseProjectJson } from '../../src/viewer/projectIO';
import {
  ROOM_SIZE_ERROR_MESSAGE,
  RoomSizeError,
  addOpening,
  addPlacement,
  cloneRoomGraphSeed,
  createRectangularRoom,
  invalidRoomSizeFields,
  normalizeRoomGraph,
  roomGraphProblem,
  setRoomSurfaceMaterials,
  type RoomGraph,
} from '../../src/viewer/roomGraph';
import { RoomHistory } from '../../src/viewer/roomHistory';

/** What storage and project files hold: the graph after a JSON round trip. */
const stored = (graph: RoomGraph): unknown => JSON.parse(JSON.stringify(graph));

function furnishedRoom(): RoomGraph {
  let g = createRectangularRoom({ length: 5, width: 4, ceilingHeight: 2.7 });
  g = addOpening(g, { wall_id: g.walls[0]!.id, type: 'door', offset_along_wall: 1 });
  g = addOpening(g, { wall_id: g.walls[2]!.id, type: 'window', offset_along_wall: 1.5 });
  g = addPlacement(g, {
    sku_id: 'STUB-SKU',
    asset_ref: '/assets/models/chair.glb',
    product_id: 'demo-lounge-chair',
    position: { x: 0.5, y: 0, z: -0.5 },
    rotation_y: Math.PI / 2,
    scale: 1,
    slot_bindings: { seat: 'fabric-wool' },
  });
  return setRoomSurfaceMaterials(g, { floor_material_id: 'wood-oak', wall_material_id: 'paint-white' });
}

/** A valid stored graph with one part replaced, to test one rule at a time. */
function withPatch(patch: (g: any) => void): unknown {
  const g = stored(furnishedRoom()) as any;
  patch(g);
  return JSON.parse(JSON.stringify(g)); // NaN / Infinity become null, as they would in storage
}

describe('normalizeRoomGraph accepts every room the app itself produces', () => {
  it('rectangular room with openings, a placement and materials', () => {
    const g = furnishedRoom();
    expect(roomGraphProblem(stored(g))).toBeNull();
    expect(normalizeRoomGraph(stored(g))).toEqual(g);
  });

  it('freeform drawn room', () => {
    let s = createDrawSession();
    for (const p of [
      { x: 0, z: 0 },
      { x: 4, z: 0 },
      { x: 4, z: 3 },
      { x: 2, z: 3 },
      { x: 2, z: 5 },
      { x: 0, z: 5 },
    ]) {
      s = addDrawPoint(s, p);
    }
    const g = commitDrawSession(s);
    expect(roomGraphProblem(stored(g))).toBeNull();
  });

  it('room confirmed from the sample plan, and a template instance cloned from it', async () => {
    const g = confirmImportToRoomGraph(await startImportJob(null, { useFixture: true }));
    expect(roomGraphProblem(stored(g))).toBeNull();
    const instance = cloneRoomGraphSeed(g, {
      provenance: { kind: 'template_instance', template_id: 'tpl_1', confirm_status: 'confirmed' },
    });
    expect(roomGraphProblem(stored(instance))).toBeNull();
  });

  it('room confirmed from an image underlay', async () => {
    const file = new File([new Uint8Array([1, 2, 3])], 'plan.jpg', { type: 'image/jpeg' });
    const g = confirmUnderlayToRoomGraph(await startUnderlayJob(file, { width_m: 6, depth_m: 4 }));
    expect(roomGraphProblem(stored(g))).toBeNull();
    expect(normalizeRoomGraph(stored(g))?.underlay?.width_m).toBe(6);
  });

  it('legacy provenance string, and missing optional lists', () => {
    const legacy = stored(createRectangularRoom({ length: 3, width: 3, ceilingHeight: 2.7 })) as any;
    legacy.provenance = 'authored';
    delete legacy.openings;
    delete legacy.placements;
    delete legacy.source_assets;
    const g = normalizeRoomGraph(legacy);
    expect(g?.provenance).toEqual({ kind: 'authored', confirm_status: 'confirmed' });
    expect(g?.openings).toEqual([]);
    expect(g?.placements).toEqual([]);
    expect(g?.source_assets).toEqual([]);
  });

  it('a room with no walls is still accepted (not one of the rules)', () => {
    expect(roomGraphProblem(withPatch((g) => (g.walls = [])))).toBeNull();
  });

  it('undo history still clones app-produced rooms', () => {
    const h = new RoomHistory();
    const g = furnishedRoom();
    h.reset(g);
    expect(h.getCurrent()).toEqual(g);
  });
});

describe('normalizeRoomGraph rejects rooms that cannot be displayed', () => {
  const cases: Array<[name: string, raw: unknown, problem: string]> = [
    ['not an object', 'room', 'not an object'],
    ['a list', [], 'not an object'],
    ['wrong schema_version', withPatch((g) => (g.schema_version = 2)), 'schema_version is not 1'],
    ['walls not a list', withPatch((g) => (g.walls = null)), 'walls is not a list'],
    ['rooms not a list', withPatch((g) => (g.rooms = 'x')), 'rooms is not a list'],
    ['no rooms', withPatch((g) => (g.rooms = [])), 'rooms is empty'],
    ['a null room', withPatch((g) => (g.rooms = [null])), 'rooms[0] is not an object'],
    ['polygon missing', withPatch((g) => delete g.rooms[0].floor_polygon), 'rooms[0].floor_polygon has fewer than 3 points'],
    ['polygon with 2 points', withPatch((g) => (g.rooms[0].floor_polygon.length = 2)), 'rooms[0].floor_polygon has fewer than 3 points'],
    ['polygon point NaN', withPatch((g) => (g.rooms[0].floor_polygon[1].x = NaN)), 'rooms[0].floor_polygon[1] is not a finite point'],
    ['polygon point as text', withPatch((g) => (g.rooms[0].floor_polygon[3].z = '2')), 'rooms[0].floor_polygon[3] is not a finite point'],
    ['ceiling as text', withPatch((g) => (g.rooms[0].ceiling_height = 'tall')), 'rooms[0].ceiling_height is not a number above 0'],
    ['ceiling 0', withPatch((g) => (g.rooms[0].ceiling_height = 0)), 'rooms[0].ceiling_height is not a number above 0'],
    ['ceiling negative', withPatch((g) => (g.rooms[0].ceiling_height = -2.7)), 'rooms[0].ceiling_height is not a number above 0'],
    ['a null wall', withPatch((g) => (g.walls[1] = null)), 'walls[1] is not an object'],
    ['wall end point null', withPatch((g) => (g.walls[0].a.x = null)), 'walls[0].a is not a finite point'],
    ['wall end point missing', withPatch((g) => delete g.walls[2].b), 'walls[2].b is not a finite point'],
    ['wall end point Infinity', withPatch((g) => (g.walls[0].b.z = Infinity)), 'walls[0].b is not a finite point'],
    ['wall thickness 0', withPatch((g) => (g.walls[0].thickness = 0)), 'walls[0].thickness is not a number above 0'],
    ['wall thickness negative', withPatch((g) => (g.walls[3].thickness = -0.12)), 'walls[3].thickness is not a number above 0'],
    ['wall thickness missing', withPatch((g) => delete g.walls[0].thickness), 'walls[0].thickness is not a number above 0'],
    ['wall height null', withPatch((g) => (g.walls[0].height = null)), 'walls[0].height is not a number above 0'],
    ['a null opening', withPatch((g) => (g.openings[0] = null)), 'openings[0] is not an object'],
    ['opening width null', withPatch((g) => (g.openings[0].width = null)), 'openings[0].width is not a finite number'],
    ['opening sill as text', withPatch((g) => (g.openings[1].sill_height = '0.9')), 'openings[1].sill_height is not a finite number'],
    ['opening offset NaN', withPatch((g) => (g.openings[0].offset_along_wall = NaN)), 'openings[0].offset_along_wall is not a finite number'],
    ['a null placement', withPatch((g) => (g.placements[0] = null)), 'placements[0] is not an object'],
    ['placement position null', withPatch((g) => (g.placements[0].position = null)), 'placements[0].position is not a finite point'],
    ['placement x null', withPatch((g) => (g.placements[0].position.x = null)), 'placements[0].position is not a finite point'],
    ['placement y null', withPatch((g) => (g.placements[0].position.y = null)), 'placements[0].position.y is not a finite number'],
    ['placement rotation NaN', withPatch((g) => (g.placements[0].rotation_y = NaN)), 'placements[0].rotation_y is not a finite number'],
    ['placement scale as text', withPatch((g) => (g.placements[0].scale = 'big')), 'placements[0].scale is not a finite number'],
  ];

  it.each(cases)('%s', (_name, raw, problem) => {
    expect(roomGraphProblem(raw)).toBe(problem);
    expect(normalizeRoomGraph(raw)).toBeNull();
  });

  it('rejects the saved value from the stress test (R6) that crashed boot', () => {
    const poison = {
      schema_version: 1,
      rooms: [{ id: 'r', floor_polygon: [{ x: null, z: 0 }], ceiling_height: 'tall' }],
      walls: [{ id: 'w', a: { x: 0, z: 0 }, b: { x: 0, z: 0 }, thickness: 0 }],
      openings: [],
      placements: [],
    };
    expect(normalizeRoomGraph(poison)).toBeNull();
  });

  it('a project file with such a room is refused with the existing message', () => {
    const project = {
      schema_version: 1,
      room_graph: withPatch((g) => (g.walls[0].thickness = 0)),
      templates: [],
    };
    expect(() => parseProjectJson(project)).toThrow('room_graph failed normalizeRoomGraph');
  });
});

describe('createRectangularRoom names the invalid size field', () => {
  const ok = { length: 5, width: 4, ceilingHeight: 2.7, wallThickness: 0.12 };

  it.each([
    ['length', { ...ok, length: 0 }],
    ['width', { ...ok, width: -4 }],
    ['ceilingHeight', { ...ok, ceilingHeight: NaN }],
    ['wallThickness', { ...ok, wallThickness: 0 }],
  ] as const)('%s', (field, input) => {
    expect(invalidRoomSizeFields(input)).toEqual([field]);
    try {
      createRectangularRoom(input);
      expect.unreachable('should throw');
    } catch (err) {
      expect(err).toBeInstanceOf(RoomSizeError);
      expect((err as RoomSizeError).fields).toEqual([field]);
      // The message is the one thrown before this change; the field travels on the error object.
      expect((err as RoomSizeError).message).toBe(ROOM_SIZE_ERROR_MESSAGE);
      expect((err as RoomSizeError).message).toBe(
        'Room size must be positive (length, width, ceiling height, wall thickness)',
      );
    }
  });

  it('lists every invalid field in form order', () => {
    const input = { length: 0, width: Number('abc'), ceilingHeight: -1, wallThickness: -0.1 };
    expect(invalidRoomSizeFields(input)).toEqual(['length', 'width', 'ceilingHeight', 'wallThickness']);
  });

  it('treats an infinite size as invalid (it could not be saved)', () => {
    expect(invalidRoomSizeFields({ ...ok, length: Infinity })).toEqual(['length']);
    expect(() => createRectangularRoom({ ...ok, length: Infinity })).toThrow(RoomSizeError);
  });

  it('a missing wall thickness is valid and gets the default', () => {
    const input = { length: 5, width: 4, ceilingHeight: 2.7 };
    expect(invalidRoomSizeFields(input)).toEqual([]);
    expect(createRectangularRoom(input).walls[0]!.thickness).toBe(0.12);
  });
});
