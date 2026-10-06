// Picker §7 checks, part 1: A2, keyboard path, programmatic value + sync, upload, thumbnailUrl, contexts, remount.
import fs from 'node:fs';
import { launch, fresh, createRoom, openStep, OUT, BASE } from './lib.mjs';
const browser = await launch();
const out = {};
const TRIG = '.tpicker[data-picker-for=product-select] .tpicker-trigger';
const POP = '.tpicker-popup[data-picker-for=product-select]';
const A2 = () => {
  const gone = (ids) => ids.filter((id) => { const el = document.getElementById(id); return el && el.offsetParent !== null; });
  if (document.body.dataset.workspace === 'catalog') return gone(['btn-create-room','room-preset','plan-file','btn-import-plan','btn-import-fixture','project-file','btn-import-project','btn-export-project','btn-clear-room','btn-draw-wall-mode','btn-opening-mode','btn-place-mode','room-wall-material']);
  return gone(['model-files','pack-files','module-file','texture-file']);
};
const glInit = () => {
  window.__gl = [];
  const orig = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (type, ...rest) {
    const ctx = orig.call(this, type, ...rest);
    if (ctx && /^webgl/.test(type) && !window.__gl.includes(ctx)) window.__gl.push(ctx);
    return ctx;
  };
  window.__glLive = () => window.__gl.filter((c) => !c.isContextLost()).length;
};
const trig = (page) => page.evaluate((s) => { const t = document.querySelector(s); return { text: t.innerText.replace(/\n/g, ' | '), img: !!t.querySelector('img'), kind: t.querySelector('.tpicker-visual').dataset.kind, expanded: t.getAttribute('aria-expanded'), focused: document.activeElement === t }; }, TRIG);

// ---------- A: A2 in four states, keyboard path, sync, contexts ----------
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`console.error: ${m.text()}`); });
  await page.addInitScript(glInit);
  await page.goto(BASE);
  await page.waitForSelector('body[data-viewer-status="ready"]', { timeout: 60000 });
  await page.waitForTimeout(800);
  out.contextsAtLoad = await page.evaluate(() => ({ live: window.__glLive(), all: window.__gl.length, stats: window.__rv.thumbnails() }));
  out.a2 = { productNoRoom: await page.evaluate(A2) };
  out.triggerAtLoad = await trig(page);
  // Keyboard path
  await page.focus(TRIG);
  await page.keyboard.press('ArrowDown');
  await page.waitForSelector(`${POP}:popover-open`);
  const kb = {};
  kb.afterOpen = await page.evaluate((p) => ({ focusId: document.activeElement?.dataset?.id ?? null, role: document.activeElement?.getAttribute('role'), view: document.querySelector(p).dataset.view }), POP);
  await page.keyboard.press('ArrowRight');
  kb.afterRight = await page.evaluate(() => document.activeElement?.dataset?.id ?? null);
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.__rv.parts()?.productId === 'demo-side-table');
  await page.waitForSelector('body[data-viewer-status="ready"]');
  kb.afterEnter = { value: await page.inputValue('#product-select'), slots: await page.locator('.slot').count(), open: await page.evaluate((p) => document.querySelector(p).matches(':popover-open'), POP), trigger: await trig(page) };
  await page.keyboard.press('Enter'); // on the trigger: opens
  await page.waitForSelector(`${POP}:popover-open`);
  kb.reopenedFocus = await page.evaluate(() => document.activeElement?.dataset?.id ?? null);
  await page.keyboard.press('Escape');
  kb.afterEsc = { open: await page.evaluate((p) => document.querySelector(p).matches(':popover-open'), POP), trigger: await trig(page), value: await page.inputValue('#product-select') };
  out.keyboard = kb;
  // thumbnails after the grid was open
  await page.waitForFunction(() => (window.__rv.thumbnails()?.cached ?? 0) >= 2, null, { timeout: 30000 });
  out.contextsAfterGrid = await page.evaluate(() => ({ live: window.__glLive(), all: window.__gl.length, stats: window.__rv.thumbnails() }));
  // Programmatic value + sync
  const sync = {};
  await page.evaluate(() => { document.querySelector('#product-select').value = 'demo-lounge-chair'; });
  sync.beforeSync = (await trig(page)).text;
  await page.evaluate(() => window.__rv.pickers().product.sync());
  sync.afterSync = await trig(page);
  // put the app back in step with the select (the change event was skipped on purpose above)
  await page.selectOption('#product-select', 'demo-lounge-chair');
  await page.waitForFunction(() => window.__rv.parts()?.productId === 'demo-lounge-chair');
  out.sync = sync;
  // Room workspace
  await page.click('#workspace-mode button[data-mode=room]');
  out.a2.roomNoRoom = await page.evaluate(A2);
  await page.selectOption('#room-preset', 'living');
  await page.click('#btn-create-room');
  await page.waitForFunction(() => (window.__rv.roomGraph()?.walls.length ?? 0) === 4);
  out.a2.roomWithRoom = await page.evaluate(A2);
  await openStep(page, 'place');
  await page.waitForTimeout(300);
  out.a2.roomPlaceStep = await page.evaluate(A2);
  out.roomPicker = await page.evaluate(() => ({ slotParent: document.querySelector('#product-picker-slot').parentElement.id, selects: document.querySelectorAll('#product-select').length, triggers: document.querySelectorAll('.tpicker[data-picker-for=product-select] .tpicker-trigger').length }));
  await page.click(TRIG);
  await page.waitForSelector(`${POP}:popover-open`);
  await page.waitForTimeout(300);
  out.roomPopup = await page.evaluate((p) => { const el = document.querySelector(p); const r = el.getBoundingClientRect(); const panel = document.querySelector('.panel').getBoundingClientRect(); const at = (x, y) => el.contains(document.elementFromPoint(x, y)); return { rect: [r.left, r.top, r.right, r.bottom].map(Math.round), panel: [panel.left, panel.top, panel.right, panel.bottom].map(Math.round), side: el.dataset.side, layout: el.dataset.layout, cornersOnTop: [at(r.left + 3, r.top + 3), at(r.right - 3, r.top + 3), at(r.left + 3, r.bottom - 3), at(r.right - 3, r.bottom - 3)], view: el.dataset.view, imgs: el.querySelectorAll('[role=option] img').length }; }, POP);
  await page.screenshot({ path: `${OUT}/shots/room-place-picker-open-1440x900.png` });
  await page.click(`${POP} [role=option][data-id=demo-side-table]`);
  await page.waitForFunction(() => window.__rv.parts()?.productId === 'demo-side-table');
  out.roomPick = { value: await page.inputValue('#product-select'), slots: await page.locator('#step-place-body .slot').count() };
  await page.click('#workspace-mode button[data-mode=catalog]');
  out.a2.productWithRoom = await page.evaluate(A2);
  out.backInProduct = await page.evaluate(() => ({ slotParent: document.querySelector('#product-picker-slot').parentElement.id, value: document.querySelector('#product-select').value, slots: document.querySelectorAll('.slot').length }));
  out.contextsEndA = await page.evaluate(() => ({ live: window.__glLive(), all: window.__gl.length, stats: window.__rv.thumbnails() }));
  out.errorsA = errors;
  await ctx.close();
}
fs.writeFileSync(`${OUT}/verify1.out.json`, JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 1));
await browser.close();
