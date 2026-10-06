import { launch, fresh, OUT } from './lib.mjs';
const browser = await launch();
for (const [w, h] of [[1440, 900], [1280, 800]]) {
  const { ctx, page } = await fresh(browser, { viewport: { width: w, height: h }, settle: 500 });
  const m = () => page.evaluate(() => { const p = document.querySelector('.panel'); return { scrollHeight: p.scrollHeight, clientHeight: p.clientHeight, canScroll: p.scrollHeight - p.clientHeight, offsetW: p.offsetWidth, clientW: p.clientWidth }; });
  const out = { product: await m() };
  await page.click('#workspace-mode button[data-mode=room]');
  out.roomEmpty = await m();
  await page.click('#room-ingress button[data-ingress=template]');
  out.roomTemplateTab = await m();
  await page.click('#room-ingress button[data-ingress=import]');
  out.roomImportTab = await m();
  await page.click('#btn-import-fixture');
  await page.waitForSelector('#import-review:not([hidden])');
  out.roomImportReview = await m();
  console.log(`${w}x${h}`, JSON.stringify(out));
  await ctx.close();
}
await browser.close();
