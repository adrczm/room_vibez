// Final numbers for the report.
import fs from 'node:fs';
import { launch, fresh, createRoom, openStep, OUT, BASE } from './lib.mjs';
const browser = await launch();
const out = { chrome: browser.version() };
const m = (page) => page.evaluate(() => {
  const panel = document.querySelector('.panel');
  const pr = panel.getBoundingClientRect();
  const wide = getComputedStyle(panel).overflowY !== 'visible';
  const fold = wide ? pr.bottom : innerHeight;
  const r = (sel) => { const e = document.querySelector(sel); if (!e || e.offsetParent === null) return null; const b = e.getBoundingClientRect(); return [Math.round(b.top), Math.round(b.bottom)]; };
  const below = (sel) => { const e = document.querySelector(sel); if (!e || e.offsetParent === null) return null; return Math.max(0, Math.round(e.getBoundingClientRect().bottom - fold)); };
  const s = document.getElementById('slots').getBoundingClientRect();
  return { panel: [Math.round(pr.top), Math.round(pr.bottom)], panelScrollTop: Math.round(panel.scrollTop), panelScrollHeight: panel.scrollHeight, scrollY: Math.round(scrollY),
    card: r('#materials-card'), cardH: Math.round(document.getElementById('materials-card').getBoundingClientRect().height), slotsH: Math.round(s.height),
    slotsTopScreens: +((s.top + scrollY) / innerHeight).toFixed(3), slotsBottomScreens: +((s.bottom + scrollY) / innerHeight).toFixed(3),
    trigger: r('.tpicker[data-picker-for=product-select] .tpicker-trigger'), add: r('#btn-add-to-room'), place: r('#btn-place-mode'), pxBelowFold: { add: below('#btn-add-to-room'), place: below('#btn-place-mode') },
    rows: [...document.querySelectorAll('#slots .swatches')].map((e) => Math.round(e.getBoundingClientRect().height)) };
});
for (const [w, h] of [[1440, 900], [1280, 800]]) {
  const { ctx, page } = await fresh(browser, { viewport: { width: w, height: h } });
  out[`${w}x${h} product`] = await m(page);
  await createRoom(page);
  await openStep(page, 'place');
  await page.waitForTimeout(500);
  out[`${w}x${h} room place (chair)`] = await m(page);
  await ctx.close();
}
{
  const { ctx, page } = await fresh(browser, { viewport: { width: 375, height: 812 }, mobile: true });
  out['375x812 product'] = await m(page);
  // The same page with this wave's additions switched off in the page (not in the files): names hidden, 34 px swatches, 34 px trigger.
  await page.addStyleTag({ content: '.swatch-tile{display:contents!important}.swatch-name{display:none!important}.swatches .swatch{width:34px!important;height:34px!important}.tpicker-trigger{min-height:34px!important;height:34px!important}' });
  await page.waitForTimeout(200);
  out['375x812 product, names/44px/trigger switched off in the page'] = await m(page);
  await ctx.close();
}
// a pack whose slots allow every material
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  page.on('dialog', (d) => d.accept());
  await page.goto(BASE);
  await page.waitForSelector('body[data-viewer-status="ready"]', { timeout: 60000 });
  await page.click('#product-advanced-summary');
  await page.setInputFiles('#pack-files', ['/Users/adrian/Desktop/Room Vibez/models/core-rulebook-4aedc7.mjs', '/Users/adrian/Desktop/Room Vibez/models/core-rulebook-4aedc7.glb']);
  await page.waitForFunction(() => !!window.__rv.pack(), null, { timeout: 30000 });
  await page.waitForSelector('body[data-viewer-status="ready"]', { timeout: 60000 });
  await page.waitForTimeout(800);
  out['pack 1440x900'] = await page.evaluate(() => ({ slots: document.querySelectorAll('.slot').length, tilesPerSlot: [...document.querySelectorAll('.slot')].map((s) => s.querySelectorAll('.swatch').length), rowHeights: [...document.querySelectorAll('#slots .swatches')].map((e) => Math.round(e.getBoundingClientRect().height)), cardH: Math.round(document.getElementById('materials-card').getBoundingClientRect().height) }));
  await ctx.close();
}
fs.writeFileSync(`${OUT}/measure2.out.json`, JSON.stringify(out, null, 1));
for (const [k, v] of Object.entries(out)) console.log(k, JSON.stringify(v));
await browser.close();
