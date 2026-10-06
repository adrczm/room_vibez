import { fileURLToPath } from 'node:url';
import { chromium } from '../../hackathon-3d-viewer/node_modules/playwright/index.mjs';
import { mkdirSync } from 'node:fs';
const OUT = fileURLToPath(new URL('./out/viewer', import.meta.url));
mkdirSync(OUT, { recursive: true });
const BASE = 'http://127.0.0.1:18767/';
const browser = await chromium.launch({ channel: 'chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const waitReady = (page, ms = 8000) => page.waitForFunction(() => document.body.getAttribute('data-viewer-status') === 'ready', null, { timeout: ms }).then(() => true).catch(() => false);
const log = (...a) => console.log(...a.map((x) => (typeof x === 'string' ? x : JSON.stringify(x))));

// F1: poison once (no init script), then reload twice - does the app recover on its own?
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage(); const errs = [];
  page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => m.type() === 'error' && errs.push(m.text().slice(0, 140)));
  await page.goto(BASE); await waitReady(page);
  const poison = JSON.stringify({ schema_version: 1, rooms: [{ id: 'r', floor_polygon: [{ x: null, z: 0 }], ceiling_height: 'tall' }], walls: [{ id: 'w', a: { x: 0, z: 0 }, b: { x: 0, z: 0 }, thickness: 0 }], openings: [], placements: [] });
  await page.evaluate((p) => localStorage.setItem('catalog3d.roomGraph', p), poison);
  const result = [];
  for (let i = 1; i <= 2; i++) {
    errs.length = 0; await page.reload(); const ready = await waitReady(page);
    result.push({ reload: i, ready, status: await page.evaluate(() => document.body.getAttribute('data-viewer-status')), keyStillPresent: await page.evaluate(() => !!localStorage.getItem('catalog3d.roomGraph')), firstError: errs[0]?.slice(0, 120), overlayText: (await page.locator('#viewer-overlay').innerText().catch(() => '')).slice(0, 120), canvasCount: await page.locator('#viewer-host canvas').count() });
  }
  await page.screenshot({ path: OUT + '/F1-poisoned-storage.png' });
  log('F1', result);
  await ctx.close();
}

// F2: .mjs flag unchecked
{
  const ctx = await browser.newContext(); const page = await ctx.newPage(); const dialogs = [];
  page.on('dialog', async (d) => { dialogs.push(d.message().slice(0, 80)); await d.dismiss(); });
  await page.goto(BASE); await waitReady(page);
  const def = await page.locator('#mjs-enabled').isChecked();
  await page.uncheck('#mjs-enabled');
  await page.setInputFiles('#module-file', { name: 'x.mjs', mimeType: 'text/javascript', buffer: Buffer.from('export default function createAsset(){ return null }') });
  await page.waitForTimeout(500);
  log('F2', { mjsFlagCheckedByDefault: def, statusWhenFlagOff: (await page.locator('#module-upload-status').innerText()).slice(0, 200), dialogsShown: dialogs });
  await ctx.close();
}

// F3: storage blocked -> any user-visible warning? Compare visible text of status regions + any .error/.warn nodes
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.addInitScript(() => { Storage.prototype.setItem = function () { throw new DOMException('quota', 'QuotaExceededError'); }; });
  const page = await ctx.newPage(); await page.goto(BASE); await waitReady(page);
  await page.locator('#workspace-mode button[data-mode=room]').click();
  const before = await page.locator('body').innerText();
  await page.selectOption('#room-preset', 'living'); await page.click('#btn-create-room'); await page.waitForTimeout(500);
  const after = await page.locator('body').innerText();
  const added = after.split('\n').filter((l) => !before.split('\n').includes(l));
  log('F3', { newVisibleLinesAfterCreate: added.slice(0, 12), mentionsNotSaved: /not (be )?saved|storage (is )?(full|blocked)|won.t (be )?(saved|persist)/i.test(after) });
  await ctx.close();
}
await browser.close();
