// Agent walkthrough of the usability-test tasks on the current build, with real mouse input where the task needs the canvas.
// This is NOT user testing: it records what the build does when the obvious path is taken. No participants were involved.
// Run: RV_QA_OUT=<writable dir> node walkthrough-tasks.mjs   (dev server on :18767)
import { fileURLToPath } from 'node:url';
import { chromium } from '../../hackathon-3d-viewer/node_modules/playwright/index.mjs';
import pngjs from '../../hackathon-3d-viewer/node_modules/pngjs/lib/png.js';
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';

const { PNG } = pngjs;
const OUT = process.env.RV_QA_OUT || fileURLToPath(new URL('./out', import.meta.url));
const SHOTS = `${OUT}/shots`;
mkdirSync(SHOTS, { recursive: true });
const BASE = 'http://127.0.0.1:18767/';
const results = {};
const rec = (id, name, observed) => { results[id] = { name, observed }; console.log(`\n## ${id} | ${name}\n${JSON.stringify(observed, null, 1).slice(0, 6000)}`); };
const section = async (id, name, fn) => { try { rec(id, name, await fn()); } catch (err) { rec(id, name, { SCRIPT_ERROR: String(err?.stack ?? err).slice(0, 500) }); } };

const browser = await chromium.launch({ channel: 'chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
async function fresh({ viewport = { width: 1440, height: 900 }, mobile = false, extraCss } = {}) {
  const ctx = await browser.newContext({ viewport, acceptDownloads: true, ...(mobile ? { hasTouch: true, isMobile: true, deviceScaleFactor: 2 } : {}) });
  if (extraCss) await ctx.addInitScript((css) => { addEventListener('DOMContentLoaded', () => { const s = document.createElement('style'); s.textContent = css; document.head.appendChild(s); }); }, extraCss);
  const page = await ctx.newPage();
  const dialogs = [];
  page.on('dialog', (dlg) => { dialogs.push(dlg.message().slice(0, 120)); dlg.dismiss(); });
  await page.goto(BASE);
  await page.waitForFunction(() => document.body.dataset.viewerStatus === 'ready', null, { timeout: 30000 });
  await page.waitForTimeout(2200);
  return { ctx, page, dialogs };
}
const openRoom = async (page) => { await page.locator('#workspace-mode button[data-mode=room]').click(); await page.waitForTimeout(1500); };
const createRoom = async (page, preset = 'living') => { await page.selectOption('#room-preset', preset); await page.click('#btn-create-room'); await page.waitForFunction(() => !!window.__rv.roomGraph()); await page.waitForTimeout(1500); };
const status = (page) => page.evaluate(() => { const e = document.getElementById('room-status'); const p = document.querySelector('.panel').getBoundingClientRect(); const r = e.getBoundingClientRect(); return { text: e.innerText, isError: e.classList.contains('error'), visibleInPanel: r.bottom > p.top && r.top < p.bottom }; });
const facts = (page) => page.evaluate(() => { const g = window.__rv.roomGraph(); if (!g) return null; const r = g.rooms[0]; const xs = r.floor_polygon.map((p) => p.x), zs = r.floor_polygon.map((p) => p.z); const b = { minX: Math.min(...xs), maxX: Math.max(...xs), minZ: Math.min(...zs), maxZ: Math.max(...zs) }; return { name: r.name, size: `${+(b.maxX - b.minX).toFixed(3)} x ${+(b.maxZ - b.minZ).toFixed(3)} m`, ceiling: r.ceiling_height, openings: g.openings.map((o) => o.type), placements: g.placements.map((p) => ({ product: p.product_id, x: +p.position.x.toFixed(2), z: +p.position.z.toFixed(2), inside: p.position.x > b.minX && p.position.x < b.maxX && p.position.z > b.minZ && p.position.z < b.maxZ })), provenance: g.provenance?.kind }; });
const cells = (page, N = 25) => page.evaluate((N) => { const v = window.__rv.viewer(); const c = document.querySelector('#viewer-host canvas').getBoundingClientRect(); const g = window.__rv.roomGraph().rooms[0].floor_polygon; const xs = g.map((p) => p.x), zs = g.map((p) => p.z); const out = { floorIn: [], wall: [], none: [] }; for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const x = Math.round(c.left + ((i + 0.5) * c.width) / N), y = Math.round(c.top + ((j + 0.5) * c.height) / N); const h = v.raycastRoom(x, y); if (!h) out.none.push({ x, y }); else if (h.kind === 'wall') out.wall.push({ x, y, wallId: h.wallId }); else if (h.point.x > Math.min(...xs) + 0.6 && h.point.x < Math.max(...xs) - 0.6 && h.point.z > Math.min(...zs) + 0.6 && h.point.z < Math.max(...zs) - 0.6) out.floorIn.push({ x, y }); } return out; }, N);
const orbitDown = async (page, px = 100) => { const c = await page.evaluate(() => { const r = document.querySelector('#viewer-host canvas').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }); await page.mouse.move(c.x, c.y - 150); await page.mouse.down(); await page.mouse.move(c.x, c.y - 150 + px, { steps: 8 }); await page.mouse.up(); await page.waitForTimeout(800); };
const mid = (arr) => arr[Math.floor(arr.length / 2)];

// ---- W2 Task 2: a 5.5 x 4 m room -----------------------------------------------------------------------------
await section('W2', 'Task "set up a 5.5 m by 4 m room": obvious path vs working path', async () => {
  const { ctx, page } = await fresh();
  await openRoom(page);
  await page.fill('#room-length', '5.5'); await page.fill('#room-width', '4');
  await page.click('#btn-create-room'); await page.waitForFunction(() => !!window.__rv.roomGraph()); await page.waitForTimeout(800);
  const obvious = { did: 'typed 5.5 and 4 into Length/Width, left Preset as it was, Create room', room: await facts(page), status: await status(page), lengthFieldStillShows: await page.inputValue('#room-length') };
  await page.selectOption('#room-preset', 'custom'); await page.fill('#room-length', '5.5'); await page.fill('#room-width', '4');
  await page.click('#btn-create-room'); await page.waitForTimeout(900);
  const working = { did: 'chose Preset "Custom…" first, then typed, Create room', room: await facts(page), status: await status(page) };
  await ctx.close();
  return { obvious, working };
});

// ---- W3 Task 3: door + window, real mouse -----------------------------------------------------------------------
await section('W3', 'Task "add a door and a window": real mouse clicks on walls, on arrival view', async () => {
  const { ctx, page } = await fresh();
  await openRoom(page); await createRoom(page, 'living');
  const g = await cells(page);
  await page.click('#btn-opening-mode'); await page.waitForTimeout(500);
  const afterToggle = { label: await page.locator('#btn-opening-mode').innerText(), hint: await page.locator('#stage-hint').innerText(), statusVisible: (await status(page)).visibleInPanel };
  const w1 = mid(g.wall);
  await page.mouse.click(w1.x, w1.y); await page.waitForTimeout(900);
  const door = { clicked: w1, room: await facts(page), status: await status(page), toolStillOn: await page.locator('#btn-opening-mode').getAttribute('aria-pressed') };
  await page.locator('#opening-type button[data-type=window]').click();
  const otherWall = g.wall.find((c) => c.wallId !== w1.wallId) ?? g.wall[0];
  await page.mouse.click(otherWall.x, otherWall.y); await page.waitForTimeout(900);
  const win = { clicked: otherWall, room: await facts(page), status: await status(page) };
  // click empty space (not a wall)
  const n0 = (await facts(page)).openings.length;
  if (g.none.length) { await page.mouse.click(g.none[0].x, g.none[0].y); await page.waitForTimeout(600); }
  const miss = { status: await status(page), openingsUnchanged: (await facts(page)).openings.length === n0 };
  await page.screenshot({ path: `${SHOTS}/W3-door-and-window.png` });
  const list = await page.locator('#opening-list li').allInnerTexts();
  await ctx.close();
  return { wallCellsOnArrival: g.wall.length, afterToggle, door, window: win, clickOnEmptySpace: miss, openingListRows: list };
});

// ---- W4/W5 Task 4 + 5: furnish, then try to move ---------------------------------------------------------------------
await section('W4', 'Task "put the chair and a side table in the room", then "move the chair": real mouse', async () => {
  const { ctx, page } = await fresh();
  await openRoom(page); await createRoom(page, 'living');
  await page.click('#btn-place-mode'); await page.waitForTimeout(500);
  let g = await cells(page);
  const arrival = { inRoomFloorCells: g.floorIn.length, wallCells: g.wall.length };
  await orbitDown(page, 100);
  g = await cells(page);
  const afterOrbit = { inRoomFloorCells: g.floorIn.length, placeModeStillOnAfterDrag: await page.locator('#btn-place-mode').getAttribute('aria-pressed'), placementsCreatedByTheDrag: (await facts(page)).placements.length };
  const c1 = mid(g.floorIn);
  await page.mouse.click(c1.x, c1.y); await page.waitForTimeout(1400);
  const chair = { room: await facts(page), status: await status(page) };
  await page.selectOption('#product-select', 'demo-side-table'); await page.waitForTimeout(1200);
  const afterPick = { workspace: await page.evaluate(() => document.body.dataset.workspace), placeModeStillOn: await page.locator('#btn-place-mode').getAttribute('aria-pressed'), productSelectDistanceFromPlaceBtnPx: await page.evaluate(() => Math.round(document.getElementById('product-select').getBoundingClientRect().top - document.getElementById('btn-place-mode').getBoundingClientRect().top)) };
  const c2 = g.floorIn[Math.floor(g.floorIn.length / 4)];
  await page.mouse.click(c2.x, c2.y); await page.waitForTimeout(1400);
  const table = { room: await facts(page), status: await status(page) };
  const rows = await page.locator('#placement-list li').allInnerTexts();
  // Task 5: leave Place mode, click the chair, try to drag it
  await page.click('#btn-place-mode'); await page.waitForTimeout(400);
  const before = JSON.stringify((await facts(page)).placements);
  await page.mouse.click(c1.x, c1.y); await page.waitForTimeout(500);
  await page.mouse.move(c1.x, c1.y); await page.mouse.down(); await page.mouse.move(c1.x + 120, c1.y + 20, { steps: 6 }); await page.mouse.up(); await page.waitForTimeout(700);
  const move = { placementsChangedByClickOrDrag: JSON.stringify((await facts(page)).placements) !== before, anySelectionUi: await page.evaluate(() => !!document.querySelector('[aria-current], [aria-selected=true], .selected')), statusAfter: (await status(page)).text, rowControls: await page.evaluate(() => [...document.querySelectorAll('#placement-list li button')].map((b) => b.innerText)) };
  await page.evaluate(() => { const v = window.__rv.viewer(); v.controls.target.set(0, 0.4, 0); v.camera.position.set(1.3, 2.3, 1.6); v.controls.update(); });
  await page.waitForTimeout(900);
  const clip = await page.evaluate(() => { const r = document.querySelector('#viewer-host canvas').getBoundingClientRect(); return { x: r.left, y: r.top, width: r.width, height: r.height }; });
  await page.screenshot({ path: `${SHOTS}/W4-placed-products-in-room.png`, clip });
  await ctx.close();
  return { arrival, afterOrbit, chair, afterPickingSideTable: afterPick, table, placementListRows: rows, task5_move: move };
});

// ---- W6 Task 7: plan image -> room ---------------------------------------------------------------------------------------
await section('W6', 'Task "use a floor-plan image to create the room": PNG underlay path', async () => {
  const png = new PNG({ width: 400, height: 300 });
  for (let i = 0; i < png.data.length; i += 4) { png.data[i] = 250; png.data[i + 1] = 250; png.data[i + 2] = 250; png.data[i + 3] = 255; }
  for (let x = 40; x < 360; x++) for (const y of [40, 260]) { const k = (y * 400 + x) * 4; png.data[k] = png.data[k + 1] = png.data[k + 2] = 30; }
  for (let y = 40; y < 260; y++) for (const x of [40, 360]) { const k = (y * 400 + x) * 4; png.data[k] = png.data[k + 1] = png.data[k + 2] = 30; }
  const buffer = PNG.sync.write(png);
  const { ctx, page } = await fresh();
  await openRoom(page);
  await page.locator('#room-ingress button[data-ingress=import]').click(); await page.waitForTimeout(300);
  const visibleIntro = await page.locator('#import-oda-note').innerText();
  await page.setInputFiles('#plan-file', { name: 'client-plan.png', mimeType: 'image/png', buffer });
  const primaryLabel = await page.locator('#btn-import-plan').innerText();
  await page.click('#btn-import-plan');
  await page.waitForSelector('#underlay-review:not([hidden])', { timeout: 8000 });
  await page.waitForTimeout(500);
  const review = { importStatus: await page.locator('#import-status').innerText(), underlayStatus: await page.locator('#underlay-status').innerText(), heading: await page.locator('#underlay-review h4').innerText(), defaultWidth: await page.inputValue('#underlay-width'), defaultDepth: await page.inputValue('#underlay-depth'), confirmLabel: await page.locator('#btn-underlay-confirm').innerText() };
  await page.fill('#underlay-width', '6'); await page.fill('#underlay-depth', '4.5');
  await page.click('#btn-underlay-confirm'); await page.waitForFunction(() => !!window.__rv.roomGraph(), null, { timeout: 8000 }); await page.waitForTimeout(1200);
  const out = { introWords: visibleIntro.split(/\s+/).length, primaryLabel, review, room: await facts(page), status: await status(page) };
  await page.screenshot({ path: `${SHOTS}/W6-room-from-plan-image.png` });
  await ctx.close();
  return out;
});

// ---- W7 Task 8: save and come back ------------------------------------------------------------------------------------------
await section('W7', 'Task "make sure you can continue tomorrow": export, clear, import; plan PNG download', async () => {
  const { ctx, page } = await fresh();
  await openRoom(page); await createRoom(page, 'living');
  await page.evaluate(() => window.__rv.simulateRoomPointer({ kind: 'floor', point: { x: 0, y: 0, z: 0 } }, 'place'));
  await page.waitForFunction(() => window.__rv.roomGraph().placements.length === 1); await page.waitForTimeout(500);
  const saveAffordances = await page.evaluate(() => ({ anySaveButton: [...document.querySelectorAll('button')].filter((b) => /\bsave\b/i.test(b.innerText)).map((b) => b.innerText), anyAutosaveNotice: /saved|autosave/i.test(document.body.innerText), exportVisibleWithoutScroll: (() => { const p = document.querySelector('.panel').getBoundingClientRect(); const r = document.getElementById('btn-export-project').getBoundingClientRect(); return r.bottom > p.top && r.top < p.bottom; })() }));
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 8000 }), page.click('#btn-export-project')]);
  const path = `${OUT}/exported-project.json`;
  await dl.saveAs(path);
  const exported = JSON.parse(readFileSync(path, 'utf8'));
  const exportInfo = { filename: dl.suggestedFilename(), bytes: readFileSync(path).length, topLevelKeys: Object.keys(exported), placementsInFile: exported.room_graph?.placements?.length, statusAfterExport: (await status(page)).text };
  const [png] = await Promise.all([page.waitForEvent('download', { timeout: 8000 }), page.click('#btn-download-plan')]);
  const planPng = { filename: png.suggestedFilename() };
  await page.click('#btn-clear-room'); await page.waitForTimeout(700);
  const afterClear = { workspace: await page.evaluate(() => document.body.dataset.workspace), room: await facts(page), importButtonVisible: await page.locator('#btn-import-project').isVisible() };
  // Import project is inside #room-tools, which is hidden when there is no room.
  await openRoom(page);
  const importReachableWithNoRoom = await page.locator('#btn-import-project').isVisible();
  await page.setInputFiles('#project-file', path).catch(() => {});
  await page.waitForTimeout(1500);
  const afterImport = { room: await facts(page), status: await status(page) };
  await ctx.close();
  return { saveAffordances, export: exportInfo, planPng, afterClear, importProjectButtonVisibleWithNoRoom: importReachableWithNoRoom, afterImportViaHiddenInput: afterImport };
});

