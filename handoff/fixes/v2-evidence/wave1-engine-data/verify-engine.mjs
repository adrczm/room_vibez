// Browser verification of the data-engine slice against the dev server on :18782.
// main.ts is unedited, so engine functions the host does not call yet are called through the same
// module instances the app uses (Vite serves /src/viewer/*.ts as modules).
import { chromium } from '/private/tmp/claude-501/-Users-adrian-Desktop-Room-Vibez/7ac663fe-e0d6-4b3c-af69-487be083d847/scratchpad/ws-data/node_modules/playwright/index.mjs';
import { readFileSync } from 'node:fs';

const BASE = process.env.RV_BASE || 'http://127.0.0.1:18782/';
const ONLY = (process.env.ONLY || '').split(',').filter(Boolean);
const browser = await chromium.launch({ channel: 'chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ready = (page, ms = 60000) => page.waitForFunction(() => ['ready', 'error'].includes(document.body.dataset.viewerStatus), null, { timeout: ms });
const results = {};
async function section(id, name, fn, ctxOpts = {}, init) {
  if (ONLY.length && !ONLY.includes(id)) return;
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, acceptDownloads: true, ...ctxOpts });
  if (init) await ctx.addInitScript(init);
  const page = await ctx.newPage();
  const errors = [];
  const dialogs = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message.slice(0, 200)));
  page.on('console', (m) => m.type() === 'error' && errors.push('console: ' + m.text().slice(0, 200)));
  let out;
  try {
    await page.goto(BASE); await ready(page);
    out = await fn(page, { errors, dialogs, ctx });
  } catch (err) { out = { SCRIPT_ERROR: String(err?.stack ?? err).slice(0, 600) }; }
  results[id] = { name, ...out, pageErrors: errors };
  console.log(`\n## ${id} | ${name}\n${JSON.stringify(results[id], null, 1)}`);
  await ctx.close();
}
const openRoom = (page) => page.locator('#workspace-mode button[data-mode=room]').click();
const createRoom = async (page) => { await openRoom(page); await page.selectOption('#room-preset', 'living'); await page.click('#btn-create-room'); await page.waitForFunction(() => !!window.__rv.roomGraph()); };
const reload = async (page) => { await page.reload(); await ready(page); await page.waitForTimeout(700); };
const F1_POISON = JSON.stringify({ schema_version: 1, rooms: [{ id: 'r', floor_polygon: [{ x: null, z: 0 }], ceiling_height: 'tall' }], walls: [{ id: 'w', a: { x: 0, z: 0 }, b: { x: 0, z: 0 }, thickness: 0 }], openings: [], placements: [] });

// ---- T1: persistRoomGraph outcome with the browser's real Storage ------------------------------------------
await section('T1a', 'persistRoomGraph returns true when storage works', async (page) => {
  await createRoom(page);
  return page.evaluate(async () => {
    const m = await import('/src/viewer/roomGraph.ts');
    const saved = m.persistRoomGraph(window.__rv.roomGraph());
    return { returned: saved, keyChars: localStorage.getItem('catalog3d.roomGraph')?.length ?? null };
  });
});
await section('T1b', 'persistRoomGraph returns false when setItem throws (stress test F3 method)', async (page) => {
  await createRoom(page);
  return page.evaluate(async () => {
    const m = await import('/src/viewer/roomGraph.ts');
    return { appHasRoom: !!window.__rv.roomGraph(), returned: m.persistRoomGraph(window.__rv.roomGraph()), keyPresent: localStorage.getItem('catalog3d.roomGraph') !== null, viewerStatus: document.body.dataset.viewerStatus };
  });
}, {}, () => { Storage.prototype.setItem = function () { throw new DOMException('quota', 'QuotaExceededError'); }; });
await section('T1c', 'persistRoomGraph returns false when reading window.localStorage throws', async (page) => {
  const boot = await page.evaluate(() => document.body.dataset.viewerStatus);
  if (boot !== 'ready') return { bootStatus: boot, overlay: await page.locator('#viewer-overlay').innerText().catch(() => '') };
  await createRoom(page);
  return page.evaluate(async () => {
    const m = await import('/src/viewer/roomGraph.ts');
    return { bootStatus: 'ready', appHasRoom: !!window.__rv.roomGraph(), returned: m.persistRoomGraph(window.__rv.roomGraph()), boot: m.loadPersistedRoomGraphOrQuarantine() };
  });
}, {}, () => { Object.defineProperty(window, 'localStorage', { configurable: true, get() { throw new DOMException('The operation is insecure.', 'SecurityError'); } }); });

