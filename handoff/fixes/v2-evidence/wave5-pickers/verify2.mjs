// Picker §7 checks, part 2: upload, thumbnailUrl, 30 products (both views, timings), 375 px list, remembered view,
// blocked storage, list view draws nothing, remount, invalidation, pack thumbnail.
import fs from 'node:fs';
import { launch, OUT, BASE } from './lib.mjs';
const browser = await launch();
const out = {};
const TRIG = '.tpicker[data-picker-for=product-select] .tpicker-trigger';
const POP = '.tpicker-popup[data-picker-for=product-select]';
const WTRIG = '.tpicker[data-picker-for=room-wall-material] .tpicker-trigger';
const WPOP = '.tpicker-popup[data-picker-for=room-wall-material]';
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
async function open(ctxOpts = {}, init = []) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, ...ctxOpts });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`console.error: ${m.text()}`); });
  await page.addInitScript(glInit);
  for (const f of init) await page.addInitScript(f);
  await page.goto(BASE);
  await page.waitForSelector('body[data-viewer-status="ready"]', { timeout: 60000 });
  await page.waitForTimeout(600);
  return { ctx, page, errors };
}
const ready = (page) => page.waitForSelector('body[data-viewer-status="ready"]', { timeout: 60000 });
const popup = (page, sel = POP) => page.evaluate((p) => { const el = document.querySelector(p); const r = el.getBoundingClientRect(); return { open: el.matches(':popover-open'), view: el.dataset.view, layout: el.dataset.layout, rect: [r.left, r.top, r.right, r.bottom].map(Math.round), search: !el.querySelector('.tpicker-search').hidden, options: el.querySelectorAll('[role=option]').length, imgs: el.querySelectorAll('[role=option] img').length, groups: [...el.querySelectorAll('.tpicker-group')].map((g) => g.textContent) }; }, sel);
/** 28 copies of the two demo products: 30 in all. Added the way a model upload adds one (catalog + option + sync). */
const add28 = (page) => page.evaluate(() => {
  const cat = window.__rv.catalog();
  const sel = document.querySelector('#product-select');
  for (let i = 1; i <= 28; i++) {
    const src = cat.products[i % 2];
    const p = { ...src, id: `dup-${String(i).padStart(2, '0')}`, name: `${src.name.replace(' (demo)', '')} copy ${i}` };
    cat.products.push(p);
    sel.add(new Option(p.name, p.id));
  }
  window.__rv.pickers().product.sync();
  return cat.products.length;
});
/** Open the product picker and time it: click -> popup open with its options in the DOM (one frame later). */
const timedOpen = (page) => page.evaluate(async ([t, p]) => {
  const trigger = document.querySelector(t);
  const t0 = performance.now();
  trigger.click();
  const opened = performance.now();
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  const painted = performance.now();
  const el = document.querySelector(p);
  return { syncMs: +(opened - t0).toFixed(1), toSecondFrameMs: +(painted - t0).toFixed(1), open: el.matches(':popover-open'), options: el.querySelectorAll('[role=option]').length, view: el.dataset.view };
}, [TRIG, POP]);

