// What happens when a candidates .json has walls without thickness/height (valid per parseCandidatesPayload, not a usable room)?
// The room has a ceiling_height so the host's review list renders; the walls have no thickness or height.
import { chromium } from '/private/tmp/claude-501/-Users-adrian-Desktop-Room-Vibez/7ac663fe-e0d6-4b3c-af69-487be083d847/scratchpad/ws-data/node_modules/playwright/index.mjs';
const BASE = process.env.RV_BASE || 'http://127.0.0.1:18782/';
const browser = await chromium.launch({ channel: 'chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ready = (page) => page.waitForFunction(() => ['ready', 'error'].includes(document.body.dataset.viewerStatus), null, { timeout: 60000 });
const payload = {
  schema_version: 1, label: 'Hand-written plan',
  walls: [
    { id: 'a', a: { x: 0, z: 0 }, b: { x: 4, z: 0 } },
    { id: 'b', a: { x: 4, z: 0 }, b: { x: 4, z: 3 } },
    { id: 'c', a: { x: 4, z: 3 }, b: { x: 0, z: 3 } },
    { id: 'd', a: { x: 0, z: 3 }, b: { x: 0, z: 0 } },
  ],
  rooms: [{ id: 'r', floor_polygon: [{ x: 0, z: 0 }, { x: 4, z: 0 }, { x: 4, z: 3 }, { x: 0, z: 3 }], ceiling_height: 2.7, wall_candidate_ids: ['a', 'b', 'c', 'd'] }],
};
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message.slice(0, 160)));
page.on('console', (m) => m.type() === 'error' && errors.push('console: ' + m.text().slice(0, 160)));
await page.goto(BASE); await ready(page);
// Start from an existing room, to see whether it survives.
await page.locator('#workspace-mode button[data-mode=room]').click();
await page.selectOption('#room-preset', 'living'); await page.click('#btn-create-room');
await page.waitForFunction(() => !!window.__rv.roomGraph());
await page.locator('#room-ingress button[data-ingress=import]').click();
await page.setInputFiles('#plan-file', { name: 'hand.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(payload)) });
await page.click('#btn-import-plan');
await page.waitForTimeout(1500);
const review = await page.evaluate(() => ({ reviewVisible: !document.getElementById('import-review').hidden, importStatus: document.getElementById('import-status').textContent }));
await page.click('#btn-import-start-editing').catch((e) => errors.push('click: ' + e.message.slice(0, 100)));
await page.waitForTimeout(1500);
const after = await page.evaluate(() => { const g = window.__rv.roomGraph(); return { importStatus: document.getElementById('import-status').textContent, importStatusIsError: document.getElementById('import-status').classList.contains('error'), roomStatus: document.getElementById('room-status').textContent, appRoom: g ? `${g.label}, ${g.walls.length} walls, thickness ${g.walls[0].thickness}` : null, stored: (localStorage.getItem('catalog3d.roomGraph') || '').slice(0, 60), viewerStatus: document.body.dataset.viewerStatus }; });
await page.reload(); await ready(page); await page.waitForTimeout(600);
const afterReload = await page.evaluate(() => ({ viewerStatus: document.body.dataset.viewerStatus, appRoom: window.__rv?.roomGraph?.()?.label ?? null, overlay: document.getElementById('viewer-overlay')?.innerText.slice(0, 100) }));
console.log(JSON.stringify({ review, after, afterReload, errors }, null, 1));
await browser.close();
