// Follow-up measurements for the Catalog 3D audit. Each block answers a question the first pass (audit-viewer.mjs) left open.
// Run: RV_QA_OUT=<writable dir> node audit-viewer-followup.mjs   (dev server on :18767)
import { fileURLToPath } from 'node:url';
import { chromium } from '../../hackathon-3d-viewer/node_modules/playwright/index.mjs';
import { writeFileSync, mkdirSync } from 'node:fs';

const OUT = process.env.RV_QA_OUT || fileURLToPath(new URL('./out', import.meta.url));
const SHOTS = `${OUT}/shots`;
mkdirSync(SHOTS, { recursive: true });
const BASE = 'http://127.0.0.1:18767/';
const results = {};
const rec = (id, name, observed) => { results[id] = { name, observed }; console.log(`\n## ${id} | ${name}\n${JSON.stringify(observed, null, 1).slice(0, 7000)}`); };
const section = async (id, name, fn) => { try { rec(id, name, await fn()); } catch (err) { rec(id, name, { SCRIPT_ERROR: String(err?.stack ?? err).slice(0, 500) }); } };

function qaInit() {
  const vis = (el) => !!el && el.getClientRects().length > 0 && (el.checkVisibility ? el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }) : true);
  const d = (el) => { if (!el) return null; if (el === document.body) return 'body'; const t = (el.innerText || el.value || el.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 32); return `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${!el.id && typeof el.className === 'string' && el.className ? '.' + el.className.trim().split(/\s+/).join('.') : ''}${el.type && el.tagName === 'INPUT' ? `[${el.type}]` : ''}${t ? ` "${t}"` : ''}`; };
  const panel = () => document.querySelector('.panel');
  const inPanel = (el) => { const p = panel(); return el ? Math.round(el.getBoundingClientRect().top - p.getBoundingClientRect().top + p.scrollTop) : null; };
  const hiddenButShown = () => [...document.querySelectorAll('[hidden]')].filter((e) => getComputedStyle(e).display !== 'none').map((e) => { const r = e.getBoundingClientRect(); return `${d(e)} display:${getComputedStyle(e).display} ${Math.round(r.width)}x${Math.round(r.height)}`; });
  window.__qa = { vis, d, inPanel, hiddenButShown };
}
const QA_SRC = `(${qaInit.toString()})()`;
const browser = await chromium.launch({ channel: 'chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });

async function fresh({ viewport = { width: 1440, height: 900 }, mobile = false, reducedMotion, settle = 2200, extraCss } = {}) {
  const ctx = await browser.newContext({ viewport, ...(mobile ? { hasTouch: true, isMobile: true, deviceScaleFactor: 2 } : {}), ...(reducedMotion ? { reducedMotion } : {}) });
  await ctx.addInitScript(QA_SRC);
  if (extraCss) await ctx.addInitScript((css) => { addEventListener('DOMContentLoaded', () => { const s = document.createElement('style'); s.textContent = css; document.head.appendChild(s); }); }, extraCss);
  const page = await ctx.newPage();
  page.on('dialog', (dlg) => dlg.dismiss());
  await page.goto(BASE);
  await page.waitForFunction(() => document.body.dataset.viewerStatus === 'ready', null, { timeout: 30000 });
  if (settle) await page.waitForTimeout(settle);
  return { ctx, page };
}
const openRoom = async (page) => { await page.locator('#workspace-mode button[data-mode=room]').click(); await page.waitForTimeout(1500); };
const createRoom = async (page, preset = 'living') => { await page.selectOption('#room-preset', preset); await page.click('#btn-create-room'); await page.waitForFunction(() => !!window.__rv.roomGraph()); await page.waitForTimeout(1500); };
const place = async (page, x = 0, z = 0) => { const n = await page.evaluate(() => window.__rv.roomGraph().placements.length); await page.evaluate(({ x, z }) => window.__rv.simulateRoomPointer({ kind: 'floor', point: { x, y: 0, z } }, 'place'), { x, z }); await page.waitForFunction((n) => window.__rv.roomGraph().placements.length === n + 1, n, { timeout: 10000 }); await page.waitForTimeout(600); };

// ---- F1 cold-load auto-scroll, desktop ------------------------------------------------------------------
await section('F1', 'Cold load, Product mode: where does the panel settle, and how far is the first swatch from view?', async () => {
  const out = {};
  for (const [w, h] of [[1440, 900], [1280, 800]]) {
    const { ctx, page } = await fresh({ viewport: { width: w, height: h }, settle: 0 });
    const trace = await page.evaluate(async () => { const p = document.querySelector('.panel'); const s = []; for (let i = 0; i < 14; i++) { s.push(Math.round(p.scrollTop)); await new Promise((r) => setTimeout(r, 150)); } return s; });
    const m = await page.evaluate(() => {
      const q = window.__qa; const p = document.querySelector('.panel'); const pr = p.getBoundingClientRect();
      const need = (el) => { const r = el.getBoundingClientRect(); return Math.max(0, Math.round(r.bottom - pr.bottom)); };
      const inView = (el) => { const r = el.getBoundingClientRect(); return r.top >= pr.top - 1 && r.bottom <= pr.bottom + 1; };
      const heads = [...document.querySelectorAll('.panel h2')].map((h) => `${h.innerText.trim().split('\n')[0]}${inView(h) ? ' [in view]' : ''}`);
      const slots = [...document.querySelectorAll('.slot')];
      return { settledScrollTop: Math.round(p.scrollTop), panelClientH: p.clientHeight, panelScrollH: p.scrollHeight, catalogCardTop: q.inPanel(document.getElementById('catalog-card')), slotsTop: q.inPanel(document.getElementById('slots')), headings: heads, materialSlotsHeadingInView: inView([...document.querySelectorAll('.panel h2')].find((h) => /Material slots/.test(h.innerText))), scrollNeededToFullyShowFirstSlotSwatches: need(slots[0].querySelector('.swatches')), scrollNeededToShowAllSlots: need(slots[slots.length - 1]), roomCardInView: (() => { const r = document.getElementById('room-card').getBoundingClientRect(); return r.bottom > pr.top + 1 && r.top < pr.bottom; })(), productSelectInView: inView(document.getElementById('product-select')), hiddenAttrButDisplayed: q.hiddenButShown() };
    });
    if (w === 1440) await page.screenshot({ path: `${SHOTS}/F1-cold-load-settled-1440.png` });
    out[`${w}x${h}`] = { scrollTopEvery150ms: trace, ...m };
    await ctx.close();
  }
  return out;
});

// ---- F2 classic scrollbar hypothesis ----------------------------------------------------------------------
await section('F2', 'Do the earlier figures (3106 / 1835 / 926 / 1705 px) reproduce when the panel has a 15 px classic scrollbar?', async () => {
  const run = async (extraCss) => {
    const { ctx, page } = await fresh({ extraCss });
    const snap = () => page.evaluate(() => { const q = window.__qa; const p = document.querySelector('.panel'); const controls = [...document.querySelectorAll('button,select,input:not([type=file]):not([type=checkbox]),summary')].filter((e) => e.offsetParent !== null); return { panelOffsetW: p.offsetWidth, panelClientW: p.clientWidth, panelClientH: p.clientHeight, panelScrollH: p.scrollHeight, slotsTop: q.inPanel(document.getElementById('slots')), presetsTop: q.inPanel(document.getElementById('presets')), roomCardH: Math.round(document.getElementById('room-card').getBoundingClientRect().height), controlsUnder32: controls.filter((e) => e.getBoundingClientRect().height < 32).length, scrollTop: Math.round(p.scrollTop) }; });
    const freshProduct = await snap();
    await openRoom(page);
    const roomNoRoom = await snap();
    await createRoom(page, 'living');
    const withRoom = await snap();
    const dist = await page.evaluate(() => window.__qa.inPanel(document.getElementById('btn-place-mode')) - window.__qa.inPanel(document.getElementById('room-status')));
    await ctx.close();
    return { freshProduct, roomNoRoom, withRoom, statusToPlaceBtnPx: dist };
  };
  return { overlayScrollbar_default: await run(null), classicScrollbar_15px: await run('.panel::-webkit-scrollbar{width:15px;background:#eee}.panel::-webkit-scrollbar-thumb{background:#bbb}'), earlierClaims: { panelScrollH: 3106, slotsTop: 1835, presetsTop: 2704, roomCardH_noRoom: 926, roomCardH_withRoom: 1705, controlsUnder32_fresh: 3, scrollTopAfterSwitchToRoom: 161, statusToPlaceBtnPx: 963 } };
});

// ---- F3 keyboard order from the top -----------------------------------------------------------------------
await section('F3', 'Keyboard: tab order starting at the first control (Product mode; Room mode with a room)', async () => {
  const walk = async (page) => {
    await page.evaluate(() => document.querySelector('#workspace-mode button').focus());
    const stops = [await page.evaluate(() => ({ el: window.__qa.d(document.activeElement), zone: 'topbar' }))];
    for (let i = 0; i < 140; i++) {
      await page.keyboard.press('Tab');
      const s = await page.evaluate(() => { const e = document.activeElement; if (!e || e === document.body) return null; const card = e.closest('[data-workspace-panel]'); const cs = getComputedStyle(e); return { el: window.__qa.d(e), zone: card ? card.dataset.workspacePanel : e.closest('.panel') ? 'panel-shared' : e.closest('.stage') ? 'stage' : 'topbar', outline: `${cs.outlineStyle} ${cs.outlineWidth} ${cs.outlineColor}`, disabled: !!e.disabled }; });
      if (!s || s.el === stops[0].el) break;
      stops.push(s);
    }
    return stops;
  };
  const { ctx, page } = await fresh();
  // Where does the very first Tab land on a fresh load (no prior focus)?
  await page.keyboard.press('Tab');
  const firstTabFresh = await page.evaluate(() => window.__qa.d(document.activeElement));
  const product = await walk(page);
  const idx = (stops, re) => stops.findIndex((s) => re.test(s.el));
  const zones = (stops) => stops.reduce((o, s) => ((o[s.zone] = (o[s.zone] || 0) + 1), o), {});
  await openRoom(page);
  await createRoom(page, 'living');
  await place(page, 0, 0);
  const room = await walk(page);
  await ctx.close();
  const ring = (stops) => stops.reduce((o, s) => { const k = /rgb\(0, 128, 96\)/.test(s.outline ?? '') ? 'custom 2px accent' : /auto/.test(s.outline ?? '') ? 'browser default' : `other: ${s.outline}`; o[k] = (o[k] || 0) + 1; return o; }, {});
  return {
    firstTabOnFreshLoadLandsOn: firstTabFresh,
    productMode: { totalStops: product.length, byZone: zones(product), stopsBeforeProductSelect: idx(product, /#product-select/), stopsBeforeFirstSwatch: idx(product, /button\.swatch/), stopsBeforeLightPreset: idx(product, /Studio soft/), focusRingStyles: ring(product.slice(1)), order: product.map((s) => `${s.zone}: ${s.el}`) },
    roomModeWithRoomAndOnePlacement: { totalStops: room.length, byZone: zones(room), stopsBeforeCreateRoom: idx(room, /#btn-create-room/), stopsBeforePlaceButton: idx(room, /#btn-place-mode/), stopsFromPlaceButtonToProductSelect: idx(room, /#product-select/) - idx(room, /#btn-place-mode/), undoRedoInOrderWhileDisabled: room.filter((s) => /#btn-(undo|redo)/.test(s.el)).map((s) => `${s.el} disabled=${s.disabled}`), order: room.map((s) => `${s.zone}: ${s.el}`) },
  };
});

// ---- F4 reduced motion, after the boot scroll has settled ---------------------------------------------------
await section('F4', 'prefers-reduced-motion: is the workspace-switch panel scroll animated?', async () => {
  const run = async (reducedMotion) => {
    const { ctx, page } = await fresh({ reducedMotion, settle: 2500 });
    const samples = await page.evaluate(async () => {
      const p = document.querySelector('.panel');
      p.scrollTop = 1500;
      await new Promise((r) => setTimeout(r, 500));
      const before = Math.round(p.scrollTop);
      const s = [];
      document.querySelector('#workspace-mode button[data-mode=room]').click();
      const t0 = performance.now();
      while (performance.now() - t0 < 900) { s.push(Math.round(p.scrollTop)); await new Promise((r) => requestAnimationFrame(r)); }
      return { before, distinct: [...new Set(s)].length, first: s[0], last: s[s.length - 1], frames: s.length, sample: s.filter((_, i) => i % 6 === 0).slice(0, 14) };
    });
    const mq = await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
    await ctx.close();
    return { mediaQueryReduce: mq, ...samples };
  };
  return { noPreference: await run('no-preference'), reduce: await run('reduce') };
});

// ---- F5 label in name -------------------------------------------------------------------------------------------
await section('F5', 'WCAG 2.5.3 Label in Name: aria-label vs the visible label text', async () => {
  const { ctx, page } = await fresh();
  const m = await page.evaluate(() => [...document.querySelectorAll('input,select,textarea')].filter((e) => e.getAttribute('aria-label')).map((e) => {
    let visible = '';
    const lab = e.labels && e.labels[0];
    if (lab) { const c = lab.cloneNode(true); c.querySelectorAll('select,input,textarea').forEach((x) => x.remove()); visible = c.innerText.trim().replace(/\s+/g, ' '); }
    const name = e.getAttribute('aria-label');
    return { id: e.id, visibleLabel: visible || '(none)', accessibleName: name, nameContainsVisibleLabel: visible ? name.toLowerCase().includes(visible.toLowerCase()) : null };
  }));
  await ctx.close();
  return { total: m.length, mismatches: m.filter((x) => x.nameContainsVisibleLabel === false), noVisibleLabel: m.filter((x) => x.nameContainsVisibleLabel === null).map((x) => `${x.id}: "${x.accessibleName}"`), ok: m.filter((x) => x.nameContainsVisibleLabel).length };
});

// ---- F6 mobile cold load + canvas/tool visibility ---------------------------------------------------------------
await section('F6', 'Mobile 375x812: where the page settles on cold load, after switching workspace, after Create room; touch scroll over the canvas', async () => {
  const { ctx, page } = await fresh({ viewport: { width: 375, height: 812 }, mobile: true, settle: 0 });
  const trace = await page.evaluate(async () => { const s = []; for (let i = 0; i < 14; i++) { s.push(Math.round(scrollY)); await new Promise((r) => setTimeout(r, 150)); } return s; });
  const view = () => page.evaluate(() => { const st = document.querySelector('.stage').getBoundingClientRect(); const vh = innerHeight; const visiblePx = Math.max(0, Math.min(vh, st.bottom) - Math.max(0, st.top)); const top = document.elementFromPoint(187, 20); return { scrollY: Math.round(scrollY), canvasVisiblePx: Math.round(visiblePx), canvasVisiblePctOfItself: Math.round((visiblePx / st.height) * 100), elementAtTopOfViewport: window.__qa.d(top?.closest('.card, .topbar') ?? top), docH: document.documentElement.scrollHeight }; });
  const coldLoad = await view();
  await page.screenshot({ path: `${SHOTS}/F6-mobile-cold-load-settled.png` });
  // touch swipe over the canvas from a clean scroll position
  await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
  await page.waitForTimeout(500);
  const cdp = await ctx.newCDPSession(page);
  const swipe = async (x, y1, y2) => { const y0 = await page.evaluate(() => scrollY); await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y: y1 }] }); for (let i = 1; i <= 12; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y1 + ((y2 - y1) * i) / 12 }] }); await page.waitForTimeout(16); } await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await page.waitForTimeout(700); const y = await page.evaluate(() => scrollY); await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' })); await page.waitForTimeout(300); return Math.round(y - y0); };
  const st = await page.evaluate(() => { const r = document.querySelector('.stage').getBoundingClientRect(); return { top: r.top, h: r.height, touchAction: getComputedStyle(document.querySelector('#viewer-host canvas')).touchAction }; });
  const swipes = { canvasTouchAction: st.touchAction, overCanvas_250pxUp: await swipe(187, st.top + st.h / 2 + 120, st.top + st.h / 2 - 130), belowCanvas_250pxUp: await swipe(187, 790, 540), topbar_100pxUp: await swipe(187, 130, 30) };
  const firstViewport = await page.evaluate(() => { const st = document.querySelector('.stage').getBoundingClientRect(); return { topbarPx: Math.round(document.querySelector('.topbar').getBoundingClientRect().height), canvasPx: Math.round(st.height), remainingBelowCanvasPx: Math.round(innerHeight - st.bottom) }; });
  // switch workspace
  await page.locator('#workspace-mode button[data-mode=room]').tap();
  await page.waitForTimeout(1800);
  const afterSwitchToRoom = await view();
  await page.screenshot({ path: `${SHOTS}/F6-mobile-after-switch-to-room.png` });
  await page.selectOption('#room-preset', 'living');
  await page.locator('#btn-create-room').tap();
  await page.waitForFunction(() => !!window.__rv.roomGraph());
  await page.waitForTimeout(1800);
  const afterCreateRoom = await view();
  await page.screenshot({ path: `${SHOTS}/F6-mobile-after-create-room.png` });
  await page.locator('#btn-place-mode').scrollIntoViewIfNeeded();
  await page.locator('#btn-place-mode').tap();
  await page.waitForTimeout(1500);
  const afterPlaceModeTap = await view();
  await ctx.close();
  return { scrollYEvery150msFromReady: trace, coldLoad, firstViewportBudget: firstViewport, swipes, afterSwitchToRoom, afterCreateRoom, afterPlaceModeTap };
});

