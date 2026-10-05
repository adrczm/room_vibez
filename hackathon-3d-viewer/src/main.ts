// Host application. Owns all UI chrome; talks to the engine only through RoomVibezViewer's public API.
import './styles.css';
import { DoubleSide } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { Object3D } from 'three';
import {
  DEFAULT_CEILING_HEIGHT_M,
  DEFAULT_DOOR,
  DEFAULT_WALL_THICKNESS_M,
  DEFAULT_WINDOW,
  LIGHT_PRESETS,
  ModuleContractError,
  ROOM_PRESETS,
  RoomVibezViewer,
  StaleLoadError,
  RoomHistory,
  addDrawPoint,
  addOpening,
  addPlacement,
  applyPackAppearance,
  associatePackFiles,
  attachTextureToMaterial,
  buildPlanSvg,
  checkPlacementCollision,
  closeDistance,
  commitDrawSession,
  confirmUnderlayToRoomGraph,
  createDrawSession,
  createMaterialFromTexture,
  createProductFromModelFiles,
  createProductFromPack,
  candidatesOverlaySvg,
  clearProjectFromIdb,
  confirmImportToRoomGraph,
  createRectangularRoom,
  createThumbnailRenderer,
  defaultsFromMeta,
  deleteTemplate,
  downloadTextFile,
  ensurePackZoneSlots,
  exportProjectJson,
  findMaterial,
  footprintFromObject,
  formatLength,
  fromMeters,
  getModuleFactory,
  importModuleFile,
  instantiateTemplate,
  isMjsLoadingEnabled,
  isPdfPlanFile,
  isRasterPlanFile,
  loadPersistedRoomGraph,
  loadProductRoot,
  loadProjectFromIdb,
  loadTemplates,
  materialsForSlot,
  meshStandardFromLibrary,
  parseProjectJson,
  persistProjectToIdb,
  persistRoomGraph,
  persistTemplates,
  planSvgToPngDataUrl,
  pointInRoom,
  registerModuleFactory,
  removeOpening,
  removePlacement,
  resolveModuleAsset,
  resolveBindings,
  resolveModulePackMeta,
  resolvePackColors,
  saveGraphAsTemplate,
  scaleFactorFromKnownLength,
  serializeProject,
  setCandidateAccepted,
  setMjsLoadingEnabled,
  setRoomSurfaceMaterials,
  setScaleFactor,
  snapPlacementToWall,
  startImportJob,
  startUnderlayJob,
  toMeters,
  updatePlacement,
  validateProduct,
  type Catalog,
  type DisplayUnit,
  type ImportJob,
  type InteractionMode,
  type MaterialCategory,
  type MaterialsLibrary,
  type ModulePackMeta,
  type DrawSession,
  type OpeningType,
  type PackStatus,
  type PartsList,
  type PlacementEntity,
  type Product,
  type RoomGraph,
  type RoomMeshMaterials,
  type RoomPointerHit,
  type SlotDefinition,
  type SlotReport,
  type TextureMapRole,
  type ThumbnailRenderer,
  type ThumbnailStats,
  type UnderlayJob,
  type ViewerStatus,
} from './viewer';
import { copy, fmt, plural } from './copy';
import { friendlyError, movedOverlapMessage, placedMessage, type FriendlyMessage } from './errors';
import {
  finishForPlacing,
  isNudgeKey,
  nudgedPosition,
  placementRows,
  quarterTurn,
  type PlacementRow,
} from './placedProducts';
import { confirmDialog } from './ui/confirmDialog';
import { dismissNotification, mountNotifier, notify as showToast, type NotifyOptions } from './ui/notify';
import {
  buildMaterialItems,
  buildProductItems,
  createThumbnailPicker,
  readStoredView,
  type PickerStrings,
  type ThumbnailPicker,
} from './ui/thumbnailPicker';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const host = $('viewer-host');
const overlay = $('viewer-overlay');
const productSelect = $<HTMLSelectElement>('product-select');
const productMeta = $('product-meta');
const slotsEl = $('slots');
const warningsEl = $('slot-warnings');
const presetsEl = $('presets');
const partsEl = $('parts-list');
const modelFiles = $<HTMLInputElement>('model-files');
const modelStatus = $('model-upload-status');
const packFiles = $<HTMLInputElement>('pack-files');
const packGlbMate = $<HTMLInputElement>('pack-glb-mate');
const packStatusEl = $('pack-upload-status');
const packParamsEl = $('pack-params');
const moduleFile = $<HTMLInputElement>('module-file');
const moduleStatus = $('module-upload-status');
const textureFile = $<HTMLInputElement>('texture-file');
const textureName = $<HTMLInputElement>('texture-name');
const textureCategory = $<HTMLSelectElement>('texture-category');
const textureRole = $<HTMLSelectElement>('texture-role');
const textureTargetWrap = $('texture-target-wrap');
const textureTarget = $<HTMLSelectElement>('texture-target');
const textureStatus = $('texture-upload-status');
const userMaterialsEl = $('user-materials');
const roomUnits = $<HTMLSelectElement>('room-units');
const roomPreset = $<HTMLSelectElement>('room-preset');
const roomLength = $<HTMLInputElement>('room-length');
const roomWidth = $<HTMLInputElement>('room-width');
const roomCeiling = $<HTMLInputElement>('room-ceiling');
const roomThickness = $<HTMLInputElement>('room-thickness');
const roomStatus = $('room-status');
const roomPlan = $('room-plan');
const roomTools = $('room-tools');
const roomGraphJson = $('room-graph-json');
const openingWidth = $<HTMLInputElement>('opening-width');
const openingHeight = $<HTMLInputElement>('opening-height');
const openingSill = $<HTMLInputElement>('opening-sill');
const openingList = $('opening-list');
const placementList = $('placement-list');
const btnOpeningMode = $<HTMLButtonElement>('btn-opening-mode');
const btnPlaceMode = $<HTMLButtonElement>('btn-place-mode');
const btnDrawWallMode = $<HTMLButtonElement>('btn-draw-wall-mode');
const btnUndo = $<HTMLButtonElement>('btn-undo');
const btnRedo = $<HTMLButtonElement>('btn-redo');
const roomWallMaterial = $<HTMLSelectElement>('room-wall-material');
const roomFloorMaterial = $<HTMLSelectElement>('room-floor-material');
const stageHint = $('stage-hint');
const stageEmpty = $('stage-empty');
const workspaceMode = $('workspace-mode');
const stageEl = document.querySelector<HTMLElement>('.stage')!;
const panel = document.querySelector<HTMLElement>('.panel')!;
/** One panel group per workspace (UX-07). Only the active workspace's group is rendered. */
const panelCatalog = $('panel-catalog');
const panelRoom = $('panel-room');
/**
 * The product picker's travelling wrapper. It holds `#product-select` (and, once the thumbnail
 * picker is mounted on the select, the picker element that wraps it). `setWorkspace` moves this
 * wrapper between the Product card and the "Place products" step, so there is one picker.
 */
const productPickerSlot = $('product-picker-slot');
const roomToolbar = $('room-toolbar');
const btnExportProject = $<HTMLButtonElement>('btn-export-project');
const btnAddToRoom = $<HTMLButtonElement>('btn-add-to-room');
const btnStepRoomChange = $<HTMLButtonElement>('btn-step-room-change');
const roomSizeAdjust = $<HTMLDetailsElement>('room-size-adjust');
/**
 * The Materials card (`#slots`, `#slot-warnings`). One element for both workspaces (UX-16 step 3):
 * `setWorkspace` puts it after the Product card, or in the "Place products" step.
 */
const materialsCard = $('materials-card');
const catalogCard = $('catalog-card');
const materialsHomeRoom = $('materials-home-room');
/** In Room, what a swatch click applies to: the next product placed, or the selected one. */
const materialsState = $('materials-state');

const roomHistory = new RoomHistory();

let viewer: RoomVibezViewer | null = null;
let library: MaterialsLibrary;
let catalog: Catalog;
let currentProduct: Product;
let currentPreset = LIGHT_PRESETS[0].id;
let lastParts: PartsList | null = null;
/** Session Object URLs so we can revoke on unload (hackathon persistence = tab lifetime). */
const sessionUrls: string[] = [];
const userMaterialIds = new Set<string>();
let roomGraph: RoomGraph | null = null;
let openingType: OpeningType = 'door';
let workspace: 'catalog' | 'room' = 'catalog';
let importJob: ImportJob | null = null;
let underlayJob: UnderlayJob | null = null;
let drawSession: DrawSession | null = null;
let roomIngress: 'scratch' | 'import' | 'template' = 'scratch';

/** The Room workspace's steps (UX-08 item 1), in order. Their titles are `copy.notInDeck.steps`. */
type RoomStep = 'room' | 'openings' | 'place' | 'finish';
const ROOM_STEPS: readonly RoomStep[] = ['room', 'openings', 'place', 'finish'];
/** The one open step. It is always 'room' while there is no room. */
let roomStep: RoomStep = 'room';
/** Whether the user left "Adjust size" open while a size preset is selected (UX-08 item 4). */
let sizeAdjustOpen = false;

/**
 * The placed product the user selected (UX-09 item 2), or null. Set by a click on the product in
 * the room (no tool on) or on its row; only ever non-null in the Room workspace, with no tool on,
 * and for a placement that is in the room graph. `selectPlacement` is the one place that sets it.
 */
let selectedPlacementId: string | null = null;
/** The row of the Products list under the pointer. Its product is outlined while it is hovered. */
let hoveredPlacementId: string | null = null;
/** The placement the host last asked the engine to outline, so the engine is told only of changes. */
let outlinedPlacementId: string | null = null;
/** Text of the last toast a move showed (overlap, or refused at the room's edge), to clear it when the next move is fine. */
let lastMoveNotice: string | null = null;
/** Text of the last toast shown at all. Every toast of the app goes through `notify` below. */
let lastToast: string | null = null;

/** Show a toast on the stage (UX-04), and remember what it said. */
function notify(message: string, options?: NotifyOptions) {
  lastToast = message;
  showToast(message, options);
}
/** Placements whose product is not in the catalog and for which the toast has been shown (once per page load). */
const announcedMissing = new Set<string>();
/** Swatch clicks the turntable has not finished applying. A product placed now waits for them (never rejects). */
let slotApplyPending: Promise<void> = Promise.resolve();
/**
 * The same clicks, slot id → material id, until the turntable has taken each one (its textures
 * load first). The Materials card shows these at once, also when it is drawn again meanwhile.
 */
const pendingSlotChoices = new Map<string, string>();
/** Finish changes of placed products are applied to their models one after another, in click order. */
let finishQueue: Promise<void> = Promise.resolve();
/** Counts `reloadAllPlacements` runs: a run that is no longer the latest stops. */
let reloadRun = 0;
/** What the Materials card showed when it was last rendered (`materialsSignature`). */
let renderedMaterials = '';

/**
 * The catalog pickers (UX-14, UX-15): a drop-down with a thumbnail view and a list view, on the
 * product select and on the three long material selects. Each native select stays in the page as
 * the state holder and keeps its options, its value and its `change` listeners. A picker has to be
 * told with `sync()` whenever code changes its select's options or value: that fires no `change`.
 * Created once, by `initPickers`; null until then, and the calls below are written for that.
 */
let productPicker: ThumbnailPicker | null = null;
let wallMaterialPicker: ThumbnailPicker | null = null;
let floorMaterialPicker: ThumbnailPicker | null = null;
let textureTargetPicker: ThumbnailPicker | null = null;
/**
 * The one offscreen renderer of product thumbnails (UX-14 step 5): a second WebGL context beside
 * the 3D view's. Created with the first thumbnail asked for; freed with the 3D view (`resetThumbnails`).
 */
let thumbnails: ThumbnailRenderer | null = null;
/**
 * True once the product picker has asked for a thumbnail, that is, once its pop-up has been open
 * in the thumbnail view. Until then nothing is drawn and no second WebGL context exists: the
 * first drawing blocks the page for over two seconds under software rendering (measured), which
 * a page load must not pay for.
 */
let thumbnailsInUse = false;

/** Active pack session (product id → meta + live params). */
interface PackSession {
  productId: string;
  meta: ModulePackMeta;
  status: PackStatus;
  params: Record<string, unknown>;
  /** Last palette applied to the mesh (for vertex-color remap chain). */
  bakedZones: Record<string, string>;
}
let activePack: PackSession | null = null;
/** Pending GLB mate chosen via the second file input (paired with next/last MJS). */
let pendingGlbMate: File | null = null;

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

function setStatus(status: ViewerStatus, detail?: string) {
  document.body.dataset.viewerStatus = status;
  overlay.classList.toggle('hidden', status === 'ready');
  overlay.classList.toggle('error', status === 'error');
  overlay.textContent =
    status !== 'error'
      ? 'Loading…'
      : /webgl/i.test(detail ?? '')
        ? 'This browser could not start WebGL (3D graphics). Enable hardware acceleration, try another browser, or use "Start Viewer.command", which runs Chrome with software WebGL.'
        : `Could not load model: ${detail}`;
}

function onParts(parts: PartsList) {
  lastParts = parts;
  partsEl.textContent = JSON.stringify(parts, null, 2);
  window.dispatchEvent(new CustomEvent('rv:partlistupdate', { detail: parts }));
}

function displayUnit(): DisplayUnit {
  return roomUnits.value as DisplayUnit;
}

/**
 * The length fields that follow the Units select, with their limits in metres.
 * The limits are read from the HTML, which is written in metres (the default unit).
 */
const LENGTH_FIELDS = [
  roomLength,
  roomWidth,
  roomCeiling,
  roomThickness,
  openingWidth,
  openingHeight,
  openingSill,
].map((input) => ({ input, minM: Number(input.min), stepM: Number(input.step) }));

/** Unit the length fields currently show. Tracked so a unit switch can convert what is in them. */
let fieldUnit: DisplayUnit = 'm';

/** Unit conversion leaves float noise (1.1 m → 110.00000000000001 cm). Trim it at 1e-6 of the unit. */
const trimNoise = (v: number) => Number(v.toFixed(6));

/** Read a length field as metres. An empty field reads as 0. */
function fieldMeters(input: HTMLInputElement, unit: DisplayUnit): number {
  return trimNoise(toMeters(Number(input.value), unit));
}

function setFieldMeters(input: HTMLInputElement, meters: number, unit: DisplayUnit) {
  input.value = String(trimNoise(fromMeters(meters, unit)));
}

/** Express each length field's `min` and `step` in the given unit. */
function syncLengthFieldLimits(unit: DisplayUnit) {
  for (const f of LENGTH_FIELDS) {
    if (unit === 'ft-in') {
      // Metric limits do not fall on a round grid in decimal feet. Keep the same minimum
      // (rounded down, so the metric minimum itself still passes) and drop the step grid.
      f.input.min = String(Math.floor(fromMeters(f.minM, unit) * 100) / 100);
      f.input.step = 'any';
    } else {
      f.input.min = String(trimNoise(fromMeters(f.minM, unit)));
      f.input.step = String(trimNoise(fromMeters(f.stepM, unit)));
    }
  }
}

/** Units select changed: the fields keep their meaning, so their numbers have to change. */
function convertLengthFields(from: DisplayUnit, to: DisplayUnit) {
  for (const { input } of LENGTH_FIELDS) {
    // An empty field stays empty; converting it would write 0 into it.
    if (input.value.trim() !== '') setFieldMeters(input, fieldMeters(input, from), to);
  }
  syncLengthFieldLimits(to);
}

function syncOpeningDefaultsFromType() {
  const d = openingType === 'door' ? DEFAULT_DOOR : DEFAULT_WINDOW;
  setFieldMeters(openingWidth, d.width, displayUnit());
  setFieldMeters(openingHeight, d.height, displayUnit());
  setFieldMeters(openingSill, d.sill_height, displayUnit());
  viewer?.setOpeningToolDefaults(openingType, d.width);
}

/**
 * Shell materials for the surfaces the user chose a finish for, and only those. A surface that
 * is left out keeps the engine's default (`buildRoomScene`). Filling the other one in with the
 * first library material turned the floor white as soon as a wall finish was picked.
 */
function shellMaterialsFromGraph(graph: RoomGraph): Partial<RoomMeshMaterials> | undefined {
  const room = graph.rooms[0];
  const wallDef = room?.wall_material_id ? findMaterial(library, room.wall_material_id) : null;
  const floorDef = room?.floor_material_id ? findMaterial(library, room.floor_material_id) : null;
  if (!wallDef && !floorDef) return undefined;
  const materials: Partial<RoomMeshMaterials> = {};
  if (wallDef) materials.wall = meshStandardFromLibrary(wallDef, { side: DoubleSide, name: `room:wall:${wallDef.id}` });
  if (floorDef) materials.floor = meshStandardFromLibrary(floorDef, { name: `room:floor:${floorDef.id}` });
  return materials;
}

/**
 * Canvas-originated feedback goes to the toast on the stage (UX-04), where the user is looking.
 * `#room-status` in the panel stays the persistent room summary and is not written by these
 * paths, so each message has exactly one announcer.
 */
function notifyProblem(msg: FriendlyMessage) {
  if (msg.neutral) notify(msg.text);
  else notify(msg.text, { kind: msg.critical ? 'error' : 'warning' });
}

/** Deck §5 "Replace room" is asked only when there is work to lose (Copy Phase 4 item 3). */
function roomHasContent(): boolean {
  return !!roomGraph && (roomGraph.placements.length > 0 || roomGraph.openings.length > 0 || roomHistory.canUndo());
}

/**
 * Guard for every flow that swaps the room and resets undo history (create room, use template,
 * create room from plan or image, open project). Resolves true when the caller may go ahead.
 */
