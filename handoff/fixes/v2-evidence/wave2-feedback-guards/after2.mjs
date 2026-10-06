// After-fix checks, part 2: UX-03 confirms + IDB defect; T6 floor colour.
import { launch, fresh, toRoom, createRoom, toClient, placements, stageState, ready, SHOTS, OUT } from './lib.mjs';
import fs from 'node:fs';
const browser = await launch();
const out = {};
const dlg = (page) => page.evaluate(() => { const d = document.querySelector('dialog.confirm-dialog[open]'); return d ? { title: d.querySelector('.app-dialog-title').textContent, body: d.querySelector('.confirm-body').textContent, strong: [...d.querySelectorAll('.confirm-body strong')].map((s) => s.textContent), confirm: d.querySelector('[data-action=confirm]').textContent, cancel: d.querySelector('[data-action=cancel]').textContent, confirmClass: d.querySelector('[data-action=confirm]').className, focus: document.activeElement?.dataset?.action ?? null } : null; });
const counts = (page) => page.evaluate(() => { const g = window.__rv.roomGraph(); return g ? { placements: g.placements.length, openings: g.openings.length, walls: g.walls.length, prov: g.provenance.kind, canUndo: !document.getElementById('btn-undo').disabled } : null; });
const stageIntoView = async (page) => { await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(150); };
const placeReal = async (page, x, z) => { await stageIntoView(page); const p = await toClient(page, x, 0, z); await page.mouse.click(p.x, p.y); };
const visibleWall = (page) => page.evaluate(() => { const v = window.__rv.viewer(); const g = window.__rv.roomGraph(); const vis = [...v.roomBuilt.wallMeshes].filter(([, m]) => m.visible).map(([id]) => id); const w = g.walls.find((x) => x.id === vis[0]); return { id: w.id, x: (w.a.x + w.b.x) / 2, z: (w.a.z + w.b.z) / 2 }; });
const CONFIRM = 'dialog.confirm-dialog [data-action="confirm"]';
const CANCEL = 'dialog.confirm-dialog [data-action="cancel"]';

async function roomWithContent(page) {
  await toRoom(page); await createRoom(page);
  await page.click('#btn-place-mode');
  await placeReal(page, 0.8, -0.5);
  await page.waitForFunction(() => window.__rv.roomGraph().placements.length === 1);
  await page.click('#btn-opening-mode');
  await stageIntoView(page); const w = await visibleWall(page); const wp = await toClient(page, w.x, 1.2, w.z);
  await page.mouse.click(wp.x, wp.y);
  await page.waitForFunction(() => window.__rv.roomGraph().openings.length === 1);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
}

for (const [w, h] of [[1440, 900], [375, 812]]) {
  const key = `${w}x${h}`; const r = {};
  const { ctx, page, errors } = await fresh(browser, { width: w, height: h });
  await roomWithContent(page);
  r.before = await counts(page);
  r.clearButton = await page.evaluate(() => { const c = document.getElementById('btn-clear-room').getBoundingClientRect(); const cr = document.getElementById('btn-create-room').getBoundingClientRect(); const row = document.getElementById('room-plan-actions').getBoundingClientRect(); const s = getComputedStyle(document.getElementById('btn-clear-room')); const p = getComputedStyle(document.getElementById('btn-create-room'));
    return { width: Math.round(c.width), rowWidth: Math.round(row.width), pxBelowCreate: Math.round(c.top - cr.bottom), color: s.color, background: s.backgroundColor, createBackground: p.backgroundColor, sameRowAs: document.getElementById('btn-clear-room').parentElement.id }; });
  // --- Clear: Keep room changes nothing
  await page.locator('#btn-clear-room').scrollIntoViewIfNeeded();
  await page.click('#btn-clear-room'); await page.waitForTimeout(300);
  r.clearDialog = await dlg(page);
  await page.screenshot({ path: `${SHOTS}/confirm-clear-room-${key}.png` });
  await page.click(CANCEL); await page.waitForTimeout(300);
  r.afterKeep = { ...(await counts(page)), dialogs: await page.locator('dialog[open]').count(), workspace: (await stageState(page)).workspace, focusBack: await page.evaluate(() => document.activeElement?.id) };
  // Esc also keeps
  await page.click('#btn-clear-room'); await page.waitForTimeout(200); await page.keyboard.press('Escape'); await page.waitForTimeout(300);
  r.afterEsc = await counts(page);
  // --- Clear: confirm
  await page.click('#btn-clear-room'); await page.waitForTimeout(200);
  await page.click(CONFIRM); await page.waitForTimeout(600);
  const st = await stageState(page);
  r.afterClear = { hasRoom: st.hasRoom, workspace: st.workspace, mode: st.mode, turntable: st.turntable, hint: st.hint, card: st.empty, roomStatus: st.roomStatus, ls: await page.evaluate(() => localStorage.getItem('catalog3d.roomGraph')), focus: await page.evaluate(() => document.activeElement?.dataset?.emptyAction ?? document.activeElement?.tagName), placementRootsLeft: await page.evaluate(() => window.__rv.viewer().placementsRoot.children.length), toolPressed: await page.evaluate(() => ['btn-opening-mode', 'btn-place-mode', 'btn-draw-wall-mode'].map((id) => document.getElementById(id).getAttribute('aria-pressed'))), clearBtnShown: await page.locator('#btn-clear-room').isVisible() };
  await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(200);
  await page.screenshot({ path: `${SHOTS}/after-clear-stays-in-room-${key}.png` });
  r.errors = errors.slice();
  out[`clear_${key}`] = r;
  await ctx.close();
}

