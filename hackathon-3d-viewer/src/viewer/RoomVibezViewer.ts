import {
  AmbientLight,
  Box3,
  Color,
  DirectionalLight,
  Group,
  HemisphereLight,
  Light,
  LoadingManager,
  Material,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  PCFSoftShadowMap,
  PerspectiveCamera,
  PlaneGeometry,
  PMREMGenerator,
  Raycaster,
  RepeatWrapping,
  Scene,
  ShadowMaterial,
  SRGBColorSpace,
  Texture,
  TextureLoader,
  Vector2,
  Vector3,
  WebGLRenderer,
  ACESFilmicToneMapping,
  type WebGLRenderTarget,
} from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

import { buildPartsList, findMaterial } from './library';
import { getModuleFactory } from './modules';
import { findPreset, LIGHT_PRESETS, type LightPreset } from './presets';
import {
  openingOffsetFromHit,
  roomBounds,
  type OpeningType,
  type RoomGraph,
} from './roomGraph';
import { buildRoomScene, type BuiltRoomScene, type RoomMeshMaterials } from './roomMesh';
import { bindUntaggedToFallback, discoverSlots, ensureMeshNormals, meshesMissingUv } from './slots';
import type { LibraryMaterial, MaterialsLibrary, PartsList, Product, SlotReport, SlotState } from './types';

export type ViewerStatus = 'idle' | 'loading' | 'ready' | 'error' | 'disposed';

/** Host interaction mode. `catalog` keeps turntable product spin; room modes use orbit + raycasts. */
export type InteractionMode = 'catalog' | 'room' | 'opening' | 'place' | 'draw-wall';

export interface RoomPointerHit {
  kind: 'wall' | 'floor';
  wallId?: string;
  /** Suggested opening start offset along wall (meters), for opening mode. */
  offsetAlongWall?: number;
  point: { x: number; y: number; z: number };
}

export interface ViewerOptions {
  library: MaterialsLibrary;
  initialPreset?: string;
  /** Rubens-like commerce hook: fired after load and after every material change. */
  onPartListUpdate?: (parts: PartsList) => void;
  onSlotsDiscovered?: (report: SlotReport) => void;
  onStatus?: (status: ViewerStatus, detail?: string) => void;
  /** Fired on primary click in room / opening / place modes (after drag threshold). */
  onRoomPointer?: (hit: RoomPointerHit | null, mode: InteractionMode) => void;
}

/**
 * Owned Three.js catalog viewer. The engine owns the canvas; the host owns all UI.
 * Lifecycle: `new` → `loadProduct()` (any number of times) → `dispose()`.
 */
export class RoomVibezViewer {
  readonly canvas: HTMLCanvasElement;
  private readonly host: HTMLElement;
  private readonly opts: ViewerOptions;
  private readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(40, 1, 0.01, 100);
  private readonly controls: OrbitControls;
  private readonly pmrem: PMREMGenerator;
  private envTarget: WebGLRenderTarget | null = null;
  /** Rotates the product only. Lights / ground / camera stay scene-fixed. */
  private readonly turntable = new Object3D();
  private readonly presetRig = new Object3D();
  private readonly ground: Mesh<PlaneGeometry, ShadowMaterial>;
  private readonly resizeObserver: ResizeObserver;
  private readonly textureLoader = new TextureLoader();
  private readonly textureCache = new Map<string, Promise<Texture>>();
  private readonly onPointerDown: (e: PointerEvent) => void;
  private readonly onPointerMove: (e: PointerEvent) => void;
  private readonly onPointerUp: (e: PointerEvent) => void;
  private turntableDragging = false;
  private turntableLastX = 0;
  private pointerDownX = 0;
  private pointerDownY = 0;
  private readonly raycaster = new Raycaster();
  private readonly ndc = new Vector2();

