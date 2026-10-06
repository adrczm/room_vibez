// First-open time of the product picker with 30 products, thumbnail view and list view. No threshold: the numbers are the result.
import fs from 'node:fs';
import { launch, OUT, BASE } from './lib.mjs';
const browser = await launch();
const TRIG = '.tpicker[data-picker-for=product-select] .tpicker-trigger';
const POP = '.tpicker-popup[data-picker-for=product-select]';
const add28 = (page) => page.evaluate(() => {
  const cat = window.__rv.catalog();
  const sel = document.querySelector('#product-select');
  for (let i = 1; i <= 28; i++) {
    const src = cat.products[i % 2];
    const p = { ...src, id: `dup-${String(i).padStart(2, '0')}`, name: `${src.name.replace(' (demo)', '')} copy ${i}` };
    cat.products.push(p);
    sel.add(new Option(p.name, p.id));
  }
  window.__rv.pickers().product.sync();
});
const runs = { grid: [], list: [] };
for (const view of ['grid', 'list', 'grid', 'list', 'grid', 'list']) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  if (view === 'list') await page.addInitScript(() => localStorage.setItem('catalog3d.pickerView.product', 'list'));
  await page.goto(BASE);
  await page.waitForSelector('body[data-viewer-status="ready"]', { timeout: 60000 });
  await page.waitForTimeout(3000); // let the 3D view settle, so its own frames are not in the numbers
  await add28(page);
  const r = await page.evaluate(async ([t, p]) => {
    const trigger = document.querySelector(t);
    const popup = document.querySelector(p);
    const t0 = performance.now();
    trigger.click();
    const res = { openCallMs: +(performance.now() - t0).toFixed(1), options: popup.querySelectorAll('[role=option]').length, view: popup.dataset.view };
    await new Promise((r) => requestAnimationFrame(r));
    res.firstFrameMs = +(performance.now() - t0).toFixed(1);
    await new Promise((r) => requestAnimationFrame(r));
    res.secondFrameMs = +(performance.now() - t0).toFixed(1);
    if (res.view === 'grid') {
      // first image, then every tile that is on screen
      await new Promise((r) => { const tick = () => (popup.querySelector('[role=option] img') ? r() : setTimeout(tick, 16)); tick(); });
      res.firstImageMs = Math.round(performance.now() - t0);
      await new Promise((r) => { const tick = () => { const s = window.__rv.thumbnails(); s && s.pending === 0 ? r() : setTimeout(tick, 50); }; tick(); });
      res.tilesOnScreenDrawnMs = Math.round(performance.now() - t0);
      res.tilesDrawn = window.__rv.thumbnails().renders;
    } else {
      await new Promise((r) => setTimeout(r, 2000));
      res.thumbnailsAfter2s = window.__rv.thumbnails();
    }
    return res;
  }, [TRIG, POP]);
  runs[view].push(r);
  await ctx.close();
}
fs.writeFileSync(`${OUT}/timing.out.json`, JSON.stringify(runs, null, 1));
console.log(JSON.stringify(runs));
await browser.close();
