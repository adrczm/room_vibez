// Screenshots of the four states at both sizes. usage: node shots.mjs [suffix]
import { launch, fresh, OUT } from './lib.mjs';

const suffix = process.argv[2] ? `-${process.argv[2]}` : '';
const browser = await launch();
for (const [name, viewport, mobile] of [['1440x900', { width: 1440, height: 900 }, false], ['375x812', { width: 375, height: 812 }, true]]) {
  const { ctx, page, errors } = await fresh(browser, { viewport, mobile });
  const act = async (sel) => { const l = page.locator(sel); await l.scrollIntoViewIfNeeded(); if (mobile) await l.tap(); else await l.click(); };
  const shot = (label, opts = {}) => page.screenshot({ path: `${OUT}/shots/${name}-${label}${suffix}.png`, ...opts });

  await shot('1-product-arrival');
  await shot('1-product-arrival-full', { fullPage: true });
  await act('#product-advanced > summary');
  await page.waitForTimeout(300);
  await shot('4-advanced-open-full', { fullPage: true });
  if (!mobile) {
    // The panel is the scroller on a wide screen: show the open disclosure in the viewport too.
    await page.locator('#product-advanced > summary').scrollIntoViewIfNeeded();
    await page.evaluate(() => { const p = document.querySelector('.panel'); p.scrollTop = document.getElementById('product-advanced').offsetTop - 12; });
    await page.waitForTimeout(200);
    await shot('4-advanced-open');
  }
  await page.evaluate(() => { scrollTo(0, 0); document.querySelector('.panel').scrollTop = 0; });
  await act('#workspace-mode button[data-mode=room]');
  await page.waitForTimeout(1500);
  await shot('2-room-no-room');
  await shot('2-room-no-room-full', { fullPage: true });
  await page.selectOption('#room-preset', 'living');
  await act('#btn-create-room');
  await page.waitForFunction(() => !!window.__rv.roomGraph());
  await page.waitForTimeout(2000);
  await shot('3a-room-created');
  await act('.step[data-step=place] .step-toggle');
  await page.waitForTimeout(500);
  if (mobile) await page.evaluate(() => scrollTo(0, 0));
  await shot('3-room-place-step');
  await shot('3-room-place-step-full', { fullPage: true });
  await act('#btn-add-to-room');
  await page.waitForFunction(() => window.__rv.roomGraph().placements.length === 1, null, { timeout: 20000 });
  await page.waitForTimeout(1500);
  if (mobile) await page.evaluate(() => scrollTo(0, 0));
  await shot('5-room-after-add-to-room');
  console.log(name, 'errors:', JSON.stringify(errors));
  await ctx.close();
}
await browser.close();