async function confirmReplaceRoom(): Promise<boolean> {
  if (!roomGraph || !roomHasContent()) return true;
  const c = copy.confirm.replaceRoom;
  return confirmDialog({
    title: c.title,
    body: fmt(c.body, { products: plural(roomGraph.placements.length, c.placedProductCount) }),
    confirmLabel: c.confirmLabel,
    cancelLabel: c.cancelLabel,
    destructive: true,
  });
}

/** Clear room (UX-03): ask first, then empty the room and stay in the workspace the user is in. */
async function onClearRoom() {
  if (!roomGraph) return;
  const c = copy.confirm.clearRoom;
  const confirmed = await confirmDialog({
    title: c.title,
    body: fmt(c.body, {
      openings: plural(roomGraph.openings.length, c.openingCount),
      products: plural(roomGraph.placements.length, c.placedProductCount),
    }),
    confirmLabel: c.confirmLabel,
    cancelLabel: c.cancelLabel,
    destructive: true,
  });
  if (!confirmed) return;
  viewer?.clearAllPlacements();
  drawSession = null;
  applyRoomGraph(null, { history: 'reset' });
  // A toast still on the stage ("Placed …") is about the room that has just gone.
  dismissNotification();
  // The Clear button has just been hidden with its row. In the Room workspace the empty-room
  // card took its place on the stage, so keyboard focus continues there.
  if (workspace === 'room') stageEmpty.querySelector<HTMLButtonElement>('button')?.focus();
}

function applyRoomGraph(
  next: RoomGraph | null,
  opts?: { frame?: boolean; reloadPlacements?: boolean; history?: 'commit' | 'reset' | 'skip' },
) {
  const historyMode = opts?.history ?? 'commit';
  if (historyMode === 'reset') {
    roomHistory.reset(next);
    roomGraph = next;
  } else if (historyMode === 'skip') {
    roomGraph = next;
  } else {
    roomGraph = roomHistory.commit(next);
  }
  persistRoomGraph(roomGraph);
  // Export project also leaves a copy in IndexedDB, and boot falls back to it when no room is
  // saved. Without this a cleared room came back on the next reload.
  if (!roomGraph) void clearProjectFromIdb();
  viewer?.setRoomGraph(roomGraph, {
    frame: opts?.frame,
    materials: roomGraph ? shellMaterialsFromGraph(roomGraph) : undefined,
  });
  renderRoomUi();
  syncUndoRedoButtons();
  if (roomGraph && opts?.reloadPlacements !== false) void reloadAllPlacements(roomGraph);
}

function syncUndoRedoButtons() {
  btnUndo.disabled = !roomHistory.canUndo();
  btnRedo.disabled = !roomHistory.canRedo();
}

function onUndo() {
  if (!roomHistory.canUndo()) return;
  const prev = roomHistory.undo();
  applyRoomGraph(prev, { frame: false, reloadPlacements: true, history: 'skip' });
  notify(copy.roomMessages.undid);
}

function onRedo() {
  if (!roomHistory.canRedo()) return;
  const next = roomHistory.redo();
  applyRoomGraph(next, { frame: false, reloadPlacements: true, history: 'skip' });
  notify(copy.roomMessages.redid);
}

function populateMaterialSelects() {
  const keepWall = roomWallMaterial.value;
  const keepFloor = roomFloorMaterial.value;
  roomWallMaterial.innerHTML = '';
  roomFloorMaterial.innerHTML = '';
  roomWallMaterial.add(new Option('Default', ''));
  roomFloorMaterial.add(new Option('Default', ''));
  for (const m of library.materials) {
    roomWallMaterial.add(new Option(m.name, m.id));
    roomFloorMaterial.add(new Option(m.name, m.id));
  }
  if (keepWall && library.materials.some((m) => m.id === keepWall)) roomWallMaterial.value = keepWall;
  if (keepFloor && library.materials.some((m) => m.id === keepFloor)) roomFloorMaterial.value = keepFloor;
  // New options and, possibly, another value: the pickers read both again.
  wallMaterialPicker?.sync();
  floorMaterialPicker?.sync();
}

function syncMaterialSelectsFromGraph() {
  if (!roomGraph) return;
  const room = roomGraph.rooms[0];
  if (!room) return;
  roomWallMaterial.value = room.wall_material_id ?? '';
  roomFloorMaterial.value = room.floor_material_id ?? '';
  // Set in code (undo, redo, a room opened or replaced), so no `change` told the pickers.
  wallMaterialPicker?.sync();
  floorMaterialPicker?.sync();
}

function setRoomIngress(mode: 'scratch' | 'import' | 'template') {
  roomIngress = mode;
  $('room-ingress').querySelectorAll('button').forEach((b) => {
    b.setAttribute('aria-checked', String(b.getAttribute('data-ingress') === mode));
  });
  $('room-ingress-scratch').hidden = mode !== 'scratch';
  $('room-ingress-import').hidden = mode !== 'import';
  $('room-ingress-template').hidden = mode !== 'template';
  if (mode === 'template') renderTemplateList();
  document.body.dataset.roomIngress = roomIngress;
}

/** The elements of one step of the Room workspace. */
function stepParts(step: RoomStep) {
  const el = roomTools.querySelector<HTMLElement>(`.step[data-step="${step}"]`)!;
  return {
    el,
    /** The heading. It takes focus when the app moves the user on to this step (UX-13). */
    title: el.querySelector<HTMLElement>('.step-title')!,
    toggle: el.querySelector<HTMLButtonElement>('.step-toggle')!,
    body: el.querySelector<HTMLElement>('.step-body')!,
  };
}

/**
 * Open one step of the Room workspace and fold the others (UX-08 item 1: one open at a time).
 * The open step carries `aria-current="step"`. Without a room only step 1 can be open, and the
 * toggles of steps 2 to 4 are disabled: their tools all need a room.
 * Also the one place that decides whether the step-1 "Change" link shows.
 */
function setRoomStep(step: RoomStep) {
  const has = !!roomGraph;
  const next: RoomStep = has ? step : 'room';
  // The button of a tool that is on is about to be hidden with its step. Leave the tool, so
  // nothing stays switched on that the panel no longer shows.
  if (next !== roomStep) exitRoomTool();
  roomStep = next;
  for (const id of ROOM_STEPS) {
    const { el, toggle, body } = stepParts(id);
    const open = id === next;
    if (open) el.setAttribute('aria-current', 'step');
    else el.removeAttribute('aria-current');
    toggle.setAttribute('aria-expanded', String(open));
    toggle.disabled = id !== 'room' && !has;
    body.hidden = !open;
  }
  // Step 1 folded to its one-line summary (#room-status): offer the way back into it.
  btnStepRoomChange.hidden = !(has && next !== 'room');
}

/** Side panel to its top, with no animation (UX-07 item 4, QA-15). On a narrow screen the page scrolls instead, so this does nothing there. */
function scrollPanelToTop() {
  panel.scrollTo({ top: 0, behavior: 'instant' });
}

/**
 * Narrow screens (QA-03): the page is one column and scrolls as a whole, so the 3D view can be
 * off screen when something happens on it. Bring it back, with no animation. On a wide screen
 * the stage is always in view and this does nothing.
 */
function revealStage() {
  const rect = stageEl.getBoundingClientRect();
  // Scroll the page by the least that shows the whole stage ("nearest", without the scroll
  // padding that is there for the room toolbar).
  if (rect.top < 0) window.scrollBy({ top: rect.top, behavior: 'instant' });
  else if (rect.bottom > window.innerHeight) {
    window.scrollBy({ top: Math.min(rect.top, rect.bottom - window.innerHeight), behavior: 'instant' });
  }
}

/**
 * A room has just been created, imported or opened (UX-08 item 2): step 1 folds to its summary
 * and the next step opens. Focus moves to that step's heading (UX-13), without scrolling: the
 * panel goes to its top, where the summary and the open step are, and the stage is shown.
 */
function onRoomStarted() {
  setRoomStep('openings');
  scrollPanelToTop();
  revealStage();
  stepParts(roomStep).title.focus({ preventScroll: true });
}

/**
 * The room size fields (UX-08 item 4): shown as they are for the Custom preset, behind the
 * "Adjust size" disclosure for the others. With Custom the disclosure is held open and its
 * summary is hidden (`.is-custom`, styles.css).
 */
function syncSizeFields() {
  const custom = roomPreset.value === 'custom';
  roomSizeAdjust.classList.toggle('is-custom', custom);
  roomSizeAdjust.open = custom || sizeAdjustOpen;
}

function renderRoomUi() {
  roomGraphJson.textContent = roomGraph ? JSON.stringify(roomGraph, null, 2) : 'null';
  const has = !!roomGraph;
  // The selected product can have gone with the change being shown (delete, undo, clear, replace).
  if (selectedPlacementId && !roomGraph?.placements.some((p) => p.id === selectedPlacementId)) selectPlacement(null);
  // #room-tools holds the steps and is always shown. What needs a room is hidden or disabled here.
  roomPlan.hidden = !has;
  $('room-plan-actions').hidden = !has;
  // The room toolbar (Picker A1 as corrected by QA C15): Undo, Redo and Export project need a
  // room. Import project is always there. The toolbar is in the Room group, so none of it is
  // rendered in the Product workspace, room or no room.
  btnUndo.hidden = !has;
  btnRedo.hidden = !has;
  btnExportProject.hidden = !has;
  // None of these can do anything without a room. ("Download plan PNG" is hidden with its row above.)
  $<HTMLButtonElement>('btn-save-template-scratch').disabled = !has;
  $<HTMLButtonElement>('btn-clear-room').disabled = !has;
  btnDrawWallMode.disabled = !has;
  setRoomStep(roomStep);
  if (!has) {
    roomStatus.textContent = 'No room yet — from scratch, import plan, or template.';
    roomStatus.classList.remove('error');
    roomPlan.innerHTML = '';
    openingList.innerHTML = '';
    placementList.innerHTML = '';
    setToolButtons(null);
    return;
  }
  syncStageState();
  const room = roomGraph!.rooms[0];
  const u = displayUnit();
  const len = room ? Math.abs(room.floor_polygon[1].x - room.floor_polygon[0].x) : 0;
  const wid = room ? Math.abs(room.floor_polygon[2].z - room.floor_polygon[1].z) : 0;
  const prov = roomGraph!.provenance;
  const provLabel =
    prov.kind === 'dwg_import'
      ? 'dwg_import'
      : prov.kind === 'template_instance'
        ? `template:${prov.template_id ?? '?'}`
        : 'authored';
  roomStatus.classList.remove('error');
  roomStatus.textContent = `${room?.name ?? 'Room'} · ${formatLength(len, u)} × ${formatLength(wid, u)} · ceiling ${formatLength(room!.ceiling_height, u)} · ${roomGraph!.openings.length} opening(s) · ${roomGraph!.placements.length} placement(s) · ${provLabel}`;
  syncMaterialSelectsFromGraph();
  renderPlanSvg();
  renderOpeningList();
  renderPlacementList();
  // The selected product's finish can have changed (a swatch, undo, redo): show the room's truth.
  syncMaterialsCard();
}

function renderImportReview() {
  const review = $('import-review');
  const status = $('import-status');
  const banner = $('import-extract-banner');
  const preview = $('import-preview');
  const wallList = $('import-wall-list');
  const openingCandList = $('import-opening-list');
  const roomCandList = $('import-room-list');
  const scaleStatus = $('import-scale-status');
  if (!importJob) {
    review.hidden = true;
    return;
  }
  review.hidden = false;
  $('underlay-review').hidden = true;
  const ex = importJob.candidates.extract;
  banner.textContent = `[${ex.path}] ODA available: ${ex.oda_available ? 'yes' : 'no'} — ${ex.note}`;
  status.textContent = `Job ${importJob.id} · source ${importJob.source.kind}:${importJob.source.filename} · scale ×${importJob.scale_factor.toFixed(3)}`;
  status.classList.remove('error');
  preview.innerHTML = candidatesOverlaySvg(importJob);
  scaleStatus.textContent = importJob.candidates.scale_hint
    ? `Hint: ${importJob.candidates.scale_hint.label} = ${importJob.candidates.scale_hint.length_m} m in extract space → factor ${importJob.scale_factor.toFixed(3)}`
    : 'No scale hint on this extract — enter a known length if needed.';

  wallList.innerHTML = '';
  for (const w of importJob.candidates.walls) {
    const li = document.createElement('li');
    const len = Math.hypot(w.b.x - w.a.x, w.b.z - w.a.z) * importJob.scale_factor;
    li.innerHTML = `<span>${w.id} · ${formatLength(len, 'm')}${w.source_layer ? ` · ${w.source_layer}` : ''}</span>`;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = w.accepted ? 'Accepted' : 'Rejected';
    btn.addEventListener('click', () => {
      importJob = setCandidateAccepted(importJob!, 'wall', w.id, !w.accepted);
      renderImportReview();
    });
    li.appendChild(btn);
    wallList.appendChild(li);
  }

  openingCandList.innerHTML = '';
  for (const o of importJob.candidates.openings) {
    const li = document.createElement('li');
    li.innerHTML = `<span>${o.type} · ${formatLength(o.width * importJob.scale_factor, 'm')}${o.inferred ? ' · inferred' : ''}${o.source_block ? ` · ${o.source_block}` : ''}</span>`;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = o.accepted ? 'Accepted' : 'Rejected';
    btn.addEventListener('click', () => {
      importJob = setCandidateAccepted(importJob!, 'opening', o.id, !o.accepted);
      renderImportReview();
    });
    li.appendChild(btn);
    openingCandList.appendChild(li);
  }

  roomCandList.innerHTML = '';
  for (const r of importJob.candidates.rooms) {
    const li = document.createElement('li');
    li.innerHTML = `<span>${r.name ?? r.id} · ceiling ${formatLength(r.ceiling_height, 'm')}</span>`;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = r.accepted ? 'Accepted' : 'Rejected';
    btn.addEventListener('click', () => {
      importJob = setCandidateAccepted(importJob!, 'room', r.id, !r.accepted);
      renderImportReview();
    });
    li.appendChild(btn);
    roomCandList.appendChild(li);
  }
}

function renderTemplateList() {
  const list = $('template-list');
  const status = $('template-status');
  const templates = loadTemplates();
  list.innerHTML = '';
  if (templates.length === 0) {
    status.textContent = 'No templates yet — import a plan and choose “Save as template”.';
    return;
  }
  status.textContent = `${templates.length} template(s) in local CMS (catalog3d.roomTemplates).`;
  for (const tpl of templates) {
    const li = document.createElement('li');
    const walls = tpl.room_graph.walls.length;
    const src = tpl.room_graph.source_assets[0]?.filename ?? 'shell';
    li.innerHTML = `<span><strong>${tpl.title}</strong> · ${walls} walls · ${src}</span>`;
    const actions = document.createElement('span');
    actions.style.display = 'flex';
    actions.style.gap = '6px';
    const useBtn = document.createElement('button');
    useBtn.type = 'button';
    useBtn.textContent = 'Instantiate';
    useBtn.addEventListener('click', async () => {
      try {
        const graph = instantiateTemplate(tpl.id);
        if (!(await confirmReplaceRoom())) return;
        setWorkspace('room');
        applyRoomGraph(graph, { frame: true, reloadPlacements: true, history: 'reset' });
        onRoomStarted();
        roomStatus.textContent = `Instantiated template “${tpl.title}”`;
        roomStatus.classList.remove('error');
      } catch (err) {
        status.textContent = String((err as Error)?.message ?? err);
        status.classList.add('error');
      }
    });
    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.textContent = 'Delete';
    delBtn.addEventListener('click', async () => {
      const c = copy.confirm.deleteTemplate;
      const confirmed = await confirmDialog({
        title: fmt(c.title, { name: tpl.title }),
        body: c.body,
        confirmLabel: c.confirmLabel,
        cancelLabel: c.cancelLabel,
        destructive: true,
      });
      if (!confirmed) return;
      deleteTemplate(tpl.id);
      renderTemplateList();
    });
    actions.append(useBtn, delBtn);
    li.appendChild(actions);
    list.appendChild(li);
  }
}

async function onStartImport(file: File | null, useFixture: boolean) {
  const status = $('import-status');
  status.classList.remove('error');
  status.textContent = useFixture ? 'Loading mock fixture extract…' : `Deriving candidates from ${file?.name ?? 'file'}…`;
  try {
    underlayJob = null;
    renderUnderlayReview();
    importJob = await startImportJob(file, { useFixture });
    if (importJob.source.uri.startsWith('blob:')) sessionUrls.push(importJob.source.uri);
    const hint = importJob.candidates.scale_hint;
    if (hint) ($('import-known-length') as HTMLInputElement).value = String(hint.length_m);
    renderImportReview();
  } catch (err) {
    status.textContent = String((err as Error)?.message ?? err);
    status.classList.add('error');
    importJob = null;
    renderImportReview();
  }
}

function onApplyImportScale() {
  if (!importJob) return;
  try {
    const known = Number(($('import-known-length') as HTMLInputElement).value);
    const factor = scaleFactorFromKnownLength(importJob, known);
    importJob = setScaleFactor(importJob, factor);
    renderImportReview();
  } catch (err) {
    $('import-scale-status').textContent = String((err as Error)?.message ?? err);
  }
}

async function onImportStartEditing() {
  if (!importJob) return;
  try {
    const job = importJob;
    const graph = confirmImportToRoomGraph(job);
    if (!(await confirmReplaceRoom())) return;
    importJob = { ...job, status: 'confirmed' };
    setWorkspace('room');
    applyRoomGraph(graph, { frame: true, reloadPlacements: true, history: 'reset' });
    onRoomStarted();
    roomStatus.textContent = `Immediate room from import · ${graph.source_assets[0]?.extract_path ?? 'import'} · place Catalog 3D GLBs`;
    roomStatus.classList.remove('error');
  } catch (err) {
    $('import-status').textContent = String((err as Error)?.message ?? err);
    $('import-status').classList.add('error');
  }
}