  private model: Object3D | null = null;
  private product: Product | null = null;
  private slotMeshes = new Map<string, Mesh[]>();
  private slotMaterials = new Map<string, MeshStandardMaterial>();
  private slotState: SlotState[] = [];
  /** Latest request per slot, so rapid swatch clicks resolve last-click-wins. */
  private slotRequests = new Map<string, number>();
  private loadToken = 0;
  private presetId: string;
  private status: ViewerStatus = 'idle';

  private roomGraph: RoomGraph | null = null;
  private roomBuilt: BuiltRoomScene | null = null;
  private readonly placementsRoot = new Group();
  private readonly placementRoots = new Map<string, Object3D>();
  private interactionMode: InteractionMode = 'catalog';
  private openingWidth = 0.9;

  constructor(host: HTMLElement, opts: ViewerOptions) {
    this.host = host;
    this.opts = opts;

    this.renderer = new WebGLRenderer({ antialias: true, preserveDrawingBuffer: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = PCFSoftShadowMap;
    this.canvas = this.renderer.domElement;
    this.canvas.dataset.testid = 'viewer-canvas';
    host.appendChild(this.canvas);

    this.pmrem = new PMREMGenerator(this.renderer);

    this.camera.position.set(1.6, 1.2, 1.8);
    this.controls = new OrbitControls(this.camera, this.canvas);
    this.controls.enableDamping = true;
    this.controls.enableRotate = false; // product spins on the turntable instead
    this.controls.screenSpacePanning = true;
    this.controls.minDistance = 0.3;
    this.controls.maxDistance = 8;
    this.controls.maxPolarAngle = Math.PI / 2 - 0.02; // keep the camera above the floor

    this.ground = new Mesh(new PlaneGeometry(40, 40), new ShadowMaterial({ opacity: 0.18 }));
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.receiveShadow = true;
    this.ground.userData.kind = 'shadow-ground';
    this.turntable.name = 'turntable';
    this.placementsRoot.name = 'room-placements';
    // Lights live on presetRig (scene-fixed). Never parent lights under turntable.
    this.scene.add(this.ground, this.presetRig, this.turntable, this.placementsRoot);

    this.onPointerDown = (e) => {
      if (e.button !== 0 || e.isPrimary === false) return;
      this.pointerDownX = e.clientX;
      this.pointerDownY = e.clientY;
      if (this.interactionMode === 'catalog') {
        this.turntableDragging = true;
        this.turntableLastX = e.clientX;
        this.canvas.setPointerCapture(e.pointerId);
      }
    };
    this.onPointerMove = (e) => {
      if (this.interactionMode !== 'catalog' || !this.turntableDragging) return;
      const dx = e.clientX - this.turntableLastX;
      this.turntableLastX = e.clientX;
      // Same horizontal feel as OrbitControls rotate (2π · Δx / height), yaw only.
      this.turntable.rotation.y += (Math.PI * 2 * dx) / Math.max(1, this.canvas.clientHeight);
    };
    this.onPointerUp = (e) => {
      const dx = e.clientX - this.pointerDownX;
      const dy = e.clientY - this.pointerDownY;
      const moved = Math.hypot(dx, dy) > 6;
      if (this.interactionMode === 'catalog') {
        if (!this.turntableDragging) return;
        this.turntableDragging = false;
        if (this.canvas.hasPointerCapture(e.pointerId)) this.canvas.releasePointerCapture(e.pointerId);
        return;
      }
      if (moved || e.button !== 0) return;
      const hit = this.raycastRoom(e.clientX, e.clientY);
      this.opts.onRoomPointer?.(hit, this.interactionMode);
    };
    this.canvas.addEventListener('pointerdown', this.onPointerDown);
    this.canvas.addEventListener('pointermove', this.onPointerMove);
    this.canvas.addEventListener('pointerup', this.onPointerUp);
    this.canvas.addEventListener('pointercancel', this.onPointerUp);

    this.presetId = opts.initialPreset && findPreset(opts.initialPreset) ? opts.initialPreset : LIGHT_PRESETS[0].id;
    this.applyPreset(findPreset(this.presetId)!);

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(host);
    this.resize();

    this.renderer.setAnimationLoop(() => {
      this.controls.update();
      this.renderer.render(this.scene, this.camera);
    });
  }

  // ------------------------------------------------------------------ public API

  getStatus(): ViewerStatus {
    return this.status;
  }

  getPresetId(): string {
    return this.presetId;
  }

  getSlots(): SlotState[] {
    return this.slotState.map((s) => ({ ...s, sources: [...s.sources] }));
  }

  getPartsList(): PartsList | null {
    return this.product ? buildPartsList(this.product, this.opts.library, this.slotState) : null;
  }

  async loadProduct(
    product: Product,
    opts?: { onRootReady?: (root: Object3D) => void | Promise<void> },
  ): Promise<SlotReport> {
    this.assertAlive();
    const token = ++this.loadToken;
    this.setStatus('loading', product.id);
    try {
      const root = await loadProductRoot(product);
      if (token !== this.loadToken || this.status === 'disposed') {
        disposeObject(root);
        throw new StaleLoadError();
      }

      this.unloadModel();
      this.product = product;
      this.model = root;
      this.turntable.rotation.y = 0;
      // Uploaded / DCC GLBs often lack normals; MeshStandardMaterial needs them or the mesh looks flat/black.
      const normalsComputed = ensureMeshNormals(this.model);
      this.model.traverse((o) => {
        if ((o as Mesh).isMesh) (o as Mesh).castShadow = (o as Mesh).receiveShadow = true;
      });

      if (opts?.onRootReady) await opts.onRootReady(this.model);
      if (token !== this.loadToken) throw new StaleLoadError();
      if (this.getStatus() === 'disposed') throw new StaleLoadError();

      this.turntable.add(this.model);
      this.frameModel(this.model);

      const report = this.bindSlots(product, { normalsComputed });
      if (!product.preserveMaterials) {
        await Promise.all(this.slotState.map((s) => this.applyMaterial(s.def.id, s.materialId, () => token === this.loadToken)));
      }
      if (token !== this.loadToken) throw new StaleLoadError();

      this.opts.onSlotsDiscovered?.(report);
      this.emitPartsList();
      this.setStatus('ready', product.id);
      return report;
    } catch (err) {
      if (err instanceof StaleLoadError) throw err;
      if (this.status !== 'disposed') this.setStatus('error', String((err as Error)?.message ?? err));
      throw err;
    }
  }

  /** Current product root (for pack color remap / diagnostics). */
  getModelRoot(): Object3D | null {
    return this.model;
  }

  async setSlotMaterial(slotId: string, materialId: string): Promise<void> {
    this.assertAlive();
    if (this.product?.preserveMaterials) {
      throw new Error('This module keeps its own materials (preserveMaterials). Library swatches are display-only.');
    }
    const slot = this.slotState.find((s) => s.def.id === slotId);
    if (!slot) throw new Error(`Unknown slot "${slotId}"`);
    const mat = findMaterial(this.opts.library, materialId);
    if (!mat) throw new Error(`Unknown material "${materialId}"`);
    if (!slot.def.allowedCategories.includes(mat.category)) {
      throw new Error(`Material "${materialId}" (${mat.category}) not allowed on slot "${slotId}"`);
    }
    const token = this.loadToken;
    const req = (this.slotRequests.get(slotId) ?? 0) + 1;
    this.slotRequests.set(slotId, req);
    const current = () => token === this.loadToken && this.slotRequests.get(slotId) === req;
    if (!(await this.applyMaterial(slotId, materialId, current))) return;
    slot.materialId = materialId;
    this.emitPartsList();
  }

  setLightPreset(id: string): void {
    this.assertAlive();
    const preset = findPreset(id);
    if (!preset) throw new Error(`Unknown light preset "${id}"`);
    this.presetId = id;
    this.applyPreset(preset);
  }

  resetCamera(): void {
    this.turntable.rotation.y = 0;
    // Product workspace always frames the catalog GLB — even if a room graph is loaded.
    if (this.interactionMode === 'catalog' && this.model) this.frameModel(this.model);
    else if (this.roomGraph) this.frameRoom();
    else if (this.model) this.frameModel(this.model);
  }

  getRoomGraph(): RoomGraph | null {
    return this.roomGraph;
  }

  getInteractionMode(): InteractionMode {
    return this.interactionMode;
  }

  /** Opening width used when computing click → centered offset along the wall. */
  setOpeningToolDefaults(_type: OpeningType, width: number): void {
    this.openingWidth = width;
  }

  setInteractionMode(mode: InteractionMode): void {
    this.assertAlive();
    this.interactionMode = mode;
    const catalog = mode === 'catalog';
    const roomy = !catalog;
    this.controls.enableRotate = roomy;
    // Catalog product turntable owns the stage: show the GLB, restore the shadow
    // ground, and hide the room shell/placements so walls cannot occlude the model.
    this.turntable.visible = catalog || !this.roomGraph;
    this.ground.visible = catalog || !this.roomGraph;
    if (this.roomBuilt?.root) this.roomBuilt.root.visible = roomy && !!this.roomGraph;
    this.placementsRoot.visible = roomy && !!this.roomGraph;
    this.canvas.style.cursor =
      mode === 'opening' || mode === 'place' || mode === 'draw-wall' ? 'crosshair' : '';
  }

  /**
   * Apply room graph as SoT: rebuild wall/floor meshes (Shape holes + ExtrudeGeometry).
   * Pass null to clear. Does not load placement GLBs — host calls `loadPlacement`.
   * Optional `materials` applies local library colors to the shell (not production Materials DB).
   * `activate` (default true): switch into room interaction when currently in catalog.
   * Pass `activate: false` to restore a persisted graph while keeping Product/catalog landing
   * (shell stays in the scene graph but hidden until the host enters Room workspace).
   */
  setRoomGraph(
    graph: RoomGraph | null,
    opts?: { frame?: boolean; materials?: RoomMeshMaterials; activate?: boolean },
  ): void {
    this.assertAlive();
    this.clearRoomShell();
    this.roomGraph = graph;
    if (!graph) {
      this.turntable.visible = true;
      // Restore product-mode shadow catcher at y=0.
      this.ground.visible = true;
      this.ground.position.y = 0;
      this.setInteractionMode('catalog');
      return;
    }
    this.roomBuilt = buildRoomScene(graph, opts?.materials);
    this.scene.add(this.roomBuilt.root);
    // Room floor top is at y=0. Hide the product shadow plane so it cannot
    // z-fight the floor (coplanar streaking while orbiting).
    this.ground.visible = false;
    this.syncPlacementVisibility(graph);
    const activate = opts?.activate !== false;
    if (activate && this.interactionMode === 'catalog') this.setInteractionMode('room');
    else this.setInteractionMode(this.interactionMode);
    if (opts?.frame !== false) this.frameRoom();
  }

  /** World-space AABB for a placement root (for soft collision). */
  getPlacementFootprint(placementId: string): { minX: number; maxX: number; minZ: number; maxZ: number } | null {
    const root = this.placementRoots.get(placementId);
    if (!root) return null;
    root.updateMatrixWorld(true);
    const box = new Box3().setFromObject(root);
    return { minX: box.min.x, maxX: box.max.x, minZ: box.min.z, maxZ: box.max.z };
  }

  setCeilingVisible(visible: boolean): void {
    if (this.roomBuilt?.ceiling) this.roomBuilt.ceiling.visible = visible;
  }

  frameRoom(): void {
    if (!this.roomGraph) return;
    const b = roomBounds(this.roomGraph);
    const sizeX = b.maxX - b.minX;
    const sizeZ = b.maxZ - b.minZ;
    const height = b.height;
    const target = new Vector3((b.minX + b.maxX) / 2, height * 0.35, (b.minZ + b.maxZ) / 2);
    const radius = Math.max(sizeX, sizeZ, height) * 0.75;
    const dist = radius / Math.sin((this.camera.fov * Math.PI) / 360);
    this.controls.target.copy(target);
    this.camera.position.copy(target).add(new Vector3(0.9, 0.55, 1.1).normalize().multiplyScalar(dist * 1.25));
    this.camera.near = Math.max(0.05, dist / 100);
    this.camera.far = Math.max(50, dist * 20);
    this.camera.updateProjectionMatrix();
    this.controls.update();
    // Widen shadow camera for room scale (ASSUMPTIONS A12).
    this.presetRig.traverse((o) => {
      const d = o as DirectionalLight;
      if (!d.isDirectionalLight || !d.castShadow) return;
      const extent = Math.max(sizeX, sizeZ, 4) * 0.75;
      d.shadow.camera.left = d.shadow.camera.bottom = -extent;
      d.shadow.camera.right = d.shadow.camera.top = extent;
      d.shadow.camera.far = Math.max(20, extent * 4);
      d.shadow.camera.updateProjectionMatrix();
    });
  }

  raycastRoom(clientX: number, clientY: number): RoomPointerHit | null {
    if (!this.roomBuilt) return null;
    const rect = this.canvas.getBoundingClientRect();
    this.ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.ndc, this.camera);

    const targets: Object3D[] = [];
    this.roomBuilt.root.traverse((o) => {
      if ((o as Mesh).isMesh) targets.push(o);
    });
    const hits = this.raycaster.intersectObjects(targets, false);
    for (const h of hits) {
      const kind = h.object.userData.kind as string | undefined;
      if (kind === 'wall' && h.object.userData.wallId) {
        const wallId = h.object.userData.wallId as string;
        const wall = this.roomGraph?.walls.find((w) => w.id === wallId);
        const point = { x: h.point.x, y: h.point.y, z: h.point.z };
        let offsetAlongWall: number | undefined;
        if (wall) {
          offsetAlongWall = openingOffsetFromHit(wall, point, this.openingWidth);
        }
        return { kind: 'wall', wallId, offsetAlongWall, point };
      }
      if (kind === 'floor') {
        return { kind: 'floor', point: { x: h.point.x, y: 0, z: h.point.z } };
      }
    }
    // Floor plane fallback for place mode (click outside extruded floor still snaps).
    if (this.interactionMode === 'place' && this.roomGraph) {
      const floorPlaneHits = this.raycaster.intersectObject(this.ground, false);
      if (floorPlaneHits[0]) {
        const p = floorPlaneHits[0].point;
        return { kind: 'floor', point: { x: p.x, y: 0, z: p.z } };
      }
    }
    return null;
  }

  /** Sit a loaded mesh on the floor at graph placement pose (Y snap = 0). */
  attachPlacement(placementId: string, root: Object3D, position: { x: number; z: number }, rotationY = 0): void {
    this.assertAlive();
    this.detachPlacement(placementId);
    ensureMeshNormals(root);
    root.traverse((o) => {
      if ((o as Mesh).isMesh) (o as Mesh).castShadow = (o as Mesh).receiveShadow = true;
    });
    // Drop pivot to floor without recentering XZ (catalog GLBs assumed meters — U3).
    root.updateMatrixWorld(true);
    const box = new Box3().setFromObject(root);
    root.position.set(position.x, -box.min.y, position.z);
    root.rotation.y = rotationY;
    root.userData.placementId = placementId;
    this.placementsRoot.add(root);
    this.placementRoots.set(placementId, root);
  }

  detachPlacement(placementId: string): void {
    const existing = this.placementRoots.get(placementId);
    if (!existing) return;
    this.placementsRoot.remove(existing);
    disposeObject(existing);
    this.placementRoots.delete(placementId);
  }

  clearAllPlacements(): void {
    for (const id of [...this.placementRoots.keys()]) this.detachPlacement(id);
  }

  private syncPlacementVisibility(graph: RoomGraph): void {
    const keep = new Set(graph.placements.map((p) => p.id));
    for (const id of [...this.placementRoots.keys()]) {
      if (!keep.has(id)) this.detachPlacement(id);
    }
  }

  private clearRoomShell(): void {
    if (this.roomBuilt) {
      this.scene.remove(this.roomBuilt.root);
      this.roomBuilt.dispose();
      this.roomBuilt = null;
    }
  }

  dispose(): void {
    if (this.status === 'disposed') return;
    this.loadToken++;
    this.renderer.setAnimationLoop(null);
    this.resizeObserver.disconnect();
    this.canvas.removeEventListener('pointerdown', this.onPointerDown);
    this.canvas.removeEventListener('pointermove', this.onPointerMove);
    this.canvas.removeEventListener('pointerup', this.onPointerUp);
    this.canvas.removeEventListener('pointercancel', this.onPointerUp);
    this.turntableDragging = false;
    this.controls.dispose();
    this.unloadModel();
    this.clearAllPlacements();
    this.clearRoomShell();
    this.roomGraph = null;
    this.clearPresetRig();
    this.envTarget?.dispose();
    this.envTarget = null;
    this.pmrem.dispose();
    this.ground.geometry.dispose();
    this.ground.material.dispose();
    for (const p of this.textureCache.values()) p.then((t) => t.dispose()).catch(() => {});
    this.textureCache.clear();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.canvas.remove();
    this.setStatus('disposed');
  }

  // ------------------------------------------------------------------ slots & materials

  private bindSlots(product: Product, geoNotes: { normalsComputed: string[] } = { normalsComputed: [] }): SlotReport {
    const found = discoverSlots(this.model!, product.sidecar);
    const defs = new Map(product.slots.map((s) => [s.id, s]));

    // Session uploads without conversion-farm tags: bind untagged meshes to fallbackSlotId.
    if (product.fallbackSlotId) bindUntaggedToFallback(found, product.fallbackSlotId);

    this.slotMeshes.clear();
    this.slotState = [];
    for (const def of product.slots) {
      const hit = found.slots.get(def.id);
      if (!hit) continue;
      this.slotMeshes.set(def.id, hit.meshes);
      this.slotState.push({ def, materialId: def.default, meshCount: hit.meshes.length, sources: [...hit.sources] });
    }

    return {
      bound: this.getSlots(),
      unknownInModel: [...found.slots.keys()].filter((id) => !defs.has(id)),
      missingInModel: product.slots.filter((s) => !found.slots.has(s.id)).map((s) => s.id),
      untaggedMeshes: found.untagged.map((m) => m.name || '(unnamed)'),
      meshesWithoutUv: meshesMissingUv(this.model!),
      meshesNormalsComputed: geoNotes.normalsComputed,
    };
  }

  /** Returns false (and binds nothing) if the request was superseded while textures loaded. */
  private async applyMaterial(slotId: string, materialId: string, isCurrent: () => boolean): Promise<boolean> {
    const def = findMaterial(this.opts.library, materialId);
    if (!def) throw new Error(`Unknown material "${materialId}"`);
    const material = await this.createMaterial(def);
    if (!isCurrent() || this.status === 'disposed') {
      material.dispose();
      return false;
    }

    const meshes = this.slotMeshes.get(slotId) ?? [];
    const previousSlotMat = this.slotMaterials.get(slotId);
    // GLB materials are often *shared* across meshes. Assign first, then dispose each unique
    // placeholder once — never call dispose() on a Material[] or double-free a shared instance
    // while another mesh still points at it (breaks parallel multi-slot apply via Promise.all).
    const orphaned = new Set<Material>();
    for (const mesh of meshes) {
      const prevs = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const prev of prevs) {
        if (!prev || prev === material || prev === previousSlotMat) continue;
        // Library materials owned by other slots stay alive in slotMaterials.
        if (prev.userData?.libraryId) continue;
        orphaned.add(prev);
      }
      mesh.material = material;
    }
    this.slotMaterials.set(slotId, material);
    if (previousSlotMat && previousSlotMat !== material) previousSlotMat.dispose();
    for (const prev of orphaned) {
      if (stillReferenced(this.model, prev)) continue;
      prev.dispose();
    }
    return true;
  }

