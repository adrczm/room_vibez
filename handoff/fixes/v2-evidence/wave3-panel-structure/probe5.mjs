// UX-08 done-when at 1440x900: after Create room, what does it take to pick a product and place it?
import { launch, fresh, OUT } from './lib.mjs';
const browser = await launch();
const { ctx, page, errors } = await fresh(browser, { viewport: { width: 1440, height: 900 } });
await page.click('#workspace-mode button[data-mode=room]');
await page.selectOption('#room-preset', 'living');
await page.click('#btn-create-room');
await page.waitForFunction(() => !!window.__rv.roomGraph());
await page.waitForTimeout(1000);
const inView = () => page.evaluate(() => {
  const panel = document.querySelector('.panel'); const pr = panel.getBoundingClientRect();
  const bar = document.getElementById('room-toolbar').getBoundingClientRect();
  const out = { panelScrollTop: panel.scrollTop, panelClientH: panel.clientHeight, panelScrollH: panel.scrollHeight };
  for (const sel of ['.step[data-step=place] .step-toggle', '#product-select', '#btn-add-to-room', '#btn-place-mode']) {
    const el = document.querySelector(sel); const r = el.getBoundingClientRect();
    out[sel] = el.offsetParent === null ? 'not rendered' : (r.top >= bar.bottom && r.bottom <= pr.bottom ? `in view (y ${Math.round(r.top - pr.top)}–${Math.round(r.bottom - pr.top)})` : `needs scroll ${Math.round(Math.max(0, r.bottom - pr.bottom))}px`);
  }
  return out;
});
console.log('after Create room:', await inView());
await page.click('.step[data-step=place] .step-toggle');
console.log('after opening step 3:', await inView());
await page.click('#btn-add-to-room');
await page.waitForFunction(() => window.__rv.roomGraph().placements.length === 1, null, { timeout: 20000 });
console.log('after Add to room: placements', await page.evaluate(() => window.__rv.roomGraph().placements.map((p) => p.position)), 'panelScrollTop', await page.evaluate(() => document.querySelector('.panel').scrollTop));
// Step 1 reopened with a room, More open, Adjust size open: a look.
await page.click('#btn-step-room-change');
await page.click('#room-size-adjust > summary');
await page.click('#room-more > summary');
await page.waitForTimeout(300);
await page.screenshot({ path: `${OUT}/shots/extra-1440-step1-reopened-adjust-more.png` });
await page.click('#room-ingress button[data-ingress=import]');
await page.click('#btn-import-fixture');
await page.waitForSelector('#import-review:not([hidden])');
await page.waitForTimeout(300);
await page.screenshot({ path: `${OUT}/shots/extra-1440-step1-import-review-full.png`, fullPage: true });
console.log('errors', errors);
await ctx.close(); await browser.close();
