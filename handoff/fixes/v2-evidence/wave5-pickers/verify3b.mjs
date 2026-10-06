// A real pack (.mjs + .glb): its thumbnail is its own model; pack params and the thumbnail.
import fs from 'node:fs';
import { launch, OUT, BASE } from './lib.mjs';
const browser = await launch();
const TRIG = '.tpicker[data-picker-for=product-select] .tpicker-trigger';
const POP = '.tpicker-popup[data-picker-for=product-select]';
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => { if (m.type() === 'error') errors.push(`console.error: ${m.text().slice(0, 200)}`); });
page.on('dialog', (d) => d.accept());
await page.goto(BASE);
const ready = () => page.waitForSelector('body[data-viewer-status="ready"]', { timeout: 60000 });
await ready();
const i = {};
try {
  await page.click('#product-advanced-summary');
  await page.setInputFiles('#pack-files', ['/Users/adrian/Desktop/Room Vibez/models/core-rulebook-4aedc7.mjs', '/Users/adrian/Desktop/Room Vibez/models/core-rulebook-4aedc7.glb']);
  await page.waitForFunction(() => !!window.__rv.pack(), null, { timeout: 30000 });
  await ready();
  await page.waitForTimeout(500);
  i.pack = await page.evaluate(() => { const p = window.__rv.catalog().products.at(-1); return { id: p.id, name: p.name, userAdded: !!p.userAdded, sourceKind: p.sourceKind, preserve: !!p.preserveMaterials, mapping: p.pack?.mappingMode, completeness: p.pack?.completeness }; });
  i.trigger = await page.evaluate((s) => document.querySelector(s).innerText.replace(/\n/g, ' | '), TRIG);
  await page.click(TRIG);
  await page.waitForSelector(`${POP}:popover-open`);
  await page.waitForFunction((p) => document.querySelectorAll(`${p} [role=option] img`).length === 3, POP, { timeout: 60000 });
  i.tiles = await page.evaluate((p) => [...document.querySelectorAll(`${p} [role=option]`)].map((o) => ({ text: o.innerText.replace(/\n/g, ' | '), kind: o.querySelector('.tpicker-visual').dataset.kind })), POP);
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${OUT}/shots/product-picker-pack-1440x900.png` });
  i.stats = await page.evaluate(() => window.__rv.thumbnails());
  await page.keyboard.press('Escape');
  // pack params: which controls exist, and what a change does to the thumbnail
  i.params = await page.evaluate(() => [...document.querySelectorAll('#pack-params .field')].map((f) => ({ label: f.querySelector('span')?.textContent, tag: f.querySelector('input,select')?.tagName, type: f.querySelector('input')?.type ?? null })));
  const before = await page.evaluate((s) => document.querySelector(`${s} img`)?.src.length, TRIG);
  const sel = await page.$('#pack-params select');
  if (sel) {
    const opts = await sel.evaluate((s) => [...s.options].map((o) => o.value));
    await sel.selectOption(opts[1] ?? opts[0]);
    await page.waitForTimeout(2500);
    i.afterParam = { stats: await page.evaluate(() => window.__rv.thumbnails()), sourceKind: await page.evaluate(() => window.__rv.catalog().products.at(-1).sourceKind), imgLenBefore: before, imgLenAfter: await page.evaluate((s) => document.querySelector(`${s} img`)?.src.length, TRIG), status: await page.evaluate(() => document.getElementById('pack-upload-status').textContent) };
  }
} catch (err) { i.failed = String(err).slice(0, 300); }
i.errors = errors;
fs.writeFileSync(`${OUT}/verify3b.out.json`, JSON.stringify(i, null, 1));
console.log(JSON.stringify(i, null, 1));
await browser.close();
