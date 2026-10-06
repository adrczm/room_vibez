// Baseline layout numbers before the swatch names (wave-4 state).
import { launch, fresh, createRoom, openStep } from './lib.mjs';
const browser = await launch();
const out = {};
for (const [w, h] of [[1440, 900], [1280, 800]]) {
  const { ctx, page } = await fresh(browser, { viewport: { width: w, height: h } });
  const m = () => page.evaluate(() => {
    const panel = document.querySelector('.panel');
    const pr = panel.getBoundingClientRect();
    const r = (sel) => { const e = document.querySelector(sel); if (!e) return null; const b = e.getBoundingClientRect(); return { top: Math.round(b.top), bottom: Math.round(b.bottom), h: Math.round(b.height), w: Math.round(b.width) }; };
    return { panel: { top: Math.round(pr.top), bottom: Math.round(pr.bottom), h: Math.round(pr.height), scrollTop: panel.scrollTop, scrollH: panel.scrollHeight, clientW: panel.clientWidth },
      toolbar: r('#room-toolbar'), picker: r('#product-select'), card: r('#materials-card'), slots: r('#slots'), swatches: [...document.querySelectorAll('#slots .swatches')].map((e) => { const b = e.getBoundingClientRect(); return { top: Math.round(b.top), bottom: Math.round(b.bottom), h: Math.round(b.height), w: Math.round(b.width) }; }),
      add: r('#btn-add-to-room'), place: r('#btn-place-mode'), step: r('.step[data-step=place]') };
  });
  out[`${w}x${h}:product`] = await m();
  await createRoom(page);
  await openStep(page, 'place');
  await page.waitForTimeout(500);
  out[`${w}x${h}:room-place`] = await m();
  await ctx.close();
}
console.log(JSON.stringify(out, null, 1));
await browser.close();