  private async createMaterial(def: LibraryMaterial): Promise<MeshStandardMaterial> {
    const [map, normalMap, roughnessMap] = await Promise.all([
      def.map ? this.texture(def.map, def.repeat, true) : null,
      def.normalMap ? this.texture(def.normalMap, def.repeat, false) : null,
      def.roughnessMap ? this.texture(def.roughnessMap, def.repeat, false) : null,
    ]);
    const m = new MeshStandardMaterial({
      name: `lib:${def.id}`,
      color: new Color(def.color),
      roughness: def.roughness,
      metalness: def.metalness,
      map,
      normalMap,
      roughnessMap,
    });
    m.userData.libraryId = def.id;
    return m;
  }

  /** Textures are cached per (url, repeat, colorSpace) and shared across materials; freed on dispose(). */
  private texture(url: string, repeat: [number, number] = [1, 1], srgb: boolean): Promise<Texture> {
    const key = `${url}|${repeat.join('x')}|${srgb}`;
    let p = this.textureCache.get(key);
    if (!p) {
      p = this.textureLoader.loadAsync(url).then((t) => {
        t.wrapS = t.wrapT = RepeatWrapping;
        t.repeat.set(repeat[0], repeat[1]);
        t.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
        if (srgb) t.colorSpace = SRGBColorSpace;
        t.needsUpdate = true;
        return t;
      });
      p.catch(() => this.textureCache.delete(key));
      this.textureCache.set(key, p);
    }
    return p;
  }

