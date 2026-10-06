// Layout of the Place products step with the Materials card: where things sit, at 1440x900 and 375x812.
import { launch, fresh, createRoom, openStep, OUT } from './lib.mjs';
const out = {};
const browser = await launch();
try {
  for (const [label, viewport, mobile] of [['1440', { width: 1440, height: 900 }, false], ['375', { width: 375, height: 812 }, true]]) {
    const { ctx, page, errors } = await fresh(browser, { viewport, mobile });
    await createRoom(page);
    await openStep(page, 'place');
    await page.waitForTimeout(600);
    out[label] = await page.evaluate(() => {
      const panel = document.querySelector('.panel');
      const pr = panel.getBoundingClientRect();
      const narrow = getComputedStyle(panel).overflowY === 'visible';
      const top = (id) => { const r = document.getElementById(id).getBoundingClientRect(); return { top: Math.round(r.top - (narrow ? 0 : pr.top) + (narrow ? scrollY : panel.scrollTop)), h: Math.round(r.height), bottomInView: narrow ? r.bottom <= innerHeight : r.bottom <= pr.bottom }; };
      return {
        narrow, panelClientH: panel.clientHeight, panelScrollH: panel.scrollHeight, panelScrollTop: panel.scrollTop, scrollY,
        picker: top('product-select'), card: top('materials-card'), state: top('materials-state'), slots: top('slots'), snap: top('place-wall-snap'),
        add: top('btn-add-to-room'), place: top('btn-place-mode'), list: top('placement-list'),
        overflowX: document.documentElement.scrollWidth - innerWidth,
        cardWidth: Math.round(document.getElementById('materials-card').getBoundingClientRect().width),
      };
    });
    await page.screenshot({ path: `${OUT}/shots/dev-place-step-${label}.png`, fullPage: label === '375' });
    out[label].errors = errors;
    await ctx.close();
  }
} finally { await browser.close(); }
console.log(JSON.stringify(out, null, 1));
