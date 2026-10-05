/**
 * GLB + MJS pack helpers for Polyfork-style assets.
 *
 * Observed from Desktop `models/core-rulebook-4aedc7.mjs` (+ sibling `.glb`):
 *   exports: createAsset, params, presets, materials, rig, view, decals, …
 *   materials keys are zone ids (cover, gold, …) baked into COLOR_0 —
 *   NOT glTF material_slot_id tags on separate meshes in the vendor GLB.
 *   GLB has nodes book / cover / cover-board, COLOR_0, one PBR material, no extras.
 *
 * SoR path (Chong): split COLOR_0 zones into real `material_slot` meshes at load.
 * COLOR_0 remap remains last-resort fallback if split fails.
 *
 * Do not invent Polyfork APIs beyond what resolveModulePackMeta reads.
 */
import {
  BufferAttribute,
  Color,
  Mesh,
  MeshStandardMaterial,
  type Object3D,
} from 'three';

import {
  getModuleFactory,
  isModuleFile,
  registerModuleFactory,
  resolveModuleAsset,
  type CreateAssetFn,
  type ResolvedModuleAsset,
} from './modules';
import { discoverSlots } from './slots';
import { probeVertexColorZones, splitVertexColorZones, type SplitZonesResult } from './splitZones';
import { UPLOAD_SLOT_CATEGORIES, isModelFile } from './uploads';
import type { Product, SlotDefinition } from './types';

export type { SplitZonesResult } from './splitZones';
export { probeVertexColorZones, splitVertexColorZones } from './splitZones';

const HEXRE = /^#[0-9a-f]{3,8}$/i;

export type PackParamType = 'choice' | 'range' | 'toggle' | 'color' | 'unknown';

export interface PackParamSchema {
  key: string;
  type: PackParamType;
  label: string;
  default: unknown;
  options?: string[];
  min?: number;
  max?: number;
  step?: number;
  /** Observed on sample: 'colors' | 'geometry'. */
  affects?: string;
  describe?: string;
}

export interface PackMaterialMeta {
  key: string;
  kind?: string;
  finish?: string;
  raw: Record<string, unknown>;
}

export type PackMappingMode = 'slots' | 'vertex-colors' | 'unknown';

export type PackCompleteness = 'complete' | 'mjs-only' | 'glb-only';

export interface PackStatus {
  completeness: PackCompleteness;
  mappingMode: PackMappingMode;
  /** Material / zone keys from MJS `materials` or color params. */
  materialKeys: string[];
  /** Keys that bound to a GLB slot or mesh name. */
  mappedKeys: string[];
  /** Keys with no inferred GLB target — do not invent slot ids. */
  unknownKeys: string[];
  /** Human-readable status lines for the UI. */
  notes: string[];
}

export interface ModulePackMeta {
  exportKeys: string[];
  via: ResolvedModuleAsset['via'];
  createAsset: CreateAssetFn;
  params: PackParamSchema[];
  /** Colorway / named presets object from `export const presets` (or COLORWAYS-shaped). */
  presets: Record<string, Record<string, string>> | null;
  materials: PackMaterialMeta[];
  /** Color zone keys (params with type color, or materials keys). */
  colorZones: string[];
}

export interface PackLoadResult {
  product: Product;
  sessionUrls: string[];
  meta: ModulePackMeta;
  status: PackStatus;
  /** Initial userParams derived from schema defaults. */
  initialParams: Record<string, unknown>;
}

function basenameStem(name: string): string {
  return name.replace(/\.[^.]+$/, '').toLowerCase();
}

