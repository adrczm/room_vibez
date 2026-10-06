# UX copy deck — Room Vibez

**Date:** 2026-10-05 · **Scope:** every user-facing string in the **Catalog 3D viewer** (`hackathon-3d-viewer/`, including engine messages that reach the UI) and the **planner-flows prototype** (`prototypes/room-vibez-planner-flows/`). Coohom captures are competitor research and are not covered.

**Your direction, applied:** keep only minor nudges on screen; put the how-to and the *why it was built this way* behind a **?** that opens a pop-up.

**Rule I held to:** nothing in the pop-up is invented. Each "how it's built" statement traces to `ARCHITECTURE.md`, `ASSUMPTIONS.md`, `README.md` or the code, and anything still undecided says so (the project's own "label Unknowns" rule). Statements I checked against code are listed in §10.

---

## 1. What changes

| | Today | After |
|---|---|---|
| Viewer: persistent helper text | **284 words in 14 paragraphs** (measured from `index.html`) | **91 words in 10 short lines**, a 68% cut (counted from §3.1) |
| Prototype: persistent helper text | 232 words in 22 paragraphs, plus research notes inside disabled buttons | Research notes removed, paragraphs shortened (§6) |
| How-to / "why" | Scattered through the sidebar | One **?** pop-up, 5 tabs (§2) |
| Errors | Raw parser text and internal names (`Unexpected token…`, `normalizeRoomGraph`) | Plain 3-part messages (§4) |

### Three tiers of text

| Tier | What it is | Where it lives | Budget |
|---|---|---|---|
| **1. Nudge** | One short line that helps *right now* | On screen, muted | ≤ 1 line, ~10 words. Mostly **state-based** (changes with the active tool) rather than static |
| **2. Feedback** | What just happened, what was kept, what to do next | Status lines, errors, confirmations | Always visible when it fires |
| **3. Guide** | How to work, and why it's built this way | The **?** pop-up | As long as it needs, in short sections |

### Two things I deliberately did *not* move behind the ?

1. **Honesty labels** stay visible as one short phrase each: *sample result* (DWG/DXF), *placeholder SKUs · no prices*, *gone when you refresh*. The stress test (`flow-stress-test-report.md` R2, R4, K6, T1) found the product looks more capable than it is when these are missing. Each gets a **Why?** link into the pop-up for the long answer.
2. **Errors, warnings and destructive confirmations.** They are feedback at the moment of action, not instruction. They are rewritten (§4, §5), not hidden.

---

## 2. The ? pop-up

### Behavior

- **Entry:** one circular **?** button at the right end of the top bar, after the Workspace switch. Tooltip *How this works*; `aria-label="Help: how this works"`; `aria-haspopup="dialog"`.
- **Opens a modal `<dialog>`** (native focus trap, Esc closes). Title *How Catalog 3D works*. Close button `aria-label="Close help"`.
- **Opens on the tab that matches where you are:** Product workspace → *Product*, Room workspace → *Room*, first visit → *Start here*. **Why?** links open the exact section.
- **Never auto-opens, no tour.** Optional: a small dot on the **?** until first opened (remember in `localStorage`, wrapped in try/catch because the app already handles blocked storage).
- **No per-card ? icons.** Six or more icons in a 340 px sidebar would bring the clutter back. The two **Why?** links cover the places where a short answer matters.
- **Mobile:** tabs become a *Topic* dropdown.
- **Tabs:** Start here · Product · Room · Files & saving · How it's built.

### Tab 1 — Start here

**How Catalog 3D works**

Look at furniture in 3D, change what each part is made of, and place it in a room you build.

1. **Product.** Spin a model and try materials, part by part.
2. **Room.** Build a room from scratch, from a plan, or from a template. Then place products in it.
3. **Switch** between the two with the Workspace switch at the top.

**Your work.** Your room saves in this browser as you go. Models, textures and plans you add don't. They're gone when you refresh. To keep a room, choose **Export project**.

Nothing you add leaves your browser. This version has no accounts or cloud storage.

### Tab 2 — Product

**Look at a product**

- **Choose** a product from the list, or add your own model (see *Files & saving*).
- **Move around.** Drag to spin, scroll to zoom, right-drag to pan. **Reset camera** puts it back.

**Change materials**
A product is made of parts, such as Frame, Handles and Pillow. Each part is called a *slot*. Pick a swatch under a part to change its material. A part only offers materials that suit it, so a pillow offers fabrics, not metal. Models you upload offer every material.

If a model's parts aren't labeled, the whole model counts as one part called **Surface** and changes together.

**Add texture.** Upload an image to create a new material, or add a *normal map* or *roughness map* to a material you already have. New materials show up as swatches on matching parts.

**Lighting.** *Studio soft*, *Warm interior* and *Neutral* change the lighting only. They never change the model file. *Neutral* is plain lighting without environment reflections.

**Parts list.** Shows what's selected, part by part, as data. SKUs are placeholders and there are no prices yet.

### Tab 3 — Room

**Build a room**

**Start one of three ways**

- **From scratch.** Pick a preset or enter a size, then choose **Create room**.
- **Import plan.** Upload a plan image and enter its real size. A room is traced over it. DWG/DXF shows a sample result for now (see *Files & saving*). `#import-plan`
- **From template.** Start a new room from one you saved. Any room can be saved as a template.

**Starting a new room replaces the current one, and you can't undo it.** Export first if you want to keep it.

**Shape the room**

- **Draw walls.** Choose **Draw walls**, click corners on the floor, then click near the first corner to close. Corners snap to right angles. This makes one closed room.
- **Doors and windows.** Pick Door or Window, set the size, choose **Add opening**, then click a wall. They cut a hole and show a plain placeholder shape. They aren't catalog products yet.
- **Wall and floor finish.** Choose materials for the walls and the floor from your library.

**Place products**

- Choose a product in the Product list, choose **Place product**, then click the floor. Turn on **Snap to nearest wall** to line it up against a wall.
- Overlaps with a wall or another product are allowed, with a warning. To move something, delete it from the list and place it again.

**Undo, save and share**

- **Undo / Redo** work for room changes: Ctrl/Cmd+Z, and Shift+Ctrl/Cmd+Z.
- **Download plan PNG** saves the 2D plan as an image.
- **Export project** saves your room and templates as a file. Open it later with **Import project**. Uploaded models aren't included, so add them again.
- **Sizes** can be shown in meters, centimeters or feet. In feet, type decimals (9.5 = 9 ft 6 in). Results appear as feet and inches.

### Tab 4 — Files & saving

**3D models**

| File | What to know |
|---|---|
| `.glb` | Best choice. One file with everything inside. |
| `.gltf` | Select it together with its companion files (`.bin`, textures). |
| `.obj` | Select the `.obj` with its `.mtl` and texture images. An optional `.slots.json` names the parts. One `.obj` at a time, and don't mix OBJ with GLB. |
| FBX, USDZ, `.blend` | Not supported. Export to GLB or OBJ first. |

- Draco- or Meshopt-compressed GLBs may not load. Re-export without compression.
- For textures to look right, a model needs UV mapping. Without it, textures look flat. Re-export with UVs.

**Packs (`.mjs` + `.glb`)**
A pack is two files with the same name. `name.glb` is the shape and `name.mjs` holds its colors and options. Select both at once, or add the `.glb` first and the `.mjs` second. A `.mjs` on its own shows a basic model and is marked incomplete.

**An `.mjs` file is a program, not a model.** It runs in this page. You'll be asked to confirm, and a quick scan flags risky patterns, but that's a warning, not a guarantee. Only load files you trust. **Allow .mjs files** turns this off.

**Plans** `#plans`

- **PNG, JPG, WebP.** Trace over the image. You enter its real width and depth. Nothing is recognized automatically.
- **DWG, DXF.** Your file is kept but not read. You'll see a clearly labeled sample room instead. Reading real DWG files needs a licensed library that isn't set up here.
- **JSON.** A ready-made list of walls and rooms in Catalog 3D's plan format.
- **PDF.** Not supported yet. Export the page as PNG or JPG.

**What's saved**

| What | Where it lasts |
|---|---|
| Room (walls, openings, placed products) | In this browser, automatically |
| Templates | In this browser |
| Models, textures and plans you add | Until you refresh |
| Export project file | On your computer. Room and templates only. |

Clearing your browser's site data removes saved rooms and templates. A saved room that used a product you uploaded reopens without that product. If your browser blocks saving, the app tells you. Use **Export project** to keep your work.

> **Hold this sentence until it's true.** *"If your browser blocks saving, the app tells you"* is **not true today**: `persistRoomGraph` swallows the failure (`roomGraph.ts:512`). Ship it with the saving-blocked banner (§4.F). Until then use: *If your browser blocks saving, your room only lasts while this tab is open. Use **Export project** to keep your work.*

### Tab 5 — How it's built

**Why Catalog 3D works the way it does.** Where something is still undecided, it says so.

1. **One 3D engine, owned by us.** Built on Three.js, with no Planner 5D or Roomle embedded. Whether Room Vibez embeds a third-party planner later is still open.
2. **Materials live in a library, not in the model.** A model file only names its parts. The catalog decides what each part can be made of. That keeps finishes consistent across products and lets one model be re-skinned.
3. **Lighting is separate from models.** Presets belong to the scene, so no product carries its own lights.
4. **Rooms are stored as plain data.** Walls, openings and placed products are saved as a "room graph" (JSON), and the 3D room is built from it. That's why every way of starting a room ends up the same, and why undo and export work.
5. **A DWG is never the source of truth.** A plan is a starting point you confirm. It then becomes a Catalog 3D room. There's no CAD editing. Reading real DWG/DXF needs ODA or Autodesk APS licenses. Which to use is undecided, so DWG/DXF shows a labeled sample for now.
6. **A person confirms every import.** There's no AI floor-plan recognition. You enter the real size and choose which walls to include.
7. **Doors and windows are cutouts for now.** Whether they become real catalog products later is undecided.
8. **Overlaps warn but don't block.** Whether to enforce placement rules later is undecided.
9. **Defaults are starting points.** 2.7 m ceilings, 12 cm walls, doors 0.9 × 2.1 m, windows 1.2 × 1.2 m with a 0.9 m sill. These are common ranges, not a product standard.
10. **Code files are opt-in.** `.mjs` files run code, so loading is opt-in and asks you to confirm.
11. **No accounts, no cloud, no prices.** Everything stays in your browser. SKUs are placeholders.
12. **Not built yet:** AR, real DWG reading, AI plan recognition, prices, catalog doors and windows, model compression, cloud projects.

*Full write-ups: `ARCHITECTURE.md` and `ASSUMPTIONS.md` in the project folder.*

**For developers** (collapsed by default)

- **Room graph JSON.** *Developer view* in the Room workspace shows the room's data live. Rooms are stored in meters. Length runs along X, width along Z, and Y is up with the floor at 0.
- **Parts list.** A JSON payload on every change, also fired as the window event `rv:partlistupdate`. Placeholder SKUs, no prices.
- **Slot labels** are read in this order: glTF `extras.material_slot_id`, a sidecar map, then node names `slot_<id>__<part>`. The naming convention is ours, not a standard.
- **Restart 3D view** rebuilds the engine and keeps your choices. It's a check that the viewer cleans up after itself.

---

## 3. Catalog 3D viewer — visible copy

Format: **Today** → **Visible now**. Unchanged items are listed at the end of each table. All element ids are unchanged.

### 3.1 Static helper lines (the 14 paragraphs)

| # | Element | Today | Visible now |
|---|---|---|---|
| 1 | `#workspace-mode-hint` (Product) | Product turntable — inspect GLB, materials, and packs. | Spin a product and try materials. |
| 1b | `#workspace-mode-hint` (Room) | Room editor — build the shell, openings, and place Catalog 3D products. | Build a room, then place products in it. |
| 2 | `#stage-hint` (default) | Drag to spin product · scroll to zoom · right-drag / two-finger to pan | Drag to spin · scroll to zoom · right-drag to pan |
| 3 | Room card intro | Three create paths → same owned room graph → Catalog 3D GLB on the floor. Graph JSON is SoT… | *(removed — now in ? › How it's built)* |
| 4 | "From scratch" subtext | Rectangular shell → door/window cutouts → place furniture. | *(removed — the Create room status line gives the next step)* |
| 5 | `#import-oda-note` | 58 words about SourceAsset, candidates, underlays, rasterizers, ODA/APS | Best with a PNG or JPG. DWG/DXF shows a sample result for now. PDF isn't supported yet. **Why?** |
| 6 | "From template" intro | Instantiate a saved room-graph seed (clone). Templates are not DWG files. | *(removed)* |
| 7 | `#template-status` (empty) | No templates yet — import a plan and choose “Save as template”. | No templates yet. Save a room to reuse it. |
| 8 | "Draw walls" hint | Click floor corners to trace an orthogonal polygon; click near the first point to close. | *(removed — the stage hint shows it while the tool is on)* |
| 9 | "Place furniture" hint | Select a Catalog product, then click the floor. Door/window openings use procedural placeholder meshes… | *(removed — the stage hint names the selected product)* |
| 10 | Add 3D model hint | 54 words about OBJ conversion, Object URLs, MJS codegen | .glb works best. OBJ and glTF also work. |
| 11 | Load pack hint | 41 words about Polyfork, basenames, createAsset() | Select both files together. Runs code — only load files you trust. |
| 12 | Load module hint | Same as pack without GLB. Prefer Load pack when the sibling GLB is available. | Use Load pack if you also have the .glb. |
| 13 | Add texture hint | Uploads go into the materials library, then apply via slot swatches (materials SoR)… | PNG, JPEG or WebP. Gone when you refresh. |
| 14 | `#room-status` (no room) | No room yet — create a size to start. *(and, after render: No room yet — from scratch, import plan, or template.)* | No room yet. Pick a way to start above. |
| new | Parts list note | *(none; badge read "stub · onPartListUpdate")* | Placeholder SKUs · no prices |

*(The two `#room-status` variants disagree today. One string fixes both.)*

### 3.2 Top bar and stage

| Element | Today | Visible now |
|---|---|---|
| `.brand` | Catalog 3D | Catalog 3D *(unchanged — pinned by e2e)* |
| Workspace label / toggle | Workspace · Product · Room workspace | *Unchanged. This was decided and documented in `catalog-room-toggle-ux.md`.* |
| **New** help button | — | **?** · tooltip *How this works* |
| `#btn-reset` | Reset camera | Reset camera |
| `#btn-remount` | Dispose & remount · tooltip *Dispose and recreate the viewer (SPA lifecycle demo)* | **Restart 3D view** · tooltip *Rebuilds the 3D view. Your choices are kept.* |
| `#viewer-overlay` | Loading… | Loading… |
| Overlay error: no WebGL | This browser could not start WebGL (3D graphics). Enable hardware acceleration, try another browser, or use "Start Viewer.command", which runs Chrome with software WebGL. | **3D isn't available in this browser.** Turn on hardware acceleration, or try another browser. On a Mac you can also open “Start Viewer (software 3D).command” from the viewer folder. |
| Overlay error: anything else | Could not load model: {raw text} | **The viewer couldn't start.** Reload the page. If it happens again, your saved room may be damaged. *(With quarantine, see §4.F.)* |

> **Bug caught:** the current WebGL message sends people to `Start Viewer.command`, which is the normal launcher that just failed. The software-WebGL launcher is `Start Viewer (software 3D).command` (`QUICKSTART.md` agrees).

### 3.3 Stage hints by mode (the main nudges)

State-based: the hint changes with what you're doing, so the static how-to paragraphs aren't needed.

| Mode | Today | Visible now |
|---|---|---|
| Product | Drag to spin product · scroll to zoom · right-drag / two-finger to pan | Drag to spin · scroll to zoom · right-drag to pan |
| Room, no room yet | Room workspace — create or import a room to edit the shell. | Create or import a room to start. |
| Room, idle | Room · drag to orbit · scroll to zoom · right-drag to pan | Drag to orbit · scroll to zoom · right-drag to pan |
| Add opening on | Opening mode · click a wall · orbit drag to look · scroll to zoom | Click a wall to add a {door / window}. |
| Place product on | Place mode · click floor to drop the selected product · orbit to look | Click the floor to place “{product}”. |
| Draw walls on | Draw walls · click floor corners · click near first point to close · orbit to look | Click floor corners. Click the first corner to close. |

### 3.4 Product card, uploads, materials, texture, lighting, parts list

| Element | Today | Visible now |
|---|---|---|
| `#product-meta` | STUB-SKU-CHAIR-001 · slots tagged via gltf-extras · session upload · pack complete/mapping | **STUB-SKU-CHAIR-001** (+ ` · your upload`). Tagging and mapping details move to *For developers* and the pack status line. |
| Product list option | Name (upload) | Name · *your upload* |
| Add 3D model — input aria | Upload GLB, glTF, or OBJ package | *(unchanged)* |
| Load pack — label | Load pack (.mjs + .glb) | Load pack (.mjs + .glb) |
| Pack-mate label | Or attach pack-mate GLB | Or add the .glb on its own |
| Module label | Load module (.mjs only) | Load module (.mjs only) |
| `#mjs-enabled` | Enable .mjs module loading (trusted files only) | Allow .mjs files (they run code) |
| Card `h2` "Material slots" | Material slots | **Materials** |
| Slot row meta | material_slot_id: `frame` · 3 mesh(es) · via gltf-extras | *(hidden; moves to the swatch tooltip and ? › For developers)* |
| Swatch tooltip | Natural oak (STUB-MAT-WOOD-OAK) | *(unchanged)* |
| Card `h2` "Add texture" fields | Image · Name *(placeholder: Optional display name)* · Category · Map role · Target material | Image · Name *(placeholder: Optional)* · Category · **Use as** · **Add to material** |
| Map role options | baseColor (new material) · normal → existing · roughness → existing | Color (new material) · Normal map (existing material) · Roughness map (existing material) |
| Texture category options | wood · textile · plastic · stone · metal | Wood · Textile · Plastic · Stone · Metal |
| `#btn-add-texture` | Add to library | Add to library |
| Card `h2` "Light preset" | Light preset | **Lighting** |
| Preset buttons | Studio soft · Warm interior · Neutral (no IBL) | Studio soft · Warm interior · **Neutral** |
| Card `h2` "Parts list" badge | Parts list · stub · onPartListUpdate | Parts list · *Placeholder* |

### 3.5 Room workspace — starting a room

| Element | Today | Visible now |
|---|---|---|
| `h2` badge | MVP | Preview |
| Ingress tabs | From scratch · Import plan · From template | *Unchanged* |
| Sub-heads | From scratch / Import plan / From template | *(removed. The tab label already says it.)* |
| Units select | meters (m) · centimeters (cm) · feet (decimal) / ft-in labels | Meters (m) · Centimeters (cm) · Feet |
| Dimension fields | Length (X) · Width (Z) · Ceiling height · Wall thickness | Length ({unit}) · Width ({unit}) · Ceiling height ({unit}) · Wall thickness ({unit}) |
| Preset options | Small bedroom 3×3 m · Living 5×4 m · Studio 6×4 m · Custom… | Small bedroom · 3 × 3 m · Living room · 5 × 4 m · Studio · 6 × 4 m · Custom size… |
| Template title | Template title (optional) · *My room template* | Template name (optional) · *My room template* |
| Buttons | Save current room as template · Create room | Save as template · Create room |
| **Import** badge | mock extract | **Sample only** |
| File label | Plan file (.dwg / .dxf / .json / .png / .jpg / .pdf) | Plan file |
| Import buttons | Upload & derive candidates · Load mock fixture | Upload plan · **Try the sample plan** |
| Underlay heading + badge | Raster underlay · human confirm | **Trace over your image** |
| Underlay fields / button | Width (m) · Depth (m) · Confirm underlay → room | Width (m) · Depth (m) · **Create room from image** |
| Underlay note | Raster underlay — human confirms size; no AI floor-plan recognition. / Trace is rectangular shell matching underlay width×depth. Adjust meters, then confirm. | Enter the real size of this plan. A rectangular room will be traced to match. |
| Sample banner | `[mock_fixture] ODA available: no — ODA Drawings / APS Model Derivative not available on this machine. Candidates are a labeled mock fixture…` | **Sample result.** Your file was kept but not read. These walls come from a built-in example, not your drawing. **Why?** *(original string kept under “Technical details”; see §10)* |
| Job status | Job job_1 · source dwg:plan.dwg · scale ×1.000 | plan.dwg |
| Scale field | Known south-wall length (m) — scale confirm | Length of the south wall (m) |
| Scale button | Apply scale from known length | Set scale |
| Scale status | Hint: south wall = 5 m in extract space → factor 1.000 / No scale hint on this extract — enter a known length if needed. | The drawing suggests this wall is 5 m. / No scale found. Enter a length you know to set it. |
| Lists | Wall candidates · Opening candidates · Room candidates | Walls found · Doors and windows found · Rooms found |
| List nudge | *(none)* | Leave out anything that doesn't belong. |
| Candidate toggle | Accepted / Rejected | **Included** / **Left out** (with `aria-pressed`) |
| Opening row | door · 0.90 m · inferred · block_name | Door · 0.90 m · estimated |
| Import actions | Start editing (immediate room) · Save as template | **Create room from plan** · Save as template |
| Template row | Title · 4 walls · shell · Instantiate · Delete | Title · 4 walls · **Use template** · Delete |
| Template count | 3 template(s) in local CMS (catalog3d.roomTemplates). | 3 saved in this browser. |
| `#btn-clear-room` | Clear room | Clear room *(+ confirmation, §5)* |

### 3.6 Room workspace — tools

| Element | Today | Visible now |
|---|---|---|
| Room status (with room) | Living · 5.00 m × 4.00 m · ceiling 2.70 m · 1 opening(s) · 2 placement(s) · authored | Living · 5.00 × 4.00 m · ceiling 2.70 m · 1 opening · 2 products *(provenance `authored` / `dwg_import` / `template:id` moves to the JSON view)* |
| Undo / Redo | Undo · Redo *(tooltips with shortcuts)* | *Unchanged* |
| Project buttons | Export project · Import project | *Unchanged* |
| `h3` | Shell materials · Wall material · Floor material | **Wall and floor finish** · Walls · Floor |
| `h3` | Draw walls | Draw walls |
| Draw button | Draw walls mode → *(on)* Draw walls on — click floor corners | **Draw walls** *(label stays fixed; state is `aria-pressed` + the stage hint)* |
| Opening button | Click wall to mark opening → *(on)* Opening mode on — click a wall | **Add opening** *(same)* |
| Place button | Click floor to place product → *(on)* Place mode on — click the floor | **Place product** *(same)* |
| Opening fields | Width · Height · Sill | Width ({unit}) · Height ({unit}) · Sill height ({unit}) |
| `h3` | Place furniture | **Place products** |
| Snap checkbox | Snap placement to nearest wall | Snap to nearest wall |
| List labels (`aria-label`, no visible heading) | Openings · Placements (rows end in Delete) | Openings · **Products** |
| Details summary | Room graph JSON | **Developer view: room data (JSON)** |

> **Why labels stay fixed:** a button that renames itself *and* sets `aria-pressed` tells a screen reader the state twice, and tells sighted users something different from what they clicked. One stable label plus the stage hint carries the state.

*Unchanged:* Delete (list rows), Door / Window, Undo, Redo, Export project, Import project, Create room, Clear room, Reset camera, Download plan PNG.

---

## 4. Messages — status, errors, warnings

**Template for every message:** *what happened · what was kept · what to do next.* Plain words, no raw parser text, no internal names, never blames the user or the file. Engine messages stay as they are (unit tests pin several). A host-level `friendlyError()` maps them.

### A. Adding a model

| When | Today | Now |
|---|---|---|
| Working | Loading model… | Adding your model… |
| Success | Added “X” · 3 slot(s) · 2 MTL material(s) in library · session only · {note} | Added “X” · 3 parts · 2 materials from the .mtl · gone when you refresh |
| Nothing chosen | No files selected | Choose a file first. |
| Both kinds | Upload either an OBJ package or a GLB/glTF — not both at once | Add an OBJ package or a GLB/glTF, not both at once. |
| Wrong type | Select a .glb, .gltf, or .obj file (include .mtl + textures with OBJ when available) | That file type isn't supported. Use .glb, .gltf or .obj (with its .mtl and textures). |
| Unreadable, 1st | Could not load model (x.glb): Unexpected token '\u0000'… | “x.glb” couldn't be read as a 3D model, so nothing was added. Try re-exporting it as .glb. |
| Unreadable, 2nd | *(same raw text again)* | Still not readable. Compressed GLBs (Draco or Meshopt) may not load here. Re-export without compression, or try an .obj. |
| Unreadable, 3rd | *(same raw text again)* | Still no luck. You can carry on with the demo products, or start a room without this model. |
| No .obj | No .obj file in selection | Add the .obj file too. The other files can't make a model on their own. |
| Several .obj | Select one .obj file (plus its .mtl / textures / .slots.json) | Choose one .obj at a time, plus its .mtl, textures and .slots.json. |
| Empty .obj | OBJ file is empty | That .obj file is empty. |
| Bad .obj | Could not parse OBJ (x.obj): … | “x.obj” isn't a valid .obj file, so nothing was added. |
| No shapes | OBJ has no meshes: x.obj | “x.obj” has no shapes in it, so nothing was added. |
| Convert failed | OBJ→GLB export failed: … | Couldn't convert the .obj. Try a .glb instead. |
| Bad sidecar | Invalid sidecar JSON (x.slots.json): … | “x.slots.json” isn't valid JSON. Fix it or leave it out. |
| Sidecar shape | Sidecar must be a JSON object of name → material_slot_id | A .slots.json file should look like `{ "partName": "slotName" }`. |
| OBJ note: no .mtl | No .mtl in selection — geometry loads with default materials… | No .mtl file, so materials use defaults. |
| OBJ note: .mtl broken | MTL failed to parse — loading geometry without materials (…) | The .mtl file couldn't be read, so materials use defaults. |
| OBJ note: textures | MTL references missing textures (not in upload): a.png, b.png | Textures missing from your selection: a.png, b.png. Add them next time. |
| OBJ note: one part | No usemtl / named groups / sidecar — bound whole model to surface slot | The model has no named materials, so it changes as one part. |
| OBJ note: parts found | Slots from usemtl/groups: top, legs | Parts found: top, legs. |

### B. Adding a texture

| When | Today | Now |
|---|---|---|
| No file | Choose an image first | Choose an image to add. |
| Wrong type | Texture must be PNG, JPEG, or WebP | That isn't a PNG, JPEG or WebP image. Choose a different file. |
| No target | Select a target material | Choose which material to add it to. |
| New material | Added “X” to library — pick it on a matching slot swatch | Added “X”. Find it in the swatches for any {category} part. |
| Map attached | Attached normal map to “X” | Added the normal map to “X”. |

### C. Packs and `.mjs`

| When | Today | Now |
|---|---|---|
| Working | Importing pack (MJS runs JS)… / Importing module (runs JS)… | Loading pack… / Loading file… |
| Only a .glb | Saved pack-mate GLB “x.glb”. Now select the matching .mjs (or multi-select both). | Got “x.glb”. Now add the matching .mjs. |
| Pack-mate added | Pack-mate GLB ready: “x.glb”. Select the .mjs (Load pack) to pair by basename. | Got “x.glb”. Now add the .mjs with the same name. |
| …and matches open pack | · basename matches current pack — re-select the .mjs to load the complete pack. | This matches the pack you have open. Add the .mjs again to complete it. |
| No .mjs | Select a .mjs file (optionally with sibling .glb) | Choose a .mjs file, with its .glb if you have it. |
| Wrong type | Select a .mjs ES module file | Choose a .mjs file. |
| Loading is off | MJS loading is disabled (Catalog 3D → enable trusted .mjs loads) | .mjs loading is off. Turn on “Allow .mjs files” to continue. |
| Cancelled | MJS load cancelled by user | Cancelled. Nothing was loaded. *(neutral style, not an error)* |
| Not a pack | Module is not a mesh file and does not export createAsset()… Exports: a, b. Expected Polyfork-style… | This .mjs isn't a furniture pack. It doesn't provide a model. It exports: a, b. A pack needs a function called createAsset. |
| Pack loaded | Pack “X” + x.glb (basename) · slots · exports: a, b | Loaded pack “X” with “x.glb”. |
| Pack incomplete | Pack “X” · GLB missing (createAsset fallback) · … | Loaded “X” without a .glb, so you see a basic version. Add the .glb to complete the pack. |
| Colors not matched | Param “k” updated, but mapping is Unknown — GLB materials unchanged. | “k” changed, but this pack's colors couldn't be matched to the model, so you won't see it. |
| Rebuilt | Rebuilt from createAsset() after geometry param “k” · pack GLB superseded for this session | Rebuilt the model after changing “k”. The original .glb isn't shown for the rest of this session. |
| Recolored (basic) | Fallback COLOR_0 remap (812 verts, zones: a, b) | Recolored the model (basic mode). |
| Colors applied | Applied pack colors to slots: a, b | Applied colors to: a, b. |
| Pack panel title | MJS pack params | **Pack options** |
| Geometry label | Name (geometry) | Name *(rebuilds model)* |
| Toggle values | true / false | On / Off |
| Panel note: split | COLOR_0 zones split into material_slot meshes — colorway / library swatches apply per zone. Geometry params rebuild via createAsset(). | Colors apply to the pack's zones. Options marked *(rebuilds model)* rebuild it from the pack's code. |
| Panel note: slots | Colors apply to mapped GLB slots. Geometry params rebuild via createAsset(). | Colors apply to matching parts. Options marked *(rebuilds model)* rebuild it from the pack's code. |
| Panel note: fallback | Fallback: colorways remap GLB COLOR_0 in place (zone split failed)… | Basic mode: colorways recolor the whole model. Swatches won't work for this pack. |
| Panel note: unknown | Mapping Unknown — color controls may not affect the GLB; geometry rebuild uses createAsset(). | This pack's colors couldn't be matched to the model, so color options may not change it. Options marked *(rebuilds model)* still work. |
| Geometry hint | Geometry-affecting params (state / pages / bands / corners) rebuild the mesh from createAsset() — the pack GLB is a static snapshot. | These options rebuild the model from the pack's code. The original .glb is replaced for this session. |
| Swatch blocked | Pack / module keeps embedded or MJS-driven materials — library swatches do not replace them… | This pack controls its own colors, so swatches won't change it. Use the pack options above. |

### D. Slot warnings (below the Materials card)

| Today | Now |
|---|---|
| Catalog slots not found in model: x | These parts can't be changed because the model doesn't label them: x. |
| Model slots not defined in catalog (ignored): x | Ignored: the model has parts the catalog doesn't list (x). |
| Untagged meshes keep placeholder material: x | Unlabeled parts keep a plain placeholder look: x. |
| Computed missing normals on: x (export with normals for best quality) | Fixed missing shading data on x. Re-export with normals for best quality. |
| Meshes without UVs — textures will look flat/wrong: x | x has no UV mapping, so textures will look flat or wrong. Re-export with UVs. |
| OBJ import: obj-usemtl (MTL→PBR is best-effort; library swatches are SoR) | Converted from OBJ. Colors from the .mtl are approximate. Library swatches take priority. |
| Embedded / MJS-driven materials preserved. Library swatches are display-only… | This model keeps its own materials, so library swatches won't change it. |
| Unknown material mapping for: x | Couldn't match these colors to the model: x. |

*Critical styling stays for the "couldn't match" and "incomplete" cases. Today it is triggered by a regex on the message text (`/unknown|incomplete/i`), so the rewritten strings would silently lose it. Switch to a flag on the message, not a text match.*

### E. Importing a plan

| When | Today | Now |
|---|---|---|
| No file | Choose a plan file, or use Load mock fixture. | Choose a plan file, or try the sample plan. |
| Working (file) | Deriving candidates from x.dwg… | Reading x.dwg… |
| Working (sample) | Loading mock fixture extract… | Loading the sample plan… |
| Working (image) | Starting raster underlay from x.png… | Loading x.png… |
| Image ready | Underlay ready — confirm width/depth, then create room. | Image loaded. Check the size, then create the room. |
| PDF | PDF plan ingest needs a rasterizer (e.g. pdf.js) or a pre-rendered PNG/JPG. Upload PNG/JPG for underlay confirm. | PDF isn't supported yet. Export the page as PNG or JPG and add that instead. |
| Wrong type | *(`.ifc`, `.exe` and random bytes currently get a mock result)* | “x.ifc” isn't a plan format we can use. Try PNG, JPG, WebP, DWG, DXF or JSON. |
| Not a real DWG | *(random bytes named .dwg get 3 "Accepted" walls)* | This doesn't look like a DWG file, so nothing was imported. |
| Bad JSON | Candidates payload must be a JSON object / Unsupported candidates schema_version (expect 1) / Candidates must include walls[] and rooms[] | This JSON file isn't in the expected plan format. It needs a list of “walls” and “rooms”. |
| Image size | Underlay width and depth must be positive meters | Width and depth need to be above 0. |
| Scale | Scale factor must be a positive number / Known length must be positive | Enter a length above 0. |
| Scale: none | No scale hint on this extract | No scale found. Enter a length you know. |
| Too few walls | Accept at least 3 wall candidates before confirming | Include at least 3 walls to make a room. |
| No room | Accept at least one room candidate before confirming | Include at least one room. |
| Created (sample) | Immediate room from import · mock_fixture · place Catalog 3D GLBs | Room created from the sample plan. Now place products. |
| Created (image) | Room from underlay · x.png · place Catalog 3D GLBs | Room created from x.png. Now place products. |
| Template saved | Saved template “X” — instantiate from From template | Saved “X” as a template. |
| Template used | Instantiated template “X” | Started a new room from “X”. |

### F. Room, saving and starting up

| When | Today | Now |
|---|---|---|
| Size invalid | Room size must be positive (length, width, ceiling height, wall thickness) | **{Field}** needs a number above 0. *(fallback if the field isn't named: Length, width, ceiling and wall thickness all need to be above 0.)* |
| Size implausible | *(accepted: 1 mm rooms, 1,000,000,000 m rooms)* | That's {value}. Did you mean {suggestion}? *(needs min/max; undecided, see §10)* |
| Created | *(status shows the summary only)* | Room created. Add doors, windows or products below. |
| Click off-target: wall | Click a wall to place the opening. | *(unchanged)* |
| Click off-target: floor | Click the floor inside the room to place furniture. | Click the floor inside the room. |
| Click off-target: corner | Click the floor to add wall corners. | *(unchanged)* |
| Draw progress | Draw wall: 3 point(s) — click near first to close | 3 corners. Click the first one to close. |
| Draw closed | Closed freeform room · 6 walls | Room closed · 6 walls. |
| Draw too few | Need at least 3 corners to close a room | Add at least 3 corners before closing. |
| Draw too short | Degenerate polygon — walls too short | Those walls are too short. Try corners further apart. |
| Opening added | Added door on wall · procedural placeholder mesh (not a catalog SKU) | Added a door. |
| Opening too big | Opening exceeds wall length (4.00 m) / Opening exceeds wall height (2.70 m) | That opening doesn't fit on this wall (wall is 4.00 m long). Make it narrower or click nearer the middle. / That opening is taller than the wall (2.70 m). |
| Sill | Sill height cannot be negative | Sill height can't be below 0. |
| No model | Select a Catalog 3D product with a GLB (or pack) first. | This product has no 3D model to place. Choose another. |
| Placing | Placing “X”… | Placing “X”… |
| Placed | Placed “X” on the floor | Placed “X”. |
| Placed, overlap | Placed “X” · Soft overlap warning (placement allowed): wall, furniture (Y) | Placed “X”. It overlaps a wall and “Y”. You can leave it, or delete it from the list below. |
| Place failed | Place failed: Module factory not registered for this product | Couldn't place “X”. Load its pack again and try once more. |
| Undo / Redo | Undid last room change / Redid room change | Undid last change. / Redid change. |
| Plan PNG | Downloaded plan PNG / Plan export failed: … | Plan saved as PNG. / Couldn't create the PNG. Try again. |
| Export | Exported project JSON (room graph + templates) | Project saved to a file (room and templates). Uploaded models aren't included. |
| Import ok | Imported project “X” | Opened project “X”. |
| Import failed | Import failed: room_graph failed normalizeRoomGraph | Couldn't open that file. It isn't a Catalog 3D project, or it's damaged. **Your current room is unchanged.** |
| No room yet | Create or load a room first. | Create a room first. |
| **Saving blocked** | *(silent; stress test E2, F3)* | **Your browser won't save your work.** It stays safe while this tab is open. Choose **Export project** to keep it. |
| **Saved room unreadable** | *(boots into error; stress test R6)* | **Your saved room couldn't be read, so we started with an empty one.** [Download the damaged data] |
| Template list damaged | *(uncaught error, empty list; R8)* | Some saved templates couldn't be read and were skipped. |

---

## 5. Confirmations

| Action | Title | Body | Buttons |
|---|---|---|---|
| **Clear room** (resets undo today) | Clear this room? | This removes the walls, {n} openings and {m} placed products. **You can't undo it.** Export project first if you want to keep it. | **Clear room** · Keep room |
| **Replace room** (Create room, Use template, Create room from plan/image, Open project; shown only if a room exists) | Replace your current room? | Your current room and its {m} placed products will be replaced, and **you won't be able to undo it.** Export project first to keep a copy. | **Replace room** · Keep current room |
| **Delete template** | Delete “X”? | This template will be removed from this browser. You can't undo this. | **Delete template** · Keep template |
| **Load .mjs** (today a `window.confirm`) | Run code from “x.mjs”? | An .mjs file is a program, not a model. It runs in this page and can do anything the page can. Only continue if you trust where it came from.{if flagged:} A quick scan flagged: fetch(, localStorage. These are unusual for a furniture pack.{if not pack-like:} This file doesn't look like a furniture pack. | **Load and run** · Don't load |
| **Start over** (prototype) | Start over? | This clears your project and {n} placed items. | **Start over** · Keep working |

> `window.confirm` can't relabel its buttons. Use a `<dialog>` so the buttons say what they do. If `confirm` stays, end the body with *Choose OK to load, or Cancel to stop.*

Destructive buttons are styled critical and are **not** the primary-colored button. This is the stress test's E3 and T3 finding, where the prototype's *Start over* looks like the main action.

---

## 6. Planner-flows prototype

Both UIs should speak in one voice and one vocabulary. The prototype's output is called **Parts list** here (the viewer already uses that term). *BOM* appears only in the reseller card.

### 6.1 Visible copy

| Element | Today | Visible now |
|---|---|---|
| Top-bar badge | Simulated Planner 5D–style UI (not official) | **Prototype · nothing is saved** *(the "inspired by" note moves to ? › What's simulated)* |
| Pills | Not signed in / No project | **No account needed** / No project yet |
| Hero | Plan rooms. Place real products. Own the BOM. | **Plan a room. Place real products. Get your parts list.** *(alternatives §7)* |
| Lede | Pick a persona to walk the Room Vibez shell around a simulated planner canvas. Architecture ingest favors DWG; furniture stays mesh + library materials. | Choose who you are to see the flow built for you. |
| Email | Email *(pre-filled alex@example.com)* | Email (optional) · *placeholder you@example.com* · helper: *Nothing is sent or saved.* |
| Step chips | 1 · Role … 5 · BOM | 1 · Role · 2 · Project · 3 · Plan · 4 · Edit · 5 · **Parts list** |
| Role heading | Who are you? | Who's this for? |
| Role: consumer | Regular person — Upload a photo/PDF plan, place furniture, share PDF. | **Planning my own space** — Add a plan, place products, share a PDF. |
| Role: designer | Interior designer — Templates, materials library, client-ready layout. | **Interior designer** — Start from templates, pick finishes, share a client-ready layout. |
| Role: architect | Architect — DWG import note + hybrid room graph (not native CAD). | **Architect** — See how a DWG plan becomes an editable room. |
| Role: reseller | Reseller / ops — Catalog SKUs + owned Room Vibez BOM. | **Reseller or catalog manager** — Match catalog SKUs to what's placed. Reads as a BOM. |
| Buttons | Continue · Open demo project | Continue · **Skip to a demo project** *(keeps your role if you picked one)* |
| Project lede | Start blank, from an owned Room Vibez template (CMS stub), or jump to plan upload. | Start blank or from a template. |
| Project name | *(pre-filled Living room — sample)* | *placeholder: e.g. Living room* |
| Blank card | Blank room — Empty canvas · manual draw | **Blank room** — Start with an empty room. |
| Template card | Template: Warm loft — Owned CMS stub · not claimed as Planner template manager | **Warm loft** — A furnished starting point. |
| Third card (disabled) | Planner official template hub — Unknown / not in public Planner docs | *(removed from the screen)* |
| Create button | Create & upload plan | **Next: add a plan** |
| Upload lede | Accept DWG / PDF / JPG / PNG. AI recognition is async and illustrative (no SLA). Always allow human confirm or manual draw. | DWG, PDF, JPG or PNG. You'll review the result before editing. |
| Upload zone | Drop or click to choose a file · Demo accepts a selection chip — no real file upload. | **Choose a file** · *This demo doesn't read your file. Pick a type to see the flow.* *(drag-and-drop isn't wired; remove "Drop")* |
| Recognition card | AI recognition (illustrative) · Queued… · Recognizing PNG… (illustrative delay) · Detecting walls… (demo) · Building editable room… (demo) · Draft ready — confirm dimensions · Wait times here are fake demo delays — not a vendor SLA. | **Reading your plan (demo)** · Reading your PNG… · Finding walls… · Building the room… · Ready to review. · *Demo only. This animation is simulated.* |
| Confirm card | Human confirm · Detected ≈ 4.2 m × 5.1 m living room · 2 openings. Review before editing. | **Check the result** · *Sample result: about 4.2 × 5.1 m living room, 2 openings. Every file gives this same example.* |
| Confirm controls | Dimensions look right · Confirm & open editor · Skip AI · manual draw | I've checked the dimensions · **Open editor** · **Draw it myself** *(and reset the tick whenever a new file is chosen)* |
| Architect note | DWG is accepted for import / AI assist and as architecture source of truth. This prototype does not fake native DWG CAD editing. Optional future: ODA Drawings inWEB or Autodesk APS… | **DWG is import-only here.** You can't edit CAD in this prototype. |
| Disabled CAD button | Native DWG CAD edit — Unknown / not in public Planner docs as AutoCAD-class | *(removed)* |
| Bottom buttons | Back · Manual draw only | Back · *(removed — duplicate of Draw it myself)* |
| Sidebar `h2`s | Tools · Catalog · Owned CMS | Tools · **Products** · **Templates** |
| Tools | Select · Draw wall · Place furniture | Select · **Draw walls** · **Place products** |
| Catalog item | Loft Chair · CHAIR-LOFT-01 · multi-slot | Loft Chair · CHAIR-LOFT-01 · 3 finishes |
| Disabled item | Live ERP stock — Unknown / not in public Planner docs | **Live stock** — *Not available yet* |
| Template button / note | Apply starter template / Room Vibez template stub — not Planner's template manager. | **Add starter products** *(after one use: Starter products added)* / *(note removed)* |
| Toolbar | Light preset: Soft day · Render preset: Preview · 4K photoreal (usage) — confirm on contract | **Lighting: Soft day** · **Render style: Preview** *(see §10, item 4)* · *(4K control removed until it exists)* |
| Tool hint | Select tool / Click canvas to place sample walls / Click canvas to place selected SKU | Select a product / **Click the plan to draw walls. The demo always draws the same room shape.** / Click the plan to place “{name}” |
| Canvas hint | Click “Draw wall” then click two corners on the grid (demo places a sample room). | Pick a tool on the left, then click the plan. |
| Selection | Nothing selected · Place the Loft Chair to edit material slots. | Nothing selected · Place a Loft Chair, then pick it to change its finishes. |
| Selection meta | CHAIR-LOFT-01 · wood:oak · plastic:slate · wool:sand | CHAIR-LOFT-01 · Wood: Oak · Plastic: Slate · Wool: Sand |
| Finishes | Materials library · Library finishes — not embedded in furniture files. · Slot: wood | **Finishes** · *(note moves to ?)* · Wood |
| Parts list panel | Room Vibez BOM (owned) · Not claiming Planner BOM manager — fed by placements. | **Parts list** · Updates as you place products. |
| Empty list | No lines yet — place catalog items. | Nothing here yet. Place a product to start your list. |
| Total | Total: €498 | **Total (placeholder prices): €498** |
| Panel buttons | Cart / BOM panel · SKU list · Planner BOM manager — Unknown / not in public docs | **Open parts list** · SKU list · *(disabled research label removed)* |
| BOM screen | Cart / BOM · Room Vibez owned · Lines below are Room Vibez system-of-record demos. Planner cart events would feed this service in a real embed. | **Parts list** · What you've placed, with placeholder prices. |
| BOM headings | BOM lines · SKU list · Share / export | Items · Catalog SKUs · Share |
| Export buttons | Export floor plan PDF (stub) · Export PNG (stub) · Optional GLB package (stub) · CAD export IFC/DWG — Partial / beta in public Planner docs | **Export plan as PDF** · **Export as PNG** · **Export 3D package** · *(CAD export removed until it exists)* |
| Restart | Start over | Start over *(with confirmation, §5, and styled as secondary)* |

### 6.2 Toasts and fallbacks

| When | Today | Now |
|---|---|---|
| Template applied | Owned CMS template applied (stub) | Template added. |
| Starter applied | Owned CMS starter contents applied | Starter products added. |
| Manual path | Manual draw path — AI skipped | Drawing from scratch. |
| Plan confirmed | Plan confirmed — opening editor | Plan confirmed. |
| Placed | Placed Loft Chair | *(unchanged)* |
| Walls | Walls updated (demo polygon) | Walls updated (sample shape). |
| Finish | wood → oak | Wood changed to Oak. |
| Finish, nothing selected | Select a multi-slot chair first | Select a Loft Chair to change its finishes. |
| Light | Light preset → Soft day | Lighting: Soft day. |
| Render | Render preset → Contrast+ (preview only) | Render style set to Contrast+. It doesn't change the image yet. |
| Exports | PDF export stub — consumer share path / PNG export stub / Optional GLB package stub (runtime target) | PDF export isn't available yet. / PNG export isn't available yet. / 3D package export isn't available yet. |
| 3D: no CDN | Three.js CDN unavailable — CSS 3D fallback (network needed for CDN) | 3D preview needs an internet connection. Showing a simple version instead. |
| 3D: no WebGL | WebGL unavailable — CSS 3D fallback / WebGL context missing — CSS 3D fallback | Your browser can't run full 3D. Showing a simple version instead. |
| 3D caption | CSS 3D fallback (Three.js CDN unavailable) / Three.js CDN preview — network required for script load | **3D preview shows one sample chair, not your whole room yet.** |

### 6.3 The prototype's ? pop-up (4 tabs)

**Walkthrough.** Five steps: choose who you are, create a project, add a plan, edit the room, review the parts list. The chips at the top show where you are.

**Roles.** The role you pick sets the label at the top. For Architect it also shows a note about DWG. The editor is the same for everyone.

**What's simulated.** Nothing is saved or sent. File upload is a demo: any file gives the same sample result, a 4.2 × 5.1 m living room with 2 openings. The 3D view shows one sample chair. Export buttons don't create files yet. Prices in € are placeholders. The look is inspired by planner apps but isn't Planner 5D's product. The 3D preview and fonts load from the web, so you need a connection.

**Why it's shaped this way.**
- A DWG is the architecture source. Furniture stays 3D models plus library materials.
- The parts list and templates are owned by Room Vibez, not by the planner. In a real embed, planner cart events would feed the parts list.
- Plan recognition always allows a human check or drawing it yourself.
- Not claimed: native CAD editing, or any recognition speed guarantee.

---

## 7. Alternatives for the high-stakes strings

### The ? button

| Option | Copy | Tone | Best for |
|---|---|---|---|
| **A (recommended)** | Tooltip **How this works** · `aria-label` Help: how this works | Plain, specific | Tells people the pop-up explains the *why* too, not just clicks |
| B | **Help** | Conventional, shortest | Where the pop-up only has how-tos |
| C | **Guide & decisions** | Candid, a bit insider | A team-facing build where design decisions are the point |

### Sample DWG/DXF banner

| Option | Copy | Tone | Best for |
|---|---|---|---|
| **A (recommended)** | **Sample result.** Your file was kept but not read. These walls come from a built-in example, not your drawing. | Direct, no blame | Anyone who might mistake it for a real extraction |
| B | **Sample plan.** We can't read DWG files yet, so this isn't your drawing. | Short, candid | Narrow sidebar |
| C | This is a sample, not your drawing. DWG reading isn't available in this version. | Formal | Client-facing demos |

### Saving blocked

| Option | Copy | Tone | Best for |
|---|---|---|---|
| **A (recommended)** | **Your browser won't save your work.** It stays safe while this tab is open. Choose **Export project** to keep it. | Calm, one action | Default. Reassures first, then gives the step |
| B | **Can't save in this browser.** Export project now so you don't lose your room. | Urgent | If users have already lost work to this |
| C | Saving is blocked here. Your room is safe while this tab is open. Export project to keep a copy. | Neutral | Admin or embedded contexts |

### Prototype headline

| Option | Copy | Tone | Best for |
|---|---|---|---|
| **A (recommended)** | **Plan a room. Place real products. Get your parts list.** | Warm, concrete | First-time visitors, all four roles |
| B | Plan rooms. Place real products. Know exactly what to buy. | Benefit-led | Consumer and reseller personas |
| C | Plan rooms. Place real products. Own the BOM. *(current)* | Insider, positioning | Only if the audience is resellers and ops |

### "Dispose & remount"

| Option | Copy | Tone | Best for |
|---|---|---|---|
| **A (recommended)** | **Restart 3D view** · tooltip *Rebuilds the 3D view. Your choices are kept.* | Plain | Keeping the control visible, because the e2e test uses `#btn-remount` |
| B | Reload viewer | Plain | Same |
| C | Move it into ? › For developers | — | If nothing but tests need it. See §10, decision 2 |

---

## 8. Rationale

- **Why 284 → 91 words.** Of the 14 paragraphs, 5 are removed outright (the tab label, the stage hint or the pop-up now does their job) and 9 are cut to one line. The explanation moved to the pop-up, where it can run long without crowding the tools. Each remaining line is either *moment-of-need* (the stage hint changes with your tool) or *honesty* (sample, placeholder, gone-on-refresh). Word counts use one tokenizer on both sides and skip bare `·` and `—` marks.
- **Why state-based stage hints.** "Draw walls", "Place product" and "Add opening" each had a static paragraph *and* a stage hint. The stage hint appears exactly when the tool is on, which is when the instruction is useful, so the static paragraph goes. The place hint now names the selected product, which answers the question the old paragraph left open ("which product?").
- **Why honesty labels stay.** The product's own rule is "refuses to look more capable than it is" (stress test §1). Hiding *sample result* behind a ? would break it. One short phrase plus **Why?** keeps the rule without the paragraph.
- **Why one ?, not many.** The sidebar is 340 px. One entry point keeps it quiet; the pop-up opens on the right tab so it still feels contextual.
- **Why stable button labels.** See §3.6. It also removes the "Opening mode on — click a wall" family of strings entirely.
- **Why plain terms.** *Slot, candidates, extract, underlay, fixture, instantiate, ingress, SoT/SoR, MVP, stub* are team vocabulary. They appear only in the pop-up (where *slot* is explained once) and in *For developers*. *Mock* becomes *sample* because it says what the person sees.
- **Why 3-part errors.** Today the viewer shows parser text (`Unexpected token '\u0000'…`) and one error mislabels a corrupt saved room as a model problem. Each message now says what happened, what was kept, what to do. Repeated failures escalate (§4.A) instead of repeating, per the stress test's E1.
- **Why confirmations name the consequence.** Six flows reset undo history with no warning: five replace the room and one clears it (verified in `main.ts`: 443, 502, 591, 638, 947, 1730). Buttons are labeled with the action (*Clear room / Keep room*), not OK/Cancel.
- **One vocabulary across both UIs.** *Parts list* (not BOM/Cart), *product* (not furniture/catalog item), *finish* in the prototype and *material* in the viewer (the viewer's library is called a materials library, so *material* stays there).

---

## 9. Localization notes

- **No i18n exists today** (stress test C2: zero references in `src/`). Put every string above in one `copy.ts` keyed by id, so translation is a second file, not a code change.
- **Plurals.** Replace `(s)` patterns (`opening(s)`, `placement(s)`, `template(s)`, `slot(s)`) with real plural forms (`Intl.PluralRules`). Languages differ in the number of forms.
- **Build whole sentences.** Several messages are glued from fragments (`… · ${a} · ${b}`). Translators need full sentences with placeholders, such as `Added “{name}” · {count} parts`.
- **Numbers and units.** Fields show the browser's decimal separator (`2,7`) while status lines always print `2.70 m` (stress test C4). Use one formatter. Currency `€` is hard-coded in the prototype; take it from the user's locale or setting.
- **Feet.** Inputs are decimal feet, but labels render as `9' 10.1"`. The ? explains this. The cleaner fix is one convention.
- **Expansion.** The sidebar is 340 px. German and Finnish run ~30% longer. Buttons here are ≤ 24 characters in English. Allow wrapping rather than truncating, and don't put text in fixed-width badges.
- **Keep untranslated:** GLB, glTF, OBJ, MTL, DWG, DXF, PNG, JPG, WebP, `.mjs`, `.slots.json`, SKU, and file names.
- **Quotes.** The code already uses curly “ ” around names. Use each locale's own quotation marks, and isolate file names with bidi isolation for right-to-left languages (names like `كرسي.obj` already work).
- **Idioms.** *Start over*, *Keep working* and *Draw it myself* are plain enough to translate. Avoid new idioms, and prefer *gone when you refresh* over metaphors.
- **Separators.** `·` and `×` are used as list and size separators. Fine in most scripts, but check them in right-to-left layouts.
- **Names in the pop-up.** *Three.js*, *Planner 5D*, *Roomle*, *ODA*, *Autodesk APS* and *Polyfork* are proper names. Don't translate.

---

## 10. Implementation notes

### Where to put it
A single `src/copy.ts` (all strings by id) and a small `src/help.ts` (the dialog, tabs, deep-link anchors). Add a host-level `friendlyError(err)` that maps engine messages to §4. **Don't edit engine strings:** several unit tests pin them.

### Strings that tests pin (change these and a test fails)

| Test | Pinned string | Plan |
|---|---|---|
| `e2e/dwg-plan-import.spec.ts:32`, `room-from-scratch.spec.ts:23` | `.brand` = `Catalog 3D` | Unchanged |
| `e2e/dwg-plan-import.spec.ts:38` | `#import-oda-note` contains `ODA / APS not available` | Keep that sentence in a visually-hidden span, or update the test |
| `e2e/dwg-plan-import.spec.ts:42-43` | `#import-extract-banner` contains `mock_fixture` and `ODA available: no` | Friendly line on top, original string kept inside a collapsed *Technical details*, or update the test |
| `e2e/dwg-plan-import.spec.ts:97` | `#template-list li button:has-text("Instantiate")` | **The "Use template" rename breaks this.** Add `data-action="use-template"` to the button and change the selector. This is the one permitted test edit. |
| `unit/dwgImport.test.ts:27, 76` | label contains `mock`; note matches `/not entity-parsed/i` | Engine unchanged |
| `unit/roomCollision.test.ts:21` | `/Soft overlap/` | Engine unchanged, host rewrites |
| `unit/modules.test.ts:53` | `Exports: materials, params` | Engine unchanged, host adds the friendly lead |
| `unit/library.test.ts:36, 51` | `/not in library/`; parts list has no `price` | Unchanged |
| `e2e/viewer.spec.ts:61` | Parts list contains `STUB-MAT-WL-TER` | Parts list JSON unchanged |

I grepped the tests for `getByText`, `getByRole`, `toHaveText`, `toContainText`, `toMatch`, `hasText` and `:has-text`. (My first pass missed `:has-text`, which is how the `Instantiate` pin above was found.) Everything else uses ids, `data-*` attributes and test ids, which all stay. `unit/mjsGuardrails.test.ts` checks the scan only, not the confirm text, so the §5 rewrite is safe.

### Copy that needs a code change (the words are ready, the behavior isn't)

| Copy | Needs | Stress-test ref |
|---|---|---|
| Saving blocked banner | `persistRoomGraph` reports failure (it swallows it today) | E2, F3 |
| Saved room unreadable / quarantine | Boot catches and quarantines a bad `catalog3d.roomGraph`; harden `normalizeRoomGraph` | R6 |
| Clear / Replace / Delete template confirmations | A `<dialog>`, plus a "room has content" check | E3 |
| `{Field} needs a number above 0` and `(cm)` labels | Name the field in validation; unit text follows the Units select | R5, K1 |
| Wrong-type / not-a-DWG rejections | Validate before the mock path (`.ifc`, `.exe` and random bytes get a result today) | R3, R4 |
| A third label, **Not reviewed**, as the starting state | Candidates start unreviewed instead of accepted. "Create room from plan" then waits until each is reviewed or the user chooses *Include all*. Undecided; today's default is accepted | E4, R2 |
| Repeated-failure escalation | A per-session counter for upload failures | E1 |
| Prototype: reset "I've checked the dimensions" on new file; keep role on demo | State fixes | R2, K3 |

### Claims I verified in code (so the pop-up is true)
- Nothing leaves the browser: the only `fetch` calls load local library JSON and the sample plan (`main.ts:184`, `dwgImport.ts:212`).
- Wall drawing snaps to right angles and closes within 0.35 m of the first corner (`freeformWalls.ts`).
- Undo history resets on the five replace flows and on Clear (`main.ts`: 443, 502, 591, 638, 947, 1730).
- The unlabeled-model slot is called **Surface** (`uploads.ts:152`).
- Undo/redo shortcuts: Ctrl/Cmd+Z, Shift+Z, and Y (`main.ts:1782-1793`).
- FBX, USDZ and `.blend` are rejected with a "Select a .glb…" message (stress test R3, measured).

### Claims I inferred from code but did not run
- A room that used an uploaded product reopens without it after refresh. `reloadAllPlacements` silently skips products missing from the catalog, so the room's list still shows an entry with no model. **This is a real silent-failure gap**, and the pop-up warns about it. Worth fixing or surfacing.
- Draco/Meshopt GLBs may not load (from `README.md` known limitations, not tested).

### Decisions for you

1. **Voice and brand.** The viewer says *Catalog 3D*, the prototype says *Room Vibez* (stress test K5, open question 1 and 9). I kept both names where they appear and wrote one voice. I did not rename anything.
2. **Developer controls on the main screen.** *Restart 3D view*, *Developer view: room data*, and the Parts list JSON are demo or inspection aids. My default is relabel and keep (their ids are used by tests). The alternative is moving them into ? › For developers.
3. **Advanced uploads.** *Load pack* and *Load module* are team-facing. Optionally wrap both in one *Advanced: code packs (.mjs)* disclosure. Layout, not copy; check the e2e specs first.
4. **Prototype render-style control.** *Render style* cycles Preview / Contrast+ / Neutral commerce and changes nothing. Remove it until it does something, or keep it with the honest toast in §6.2. I wrote the toast but recommend removal.
5. **Size limits.** The "did you mean…?" message needs min/max room sizes, which are undecided (open question 10).
