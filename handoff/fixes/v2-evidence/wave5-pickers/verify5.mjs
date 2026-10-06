// OBJ package upload (tests/fixtures/obj-stool): does its thumbnail draw? Also the pixel numbers of the chair thumbnail.
import fs from 'node:fs';
import path from 'node:path';
import { launch, OUT, BASE } from './lib.mjs';
const browser = await launch();
const TRIG = '.tpicker[data-picker-for=product-select] .tpicker-trigger';
const POP = '.tpicker-popup[data-picker-for=product-select]';
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => { if (m.type() === 'error') errors.push(`console.error: ${m.text().slice(0, 200)}`); });
await page.goto(BASE);
const ready = () => page.waitForSelector('body[data-viewer-status="ready"]', { timeout: 60000 });
await ready();
const out = {};
const dir = '/Users/adrian/Desktop/Room Vibez/v2/hackathon-3d-viewer/tests/fixtures/obj-stool';
const files = fs.readdirSync(dir).filter((f) => !f.startsWith('.')).map((f) => path.join(dir, f));
out.files = files.map((f) => path.basename(f));
try {
  await page.setInputFiles('#model-files', files);
  await page.waitForFunction(() => window.__rv.catalog().products.some((p) => p.userAdded), null, { timeout: 30000 });
  await ready();
  out.product = await page.evaluate(() => { const p = window.__rv.catalog().products.at(-1); return { id: p.id, name: p.name, slotTagging: p.slotTagging, slots: p.slots.length, preserve: !!p.preserveMaterials, sourceKind: p.sourceKind, hasResourceMap: !!p.resourceMap }; });
  out.status = await page.evaluate(() => document.getElementById('model-upload-status').textContent);
  await page.click(TRIG);
  await page.waitForSelector(`${POP}:popover-open`);
  await page.waitForFunction((p) => document.querySelectorAll(`${p} [role=option] img`).length === 3, POP, { timeout: 60000 });
  out.tiles = await page.evaluate((p) => [...document.querySelectorAll(`${p} [role=option]`)].map((o) => ({ text: o.innerText.replace(/\n/g, ' | '), kind: o.querySelector('.tpicker-visual').dataset.kind })), POP);
  out.stats = await page.evaluate(() => window.__rv.thumbnails());
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/shots/product-picker-obj-upload-1440x900.png` });
  // pixel numbers of the chair thumbnail (what the spec asserts)
  out.chairPixels = await page.evaluate(async (p) => {
    const src = document.querySelector(`${p} [role=option][data-id=demo-lounge-chair] img`).src;
    const img = new Image(); img.src = src; await img.decode();
    const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
    const g = c.getContext('2d'); g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height).data;
    let opaque = 0, warm = 0, dark = 0;
    for (let i = 0; i < d.length; i += 4) { if (d[i + 3] < 250) continue; opaque++; if (d[i] > 150 && d[i] - d[i + 2] > 25) warm++; if (d[i] < 70 && d[i + 1] < 70 && d[i + 2] < 70) dark++; }
    return { size: img.naturalWidth, bytes: src.length, opaqueShare: +(opaque / (d.length / 4)).toFixed(3), warmShare: +(warm / opaque).toFixed(3), darkShare: +(dark / opaque).toFixed(3) };
  }, POP);
} catch (err) { out.failed = String(err).slice(0, 300); }
out.errors = errors;
fs.writeFileSync(`${OUT}/verify5.out.json`, JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 1));
await browser.close();
