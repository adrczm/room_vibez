/**
 * From what the engine says to what people read (Copy Phase 3; deck §4 and §5).
 *
 * The engine's messages in `src/viewer/**` stay as they are (unit tests pin several). The host
 * calls the pure functions here instead of showing `err.message`:
 *
 *   friendlyError(err, ctx)        a thrown error            -> { text, segments, critical, ... }
 *   createUploadEscalation()       the 1st / 2nd / 3rd wording for repeated unreadable models
 *   slotWarnings(report, product)  the lines under the Materials card -> { text, critical }[]
 *   packSummary(status)            the pack panel note by mapping mode, raw notes as details
 *   packStatusMessage(...)         the pack status line (loaded / incomplete)
 *   friendlyObjNote(note)          one OBJ import note
 *   overlapList / placedMessage / movedOverlapMessage   the soft overlap warning
 *   mjsConfirmContent / splitGuardMessage               the ".mjs runs code" confirmation
 *
 * Every string comes from `src/copy.ts`. Nothing here touches the DOM, so it runs in node tests.
 *
 * THE `critical` FLAG. It never depends on the wording (deck §4.D: the old regex on the message
 * text would silently stop matching the rewritten strings). The handoffs do not say which errors
 * are "task-blocking" (QA-17), so this file uses one rule, set per row and easy to change:
 *   critical = false   the app is waiting for a different choice or input: nothing chosen, a
 *                      file type it does not take, a number that is not above 0, a click on the
 *                      wrong surface, too few walls included, .mjs loading switched off.
 *   critical = true    a file was read and found unusable, or the app could not do the job:
 *                      unreadable or invalid model, pack, plan or project, a failed conversion,
 *                      a failed placement or export, the viewer not starting, and anything
 *                      unrecognised.
 * A cancelled action is neither: `neutral` is true and the host shows it without error styling.
 */
import { copy, fmt, plural, rich, type RichSegment } from './copy';

// ---------------------------------------------------------------------------------------------
// friendlyError
// ---------------------------------------------------------------------------------------------

/** Where the error was caught. One value per `catch` in `main.ts` (function names as of wave 0). */
export type ErrorWhere =
  | 'boot' //            boot().catch
  | 'product-load' //    viewer onStatus('error', detail): the stage overlay
  | 'model-upload' //    onModelFilesSelected
  | 'texture-add' //     onAddTexture, swatch clicks
  | 'pack-load' //       onPackFilesSelected
  | 'module-load' //     onModuleFileSelected
  | 'plan-import' //     onStartImport
  | 'plan-image' //      onStartUnderlay, onUnderlayConfirm
  | 'plan-scale' //      onApplyImportScale
  | 'plan-confirm' //    onImportStartEditing, onImportSaveTemplate
  | 'template-use' //    renderTemplateList, "Use template"
  | 'template-save' //   onSaveTemplateFromScratch
  | 'room-create' //     onCreateRoom
  | 'opening-add' //     onRoomPointer, opening tool
  | 'draw-walls' //      onRoomPointer, closing a drawn room
  | 'place' //           placeCurrentProduct
  | 'plan-png' //        onDownloadPlanPng
  | 'project-import'; // onImportProjectFile

/** The four size fields of the "From scratch" form. */
export type RoomSizeField = 'length' | 'width' | 'ceilingHeight' | 'wallThickness';

export interface ErrorContext {
  where: ErrorWhere;
  /** Name of the product or template the action was about. Needed by the place messages. */
  name?: string;
  /** Name of the file the user chose. Wins over a file name found in the engine message. */
  fileName?: string;
  /**
   * Which consecutive "unreadable model" failure this is, starting at 1 (deck §4.A). Leave it
   * out for the first wording, or let `createUploadEscalation()` keep count.
   */
  attempt?: number;
  /** The size field that failed, when the host knows it. */
  field?: RoomSizeField;
  /** Where the raw error is logged. Defaults to `console.error`. */
  log?: (...args: unknown[]) => void;
}

export interface FriendlyMessage {
  /** The message as plain text: safe for textContent, `title` and `aria-label`. */
  text: string;
  /** The same message with the deck's bold runs marked, for building DOM nodes. */
  segments: RichSegment[];
  /** True for task-blocking errors: `.warning.critical` and `role="alert"` (QA-17). */
  critical: boolean;
  /** True when this is not an error at all (the user cancelled). No error styling. */
  neutral: boolean;
  /** Key of the string that was chosen, for example "modelMessages.unreadable". */
  id: string;
  /** False when nothing matched and the generic fallback was used. */
  matched: boolean;
}

interface Outcome {
  id: string;
  template: string;
  vars?: Record<string, string | number>;
  critical: boolean;
  neutral?: boolean;
}

