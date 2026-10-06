import { launch, OUT, BASE } from './lib.mjs';
const browser = await launch();
const go = async (name, setup, viewport = { width: 1280, height: 800 }) => {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  await setup(page);
  await page.goto(BASE);
  await page.waitForSelector('body[data-viewer-status="error"]', { timeout: 30000 });
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/shots/${name}.png` });
  const box = await page.evaluate(() => { const m = document.querySelector('.overlay-message').getBoundingClientRect(); const s = document.querySelector('.stage').getBoundingClientRect(); return { text: document.querySelector('#viewer-overlay').textContent, w: Math.round(m.width), h: Math.round(m.height), insideStage: m.left >= s.left && m.right <= s.right }; });
  console.log(name, JSON.stringify(box));
  await ctx.close();
};
await go('1280-30-overlay-could-not-start', (p) => p.route('**/assets/library/catalog.json', (r) => r.fulfill({ status: 500, body: 'no' })));
await go('1280-31-overlay-model-failed', (p) => p.route('**/*.glb', (r) => r.fulfill({ status: 404, body: 'gone' })));
await go('1280-32-overlay-no-webgl', (p) => p.addInitScript(() => { const o = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function (t, ...r) { return /webgl/i.test(t) ? null : o.call(this, t, ...r); }; }));
await go('375-32-overlay-no-webgl', (p) => p.addInitScript(() => { const o = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function (t, ...r) { return /webgl/i.test(t) ? null : o.call(this, t, ...r); }; }), { width: 375, height: 812 });
// A real browser without WebGL (no SwiftShader, GPU off): what the engine really throws there.
{
  const { chromium } = await import('/Users/adrian/Desktop/Room Vibez/v2/hackathon-3d-viewer/node_modules/playwright/index.mjs');
  const b2 = await chromium.launch({ channel: 'chrome', args: ['--disable-gpu', '--disable-3d-apis'] });
  const page = await b2.newPage({ viewport: { width: 1280, height: 800 } });
  const logs = []; page.on('console', (m) => m.type() === 'error' && logs.push(m.text().slice(0, 200)));
  await page.goto(BASE);
  await page.waitForSelector('body[data-viewer-status="error"]', { timeout: 30000 });
  console.log('real no-WebGL browser:', await page.locator('#viewer-overlay').textContent(), '| console:', logs.slice(0, 2));
  await page.screenshot({ path: `${OUT}/shots/1280-33-overlay-no-webgl-real-browser.png` });
  await b2.close();
}
await browser.close();
