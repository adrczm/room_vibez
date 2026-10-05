/**
 * OBJ (+ MTL + texture maps + optional sidecar) → session GLB-equivalent Product.
 *
 * Honest pipeline (see Room Vibez docs/obj-dwg-auto-glb-mjs-feasibility.md):
 *   - Load OBJ/MTL in-browser (Three.js OBJLoader / MTLLoader)
 *   - Slots from usemtl / named groups (+ optional sidecar JSON)
 *   - MTL → best-effort PBR library materials (hint, not SoR forever — swatches replace)
 *   - Export session GLB via GLTFExporter so Catalog 3D uses the same slot/material UX
 *   - Does NOT invent Polyfork createAsset MJS from OBJ
 */
import {
  Color,
  DoubleSide,
  Group,
  LoadingManager,
  Mesh,
  MeshPhongMaterial,
  MeshStandardMaterial,
  type Material,
  type Object3D,
  type Texture,
} from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';

import { ensureMeshNormals, meshesMissingUv } from './slots';
import type { LibraryMaterial, MaterialCategory, Product, SlotDefinition } from './types';

/** Same broad categories as session GLB uploads (see uploads.ts). */
const OBJ_SLOT_CATEGORIES: MaterialCategory[] = ['wood', 'plastic', 'textile', 'stone', 'metal'];

const OBJ_EXT = /\.obj$/i;
const MTL_EXT = /\.mtl$/i;
const SIDECAR_EXT = /\.slots\.json$/i;
const TEXTURE_EXT = /\.(png|jpe?g|webp|bmp|tga)$/i;

export interface ObjImportWarnings {
  missingMtl: boolean;
  mtlLoadFailed?: string;
  missingTextures: string[];
  meshesWithoutUv: string[];
  meshesNormalsComputed: string[];
  noNamedMaterials: boolean;
  notes: string[];
}

export interface ObjImportResult {
  product: Product;
  sessionUrls: string[];
  /** MTL-derived library materials used as slot defaults (session only). */
  materials: LibraryMaterial[];
  warnings: ObjImportWarnings;
}

export function isObjFile(file: File): boolean {
  return OBJ_EXT.test(file.name) || /model\/obj/i.test(file.type);
}

export function isMtlFile(file: File): boolean {
  return MTL_EXT.test(file.name);
}

export function isObjSidecarFile(file: File): boolean {
  return SIDECAR_EXT.test(file.name);
}

export function isObjCompanionTexture(file: File): boolean {
  return TEXTURE_EXT.test(file.name);
}

/** Slug suitable for material_slot_id / catalog slot id. */
export function slotIdFromLabel(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'surface';
}

