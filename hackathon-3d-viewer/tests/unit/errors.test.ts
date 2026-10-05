/**
 * The error mapper against the engine's ACTUAL messages.
 *
 * Wherever the engine function is pure it is called for real, so the test follows the engine.
 * Where a message cannot be produced in node (it needs WebGL, a GLTF parse or a canvas), the
 * literal is copied from the source with its file:line.
 *
 * Three describe blocks at the end are named "to reconcile after merge". They cover engine
 * behaviour that was being changed in parallel when this file was written, and they are written
 * to hold both before and after that change.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BufferAttribute, BufferGeometry, Color, Group, Mesh, MeshStandardMaterial } from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { copy, fmt, plural } from '../../src/copy';
import {
  createUploadEscalation,
  friendlyError,
  friendlyObjNote,
  mjsConfirmContent,
  movedOverlapMessage,
  overlapList,
  packPanelMode,
  packStatusMessage,
  packSummary,
  placedMessage,
  rawMessage,
  slotWarnings,
  splitGuardMessage,
  type ErrorContext,
  type ErrorWhere,
  type FriendlyMessage,
} from '../../src/errors';
import {
  confirmImportToRoomGraph,
  parseCandidatesPayload,
  scaleFactorFromKnownLength,
  setCandidateAccepted,
  setScaleFactor,
  startImportJob,
} from '../../src/viewer/dwgImport';
import { commitDrawSession, createDrawSession } from '../../src/viewer/freeformWalls';
import { formatMjsGuardMessage, scanMjsSource } from '../../src/viewer/mjsGuardrails';
import { importModuleFile, resolveModuleAsset } from '../../src/viewer/modules';
import { buildPackStatus, inferPackMapping, resolveModulePackMeta } from '../../src/viewer/packs';
import { confirmUnderlayToRoomGraph, startUnderlayJob } from '../../src/viewer/planUnderlay';
import { parseProjectJson } from '../../src/viewer/projectIO';
import { checkPlacementCollision, footprintFromPlacement, formatCollisionWarn } from '../../src/viewer/roomCollision';
import { addOpening, addPlacement, createRectangularRoom } from '../../src/viewer/roomGraph';
import { planSvgToPngDataUrl } from '../../src/viewer/roomPlan';
import type { Product, SlotReport } from '../../src/viewer/types';
import {
  createMaterialFromTexture,
  createProductFromModelFiles,
  createProductFromObjPackage,
} from '../../src/viewer/uploads';

const FIXTURE = join(dirname(fileURLToPath(import.meta.url)), '../fixtures/obj-stool');
const fixtureFile = (name: string) => new File([readFileSync(join(FIXTURE, name))], name);
const OPTS = { defaultMaterialId: 'wood-oak' };
const TRIANGLE = 'v 0 0 0\nv 1 0 0\nv 0 1 0\nf 1 2 3\n';

/** Run an engine call and return what it throws. */
async function thrownBy(fn: () => unknown): Promise<unknown> {
  try {
    await fn();
  } catch (err) {
    return err;
  }
  throw new Error('expected the engine call to throw');
}

/** Map without writing to the console. */
function map(err: unknown, where: ErrorWhere, extra?: Partial<ErrorContext>): FriendlyMessage {
  return friendlyError(err, { where, log: () => {}, ...extra });
}

