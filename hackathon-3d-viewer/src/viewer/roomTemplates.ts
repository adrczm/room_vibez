/**
 * Owned Template CMS (localStorage MVP) — room-graph seeds, not a DWG format.
 * Spec: dwg-plan-import-room-feasibility.md §5 + persona-formats Template sketch.
 */

import { cloneRoomGraphSeed, type RoomGraph } from './roomGraph';

export interface RoomTemplate {
  id: string;
  title: string;
  tags: string[];
  created_at: string;
  /** Shell seed; placements usually empty. */
  room_graph: RoomGraph;
  /** Optional preview SVG markup. */
  preview_svg?: string;
}

export const TEMPLATE_STORAGE_KEY = 'catalog3d.roomTemplates';

let seq = 0;
function nid(): string {
  seq += 1;
  return `tpl_${Date.now().toString(36)}_${seq.toString(36)}`;
}

export function loadTemplates(): RoomTemplate[] {
  try {
    const raw = localStorage.getItem(TEMPLATE_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as RoomTemplate[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function persistTemplates(list: RoomTemplate[]): void {
  try {
    localStorage.setItem(TEMPLATE_STORAGE_KEY, JSON.stringify(list));
  } catch {
    // session-only if storage blocked
  }
}

/** Persist graph seed as reusable template (immutable until template edit — MVP = replace by id). */
export function saveGraphAsTemplate(
  graph: RoomGraph,
  opts: { title: string; tags?: string[]; preview_svg?: string },
): RoomTemplate {
  const seed: RoomGraph = {
    ...graph,
    placements: [],
    provenance: {
      kind: graph.provenance.kind === 'dwg_import' ? 'dwg_import' : graph.provenance.kind,
      import_job_id: graph.provenance.import_job_id,
      confirm_status: 'confirmed',
    },
  };
  const tpl: RoomTemplate = {
    id: nid(),
    title: opts.title.trim() || graph.label || 'Room template',
    tags: opts.tags ?? [],
    created_at: new Date().toISOString(),
    room_graph: seed,
    preview_svg: opts.preview_svg,
  };
  const list = loadTemplates();
  list.unshift(tpl);
  persistTemplates(list);
  return tpl;
}

/** Clone template seed into a new project/session graph. */
export function instantiateTemplate(templateId: string): RoomGraph {
  const tpl = loadTemplates().find((t) => t.id === templateId);
  if (!tpl) throw new Error(`Unknown template "${templateId}"`);
  return cloneRoomGraphSeed(tpl.room_graph, {
    provenance: {
      kind: 'template_instance',
      template_id: tpl.id,
      confirm_status: 'confirmed',
      import_job_id: tpl.room_graph.provenance.import_job_id,
    },
    label: tpl.title,
    clearPlacements: true,
  });
}

export function deleteTemplate(templateId: string): void {
  persistTemplates(loadTemplates().filter((t) => t.id !== templateId));
}
