// Final screenshots for the report, 1440x900 and 375x812. Saved to h5/shots/final-*.png
import { launch, OUT, BASE } from './lib.mjs';
const browser = await launch();
const TRIG = (s) => `.tpicker[data-picker-for=${s}] .tpicker-trigger`;
const POP = (s) => `.tpicker-popup[data-picker-for=${s}]`;
const sizes = [
  { tag: '1440x900', opts: { viewport: { width: 1440, height: 900 } } },
  { tag: '375x812', opts: { viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 } },
];
const notes = {};
for (const { tag, opts } of sizes) {
  const ctx = await browser.newContext(opts);
  const page = await ctx.newPage();
  const shot = (name) => page.screenshot({ path: `${OUT}/shots/final-${name}-${tag}.png` });
  const ready = () => page.waitForSelector('body[data-viewer-status="ready"]', { timeout: 60000 });
  await page.goto(BASE);
  await ready();
  await page.waitForTimeout(1500);
  // 1. swatches with names (Product, on arrival)
  if (tag === '375x812') await page.locator('#materials-card').scrollIntoViewIfNeeded();
  await shot('swatch-names-product');
  if (tag === '375x812') await page.evaluate(() => scrollTo(0, 0));
  // 2. Product picker, thumbnail view
  await page.click(TRIG('product-select'));
  await page.waitForSelector(`${POP('product-select')}:popover-open`);
  await page.waitForFunction((p) => document.querySelectorAll(`${p} [role=option] img`).length === 2, POP('product-select'), { timeout: 60000 });
  await page.waitForTimeout(400);
  await shot('product-picker-thumbnails');
  // 3. Product picker, list view (this page only; the choice is put back afterwards)
  await page.click(`${POP('product-select')} [data-view-option=list]`);
  await page.waitForTimeout(300);
  await shot('product-picker-list');
  await page.click(`${POP('product-select')} [data-view-option=grid]`);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  await shot('product-trigger-with-thumbnail');
  // 4. Room > Place products: Materials card visible, then the picker open
  await page.click('#workspace-mode button[data-mode=room]');
  await page.selectOption('#room-preset', 'living');
  await page.click('#btn-create-room');
  await page.waitForFunction(() => (window.__rv.roomGraph()?.walls.length ?? 0) === 4);
  await page.click('.step[data-step=place] .step-toggle');
  await page.waitForTimeout(600);
  notes[`${tag}:placeStep`] = await page.evaluate(() => { const r = (id) => { const b = document.getElementById(id).getBoundingClientRect(); return [Math.round(b.top), Math.round(b.bottom)]; }; const p = document.querySelector('.panel').getBoundingClientRect(); return { panel: [Math.round(p.top), Math.round(p.bottom)], picker: r('product-picker-slot'), card: r('materials-card'), add: r('btn-add-to-room'), place: r('btn-place-mode'), scrollY: Math.round(scrollY), innerHeight }; });
  await shot('room-place-step-materials');
  await page.click(TRIG('product-select'));
  await page.waitForSelector(`${POP('product-select')}:popover-open`);
  await page.waitForTimeout(500);
  await shot('room-place-step-picker-open');
  await page.keyboard.press('Escape');
  // 5. Wall material picker with its category tabs (thumbnail view, then list view)
  await page.click('.step[data-step=finish] .step-toggle');
  await page.waitForTimeout(300);
  await page.click(TRIG('room-wall-material'));
  await page.waitForSelector(`${POP('room-wall-material')}:popover-open`);
  await page.waitForTimeout(500);
  await shot('wall-picker-thumbnails');
  await page.click(`${POP('room-wall-material')} .tpicker-group[data-group=wood]`);
  await page.waitForTimeout(200);
  await shot('wall-picker-tab-wood');
  await page.click(`${POP('room-wall-material')} .tpicker-group[data-group=""]`);
  await page.click(`${POP('room-wall-material')} [data-view-option=list]`);
  await page.waitForTimeout(300);
  await shot('wall-picker-list');
  await page.click(`${POP('room-wall-material')} [data-view-option=grid]`);
  await page.click(`${POP('room-wall-material')} [role=option][data-id=wood-walnut]`);
  await page.waitForFunction(() => window.__rv.roomGraph().rooms[0].wall_material_id === 'wood-walnut');
  await page.waitForTimeout(800);
  await shot('wall-picked-walnut');
  await ctx.close();
}
console.log(JSON.stringify(notes));
await browser.close();
