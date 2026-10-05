// Data contracts shared by the viewer engine and the host UI.
// These mirror (in miniature) the owned DB tables: materials, SKU/product, material_slot.

export type MaterialCategory = 'wood' | 'plastic' | 'textile' | 'stone' | 'metal' | (string & {});

/** One row of the materials library (stand-in for the Materials DB). */
export interface LibraryMaterial {
  id: string;
  name: string;
  category: MaterialCategory;
  /** STUB identifier — the real value comes from the owned SKU/BOM system. */
  sku: string;
  /** sRGB hex; multiplies `map` when both are present. */
  color: string;
  roughness: number;
  metalness: number;
  /** baseColor texture (PNG/JPEG), sRGB. */
  map?: string;
  normalMap?: string;
  roughnessMap?: string;
  repeat?: [number, number];
}

export interface MaterialsLibrary {
  version: number;
  materials: LibraryMaterial[];
}

/** Catalog-side definition of a slot. The GLB only carries the slot id; label/rules live here. */
export interface SlotDefinition {
  id: string;
  label: string;
  allowedCategories: MaterialCategory[];
  default: string;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  glb: string;
  /** Informational: how the asset was tagged by the conversion step. */
  slotTagging?: string;
  slots: SlotDefinition[];
  /**
   * Optional sidecar mapping mesh/node / MTL name → material_slot_id.
   * Used by OBJ packages (`*.slots.json`) and any future farm tagging.
   */
  sidecar?: Record<string, string>;
  /**
   * When set, meshes with no resolvable slot id bind to this catalog slot.
   * Used for session uploads that lack conversion-farm tagging.
   */
  fallbackSlotId?: string;
  /**
   * Session-only: basename → Object URL for multi-file glTF (.gltf + .bin + textures).
   * Not used for self-contained .glb.
   */
  resourceMap?: Record<string, string>;
  /** True for products added via the host upload UI (session Object URLs). */
  userAdded?: boolean;
  /**
   * How the mesh is obtained at load time.
   * - `glb` (default): `GLTFLoader` on `product.glb`
   * - `mjs-module`: call registered `createAsset()` from a dynamic `.mjs` import
   */
  sourceKind?: 'glb' | 'mjs-module';
  /**
   * When true, keep materials shipped by the asset (e.g. Polyfork vertex colors).
   * Library slot swatches are shown but do not replace embedded materials.
   */
  preserveMaterials?: boolean;
  /**
   * Optional GLB+MJS pack metadata (Polyfork-style). Present when loaded via pack workflow.
   * Mapping mode / unknown keys are observational — slot ids are never invented.
   */
  pack?: {
    hasMjs: boolean;
    hasGlb: boolean;
    completeness: 'complete' | 'mjs-only' | 'glb-only';
    mappingMode: 'slots' | 'vertex-colors' | 'unknown';
    exportKeys: string[];
    materialKeys: string[];
    mappedKeys: string[];
    unknownKeys: string[];
    notes: string[];
    paramKeys: string[];
  };
}

export interface Catalog {
  version: number;
  products: Product[];
}

/** How a mesh's slot id was resolved. Order of precedence: extras → sidecar → name; uploads may use fallback. */
export type SlotSource = 'extras' | 'sidecar' | 'name' | 'fallback';

export interface PartsListEntry {
  slotId: string;
  slotLabel: string;
  materialId: string;
  materialName: string;
  materialSku: string;
  meshCount: number;
}

/** Rubens-like `onPartListUpdate` payload. Explicitly a stub — no prices, no ERP. */
export interface PartsList {
  stub: true;
  productId: string;
  productSku: string;
  parts: PartsListEntry[];
  generatedAt: string;
}

export interface SlotState {
  def: SlotDefinition;
  materialId: string;
  meshCount: number;
  sources: SlotSource[];
}

export interface SlotReport {
  /** Slots present in both catalog and GLB. */
  bound: SlotState[];
  /** Slot ids found in the GLB but not defined in the catalog (shown, but not bindable). */
  unknownInModel: string[];
  /** Catalog slots with no meshes in the GLB. */
  missingInModel: string[];
  /** Meshes with no resolvable slot id (keep their embedded placeholder). */
  untaggedMeshes: string[];
  /** Meshes missing UVs — library baseColor/normal maps will not display correctly. */
  meshesWithoutUv?: string[];
  /** Meshes that had no normals; engine computed them so MeshStandardMaterial can light. */
  meshesNormalsComputed?: string[];
}