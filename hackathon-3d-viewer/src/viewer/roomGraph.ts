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
 */
export function createRectangularRoom(input: RoomSizeInput): RoomGraph {
  const length = input.length;
  const width = input.width;
  const ceiling = input.ceilingHeight;
  const thickness = input.wallThickness ?? DEFAULT_WALL_THICKNESS_M;
  if (!(length > 0) || !(width > 0) || !(ceiling > 0) || !(thickness > 0)) {
    throw new Error('Room size must be positive (length, width, ceiling height, wall thickness)');
  }

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

/** Normalize legacy `provenance: "authored"` string from early from-scratch builds. */
export function normalizeRoomGraph(raw: unknown): RoomGraph | null {
  if (!raw || typeof raw !== 'object') return null;
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

export function persistRoomGraph(graph: RoomGraph | null): void {
  try {
    if (!graph) {
      localStorage.removeItem(STORAGE_KEY);
      return;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(graph));
  } catch {
    // session-only fallback if storage blocked
  }
}

export function loadPersistedRoomGraph(): RoomGraph | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return normalizeRoomGraph(JSON.parse(raw));
  } catch {
    return null;
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