function onImportSaveTemplate() {
  if (!importJob) return;
  try {
    const graph = confirmImportToRoomGraph(importJob);
    importJob = { ...importJob, status: 'confirmed' };
    const tpl = saveGraphAsTemplate(graph, {
      title: graph.label ?? 'Imported plan',
      tags: ['dwg_import', graph.source_assets[0]?.extract_path ?? 'mock'],
      preview_svg: candidatesOverlaySvg(importJob),
    });
    setRoomIngress('template');
    renderTemplateList();
    roomStatus.textContent = `Saved template “${tpl.title}” — instantiate from From template`;
    roomStatus.classList.remove('error');
  } catch (err) {
    $('import-status').textContent = String((err as Error)?.message ?? err);
    $('import-status').classList.add('error');
  }
}

function renderPlanSvg() {
  if (!roomGraph) {
    roomPlan.innerHTML = '';
    return;
  }
  roomPlan.innerHTML = buildPlanSvg(roomGraph, {
    unit: displayUnit(),
    underlayHref: roomGraph.underlay?.uri,
    underlayOpacity: roomGraph.underlay?.opacity,
  });
}

function renderUnderlayReview() {
  const review = $('underlay-review');
  const status = $('underlay-status');
  const preview = $('underlay-preview');
  if (!underlayJob) {
    review.hidden = true;
    return;
  }
  review.hidden = false;
  $('import-review').hidden = true;
  status.textContent = `${underlayJob.note} · ${underlayJob.source.filename}`;
  ($('underlay-width') as HTMLInputElement).value = String(underlayJob.width_m);
  ($('underlay-depth') as HTMLInputElement).value = String(underlayJob.depth_m);
  preview.innerHTML = `<img src="${underlayJob.imageUri}" alt="Underlay preview" style="max-width:100%;max-height:160px;object-fit:contain" />`;
}

async function onStartUnderlay(file: File) {
  const status = $('import-status');
  status.classList.remove('error');
  status.textContent = `Starting raster underlay from ${file.name}…`;
  try {
    importJob = null;
    $('import-review').hidden = true;
    underlayJob = await startUnderlayJob(file);
    if (underlayJob.source.uri.startsWith('blob:')) sessionUrls.push(underlayJob.source.uri);
    renderUnderlayReview();
    status.textContent = `Underlay ready — confirm width/depth, then create room.`;
  } catch (err) {
    status.textContent = String((err as Error)?.message ?? err);
    status.classList.add('error');
    underlayJob = null;
    renderUnderlayReview();
  }
}

async function onUnderlayConfirm() {
  if (!underlayJob) return;
  try {
    underlayJob = {
      ...underlayJob,
      width_m: Number(($('underlay-width') as HTMLInputElement).value),
      depth_m: Number(($('underlay-depth') as HTMLInputElement).value),
      status: 'confirmed',
    };
    const graph = confirmUnderlayToRoomGraph(underlayJob);
    if (!(await confirmReplaceRoom())) return;
    underlayJob = null;
    renderUnderlayReview();
    setWorkspace('room');
    applyRoomGraph(graph, { frame: true, reloadPlacements: true, history: 'reset' });
    onRoomStarted();
    roomStatus.textContent = `Room from underlay · ${graph.source_assets[0]?.filename ?? 'raster'} · place Catalog 3D GLBs`;
    roomStatus.classList.remove('error');
  } catch (err) {
    $('underlay-status').textContent = String((err as Error)?.message ?? err);
    $('underlay-status').classList.add('error');
  }
}

async function onDownloadPlanPng() {
  if (!roomGraph) return;
  try {
    const svg = buildPlanSvg(roomGraph, {
      unit: displayUnit(),
      underlayHref: roomGraph.underlay?.uri,
      underlayOpacity: roomGraph.underlay?.opacity,
    });
    const dataUrl = await planSvgToPngDataUrl(svg);
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `${roomGraph.label ?? 'room-plan'}.png`;
    a.click();
    roomStatus.textContent = 'Downloaded plan PNG';
    roomStatus.classList.remove('error');
  } catch (err) {
    roomStatus.textContent = `Plan export failed: ${String((err as Error)?.message ?? err)}`;
    roomStatus.classList.add('error');
  }
}

function onExportProject() {
  const project = exportProjectJson({
    graph: roomGraph,
    templates: loadTemplates(),
    label: roomGraph?.label,
  });
  downloadTextFile('catalog3d-project.json', serializeProject(project));
  void persistProjectToIdb(project);
  roomStatus.textContent = 'Exported project JSON (room graph + templates)';
  roomStatus.classList.remove('error');
}

async function onImportProjectFile(file: File) {
  try {
    const project = parseProjectJson(JSON.parse(await file.text()));
    // Ask before anything is written: "Keep current room" must leave the room and the templates alone.
    if (!(await confirmReplaceRoom())) return;
    if (project.templates.length) persistTemplates(project.templates);
    setWorkspace('room');
    applyRoomGraph(project.room_graph, { frame: true, reloadPlacements: true, history: 'reset' });
    onRoomStarted();
    if (project.templates.length) renderTemplateList();
    // Opening a project can start from the card on the stage (QA-04), so its result is said there.
    notify(
      project.label ? fmt(copy.roomMessages.importOk, { name: project.label }) : copy.roomMessages.importOkUnnamed,
      { kind: 'success' },
    );
  } catch (err) {
    notifyProblem(friendlyError(err, 'project-import'));
  }
}

function onSaveTemplateFromScratch() {
  if (!roomGraph) {
    roomStatus.textContent = 'Create or load a room first.';
    roomStatus.classList.add('error');
    return;
  }
  try {
    const title = ($('template-title') as HTMLInputElement).value.trim() || roomGraph.label || 'Room template';
    const tpl = saveGraphAsTemplate(roomGraph, {
      title,
      tags: ['authored'],
      preview_svg: buildPlanSvg(roomGraph, { unit: displayUnit() }),
    });
    setRoomIngress('template');
    renderTemplateList();
    roomStatus.textContent = `Saved template “${tpl.title}” — instantiate from From template`;
    roomStatus.classList.remove('error');
  } catch (err) {
    roomStatus.textContent = String((err as Error)?.message ?? err);
    roomStatus.classList.add('error');
  }
}

function onRoomMaterialChange() {
  if (!roomGraph) return;
  const wallId = roomWallMaterial.value || null;
  const floorId = roomFloorMaterial.value || null;
  const next = setRoomSurfaceMaterials(roomGraph, {
    wall_material_id: wallId,
    floor_material_id: floorId,
  });
  applyRoomGraph(next, { frame: false, reloadPlacements: false });
}

function renderOpeningList() {
  openingList.innerHTML = '';
  if (!roomGraph) return;
  for (const op of roomGraph.openings) {
    const li = document.createElement('li');
    const u = displayUnit();
    li.innerHTML = `<span>${op.type} · ${formatLength(op.width, u)} × ${formatLength(op.height, u)} · sill ${formatLength(op.sill_height, u)}</span>`;
    const del = document.createElement('button');
    del.type = 'button';
    del.textContent = 'Delete';
    del.addEventListener('click', () => {
      if (!roomGraph) return;
      applyRoomGraph(removeOpening(roomGraph, op.id), { frame: false, reloadPlacements: false });
    });
    li.appendChild(del);
    openingList.appendChild(li);
  }
}

// ------------------------------------------------------------------ placed products (UX-09)

/** The rows of the Products list for the room as it is now: each product named and numbered (UX-09 item 2). */
function placementRowsNow(): PlacementRow[] {
  return roomGraph ? placementRows(roomGraph.placements, catalog.products) : [];
}

/** What the list, and every message, calls a placed product: "Lounge chair (demo) 2". */
function placementLabel(placementId: string): string | undefined {
  return placementRowsNow().find((r) => r.id === placementId)?.label;
}

/**
 * Re-render a part of the panel without dropping keyboard focus. Rows and swatches are rebuilt on
 * every room change; the control that had focus is found again by the selector `keyOf` gives for it.
 */
function keepingFocus(container: HTMLElement, keyOf: (el: Element) => string | null, render: () => void) {
  const active = document.activeElement;
  const key = active && container.contains(active) ? keyOf(active) : null;
  render();
  if (key) container.querySelector<HTMLElement>(key)?.focus({ preventScroll: true });
}

/** Selector of a button of the Products list, from the button as it is now. */
function placementControlKey(el: Element): string | null {
  const id = el.closest<HTMLElement>('li[data-placement-id]')?.dataset.placementId;
  const action = el.closest<HTMLElement>('button[data-action]')?.dataset.action;
  return id && action ? `li[data-placement-id="${CSS.escape(id)}"] button[data-action="${action}"]` : null;
}

function placementListButton(action: string, label: string): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  b.dataset.action = action;
  b.textContent = label;
  return b;
}

/**
 * The Products list (UX-09 item 2). One row per placed product: its numbered name, which selects
 * it, and Delete. The selected row carries `aria-current` and also holds the two Rotate buttons.
 * A placement whose product is not in the catalog (a model uploaded before a refresh) is not in
 * the room; its row says so (Copy §6 C) and can only be deleted.
 * The rows hold no listeners: `initPlacedProductsUi` listens on the list.
 */
function renderPlacementList() {
  const labels = copy.notInDeck.placedProducts;
  keepingFocus(placementList, placementControlKey, () => {
    placementList.innerHTML = '';
    for (const row of placementRowsNow()) {
      const li = document.createElement('li');
      li.dataset.placementId = row.id;
      if (!row.inCatalog) {
        li.className = 'placement-missing';
        const text = document.createElement('span');
        text.textContent = fmt(copy.notInDeck.uploadNotRestored, { name: row.name });
        li.append(text, placementListButton('delete', copy.common.delete));
      } else {
        li.className = 'placement-row';
        const name = placementListButton('select', row.label);
        name.className = 'placement-name';
        li.append(name, placementListButton('delete', copy.common.delete));
        if (row.id === selectedPlacementId) {
          li.setAttribute('aria-current', 'true');
          const actions = document.createElement('span');
          actions.className = 'placement-actions';
          actions.append(
            placementListButton('rotate-left', labels.rotateLeft),
            placementListButton('rotate-right', labels.rotateRight),
          );
          li.appendChild(actions);
        }
      }
      placementList.appendChild(li);
    }
  });
  // A hovered row can have gone with its placement.
  if (hoveredPlacementId && !roomGraph?.placements.some((p) => p.id === hoveredPlacementId)) {
    hoveredPlacementId = null;
    syncPlacementOutline();
  }
}

/**
 * The engine outlines one placed product: the one whose row is hovered, else the selected one.
 * It is told only when that changes (the outline survives a reload of the placements by itself).
 */
function syncPlacementOutline() {
  const want = hoveredPlacementId ?? selectedPlacementId;
  if (want === outlinedPlacementId) return;
  outlinedPlacementId = want;
  viewer?.setPlacementHighlight(want);
}

/**
 * Select a placed product, or none (UX-09 item 2). The one place that changes the selection.
 * Everything that shows it follows from here: the outline in the room, the row's `aria-current`
 * and Rotate buttons, the Materials card (UX-16 step 4: the selected product's own finish) and
 * the stage hint with the keys.
 * A placement that is not in the room (unknown id, or its product is not in the catalog) cannot
 * be selected; asking for it clears the selection.
 */
function selectPlacement(id: string | null, anchor: () => HTMLElement | null = focusedBelowMaterials) {
  const row = id && workspace === 'room' ? placementRowsNow().find((r) => r.id === id) : undefined;
  const next = row?.inCatalog ? row.id : null;
  if (next === selectedPlacementId) return;
  selectedPlacementId = next;
  // The Materials card now shows another product, which can have more or fewer slots: the card
  // changes height, and everything under it in the step would move. `anchor` is what the user
  // is acting on down there; it stays where it is.
  keepingInPlace(anchor, () => {
    syncPlacementOutline();
    renderPlacementList();
    syncMaterialsCard();
  });
  syncStageState();
}

/**
 * Run a change that redraws part of the panel, and keep one element where it is on screen by
 * scrolling by however far it moved. `anchor` is asked before and after the change, because rows
 * of the Products list are new elements afterwards. Without this, a click on a row could move
 * the list from under the pointer and leave "Add to room" there instead.
 */
function keepingInPlace(anchor: () => HTMLElement | null, change: () => void) {
  const before = anchor()?.getBoundingClientRect().top;
  change();
  const after = anchor()?.getBoundingClientRect().top;
  if (before === undefined || after === undefined || Math.abs(after - before) < 1) return;
  // The panel scrolls on a wide screen; on a narrow one the page does.
  const scroller = getComputedStyle(panel).overflowY === 'visible' ? window : panel;
  scroller.scrollBy({ top: after - before, behavior: 'instant' });
}

/**
 * The control with keyboard focus, when it is in the "Place products" step under the Materials
 * card: a row of the list, "Add to room", "Place product". That is what the user is acting on
 * when the selection changes without a pointer (Esc, Delete) or from one of those buttons.
 */
function focusedBelowMaterials(): HTMLElement | null {
  const el = document.activeElement;
  if (!(el instanceof HTMLElement) || !materialsHomeRoom.parentElement?.contains(el)) return null;
  return materialsCard.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING && !materialsCard.contains(el) ? el : null;
}

/**
 * Delete a placed product. One history step, so Undo brings it back.
 * If keyboard focus was on its row, it goes to the row after it, the one before it, or "Add to room".
 */
function deletePlacement(placementId: string) {
  if (!roomGraph?.placements.some((p) => p.id === placementId)) return;
  const li = placementList.querySelector<HTMLElement>(`li[data-placement-id="${CSS.escape(placementId)}"]`);
  const hadFocus = !!li && li.contains(document.activeElement);
  const neighbourId = ((li?.nextElementSibling ?? li?.previousElementSibling) as HTMLElement | null)?.dataset.placementId;
  viewer?.detachPlacement(placementId);
  // renderRoomUi (through applyRoomGraph) lets go of the selection if this was the selected one.
  applyRoomGraph(removePlacement(roomGraph, placementId), { frame: false, reloadPlacements: false });
  if (!hadFocus) return;
  const next = neighbourId
    ? placementList.querySelector<HTMLElement>(`li[data-placement-id="${CSS.escape(neighbourId)}"] button`)
    : btnAddToRoom;
  next?.focus({ preventScroll: true });
}

/**
 * A toast said by a move is out of date once the next move is fine: close it, unless another
 * toast has been shown since. (Closing a toast that has already gone does nothing.)
 */
function clearMoveNotice() {
  if (lastMoveNotice && lastToast === lastMoveNotice) dismissNotification();
  lastMoveNotice = null;
}

function notifyMove(text: string) {
  lastMoveNotice = text;
  notify(text, { kind: 'warning' });
}

/**
 * Move and/or turn the selected product (UX-09 item 3). The model in the room is moved in place
 * (`setPlacementPose`, never `attachPlacement`), then the room graph is updated as one history
 * step, so Undo reverses exactly this move.
 *
 * A move never takes a product out of the room: when the new floor point is outside the floor
 * polygon (`pointInRoom`, the test a Place click has to pass: QA-02, D-QA1) the product stays
 * where it is and a toast says so. A product that is already outside (a room saved by an older
 * build) may be moved freely, so it can be brought back in.
 * Overlapping a wall or another product is allowed, as when placing; the soft warning follows.
 */
function moveSelectedPlacement(change: { position?: { x: number; z: number }; rotationY?: number }) {
  if (!roomGraph || !viewer || !selectedPlacementId) return;
  const id = selectedPlacementId;
  const pl = roomGraph.placements.find((p) => p.id === id);
  if (!pl) return;
  const label = placementLabel(id) ?? pl.sku_id;
  const position = change.position ?? { x: pl.position.x, z: pl.position.z };
  const rotationY = change.rotationY ?? pl.rotation_y;
  if (change.position && !pointInRoom(roomGraph, position) && pointInRoom(roomGraph, pl.position)) {
    notifyMove(fmt(copy.notInDeck.placedProducts.movedOutsideRoom, { name: label }));
    return;
  }
  // False while the product's model is still loading: it is then attached at the pose in the graph.
  viewer.setPlacementPose(id, position, rotationY);
  applyRoomGraph(
    updatePlacement(roomGraph, id, { position: { x: position.x, y: 0, z: position.z }, rotation_y: rotationY }),
    { frame: false, reloadPlacements: false },
  );
  // The same check, with the same boxes, as the warning after placing.
  const footprint = viewer.getPlacementFootprint(id);
  const report = footprint && roomGraph ? checkPlacementCollision(roomGraph, footprint, { ignorePlacementId: id }) : null;
  const warning = report ? movedOverlapMessage(label, report, (o) => placementLabel(o.id) ?? o.label) : null;
  if (warning) notifyMove(warning);
  else clearMoveNotice();
}

/** One arrow-key step: 5 cm, or 25 cm with Shift, along the room's axes (`nudgedPosition`). */
function nudgeSelectedPlacement(key: string, big: boolean) {
  const pl = roomGraph?.placements.find((p) => p.id === selectedPlacementId);
  const position = pl && nudgedPosition(pl.position, key, big);
  if (position) moveSelectedPlacement({ position });
}

/** A quarter turn of the selected product about its own floor point. */
function rotateSelectedPlacement(direction: 'left' | 'right') {
  const pl = roomGraph?.placements.find((p) => p.id === selectedPlacementId);
  if (pl) moveSelectedPlacement({ rotationY: quarterTurn(pl.rotation_y, direction) });
}