async function mapThrown(fn: () => unknown, where: ErrorWhere, extra?: Partial<ErrorContext>): Promise<FriendlyMessage> {
  return map(await thrownBy(fn), where, extra);
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// -------------------------------------------------------------------------------------------------
describe('friendlyError: adding a model (deck §4.A)', () => {
  it('nothing chosen', async () => {
    const msg = await mapThrown(() => createProductFromModelFiles([], OPTS), 'model-upload');
    expect(msg.text).toBe('Choose a file first.');
    expect(msg).toMatchObject({ critical: false, neutral: false, matched: true, id: 'modelMessages.nothingChosen' });
  });

  it('an OBJ package and a GLB together', async () => {
    const files = [new File([TRIANGLE], 'a.obj'), new File([new Uint8Array([1])], 'b.glb')];
    const msg = await mapThrown(() => createProductFromModelFiles(files, OPTS), 'model-upload');
    expect(msg.text).toBe('Add an OBJ package or a GLB/glTF, not both at once.');
    expect(msg.critical).toBe(false);
  });

  it('a file type the upload does not take (FBX)', async () => {
    const msg = await mapThrown(() => createProductFromModelFiles([new File(['x'], 'a.fbx')], OPTS), 'model-upload');
    expect(msg.text).toBe("That file type isn't supported. Use .glb, .gltf or .obj (with its .mtl and textures).");
    expect(msg.critical).toBe(false);
  });

  it('an unreadable model: names the file and drops the parser text', () => {
    // uploads.ts:130  throw new Error(`Could not load model (${mainFile.name}): ${(err as Error).message}`)
    // GLTFLoader cannot run in node, so the parser text is the one the stress test recorded.
    const err = new Error('Could not load model (x.glb): Unexpected token \'\\u0000\', "\\u0000\\u0001\\u0002"... is not valid JSON');
    const msg = map(err, 'model-upload');
    expect(msg.text).toBe("“x.glb” couldn't be read as a 3D model, so nothing was added. Try re-exporting it as .glb.");
    expect(msg.critical).toBe(true);
    expect(msg.text).not.toMatch(/Unexpected token|JSON/);
    // A file name with brackets in it.
    expect(map(new Error('Could not load model (chair (1).glb): Invalid typed array length: 4'), 'model-upload').text).toBe(
      "“chair (1).glb” couldn't be read as a 3D model, so nothing was added. Try re-exporting it as .glb.",
    );
  });

  it('files with no .obj among them', async () => {
    const msg = await mapThrown(() => createProductFromObjPackage([new File(['x'], 'a.mtl')], OPTS), 'model-upload');
    expect(msg.text).toBe("Add the .obj file too. The other files can't make a model on their own.");
  });

  it('several .obj files', async () => {
    const files = [new File([TRIANGLE], 'a.obj'), new File([TRIANGLE], 'b.obj')];
    const msg = await mapThrown(() => createProductFromModelFiles(files, OPTS), 'model-upload');
    expect(msg.text).toBe('Choose one .obj at a time, plus its .mtl, textures and .slots.json.');
    expect(msg.critical).toBe(false);
  });

  it('an empty .obj (the engine wraps "OBJ file is empty" in its parse error)', async () => {
    const err = await thrownBy(() => createProductFromModelFiles([new File(['   \n'], 'empty.obj')], OPTS));
    expect(rawMessage(err)).toBe('Could not parse OBJ (empty.obj): OBJ file is empty');
    expect(map(err, 'model-upload').text).toBe('That .obj file is empty.');
    // objImport.ts:444, the unwrapped form the deck lists
    expect(map(new Error('OBJ file is empty'), 'model-upload').id).toBe('modelMessages.emptyObj');
  });

  it('an .obj that does not parse', () => {
    // objImport.ts:448  throw new Error(`Could not parse OBJ (${objFile.name}): ${(err as Error).message}`)
    // OBJLoader accepts almost any text, so this cannot be produced with a small file.
    const msg = map(new Error('Could not parse OBJ (x.obj): Unexpected line: "zz"'), 'model-upload');
    expect(msg.text).toBe("“x.obj” isn't a valid .obj file, so nothing was added.");
    expect(msg.critical).toBe(true);
  });

  it('an .obj with no shapes', async () => {
    const msg = await mapThrown(
      () => createProductFromModelFiles([new File(['# just a comment\n'], 'nothing.obj')], OPTS),
      'model-upload',
    );
    expect(msg.text).toBe('“nothing.obj” has no shapes in it, so nothing was added.');
  });

  it('a failed conversion', () => {
    // objImport.ts:589  throw new Error(`OBJ→GLB export failed: ${(err as Error).message}`)
    const msg = map(new Error('OBJ→GLB export failed: FileReader is not defined'), 'model-upload');
    expect(msg.text).toBe("Couldn't convert the .obj. Try a .glb instead.");
    expect(msg.text).not.toMatch(/FileReader/);
  });

  it('a .slots.json that is not JSON, and one with the wrong shape', async () => {
    const obj = new File([TRIANGLE], 'a.obj');
    const bad = await thrownBy(() => createProductFromModelFiles([obj, new File(['{not json'], 'a.slots.json')], OPTS));
    expect(rawMessage(bad)).toMatch(/^Invalid sidecar JSON \(a\.slots\.json\): /);
    expect(map(bad, 'model-upload').text).toBe("“a.slots.json” isn't valid JSON. Fix it or leave it out.");

    const shape = await thrownBy(() => createProductFromModelFiles([obj, new File(['[1,2]'], 'a.slots.json')], OPTS));
    expect(rawMessage(shape)).toBe(
      'Invalid sidecar JSON (a.slots.json): Sidecar must be a JSON object of name → material_slot_id',
    );
    expect(map(shape, 'model-upload').text).toBe('A .slots.json file should look like { "partName": "slotName" }.');
    // objImport.ts:256, the unwrapped form the deck lists
    expect(map(new Error('Sidecar must be a JSON object of name → material_slot_id'), 'model-upload').id).toBe(
      'modelMessages.sidecarShape',
    );
  });
});

describe('createUploadEscalation (deck §4.A, 1st / 2nd / 3rd)', () => {
  // uploads.ts:130
  const unreadable = () => new Error('Could not load model (x.glb): Unexpected token');

  it('escalates on repeated unreadable models and starts over after reset()', async () => {
    const uploads = createUploadEscalation();
    const quiet = { log: () => {} };
    expect(uploads.map(unreadable(), quiet).text).toBe(
      "“x.glb” couldn't be read as a 3D model, so nothing was added. Try re-exporting it as .glb.",
    );
    // A different kind of upload error in between does not move the count.
    const nothing = await thrownBy(() => createProductFromModelFiles([], OPTS));
    expect(uploads.map(nothing, quiet).text).toBe('Choose a file first.');
    expect(uploads.map(unreadable(), quiet).text).toBe(
      'Still not readable. Compressed GLBs (Draco or Meshopt) may not load here. Re-export without compression, or try an .obj.',
    );
    const third = 'Still no luck. You can carry on with the demo products, or start a room without this model.';
    expect(uploads.map(unreadable(), quiet).text).toBe(third);
    expect(uploads.map(unreadable(), quiet).text).toBe(third);
    uploads.reset();
    expect(uploads.map(unreadable(), quiet).id).toBe('modelMessages.unreadable');
  });

  it('friendlyError takes the attempt directly too', () => {
    expect(map(unreadable(), 'model-upload', { attempt: 2 }).id).toBe('modelMessages.unreadableSecond');
    expect(map(unreadable(), 'model-upload', { attempt: 7 }).id).toBe('modelMessages.unreadableThird');
  });
});

describe('friendlyObjNote (deck §4.A, the OBJ notes)', () => {
  it('translates the notes of a bare .obj', async () => {
    const result = await createProductFromModelFiles([new File([TRIANGLE], 'tri.obj')], OPTS);
    for (const u of result.sessionUrls) URL.revokeObjectURL(u);
    expect(result.warnings?.notes).toEqual([
      'No .mtl in selection — geometry loads with default materials; slots from object names or surface fallback',
      'Meshes without UVs — textured library materials will look flat: (unnamed)',
      'No usemtl / named groups / sidecar — bound whole model to surface slot',
    ]);
    expect(result.warnings!.notes.map(friendlyObjNote)).toEqual([
      'No .mtl file, so materials use defaults.',
      '(unnamed) has no UV mapping, so textures will look flat or wrong. Re-export with UVs.',
      'The model has no named materials, so it changes as one part.',
    ]);
  });

  it('translates the notes of the stool fixture without its texture', async () => {
    const files = [fixtureFile('stool.obj'), fixtureFile('stool.mtl')];
    const result = await createProductFromModelFiles(files, OPTS);
    for (const u of result.sessionUrls) URL.revokeObjectURL(u);
    const notes = result.warnings!.notes;
    // In node the MTL loader has no `document`, which gives a real "MTL failed to parse" note.
    expect(notes.some((n) => /^MTL failed to parse — /.test(n))).toBe(true);
    expect(notes).toContain('MTL references missing textures (not in upload): wood.png');
    expect(notes).toContain('Slots from usemtl/groups: top, legs');
    const friendly = notes.map(friendlyObjNote);
    expect(friendly).toContain("The .mtl file couldn't be read, so materials use defaults.");
    expect(friendly).toContain('Textures missing from your selection: wood.png. Add them next time.');
    expect(friendly).toContain('Parts found: top, legs.');
    for (const line of friendly) expect(line).not.toMatch(/document is not defined|usemtl|MTL /);
  });

  it('handles the "+ sidecar" form and returns null where the deck has no wording', () => {
    // objImport.ts:543
    expect(friendlyObjNote('Slots from usemtl/groups + sidecar: top, legs')).toBe('Parts found: top, legs.');
    // objImport.ts:474, several meshes
    expect(friendlyObjNote('Meshes without UVs — textured library materials will look flat: seat, leg')).toBe(
      'seat, leg have no UV mapping, so textures will look flat or wrong. Re-export with UVs.',
    );
    // objImport.ts:541, no deck row
    expect(friendlyObjNote('Slots from sidecar only (3)')).toBeNull();
    expect(friendlyObjNote('something new')).toBeNull();
  });
});

// -------------------------------------------------------------------------------------------------
describe('friendlyError: adding a texture (deck §4.B)', () => {
  it('a file that is not an image', async () => {
    const msg = await mapThrown(
      () => createMaterialFromTexture(new File(['x'], 'a.gif'), { category: 'wood' }),
      'texture-add',
    );
    expect(msg.text).toBe("That isn't a PNG, JPEG or WebP image. Choose a different file.");
    expect(msg.critical).toBe(false);
  });

  it('the two host messages of the texture form', () => {
    // main.ts:1609  throw new Error('Select a target material')
    expect(map(new Error('Select a target material'), 'texture-add').text).toBe('Choose which material to add it to.');
    // main.ts:1587  textureStatus.textContent = 'Choose an image first'
    expect(map('Choose an image first', 'texture-add').text).toBe('Choose an image to add.');
  });
});

// -------------------------------------------------------------------------------------------------
describe('friendlyError: packs and .mjs (deck §4.C)', () => {
  it('not a .mjs file', async () => {
    const msg = await mapThrown(() => importModuleFile(new File(['x'], 'a.txt')), 'module-load');
    expect(msg.text).toBe('Choose a .mjs file.');
  });

  it('.mjs loading switched off', async () => {
    const file = new File(['export const a = 1'], 'a.mjs');
    const msg = await mapThrown(() => importModuleFile(file, undefined, { enabled: false }), 'pack-load');
    expect(msg.text).toBe('.mjs loading is off. Turn on “Allow .mjs files” to continue.');
    expect(msg.critical).toBe(false);
  });

  it('cancelled by the user: neutral, and not logged as an error', async () => {
    vi.stubGlobal('window', {}); // the engine only asks for confirmation when a window exists
    const file = new File(['export const a = 1'], 'a.mjs');
    const err = await thrownBy(() => importModuleFile(file, undefined, { enabled: true, confirmFn: () => false }));
    expect(rawMessage(err)).toBe('MJS load cancelled by user');
    const log = vi.fn();
    const msg = friendlyError(err, { where: 'pack-load', log });
    expect(msg.text).toBe('Cancelled. Nothing was loaded.');
    expect(msg).toMatchObject({ neutral: true, critical: false, matched: true });
    expect(log).not.toHaveBeenCalled();
  });

  it('a module that is not a pack', async () => {
    const err = await thrownBy(() => resolveModuleAsset({ params: 1, materials: 2 }));
    expect(rawMessage(err)).toContain('Exports: materials, params'); // pinned by unit/modules.test.ts:53
    const msg = map(err, 'pack-load');
    expect(msg.text).toBe(
      "This .mjs isn't a furniture pack. It doesn't provide a model. It exports: materials, params. A pack needs a function called createAsset.",
    );
    expect(msg.critical).toBe(true);
    expect(msg.text).not.toMatch(/Polyfork|Object3D|THREE/);
    // The same message as plain text, without the error object.
    expect(map(rawMessage(err), 'module-load').text).toBe(msg.text);
  });

  it('a module that exports nothing', async () => {
    const msg = await mapThrown(() => resolveModuleAsset({}), 'module-load');
    expect(msg.text).toBe(
      "This .mjs isn't a furniture pack. It doesn't provide a model. A pack needs a function called createAsset.",
    );
  });

  it('host and viewer messages of the pack flow', () => {
    // main.ts:1486  throw new Error('Select a .mjs file (optionally with sibling .glb)')
    expect(map(new Error('Select a .mjs file (optionally with sibling .glb)'), 'pack-load').text).toBe(
      'Choose a .mjs file, with its .glb if you have it.',
    );
    // RoomVibezViewer.ts:278
    const blocked = new Error('This module keeps its own materials (preserveMaterials). Library swatches are display-only.');
    expect(map(blocked, 'texture-add').text).toBe(
      "This pack controls its own colors, so swatches won't change it. Use the pack options above.",
    );
  });
});

// -------------------------------------------------------------------------------------------------
describe('friendlyError: importing a plan (deck §4.E)', () => {
  it('no file', () => {
    // dwgImport.ts:244  throw new Error('No file provided')  (not reachable through startImportJob today)
    expect(map(new Error('No file provided'), 'plan-import').text).toBe('Choose a plan file, or try the sample plan.');
    // main.ts:1679  status.textContent = 'Choose a plan file, or use Load mock fixture.'
    expect(map('Choose a plan file, or use Load mock fixture.', 'plan-import').id).toBe('planMessages.noFile');
  });

  it('a PDF', async () => {
    const pdf = new File(['x'], 'plan.pdf', { type: 'application/pdf' });
    const msg = await mapThrown(() => startUnderlayJob(pdf), 'plan-image');
    expect(msg.text).toBe("PDF isn't supported yet. Export the page as PNG or JPG and add that instead.");
    expect(msg.text).not.toMatch(/rasterizer|pdf\.js|imageUri/);
    // main.ts:1688-1689, the host's own copy of the sentence
    const host =
      'PDF plan ingest needs a rasterizer (e.g. pdf.js) or a pre-rendered PNG/JPG. Upload PNG/JPG for underlay confirm.';
    expect(map(host, 'plan-import').id).toBe('planMessages.pdf');
  });

  it('a file the image path does not take', async () => {
    const err = await thrownBy(() => startUnderlayJob(new File(['x'], 'plan.ifc')));
    expect(rawMessage(err)).toBe('Underlay accepts PNG / JPEG / WebP (PDF blocked without rasterizer)');
    expect(map(err, 'plan-image', { fileName: 'plan.ifc' }).text).toBe(
      "“plan.ifc” isn't a plan format we can use. Try PNG, JPG, WebP, DWG, DXF or JSON.",
    );
    // Without the file name the sentence cannot be built, so the generic message is used.
    expect(map(err, 'plan-image').matched).toBe(false);
  });

  it('a JSON file that is not a plan (three engine messages, plus a JSON syntax error)', async () => {
    const want = "This JSON file isn't in the expected plan format. It needs a list of “walls” and “rooms”.";
    const cases: unknown[] = [null, { schema_version: 2 }, { schema_version: 1 }];
    const raws: string[] = [];
    for (const payload of cases) {
      const err = await thrownBy(() => parseCandidatesPayload(payload));
      raws.push(rawMessage(err));
      const msg = map(err, 'plan-import');
      expect(msg.text).toBe(want);
      expect(msg.critical).toBe(true);
    }
    expect(raws).toEqual([
      'Candidates payload must be a JSON object',
      'Unsupported candidates schema_version (expect 1)',
      'Candidates must include walls[] and rooms[]',
    ]);
    const syntax = await thrownBy(() => JSON.parse('{nope'));
    expect(map(syntax, 'plan-import').text).toBe(want);
  });

  it('an image size that is not above 0', async () => {
    const job = await startUnderlayJob(new File(['x'], 'p.png', { type: 'image/png' }));
    URL.revokeObjectURL(job.imageUri);
    const msg = await mapThrown(() => confirmUnderlayToRoomGraph({ ...job, width_m: 0 }), 'plan-image');
    expect(msg.text).toBe('Width and depth need to be above 0.');
    expect(msg.critical).toBe(false);
  });

  it('scale: a bad length, a bad factor, and no scale to work from', async () => {
    const job = await startImportJob(null, { useFixture: true });
    expect((await mapThrown(() => scaleFactorFromKnownLength(job, 0), 'plan-scale')).text).toBe('Enter a length above 0.');
    expect((await mapThrown(() => setScaleFactor(job, -1), 'plan-scale')).text).toBe('Enter a length above 0.');
    const noHint = { ...job, candidates: { ...job.candidates, scale_hint: undefined } };
    const err = await thrownBy(() => scaleFactorFromKnownLength(noHint, 5));
    expect(rawMessage(err)).toBe('No scale hint on this extract');
    expect(map(err, 'plan-scale').text).toBe('No scale found. Enter a length you know.');
  });

  it('too few walls, then no room', async () => {
    let job = await startImportJob(null, { useFixture: true });
    const rooms = job.candidates.rooms;
    for (const r of rooms) job = setCandidateAccepted(job, 'room', r.id, false);
    const noRoom = job;
    expect((await mapThrown(() => confirmImportToRoomGraph(noRoom), 'plan-confirm')).text).toBe(
      'Include at least one room.',
    );
    for (const w of job.candidates.walls) job = setCandidateAccepted(job, 'wall', w.id, false);
    const noWalls = job;
    const msg = await mapThrown(() => confirmImportToRoomGraph(noWalls), 'plan-confirm');
    expect(msg.text).toBe('Include at least 3 walls to make a room.');
    expect(msg.critical).toBe(false);
  });
});

// -------------------------------------------------------------------------------------------------
describe('friendlyError: room, saving and starting up (deck §4.F)', () => {
  const room = () => createRectangularRoom({ length: 5, width: 4, ceilingHeight: 2.7 });

  it('closing a drawn room with too few corners', async () => {
    const session = { ...createDrawSession(), points: [{ x: 0, z: 0 }, { x: 2, z: 0 }] };
    const msg = await mapThrown(() => commitDrawSession(session), 'draw-walls');
    expect(msg.text).toBe('Add at least 3 corners before closing.');
  });

  it('closing a drawn room whose walls are too short', async () => {
    const points = [
      { x: 0, z: 0 },
      { x: 0.02, z: 0 },
      { x: 0.02, z: 0.02 },
      { x: 0, z: 0.02 },
    ];
    const err = await thrownBy(() => commitDrawSession({ ...createDrawSession(), points }));
    expect(rawMessage(err)).toBe('Degenerate polygon — walls too short');
    expect(map(err, 'draw-walls').text).toBe('Those walls are too short. Try corners further apart.');
  });

  it('an opening that is too wide, too tall, below the floor, or has no size', async () => {
    const g = room();
    const wall_id = g.walls[0]!.id;
    const base = { wall_id, type: 'door' as const, offset_along_wall: 0 };

    const wide = await thrownBy(() => addOpening(g, { ...base, width: 10 }));
    expect(rawMessage(wide)).toBe('Opening exceeds wall length (5.00 m)');
    expect(map(wide, 'opening-add').text).toBe(
      "That opening doesn't fit on this wall (wall is 5.00 m long). Make it narrower or click nearer the middle.",
    );

    const tall = await thrownBy(() => addOpening(g, { ...base, height: 5 }));
    expect(rawMessage(tall)).toBe('Opening exceeds wall height (2.70 m)');
    expect(map(tall, 'opening-add').text).toBe('That opening is taller than the wall (2.70 m).');

    const sill = await mapThrown(() => addOpening(g, { ...base, type: 'window', sill_height: -1 }), 'opening-add');
    expect(sill.text).toBe("Sill height can't be below 0.");

    // roomGraph.ts:389 has no deck row; the string is in copy.notInDeck.
    const flat = await thrownBy(() => addOpening(g, { ...base, width: 0 }));
    expect(rawMessage(flat)).toBe('Opening width and height must be positive');
    expect(map(flat, 'opening-add')).toMatchObject({
      text: 'Width and height need to be above 0.',
      id: 'notInDeck.openingSizeInvalid',
      critical: false,
    });
  });

  it('placing: no model, a missing pack factory, and any other failure', () => {
    // main.ts:857  roomStatus.textContent = 'Select a Catalog 3D product with a GLB (or pack) first.'
    expect(map('Select a Catalog 3D product with a GLB (or pack) first.', 'place').text).toBe(
      'This product has no 3D model to place. Choose another.',
    );
    // main.ts:906  throw new Error('Module factory not registered for this product'), shown as "Place failed: ..."
    const factory = new Error('Module factory not registered for this product');
    const msg = map(factory, 'place', { name: 'core-rulebook' });
    expect(msg.text).toBe("Couldn't place “core-rulebook”. Load its pack again and try once more.");
    expect(msg.critical).toBe(true);
    expect(map('Place failed: Module factory not registered for this product', 'place', { name: 'X' }).id).toBe(
      'roomMessages.placeFailed',
    );
    // A GLB that fails to load is not a pack problem: the deck's sentence would mislead.
    const other = map(new Error('fetch for "blob:x" responded with 404: Not Found'), 'place', { name: 'Lounge chair' });
    expect(other).toMatchObject({ text: "Couldn't place “Lounge chair”. Try again.", id: 'notInDeck.placeFailedOther' });
    expect(other.text).not.toMatch(/404|blob/);
  });

  it('the plan PNG could not be created', async () => {
    // In node there is no Image, so the real function fails; any failure there reads the same.
    const msg = await mapThrown(() => planSvgToPngDataUrl('<svg xmlns="http://www.w3.org/2000/svg"/>'), 'plan-png');
    expect(msg.text).toBe("Couldn't create the PNG. Try again.");
    // roomPlan.ts:136 and :143
    expect(map(new Error('Failed to rasterize plan SVG'), 'plan-png').id).toBe('roomMessages.planPngFailed');
    expect(map('Plan export failed: Canvas 2D unavailable', 'plan-png').id).toBe('roomMessages.planPngFailed');
  });

  it('a project file that cannot be opened, whatever the reason', async () => {
    const want = "Couldn't open that file. It isn't a Catalog 3D project, or it's damaged. Your current room is unchanged.";
    const payloads: unknown[] = [null, { schema_version: 99 }, { schema_version: 1, room_graph: { nope: true } }];
    const raws: string[] = [];
    for (const payload of payloads) {
      const err = await thrownBy(() => parseProjectJson(payload));
      raws.push(rawMessage(err));
      const msg = map(err, 'project-import');
      expect(msg.text).toBe(want);
      expect(msg.critical).toBe(true);
      expect(msg.text).not.toMatch(/normalizeRoomGraph|schema_version/);
    }
    expect(raws).toEqual([
      'Invalid project JSON',
      'Unsupported project schema_version (expected 1)',
      'room_graph failed normalizeRoomGraph',
    ]);
    // main.ts:635 parses the file first: a file that is not JSON fails there.
    expect(map(await thrownBy(() => JSON.parse('<html>')), 'project-import').text).toBe(want);
    // main.ts:643 shows it today as "Import failed: ..."
    expect(map('Import failed: room_graph failed normalizeRoomGraph', 'project-import').text).toBe(want);
    // The last sentence is the emphasised one.
    const strong = map(new Error('Invalid project JSON'), 'project-import').segments.filter((s) => s.strong);
    expect(strong.map((s) => s.text)).toEqual(['Your current room is unchanged.']);
  });

  it('no room yet', () => {
    // main.ts:650  roomStatus.textContent = 'Create or load a room first.'
    expect(map('Create or load a room first.', 'template-save').text).toBe('Create a room first.');
  });
});

// -------------------------------------------------------------------------------------------------
describe('friendlyError: the stage overlay (deck §3.2)', () => {
  it('no WebGL names the software-3D launcher', () => {
    // three.module.js: throw new Error('Error creating WebGL context.')
    const msg = map(new Error('Error creating WebGL context.'), 'boot');
    expect(msg.text).toBe(
      "3D isn't available in this browser. Turn on hardware acceleration, or try another browser. On a Mac you can also open “Start Viewer (software 3D).command” from the viewer folder.",
    );
    expect(msg.segments[0]).toEqual({ text: "3D isn't available in this browser.", strong: true });
    expect(msg.critical).toBe(true);
    expect(map('Error creating WebGL context.', 'product-load').id).toBe('topBarAndStage.overlayNoWebgl');
  });

  it('any other boot failure does not say "model"', () => {
    // main.ts:185  throw new Error(`${url}: HTTP ${res.status}`)
    const msg = map(new Error('/assets/library/materials.json: HTTP 404'), 'boot');
    expect(msg.text).toBe(
      "The viewer couldn't start. Reload the page. If it happens again, your saved room may be damaged.",
    );
    expect(msg.text).not.toMatch(/model|404|materials\.json/);
    expect(msg).toMatchObject({ critical: true, matched: true });
  });

  it('a product that fails to load gets its own sentence', () => {
    // RoomVibezViewer.ts:751, passed to the host through onStatus('error', detail)
    const msg = map('createAsset() did not return a THREE.Object3D', 'product-load');
    expect(msg).toMatchObject({
      text: "This product's 3D model couldn't be loaded. Choose another product, or reload the page.",
      id: 'notInDeck.overlayModelFailed',
      critical: true,
    });
  });
});

// -------------------------------------------------------------------------------------------------
describe('friendlyError: fallback and logging', () => {
  it('falls back to a plain generic message and never shows the raw text', () => {
    // roomTemplates.ts:77
    const msg = map(new Error('Unknown template "tpl_abc_1"'), 'template-use');
    expect(msg).toMatchObject({
      text: 'Something went wrong. Try again.',
      id: 'notInDeck.genericError',
      matched: false,
      critical: true,
      neutral: false,
    });
    // main.ts:1358  throw new Error('Materials library is empty')
    expect(map(new Error('Materials library is empty'), 'model-upload').matched).toBe(false);
  });

  it('copes with anything that can be thrown', () => {
    for (const thrown of [undefined, null, 42, { message: 7 }, { message: 'boom' }, 'boom']) {
      expect(map(thrown, 'texture-add').text).toBe('Something went wrong. Try again.');
    }
    expect(rawMessage({ message: 'boom' })).toBe('boom');
    expect(rawMessage(undefined)).toBe('undefined');
  });

  it('logs the raw error to console.error by default, with the call site', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const err = new Error('Could not load model (x.glb): Unexpected token'); // uploads.ts:130
    friendlyError(err, 'model-upload');
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith('[model-upload]', err);
  });

  it('accepts the call site as a plain string or as a context object', () => {
    const log = vi.fn();
    const err = new Error('Texture must be PNG, JPEG, or WebP'); // uploads.ts:189
    expect(friendlyError(err, { where: 'texture-add', log }).id).toBe('textureMessages.wrongType');
    expect(log).toHaveBeenCalledWith('[texture-add]', err);
  });

  it('keeps team vocabulary and raw detail out of every mapped message', async () => {
    const TEAM_WORDS =
      /(SoT|SoR|MVP|\bstub\b|ingress|candidates|fixture|Polyfork|material_slot_id|\bmock\b|COLOR_0|normalizeRoomGraph|Unknown \/ not in public|\(s\))/i;
    const engineErrors: Array<[unknown, ErrorWhere]> = [
      [await thrownBy(() => parseCandidatesPayload({ schema_version: 1 })), 'plan-import'],
      [await thrownBy(() => parseProjectJson({ schema_version: 1, room_graph: {} })), 'project-import'],
      [await thrownBy(() => resolveModuleAsset({ a: 1 })), 'pack-load'],
      [await thrownBy(() => createProductFromModelFiles([new File(['[1]'], 'a.slots.json'), new File([TRIANGLE], 'a.obj')], OPTS)), 'model-upload'],
      [new Error('Fallback COLOR_0 remap failed in normalizeRoomGraph'), 'pack-load'],
    ];
    for (const [err, where] of engineErrors) expect(map(err, where).text).not.toMatch(TEAM_WORDS);
  });
});

