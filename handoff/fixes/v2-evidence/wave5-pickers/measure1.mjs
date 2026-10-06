// Layout after the swatch names: Product arrival and the Place step, at 1440x900 and 1280x800; 375x812 mobile.
import { launch, fresh, createRoom, openStep, OUT } from './lib.mjs';
const browser = await launch();
const out = {};
const m = (page) => page.evaluate(() => {
  const panel = document.querySelector('.panel');
  const pr = panel.getBoundingClientRect();
  const r = (sel) => { const e = document.querySelector(sel); if (!e || e.offsetParent === null) return null; const b = e.getBoundingClientRect(); return { top: Math.round(b.top), bottom: Math.round(b.bottom), h: Math.round(b.height), w: Math.round(b.width) }; };
  const inView = (sel) => { const e = document.querySelector(sel); if (!e) return null; const b = e.getBoundingClientRect(); return b.height > 0 && b.top >= pr.top && b.bottom <= pr.bottom; };
  return { panel: { top: Math.round(pr.top), bottom: Math.round(pr.bottom), h: Math.round(pr.height), scrollTop: Math.round(panel.scrollTop), scrollH: panel.scrollHeight },
    scrollY: Math.round(scrollY), docOverflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    toolbar: r('#room-toolbar'), trigger: r('.tpicker[data-picker-for=product-select] .tpicker-trigger'), card: r('#materials-card'), slots: r('#slots'),
    rows: [...document.querySelectorAll('#slots .swatches')].map((e) => { const b = e.getBoundingClientRect(); return { top: Math.round(b.top), h: Math.round(b.height), tiles: e.children.length, inView: b.top >= pr.top && b.bottom <= pr.bottom }; }),
    names: [...document.querySelectorAll('#slots .swatch-name')].map((e) => ({ t: e.textContent, w: Math.round(e.getBoundingClientRect().width), cut: e.scrollWidth > e.clientWidth, h: Math.round(e.getBoundingClientRect().height) })),
    swatch: r('#slots .swatch'), tile: r('#slots .swatch-tile'),
    add: r('#btn-add-to-room'), place: r('#btn-place-mode'), step: r('.step[data-step=place]'), stepTitle: r('#step-place-title'),
    inView: { slots: inView('#slots'), picker: inView('#product-select'), add: inView('#btn-add-to-room'), place: inView('#btn-place-mode') } };
});
for (const [w, h] of [[1440, 900], [1280, 800]]) {
  const { ctx, page, errors } = await fresh(browser, { viewport: { width: w, height: h } });
  out[`${w}x${h}:product`] = await m(page);
  await page.screenshot({ path: `${OUT}/shots/m1-product-${w}x${h}.png` });
  await createRoom(page);
  await openStep(page, 'place');
  await page.waitForTimeout(500);
  out[`${w}x${h}:room-place`] = await m(page);
  await page.screenshot({ path: `${OUT}/shots/m1-room-place-${w}x${h}.png` });
  await page.selectOption('#product-select', 'demo-side-table');
  await page.waitForFunction(() => window.__rv.parts()?.productId === 'demo-side-table');
  await page.waitForTimeout(500);
  out[`${w}x${h}:room-place-table`] = await m(page);
  out[`${w}x${h}:errors`] = errors;
  await ctx.close();
}
{
  const { ctx, page, errors } = await fresh(browser, { viewport: { width: 375, height: 812 }, mobile: true });
  out['375x812:product'] = await m(page);
  out['375x812:coarse'] = await page.evaluate(() => matchMedia('(pointer: coarse)').matches);
  await page.screenshot({ path: `${OUT}/shots/m1-product-375x812.png`, fullPage: true });
  out['375x812:errors'] = errors;
  await ctx.close();
}
console.log(JSON.stringify(out));
await browser.close();