function labelFromId(id: string): string {
  return id
    .split(/[-_]/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function readParamSchema(key: string, raw: unknown): PackParamSchema {
  const o = asRecord(raw) ?? {};
  const typeRaw = typeof o.type === 'string' ? o.type : 'unknown';
  const type: PackParamType =
    typeRaw === 'choice' || typeRaw === 'range' || typeRaw === 'toggle' || typeRaw === 'color'
      ? typeRaw
      : 'unknown';
  const options = Array.isArray(o.options) ? o.options.filter((x): x is string => typeof x === 'string') : undefined;
  return {
    key,
    type,
    label: typeof o.label === 'string' ? o.label : labelFromId(key),
    default: o.default,
    options,
    min: typeof o.min === 'number' ? o.min : undefined,
    max: typeof o.max === 'number' ? o.max : undefined,
    step: typeof o.step === 'number' ? o.step : undefined,
    affects: typeof o.affects === 'string' ? o.affects : undefined,
    describe: typeof o.describe === 'string' ? o.describe : undefined,
  };
}

function readPresets(raw: unknown): Record<string, Record<string, string>> | null {
  const top = asRecord(raw);
  if (!top) return null;
  const out: Record<string, Record<string, string>> = {};
  for (const [name, zoneRaw] of Object.entries(top)) {
    const zone = asRecord(zoneRaw);
    if (!zone) continue;
    const colors: Record<string, string> = {};
    for (const [k, v] of Object.entries(zone)) {
      if (typeof v === 'string' && HEXRE.test(v)) colors[k] = v;
    }
    if (Object.keys(colors).length) out[name] = colors;
  }
  return Object.keys(out).length ? out : null;
}

function readMaterials(raw: unknown): PackMaterialMeta[] {
  const top = asRecord(raw);
  if (!top) return [];
  return Object.entries(top).map(([key, v]) => {
    const o = asRecord(v) ?? {};
    return {
      key,
      kind: typeof o.kind === 'string' ? o.kind : undefined,
      finish: typeof o.finish === 'string' ? o.finish : undefined,
      raw: o,
    };
  });
}

/**
 * Inspect a loaded module namespace for pack metadata (params / presets / materials).
 * Only reads what is actually exported — no invented Polyfork fields.
 */
export function resolveModulePackMeta(mod: Record<string, unknown>): ModulePackMeta {
  const resolved = resolveModuleAsset(mod);
  const paramsRaw = asRecord(mod.params);
  const params = paramsRaw
    ? Object.entries(paramsRaw).map(([k, v]) => readParamSchema(k, v))
    : [];
  const materials = readMaterials(mod.materials);
  const presets = readPresets(mod.presets);

  const colorFromParams = params.filter((p) => p.type === 'color').map((p) => p.key);
  const colorZones = [...new Set([...materials.map((m) => m.key), ...colorFromParams])];

  return {
    exportKeys: resolved.exportKeys,
    via: resolved.via,
    createAsset: resolved.createAsset,
    params,
    presets,
    materials,
    colorZones,
  };
}

/** Pair files from a multi-select: prefer same basename stem for .mjs + .glb. */
export function associatePackFiles(files: FileList | File[]): {
  mjs: File | null;
  glb: File | null;
  extras: File[];
  association: 'basename' | 'single-mjs' | 'single-glb' | 'multi-unmatched' | 'empty';
} {
  const list = [...files];
  if (!list.length) return { mjs: null, glb: null, extras: [], association: 'empty' };

  const mjsFiles = list.filter(isModuleFile);
  const glbFiles = list.filter((f) => /\.glb$/i.test(f.name) || (isModelFile(f) && /\.glb$/i.test(f.name)));
  const extras = list.filter((f) => !mjsFiles.includes(f) && !glbFiles.includes(f));

  const mjs = mjsFiles[0] ?? null;
  if (mjs && glbFiles.length) {
    const stem = basenameStem(mjs.name);
    const mate = glbFiles.find((g) => basenameStem(g.name) === stem) ?? null;
    if (mate) return { mjs, glb: mate, extras, association: 'basename' };
    if (glbFiles.length === 1) return { mjs, glb: glbFiles[0], extras, association: 'multi-unmatched' };
  }
  if (mjs && !glbFiles.length) return { mjs, glb: null, extras, association: 'single-mjs' };
  if (!mjs && glbFiles.length === 1) return { mjs: null, glb: glbFiles[0], extras, association: 'single-glb' };
  return { mjs, glb: glbFiles[0] ?? null, extras, association: list.length ? 'multi-unmatched' : 'empty' };
}

/** Finish → MeshStandardMaterial hints from observed `materials` meta (kind/finish strings). */
export function finishToPbr(meta?: PackMaterialMeta): { roughness: number; metalness: number } {
  const kind = (meta?.kind ?? '').toLowerCase();
  const finish = (meta?.finish ?? '').toLowerCase();
  if (kind === 'metal' || finish === 'polished') return { roughness: 0.35, metalness: 0.85 };
  if (kind === 'leather' || finish === 'grain') return { roughness: 0.75, metalness: 0 };
  if (kind === 'paper' || finish === 'plain') return { roughness: 0.9, metalness: 0 };
  if (kind === 'fabric' || finish === 'cotton') return { roughness: 0.85, metalness: 0 };
  if (kind === 'paint' || finish === 'matte') return { roughness: 0.95, metalness: 0 };
  return { roughness: 0.85, metalness: 0 };
}

/**
 * Resolve active zone colors from params + presets (mirrors sample resolveParams color path).
 */
export function resolvePackColors(
  meta: ModulePackMeta,
  userParams: Record<string, unknown> = {},
): Record<string, string> {
  const colorwayParam = meta.params.find((p) => p.key === 'colorway');
  const defaultCw =
    typeof colorwayParam?.default === 'string'
      ? colorwayParam.default
      : meta.presets
        ? Object.keys(meta.presets)[0]
        : undefined;
  const cwRaw = userParams.colorway;
  const cw =
    typeof cwRaw === 'string' && meta.presets?.[cwRaw]
      ? cwRaw
      : defaultCw && meta.presets?.[defaultCw]
        ? defaultCw
        : null;

  const zones: Record<string, string> = {};
  if (cw && meta.presets?.[cw]) Object.assign(zones, meta.presets[cw]);

  for (const key of meta.colorZones) {
    if (!zones[key]) {
      const p = meta.params.find((x) => x.key === key);
      if (typeof p?.default === 'string' && HEXRE.test(p.default)) zones[key] = p.default;
    }
  }

  for (const key of meta.colorZones) {
    const v = userParams[key];
    if (typeof v === 'string' && HEXRE.test(v)) zones[key] = v;
  }
  return zones;
}

/** Defaults object from param schema (for UI + createAsset).
 * Color zone keys are omitted so `colorway` / presets can drive them (Polyfork resolveParams behavior).
 */
export function defaultsFromMeta(meta: ModulePackMeta): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const p of meta.params) {
    if (p.type === 'color') continue;
    if (p.default !== undefined) out[p.key] = p.default;
  }
  return out;
}