/**
 * Keys that some controls use themselves. With focus on one of them an arrow key belongs to the
 * control (a slider, a group of radio buttons, a list of options), not to the selected product.
 * That includes the trigger of a catalog picker (`aria-haspopup`): Arrow Down or Up on it opens
 * its pop-up, and must not also move the selected product. (Inside the open pop-up the keys never
 * get this far: see `isTypingTarget`.)
 */
function ownsArrowKeys(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  if (target instanceof HTMLInputElement && (target.type === 'range' || target.type === 'radio')) return true;
  return !!target.closest('[role=radiogroup], [role=listbox], [role=slider], [role=tablist], [role=menu], [aria-haspopup]');
}

/**
 * The keys of the selected product (UX-09 items 3 and 5). Returns true when the key was used.
 *   Arrow keys          move 5 cm; with Shift 25 cm
 *   R / Shift+R         rotate right / left by 90°
 *   Delete, Backspace   remove
 * The caller has already ruled out typing targets and Ctrl/Cmd combinations.
 */
function onSelectedPlacementKey(e: KeyboardEvent): boolean {
  if (!selectedPlacementId || !roomGraph || e.altKey) return false;
  if (isNudgeKey(e.key)) {
    if (ownsArrowKeys(e.target)) return false;
    nudgeSelectedPlacement(e.key, e.shiftKey);
    return true;
  }
  if (e.key === 'r' || e.key === 'R') {
    rotateSelectedPlacement(e.shiftKey ? 'left' : 'right');
    return true;
  }
  if (e.key === 'Delete' || e.key === 'Backspace') {
    deletePlacement(selectedPlacementId);
    return true;
  }
  return false;
}

/**
 * A room saved with a product that is no longer in the catalog (a model uploaded before a
 * refresh; Copy §6 C). The room is shown without it. Say so once per placement, on the stage,
 * when the room is on the stage; the row in the Products list says it for as long as it is there.
 */
function announceMissingProducts() {
  if (workspace !== 'room' || !roomGraph) return;
  const missing = placementRowsNow().filter((r) => !r.inCatalog && !announcedMissing.has(r.id));
  if (!missing.length) return;
  for (const r of missing) announcedMissing.add(r.id);
  notify(fmt(copy.notInDeck.uploadNotRestored, { name: missing[0]!.name }), { kind: 'warning' });
}

/** One-time wiring of the Products list. The rows are rebuilt on every change, so the list itself listens. */
function initPlacedProductsUi() {
  placementList.addEventListener('click', (e) => {
    const target = e.target as Element;
    const li = target.closest<HTMLElement>('li[data-placement-id]');
    const id = li?.dataset.placementId;
    if (!li || !id) return;
    const action = target.closest<HTMLElement>('button[data-action]')?.dataset.action;
    if (action === 'delete') {
      deletePlacement(id);
    } else if (action === 'rotate-left' || action === 'rotate-right') {
      rotateSelectedPlacement(action === 'rotate-left' ? 'left' : 'right');
    } else if (li.classList.contains('placement-row')) {
      // The name, or anywhere else on the row. A tool that is on is left first: with a tool on,
      // the canvas and the keys belong to the tool. The row stays under the pointer.
      exitRoomTool();
      selectPlacement(id, () =>
        placementList.querySelector<HTMLElement>(`li[data-placement-id="${CSS.escape(id)}"]`),
      );
    }
  });
  // Hovering a row outlines its product in the room (UX-09 item 2). The listener is on the document:
  // the rows are rebuilt under the pointer, and a row that has been replaced gets no "leave" event,
  // but whatever the pointer goes over next always gets an "over".
  const hover = (id: string | null) => {
    if (id === hoveredPlacementId) return;
    hoveredPlacementId = id;
    syncPlacementOutline();
  };
  document.addEventListener('pointerover', (e) => {
    if (e.pointerType === 'touch') return; // a tap selects; it is not a hover
    const li = e.target instanceof Element ? e.target.closest<HTMLElement>('#placement-list li.placement-row') : null;
    hover(li?.dataset.placementId ?? null);
  });
  document.documentElement.addEventListener('pointerleave', () => hover(null));
}

/**
 * The three tool buttons keep one fixed label each (deck §3.6). Their state is `aria-pressed`,
 * and the stage hint says what a click on the canvas will do.
 */
function setToolButtons(mode: InteractionMode | null) {
  btnOpeningMode.setAttribute('aria-pressed', String(mode === 'opening'));
  btnPlaceMode.setAttribute('aria-pressed', String(mode === 'place'));
  btnDrawWallMode.setAttribute('aria-pressed', String(mode === 'draw-wall'));
  // With a tool on, a click on the canvas and the hint line belong to the tool: let go of the selected product.
  if (mode === 'opening' || mode === 'place' || mode === 'draw-wall') selectPlacement(null);
  syncStageState();
}

/**
 * What the stage itself says about the current state. One function, so the two cannot disagree.
 *
 * `#stage-hint` is the single on-canvas state line and always carries the deck §3.3 string for
 * the state. With a tool on it is shown as a chip (`data-tool`, styled in styles.css); with no
 * tool on the chip goes away and the same element is the quiet nudge it was before.
 *
 * `#stage-empty` is the card for the Room workspace with no room (UX-06).
 *
 * The state is read here, not passed in: workspace, room, the engine's interaction mode, the
 * opening type, the product chosen in the picker and the placed product that is selected. Call it
 * after any of them changes.
 */
function syncStageState() {
  const inRoom = workspace === 'room';
  const im = viewer?.getInteractionMode();
  const tool = inRoom && roomGraph && (im === 'opening' || im === 'place' || im === 'draw-wall') ? im : null;
  let hint: string;
  if (!inRoom) hint = copy.stageHints.product;
  else if (!roomGraph) hint = copy.stageHints.roomEmpty;
  else if (tool === 'opening')
    hint = openingType === 'window' ? copy.stageHints.addOpeningWindow : copy.stageHints.addOpeningDoor;
  else if (tool === 'place') hint = fmt(copy.stageHints.placeProduct, { product: currentProduct?.name ?? '' });
  else if (tool === 'draw-wall') hint = copy.stageHints.drawWalls;
  // A placed product is selected (UX-09): the hint gives its keys.
  else if (selectedPlacementId) hint = copy.notInDeck.placedProducts.selectedHint;
  else hint = copy.stageHints.roomIdle;
  stageHint.textContent = hint;
  if (tool) stageHint.dataset.tool = tool;
  else delete stageHint.dataset.tool;
  stageEmpty.hidden = !(inRoom && !roomGraph);
}

function setWorkspace(mode: 'catalog' | 'room') {
  const changed = workspace !== mode;
  workspace = mode;
  document.body.dataset.workspace = mode;
  // A toast belongs to the stage it was shown on. Do not carry it into the other workspace.
  if (changed) dismissNotification();
  workspaceMode.querySelectorAll('button').forEach((b) => {
    b.setAttribute('aria-checked', String(b.getAttribute('data-mode') === mode));
  });
  // UX-07 item 1: only the active workspace's controls are rendered. `hidden` also takes the
  // other group's controls out of the tab order (QA-09).
  panelCatalog.hidden = mode !== 'catalog';
  panelRoom.hidden = mode !== 'room';
  // The one product picker goes where it is used: the Product card, or the "Place products" step.
  const pickerHome = $(mode === 'room' ? 'product-picker-home-room' : 'product-picker-home-catalog');
  if (productPickerSlot.parentElement !== pickerHome) pickerHome.appendChild(productPickerSlot);
  // So does the one Materials card (UX-16 step 3): right after the Product card, or under the picker
  // in the "Place products" step. Moved, never copied.
  if (mode === 'room') {
    if (materialsCard.parentElement !== materialsHomeRoom) materialsHomeRoom.appendChild(materialsCard);
  } else if (catalogCard.nextElementSibling !== materialsCard) {
    catalogCard.after(materialsCard);
  }
  // A placed product is selected in the room only. Leaving the room lets go of it.
  if (mode !== 'room') selectPlacement(null);
  const hint = $('workspace-mode-hint');
  if (mode === 'catalog') {
    hint.textContent = 'Product turntable — inspect GLB, materials, and packs.';
    viewer?.setInteractionMode('catalog');
    // Reframe the catalog GLB — room camera/shell must not leave the product invisible.
    viewer?.resetCamera();
    setToolButtons(null);
  } else {
    hint.textContent = 'Room editor — build the shell, openings, and place Catalog 3D products.';
    // Room mode with or without a room. With no room the engine shows an empty stage instead of
    // the turntable product (`hideProductInEmptyRoom`, see mountViewer), and syncStageState puts
    // the empty-room card over it (UX-06).
    viewer?.setInteractionMode('room');
    // Frame the room on arrival from Product only. Framing on every call threw away the
    // view the user had just orbited to.
    if (roomGraph && changed) viewer?.frameRoom();
    setToolButtons(null);
  }
  // UX-07 item 4: the panel of the workspace starts at its top. It used to scroll a card into
  // view, which left the panel mid-form and, on a narrow screen, scrolled the 3D view away
  // (QA-03). The cold boot goes through here too and must not move the page: the group shown is
  // already at the top, and the stage is only brought into view on a real switch.
  scrollPanelToTop();
  if (changed) revealStage();
  // The card says what its swatches apply to in this workspace (its state line shows in Room only).
  renderSlots();
  // Arriving in a room that was saved with a product the catalog no longer has: say so now.
  if (changed) announceMissingProducts();
}

function readOpeningParamsMeters() {
  const u = displayUnit();
  return {
    width: fieldMeters(openingWidth, u),
    height: fieldMeters(openingHeight, u),
    sill_height: fieldMeters(openingSill, u),
  };
}

/** Leave the active room tool (opening, place or draw walls), if one is on. Returns whether one was. */
function exitRoomTool(): boolean {
  const mode = viewer?.getInteractionMode();
  if (mode !== 'opening' && mode !== 'place' && mode !== 'draw-wall') return false;
  drawSession = null;
  viewer?.setInteractionMode('room');
  setToolButtons(null);
  return true;
}

/** Input types that take no typed text and do nothing of their own with Esc or undo. */
const NON_TYPING_INPUT_TYPES = new Set(['checkbox', 'radio', 'button', 'submit', 'reset', 'file', 'range', 'color', 'image']);

/**
 * True when a key press belongs to the control it came from: a field the user types in, a
 * select, or anything inside an open dialog or pop-up (`popover`: it closes itself on Esc and
 * may use the arrow keys). Global shortcuts (undo, redo, Esc, the keys of a selected product) must
 * leave those alone. A ticked checkbox keeps focus but has no text to undo, so it does not count.
 */
function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable || target.closest('select, textarea, dialog, [popover]')) return true;
  return target instanceof HTMLInputElement && !NON_TYPING_INPUT_TYPES.has(target.type);
}

function onRoomPointer(hit: RoomPointerHit | null, mode: InteractionMode) {
  if (!roomGraph || !viewer) return;
  // Everything said from here on is about a click on the canvas, so it is said on the canvas
  // (the stage toast), not in the panel's #room-status.
  if (mode === 'room') {
    // No tool on (UX-09 item 2): a click on a placed product selects it; a click anywhere else
    // (floor, wall, outside the room) lets go of the selection. A drag orbits and never gets here.
    selectPlacement(hit?.kind === 'placement' && hit.placementId ? hit.placementId : null);
    return;
  }
  if (mode === 'opening') {
    if (!hit || hit.kind !== 'wall' || !hit.wallId || hit.offsetAlongWall == null) {
      notify(copy.roomMessages.clickWall, { kind: 'warning' });
      return;
    }
    const dims = readOpeningParamsMeters();
    try {
      const next = addOpening(roomGraph, {
        wall_id: hit.wallId,
        type: openingType,
        offset_along_wall: hit.offsetAlongWall,
        ...dims,
      });
      applyRoomGraph(next, { frame: false, reloadPlacements: false });
      notify(openingType === 'window' ? copy.roomMessages.openingAddedWindow : copy.roomMessages.openingAddedDoor, {
        kind: 'success',
      });
    } catch (err) {
      notifyProblem(friendlyError(err, 'opening-add'));
    }
    return;
  }
  if (mode === 'place') {
    if (!hit) {
      // Nothing of the room is under the pointer: the click was outside it (QA-02, D-QA1: reject, say so).
      notify(copy.notInDeck.outsideRoom, { kind: 'warning' });
      return;
    }
    if (hit.kind !== 'floor') {
      notify(copy.roomMessages.clickFloor, { kind: 'warning' });
      return;
    }
    void placeCurrentProduct(hit.point.x, hit.point.z);
    return;
  }
  if (mode === 'draw-wall') {
    const point =
      hit?.kind === 'floor'
        ? { x: hit.point.x, z: hit.point.z }
        : hit
          ? { x: hit.point.x, z: hit.point.z }
          : null;
    if (!point) {
      notify(copy.roomMessages.clickCorner, { kind: 'warning' });
      return;
    }
    if (!drawSession) {
      const room = roomGraph.rooms[0];
      drawSession = createDrawSession({
        displayUnit: displayUnit(),
        ceilingHeight: room?.ceiling_height,
        wallThickness: roomGraph.walls[0]?.thickness,
        name: 'Freeform room',
      });
    }
    if (closeDistance(drawSession, point)) {
      try {
        const graph = commitDrawSession(drawSession);
        drawSession = null;
        applyRoomGraph(graph, { frame: true, reloadPlacements: true });
        viewer.setInteractionMode('room');
        setToolButtons(null);
        notify(plural(graph.walls.length, copy.roomMessages.drawClosed), { kind: 'success' });
      } catch (err) {
        notifyProblem(friendlyError(err, 'draw-walls'));
      }
      return;
    }
    drawSession = addDrawPoint(drawSession, point);
    notify(plural(drawSession.points.length, copy.roomMessages.drawProgress));
  }
}

/** Where a placed product stands: its floor point and its turn about the vertical axis. */
interface PlacementPose {
  x: number;
  z: number;
  rotationY: number;
}

type Footprint = ReturnType<typeof footprintFromObject>;

/**
 * The pose a product gets when it is asked for at floor point (x, z): against the nearest wall
 * when "Snap to nearest wall" is ticked, the point itself otherwise.
 */
function placementPose(graph: RoomGraph, x: number, z: number): PlacementPose {
  if (($('place-wall-snap') as HTMLInputElement).checked) {
    const snap = snapPlacementToWall(graph, { x, z });
    // The snap moves the point toward a wall. Keep it only while it stays on the floor.
    if (snap && pointInRoom(graph, { x: snap.x, z: snap.z })) return { x: snap.x, z: snap.z, rotationY: snap.rotation_y };
  }
  return { x, z, rotationY: 0 };
}

/** The floor box a product covers at a pose, from the box it covers standing unturned at the origin. */
function footprintAtPose(base: Footprint, pose: PlacementPose): Footprint {
  const cos = Math.cos(pose.rotationY);
  const sin = Math.sin(pose.rotationY);
  const xs: number[] = [];
  const zs: number[] = [];
  for (const bx of [base.minX, base.maxX]) {
    for (const bz of [base.minZ, base.maxZ]) {
      // A turn about Y by the same convention three.js uses for `rotation.y`.
      xs.push(pose.x + bx * cos + bz * sin);
      zs.push(pose.z - bx * sin + bz * cos);
    }
  }
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minZ: Math.min(...zs), maxZ: Math.max(...zs) };
}

/**
 * Where "Add to room" puts a product (UX-08 item 3): the first free spot, or the room centre.
 *
 * Candidates are the points of a grid laid over the bounds of the floor polygon, 0.25 m apart
 * (closer in a small room, so each side has at least eight steps), tried nearest the centre of
 * those bounds first. The first product therefore lands in the middle of the room and the next
 * ones beside it. A candidate is turned into the pose a click on that point would give (wall snap
 * included) and is taken when it is
 *   1. on the floor: `pointInRoom`, the test a canvas click has to pass. The centre of the bounds
 *      is a candidate like any other, because in an L-shaped room it is not on the floor;
 *   2. free: `checkPlacementCollision` finds no wall and no placed product under the product's
 *      footprint at that pose. It is asked twice, once with the stand-in boxes it uses by default
 *      (what the "It overlaps…" warning after placing is based on) and once with the real boxes
 *      of the placed products from the viewer. A spot is free only when both agree.
 * When no candidate is free, the product goes to "the room centre": the on-floor candidate nearest
 * the centre that is at least half the product's smaller side away from every wall (`pointInRoom`
 * with a margin), or failing that the nearest on-floor candidate. The usual overlap warning
 * follows; a placement is never blocked by an overlap.
 * Returns null only when no grid point is on the floor at all.
 */
function findSpotInRoom(graph: RoomGraph, root: Object3D): PlacementPose | null {
  const polygon = graph.rooms[0]?.floor_polygon;
  if (!polygon || polygon.length < 3) return null;
  const xsAll = polygon.map((p) => p.x);
  const zsAll = polygon.map((p) => p.z);
  const minX = Math.min(...xsAll);
  const maxX = Math.max(...xsAll);
  const minZ = Math.min(...zsAll);
  const maxZ = Math.max(...zsAll);
  const cx = (minX + maxX) / 2;
  const cz = (minZ + maxZ) / 2;
  const step = Math.max(0.05, Math.min(0.25, (maxX - minX) / 8, (maxZ - minZ) / 8));
  const stepsX = Math.floor((maxX - cx) / step);
  const stepsZ = Math.floor((maxZ - cz) / step);
  const candidates: { x: number; z: number; d2: number }[] = [];
  for (let i = -stepsX; i <= stepsX; i++) {
    for (let j = -stepsZ; j <= stepsZ; j++) candidates.push({ x: cx + i * step, z: cz + j * step, d2: i * i + j * j });
  }
  // Nearest the centre first. The sort is stable, so equal distances keep one fixed order.
  candidates.sort((a, b) => a.d2 - b.d2);

  // The product's box standing unturned at the origin; `attachPlacement` sets the same two fields.
  root.position.set(0, 0, 0);
  root.rotation.y = 0;
  const base = footprintFromObject(root);
  const placed = new Map<string, Footprint>();
  for (const pl of graph.placements) {
    const box = viewer?.getPlacementFootprint(pl.id);
    if (box) placed.set(pl.id, box);
  }

  const inset = Math.min(base.maxX - base.minX, base.maxZ - base.minZ) / 2;
  let centre: PlacementPose | null = null;
  let onFloor: PlacementPose | null = null;
  for (const c of candidates) {
    if (!pointInRoom(graph, c)) continue;
    const pose = placementPose(graph, c.x, c.z);
    if (!pointInRoom(graph, pose)) continue;
    onFloor ??= pose;
    if (!centre && pointInRoom(graph, pose, inset)) centre = pose;
    const footprint = footprintAtPose(base, pose);
    if (
      checkPlacementCollision(graph, footprint).ok &&
      checkPlacementCollision(graph, footprint, { otherFootprints: placed }).ok
    ) {
      return pose;
    }
  }
  return centre ?? onFloor;
}

