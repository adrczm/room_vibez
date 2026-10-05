/**
 * Opt-in ES module (.mjs) loader for parametric Three.js assets.
 *
 * Contract (discovered from Desktop sample `models/core-rulebook-4aedc7.mjs`,
 * Polyfork-style — not invented):
 *   - Named `createAsset(params?)` → THREE.Object3D (typically Group), OR
 *   - `default` export that is the same factory, OR
 *   - `default` / `createAsset` that is already an Object3D
 *
 * `.mjs` is JavaScript, not a mesh format. Arbitrary code runs on import.
 */
import type { Object3D } from 'three';

import { UPLOAD_SLOT_CATEGORIES } from './uploads';
import type { Product, SlotDefinition } from './types';

/** Absolute URLs for bare `three` / `three/addons/` rewrites (blob modules cannot use Vite resolve). */
export interface ThreeBareImportUrls {
  three: string;
  addonsBase: string;
}

export type CreateAssetFn = (params?: Record<string, unknown>) => Object3D;

export interface ResolvedModuleAsset {
  /** Factory used on every load/remount (fresh Object3D each time). */
  createAsset: CreateAssetFn;
  /** Export keys present on the module (for diagnostics). */
  exportKeys: string[];
  /** How the factory was selected. */
  via: 'createAsset' | 'default-function' | 'default-object3d' | 'createAsset-object3d';
}

export class ModuleContractError extends Error {
  readonly exportKeys: string[];
  constructor(message: string, exportKeys: string[]) {
    super(message);
    this.name = 'ModuleContractError';
    this.exportKeys = exportKeys;
  }
}

export function isModuleFile(file: File): boolean {
  return /\.mjs$/i.test(file.name) || file.type === 'text/javascript' || file.type === 'application/javascript';
}

function isObject3D(value: unknown): value is Object3D {
  return !!value && typeof value === 'object' && (value as Object3D).isObject3D === true;
}

/**
 * Rewrite bare `three` / `three/addons/…` specifiers so a blob: module can resolve
 * them against Vite-served (or CDN) absolute URLs. Leaves other imports alone.
 */