// -------------------------------------------------------------------------------------------------
describe('slotWarnings (deck §4.D)', () => {
  const report: SlotReport = {
    bound: [],
    missingInModel: ['handles'],
    unknownInModel: ['armrest'],
    untaggedMeshes: ['Mesh_12'],
    meshesNormalsComputed: ['Seat'],
    meshesWithoutUv: ['Seat', 'Leg'],
  };
  const product: Pick<Product, 'slotTagging' | 'preserveMaterials' | 'pack'> = {
    slotTagging: 'obj-usemtl (top, legs)',
    preserveMaterials: true,
    pack: {
      hasMjs: true,
      hasGlb: true,
      completeness: 'complete',
      mappingMode: 'slots',
      exportKeys: [],
      materialKeys: ['cover', 'gold', 'ink'],
      mappedKeys: ['cover', 'gold'],
      unknownKeys: ['ink'],
      notes: ['Pack complete: paired .glb + .mjs.', 'Unknown (not invented as slot ids): ink. GLB meshes: book.'],
      paramKeys: [],
    },
  };

  it('returns the eight deck lines in order, as { text, critical }', () => {
    const lines = slotWarnings(report, product, { slotLabel: (id) => (id === 'handles' ? 'Handles' : id) });
    expect(lines.map((l) => l.text)).toEqual([
      "These parts can't be changed because the model doesn't label them: Handles.",
      "Ignored: the model has parts the catalog doesn't list (armrest).",
      'Unlabeled parts keep a plain placeholder look: Mesh_12.',
      'Fixed missing shading data on Seat. Re-export with normals for best quality.',
      'Seat, Leg have no UV mapping, so textures will look flat or wrong. Re-export with UVs.',
      'Converted from OBJ. Colors from the .mtl are approximate. Library swatches take priority.',
      "This model keeps its own materials, so library swatches won't change it.",
      "Couldn't match these colors to the model: ink.",
    ]);
    expect(lines.map((l) => l.critical)).toEqual([false, false, false, false, false, false, false, true]);
    // The raw pack notes are not repeated as warnings (they move to packSummary().details).
    expect(lines.some((l) => /Pack complete|not invented/.test(l.text))).toBe(false);
  });

  it('never decides "critical" from the words: today\'s regex would get both of these wrong', () => {
    const OLD = /unknown|incomplete/i; // main.ts:1068
    const rewritten = slotWarnings(report, product).at(-1)!;
    expect(OLD.test(rewritten.text)).toBe(false); // the rewritten string lost the trigger words
    expect(rewritten.critical).toBe(true); // and is still critical
    const named = slotWarnings({ ...report, untaggedMeshes: ['unknown_incomplete_mesh'] }, {});
    const untagged = named.find((l) => l.id === 'slotWarnings.untagged')!;
    expect(OLD.test(untagged.text)).toBe(true); // a mesh name trips the old regex
    expect(untagged.critical).toBe(false); // but this warning is not critical
  });

  it('follows the conditions of renderWarnings', () => {
    const empty: SlotReport = { bound: [], missingInModel: [], unknownInModel: [], untaggedMeshes: [] };
    expect(slotWarnings(empty, {})).toEqual([]);
    // One mesh without UVs uses the singular the deck gives.
    expect(slotWarnings({ ...empty, meshesWithoutUv: ['x'] }, {})[0]!.text).toBe(
      'x has no UV mapping, so textures will look flat or wrong. Re-export with UVs.',
    );
    // main.ts:1062: the "couldn't match" line is not shown in the vertex-colour fallback mode.
    const fallbackPack = { mappingMode: 'vertex-colors', unknownKeys: ['cover'] };
    expect(slotWarnings(empty, { pack: fallbackPack })).toEqual([]);
    // Slot ids are used as they are when the host gives no labels.
    expect(slotWarnings({ ...empty, missingInModel: ['frame', 'pillow'] }, {})[0]!.text).toBe(
      "These parts can't be changed because the model doesn't label them: frame, pillow.",
    );
  });
});