// ---- F7 320 px overflow cause ---------------------------------------------------------------------------------------
await section('F7', '320 px wide: what forces the 33 px horizontal overflow?', async () => {
  const { ctx, page } = await fresh({ viewport: { width: 320, height: 568 } });
  const base = await page.evaluate(() => ({ overflowX: document.documentElement.scrollWidth - innerWidth, layoutW: Math.round(document.querySelector('.layout').getBoundingClientRect().width), stageW: Math.round(document.querySelector('.stage').getBoundingClientRect().width) }));
  const tryFix = async (css) => { const h = await page.addStyleTag({ content: css }); await page.waitForTimeout(250); const o = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth); await h.evaluate((n) => n.remove()); await page.waitForTimeout(150); return o; };
  const probes = {
    'hide .file-input': await tryFix('.file-input{display:none!important}'),
    'file-input min-width:0': await tryFix('.file-input{min-width:0!important;max-width:100%!important}'),
    'hide #room-card': await tryFix('#room-card{display:none!important}'),
    'hide #catalog-card': await tryFix('#catalog-card{display:none!important}'),
    'hide .segmented': await tryFix('.segmented{display:none!important}'),
    'hide pre.code': await tryFix('.code{display:none!important}'),
    '.panel min-width:0': await tryFix('.panel{min-width:0!important}'),
    '.panel > * min-width:0': await tryFix('.panel,.panel>*{min-width:0!important}'),
    'hide .stage-toolbar + hint': await tryFix('.stage-toolbar,.hint{display:none!important}'),
    'layout cols minmax(0,1fr)': await tryFix('.layout{grid-template-columns:minmax(0,1fr)!important}'),
  };
  const widest = await page.evaluate(() => [...document.querySelectorAll('.panel *')].filter((e) => window.__qa.vis(e)).map((e) => ({ el: window.__qa.d(e), w: Math.round(e.getBoundingClientRect().width), sw: e.scrollWidth })).filter((x) => x.w > 288 - 28 + 1).sort((a, b) => b.w - a.w).slice(0, 8));
  await ctx.close();
  return { base, overflowXAfterEachProbe: probes, widestPanelDescendants: widest };
});