interface Rule {
  re: RegExp;
  /** Limit the rule to these call sites. Without it the rule applies everywhere. */
  where?: readonly ErrorWhere[];
  /** Return null when the rule cannot produce its message (for example no file name). */
  make: (m: RegExpExecArray, ctx: ErrorContext, err: unknown) => Outcome | null;
}

const C = copy;

/** The raw text of anything that was thrown. */
export function rawMessage(err: unknown): string {
  if (typeof err === 'string') return err;
  if (err && typeof err === 'object' && 'message' in err && typeof err.message === 'string') {
    return err.message;
  }
  return String(err);
}

function errorName(err: unknown): string {
  return err && typeof err === 'object' && 'name' in err && typeof err.name === 'string' ? err.name : '';
}

const say = (id: string, template: string, critical: boolean, vars?: Outcome['vars']): Outcome => ({
  id,
  template,
  vars,
  critical,
});

// ----- Room size: which field failed ----------------------------------------------------------

const SIZE_FIELD_ALIASES: Record<string, RoomSizeField> = {
  length: 'length',
  roomlength: 'length',
  width: 'width',
  roomwidth: 'width',
  ceiling: 'ceilingHeight',
  ceilingheight: 'ceilingHeight',
  wallthickness: 'wallThickness',
  thickness: 'wallThickness',
};

const SIZE_FIELD_WORDS: ReadonlyArray<readonly [RegExp, RoomSizeField]> = [
  [/\blength\b/i, 'length'],
  [/\bwidth\b/i, 'width'],
  [/\bceiling\b/i, 'ceilingHeight'],
  [/\bthickness\b/i, 'wallThickness'],
];

/** Reads like "this number has to be above 0", whatever the exact words. */
const SIZE_COMPLAINT = /must be positive|must be (?:greater|more) than (?:0|zero)|must be above 0|above 0|greater than 0|> ?0|needs a number/i;

/** A `field` property on the error, in any of the spellings above. */
function fieldOnError(err: unknown): RoomSizeField | null {
  if (err && typeof err === 'object' && 'field' in err && typeof err.field === 'string') {
    return SIZE_FIELD_ALIASES[err.field.toLowerCase().replace(/[^a-z]/g, '')] ?? null;
  }
  return null;
}

/** The host or the error itself says which field failed, whatever the message is. */
function hasSizeField(err: unknown, ctx: ErrorContext): boolean {
  return Boolean(ctx.field ?? fieldOnError(err));
}

/**
 * TO RECONCILE AFTER MERGE (Copy Phase 4 item 5). Today the engine throws one message for all
 * four fields. The engine change that names the field is being written in parallel, so this
 * accepts the three likely shapes: `ctx.field` from the host, a `field` property on the error,
 * or a message that names exactly one field.
 */
function roomSizeField(err: unknown, ctx: ErrorContext): RoomSizeField | null {
  const known = ctx.field ?? fieldOnError(err);
  if (known) return known;
  const message = rawMessage(err);
  const named = SIZE_FIELD_WORDS.filter(([re]) => re.test(message)).map(([, field]) => field);
  return named.length === 1 ? named[0]! : null;
}

function roomSizeOutcome(err: unknown, ctx: ErrorContext): Outcome {
  const field = roomSizeField(err, ctx);
  return field
    ? say('roomMessages.sizeInvalidField', C.roomMessages.sizeInvalidField, false, {
        field: C.roomMessages.sizeFields[field],
      })
    : say('roomMessages.sizeInvalid', C.roomMessages.sizeInvalid, false);
}

// ----- Small helpers for the rules ------------------------------------------------------------

function unreadableModel(file: string, attempt: number | undefined): Outcome {
  const n = attempt ?? 1;
  if (n >= 3) return say('modelMessages.unreadableThird', C.modelMessages.unreadableThird, true);
  if (n === 2) return say('modelMessages.unreadableSecond', C.modelMessages.unreadableSecond, true);
  return say('modelMessages.unreadable', C.modelMessages.unreadable, true, { file });
}

function notAPack(exportsText: string, err: unknown): Outcome {
  let keys: string[] | null = null;
  if (err && typeof err === 'object' && 'exportKeys' in err && Array.isArray(err.exportKeys)) {
    keys = err.exportKeys.map(String);
  }
  const list = keys ? keys.join(', ') : exportsText === '(none)' ? '' : exportsText;
  return list
    ? say('packMessages.notAPack', C.packMessages.notAPack, true, { exports: list })
    : say('packMessages.notAPackNoExports', C.packMessages.notAPackNoExports, true);
}

/** A quoted file name inside a message, for rules whose text needs one. */
function quotedFileName(message: string): string | null {
  const m = /[“"']([^“”"']+\.[A-Za-z0-9]+)[”"']/.exec(message);
  return m ? m[1]! : null;
}