function collectMeshNames(root: Object3D): string[] {
  const names: string[] = [];
  root.traverse((o) => {
    if ((o as Mesh).isMesh && o.name) names.push(o.name);
  });
  return names;
}

/**
 * Infer mapping from MJS material/zone keys → GLB slot ids or mesh names.
 * Prefer COLOR_0 → split slots when zone palette matches vertex colors (core-rulebook).
 * Never invents slot ids for keys with no geometry evidence: those go to unknownKeys.
 */
export function inferPackMapping(
  meta: ModulePackMeta,
  root: Object3D | null,
): Pick<PackStatus, 'mappingMode' | 'materialKeys' | 'mappedKeys' | 'unknownKeys' | 'notes'> {
  const materialKeys = meta.colorZones.length
    ? [...meta.colorZones]
    : meta.materials.map((m) => m.key);
  const notes: string[] = [];

  if (!root) {
    return {
      mappingMode: 'unknown',
      materialKeys,
      mappedKeys: [],
      unknownKeys: [...materialKeys],
      notes: ['No GLB in pack — using createAsset() mesh; pack incomplete for catalog GLB path.'],
    };
  }

  const discovered = discoverSlots(root);
  const slotIds = new Set([...discovered.slots.keys()]);
  const meshNames = new Set(collectMeshNames(root).map((n) => n.toLowerCase()));

  const mappedKeys: string[] = [];
  const unknownKeys: string[] = [];

  for (const key of materialKeys) {
    const lower = key.toLowerCase();
    if (slotIds.has(key) || slotIds.has(lower)) {
      mappedKeys.push(key);
      continue;
    }
    if (meshNames.has(lower) || meshNames.has(`slot_${lower}`)) {
      mappedKeys.push(key);
      continue;
    }
    // slot_<id> discovery already uses ids without prefix
    let hit = false;
    for (const id of slotIds) {
      if (id.toLowerCase() === lower) {
        hit = true;
        break;
      }
    }
    if (hit) mappedKeys.push(key);
    else unknownKeys.push(key);
  }

  if (mappedKeys.length) {
    notes.push(`Mapped MJS material keys → GLB slots/meshes: ${mappedKeys.join(', ')}.`);
    if (unknownKeys.length) {
      notes.push(
        `Unknown (not invented as slot ids): ${unknownKeys.join(', ')}. ` +
          `GLB meshes: ${[...meshNames].join(', ') || '(unnamed)'}.`,
      );
    }
    return { mappingMode: 'slots', materialKeys, mappedKeys, unknownKeys, notes };
  }

  // Prefer split: COLOR_0 clusters that match MJS zone palette → real material_slot meshes at load.
  const defaultPalette = resolvePackColors(meta, defaultsFromMeta(meta));
  const probe = probeVertexColorZones(root, defaultPalette);
  if (probe.hasColorAttribute && probe.hits.length && materialKeys.length) {
    const splitMapped = probe.hits.map((h) => h.key).filter((k) => materialKeys.includes(k));
    const splitUnknown = materialKeys.filter((k) => !splitMapped.includes(k));
    notes.push(
      `COLOR_0 zone split (primary): MJS keys match vertex-color clusters → will emit material_slot meshes for: ${splitMapped.join(', ')}. ` +
        probe.hits.map((h) => `${h.key}:${h.faces}f/${h.vertices}v`).join(', '),
    );
    if (splitUnknown.length) {
      notes.push(
        `Unknown (no COLOR_0 faces for this GLB snapshot — not invented as empty slots): ${splitUnknown.join(', ')}.`,
      );
    }
    notes.push(
      `GLB mesh names: ${[...meshNames].join(', ') || '(unnamed)'} — zones come from COLOR_0 + MJS palette, not mesh names.`,
    );
    return {
      mappingMode: 'slots',
      materialKeys,
      mappedKeys: splitMapped,
      unknownKeys: splitUnknown,
      notes,
    };
  }

  // Last-resort fallback: remap COLOR_0 in place when split cannot match zones.
  if (probe.hasColorAttribute && materialKeys.length) {
    notes.push(
      'Split failed / no zone matches — fallback: COLOR_0 vertex-color remap (no material_slot meshes). ' +
        `Unmapped keys: ${materialKeys.join(', ')}.`,
    );
    if (discovered.slots.size === 0) {
      notes.push(
        `GLB mesh names: ${[...meshNames].join(', ') || '(unnamed)'} — not treated as invented slot ids.`,
      );
    }
    return {
      mappingMode: 'vertex-colors',
      materialKeys,
      mappedKeys: [],
      unknownKeys: [...materialKeys],
      notes,
    };
  }

  notes.push(
    'Unknown: cannot map MJS materials/params onto GLB slots. ' +
      'Do not invent material_slot_id. ' +
      `Keys: ${materialKeys.join(', ') || '(none)'}. ` +
      `GLB slots: ${[...slotIds].join(', ') || '(none)'}; meshes: ${[...meshNames].join(', ') || '(unnamed)'}.`,
  );
  return { mappingMode: 'unknown', materialKeys, mappedKeys, unknownKeys: [...materialKeys], notes };
}