// ---- T2: quarantine with the browser's real localStorage -------------------------------------------------
await section('T2', 'boot load quarantines the stress-test poison; damaged data is downloadable', async (page) => {
  await page.evaluate((p) => localStorage.setItem('catalog3d.roomGraph', p), F1_POISON);
  const first = await page.evaluate(async () => {
    const m = await import('/src/viewer/roomGraph.ts');
    const r = m.loadPersistedRoomGraphOrQuarantine();
    return { result: r, keys: Object.keys(localStorage).sort(), mainKey: localStorage.getItem('catalog3d.roomGraph'), backup: m.readQuarantinedRoomGraph() };
  });
  await reload(page);
  const afterReload = await page.evaluate(async () => {
    const m = await import('/src/viewer/roomGraph.ts');
    return { viewerStatus: document.body.dataset.viewerStatus, appHasRoom: !!window.__rv.roomGraph(), secondLoad: m.loadPersistedRoomGraphOrQuarantine(), backupStillThere: !!m.readQuarantinedRoomGraph() };
  });
  // "Download the damaged data": the host would call downloadTextFile(name, quarantined.raw).
  const [dl] = await Promise.all([
    page.waitForEvent('download', { timeout: 15000 }),
    page.evaluate(async () => {
      const rg = await import('/src/viewer/roomGraph.ts');
      const io = await import('/src/viewer/projectIO.ts');
      io.downloadTextFile('catalog3d-room-unreadable.json', rg.readQuarantinedRoomGraph().raw);
    }),
  ]);
  const path = await dl.path();
  const downloaded = readFileSync(path, 'utf8');
  const discarded = await page.evaluate(async () => { const m = await import('/src/viewer/roomGraph.ts'); return { discard: m.discardQuarantinedRoomGraph(), keys: Object.keys(localStorage).sort() }; });
  return { first, afterReload, download: { filename: dl.suggestedFilename(), equalsOriginalText: downloaded === F1_POISON }, discarded };
});

// ---- T6: IndexedDB clear ----------------------------------------------------------------------------------
const exportProject = async (page) => { const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 15000 }), page.click('#btn-export-project')]); return dl.suggestedFilename(); };
const roomFacts = (page) => page.evaluate(() => { const g = window.__rv.roomGraph(); return { appRoom: g ? `${g.label}, ${g.walls.length} walls` : null, lsRoomKey: localStorage.getItem('catalog3d.roomGraph') !== null }; });
await section('T6a', 'create -> export -> clear + clearProjectFromIdb() -> reload: room stays gone', async (page) => {
  await createRoom(page);
  await exportProject(page); await page.waitForTimeout(1200);
  await openRoom(page); await page.click('#btn-clear-room');
  const cleared = await page.evaluate(async () => (await import('/src/viewer/projectIO.ts')).clearProjectFromIdb());
  const idbAfterClear = await page.evaluate(async () => (await import('/src/viewer/projectIO.ts')).loadProjectFromIdb());
  await reload(page);
  const r1 = await roomFacts(page);
  await reload(page);
  return { clearProjectFromIdbReturned: cleared, idbProjectAfterClear: idbAfterClear, afterReload: r1, afterSecondReload: await roomFacts(page) };
});
await section('T6b', 'same, but export and clear back to back with no wait (ordering)', async (page) => {
  await createRoom(page);
  // Export click, then clear + clearProjectFromIdb in the same task, before the export's IndexedDB writes can finish.
  const dlPromise = page.waitForEvent('download', { timeout: 15000 });
  const cleared = await page.evaluate(async () => {
    const io = await import('/src/viewer/projectIO.ts');
    document.getElementById('btn-export-project').click();
    document.querySelector('#workspace-mode button[data-mode=room]').click();
    document.getElementById('btn-clear-room').click();
    return io.clearProjectFromIdb();
  });
  await dlPromise;
  await page.waitForTimeout(1500);
  await reload(page);
  return { clearProjectFromIdbReturned: cleared, afterReload: await roomFacts(page) };
});
await section('T6c', 'UNEDITED HOST, no clearProjectFromIdb: templates saved after the export are overwritten when boot falls back to IndexedDB', async (page) => {
  page.on('dialog', (d) => d.accept());
  await createRoom(page);
  await page.fill('#template-title', 'T1 before export'); await page.click('#btn-save-template-scratch');
  await openRoom(page); await page.locator('#room-ingress button[data-ingress=scratch]').click();
  await exportProject(page); await page.waitForTimeout(1200);
  await page.fill('#template-title', 'T2 after export'); await page.click('#btn-save-template-scratch');
  const titles = () => page.evaluate(() => (JSON.parse(localStorage.getItem('catalog3d.roomTemplates') || '[]')).map((t) => t.title));
  const beforeClear = await titles();
  await openRoom(page); await page.click('#btn-clear-room');
  const afterClear = await titles();
  await reload(page);
  return { templatesBeforeClear: beforeClear, templatesAfterClear: afterClear, templatesAfterReload: await titles(), roomAfterReload: await roomFacts(page) };
});
await section('T6d', 'same as T6c but with clearProjectFromIdb() after Clear: templates and empty room survive the reload', async (page) => {
  page.on('dialog', (d) => d.accept());
  await createRoom(page);
  await page.fill('#template-title', 'T1 before export'); await page.click('#btn-save-template-scratch');
  await openRoom(page); await page.locator('#room-ingress button[data-ingress=scratch]').click();
  await exportProject(page); await page.waitForTimeout(1200);
  await page.fill('#template-title', 'T2 after export'); await page.click('#btn-save-template-scratch');
  const titles = () => page.evaluate(() => (JSON.parse(localStorage.getItem('catalog3d.roomTemplates') || '[]')).map((t) => t.title));
  await openRoom(page); await page.click('#btn-clear-room');
  await page.evaluate(async () => (await import('/src/viewer/projectIO.ts')).clearProjectFromIdb());
  await reload(page);
  return { templatesAfterReload: await titles(), roomAfterReload: await roomFacts(page) };
});