/** "Add to room" clicks run one after another: each search has to see what the one before it placed. */
let addToRoomQueue: Promise<void> = Promise.resolve();

/**
 * The finish a product is placed with (UX-16 step 2): the choices the Materials card shows for
 * the next product, read from the turntable (`viewer.getSlots()`), once every swatch click made
 * so far has been applied there. Call it at the moment the user asks to place: what the card
 * showed then is what the product gets, whatever they click while its model loads.
 */
async function finishToPlace(product: Product): Promise<Record<string, string>> {
  // Nothing is chosen for a product that keeps its own materials: it is saved with its defaults, as before.
  if (keepsOwnMaterials(product)) return finishForPlacing(product, null, library);
  await slotApplyPending;
  const shown = viewer ? { productId: viewer.getPartsList()?.productId, slots: viewer.getSlots() } : null;
  return finishForPlacing(product, shown, library);
}

/**
 * UX-16: "a pack or `preserveMaterials` product keeps its own materials". In the room such a
 * product is the model it came with. A pack is included whatever its flag says: on the turntable
 * its colours come from the pack's own controls, which are not part of what a placement saves (D3),
 * so library materials on its placed model would show a finish nobody chose.
 */
function keepsOwnMaterials(product: Product): boolean {
  return !!product.preserveMaterials || !!product.pack;
}

/** Put a finish on a product model that is in the room, or about to be. A product that keeps its own materials is left alone. */
async function applyFinish(v: RoomVibezViewer, root: Object3D, product: Product, bindings: Record<string, string>) {
  if (!keepsOwnMaterials(product)) await v.applySlotBindings(root, product, bindings);
}

/** "Add to room" (UX-08 item 3): place the selected product with no pointer. Also the keyboard and touch path. */
function onAddToRoom() {
  // What the click asks for is fixed now: the product in the picker, with the finish for the next product.
  const product = currentProduct;
  // Placing a new product lets go of the selected one, so the Materials card shows what is being
  // placed. The button stays under the pointer for the next click.
  selectPlacement(null, () => btnAddToRoom);
  const finish = finishToPlace(product);
  addToRoomQueue = addToRoomQueue.then(() => addProductToRoom(product, finish)).catch((err) => console.error(err));
}

async function addProductToRoom(product: Product, finishAsked: Promise<Record<string, string>>) {
  if (!roomGraph || !viewer) return;
  if (!product?.glb && product.sourceKind !== 'mjs-module') {
    notify(copy.roomMessages.noModel, { kind: 'warning' });
    return;
  }
  try {
    const finish = await finishAsked;
    // The model is loaded first: the search needs the product's size. The same root is then placed.
    const root = await loadPlacementRoot(product);
    // The room can have been cleared or replaced while the model loaded.
    if (!roomGraph || !viewer) return;
    const pose = findSpotInRoom(roomGraph, root);
    if (!pose) throw new Error('No point of the room floor to place on');
    await placeCurrentProduct(pose.x, pose.z, { product, root, pose, finish });
  } catch (err) {
    notifyProblem(friendlyError(err, { where: 'place', name: product.name }));
  }
}

/**
 * Place the selected product at a floor point. Every caller goes through the room-bounds check
 * here (QA-02), so a path that does not come from a canvas raycast (the test hook, "Add to room")
 * cannot put a product outside the room either.
 *
 * `prepared` is for "Add to room", which has already loaded the product's model to measure it and
 * has chosen the pose and read the finish: the product, root, pose and finish are then taken as given.
 *
 * The finish (UX-16 step 2) is the one the Materials card shows for the next product at the
 * moment of the click. It is saved in the placement's `slot_bindings` (the only thing saved about
 * it: D3) and put on the model before the model goes into the room.
 */
async function placeCurrentProduct(
  x: number,
  z: number,
  prepared?: { product: Product; root: Object3D; pose: PlacementPose; finish: Record<string, string> },
) {
  if (!roomGraph || !viewer) return;
  if (!pointInRoom(roomGraph, { x, z })) {
    notify(copy.notInDeck.outsideRoom, { kind: 'warning' });
    return;
  }
  const product = prepared?.product ?? currentProduct;
  if (!product?.glb && product.sourceKind !== 'mjs-module') {
    notify(copy.roomMessages.noModel, { kind: 'warning' });
    return;
  }
  // (Nothing is selected here: the Place tool and "Add to room" both let go of the selection.)
  notify(fmt(copy.roomMessages.placing, { name: product.name }));
  try {
    const v = viewer;
    const { x: px, z: pz, rotationY } = prepared?.pose ?? placementPose(roomGraph, x, z);
    const slot_bindings = prepared?.finish ?? (await finishToPlace(product));
    const root = prepared?.root ?? (await loadPlacementRoot(product));
    // UX-16, the one rule: the finish goes on before the product goes into the room.
    await applyFinish(v, root, product, slot_bindings);
    // The room can have been cleared, or the 3D view restarted, while the model and its textures loaded.
    if (!roomGraph || viewer !== v) return;
    const next = addPlacement(roomGraph, {
      sku_id: product.sku,
      asset_ref: product.glb,
      product_id: product.id,
      position: { x: px, y: 0, z: pz },
      rotation_y: rotationY,
      scale: 1,
      slot_bindings,
    });
    const placed = next.placements[next.placements.length - 1]!;
    v.attachPlacement(placed.id, root, { x: px, z: pz }, rotationY);
    applyRoomGraph(next, { frame: false, reloadPlacements: false });
    const fp = footprintFromObject(root);
    const report = checkPlacementCollision(roomGraph, fp, { ignorePlacementId: placed.id });
    // An overlap warns and never blocks. An overlapped product is named as its list row names it.
    const msg = placedMessage(product.name, report, (o) => placementLabel(o.id) ?? o.label);
    notify(msg.text, { kind: msg.overlap ? 'warning' : 'success' });
  } catch (err) {
    notifyProblem(friendlyError(err, { where: 'place', name: product.name }));
  }
}

async function loadPlacementRoot(product: Product): Promise<import('three').Object3D> {
  if (product.sourceKind === 'mjs-module') {
    const factory = getModuleFactory(product.id);
    if (!factory) throw new Error('Module factory not registered for this product');
    return factory();
  }
  const gltf = await new GLTFLoader().loadAsync(product.glb);
  return gltf.scene.clone(true);
}

/**
 * Build every placed product of the room again from the room graph: after a reload of the page,
 * undo, redo, or a room that was opened or replaced. Each model gets its saved finish
 * (`slot_bindings`, UX-16 step 2) before it goes into the room.
 *
 * Models load one after another, and the room can change meanwhile. A run stops as soon as a
 * newer run has started or the 3D view was restarted; and each product is attached where, and
 * with the finish, the room graph gives it at that moment, not when the run began.
 *
 * A placement whose product is not in the catalog (a model uploaded before a refresh) cannot be
 * rebuilt. It stays in the graph and in the list, where its row says so, and a toast says it once
 * (`announceMissingProducts`).
 */
async function reloadAllPlacements(graph: RoomGraph) {
  if (!viewer) return;
  const v = viewer;
  const run = ++reloadRun;
  const stale = () => run !== reloadRun || viewer !== v;
  v.clearAllPlacements();
  for (const { id, product_id } of graph.placements) {
    const product = catalog.products.find((p) => p.id === product_id);
    if (!product) continue;
    try {
      const root = await loadPlacementRoot(product);
      if (stale()) return;
      const saved = roomGraph?.placements.find((p) => p.id === id);
      if (!saved) continue; // deleted while its model loaded
      await applyFinish(v, root, product, saved.slot_bindings);
      if (stale()) return;
      const now = roomGraph?.placements.find((p) => p.id === id);
      if (!now) continue;
      v.attachPlacement(id, root, { x: now.position.x, z: now.position.z }, now.rotation_y);
      // Its finish was changed while the textures loaded: bring the model up to date.
      if (JSON.stringify(now.slot_bindings) !== JSON.stringify(saved.slot_bindings)) queueFinishSync(id);
    } catch (err) {
      console.warn('Failed to reload placement', id, err);
    }
  }
  // After whatever the caller says about the room it has just shown ("Opened project …").
  await Promise.resolve();
  if (!stale()) announceMissingProducts();
}

/**
 * Bring a placed product's model up to date with the finish the room graph holds for it. Queued:
 * textures load asynchronously, and two changes applied out of order would leave the model with
 * the older one. A product whose model is not in the room yet is skipped: `reloadAllPlacements`
 * attaches it with the finish in the graph.
 */
function queueFinishSync(placementId: string) {
  finishQueue = finishQueue
    .then(async () => {
      const v = viewer;
      const pl = roomGraph?.placements.find((p) => p.id === placementId);
      const product = pl && catalog.products.find((p) => p.id === pl.product_id);
      const root = v?.getPlacementRoot(placementId);
      if (v && pl && product && root) await applyFinish(v, root, product, pl.slot_bindings);
    })
    .catch((err) => console.error(err));
}

/**
 * Change one slot of a placed product (UX-16 step 4, "16b"). The room graph is updated first, as
 * one history step (so Undo takes exactly this change back, and the card and the saved room agree
 * at once); the model then follows.
 */
function setPlacementFinish(placementId: string, slotId: string, materialId: string) {
  const pl = roomGraph?.placements.find((p) => p.id === placementId);
  const product = pl && catalog.products.find((p) => p.id === pl.product_id);
  if (!roomGraph || !pl || !product) return;
  const current = resolveBindings(product, pl.slot_bindings, library).bindings;
  if (current[slotId] === materialId) return;
  applyRoomGraph(updatePlacement(roomGraph, placementId, { slot_bindings: { ...current, [slotId]: materialId } }), {
    frame: false,
    reloadPlacements: false,
  });
  queueFinishSync(placementId);
}

async function onCreateRoom() {
  const u = displayUnit();
  // The preset only names the room. The size always comes from the fields, which the preset
  // fills in and the user may then edit.
  const preset = ROOM_PRESETS.find((p) => p.id === roomPreset.value);
  try {
    const length = fieldMeters(roomLength, u);
    const width = fieldMeters(roomWidth, u);
    const ceilingHeight = fieldMeters(roomCeiling, u);
    const wallThickness = fieldMeters(roomThickness, u);
    const graph = createRectangularRoom({
      length,
      width,
      ceilingHeight: ceilingHeight || DEFAULT_CEILING_HEIGHT_M,
      wallThickness: wallThickness || DEFAULT_WALL_THICKNESS_M,
      name: preset?.label ?? 'Custom room',
      displayUnit: u,
    });
    // The size is valid. Now ask, if the room on stage has work in it (deck §5 "Replace room").
    if (!(await confirmReplaceRoom())) return;
    setWorkspace('room');
    applyRoomGraph(graph, { frame: true, reloadPlacements: true, history: 'reset' });
    viewer?.clearAllPlacements();
    onRoomStarted();
  } catch (err) {
    roomStatus.textContent = String((err as Error)?.message ?? err);
    roomStatus.classList.add('error');
  }
}

function mountViewer() {
  viewer = new RoomVibezViewer(host, {
    library,
    initialPreset: currentPreset,
    onStatus: setStatus,
    onPartListUpdate: onParts,
    onSlotsDiscovered: renderWarnings,
    onRoomPointer,
    // Room workspace with no room: an empty stage, not the turntable product (UX-06).
    // Product (catalog mode) is not affected by this option.
    hideProductInEmptyRoom: true,
  });
  // A new engine has no outline yet: give it the selected product's again ("Restart 3D view").
  outlinedPlacementId = null;
  syncPlacementOutline();
  if (roomGraph) {
    // Restore shell/placements into the viewer, but do not force Room mode when
    // Product is the active workspace (cold load must still show catalog demos).
    viewer.setRoomGraph(roomGraph, {
      frame: workspace === 'room',
      activate: workspace === 'room',
      materials: shellMaterialsFromGraph(roomGraph),
    });
    void reloadAllPlacements(roomGraph);
    if (workspace === 'room') viewer.setInteractionMode('room');
    else viewer.setInteractionMode('catalog');
  }
}

async function loadProduct(product: Product, opts?: { onRootReady?: (root: Object3D) => void | Promise<void> }) {
  currentProduct = product;
  // The Place hint names the selected product.
  syncStageState();
  const packNote = product.pack
    ? ` · pack ${product.pack.completeness}/${product.pack.mappingMode}`
    : '';
  productMeta.textContent = `${product.sku} · slots tagged via ${product.slotTagging ?? 'unknown'}${
    product.userAdded ? ' · session upload' : ''
  }${packNote}`;
  slotsEl.innerHTML = '';
  warningsEl.innerHTML = '';
  // Swatch clicks still on their way belonged to the product that was on the turntable.
  pendingSlotChoices.clear();
  for (const p of validateProduct(product, library)) console.warn('[catalog]', p);
  try {
    await viewer!.loadProduct(product, opts);
    renderSlots();
    // The product is on the turntable. The picker's trigger gets its image, if thumbnails are in
    // use and it has none yet (never waited for; see showSelectedProductThumb).
    showSelectedProductThumb();
    if (activePack?.productId === product.id) renderPackParams();
    else if (!product.pack) {
      packParamsEl.hidden = true;
      packParamsEl.innerHTML = '';
    }
  } catch (err) {
    if (!(err instanceof StaleLoadError)) console.error(err);
  }
}

/** What the Materials card is about: the product in the picker, or one placed product. */
type MaterialsTarget =
  | { kind: 'next' }
  | { kind: 'placement'; placement: PlacementEntity; product: Product; label: string };

/**
 * What decides what the Materials card shows (UX-16 steps 3 and 4).
 *  - A placed product is selected (Room only): the slots of THAT product, which need not be the
 *    one in the picker, with the finish saved for it. A swatch changes that placed product.
 *  - Otherwise: the slots of the product in the picker, as it is loaded on the turntable. In
 *    Product that is the product on the stage. In Room the turntable is hidden and the choice is
 *    the finish of the next product placed; products already in the room are not touched.
 */
function materialsTarget(): MaterialsTarget {
  if (workspace === 'room' && selectedPlacementId && roomGraph) {
    const placement = roomGraph.placements.find((p) => p.id === selectedPlacementId);
    const product = placement && catalog.products.find((p) => p.id === placement.product_id);
    if (placement && product) {
      return { kind: 'placement', placement, product, label: placementLabel(placement.id) ?? product.name };
    }
  }
  return { kind: 'next' };
}

/** Changes whenever the card has to be drawn again because of the room: the target, its name, its finish. */
function materialsSignature(target: MaterialsTarget): string {
  return target.kind === 'placement'
    ? JSON.stringify([workspace, target.placement.id, target.label, target.placement.slot_bindings, library.materials.length])
    : JSON.stringify([workspace, 'next']);
}

/**
 * Draw the Materials card again if the room has changed what it should show: another product was
 * selected or none, or the selected product's finish changed (a swatch, undo, redo).
 * Changes on the turntable side (another product loaded, a texture added) call `renderSlots`.
 */
function syncMaterialsCard() {
  if (materialsSignature(materialsTarget()) !== renderedMaterials) renderSlots();
}

/** Selector of a swatch, from the swatch as it is now (`keepingFocus`). */
function swatchKey(el: Element): string | null {
  const slot = el.closest<HTMLElement>('.slot[data-slot]')?.dataset.slot;
  const material = el.closest<HTMLElement>('.swatch[data-material]')?.dataset.material;
  return slot && material
    ? `.slot[data-slot="${CSS.escape(slot)}"] .swatch[data-material="${CSS.escape(material)}"]`
    : null;
}

