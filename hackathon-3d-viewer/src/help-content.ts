// Content of the ? pop-up. Source: docs/ux-copy-deck.md §2, copied word for word.
//
// One sentence differs from the deck (host wave 6a, copy handoff §2 "the pop-up may only state
// what is true"): Room tab, "Place products". The deck says "To move something, delete it from
// the list and place it again." A placed product can now be selected and moved with the arrow
// keys (UX-09), so it reads "…select it in the list and use the arrow keys."
//
// Everything here is static, authored HTML. Nothing a user typed (file names, template
// titles, product names) may ever be interpolated into these strings: help.ts assigns
// them with innerHTML.
//
// The one switch is Copy handoff §6 item A: the deck sentence "If your browser blocks
// saving, the app tells you." is only true once the saving-blocked banner exists, so
// both wordings ship and the host chooses (see `storageFailureIsSurfaced`).

export type HelpTabId = 'start' | 'product' | 'room' | 'files' | 'built';

/** Deep-link targets. `import-plan` is on the Room tab, `plans` on Files & saving. */
export type HelpAnchor = 'import-plan' | 'plans';

export interface HelpTab {
  id: HelpTabId;
  /** Tab label, also used as the option text in the Topic select. */
  label: string;
  /** Static authored HTML for the tab panel. */
  html: string;
}

export interface HelpContentOptions {
  /**
   * Copy handoff §6 item A.
   * false: "If your browser blocks saving, your room only lasts while this tab is open."
   * true:  "If your browser blocks saving, the app tells you." (deck wording)
   */
  storageFailureIsSurfaced: boolean;
}

/* ---- Strings around the content (all from deck §2 "Behavior") ---- */

export const HELP_TITLE = 'How Catalog 3D works';
export const HELP_BUTTON_TEXT = '?';
export const HELP_BUTTON_TOOLTIP = 'How this works';
export const HELP_BUTTON_ARIA_LABEL = 'Help: how this works';
export const HELP_CLOSE_ARIA_LABEL = 'Close help';
export const HELP_TOPIC_LABEL = 'Topic';

/** Where each deep link lands. `elementId` is the id inside the dialog. */
export const HELP_ANCHORS: Record<HelpAnchor, { tab: HelpTabId; elementId: string }> = {
  'import-plan': { tab: 'room', elementId: 'help-import-plan' },
  plans: { tab: 'files', elementId: 'help-plans' },
};

/** Copy handoff §6 item A: the two wordings of one sentence in "Files & saving". */
export const STORAGE_FAILURE_SENTENCE = {
  interim: 'If your browser blocks saving, your room only lasts while this tab is open.',
  surfaced: 'If your browser blocks saving, the app tells you.',
} as const;

/* ---- Tab 1: Start here ---- */

const START_HTML = `
<h3>How Catalog 3D works</h3>
<p>Look at furniture in 3D, change what each part is made of, and place it in a room you build.</p>
<ol>
  <li><strong>Product.</strong> Spin a model and try materials, part by part.</li>
  <li><strong>Room.</strong> Build a room from scratch, from a plan, or from a template. Then place products in it.</li>
  <li><strong>Switch</strong> between the two with the Workspace switch at the top.</li>
</ol>
<p><strong>Your work.</strong> Your room saves in this browser as you go. Models, textures and plans you add don't. They're gone when you refresh. To keep a room, choose <strong>Export project</strong>.</p>
<p>Nothing you add leaves your browser. This version has no accounts or cloud storage.</p>
`;

/* ---- Tab 2: Product ---- */

const PRODUCT_HTML = `
<h3>Look at a product</h3>
<ul>
  <li><strong>Choose</strong> a product from the list, or add your own model (see <em>Files &amp; saving</em>).</li>
  <li><strong>Move around.</strong> Drag to spin, scroll to zoom, right-drag to pan. <strong>Reset camera</strong> puts it back.</li>
</ul>
<h3>Change materials</h3>
<p>A product is made of parts, such as Frame, Handles and Pillow. Each part is called a <em>slot</em>. Pick a swatch under a part to change its material. A part only offers materials that suit it, so a pillow offers fabrics, not metal. Models you upload offer every material.</p>
<p>If a model's parts aren't labeled, the whole model counts as one part called <strong>Surface</strong> and changes together.</p>
<p><strong>Add texture.</strong> Upload an image to create a new material, or add a <em>normal map</em> or <em>roughness map</em> to a material you already have. New materials show up as swatches on matching parts.</p>
<p><strong>Lighting.</strong> <em>Studio soft</em>, <em>Warm interior</em> and <em>Neutral</em> change the lighting only. They never change the model file. <em>Neutral</em> is plain lighting without environment reflections.</p>
<p><strong>Parts list.</strong> Shows what's selected, part by part, as data. SKUs are placeholders and there are no prices yet.</p>
`;

