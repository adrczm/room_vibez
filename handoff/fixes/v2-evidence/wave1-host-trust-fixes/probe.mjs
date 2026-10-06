// H1 probe: measures the six trust-fix items against the v2 dev server. Run before and after the fix.
// usage: node probe.mjs <label>     writes out-<label>.json beside this file
import { chromium } from '/Users/adrian/Desktop/Room Vibez/v2/hackathon-3d-viewer/node_modules/playwright/index.mjs';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const BASE = 'http://127.0.0.1:18777/';
const label = process.argv[2] || 'run';
const only = process.argv[3] ? process.argv[3].split(',') : null;
const OUT = fileURLToPath(new URL(`./out-${label}.json`, import.meta.url));
const results = {};
const browser = await chromium.launch({ channel: 'chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });

async function fresh(viewport = { width: 1440, height: 900 }) {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto(BASE);
  await page.waitForFunction(() => document.body.dataset.viewerStatus === 'ready', null, { timeout: 60000 });
  await page.waitForTimeout(1500);
  return { ctx, page, errors };
}
const openRoom = async (page) => { await page.locator('#workspace-mode button[data-mode=room]').click(); await page.waitForTimeout(1200); };
const createRoom = async (page, preset) => { if (preset) await page.selectOption('#room-preset', preset); await page.click('#btn-create-room'); await page.waitForFunction(() => !!window.__rv.roomGraph()); await page.waitForTimeout(1200); };
const st = (page) => page.evaluate(() => { const v = window.__rv.viewer(); const t = v.controls.target, c = v.camera.position; return { mode: v.getInteractionMode(), workspace: document.body.dataset.workspace, place: document.getElementById('btn-place-mode').getAttribute('aria-pressed'), opening: document.getElementById('btn-opening-mode').getAttribute('aria-pressed'), draw: document.getElementById('btn-draw-wall-mode').getAttribute('aria-pressed'), elevationDeg: +((Math.atan2(c.y - t.y, Math.hypot(c.x - t.x, c.z - t.z)) * 180) / Math.PI).toFixed(2), camDist: +Math.hypot(c.x - t.x, c.y - t.y, c.z - t.z).toFixed(3) }; });
const canvasCentre = (page) => page.evaluate(() => { const r = document.querySelector('#viewer-host canvas').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
// OrbitControls damping keeps the camera drifting after a drag (slow on SwiftShader). Wait until it is still.
const settle = async (page) => { let prev = null; for (let i = 0; i < 60; i++) { const e = (await st(page)).elevationDeg; if (prev !== null && Math.abs(e - prev) < 0.02) return e; prev = e; await page.waitForTimeout(300); } return prev; };
const orbitDown = async (page, px = 100) => { const c = await canvasCentre(page); await page.mouse.move(c.x, c.y - 150); await page.mouse.down(); await page.mouse.move(c.x, c.y - 150 + px, { steps: 8 }); await page.mouse.up(); await settle(page); };
// A canvas point whose ray hits the floor inside the room (read-only raycast), nth candidate so two clicks differ.
const floorPoint = (page, nth = 0) => page.evaluate((nth) => { const v = window.__rv.viewer(); const r = document.querySelector('#viewer-host canvas').getBoundingClientRect(); const g = window.__rv.roomGraph().rooms[0].floor_polygon; const xs = g.map((p) => p.x), zs = g.map((p) => p.z); const hits = []; const N = 15; for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const x = r.left + ((i + 0.5) * r.width) / N, y = r.top + ((j + 0.5) * r.height) / N; if (document.elementFromPoint(x, y)?.tagName !== 'CANVAS') continue; const h = v.raycastRoom(x, y); if (h?.kind === 'floor' && h.point.x > Math.min(...xs) + 0.6 && h.point.x < Math.max(...xs) - 0.6 && h.point.z > Math.min(...zs) + 0.6 && h.point.z < Math.max(...zs) - 0.6) hits.push({ x, y, wx: h.point.x, wz: h.point.z }); } hits.sort((a, b) => Math.hypot(a.wx, a.wz) - Math.hypot(b.wx, b.wz)); return hits.length ? hits[Math.min(nth * 6, hits.length - 1)] : null; }, nth);
const placements = (page) => page.evaluate(() => window.__rv.roomGraph()?.placements.length ?? 0);
const hiddenShown = (page) => page.evaluate(() => [...document.querySelectorAll('[hidden]')].filter((e) => getComputedStyle(e).display !== 'none').map((e) => e.id));
const section = async (id, fn) => { if (only && !only.includes(id)) return; try { results[id] = await fn(); } catch (err) { results[id] = { SCRIPT_ERROR: String(err?.stack ?? err).slice(0, 900) }; } console.log(`\n## ${id}\n${JSON.stringify(results[id], null, 1)}`); };

// ---- UX-01 part 1 and 2: typed size vs preset ---------------------------------------------------------
await section('UX01_size', async () => {
  const { ctx, page, errors } = await fresh();
  await openRoom(page);
  const presetBefore = await page.inputValue('#room-preset');
  await page.locator('#room-length').click();
  await page.locator('#room-length').fill('6');
  const presetAfterTyping = await page.inputValue('#room-preset');
  await page.click('#btn-create-room');
  await page.waitForFunction(() => !!window.__rv.roomGraph());
  await page.waitForTimeout(600);
  const out = await page.evaluate(() => { const g = window.__rv.roomGraph(); const p = g.rooms[0].floor_polygon; return { lengthM: Math.abs(p[1].x - p[0].x), widthM: Math.abs(p[2].z - p[1].z), ceilingM: g.rooms[0].ceiling_height, roomName: g.rooms[0].name, status: document.getElementById('room-status').textContent, field: document.getElementById('room-length').value, preset: document.getElementById('room-preset').value, presetLabel: document.getElementById('room-preset').selectedOptions[0].textContent }; });
  await ctx.close();
  return { presetBefore, presetAfterTyping, ...out, errors };
});

// ---- UX-01 part 3: unit switch converts the fields ------------------------------------------------------
await section('UX01_units', async () => {
  const { ctx, page, errors } = await fresh();
  await openRoom(page);
  const ids = ['room-length', 'room-width', 'room-ceiling', 'room-thickness', 'opening-width', 'opening-height', 'opening-sill'];
  const read = () => page.evaluate((ids) => Object.fromEntries(ids.map((id) => { const e = document.getElementById(id); return [id, `${e.value} (min ${e.min}, step ${e.step})`]; })), ids);
  const m = await read();
  await page.selectOption('#room-units', 'cm');
  const cm = await read();
  const presetAfterUnit = await page.inputValue('#room-preset');
  await page.click('#btn-create-room');
  await page.waitForFunction(() => !!window.__rv.roomGraph());
  await page.waitForTimeout(600);
  const created = await page.evaluate(() => { const g = window.__rv.roomGraph(); const p = g.rooms[0].floor_polygon; return { lengthM: Math.abs(p[1].x - p[0].x), widthM: Math.abs(p[2].z - p[1].z), ceilingM: g.rooms[0].ceiling_height, wallThicknessM: g.walls[0].thickness, status: document.getElementById('room-status').textContent }; });
  await page.selectOption('#room-units', 'ft-in');
  const ft = await read();
  await page.selectOption('#room-units', 'm');
  const backToM = await read();
  await ctx.close();
  return { m, cm, presetAfterUnit, created, ft, backToM, errors };
});

// ---- QA-08 / UX-02: [hidden] overridden, four states, plus the texture target check --------------------
await section('QA08_hidden', async () => {
  const { ctx, page, errors } = await fresh();
  const out = {};
  out.freshProduct = await hiddenShown(page);
  await openRoom(page);
  out.roomNoRoom = await hiddenShown(page);
  out.downloadPlanVisibleNoRoom = await page.locator('#btn-download-plan').isVisible();
  await page.locator('#room-ingress button[data-ingress=import]').click();
  await page.waitForTimeout(400);
  out.importTab = await hiddenShown(page);
  await page.locator('#room-ingress button[data-ingress=scratch]').click();
  await createRoom(page, 'living');
  out.roomWithRoom = await hiddenShown(page);
  out.projectFileDisplay = await page.evaluate(() => getComputedStyle(document.getElementById('project-file')).display);
  // Check after: texture target select follows the role
  const target = async () => page.evaluate(() => ({ hiddenAttr: document.getElementById('texture-target-wrap').hidden, display: getComputedStyle(document.getElementById('texture-target-wrap')).display }));
  out.textureTarget = {};
  for (const role of ['map', 'normalMap', 'roughnessMap', 'map']) { await page.selectOption('#texture-role', role); out.textureTarget[`${role}${out.textureTarget[role] ? '_again' : ''}`] = await target(); }
  out.textureTargetVisibleForNormal = await (async () => { await page.selectOption('#texture-role', 'normalMap'); return page.locator('#texture-target').isVisible(); })();
  out.roomCardHeight = await page.evaluate(() => Math.round(document.getElementById('room-card').getBoundingClientRect().height));
  await ctx.close();
  return { ...out, errors };
});

// ---- QA-01: tool toggle, camera kept, ingress tab, Product -> Room still frames, Esc -------------------
await section('QA01_tools', async () => {
  const { ctx, page, errors } = await fresh();
  await openRoom(page);
  await createRoom(page, 'living');
  const out = { arrival: await st(page) };
  for (const [name, sel] of [['place', '#btn-place-mode'], ['opening', '#btn-opening-mode'], ['draw-wall', '#btn-draw-wall-mode']]) {
    await page.click(sel); await page.waitForTimeout(400); const first = await st(page);
    await page.click(sel); await page.waitForTimeout(400); const second = await st(page);
    await page.click(sel); await page.waitForTimeout(400); const third = await st(page);
    const key = name === 'draw-wall' ? 'draw' : name;
    out[name] = { modes: [first.mode, second.mode, third.mode], pressed: [first[key], second[key], third[key]] };
    if (third.mode === name) { await page.click(sel); await page.waitForTimeout(300); } // leave it off if toggling works
  }
  out.afterCycling = await st(page);
  // orbit, then pick each tool: is the view kept?
  out.orbitThenTool = {};
  for (const [name, sel] of [['place', '#btn-place-mode'], ['opening', '#btn-opening-mode'], ['draw-wall', '#btn-draw-wall-mode']]) {
    await page.locator('#workspace-mode button[data-mode=catalog]').click(); await page.waitForTimeout(600);
    await page.locator('#workspace-mode button[data-mode=room]').click(); await page.waitForTimeout(1200);
    const framed = await st(page);
    await orbitDown(page);
    const orbited = await st(page);
    await page.click(sel); await page.waitForTimeout(700); await settle(page);
    const after = await st(page);
    out.orbitThenTool[name] = { framedDeg: framed.elevationDeg, orbitedDeg: orbited.elevationDeg, afterToolDeg: after.elevationDeg, deltaDeg: +(after.elevationDeg - orbited.elevationDeg).toFixed(2), modeAfter: after.mode };
  }
  // tool is on (draw-wall). Esc with focus on the button
  await page.keyboard.press('Escape'); await page.waitForTimeout(300);
  out.escFromButtonFocus = await st(page);
  // Esc after a canvas click in Place mode (focus wherever the browser leaves it)
  await page.click('#btn-place-mode'); await page.waitForTimeout(300);
  out.placeOnBeforeEsc = (await st(page)).mode;
  out.activeElementAfterToolClick = await page.evaluate(() => document.activeElement?.id || document.activeElement?.tagName);
  await page.keyboard.press('Escape'); await page.waitForTimeout(300);
  out.escInPlace = await st(page);
  // ingress tab: camera kept? (fresh framing first so the camera is not pinned at the top-down limit)
  await page.locator('#workspace-mode button[data-mode=catalog]').click(); await page.waitForTimeout(600);
  await page.locator('#workspace-mode button[data-mode=room]').click(); await page.waitForTimeout(1200);
  await orbitDown(page);
  const e1 = await st(page);
  await page.locator('#room-ingress button[data-ingress=template]').click(); await page.waitForTimeout(700); await settle(page);
  const e2 = await st(page);
  out.ingressTab = { before: e1.elevationDeg, after: e2.elevationDeg, deltaDeg: +(e2.elevationDeg - e1.elevationDeg).toFixed(2), ingress: await page.evaluate(() => document.body.dataset.roomIngress) };
  await page.locator('#room-ingress button[data-ingress=scratch]').click(); await page.waitForTimeout(300);
  // ingress tab while a tool is on: does the tool stay?
  await page.click('#btn-place-mode'); await page.waitForTimeout(300);
  await page.locator('#room-ingress button[data-ingress=template]').click(); await page.waitForTimeout(500);
  out.ingressTabWhilePlaceOn = await st(page);
  await page.locator('#room-ingress button[data-ingress=scratch]').click(); await page.waitForTimeout(300);
  // Product -> Room must still frame the room (and leave tool mode)
  await page.locator('#workspace-mode button[data-mode=catalog]').click(); await page.waitForTimeout(800);
  out.inProduct = await st(page);
  await page.locator('#workspace-mode button[data-mode=room]').click(); await page.waitForTimeout(1200);
  out.productThenRoom = await st(page);
  // tool button clicked from the Product workspace (room card is still on screen there)
  await page.locator('#workspace-mode button[data-mode=catalog]').click(); await page.waitForTimeout(800);
  await page.click('#btn-place-mode'); await page.waitForTimeout(900);
  out.toolFromProduct = await st(page);
  await ctx.close();
  return { ...out, errors };
});

// ---- QA-06: Cmd/Ctrl+Z inside a field ------------------------------------------------------------------
await section('QA06_undo_in_field', async () => {
  const { ctx, page, errors } = await fresh();
  await openRoom(page);
  await createRoom(page, 'living');
  // real pointer placement: tool on, orbit so the floor shows, click two floor points
  await page.click('#btn-place-mode'); await page.waitForTimeout(400);
  await orbitDown(page);
  const out = { placedWith: 'real pointer clicks' };
  for (let i = 0; i < 2; i++) {
    const p = await floorPoint(page, i);
    if (!p) { out.noFloorPoint = true; break; }
    const n = await placements(page);
    await page.mouse.click(p.x, p.y);
    await page.waitForFunction((n) => window.__rv.roomGraph().placements.length === n + 1, n, { timeout: 15000 });
    await page.waitForTimeout(500);
  }
  out.activeElementAfterCanvasClick = await page.evaluate(() => document.activeElement?.id || document.activeElement?.tagName);
  out.placementsBefore = await placements(page);
  const lengthBefore = await page.inputValue('#room-length');
  await page.locator('#room-length').click();
  await page.keyboard.press('End');
  await page.keyboard.type('9');
  out.fieldAfterTyping = await page.inputValue('#room-length');
  const mod = process.platform === 'darwin' ? 'Meta' : 'Control';
  await page.keyboard.press(`${mod}+z`);
  await page.waitForTimeout(500);
  out.afterUndoKeyInField = { placements: await placements(page), field: await page.inputValue('#room-length'), fieldBeforeTyping: lengthBefore, status: await page.locator('#room-status').textContent() };
  // Esc inside the field must not leave the tool
  out.modeBeforeEscInField = (await st(page)).mode;
  await page.keyboard.press('Escape'); await page.waitForTimeout(300);
  out.modeAfterEscInField = (await st(page)).mode;
  // outside a field the shortcut must still work
  await page.locator('h1, .brand').first().click();
  await page.waitForTimeout(200);
  out.activeElementOutside = await page.evaluate(() => document.activeElement?.id || document.activeElement?.tagName);
  const n0 = await placements(page);
  await page.keyboard.press(`${mod}+z`);
  await page.waitForTimeout(700);
  out.afterUndoKeyOutsideField = { placementsBefore: n0, placements: await placements(page), status: await page.locator('#room-status').textContent() };
  await page.keyboard.press(`${mod}+Shift+z`);
  await page.waitForTimeout(700);
  out.afterRedoKeyOutsideField = { placements: await placements(page) };
  // checkbox focus (an <input>): what happens to Esc and undo there
  await page.locator('#place-wall-snap').click();
  out.activeElementAfterCheckbox = await page.evaluate(() => document.activeElement?.id || document.activeElement?.tagName);
  const n1 = await placements(page);
  await page.keyboard.press(`${mod}+z`);
  await page.waitForTimeout(500);
  out.undoWithCheckboxFocused = { placementsBefore: n1, placements: await placements(page) };
  await ctx.close();
  return { ...out, errors };
});

// ---- QA-07: disabled .btn looks disabled ---------------------------------------------------------------
await section('QA07_disabled', async () => {
  const { ctx, page, errors } = await fresh();
  await openRoom(page);
  await createRoom(page, 'living');
  const css = (sel) => page.evaluate((sel) => { const e = document.querySelector(sel); const s = getComputedStyle(e); return { disabled: e.disabled, color: s.color, background: s.backgroundColor, border: s.borderTopColor, opacity: s.opacity, cursor: s.cursor, boxShadow: s.boxShadow }; }, sel);
  const undo = await css('#btn-undo');
  const exp = await css('#btn-export-project');
  const differs = ['color', 'opacity', 'cursor', 'background', 'border', 'boxShadow'].filter((k) => undo[k] !== exp[k]);
  await page.hover('#btn-undo');
  const undoHover = await css('#btn-undo');
  await ctx.close();
  return { undoDisabled: undo, exportEnabled: exp, differsIn: differs, undoHoverBackground: undoHover.background, errors };
});

// ---- QA-18: controls that cannot work with no room -----------------------------------------------------
await section('QA18_no_room', async () => {
  const { ctx, page, errors } = await fresh();
  await openRoom(page);
  const state = () => page.evaluate(() => Object.fromEntries(['btn-save-template-scratch', 'btn-clear-room', 'btn-download-plan'].map((id) => { const e = document.getElementById(id); return [id, { disabled: e.disabled, visible: e.getClientRects().length > 0 && getComputedStyle(e).visibility !== 'hidden' }]; })));
  const out = { noRoom: await state(), hasRoomGraph: await page.evaluate(() => !!window.__rv.roomGraph()) };
  await createRoom(page, 'living');
  out.withRoom = await state();
  // enabled state must be real: Clear room still clears (today it also switches to Product; UX-03 owns that)
  await page.click('#btn-clear-room'); await page.waitForTimeout(800);
  out.afterClear = { hasRoomGraph: await page.evaluate(() => !!window.__rv.roomGraph()), workspace: await page.evaluate(() => document.body.dataset.workspace), ...(await state()) };
  await ctx.close();
  return { ...out, errors };
});

writeFileSync(OUT, JSON.stringify(results, null, 1));
console.log(`\nwritten ${OUT}`);
await browser.close();
