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
  confirmImportToRoomGraph,
  createRectangularRoom,
  defaultsFromMeta,
  deleteTemplate,
  downloadTextFile,
  ensurePackZoneSlots,
  exportProjectJson,
  findMaterial,
  footprintFromObject,
  formatCollisionWarn,
  formatLength,
  fromMeters,
  getModuleFactory,
  importModuleFile,
  instantiateTemplate,
  isMjsLoadingEnabled,
  isPdfPlanFile,
  isRasterPlanFile,
  loadPersistedRoomGraph,
  loadProjectFromIdb,
  loadTemplates,
  materialsForSlot,
  meshStandardFromLibrary,
  parseProjectJson,
  persistProjectToIdb,
  persistRoomGraph,
  persistTemplates,
  planSvgToPngDataUrl,
  registerModuleFactory,
  removeOpening,
  removePlacement,
  resolveModuleAsset,
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
  type Product,
  type RoomGraph,
  type RoomMeshMaterials,
  type RoomPointerHit,
  type SlotReport,
  type TextureMapRole,
  type UnderlayJob,
  type ViewerStatus,
} from './viewer';

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
const workspaceMode = $('workspace-mode');

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

function shellMaterialsFromGraph(graph: RoomGraph): RoomMeshMaterials | undefined {
  const room = graph.rooms[0];
  if (!room?.wall_material_id && !room?.floor_material_id) return undefined;
  const wallDef = room.wall_material_id ? findMaterial(library, room.wall_material_id) : null;
  const floorDef = room.floor_material_id ? findMaterial(library, room.floor_material_id) : null;
  return {
    wall: wallDef
      ? meshStandardFromLibrary(wallDef, { side: DoubleSide, name: `room:wall:${wallDef.id}` })
      : meshStandardFromLibrary(library.materials[0]!, { side: DoubleSide, name: 'room:wall:default' }),
    floor: floorDef
      ? meshStandardFromLibrary(floorDef, { name: `room:floor:${floorDef.id}` })
      : meshStandardFromLibrary(library.materials[0]!, { name: 'room:floor:default' }),
  };
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
  roomStatus.textContent = 'Undid last room change';
  roomStatus.classList.remove('error');
}

function onRedo() {
  if (!roomHistory.canRedo()) return;
  const next = roomHistory.redo();
  applyRoomGraph(next, { frame: false, reloadPlacements: true, history: 'skip' });
  roomStatus.textContent = 'Redid room change';
  roomStatus.classList.remove('error');
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
}

