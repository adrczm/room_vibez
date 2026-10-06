import { launch, fresh, createRoom, openStep, vocab, waitPlacements, OUT } from './lib.mjs';
import fs from 'node:fs';
const browser = await launch();
const res = { topbar: {}, vocab: {} };
for (const [w, h, mobile] of [[1440, 900, false], [1024, 768, false], [860, 800, false], [721, 800, false], [375, 812, true], [320, 568, true]]) {
  const { ctx, page } = await fresh(browser, { viewport: { width: w, height: h }, mobile });
  const hgt = () => page.evaluate(() => ({ topbar: document.querySelector('.topbar').getBoundingClientRect().height, hintLines: Math.round(document.getElementById('workspace-mode-hint').getBoundingClientRect().height), stageTop: Math.round(document.querySelector('.stage').getBoundingClientRect().top + scrollY) }));
  const product = await hgt();
  await page.click('#workspace-mode button[data-mode=room]');
  await page.waitForTimeout(200);
  const room = await hgt();
  res.topbar[`${w}x${h}`] = { product, room };
  await ctx.close();
}
{
  const { ctx, page } = await fresh(browser);
  res.vocab.product = await vocab(page);
  await page.click('#workspace-mode button[data-mode=room]');
  res.vocab.roomEmpty = await vocab(page);
  await page.click('#room-ingress button[data-ingress=import]');
  await page.click('#btn-import-fixture');
  await page.waitForSelector('#import-review:not([hidden])');
  res.vocab.importReview = await vocab(page);
  await page.click('#room-ingress button[data-ingress=scratch]');
  await page.selectOption('#room-preset', 'living');
  await page.click('#btn-create-room');
  await page.waitForFunction(() => (window.__rv.roomGraph()?.walls.length ?? 0) === 4);
  await openStep(page, 'place');
  await page.click('#btn-add-to-room');
  await waitPlacements(page, 1);
  await page.waitForTimeout(500);
  res.vocab.roomWithProduct = await vocab(page);
  await ctx.close();
}
fs.writeFileSync(`${OUT}/out/before.json`, JSON.stringify(res, null, 2));
console.log(JSON.stringify(res, null, 1));
await browser.close();
