import { chromium } from '/private/tmp/claude-501/-Users-adrian-Desktop-Room-Vibez/7ac663fe-e0d6-4b3c-af69-487be083d847/scratchpad/ws-engine/node_modules/playwright/index.mjs';
const OUT = '/private/tmp/claude-501/-Users-adrian-Desktop-Room-Vibez/7ac663fe-e0d6-4b3c-af69-487be083d847/scratchpad/out-engine';
const floors = JSON.parse(process.argv[2] || '[]');
const browser = await chromium.launch({ channel: 'chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror ' + e.message));
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ' ' + m.text()); });
await page.goto('http://127.0.0.1:18781/');
await page.waitForFunction(() => document.body.dataset.viewerStatus === 'ready', null, { timeout: 60000 });
await page.waitForTimeout(1500);
await page.locator('#workspace-mode button[data-mode=room]').click(); await page.waitForTimeout(800);
await page.selectOption('#room-preset', 'living'); await page.click('#btn-create-room'); await page.waitForFunction(() => !!window.__rv.roomGraph()); await page.waitForTimeout(1200);
// project a world floor point to client coords
const toClient = (x, z) => page.evaluate(([x, z]) => { const v = window.__rv.viewer(); const r = v.canvas.getBoundingClientRect(); const p = new v.camera.position.constructor(x, 0, z).project(v.camera); return { x: r.left + ((p.x + 1) / 2) * r.width, y: r.top + ((1 - p.y) / 2) * r.height }; }, [x, z]);
await page.click('#btn-place-mode'); await page.waitForTimeout(300);
let c = await toClient(0.6, -0.4); await page.mouse.click(c.x, c.y); await page.waitForFunction(() => window.__rv.roomGraph().placements.length === 1); await page.waitForTimeout(800);
await page.selectOption('#product-select', 'demo-side-table'); await page.waitForTimeout(1200);
c = await toClient(-1.2, 0.8); await page.mouse.click(c.x, c.y); await page.waitForFunction(() => window.__rv.roomGraph().placements.length === 2); await page.waitForTimeout(800);
const applied = await page.evaluate(async () => {
  const v = window.__rv.viewer(); const g = window.__rv.roomGraph(); const cat = window.__rv.catalog();
  const out = [];
  for (const pl of g.placements) { const product = cat.products.find((p) => p.id === pl.product_id); out.push(await v.applySlotBindings(v.getPlacementRoot(pl.id), product, pl.slot_bindings)); }
  return out;
});
console.log('applied', JSON.stringify(applied), 'status', await page.locator('#room-status').innerText());
await page.waitForTimeout(800);
const clip = await page.evaluate(() => { const r = document.querySelector('#viewer-host canvas').getBoundingClientRect(); return { x: r.left, y: r.top, width: r.width, height: r.height }; });
for (const floor of floors.length ? floors : [null]) {
  if (floor) await page.evaluate((floor) => { window.__rv.viewer().roomBuilt.materials.floor.color.set(floor); }, floor);
  for (const preset of ['studio-soft', 'warm-interior', 'neutral']) {
    await page.locator('#presets button[data-preset=' + preset + ']').click(); await page.waitForTimeout(700);
    await page.screenshot({ path: `${OUT}/shots/look-${(floor || 'default').replace('#', '')}-${preset}.png`, clip });
  }
}
console.log('console', JSON.stringify(errors));
await browser.close();