function planWrongType(message: string, ctx: ErrorContext): Outcome | null {
  const file = ctx.fileName ?? quotedFileName(message);
  return file ? say('planMessages.wrongType', C.planMessages.wrongType, false, { file }) : null;
}

const PLAN_SITES = ['plan-import', 'plan-image'] as const;

// ----- The rules ------------------------------------------------------------------------------
// Each regex is anchored on the engine's current message: the "Today" column of deck §4. The
// comment gives the throw site. Order matters where one message wraps another.

const RULES: readonly Rule[] = [
  // ===== Deck §4.A  Adding a model =====
  // uploads.ts:90
  { re: /^No files selected$/, make: () => say('modelMessages.nothingChosen', C.modelMessages.nothingChosen, false) },
  // uploads.ts:96
  {
    re: /^Upload either an OBJ package or a GLB\/glTF — not both at once$/,
    make: () => say('modelMessages.bothKinds', C.modelMessages.bothKinds, false),
  },
  // uploads.ts:106
  {
    re: /^Select a \.glb, \.gltf, or \.obj file \(include \.mtl \+ textures with OBJ when available\)$/,
    make: () => say('modelMessages.wrongType', C.modelMessages.wrongType, false),
  },
  // uploads.ts:130  `Could not load model (${file}): ${parser text}`
  {
    re: /^Could not load model \((.+?)\): /,
    make: (m, ctx) => unreadableModel(ctx.fileName ?? m[1]!, ctx.attempt),
  },
  // objImport.ts:370
  { re: /^No \.obj file in selection$/, make: () => say('modelMessages.noObj', C.modelMessages.noObj, false) },
  // objImport.ts:371
  {
    re: /^Select one \.obj file \(plus its \.mtl \/ textures \/ \.slots\.json\)$/,
    make: () => say('modelMessages.severalObj', C.modelMessages.severalObj, false),
  },
  // objImport.ts:444, which reaches the host wrapped by :448 as "Could not parse OBJ (x.obj): OBJ file is empty"
  {
    re: /^(?:Could not parse OBJ \(.+?\): )?OBJ file is empty$/,
    make: () => say('modelMessages.emptyObj', C.modelMessages.emptyObj, true),
  },
  // objImport.ts:448
  {
    re: /^Could not parse OBJ \((.+?)\): /,
    make: (m, ctx) => say('modelMessages.badObj', C.modelMessages.badObj, true, { file: ctx.fileName ?? m[1]! }),
  },
  // objImport.ts:466
  {
    re: /^OBJ has no meshes: (.+)$/,
    make: (m, ctx) => say('modelMessages.noShapes', C.modelMessages.noShapes, true, { file: ctx.fileName ?? m[1]! }),
  },
  // objImport.ts:589
  {
    re: /^OBJ→GLB export failed: /,
    make: () => say('modelMessages.convertFailed', C.modelMessages.convertFailed, true),
  },
  // objImport.ts:256, which reaches the host wrapped by :264 as "Invalid sidecar JSON (x.slots.json): Sidecar must be ..."
  {
    re: /^(?:Invalid sidecar JSON \(.+?\): )?Sidecar must be a JSON object of name → material_slot_id$/,
    make: () => say('modelMessages.sidecarShape', C.modelMessages.sidecarShape, true),
  },
  // objImport.ts:264
  {
    re: /^Invalid sidecar JSON \((.+?)\): /,
    make: (m) => say('modelMessages.badSidecar', C.modelMessages.badSidecar, true, { file: m[1]! }),
  },

  // ===== Deck §4.B  Adding a texture =====
  // main.ts:1587 (host status text)
  { re: /^Choose an image first$/, make: () => say('textureMessages.noFile', C.textureMessages.noFile, false) },
  // uploads.ts:189 and :215
  {
    re: /^Texture must be PNG, JPEG, or WebP$/,
    make: () => say('textureMessages.wrongType', C.textureMessages.wrongType, false),
  },
  // main.ts:1609 (thrown by the host)
  { re: /^Select a target material$/, make: () => say('textureMessages.noTarget', C.textureMessages.noTarget, false) },

  // ===== Deck §4.C  Packs and .mjs =====
  // main.ts:1486 (thrown by the host)
  {
    re: /^Select a \.mjs file \(optionally with sibling \.glb\)$/,
    make: () => say('packMessages.noMjs', C.packMessages.noMjs, false),
  },
  // modules.ts:144
  { re: /^Select a \.mjs ES module file$/, make: () => say('packMessages.wrongType', C.packMessages.wrongType, false) },
  // modules.ts:148
  {
    re: /^MJS loading is disabled \(Catalog 3D → enable trusted \.mjs loads\)$/,
    make: () => say('packMessages.loadingOff', C.packMessages.loadingOff, false),
  },
  // modules.ts:157
  {
    re: /^MJS load cancelled by user$/,
    make: () => ({ ...say('packMessages.cancelled', C.packMessages.cancelled, false), neutral: true }),
  },
  // modules.ts:110-115 (ModuleContractError)
  {
    re: /^Module is not a mesh file and does not export createAsset\(\) \/ a default Object3D factory\. Exports: (.*?)\. Expected Polyfork-style: /,
    make: (m, _ctx, err) => notAPack(m[1]!, err),
  },
  // RoomVibezViewer.ts:278 (same condition as the host string at main.ts:1029)
  {
    re: /^This module keeps its own materials \(preserveMaterials\)\. Library swatches are display-only\.$/,
    make: () => say('packMessages.swatchBlocked', C.packMessages.swatchBlocked, false),
  },

  // ===== Deck §4.E  Importing a plan =====
  // dwgImport.ts:244; main.ts:1679 (host status text)
  {
    re: /^(?:No file provided|Choose a plan file, or use Load mock fixture\.)$/,
    make: () => say('planMessages.noFile', C.planMessages.noFile, false),
  },
  // planUnderlay.ts:59-61; main.ts:1688-1689 (host status text, same opening words)
  { re: /^PDF plan ingest needs a rasterizer /, make: () => say('planMessages.pdf', C.planMessages.pdf, false) },
  // planUnderlay.ts:64
  {
    re: /^Underlay accepts PNG \/ JPEG \/ WebP \(PDF blocked without rasterizer\)$/,
    make: (m, ctx) => planWrongType(m[0], ctx),
  },
  // dwgImport.ts:184, :186, :188
  {
    re: /^(?:Candidates payload must be a JSON object|Unsupported candidates schema_version \(expect 1\)|Candidates must include walls\[\] and rooms\[\])$/,
    make: () => say('planMessages.badJson', C.planMessages.badJson, true),
  },
  // planUnderlay.ts:94
  {
    re: /^Underlay width and depth must be positive meters$/,
    make: () => say('planMessages.imageSize', C.planMessages.imageSize, false),
  },
  // dwgImport.ts:326, :334
  {
    re: /^(?:Scale factor must be a positive number|Known length must be positive)$/,
    make: () => say('planMessages.scaleInvalid', C.planMessages.scaleInvalid, false),
  },
  // dwgImport.ts:333
  { re: /^No scale hint on this extract$/, make: () => say('planMessages.scaleNone', C.planMessages.scaleNone, false) },
  // dwgImport.ts:350
  {
    re: /^Accept at least 3 wall candidates before confirming$/,
    make: () => say('planMessages.tooFewWalls', C.planMessages.tooFewWalls, false),
  },
  // dwgImport.ts:354
  {
    re: /^Accept at least one room candidate before confirming$/,
    make: () => say('planMessages.noRoom', C.planMessages.noRoom, false),
  },
  // TO RECONCILE AFTER MERGE (Copy Phase 4 item 6). The engine does not reject these files yet;
  // the rejection is being written in parallel and its messages are not known. Until then these
  // two rules recognise the likely wording, at the plan call sites only.
  {
    where: PLAN_SITES,
    re: /\b(?:not|isn't|doesn't|invalid)\b.*\bDWG\b|\bDWG\b.*\b(?:not|invalid|signature|header|magic)\b/i,
    make: () => say('planMessages.notADwg', C.planMessages.notADwg, true),
  },
  {
    where: PLAN_SITES,
    re: /unsupported|not supported|isn't a plan format|unknown (?:plan |file )?(?:type|format)/i,
    make: (m, ctx) => planWrongType(m.input, ctx),
  },

  // ===== Deck §4.F  Room, saving and starting up =====
  // roomGraph.ts:199
  {
    re: /^Room size must be positive \(length, width, ceiling height, wall thickness\)$/,
    make: (_m, ctx, err) => roomSizeOutcome(err, ctx),
  },
  // TO RECONCILE AFTER MERGE (Copy Phase 4 item 5): the per-field error that replaces the one above.
  // Recognised by a `field` on the error (or in ctx), or by a message that reads like a size complaint.
  {
    where: ['room-create'],
    re: /^/,
    make: (m, ctx, err) =>
      hasSizeField(err, ctx) || SIZE_COMPLAINT.test(m.input) ? roomSizeOutcome(err, ctx) : null,
  },
  // freeformWalls.ts:90
  {
    re: /^Need at least 3 corners to close a room$/,
    make: () => say('roomMessages.drawTooFew', C.roomMessages.drawTooFew, false),
  },
  // freeformWalls.ts:110
  {
    re: /^Degenerate polygon — walls too short$/,
    make: () => say('roomMessages.drawTooShort', C.roomMessages.drawTooShort, false),
  },
  // roomGraph.ts:393  `Opening exceeds wall length (${formatLength(len, 'm')})`
  {
    re: /^Opening exceeds wall length \((.+)\)$/,
    make: (m) => say('roomMessages.openingTooWide', C.roomMessages.openingTooWide, false, { length: m[1]! }),
  },
  // roomGraph.ts:396
  {
    re: /^Opening exceeds wall height \((.+)\)$/,
    make: (m) => say('roomMessages.openingTooTall', C.roomMessages.openingTooTall, false, { height: m[1]! }),
  },
  // roomGraph.ts:390
  {
    re: /^Sill height cannot be negative$/,
    make: () => say('roomMessages.sillNegative', C.roomMessages.sillNegative, false),
  },
  // roomGraph.ts:389 (no deck row: see `notInDeck.openingSizeInvalid`)
  {
    re: /^Opening width and height must be positive$/,
    make: () => say('notInDeck.openingSizeInvalid', C.notInDeck.openingSizeInvalid, false),
  },
  // main.ts:857 (host status text)
  {
    re: /^Select a Catalog 3D product with a GLB \(or pack\) first\.$/,
    make: () => say('roomMessages.noModel', C.roomMessages.noModel, false),
  },
  // main.ts:906 (thrown by the host, shown as "Place failed: ..."); RoomVibezViewer.ts:749 is the engine's twin
  {
    where: ['place'],
    re: /^(?:Place failed: )?(?:Module factory not registered for this product|No createAsset factory registered for module product ".*")$/,
    make: (_m, ctx) =>
      ctx.name ? say('roomMessages.placeFailed', C.roomMessages.placeFailed, true, { name: ctx.name }) : null,
  },
  // roomPlan.ts:136, :143 (shown as "Plan export failed: ...")
  {
    re: /^(?:Plan export failed: )?(?:Failed to rasterize plan SVG|Canvas 2D unavailable)$/,
    make: () => say('roomMessages.planPngFailed', C.roomMessages.planPngFailed, true),
  },
  // projectIO.ts:43, :46, :49 (shown as "Import failed: ...")
  {
    re: /^(?:Import failed: )?(?:Invalid project JSON|Unsupported project schema_version \(expected \d+\)|room_graph failed normalizeRoomGraph)$/,
    make: () => say('roomMessages.importFailed', C.roomMessages.importFailed, true),
  },
  // main.ts:650 (host status text)
  { re: /^Create or load a room first\.$/, make: () => say('roomMessages.noRoomYet', C.roomMessages.noRoomYet, false) },
];