// -------------------------------------------------------------------------------------------------
describe('pack summaries by mapping mode (deck §4.C)', () => {
  const packMeta = (extra: Record<string, unknown> = {}) =>
    resolveModulePackMeta({
      createAsset: () => new Group(),
      materials: { cover: { kind: 'leather' }, gold: { kind: 'metal' } },
      params: {
        cover: { type: 'color', default: '#163c23' },
        gold: { type: 'color', default: '#d9c56e' },
      },
      ...extra,
    });

  /** One triangle per colour, as in unit/packs.test.ts. */
  function vertexColorRoot(colors: string[]): Group {
    const positions: number[] = [];
    const rgb: number[] = [];
    colors.forEach((hex, i) => {
      positions.push(i * 2, 0, 0, i * 2 + 1, 0, 0, i * 2, 1, 0);
      const c = new Color(hex);
      for (let v = 0; v < 3; v++) rgb.push(c.r, c.g, c.b);
    });
    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
    geo.setAttribute('color', new BufferAttribute(new Float32Array(rgb), 3));
    const mesh = new Mesh(geo, new MeshStandardMaterial({ vertexColors: true }));
    mesh.name = 'book';
    const root = new Group();
    root.add(mesh);
    return root;
  }

  it('split: zones found in the vertex colours', () => {
    const status = buildPackStatus('complete', inferPackMapping(packMeta(), vertexColorRoot(['#163c23', '#d9c56e'])));
    expect(status.mappingMode).toBe('slots');
    const summary = packSummary(status);
    expect(summary.mode).toBe('split');
    expect(summary.text).toBe(
      "Colors apply to the pack's zones. Options marked (rebuilds model) rebuild it from the pack's code.",
    );
    expect(summary.critical).toBe(false);
    expect(summary.details).toEqual(status.notes); // the raw notes, for the collapsed Details
    expect(summary.details.join(' ')).toMatch(/COLOR_0/);
    expect(summary.text).not.toMatch(/COLOR_0|createAsset|material_slot/);
  });

  it('slots: mesh names match the pack keys', () => {
    const root = new Group();
    for (const name of ['cover', 'gold']) {
      const mesh = new Mesh(new BufferGeometry(), new MeshStandardMaterial());
      mesh.name = name;
      root.add(mesh);
    }
    const status = buildPackStatus('complete', inferPackMapping(packMeta(), root));
    expect(packPanelMode(status)).toBe('slots');
    expect(packSummary(status)).toMatchObject({
      text: "Colors apply to matching parts. Options marked (rebuilds model) rebuild it from the pack's code.",
      critical: false,
    });
  });

  it('fallback: vertex colours that match no zone', () => {
    const status = buildPackStatus('complete', inferPackMapping(packMeta(), vertexColorRoot(['#e61919'])));
    expect(status.mappingMode).toBe('vertex-colors');
    expect(packSummary(status)).toMatchObject({
      mode: 'fallback',
      text: "Basic mode: colorways recolor the whole model. Swatches won't work for this pack.",
      critical: false,
    });
  });

  it('unknown: nothing to match on, critical', () => {
    const root = new Group();
    root.add(new Mesh(new BufferGeometry(), new MeshStandardMaterial()));
    const status = buildPackStatus('complete', inferPackMapping(packMeta(), root));
    expect(status.mappingMode).toBe('unknown');
    expect(packSummary(status)).toMatchObject({
      mode: 'unknown',
      text: "This pack's colors couldn't be matched to the model, so color options may not change it. Options marked (rebuilds model) still work.",
      critical: true,
    });
  });

  it('an incomplete pack (no .glb) is critical, and the status line says what to do', () => {
    const status = buildPackStatus('mjs-only', inferPackMapping(packMeta(), null));
    expect(status.notes[0]).toBe('Pack incomplete: GLB missing — fallback to createAsset() mesh.');
    expect(packSummary(status).critical).toBe(true);
    expect(packStatusMessage({ name: 'core-rulebook', glbName: null, status })).toEqual({
      id: 'packMessages.packIncomplete',
      text: 'Loaded “core-rulebook” without a .glb, so you see a basic version. Add the .glb to complete the pack.',
      critical: true,
    });
  });

  it('a complete pack status line', () => {
    const status = buildPackStatus('complete', inferPackMapping(packMeta(), vertexColorRoot(['#163c23', '#d9c56e'])));
    expect(packStatusMessage({ name: 'core-rulebook', glbName: 'core-rulebook.glb', status })).toEqual({
      id: 'packMessages.packLoaded',
      text: 'Loaded pack “core-rulebook” with “core-rulebook.glb”.',
      critical: false,
    });
  });
});

