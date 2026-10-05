import { afterEach, describe, expect, it } from 'vitest';
import {
  IDB_STORE,
  clearProjectFromIdb,
  exportProjectJson,
  idbGet,
  idbSet,
  loadProjectFromIdb,
  persistProjectToIdb,
} from '../../src/viewer/projectIO';
import { createRectangularRoom } from '../../src/viewer/roomGraph';

/**
 * A small in-memory stand-in for the parts of IndexedDB that projectIO uses (open, one object store,
 * put / get / delete, transaction completion). Requests settle asynchronously, like the real thing.
 * It records every write so the order of operations can be checked.
 */
function installFakeIndexedDb() {
  const stores = new Map<string, Map<string, unknown>>();
  const log: string[] = [];
  const indexedDB = {
    open() {
      const req: any = { result: undefined, error: null };
      const db = {
        objectStoreNames: { contains: (name: string) => stores.has(name) },
        createObjectStore: (name: string) => void stores.set(name, new Map()),
        transaction(name: string) {
          const data = stores.get(name)!;
          const tx: any = { error: null };
          let pending = 0;
          const op = (run: () => unknown) => {
            const request: any = {};
            pending += 1;
            setTimeout(() => {
              request.result = run();
              pending -= 1;
              request.onsuccess?.();
              if (pending === 0) setTimeout(() => tx.oncomplete?.(), 0);
            }, 0);
            return request;
          };
          tx.objectStore = () => ({
            put: (value: unknown, key: string) =>
              op(() => {
                data.set(key, structuredClone(value));
                log.push(`put ${key}`);
              }),
            get: (key: string) => op(() => data.get(key)),
            delete: (key: string) =>
              op(() => {
                data.delete(key);
                log.push(`delete ${key}`);
              }),
          });
          return tx;
        },
        close() {},
      };
      setTimeout(() => {
        req.result = db;
        if (!stores.has(IDB_STORE)) req.onupgradeneeded?.();
        req.onsuccess?.();
      }, 0);
      return req;
    },
  };
  Object.defineProperty(globalThis, 'indexedDB', { value: indexedDB, configurable: true });
  return { log, keys: () => [...(stores.get(IDB_STORE)?.keys() ?? [])].sort() };
}

const exportedProject = () =>
  exportProjectJson({
    graph: createRectangularRoom({ length: 5, width: 4, ceilingHeight: 2.7 }),
    templates: [],
    label: 'Living',
  });

describe('clearProjectFromIdb', () => {
  afterEach(() => {
    Reflect.deleteProperty(globalThis, 'indexedDB');
  });

  it('resolves false, and does not reject, when IndexedDB is unavailable', async () => {
    Object.defineProperty(globalThis, 'indexedDB', { value: undefined, configurable: true });
    await expect(clearProjectFromIdb()).resolves.toBe(false);
  });

  it('removes the copy that Export project left, so boot has nothing to fall back to', async () => {
    const idb = installFakeIndexedDb();
    await persistProjectToIdb(exportedProject());
    expect(idb.keys()).toEqual(['project', 'room_graph', 'updated_at']);
    expect((await loadProjectFromIdb())?.room_graph?.walls).toHaveLength(4);

    await expect(clearProjectFromIdb()).resolves.toBe(true);

    expect(idb.keys()).toEqual([]);
    expect(await loadProjectFromIdb()).toBeNull();
  });

  it('leaves other keys in the store alone', async () => {
    const idb = installFakeIndexedDb();
    await idbSet('something-else', { keep: true });
    await persistProjectToIdb(exportedProject());
    await clearProjectFromIdb();
    expect(idb.keys()).toEqual(['something-else']);
    expect(await idbGet('something-else')).toEqual({ keep: true });
  });

  it('a clear issued right after an un-awaited export still lands after it', async () => {
    const idb = installFakeIndexedDb();
    void persistProjectToIdb(exportedProject()); // the host does not await this
    await expect(clearProjectFromIdb()).resolves.toBe(true);
    expect(idb.log).toEqual([
      'put project',
      'put room_graph',
      'put updated_at',
      'delete project',
      'delete room_graph',
      'delete updated_at',
    ]);
    expect(await loadProjectFromIdb()).toBeNull();
  });

  it('is safe to call when nothing was exported, and exporting works again afterwards', async () => {
    const idb = installFakeIndexedDb();
    await expect(clearProjectFromIdb()).resolves.toBe(true);
    await persistProjectToIdb(exportedProject());
    expect(idb.keys()).toEqual(['project', 'room_graph', 'updated_at']);
    expect((await loadProjectFromIdb())?.label).toBe('Living');
  });

  it('a failed export write does not block later writes or clears', async () => {
    Object.defineProperty(globalThis, 'indexedDB', { value: undefined, configurable: true });
    await expect(persistProjectToIdb(exportedProject())).rejects.toThrow('IndexedDB unavailable');
    const idb = installFakeIndexedDb();
    await persistProjectToIdb(exportedProject());
    await expect(clearProjectFromIdb()).resolves.toBe(true);
    expect(idb.keys()).toEqual([]);
  });
});
