// Part 3: remount, invalidation, pack thumbnail, wave-4 keyboard interplay with the real picker, swatch names, coarse sizes.
import fs from 'node:fs';
import { launch, OUT, BASE, toClient, pointOn } from './lib.mjs';
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
async function open(ctxOpts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, ...ctxOpts });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`console.error: ${m.text()}`); });
  await page.addInitScript(glInit);
  await page.goto(BASE);
  await page.waitForSelector('body[data-viewer-status="ready"]', { timeout: 60000 });
  await page.waitForTimeout(600);
  return { ctx, page, errors };
}
const ready = (page) => page.waitForSelector('body[data-viewer-status="ready"]', { timeout: 60000 });
const save = () => fs.writeFileSync(`${OUT}/verify3.out.json`, JSON.stringify(out, null, 1));
const gl = (page) => page.evaluate(() => ({ live: window.__glLive(), all: window.__gl.length, stats: window.__rv.thumbnails() }));
const trig = (page) => page.evaluate((s) => { const t = document.querySelector(s); const v = t.querySelector('.tpicker-visual'); return { text: t.innerText.replace(/\n/g, ' | '), img: !!t.querySelector('img'), visualShown: getComputedStyle(v).display !== 'none', padLeft: getComputedStyle(t).paddingLeft }; }, TRIG);

// ---------- G: remount ----------
{
  const { ctx, page, errors } = await open();
  const g = { triggerAtLoad: await trig(page) };
  await page.click(TRIG);
  await page.waitForSelector(`${POP}:popover-open`);
  await page.waitForFunction((p) => document.querySelectorAll(`${p} [role=option] img`).length === 2, POP, { timeout: 40000 });
  await page.keyboard.press('Escape');
  g.before = { ...(await gl(page)), trigger: await trig(page) };
  await page.click('.slot[data-slot=frame] .swatch[data-material=wood-walnut]');
  await page.waitForFunction(() => window.__rv.viewer().getSlots().find((s) => s.def.id === 'frame').materialId === 'wood-walnut');
  await page.click('#btn-remount');
  await page.waitForFunction(() => window.__rv.viewer()?.status !== 'disposed');
  await ready(page);
  // the trigger's image is drawn again, by a new renderer
  await page.waitForFunction((s) => !!document.querySelector(`${s} img`), TRIG, { timeout: 40000 });
  await page.waitForTimeout(300);
  g.afterRemount = { ...(await gl(page)), trigger: await trig(page), slots: await page.locator('.slot').count(), frame: await page.evaluate(() => window.__rv.viewer().getSlots().find((s) => s.def.id === 'frame').materialId), pressed: await page.getAttribute('.slot[data-slot=frame] .swatch[data-material=wood-walnut]', 'aria-pressed') };
  await page.click(TRIG);
  await page.waitForSelector(`${POP}:popover-open`);
  g.tilesRightAfterOpen = await page.evaluate((p) => [...document.querySelectorAll(`${p} [role=option]`)].map((o) => o.querySelector('.tpicker-visual').dataset.kind), POP);
  await page.waitForFunction((p) => document.querySelectorAll(`${p} [role=option] img`).length === 2, POP, { timeout: 40000 });
  g.afterReopen = await gl(page);
  await page.click(`${POP} [role=option][data-id=demo-side-table]`);
  await page.waitForFunction(() => window.__rv.parts()?.productId === 'demo-side-table');
  await ready(page);
  g.pickAfterRemount = { value: await page.inputValue('#product-select'), slots: await page.locator('.slot').count() };
  await page.click('.slot[data-slot=legs] .swatch[data-material=metal-black]');
  await page.waitForFunction(() => window.__rv.viewer().getSlots().find((s) => s.def.id === 'legs').materialId === 'metal-black');
  g.swatchAfterRemount = await page.evaluate(() => document.querySelector('.slot[data-slot=legs] [data-role=value]').textContent);
  // remount in the Room workspace, with a material picker
  await page.click('#workspace-mode button[data-mode=room]');
  await page.selectOption('#room-preset', 'living');
  await page.click('#btn-create-room');
  await page.waitForFunction(() => (window.__rv.roomGraph()?.walls.length ?? 0) === 4);
  await page.click('#btn-remount');
  await ready(page);
  await page.waitForTimeout(500);
  await page.click('.step[data-step=finish] .step-toggle');
  await page.click(WTRIG);
  await page.waitForSelector(`${WPOP}:popover-open`);
  await page.click(`${WPOP} [role=option][data-id=stone-marble]`);
  await page.waitForFunction(() => window.__rv.roomGraph().rooms[0].wall_material_id === 'stone-marble');
  await page.click('.step[data-step=place] .step-toggle');
  await page.waitForTimeout(300);
  g.roomAfterRemount = { ...(await gl(page)), wall: await page.evaluate(() => window.__rv.roomGraph().rooms[0].wall_material_id), cardInStep: await page.locator('#step-place-body #materials-card .slot').count(), pickerInStep: await page.locator('#step-place-body .tpicker[data-picker-for=product-select]').count() };
  g.errors = errors;
  out.G_remount = g; save();
  await ctx.close();
}

