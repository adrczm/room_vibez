/**
 * Room graph SoT for from-scratch + DWG import (shared schema).
 * Canonical units: meters. UI may display m / cm / ft-in.
 * Meshes are derived — never store triangle soup as SoT.
 * DWG is never the Three.js SoT (see dwg-plan-import-room-feasibility.md).
 */

export type DisplayUnit = 'm' | 'cm' | 'ft-in';
export type OpeningType = 'door' | 'window';
export type ProvenanceKind = 'authored' | 'dwg_import' | 'template_instance';
export type ConfirmStatus = 'draft' | 'confirmed';
export type SourceAssetKind =
  | 'dwg'
  | 'dxf'
  | 'json_candidates'
  | 'mock_fixture'
  | 'png'
  | 'jpg'
  | 'pdf'
  | 'underlay';

export interface Vec2 {
  x: number;
  z: number;
}

export interface RoomEntity {
  id: string;
  name?: string;
  floor_polygon: Vec2[];
  ceiling_height: number;
  wall_ids: string[];
  /** Local materials library id for the floor (not production Materials DB). */
  floor_material_id?: string;
  /** Default wall material id for all walls in this room unless wall overrides. */
  wall_material_id?: string;
}

export interface WallEntity {
  id: string;
  a: Vec2;
  b: Vec2;
  thickness: number;
  height: number;
  connected_room_ids: string[];
  /** Optional per-wall materials library id. */
  material_id?: string;
}

export interface OpeningEntity {
  id: string;
  wall_id: string;
  type: OpeningType;
  /** Meters from wall endpoint `a` to opening start edge. */
  offset_along_wall: number;
  width: number;
  height: number;
  sill_height: number;
  host_side?: 'inner' | 'outer';
  /** True when height/sill/width came from residential defaults, not the plan. */
  inferred?: boolean;
}

export interface PlacementEntity {
  id: string;
  sku_id: string;
  asset_ref: string;
  product_id: string;
  position: { x: number; y: number; z: number };
  rotation_y: number;
  scale: number;
  slot_bindings: Record<string, string>;
}

/** Kept original plan file / extract payload (architecture archive — not runtime SoT). */
export interface SourceAsset {
  id: string;
  kind: SourceAssetKind;
  filename: string;
  /** Object URL or fixture path; session-scoped for uploads. */
  uri: string;
  sha256?: string;
  bytes?: number;
  units_guess?: DisplayUnit | 'unknown';
  layout_id?: string;
  /** Honest extract path label (e.g. mock_fixture when ODA unavailable). */
  extract_path:
    | 'oda'
    | 'aps'
    | 'mock_fixture'
    | 'dxf_simple'
    | 'json_candidates'
    | 'raster_underlay';
  note?: string;
}

export interface RoomProvenance {
  kind: ProvenanceKind;
  import_job_id?: string;
  template_id?: string;
  confirm_status: ConfirmStatus;
}

export interface RoomGraph {
  schema_version: 1;
  units: 'm';
  rooms: RoomEntity[];
  walls: WallEntity[];
  openings: OpeningEntity[];
  placements: PlacementEntity[];
  source_assets: SourceAsset[];
  provenance: RoomProvenance;
  light_preset_id?: string;
  display_unit?: DisplayUnit;
  label?: string;
  /** Optional plan underlay (JPG/PNG/PDF raster) for human-confirm import. */
  underlay?: {
    source_asset_id?: string;
    uri: string;
    opacity?: number;
    /** Width/depth of underlay plane in meters (XZ). */
    width_m?: number;
    depth_m?: number;
  };
}

export interface RoomSizeInput {
  length: number;
  width: number;
  ceilingHeight: number;
  wallThickness?: number;
  name?: string;
  displayUnit?: DisplayUnit;
}