// ---- W9 long real-world file name, phone width ----------------------------------------------------------------------------------
await section('W9', 'Upload a valid GLB with a long file name at 375 px: overflow, product list, status text', async () => {
  const glb = Buffer.from(await (await fetch(`${BASE}assets/models/side-table.glb`)).arrayBuffer());
  const { ctx, page } = await fresh({ viewport: { width: 375, height: 812 }, mobile: true });
  const before = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  await page.setInputFiles('#model-files', { name: 'client-living-room-armchair-walnut-final-v2-approved.glb', mimeType: 'model/gltf-binary', buffer: glb });
  await page.waitForFunction(() => /Added|Could not|Select/.test(document.getElementById('model-upload-status').innerText), null, { timeout: 15000 });
  await page.waitForTimeout(1200);
  const out = await page.evaluate(() => ({ status: document.getElementById('model-upload-status').innerText, isError: document.getElementById('model-upload-status').classList.contains('error'), productOptions: [...document.getElementById('product-select').options].map((o) => o.text), overflowXAfter: document.documentElement.scrollWidth - innerWidth, widest: [...document.querySelectorAll('body *')].filter((e) => e.getClientRects().length && e.getBoundingClientRect().right > innerWidth + 1).map((e) => `${e.tagName.toLowerCase()}${e.id ? '#' + e.id : ''}.${String(e.className).split(' ')[0]}`).slice(0, 6), slots: window.__rv.viewer().getSlots().map((s) => `${s.def.label}=${s.materialId}`), warnings: document.getElementById('slot-warnings').innerText, meta: document.getElementById('product-meta').innerText }));
  await page.locator('#parts-list').scrollIntoViewIfNeeded(); await page.waitForTimeout(300);
  await page.screenshot({ path: `${SHOTS}/W9-mobile-long-filename-upload.png` });
  await ctx.close();
  return { overflowXBefore: before, ...out };
});