// ---------- H: invalidation when a product's own materials change (a map added to a library material) ----------
{
  const { ctx, page, errors } = await open();
  const h = {};
  await page.click(TRIG);
  await page.waitForSelector(`${POP}:popover-open`);
  await page.waitForFunction((p) => document.querySelectorAll(`${p} [role=option] img`).length === 2, POP, { timeout: 40000 });
  await page.keyboard.press('Escape');
  h.before = (await gl(page)).stats;
  const chairBefore = await page.evaluate((s) => document.querySelector(`${s} img`).src, TRIG);
  // Advanced > Add texture: a normal map onto "Natural oak" (the chair's default frame; the table does not use it by default)
  await page.click('#product-advanced-summary');
  await page.selectOption('#texture-role', 'normalMap');
  h.targetWrapShown = await page.evaluate(() => !document.getElementById('texture-target-wrap').hidden);
  h.targetPickerInWrap = await page.locator('#texture-target-wrap .tpicker[data-picker-for=texture-target] .tpicker-trigger').count();
  await page.click('.tpicker[data-picker-for=texture-target] .tpicker-trigger');
  await page.waitForSelector('.tpicker-popup[data-picker-for=texture-target]:popover-open');
  await page.waitForTimeout(250);
  h.targetPopup = await page.evaluate(() => { const p = document.querySelector('.tpicker-popup[data-picker-for=texture-target]'); return { title: p.querySelector('.tpicker-title').textContent, options: p.querySelectorAll('[role=option]').length, first: p.querySelector('[role=option]').dataset.id, groups: [...p.querySelectorAll('.tpicker-group')].map((g) => g.textContent), native: document.querySelectorAll('#texture-target option').length, view: p.dataset.view }; });
  await page.screenshot({ path: `${OUT}/shots/texture-target-picker-1440x900.png` });
  await page.click('.tpicker-popup[data-picker-for=texture-target] [role=option][data-id=wood-oak]');
  h.targetValue = await page.inputValue('#texture-target');
  const png = await page.request.get(BASE + 'assets/textures/wool-knit.png');
  await page.setInputFiles('#texture-file', { name: 'bumps.png', mimeType: 'image/png', buffer: await png.body() });
  await page.click('#btn-add-texture');
  await page.waitForFunction(() => /Attached/.test(document.getElementById('texture-upload-status').textContent));
  // the chair is the selected product: its thumbnail is drawn again at once
  await page.waitForFunction(() => window.__rv.thumbnails().renders >= 3 && window.__rv.thumbnails().pending === 0, null, { timeout: 40000 });
  await page.waitForTimeout(300);
  h.after = (await gl(page)).stats;
  h.chairImageChanged = (await page.evaluate((s) => document.querySelector(`${s} img`)?.src, TRIG)) !== chairBefore;
  // role back to "map": the wrapper hides again, with the picker in it
  await page.selectOption('#texture-role', 'map');
  h.targetWrapHiddenAgain = await page.evaluate(() => document.getElementById('texture-target-wrap').hidden && document.querySelector('.tpicker[data-picker-for=texture-target] .tpicker-trigger').offsetParent === null);
  // a new colour texture appears in all three material pickers
  await page.setInputFiles('#texture-file', { name: 'my-weave.png', mimeType: 'image/png', buffer: await png.body() });
  await page.click('#btn-add-texture');
  await page.waitForFunction(() => /Added/.test(document.getElementById('texture-upload-status').textContent));
  h.afterNewMaterial = await page.evaluate(() => ({ wallNative: document.querySelectorAll('#room-wall-material option').length, floorNative: document.querySelectorAll('#room-floor-material option').length, targetNative: document.querySelectorAll('#texture-target option').length, lib: window.__rv.library().materials.length }));
  await page.click('#workspace-mode button[data-mode=room]');
  await page.selectOption('#room-preset', 'living');
  await page.click('#btn-create-room');
  await page.waitForFunction(() => (window.__rv.roomGraph()?.walls.length ?? 0) === 4);
  await page.click('.step[data-step=finish] .step-toggle');
  await page.click(WTRIG);
  await page.waitForSelector(`${WPOP}:popover-open`);
  await page.waitForTimeout(250);
  h.wallHasNew = await page.evaluate((p) => { const o = [...document.querySelectorAll(`${p} [role=option]`)].find((x) => /my-weave/.test(x.innerText)); return o ? { text: o.innerText, kind: o.querySelector('.tpicker-visual').dataset.kind, bg: o.querySelector('.tpicker-visual').style.backgroundImage.slice(0, 12), total: document.querySelectorAll(`${p} [role=option]`).length } : null; }, WPOP);
  await page.keyboard.press('Escape');
  h.errors = errors;
  out.H_invalidate = h; save();
  await ctx.close();
}

