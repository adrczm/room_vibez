import { launch, fresh, createRoom, openStep, OUT } from './lib.mjs';
const browser = await launch();
const { ctx, page } = await fresh(browser, { settle: 300 });
await createRoom(page);
await openStep(page, 'place');
await page.waitForTimeout(400);
const r = await page.evaluate(() => {
  const rect = (el) => { const b = el.getBoundingClientRect(); return [+(b.top).toFixed(1), +(b.bottom).toFixed(1)]; };
  const tb = document.getElementById('room-toolbar');
  const cs = getComputedStyle(tb);
  const p = document.querySelector('#step-place-body > p');
  return { toolbar: rect(tb), toolbarBg: cs.backgroundColor, toolbarClass: tb.className, toolbarPad: cs.padding, toolbarShadow: cs.boxShadow.slice(0, 40), para: rect(p), slot: rect(document.getElementById('product-picker-slot')), trigger: rect(document.querySelector('.tpicker[data-picker-for=product-select] .tpicker-trigger')), panelScrollPad: getComputedStyle(document.querySelector('.panel')).scrollPaddingTop, card: rect(document.getElementById('room-card')) };
});
console.log(JSON.stringify(r, null, 1));
await page.screenshot({ path: `${OUT}/shots/probe4-toolbar-edge.png`, clip: { x: 1084, y: 110, width: 340, height: 120 } });
await ctx.close(); await browser.close();