/**
 * Run COLOR_0 → slot mesh split using the palette currently baked in the mesh
 * (defaults / last known zones). Idempotent for already-split children.
 */
export function ensurePackZoneSlots(
  root: Object3D,
  meta: ModulePackMeta,
  bakedZones?: Record<string, string>,
): SplitZonesResult {
  const palette = bakedZones ?? resolvePackColors(meta, defaultsFromMeta(meta));
  return splitVertexColorZones(root, palette);
}

/**
 * Remap COLOR_0 vertices whose RGB matches a from-palette zone onto the to-palette zone.
 * Used when pack mappingMode is vertex-colors (core-rulebook style).
 */
export function remapVertexColors(
  root: Object3D,
  fromZones: Record<string, string>,
  toZones: Record<string, string>,
  tolerance = 0.02,
): { remappedVertices: number; zonesHit: string[] } {
  const fromEntries = Object.entries(fromZones).filter(([k]) => toZones[k]);
  const fromColors = fromEntries.map(([k, hex]) => {
    const c = new Color(hex);
    return { key: k, r: c.r, g: c.g, b: c.b, to: new Color(toZones[k]) };
  });

  let remappedVertices = 0;
  const zonesHit = new Set<string>();

  root.traverse((o) => {
    if (!(o as Mesh).isMesh) return;
    const mesh = o as Mesh;
    const attr = mesh.geometry?.getAttribute('color') as BufferAttribute | undefined;
    if (!attr) return;
    // Mutate a clone so we do not permanently alter a shared buffer across remounts incorrectly.
    const arr = new Float32Array(attr.array as Float32Array);
    const itemSize = attr.itemSize;
    for (let i = 0; i < attr.count; i++) {
      const r = arr[i * itemSize];
      const g = arr[i * itemSize + 1];
      const b = arr[i * itemSize + 2];
      for (const z of fromColors) {
        if (
          Math.abs(r - z.r) <= tolerance &&
          Math.abs(g - z.g) <= tolerance &&
          Math.abs(b - z.b) <= tolerance
        ) {
          arr[i * itemSize] = z.to.r;
          arr[i * itemSize + 1] = z.to.g;
          arr[i * itemSize + 2] = z.to.b;
          remappedVertices++;
          zonesHit.add(z.key);
          break;
        }
      }
    }
    mesh.geometry.setAttribute('color', new BufferAttribute(arr, itemSize));
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const m of mats) {
      if (m && 'vertexColors' in m) {
        (m as MeshStandardMaterial).vertexColors = true;
        m.needsUpdate = true;
      }
    }
  });

  return { remappedVertices, zonesHit: [...zonesHit] };
}