// ---- F8 how much orbit reveals the floor ---------------------------------------------------------------------------
await section('F8', 'After Create room (Living 5x4): floor share of the canvas after a vertical mouse drag; and with a raised default camera', async () => {
  const { ctx, page } = await fresh();
  await openRoom(page);
  await createRoom(page, 'living');
  const grid = () => page.evaluate(() => { const v = window.__rv.viewer(); const c = document.querySelector('#viewer-host canvas').getBoundingClientRect(); const N = 21; const g = window.__rv.roomGraph().rooms[0].floor_polygon; const xs = g.map((p) => p.x), zs = g.map((p) => p.z); let floorIn = 0, wall = 0; for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const h = v.raycastRoom(c.left + ((i + 0.5) * c.width) / N, c.top + ((j + 0.5) * c.height) / N); if (h?.kind === 'floor' && h.point.x > Math.min(...xs) && h.point.x < Math.max(...xs) && h.point.z > Math.min(...zs) && h.point.z < Math.max(...zs)) floorIn++; else if (h?.kind === 'wall') wall++; } const cam = v.camera.position, t = v.controls.target; return { inRoomFloorPct: +((floorIn / (N * N)) * 100).toFixed(1), wallPct: +((wall / (N * N)) * 100).toFixed(1), elevationDeg: +((Math.atan2(cam.y - t.y, Math.hypot(cam.x - t.x, cam.z - t.z)) * 180) / Math.PI).toFixed(1) }; });
  const c = await page.evaluate(() => { const r = document.querySelector('#viewer-host canvas').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, clip: { x: r.left, y: r.top, width: r.width, height: r.height } }; });
  const out = { arrival: await grid() };
  let dragged = 0;
  for (const step of [100, 100, 100, 100]) {
    await page.mouse.move(c.x, c.y - 150); await page.mouse.down(); await page.mouse.move(c.x, c.y - 150 + step, { steps: 8 }); await page.mouse.up();
    await page.waitForTimeout(700);
    dragged += step;
    out[`afterDragDown_${dragged}px`] = await grid();
  }
  await page.screenshot({ path: `${SHOTS}/F8-living-after-400px-drag.png`, clip: c.clip });
  // candidate default elevations, same distance (set camera directly; no code change)
  for (const deg of [35, 45, 55]) {
    await page.evaluate((deg) => { const v = window.__rv.viewer(); v.frameRoom(); const t = v.controls.target.clone(); const off = v.camera.position.clone().sub(t); const dist = off.length(); const az = Math.atan2(off.x, off.z); const el = (deg * Math.PI) / 180; v.camera.position.set(t.x + dist * Math.cos(el) * Math.sin(az), t.y + dist * Math.sin(el), t.z + dist * Math.cos(el) * Math.cos(az)); v.controls.update(); }, deg);
    await page.waitForTimeout(600);
    out[`cameraElevation_${deg}deg_sameDistance`] = await grid();
    if (deg === 45) await page.screenshot({ path: `${SHOTS}/F8-living-elevation-45deg.png`, clip: c.clip });
  }
  await ctx.close();
  return out;
});

