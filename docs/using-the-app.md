# Using the app

This page follows the app's own **?** help (the five tabs you can open from the top bar), and adds what v2 changed. Where it says "new in v2", the behaviour arrived with the fix in this repository.

## Two workspaces

**Product** is where you look at one product and try materials. **Room** is where you build a room and place products in it. Switch with the Workspace control in the top bar. The app opens on Product with the demo lounge chair.

## Product

- **Choose a product** from the picker under *Product* (new in v2: a drop-down with rendered thumbnails, or a list; the view you pick is remembered). The two demo products are a lounge chair and a side table. Models you upload are added to the list, marked "your upload".
- **Move around.** Drag to spin the product, scroll to zoom, right-drag to pan. *Reset camera* puts it back.
- **Materials.** A product is made of parts (Frame, Handles, Pillow …), each called a slot. Pick a swatch under a part to change its material; each swatch shows its name (new in v2). A part offers only materials that suit it; uploaded models offer every material. If a model's parts are not labelled, the whole model is one part called *Surface*.
- **Add 3D model.** `.glb` is the best choice; `.gltf` with its companion files, or an `.obj` with its `.mtl` and textures, also work. FBX, USDZ and `.blend` are not supported. Uploaded models last until you refresh.
- **Advanced.** Texture upload (a new material from an image, or a normal or roughness map for an existing one), and the pack and module loaders for `.mjs` files. An `.mjs` file is a program; the app asks you to confirm before running it.
- **Lighting.** *Studio soft*, *Warm interior*, *Neutral* change the lighting only, never the model. These buttons sit on the 3D view.
- **Parts list.** Shows what is selected, part by part, as data. SKUs are placeholders; there are no prices.

## Room

The Room workspace is four steps, one open at a time (new in v2). With no room yet, the 3D view shows a card with four ways to start.

### 1 · Room

Start one of three ways, or draw:

- **From scratch.** Pick a preset or open *Adjust size* and type a length, width, ceiling height and wall thickness (new in v2: the typed size always wins; changing units converts the numbers). Then *Create room*.
- **Import plan.** Upload a plan image (PNG, JPG, WebP) and type its real width and depth; a room is traced at that size. A DWG or DXF file shows a clearly labelled **sample** room, because reading real CAD files is not set up. PDF is not supported.
- **From template.** Start from a room you saved earlier with *Save current room as template* (under *More*).
- **Draw walls.** Click corners on the floor, then click near the first corner to close. Corners snap to right angles. One closed room.

Starting a new room over one that has content asks you to confirm (new in v2). You cannot undo it; export first if you want to keep it.

### 2 · Openings

Pick Door or Window, set width, height and sill, choose *Add opening*, then click a wall. Openings cut a hole and show a plain placeholder shape; they are not catalog products. On arrival the two walls nearest the camera are cut away so you can see the floor; orbit to bring a wall back before clicking it.

### 3 · Place products

- **Add to room** (new in v2) places the product chosen in the picker at the first free spot, or the centre, with no pointer needed.
- **Place product** turns on pointer placement: click the floor where you want it. Clicks outside the room place nothing and say so on the 3D view. *Snap to nearest wall* lines the product up against a wall.
- **Materials** here apply to the next product you place. With a placed product selected, they apply to that product instead (new in v2).
- **Select a placed product** by clicking it in the 3D view or in the *Products* list (new in v2). Rows are numbered per product. Then: arrow keys move it 5 cm (Shift: 25 cm), **R** rotates 90° (Shift+R the other way), **Delete** removes it, **Esc** deselects. Each step can be undone. The list also has Rotate and Delete buttons. There are no on-screen move buttons yet, so on a touch screen a product cannot be moved.
- Overlaps with a wall or another product are allowed, with a warning.

### 4 · Wall and floor finish

Choose materials for the walls and the floor from the library, from pickers with category tabs (new in v2).

## Undo, saving, files

- **Undo / Redo** cover room changes: the buttons at the top of the Room panel, or Ctrl/Cmd+Z and Shift+Ctrl/Cmd+Z. Typing in a field is not affected.
- **Your room saves in this browser as you go.** Models, textures and plans you add do not; they are gone when you refresh, and a saved room that used one reopens without it and says so (new in v2).
- **Export project** saves the room and templates as a file. **Import project** opens one; it is available in the Room workspace even before a room exists (new in v2).
- **Clear room** asks first and tells you what it removes (new in v2). After it you stay in the Room workspace.
- **Download plan PNG** saves the 2D plan as an image.
- **Sizes** can be shown in metres, centimetres or feet. In feet, type decimals (9.5 = 9 ft 6 in).

## Feedback and help

- Messages about what you did on the 3D view (placed, could not place, overlap, undone …) appear as a short notice on the view itself, where you are looking (new in v2).
- The **?** button opens the help: *Start here*, *Product*, *Room*, *Files & saving*, and *How it's built*, which explains the design decisions and marks the ones still undecided.

## What to expect that is not finished

Some messages, especially after a failed upload or import, are still the engine's raw text rather than plain language. See [Known gaps](known-gaps.md).
