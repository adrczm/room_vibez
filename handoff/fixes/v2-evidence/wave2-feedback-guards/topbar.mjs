import { launch, fresh, toRoom } from './lib.mjs';
const browser = await launch();
const out = {};
for (const [w, h] of [[1440, 900], [1024, 768], [375, 812]]) {
  const { ctx, page } = await fresh(browser, { width: w, height: h });
  await page.waitForTimeout(1500);
  const m = () => page.evaluate(() => { const t = document.querySelector('.topbar').getBoundingClientRect(); const n = document.querySelector('.workspace-nav').getBoundingClientRect(); const b = document.querySelector('.brand').getBoundingClientRect(); return { topbarH: Math.round(t.height), navLeft: Math.round(n.left), navRight: Math.round(n.right), navTop: Math.round(n.top), brandLeft: Math.round(b.left), brandTop: Math.round(b.top), overflowX: document.documentElement.scrollWidth - innerWidth }; });
  const product = await m();
  await toRoom(page); await page.waitForTimeout(800);
  out[`${w}x${h}`] = { product, room: await m() };
  await ctx.close();
}
console.log(JSON.stringify(out, null, 1));
await browser.close();