// ---------- B: upload a model; thumbnailUrl wins ----------
{
  const { ctx, page, errors } = await open();
  const glb = await page.request.get(BASE + 'assets/models/side-table.glb');
  await page.setInputFiles('#model-files', { name: 'my-table.glb', mimeType: 'model/gltf-binary', buffer: await glb.body() });
  await page.waitForFunction(() => window.__rv.catalog().products.filter((p) => p.userAdded).length === 1);
  await ready(page);
  const up = await page.evaluate(() => window.__rv.catalog().products.find((p) => p.userAdded).id);
  const b = { uploadId: up, statsBeforeOpen: await page.evaluate(() => window.__rv.thumbnails()) };
  b.trigger = await page.evaluate((s) => document.querySelector(s).innerText.replace(/\n/g, ' | '), TRIG);
  b.nativeOptions = await page.evaluate(() => [...document.querySelectorAll('#product-select option')].map((o) => o.textContent));
  await page.click(TRIG);
  await page.waitForSelector(`${POP}:popover-open`);
  b.tiles = await page.evaluate((p) => [...document.querySelectorAll(`${p} [role=option]`)].map((o) => ({ id: o.dataset.id, name: o.querySelector('.tpicker-name').textContent, sub: o.querySelector('.tpicker-sub')?.textContent ?? null, kind: o.querySelector('.tpicker-visual').dataset.kind, text: o.innerText.replace(/\n/g, ' | ') })), POP);
  await page.waitForFunction((p) => document.querySelectorAll(`${p} [role=option] img`).length === 3, POP, { timeout: 40000 });
  b.afterThumbs = await page.evaluate(() => window.__rv.thumbnails());
  await page.screenshot({ path: `${OUT}/shots/product-picker-upload-thumbs-1440x900.png` });
  await page.keyboard.press('Escape');
  // A second upload now that thumbnails are in use: the trigger gets its image without the popup.
  await page.setInputFiles('#model-files', { name: 'my-chair.glb', mimeType: 'model/gltf-binary', buffer: await (await page.request.get(BASE + 'assets/models/lounge-chair.glb')).body() });
  await page.waitForFunction(() => window.__rv.catalog().products.filter((p) => p.userAdded).length === 2);
  await page.waitForFunction((s) => !!document.querySelector(`${s} img`), TRIG, { timeout: 40000 });
  b.secondUploadTrigger = await page.evaluate((s) => ({ text: document.querySelector(s).innerText.replace(/\n/g, ' | '), img: !!document.querySelector(`${s} img`) }), TRIG);
  b.statsAfterSecond = await page.evaluate(() => window.__rv.thumbnails());
  // thumbnailUrl wins: a product that brings its own image is never drawn.
  const before = await page.evaluate(() => window.__rv.thumbnails().renders);
  await page.evaluate(() => {
    const cat = window.__rv.catalog();
    const png = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><rect width="8" height="8" fill="#c00"/></svg>');
    const p = { ...cat.products[0], id: 'with-own-image', name: 'Own image test', thumbnailUrl: png };
    cat.products.push(p);
    document.querySelector('#product-select').add(new Option(p.name, p.id));
    window.__rv.pickers().product.sync();
  });
  await page.click(TRIG);
  await page.waitForSelector(`${POP}:popover-open`);
  await page.waitForTimeout(2500);
  b.ownImage = await page.evaluate((p) => { const o = document.querySelector(`${p} [role=option][data-id=with-own-image]`); return { kind: o.querySelector('.tpicker-visual').dataset.kind, srcStart: o.querySelector('img')?.src.slice(0, 22) }; }, POP);
  b.rendersForOwnImage = (await page.evaluate(() => window.__rv.thumbnails().renders)) - before;
  b.live = await page.evaluate(() => window.__glLive());
  b.errors = errors;
  out.B_upload = b;
  await ctx.close();
  fs.writeFileSync(`${OUT}/verify2.out.json`, JSON.stringify(out, null, 1));
}

