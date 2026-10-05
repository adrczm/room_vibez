import { afterEach, describe, expect, it } from 'vitest';
import {
  QUARANTINE_STORAGE_KEY,
  STORAGE_KEY,
  createRectangularRoom,
  discardQuarantinedRoomGraph,
  loadPersistedRoomGraph,
  loadPersistedRoomGraphOrQuarantine,
  persistRoomGraph,
  quarantinePersistedRoomGraph,
  readQuarantinedRoomGraph,
  type StorageLike,
} from '../../src/viewer/roomGraph';

/** In-memory Storage-like object; `failOn` makes the named operations throw, like a blocked or full browser store. */
function memoryStorage(failOn: Array<'getItem' | 'setItem' | 'removeItem'> = []) {
  const map = new Map<string, string>();
  const fail = (op: 'getItem' | 'setItem' | 'removeItem') => {
    if (failOn.includes(op)) throw new Error(`storage ${op} blocked`);
  };
  const storage: StorageLike = {
    getItem: (k) => {
      fail('getItem');
      return map.get(k) ?? null;
    },
    setItem: (k, v) => {
      fail('setItem');
      map.set(k, String(v));
    },
    removeItem: (k) => {
      fail('removeItem');
      map.delete(k);
    },
  };
  return { storage, map };
}

/** The saved value from the stress test (R6 / F1) that booted the app into an error. */
const STRESS_TEST_POISON = JSON.stringify({
  schema_version: 1,
  rooms: [{ id: 'r', floor_polygon: [{ x: null, z: 0 }], ceiling_height: 'tall' }],
  walls: [{ id: 'w', a: { x: 0, z: 0 }, b: { x: 0, z: 0 }, thickness: 0 }],
  openings: [],
  placements: [],
});

const FIXED_NOW = () => new Date('2026-10-05T12:00:00.000Z');
const room = () => createRectangularRoom({ length: 5, width: 4, ceilingHeight: 2.7 });

describe('persistRoomGraph reports whether saving worked', () => {
  afterEach(() => {
    Reflect.deleteProperty(globalThis, 'localStorage');
  });

  it('returns true and stores the room when storage accepts the write', () => {
    const { storage, map } = memoryStorage();
    const graph = room();
    expect(persistRoomGraph(graph, storage)).toBe(true);
    expect(JSON.parse(map.get(STORAGE_KEY)!)).toEqual(graph);
    expect(loadPersistedRoomGraph(storage)?.walls).toHaveLength(4);
  });

  it('returns true and removes the key when the room is cleared', () => {
    const { storage, map } = memoryStorage();
    persistRoomGraph(room(), storage);
    expect(persistRoomGraph(null, storage)).toBe(true);
    expect(map.has(STORAGE_KEY)).toBe(false);
  });

  it('returns false, and does not throw, when storage refuses the write', () => {
    const { storage, map } = memoryStorage(['setItem']);
    expect(persistRoomGraph(room(), storage)).toBe(false);
    expect(map.has(STORAGE_KEY)).toBe(false);
  });

  it('returns false when removing the saved room is refused', () => {
    const { storage } = memoryStorage(['removeItem']);
    expect(persistRoomGraph(null, storage)).toBe(false);
  });

  it('returns false when there is no localStorage at all (existing one-argument call)', () => {
    Object.defineProperty(globalThis, 'localStorage', { value: undefined, configurable: true });
    expect(persistRoomGraph(room())).toBe(false);
    expect(loadPersistedRoomGraph()).toBeNull();
  });

  it('returns false when merely reading window.localStorage throws', () => {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get() {
        throw new Error('SecurityError: storage is blocked');
      },
    });
    expect(persistRoomGraph(room())).toBe(false);
    expect(loadPersistedRoomGraphOrQuarantine()).toEqual({ status: 'storage_unavailable', graph: null });
  });

  it('uses the global localStorage when no storage is passed', () => {
    const { storage, map } = memoryStorage();
    Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true });
    expect(persistRoomGraph(room())).toBe(true);
    expect(map.has(STORAGE_KEY)).toBe(true);
  });
});