/** What a call site shows when no rule matched. Null means the generic fallback. */
function siteFallback(err: unknown, ctx: ErrorContext): Outcome | null {
  switch (ctx.where) {
    case 'boot':
      // Deck §3.2 "Overlay error: anything else".
      return say('topBarAndStage.overlayCouldntStart', C.topBarAndStage.overlayCouldntStart, true);
    case 'product-load':
      return say('notInDeck.overlayModelFailed', C.notInDeck.overlayModelFailed, true);
    case 'project-import':
      // Deck §4.F "Import failed" covers every way a project file can fail, JSON syntax included.
      return say('roomMessages.importFailed', C.roomMessages.importFailed, true);
    case 'plan-png':
      return say('roomMessages.planPngFailed', C.roomMessages.planPngFailed, true);
    case 'plan-import':
      // A .json plan that is not JSON at all fails in JSON.parse before the engine sees it.
      return errorName(err) === 'SyntaxError' ? say('planMessages.badJson', C.planMessages.badJson, true) : null;
    case 'place':
      return ctx.name
        ? say('notInDeck.placeFailedOther', C.notInDeck.placeFailedOther, true, { name: ctx.name })
        : null;
    default:
      return null;
  }
}

function choose(err: unknown, ctx: ErrorContext): Outcome | null {
  const message = rawMessage(err);
  // Deck §3.2: the same test `setStatus` uses today (main.ts:196), at the two overlay call sites.
  if ((ctx.where === 'boot' || ctx.where === 'product-load') && /webgl/i.test(message)) {
    return say('topBarAndStage.overlayNoWebgl', C.topBarAndStage.overlayNoWebgl, true);
  }
  for (const rule of RULES) {
    if (rule.where && !rule.where.includes(ctx.where)) continue;
    const m = rule.re.exec(message);
    if (!m) continue;
    const outcome = rule.make(m, ctx, err);
    if (outcome) return outcome;
  }
  return siteFallback(err, ctx);
}

