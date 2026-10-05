/**
 * Product thumbnails rendered at run time (UX-14 step 5 spike).
 *
 * One offscreen WebGLRenderer, created on the first render and kept until `dispose()`. It is a
 * second WebGL context next to the viewer's. Renders are queued and run one at a time; results are
 * cached per product id. Nothing here touches the viewer, its canvas or `data-viewer-status`.
 *
 * The module does not know how the host loads a product root, so the loader is a parameter
 * (the host's `loadPlacementRoot`, or the engine's `loadProductRoot`).
 */

import {
  ACESFilmicToneMapping,
  Box3,
  DirectionalLight,
  HemisphereLight,
  PerspectiveCamera,
  PMREMGenerator,
  Scene,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
  type Material,
  type Mesh,
  type Object3D,
  type Texture,
  type WebGLRenderTarget,
} from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

import { ensureMeshNormals } from './slots';
import type { Product } from './types';

export interface ThumbnailRendererOptions {
  /**
   * Returns a fresh root for the product. The thumbnail renderer owns that root afterwards and
   * disposes its geometries and materials after the shot, so do not hand it a root that is on stage.
   */
  loadRoot: (product: Product) => Promise<Object3D>;
  /**
   * Optional: put the product's default finish on the root before the shot, for example
   * `(root, product) => viewer.applySlotBindings(root, product)`. Without it the image shows the
   * asset's own (placeholder) materials.
   */
  applyFinish?: (root: Object3D, product: Product) => Promise<unknown> | unknown;
  /** Edge of the square image in CSS pixels. Default 192. */
  size?: number;
  /** Device pixel ratio for the image. Default: the window's, capped at 2. */
  pixelRatio?: number;
}

export interface ThumbnailStats {
  /** A WebGL context exists and is not lost. */
  contextAlive: boolean;
  /** How many contexts this renderer has created so far (1 unless disposed and used again). */
  contextsCreated: number;
  renders: number;
  cached: number;
  /** Renders waiting or running. */
  pending: number;
  /** Duration of the last finished render in ms (load + finish + draw + encode). */
  lastRenderMs: number | null;
  /** three.js memory counters of the thumbnail context (0/0 right after dispose). */
  geometries: number;
  textures: number;
}

export interface ThumbnailRenderer {
  /**
   * Image URL for the product. `product.thumbnailUrl` wins and is returned as is (nothing is
   * rendered). Otherwise a PNG data URL with a transparent background, rendered once per product id
   * and cached. Rejects if the product cannot be loaded or drawn; the queue carries on.
   */
  render(product: Product): Promise<string>;
  /** The cached URL (or `thumbnailUrl`), without starting a render. */
  peek(product: Product): string | undefined;
  /** Forget one cached image, or all when no id is given. Call when a product's own look changes. */
  invalidate(productId?: string): void;
  /** Free the WebGL context and the cache. A later `render()` starts again with a new context. */
  dispose(): void;
  stats(): ThumbnailStats;
}

const DEFAULT_SIZE = 192;
/** Same three-quarter view the viewer uses for the turntable product. */
const VIEW_DIR = new Vector3(0.75, 0.45, 1).normalize();
const FOV_DEG = 30;

