// First look: do the pickers mount, do thumbnails arrive, does anything throw?
import { launch, fresh, createRoom, openStep, OUT } from './lib.mjs';
const browser = await launch();
const out = {};
{
  const { ctx, page, errors } = await fresh(browser, { settle: 0 });
  const t0 = Date.now();
  out.pickers = await page.evaluate(() => [...document.querySelectorAll('.tpicker')].map((e) => ({ for: e.dataset.pickerFor, enhanced: e.dataset.enhanced, parent: e.parentElement.id || e.parentElement.className, trigger: e.querySelector('.tpicker-trigger')?.innerText, selectVisible: e.querySelector('select').offsetParent !== null })));
  // wait for the trigger thumbnail
  await page.waitForFunction(() => !!document.querySelector('.tpicker[data-picker-for=product-select] .tpicker-trigger img'), null, { timeout: 30000 }).catch(() => {});
  out.triggerThumbMs = Date.now() - t0;
  out.stats1 = await page.evaluate(() => window.__rv.thumbnails());
  await page.click('.tpicker[data-picker-for=product-select] .tpicker-trigger');
  await page.waitForTimeout(300);
  out.popup = await page.evaluate(() => { const p = document.querySelector('.tpicker-popup[data-picker-for=product-select]'); const r = p.getBoundingClientRect(); return { open: p.matches(':popover-open'), view: p.dataset.view, rect: [r.left, r.top, r.width, r.height].map(Math.round), options: [...p.querySelectorAll('[role=option]')].map((o) => ({ id: o.dataset.id, text: o.innerText, kind: o.querySelector('.tpicker-visual').dataset.kind, sel: o.getAttribute('aria-selected') })) }; });
  await page.screenshot({ path: `${OUT}/shots/probe1-product-open.png` });
  await page.waitForFunction(() => document.querySelectorAll('.tpicker-popup[data-picker-for=product-select] [role=option] img').length === 2, null, { timeout: 30000 }).catch(() => {});
  out.stats2 = await page.evaluate(() => window.__rv.thumbnails());
  await page.screenshot({ path: `${OUT}/shots/probe1-product-open-thumbs.png` });
  await page.click('.tpicker-popup[data-picker-for=product-select] [role=option][data-id=demo-side-table]');
  await page.waitForFunction(() => window.__rv.parts()?.productId === 'demo-side-table');
  out.afterPick = await page.evaluate(() => ({ value: document.querySelector('#product-select').value, slots: document.querySelectorAll('.slot').length, trigger: document.querySelector('.tpicker[data-picker-for=product-select] .tpicker-trigger').innerText, focus: document.activeElement?.className }));
  // Room
  await createRoom(page);
  await openStep(page, 'place');
  await page.waitForTimeout(400);
  out.room = await page.evaluate(() => ({ slotParent: document.querySelector('#product-picker-slot').parentElement.id, pickers: document.querySelectorAll('.tpicker[data-picker-for=product-select]').length, popups: document.querySelectorAll('.tpicker-popup').length }));
  await page.click('.tpicker[data-picker-for=product-select] .tpicker-trigger');
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/shots/probe1-room-open.png` });
  await page.keyboard.press('Escape');
  await openStep(page, 'finish');
  await page.waitForTimeout(300);
  await page.click('.tpicker[data-picker-for=room-wall-material] .tpicker-trigger');
  await page.waitForTimeout(400);
  out.wall = await page.evaluate(() => { const p = document.querySelector('.tpicker-popup[data-picker-for=room-wall-material]'); return { open: p.matches(':popover-open'), view: p.dataset.view, title: p.querySelector('.tpicker-title').textContent, groups: [...p.querySelectorAll('.tpicker-group')].map((g) => g.textContent), options: p.querySelectorAll('[role=option]').length, native: document.querySelectorAll('#room-wall-material option').length }; });
  await page.screenshot({ path: `${OUT}/shots/probe1-wall-open.png` });
  await page.click('.tpicker-popup[data-picker-for=room-wall-material] [role=option][data-id=wood-walnut]');
  await page.waitForTimeout(300);
  out.wallPicked = await page.evaluate(() => ({ graph: window.__rv.roomGraph().rooms[0].wall_material_id, value: document.querySelector('#room-wall-material').value, trigger: document.querySelector('.tpicker[data-picker-for=room-wall-material] .tpicker-trigger').innerText }));
  out.errors = errors;
  await ctx.close();
}
console.log(JSON.stringify(out, null, 1));
await browser.close();