// ---- T3: .mjs confirmation -----------------------------------------------------------------------------------
const PACK_MJS = `import * as THREE from 'three';
export const params = {};
export function createAsset() {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.4), new THREE.MeshStandardMaterial({ color: 0x8899aa })));
  return g;
}
`;
const RISKY_MJS = `globalThis.__riskyRan = true;\nexport const note = 'not a pack'; const u = 'https://example.test/'; if (false) fetch(u);\n`;
await section('T3a', 'UI path (window.confirm fallback): message text, dismiss cancels, accept loads', async (page) => {
  const seen = [];
  let answer = 'dismiss';
  page.on('dialog', (d) => { seen.push({ type: d.type(), message: d.message() }); return answer === 'accept' ? d.accept() : d.dismiss(); });
  const optionCount = () => page.locator('#product-select option').count();
  const before = await optionCount();
  await page.setInputFiles('#module-file', { name: 'verify-box.mjs', mimeType: 'text/javascript', buffer: Buffer.from(PACK_MJS) });
  await page.waitForFunction(() => /cancel/i.test(document.getElementById('module-upload-status').textContent), null, { timeout: 15000 });
  const dismissed = { status: await page.locator('#module-upload-status').innerText(), productsAdded: (await optionCount()) - before };
  answer = 'accept';
  await page.setInputFiles('#module-file', { name: 'verify-box.mjs', mimeType: 'text/javascript', buffer: Buffer.from(PACK_MJS) });
  await page.waitForFunction((n) => document.querySelectorAll('#product-select option').length > n, before, { timeout: 30000 });
  await ready(page);
  const accepted = { status: await page.locator('#module-upload-status').innerText(), productsAdded: (await optionCount()) - before, viewerStatus: await page.evaluate(() => document.body.dataset.viewerStatus) };
  return { dialogs: seen, dismissed, accepted };
});
await section('T3b', 'UI path: flagged, not pack-like source; dismiss means the code never runs', async (page) => {
  const seen = [];
  page.on('dialog', (d) => { seen.push(d.message()); return d.dismiss(); });
  await page.setInputFiles('#module-file', { name: 'risky.mjs', mimeType: 'text/javascript', buffer: Buffer.from(RISKY_MJS) });
  await page.waitForFunction(() => /cancel/i.test(document.getElementById('module-upload-status').textContent), null, { timeout: 15000 });
  return { dialogMessage: seen[0], status: await page.locator('#module-upload-status').innerText(), codeRan: await page.evaluate(() => globalThis.__riskyRan === true) };
});
await section('T3c', 'importModuleFile with an async confirmFn (what a dialog-backed host passes)', async (page) => {
  const nativeDialogs = [];
  page.on('dialog', (d) => { nativeDialogs.push(d.message()); return d.dismiss(); });
  const out = await page.evaluate(async ({ PACK_MJS, RISKY_MJS }) => {
    const m = await import('/src/viewer/modules.ts');
    const g = await import('/src/viewer/mjsGuardrails.ts');
    const later = (v) => new Promise((r) => setTimeout(() => r(v), 150));
    const file = (src, name) => new File([src], name, { type: 'text/javascript' });
    const r = {};
    let msg = null;
    // "Don't load": resolves false after a delay, like a dialog the user closes.
    r.declined = await m.importModuleFile(file(RISKY_MJS, 'risky.mjs'), undefined, { confirmFn: (x) => { msg = x; return later(false); } }).then(() => 'LOADED', (e) => e.message);
    r.declinedCodeRan = globalThis.__riskyRan === true;
    r.messageGiven = msg;
    r.parsed = g.parseMjsGuardMessage(msg);
    // "Load and run": resolves true.
    const ok = await m.importModuleFile(file(PACK_MJS, 'verify-box.mjs'), undefined, { confirmFn: () => later(true) });
    const obj = ok.mod.createAsset();
    r.accepted = { exports: Object.keys(ok.mod).sort(), isObject3D: obj.isObject3D === true, children: obj.children.length, rewritten: ok.rewritten };
    URL.revokeObjectURL(ok.objectUrl);
    return r;
  }, { PACK_MJS, RISKY_MJS });
  return { ...out, nativeDialogsShown: nativeDialogs.length };
});

