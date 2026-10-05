# ARCHITECTURE — Room Vibez catalog 3D viewer (hackathon slice)

Scope: the **Catalog placer / 3D Viewer** box of the Room Vibez core IA (prompt §4). Room editor, architect mode, auth/commerce and the conversion farm are stubbed or documented only.

## 1. Stack (and which prompt lock it satisfies)

| Choice | Why |
|---|---|
| **Three.js 0.170** (`WebGLRenderer`, `GLTFLoader`, `OrbitControls`, `RoomEnvironment`, `MeshStandardMaterial`) | §2 lock "Three.js only". No Babylon, no second engine. Boring, well-documented primitives (§10). |
| **TypeScript + Vite** | Explicit TS config/state instead of a WASM kernel (§4 "Do not implement a closed WASM configurator kernel"). |
| **GLB** runtime assets in `public/assets/models` | §2 "Catalog furniture runtime = GLB", §3 "Ingest/display .glb/.gltf". |
| **JSON materials library + catalog** in `public/assets/library` | §2 "Furniture materials not embedded as SoR — bind from a materials library via `material_slot_id`". Stand-ins for the owned Materials / SKU / material_slot tables. |
| **Scene-level light presets** (`src/viewer/presets.ts`) | §2 "Lights = scene/render presets, not per-SKU light rigs". |
| Polaris-like tokens in `src/styles.css` | §2 design-system lock. |
| Vitest (unit) + Playwright on local Chrome (e2e) | §7 "Basic automated smoke test". |

No Planner 5D, Roomle/Rubens SDK, ODA or APS dependency anywhere (`package.json` runtime dependency is `three` only).

## 2. Module boundaries

```text
index.html + src/main.ts            HOST (owns all UI chrome)
   │  product picker, slot swatches, preset switcher, parts-list panel
   │  calls ↓ public API only                ↑ callbacks (onStatus, onSlotsDiscovered, onPartListUpdate)
src/viewer/RoomVibezViewer.ts       ENGINE (owns the <canvas>)
   ├─ slots.ts      resolveSlotId / discoverSlots   (pure, unit-tested)
   ├─ library.ts    materialsForSlot / validateProduct / buildPartsList (pure, unit-tested)
   ├─ presets.ts    LIGHT_PRESETS data
   └─ types.ts      contracts mirroring the owned DB tables
```

This is the Rubens pattern "host owns UI; engine owns canvas" (§5), without the vendor kernel. `src/viewer/index.ts` is the only import surface a future host (Room Vibez app, PDP embed, room editor) should use.

### Engine API

```ts
const v = new RoomVibezViewer(hostEl, { library, initialPreset, onPartListUpdate, onSlotsDiscovered, onStatus });
await v.loadProduct(product);           // any number of times; stale loads are cancelled
await v.setSlotMaterial('frame', 'wood-walnut');
v.setLightPreset('warm-interior');
v.getSlots(); v.getPartsList(); v.resetCamera();
v.dispose();                            // SPA-safe teardown
```

## 3. Data flow

```text
catalog.json ──► Product { glb, slots[] (id, label, allowedCategories, default) }
                     │
                     ▼
GLTFLoader(product.glb) ──► scene graph ──► discoverSlots() ──► Map<slotId, Mesh[]>
                                                   │
materials.json ──► LibraryMaterial ──► MeshStandardMaterial (cached textures) ──► assigned to every mesh in slot
                                                   │
                                                   ▼
                                    buildPartsList() ──► onPartListUpdate(PartsList stub) ──► host / future BOM SoR
```

## 4. How material slots work

1. **Tagging (asset side).** A mesh — or any ancestor node — carries a `material_slot_id`. Resolution per node, highest precedence first:
   1. glTF node `extras.material_slot_id` (three.js exposes it as `object.userData.material_slot_id`) — used by the chair demo.
   2. Optional **sidecar** `{ "<node name>": "<slot id>" }` on the catalog product — the OBJ+sidecar path (§3). Implemented and unit-tested; no demo asset uses it.
   3. **Node-name convention** `slot_<slotId>__<part>` — used by the side-table demo.
   The nearest tagged ancestor wins, so a converter can tag a group node once.
2. **Definition (catalog side).** The *meaning* of a slot (label, allowed material categories, default) lives in the catalog, not in the GLB. The GLB only names the slot.
3. **Reconciliation.** `bindSlots()` intersects GLB slots with catalog slots and reports: catalog slots missing in the GLB, GLB slots unknown to the catalog, and untagged meshes. The UI shows these as warnings rather than guessing.
4. **Binding.** One `MeshStandardMaterial` per slot is built from the library row and shared by every mesh in that slot. The GLB's embedded material is treated as a placeholder and disposed on first bind. Category rules are enforced in `setSlotMaterial()`.
5. **Concurrency.** Product loads use a token (newer `loadProduct` wins); slot changes use a per-slot request counter (last click wins even if textures resolve out of order).

## 5. Conversion farm (stubbed)

`scripts/build-assets.mjs` (glTF-Transform + pngjs) stands in for the farm: it emits two GLBs with slot tags and the PNG baseColor textures. In production this becomes OBJ/glTF/FBX → normalise → GLB + slots + LOD → register SKU (see `docs/rubens-like-architecture-analysis.md` §2.4). No OBJ→GLB converter was built this sprint.

## 6. Lighting

Three presets: `studio-soft` (PMREM `RoomEnvironment` IBL + key light), `warm-interior` (low IBL, warm hemisphere + low-angle warm key), `neutral` (no IBL, hemisphere + key + fill). Each preset owns its lights in a dedicated rig node that is torn down on switch. A `ShadowMaterial` ground plane gives contact grounding. ACES tone mapping and sRGB output.

## 7. Lifecycle

`dispose()` stops the animation loop, disconnects the `ResizeObserver`, disposes controls, model geometry, slot materials, cached textures, PMREM target, preset lights/shadow maps, renderer, forces context loss and removes the canvas. The host demonstrates this with **Dispose & remount**, and Vite HMR calls `dispose()` too. The e2e test asserts exactly one canvas exists after a remount and the user's choices are restored.

## 8. Where this plugs into the wider Room Vibez architecture

```text
[Auth · projects · commerce · BOM/SKU UI]     ← stub: parts-list JSON panel + `rv:partlistupdate` window event
        ├─ Room editor (Three.js)             ← future: reuse RoomVibezViewer's slot binding + presets on placed items
        ├─ Catalog placer / 3D Viewer         ← THIS PROTOTYPE
        └─ Architect mode                     ← not built; DWG → room graph stays a separate pipeline
        [Conversion farm]                     ← scripts/build-assets.mjs (pre-baked)
        [DBs: SKU · material_slot · materials · BOM · projects · presets]
                                              ← catalog.json / materials.json / presets.ts
```

## 9. Deferred (deliberately)

- Room editor / placement into rooms; DWG/DXF/PDF room ingest; AI floor plans.
- Real conversion farm, LODs, Draco/Meshopt compression, KTX2 textures, CDN.
- AR (USDZ/Quick Look, Scene Viewer, `model-viewer`) — would need a USDZ pipeline we don't have; see ASSUMPTIONS.md.
- Real BOM/price lookup; the parts list is explicitly `stub: true` and carries no prices.
- Configurator rules beyond "allowed categories per slot".