// -------------------------------------------------------------------------------------------------
describe('soft overlap warning (deck §4.F "Placed, overlap")', () => {
  function roomWithChairAtEastWall() {
    let g = createRectangularRoom({ length: 5, width: 4, ceilingHeight: 2.7 });
    g = addPlacement(g, {
      sku_id: 'STUB',
      asset_ref: 'x',
      product_id: 'chair-lounge',
      position: { x: 2.3, y: 0, z: 0 },
      rotation_y: 0,
      scale: 1,
      slot_bindings: {},
    });
    return g;
  }

  it('turns the engine report into the deck sentence', () => {
    const g = roomWithChairAtEastWall();
    const report = checkPlacementCollision(g, footprintFromPlacement(g.placements[0]!, { sx: 1, sz: 1 }), {
      ignorePlacementId: 'the new one',
    });
    expect(formatCollisionWarn(report)).toBe('Soft overlap warning (placement allowed): furniture (chair-lounge), wall');
    const msg = placedMessage('Side table (demo)', report, () => 'Lounge chair (demo) 1');
    expect(msg.text).toBe(
      'Placed “Side table (demo)”. It overlaps a wall and “Lounge chair (demo) 1”. You can leave it, or delete it from the list below.',
    );
    expect(msg.overlap).toBe(true);
    expect(msg.text).not.toMatch(/Soft overlap|furniture|placement allowed/);
    expect(movedOverlapMessage('Side table (demo) 1', report, () => 'Lounge chair (demo) 1')).toBe(
      '“Side table (demo) 1” overlaps a wall and “Lounge chair (demo) 1”. You can leave it, or move it again.',
    );
  });

  it('says "Placed" alone when nothing overlaps', () => {
    const g = createRectangularRoom({ length: 5, width: 4, ceilingHeight: 2.7 });
    const report = checkPlacementCollision(g, { minX: -0.3, maxX: 0.3, minZ: -0.3, maxZ: 0.3 });
    expect(report.ok).toBe(true);
    expect(placedMessage('Lounge chair (demo)', report)).toEqual({
      id: 'roomMessages.placed',
      text: 'Placed “Lounge chair (demo)”.',
      overlap: false,
    });
    expect(overlapList(report)).toBeNull();
    expect(movedOverlapMessage('x', report)).toBeNull();
  });

  it('lists several things the deck way: no serial comma, each name once', () => {
    const overlaps = [
      { kind: 'wall', id: 'w1', label: 'wall w1' },
      { kind: 'wall', id: 'w2', label: 'wall w2' },
      { kind: 'furniture', id: 'p1', label: 'chair' },
      { kind: 'furniture', id: 'p2', label: 'table' },
      { kind: 'furniture', id: 'p3', label: 'table' },
    ];
    expect(overlapList({ ok: false, overlaps })).toBe('a wall, “chair” and “table”');
    expect(overlapList({ ok: false, overlaps: overlaps.slice(2, 3) })).toBe('“chair”');
  });
});