// ---------- C: 30 products, thumbnail view (first open), search, contexts ----------
{
  const { ctx, page, errors } = await open();
  const c = { products: await add28(page) };
  c.firstOpen = await timedOpen(page);
  c.popup = await popup(page);
  const t0 = Date.now();
  // tiles on screen get their image; the rest wait until they are scrolled to
  await page.waitForFunction(() => { const s = window.__rv.thumbnails(); return s && s.pending === 0 && s.renders > 0; }, null, { timeout: 120000, polling: 250 });
  c.visibleTilesDrawnMs = Date.now() - t0;
  c.afterVisible = await page.evaluate((p) => ({ stats: window.__rv.thumbnails(), imgs: document.querySelectorAll(`${p} [role=option] img`).length, live: window.__glLive(), all: window.__gl.length }), POP);
  await page.screenshot({ path: `${OUT}/shots/product-picker-30-grid-1440x900.png` });
  // scroll to the end: the remaining tiles are asked for
  await page.evaluate((p) => { const l = document.querySelector(`${p} .tpicker-list`); l.scrollTop = l.scrollHeight; }, POP);
  const t1 = Date.now();
  await page.waitForTimeout(600);
  await page.waitForFunction(() => window.__rv.thumbnails().pending === 0, null, { timeout: 180000, polling: 250 });
  c.afterScrollToEndMs = Date.now() - t1;
  c.afterAll = await page.evaluate(() => ({ stats: window.__rv.thumbnails(), live: window.__glLive(), all: window.__gl.length }));
  // search
  await page.fill(`${POP} .tpicker-search`, 'copy 12');
  c.search = await page.evaluate((p) => [...document.querySelectorAll(`${p} [role=option]`)].map((o) => o.dataset.id), POP);
  await page.fill(`${POP} .tpicker-search`, 'zzz');
  c.noMatch = await page.evaluate((p) => ({ text: document.querySelector(`${p} .tpicker-empty`).textContent, placeholder: document.querySelector(`${p} .tpicker-search`).placeholder }), POP);
  await page.keyboard.press('Escape');
  // second open (everything cached)
  c.secondOpen = await timedOpen(page);
  c.errors = errors;
  out.C_30grid = c;
  await ctx.close();
  fs.writeFileSync(`${OUT}/verify2.out.json`, JSON.stringify(out, null, 1));
}

// ---------- D: 30 products, list view remembered across reload; list draws nothing; both kinds ----------
{
  const { ctx, page, errors } = await open();
  const d = {};
  await page.click(TRIG);
  await page.waitForSelector(`${POP}:popover-open`);
  await page.click(`${POP} [data-view-option=list]`);
  d.afterToggle = { view: (await popup(page)).view, stored: await page.evaluate(() => localStorage.getItem('catalog3d.pickerView.product')) };
  await page.screenshot({ path: `${OUT}/shots/product-picker-list-1440x900.png` });
  await page.keyboard.press('Escape');
  // material kind: wall picker
  await page.click('#workspace-mode button[data-mode=room]');
  await page.selectOption('#room-preset', 'living');
  await page.click('#btn-create-room');
  await page.waitForFunction(() => (window.__rv.roomGraph()?.walls.length ?? 0) === 4);
  await page.click('.step[data-step=finish] .step-toggle');
  await page.click(WTRIG);
  await page.waitForSelector(`${WPOP}:popover-open`);
  d.wallDefault = await popup(page, WPOP);
  await page.screenshot({ path: `${OUT}/shots/wall-picker-grid-1440x900.png` });
  await page.click(`${WPOP} [data-view-option=list]`);
  await page.waitForTimeout(150);
  await page.screenshot({ path: `${OUT}/shots/wall-picker-list-1440x900.png` });
  d.wallAfterToggle = { view: (await popup(page, WPOP)).view, stored: await page.evaluate(() => localStorage.getItem('catalog3d.pickerView.material')) };
  await page.keyboard.press('Escape');
  // reload: both remembered (same browser context on purpose)
  await page.reload();
  await ready(page);
  await page.waitForTimeout(500);
  d.products = await add28(page);
  d.listFirstOpen = await timedOpen(page);
  d.listPopup = await popup(page);
  await page.waitForTimeout(3000);
  d.listDrawsNothing = await page.evaluate(() => ({ stats: window.__rv.thumbnails(), live: window.__glLive(), all: window.__gl.length }));
  await page.screenshot({ path: `${OUT}/shots/product-picker-30-list-1440x900.png` });
  // pick from the list
  await page.click(`${POP} [role=option][data-id=demo-side-table]`);
  await page.waitForFunction(() => window.__rv.parts()?.productId === 'demo-side-table');
  d.listPick = { value: await page.inputValue('#product-select'), slots: await page.locator('.slot').count() };
  await page.click('#workspace-mode button[data-mode=room]');
  await page.click('.step[data-step=finish] .step-toggle');
  await page.click(WTRIG);
  await page.waitForSelector(`${WPOP}:popover-open`);
  d.wallAfterReload = (await popup(page, WPOP)).view;
  // back to thumbnails, for both
  await page.click(`${WPOP} [data-view-option=grid]`);
  d.wallBackToGrid = (await popup(page, WPOP)).view;
  await page.keyboard.press('Escape');
  d.errors = errors;
  out.D_list = d;
  await ctx.close();
  fs.writeFileSync(`${OUT}/verify2.out.json`, JSON.stringify(out, null, 1));
}