/**
 * Turn anything a `catch` received into the deck's message for it.
 *
 *   } catch (err) {
 *     const msg = friendlyError(err, { where: 'model-upload' });
 *     status.textContent = msg.text;            // or build nodes from msg.segments
 *     status.classList.toggle('error', !msg.neutral);
 *   }
 *
 * The raw error goes to `console.error` (or `ctx.log`) and never into the visible text. When no
 * rule matches, the result is the generic "Something went wrong. Try again." with
 * `matched: false`. Call it once per error: it logs each time.
 */
export function friendlyError(err: unknown, ctx: ErrorWhere | ErrorContext): FriendlyMessage {
  const context: ErrorContext = typeof ctx === 'string' ? { where: ctx } : ctx;
  const outcome = choose(err, context);
  const final = outcome ?? say('notInDeck.genericError', C.notInDeck.genericError, true);
  if (!final.neutral) (context.log ?? console.error)(`[${context.where}]`, err);
  const segments = rich(final.template, final.vars ?? {});
  return {
    text: segments.map((s) => s.text).join(''),
    segments,
    critical: final.critical,
    neutral: final.neutral ?? false,
    id: final.id,
    matched: outcome !== null,
  };
}

/**
 * The escalating wording for repeated unreadable models (deck §4.A, Copy §7 item 6).
 * Keep one per session:
 *
 *   const uploadErrors = createUploadEscalation();
 *   ...catch (err) { const msg = uploadErrors.map(err); ... }
 *   ...on success:   uploadErrors.reset();
 *
 * The 1st unreadable file gets the message that names it, the 2nd "Still not readable. ...",
 * the 3rd and later "Still no luck. ...". Other upload errors do not move the count. Without
 * `reset()` the count runs for the whole session.
 */
