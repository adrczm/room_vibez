// Screenshots of the copy pass (copy handoff §8, the first half's list), at 1280x800 and 375 px wide.
import { launch, fresh, openStep, waitPlacements, OUT } from './lib.mjs';
const browser = await launch();
const SHOTS = `${OUT}/shots`;
const log = [];
for (const [tag, viewport, mobile] of [['1280', { width: 1280, height: 800 }, false], ['375', { width: 375, height: 812 }, true]]) {
  const full = tag === '375';
  const shot = async (page, name, opts = {}) => { const path = `${SHOTS}/${tag}-${name}.png`; await page.screenshot({ path, fullPage: opts.fullPage ?? full }); log.push(path); };
  {
    const { ctx, page, errors } = await fresh(browser, { viewport, mobile, settle: 1500 });
    await shot(page, '01-product-cold-load');
    await page.click('#workspace-mode button[data-mode=room]');
    await page.waitForTimeout(400);
    await shot(page, '02-room-no-room');
    // Import plan tab, then the sample review with Technical details collapsed
    await page.click('#room-ingress button[data-ingress=import]');
    await page.waitForTimeout(200);
    await shot(page, '03-import-plan-tab');
    await page.click('#btn-import-fixture');
    await page.waitForSelector('#import-review:not([hidden])');
    await page.waitForTimeout(400);
    await page.evaluate(() => document.getElementById('import-extract-banner').scrollIntoView({ block: 'start' }));
    await page.waitForTimeout(200);
    await shot(page, '04-import-sample-review-technical-collapsed', { fullPage: false });
    if (full) await shot(page, '04b-import-sample-review-full-page', { fullPage: true });
    // deep link from the banner's Why?
    await page.click('#import-extract-banner .why-link');
    await page.waitForTimeout(300);
    await shot(page, '10-why-from-sample-banner-files-plans', { fullPage: false });
    await page.keyboard.press('Escape');
    await page.evaluate(() => document.getElementById('import-oda-note').scrollIntoView({ block: 'center' }));
    await page.click('#import-oda-note .why-link');
    await page.waitForTimeout(300);
    await shot(page, '11-why-from-import-nudge-room-import-plan', { fullPage: false });
    await page.keyboard.press('Escape');
    // a room with a placed product
    await page.click('#btn-import-start-editing');
    await page.waitForFunction(() => (window.__rv.roomGraph()?.walls.length ?? 0) === 4);
    await openStep(page, 'place');
    await page.locator('#btn-add-to-room').scrollIntoViewIfNeeded();
    await page.click('#btn-add-to-room');
    await waitPlacements(page, 1);
    await page.waitForTimeout(1200);
    if (!full) await shot(page, '05-room-with-placed-product');
    else { await page.evaluate(() => scrollTo(0, 0)); await page.waitForTimeout(300); await shot(page, '05-room-with-placed-product', { fullPage: true }); }
    // the five tabs
    await page.evaluate(() => scrollTo(0, 0));
    await page.click('#btn-help');
    for (const [i, id] of ['start', 'product', 'room', 'files', 'built'].entries()) {
      if (full) await page.selectOption('#help-topic', id); else await page.click(`#help-tab-${id}`);
      await page.waitForTimeout(200);
      await shot(page, `2${i}-help-${id}`, { fullPage: false });
      // the lower part of the long tabs
      const more = await page.evaluate(() => { const b = document.querySelector('#help-dialog .help-body'); const can = b.scrollHeight - b.clientHeight; b.scrollTop = can; return can; });
      if (more > 40) { await page.waitForTimeout(150); await shot(page, `2${i}-help-${id}-end`, { fullPage: false }); }
    }
    await page.keyboard.press('Escape');
    // Parts list Why? (Product)
    await page.click('#workspace-mode button[data-mode=catalog]');
    await page.waitForTimeout(600);
    await page.evaluate(() => document.getElementById('parts-note').scrollIntoView({ block: 'center' }));
    await page.waitForTimeout(200);
    await shot(page, '06-product-parts-list-note', { fullPage: false });
    await page.click('#parts-note .why-link');
    await page.waitForTimeout(300);
    await shot(page, '12-why-from-parts-list-note-product-tab', { fullPage: false });
    await page.keyboard.press('Escape');
    // Advanced opened (the three short hints)
    await page.click('#product-advanced-summary');
    await page.evaluate(() => document.getElementById('product-advanced').scrollIntoView({ block: 'start' }));
    await page.waitForTimeout(200);
    await shot(page, '07-product-advanced-open', { fullPage: false });
    console.log(tag, 'errors', errors);
    await ctx.close();
  }
}
console.log(log.map((p) => p.split('/').pop()).join('\n'));
await browser.close();
