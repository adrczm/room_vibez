/**
 * Best-effort local durable store: export/import JSON + IndexedDB.
 * Not cloud auth / projects — session + browser origin only.
 */

import { normalizeRoomGraph, type RoomGraph } from './roomGraph';
import { loadTemplates, type RoomTemplate } from './roomTemplates';

export const PROJECT_SCHEMA = 1 as const;
export const IDB_NAME = 'catalog3d-local';
export const IDB_VERSION = 1;
export const IDB_STORE = 'kv';

export interface ProjectExport {
  schema_version: typeof PROJECT_SCHEMA;
  exported_at: string;
  label?: string;
  room_graph: RoomGraph | null;
  templates: RoomTemplate[];
  note: string;
}

export function exportProjectJson(opts?: {
  graph?: RoomGraph | null;
  templates?: RoomTemplate[];
  label?: string;
}): ProjectExport {
  return {
    schema_version: PROJECT_SCHEMA,
    exported_at: new Date().toISOString(),
    label: opts?.label,
    room_graph: opts?.graph ?? null,
    templates: opts?.templates ?? loadTemplates(),
    note: 'Local Catalog 3D project export — not a cloud project. Session Object URLs for uploads are not embedded.',
  };
}

export function serializeProject(project: ProjectExport): string {
  return JSON.stringify(project, null, 2);
}

export function parseProjectJson(raw: unknown): ProjectExport {
  if (!raw || typeof raw !== 'object') throw new Error('Invalid project JSON');
  const o = raw as Partial<ProjectExport>;
  if (o.schema_version !== PROJECT_SCHEMA) {
    throw new Error(`Unsupported project schema_version (expected ${PROJECT_SCHEMA})`);
  }
  const graph = o.room_graph == null ? null : normalizeRoomGraph(o.room_graph);
  if (o.room_graph != null && !graph) throw new Error('room_graph failed normalizeRoomGraph');
  return {
    schema_version: PROJECT_SCHEMA,
    exported_at: typeof o.exported_at === 'string' ? o.exported_at : new Date().toISOString(),
    label: o.label,
    room_graph: graph,
    templates: Array.isArray(o.templates) ? (o.templates as RoomTemplate[]) : [],
    note: typeof o.note === 'string' ? o.note : '',
  };
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(IDB_NAME, IDB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) db.createObjectStore(IDB_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB open failed'));
  });
}

export async function idbSet(key: string, value: unknown): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('idb put failed'));
  });
  db.close();
}

export async function idbGet<T>(key: string): Promise<T | undefined> {
  const db = await openDb();
  const value = await new Promise<T | undefined>((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readonly');
    const req = tx.objectStore(IDB_STORE).get(key);
    req.onsuccess = () => resolve(req.result as T | undefined);
    req.onerror = () => reject(req.error ?? new Error('idb get failed'));
  });
  db.close();
  return value;
}

export async function persistProjectToIdb(project: ProjectExport): Promise<void> {
  await idbSet('project', project);
  await idbSet('room_graph', project.room_graph);
  await idbSet('updated_at', project.exported_at);
}

export async function loadProjectFromIdb(): Promise<ProjectExport | null> {
  try {
    const project = await idbGet<ProjectExport>('project');
    if (!project) return null;
    return parseProjectJson(project);
  } catch {
    return null;
  }
}

export function downloadTextFile(filename: string, text: string, mime = 'application/json'): void {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
