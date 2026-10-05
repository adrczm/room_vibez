/**
 * DWG/DXF plan import → candidates → human confirm → owned RoomGraph.
 *
 * Honest MVP: ODA / APS commercial SDKs are not available on this machine.
 * This module implements the product architecture with a clearly labeled
 * mock/fixture extract path. It does NOT claim AutoCAD-class DWG fidelity
 * and does not invent open-source DWG parsing as production-grade.
 *
 * Spec: dwg-plan-import-room-feasibility.md Phase 0.
 */

import {
  DEFAULT_CEILING_HEIGHT_M,
  DEFAULT_DOOR,
  DEFAULT_WALL_THICKNESS_M,
  DEFAULT_WINDOW,
  roomGraphProblem,
  type OpeningEntity,
  type OpeningType,
  type RoomEntity,
  type RoomGraph,
  type SourceAsset,
  type SourceAssetKind,
  type Vec2,
  type WallEntity,
} from './roomGraph';
import { isPdfPlanFile, isRasterPlanFile } from './planUnderlay';

export type ExtractPath = SourceAsset['extract_path'];

export interface WallCandidate {
  id: string;
  a: Vec2;
  b: Vec2;
  thickness: number;
  height: number;
  accepted: boolean;
  source_layer?: string;
}

export interface OpeningCandidate {
  id: string;
  /** Temporary wall candidate id (remapped on commit). */
  wall_candidate_id: string;
  type: OpeningType;
  offset_along_wall: number;
  width: number;
  height: number;
  sill_height: number;
  accepted: boolean;
  inferred: boolean;
  source_block?: string;
}

export interface RoomCandidate {
  id: string;
  name?: string;
  floor_polygon: Vec2[];
  ceiling_height: number;
  wall_candidate_ids: string[];
  accepted: boolean;
}

export interface ImportCandidates {
  schema_version: 1;
  label: string;
  units_guess: 'm' | 'unknown';
  /** Known length along one wall for scale confirm (meters in extract space). */
  scale_hint?: { wall_candidate_id: string; length_m: number; label: string };
  walls: WallCandidate[];
  openings: OpeningCandidate[];
  rooms: RoomCandidate[];
  preview_svg?: string;
  /** Honest extract metadata. */
  extract: {
    path: ExtractPath;
    oda_available: false;
    note: string;
  };
}

export interface ImportJob {
  id: string;
  created_at: string;
  source: SourceAsset;
  candidates: ImportCandidates;
  /** Multiplier applied at confirm (user scale confirm). */
  scale_factor: number;
  status: 'draft' | 'confirmed';
}

export const FIXTURE_CANDIDATES_URL = '/fixtures/dwg-import/sample-plan.candidates.json';
export const FIXTURE_PREVIEW_URL = '/fixtures/dwg-import/sample-plan.preview.svg';

let jobSeq = 0;
function nid(prefix: string): string {
  jobSeq += 1;
  return `${prefix}_${Date.now().toString(36)}_${jobSeq.toString(36)}`;
}