// ---- T5: plan file check ------------------------------------------------------------------------------------
await section('T5a', 'checkPlanFile on browser File objects', async (page) => {
  return page.evaluate(async () => {
    const m = await import('/src/viewer/dwgImport.ts');
    const junk = crypto.getRandomValues(new Uint8Array(4096));
    const enc = (s) => new TextEncoder().encode(s);
    const dwgLike = new Uint8Array(4096); dwgLike.set(enc('AC1032'));
    const dxf = '  0\nSECTION\n  2\nHEADER\n  0\nENDSEC\n  0\nEOF\n';
    const files = [
      new File([enc('ISO-10303-21;')], 'building.ifc'),
      new File([new Uint8Array([0x4d, 0x5a, 0x90, 0])], 'setup.exe', { type: 'application/x-msdownload' }),
      new File([junk], 'random.dwg', { type: 'application/octet-stream' }),
      new File([new Uint8Array([0x4d, 0x5a, 0x90, 0])], 'setup.dwg'),
      new File([], 'empty.dwg'),
      new File([dwgLike], 'starts-with-AC1032.dwg'),
      new File([junk], 'random.dxf'),
      new File([enc(dxf)], 'synthetic.dxf'),
      new File([junk], 'plan.png', { type: 'image/png' }),
      new File([enc('%PDF-1.7')], 'plan.pdf', { type: 'application/pdf' }),
      new File([enc('{}')], 'plan.json', { type: 'application/json' }),
    ];
    const out = {};
    for (const f of files) out[f.name] = await m.checkPlanFile(f);
    return out;
  });
});
const planUi = async (page, name, buffer, mimeType = 'application/octet-stream') => {
  await page.locator('#room-ingress button[data-ingress=import]').click();
  await page.setInputFiles('#plan-file', { name, mimeType, buffer });
  await page.click('#btn-import-plan');
  await page.waitForTimeout(1500);
  return page.evaluate(() => ({ importStatus: document.getElementById('import-status').textContent, statusIsError: document.getElementById('import-status').classList.contains('error'), reviewVisible: !document.getElementById('import-review').hidden, job: window.__rv.importJob() ? { source: window.__rv.importJob().source.kind + ':' + window.__rv.importJob().source.filename, walls: window.__rv.importJob().candidates.walls.length } : null }));
};
await section('T5b', 'UNEDITED HOST: what the Import plan button does now with .ifc, .exe, random .dwg, bad .json', async (page) => {
  const junk = Buffer.from(Array.from({ length: 2048 }, (_, i) => (i * 131 + 17) % 256));
  return {
    'building.ifc': await planUi(page, 'building.ifc', Buffer.from('ISO-10303-21;')),
    'setup.exe': await planUi(page, 'setup.exe', Buffer.from([0x4d, 0x5a, 0x90, 0])),
    'bad.json': await planUi(page, 'bad.json', Buffer.from('{bad'), 'application/json'),
    'random.dwg (host does not call checkPlanFile yet)': await planUi(page, 'random.dwg', junk),
  };
});

// ---- T4: which size field --------------------------------------------------------------------------------------
await section('T4', 'RoomSizeError carries the field; UI message unchanged', async (page) => {
  await openRoom(page);
  await page.selectOption('#room-preset', 'custom');
  await page.fill('#room-length', '5'); await page.fill('#room-width', '0');
  await page.click('#btn-create-room'); await page.waitForTimeout(400);
  const ui = await page.evaluate(() => ({ status: document.getElementById('room-status').textContent, isError: document.getElementById('room-status').classList.contains('error'), roomCreated: !!window.__rv.roomGraph() }));
  const engine = await page.evaluate(async () => {
    const m = await import('/src/viewer/roomGraph.ts');
    try { m.createRectangularRoom({ length: 5, width: 0, ceilingHeight: 2.7, wallThickness: -1 }); return 'no throw'; }
    catch (e) { return { isRoomSizeError: e instanceof m.RoomSizeError, name: e.name, fields: e.fields, message: e.message }; }
  });
  return { ui, engine };
});

await browser.close();
