// Does the camera keep moving after a drag with no click at all? (explains the QA probe's +5.8 deg reading)
import { chromium } from '/Users/adrian/Desktop/Room Vibez/v2/hackathon-3d-viewer/node_modules/playwright/index.mjs';
const browser = await chromium.launch({ channel: 'chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
await page.goto('http://127.0.0.1:18777/');
await page.waitForFunction(() => document.body.dataset.viewerStatus === 'ready');
await page.waitForTimeout(1500);
await page.locator('#workspace-mode button[data-mode=room]').click(); await page.waitForTimeout(1200);
await page.selectOption('#room-preset', 'living'); await page.click('#btn-create-room'); await page.waitForFunction(() => !!window.__rv.roomGraph()); await page.waitForTimeout(1200);
const el = () => page.evaluate(() => { const v = window.__rv.viewer(); const t = v.controls.target, c = v.camera.position; return +((Math.atan2(c.y - t.y, Math.hypot(c.x - t.x, c.z - t.z)) * 180) / Math.PI).toFixed(2); });
const c = await page.evaluate(() => { const r = document.querySelector('#viewer-host canvas').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
await page.mouse.move(c.x, c.y - 150); await page.mouse.down(); await page.mouse.move(c.x, c.y - 50, { steps: 8 }); await page.mouse.up();
const t0 = Date.now(); const trace = [];
for (let i = 0; i < 14; i++) { trace.push([Date.now() - t0, await el()]); await page.waitForTimeout(300); }
console.log(JSON.stringify(trace));
await browser.close();