export function createThumbnailRenderer(opts: ThumbnailRendererOptions): ThumbnailRenderer {
  const size = opts.size ?? DEFAULT_SIZE;
  const cache = new Map<string, string>();
  const inFlight = new Map<string, Promise<string>>();
  let queue: Promise<unknown> = Promise.resolve();
  let pending = 0;
  let renders = 0;
  let contextsCreated = 0;
  let lastRenderMs: number | null = null;
  /** Bumped by dispose(): renders queued or loading before it are rejected instead of reviving a context. */
  let generation = 0;

  let gl: {
    renderer: WebGLRenderer;
    scene: Scene;
    camera: PerspectiveCamera;
    pmrem: PMREMGenerator;
    env: WebGLRenderTarget;
  } | null = null;

  function ensureContext() {
    if (gl) return gl;
    const canvas = document.createElement('canvas'); // never attached to the document
    const renderer = new WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true });
    contextsCreated++;
    renderer.setPixelRatio(opts.pixelRatio ?? Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(size, size, false);
    renderer.outputColorSpace = SRGBColorSpace;
    renderer.toneMapping = ACESFilmicToneMapping;
    renderer.setClearColor(0x000000, 0);
    const scene = new Scene();
    const pmrem = new PMREMGenerator(renderer);
    const room = new RoomEnvironment();
    const env = pmrem.fromScene(room, 0.04);
    room.dispose();
    scene.environment = env.texture;
    scene.add(new HemisphereLight('#ffffff', '#b8b8b8', 0.6));
    const key = new DirectionalLight('#ffffff', 1.2);
    key.position.set(2, 4, 3);
    scene.add(key);
    const camera = new PerspectiveCamera(FOV_DEG, 1, 0.01, 100);
    gl = { renderer, scene, camera, pmrem, env };
    return gl;
  }

  async function draw(product: Product, myGeneration: number): Promise<string> {
    if (myGeneration !== generation) throw new Error('Thumbnail renderer was disposed');
    const started = performance.now();
    const root = await opts.loadRoot(product);
    try {
      ensureMeshNormals(root);
      if (opts.applyFinish) await opts.applyFinish(root, product);
      if (myGeneration !== generation) throw new Error('Thumbnail renderer was disposed');
      const { renderer, scene, camera } = ensureContext();

      root.updateMatrixWorld(true);
      const box = new Box3().setFromObject(root);
      if (box.isEmpty()) throw new Error(`Nothing to draw for product "${product.id}"`);
      const centre = box.getCenter(new Vector3());
      const radius = Math.max(box.getSize(new Vector3()).length() / 2, 1e-3);
      const dist = (radius / Math.sin((FOV_DEG * Math.PI) / 360)) * 1.05;
      camera.position.copy(centre).addScaledVector(VIEW_DIR, dist);
      camera.near = Math.max(0.01, dist / 100);
      camera.far = dist * 20;
      camera.lookAt(centre);
      camera.updateProjectionMatrix();

      scene.add(root);
      try {
        renderer.render(scene, camera);
        const url = renderer.domElement.toDataURL('image/png');
        renders++;
        lastRenderMs = performance.now() - started;
        return url;
      } finally {
        scene.remove(root);
      }
    } finally {
      disposeRoot(root);
    }
  }

  return {
    render(product) {
      if (product.thumbnailUrl) return Promise.resolve(product.thumbnailUrl);
      const cached = cache.get(product.id);
      if (cached) return Promise.resolve(cached);
      const running = inFlight.get(product.id);
      if (running) return running;
      pending++;
      const myGeneration = generation;
      const job = queue.then(() => draw(product, myGeneration));
      // The queue itself never rejects, so one bad product does not block the ones behind it.
      queue = job.then(
        () => undefined,
        () => undefined,
      );
      const result: Promise<string> = job
        .then((url) => {
          // Not cached when invalidate() or dispose() ran while this was in flight.
          if (inFlight.get(product.id) === result) cache.set(product.id, url);
          return url;
        })
        .finally(() => {
          pending--;
          if (inFlight.get(product.id) === result) inFlight.delete(product.id);
        });
      inFlight.set(product.id, result);
      return result;
    },
    peek(product) {
      return product.thumbnailUrl ?? cache.get(product.id);
    },
    invalidate(productId) {
      if (productId === undefined) {
        cache.clear();
        inFlight.clear();
      } else {
        cache.delete(productId);
        inFlight.delete(productId);
      }
    },
    dispose() {
      generation++;
      cache.clear();
      inFlight.clear();
      if (!gl) return;
      gl.env.dispose();
      gl.pmrem.dispose();
      for (const child of [...gl.scene.children]) {
        (child as DirectionalLight).dispose?.();
        gl.scene.remove(child);
      }
      gl.renderer.dispose();
      gl.renderer.forceContextLoss();
      gl = null;
    },
    stats() {
      return {
        contextAlive: !!gl && !gl.renderer.getContext().isContextLost(),
        contextsCreated,
        renders,
        cached: cache.size,
        pending,
        lastRenderMs,
        geometries: gl?.renderer.info.memory.geometries ?? 0,
        textures: gl?.renderer.info.memory.textures ?? 0,
      };
    },
  };
}

/**
 * Free everything the temporary root brought along. Library materials (made by applySlotBindings)
 * are disposed, but their textures are left alone: those are shared through the viewer's cache.
 * Textures embedded in the asset belong to this root only and are disposed.
 */
function disposeRoot(root: Object3D): void {
  const materials = new Set<Material>();
  root.traverse((o) => {
    const mesh = o as Mesh;
    if (!mesh.isMesh) return;
    mesh.geometry?.dispose();
    for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      if (m) materials.add(m);
    }
  });
  for (const m of materials) {
    if (!m.userData?.libraryId) {
      for (const value of Object.values(m)) {
        if ((value as Texture | null)?.isTexture) (value as Texture).dispose();
      }
    }
    m.dispose();
  }
}