function labelFromId(id: string): string {
  return id
    .split(/[-_]/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function basename(url: string): string {
  const cleaned = decodeURIComponent(url.replace(/\\/g, '/').split(/[?#]/)[0] ?? url);
  return cleaned.split('/').pop() ?? cleaned;
}

function buildResourceMap(files: File[]): { resourceMap: Record<string, string>; sessionUrls: string[] } {
  const resourceMap: Record<string, string> = {};
  const sessionUrls: string[] = [];
  for (const f of files) {
    const url = URL.createObjectURL(f);
    sessionUrls.push(url);
    resourceMap[f.name] = url;
    resourceMap[f.name.replace(/\\/g, '/')] = url;
    // Case-insensitive lookup key
    resourceMap[f.name.toLowerCase()] = url;
  }
  return { resourceMap, sessionUrls };
}

function resolveResource(url: string, resourceMap: Record<string, string>): string {
  const name = basename(url);
  if (resourceMap[name]) return resourceMap[name];
  if (resourceMap[name.toLowerCase()]) return resourceMap[name.toLowerCase()];
  // Match by suffix (MTL often uses Texture\sub\file.jpg)
  const lower = name.toLowerCase();
  for (const [key, value] of Object.entries(resourceMap)) {
    if (key.toLowerCase() === lower || key.toLowerCase().endsWith('/' + lower)) return value;
  }
  return url;
}

function disposeObject(root: Object3D): void {
  root.traverse((o) => {
    const mesh = o as Mesh;
    if (!mesh.isMesh) return;
    mesh.geometry?.dispose();
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const m of mats) {
      if (!m) continue;
      for (const key of Object.keys(m) as (keyof Material)[]) {
        const v = m[key];
        if (v && typeof v === 'object' && 'isTexture' in (v as object) && (v as Texture).isTexture) {
          (v as Texture).dispose();
        }
      }
      m.dispose();
    }
  });
}

/** Split multi-material OBJ meshes so each usemtl becomes its own mesh (one slot binding). */
export function explodeMultiMaterialMeshes(root: Object3D): void {
  const jobs: { mesh: Mesh; replacements: Mesh[] }[] = [];
  root.traverse((obj) => {
    const mesh = obj as Mesh;
    if (!mesh.isMesh) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : null;
    if (!mats || mats.length <= 1) return;
    const geo = mesh.geometry;
    const groups = geo.groups?.length
      ? geo.groups
      : [{ start: 0, count: geo.index ? geo.index.count : geo.attributes.position.count, materialIndex: 0 }];
    const replacements: Mesh[] = [];
    for (const g of groups) {
      const matIndex = g.materialIndex ?? 0;
      const mat = mats[matIndex] ?? mats[0];
      const piece = geo.clone();
      if (geo.index) {
        const src = geo.index.array;
        const sliced = Array.from(src).slice(g.start, g.start + g.count);
        piece.setIndex(sliced);
      }
      piece.clearGroups();
      const child = new Mesh(piece, mat);
      child.name = mesh.name;
      child.position.copy(mesh.position);
      child.quaternion.copy(mesh.quaternion);
      child.scale.copy(mesh.scale);
      replacements.push(child);
    }
    if (replacements.length) jobs.push({ mesh, replacements });
  });

  for (const { mesh, replacements } of jobs) {
    const parent = mesh.parent;
    if (!parent) continue;
    parent.remove(mesh);
    mesh.geometry?.dispose();
    for (const child of replacements) parent.add(child);
  }
}

function materialNameOf(mesh: Mesh): string | null {
  const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  for (const m of mats) {
    if (m?.name && !/^material(_\d+)?$/i.test(m.name) && m.name !== '') return m.name;
  }
  return null;
}

function inferCategory(mtlName: string, metalness: number): MaterialCategory {
  const n = mtlName.toLowerCase();
  if (/metal|aluminium|aluminum|steel|chrome|iron|brass|gold|copper/.test(n) || metalness > 0.5) return 'metal';
  if (/wood|oak|walnut|teak|veneer|meja|lemari/.test(n)) return 'wood';
  if (/fabric|textile|cloth|carpet|cushion|cusion|sofa|pillow|rug/.test(n)) return 'textile';
  if (/stone|marble|concrete|tile|tegel|floor|wall|roof/.test(n)) return 'stone';
  if (/plastic|rubber|vinyl/.test(n)) return 'plastic';
  return 'plastic';
}

function textureImageSrc(tex: Texture | null | undefined): string | undefined {
  if (!tex) return undefined;
  const img = tex.image as unknown;
  if (typeof img === 'string' && img.length) return img;
  if (img && typeof img === 'object' && 'src' in img && typeof (img as { src: unknown }).src === 'string') {
    return (img as { src: string }).src;
  }
  return undefined;
}

function phongToLibraryMaterial(
  mat: MeshPhongMaterial | MeshStandardMaterial,
  opts: { idPrefix: string },
): LibraryMaterial {
  const name = mat.name || 'Surface';
  const id = `${opts.idPrefix}-${slotIdFromLabel(name)}`;
  let color = '#cccccc';
  let roughness = 0.6;
  let metalness = 0;
  let map: string | undefined;

  if ((mat as MeshStandardMaterial).isMeshStandardMaterial) {
    const s = mat as MeshStandardMaterial;
    color = '#' + s.color.getHexString();
    roughness = s.roughness;
    metalness = s.metalness;
    map = textureImageSrc(s.map);
  } else {
    const p = mat as MeshPhongMaterial;
    color = '#' + p.color.getHexString();
    // Ns-like shininess → rough PBR guess
    const shiny = typeof p.shininess === 'number' ? p.shininess : 30;
    roughness = Math.min(1, Math.max(0.05, 1 - shiny / 1000));
    metalness = p.specular && p.specular.r + p.specular.g + p.specular.b > 1.2 ? 0.6 : 0;
    map = textureImageSrc(p.map);
  }

  return {
    id,
    name: labelFromId(slotIdFromLabel(name)) || name,
    category: inferCategory(name, metalness),
    sku: `STUB-MAT-OBJ-${id.toUpperCase()}`,
    color,
    roughness,
    metalness,
    map,
    repeat: [1, 1],
  };
}

async function parseSidecar(file: File | undefined): Promise<Record<string, string> | undefined> {
  if (!file) return undefined;
  try {
    const text = await file.text();
    const data = JSON.parse(text) as unknown;
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      throw new Error('Sidecar must be a JSON object of name → material_slot_id');
    }
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(data as Record<string, unknown>)) {
      if (typeof v === 'string' && v.trim()) out[k] = v.trim();
    }
    return out;
  } catch (err) {
    throw new Error(`Invalid sidecar JSON (${file.name}): ${(err as Error).message}`);
  }
}

function tagSlotsFromObj(
  root: Object3D,
  sidecar: Record<string, string> | undefined,
): { slotIds: Set<string>; meshSlot: Map<Mesh, string>; noNamed: boolean } {
  const slotIds = new Set<string>();
  const meshSlot = new Map<Mesh, string>();
  let named = 0;

  root.traverse((obj) => {
    const mesh = obj as Mesh;
    if (!mesh.isMesh) return;

    let slotId: string | undefined;

    // Sidecar by mesh / object name first
    if (sidecar) {
      if (mesh.name && sidecar[mesh.name]) slotId = sidecar[mesh.name];
      else if (mesh.parent?.name && sidecar[mesh.parent.name]) slotId = sidecar[mesh.parent.name];
    }

    const matName = materialNameOf(mesh);
    if (!slotId && matName && sidecar?.[matName]) slotId = sidecar[matName];
    if (!slotId && matName) {
      slotId = slotIdFromLabel(matName);
      named++;
    }
    if (!slotId && mesh.name) {
      // Fallback: object/group name (o/g)
      const fromName = slotIdFromLabel(mesh.name.replace(/\.[0-9]+$/, ''));
      if (fromName !== 'surface') {
        slotId = fromName;
        named++;
      }
    }

    if (!slotId) return;

    mesh.userData.material_slot_id = slotId;
    // Name convention so discoverSlots also sees `name` source if extras drop on round-trip
    if (!/^slot_/i.test(mesh.name)) {
      mesh.name = `slot_${slotId}__${mesh.name || 'part'}`;
    }
    slotIds.add(slotId);
    meshSlot.set(mesh, slotId);
  });

  return { slotIds, meshSlot, noNamed: named === 0 };
}

/** Minimal FileReader so GLTFExporter can run under Vitest/Node (browser has a real one). */
function ensureFileReaderPolyfill(): void {
  if (typeof globalThis.FileReader !== 'undefined') return;
  class FileReaderStub {
    result: string | ArrayBuffer | null = null;
    onloadend: ((this: FileReader, ev: ProgressEvent<FileReader>) => void) | null = null;
    onerror: ((this: FileReader, ev: ProgressEvent<FileReader>) => void) | null = null;
    readAsDataURL(blob: Blob) {
      void this.readBlob(blob, 'dataurl');
    }
    readAsArrayBuffer(blob: Blob) {
      void this.readBlob(blob, 'buffer');
    }
    private async readBlob(blob: Blob, mode: 'dataurl' | 'buffer') {
      try {
        const buf = await blob.arrayBuffer();
        if (mode === 'buffer') {
          this.result = buf;
        } else {
          const bytes = new Uint8Array(buf);
          let bin = '';
          for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!);
          this.result = `data:application/octet-stream;base64,${btoa(bin)}`;
        }
      } catch {
        this.result = mode === 'buffer' ? new ArrayBuffer(0) : 'data:application/octet-stream;base64,';
      }
      this.onloadend?.call(this as unknown as FileReader, {} as ProgressEvent<FileReader>);
    }
  }
  (globalThis as unknown as { FileReader: unknown }).FileReader = FileReaderStub;
}

async function exportToGlb(root: Object3D): Promise<ArrayBuffer> {
  ensureFileReaderPolyfill();
  const exporter = new GLTFExporter();
  const result = await exporter.parseAsync(root, { binary: true });
  if (result instanceof ArrayBuffer) return result;
  // JSON glTF fallback — shouldn't happen with binary:true
  const json = JSON.stringify(result);
  return new TextEncoder().encode(json).buffer;
}

/**
 * Build a catalog Product from an OBJ package (OBJ + optional MTL/textures/sidecar).
 * Converts to a session GLB so RoomVibezViewer loadProduct path is unchanged.
 */
export async function createProductFromObjPackage(
  files: FileList | File[],
  opts: { defaultMaterialId: string },
): Promise<ObjImportResult> {
  const list = [...files];
  const objs = list.filter(isObjFile);
  if (objs.length === 0) throw new Error('No .obj file in selection');
  if (objs.length > 1) throw new Error('Select one .obj file (plus its .mtl / textures / .slots.json)');

  const objFile = objs[0];
  const mtlFile = list.find(isMtlFile);
  const sidecarFile = list.find(isObjSidecarFile);
  // Also accept basename.json that is a plain string map (optional)
  const looseJson = list.find(
    (f) => /\.json$/i.test(f.name) && !isObjSidecarFile(f) && f.name.replace(/\.json$/i, '') === objFile.name.replace(/\.obj$/i, ''),
  );

  const warnings: ObjImportWarnings = {
    missingMtl: !mtlFile,
    missingTextures: [],
    meshesWithoutUv: [],
    meshesNormalsComputed: [],
    noNamedMaterials: false,
    notes: [],
  };

  const { resourceMap, sessionUrls } = buildResourceMap(list);
  const sidecar = await parseSidecar(sidecarFile ?? looseJson);

  let pendingLoads = 0;
  let settleLoad!: () => void;
  const texturesReady = new Promise<void>((resolve) => {
    settleLoad = resolve;
  });

  const manager = new LoadingManager();
  manager.onStart = () => {
    pendingLoads++;
  };
  manager.onLoad = () => {
    settleLoad();
  };
  manager.onError = (url) => {
    const name = basename(url);
    if (TEXTURE_EXT.test(url) && !warnings.missingTextures.includes(name)) {
      warnings.missingTextures.push(name);
    }
  };
  manager.setURLModifier((url) => {
    const resolved = resolveResource(url, resourceMap);
    if (resolved === url && TEXTURE_EXT.test(basename(url))) {
      const name = basename(url);
      if (!warnings.missingTextures.includes(name)) warnings.missingTextures.push(name);
    }
    return resolved;
  });

  let materialsCreator: ReturnType<MTLLoader['parse']> | undefined;
  if (mtlFile) {
    try {
      const mtlText = await mtlFile.text();
      const mtlLoader = new MTLLoader(manager);
      mtlLoader.setMaterialOptions({ side: DoubleSide });
      materialsCreator = mtlLoader.parse(mtlText, '');
      materialsCreator.preload();
    } catch (err) {
      warnings.mtlLoadFailed = String((err as Error)?.message ?? err);
      warnings.notes.push(`MTL failed to parse — loading geometry without materials (${warnings.mtlLoadFailed})`);
      materialsCreator = undefined;
    }
  } else {
    warnings.notes.push('No .mtl in selection — geometry loads with default materials; slots from object names or surface fallback');
  }

  const objLoader = new OBJLoader(manager);
  if (materialsCreator) objLoader.setMaterials(materialsCreator);

  let root: Group;
  try {
    const objText = await objFile.text();
    if (!objText.trim()) throw new Error('OBJ file is empty');
    root = objLoader.parse(objText);
  } catch (err) {
    for (const u of sessionUrls) URL.revokeObjectURL(u);
    throw new Error(`Could not parse OBJ (${objFile.name}): ${(err as Error).message}`);
  }

  // MTL map_* loads are async via LoadingManager — wait so GLB export embeds textures.
  if (pendingLoads > 0) {
    await Promise.race([
      texturesReady,
      new Promise<void>((resolve) => setTimeout(resolve, 8000)),
    ]);
  }

  let meshCount = 0;
  root.traverse((o) => {
    if ((o as Mesh).isMesh) meshCount++;
  });
  if (meshCount === 0) {
    disposeObject(root);
    for (const u of sessionUrls) URL.revokeObjectURL(u);
    throw new Error(`OBJ has no meshes: ${objFile.name}`);
  }

  explodeMultiMaterialMeshes(root);
  warnings.meshesNormalsComputed = ensureMeshNormals(root);
  warnings.meshesWithoutUv = meshesMissingUv(root);
  if (warnings.meshesWithoutUv.length) {
    warnings.notes.push(
      `Meshes without UVs — textured library materials will look flat: ${warnings.meshesWithoutUv.slice(0, 8).join(', ')}${warnings.meshesWithoutUv.length > 8 ? '…' : ''}`,
    );
  }
  if (warnings.missingTextures.length) {
    warnings.notes.push(
      `MTL references missing textures (not in upload): ${warnings.missingTextures.slice(0, 8).join(', ')}${warnings.missingTextures.length > 8 ? '…' : ''}`,
    );
  }

  const { slotIds, meshSlot, noNamed } = tagSlotsFromObj(root, sidecar);
  warnings.noNamedMaterials = noNamed && !sidecar;

  const materials: LibraryMaterial[] = [];
  const slotDefault = new Map<string, string>();
  const idPrefix = `obj-${Date.now().toString(36)}`;
  const seenMat = new Map<string, LibraryMaterial>();

  for (const [mesh, slotId] of meshSlot) {
    if (slotDefault.has(slotId)) continue;
    const mat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
    if (mat && ((mat as MeshPhongMaterial).isMeshPhongMaterial || (mat as MeshStandardMaterial).isMeshStandardMaterial)) {
      const key = mat.name || slotId;
      let lib = seenMat.get(key);
      if (!lib) {
        lib = phongToLibraryMaterial(mat as MeshPhongMaterial, { idPrefix });
        // Prefer Object URL from the upload map when MTL referenced a file by basename
        if (!lib.map && materialsCreator && mat.name) {
          const info = (materialsCreator as unknown as { materialsInfo?: Record<string, { map_kd?: string }> })
            .materialsInfo;
          const entry = info?.[mat.name.toLowerCase()] ?? info?.[mat.name];
          const mapKd = entry?.map_kd;
          if (mapKd) {
            const resolved = resolveResource(mapKd, resourceMap);
            if (resolved !== mapKd) lib.map = resolved;
          }
        }
        if (materials.some((m) => m.id === lib!.id)) lib.id = `${lib.id}-${materials.length}`;
        seenMat.set(key, lib);
        materials.push(lib);
      }
      slotDefault.set(slotId, lib.id);
    } else {
      slotDefault.set(slotId, opts.defaultMaterialId);
    }
  }

  const slots: SlotDefinition[] = [];
  for (const id of slotIds) {
    slots.push({
      id,
      label: labelFromId(id),
      allowedCategories: [...OBJ_SLOT_CATEGORIES],
      default: slotDefault.get(id) ?? opts.defaultMaterialId,
    });
  }

  let fallbackSlotId: string | undefined;
  if (slots.length === 0) {
    fallbackSlotId = 'surface';
    slots.push({
      id: 'surface',
      label: 'Surface',
      allowedCategories: [...OBJ_SLOT_CATEGORIES],
      default: opts.defaultMaterialId,
    });
    warnings.notes.push('No usemtl / named groups / sidecar — bound whole model to surface slot');
  } else if (warnings.noNamedMaterials && sidecar) {
    warnings.notes.push(`Slots from sidecar only (${slots.length})`);
  } else {
    warnings.notes.push(`Slots from usemtl/groups${sidecar ? ' + sidecar' : ''}: ${[...slotIds].slice(0, 12).join(', ')}${slotIds.size > 12 ? '…' : ''}`);
  }

  // Placeholder PBR materials for GLB export (color only). Texture maps stay on library
  // materials (SoR) — avoids GLTFExporter FileReader dependency and keeps maps swappable.
  root.traverse((o) => {
    const mesh = o as Mesh;
    if (!mesh.isMesh) return;
    const convert = (m: Material): Material => {
      const name = m.name || 'placeholder';
      let color = new Color(0xcccccc);
      let roughness = 0.6;
      let metalness = 0;
      if ((m as MeshPhongMaterial).isMeshPhongMaterial) {
        const p = m as MeshPhongMaterial;
        color = p.color.clone();
        roughness = Math.min(1, Math.max(0.05, 1 - (p.shininess ?? 30) / 1000));
        metalness = p.specular && p.specular.r + p.specular.g + p.specular.b > 1.2 ? 0.55 : 0;
      } else if ((m as MeshStandardMaterial).isMeshStandardMaterial) {
        const s = m as MeshStandardMaterial;
        color = s.color.clone();
        roughness = s.roughness;
        metalness = s.metalness;
      }
      const slotId = typeof mesh.userData.material_slot_id === 'string' ? mesh.userData.material_slot_id : undefined;
      const s = new MeshStandardMaterial({
        name,
        color,
        roughness,
        metalness,
        side: DoubleSide,
      });
      s.userData = { ...m.userData };
      if (slotId) s.userData.material_slot_id = slotId;
      return s;
    };
    if (Array.isArray(mesh.material)) mesh.material = mesh.material.map(convert);
    else mesh.material = convert(mesh.material);
  });

  let glbBuffer: ArrayBuffer;
  try {
    glbBuffer = await exportToGlb(root);
  } catch (err) {
    disposeObject(root);
    for (const u of sessionUrls) URL.revokeObjectURL(u);
    throw new Error(`OBJ→GLB export failed: ${(err as Error).message}`);
  }
  disposeObject(root);

  const glbBlob = new Blob([glbBuffer], { type: 'model/gltf-binary' });
  const glbUrl = URL.createObjectURL(glbBlob);
  sessionUrls.push(glbUrl);

  const id = `upload-obj-${Date.now().toString(36)}`;
  const product: Product = {
    id,
    sku: `STUB-SKU-OBJ-${id.toUpperCase()}`,
    name: objFile.name.replace(/\.obj$/i, ''),
    glb: glbUrl,
    slotTagging: slots.some((s) => s.id !== 'surface')
      ? `obj-usemtl (${slots.map((s) => s.id).join(', ')})`
      : 'obj-fallback-surface',
    slots,
    fallbackSlotId,
    sidecar,
    userAdded: true,
  };

  return { product, sessionUrls, materials, warnings };
}
