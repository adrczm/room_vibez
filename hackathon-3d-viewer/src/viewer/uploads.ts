/**
 * Session upload helpers for catalog meshes (GLB/glTF/OBJ) and library textures.
 * Persistence is Object URLs only — no server write, no Draco farm.
 */
import { LoadingManager, type Mesh, type Object3D } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

import {
  createProductFromObjPackage,
  isMtlFile,
  isObjFile,
  isObjSidecarFile,
  type ObjImportResult,
} from './objImport';
import { discoverSlots } from './slots';
import type { LibraryMaterial, MaterialCategory, Product, SlotDefinition } from './types';

export {
  createProductFromObjPackage,
  isMtlFile,
  isObjCompanionTexture,
  isObjFile,
  isObjSidecarFile,
  slotIdFromLabel,
  explodeMultiMaterialMeshes,
  type ObjImportResult,
  type ObjImportWarnings,
} from './objImport';

/** Categories available for user-uploaded models (broad so library swatches apply). */
export const UPLOAD_SLOT_CATEGORIES: MaterialCategory[] = ['wood', 'plastic', 'textile', 'stone', 'metal'];

export type TextureMapRole = 'map' | 'normalMap' | 'roughnessMap';

const MODEL_EXT = /\.(glb|gltf)$/i;
const TEXTURE_EXT = /\.(png|jpe?g|webp)$/i;

export function isModelFile(file: File): boolean {
  return MODEL_EXT.test(file.name) || /model\/gltf/i.test(file.type);
}

/** True for any mesh package the “Add 3D model” control accepts. */
export function isMeshUploadFile(file: File): boolean {
  return isModelFile(file) || isObjFile(file) || isMtlFile(file) || isObjSidecarFile(file);
}

export function isTextureFile(file: File): boolean {
  return TEXTURE_EXT.test(file.name) || /^image\/(png|jpeg|webp)$/i.test(file.type);
}

function labelFromId(id: string): string {
  return id
    .split(/[-_]/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function disposeParsedScene(root: Object3D): void {
  root.traverse((o) => {
    const mesh = o as Mesh;
    if (!mesh.isMesh) return;
    mesh.geometry?.dispose();
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const m of mats) m?.dispose();
  });
}

function basename(url: string): string {
  return decodeURIComponent(url.split(/[/?#]/).pop() ?? url);
}

export type ModelUploadResult = {
  product: Product;
  sessionUrls: string[];
  materials?: LibraryMaterial[];
  warnings?: ObjImportResult['warnings'];
};

/**
 * Build a temporary catalog Product from uploaded mesh files.
 * Supports .glb / .gltf (+ companions) and OBJ (+ MTL + textures + optional .slots.json).
 * Discovers material_slot_id tags; untagged meshes fall back to a `surface` slot.
 */
export async function createProductFromModelFiles(
  files: FileList | File[],
  opts: { defaultMaterialId: string },
): Promise<ModelUploadResult> {
  const list = [...files];
  if (!list.length) throw new Error('No files selected');

  const objs = list.filter(isObjFile);
  const models = list.filter(isModelFile);

  if (objs.length && models.length) {
    throw new Error('Upload either an OBJ package or a GLB/glTF — not both at once');
  }

  if (objs.length) {
    return createProductFromObjPackage(list, opts);
  }

  const glb = models.find((f) => /\.glb$/i.test(f.name));
  const gltf = models.find((f) => /\.gltf$/i.test(f.name));
  if (!glb && !gltf) {
    throw new Error(
      'Select a .glb, .gltf, or .obj file (include .mtl + textures with OBJ when available)',
    );
  }

  const sessionUrls: string[] = [];
  const resourceMap: Record<string, string> = {};
  for (const f of list) {
    const url = URL.createObjectURL(f);
    sessionUrls.push(url);
    resourceMap[f.name] = url;
  }

  const mainFile = glb ?? gltf!;
  const mainUrl = resourceMap[mainFile.name];

  const manager = new LoadingManager();
  manager.setURLModifier((url) => resourceMap[basename(url)] ?? url);

  let parsed;
  try {
    parsed = await new GLTFLoader(manager).loadAsync(mainUrl);
  } catch (err) {
    for (const u of sessionUrls) URL.revokeObjectURL(u);
    throw new Error(`Could not load model (${mainFile.name}): ${(err as Error).message}`);
  }

  const discovered = discoverSlots(parsed.scene);
  disposeParsedScene(parsed.scene);

  const slots: SlotDefinition[] = [];
  for (const id of discovered.slots.keys()) {
    slots.push({
      id,
      label: labelFromId(id),
      allowedCategories: [...UPLOAD_SLOT_CATEGORIES],
      default: opts.defaultMaterialId,
    });
  }

  let fallbackSlotId: string | undefined;
  if (discovered.untagged.length > 0 || slots.length === 0) {
    fallbackSlotId = 'surface';
    if (!slots.some((s) => s.id === 'surface')) {
      slots.push({
        id: 'surface',
        label: 'Surface',
        allowedCategories: [...UPLOAD_SLOT_CATEGORIES],
        default: opts.defaultMaterialId,
      });
    }
  }

  const id = `upload-${Date.now().toString(36)}`;
  const product: Product = {
    id,
    sku: `STUB-SKU-UPLOAD-${id.toUpperCase()}`,
    name: mainFile.name.replace(/\.(glb|gltf)$/i, ''),
    glb: mainUrl,
    slotTagging: discovered.slots.size
      ? `upload-detected (${[...discovered.slots.keys()].join(', ')})`
      : 'upload-fallback-surface',
    slots,
    fallbackSlotId,
    resourceMap: gltf ? resourceMap : undefined,
    userAdded: true,
  };

  return { product, sessionUrls };
}

/** Create a new library material whose baseColor map is the uploaded image. */
export function createMaterialFromTexture(
  file: File,
  opts: {
    name?: string;
    category: MaterialCategory;
    color?: string;
    roughness?: number;
    metalness?: number;
    repeat?: [number, number];
  },
): { material: LibraryMaterial; objectUrl: string } {
  if (!isTextureFile(file)) throw new Error('Texture must be PNG, JPEG, or WebP');
  const objectUrl = URL.createObjectURL(file);
  const id = `user-${Date.now().toString(36)}`;
  const baseName = file.name.replace(/\.(png|jpe?g|webp)$/i, '');
  return {
    objectUrl,
    material: {
      id,
      name: (opts.name?.trim() || baseName).slice(0, 64),
      category: opts.category,
      sku: `STUB-MAT-USER-${id.toUpperCase()}`,
      color: opts.color ?? '#ffffff',
      roughness: opts.roughness ?? 0.6,
      metalness: opts.metalness ?? 0,
      map: objectUrl,
      repeat: opts.repeat ?? [1, 1],
    },
  };
}

/** Attach an uploaded image to an existing library material as map / normalMap / roughnessMap. */
export function attachTextureToMaterial(
  material: LibraryMaterial,
  file: File,
  role: TextureMapRole,
): { objectUrl: string } {
  if (!isTextureFile(file)) throw new Error('Texture must be PNG, JPEG, or WebP');
  const objectUrl = URL.createObjectURL(file);
  material[role] = objectUrl;
  return { objectUrl };
}