// ---- F9 placed product appearance (evidence shot) + replace-room + undo hijack -----------------------------------------
await section('F9', 'Placed product materials (evidence shot); Create room over existing work; Cmd/Ctrl+Z while typing in a field', async () => {
  const { ctx, page } = await fresh();
  await page.click('.slot[data-slot=frame] .swatch[data-material=wood-walnut]');
  await page.click('.slot[data-slot=pillow] .swatch[data-material=wool-terracotta]');
  await openRoom(page);
  await createRoom(page, 'living');
  await place(page, 0, 0);
  await page.evaluate(() => { const v = window.__rv.viewer(); const t = v.controls.target; v.camera.position.set(t.x + 1.6, 2.6, t.z + 2.2); v.controls.target.set(0, 0.4, 0); v.controls.update(); });
  await page.waitForTimeout(900);
  const clip = await page.evaluate(() => { const r = document.querySelector('#viewer-host canvas').getBoundingClientRect(); return { x: r.left, y: r.top, width: r.width, height: r.height }; });
  await page.screenshot({ path: `${SHOTS}/F9-placed-chair-in-room.png`, clip });
  const placedMats = await page.evaluate(() => { const v = window.__rv.viewer(); const set = {}; for (const root of v.placementRoots.values()) root.traverse((o) => { if (o.isMesh) { const k = `${o.material.name} #${o.material.color.getHexString()} map:${o.material.map ? 'yes' : 'none'}`; set[k] = (set[k] || 0) + 1; } }); return set; });
  // reload: does the placed chair look the same after a refresh?
  await page.reload();
  await page.waitForFunction(() => document.body.dataset.viewerStatus === 'ready');
  await page.waitForTimeout(2000);
  await openRoom(page);
  const afterReloadMats = await page.evaluate(() => { const v = window.__rv.viewer(); const set = {}; for (const root of v.placementRoots.values()) root.traverse((o) => { if (o.isMesh) { const k = `${o.material.name} #${o.material.color.getHexString()} map:${o.material.map ? 'yes' : 'none'}`; set[k] = (set[k] || 0) + 1; } }); return { set, placements: window.__rv.roomGraph().placements.length, productSlotsAfterReload: v.getSlots().map((s) => `${s.def.id}=${s.materialId}`) }; });
  // undo hijack: focus a number field, type, press Meta+Z / Control+Z
  await place(page, 1, 0.5);
  const before = await page.evaluate(() => window.__rv.roomGraph().placements.length);
  await page.locator('#room-length').focus();
  await page.keyboard.type('9');
  const typed = await page.inputValue('#room-length');
  await page.keyboard.press('Meta+z');
  await page.waitForTimeout(500);
  const afterMeta = await page.evaluate(() => ({ placements: window.__rv.roomGraph().placements.length, field: document.getElementById('room-length').value, status: document.getElementById('room-status').innerText }));
  // create room over existing content
  await place(page, -1, 0);
  const pre = await page.evaluate(() => window.__rv.roomGraph().placements.length);
  let dialog = false; page.on('dialog', () => { dialog = true; });
  await page.click('#btn-create-room');
  await page.waitForTimeout(900);
  const replaced = await page.evaluate(() => ({ placements: window.__rv.roomGraph().placements.length, undoDisabled: document.getElementById('btn-undo').disabled, status: document.getElementById('room-status').innerText }));
  await ctx.close();
  return { placedRootMaterials: placedMats, afterReload: afterReloadMats, undoWhileTypingInLengthField: { placementsBefore: before, fieldAfterTyping: typed, afterMetaZ: afterMeta, roomUndoFiredInsteadOfTextUndo: afterMeta.placements < before }, createRoomOverExistingWork: { placementsBefore: pre, confirmDialogShown: dialog, after: replaced } };
});