function syncMaterialSelectsFromGraph() {
  if (!roomGraph) return;
  const room = roomGraph.rooms[0];
  if (!room) return;
  roomWallMaterial.value = room.wall_material_id ?? '';
  roomFloorMaterial.value = room.floor_material_id ?? '';
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

function renderRoomUi() {
  roomGraphJson.textContent = roomGraph ? JSON.stringify(roomGraph, null, 2) : 'null';
  const has = !!roomGraph;
  roomTools.hidden = !has;
  roomPlan.hidden = !has;
  $('room-plan-actions').hidden = !has;
  // Neither can do anything without a room. ("Download plan PNG" is hidden with its row above.)
  $<HTMLButtonElement>('btn-save-template-scratch').disabled = !has;
  $<HTMLButtonElement>('btn-clear-room').disabled = !has;
  if (!has) {
    roomStatus.textContent = 'No room yet — from scratch, import plan, or template.';
    roomStatus.classList.remove('error');
    roomPlan.innerHTML = '';
    openingList.innerHTML = '';
    placementList.innerHTML = '';
    setToolButtons(null);
    return;
  }
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
    useBtn.addEventListener('click', () => {
      try {
        const graph = instantiateTemplate(tpl.id);
        setWorkspace('room');
        applyRoomGraph(graph, { frame: true, reloadPlacements: true, history: 'reset' });
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
    delBtn.addEventListener('click', () => {
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

function onImportStartEditing() {
  if (!importJob) return;
  try {
    const graph = confirmImportToRoomGraph(importJob);
    importJob = { ...importJob, status: 'confirmed' };
    setWorkspace('room');
    applyRoomGraph(graph, { frame: true, reloadPlacements: true, history: 'reset' });
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

function onUnderlayConfirm() {
  if (!underlayJob) return;
  try {
    underlayJob = {
      ...underlayJob,
      width_m: Number(($('underlay-width') as HTMLInputElement).value),
      depth_m: Number(($('underlay-depth') as HTMLInputElement).value),
      status: 'confirmed',
    };
    const graph = confirmUnderlayToRoomGraph(underlayJob);
    underlayJob = null;
    renderUnderlayReview();
    setWorkspace('room');
    applyRoomGraph(graph, { frame: true, reloadPlacements: true, history: 'reset' });
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
    if (project.templates.length) persistTemplates(project.templates);
    setWorkspace('room');
    applyRoomGraph(project.room_graph, { frame: true, reloadPlacements: true, history: 'reset' });
    if (project.templates.length) renderTemplateList();
    roomStatus.textContent = `Imported project${project.label ? ` “${project.label}”` : ''}`;
    roomStatus.classList.remove('error');
  } catch (err) {
    roomStatus.textContent = `Import failed: ${String((err as Error)?.message ?? err)}`;
    roomStatus.classList.add('error');
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

function renderPlacementList() {
  placementList.innerHTML = '';
  if (!roomGraph) return;
  for (const pl of roomGraph.placements) {
    const product = catalog.products.find((p) => p.id === pl.product_id);
    const li = document.createElement('li');
    li.innerHTML = `<span>${product?.name ?? pl.sku_id}</span>`;
    const del = document.createElement('button');
    del.type = 'button';
    del.textContent = 'Delete';
    del.addEventListener('click', () => {
      if (!roomGraph) return;
      viewer?.detachPlacement(pl.id);
      applyRoomGraph(removePlacement(roomGraph, pl.id), { frame: false, reloadPlacements: false });
    });
    li.appendChild(del);
    placementList.appendChild(li);
  }
}

function setToolButtons(mode: InteractionMode | null) {
  btnOpeningMode.setAttribute('aria-pressed', String(mode === 'opening'));
  btnPlaceMode.setAttribute('aria-pressed', String(mode === 'place'));
  btnDrawWallMode.setAttribute('aria-pressed', String(mode === 'draw-wall'));
  btnOpeningMode.textContent = mode === 'opening' ? 'Opening mode on — click a wall' : 'Click wall to mark opening';
  btnPlaceMode.textContent = mode === 'place' ? 'Place mode on — click the floor' : 'Click floor to place product';
  btnDrawWallMode.textContent =
    mode === 'draw-wall' ? 'Draw walls on — click floor corners' : 'Draw walls mode';
  if (mode === 'opening') stageHint.textContent = 'Opening mode · click a wall · orbit drag to look · scroll to zoom';
  else if (mode === 'place') stageHint.textContent = 'Place mode · click floor to drop the selected product · orbit to look';
  else if (mode === 'draw-wall')
    stageHint.textContent = 'Draw walls · click floor corners · click near first point to close · orbit to look';
  else if (workspace === 'room' || roomGraph)
    stageHint.textContent = 'Room · drag to orbit · scroll to zoom · right-drag to pan';
  else stageHint.textContent = 'Drag to spin product · scroll to zoom · right-drag / two-finger to pan';
}

function setWorkspace(mode: 'catalog' | 'room') {
  const changed = workspace !== mode;
  workspace = mode;
  document.body.dataset.workspace = mode;
  workspaceMode.querySelectorAll('button').forEach((b) => {
    b.setAttribute('aria-checked', String(b.getAttribute('data-mode') === mode));
  });
  const hint = $('workspace-mode-hint');
  if (mode === 'catalog') {
    hint.textContent = 'Product turntable — inspect GLB, materials, and packs.';
    viewer?.setInteractionMode('catalog');
    // Reframe the catalog GLB — room camera/shell must not leave the product invisible.
    viewer?.resetCamera();
    setToolButtons(null);
    stageHint.textContent = 'Drag to spin product · scroll to zoom · right-drag / two-finger to pan';
    $('catalog-card')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  } else {
    hint.textContent = 'Room editor — build the shell, openings, and place Catalog 3D products.';
    if (roomGraph) {
      viewer?.setInteractionMode('room');
      // Frame the room on arrival from Product only. Framing on every call threw away the
      // view the user had just orbited to.
      if (changed) viewer?.frameRoom();
      stageHint.textContent = 'Room · drag to orbit · scroll to zoom · right-drag to pan';
    } else {
      stageHint.textContent = 'Room workspace — create or import a room to edit the shell.';
    }
    const im = viewer?.getInteractionMode();
    setToolButtons(im === 'opening' || im === 'place' || im === 'draw-wall' ? im : null);
    $('room-card')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
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
 * select, or anything inside an open dialog. Global shortcuts (undo, redo, Esc) must leave
 * those alone. A ticked checkbox keeps focus but has no text to undo, so it does not count.
 */
function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable || target.closest('select, textarea, dialog')) return true;
  return target instanceof HTMLInputElement && !NON_TYPING_INPUT_TYPES.has(target.type);
}

function onRoomPointer(hit: RoomPointerHit | null, mode: InteractionMode) {
  if (!roomGraph || !viewer) return;
  if (mode === 'opening') {
    if (!hit || hit.kind !== 'wall' || !hit.wallId || hit.offsetAlongWall == null) {
      roomStatus.textContent = 'Click a wall to place the opening.';
      roomStatus.classList.add('error');
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
      roomStatus.classList.remove('error');
      roomStatus.textContent = `Added ${openingType} on wall · procedural placeholder mesh (not a catalog SKU)`;
    } catch (err) {
      roomStatus.textContent = String((err as Error)?.message ?? err);
      roomStatus.classList.add('error');
    }
    return;
  }
  if (mode === 'place') {
    if (!hit || hit.kind !== 'floor') {
      roomStatus.textContent = 'Click the floor inside the room to place furniture.';
      roomStatus.classList.add('error');
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
      roomStatus.textContent = 'Click the floor to add wall corners.';
      roomStatus.classList.add('error');
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
        roomStatus.classList.remove('error');
        roomStatus.textContent = `Closed freeform room · ${graph.walls.length} walls`;
      } catch (err) {
        roomStatus.textContent = String((err as Error)?.message ?? err);
        roomStatus.classList.add('error');
      }
      return;
    }
    drawSession = addDrawPoint(drawSession, point);
    roomStatus.classList.remove('error');
    roomStatus.textContent = `Draw wall: ${drawSession.points.length} point(s) — click near first to close`;
  }
}

async function placeCurrentProduct(x: number, z: number) {
  if (!roomGraph || !viewer) return;
  const product = currentProduct;
  if (!product?.glb && product.sourceKind !== 'mjs-module') {
    roomStatus.textContent = 'Select a Catalog 3D product with a GLB (or pack) first.';
    roomStatus.classList.add('error');
    return;
  }
  roomStatus.classList.remove('error');
  roomStatus.textContent = `Placing “${product.name}”…`;
  try {
    let px = x;
    let pz = z;
    let rotationY = 0;
    if (($('place-wall-snap') as HTMLInputElement).checked) {
      const snap = snapPlacementToWall(roomGraph, { x, z });
      if (snap) {
        px = snap.x;
        pz = snap.z;
        rotationY = snap.rotation_y;
      }
    }
    const root = await loadPlacementRoot(product);
    const slot_bindings: Record<string, string> = {};
    for (const s of product.slots) slot_bindings[s.id] = s.default;
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
    viewer.attachPlacement(placed.id, root, { x: px, z: pz }, rotationY);
    applyRoomGraph(next, { frame: false, reloadPlacements: false });
    const fp = footprintFromObject(root);
    const report = checkPlacementCollision(roomGraph, fp, { ignorePlacementId: placed.id });
    const warn = formatCollisionWarn(report);
    roomStatus.textContent = warn
      ? `Placed “${product.name}” · ${warn}`
      : `Placed “${product.name}” on the floor`;
  } catch (err) {
    console.error(err);
    roomStatus.textContent = `Place failed: ${String((err as Error)?.message ?? err)}`;
    roomStatus.classList.add('error');
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

async function reloadAllPlacements(graph: RoomGraph) {
  if (!viewer) return;
  viewer.clearAllPlacements();
  for (const pl of graph.placements) {
    const product = catalog.products.find((p) => p.id === pl.product_id);
    if (!product) continue;
    try {
      const root = await loadPlacementRoot(product);
      viewer.attachPlacement(pl.id, root, { x: pl.position.x, z: pl.position.z }, pl.rotation_y);
    } catch (err) {
      console.warn('Failed to reload placement', pl.id, err);
    }
  }
}

function onCreateRoom() {
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
    setWorkspace('room');
    applyRoomGraph(graph, { frame: true, reloadPlacements: true, history: 'reset' });
    viewer?.clearAllPlacements();
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
  });
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
  const packNote = product.pack
    ? ` · pack ${product.pack.completeness}/${product.pack.mappingMode}`
    : '';
  productMeta.textContent = `${product.sku} · slots tagged via ${product.slotTagging ?? 'unknown'}${
    product.userAdded ? ' · session upload' : ''
  }${packNote}`;
  slotsEl.innerHTML = '';
  warningsEl.innerHTML = '';
  for (const p of validateProduct(product, library)) console.warn('[catalog]', p);
  try {
    await viewer!.loadProduct(product, opts);
    renderSlots();
    if (activePack?.productId === product.id) renderPackParams();
    else if (!product.pack) {
      packParamsEl.hidden = true;
      packParamsEl.innerHTML = '';
    }
  } catch (err) {
    if (!(err instanceof StaleLoadError)) console.error(err);
  }
}

function renderSlots() {
  slotsEl.innerHTML = '';
  for (const slot of viewer!.getSlots()) {
    const current = findMaterial(library, slot.materialId);
    const wrap = document.createElement('div');
    wrap.className = 'slot';
    wrap.dataset.slot = slot.def.id;
    wrap.innerHTML = `
      <div class="slot-head">
        <span class="slot-label">${slot.def.label}</span>
        <span class="slot-value" data-role="value">${current?.name ?? slot.materialId}</span>
      </div>
      <div class="swatches" role="group" aria-label="${slot.def.label} materials"></div>
      <div class="slot-meta">material_slot_id: <code>${slot.def.id}</code> · ${slot.meshCount} mesh(es) · via ${slot.sources.join(', ')}</div>`;
    const swatches = wrap.querySelector('.swatches')!;
    for (const mat of materialsForSlot(library, slot.def)) {
      const b = document.createElement('button');
      b.className = 'swatch';
      b.title = `${mat.name} (${mat.sku})`;
      b.setAttribute('aria-label', mat.name);
      b.setAttribute('aria-pressed', String(mat.id === slot.materialId));
      b.dataset.material = mat.id;
      b.style.backgroundColor = mat.color;
      if (mat.map) b.style.backgroundImage = `url(${mat.map})`;
      b.addEventListener('click', async () => {
        if (currentProduct.preserveMaterials) {
          warningsEl.innerHTML =
            '<div class="warning">Pack / module keeps embedded or MJS-driven materials — library swatches do not replace them (use MJS params when mapping allows).</div>';
          return;
        }
        swatches.querySelectorAll('.swatch').forEach((s) => s.setAttribute('aria-pressed', String(s === b)));
        wrap.querySelector('[data-role=value]')!.textContent = mat.name;
        try {
          await viewer!.setSlotMaterial(slot.def.id, mat.id);
        } catch (err) {
          console.error(err);
        }
      });
      swatches.appendChild(b);
    }
    slotsEl.appendChild(wrap);
  }
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

function refreshProductSelect(selectId?: string) {
  const keep = selectId ?? productSelect.value;
  productSelect.innerHTML = '';
  for (const p of catalog.products) {
    const opt = new Option(p.userAdded ? `${p.name} (upload)` : p.name, p.id);
    productSelect.add(opt);
  }
  if (keep && catalog.products.some((p) => p.id === keep)) productSelect.value = keep;
}

function refreshTextureTargetOptions() {
  const keep = textureTarget.value;
  textureTarget.innerHTML = '';
  for (const m of library.materials) {
    textureTarget.add(new Option(`${m.name} (${m.category})`, m.id));
  }
  if (keep && library.materials.some((m) => m.id === keep)) textureTarget.value = keep;
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

async function boot() {
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
  populateMaterialSelects();

  refreshProductSelect(catalog.products[0]?.id);
  productSelect.addEventListener('change', () => {
    const p = catalog.products.find((x) => x.id === productSelect.value);
    if (!p) return;
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
  $('btn-underlay-confirm').addEventListener('click', () => onUnderlayConfirm());
  $('btn-import-fixture').addEventListener('click', () => void onStartImport(null, true));
  $('btn-import-apply-scale').addEventListener('click', () => onApplyImportScale());
  $('btn-import-start-editing').addEventListener('click', () => onImportStartEditing());
  $('btn-import-save-template').addEventListener('click', () => onImportSaveTemplate());
  roomPreset.addEventListener('change', () => {
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
    });
  });
  openingWidth.addEventListener('change', () => {
    viewer?.setOpeningToolDefaults(openingType, readOpeningParamsMeters().width);
  });
  $('btn-create-room').addEventListener('click', () => onCreateRoom());
  $('btn-save-template-scratch').addEventListener('click', () => onSaveTemplateFromScratch());
  $('btn-clear-room').addEventListener('click', () => {
    viewer?.clearAllPlacements();
    drawSession = null;
    applyRoomGraph(null, { history: 'reset' });
    setWorkspace('catalog');
  });
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
      exitRoomTool();
      return;
    }
    const mod = e.metaKey || e.ctrlKey;
    if (!mod) return;
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
};

boot().catch((err) => {
  console.error(err);
  setStatus('error', String(err?.message ?? err));
});

if (import.meta.hot) import.meta.hot.dispose(() => viewer?.dispose());