// --- Replace: each guarded flow
{
  const { ctx, page, errors } = await fresh(browser);
  const r = {};
  // no content: no dialog
  await toRoom(page); await createRoom(page);
  await page.click('#btn-create-room'); await page.waitForTimeout(400);
  r.createOverEmptyRoom = { dialogs: await page.locator('dialog[open]').count(), room: await counts(page) };
  // Create room with content
  await page.click('#btn-place-mode'); await placeReal(page, 0.8, -0.5);
  await page.waitForFunction(() => window.__rv.roomGraph().placements.length === 1);
  await page.keyboard.press('Escape');
  await page.click('#btn-create-room'); await page.waitForTimeout(300);
  r.createDialog = await dlg(page);
  await page.screenshot({ path: `${SHOTS}/confirm-replace-room-1440x900.png` });
  await page.click(CANCEL); await page.waitForTimeout(300);
  r.createKeep = await counts(page);
  // invalid size + content: the size error comes first, no dialog
  await page.fill('#room-length', '0'); await page.click('#btn-create-room'); await page.waitForTimeout(300);
  r.invalidSize = { dialogs: await page.locator('dialog[open]').count(), status: (await stageState(page)).roomStatus, room: await counts(page) };
  await page.fill('#room-length', '5');
  // Save a template (keeps the room), then Use template -> dialog
  await page.fill('#template-title', 'T-one'); await page.click('#btn-save-template-scratch'); await page.waitForTimeout(300);
  await page.click('#template-list li button:has-text("Instantiate")'); await page.waitForTimeout(300);
  r.templateDialog = (await dlg(page))?.title ?? null;
  await page.click(CANCEL); await page.waitForTimeout(200);
  r.templateKeep = await counts(page);
  // Delete template -> dialog; keep; delete
  await page.click('#template-list li button:has-text("Delete")'); await page.waitForTimeout(300);
  r.deleteDialog = await dlg(page);
  await page.screenshot({ path: `${SHOTS}/confirm-delete-template-1440x900.png` });
  await page.click(CANCEL); await page.waitForTimeout(200);
  r.deleteKeep = await page.locator('#template-list li').count();
  // Import plan (sample) -> Start editing -> dialog
  await page.click('#room-ingress button[data-ingress=import]');
  await page.click('#btn-import-fixture'); await page.waitForSelector('#import-review:not([hidden])');
  await page.click('#btn-import-start-editing'); await page.waitForTimeout(300);
  r.planDialog = (await dlg(page))?.title ?? null;
  await page.click(CANCEL); await page.waitForTimeout(200);
  r.planKeep = await counts(page);
  // Image -> room -> dialog
  const png = `${OUT}/underlay.png`;
  fs.writeFileSync(png, Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64'));
  await page.setInputFiles('#plan-file', png); await page.click('#btn-import-plan'); await page.waitForSelector('#underlay-review:not([hidden])');
  await page.click('#btn-underlay-confirm'); await page.waitForTimeout(300);
  r.imageDialog = (await dlg(page))?.title ?? null;
  await page.click(CANCEL); await page.waitForTimeout(200);
  r.imageKeep = { room: await counts(page), underlayReviewStillShown: await page.locator('#underlay-review').isVisible() };
  // Open project -> dialog; keep leaves room AND templates
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#btn-export-project')]);
  const file = `${OUT}/replace-project.json`; await dl.saveAs(file);
  const proj = JSON.parse(fs.readFileSync(file, 'utf8')); proj.templates = []; proj.room_graph.placements = []; proj.label = 'Other';
  fs.writeFileSync(file, JSON.stringify(proj));
  const [ch] = await Promise.all([page.waitForEvent('filechooser'), page.click('#btn-import-project')]);
  await ch.setFiles(file); await page.waitForTimeout(400);
  r.projectDialog = (await dlg(page))?.title ?? null;
  await page.click(CANCEL); await page.waitForTimeout(200);
  r.projectKeep = { room: await counts(page), templates: await page.evaluate(() => JSON.parse(localStorage.getItem('catalog3d.roomTemplates') ?? '[]').length) };
  // now confirm one: Replace through Create room
  await page.click('#room-ingress button[data-ingress=scratch]');
  await page.click('#btn-create-room'); await page.waitForTimeout(300);
  await page.click(CONFIRM); await page.waitForTimeout(600);
  r.createReplaced = { room: await counts(page), placementRootsLeft: await page.evaluate(() => window.__rv.viewer().placementsRoot.children.length), workspace: (await stageState(page)).workspace };
  // delete template for real
  await page.click('#room-ingress button[data-ingress=template]');
  await page.click('#template-list li button:has-text("Delete")'); await page.click(CONFIRM); await page.waitForTimeout(300);
  r.deleteConfirmed = await page.locator('#template-list li').count();
  r.errors = errors.slice();
  out.replace = r;
  await ctx.close();
}

// --- IDB defect: create -> Export -> Clear (confirm) -> reload -> no room
{
  const { ctx, page } = await fresh(browser);
  await toRoom(page); await createRoom(page);
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#btn-export-project')]);
  await dl.path(); await page.waitForTimeout(300);
  const idbHas = () => page.evaluate(() => new Promise((res) => { const req = indexedDB.open('catalog3d-local', 1); req.onsuccess = () => { const db = req.result; if (!db.objectStoreNames.contains('kv')) { db.close(); return res(null); } const g = db.transaction('kv').objectStore('kv').get('project'); g.onsuccess = () => { db.close(); res(g.result ? 'project' : null); }; g.onerror = () => res('err'); }; req.onerror = () => res('err'); }));
  const afterExport = await idbHas();
  await page.click('#btn-clear-room'); await page.click(CONFIRM); await page.waitForTimeout(500);
  const afterClear = await idbHas();
  await page.reload(); await ready(page); await page.waitForTimeout(500);
  const hasRoom = await page.evaluate(() => !!window.__rv.roomGraph());
  await toRoom(page); await page.waitForTimeout(400);
  out.idb = { idbAfterExport: afterExport, idbAfterClear: afterClear, afterReloadHasRoom: hasRoom, afterReload: await stageState(page) };
  // And "Keep room" must not clear the IDB copy
  await createRoom(page);
  const [dl2] = await Promise.all([page.waitForEvent('download'), page.click('#btn-export-project')]); await dl2.path(); await page.waitForTimeout(300);
  await page.click('#btn-clear-room'); await page.click(CANCEL); await page.waitForTimeout(300);
  out.idb.keepRoomLeavesIdb = await idbHas();
  await ctx.close();
}

// --- T6: surface materials
{
  const { ctx, page } = await fresh(browser);
  await toRoom(page); await createRoom(page);
  const colors = () => page.evaluate(() => { const v = window.__rv.viewer(); let f = null, w = null; v.roomBuilt.root.traverse((o) => { if (o.isMesh && o.userData.kind === 'floor' && !f) f = '#' + o.material.color.getHexString() + ' ' + o.material.name; if (o.isMesh && o.userData.kind === 'wall' && !w) w = '#' + o.material.color.getHexString() + ' ' + o.material.name; }); return { floor: f, wall: w }; });
  const r = { default: await colors() };
  await page.selectOption('#room-wall-material', 'wood-walnut'); await page.waitForTimeout(400);
  r.wallOnly = await colors();
  await page.selectOption('#room-wall-material', ''); await page.selectOption('#room-floor-material', 'wood-oak'); await page.waitForTimeout(400);
  r.floorOnly = await colors();
  await page.selectOption('#room-wall-material', 'wood-walnut'); await page.waitForTimeout(400);
  r.both = await colors();
  await page.selectOption('#room-wall-material', ''); await page.selectOption('#room-floor-material', ''); await page.waitForTimeout(400);
  r.backToDefault = await colors();
  // reload with wall only persisted: mountViewer path
  await page.selectOption('#room-wall-material', 'wood-walnut'); await page.waitForTimeout(300);
  await page.reload(); await ready(page); await toRoom(page); await page.waitForTimeout(600);
  r.wallOnlyAfterReload = await colors();
  out.T6 = r;
  await ctx.close();
}

fs.writeFileSync(`${OUT}/after2.json`, JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 1));
await browser.close();