export function createUploadEscalation(): {
  map(err: unknown, ctx?: Omit<ErrorContext, 'where' | 'attempt'>): FriendlyMessage;
  reset(): void;
} {
  let unreadable = 0;
  return {
    map(err, ctx = {}) {
      const result = friendlyError(err, { ...ctx, where: 'model-upload', attempt: unreadable + 1 });
      if (result.id.startsWith('modelMessages.unreadable')) unreadable += 1;
      return result;
    },
    reset() {
      unreadable = 0;
    },
  };
}

// ---------------------------------------------------------------------------------------------
// Slot warnings (deck §4.D)
// ---------------------------------------------------------------------------------------------

export interface SlotWarning {
  /** Key of the string, for example "slotWarnings.noUv". */
  id: string;
  text: string;
  /** Style with `.warning.critical`. Set from the kind of warning, never from its words. */
  critical: boolean;
}

/** The parts of the engine's `SlotReport` this needs. */
export interface SlotReportLike {
  missingInModel: readonly string[];
  unknownInModel: readonly string[];
  untaggedMeshes: readonly string[];
  meshesNormalsComputed?: readonly string[];
  meshesWithoutUv?: readonly string[];
}

/** The parts of the engine's `Product` this needs. */
export interface WarningProductLike {
  slotTagging?: string;
  preserveMaterials?: boolean;
  pack?: { mappingMode: string; unknownKeys: readonly string[] };
}

/**
 * The lines under the Materials card, in today's order (`renderWarnings` in `main.ts`).
 *
 * The raw pack notes that `renderWarnings` also printed are not returned: Copy Phase 3 replaces
 * them with `packSummary()`, which keeps them as collapsed details.
 *
 * Names are joined as text. Put `text` in the DOM with textContent: mesh and slot names come
 * from uploaded files.
 */
