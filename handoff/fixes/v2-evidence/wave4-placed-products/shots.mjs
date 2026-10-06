// Final screenshots for the report, at 1440x900 and 375x812.
import { launch, fresh, toClient, openStep, placements, waitPlacements, pointOn, OUT } from './lib.mjs';
const browser = await launch();
const log = {};
try {
  for (const [label, viewport, mobile] of [['1440x900', { width: 1440, height: 900 }, false], ['375x812', { width: 375, height: 812 }, true]]) {
    const { ctx, page, errors } = await fresh(browser, { viewport, mobile });
    const full = mobile;
    await page.click('#workspace-mode button[data-mode=room]');
    await page.selectOption('#room-preset', 'living');
    await page.click('#btn-create-room');
    await page.waitForFunction(() => (window.__rv.roomGraph()?.walls.length ?? 0) === 4);
    await openStep(page, 'place');
    await page.waitForTimeout(500);
    // 3. The Materials card in the Place products step (as the step opens).
    await page.screenshot({ path: `${OUT}/shots/materials-in-place-step-${label}.png`, fullPage: full });
    // 1. A walnut chair in the room: one default (oak) by Add to room, one walnut by Add to room.
    await page.click('#btn-add-to-room');
    await waitPlacements(page, 1);
    await page.click('.slot[data-slot=frame] .swatch[data-material=wood-walnut]');
    await page.click('#btn-add-to-room');
    await waitPlacements(page, 2);
    await page.waitForTimeout(7000); // let the "Placed" toast go
    if (mobile) await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
    await page.screenshot({ path: `${OUT}/shots/walnut-chair-in-room-${label}.png` });
    // 2. A selected product: outline in the room, highlighted row in the list.
    const pls = await placements(page);
    if (mobile) {
      await page.locator('#placement-list li:nth-child(2) .placement-name').tap();
    } else {
      const pt = await pointOn(page, pls[1].id);
      await page.mouse.click(pt.x, pt.y);
    }
    await page.waitForTimeout(400);
    if (!mobile) await page.evaluate(() => document.querySelector('#placement-list li[aria-current]').scrollIntoView({ block: 'center', behavior: 'instant' }));
    await page.mouse.move(700, 120);
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${OUT}/shots/selected-product-${label}.png`, fullPage: full });
    if (mobile) { await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' })); await page.waitForTimeout(200); await page.screenshot({ path: `${OUT}/shots/selected-product-stage-${label}.png` }); }
    // 2b. The selected product's own finish (16b): the card about the selected chair.
    await page.evaluate(() => document.getElementById('materials-card').scrollIntoView({ block: 'start', behavior: 'instant' }));
    await page.waitForTimeout(200);
    await page.screenshot({ path: `${OUT}/shots/selected-product-finish-${label}.png` });
    log[label] = { errors, overflowX: await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), sel: await page.evaluate(() => document.querySelector('#placement-list li[aria-current] .placement-name')?.textContent), state: await page.textContent('#materials-state') };
    await ctx.close();
  }
} finally { await browser.close(); }
console.log(JSON.stringify(log, null, 1));
