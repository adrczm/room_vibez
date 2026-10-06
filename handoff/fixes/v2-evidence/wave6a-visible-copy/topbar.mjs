import { launch, fresh, OUT } from './lib.mjs';
import fs from 'node:fs';
const browser = await launch();
const res = {};
for (const [w, h, mobile] of [[1920, 1080, false], [1440, 900, false], [1280, 800, false], [1024, 768, false], [861, 800, false], [860, 800, false], [721, 800, false], [720, 800, false], [375, 812, true], [375, 812, false], [320, 568, true]]) {
  const { ctx, page } = await fresh(browser, { viewport: { width: w, height: h }, mobile, settle: 300 });
  const m = () => page.evaluate(() => {
    const r = (el) => el.getBoundingClientRect();
    const hint = document.getElementById('workspace-mode-hint');
    const help = document.getElementById('btn-help');
    return { topbar: r(document.querySelector('.topbar')).height, hintH: r(hint).height, hintLines: Math.round(r(hint).height / parseFloat(getComputedStyle(hint).lineHeight)), stageTop: Math.round(r(document.querySelector('.stage')).top + scrollY),
      help: help ? { w: r(help).width, h: r(help).height, right: Math.round(innerWidth - r(help).right), top: Math.round(r(help).top) } : null, overflowX: document.documentElement.scrollWidth - innerWidth,
      coarse: matchMedia('(pointer: coarse)').matches };
  });
  const product = await m();
  await page.click('#workspace-mode button[data-mode=room]');
  await page.waitForTimeout(150);
  const room = await m();
  await page.click('#workspace-mode button[data-mode=catalog]');
  await page.waitForTimeout(150);
  const back = await m();
  res[`${w}x${h}${mobile ? ' touch' : ''}`] = { product: product.topbar, room: room.topbar, backToProduct: back.topbar, same: product.topbar === room.topbar && back.topbar === product.topbar, hintLines: [product.hintLines, room.hintLines], stageTop: [product.stageTop, room.stageTop], help: product.help, overflowX: [product.overflowX, room.overflowX], coarse: product.coarse };
  await ctx.close();
}
fs.writeFileSync(`${OUT}/out/topbar-after.json`, JSON.stringify(res, null, 2));
for (const [k, v] of Object.entries(res)) console.log(k.padEnd(16), JSON.stringify(v));
await browser.close();