function renderSlots() {
  const target = materialsTarget();
  renderedMaterials = materialsSignature(target);
  // In Room the card says what a swatch applies to (UX-16 steps 3 and 4). In Product it is the
  // product on the stage and needs no line.
  const inRoom = workspace === 'room';
  const about = target.kind === 'placement' ? target.product : currentProduct;
  materialsState.hidden = !inRoom;
  materialsState.textContent = !inRoom
    ? ''
    : about && keepsOwnMaterials(about)
      ? // In the room this product is the model it came with: the swatches change nothing there.
        copy.slotWarnings.keepsOwnMaterials
      : target.kind === 'placement'
        ? fmt(copy.notInDeck.appliesToSelectedProduct, { name: target.label })
        : copy.notInDeck.appliesToNextProduct;
  // The warnings under the swatches are about the model on the turntable, not about a placed product.
  warningsEl.hidden = target.kind === 'placement';

  const turntable = viewer?.getSlots() ?? [];
  const metaOf = (s: (typeof turntable)[number]) =>
    `material_slot_id: <code>${s.def.id}</code> · ${s.meshCount} mesh(es) · via ${s.sources.join(', ')}`;
  let rows: { def: SlotDefinition; materialId: string; meta: string | null }[];
  if (target.kind === 'placement') {
    // What is on the placed model: the saved finish, with the default wherever a saved entry cannot be used.
    const bindings = resolveBindings(target.product, target.placement.slot_bindings, library).bindings;
    // The line under each row of swatches is about the model. When the picker holds this same
    // product, the turntable has the same model and the line is the same, so the card does not
    // change height between "next product" and "this product". For another product it is left out.
    const sameModel = viewer?.getPartsList()?.productId === target.product.id;
    rows = target.product.slots.map((def) => {
      const onTurntable = sameModel ? turntable.find((s) => s.def.id === def.id) : undefined;
      return { def, materialId: bindings[def.id] ?? def.default, meta: onTurntable ? metaOf(onTurntable) : null };
    });
  } else {
    rows = turntable.map((s) => ({
      def: s.def,
      materialId: pendingSlotChoices.get(s.def.id) ?? s.materialId,
      meta: metaOf(s),
    }));
  }

  keepingFocus(slotsEl, swatchKey, () => {
    slotsEl.innerHTML = '';
    for (const row of rows) {
      const current = findMaterial(library, row.materialId);
      const wrap = document.createElement('div');
      wrap.className = 'slot';
      wrap.dataset.slot = row.def.id;
      wrap.innerHTML = `
      <div class="slot-head">
        <span class="slot-label">${row.def.label}</span>
        <span class="slot-value" data-role="value">${current?.name ?? row.materialId}</span>
      </div>
      <div class="swatches" role="group" aria-label="${row.def.label} materials"></div>${
        row.meta ? `\n      <div class="slot-meta">${row.meta}</div>` : ''
      }`;
      const swatches = wrap.querySelector('.swatches')!;
      for (const mat of materialsForSlot(library, row.def)) {
        // UX-15 step 6: the swatches stay inline buttons, and each one carries its name on one
        // line under it. The tile is a <label>, so a click on the name presses its button. The
        // button is named by its `aria-label`, so the visible copy of the name is not read twice.
        const tile = document.createElement('label');
        tile.className = 'swatch-tile';
        const name = document.createElement('span');
        name.className = 'swatch-name';
        name.setAttribute('aria-hidden', 'true');
        name.textContent = mat.name;
        const b = document.createElement('button');
        b.className = 'swatch';
        b.title = `${mat.name} (${mat.sku})`;
        b.setAttribute('aria-label', mat.name);
        b.setAttribute('aria-pressed', String(mat.id === row.materialId));
        b.dataset.material = mat.id;
        b.style.backgroundColor = mat.color;
        if (mat.map) b.style.backgroundImage = `url(${mat.map})`;
        b.addEventListener('click', () => {
          if (target.kind === 'placement') {
            // The selected placed product (UX-16 step 4). The room graph changes, and the card is
            // drawn again from it (renderRoomUi → syncMaterialsCard).
            if (keepsOwnMaterials(target.product)) {
              notify(copy.slotWarnings.keepsOwnMaterials, { kind: 'warning' });
              return;
            }
            setPlacementFinish(target.placement.id, row.def.id, mat.id);
            return;
          }
          if (currentProduct.preserveMaterials) {
            warningsEl.innerHTML =
              '<div class="warning">Pack / module keeps embedded or MJS-driven materials — library swatches do not replace them (use MJS params when mapping allows).</div>';
            return;
          }
          swatches.querySelectorAll('.swatch').forEach((s) => s.setAttribute('aria-pressed', String(s === b)));
          wrap.querySelector('[data-role=value]')!.textContent = mat.name;
          // The turntable takes a moment (textures load). A product placed meanwhile waits for it
          // (`finishToPlace`), so it gets the finish the card shows.
          pendingSlotChoices.set(row.def.id, mat.id);
          const applied = viewer!
            .setSlotMaterial(row.def.id, mat.id)
            .catch((err) => console.error(err))
            .then(() => {
              // Unless a later click on this slot has taken its place.
              if (pendingSlotChoices.get(row.def.id) === mat.id) pendingSlotChoices.delete(row.def.id);
            });
          slotApplyPending = Promise.all([slotApplyPending, applied]).then(() => undefined);
        });
        tile.append(b, name);
        swatches.appendChild(tile);
      }
      slotsEl.appendChild(wrap);
    }
  });
}

function renderWarnings(report: SlotReport) {
  const lines: string[] = [];
  if (report.missingInModel.length) lines.push(`Catalog slots not found in model: ${report.missingInModel.join(', ')}`);
  if (report.unknownInModel.length) lines.push(`Model slots not defined in catalog (ignored): ${report.unknownInModel.join(', ')}`);
  if (report.untaggedMeshes.length) lines.push(`Untagged meshes keep placeholder material: ${report.untaggedMeshes.join(', ')}`);
  if (report.meshesNormalsComputed?.length)
    lines.push(`Computed missing normals on: ${report.meshesNormalsComputed.join(', ')} (export with normals for best quality)`);
  if (report.meshesWithoutUv?.length)
    lines.push(`Meshes without UVs — textures will look flat/wrong: ${report.meshesWithoutUv.join(', ')}`);
  if (currentProduct.slotTagging?.startsWith('obj-')) {
    lines.push(`OBJ import: ${currentProduct.slotTagging} (MTL→PBR is best-effort; library swatches are SoR)`);
  }
  if (currentProduct.preserveMaterials)
    lines.push('Embedded / MJS-driven materials preserved. Library swatches are display-only unless pack mapping is slots.');
  if (currentProduct.pack) {
    for (const n of currentProduct.pack.notes) lines.push(n);
    if (currentProduct.pack.unknownKeys.length && currentProduct.pack.mappingMode !== 'vertex-colors') {
      lines.push(`Unknown material mapping for: ${currentProduct.pack.unknownKeys.join(', ')}`);
    }
  }
  warningsEl.innerHTML = lines
    .map((l) => {
      const crit = /unknown|incomplete/i.test(l);
      return `<div class="warning${crit ? ' critical' : ''}">${l}</div>`;
    })
    .join('');
}

function renderPackParams() {
  if (!activePack || activePack.productId !== currentProduct.id) {
    packParamsEl.hidden = true;
    packParamsEl.innerHTML = '';
    return;
  }
  const { meta, status, params } = activePack;
  packParamsEl.hidden = false;
  packParamsEl.innerHTML = '';

  const title = document.createElement('h3');
  title.textContent = 'MJS pack params';
  packParamsEl.appendChild(title);

  const note = document.createElement('p');
  note.className = 'pack-note';
  const splitSoR = status.notes.some((n) => /COLOR_0 zone split/i.test(n));
  note.textContent =
    status.mappingMode === 'vertex-colors'
      ? 'Fallback: colorways remap GLB COLOR_0 in place (zone split failed). Geometry params rebuild via createAsset().'
      : status.mappingMode === 'slots' && splitSoR
        ? 'COLOR_0 zones split into material_slot meshes — colorway / library swatches apply per zone. Geometry params rebuild via createAsset().'
        : status.mappingMode === 'slots'
          ? 'Colors apply to mapped GLB slots. Geometry params rebuild via createAsset().'
          : 'Mapping Unknown — color controls may not affect the GLB; geometry rebuild uses createAsset().';
  packParamsEl.appendChild(note);

  const colorAffecting = meta.params.filter((p) => p.affects !== 'geometry');
  const geomAffecting = meta.params.filter((p) => p.affects === 'geometry');

  for (const p of colorAffecting) {
    packParamsEl.appendChild(buildParamField(p, params[p.key], (v) => void onPackParamChange(p.key, v, false)));
  }

  if (geomAffecting.length) {
    const hint = document.createElement('div');
    hint.className = 'geom-hint';
    hint.textContent =
      'Geometry-affecting params (state / pages / bands / corners) rebuild the mesh from createAsset() — the pack GLB is a static snapshot.';
    packParamsEl.appendChild(hint);
    for (const p of geomAffecting) {
      packParamsEl.appendChild(buildParamField(p, params[p.key], (v) => void onPackParamChange(p.key, v, true)));
    }
  }
}

