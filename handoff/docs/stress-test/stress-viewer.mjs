import { fileURLToPath } from 'node:url';
// Adversarial checks against the running Catalog 3D viewer (http://127.0.0.1:18767).
// Isolated Playwright profile (fresh localStorage); writes only to ./out. Read-only against project files.
import { chromium } from '../../hackathon-3d-viewer/node_modules/playwright/index.mjs';
import { writeFileSync, mkdirSync } from 'node:fs';

const OUT = fileURLToPath(new URL('./out/viewer', import.meta.url));
mkdirSync(OUT, { recursive: true });
const BASE = 'http://127.0.0.1:18767/';
const results = [];
const rec = (id, name, observed) => { results.push({ id, name, observed }); console.log(id, '|', name, '|', JSON.stringify(observed)); };

const browser = await chromium.launch({ channel: 'chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });

async function fresh({ viewport = { width: 1280, height: 900 }, init } = {}) {
  const ctx = await browser.newContext({ viewport });
  if (init) await ctx.addInitScript(init);
  const page = await ctx.newPage();
  const errors = []; const dialogs = [];
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
  page.on('console', (m) => m.type() === 'error' && !/favicon/i.test(m.text()) && errors.push('CONSOLE: ' + m.text().slice(0, 160)));
  page.on('dialog', async (d) => { dialogs.push({ type: d.type(), message: d.message().slice(0, 400) }); await d.dismiss(); });
  await page.goto(BASE);
  return { ctx, page, errors, dialogs };
}
const status = (page) => page.evaluate(() => document.body.getAttribute('data-viewer-status'));
const waitReady = (page, ms = 15000) => page.waitForFunction(() => document.body.getAttribute('data-viewer-status') === 'ready', null, { timeout: ms }).then(() => true).catch(() => false);
const txt = (page, sel) => page.locator(sel).first().innerText().catch(() => '(missing)');
const room = (page) => page.evaluate(() => { const g = window.__rv?.roomGraph?.(); return g ? { walls: g.walls.length, rooms: g.rooms.length, ceiling: g.rooms[0]?.ceiling_height } : null; });
async function openRoom(page) { await page.locator('#workspace-mode button[data-mode=room]').click(); }

// V01 custom room dimensions
{
  const { ctx, page, errors } = await fresh(); await waitReady(page); await openRoom(page);
  await page.selectOption('#room-preset', 'custom');
  const cases = [['0', '0', '0'], ['-3', '4', '2.7'], ['', '', ''], ['1e9', '1e9', '2.7'], ['0.001', '0.001', '0.001'], ['3', '3', '-1']];
  const out = [];
  for (const [l, w, c] of cases) {
    await page.fill('#room-length', l).catch(() => {}); await page.fill('#room-width', w).catch(() => {}); await page.fill('#room-ceiling', c).catch(() => {});
    await page.click('#btn-create-room'); await page.waitForTimeout(250);
    out.push({ input: `${l}|${w}|${c}`, roomAfter: await room(page), msg: (await txt(page, '#room-status')).slice(0, 100), isError: await page.locator('#room-status').evaluate((e) => e.classList.contains('error')), viewer: await status(page) });
  }
  rec('V01', 'Custom room: zero / negative / empty / 1e9 / tiny / negative ceiling (text input cannot be typed into a number field, so it is not tested)', { cases: out, errors: errors.slice(0, 5) });
  await ctx.close();
}

// V02 corrupt persisted room graph + V03 corrupt templates
for (const [id, key, val] of [
  ['V02a', 'catalog3d.roomGraph', '[[['],
  ['V02b', 'catalog3d.roomGraph', '{"walls":null,"rooms":"x"}'],
  ['V02c', 'catalog3d.roomGraph', JSON.stringify({ schema_version: 1, rooms: [{ id: 'r', floor_polygon: [{ x: NaN, z: 0 }], ceiling_height: 'tall' }], walls: [{ id: 'w', a: { x: 0, z: 0 }, b: { x: 0, z: 0 }, thickness: 0 }], openings: [], placements: [] })],
  ['V03a', 'catalog3d.roomTemplates', '{bad'],
  ['V03b', 'catalog3d.roomTemplates', '[1,null,{"x":1},"str"]'],
]) {
  const { ctx, page, errors } = await fresh({ init: `try{localStorage.setItem(${JSON.stringify(key)}, ${JSON.stringify(val)})}catch(e){}` });
  const ready = await waitReady(page);
  let tpl = null;
  if (id.startsWith('V03')) { await openRoom(page); await page.locator('#room-ingress button[data-ingress=template], #room-ingress button:has-text("template")').first().click().catch(() => {}); await page.waitForTimeout(300); tpl = (await txt(page, '#template-list')).slice(0, 120); }
  rec(id, `Corrupt ${key} = ${val.slice(0, 40)}`, { appReady: ready, room: await room(page), templateListText: tpl, errors: errors.slice(0, 4) });
  await ctx.close();
}

// V04 import project JSON (adversarial)
{
  const { ctx, page, errors } = await fresh(); await waitReady(page); await openRoom(page);
  await page.selectOption('#room-preset', 'living'); await page.click('#btn-create-room'); await page.waitForTimeout(300);
  const before = await room(page);
  const bad = [
    ['not-json.json', 'this is not json'],
    ['wrong-schema.json', JSON.stringify({ schema_version: 99 })],
    ['array.json', '[]'],
    ['empty.json', ''],
    ['nan-walls.json', JSON.stringify({ schema_version: 1, room_graph: { rooms: [], walls: [{ a: { x: null, z: 0 }, b: { x: 1, z: 1 } }] } })],
  ];
  const out = [];
  for (const [name, body] of bad) {
    await page.setInputFiles('#project-file', { name, mimeType: 'application/json', buffer: Buffer.from(body) });
    await page.waitForTimeout(300);
    out.push({ file: name, msg: (await txt(page, '#room-status')).slice(0, 140), isError: await page.locator('#room-status').evaluate((e) => e.classList.contains('error')), roomStillThere: JSON.stringify(await room(page)) === JSON.stringify(before) });
  }
  rec('V04', 'Import project JSON: garbage / wrong schema / empty / NaN walls (does the existing room survive?)', { before, out, errors: errors.slice(0, 4) });
  await ctx.close();
}

// V05 broken model uploads
{
  const { ctx, page, errors } = await fresh(); await waitReady(page);
  const optsBefore = await page.locator('#product-select option').count();
  const tries = [
    ['broken.glb', 'model/gltf-binary', Buffer.from([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11])],
    ['empty.glb', 'model/gltf-binary', Buffer.alloc(0)],
    ['garbage.obj', 'text/plain', Buffer.from('this is not an obj\n\x00\x01\x02')],
    ['no-faces.obj', 'text/plain', Buffer.from('# no geometry\nv 0 0 0\nv 1 0 0\n')],
    ['renamed.txt.glb', 'model/gltf-binary', Buffer.from('<html>not a model</html>')],
  ];
  const out = [];
  for (const [name, mt, buf] of tries) {
    await page.setInputFiles('#model-files', { name, mimeType: mt, buffer: buf });
    await page.waitForTimeout(700);
    out.push({ file: name, msg: (await txt(page, '#model-upload-status')).slice(0, 140), isError: await page.locator('#model-upload-status').evaluate((e) => e.classList.contains('error')).catch(() => null), optionsNow: await page.locator('#product-select option').count(), viewer: await status(page) });
  }
  rec('V05', 'Broken / empty / mislabeled model uploads', { optsBefore, out, errors: errors.slice(0, 4) });
  await page.screenshot({ path: OUT + '/V05-after-broken-uploads.png' });
  await ctx.close();
}

// V06 rapid toggling & product switching
{
  const { ctx, page, errors } = await fresh(); await waitReady(page);
  for (let i = 0; i < 40; i++) {
    await page.locator('#workspace-mode button[data-mode=' + (i % 2 ? 'room' : 'catalog') + ']').click({ timeout: 2000 }).catch(() => {});
    if (i % 5 === 0) await page.selectOption('#product-select', i % 10 === 0 ? 'demo-lounge-chair' : 'demo-side-table').catch(() => {});
  }
  const ready = await waitReady(page, 20000);
  rec('V06', '40 rapid workspace toggles + product switches', { ready, canvases: await page.locator('#viewer-host canvas').count(), errors: errors.slice(0, 4) });
  await ctx.close();
}

// V07 undo/redo on empty history
{
  const { ctx, page, errors } = await fresh(); await waitReady(page); await openRoom(page);
  const u = await page.locator('#btn-undo').isDisabled().catch(() => 'n/a'); const r = await page.locator('#btn-redo').isDisabled().catch(() => 'n/a');
  await page.locator('#btn-undo').click({ force: true, timeout: 1500 }).catch(() => {});
  rec('V07', 'Undo/redo with no room', { undoDisabled: u, redoDisabled: r, errors: errors.slice(0, 3) });
  await ctx.close();
}

// V08 import plan with garbage "DWG"
{
  const { ctx, page, errors } = await fresh(); await waitReady(page); await openRoom(page);
  await page.locator('#room-ingress button:has-text("Import")').first().click().catch(() => {});
  await page.setInputFiles('#plan-file', { name: 'garbage.dwg', mimeType: 'application/acad', buffer: Buffer.from('random bytes, not a DWG \x00\x01') });
  await page.click('#btn-import-plan').catch(() => {});
  await page.waitForTimeout(800);
  rec('V08', 'Garbage bytes named .dwg through "Import plan"', { importStatus: (await txt(page, '#import-status')).slice(0, 200), banner: (await txt(page, '#import-extract-banner')).slice(0, 200), walls: (await txt(page, '#import-wall-list')).slice(0, 100), errors: errors.slice(0, 3) });
  await page.screenshot({ path: OUT + '/V08-garbage-dwg.png', fullPage: true });
  // also an exe renamed
  await page.setInputFiles('#plan-file', { name: 'setup.exe', mimeType: 'application/x-msdownload', buffer: Buffer.from('MZ\x90\x00') });
  await page.click('#btn-import-plan').catch(() => {}); await page.waitForTimeout(500);
  rec('V08b', '.exe through "Import plan"', { importStatus: (await txt(page, '#import-status')).slice(0, 200), accept: await page.locator('#plan-file').getAttribute('accept') });
  await ctx.close();
}

// V09 .mjs guardrail (dialogs are DISMISSED, never accepted; nothing executes)
{
  const { ctx, page, dialogs } = await fresh(); await waitReady(page);
  const mjs = 'export default function createAsset(){ fetch("http://127.0.0.1:1/x"); return null }';
  const enabledBefore = await page.locator('#mjs-enabled').isChecked();
  await page.setInputFiles('#module-file', { name: 'evil.mjs', mimeType: 'text/javascript', buffer: Buffer.from(mjs) });
  await page.waitForTimeout(500);
  const msgOff = (await txt(page, '#module-upload-status')).slice(0, 160);
  await page.check('#mjs-enabled').catch(() => {});
  await page.setInputFiles('#module-file', { name: 'evil2.mjs', mimeType: 'text/javascript', buffer: Buffer.from(mjs) });
  await page.waitForTimeout(700);
  rec('V09', '.mjs with network call: flag off, then flag on (confirm dialog dismissed = refuse)', { enabledByDefault: enabledBefore, statusWhenOff: msgOff, dialogs, statusAfterDismiss: (await txt(page, '#module-upload-status')).slice(0, 200) });
  await ctx.close();
}

// V10 storage failure is silent?
{
  const { ctx, page } = await fresh({ init: `Storage.prototype.setItem = function(){ throw new DOMException('quota', 'QuotaExceededError') }` });
  await waitReady(page); await openRoom(page);
  await page.selectOption('#room-preset', 'living'); await page.click('#btn-create-room'); await page.waitForTimeout(400);
  rec('V10', 'localStorage full / blocked while editing a room', { roomCreated: await room(page), statusText: (await txt(page, '#room-status')).slice(0, 160), anyWarningMentionsSave: /sav|stor|persist|lost/i.test(await page.locator('body').innerText()) });
  await page.screenshot({ path: OUT + '/V10-storage-blocked.png' });
  await ctx.close();
}

// V11 mobile room workspace
{
  const { ctx, page } = await fresh({ viewport: { width: 375, height: 812 } }); await waitReady(page);
  const cat = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  await openRoom(page); await page.selectOption('#room-preset', 'living'); await page.click('#btn-create-room'); await page.waitForTimeout(500);
  const rm = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  rec('V11', 'Mobile 375px horizontal overflow (px): catalog vs room workspace', { catalog: cat, roomWithPlan: rm });
  await page.screenshot({ path: OUT + '/V11-mobile-room.png' });
  await ctx.close();
}

// V12 keyboard/a11y of the 3D stage
{
  const { ctx, page } = await fresh(); await waitReady(page);
  rec('V12', 'Canvas keyboard/a11y affordances', await page.evaluate(() => { const c = document.querySelector('#viewer-host canvas'); return { tabindex: c?.getAttribute('tabindex'), ariaLabel: c?.getAttribute('aria-label'), role: c?.getAttribute('role'), hostAria: document.querySelector('#viewer-host')?.getAttribute('aria-label') }; }));
  await ctx.close();
}

writeFileSync(OUT + '/results.json', JSON.stringify(results, null, 2));
await browser.close();
console.log('DONE', results.length);
