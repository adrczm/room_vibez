# Loading `.mjs` into the hackathon 3D viewer

For Chong / Room Vibez: what `*.mjs` means here, how it relates to the Vite + Three.js catalog viewer, and the opt-in load path that was added.

## Verdict (plain language)

**`.mjs` is JavaScript (ES modules), not a 3D mesh format.** It is not GLB, OBJ, or glTF. You cannot “parse geometry out of” a random `.mjs` the way you load a `.glb`. The only way an `.mjs` becomes something in the viewer is if the **module runs** and **exports** Three.js objects (or a factory that builds them).

Chong’s Desktop sample fits that pattern:

- Path: `/Users/adrian/Desktop/Room Vibez/models/core-rulebook-4aedc7.mjs`
- Same asset also exists as `core-rulebook-4aedc7.glb` (real mesh file)
- The `.mjs` is a **Polyfork-style parametric Three.js source**: `import` → call `createAsset()` → get a ready `THREE.Group` (no GLTFLoader, no textures)

Also nearby (build tooling only, not a catalog asset):

- `hackathon-3d-viewer/scripts/build-assets.mjs` — Node script that pre-bakes demo GLBs

## What `.mjs` is / is not

| | `.mjs` / ES module | `.glb` / `.gltf` |
|---|---|---|
| Kind | Executable JavaScript | Binary / JSON 3D asset |
| Loader in this app | Native `import()` (runs code) | `GLTFLoader` |
| Typical content | Functions, classes, maybe `createAsset()` | Meshes, materials, animations |
| Security | **Arbitrary code execution** | Data parse (still trust source) |
| “Just drop in and see mesh?” | Only if it exports a known API | Yes (if valid GLB) |

**Cannot:** treat `.mjs` as a mesh container unless the module exports Three.js objects or a documented factory. Listing bytes or renaming to `.glb` will not work.

## How this Vite + TypeScript app loads modules today

Repo: `hackathon-3d-viewer/` (`"type": "module"` in `package.json`).

1. **Bundled static imports** — `src/main.ts` and `src/viewer/*` use normal ESM (`import { … } from 'three'`, `from './slots'`). Vite resolves and bundles them for the browser.
2. **JSON / assets via `fetch`** — catalog and materials JSON from `/assets/…`.
3. **Runtime model load** — `GLTFLoader.loadAsync(product.glb)` for catalog and session GLB/glTF uploads (`RoomVibezViewer.loadProduct`).
4. **Node `.mjs` scripts** — `scripts/build-assets.mjs` runs under Node (`npm run assets`), not in the browser viewer.
5. **New (opt-in)** — host UI **Load module (.mjs)** → rewrite bare `three` imports → `import(blobUrl)` → resolve `createAsset` → register factory → `loadProduct` with `sourceKind: 'mjs-module'`.

There was previously **no** path that dynamic-imported user `.mjs` into the scene.

## Safe-ish ways to load `.mjs` into the running app

All of these **execute code**. Prefer trusted files only (local assets you authored or licensed).

| Approach | When to use | Notes |
|---|---|---|
| **Dynamic `import()` of a blob URL** (implemented) | User picks a local `.mjs` | Rewrite `from 'three'` / `three/addons/…` to absolute Vite-served URLs; browser cannot resolve bare specifiers in blob modules |
| **Vite `?url` + `import()`** | File is in the repo (`public/` or `src/`) | Good for first-party plugins; URL is known at build/dev time |
| **Import map** in `index.html` | Many external modules with bare `three` | Alternative to per-file rewrite; must load before app modules |
| **Plugin registry** | Productized extensions | Host keeps a map `id → () => import(url)`; same contract as below |

### Security caveats

- `import()` of user content = **full script privileges** in the page (DOM, `fetch`, anything the origin can do).
- Do not enable for untrusted uploads in production without sandboxing (iframe + tight CSP, or server-side review).
- The hackathon UI labels this as opt-in and states that code is executed.

## Supported module contract (documented — from the real sample)

Discovered in `core-rulebook-4aedc7.mjs` (Polyfork / polyfork.dev header), **not invented**:

```js
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export function createAsset(userParams = {}) {
  const g = new THREE.Group();
  // …build meshes…
  return g;
}
export default createAsset;
// also exports: params, presets, materials, rig, view, …
```

### Contract the viewer accepts

1. **Preferred:** named export `createAsset` that is a **function** returning `THREE.Object3D`.
2. **Or:** `default` export that is that function.
3. **Or:** `default` / `createAsset` that is already an `Object3D` (cloned on each load).

If none match, the UI shows an error that **lists export keys** (e.g. `params, materials, …`) so Chong can see what the file actually exports.

### What the viewer does after a successful import

- Registers the factory under a session product (`sourceKind: 'mjs-module'`).
- Calls `createAsset()` on load and on dispose/remount (fresh object each time).
- Sets `preserveMaterials: true` so library swatches do **not** wipe Polyfork vertex-color materials.
- Does **not** claim `.mjs` as a general Room Vibez catalog format; catalog SoR remains GLB + materials DB.

### What we did **not** invent

- No fake “MJS mesh codec.”
- No claim that every `.mjs` is a 3D model.
- Optional params UI for `params` / colorways was **not** built (can be a follow-up if Chong wants it).

## How to try it

```bash
cd "/Users/adrian/Desktop/Room Vibez/hackathon-3d-viewer"
npm run dev   # http://127.0.0.1:18767/
```

In the Product panel: **Load module (.mjs)** → choose  
`/Users/adrian/Desktop/Room Vibez/models/core-rulebook-4aedc7.mjs`.

Prefer the sibling `.glb` when you only need a static mesh and slot/material workflows.

## Code map

| File | Role |
|---|---|
| `src/viewer/modules.ts` | Rewrite imports, `resolveModuleAsset`, `importModuleFile`, product factory registry |
| `src/viewer/RoomVibezViewer.ts` | `loadProduct` branches on `sourceKind` / `preserveMaterials` |
| `src/main.ts` + `index.html` | Opt-in file input + status / errors |
| `tests/unit/modules.test.ts` | Contract + rewrite unit tests |

## Unknowns

- Whether Chong wants full Polyfork **params** UI (colorway, open/closed, …) or only default `createAsset()`.
- Whether production should allow user `.mjs` at all, or only first-party modules under `public/`.
- Three version skew: sample docs mention `three@0.180`; viewer depends on `three@0.170` — usually fine for this asset; watch addons APIs.