// ---- W10 earlier panel figures with 15 px less content width -------------------------------------------------------------------------
await section('W10', 'Earlier panel figures (3106/1835/926/1705): do they reproduce when the panel content is 15 px narrower (as with a classic scrollbar)?', async () => {
  const { ctx, page } = await fresh({ extraCss: '.panel{padding-right:15px!important}' });
  const snap = () => page.evaluate(() => { const p = document.querySelector('.panel'); const pr = p.getBoundingClientRect(); const top = (id) => Math.round(document.getElementById(id).getBoundingClientRect().top - pr.top + p.scrollTop); const controls = [...document.querySelectorAll('button,select,input:not([type=file]):not([type=checkbox]),summary')].filter((e) => e.offsetParent !== null); return { cardWidth: Math.round(document.getElementById('room-card').getBoundingClientRect().width), panelScrollH: p.scrollHeight, slotsTop: top('slots'), presetsTop: top('presets'), roomCardH: Math.round(document.getElementById('room-card').getBoundingClientRect().height), controlsUnder32: controls.filter((e) => e.getBoundingClientRect().height < 32).length, scrollTop: Math.round(p.scrollTop) }; });
  const freshProduct = await snap();
  await openRoom(page);
  const roomNoRoom = await snap();
  await createRoom(page, 'living');
  const withRoom = await snap();
  await ctx.close();
  return { freshProduct, roomNoRoom, withRoom, earlierClaims: { panelScrollH: 3106, slotsTop: 1835, presetsTop: 2704, roomCardH_noRoom: 926, roomCardH_withRoom: 1705, controlsUnder32_fresh: 3, scrollTopAfterSwitchToRoom: 161 } };
});