  private emitPartsList(): void {
    const parts = this.getPartsList();
    if (parts) this.opts.onPartListUpdate?.(parts);
  }

  // ------------------------------------------------------------------ scene helpers

  private applyPreset(preset: LightPreset): void {
    this.clearPresetRig();
    if (preset.environment) {
      if (!this.envTarget) {
        const room = new RoomEnvironment();
        this.envTarget = this.pmrem.fromScene(room, 0.04);
        room.dispose();
      }
      this.scene.environment = this.envTarget.texture;
      this.scene.environmentIntensity = preset.environmentIntensity;
    } else {
      this.scene.environment = null;
    }
    this.scene.background = new Color(preset.background);
    this.renderer.toneMappingExposure = preset.exposure;
    this.ground.material.opacity = preset.shadowOpacity;

    for (const l of preset.lights) {
      let light: Light;
      if (l.type === 'hemisphere') light = new HemisphereLight(l.color, l.groundColor ?? '#444444', l.intensity);
      else if (l.type === 'ambient') light = new AmbientLight(l.color, l.intensity);
      else {
        const d = new DirectionalLight(l.color, l.intensity);
        d.position.fromArray(l.position ?? [2, 4, 3]);
        if (l.castShadow) {
          d.castShadow = true;
          d.shadow.mapSize.set(2048, 2048);
          d.shadow.camera.left = d.shadow.camera.bottom = -3;
          d.shadow.camera.right = d.shadow.camera.top = 3;
          d.shadow.camera.near = 0.1;
          d.shadow.camera.far = 20;
          d.shadow.bias = -0.0008;
          d.shadow.normalBias = 0.02;
        }
        light = d;
      }
      this.presetRig.add(light);
    }
  }