/* ---- Tab 3: Room ---- */

const ROOM_HTML = `
<h3>Build a room</h3>
<h4>Start one of three ways</h4>
<ul>
  <li><strong>From scratch.</strong> Pick a preset or enter a size, then choose <strong>Create room</strong>.</li>
  <li id="help-import-plan" tabindex="-1"><strong>Import plan.</strong> Upload a plan image and enter its real size. A room is traced over it. DWG/DXF shows a sample result for now (see <em>Files &amp; saving</em>).</li>
  <li><strong>From template.</strong> Start a new room from one you saved. Any room can be saved as a template.</li>
</ul>
<p><strong>Starting a new room replaces the current one, and you can't undo it.</strong> Export first if you want to keep it.</p>
<h4>Shape the room</h4>
<ul>
  <li><strong>Draw walls.</strong> Choose <strong>Draw walls</strong>, click corners on the floor, then click near the first corner to close. Corners snap to right angles. This makes one closed room.</li>
  <li><strong>Doors and windows.</strong> Pick Door or Window, set the size, choose <strong>Add opening</strong>, then click a wall. They cut a hole and show a plain placeholder shape. They aren't catalog products yet.</li>
  <li><strong>Wall and floor finish.</strong> Choose materials for the walls and the floor from your library.</li>
</ul>
<h4>Place products</h4>
<ul>
  <li>Choose a product in the Product list, choose <strong>Place product</strong>, then click the floor. Turn on <strong>Snap to nearest wall</strong> to line it up against a wall.</li>
  <li>Overlaps with a wall or another product are allowed, with a warning. To move something, select it in the list and use the arrow keys.</li>
</ul>
<h4>Undo, save and share</h4>
<ul>
  <li><strong>Undo / Redo</strong> work for room changes: Ctrl/Cmd+Z, and Shift+Ctrl/Cmd+Z.</li>
  <li><strong>Download plan PNG</strong> saves the 2D plan as an image.</li>
  <li><strong>Export project</strong> saves your room and templates as a file. Open it later with <strong>Import project</strong>. Uploaded models aren't included, so add them again.</li>
  <li><strong>Sizes</strong> can be shown in meters, centimeters or feet. In feet, type decimals (9.5 = 9 ft 6 in). Results appear as feet and inches.</li>
</ul>
`;

/* ---- Tab 4: Files & saving ---- */

function filesHtml(storageFailureSentence: string): string {
  return `
<h3>3D models</h3>
<table>
  <thead>
    <tr><th scope="col">File</th><th scope="col">What to know</th></tr>
  </thead>
  <tbody>
    <tr><th scope="row"><code>.glb</code></th><td>Best choice. One file with everything inside.</td></tr>
    <tr><th scope="row"><code>.gltf</code></th><td>Select it together with its companion files (<code>.bin</code>, textures).</td></tr>
    <tr><th scope="row"><code>.obj</code></th><td>Select the <code>.obj</code> with its <code>.mtl</code> and texture images. An optional <code>.slots.json</code> names the parts. One <code>.obj</code> at a time, and don't mix OBJ with GLB.</td></tr>
    <tr><th scope="row">FBX, USDZ, <code>.blend</code></th><td>Not supported. Export to GLB or OBJ first.</td></tr>
  </tbody>
</table>
<ul>
  <li>Draco- or Meshopt-compressed GLBs may not load. Re-export without compression.</li>
  <li>For textures to look right, a model needs UV mapping. Without it, textures look flat. Re-export with UVs.</li>
</ul>
<h3>Packs (<code>.mjs</code> + <code>.glb</code>)</h3>
<p>A pack is two files with the same name. <code>name.glb</code> is the shape and <code>name.mjs</code> holds its colors and options. Select both at once, or add the <code>.glb</code> first and the <code>.mjs</code> second. A <code>.mjs</code> on its own shows a basic model and is marked incomplete.</p>
<p><strong>An <code>.mjs</code> file is a program, not a model.</strong> It runs in this page. You'll be asked to confirm, and a quick scan flags risky patterns, but that's a warning, not a guarantee. Only load files you trust. <strong>Allow .mjs files</strong> turns this off.</p>
<h3 id="help-plans" tabindex="-1">Plans</h3>
<ul>
  <li><strong>PNG, JPG, WebP.</strong> Trace over the image. You enter its real width and depth. Nothing is recognized automatically.</li>
  <li><strong>DWG, DXF.</strong> Your file is kept but not read. You'll see a clearly labeled sample room instead. Reading real DWG files needs a licensed library that isn't set up here.</li>
  <li><strong>JSON.</strong> A ready-made list of walls and rooms in Catalog 3D's plan format.</li>
  <li><strong>PDF.</strong> Not supported yet. Export the page as PNG or JPG.</li>
</ul>
<h3>What's saved</h3>
<table>
  <thead>
    <tr><th scope="col">What</th><th scope="col">Where it lasts</th></tr>
  </thead>
  <tbody>
    <tr><th scope="row">Room (walls, openings, placed products)</th><td>In this browser, automatically</td></tr>
    <tr><th scope="row">Templates</th><td>In this browser</td></tr>
    <tr><th scope="row">Models, textures and plans you add</th><td>Until you refresh</td></tr>
    <tr><th scope="row">Export project file</th><td>On your computer. Room and templates only.</td></tr>
  </tbody>
</table>
<p>Clearing your browser's site data removes saved rooms and templates. A saved room that used a product you uploaded reopens without that product. <span data-help-sentence="storage-failure">${storageFailureSentence}</span> Use <strong>Export project</strong> to keep your work.</p>
`;
}

