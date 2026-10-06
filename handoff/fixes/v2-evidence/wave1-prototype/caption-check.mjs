// Is the 3D caption inside the window at 1280x800 and 375x812, with an empty project and with products placed? Works on both copies.
import { pathToFileURL } from 'node:url';
import { chromium } from '/Users/adrian/Desktop/Room Vibez/v2/hackathon-3d-viewer/node_modules/playwright/index.mjs';
const URL_ = pathToFileURL(process.argv[2]).href;
const browser = await chromium.launch({ channel: 'chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
for (const three of ['real', 'blocked']) for (const vp of [{ width: 1280, height: 800 }, { width: 375, height: 812 }]) for (const filled of [false, true]) {
  const ctx = await browser.newContext({ viewport: vp }); const page = await ctx.newPage();
  if (three === 'blocked') await page.route(/unpkg\.com/, (r) => r.abort());
  await page.goto(URL_); await page.waitForTimeout(900);
  await page.evaluate(() => document.querySelector('.role-card[data-role=designer]').click());
  await page.evaluate(() => document.getElementById('btnSkipDemo').click()); await page.waitForTimeout(200);
  if (filled) { await page.evaluate(() => document.getElementById('btnApplyTemplate').click()); }
  await page.evaluate(() => { scrollTo(0, 0); document.querySelector('.mode-toggle button[data-mode="3d"]').click(); }); await page.waitForTimeout(700);
  const r = await page.evaluate(() => { const p = document.querySelector('#three-host:not([hidden]) p, #three-host:not([hidden]) .draw-hint, #css3d:not([hidden]) p, #css3d:not([hidden]) .draw-hint'); const st = document.getElementById('stage').getBoundingClientRect(); if (!p) return { caption: null }; const b = p.getBoundingClientRect(); const cx = b.left + b.width / 2, cy = b.top + b.height / 2; const hit = cy < innerHeight && cy > 0 ? document.elementFromPoint(cx, cy) : null; return { text: p.innerText.slice(0, 40), rect: [Math.round(b.left), Math.round(b.top), Math.round(b.width), Math.round(b.height)], stage: [Math.round(st.top), Math.round(st.bottom)], innerHeight, fullyInWindowAtTopOfPage: b.top >= 0 && b.bottom <= innerHeight, onTop: hit === p, docScrollH: document.documentElement.scrollHeight }; });
  console.log(`${three.padEnd(7)} ${String(vp.width).padEnd(4)} ${filled ? 'products' : 'template'} `, JSON.stringify(r));
  await ctx.close();
}
await browser.close();