/** UX defaults from feasibility (not locked product constants — U1). */
export const DEFAULT_WALL_THICKNESS_M = 0.12;
export const DEFAULT_CEILING_HEIGHT_M = 2.7;
export const DEFAULT_DOOR = { width: 0.9, height: 2.1, sill_height: 0 } as const;
export const DEFAULT_WINDOW = { width: 1.2, height: 1.2, sill_height: 0.9 } as const;

export const ROOM_PRESETS = [
  { id: 'small-bedroom', label: 'Small bedroom', length: 3, width: 3, ceilingHeight: 2.7 },
  { id: 'living', label: 'Living', length: 5, width: 4, ceilingHeight: 2.7 },
  { id: 'studio', label: 'Studio', length: 6, width: 4, ceilingHeight: 2.7 },
] as const;

export const STORAGE_KEY = 'catalog3d.roomGraph';
/** Where an unreadable saved room is moved at boot (see `loadPersistedRoomGraphOrQuarantine`). */
export const QUARANTINE_STORAGE_KEY = 'catalog3d.roomGraph.unreadable';

/** The part of `Storage` this module uses. Pass one to run the persistence functions without a browser. */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** The four size inputs of a rectangular room, named by their `RoomSizeInput` key. */
export type RoomSizeField = 'length' | 'width' | 'ceilingHeight' | 'wallThickness';

/** Message of every `RoomSizeError`. Unchanged from the plain Error thrown before; a unit test and the host mapper match it. */
export const ROOM_SIZE_ERROR_MESSAGE =
  'Room size must be positive (length, width, ceiling height, wall thickness)';

/**
 * Thrown by `createRectangularRoom` when a size is not a finite number above 0.
 * `fields` names every invalid input in form order (length, width, ceiling height, wall thickness),
 * so the host can say which field to fix. The message itself stays generic.
 */