// ---- W12 rendered contrast of floor / wall / background per light preset ---------------------------------------------------------------
await section('W12', 'Rendered pixel contrast: floor vs wall vs background, per light preset (camera orbited so the floor shows)', async () => {
  const { ctx, page } = await fresh();
  await openRoom(page); await createRoom(page, 'living');
  await orbitDown(page, 100);
  const g = await cells(page, 31);
  const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
  const ratio = (a, b) => { const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x); return +((l1 + 0.05) / (l2 + 0.05)).toFixed(2); };
  const hex = (c) => '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');
  const out = {};
  for (const preset of ['studio-soft', 'warm-interior', 'neutral']) {
    await page.locator('#presets button[data-preset=' + preset + ']').click();
    await page.waitForTimeout(900);
    const img = PNG.sync.read(await page.screenshot());
    const avg = (pts) => { const acc = [0, 0, 0]; let n = 0; for (const p of pts.slice(0, 60)) { const k = (p.y * img.width + p.x) * 4; acc[0] += img.data[k]; acc[1] += img.data[k + 1]; acc[2] += img.data[k + 2]; n++; } return acc.map((v) => Math.round(v / n)); };
    const floor = avg(g.floorIn), wall = avg(g.wall), bg = avg(g.none);
    out[preset] = { floor: hex(floor), wall: hex(wall), background: hex(bg), floorVsWall: ratio(floor, wall), floorVsBackground: ratio(floor, bg), wallVsBackground: ratio(wall, bg), samples: { floor: Math.min(60, g.floorIn.length), wall: Math.min(60, g.wall.length), bg: Math.min(60, g.none.length) } };
    if (preset !== 'warm-interior') { const clip = await page.evaluate(() => { const r = document.querySelector('#viewer-host canvas').getBoundingClientRect(); return { x: r.left, y: r.top, width: r.width, height: r.height }; }); await page.screenshot({ path: `${SHOTS}/W12-room-${preset}.png`, clip }); }
  }
  await ctx.close();
  return { note: 'Averages over up to 60 sampled pixels per surface; walls differ in shade by orientation, so wall is a mixed average. SwiftShader software rendering.', ...out };
});

await browser.close();
writeFileSync(`${OUT}/walkthrough-results.json`, JSON.stringify(results, null, 2));
console.log(`\nWrote ${OUT}/walkthrough-results.json`);