// ---- F10 [hidden] overridden: every state -------------------------------------------------------------------------------
await section('F10', 'Elements carrying the hidden attribute that are still displayed (per state)', async () => {
  const { ctx, page } = await fresh();
  const out = { freshProduct: await page.evaluate(() => window.__qa.hiddenButShown()) };
  out.roomPlanBoxVisibleWithNoRoom = await page.evaluate(() => { const e = document.getElementById('room-plan'); const r = e.getBoundingClientRect(); return { display: getComputedStyle(e).display, size: `${Math.round(r.width)}x${Math.round(r.height)}`, downloadBtnVisible: window.__qa.vis(document.getElementById('btn-download-plan')) }; });
  await page.locator('#room-plan').scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${SHOTS}/F10-empty-plan-box-and-download-button-with-no-room.png` });
  // Download plan PNG with no room: what happens?
  let download = false; page.on('download', () => { download = true; });
  await page.click('#btn-download-plan');
  await page.waitForTimeout(500);
  out.downloadPlanWithNoRoom = { downloadStarted: download, roomStatus: await page.locator('#room-status').innerText() };
  await openRoom(page);
  out.roomNoRoom = await page.evaluate(() => window.__qa.hiddenButShown());
  await createRoom(page, 'living');
  out.roomWithRoom = await page.evaluate(() => window.__qa.hiddenButShown());
  await page.locator('#room-ingress button[data-ingress=import]').click();
  await page.waitForTimeout(300);
  out.importTab = await page.evaluate(() => window.__qa.hiddenButShown());
  await ctx.close();
  return out;
});

await browser.close();
writeFileSync(`${OUT}/viewer-followup-results.json`, JSON.stringify(results, null, 2));
console.log(`\nWrote ${OUT}/viewer-followup-results.json`);