export class RoomSizeError extends Error {
  readonly fields: RoomSizeField[];
  constructor(fields: RoomSizeField[]) {
    super(ROOM_SIZE_ERROR_MESSAGE);
    this.name = 'RoomSizeError';
    this.fields = fields;
  }
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isPositiveNumber(value: unknown): value is number {
  return isFiniteNumber(value) && value > 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function isFinitePoint(value: unknown): boolean {
  return isRecord(value) && isFiniteNumber(value.x) && isFiniteNumber(value.z);
}

/**
 * Size inputs that are not a finite number above 0, in form order. Empty when the size is valid.
 * A missing `wallThickness` is valid (the default applies).
 */
export function invalidRoomSizeFields(input: RoomSizeInput): RoomSizeField[] {
  const fields: RoomSizeField[] = [];
  if (!isPositiveNumber(input.length)) fields.push('length');
  if (!isPositiveNumber(input.width)) fields.push('width');
  if (!isPositiveNumber(input.ceilingHeight)) fields.push('ceilingHeight');
  if (input.wallThickness != null && !isPositiveNumber(input.wallThickness)) fields.push('wallThickness');
  return fields;
}

let idSeq = 0;
function nid(prefix: string): string {
  idSeq += 1;
  return `${prefix}_${Date.now().toString(36)}_${idSeq.toString(36)}`;
}

export function wallLength(wall: WallEntity): number {
  const dx = wall.b.x - wall.a.x;
  const dz = wall.b.z - wall.a.z;
  return Math.hypot(dx, dz);
}

/** Convert display value → meters. */
export function toMeters(value: number, unit: DisplayUnit): number {
  if (unit === 'cm') return value / 100;
  if (unit === 'ft-in') return value * 0.3048; // treat input as decimal feet
  return value;
}

/** Convert meters → display value. */
export function fromMeters(meters: number, unit: DisplayUnit): number {
  if (unit === 'cm') return meters * 100;
  if (unit === 'ft-in') return meters / 0.3048;
  return meters;
}

export function formatLength(meters: number, unit: DisplayUnit, digits = 2): string {
  if (unit === 'ft-in') {
    const totalIn = meters / 0.0254;
    const ft = Math.floor(totalIn / 12);
    const inch = totalIn - ft * 12;
    return `${ft}' ${inch.toFixed(1)}"`;
  }
  if (unit === 'cm') return `${(meters * 100).toFixed(0)} cm`;
  return `${meters.toFixed(digits)} m`;
}

/**
 * Closed rectangular room: four centerline walls + CCW floor polygon.
 * Length = X extent, width = Z extent. Origin at room center, floor y=0.
 * Wall a→b centerlines sit on the floor polygon edges (inner faces);
 * mesh thickness extrudes outward from those centerlines.
 *
 * Throws `RoomSizeError` (with `.fields`) when a size is not a finite number above 0.
 */
export function createRectangularRoom(input: RoomSizeInput): RoomGraph {
  const length = input.length;
  const width = input.width;
  const ceiling = input.ceilingHeight;
  const thickness = input.wallThickness ?? DEFAULT_WALL_THICKNESS_M;
  const invalid = invalidRoomSizeFields(input);
  if (invalid.length > 0) throw new RoomSizeError(invalid);

  const hx = length / 2;
  const hz = width / 2;
  // Inner floor polygon (CCW when viewed from +Y): SW → SE → NE → NW
  const floor: Vec2[] = [
    { x: -hx, z: -hz },
    { x: hx, z: -hz },
    { x: hx, z: hz },
    { x: -hx, z: hz },
  ];

  // Centerlines = inner faces / floor edges (thickness extrudes outward in roomMesh).
  const wallDefs: Array<{ a: Vec2; b: Vec2 }> = [
    { a: { x: -hx, z: -hz }, b: { x: hx, z: -hz } }, // south (+Z outward ≈ -Z side)
    { a: { x: hx, z: -hz }, b: { x: hx, z: hz } }, // east
    { a: { x: hx, z: hz }, b: { x: -hx, z: hz } }, // north
    { a: { x: -hx, z: hz }, b: { x: -hx, z: -hz } }, // west
  ];

  const roomId = nid('room');
  const walls: WallEntity[] = wallDefs.map((w) => ({
    id: nid('wall'),
    a: w.a,
    b: w.b,
    thickness,
    height: ceiling,
    connected_room_ids: [roomId],
  }));

  const room: RoomEntity = {
    id: roomId,
    name: input.name ?? 'Room',
    floor_polygon: floor,
    ceiling_height: ceiling,
    wall_ids: walls.map((w) => w.id),
  };

  return {
    schema_version: 1,
    units: 'm',
    rooms: [room],
    walls,
    openings: [],
    placements: [],
    source_assets: [],
    provenance: { kind: 'authored', confirm_status: 'confirmed' },
    display_unit: input.displayUnit ?? 'm',
    label: input.name ?? 'Room',
  };
}

/**
 * First reason `raw` cannot be used as a RoomGraph, or null when it can.
 * The text is for the console and diagnostics (a path and what is wrong with it), not UI copy.
 *
 * Checked: schema_version 1; `rooms` and `walls` are lists; at least one room; every room has
 * a floor polygon of 3 or more finite points and a ceiling height above 0; every wall has finite
 * end points and a thickness and height above 0; every opening and placement that is present is
 * an object whose numbers are finite. Not checked: ids, cross-references (`wall_ids`, `wall_id`),
 * materials, source assets, underlay.
 */
export function roomGraphProblem(raw: unknown): string | null {
  if (!isRecord(raw)) return 'not an object';
  if (raw.schema_version !== 1) return 'schema_version is not 1';
  if (!Array.isArray(raw.walls)) return 'walls is not a list';
  if (!Array.isArray(raw.rooms)) return 'rooms is not a list';
  if (raw.rooms.length === 0) return 'rooms is empty';

  for (let i = 0; i < raw.rooms.length; i++) {
    const room: unknown = raw.rooms[i];
    if (!isRecord(room)) return `rooms[${i}] is not an object`;
    const polygon = room.floor_polygon;
    if (!Array.isArray(polygon) || polygon.length < 3) return `rooms[${i}].floor_polygon has fewer than 3 points`;
    for (let j = 0; j < polygon.length; j++) {
      if (!isFinitePoint(polygon[j])) return `rooms[${i}].floor_polygon[${j}] is not a finite point`;
    }
    if (!isPositiveNumber(room.ceiling_height)) return `rooms[${i}].ceiling_height is not a number above 0`;
  }

  for (let i = 0; i < raw.walls.length; i++) {
    const wall: unknown = raw.walls[i];
    if (!isRecord(wall)) return `walls[${i}] is not an object`;
    if (!isFinitePoint(wall.a)) return `walls[${i}].a is not a finite point`;
    if (!isFinitePoint(wall.b)) return `walls[${i}].b is not a finite point`;
    if (!isPositiveNumber(wall.thickness)) return `walls[${i}].thickness is not a number above 0`;
    if (!isPositiveNumber(wall.height)) return `walls[${i}].height is not a number above 0`;
  }

  if (Array.isArray(raw.openings)) {
    for (let i = 0; i < raw.openings.length; i++) {
      const opening: unknown = raw.openings[i];
      if (!isRecord(opening)) return `openings[${i}] is not an object`;
      for (const key of ['offset_along_wall', 'width', 'height', 'sill_height'] as const) {
        if (!isFiniteNumber(opening[key])) return `openings[${i}].${key} is not a finite number`;
      }
    }
  }

  if (Array.isArray(raw.placements)) {
    for (let i = 0; i < raw.placements.length; i++) {
      const placement: unknown = raw.placements[i];
      if (!isRecord(placement)) return `placements[${i}] is not an object`;
      const position = placement.position;
      if (!isFinitePoint(position)) return `placements[${i}].position is not a finite point`;
      // `position.y` and `scale` are written by addPlacement but read nowhere; reject only a present, non-finite value.
      const y = (position as Record<string, unknown>).y;
      if (y !== undefined && !isFiniteNumber(y)) return `placements[${i}].position.y is not a finite number`;
      if (!isFiniteNumber(placement.rotation_y)) return `placements[${i}].rotation_y is not a finite number`;
      if (placement.scale !== undefined && !isFiniteNumber(placement.scale)) {
        return `placements[${i}].scale is not a finite number`;
      }
    }
  }

  return null;
}

/**
 * Validate a stored or imported graph and return it in the current shape, or null when it is unusable
 * (`roomGraphProblem` says why). Also normalizes the legacy `provenance: "authored"` string from early
 * from-scratch builds.
 */
export function normalizeRoomGraph(raw: unknown): RoomGraph | null {
  if (roomGraphProblem(raw) !== null) return null;
  const parsed = raw as {
    schema_version?: number;
    rooms?: RoomEntity[];
    walls?: WallEntity[];
    openings?: OpeningEntity[];
    placements?: PlacementEntity[];
    source_assets?: SourceAsset[];
    provenance?: unknown;
    light_preset_id?: string;
    display_unit?: DisplayUnit;
    label?: string;
    underlay?: RoomGraph['underlay'];
  };
  if (parsed.schema_version !== 1 || !Array.isArray(parsed.walls) || !Array.isArray(parsed.rooms)) {
    return null;
  }
  let provenance: RoomProvenance;
  if (parsed.provenance === 'authored' || parsed.provenance == null) {
    provenance = { kind: 'authored', confirm_status: 'confirmed' };
  } else if (typeof parsed.provenance === 'object' && parsed.provenance !== null) {
    const p = parsed.provenance as Partial<RoomProvenance>;
    const kind: ProvenanceKind =
      p.kind === 'dwg_import' || p.kind === 'template_instance' || p.kind === 'authored'
        ? p.kind
        : 'authored';
    provenance = {
      kind,
      import_job_id: p.import_job_id,
      template_id: p.template_id,
      confirm_status: p.confirm_status === 'draft' ? 'draft' : 'confirmed',
    };
  } else {
    provenance = { kind: 'authored', confirm_status: 'confirmed' };
  }
  return {
    schema_version: 1,
    units: 'm',
    rooms: parsed.rooms,
    walls: parsed.walls,
    openings: Array.isArray(parsed.openings) ? parsed.openings : [],
    placements: Array.isArray(parsed.placements) ? parsed.placements : [],
    source_assets: Array.isArray(parsed.source_assets) ? parsed.source_assets : [],
    provenance,
    light_preset_id: parsed.light_preset_id,
    display_unit: parsed.display_unit,
    label: parsed.label,
    underlay: parsed.underlay && typeof parsed.underlay === 'object' ? parsed.underlay : undefined,
  };
}

/** Set room-level wall/floor material ids (local library). */
export function setRoomSurfaceMaterials(
  graph: RoomGraph,
  mats: { floor_material_id?: string | null; wall_material_id?: string | null },
): RoomGraph {
  const rooms = graph.rooms.map((r, i) => {
    if (i !== 0) return r;
    const next = { ...r };
    if (mats.floor_material_id === null) delete next.floor_material_id;
    else if (mats.floor_material_id !== undefined) next.floor_material_id = mats.floor_material_id;
    if (mats.wall_material_id === null) delete next.wall_material_id;
    else if (mats.wall_material_id !== undefined) next.wall_material_id = mats.wall_material_id;
    return next;
  });
  return { ...graph, rooms };
}

/** Deep-clone graph for template instantiate (new ids for rooms/walls/openings). */
export function cloneRoomGraphSeed(
  seed: RoomGraph,
  opts: { provenance: RoomProvenance; label?: string; clearPlacements?: boolean },
): RoomGraph {
  const wallIdMap = new Map<string, string>();
  const walls: WallEntity[] = seed.walls.map((w) => {
    const id = nid('wall');
    wallIdMap.set(w.id, id);
    return { ...w, id, a: { ...w.a }, b: { ...w.b }, connected_room_ids: [] };
  });
  const rooms: RoomEntity[] = seed.rooms.map((r) => {
    const id = nid('room');
    const wall_ids = r.wall_ids.map((wid) => wallIdMap.get(wid) ?? wid);
    for (const w of walls) {
      if (wall_ids.includes(w.id)) w.connected_room_ids = [id];
    }
    return {
      ...r,
      id,
      floor_polygon: r.floor_polygon.map((p) => ({ ...p })),
      wall_ids,
    };
  });
  const openings: OpeningEntity[] = seed.openings.map((o) => ({
    ...o,
    id: nid('opening'),
    wall_id: wallIdMap.get(o.wall_id) ?? o.wall_id,
  }));
  return {
    schema_version: 1,
    units: 'm',
    rooms,
    walls,
    openings,
    placements: opts.clearPlacements === false ? seed.placements.map((p) => ({ ...p, id: nid('place'), position: { ...p.position }, slot_bindings: { ...p.slot_bindings } })) : [],
    source_assets: seed.source_assets.map((s) => ({ ...s })),
    provenance: opts.provenance,
    light_preset_id: seed.light_preset_id,
    display_unit: seed.display_unit,
    label: opts.label ?? seed.label,
  };
}

export interface OpeningInput {
  wall_id: string;
  type: OpeningType;
  offset_along_wall: number;
  width?: number;
  height?: number;
  sill_height?: number;
}

export type OpeningValidation =
  | { ok: true; opening: OpeningEntity }
  | { ok: false; error: string };

export function validateOpening(graph: RoomGraph, input: OpeningInput): OpeningValidation {
  const wall = graph.walls.find((w) => w.id === input.wall_id);
  if (!wall) return { ok: false, error: `Unknown wall "${input.wall_id}"` };

  const defaults = input.type === 'door' ? DEFAULT_DOOR : DEFAULT_WINDOW;
  const width = input.width ?? defaults.width;
  const height = input.height ?? defaults.height;
  const sill = input.sill_height ?? defaults.sill_height;
  const offset = input.offset_along_wall;
  const len = wallLength(wall);

  if (!(width > 0) || !(height > 0)) return { ok: false, error: 'Opening width and height must be positive' };
  if (sill < 0) return { ok: false, error: 'Sill height cannot be negative' };
  if (offset < 0) return { ok: false, error: 'Offset cannot be negative' };
  if (offset + width > len + 1e-6) {
    return { ok: false, error: `Opening exceeds wall length (${formatLength(len, 'm')})` };
  }
  if (sill + height > wall.height + 1e-6) {
    return { ok: false, error: `Opening exceeds wall height (${formatLength(wall.height, 'm')})` };
  }

  return {
    ok: true,
    opening: {
      id: nid('opening'),
      wall_id: wall.id,
      type: input.type,
      offset_along_wall: offset,
      width,
      height,
      sill_height: sill,
    },
  };
}

export function addOpening(graph: RoomGraph, input: OpeningInput): RoomGraph {
  const result = validateOpening(graph, input);
  if (!result.ok) throw new Error(result.error);
  return { ...graph, openings: [...graph.openings, result.opening] };
}

export function updateOpening(
  graph: RoomGraph,
  openingId: string,
  patch: Partial<Pick<OpeningEntity, 'width' | 'height' | 'sill_height' | 'offset_along_wall' | 'type'>>,
): RoomGraph {
  const existing = graph.openings.find((o) => o.id === openingId);
  if (!existing) throw new Error(`Unknown opening "${openingId}"`);
  const next = { ...existing, ...patch };
  const checked = validateOpening(
    { ...graph, openings: graph.openings.filter((o) => o.id !== openingId) },
    {
      wall_id: next.wall_id,
      type: next.type,
      offset_along_wall: next.offset_along_wall,
      width: next.width,
      height: next.height,
      sill_height: next.sill_height,
    },
  );
  if (!checked.ok) throw new Error(checked.error);
  return {
    ...graph,
    openings: graph.openings.map((o) => (o.id === openingId ? { ...checked.opening, id: openingId } : o)),
  };
}

export function removeOpening(graph: RoomGraph, openingId: string): RoomGraph {
  return { ...graph, openings: graph.openings.filter((o) => o.id !== openingId) };
}

export function addPlacement(
  graph: RoomGraph,
  input: Omit<PlacementEntity, 'id'> & { id?: string },
): RoomGraph {
  const placement: PlacementEntity = {
    id: input.id ?? nid('place'),
    sku_id: input.sku_id,
    asset_ref: input.asset_ref,
    product_id: input.product_id,
    position: { ...input.position, y: 0 },
    rotation_y: input.rotation_y ?? 0,
    scale: input.scale ?? 1,
    slot_bindings: { ...input.slot_bindings },
  };
  return { ...graph, placements: [...graph.placements, placement] };
}

export function updatePlacement(
  graph: RoomGraph,
  placementId: string,
  patch: Partial<Pick<PlacementEntity, 'position' | 'rotation_y' | 'scale' | 'slot_bindings'>>,
): RoomGraph {
  return {
    ...graph,
    placements: graph.placements.map((p) => {
      if (p.id !== placementId) return p;
      return {
        ...p,
        ...patch,
        position: patch.position ? { ...patch.position, y: 0 } : p.position,
        slot_bindings: patch.slot_bindings ? { ...patch.slot_bindings } : p.slot_bindings,
      };
    }),
  };
}

export function removePlacement(graph: RoomGraph, placementId: string): RoomGraph {
  return { ...graph, placements: graph.placements.filter((p) => p.id !== placementId) };
}

/** Offset along wall for a world XZ hit, centered opening width. */
export function openingOffsetFromHit(
  wall: WallEntity,
  hit: Vec2,
  openingWidth: number,
): number {
  const len = wallLength(wall);
  const dx = wall.b.x - wall.a.x;
  const dz = wall.b.z - wall.a.z;
  const t = len > 0 ? ((hit.x - wall.a.x) * dx + (hit.z - wall.a.z) * dz) / (len * len) : 0;
  const along = Math.min(Math.max(t, 0), 1) * len;
  const half = openingWidth / 2;
  return Math.min(Math.max(along - half, 0), Math.max(0, len - openingWidth));
}

/**
 * Save the room to browser storage (or remove it when `graph` is null).
 * Returns true when storage accepted the write, false when it threw (blocked, full, or unavailable).
 * On false the room lives only in memory: the caller should tell the user (deck §4.F "Saving blocked").
 * Never throws.
 */
export function persistRoomGraph(graph: RoomGraph | null, storage?: StorageLike): boolean {
  try {
    // Reading `localStorage` can itself throw when the browser blocks storage, so it stays inside the try.
    const store = storage ?? localStorage;
    if (!graph) {
      store.removeItem(STORAGE_KEY);
      return true;
    }
    store.setItem(STORAGE_KEY, JSON.stringify(graph));
    return true;
  } catch {
    return false;
  }
}

/** The saved room, or null when there is none, it is unreadable, or storage is unavailable. Changes nothing. */
export function loadPersistedRoomGraph(storage?: StorageLike): RoomGraph | null {
  try {
    const raw = (storage ?? localStorage).getItem(STORAGE_KEY);
    if (!raw) return null;
    return normalizeRoomGraph(JSON.parse(raw));
  } catch {
    return null;
  }
}

/**
 * Why a saved room was set aside:
 * - `not_json`: the stored text does not parse as JSON
 * - `invalid_graph`: it parses, but `roomGraphProblem` rejects it
 * - `render_failed`: it passed validation but the host could not display it (host-reported)
 */
export type QuarantineReason = 'not_json' | 'invalid_graph' | 'render_failed';

/** What is kept under `QUARANTINE_STORAGE_KEY` (as JSON) for an unreadable saved room. */
export interface QuarantinedRoomGraph {
  /** The saved text exactly as found. This is what a "download the damaged data" action should offer. */
  raw: string;
  reason: QuarantineReason;
  /** Developer-facing detail (the failed check or the error text). Not UI copy. */
  detail: string;
  /** ISO timestamp. */
  quarantined_at: string;
}

export interface QuarantineOutcome {
  quarantined: QuarantinedRoomGraph;
  /** True when the copy was written under `QUARANTINE_STORAGE_KEY`. False when storage refused the write. */
  backedUp: boolean;
  /**
   * True when the unreadable text was removed from `STORAGE_KEY`. It is removed only after the backup
   * succeeded, so the only stored copy is never destroyed; when false, the next load reports it again.
   */
  removed: boolean;
}

/**
 * Move whatever is saved under `STORAGE_KEY` to `QUARANTINE_STORAGE_KEY` (replacing an earlier backup).
 * Returns null when nothing is saved or storage cannot be read. Never throws.
 *
 * `loadPersistedRoomGraphOrQuarantine` calls this for text it cannot read. The host can call it directly
 * with `'render_failed'` if a saved room passes validation but breaks the first render.
 */
export function quarantinePersistedRoomGraph(
  reason: QuarantineReason,
  detail: string,
  storage?: StorageLike,
  now: () => Date = () => new Date(),
): QuarantineOutcome | null {
  let store: StorageLike;
  let raw: string | null;
  try {
    store = storage ?? localStorage;
    raw = store.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
  if (raw === null) return null;
  const quarantined: QuarantinedRoomGraph = { raw, reason, detail, quarantined_at: now().toISOString() };
  let backedUp = false;
  let removed = false;
  try {
    store.setItem(QUARANTINE_STORAGE_KEY, JSON.stringify(quarantined));
    backedUp = true;
    store.removeItem(STORAGE_KEY);
    removed = true;
  } catch {
    // Storage refused. The caller still has `quarantined.raw` in memory to offer as a download.
  }
  return { quarantined, backedUp, removed };
}

/** Result of reading the saved room at boot. `graph` is null in every state except `ok`. */
export type PersistedRoomLoad =
  | { status: 'none'; graph: null }
  | { status: 'ok'; graph: RoomGraph }
  | ({ status: 'unreadable'; graph: null } & QuarantineOutcome)
  | { status: 'storage_unavailable'; graph: null };

/**
 * Boot-time load. Like `loadPersistedRoomGraph`, but a saved room that cannot be read is moved to
 * `QUARANTINE_STORAGE_KEY` and reported, so the app can start empty, say so, and offer the damaged
 * data as a download (deck §4.F "Saved room unreadable"). Never throws.
 */
export function loadPersistedRoomGraphOrQuarantine(
  storage?: StorageLike,
  now: () => Date = () => new Date(),
): PersistedRoomLoad {
  let store: StorageLike;
  let raw: string | null;
  try {
    store = storage ?? localStorage;
    raw = store.getItem(STORAGE_KEY);
  } catch {
    return { status: 'storage_unavailable', graph: null };
  }
  if (!raw) return { status: 'none', graph: null };

  let reason: QuarantineReason = 'invalid_graph';
  let detail: string;
  try {
    const parsed: unknown = JSON.parse(raw);
    const graph = normalizeRoomGraph(parsed);
    if (graph) return { status: 'ok', graph };
    detail = roomGraphProblem(parsed) ?? 'rejected by normalizeRoomGraph';
  } catch (err) {
    reason = 'not_json';
    detail = String((err as Error)?.message ?? err);
  }

  const outcome = quarantinePersistedRoomGraph(reason, detail, store, now);
  if (!outcome) {
    // The text was readable a moment ago and is gone or unreachable now; report what was read.
    return {
      status: 'unreadable',
      graph: null,
      quarantined: { raw, reason, detail, quarantined_at: now().toISOString() },
      backedUp: false,
      removed: false,
    };
  }
  return { status: 'unreadable', graph: null, ...outcome };
}

/** The backup written by the last quarantine, or null when there is none (or it cannot be read). */
export function readQuarantinedRoomGraph(storage?: StorageLike): QuarantinedRoomGraph | null {
  try {
    const text = (storage ?? localStorage).getItem(QUARANTINE_STORAGE_KEY);
    if (!text) return null;
    const parsed: unknown = JSON.parse(text);
    if (!isRecord(parsed) || typeof parsed.raw !== 'string') return null;
    const reason: QuarantineReason =
      parsed.reason === 'not_json' || parsed.reason === 'render_failed' ? parsed.reason : 'invalid_graph';
    return {
      raw: parsed.raw,
      reason,
      detail: typeof parsed.detail === 'string' ? parsed.detail : '',
      quarantined_at: typeof parsed.quarantined_at === 'string' ? parsed.quarantined_at : '',
    };
  } catch {
    return null;
  }
}

/** Delete the quarantine backup (for example after the user downloaded it). False when storage threw. */
export function discardQuarantinedRoomGraph(storage?: StorageLike): boolean {
  try {
    (storage ?? localStorage).removeItem(QUARANTINE_STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}

export function roomBounds(graph: RoomGraph): { minX: number; maxX: number; minZ: number; maxZ: number; height: number } {
  let minX = Infinity,
    maxX = -Infinity,
    minZ = Infinity,
    maxZ = -Infinity,
    height = 0;
  for (const r of graph.rooms) {
    height = Math.max(height, r.ceiling_height);
    for (const p of r.floor_polygon) {
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
      minZ = Math.min(minZ, p.z);
      maxZ = Math.max(maxZ, p.z);
    }
  }
  if (!Number.isFinite(minX)) return { minX: -1, maxX: 1, minZ: -1, maxZ: 1, height: 2.7 };
  return { minX, maxX, minZ, maxZ, height };
}