// ---------- I: a real pack (.mjs + .glb): its thumbnail is its own model ----------
{
  const { ctx, page, errors } = await open();
  const i = {};
  try {
    await page.click('#product-advanced-summary');
    await page.setInputFiles('#pack-files', ['/Users/adrian/Desktop/Room Vibez/models/core-rulebook-4aedc7.mjs', '/Users/adrian/Desktop/Room Vibez/models/core-rulebook-4aedc7.glb']);
    await page.waitForFunction(() => !!window.__rv.pack(), null, { timeout: 30000 });
    await ready(page);
    i.pack = await page.evaluate(() => { const p = window.__rv.catalog().products.at(-1); return { id: p.id, name: p.name, sourceKind: p.sourceKind, preserve: !!p.preserveMaterials, mapping: p.pack?.mappingMode, completeness: p.pack?.completeness }; });
    await page.click(TRIG);
    await page.waitForSelector(`${POP}:popover-open`);
    await page.waitForFunction((p) => document.querySelectorAll(`${p} [role=option] img`).length === 3, POP, { timeout: 60000 });
    i.tiles = await page.evaluate((p) => [...document.querySelectorAll(`${p} [role=option]`)].map((o) => ({ text: o.innerText.replace(/\n/g, ' | '), kind: o.querySelector('.tpicker-visual').dataset.kind })), POP);
    await page.waitForTimeout(200);
    await page.screenshot({ path: `${OUT}/shots/product-picker-pack-1440x900.png` });
    i.stats = (await gl(page)).stats;
  } catch (err) { i.failed = String(err).slice(0, 300); }
  i.errors = errors;
  out.I_pack = i; save();
  await ctx.close();
}
console.log(JSON.stringify(out, null, 1));
await browser.close();