/** Apply solid colors onto meshes that match mapped material keys (slot or mesh name). */
export function applyPackSlotColors(
  root: Object3D,
  meta: ModulePackMeta,
  colors: Record<string, string>,
  mappedKeys: string[],
): void {
  const byKey = new Map(meta.materials.map((m) => [m.key, m]));
  root.traverse((o) => {
    if (!(o as Mesh).isMesh) return;
    const mesh = o as Mesh;
    const name = (mesh.name || '').toLowerCase();
    for (const key of mappedKeys) {
      const lower = key.toLowerCase();
      const slotExtra = mesh.userData?.material_slot_id;
      const match =
        (typeof slotExtra === 'string' && slotExtra.toLowerCase() === lower) ||
        name === lower ||
        name === `slot_${lower}` ||
        name.startsWith(`slot_${lower}__`);
      if (!match) continue;
      const pbr = finishToPbr(byKey.get(key));
      const hex = colors[key];
      if (!hex) continue;
      const mat = new MeshStandardMaterial({
        name: `pack:${key}`,
        color: new Color(hex),
        roughness: pbr.roughness,
        metalness: pbr.metalness,
      });
      mat.userData.packZone = key;
      mesh.material = mat;
    }
  });
}

export function buildPackStatus(
  completeness: PackCompleteness,
  mapping: ReturnType<typeof inferPackMapping>,
): PackStatus {
  return {
    completeness,
    mappingMode: mapping.mappingMode,
    materialKeys: mapping.materialKeys,
    mappedKeys: mapping.mappedKeys,
    unknownKeys: mapping.unknownKeys,
    notes: [
      completeness === 'complete'
        ? 'Pack complete: paired .glb + .mjs.'
        : completeness === 'mjs-only'
          ? 'Pack incomplete: GLB missing — fallback to createAsset() mesh.'
          : 'GLB only (no MJS materials source).',
      ...mapping.notes,
    ],
  };
}

/**
 * Build a Product from an MJS (+ optional paired GLB). Prefer GLB geometry when present.
 */
