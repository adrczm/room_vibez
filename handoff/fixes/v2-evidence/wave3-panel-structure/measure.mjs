// UX §6 snippet, A2, QA-03, QA-09, QA-10 in one run. usage: node measure.mjs <label>
import { writeFileSync } from 'node:fs';
import { launch, fresh, uxSnippet, a2, materialsView, stageView, tabWalk, OUT } from './lib.mjs';

const label = process.argv[2] || 'run';
const browser = await launch();
const out = { label, at: new Date().toISOString() };

const toRoom = async (page, mobile) => {
  const b = page.locator('#workspace-mode button[data-mode=room]');
  if (mobile) await b.tap(); else await b.click();
  await page.waitForTimeout(2000);
};
const toProduct = async (page, mobile) => {
  const b = page.locator('#workspace-mode button[data-mode=catalog]');
  if (mobile) await b.tap(); else await b.click();
  await page.waitForTimeout(2000);
};
const createRoom = async (page, mobile) => {
  // Works on both layouts: the preset may be in a collapsed step later on, so fall back to evaluate.
  await page.selectOption('#room-preset', 'living');
  const b = page.locator('#btn-create-room');
  await b.scrollIntoViewIfNeeded();
  if (mobile) await b.tap(); else await b.click();
  await page.waitForFunction(() => !!window.__rv.roomGraph());
  await page.waitForTimeout(2000);
};

for (const [name, viewport, mobile] of [['1440x900', { width: 1440, height: 900 }, false], ['375x812', { width: 375, height: 812 }, true]]) {
  const { ctx, page, errors } = await fresh(browser, { viewport, mobile });
  const r = {};
  r.productFresh = { ux: await page.evaluate(uxSnippet), a2: await page.evaluate(a2), materials: await page.evaluate(materialsView), stage: await page.evaluate(stageView) };
  if (!mobile) r.productFresh.tabStops = await tabWalk(page);
  await toRoom(page, mobile);
  r.roomNoRoom = { ux: await page.evaluate(uxSnippet), a2: await page.evaluate(a2), stage: await page.evaluate(stageView) };
  try {
    await createRoom(page, mobile);
    r.roomWithRoom = { ux: await page.evaluate(uxSnippet), a2: await page.evaluate(a2), stage: await page.evaluate(stageView) };
    if (!mobile) r.roomWithRoom.tabStops = await tabWalk(page);
  } catch (err) {
    r.roomWithRoom = { SCRIPT_ERROR: String(err).slice(0, 300) };
  }
  await toProduct(page, mobile);
  r.productWithRoom = { ux: await page.evaluate(uxSnippet), a2: await page.evaluate(a2), materials: await page.evaluate(materialsView), stage: await page.evaluate(stageView) };
  r.errors = errors;
  out[name] = r;
  await ctx.close();
}
await browser.close();

const summarise = (stops) => stops && { total: stops.length, inInactiveGroup: stops.filter((s) => s.inInactiveGroup).length, inHiddenSubtree: stops.filter((s) => s.inHiddenSubtree).length, first: stops[0]?.el, order: stops.map((s) => `${s.group ?? '-'}${s.inInactiveGroup ? '!' : ''}: ${s.el}`) };
for (const k of ['1440x900', '375x812']) for (const st of Object.values(out[k])) if (st && st.tabStops) st.tabStops = summarise(st.tabStops);
writeFileSync(`${OUT}/measure-${label}.json`, JSON.stringify(out, null, 1));
const brief = JSON.parse(JSON.stringify(out));
for (const k of ['1440x900', '375x812']) for (const st of Object.values(brief[k])) if (st && st.tabStops) delete st.tabStops.order;
console.log(JSON.stringify(brief, null, 1));
