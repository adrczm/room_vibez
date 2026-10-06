import { chromium } from '/Users/adrian/Desktop/Room Vibez/hackathon-3d-viewer/node_modules/playwright/index.mjs';
const browser = await chromium.launch({ channel: 'chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
await page.goto('http://127.0.0.1:18767/');
await page.waitForFunction(() => document.body.dataset.viewerStatus === 'ready');
await page.waitForTimeout(2000);
await page.locator('#workspace-mode button[data-mode=room]').click(); await page.waitForTimeout(1200);
await page.selectOption('#room-preset', 'living'); await page.click('#btn-create-room'); await page.waitForFunction(() => !!window.__rv.roomGraph()); await page.waitForTimeout(1200);
const st = () => page.evaluate(() => { const v = window.__rv.viewer(); const t = v.controls.target, c = v.camera.position; return { mode: v.getInteractionMode(), place: document.getElementById('btn-place-mode').getAttribute('aria-pressed'), opening: document.getElementById('btn-opening-mode').getAttribute('aria-pressed'), draw: document.getElementById('btn-draw-wall-mode').getAttribute('aria-pressed'), elevationDeg: +((Math.atan2(c.y - t.y, Math.hypot(c.x - t.x, c.z - t.z)) * 180) / Math.PI).toFixed(1) }; });
const out = {};
for (const [name, sel] of [['place', '#btn-place-mode'], ['opening', '#btn-opening-mode'], ['draw-wall', '#btn-draw-wall-mode']]) {
  await page.click(sel); await page.waitForTimeout(400); const on = await st();
  await page.click(sel); await page.waitForTimeout(400); const second = await st();
  await page.click(sel); await page.waitForTimeout(400); const third = await st();
  out[name] = { afterFirstClick: on.mode, afterSecondClick: second.mode, afterThirdClick: third.mode, canToggleOff: second.mode !== name };
}
out.stateAfterCyclingAllThree = await st();
// leave tools by switching workspace
await page.locator('#workspace-mode button[data-mode=catalog]').click(); await page.waitForTimeout(800);
await page.locator('#workspace-mode button[data-mode=room]').click(); await page.waitForTimeout(1200);
out.afterProductThenRoom = await st();
// orbit first, then click the Place button: is the orbit kept?
const c = await page.evaluate(() => { const r = document.querySelector('#viewer-host canvas').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
await page.mouse.move(c.x, c.y - 150); await page.mouse.down(); await page.mouse.move(c.x, c.y - 50, { steps: 8 }); await page.mouse.up(); await page.waitForTimeout(800);
out.afterOrbit = await st();
await page.click('#btn-place-mode'); await page.waitForTimeout(600);
out.afterClickingPlaceButton = await st();
// same for the opening button and the ingress tabs
await page.mouse.move(c.x, c.y - 150); await page.mouse.down(); await page.mouse.move(c.x, c.y - 50, { steps: 8 }); await page.mouse.up(); await page.waitForTimeout(800);
const e1 = (await st()).elevationDeg;
await page.locator('#room-ingress button[data-ingress=template]').click(); await page.waitForTimeout(600);
out.ingressTabClick = { elevationBefore: e1, elevationAfter: (await st()).elevationDeg };
console.log(JSON.stringify(out, null, 1));
await browser.close();