function buildParamField(
  p: ModulePackMeta['params'][number],
  value: unknown,
  onChange: (v: unknown) => void,
): HTMLElement {
  const field = document.createElement('label');
  field.className = 'field';
  const span = document.createElement('span');
  span.textContent = p.label + (p.affects === 'geometry' ? ' (geometry)' : '');
  field.appendChild(span);

  if (p.type === 'choice' && p.options?.length) {
    const sel = document.createElement('select');
    sel.className = 'select';
    for (const opt of p.options) sel.add(new Option(opt, opt));
    sel.value = String(value ?? p.default ?? p.options[0]);
    sel.addEventListener('change', () => onChange(sel.value));
    field.appendChild(sel);
  } else if (p.type === 'toggle') {
    const sel = document.createElement('select');
    sel.className = 'select';
    sel.add(new Option('true', 'true'));
    sel.add(new Option('false', 'false'));
    sel.value = String(value ?? p.default ?? true);
    sel.addEventListener('change', () => onChange(sel.value === 'true'));
    field.appendChild(sel);
  } else if (p.type === 'range') {
    const input = document.createElement('input');
    input.type = 'range';
    input.min = String(p.min ?? 0);
    input.max = String(p.max ?? 100);
    input.step = String(p.step ?? 1);
    input.value = String(value ?? p.default ?? 0);
    const out = document.createElement('span');
    out.className = 'muted small';
    out.textContent = input.value;
    input.addEventListener('input', () => {
      out.textContent = input.value;
    });
    input.addEventListener('change', () => onChange(Number(input.value)));
    field.appendChild(input);
    field.appendChild(out);
  } else if (p.type === 'color') {
    const input = document.createElement('input');
    input.type = 'color';
    const resolved = resolvePackColors(activePack!.meta, activePack!.params);
    const hex =
      (typeof value === 'string' && /^#/.test(value) ? value : null) ||
      resolved[p.key] ||
      (typeof p.default === 'string' ? p.default : '#888888');
    input.value = hex.length === 7 ? hex : '#888888';
    input.addEventListener('change', () => onChange(input.value));
    field.appendChild(input);
  } else {
    const input = document.createElement('input');
    input.className = 'text-input';
    input.value = String(value ?? p.default ?? '');
    input.addEventListener('change', () => onChange(input.value));
    field.appendChild(input);
  }
  if (p.describe) {
    const help = document.createElement('p');
    help.className = 'field-help muted small';
    help.textContent = p.describe;
    field.appendChild(help);
  }
  return field;
}

async function onPackParamChange(key: string, value: unknown, geometry: boolean) {
  if (!activePack || !viewer) return;
  activePack.params = { ...activePack.params, [key]: value };

  // Changing colorway clears per-zone overrides so the preset wins (matches Polyfork resolveParams).
  if (key === 'colorway') {
    for (const z of activePack.meta.colorZones) delete activePack.params[z];
    renderPackParams();
  }

  if (geometry) {
    // Rebuild from createAsset with current params (GLB snapshot cannot morph).
    const factory = activePack.meta.createAsset;
    const product = currentProduct;
    product.sourceKind = 'mjs-module';
    // Prefer split slots on createAsset mesh too when COLOR_0 zones match.
    const wantsSplit = activePack.status.notes.some((n) => /COLOR_0 zone split/i.test(n));
    product.preserveMaterials = !(activePack.status.mappingMode === 'slots' && wantsSplit);
    activePack.bakedZones = resolvePackColors(activePack.meta, activePack.params);
    registerModuleFactory(product.id, () => factory(activePack!.params));
    // The model is built again with other parameters: its thumbnail is out of date. `loadProduct` draws the new one.
    invalidateProductThumb(product.id, false);
    await loadProduct(product, {
      onRootReady: (root) => {
        if (!activePack) return;
        preparePackRoot(root, activePack);
      },
    });
    const root = viewer.getModelRoot();
    if (root && activePack) applyPackColorsToRoot(root, activePack);
    renderSlots();
    packStatusEl.textContent = `Rebuilt from createAsset() after geometry param “${key}” · pack GLB superseded for this session`;
    return;
  }

  const root = viewer.getModelRoot();
  if (!root) return;

  if (activePack.status.mappingMode === 'unknown') {
    packStatusEl.textContent = `Param “${key}” updated, but mapping is Unknown — GLB materials unchanged.`;
    packStatusEl.classList.add('error');
    return;
  }

  const result = applyPackAppearance(root, activePack.meta, activePack.params, activePack.status, activePack.bakedZones);
  activePack.bakedZones = result.toZones;
  // A module's model is built from the parameters, so its thumbnail follows them. (A pack that
  // came with a .glb is drawn from that file, as it is placed in the room: these colours are not in it.)
  if (currentProduct.sourceKind === 'mjs-module') invalidateProductThumb(activePack.productId);
  packStatusEl.classList.remove('error');
  packStatusEl.textContent =
    activePack.status.mappingMode === 'vertex-colors'
      ? `Fallback COLOR_0 remap (${result.remappedVertices} verts, zones: ${result.zonesHit.join(', ') || 'none'})`
      : `Applied pack colors to slots: ${result.zonesHit.join(', ') || 'none'}`;
}

/** Split COLOR_0 → slot meshes when pack mapping expects slots from zone clusters. */
function preparePackRoot(root: import('three').Object3D, session: PackSession): void {
  const wantsSplit = session.status.notes.some((n) => /COLOR_0 zone split/i.test(n));
  if (!(session.status.mappingMode === 'slots' && wantsSplit)) return;

  // GLB snapshots bake the default colorway; createAsset() bakes the current params palette.
  const defaultPalette = resolvePackColors(session.meta, defaultsFromMeta(session.meta));
  let split = ensurePackZoneSlots(root, session.meta, defaultPalette);
  if (!split.ok) {
    split = ensurePackZoneSlots(root, session.meta, session.bakedZones);
  }
  if (!split.ok) {
    session.status = {
      ...session.status,
      mappingMode: 'vertex-colors',
      mappedKeys: [],
      unknownKeys: [...session.status.materialKeys],
      notes: [
        ...session.status.notes,
        'Runtime split failed — using COLOR_0 remap fallback.',
        ...split.notes,
      ],
    };
    if (currentProduct.pack) {
      currentProduct.pack.mappingMode = 'vertex-colors';
      currentProduct.pack.mappedKeys = [];
      currentProduct.pack.unknownKeys = [...session.status.materialKeys];
      currentProduct.pack.notes = session.status.notes;
      currentProduct.preserveMaterials = true;
      currentProduct.slotTagging = 'mjs-pack-vertex-colors-fallback';
    }
  }
}

function applyPackColorsToRoot(root: import('three').Object3D, session: PackSession): void {
  if (session.status.mappingMode === 'unknown') return;
  const from =
    session.status.mappingMode === 'vertex-colors'
      ? resolvePackColors(session.meta, defaultsFromMeta(session.meta))
      : session.bakedZones;
  const r = applyPackAppearance(root, session.meta, session.params, session.status, from);
  session.bakedZones = r.toZones;
}

function renderPresets() {
  // UX-07 item 3: the presets sit in the stage toolbar. The group's name is the deck's word for it.
  presetsEl.setAttribute('aria-label', copy.productCard.lightingHeading);
  presetsEl.innerHTML = '';
  for (const p of LIGHT_PRESETS) {
    const b = document.createElement('button');
    b.textContent = p.label;
    b.dataset.preset = p.id;
    b.setAttribute('role', 'radio');
    b.setAttribute('aria-checked', String(p.id === currentPreset));
    b.addEventListener('click', () => {
      currentPreset = p.id;
      viewer?.setLightPreset(p.id);
      presetsEl.querySelectorAll('button').forEach((x) => x.setAttribute('aria-checked', String(x === b)));
    });
    presetsEl.appendChild(b);
  }
}

// ------------------------------------------------------------------ catalog pickers (UX-14, UX-15)

/**
 * The thumbnail renderer, created when the first thumbnail is asked for. It loads a product's
 * model the way the turntable does (`loadProductRoot`: GLB, multi-file glTF, or a module's
 * `createAsset`) and shows it in its DEFAULT finish (UX-14 step 5): the slot defaults from the
 * catalog, whatever is chosen on the Materials card. A pack, or a product that keeps its own
 * materials, is drawn as its model comes (`applyFinish` leaves it alone).
 */
function thumbnailRenderer(): ThumbnailRenderer {
  thumbnails ??= createThumbnailRenderer({
    loadRoot: loadProductRoot,
    applyFinish: (root, product) => {
      // The library materials are built by the 3D view (it holds the texture cache).
      if (!viewer) throw new Error('The 3D view is not running');
      return applyFinish(viewer, root, product, {});
    },
  });
  return thumbnails;
}

/**
 * One product's thumbnail, for the product picker (its `requestThumb`). Resolves with the image
 * URL, or with null when it could not be drawn: the tile then keeps its placeholder, and nothing
 * is shown in the image's place. `product.thumbnailUrl` wins over drawing; drawn images are cached
 * per product id by the renderer, which draws one at a time.
 */
function requestProductThumb(productId: string): Promise<string | null> | undefined {
  const product = catalog.products.find((p) => p.id === productId);
  if (!product || !viewer) return undefined;
  const renderer = thumbnailRenderer();
  return renderer.render(product).catch((err) => {
    // "Restart 3D view" drops the drawings that were under way; that is not a failure.
    if (thumbnails === renderer) console.warn(`[thumbnail] ${productId}:`, err);
    return null;
  });
}

/**
 * The picker's trigger shows the selected product's image when there is one. Images are drawn for
 * the tiles the pop-up shows in the thumbnail view, and the selected product is among those; but
 * a product can become the selected one without its tile ever being shown (a model just added, a
 * select set in code, "Restart 3D view"). This draws that one image.
 *
 * It does nothing until the thumbnail view has been used (`thumbnailsInUse`), and nothing while
 * the picker is set to List: the list view is the path that draws no image at all (UX-14 step 2b).
 * Called after a product has loaded on the turntable, and never waited for.
 */
function showSelectedProductThumb() {
  const id = currentProduct?.id;
  if (!id || !productPicker || !thumbnailsInUse || readStoredView('product') === 'list') return;
  void requestProductThumb(id)?.then((url) => {
    if (url) productPicker?.setThumb(id, url);
  });
}

/**
 * Forget a product's thumbnail because the product's own look has changed (UX-14 step 5). Its
 * tile shows the placeholder until it is drawn again: at once for the product in the trigger
 * (unless the caller is about to load that product, which draws it: `redraw` false), otherwise
 * when its tile is next shown in the thumbnail view.
 */
function invalidateProductThumb(productId: string, redraw = true) {
  thumbnails?.invalidate(productId);
  productPicker?.setThumb(productId, null);
  if (redraw && productId === currentProduct?.id) showSelectedProductThumb();
}

/**
 * A library material has changed (a normal or roughness map was added to it). A thumbnail shows
 * the default finish, so the products whose default finish uses that material are drawn again.
 */
function invalidateThumbsUsingMaterial(materialId: string) {
  for (const p of catalog.products) {
    if (!keepsOwnMaterials(p) && p.slots.some((s) => s.default === materialId)) invalidateProductThumb(p.id);
  }
}

/**
 * Free the thumbnail renderer together with the 3D view ("Restart 3D view"), and forget what it
 * drew. A new renderer is created with the next thumbnail asked for, so there is never more than
 * one thumbnail WebGL context. Drawings under way are dropped (the renderer rejects them).
 */
function resetThumbnails() {
  thumbnails?.dispose();
  thumbnails = null;
  for (const p of catalog.products) productPicker?.setThumb(p.id, null);
}

/**
 * Mount the four catalog pickers (UX-14, UX-15). Each wraps its select where the select is, so the
 * product picker sits inside `#product-picker-slot` and travels with it between the workspaces,
 * and the texture-target picker stays inside `#texture-target-wrap`, which the map role shows and
 * hides. Needs the catalog and the library, and runs before the selects are filled.
 * Every string comes from `copy`; the tiles carry a thumbnail or swatch and a name, and nothing
 * the data does not have (UX-14 step 4).
 */
function initPickers() {
  const s = copy.notInDeck.picker;
  const shared = {
    close: s.close,
    viewGroupLabel: s.viewLabel,
    viewThumbnails: s.thumbnails,
    viewList: s.list,
    groupTabsLabel: s.groupTabsLabel,
    allGroups: s.allGroups,
  };
  const productStrings: PickerStrings = { ...shared, searchPlaceholder: s.searchProducts, noMatches: s.noProductsMatch };
  const materialStrings: PickerStrings = { ...shared, searchPlaceholder: s.searchMaterials, noMatches: s.noMaterialsMatch };

  productPicker = createThumbnailPicker({
    select: productSelect,
    label: s.productLabel,
    viewKey: 'product',
    strings: productStrings,
    // Thumbnail and name; "your upload" under the name of a product the user added.
    getItems: () => buildProductItems(catalog.products, { uploadSublabel: copy.productCard.yourUpload }),
    // Asked only while the pop-up is open in the thumbnail view, for a tile that is on screen and has no image.
    requestThumb: (id) => {
      thumbnailsInUse = true;
      return requestProductThumb(id);
    },
    alignTo: panel,
  });

  // Materials: a CSS swatch (colour and map, as the slot swatches are drawn) and the name. The
  // tabs are the materials' categories, named with the deck's words for them where it has one.
  const categoryNames: Record<string, string> = copy.productCard.textureCategories;
  const formatGroup = (category: string) => categoryNames[category] ?? category;
  const materialPicker = (select: HTMLSelectElement, label: string, defaultLabel?: string) =>
    createThumbnailPicker({
      select,
      label,
      viewKey: 'material',
      strings: materialStrings,
      getItems: () => buildMaterialItems(library.materials, defaultLabel === undefined ? {} : { defaultLabel }),
      formatGroup,
      alignTo: panel,
    });
  // Wall and floor start with "Default" (value ''): the room's own surface, no library material.
  wallMaterialPicker = materialPicker(roomWallMaterial, copy.roomTools.wallsLabel, s.defaultMaterial);
  floorMaterialPicker = materialPicker(roomFloorMaterial, copy.roomTools.floorLabel, s.defaultMaterial);
  textureTargetPicker = materialPicker(textureTarget, copy.productCard.textureAddToMaterialLabel);
}

function refreshProductSelect(selectId?: string) {
  const keep = selectId ?? productSelect.value;
  productSelect.innerHTML = '';
  for (const p of catalog.products) {
    const opt = new Option(p.userAdded ? `${p.name} (upload)` : p.name, p.id);
    productSelect.add(opt);
  }
  if (keep && catalog.products.some((p) => p.id === keep)) productSelect.value = keep;
  // New options and a value set in code: the picker reads both again.
  productPicker?.sync();
}

function refreshTextureTargetOptions() {
  const keep = textureTarget.value;
  textureTarget.innerHTML = '';
  for (const m of library.materials) {
    textureTarget.add(new Option(`${m.name} (${m.category})`, m.id));
  }
  if (keep && library.materials.some((m) => m.id === keep)) textureTarget.value = keep;
  textureTargetPicker?.sync();
}

function renderUserMaterials() {
  userMaterialsEl.innerHTML = '';
  for (const id of userMaterialIds) {
    const m = findMaterial(library, id);
    if (!m) continue;
    const li = document.createElement('li');
    li.innerHTML = `<span class="swatch mini" style="background-color:${m.color};${m.map ? `background-image:url(${m.map})` : ''}"></span>
      <span>${m.name} · <code>${m.category}</code></span>`;
    userMaterialsEl.appendChild(li);
  }
}

function syncTextureRoleUi() {
  const role = textureRole.value as TextureMapRole;
  const needsTarget = role === 'normalMap' || role === 'roughnessMap';
  textureTargetWrap.hidden = !needsTarget;
}

async function reapplyMaterialIfBound(materialId: string) {
  if (!viewer) return;
  for (const slot of viewer.getSlots()) {
    if (slot.materialId === materialId) {
      try {
        await viewer.setSlotMaterial(slot.def.id, materialId);
      } catch (err) {
        console.error(err);
      }
    }
  }
  // Placed products that wear this material get the changed version too.
  for (const pl of roomGraph?.placements ?? []) {
    if (Object.values(pl.slot_bindings).includes(materialId)) queueFinishSync(pl.id);
  }
}

async function onModelFilesSelected() {
  const files = modelFiles.files;
  if (!files?.length) return;
  modelStatus.textContent = 'Loading model…';
  modelStatus.classList.remove('error');
  try {
    const defaultMaterialId = library.materials[0]?.id;
    if (!defaultMaterialId) throw new Error('Materials library is empty');
    const { product, sessionUrls: urls, materials, warnings } = await createProductFromModelFiles(files, {
      defaultMaterialId,
    });
    sessionUrls.push(...urls);
    if (materials?.length) {
      for (const m of materials) {
        library.materials.push(m);
        userMaterialIds.add(m.id);
      }
      refreshTextureTargetOptions();
      populateMaterialSelects();
      renderUserMaterials();
    }
    catalog.products.push(product);
    activePack = null;
    refreshProductSelect(product.id);
    await loadProduct(product);
    const warnBits = warnings?.notes?.length ? ` · ${warnings.notes[0]}` : '';
    const matBits = materials?.length ? ` · ${materials.length} MTL material(s) in library` : '';
    modelStatus.textContent = `Added “${product.name}” · ${product.slots.length} slot(s)${matBits} · session only${warnBits}`;
    if (warnings?.notes?.length && warnings.notes.length > 1) {
      // Extra notes surface via slot warnings after load; keep status to one line.
      console.info('[OBJ upload]', warnings);
    }
  } catch (err) {
    console.error(err);
    modelStatus.textContent = String((err as Error)?.message ?? err);
    modelStatus.classList.add('error');
  } finally {
    modelFiles.value = '';
  }
}

async function loadPackFromFiles(mjs: File, glb: File | null, association: string) {
  packStatusEl.textContent = 'Importing pack (MJS runs JS)…';
  packStatusEl.classList.remove('error');
  const defaultMaterialId = library.materials[0]?.id;
  if (!defaultMaterialId) throw new Error('Materials library is empty');

  const { mod, objectUrl } = await importModuleFile(mjs);
  sessionUrls.push(objectUrl);
  const meta = resolveModulePackMeta(mod);

  let glbRoot: Object3D | null = null;
  if (glb) {
    const url = URL.createObjectURL(glb);
    // Temporary URL only for parse; createProductFromPack creates the session URL.
    try {
      const gltf = await new GLTFLoader().loadAsync(url);
      glbRoot = gltf.scene;
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  const { product, sessionUrls: urls, status, initialParams } = createProductFromPack({
    mjsFile: mjs,
    glbFile: glb,
    meta,
    defaultMaterialId,
    glbRoot,
  });
  sessionUrls.push(...urls);

  // Dispose probe scene geometries (product load will re-fetch GLB).
  if (glbRoot) {
    glbRoot.traverse((o) => {
      const m = o as import('three').Mesh;
      if (m.isMesh) {
        m.geometry?.dispose();
        const mats = Array.isArray(m.material) ? m.material : [m.material];
        for (const mat of mats) mat?.dispose();
      }
    });
  }

  activePack = {
    productId: product.id,
    meta,
    status,
    params: { ...initialParams },
    bakedZones: resolvePackColors(meta, initialParams),
  };

  catalog.products.push(product);
  refreshProductSelect(product.id);

  await loadProduct(product, {
    onRootReady: (root) => {
      if (!activePack) return;
      preparePackRoot(root, activePack);
    },
  });
  // Library defaults apply during loadProduct when preserveMaterials=false; re-apply MJS colorway onto split slots.
  const loadedRoot = viewer?.getModelRoot();
  if (loadedRoot && activePack && activePack.status.mappingMode !== 'unknown') {
    applyPackColorsToRoot(loadedRoot, activePack);
    renderSlots();
  }

  const keys = meta.exportKeys.join(', ');
  const mate =
    glb
      ? `+ ${glb.name} (${association})`
      : '· GLB missing (createAsset fallback)';
  packStatusEl.textContent = `Pack “${product.name}” ${mate} · ${status.mappingMode} · exports: ${keys}`;
  if (status.completeness === 'mjs-only' || status.mappingMode === 'unknown') {
    packStatusEl.classList.add('error');
  }
}

async function onPackFilesSelected() {
  const files = packFiles.files;
  if (!files?.length) return;
  try {
    let { mjs, glb, association } = associatePackFiles(files);
    if (!mjs && glb && pendingGlbMate) {
      // ignore
    }
    if (!mjs) {
      // Maybe user only picked GLB as pack mate for a prior module — require MJS.
      if (glb && !mjs) {
        pendingGlbMate = glb;
        packStatusEl.textContent = `Saved pack-mate GLB “${glb.name}”. Now select the matching .mjs (or multi-select both).`;
        packStatusEl.classList.remove('error');
        return;
      }
      throw new Error('Select a .mjs file (optionally with sibling .glb)');
    }
    if (!glb && pendingGlbMate) {
      const stemM = mjs.name.replace(/\.mjs$/i, '').toLowerCase();
      const stemG = pendingGlbMate.name.replace(/\.glb$/i, '').toLowerCase();
      if (stemM === stemG || true) {
        glb = pendingGlbMate;
        association = stemM === stemG ? 'basename' : 'multi-unmatched';
        pendingGlbMate = null;
      }
    }
    await loadPackFromFiles(mjs, glb, association);
  } catch (err) {
    console.error(err);
    const msg =
      err instanceof ModuleContractError ? err.message : String((err as Error)?.message ?? err);
    packStatusEl.textContent = msg;
    packStatusEl.classList.add('error');
  } finally {
    packFiles.value = '';
  }
}

async function onPackGlbMateSelected() {
  const file = packGlbMate.files?.[0];
  if (!file) return;
  pendingGlbMate = file;
  packGlbMate.value = '';
  packStatusEl.classList.remove('error');
  packStatusEl.textContent = `Pack-mate GLB ready: “${file.name}”. Select the .mjs (Load pack) to pair by basename.`;

  // If current product is mjs-only with matching stem, offer re-load — simplest: wait for mjs.
  if (activePack && currentProduct.pack?.completeness === 'mjs-only') {
    const stem = currentProduct.name.toLowerCase();
    if (file.name.replace(/\.glb$/i, '').toLowerCase() === stem) {
      packStatusEl.textContent += ' · basename matches current pack — re-select the .mjs to load the complete pack.';
    }
  }
}

async function onModuleFileSelected() {
  const file = moduleFile.files?.[0];
  if (!file) return;
  moduleStatus.textContent = 'Importing module (runs JS)…';
  moduleStatus.classList.remove('error');
  try {
    // If a pack-mate GLB is pending, upgrade to pack flow (second-upload path).
    if (pendingGlbMate) {
      const mate = pendingGlbMate;
      pendingGlbMate = null;
      const assoc =
        file.name.replace(/\.mjs$/i, '').toLowerCase() === mate.name.replace(/\.glb$/i, '').toLowerCase()
          ? 'basename'
          : 'multi-unmatched';
      await loadPackFromFiles(file, mate, assoc);
      moduleStatus.textContent = `Routed to pack with GLB “${mate.name}” (${assoc})`;
      return;
    }

    const defaultMaterialId = library.materials[0]?.id;
    if (!defaultMaterialId) throw new Error('Materials library is empty');
    const { mod, objectUrl } = await importModuleFile(file);
    sessionUrls.push(objectUrl);
    const meta = resolveModulePackMeta(mod);
    const resolved = resolveModuleAsset(mod);
    // Prefer pack product even without GLB so params UI works.
    const { product, status, initialParams } = createProductFromPack({
      mjsFile: file,
      glbFile: null,
      meta,
      defaultMaterialId,
    });
    activePack = {
      productId: product.id,
      meta,
      status,
      params: { ...initialParams },
      bakedZones: resolvePackColors(meta, initialParams),
    };
    catalog.products.push(product);
    refreshProductSelect(product.id);
    await loadProduct(product);
    const keys = resolved.exportKeys.join(', ');
    moduleStatus.textContent = `Added “${product.name}” via ${resolved.via} · pack incomplete (no GLB) · exports: ${keys}`;
    moduleStatus.classList.add('error');
  } catch (err) {
    console.error(err);
    const msg =
      err instanceof ModuleContractError
        ? `${err.message}`
        : String((err as Error)?.message ?? err);
    moduleStatus.textContent = msg;
    moduleStatus.classList.add('error');
  } finally {
    moduleFile.value = '';
  }
}

async function onAddTexture() {
  const file = textureFile.files?.[0];
  if (!file) {
    textureStatus.textContent = 'Choose an image first';
    textureStatus.classList.add('error');
    return;
  }
  textureStatus.classList.remove('error');
  const role = textureRole.value as TextureMapRole;
  try {
    if (role === 'map') {
      const { material, objectUrl } = createMaterialFromTexture(file, {
        name: textureName.value,
        category: textureCategory.value as MaterialCategory,
      });
      sessionUrls.push(objectUrl);
      library.materials.push(material);
      userMaterialIds.add(material.id);
      refreshTextureTargetOptions();
      populateMaterialSelects();
      renderSlots();
      renderUserMaterials();
      textureStatus.textContent = `Added “${material.name}” to library — pick it on a matching slot swatch`;
    } else {
      const target = findMaterial(library, textureTarget.value);
      if (!target) throw new Error('Select a target material');
      const { objectUrl } = attachTextureToMaterial(target, file, role);
      sessionUrls.push(objectUrl);
      await reapplyMaterialIfBound(target.id);
      invalidateThumbsUsingMaterial(target.id);
      renderSlots();
      renderUserMaterials();
      textureStatus.textContent = `Attached ${role === 'normalMap' ? 'normal' : 'roughness'} map to “${target.name}”`;
    }
    textureFile.value = '';
    textureName.value = '';
  } catch (err) {
    console.error(err);
    textureStatus.textContent = String((err as Error)?.message ?? err);
    textureStatus.classList.add('error');
  }
}

/**
 * One-time wiring of what sits on the stage besides the canvas: the toast (UX-04), the
 * empty-room card (UX-06, QA-04) and the fixed tool-button labels (deck §3.6).
 */
function initStageUi() {
  mountNotifier(document.querySelector<HTMLElement>('.stage')!, { dismissLabel: copy.notInDeck.toastDismiss });

  btnOpeningMode.textContent = copy.roomTools.addOpening;
  btnPlaceMode.textContent = copy.roomTools.placeProduct;
  btnDrawWallMode.textContent = copy.roomTools.drawWalls;

  const empty = copy.notInDeck.emptyRoom;
  $('stage-empty-title').textContent = empty.title;
  $('stage-empty-body').textContent = empty.body;
  const labels = {
    scratch: empty.fromScratch,
    import: empty.importPlan,
    template: empty.fromTemplate,
    project: empty.importProject,
  };
  stageEmpty.querySelectorAll<HTMLButtonElement>('button[data-empty-action]').forEach((button) => {
    const action = button.dataset.emptyAction as keyof typeof labels;
    button.textContent = labels[action];
    button.addEventListener('click', () => {
      if (action === 'project') {
        // The one hidden input that the room toolbar's Import project button uses as well.
        $<HTMLInputElement>('project-file').click();
        return;
      }
      setRoomIngress(action);
      // Take the user to the form they chose. Focusing its tab also scrolls it into view, in the
      // panel on a wide screen and in the page on a narrow one.
      $('room-ingress').querySelector<HTMLButtonElement>(`button[data-ingress="${action}"]`)?.focus();
    });
  });

  // Two things are sized by what sits above them, and both can wrap onto a second row:
  // the empty-room card stays below the stage toolbar (which now holds the light presets), and
  // a control scrolled into view in the panel stays clear of the room toolbar stuck to its top.
  const stageToolbar = stageEl.querySelector<HTMLElement>('.stage-toolbar');
  const measure = () => {
    if (stageToolbar) {
      stageEl.style.setProperty('--stage-toolbar-bottom', `${stageToolbar.offsetTop + stageToolbar.offsetHeight}px`);
    }
    // 0 while the Room group is hidden.
    document.documentElement.style.setProperty('--room-toolbar-height', `${roomToolbar.offsetHeight}px`);
  };
  measure();
  if (typeof ResizeObserver !== 'undefined') {
    const observer = new ResizeObserver(measure);
    if (stageToolbar) observer.observe(stageToolbar);
    observer.observe(roomToolbar);
  }
}

/** True when the bottom of an element of the panel is under the lower edge of what can be seen of the panel. */
function belowTheFold(el: HTMLElement): boolean {
  // The panel scrolls on a wide screen; on a narrow one the page does.
  const fold = getComputedStyle(panel).overflowY === 'visible' ? window.innerHeight : panel.getBoundingClientRect().bottom;
  return el.getBoundingClientRect().bottom > fold;
}

/**
 * One-time wiring of the side panel's structure (UX-07, UX-08): the labels of the new controls
 * (all from `copy`, so index.html leaves them empty), the steps, "Adjust size" and "Add to room".
 * It needs no data, so it runs before anything is fetched.
 */
function initPanelUi() {
  const labels = copy.notInDeck;
  $('product-advanced-summary').textContent = labels.advanced;
  $('room-size-adjust-summary').textContent = labels.adjustSize;
  $('room-more-summary').textContent = labels.more;
  btnStepRoomChange.textContent = labels.stepChange;
  btnAddToRoom.textContent = labels.addToRoom;

  for (const step of ROOM_STEPS) {
    const { el, toggle } = stepParts(step);
    toggle.querySelector('.step-name')!.textContent = labels.steps[step];
    // One step is open at a time, so the toggle of the open step has nothing to do.
    toggle.addEventListener('click', () => {
      if (roomStep === step) return;
      setRoomStep(step);
      // The steps above may just have folded and moved this step. Bring the whole step into view
      // when it fits, its heading at the top when it does not ("nearest" does both). With the
      // Materials card in it, "Place products" no longer fits under its heading where it opens:
      // "Add to room" would be below the fold.
      el.scrollIntoView({ block: 'nearest', behavior: 'instant' });
      // With a name under every swatch (UX-15 step 6) the Materials card is taller, and on a
      // 900 px high window "Place products" no longer fits under its heading: "Place product"
      // was below the fold again. When that is so, the panel starts at the picker instead. The
      // step is opened to choose a product, its finish, and place it; the picker, the Materials
      // card and the two buttons are what has to be on screen, and the heading gives way.
      if (step === 'place' && belowTheFold(btnPlaceMode)) {
        productPickerSlot.scrollIntoView({ block: 'start', behavior: 'instant' });
      }
    });
  }
  // "Change" on the step-1 summary reopens step 1. The link hides itself, so focus goes to the heading.
  btnStepRoomChange.addEventListener('click', () => {
    setRoomStep('room');
    const { title } = stepParts('room');
    title.focus({ preventScroll: true });
    title.scrollIntoView({ block: 'nearest', behavior: 'instant' });
  });

  // Remember what the user did with "Adjust size" (with Custom the app holds it open, and its
  // summary is hidden, so that is never their choice). The click is about to toggle the
  // disclosure. The `toggle` event is not used: it arrives a task later, by when the preset may
  // have changed again.
  $('room-size-adjust-summary').addEventListener('click', () => {
    sizeAdjustOpen = !roomSizeAdjust.open;
  });
  btnAddToRoom.addEventListener('click', () => onAddToRoom());
  initPlacedProductsUi();
}

async function boot() {
  initPanelUi();
  [library, catalog] = await Promise.all([
    fetchJson<MaterialsLibrary>('/assets/library/materials.json'),
    fetchJson<Catalog>('/assets/library/catalog.json'),
  ]);

  roomGraph = loadPersistedRoomGraph();
  if (!roomGraph) {
    const project = await loadProjectFromIdb();
    if (project?.room_graph) {
      roomGraph = project.room_graph;
      if (project.templates.length) persistTemplates(project.templates);
    }
  }
  roomHistory.reset(roomGraph);
  // A room restored from the last visit: step 1 is done, so the Room workspace opens on the next step.
  if (roomGraph) roomStep = 'openings';
  // The pickers go on the selects before the selects are filled; filling them tells the pickers.
  initPickers();
  populateMaterialSelects();

  refreshProductSelect(catalog.products[0]?.id);
  productSelect.addEventListener('change', () => {
    const p = catalog.products.find((x) => x.id === productSelect.value);
    if (!p) return;
    // Choosing a product is about the next one to place: let go of the placed product that is
    // selected, so the Materials card shows the finish of the product just chosen.
    selectPlacement(null);
    if (activePack && activePack.productId !== p.id) {
      // Keep pack session in memory but hide params for other products
      packParamsEl.hidden = true;
    }
    void loadProduct(p).then(() => {
      if (activePack?.productId === p.id) renderPackParams();
    });
  });

  modelFiles.addEventListener('change', () => void onModelFilesSelected());
  packFiles.addEventListener('change', () => void onPackFilesSelected());
  packGlbMate.addEventListener('change', () => void onPackGlbMateSelected());
  moduleFile.addEventListener('change', () => void onModuleFileSelected());
  textureRole.addEventListener('change', syncTextureRoleUi);
  $('btn-add-texture').addEventListener('click', () => void onAddTexture());
  refreshTextureTargetOptions();
  syncTextureRoleUi();

  workspaceMode.querySelectorAll('button').forEach((b) => {
    b.addEventListener('click', () => setWorkspace((b.getAttribute('data-mode') as 'catalog' | 'room') ?? 'catalog'));
  });
  $('room-ingress').querySelectorAll('button').forEach((b) => {
    b.addEventListener('click', () => {
      setRoomIngress((b.getAttribute('data-ingress') as 'scratch' | 'import' | 'template') ?? 'scratch');
      // Only when arriving from Product: inside the Room workspace a tab must not reset the tool.
      if (workspace !== 'room') setWorkspace('room');
    });
  });
  $('btn-import-plan').addEventListener('click', () => {
    const input = $<HTMLInputElement>('plan-file');
    const file = input.files?.[0] ?? null;
    const status = $('import-status');
    if (!file) {
      status.textContent = 'Choose a plan file, or use Load mock fixture.';
      status.classList.add('error');
      return;
    }
    if (isRasterPlanFile(file)) {
      void onStartUnderlay(file);
      return;
    }
    if (isPdfPlanFile(file)) {
      status.textContent =
        'PDF plan ingest needs a rasterizer (e.g. pdf.js) or a pre-rendered PNG/JPG. Upload PNG/JPG for underlay confirm.';
      status.classList.add('error');
      return;
    }
    void onStartImport(file, false);
  });
  $('btn-underlay-confirm').addEventListener('click', () => void onUnderlayConfirm());
  $('btn-import-fixture').addEventListener('click', () => void onStartImport(null, true));
  $('btn-import-apply-scale').addEventListener('click', () => onApplyImportScale());
  $('btn-import-start-editing').addEventListener('click', () => void onImportStartEditing());
  $('btn-import-save-template').addEventListener('click', () => onImportSaveTemplate());
  roomPreset.addEventListener('change', () => {
    // Custom shows the size fields; a preset folds them behind "Adjust size" (UX-08 item 4).
    syncSizeFields();
    const preset = ROOM_PRESETS.find((p) => p.id === roomPreset.value);
    if (!preset) return;
    const u = displayUnit();
    setFieldMeters(roomLength, preset.length, u);
    setFieldMeters(roomWidth, preset.width, u);
    setFieldMeters(roomCeiling, preset.ceilingHeight, u);
  });
  // A size typed by hand is no longer the preset's size, so the preset reads "Custom…".
  for (const input of [roomLength, roomWidth, roomCeiling]) {
    input.addEventListener('input', () => {
      roomPreset.value = 'custom';
      syncSizeFields();
    });
  }
  roomUnits.addEventListener('change', () => {
    const next = displayUnit();
    convertLengthFields(fieldUnit, next);
    fieldUnit = next;
    if (roomGraph) roomGraph = { ...roomGraph, display_unit: next };
    renderRoomUi();
  });
  $('opening-type').querySelectorAll('button').forEach((b) => {
    b.addEventListener('click', () => {
      openingType = (b.getAttribute('data-type') as OpeningType) ?? 'door';
      $('opening-type').querySelectorAll('button').forEach((x) => {
        x.setAttribute('aria-checked', String(x === b));
      });
      syncOpeningDefaultsFromType();
      // The Add opening hint names the type.
      syncStageState();
    });
  });
  openingWidth.addEventListener('change', () => {
    viewer?.setOpeningToolDefaults(openingType, readOpeningParamsMeters().width);
  });
  $('btn-create-room').addEventListener('click', () => void onCreateRoom());
  $('btn-save-template-scratch').addEventListener('click', () => onSaveTemplateFromScratch());
  $('btn-clear-room').addEventListener('click', () => void onClearRoom());
  btnUndo.addEventListener('click', () => onUndo());
  btnRedo.addEventListener('click', () => onRedo());
  roomWallMaterial.addEventListener('change', () => onRoomMaterialChange());
  roomFloorMaterial.addEventListener('change', () => onRoomMaterialChange());
  $('btn-export-project').addEventListener('click', () => onExportProject());
  $('btn-import-project').addEventListener('click', () => $<HTMLInputElement>('project-file').click());
  $<HTMLInputElement>('project-file').addEventListener('change', () => {
    const file = $<HTMLInputElement>('project-file').files?.[0];
    if (file) void onImportProjectFile(file);
    $<HTMLInputElement>('project-file').value = '';
  });
  $('btn-download-plan').addEventListener('click', () => void onDownloadPlanPng());
  const mjsEnabled = $<HTMLInputElement>('mjs-enabled');
  mjsEnabled.checked = isMjsLoadingEnabled();
  mjsEnabled.addEventListener('change', () => setMjsLoadingEnabled(mjsEnabled.checked));
  // The three tool buttons read the current mode BEFORE any workspace switch. setWorkspace('room')
  // puts the viewer back in plain room mode, so reading afterwards always saw the tool as off
  // and a second click could never switch it off.
  btnOpeningMode.addEventListener('click', () => {
    if (!roomGraph) return;
    const next = viewer?.getInteractionMode() === 'opening' ? 'room' : 'opening';
    if (workspace !== 'room') setWorkspace('room');
    viewer?.setOpeningToolDefaults(openingType, readOpeningParamsMeters().width);
    viewer?.setInteractionMode(next);
    setToolButtons(next === 'opening' ? 'opening' : null);
  });
  btnPlaceMode.addEventListener('click', () => {
    if (!roomGraph) return;
    const next = viewer?.getInteractionMode() === 'place' ? 'room' : 'place';
    if (workspace !== 'room') setWorkspace('room');
    // The tool lets go of the selected product (setToolButtons). Done here first, so that this
    // button stays under the pointer if the Materials card above it changes height.
    if (next === 'place') selectPlacement(null, () => btnPlaceMode);
    viewer?.setInteractionMode(next);
    setToolButtons(next === 'place' ? 'place' : null);
  });
  btnDrawWallMode.addEventListener('click', () => {
    if (!roomGraph) return;
    const next = viewer?.getInteractionMode() === 'draw-wall' ? 'room' : 'draw-wall';
    if (workspace !== 'room') setWorkspace('room');
    if (next === 'draw-wall') {
      const room = roomGraph.rooms[0];
      drawSession = createDrawSession({
        displayUnit: displayUnit(),
        ceilingHeight: room?.ceiling_height,
        wallThickness: roomGraph.walls[0]?.thickness,
        name: 'Freeform room',
      });
    } else {
      drawSession = null;
    }
    viewer?.setInteractionMode(next);
    setToolButtons(next === 'draw-wall' ? 'draw-wall' : null);
  });

  document.addEventListener('keydown', (e) => {
    if (workspace !== 'room') return;
    // A key typed into a field belongs to the field: Cmd/Ctrl+Z there undoes the typing, not the room.
    if (isTypingTarget(e.target)) return;
    if (e.key === 'Escape') {
      // A tool that is on is left first. With no tool on, Esc lets go of the selected product.
      if (!exitRoomTool()) selectPlacement(null);
      return;
    }
    const mod = e.metaKey || e.ctrlKey;
    if (!mod) {
      // UX-09 items 3 and 5: the keys of the selected product (arrows, R, Delete).
      if (onSelectedPlacementKey(e)) e.preventDefault();
      return;
    }
    if (e.key === 'z' && !e.shiftKey) {
      e.preventDefault();
      onUndo();
    } else if ((e.key === 'z' && e.shiftKey) || e.key === 'y') {
      e.preventDefault();
      onRedo();
    }
  });

  $('btn-reset').addEventListener('click', () => viewer?.resetCamera());
  $('btn-remount').addEventListener('click', async () => {
    const choices = viewer?.getSlots().map((s) => [s.def.id, s.materialId] as const) ?? [];
    const packSnapshot = activePack;
    const mode = viewer?.getInteractionMode() ?? 'catalog';
    viewer?.dispose();
    // The thumbnail renderer goes with the 3D view. `loadProduct` below asks for the trigger's image
    // again, from a new renderer; the other tiles are drawn again when they are next shown.
    resetThumbnails();
    mountViewer();
    await loadProduct(currentProduct, {
      onRootReady: (root) => {
        if (!packSnapshot || packSnapshot.productId !== currentProduct.id) return;
        preparePackRoot(root, packSnapshot);
      },
    });
    if (packSnapshot?.productId === currentProduct.id) {
      const root = viewer?.getModelRoot();
      if (root) applyPackColorsToRoot(root, packSnapshot);
      activePack = packSnapshot;
    }
    for (const [slot, mat] of choices) {
      if (!currentProduct.preserveMaterials) await viewer!.setSlotMaterial(slot, mat);
    }
    renderSlots();
    if (packSnapshot?.productId === currentProduct.id) renderPackParams();
    // Preserve the active interaction mode (including Product/catalog with a
    // restored room graph) — remount must not yank the user into Room.
    viewer?.setInteractionMode(mode);
    setToolButtons(mode === 'opening' || mode === 'place' || mode === 'draw-wall' ? mode : null);
    if (mode === 'catalog') viewer?.resetCamera();
    else if (roomGraph) viewer?.frameRoom();
  });

  window.addEventListener('beforeunload', () => {
    for (const u of sessionUrls) URL.revokeObjectURL(u);
  });

  renderPresets();
  initStageUi();
  // Every length field below is seeded in the unit the select shows right now.
  fieldUnit = displayUnit();
  syncLengthFieldLimits(fieldUnit);
  syncOpeningDefaultsFromType();
  // Seed custom fields from default preset.
  roomPreset.dispatchEvent(new Event('change'));
  setFieldMeters(roomThickness, DEFAULT_WALL_THICKNESS_M, fieldUnit);
  mountViewer();
  setRoomIngress('scratch');
  syncUndoRedoButtons();
  renderRoomUi();
  await loadProduct(catalog.products[0]);
  // Always land on Product so demo GLBs are visible on cold load. A persisted
  // room graph remains restored (see mountViewer) for when the user opens Room.
  setWorkspace('catalog');
}

declare global {
  interface Window {
    __rv: {
      viewer: () => RoomVibezViewer | null;
      parts: () => PartsList | null;
      library: () => MaterialsLibrary;
      catalog: () => Catalog;
      pack: () => PackSession | null;
      roomGraph: () => RoomGraph | null;
      importJob: () => ImportJob | null;
      /** Test helper: simulate a room-mode canvas click. */
      simulateRoomPointer: (hit: RoomPointerHit | null, mode: InteractionMode) => void;
      /** Test helper: start mock fixture import. */
      startFixtureImport: () => Promise<void>;
      /** Test helper: the catalog pickers, e.g. to call `sync()` after setting a select's value in code. */
      pickers: () => {
        product: ThumbnailPicker | null;
        wall: ThumbnailPicker | null;
        floor: ThumbnailPicker | null;
        textureTarget: ThumbnailPicker | null;
      };
      /** Test helper: the thumbnail renderer's counters, or null while no renderer exists. */
      thumbnails: () => ThumbnailStats | null;
    };
  }
}
window.__rv = {
  viewer: () => viewer,
  parts: () => lastParts,
  library: () => library,
  catalog: () => catalog,
  pack: () => activePack,
  roomGraph: () => roomGraph,
  importJob: () => importJob,
  simulateRoomPointer: (hit, mode) => onRoomPointer(hit, mode),
  startFixtureImport: () => onStartImport(null, true),
  pickers: () => ({
    product: productPicker,
    wall: wallMaterialPicker,
    floor: floorMaterialPicker,
    textureTarget: textureTargetPicker,
  }),
  thumbnails: () => thumbnails?.stats() ?? null,
};

boot().catch((err) => {
  console.error(err);
  setStatus('error', String(err?.message ?? err));
});

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    viewer?.dispose();
    thumbnails?.dispose();
    // Each picker puts its select back as it found it, so a module that runs again can mount afresh.
    for (const picker of [productPicker, wallMaterialPicker, floorMaterialPicker, textureTargetPicker]) picker?.destroy();
  });
}