export function createProductFromPack(opts: {
  mjsFile: File;
  glbFile?: File | null;
  meta: ModulePackMeta;
  defaultMaterialId: string;
  /** Optional pre-parsed GLB root for mapping inference (caller may dispose). */
  glbRoot?: Object3D | null;
}): PackLoadResult {
  const { mjsFile, glbFile, meta, defaultMaterialId, glbRoot = null } = opts;
  const id = `pack-${Date.now().toString(36)}`;
  const base = mjsFile.name.replace(/\.mjs$/i, '');
  const sessionUrls: string[] = [];

  registerModuleFactory(id, meta.createAsset);

  const completeness: PackCompleteness = glbFile ? 'complete' : 'mjs-only';
  const mapping = inferPackMapping(meta, glbFile ? glbRoot : null);
  const status = buildPackStatus(completeness, mapping);
  const initialParams = defaultsFromMeta(meta);

  const slots: SlotDefinition[] = [];
  if (mapping.mappingMode === 'slots' && mapping.mappedKeys.length) {
    for (const key of mapping.mappedKeys) {
      const param = meta.params.find((p) => p.key === key);
      slots.push({
        id: key,
        label: param?.label ?? labelFromId(key),
        allowedCategories: [...UPLOAD_SLOT_CATEGORIES],
        default: defaultMaterialId,
      });
    }
  } else {
    slots.push({
      id: 'surface',
      label:
        completeness === 'mjs-only'
          ? 'Surface (createAsset materials)'
          : mapping.mappingMode === 'vertex-colors'
            ? 'Surface (COLOR_0 remap fallback — split failed)'
            : 'Surface (pack — mapping Unknown)',
      allowedCategories: [...UPLOAD_SLOT_CATEGORIES],
      default: defaultMaterialId,
    });
  }

  let glbUrl = `module://${id}`;
  let resourceMap: Record<string, string> | undefined;
  let sourceKind: Product['sourceKind'] = 'mjs-module';
  let preserveMaterials = true;

  if (glbFile) {
    glbUrl = URL.createObjectURL(glbFile);
    sessionUrls.push(glbUrl);
    sourceKind = 'glb';
    // Slot-mapped / COLOR_0-split packs accept library overrides; vertex-color fallback keeps embedded.
    preserveMaterials = mapping.mappingMode !== 'slots';
  }

  const splitNote = mapping.notes.some((n) => /COLOR_0 zone split/i.test(n));
  const product: Product = {
    id,
    sku: `STUB-SKU-PACK-${id.toUpperCase()}`,
    name: base,
    glb: glbUrl,
    slotTagging:
      mapping.mappingMode === 'slots'
        ? splitNote
          ? `mjs-pack-color0-split (${mapping.mappedKeys.join(', ')})`
          : `mjs-pack-slots (${mapping.mappedKeys.join(', ')})`
        : mapping.mappingMode === 'vertex-colors'
          ? 'mjs-pack-vertex-colors-fallback'
          : completeness === 'mjs-only'
            ? `mjs-module (${meta.via})`
            : 'mjs-pack-mapping-unknown',
    slots,
    fallbackSlotId: mapping.mappingMode === 'slots' ? undefined : 'surface',
    resourceMap,
    userAdded: true,
    sourceKind,
    preserveMaterials,
    pack: {
      hasMjs: true,
      hasGlb: !!glbFile,
      completeness,
      mappingMode: mapping.mappingMode,
      exportKeys: meta.exportKeys,
      materialKeys: mapping.materialKeys,
      mappedKeys: mapping.mappedKeys,
      unknownKeys: mapping.unknownKeys,
      notes: status.notes,
      paramKeys: meta.params.map((p) => p.key),
    },
  };

  return { product, sessionUrls, meta, status, initialParams };
}

/** Re-apply pack colors onto an already-loaded scene root. */
export function applyPackAppearance(
  root: Object3D,
  meta: ModulePackMeta,
  userParams: Record<string, unknown>,
  status: PackStatus,
  /** Palette currently baked in the mesh (defaults / last apply). */
  fromZones?: Record<string, string>,
): { toZones: Record<string, string>; remappedVertices: number; zonesHit: string[] } {
  const toZones = resolvePackColors(meta, userParams);
  if (status.mappingMode === 'slots') {
    applyPackSlotColors(root, meta, toZones, status.mappedKeys);
    return { toZones, remappedVertices: 0, zonesHit: status.mappedKeys };
  }
  if (status.mappingMode === 'vertex-colors') {
    const from = fromZones ?? resolvePackColors(meta, defaultsFromMeta(meta));
    const result = remapVertexColors(root, from, toZones);
    return { toZones, ...result };
  }
  return { toZones, remappedVertices: 0, zonesHit: [] };
}

export function getPackFactory(productId: string): CreateAssetFn | undefined {
  return getModuleFactory(productId);
}