  private clearPresetRig(): void {
    for (const child of [...this.presetRig.children]) {
      (child as DirectionalLight).shadow?.dispose();
      (child as Light).dispose();
      this.presetRig.remove(child);
    }
  }

  /** Sit the model on the floor at the origin and point the camera at it. */
  private frameModel(model: Object3D): void {
    model.position.set(0, 0, 0);
    model.updateMatrixWorld(true);
    const box = new Box3().setFromObject(model);
    const center = box.getCenter(new Vector3());
    model.position.set(-center.x, -box.min.y, -center.z);
    model.updateMatrixWorld(true);

    const size = box.getSize(new Vector3());
    const radius = size.length() / 2;
    const dist = radius / Math.sin((this.camera.fov * Math.PI) / 360);
    const target = new Vector3(0, size.y / 2, 0);
    this.controls.target.copy(target);
    this.camera.position.copy(target).add(new Vector3(0.75, 0.45, 1).normalize().multiplyScalar(dist * 1.05));
    this.camera.near = Math.max(0.01, dist / 100);
    this.camera.far = dist * 20;
    this.camera.updateProjectionMatrix();
    this.controls.update();
  }

  private unloadModel(): void {
    if (this.model) {
      this.turntable.remove(this.model);
      disposeObject(this.model);
    }
    for (const m of this.slotMaterials.values()) m.dispose();
    this.slotMaterials.clear();
    this.slotMeshes.clear();
    this.slotRequests.clear();
    this.slotState = [];
    this.model = null;
    this.product = null;
  }