// -------------------------------------------------------------------------------------------------
describe('the ".mjs runs code" confirmation (deck §5)', () => {
  it('assembles the deck wording from the scan', () => {
    const clean = mjsConfirmContent(scanMjsSource('export function createAsset() {}'), 'x.mjs');
    expect(clean).toEqual({
      title: 'Run code from “x.mjs”?',
      body: 'An .mjs file is a program, not a model. It runs in this page and can do anything the page can. Only continue if you trust where it came from.',
      bodyParts: [copy.confirm.loadMjs.body],
      confirmLabel: 'Load and run',
      cancelLabel: "Don't load",
    });

    const risky = mjsConfirmContent(scanMjsSource('fetch("/x"); localStorage.getItem("a")'), 'x.mjs');
    expect(risky.bodyParts).toEqual([
      copy.confirm.loadMjs.body,
      'A quick scan flagged: localStorage, fetch(. These are unusual for a furniture pack.',
      "This file doesn't look like a furniture pack.",
    ]);
    expect(risky.body).toBe(risky.bodyParts.join(' '));
  });

  it('splits an engine guard message into a title and a body', () => {
    const message = formatMjsGuardMessage(scanMjsSource('fetch("/x")'), 'x.mjs');
    const { title, body } = splitGuardMessage(message);
    expect(title).toBe(message.split('\n')[0]);
    expect(title).toContain('“x.mjs”');
    expect(body).not.toContain('\n');
    expect(body).toContain('fetch(');
    expect(splitGuardMessage('Only a title')).toEqual({ title: 'Only a title', body: '' });
  });
});

