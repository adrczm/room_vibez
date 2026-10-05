/**
 * Every user-facing string of the Catalog 3D viewer, keyed by id.
 *
 * WORDS: `docs/ux-copy-deck.md` is the source of truth. Strings in the deck groups below are
 * copied from it exactly (same words, punctuation, curly quotes and capitalisation). Do not
 * reword them here; change the deck first.
 *
 * LAYOUT: one top-level group per deck section, in deck order.
 *
 *   common           labels shared by several sections (Why?, Technical details, Delete)
 *   helperLines      deck §3.1  Static helper lines
 *   topBarAndStage   deck §3.2  Top bar and stage
 *   stageHints       deck §3.3  Stage hints by mode
 *   productCard      deck §3.4  Product card, uploads, materials, texture, lighting, parts list
 *   roomStart        deck §3.5  Room workspace: starting a room
 *   roomTools        deck §3.6  Room workspace: tools
 *   modelMessages    deck §4.A  Adding a model
 *   textureMessages  deck §4.B  Adding a texture
 *   packMessages     deck §4.C  Packs and .mjs
 *   slotWarnings     deck §4.D  Slot warnings
 *   planMessages     deck §4.E  Importing a plan
 *   roomMessages     deck §4.F  Room, saving and starting up
 *   confirm          deck §5    Confirmations (viewer only)
 *   notInDeck        NOT IN THE DECK: strings another handoff asked for. Add new ones there.
 *
 * Not here on purpose: the ? pop-up content (deck §2, `src/help-content.ts`) and the
 * planner prototype (deck §6, plain JS, cannot import this file).
 *
 * CONVENTIONS
 *   "{name}"            a placeholder. Fill it with `fmt(template, { name })`.
 *   { one, other }      plural forms. Pick one with `plural(n, forms)`; "{n}" becomes the count.
 *   "**bold**"          the deck's emphasis inside a sentence. Never assign such a string to
 *                       textContent as is: build nodes from `rich(text, vars)` or strip the
 *                       markers with `plain(text)`. Keys that carry markers say so in a comment.
 *   A trailing comment "variant" marks a form the deck implies but does not spell out (the
 *   window twin of a door string, a singular form, and so on). Each is listed in the wave-1
 *   copy report.
 *
 * No DOM access happens in this module, so it is safe to import from unit tests (node).
 */

/** Locale of the strings in this file. A translation is a second object of type `CopyShape`. */
export const LOCALE = 'en';

// ---------------------------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------------------------

/** Names of the `{placeholders}` in a literal template. */
type PlaceholderNames<S extends string> = S extends `${string}{${infer Name}}${infer Rest}`
  ? Name | PlaceholderNames<Rest>
  : never;

/**
 * The values a template needs. For a literal from `copy`, a missing or misspelt placeholder is a
 * compile error. For a plain `string` (for example the result of `plural`) any object is accepted.
 */
export type FmtVars<S extends string> = { [K in PlaceholderNames<S>]: string | number };

function substitute(template: string, vars: object): string {
  const values = vars as Record<string, string | number | undefined>;
  return template.replace(/\{(\w+)\}/g, (whole, key: string) => {
    const value = Object.prototype.hasOwnProperty.call(values, key) ? values[key] : undefined;
    return value === undefined ? whole : String(value);
  });
}

/**
 * Fill `{placeholder}`s in a template: `fmt(copy.roomMessages.placed, { name: 'Lounge chair' })`.
 * A placeholder with no value is left as it is, so a missing value shows up instead of throwing.
 * Values are inserted as text. Put the result in the DOM with textContent, never innerHTML.
 */
export function fmt<S extends string>(template: S, vars: FmtVars<S>): string {
  return substitute(template, vars);
}

/** Plural forms keyed by CLDR category. English uses `one` and `other`. */
export interface PluralForms {
  readonly one: string;
  readonly other: string;
  readonly zero?: string;
  readonly two?: string;
  readonly few?: string;
  readonly many?: string;
}

const pluralRules = new Intl.PluralRules(LOCALE);
const countFormat = new Intl.NumberFormat(LOCALE);

/**
 * Pick the plural form for `n` (`Intl.PluralRules`, never "(s)") and put the count in for "{n}".
 *
 *   plural(2, copy.roomTools.productCount)      -> "2 products"
 *   plural(1, '{n} wall', '{n} walls')          -> "1 wall"
 *
 * Other placeholders are left for `fmt`: `fmt(plural(n, forms), { name })`.
 */
export function plural(n: number, forms: PluralForms): string;
export function plural(n: number, one: string, other: string): string;
export function plural(n: number, formsOrOne: PluralForms | string, other?: string): string {
  const forms: PluralForms =
    typeof formsOrOne === 'string' ? { one: formsOrOne, other: other ?? formsOrOne } : formsOrOne;
  const form = forms[pluralRules.select(n)] ?? forms.other;
  return form.replace(/\{n\}/g, countFormat.format(n));
}

/** One run of text from a string that uses `**bold**` markers. */
export interface RichSegment {
  text: string;
  strong: boolean;
}

/**
 * Split a string on its `**bold**` markers so the host can build DOM nodes (a `<strong>` for
 * `strong` runs, a text node otherwise). Placeholders are filled after the split, so a file or
 * product name that happens to contain asterisks cannot change the emphasis.
 */
export function rich<S extends string>(template: S, vars?: FmtVars<S>): RichSegment[] {
  const out: RichSegment[] = [];
  template.split('**').forEach((part, i) => {
    if (!part) return;
    out.push({ text: vars ? substitute(part, vars) : part, strong: i % 2 === 1 });
  });
  return out;
}

