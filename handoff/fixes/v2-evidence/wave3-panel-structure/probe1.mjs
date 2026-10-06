// Small probes: controls under 32 px (which ones), first Tab on a fresh load, toolbar sizes, chair vs toolbar at 375.
import { launch, fresh } from './lib.mjs';
const browser = await launch();
const under32 = () => [...document.querySelectorAll('button,select,input:not([type=file]):not([type=checkbox]),summary')]
  .filter((e) => e.offsetParent !== null && e.getBoundingClientRect().height < 32)
  .map((e) => `${e.tagName.toLowerCase()}${e.id ? '#' + e.id : ''} "${(e.innerText || e.value || '').trim().slice(0, 20)}" ${Math.round(e.getBoundingClientRect().height * 10) / 10}`);

for (const [name, viewport, mobile] of [['1440x900', { width: 1440, height: 900 }, false], ['375x812', { width: 375, height: 812 }, true]]) {
  const { ctx, page, errors } = await fresh(browser, { viewport, mobile });
  if (!mobile) {
    await page.keyboard.press('Tab');
    console.log(name, 'first Tab on fresh load lands on:', await page.evaluate(() => { const e = document.activeElement; return `${e.tagName.toLowerCase()}${e.id ? '#' + e.id : ''} "${(e.innerText || '').trim().slice(0, 20)}"`; }));
  }
  console.log(name, 'Product under32:', await page.evaluate(under32));
  console.log(name, 'stage toolbar:', await page.evaluate(() => { const t = document.querySelector('.stage-toolbar').getBoundingClientRect(); const s = document.querySelector('.stage').getBoundingClientRect(); return { h: Math.round(t.height), bottomInStage: Math.round(t.bottom - s.top), w: Math.round(t.width), presetsH: Math.round(document.getElementById('presets').getBoundingClientRect().height), presetsW: Math.round(document.getElementById('presets').getBoundingClientRect().width), stageW: Math.round(s.width), stageH: Math.round(s.height) }; }));
  const act = async (sel) => { const l = page.locator(sel); if (mobile) await l.tap(); else await l.click(); };
  await act('#workspace-mode button[data-mode=room]');
  await page.waitForTimeout(800);
  console.log(name, 'Room(no room) under32:', await page.evaluate(under32));
  await page.selectOption('#room-preset', 'living');
  await act('#btn-create-room');
  await page.waitForFunction(() => !!window.__rv.roomGraph());
  await page.waitForTimeout(800);
  console.log(name, 'Room(room) under32:', await page.evaluate(under32));
  console.log(name, 'active element after Create room:', await page.evaluate(() => { const e = document.activeElement; return `${e.tagName.toLowerCase()}#${e.id}`; }), 'aria-current:', await page.evaluate(() => [...document.querySelectorAll('.step')].map((s) => `${s.dataset.step}:${s.getAttribute('aria-current')}`)));
  console.log(name, 'room toolbar:', await page.evaluate(() => { const t = document.getElementById('room-toolbar').getBoundingClientRect(); return { h: Math.round(t.height), w: Math.round(t.width), btns: [...document.querySelectorAll('#room-toolbar button')].map((b) => `${b.id}:${Math.round(b.getBoundingClientRect().width)}x${Math.round(b.getBoundingClientRect().height)}@${Math.round(b.getBoundingClientRect().top - t.top)}`), varH: getComputedStyle(document.documentElement).getPropertyValue('--room-toolbar-height') }; }));
  console.log(name, 'errors', errors);
  await ctx.close();
}
await browser.close();