  private resize(): void {
    const w = Math.max(1, this.host.clientWidth), h = Math.max(1, this.host.clientHeight);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  private setStatus(status: ViewerStatus, detail?: string): void {
    this.status = status;
    this.opts.onStatus?.(status, detail);
  }

  private assertAlive(): void {
    if (this.status === 'disposed') throw new Error('Viewer has been disposed');
  }
}

/** Thrown when a newer loadProduct() call superseded this one; hosts can ignore it. */
export class StaleLoadError extends Error {
  constructor() {
    super('Load superseded by a newer loadProduct() call');
    this.name = 'StaleLoadError';
  }
}

/** Resolve the scene root: GLB/glTF via loader, or a registered .mjs createAsset() factory. */
async function loadProductRoot(product: Product): Promise<Object3D> {
  if (product.sourceKind === 'mjs-module') {
    const factory = getModuleFactory(product.id);
    if (!factory) throw new Error(`No createAsset factory registered for module product "${product.id}"`);
    const root = factory();
    if (!root?.isObject3D) throw new Error('createAsset() did not return a THREE.Object3D');
    return root;
  }
  const gltf = await loadGltf(product);
  return gltf.scene;
}

/** Load a catalog GLB/glTF, resolving multi-file glTF companions via product.resourceMap. */
function loadGltf(product: Product) {
  if (!product.resourceMap) return new GLTFLoader().loadAsync(product.glb);
  const map = product.resourceMap;
  const manager = new LoadingManager();
  manager.setURLModifier((url) => {
    const name = decodeURIComponent(url.split(/[/?#]/).pop() ?? '');
    return map[name] ?? url;
  });
  return new GLTFLoader(manager).loadAsync(product.glb);
}

function stillReferenced(root: Object3D | null, material: Material): boolean {
  if (!root) return false;
  let used = false;
  root.traverse((o) => {
    if (used || !(o as Mesh).isMesh) return;
    const mats = Array.isArray((o as Mesh).material) ? (o as Mesh).material : [(o as Mesh).material];
    if ((mats as Material[]).includes(material)) used = true;
  });
  return used;
}

function disposeObject(root: Object3D): void {
  const seen = new Set<Material>();
  root.traverse((o) => {
    const mesh = o as Mesh;
    if (!mesh.isMesh) return;
    mesh.geometry.dispose();
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    // Library materials are owned by slotMaterials and disposed there; only free GLB-embedded ones.
    for (const m of mats) {
      if (!m || m.userData?.libraryId || seen.has(m)) continue;
      seen.add(m);
      m.dispose();
    }
  });
}
