# Architecture

The authoritative description is [hackathon-3d-viewer/ARCHITECTURE.md](../hackathon-3d-viewer/ARCHITECTURE.md) (stack, module boundaries, data flow, how material slots work, lifecycle) together with [ASSUMPTIONS.md](../hackathon-3d-viewer/ASSUMPTIONS.md) (every assumption, every open unknown, and what is explicitly not claimed). This page is the short version plus what v2 added.

## The shape of the app

- **Engine owns the canvas, host owns the UI.** `src/viewer/` is the Three.js engine; the host (`src/main.ts`, `index.html`, `src/styles.css`) imports only from `src/viewer/index.ts` and talks to the engine through its public API.
- **Materials live in a library, not in the model.** A model names its parts (slots) through glTF `extras.material_slot_id`, a sidecar, or node names; `public/assets/library/` decides what each slot may be made of.
- **A room is data.** Walls, openings and placed products are one JSON "room graph", saved to `localStorage`; the 3D room, the 2D plan and the undo history are all derived from it. Every way of starting a room ends in the same graph.
- **Lighting is scene-level.** Presets never live in a model file.
- **A DWG is never the source of truth.** A plan becomes a confirmed room graph; there is no CAD editing, and real DWG/DXF reading is not set up.

## What v2 added

| Area | Files | What |
|---|---|---|
| Words | `src/copy.ts` | Every user-facing string, transcribed from the copy deck; `fmt`, `plural`, `rich`, `plain` helpers; a marked `notInDeck` section for strings the deck lacked. Static text in `index.html` is filled at boot through `data-copy` attributes |
| Messages | `src/errors.ts` | Maps engine errors to the deck's plain wording (`friendlyError`, slot warnings, pack summaries). Built and unit-tested; **most call sites are not wired yet** (skipped wave 6b) |
| Dialogs | `src/help.ts`, `src/help-content.ts`, `src/ui/confirmDialog.ts`, `src/ui/notify.ts` | The **?** pop-up (native `<dialog>`, five tabs), the confirm dialog, the on-stage toast |
| Pickers | `src/ui/thumbnailPicker.ts`, `src/viewer/thumbnails.ts` | A listbox pop-up (native `popover`) with thumbnail and list views over a still-rendered native `<select>`; an offscreen renderer that draws product thumbnails in a second WebGL context, lazily and cached |
| Placed products | `src/placedProducts.ts` and the engine | Selection, nudge and rotate helpers; engine methods `applySlotBindings`, `getPlacementRoot`, `setPlacementPose`, `setPlacementHighlight`; a `placement` hit kind from the raycaster |
| Room on arrival | `src/viewer/RoomVibezViewer.ts`, `roomMesh.ts` | Wall cutaway (walls facing the camera are hidden and skipped by the raycaster), a 45° arrival camera that fits the room, a darker default floor |
| Room bounds | `src/viewer/roomCollision.ts` | `pointInFloorPolygon`, `pointInRoom`: a floor hit always means inside the room |
| Saved data | `src/viewer/roomGraph.ts`, `projectIO.ts`, `dwgImport.ts`, `modules.ts` | `persistRoomGraph` reports failure; stricter `normalizeRoomGraph` with quarantine of an unreadable saved room; `checkPlanFile`; `RoomSizeError` with the failing field; async `.mjs` confirm; `clearProjectFromIdb` |

## Where state lives

| Key or store | Holds |
|---|---|
| `localStorage` `catalog3d.roomGraph` | The current room graph |
| `catalog3d.roomGraph.unreadable` | A saved room that could not be read, moved aside at boot |
| `catalog3d.roomTemplates` | Saved templates |
| `catalog3d.mjsEnabled` | Whether `.mjs` loading is allowed |
| `catalog3d.pickerView.product`, `.material` | Thumbnail or list view per picker kind |
| `catalog3d.helpSeen` | Whether the help was ever opened |
| IndexedDB `catalog3d-local` | A copy of the project written on Export, read at boot when `localStorage` has no room, cleared on Clear room |

Storage is per browser origin, so each port has its own.

## Test hook

`window.__rv` exposes the viewer, the room graph, the catalog, the pickers and the thumbnail renderer to tests and scripts, plus `simulateRoomPointer` for setting up state. It is not an API for the UI.

## Panel structure (v2)

`.panel` holds two groups, `#panel-catalog` and `#panel-room`; only the active one is rendered. The Room group is a toolbar (Undo, Redo, Export, Import) over `#room-tools`, which holds four `section.step` elements (room, openings, place, finish), one open at a time. The product picker and the Materials card are single elements that move between the Product card and the Place products step when the workspace changes. Element ids are a test contract (see `handoff/fixes/ux-improvements-handoff.md` §3): move elements, keep their ids.