export function slotWarnings(
  report: SlotReportLike,
  product: WarningProductLike,
  opts?: { slotLabel?: (slotId: string) => string },
): SlotWarning[] {
  const W = C.slotWarnings;
  const list = (items: readonly string[]) => items.join(', ');
  const out: SlotWarning[] = [];
  if (report.missingInModel.length) {
    const parts = list(report.missingInModel.map((id) => opts?.slotLabel?.(id) ?? id));
    out.push({ id: 'slotWarnings.missingInModel', text: fmt(W.missingInModel, { parts }), critical: false });
  }
  if (report.unknownInModel.length) {
    out.push({
      id: 'slotWarnings.unknownInModel',
      text: fmt(W.unknownInModel, { parts: list(report.unknownInModel) }),
      critical: false,
    });
  }
  if (report.untaggedMeshes.length) {
    out.push({
      id: 'slotWarnings.untagged',
      text: fmt(W.untagged, { parts: list(report.untaggedMeshes) }),
      critical: false,
    });
  }
  if (report.meshesNormalsComputed?.length) {
    out.push({
      id: 'slotWarnings.normalsComputed',
      text: fmt(W.normalsComputed, { parts: list(report.meshesNormalsComputed) }),
      critical: false,
    });
  }
  if (report.meshesWithoutUv?.length) {
    out.push({
      id: 'slotWarnings.noUv',
      text: fmt(plural(report.meshesWithoutUv.length, W.noUv), { parts: list(report.meshesWithoutUv) }),
      critical: false,
    });
  }
  if (product.slotTagging?.startsWith('obj-')) {
    out.push({ id: 'slotWarnings.fromObj', text: W.fromObj, critical: false });
  }
  if (product.preserveMaterials) {
    out.push({ id: 'slotWarnings.keepsOwnMaterials', text: W.keepsOwnMaterials, critical: false });
  }
  if (product.pack && product.pack.unknownKeys.length && product.pack.mappingMode !== 'vertex-colors') {
    out.push({
      id: 'slotWarnings.colorsNotMatched',
      text: fmt(W.colorsNotMatched, { keys: list(product.pack.unknownKeys) }),
      critical: true,
    });
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Packs (deck §4.C)
// ---------------------------------------------------------------------------------------------

/** The four panel notes of deck §4.C. */
export type PackPanelMode = 'split' | 'slots' | 'fallback' | 'unknown';

/** The parts of the engine's `PackStatus` this needs. */
export interface PackStatusLike {
  /** 'slots' | 'vertex-colors' | 'unknown'. */
  mappingMode: string;
  /** 'complete' | 'mjs-only' | 'glb-only'. */
  completeness?: string;
  notes?: readonly string[];
}

/**
 * Which of the four notes applies. Same decision as `renderPackParams` makes today: the engine
 * has three mapping modes, and "split" is the 'slots' mode when its notes record a zone split.
 */
export function packPanelMode(status: PackStatusLike): PackPanelMode {
  if (status.mappingMode === 'vertex-colors') return 'fallback';
  if (status.mappingMode === 'slots') {
    return status.notes?.some((n) => /COLOR_0 zone split/i.test(n)) ? 'split' : 'slots';
  }
  return 'unknown';
}

/**
 * The pack panel note, with the raw engine notes kept for a collapsed "Details" block
 * (`copy.notInDeck.packDetails`). `critical` is true for the two cases the deck keeps critical:
 * colours that could not be matched, and an incomplete pack.
 */
export function packSummary(status: PackStatusLike): {
  mode: PackPanelMode;
  text: string;
  critical: boolean;
  details: string[];
} {
  const mode = packPanelMode(status);
  return {
    mode,
    text: C.packMessages.panelNote[mode],
    critical: mode === 'unknown' || status.completeness === 'mjs-only',
    details: [...(status.notes ?? [])],
  };
}

/**
 * The pack status line after loading: "Loaded pack “X” with “x.glb”." or, without a .glb,
 * "Loaded “X” without a .glb, ...". `critical` follows today's rule for the error style
 * (`main.ts:1465`): no .glb, or colours that could not be matched.
 */
export function packStatusMessage(input: {
  name: string;
  glbName?: string | null;
  status: PackStatusLike;
}): { id: string; text: string; critical: boolean } {
  const incomplete = !input.glbName || input.status.completeness === 'mjs-only';
  const critical = incomplete || input.status.mappingMode === 'unknown';
  return incomplete
    ? {
        id: 'packMessages.packIncomplete',
        text: fmt(C.packMessages.packIncomplete, { name: input.name }),
        critical,
      }
    : {
        id: 'packMessages.packLoaded',
        text: fmt(C.packMessages.packLoaded, { name: input.name, file: input.glbName! }),
        critical,
      };
}

// ---------------------------------------------------------------------------------------------
// OBJ notes (deck §4.A, the "OBJ note" rows)
// ---------------------------------------------------------------------------------------------

/**
 * Translate one entry of `ObjImportWarnings.notes`. Returns null for a note with no deck
 * wording ("Slots from sidecar only (n)" and anything unrecognised): show nothing for those.
 */
export function friendlyObjNote(note: string): string | null {
  const M = C.modelMessages;
  let m: RegExpExecArray | null;
  // objImport.ts:435
  if (/^No \.mtl in selection — /.test(note)) return M.objNoteNoMtl;
  // objImport.ts:431
  if (/^MTL failed to parse — /.test(note)) return M.objNoteMtlBroken;
  // objImport.ts:479
  if ((m = /^MTL references missing textures \(not in upload\): (.+)$/.exec(note))) {
    return fmt(M.objNoteTexturesMissing, { files: m[1]! });
  }
  // objImport.ts:539
  if (/^No usemtl \/ named groups \/ sidecar — bound whole model to surface slot$/.test(note)) {
    return M.objNoteOnePart;
  }
  // objImport.ts:543
  if ((m = /^Slots from usemtl\/groups(?: \+ sidecar)?: (.+)$/.exec(note))) {
    return fmt(M.objNotePartsFound, { parts: m[1]! });
  }
  // objImport.ts:474. No "OBJ note" row; the same fact has a slot-warning row in deck §4.D.
  if ((m = /^Meshes without UVs — textured library materials will look flat: (.+)$/.exec(note))) {
    const names = m[1]!;
    const count = names.endsWith('…') ? 2 : names.split(', ').length;
    return fmt(plural(count, C.slotWarnings.noUv), { parts: names });
  }
  return null;
}

// ---------------------------------------------------------------------------------------------
// Soft overlap warning (deck §4.F "Placed, overlap")
// ---------------------------------------------------------------------------------------------

/** The parts of the engine's `CollisionReport` this needs. */
export interface CollisionReportLike {
  ok: boolean;
  overlaps: ReadonlyArray<{ kind: string; id: string; label: string }>;
}

// The deck writes lists without a serial comma ("a wall, “Y” and “Z”"), which is what the
// en-GB list rules give. The words themselves stay as in `copy`.
const overlapListFormat = new Intl.ListFormat('en-GB', { style: 'long', type: 'conjunction' });

/**
 * "a wall and “Lounge chair 1”": what a product overlaps, or null when it overlaps nothing.
 * `productName` turns an overlapped placement into the name people see (the row name in the
 * Products list). Without it the engine's label is used, which is a product id.
 */
export function overlapList(
  report: CollisionReportLike,
  productName?: (hit: { id: string; label: string }) => string,
): string | null {
  if (report.ok || report.overlaps.length === 0) return null;
  const items: string[] = [];
  if (report.overlaps.some((o) => o.kind === 'wall')) items.push(C.roomMessages.overlapWall);
  for (const o of report.overlaps) {
    if (o.kind === 'wall') continue;
    const item = fmt(C.roomMessages.overlapProduct, { name: productName ? productName(o) : o.label });
    if (!items.includes(item)) items.push(item);
  }
  return overlapListFormat.format(items);
}

/** The status after placing: "Placed “X”." or the overlap warning. Overlaps warn, never block. */
export function placedMessage(
  name: string,
  report: CollisionReportLike,
  productName?: (hit: { id: string; label: string }) => string,
): { id: string; text: string; overlap: boolean } {
  const what = overlapList(report, productName);
  return what
    ? { id: 'roomMessages.placedOverlap', text: fmt(C.roomMessages.placedOverlap, { name, what }), overlap: true }
    : { id: 'roomMessages.placed', text: fmt(C.roomMessages.placed, { name }), overlap: false };
}

/** The warning after moving or rotating a placed product (UX-09 item 3), or null when it is clear. */
export function movedOverlapMessage(
  name: string,
  report: CollisionReportLike,
  productName?: (hit: { id: string; label: string }) => string,
): string | null {
  const what = overlapList(report, productName);
  return what ? fmt(C.notInDeck.placedProducts.movedOverlap, { name, what }) : null;
}

// ---------------------------------------------------------------------------------------------
// The ".mjs runs code" confirmation (deck §5 "Load .mjs")
// ---------------------------------------------------------------------------------------------

/** The parts of the engine's `MjsScanResult` this needs. */
export interface MjsScanLike {
  risks: readonly string[];
  looksLikeAssetModule: boolean;
}

/**
 * The deck §5 wording for the confirmation, assembled from `copy.confirm.loadMjs`.
 * `body` is one string for `confirmDialog({ body })`; `bodyParts` is the same text in up to
 * three pieces, if the dialog shows paragraphs. This dialog is not destructive.
 *
 * TO RECONCILE AFTER MERGE (Copy Phase 4 item 4): `formatMjsGuardMessage` is being rewritten to
 * the same wording (first line = title, the rest = body). After the merge the host can use either
 * this or `splitGuardMessage(formatMjsGuardMessage(...))`. They should say the same thing.
 */
export function mjsConfirmContent(
  scan: MjsScanLike,
  fileName: string,
): { title: string; body: string; bodyParts: string[]; confirmLabel: string; cancelLabel: string } {
  const L = C.confirm.loadMjs;
  const bodyParts: string[] = [L.body];
  if (scan.risks.length) bodyParts.push(fmt(L.flagged, { risks: scan.risks.join(', ') }));
  if (!scan.looksLikeAssetModule) bodyParts.push(L.notPackLike);
  return {
    title: fmt(L.title, { file: fileName }),
    body: bodyParts.join(' '),
    bodyParts,
    confirmLabel: L.confirmLabel,
    cancelLabel: L.cancelLabel,
  };
}

/** Split an engine guard message into a dialog title (its first line) and body (the rest). */
export function splitGuardMessage(message: string): { title: string; body: string } {
  const lines = message.split('\n');
  return {
    title: (lines.shift() ?? '').trim(),
    body: lines
      .map((l) => l.trim())
      .filter(Boolean)
      .join(' '),
  };
}