/** Remove `**bold**` markers: for textContent, `title`, `aria-label` and plain dialogs. */
export function plain(text: string): string {
  return text.replaceAll('**', '');
}

type CopyTree = { readonly [key: string]: string | CopyTree };

// ---------------------------------------------------------------------------------------------
// The strings
// ---------------------------------------------------------------------------------------------

export const copy = {
  // ===========================================================================================
  // Shared labels
  // ===========================================================================================
  common: {
    /** Link beside the import nudge (§3.1 #5), the sample banner (§3.5) and the Parts list note. Opens the ? pop-up. */
    why: 'Why?',
    /** `<summary>` of the collapsed block that keeps an original technical string (§3.5, §10). */
    technicalDetails: 'Technical details',
    /** List rows and template rows (§3.5, §3.6 "Unchanged"). */
    delete: 'Delete',
  },

  // ===========================================================================================
  // Deck §3.1  Static helper lines
  // Rows 3, 4, 6, 8 and 9 are removed by the deck, so they have no string.
  // ===========================================================================================
  helperLines: {
    /** #1 `#workspace-mode-hint` in the Product workspace. */
    workspaceHintProduct: 'Spin a product and try materials.',
    /** #1b `#workspace-mode-hint` in the Room workspace. */
    workspaceHintRoom: 'Build a room, then place products in it.',
    /** #2 `#stage-hint` default. Same words as `stageHints.product`. */
    stageHintDefault: 'Drag to spin · scroll to zoom · right-drag to pan',
    /** #5 `#import-oda-note`. Followed by a `common.why` link. */
    importNote: "Best with a PNG or JPG. DWG/DXF shows a sample result for now. PDF isn't supported yet.",
    /** #7 `#template-status` when there are no templates. */
    templatesEmpty: 'No templates yet. Save a room to reuse it.',
    /** #10 Add 3D model hint. */
    addModelHint: '.glb works best. OBJ and glTF also work.',
    /** #11 Load pack hint. */
    loadPackHint: 'Select both files together. Runs code — only load files you trust.',
    /** #12 Load module hint. */
    loadModuleHint: 'Use Load pack if you also have the .glb.',
    /** #13 Add texture hint. */
    addTextureHint: 'PNG, JPEG or WebP. Gone when you refresh.',
    /** #14 `#room-status` with no room (one string for both of today's variants). */
    roomStatusEmpty: 'No room yet. Pick a way to start above.',
    /** "new" row: the Parts list note. Followed by a `common.why` link (Copy Phase 2). */
    partsListNote: 'Placeholder SKUs · no prices',
  },

  // ===========================================================================================
  // Deck §3.2  Top bar and stage
  // ===========================================================================================
  topBarAndStage: {
    /** `.brand`. Pinned by e2e. */
    brand: 'Catalog 3D',
    workspaceLabel: 'Workspace',
    workspaceProduct: 'Product',
    workspaceRoom: 'Room workspace',
    /** The new help button: its visible glyph, tooltip and accessible name (deck §2 "Behavior"). */
    helpButton: '?',
    helpTooltip: 'How this works',
    helpAriaLabel: 'Help: how this works',
    /** `#btn-reset`. */
    resetCamera: 'Reset camera',
    /** `#btn-remount`. */
    restartView: 'Restart 3D view',
    restartViewTooltip: 'Rebuilds the 3D view. Your choices are kept.',
    /** `#viewer-overlay`. */
    loading: 'Loading…',
    /** Overlay error: no WebGL. Carries ** markers. */
    overlayNoWebgl:
      "**3D isn't available in this browser.** Turn on hardware acceleration, or try another browser. On a Mac you can also open “Start Viewer (software 3D).command” from the viewer folder.",
    /** Overlay error: anything else (a boot failure). Carries ** markers. */
    overlayCouldntStart:
      "**The viewer couldn't start.** Reload the page. If it happens again, your saved room may be damaged.",
  },

  // ===========================================================================================
  // Deck §3.3  Stage hints by mode (the main nudges)
  // ===========================================================================================
  stageHints: {
    /** Product workspace. */
    product: 'Drag to spin · scroll to zoom · right-drag to pan',
    /** Room workspace, no room yet. */
    roomEmpty: 'Create or import a room to start.',
    /** Room workspace, no tool on. */
    roomIdle: 'Drag to orbit · scroll to zoom · right-drag to pan',
    /** Add opening on. Deck: "Click a wall to add a {door / window}." One full sentence per type. */
    addOpeningDoor: 'Click a wall to add a door.',
    addOpeningWindow: 'Click a wall to add a window.',
    /** Place product on. */
    placeProduct: 'Click the floor to place “{product}”.',
    /** Draw walls on. */
    drawWalls: 'Click floor corners. Click the first corner to close.',
  },

  // ===========================================================================================
  // Deck §3.4  Product card, uploads, materials, texture, lighting, parts list
  // ===========================================================================================
  productCard: {
    /** `#product-meta`: the SKU, plus " · your upload" for a product the user added. */
    productMeta: '{sku}',
    productMetaUpload: '{sku} · your upload',
    /** Product list option for an uploaded product. A demo product shows its name only. */
    productOptionUpload: '{name} · your upload',
    /** The same phrase on its own (picker sublabel, UX-14 step 4). */
    yourUpload: 'your upload',
    addModelLabel: 'Add 3D model',
    /** `#model-files` aria-label. Deck: unchanged. QA-14 objects to it: see the copy report. */
    addModelAriaLabel: 'Upload GLB, glTF, or OBJ package',
    loadPackLabel: 'Load pack (.mjs + .glb)',
    packMateLabel: 'Or add the .glb on its own',
    loadModuleLabel: 'Load module (.mjs only)',
    /** `#mjs-enabled` checkbox. */
    allowMjs: 'Allow .mjs files (they run code)',
    /** Card h2 (was "Material slots"). */
    materialsHeading: 'Materials',
    /** Swatch tooltip, unchanged: "Natural oak (STUB-MAT-WOOD-OAK)". */
    swatchTooltip: '{name} ({sku})',
    addTextureHeading: 'Add texture',
    textureImageLabel: 'Image',
    textureNameLabel: 'Name',
    textureNamePlaceholder: 'Optional',
    textureCategoryLabel: 'Category',
    /** Was "Map role". */
    textureUseAsLabel: 'Use as',
    /** Was "Target material". */
    textureAddToMaterialLabel: 'Add to material',
    /** `#texture-role` options, keyed by option value. */
    textureRoles: {
      map: 'Color (new material)',
      normalMap: 'Normal map (existing material)',
      roughnessMap: 'Roughness map (existing material)',
    },
    /** `#texture-category` options, keyed by option value. */
    textureCategories: {
      wood: 'Wood',
      textile: 'Textile',
      plastic: 'Plastic',
      stone: 'Stone',
      metal: 'Metal',
    },
    /** `#btn-add-texture`. */
    addToLibrary: 'Add to library',
    /** Card h2 (was "Light preset"), also the accessible name of the preset group (UX-07 item 3). */
    lightingHeading: 'Lighting',
    /** `#presets` buttons, keyed by preset id. */
    lightPresets: {
      'studio-soft': 'Studio soft',
      'warm-interior': 'Warm interior',
      neutral: 'Neutral',
    },
    partsListHeading: 'Parts list',
    /** Badge beside the Parts list heading (was "stub · onPartListUpdate"). */
    partsListBadge: 'Placeholder',
  },

  // ===========================================================================================
  // Deck §3.5  Room workspace: starting a room
  // ===========================================================================================
  roomStart: {
    /** h2 badge (was "MVP"). */
    badge: 'Preview',
    /** `#room-ingress` tabs, keyed by `data-ingress`. Unchanged. */
    ingress: {
      scratch: 'From scratch',
      import: 'Import plan',
      template: 'From template',
    },
    /** `#room-units` options, keyed by option value. */
    units: {
      m: 'Meters (m)',
      cm: 'Centimeters (cm)',
      'ft-in': 'Feet',
    },
    /** Dimension field labels. "{unit}" follows the Units select: see `notInDeck.unitAbbrev`. */
    lengthLabel: 'Length ({unit})',
    widthLabel: 'Width ({unit})',
    ceilingHeightLabel: 'Ceiling height ({unit})',
    wallThicknessLabel: 'Wall thickness ({unit})',
    /** `#room-preset` options, keyed by option value. */
    presets: {
      'small-bedroom': 'Small bedroom · 3 × 3 m',
      living: 'Living room · 5 × 4 m',
      studio: 'Studio · 6 × 4 m',
      custom: 'Custom size…',
    },
    /** `#template-title` label and placeholder. */
    templateNameLabel: 'Template name (optional)',
    templateNamePlaceholder: 'My room template',
    /** `#btn-save-template-scratch` and `#btn-import-save-template`. */
    saveAsTemplate: 'Save as template',
    /** `#btn-create-room`. */
    createRoom: 'Create room',
    /** Import badge (was "mock extract"). */
    importBadge: 'Sample only',
    /** Label of `#plan-file`. */
    planFileLabel: 'Plan file',
    /** `#btn-import-plan`. */
    uploadPlan: 'Upload plan',
    /** `#btn-import-fixture`. */
    trySamplePlan: 'Try the sample plan',
    /** Underlay heading. It replaces both the old heading and its badge. */
    traceHeading: 'Trace over your image',
    traceWidthLabel: 'Width (m)',
    traceDepthLabel: 'Depth (m)',
    /** `#btn-underlay-confirm`. */
    createRoomFromImage: 'Create room from image',
    /** Underlay note (`#underlay-status`). */
    traceNote: 'Enter the real size of this plan. A rectangular room will be traced to match.',
    /** `#import-extract-banner`, friendly line. Carries ** markers. Followed by a `common.why` link. */
    sampleBanner:
      '**Sample result.** Your file was kept but not read. These walls come from a built-in example, not your drawing.',
    /**
     * The original banner string, kept unchanged inside the collapsed `common.technicalDetails`
     * block. Not new copy. e2e pins "mock_fixture" and "ODA available: no" in it
     * (`dwg-plan-import.spec.ts:42-43`); "{oda}" is "yes" or "no".
     */
    sampleBannerTechnical: '[{path}] ODA available: {oda} — {note}',
    /** `#import-status` once a job exists: just the file name. */
    jobStatus: '{file}',
    /** Label of `#import-known-length`. */
    scaleFieldLabel: 'Length of the south wall (m)',
    /** `#btn-import-apply-scale`. */
    setScale: 'Set scale',
    /** `#import-scale-status` with and without a scale hint. "{length}" is a number of meters. */
    scaleSuggested: 'The drawing suggests this wall is {length} m.',
    scaleNotFound: 'No scale found. Enter a length you know to set it.',
    /** List headings (were "... candidates"). */
    wallsFound: 'Walls found',
    openingsFound: 'Doors and windows found',
    roomsFound: 'Rooms found',
    /** New nudge above the lists. */
    listNudge: "Leave out anything that doesn't belong.",
    /** Candidate toggle, with `aria-pressed`. */
    included: 'Included',
    leftOut: 'Left out',
    /** Opening row: "Door · 0.90 m · estimated". "{type}" is `openingTypes.door` or `.window`. */
    openingRow: '{type} · {width}', // variant: the row for an opening that is not estimated
    openingRowEstimated: '{type} · {width} · estimated',
    openingTypes: {
      door: 'Door',
      window: 'Window',
    },
    /** `#btn-import-start-editing`. */
    createRoomFromPlan: 'Create room from plan',
    /** Template row text: "Title · 4 walls". "{walls}" is `plural(n, wallCount)`. */
    templateRow: '{title} · {walls}',
    wallCount: {
      one: '{n} wall', // variant
      other: '{n} walls',
    },
    /** Template row button (was "Instantiate"). The button also gets `data-action="use-template"`. */
    useTemplate: 'Use template',
    /** `#template-status` with templates: "3 saved in this browser." */
    templateCount: {
      one: '{n} saved in this browser.',
      other: '{n} saved in this browser.',
    },
    /** `#btn-clear-room` (plus the confirmation in `confirm.clearRoom`). */
    clearRoom: 'Clear room',
  },

  // ===========================================================================================
  // Deck §3.6  Room workspace: tools
  // ===========================================================================================
  roomTools: {
    /**
     * `#room-status` with a room: "Living · 5.00 × 4.00 m · ceiling 2.70 m · 1 opening · 2 products".
     * "{size}" comes from `roomSize`, "{openings}" and "{products}" from the plural forms below.
     */
    roomSummary: '{name} · {size} · ceiling {ceiling} · {openings} · {products}',
    /** "5.00 × 4.00 m": two bare numbers, the unit once. */
    roomSize: '{length} × {width} {unit}',
    openingCount: {
      one: '{n} opening',
      other: '{n} openings', // variant
    },
    productCount: {
      one: '{n} product', // variant
      other: '{n} products',
    },
    undo: 'Undo',
    redo: 'Redo',
    /** Tooltips, unchanged. */
    undoTooltip: 'Undo (Ctrl/Cmd+Z)',
    redoTooltip: 'Redo (Ctrl/Cmd+Shift+Z)',
    exportProject: 'Export project',
    importProject: 'Import project',
    /** h3 (was "Shell materials") and its two field labels. */
    finishHeading: 'Wall and floor finish',
    wallsLabel: 'Walls',
    floorLabel: 'Floor',
    drawWallsHeading: 'Draw walls',
    /** Tool buttons. The label never changes; `aria-pressed` and the stage hint carry the state. */
    drawWalls: 'Draw walls',
    addOpening: 'Add opening',
    placeProduct: 'Place product',
    /** `#opening-type` buttons. Unchanged. */
    door: 'Door',
    window: 'Window',
    /** Opening field labels. "{unit}" as for the room size fields. */
    openingWidthLabel: 'Width ({unit})',
    openingHeightLabel: 'Height ({unit})',
    openingSillLabel: 'Sill height ({unit})',
    /** h3 (was "Place furniture"). */
    placeProductsHeading: 'Place products',
    /** `#place-wall-snap`. */
    snapToWall: 'Snap to nearest wall',
    /** `aria-label` of `#opening-list` and `#placement-list`. */
    openingsListLabel: 'Openings',
    productsListLabel: 'Products',
    /** `<summary>` of the room graph JSON. */
    developerView: 'Developer view: room data (JSON)',
    /** `#btn-download-plan`. Unchanged. */
    downloadPlanPng: 'Download plan PNG',
  },

  // ===========================================================================================
  // Deck §4.A  Adding a model
  // ===========================================================================================
  modelMessages: {
    working: 'Adding your model…',
    /**
     * Success: "Added “X” · 3 parts · 2 materials from the .mtl · gone when you refresh".
     * "{parts}" is `plural(n, partCount)`, "{materials}" is `plural(n, mtlMaterialCount)`.
     */
    added: 'Added “{name}” · {parts} · gone when you refresh', // variant: no .mtl materials
    addedWithMtl: 'Added “{name}” · {parts} · {materials} · gone when you refresh',
    partCount: {
      one: '{n} part', // variant
      other: '{n} parts',
    },
    mtlMaterialCount: {
      one: '{n} material from the .mtl', // variant
      other: '{n} materials from the .mtl',
    },
    nothingChosen: 'Choose a file first.',
    bothKinds: 'Add an OBJ package or a GLB/glTF, not both at once.',
    wrongType: "That file type isn't supported. Use .glb, .gltf or .obj (with its .mtl and textures).",
    /** Unreadable file: 1st, 2nd and 3rd consecutive failure. */
    unreadable: "“{file}” couldn't be read as a 3D model, so nothing was added. Try re-exporting it as .glb.",
    unreadableSecond:
      'Still not readable. Compressed GLBs (Draco or Meshopt) may not load here. Re-export without compression, or try an .obj.',
    unreadableThird:
      'Still no luck. You can carry on with the demo products, or start a room without this model.',
    noObj: "Add the .obj file too. The other files can't make a model on their own.",
    severalObj: 'Choose one .obj at a time, plus its .mtl, textures and .slots.json.',
    emptyObj: 'That .obj file is empty.',
    badObj: "“{file}” isn't a valid .obj file, so nothing was added.",
    noShapes: '“{file}” has no shapes in it, so nothing was added.',
    convertFailed: "Couldn't convert the .obj. Try a .glb instead.",
    badSidecar: "“{file}” isn't valid JSON. Fix it or leave it out.",
    /** The braces are a JSON example, not placeholders. Do not pass this one to `fmt`. */
    sidecarShape: 'A .slots.json file should look like { "partName": "slotName" }.',
    /** OBJ notes (shown after a successful OBJ upload). */
    objNoteNoMtl: 'No .mtl file, so materials use defaults.',
    objNoteMtlBroken: "The .mtl file couldn't be read, so materials use defaults.",
    objNoteTexturesMissing: 'Textures missing from your selection: {files}. Add them next time.',
    objNoteOnePart: 'The model has no named materials, so it changes as one part.',
    objNotePartsFound: 'Parts found: {parts}.',
  },

  // ===========================================================================================
  // Deck §4.B  Adding a texture
  // ===========================================================================================
  textureMessages: {
    noFile: 'Choose an image to add.',
    wrongType: "That isn't a PNG, JPEG or WebP image. Choose a different file.",
    noTarget: 'Choose which material to add it to.',
    /** "{category}" is one of `categoryInSentence`. */
    addedMaterial: 'Added “{name}”. Find it in the swatches for any {category} part.',
    /** The deck's category names in lower case, for use inside `addedMaterial`. */
    categoryInSentence: {
      wood: 'wood',
      textile: 'textile',
      plastic: 'plastic',
      stone: 'stone',
      metal: 'metal',
    },
    normalMapAdded: 'Added the normal map to “{name}”.',
    roughnessMapAdded: 'Added the roughness map to “{name}”.', // variant
  },

  // ===========================================================================================
  // Deck §4.C  Packs and .mjs
  // ===========================================================================================
  packMessages: {
    loadingPack: 'Loading pack…',
    loadingFile: 'Loading file…',
    /** Only a .glb was chosen in the pack input. */
    onlyGlb: 'Got “{file}”. Now add the matching .mjs.',
    /** A .glb was added through the pack-mate input. */
    packMateAdded: 'Got “{file}”. Now add the .mjs with the same name.',
    /** Added after `packMateAdded` when the .glb matches the pack that is open. */
    packMateMatchesOpenPack: 'This matches the pack you have open. Add the .mjs again to complete it.',
    noMjs: 'Choose a .mjs file, with its .glb if you have it.',
    wrongType: 'Choose a .mjs file.',
    loadingOff: '.mjs loading is off. Turn on “Allow .mjs files” to continue.',
    /** Neutral style, not an error. */
    cancelled: 'Cancelled. Nothing was loaded.',
    notAPack:
      "This .mjs isn't a furniture pack. It doesn't provide a model. It exports: {exports}. A pack needs a function called createAsset.",
    /** The same message for a file that exports nothing (the "It exports" sentence is left out). */
    notAPackNoExports:
      "This .mjs isn't a furniture pack. It doesn't provide a model. A pack needs a function called createAsset.", // variant
    packLoaded: 'Loaded pack “{name}” with “{file}”.',
    packIncomplete:
      'Loaded “{name}” without a .glb, so you see a basic version. Add the .glb to complete the pack.',
    colorsNotMatched:
      "“{param}” changed, but this pack's colors couldn't be matched to the model, so you won't see it.",
    rebuilt:
      "Rebuilt the model after changing “{param}”. The original .glb isn't shown for the rest of this session.",
    recoloredBasic: 'Recolored the model (basic mode).',
    colorsApplied: 'Applied colors to: {zones}.',
    /** Pack panel. */
    panelTitle: 'Pack options',
    /** Label of an option that rebuilds the model (was "Name (geometry)"). */
    geometryLabel: '{label} (rebuilds model)',
    toggleOn: 'On',
    toggleOff: 'Off',
    /** Panel note by mapping mode. Use `packSummary()` in `src/errors.ts` to choose. */
    panelNote: {
      split:
        "Colors apply to the pack's zones. Options marked (rebuilds model) rebuild it from the pack's code.",
      slots:
        "Colors apply to matching parts. Options marked (rebuilds model) rebuild it from the pack's code.",
      fallback: "Basic mode: colorways recolor the whole model. Swatches won't work for this pack.",
      unknown:
        "This pack's colors couldn't be matched to the model, so color options may not change it. Options marked (rebuilds model) still work.",
    },
    geometryHint:
      "These options rebuild the model from the pack's code. The original .glb is replaced for this session.",
    /** A swatch was clicked on a product that keeps its own materials. */
    swatchBlocked:
      "This pack controls its own colors, so swatches won't change it. Use the pack options above.",
  },

  // ===========================================================================================
  // Deck §4.D  Slot warnings (below the Materials card)
  // Use `slotWarnings()` in `src/errors.ts`: it returns { text, critical } for each line.
  // ===========================================================================================
  slotWarnings: {
    missingInModel: "These parts can't be changed because the model doesn't label them: {parts}.",
    unknownInModel: "Ignored: the model has parts the catalog doesn't list ({parts}).",
    untagged: 'Unlabeled parts keep a plain placeholder look: {parts}.',
    normalsComputed: 'Fixed missing shading data on {parts}. Re-export with normals for best quality.',
    noUv: {
      one: '{parts} has no UV mapping, so textures will look flat or wrong. Re-export with UVs.',
      other: '{parts} have no UV mapping, so textures will look flat or wrong. Re-export with UVs.', // variant
    },
    fromObj: 'Converted from OBJ. Colors from the .mtl are approximate. Library swatches take priority.',
    keepsOwnMaterials: "This model keeps its own materials, so library swatches won't change it.",
    /** Critical. */
    colorsNotMatched: "Couldn't match these colors to the model: {keys}.",
  },

  // ===========================================================================================
  // Deck §4.E  Importing a plan
  // ===========================================================================================
  planMessages: {
    noFile: 'Choose a plan file, or try the sample plan.',
    readingFile: 'Reading {file}…',
    loadingSample: 'Loading the sample plan…',
    loadingImage: 'Loading {file}…',
    imageReady: 'Image loaded. Check the size, then create the room.',
    pdf: "PDF isn't supported yet. Export the page as PNG or JPG and add that instead.",
    wrongType: "“{file}” isn't a plan format we can use. Try PNG, JPG, WebP, DWG, DXF or JSON.",
    notADwg: "This doesn't look like a DWG file, so nothing was imported.",
    badJson: "This JSON file isn't in the expected plan format. It needs a list of “walls” and “rooms”.",
    imageSize: 'Width and depth need to be above 0.',
    scaleInvalid: 'Enter a length above 0.',
    scaleNone: 'No scale found. Enter a length you know.',
    tooFewWalls: 'Include at least 3 walls to make a room.',
    noRoom: 'Include at least one room.',
    createdFromSample: 'Room created from the sample plan. Now place products.',
    createdFromFile: 'Room created from {file}. Now place products.',
    templateSaved: 'Saved “{name}” as a template.',
    templateUsed: 'Started a new room from “{name}”.',
  },

  // ===========================================================================================
  // Deck §4.F  Room, saving and starting up
  // ===========================================================================================
  roomMessages: {
    /** Size invalid, field known. "{field}" is one of `sizeFields`. Carries ** markers. */
    sizeInvalidField: '**{field}** needs a number above 0.',
    /** Size invalid, field not known. */
    sizeInvalid: 'Length, width, ceiling and wall thickness all need to be above 0.',
    /** The field names for `sizeInvalidField`: the §3.5 labels without their unit. */
    sizeFields: {
      length: 'Length',
      width: 'Width',
      ceilingHeight: 'Ceiling height',
      wallThickness: 'Wall thickness',
    },
    /** Not wired: needs min and max room sizes, which are undecided (Copy §7 item 4, skipped). */
    sizeImplausible: "That's {value}. Did you mean {suggestion}?",
    created: 'Room created. Add doors, windows or products below.',
    /** Click off-target. */
    clickWall: 'Click a wall to place the opening.',
    clickFloor: 'Click the floor inside the room.',
    clickCorner: 'Click the floor to add wall corners.',
    /** Draw progress: "3 corners. Click the first one to close." */
    drawProgress: {
      one: '{n} corner. Click the first one to close.', // variant
      other: '{n} corners. Click the first one to close.',
    },
    /** Draw closed: "Room closed · 6 walls." */
    drawClosed: {
      one: 'Room closed · {n} wall.', // variant
      other: 'Room closed · {n} walls.',
    },
    drawTooFew: 'Add at least 3 corners before closing.',
    drawTooShort: 'Those walls are too short. Try corners further apart.',
    openingAddedDoor: 'Added a door.',
    openingAddedWindow: 'Added a window.', // variant
    /** "{length}" and "{height}" arrive formatted with their unit, for example "4.00 m". */
    openingTooWide:
      "That opening doesn't fit on this wall (wall is {length} long). Make it narrower or click nearer the middle.",
    openingTooTall: 'That opening is taller than the wall ({height}).',
    sillNegative: "Sill height can't be below 0.",
    noModel: 'This product has no 3D model to place. Choose another.',
    placing: 'Placing “{name}”…',
    placed: 'Placed “{name}”.',
    /**
     * Placed with an overlap: "Placed “X”. It overlaps a wall and “Y”. You can leave it, ...".
     * Use `placedMessage()` in `src/errors.ts`: it builds "{what}" from the two pieces below.
     */
    placedOverlap: 'Placed “{name}”. It overlaps {what}. You can leave it, or delete it from the list below.',
    overlapWall: 'a wall',
    overlapProduct: '“{name}”',
    placeFailed: "Couldn't place “{name}”. Load its pack again and try once more.",
    undid: 'Undid last change.',
    redid: 'Redid change.',
    planPngSaved: 'Plan saved as PNG.',
    planPngFailed: "Couldn't create the PNG. Try again.",
    exported: "Project saved to a file (room and templates). Uploaded models aren't included.",
    importOk: 'Opened project “{name}”.',
    importOkUnnamed: 'Opened project.', // variant: the project file has no label
    /** Carries ** markers. */
    importFailed:
      "Couldn't open that file. It isn't a Catalog 3D project, or it's damaged. **Your current room is unchanged.**",
    noRoomYet: 'Create a room first.',
    /** Saving blocked banner (Copy Phase 4 item 1). Carries ** markers. */
    savingBlocked:
      "**Your browser won't save your work.** It stays safe while this tab is open. Choose **Export project** to keep it.",
    /** Saved room unreadable (Copy Phase 4 item 2). Carries ** markers. */
    savedRoomUnreadable: "**Your saved room couldn't be read, so we started with an empty one.**",
    /** The button that follows `savedRoomUnreadable`. */
    downloadDamagedData: 'Download the damaged data',
    templatesDamaged: "Some saved templates couldn't be read and were skipped.",
  },

  // ===========================================================================================
  // Deck §5  Confirmations (the prototype's "Start over" is not here)
  // The first button is the destructive one: critical styling, not the primary colour.
  // ===========================================================================================
  confirm: {
    clearRoom: {
      title: 'Clear this room?',
      /** "{openings}" and "{products}" are the plural forms below. Carries ** markers. */
      body: "This removes the walls, {openings} and {products}. **You can't undo it.** Export project first if you want to keep it.",
      openingCount: {
        one: '{n} opening', // variant
        other: '{n} openings',
      },
      placedProductCount: {
        one: '{n} placed product', // variant
        other: '{n} placed products',
      },
      confirmLabel: 'Clear room',
      cancelLabel: 'Keep room',
    },
    replaceRoom: {
      title: 'Replace your current room?',
      /** "{products}" is the plural form below. Carries ** markers. */
      body: "Your current room and its {products} will be replaced, and **you won't be able to undo it.** Export project first to keep a copy.",
      placedProductCount: {
        one: '{n} placed product', // variant
        other: '{n} placed products',
      },
      confirmLabel: 'Replace room',
      cancelLabel: 'Keep current room',
    },
    deleteTemplate: {
      title: 'Delete “{name}”?',
      body: "This template will be removed from this browser. You can't undo this.",
      confirmLabel: 'Delete template',
      cancelLabel: 'Keep template',
    },
    /** Use `mjsConfirmContent()` in `src/errors.ts` to assemble the body. */
    loadMjs: {
      title: 'Run code from “{file}”?',
      body: 'An .mjs file is a program, not a model. It runs in this page and can do anything the page can. Only continue if you trust where it came from.',
      /** Added when the scan found something. "{risks}" is a comma-separated list. */
      flagged: 'A quick scan flagged: {risks}. These are unusual for a furniture pack.',
      /** Added when the file does not look like a pack. */
      notPackLike: "This file doesn't look like a furniture pack.",
      confirmLabel: 'Load and run',
      cancelLabel: "Don't load",
      /** Only if a native `window.confirm` is still used: it ends the body. */
      nativeConfirmSuffix: 'Choose OK to load, or Cancel to stop.',
    },
  },

  // ###########################################################################################
  // ###########################################################################################
  //
  //   NOT IN THE DECK
  //
  //   Strings another handoff names or needs and `docs/ux-copy-deck.md` does not have.
  //   "given"   = the handoff supplies the words; they are used as written.
  //   "written" = the handoff only describes the need; written in the deck's voice (deck §1)
  //               with the deck's vocabulary (product, Parts list, sample). Not reviewed.
  //   Each entry names the item that asked for it. Add new strings here, in the same form,
  //   and list them in the completion doc.
  //
  // ###########################################################################################
  // ###########################################################################################
  notInDeck: {
    // ----- Empty-state card over the stage, `#stage-empty` (UX-06 item 1, QA-04) ---------------
    emptyRoom: {
      /** written. UX-06 item 1. From the deck's "No room yet." (§3.1 #14). */
      title: 'No room yet',
      /** written. UX-06 item 1. The deck's "Pick a way to start above." without "above". */
      body: 'Pick a way to start.',
      /** written. UX-06 item 1: the three starts reuse the deck's tab labels (§3.5). */
      fromScratch: 'From scratch',
      importPlan: 'Import plan',
      fromTemplate: 'From template',
      /** written. QA-04: the fourth entry, "open a project file". The deck's button label (§3.6). */
      importProject: 'Import project',
    },

    // ----- Product workspace structure (UX-07) ------------------------------------------------
    /** given. UX-07 item 2: the closed disclosure that holds texture, pack and module uploads. */
    advanced: 'Advanced',

    // ----- Room workspace steps (UX-08) -------------------------------------------------------
    /** given. UX-08 item 1: the four step titles ("1 Room · 2 Openings · 3 Place products · 4 Wall and floor finish"). */
    steps: {
      room: 'Room',
      openings: 'Openings',
      place: 'Place products',
      finish: 'Wall and floor finish',
    },
    /** given. UX-08 item 2: the link on the collapsed step-1 summary. */
    stepChange: 'Change',
    /** given. UX-08 item 4: the collapsed size fields when a preset is selected. */
    adjustSize: 'Adjust size',
    /** given. UX-08 item 6: the optional menu that can hold "Save as template". */
    more: 'More',
    /** given. UX-08 item 3: places the selected product with no pointer needed. */
    addToRoom: 'Add to room',

    // ----- Placed products (UX-09) ------------------------------------------------------------
    placedProducts: {
      /** given (format). UX-09 item 2: rows numbered per product, "Lounge chair 1", "Lounge chair 2". */
      row: '{name} {n}',
      /** written. UX-09 item 3: rotate by 90 degrees. Delete uses `common.delete`. */
      rotateLeft: 'Rotate left',
      rotateRight: 'Rotate right',
      /** written. UX-09 item 3: the optional Duplicate action. */
      duplicate: 'Duplicate',
      /** written. UX-09 item 3: the keys for a selected product, as a stage hint (deck §3.3 style). */
      selectedHint: 'Arrow keys to move · R to rotate · Delete to remove',
      /** written. UX-09 item 3: the soft warning after a move. "{what}" as in `roomMessages.placedOverlap`. */
      movedOverlap: '“{name}” overlaps {what}. You can leave it, or move it again.',
      /**
       * written (host wave 4). UX-09 item 3 with QA-02 / D-QA1: an arrow-key move that would take a
       * product's floor point outside the room is refused, as a Place click there is. "{name}" is the
       * row name. Modelled on `outsideRoom` ("…is outside the room, so nothing was placed.").
       */
      movedOutsideRoom: 'That would put “{name}” outside the room, so it stayed where it is.',
    },

    // ----- Accessibility (UX-13) --------------------------------------------------------------
    /** written. UX-13: `aria-label` of the 3D canvas. */
    canvasLabel: '3D view',

    // ----- Catalog and material pickers (UX-14 step 7, UX-15, Picker §8 item 3) -----------------
    picker: {
      /** given. UX-14 step 7: the trigger label of the product picker. */
      productLabel: 'Product',
      /** given. UX-14 step 7. */
      searchProducts: 'Search products',
      /** given. UX-14 step 7. */
      noProductsMatch: 'No products match.',
      /** given. UX-14 step 7. */
      close: 'Close',
      /** given. UX-14 step 7: group label of the view toggle, and its two options. */
      viewLabel: 'View',
      thumbnails: 'Thumbnails',
      list: 'List',
      /** written. UX-14 step 2: accessible name of the trigger, "label + current name". */
      triggerName: '{label}: {name}',
      /** written. UX-15 step 1: the same two strings for the material pickers. */
      searchMaterials: 'Search materials',
      noMaterialsMatch: 'No materials match.',
      /** given. UX-15 step 1: the first wall and floor item, value ''. Today's option text. */
      defaultMaterial: 'Default',
    },

    // ----- Finishes in the room (UX-16 step 3) ------------------------------------------------
    /** given. UX-16 step 3: state line under the Materials card in the "Place products" step. */
    appliesToNextProduct: 'Applies to the next product you place.',
    /**
     * written (host wave 4). UX-16 step 4 ("16b"): the same state line while a placed product is
     * selected; the swatches then change that product. "{name}" is its row name ("Lounge chair 2").
     */
    appliesToSelectedProduct: 'Applies to “{name}”.',

    // ----- Placement guard (QA-02, D-QA1) -----------------------------------------------------
    /** written. QA-02: a Place click outside the floor polygon is rejected with this message. */
    outsideRoom: 'That spot is outside the room, so nothing was placed. Click the floor inside the room.',

    // ----- Stage toast (UX-04 item 1) ---------------------------------------------------------
    /** written. UX-04 item 1: accessible name of the toast's close button (`#stage-toast`). */
    toastDismiss: 'Dismiss',

    // ----- Uploaded products after a refresh (Copy §6 C) --------------------------------------
    /** given. Copy §6 C: a saved placement whose product is no longer in the catalog. */
    uploadNotRestored:
      "“{name}” isn't available after a refresh, so it wasn't placed back. Add the model again to use it.",

    // ----- Messages the error mapper needs (Copy Phase 3, Phase 1 step 8) -----------------------
    /** written. Copy Phase 3: the generic fallback of `friendlyError` ("a generic plain message"). */
    genericError: 'Something went wrong. Try again.',
    /**
     * written. Copy Phase 1 step 8 asks to split the overlay error so a boot failure does not say
     * "model". The deck words the boot half only; this is the product-load half.
     */
    overlayModelFailed:
      "This product's 3D model couldn't be loaded. Choose another product, or reload the page.",
    /**
     * written. Deck §4.F "Place failed" tells people to load the pack again, which is wrong for a
     * product that is not a pack. Used for every other placing failure.
     */
    placeFailedOther: "Couldn't place “{name}”. Try again.",
    /**
     * written. Engine message with no deck row: "Opening width and height must be positive"
     * (`roomGraph.ts:389`). Modelled on the deck's "Width and depth need to be above 0." (§4.E).
     */
    openingSizeInvalid: 'Width and height need to be above 0.',
    /**
     * given. Copy Phase 3 ("Keep the raw notes in a collapsed Details"): `<summary>` of the raw
     * pack notes under the pack panel note. See `packSummary()` in `src/errors.ts`.
     */
    packDetails: 'Details',

    // ----- Rows and labels the deck leaves out (deck gaps found while filling Phase 0) ---------
    /**
     * written. Deck §3.5 uses "({unit})" in field labels and shows "(m)" and "(cm)" only.
     * The feet form is not in the deck; "ft" follows its help text ("9.5 = 9 ft 6 in").
     */
    unitAbbrev: {
      m: 'm',
      cm: 'cm',
      'ft-in': 'ft',
    },
    /** written. Deck §3.6 shows the room size in meters only. In feet each value has its own marks. */
    roomSizeFeet: '{length} × {width}',
    /**
     * written. Deck §3.5 rewrites the opening row only. Today's wall row shows an internal id and a
     * CAD layer ("wc_s · 5.00 m · A-WALL"). "{n}" is the row number.
     */
    importWallRow: 'Wall {n} · {length}',
    /** written. Deck §3.5 has no room row. Today's row, kept: "Living · ceiling 2.70 m". */
    importRoomRow: '{name} · ceiling {height}',
    /** written. Deck §3.6 has no opening-list row. Today's row with the deck's capital: "Door · 0.90 m × 2.10 m · sill 0.00 m". */
    openingListRow: '{type} · {width} × {height} · sill {sill}',
    /**
     * written. Deck §3.5 has one banner, worded for an uploaded DWG/DXF ("Your file was kept but
     * not read"). After "Try the sample plan" there is no file, so that sentence is false.
     * Carries ** markers.
     */
    sampleBannerBuiltIn: '**Sample plan.** These walls come from a built-in example.',
    /**
     * written. Deck §3.5 "Job status" shows the file name. For the built-in sample that name is
     * "sample-plan.candidates.json", which is internal vocabulary.
     */
    jobStatusSample: 'Sample plan',
  },
} as const satisfies CopyTree;

/** The type of `copy`: every key, with its exact English string. */
export type Copy = typeof copy;

type Widen<T> = T extends string ? string : { readonly [K in keyof T]: Widen<T[K]> };

/** The shape a translation of `copy` must have: the same keys, any strings. */
export type CopyShape = Widen<Copy>;