describe('loadPersistedRoomGraphOrQuarantine', () => {
  it('reports "none" when nothing is saved', () => {
    const { storage, map } = memoryStorage();
    expect(loadPersistedRoomGraphOrQuarantine(storage)).toEqual({ status: 'none', graph: null });
    expect(map.size).toBe(0);
  });

  it('returns a readable room and leaves storage alone', () => {
    const { storage, map } = memoryStorage();
    const graph = room();
    persistRoomGraph(graph, storage);
    const result = loadPersistedRoomGraphOrQuarantine(storage);
    expect(result.status).toBe('ok');
    expect(result.graph).toEqual(graph);
    expect(map.has(QUARANTINE_STORAGE_KEY)).toBe(false);
    expect(map.has(STORAGE_KEY)).toBe(true);
  });

  it('moves the stress-test poison to the backup key and starts empty', () => {
    const { storage, map } = memoryStorage();
    map.set(STORAGE_KEY, STRESS_TEST_POISON);

    const result = loadPersistedRoomGraphOrQuarantine(storage, FIXED_NOW);

    expect(result.status).toBe('unreadable');
    expect(result.graph).toBeNull();
    if (result.status !== 'unreadable') throw new Error('unreachable');
    expect(result.backedUp).toBe(true);
    expect(result.removed).toBe(true);
    expect(result.quarantined).toEqual({
      raw: STRESS_TEST_POISON,
      reason: 'invalid_graph',
      detail: 'rooms[0].floor_polygon has fewer than 3 points',
      quarantined_at: '2026-10-05T12:00:00.000Z',
    });
    // Moved, not copied: the main key is free and the backup holds the exact original text.
    expect(map.has(STORAGE_KEY)).toBe(false);
    expect(readQuarantinedRoomGraph(storage)).toEqual(result.quarantined);
    // The next boot is clean.
    expect(loadPersistedRoomGraphOrQuarantine(storage)).toEqual({ status: 'none', graph: null });
  });

  it('quarantines text that is not JSON, with reason "not_json"', () => {
    const { storage, map } = memoryStorage();
    map.set(STORAGE_KEY, '{bad');
    const result = loadPersistedRoomGraphOrQuarantine(storage, FIXED_NOW);
    if (result.status !== 'unreadable') throw new Error(`expected unreadable, got ${result.status}`);
    expect(result.quarantined.reason).toBe('not_json');
    expect(result.quarantined.raw).toBe('{bad');
    expect(map.has(STORAGE_KEY)).toBe(false);
    expect(readQuarantinedRoomGraph(storage)?.raw).toBe('{bad');
  });

  it('keeps the only stored copy when the backup cannot be written', () => {
    const { storage, map } = memoryStorage(['setItem']);
    map.set(STORAGE_KEY, STRESS_TEST_POISON);
    const result = loadPersistedRoomGraphOrQuarantine(storage, FIXED_NOW);
    if (result.status !== 'unreadable') throw new Error(`expected unreadable, got ${result.status}`);
    expect(result.graph).toBeNull();
    expect(result.backedUp).toBe(false);
    expect(result.removed).toBe(false);
    // Still offered to the host for download, and still in storage.
    expect(result.quarantined.raw).toBe(STRESS_TEST_POISON);
    expect(map.get(STORAGE_KEY)).toBe(STRESS_TEST_POISON);
    expect(map.has(QUARANTINE_STORAGE_KEY)).toBe(false);
  });

  it('reports "storage_unavailable" when storage cannot be read', () => {
    const { storage } = memoryStorage(['getItem']);
    expect(loadPersistedRoomGraphOrQuarantine(storage)).toEqual({ status: 'storage_unavailable', graph: null });
  });

  it('a newer quarantine replaces the older backup', () => {
    const { storage, map } = memoryStorage();
    map.set(STORAGE_KEY, '{first');
    loadPersistedRoomGraphOrQuarantine(storage, FIXED_NOW);
    map.set(STORAGE_KEY, '{second');
    loadPersistedRoomGraphOrQuarantine(storage, FIXED_NOW);
    expect(readQuarantinedRoomGraph(storage)?.raw).toBe('{second');
  });
});

describe('quarantine helpers', () => {
  it('lets the host quarantine a room that validated but failed to render', () => {
    const { storage, map } = memoryStorage();
    const graph = room();
    persistRoomGraph(graph, storage);
    const saved = map.get(STORAGE_KEY)!;

    const outcome = quarantinePersistedRoomGraph('render_failed', 'TypeError: boom', storage, FIXED_NOW);

    expect(outcome).toEqual({
      quarantined: {
        raw: saved,
        reason: 'render_failed',
        detail: 'TypeError: boom',
        quarantined_at: '2026-10-05T12:00:00.000Z',
      },
      backedUp: true,
      removed: true,
    });
    expect(map.has(STORAGE_KEY)).toBe(false);
  });

  it('returns null when there is nothing to quarantine or storage is unreadable', () => {
    expect(quarantinePersistedRoomGraph('render_failed', 'x', memoryStorage().storage)).toBeNull();
    expect(quarantinePersistedRoomGraph('render_failed', 'x', memoryStorage(['getItem']).storage)).toBeNull();
  });

  it('reads back null when there is no backup or it is damaged, and can discard a backup', () => {
    const { storage, map } = memoryStorage();
    expect(readQuarantinedRoomGraph(storage)).toBeNull();
    map.set(QUARANTINE_STORAGE_KEY, 'not json');
    expect(readQuarantinedRoomGraph(storage)).toBeNull();
    map.set(QUARANTINE_STORAGE_KEY, JSON.stringify({ raw: '{x', reason: 'not_json', detail: 'd', quarantined_at: 't' }));
    expect(readQuarantinedRoomGraph(storage)).toEqual({ raw: '{x', reason: 'not_json', detail: 'd', quarantined_at: 't' });
    expect(discardQuarantinedRoomGraph(storage)).toBe(true);
    expect(map.has(QUARANTINE_STORAGE_KEY)).toBe(false);
    expect(discardQuarantinedRoomGraph(memoryStorage(['removeItem']).storage)).toBe(false);
  });
});