// ---------- E: 375 px, list with 30 items, and grid; no horizontal scroll ----------
{
  const { ctx, page, errors } = await open({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  const e = {};
  const overflow = () => page.evaluate(() => ({ x: document.documentElement.scrollWidth - document.documentElement.clientWidth, w: innerWidth }));
  e.closed = await overflow();
  await add28(page);
  await page.click(TRIG);
  await page.waitForSelector(`${POP}:popover-open`);
  await page.waitForTimeout(400);
  e.grid = { ...(await popup(page)), overflow: await overflow() };
  await page.screenshot({ path: `${OUT}/shots/product-picker-30-grid-375x812.png` });
  await page.click(`${POP} [data-view-option=list]`);
  await page.waitForTimeout(300);
  e.list = { ...(await popup(page)), overflow: await overflow(), rowH: await page.evaluate((p) => Math.round(document.querySelector(`${p} [role=option]`).getBoundingClientRect().height), POP), rowsVisible: await page.evaluate((p) => { const l = document.querySelector(`${p} .tpicker-list`).getBoundingClientRect(); return [...document.querySelectorAll(`${p} [role=option]`)].filter((o) => { const r = o.getBoundingClientRect(); return r.top >= l.top && r.bottom <= l.bottom; }).length; }, POP) };
  await page.screenshot({ path: `${OUT}/shots/product-picker-30-list-375x812.png` });
  // pick the last one by scrolling the list
  await page.locator(`${POP} [role=option][data-id=dup-28]`).scrollIntoViewIfNeeded();
  await page.click(`${POP} [role=option][data-id=dup-28]`);
  await page.waitForFunction(() => window.__rv.parts()?.productId === 'dup-28');
  e.pickedLast = await page.inputValue('#product-select');
  e.afterPick = await overflow();
  e.errors = errors;
  out.E_375 = e;
  await ctx.close();
  fs.writeFileSync(`${OUT}/verify2.out.json`, JSON.stringify(out, null, 1));
}

// ---------- F: localStorage.setItem throws before load ----------
{
  const { ctx, page, errors } = await open({}, [() => { Storage.prototype.setItem = function () { throw new DOMException('blocked by test', 'SecurityError'); }; }]);
  const f = {};
  await page.click(TRIG);
  await page.waitForSelector(`${POP}:popover-open`);
  await page.click(`${POP} [data-view-option=list]`);
  f.afterToggle = (await popup(page)).view;
  await page.keyboard.press('Escape');
  await page.click(TRIG);
  await page.waitForSelector(`${POP}:popover-open`);
  f.reopened = (await popup(page)).view;
  f.stored = await page.evaluate(() => localStorage.getItem('catalog3d.pickerView.product'));
  await page.click(`${POP} [role=option][data-id=demo-side-table]`);
  await page.waitForFunction(() => window.__rv.parts()?.productId === 'demo-side-table');
  f.pick = await page.inputValue('#product-select');
  f.errors = errors;
  out.F_blockedStorage = f;
  await ctx.close();
  fs.writeFileSync(`${OUT}/verify2.out.json`, JSON.stringify(out, null, 1));
}
fs.writeFileSync(`${OUT}/verify2.out.json`, JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 1));
await browser.close();