export async function sha256Hex(buffer: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function kindFromFilename(name: string): SourceAssetKind {
  const lower = name.toLowerCase();
  if (lower.endsWith('.dwg')) return 'dwg';
  if (lower.endsWith('.dxf')) return 'dxf';
  if (lower.endsWith('.json') || lower.endsWith('.candidates.json')) return 'json_candidates';
  return 'mock_fixture';
}

/**
 * Why a chosen plan file is refused before any import starts:
 * - `unsupported_type`: not an image, DWG, DXF or JSON by name (for example `.ifc`, `.exe`, no extension)
 * - `pdf_unsupported`: a PDF (there is no rasterizer)
 * - `not_dwg`: named `.dwg` but the content does not start like a DWG
 * - `not_dxf`: named `.dxf` but the content does not start like a DXF
 */
export type PlanFileRejection = 'unsupported_type' | 'pdf_unsupported' | 'not_dwg' | 'not_dxf';

/** Which import path a plan file belongs to. `raster` goes to `startUnderlayJob`; the rest to `startImportJob`. */
export type PlanFileKind = 'raster' | 'dwg' | 'dxf' | 'json_candidates';

export type PlanFileCheck =
  | { ok: true; kind: PlanFileKind; filename: string }
  | {
      ok: false;
      reason: PlanFileRejection;
      filename: string;
      /** Lower-case extension without the dot, or '' when the name has none. */
      extension: string;
    };

/** Thrown by `startImportJob` for a file it has no import path for. `reason` is the fact to map to copy. */
export class PlanFileError extends Error {
  readonly reason: PlanFileRejection;
  readonly filename: string;
  constructor(reason: PlanFileRejection, filename: string, message: string) {
    super(message);
    this.name = 'PlanFileError';
    this.reason = reason;
    this.filename = filename;
  }
}

function extensionOf(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot < 0 || dot === name.length - 1 ? '' : name.slice(dot + 1).toLowerCase();
}

function asciiAt(bytes: Uint8Array, start: number, length: number): string {
  let out = '';
  for (let i = start; i < Math.min(bytes.length, start + length); i++) out += String.fromCharCode(bytes[i]!);
  return out;
}

/**
 * True when the bytes start with a DWG version tag of the form `AC10xx` (six ASCII characters,
 * for example `AC1015` or `AC1032`). That tag is all this looks at: it does not parse the drawing,
 * and it was written from the documented format, not checked against a DWG file from a CAD program.
 */
export function looksLikeDwg(head: Uint8Array): boolean {
  return /^AC10[0-9]{2}$/.test(asciiAt(head, 0, 6));
}

/**
 * True when the bytes start like a DXF: either the binary sentinel `AutoCAD Binary DXF`, or text
 * whose first group, after any `999` comment groups, is `0` / `SECTION` (or `0` / `EOF`, an empty
 * drawing). Looks at the start only; it does not parse the drawing, and it was not checked against a
 * DXF file from a CAD program.
 */
export function looksLikeDxf(head: Uint8Array): boolean {
  if (asciiAt(head, 0, 18) === 'AutoCAD Binary DXF') return true;
  let text = asciiAt(head, 0, head.length);
  if (text.startsWith('ï»¿')) text = text.slice(3); // UTF-8 byte-order mark, read as bytes
  const lines = text.split(/\r\n|\r|\n/).map((line) => line.trim());
  while (lines.length && lines[0] === '') lines.shift();
  for (let i = 0; i + 1 < lines.length; i += 2) {
    const code = lines[i]!;
    const value = lines[i + 1]!;
    if (!/^[0-9]{1,4}$/.test(code)) return false;
    if (Number(code) === 999) continue; // comment group
    return Number(code) === 0 && (value === 'SECTION' || value === 'EOF');
  }
  return false;
}

/** How much of a file `checkPlanFile` reads to recognise DWG / DXF content. */
export const PLAN_SNIFF_BYTES = 4096;

/**
 * Decide, before any import starts, whether a chosen plan file can be used and by which path.
 * Call this first; on `ok: false` show the matching message and start nothing, so a file that is not
 * a plan never reaches the sample-extract path.
 *
 * Images and PDFs are recognised by name or MIME type (same rules as `isRasterPlanFile` /
 * `isPdfPlanFile`); their content is not inspected. DWG and DXF are recognised by name and then by
 * the first `PLAN_SNIFF_BYTES` bytes. JSON is recognised by name; `startImportJob` validates it.
 */
export async function checkPlanFile(file: File): Promise<PlanFileCheck> {
  const filename = file.name;
  const extension = extensionOf(filename);
  if (isRasterPlanFile(file)) return { ok: true, kind: 'raster', filename };
  if (isPdfPlanFile(file)) return { ok: false, reason: 'pdf_unsupported', filename, extension };
  if (extension === 'json') return { ok: true, kind: 'json_candidates', filename };
  if (extension !== 'dwg' && extension !== 'dxf') {
    return { ok: false, reason: 'unsupported_type', filename, extension };
  }
  const head = new Uint8Array(await file.slice(0, PLAN_SNIFF_BYTES).arrayBuffer());
  if (extension === 'dwg') {
    return looksLikeDwg(head)
      ? { ok: true, kind: 'dwg', filename }
      : { ok: false, reason: 'not_dwg', filename, extension };
  }
  return looksLikeDxf(head)
    ? { ok: true, kind: 'dxf', filename }
    : { ok: false, reason: 'not_dxf', filename, extension };
}

/** Built-in rectangular living-room-like plan candidates (meters). */
export function builtInFixtureCandidates(): ImportCandidates {
  const ceiling = DEFAULT_CEILING_HEIGHT_M;
  const thickness = DEFAULT_WALL_THICKNESS_M;
  const hx = 2.5; // 5 m length
  const hz = 2.0; // 4 m width
  const walls: WallCandidate[] = [
    { id: 'wc_s', a: { x: -hx, z: -hz }, b: { x: hx, z: -hz }, thickness, height: ceiling, accepted: true, source_layer: 'A-WALL' },
    { id: 'wc_e', a: { x: hx, z: -hz }, b: { x: hx, z: hz }, thickness, height: ceiling, accepted: true, source_layer: 'A-WALL' },
    { id: 'wc_n', a: { x: hx, z: hz }, b: { x: -hx, z: hz }, thickness, height: ceiling, accepted: true, source_layer: 'A-WALL' },
    { id: 'wc_w', a: { x: -hx, z: hz }, b: { x: -hx, z: -hz }, thickness, height: ceiling, accepted: true, source_layer: 'A-WALL' },
  ];
  const openings: OpeningCandidate[] = [
    {
      id: 'oc_door',
      wall_candidate_id: 'wc_s',
      type: 'door',
      offset_along_wall: 1.8,
      width: DEFAULT_DOOR.width,
      height: DEFAULT_DOOR.height,
      sill_height: DEFAULT_DOOR.sill_height,
      accepted: true,
      inferred: true,
      source_block: 'DOOR-36',
    },
    {
      id: 'oc_win',
      wall_candidate_id: 'wc_n',
      type: 'window',
      offset_along_wall: 1.5,
      width: DEFAULT_WINDOW.width,
      height: DEFAULT_WINDOW.height,
      sill_height: DEFAULT_WINDOW.sill_height,
      accepted: true,
      inferred: true,
      source_block: 'WIN-48',
    },
  ];
  const rooms: RoomCandidate[] = [
    {
      id: 'rc_main',
      name: 'Imported living',
      floor_polygon: [
        { x: -hx, z: -hz },
        { x: hx, z: -hz },
        { x: hx, z: hz },
        { x: -hx, z: hz },
      ],
      ceiling_height: ceiling,
      wall_candidate_ids: walls.map((w) => w.id),
      accepted: true,
    },
  ];
  return {
    schema_version: 1,
    label: 'Sample plan (mock extract)',
    units_guess: 'm',
    scale_hint: { wall_candidate_id: 'wc_s', length_m: 5, label: 'South wall length' },
    walls,
    openings,
    rooms,
    preview_svg: FIXTURE_PREVIEW_URL,
    extract: {
      path: 'mock_fixture',
      oda_available: false,
      note:
        'ODA Drawings / APS Model Derivative not available on this machine. Candidates are a labeled mock fixture — not parsed from real DWG entity data. Do not treat as AutoCAD-class fidelity.',
    },
  };
}

export function parseCandidatesPayload(raw: unknown): ImportCandidates {
  if (!raw || typeof raw !== 'object') throw new Error('Candidates payload must be a JSON object');
  const data = raw as Partial<ImportCandidates>;
  if (data.schema_version !== 1) throw new Error('Unsupported candidates schema_version (expect 1)');
  if (!Array.isArray(data.walls) || !Array.isArray(data.rooms)) {
    throw new Error('Candidates must include walls[] and rooms[]');
  }
  const builtin = builtInFixtureCandidates();
  return {
    schema_version: 1,
    label: data.label ?? 'Imported candidates',
    units_guess: data.units_guess === 'unknown' ? 'unknown' : 'm',
    scale_hint: data.scale_hint,
    walls: data.walls.map((w) => ({ ...w, accepted: w.accepted !== false })),
    openings: Array.isArray(data.openings)
      ? data.openings.map((o) => ({ ...o, accepted: o.accepted !== false, inferred: o.inferred !== false }))
      : [],
    rooms: data.rooms.map((r) => ({ ...r, accepted: r.accepted !== false })),
    preview_svg: data.preview_svg ?? builtin.preview_svg,
    extract: data.extract ?? {
      path: 'json_candidates',
      oda_available: false,
      note: 'JSON candidate payload (not ODA entity extract).',
    },
  };
}

export async function loadFixtureCandidates(): Promise<ImportCandidates> {
  try {
    const res = await fetch(FIXTURE_CANDIDATES_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return parseCandidatesPayload(await res.json());
  } catch {
    return builtInFixtureCandidates();
  }
}

/**
 * Start an import job.
 * - `.json` candidate payloads are parsed directly (honest path).
 * - `.dwg` / `.dxf` uploads attach as SourceAsset but derive candidates from the
 *   mock fixture until an ODA/APS farm is wired (explicitly labeled).
 * - Any other file name throws `PlanFileError` (`unsupported_type`): it has no import path and must
 *   not get the sample extract.
 *
 * This does not look inside a `.dwg` / `.dxf` file. Call `checkPlanFile` first to refuse files that
 * are not really DWG / DXF.
 */
export async function startImportJob(file: File | null, opts?: { useFixture?: boolean }): Promise<ImportJob> {
  const useFixture = opts?.useFixture || !file;
  let source: SourceAsset;
  let candidates: ImportCandidates;

  if (useFixture && !file) {
    candidates = await loadFixtureCandidates();
    source = {
      id: nid('src'),
      kind: 'mock_fixture',
      filename: 'sample-plan.candidates.json',
      uri: FIXTURE_CANDIDATES_URL,
      extract_path: 'mock_fixture',
      units_guess: candidates.units_guess === 'unknown' ? 'unknown' : 'm',
      layout_id: 'model_space',
      note: candidates.extract.note,
    };
  } else if (!file) {
    throw new Error('No file provided');
  } else {
    const kind = kindFromFilename(file.name);
    if (kind !== 'dwg' && kind !== 'dxf' && kind !== 'json_candidates') {
      throw new PlanFileError(
        'unsupported_type',
        file.name,
        `Unsupported plan file type: "${file.name}" (expected .dwg, .dxf or .json)`,
      );
    }
    const buffer = await file.arrayBuffer();
    const hash = await sha256Hex(buffer);
    const uri = URL.createObjectURL(file);

    if (kind === 'json_candidates') {
      const text = new TextDecoder().decode(buffer);
      let payload: unknown;
      try {
        payload = JSON.parse(text);
      } catch {
        // Same message as a parsed value that is not an object: the file is not a candidates payload.
        throw new Error('Candidates payload must be a JSON object');
      }
      candidates = parseCandidatesPayload(payload);
      source = {
        id: nid('src'),
        kind,
        filename: file.name,
        uri,
        sha256: hash,
        bytes: file.size,
        extract_path: 'json_candidates',
        units_guess: candidates.units_guess === 'unknown' ? 'unknown' : 'm',
        layout_id: 'model_space',
        note: candidates.extract.note,
      };
    } else {
      // DWG/DXF: keep SourceAsset; mock extract only (ODA unavailable).
      candidates = await loadFixtureCandidates();
      candidates = {
        ...candidates,
        label: `${file.name} → mock extract`,
        extract: {
          path: 'mock_fixture',
          oda_available: false,
          note:
            `Uploaded ${kind.toUpperCase()} kept as SourceAsset (sha256 ${hash.slice(0, 12)}…). ` +
            'ODA Drawings SDK / APS farm not available — wall/opening candidates are the labeled mock fixture, not entity-parsed from this file.',
        },
      };
      source = {
        id: nid('src'),
        kind,
        filename: file.name,
        uri,
        sha256: hash,
        bytes: file.size,
        extract_path: 'mock_fixture',
        units_guess: 'unknown',
        layout_id: 'model_space',
        note: candidates.extract.note,
      };
    }
  }

  return {
    id: nid('import'),
    created_at: new Date().toISOString(),
    source,
    candidates,
    scale_factor: 1,
    status: 'draft',
  };
}

export function setCandidateAccepted(
  job: ImportJob,
  kind: 'wall' | 'opening' | 'room',
  id: string,
  accepted: boolean,
): ImportJob {
  const c = structuredClone(job.candidates);
  if (kind === 'wall') {
    const w = c.walls.find((x) => x.id === id);
    if (w) w.accepted = accepted;
  } else if (kind === 'opening') {
    const o = c.openings.find((x) => x.id === id);
    if (o) o.accepted = accepted;
  } else {
    const r = c.rooms.find((x) => x.id === id);
    if (r) r.accepted = accepted;
  }
  return { ...job, candidates: c };
}

export function setScaleFactor(job: ImportJob, factor: number): ImportJob {
  if (!(factor > 0) || !Number.isFinite(factor)) throw new Error('Scale factor must be a positive number');
  return { ...job, scale_factor: factor };
}

/** Scale factor from user-known length vs extract hint length. */
export function scaleFactorFromKnownLength(job: ImportJob, knownLengthM: number): number {
  const hint = job.candidates.scale_hint;
  if (!hint || !(hint.length_m > 0)) throw new Error('No scale hint on this extract');
  if (!(knownLengthM > 0)) throw new Error('Known length must be positive');
  return knownLengthM / hint.length_m;
}

function scaleVec(v: Vec2, s: number): Vec2 {
  return { x: v.x * s, z: v.z * s };
}

/** Start of the message thrown when accepted candidates do not add up to a usable room. The failed check follows. */
export const IMPORT_NOT_A_ROOM_MESSAGE = 'Import candidates are not a usable room';

/**
 * Human confirm → owned RoomGraph (same schema as from-scratch).
 * Placements stay empty; DWG furniture blocks are ignored.
 *
 * Throws when the result would not pass `normalizeRoomGraph` (for example a candidates file whose
 * walls have no thickness), so a room that cannot be saved or reopened is never handed to the host.
 */
export function confirmImportToRoomGraph(job: ImportJob): RoomGraph {
  const s = job.scale_factor;
  const acceptedWalls = job.candidates.walls.filter((w) => w.accepted);
  if (acceptedWalls.length < 3) {
    throw new Error('Accept at least 3 wall candidates before confirming');
  }
  const acceptedRooms = job.candidates.rooms.filter((r) => r.accepted);
  if (acceptedRooms.length === 0) {
    throw new Error('Accept at least one room candidate before confirming');
  }

  const wallIdMap = new Map<string, string>();
  // Scale plan XZ endpoints; thickness/height stay in real meters (heuristic — feasibility §4.3).
  const walls: WallEntity[] = acceptedWalls.map((w) => {
    const id = nid('wall');
    wallIdMap.set(w.id, id);
    return {
      id,
      a: scaleVec(w.a, s),
      b: scaleVec(w.b, s),
      thickness: w.thickness,
      height: w.height,
      connected_room_ids: [],
    };
  });

  const rooms: RoomEntity[] = acceptedRooms.map((r) => {
    const id = nid('room');
    const wall_ids = r.wall_candidate_ids
      .map((wid) => wallIdMap.get(wid))
      .filter((x): x is string => !!x);
    for (const w of walls) {
      if (wall_ids.includes(w.id)) {
        w.connected_room_ids = [...new Set([...w.connected_room_ids, id])];
      }
    }
    return {
      id,
      name: r.name ?? 'Imported room',
      floor_polygon: r.floor_polygon.map((p) => scaleVec(p, s)),
      ceiling_height: r.ceiling_height,
      wall_ids,
    };
  });

  const openings: OpeningEntity[] = job.candidates.openings
    .filter((o) => o.accepted && wallIdMap.has(o.wall_candidate_id))
    .map((o) => ({
      id: nid('opening'),
      wall_id: wallIdMap.get(o.wall_candidate_id)!,
      type: o.type,
      offset_along_wall: o.offset_along_wall * s,
      width: o.width * s,
      height: o.height,
      sill_height: o.sill_height,
      inferred: o.inferred,
    }));

  const graph: RoomGraph = {
    schema_version: 1,
    units: 'm',
    rooms,
    walls,
    openings,
    placements: [],
    source_assets: [{ ...job.source }],
    provenance: {
      kind: 'dwg_import',
      import_job_id: job.id,
      confirm_status: 'confirmed',
    },
    display_unit: 'm',
    label: job.candidates.label,
  };
  const problem = roomGraphProblem(graph);
  if (problem) throw new Error(`${IMPORT_NOT_A_ROOM_MESSAGE}: ${problem}`);
  return graph;
}

/** SVG overlay of accepted candidates (plan view) for the review UI. */
export function candidatesOverlaySvg(job: ImportJob, size = 240): string {
  const s = job.scale_factor;
  const pts = job.candidates.walls.flatMap((w) => [w.a, w.b]);
  let minX = Infinity,
    maxX = -Infinity,
    minZ = Infinity,
    maxZ = -Infinity;
  for (const p of pts) {
    minX = Math.min(minX, p.x * s);
    maxX = Math.max(maxX, p.x * s);
    minZ = Math.min(minZ, p.z * s);
    maxZ = Math.max(maxZ, p.z * s);
  }
  if (!Number.isFinite(minX)) {
    minX = -1;
    maxX = 1;
    minZ = -1;
    maxZ = 1;
  }
  const pad = 16;
  const spanX = Math.max(maxX - minX, 0.1);
  const spanZ = Math.max(maxZ - minZ, 0.1);
  const scale = (size - pad * 2) / Math.max(spanX, spanZ);
  const toX = (x: number) => pad + (x - minX) * scale;
  const toY = (z: number) => pad + (z - minZ) * scale;

  let lines = '';
  for (const w of job.candidates.walls) {
    const stroke = w.accepted ? '#222' : '#bbb';
    const dash = w.accepted ? '' : ' stroke-dasharray="4 3"';
    lines += `<line x1="${toX(w.a.x * s)}" y1="${toY(w.a.z * s)}" x2="${toX(w.b.x * s)}" y2="${toY(w.b.z * s)}" stroke="${stroke}" stroke-width="3"${dash} />`;
  }
  for (const o of job.candidates.openings) {
    if (!o.accepted) continue;
    const wall = job.candidates.walls.find((w) => w.id === o.wall_candidate_id);
    if (!wall) continue;
    const len = Math.hypot(wall.b.x - wall.a.x, wall.b.z - wall.a.z);
    if (len < 1e-6) continue;
    const ux = (wall.b.x - wall.a.x) / len;
    const uz = (wall.b.z - wall.a.z) / len;
    const x0 = (wall.a.x + ux * o.offset_along_wall) * s;
    const z0 = (wall.a.z + uz * o.offset_along_wall) * s;
    const x1 = (wall.a.x + ux * (o.offset_along_wall + o.width)) * s;
    const z1 = (wall.a.z + uz * (o.offset_along_wall + o.width)) * s;
    const color = o.type === 'door' ? '#c45c26' : '#2a6f97';
    lines += `<line x1="${toX(x0)}" y1="${toY(z0)}" x2="${toX(x1)}" y2="${toY(z1)}" stroke="${color}" stroke-width="5" stroke-linecap="square" />`;
  }

  return `<svg viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg" aria-label="Import candidates overlay">
  <rect width="${size}" height="${size}" fill="#f7f7f5"/>
  ${lines}
</svg>`;
}
