import { beforeEach, describe, expect, it } from 'vitest';
import { confirmImportToRoomGraph, startImportJob } from '../../src/viewer/dwgImport';
import {
  TEMPLATE_STORAGE_KEY,
  instantiateTemplate,
  loadTemplates,
  saveGraphAsTemplate,
} from '../../src/viewer/roomTemplates';

/** Minimal localStorage for node vitest. */
function installMemoryStorage() {
  const map = new Map<string, string>();
  const storage = {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => {
      map.set(k, String(v));
    },
    removeItem: (k: string) => {
      map.delete(k);
    },
    clear: () => map.clear(),
    key: (i: number) => [...map.keys()][i] ?? null,
    get length() {
      return map.size;
    },
  };
  Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true });
}

describe('roomTemplates CMS', () => {
  beforeEach(() => {
    installMemoryStorage();
    localStorage.removeItem(TEMPLATE_STORAGE_KEY);
  });

  it('saves confirmed import graph as template and instantiates a clone', async () => {
    const job = await startImportJob(null, { useFixture: true });
    const graph = confirmImportToRoomGraph(job);
    const tpl = saveGraphAsTemplate(graph, { title: 'Living shell', tags: ['mock'] });
    expect(loadTemplates()).toHaveLength(1);
    expect(tpl.room_graph.placements).toHaveLength(0);
    expect(tpl.room_graph.source_assets.length).toBeGreaterThan(0);

    const instance = instantiateTemplate(tpl.id);
    expect(instance.provenance.kind).toBe('template_instance');
    expect(instance.provenance.template_id).toBe(tpl.id);
    expect(instance.walls).toHaveLength(graph.walls.length);
    expect(instance.walls[0]!.id).not.toBe(graph.walls[0]!.id);
    expect(instance.placements).toHaveLength(0);
  });
});