export function rewriteThreeBareImports(source: string, urls: ThreeBareImportUrls): string {
  const three = urls.three;
  const addons = urls.addonsBase.endsWith('/') ? urls.addonsBase : `${urls.addonsBase}/`;
  return source
    .replace(/(from\s+|import\s*\(\s*)['"]three['"]/g, `$1'${three}'`)
    .replace(/(from\s+|import\s*\(\s*)['"]three\/addons\//g, `$1'${addons}`);
}

/** Default Vite-dev URLs for this repo's three@0.170 layout. */
export function defaultThreeBareImportUrls(origin = typeof location !== 'undefined' ? location.origin : 'http://127.0.0.1:18767'): ThreeBareImportUrls {
  return {
    three: `${origin}/node_modules/three/build/three.module.js`,
    addonsBase: `${origin}/node_modules/three/examples/jsm/`,
  };
}

/**
 * Resolve a loaded ES module namespace to a createAsset factory.
 * Throws ModuleContractError with export keys when the shape is unknown.
 */
export function resolveModuleAsset(mod: Record<string, unknown>): ResolvedModuleAsset {
  const exportKeys = Object.keys(mod).sort();

  const named = mod.createAsset;
  if (typeof named === 'function') {
    return {
      createAsset: named as CreateAssetFn,
      exportKeys,
      via: 'createAsset',
    };
  }
  if (isObject3D(named)) {
    return {
      createAsset: () => named.clone(true),
      exportKeys,
      via: 'createAsset-object3d',
    };
  }

  const def = mod.default;
  if (typeof def === 'function') {
    return {
      createAsset: def as CreateAssetFn,
      exportKeys,
      via: 'default-function',
    };
  }
  if (isObject3D(def)) {
    return {
      createAsset: () => def.clone(true),
      exportKeys,
      via: 'default-object3d',
    };
  }

  throw new ModuleContractError(
    `Module is not a mesh file and does not export createAsset() / a default Object3D factory. ` +
      `Exports: ${exportKeys.length ? exportKeys.join(', ') : '(none)'}. ` +
      `Expected Polyfork-style: export function createAsset(params?) { return new THREE.Group(); }`,
    exportKeys,
  );
}

/**
 * Dynamic-import a user .mjs File as an ES module (blob URL after three-import rewrite).
 * SECURITY: this executes arbitrary JavaScript from the file.
 * Guardrails (scan + optional confirm) are best-effort — not a sandbox.
 */
export async function importModuleFile(
  file: File,
  urls: ThreeBareImportUrls = defaultThreeBareImportUrls(),
  opts?: {
    /** Pre-read source (skip second file.text). */
    sourceText?: string;
    /** When false, skip confirm (tests). Default true in browser. */
    confirm?: boolean;
    /**
     * Injected confirm; may be async (a dialog). Receives `formatMjsGuardMessage(...)`: first line is the
     * dialog title, the rest is the body (`parseMjsGuardMessage` splits it). Resolve true to load.
     * Defaults to window.confirm, with the deck's "Choose OK to load, or Cancel to stop." appended.
     */
    confirmFn?: (message: string) => boolean | Promise<boolean>;
    /** Injected scan (tests). */
    scan?: (source: string) => { ok: boolean; risks: string[]; looksLikeAssetModule: boolean };
    enabled?: boolean;
  },
): Promise<{
  mod: Record<string, unknown>;
  objectUrl: string;
  rewritten: boolean;
  scan: { ok: boolean; risks: string[]; looksLikeAssetModule: boolean };
}> {
  if (!isModuleFile(file) && !/\.mjs$/i.test(file.name)) {
    throw new Error('Select a .mjs ES module file');
  }
  const { isMjsLoadingEnabled, scanMjsSource, formatMjsGuardMessage, MJS_NATIVE_CONFIRM_HINT } = await import(
    './mjsGuardrails'
  );
  if (opts?.enabled === false || (opts?.enabled === undefined && !isMjsLoadingEnabled())) {
    throw new Error('MJS loading is disabled (Catalog 3D → enable trusted .mjs loads)');
  }
  const raw = opts?.sourceText ?? (await file.text());
  const scan = (opts?.scan ?? scanMjsSource)(raw);
  const needsConfirm = opts?.confirm !== false && typeof window !== 'undefined';
  if (needsConfirm) {
    const message = formatMjsGuardMessage(scan, file.name);
    // Awaited: a dialog-backed confirmFn returns a Promise, and an un-awaited Promise is always truthy.
    // Only an explicit `true` loads the file.
    const ok = opts?.confirmFn
      ? await opts.confirmFn(message)
      : window.confirm(`${message}\n\n${MJS_NATIVE_CONFIRM_HINT}`);
    if (ok !== true) throw new Error('MJS load cancelled by user');
  }
  const rewritten = /from\s+['"]three['"]|from\s+['"]three\/addons\//.test(raw);
  const source = rewritten ? rewriteThreeBareImports(raw, urls) : raw;
  const objectUrl = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
  try {
    const mod = (await import(/* @vite-ignore */ objectUrl)) as Record<string, unknown>;
    return { mod, objectUrl, rewritten, scan };
  } catch (err) {
    URL.revokeObjectURL(objectUrl);
    throw err;
  }
}

/** Session registry: product id → factory (needed for dispose & remount). */
const moduleFactories = new Map<string, CreateAssetFn>();

export function registerModuleFactory(productId: string, createAsset: CreateAssetFn): void {
  moduleFactories.set(productId, createAsset);
}

export function getModuleFactory(productId: string): CreateAssetFn | undefined {
  return moduleFactories.get(productId);
}

export function unregisterModuleFactory(productId: string): void {
  moduleFactories.delete(productId);
}

/**
 * Build a temporary catalog Product for a createAsset module.
 * Materials stay embedded (preserveMaterials) — Polyfork assets bake vertex colors.
 */
export function createProductFromModuleAsset(
  fileName: string,
  resolved: ResolvedModuleAsset,
  opts: { defaultMaterialId: string },
): Product {
  const id = `module-${Date.now().toString(36)}`;
  const base = fileName.replace(/\.mjs$/i, '');
  const slots: SlotDefinition[] = [
    {
      id: 'surface',
      label: 'Surface (module keeps own materials)',
      allowedCategories: [...UPLOAD_SLOT_CATEGORIES],
      default: opts.defaultMaterialId,
    },
  ];

  registerModuleFactory(id, resolved.createAsset);

  return {
    id,
    sku: `STUB-SKU-MODULE-${id.toUpperCase()}`,
    name: base,
    glb: `module://${id}`,
    slotTagging: `mjs-module (${resolved.via})`,
    slots,
    fallbackSlotId: 'surface',
    userAdded: true,
    sourceKind: 'mjs-module',
    preserveMaterials: true,
  };
}