// =================================================================================================
// TO RECONCILE AFTER MERGE
// The three engine changes below were being written in parallel with this file. Each block passes
// with the engine as it was (wave 0) and is meant to keep passing once the change lands. If one
// fails after the merge, the engine's new message is not recognised: adjust the rule it names in
// src/errors.ts.
// =================================================================================================

describe('to reconcile after merge: room size names the field (Copy Phase 4 item 5)', () => {
  const FALLBACK = 'Length, width, ceiling and wall thickness all need to be above 0.';
  const good = { length: 5, width: 4, ceilingHeight: 2.7, wallThickness: 0.12 };
  const fields = [
    ['length', 'Length'],
    ['width', 'Width'],
    ['ceilingHeight', 'Ceiling height'],
    ['wallThickness', 'Wall thickness'],
  ] as const;

  it('maps whatever createRectangularRoom throws today to the fallback or to the field sentence', async () => {
    for (const [field, label] of fields) {
      const err = await thrownBy(() => createRectangularRoom({ ...good, [field]: 0 }));
      const msg = map(err, 'room-create');
      expect(msg.matched, `engine message not recognised: ${rawMessage(err)}`).toBe(true);
      expect([FALLBACK, `${label} needs a number above 0.`]).toContain(msg.text);
      expect(msg.critical).toBe(false);
    }
  });

  it('the current message (roomGraph.ts:199) gives the fallback, or the field when the host knows it', () => {
    const err = new Error('Room size must be positive (length, width, ceiling height, wall thickness)');
    expect(map(err, 'room-create').text).toBe(FALLBACK);
    const msg = map(err, 'room-create', { field: 'wallThickness' });
    expect(msg.text).toBe('Wall thickness needs a number above 0.');
    expect(msg.segments).toEqual([
      { text: 'Wall thickness', strong: true },
      { text: ' needs a number above 0.', strong: false },
    ]);
  });

  it('recognises the shapes the engine change is likely to take (assumed, not yet real)', () => {
    for (const [field, label] of fields) {
      const withProperty = Object.assign(new Error('Room size is invalid'), { field });
      expect(map(withProperty, 'room-create').text).toBe(`${label} needs a number above 0.`);
    }
    expect(map(new Error('Room length must be positive'), 'room-create').text).toBe('Length needs a number above 0.');
    expect(map(new Error('Ceiling height must be greater than 0'), 'room-create').text).toBe(
      'Ceiling height needs a number above 0.',
    );
    expect(map(new Error('Room size must be positive: wall thickness'), 'room-create').text).toBe(
      'Wall thickness needs a number above 0.',
    );
    // Two fields named: no single field to blame.
    expect(map(new Error('Length and width must be positive'), 'room-create').text).toBe(FALLBACK);
  });
});