/* ---- Tab 5: How it's built ---- */

const BUILT_HTML = `
<p><strong>Why Catalog 3D works the way it does.</strong> Where something is still undecided, it says so.</p>
<ol>
  <li><strong>One 3D engine, owned by us.</strong> Built on Three.js, with no Planner 5D or Roomle embedded. Whether Room Vibez embeds a third-party planner later is still open.</li>
  <li><strong>Materials live in a library, not in the model.</strong> A model file only names its parts. The catalog decides what each part can be made of. That keeps finishes consistent across products and lets one model be re-skinned.</li>
  <li><strong>Lighting is separate from models.</strong> Presets belong to the scene, so no product carries its own lights.</li>
  <li><strong>Rooms are stored as plain data.</strong> Walls, openings and placed products are saved as a "room graph" (JSON), and the 3D room is built from it. That's why every way of starting a room ends up the same, and why undo and export work.</li>
  <li><strong>A DWG is never the source of truth.</strong> A plan is a starting point you confirm. It then becomes a Catalog 3D room. There's no CAD editing. Reading real DWG/DXF needs ODA or Autodesk APS licenses. Which to use is undecided, so DWG/DXF shows a labeled sample for now.</li>
  <li><strong>A person confirms every import.</strong> There's no AI floor-plan recognition. You enter the real size and choose which walls to include.</li>
  <li><strong>Doors and windows are cutouts for now.</strong> Whether they become real catalog products later is undecided.</li>
  <li><strong>Overlaps warn but don't block.</strong> Whether to enforce placement rules later is undecided.</li>
  <li><strong>Defaults are starting points.</strong> 2.7 m ceilings, 12 cm walls, doors 0.9 × 2.1 m, windows 1.2 × 1.2 m with a 0.9 m sill. These are common ranges, not a product standard.</li>
  <li><strong>Code files are opt-in.</strong> <code>.mjs</code> files run code, so loading is opt-in and asks you to confirm.</li>
  <li><strong>No accounts, no cloud, no prices.</strong> Everything stays in your browser. SKUs are placeholders.</li>
  <li><strong>Not built yet:</strong> AR, real DWG reading, AI plan recognition, prices, catalog doors and windows, model compression, cloud projects.</li>
</ol>
<p><em>Full write-ups: <code>ARCHITECTURE.md</code> and <code>ASSUMPTIONS.md</code> in the project folder.</em></p>
<details class="help-developers">
  <summary>For developers</summary>
  <ul>
    <li><strong>Room graph JSON.</strong> <em>Developer view</em> in the Room workspace shows the room's data live. Rooms are stored in meters. Length runs along X, width along Z, and Y is up with the floor at 0.</li>
    <li><strong>Parts list.</strong> A JSON payload on every change, also fired as the window event <code>rv:partlistupdate</code>. Placeholder SKUs, no prices.</li>
    <li><strong>Slot labels</strong> are read in this order: glTF <code>extras.material_slot_id</code>, a sidecar map, then node names <code>slot_&lt;id&gt;__&lt;part&gt;</code>. The naming convention is ours, not a standard.</li>
    <li><strong>Restart 3D view</strong> rebuilds the engine and keeps your choices. It's a check that the viewer cleans up after itself.</li>
  </ul>
</details>
`;

/** The five tabs, in deck order: Start here · Product · Room · Files & saving · How it's built. */
export function buildHelpTabs(options: HelpContentOptions): HelpTab[] {
  const sentence = options.storageFailureIsSurfaced
    ? STORAGE_FAILURE_SENTENCE.surfaced
    : STORAGE_FAILURE_SENTENCE.interim;
  return [
    { id: 'start', label: 'Start here', html: START_HTML },
    { id: 'product', label: 'Product', html: PRODUCT_HTML },
    { id: 'room', label: 'Room', html: ROOM_HTML },
    { id: 'files', label: 'Files & saving', html: filesHtml(sentence) },
    { id: 'built', label: "How it's built", html: BUILT_HTML },
  ];
}