describe('to reconcile after merge: the .mjs guard message (Copy Phase 4 item 4)', () => {
  it('once the engine speaks the deck wording, it says the same as mjsConfirmContent', () => {
    const squash = (s: string) => s.replace(/\s+/g, ' ').trim();
    for (const source of ['export function createAsset() {}', 'fetch("/x"); localStorage.getItem("a")']) {
      const scan = scanMjsSource(source);
      const engine = splitGuardMessage(formatMjsGuardMessage(scan, 'x.mjs'));
      const deck = mjsConfirmContent(scan, 'x.mjs');
      if (!engine.title.startsWith('Run code from')) {
        // Wave 0 engine (mjsGuardrails.ts:51-64): still the old wording. Nothing to compare yet.
        expect(engine.title).toBe('Load trusted .mjs module “x.mjs”?');
        continue;
      }
      expect(engine.title).toBe(deck.title);
      expect(squash(engine.body)).toBe(squash(deck.body));
    }
  });
});

describe('to reconcile after merge: plan files that are rejected (Copy Phase 4 item 6)', () => {
  const WRONG_TYPE = "“plan.ifc” isn't a plan format we can use. Try PNG, JPG, WebP, DWG, DXF or JSON.";
  const NOT_A_DWG = "This doesn't look like a DWG file, so nothing was imported.";

  it('if startImportJob rejects an .ifc, the message is the deck sentence', async () => {
    let err: unknown = null;
    try {
      const job = await startImportJob(new File([new Uint8Array([1, 2, 3])], 'plan.ifc'));
      URL.revokeObjectURL(job.source.uri);
    } catch (e) {
      err = e;
    }
    if (err === null) return; // wave 0 engine: the file gets the sample result, there is no error to map
    expect(map(err, 'plan-import', { fileName: 'plan.ifc' }).text).toBe(WRONG_TYPE);
  });

  it('if startImportJob rejects random bytes named .dwg, the message is the deck sentence', async () => {
    let err: unknown = null;
    try {
      const job = await startImportJob(new File([new Uint8Array([9, 8, 7, 6, 5, 4])], 'plan.dwg'));
      URL.revokeObjectURL(job.source.uri);
    } catch (e) {
      err = e;
    }
    if (err === null) return; // wave 0 engine: accepted, see above
    expect(map(err, 'plan-import', { fileName: 'plan.dwg' }).text).toBe(NOT_A_DWG);
  });

  it('recognises the wording the rejection is likely to use (assumed, not yet real)', () => {
    const ctx = { fileName: 'plan.ifc' };
    expect(map(new Error('Unsupported plan file type: .ifc'), 'plan-import', ctx).text).toBe(WRONG_TYPE);
    expect(map(new Error('Plan format not supported'), 'plan-import', ctx).text).toBe(WRONG_TYPE);
    expect(map(new Error('Unsupported plan file “plan.ifc”'), 'plan-import').text).toBe(WRONG_TYPE);
    expect(map(new Error('Not a DWG file (missing AC10 signature)'), 'plan-import', ctx).text).toBe(NOT_A_DWG);
    expect(map(new Error('File is not a valid DWG'), 'plan-import', ctx)).toMatchObject({ text: NOT_A_DWG, critical: true });
    // The same words anywhere else are not plan errors.
    expect(map(new Error('Unsupported plan file type: .ifc'), 'texture-add', ctx).matched).toBe(false);
    // Today's JSON message also starts with "Unsupported" and must keep its own sentence.
    expect(map(new Error('Unsupported candidates schema_version (expect 1)'), 'plan-import', ctx).id).toBe(
      'planMessages.badJson',
    );
  });
});

// A compile-time check that the real engine types fit the structural inputs of the mappers.
describe('engine types fit the mapper inputs', () => {
  it('accepts a real Product and plural/fmt results', () => {
    const product = { slotTagging: 'gltf-extras', slots: [], id: 'p', sku: 's', name: 'n', glb: 'g' } satisfies Product;
    const none: SlotReport = { bound: [], missingInModel: [], unknownInModel: [], untaggedMeshes: [] };
    expect(slotWarnings(none, product)).toEqual([]);
    expect(fmt(plural(2, copy.modelMessages.partCount), {})).toBe('2 parts');
  });
});
