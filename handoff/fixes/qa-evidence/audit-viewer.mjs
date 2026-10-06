// QA / usability / aesthetic audit of the running Catalog 3D viewer (http://127.0.0.1:18767).
// Isolated Playwright contexts (fresh localStorage each time). Writes only to ./out. Read-only against project source.
// Run: RV_QA_OUT=<writable dir> node audit-viewer.mjs   (dev server must be up on :18767)
// RV_QA_OUT defaults to ./out. A sandboxed agent shell cannot write inside the project, so point it at a scratch dir.
import { fileURLToPath } from 'node:url';
import { chromium } from '../../hackathon-3d-viewer/node_modules/playwright/index.mjs';
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';

const OUT = process.env.RV_QA_OUT || fileURLToPath(new URL('./out', import.meta.url));
const SHOTS = `${OUT}/shots`;
mkdirSync(SHOTS, { recursive: true });
const VIEWER = fileURLToPath(new URL('../../hackathon-3d-viewer', import.meta.url));
const BASE = 'http://127.0.0.1:18767/';
const results = {};
const rec = (id, name, observed) => {
  results[id] = { name, observed };
  console.log(`\n## ${id} | ${name}\n${JSON.stringify(observed, null, 1).slice(0, 6000)}`);
};

// ---- in-page helpers -------------------------------------------------------------------------
function qaInit() {
  const parse = (s) => {
    const m = String(s).match(/rgba?\(([^)]+)\)/);
    if (!m) return [0, 0, 0, 0];
    const p = m[1].split(/[,\s/]+/).filter(Boolean).map(Number);
    return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1];
  };
  const over = (top, bot) => [0, 1, 2].map((i) => top[i] * top[3] + bot[i] * (1 - top[3])).concat(1);
  const lum = (c) => {
    const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
  };
  const ratio = (a, b) => { const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x); return (l1 + 0.05) / (l2 + 0.05); };
  const hex = (c) => '#' + c.slice(0, 3).map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
  const bgOf = (el) => {
    const chain = [];
    for (let e = el; e; e = e.parentElement) chain.push(e);
    let bg = [255, 255, 255, 1];
    for (const e of chain.reverse()) {
      const c = parse(getComputedStyle(e).backgroundColor);
      if (c[3] > 0) bg = over(c, bg);
    }
    return bg;
  };
  const effective = (el, colorProp = 'color', pseudo = null) => {
    let bg = bgOf(el);
    let fg = over(parse(getComputedStyle(el, pseudo)[colorProp]), bg);
    let opacityChain = 1;
    for (let e = el; e && e !== document.documentElement; e = e.parentElement) {
      const o = parseFloat(getComputedStyle(e).opacity);
      if (o < 1) {
        opacityChain *= o;
        const backdrop = e.parentElement ? bgOf(e.parentElement) : [255, 255, 255, 1];
        fg = over([fg[0], fg[1], fg[2], o], backdrop);
        bg = over([bg[0], bg[1], bg[2], o], backdrop);
      }
    }
    return { fg, bg, opacityChain };
  };
  const vis = (el) => !!el && el.getClientRects().length > 0 &&
    (el.checkVisibility ? el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }) : true);
  const d = (el) => {
    if (!el) return null;
    if (el === document.body) return 'body';
    const t = (el.innerText || el.value || el.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 40);
    return `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${!el.id && el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).join('.') : ''}${el.type && el.tagName === 'INPUT' ? `[${el.type}]` : ''}${t ? ` "${t}"` : ''}`;
  };
  const panel = () => document.querySelector('.panel');
  const inPanel = (el) => {
    const p = panel();
    if (!el || !p) return null;
    return Math.round(el.getBoundingClientRect().top - p.getBoundingClientRect().top + p.scrollTop);
  };
  const snippet = () => {
    const p = panel();
    const controls = [...document.querySelectorAll('button,select,input:not([type=file]):not([type=checkbox]),summary')].filter((e) => e.offsetParent !== null);
    return {
      viewport: [innerWidth, innerHeight],
      mode: document.body.dataset.workspace,
      panelClientH: p.clientHeight,
      panelScrollH: p.scrollHeight,
      panelScrollTop: Math.round(p.scrollTop),
      slotsTopInPanel: inPanel(document.getElementById('slots')),
      presetsTopInPanel: inPanel(document.getElementById('presets')),
      roomCardH: Math.round(document.getElementById('room-card').getBoundingClientRect().height),
      catalogCardH: Math.round(document.getElementById('catalog-card').getBoundingClientRect().height),
      visibleFileInputs: [...document.querySelectorAll('input[type=file]')].filter((e) => e.offsetParent !== null && getComputedStyle(e).display !== 'none').map((e) => e.id),
      controlsUnder32px: controls.filter((e) => e.getBoundingClientRect().height < 32).map((e) => `${d(e)} ${Math.round(e.getBoundingClientRect().width)}x${Math.round(e.getBoundingClientRect().height)}`),
      overflowX: document.documentElement.scrollWidth - innerWidth,
      docScrollH: document.documentElement.scrollHeight,
    };
  };
  const textAudit = () => {
    const out = [];
    const all = [...document.querySelectorAll('body *')];
    for (const el of all) {
      if (!vis(el)) continue;
      const isField = /^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName) && el.type !== 'file' && el.type !== 'checkbox' && el.type !== 'range' && el.type !== 'color';
      const hasText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 0);
      if (!hasText && !isField) continue;
      if (el.closest('svg')) continue;
      const cs = getComputedStyle(el);
      const { fg, bg, opacityChain } = effective(el);
      const size = parseFloat(cs.fontSize);
      const weight = parseInt(cs.fontWeight, 10);
      const large = size >= 24 || (size >= 18.66 && weight >= 700);
      out.push({ el: d(el), size, weight, fg: hex(fg), bg: hex(bg), ratio: +ratio(fg, bg).toFixed(2), need: large ? 3 : 4.5, opacityChain: +opacityChain.toFixed(2), overCanvas: !!el.closest('.stage') });
    }
    return out;
  };
  const targets = () =>
    [...document.querySelectorAll('a[href],button,select,input:not([type=hidden]),textarea,summary,[tabindex]:not([tabindex="-1"])')]
      .filter(vis)
      .map((e) => { const r = e.getBoundingClientRect(); return { el: d(e), w: Math.round(r.width), h: Math.round(r.height) }; });
  window.__qa = { parse, over, lum, ratio, hex, bgOf, effective, vis, d, inPanel, snippet, textAudit, targets };
}
const QA_SRC = `(${qaInit.toString()})()`;

const browser = await chromium.launch({ channel: 'chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const allErrors = [];

async function fresh({ viewport = { width: 1440, height: 900 }, mobile = false, reducedMotion } = {}) {
  const ctx = await browser.newContext({ viewport, ...(mobile ? { hasTouch: true, isMobile: true, deviceScaleFactor: 2 } : {}), ...(reducedMotion ? { reducedMotion } : {}) });
  await ctx.addInitScript(QA_SRC);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => { errors.push('PAGEERROR: ' + e.message); allErrors.push('PAGEERROR: ' + e.message); });
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon/i.test(m.text())) { errors.push('CONSOLE: ' + m.text().slice(0, 200)); allErrors.push('CONSOLE: ' + m.text().slice(0, 200)); } });
  page.on('dialog', (dlg) => dlg.dismiss());
  await page.goto(BASE);
  await page.waitForFunction(() => document.body.dataset.viewerStatus === 'ready', null, { timeout: 30000 });
  await page.waitForTimeout(300);
  return { ctx, page, errors };
}
const openRoom = async (page) => { await page.locator('#workspace-mode button[data-mode=room]').click(); await page.waitForTimeout(700); };
const createRoom = async (page, preset = 'living') => {
  await page.selectOption('#room-preset', preset);
  await page.click('#btn-create-room');
  await page.waitForFunction(() => !!window.__rv.roomGraph(), null, { timeout: 10000 });
  await page.waitForTimeout(700);
};
const roomFacts = (page) => page.evaluate(() => {
  const g = window.__rv.roomGraph();
  if (!g) return null;
  const r = g.rooms[0];
  const xs = r.floor_polygon.map((p) => p.x), zs = r.floor_polygon.map((p) => p.z);
  return { name: r.name, lengthX: +(Math.max(...xs) - Math.min(...xs)).toFixed(4), widthZ: +(Math.max(...zs) - Math.min(...zs)).toFixed(4), ceiling: r.ceiling_height, wallThickness: g.walls[0]?.thickness, walls: g.walls.length, openings: g.openings.length, placements: g.placements.length, bounds: { minX: Math.min(...xs), maxX: Math.max(...xs), minZ: Math.min(...zs), maxZ: Math.max(...zs) } };
});
const section = async (id, name, fn) => {
  try { rec(id, name, await fn()); } catch (err) { rec(id, name, { SCRIPT_ERROR: String(err?.message ?? err).slice(0, 400) }); }
};

// ---- S01 Product, fresh load, 1440x900 ---------------------------------------------------------
await section('S01', 'Product workspace, fresh load, 1440x900: panel metrics', async () => {
  const { ctx, page, errors } = await fresh();
  const m = await page.evaluate(() => ({
    ...window.__qa.snippet(),
    dimmedRoomCardOpacity: getComputedStyle(document.getElementById('room-card')).opacity,
    firstPanelChild: window.__qa.d(document.querySelector('.panel').firstElementChild),
    panelWidth: Math.round(document.querySelector('.panel').getBoundingClientRect().width),
    stage: (() => { const r = document.querySelector('.stage').getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; })(),
    title: document.title,
    stageHint: document.getElementById('stage-hint').innerText,
    workspaceHint: document.getElementById('workspace-mode-hint').innerText,
  }));
  await page.screenshot({ path: `${SHOTS}/S01-product-1440.png` });
  await ctx.close();
  return { ...m, errors };
});

// ---- S02 switch to Room with no room -----------------------------------------------------------
await section('S02', 'Room workspace with no room: scroll position, stage content, hints', async () => {
  const { ctx, page, errors } = await fresh();
  await openRoom(page);
  const m = await page.evaluate(() => {
    const v = window.__rv.viewer();
    return {
      ...window.__qa.snippet(),
      turntableVisible: v.turntable?.visible,
      interactionMode: v.getInteractionMode(),
      stageHint: document.getElementById('stage-hint').innerText,
      workspaceHint: document.getElementById('workspace-mode-hint').innerText,
      roomStatus: document.getElementById('room-status').innerText,
      clearRoomButtonVisibleWithNoRoom: window.__qa.vis(document.getElementById('btn-clear-room')),
      saveTemplateVisibleWithNoRoom: window.__qa.vis(document.getElementById('btn-save-template-scratch')),
      roomCardHeaderInView: (() => { const p = document.querySelector('.panel').getBoundingClientRect(); const h = document.querySelector('#room-card h2').getBoundingClientRect(); return h.top >= p.top && h.bottom <= p.bottom; })(),
      ingressTabsInView: (() => { const p = document.querySelector('.panel').getBoundingClientRect(); const h = document.getElementById('room-ingress').getBoundingClientRect(); return h.top >= p.top && h.bottom <= p.bottom; })(),
    };
  });
  await page.screenshot({ path: `${SHOTS}/S02-room-empty-1440.png` });
  // Save template with no room: what happens?
  await page.click('#btn-save-template-scratch');
  await page.waitForTimeout(200);
  const saveNoRoom = await page.evaluate(() => ({ text: document.getElementById('room-status').innerText, isError: document.getElementById('room-status').classList.contains('error') }));
  await ctx.close();
  return { ...m, saveTemplateWithNoRoom: saveNoRoom, errors };
});

// ---- S03 UX-01 typed size ignored ---------------------------------------------------------------
await section('S03', 'UX-01 reproduce: preset Small bedroom + Length typed 6 -> Create room', async () => {
  const { ctx, page } = await fresh();
  await openRoom(page);
  await page.fill('#room-length', '6');
  const presetBefore = await page.inputValue('#room-preset');
  await page.click('#btn-create-room');
  await page.waitForFunction(() => !!window.__rv.roomGraph());
  await page.waitForTimeout(400);
  const out = { presetBefore, presetAfter: await page.inputValue('#room-preset'), fieldLengthAfter: await page.inputValue('#room-length'), room: await roomFacts(page), status: await page.locator('#room-status').innerText() };
  await ctx.close();
  return out;
});

// ---- S04 with a room: layout distances ------------------------------------------------------------
await section('S04', 'Room exists (Living 5x4), 1440x900: panel metrics and distances', async () => {
  const { ctx, page } = await fresh();
  await openRoom(page);
  await createRoom(page, 'living');
  const m = await page.evaluate(() => {
    const q = window.__qa;
    const top = (id) => q.inPanel(document.getElementById(id));
    const pf = document.getElementById('project-file');
    return {
      ...q.snippet(),
      projectFileDisplay: getComputedStyle(pf).display,
      projectFileHasHiddenAttr: pf.hasAttribute('hidden'),
      projectFileHeight: Math.round(pf.getBoundingClientRect().height),
      tops: Object.fromEntries(['room-ingress', 'room-preset', 'btn-create-room', 'btn-clear-room', 'room-status', 'room-plan', 'btn-undo', 'btn-export-project', 'room-wall-material', 'btn-draw-wall-mode', 'opening-type', 'btn-opening-mode', 'place-wall-snap', 'btn-place-mode', 'placement-list', 'catalog-card', 'product-select', 'slots', 'presets'].map((id) => [id, top(id)])),
      statusToPlaceBtnPx: top('btn-place-mode') - top('room-status'),
      placeBtnToProductSelectPx: top('product-select') - top('btn-place-mode'),
      catalogCardOpacityInRoomMode: getComputedStyle(document.getElementById('catalog-card')).opacity,
      roomStatus: document.getElementById('room-status').innerText,
      stageHint: document.getElementById('stage-hint').innerText,
      undoDisabled: document.getElementById('btn-undo').disabled,
    };
  });
  await page.screenshot({ path: `${SHOTS}/S04-room-created-1440-no-camera-input.png` });
  await ctx.close();
  return m;
});

// ---- S05 floor visibility + real-mouse placement ------------------------------------------------------
await section('S05', 'UX-05 reproduce: floor visibility on arrival (raycast grid) + real mouse Place clicks', async () => {
  const out = {};
  for (const preset of ['small-bedroom', 'living', 'studio']) {
    const { ctx, page } = await fresh();
    await openRoom(page);
    await createRoom(page, preset);
    const grid = (N = 21) => page.evaluate((N) => {
      const v = window.__rv.viewer();
      const c = document.querySelector('#viewer-host canvas');
      const r = c.getBoundingClientRect();
      const counts = {}; const rows = []; const floorCells = [];
      for (let j = 0; j < N; j++) {
        let row = '';
        for (let i = 0; i < N; i++) {
          const x = r.left + ((i + 0.5) * r.width) / N, y = r.top + ((j + 0.5) * r.height) / N;
          const h = v.raycastRoom(x, y);
          const k = h ? h.kind : 'none';
          counts[k] = (counts[k] || 0) + 1;
          if (k === 'floor') floorCells.push({ x: Math.round(x), y: Math.round(y), px: +h.point.x.toFixed(2), pz: +h.point.z.toFixed(2) });
          row += k === 'floor' ? 'F' : k === 'wall' ? 'W' : '.';
        }
        rows.push(row);
      }
      const cam = v.camera.position, tgt = v.controls.target;
      const dx = cam.x - tgt.x, dy = cam.y - tgt.y, dz = cam.z - tgt.z;
      return { mode: v.getInteractionMode(), counts, total: N * N, rows, floorCells, canvas: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)], centreHit: v.raycastRoom(r.left + r.width / 2, r.top + r.height / 2)?.kind ?? 'none', cameraElevationDeg: +((Math.atan2(dy, Math.hypot(dx, dz)) * 180) / Math.PI).toFixed(1), ceilingVisible: v.roomBuilt?.ceiling ? v.roomBuilt.ceiling.visible : 'no ceiling mesh' };
    }, N);
    const g1 = await grid();
    const facts = await roomFacts(page);
    const o = { room: { lengthX: facts.lengthX, widthZ: facts.widthZ }, roomMode: { counts: g1.counts, total: g1.total, floorPct: +(((g1.counts.floor || 0) / g1.total) * 100).toFixed(1), centreHit: g1.centreHit, cameraElevationDeg: g1.cameraElevationDeg, ceilingVisible: g1.ceilingVisible, rows: g1.rows } };
    if (preset === 'living') {
      await page.screenshot({ path: `${SHOTS}/S05-living-arrival-stage.png`, clip: { x: g1.canvas[0], y: g1.canvas[1], width: g1.canvas[2], height: g1.canvas[3] } });
      // Enter Place mode with the real button, then real mouse clicks.
      await page.click('#btn-place-mode');
      await page.waitForTimeout(500);
      const afterToggle = await page.evaluate(() => {
        const p = document.querySelector('.panel').getBoundingClientRect();
        const s = document.getElementById('room-status').getBoundingClientRect();
        return { pressed: document.getElementById('btn-place-mode').getAttribute('aria-pressed'), btnLabel: document.getElementById('btn-place-mode').innerText, stageHint: document.getElementById('stage-hint').innerText, panelScrollTop: Math.round(document.querySelector('.panel').scrollTop), roomStatusVisibleInPanel: s.bottom > p.top && s.top < p.bottom, roomStatusOffsetAbovePanelTopPx: Math.round(p.top - s.bottom), cursor: document.querySelector('#viewer-host canvas').style.cursor };
      });
      const g2 = await grid();
      const cx = g1.canvas[0] + g1.canvas[2] / 2, cy = g1.canvas[1] + g1.canvas[3] / 2;
      await page.mouse.click(cx, cy);
      await page.waitForTimeout(900);
      const afterCentreClick = await page.evaluate(() => ({ status: document.getElementById('room-status').innerText, isError: document.getElementById('room-status').classList.contains('error'), placements: window.__rv.roomGraph().placements.length, statusVisibleInPanel: (() => { const p = document.querySelector('.panel').getBoundingClientRect(); const s = document.getElementById('room-status').getBoundingClientRect(); return s.bottom > p.top && s.top < p.bottom; })(), anyVisibleFeedbackOnStage: [...document.querySelectorAll('.stage *')].filter((e) => window.__qa.vis(e) && e.tagName !== 'CANVAS' && e.innerText).map((e) => window.__qa.d(e)) }));
      await page.screenshot({ path: `${SHOTS}/S05-place-mode-after-centre-click.png` });
      // Void click (top-left corner of the canvas, outside the room): does the ground-plane fallback place outside?
      const voidCell = await page.evaluate(() => { const c = document.querySelector('#viewer-host canvas').getBoundingClientRect(); return { x: c.left + 40, y: c.bottom - 60 }; });
      const voidHit = await page.evaluate(({ x, y }) => { const h = window.__rv.viewer().raycastRoom(x, y); return h ? { kind: h.kind, x: +h.point.x.toFixed(2), z: +h.point.z.toFixed(2) } : null; }, voidCell);
      const before = (await roomFacts(page)).placements;
      await page.mouse.click(voidCell.x, voidCell.y);
      await page.waitForTimeout(1200);
      const afterVoid = await page.evaluate(() => { const g = window.__rv.roomGraph(); const pl = g.placements[g.placements.length - 1]; return { status: document.getElementById('room-status').innerText, placements: g.placements.length, last: pl ? { x: +pl.position.x.toFixed(2), z: +pl.position.z.toFixed(2) } : null }; });
      const f2 = await roomFacts(page);
      const outside = afterVoid.last ? (afterVoid.last.x < f2.bounds.minX || afterVoid.last.x > f2.bounds.maxX || afterVoid.last.z < f2.bounds.minZ || afterVoid.last.z > f2.bounds.maxZ) : null;
      // First visible floor cell, real click.
      const cell = g2.floorCells.find((c) => c.px > f2.bounds.minX && c.px < f2.bounds.maxX && c.pz > f2.bounds.minZ && c.pz < f2.bounds.maxZ);
      let floorClick = 'no visible in-room floor cell on arrival';
      if (cell) {
        const n0 = (await roomFacts(page)).placements;
        await page.mouse.click(cell.x, cell.y);
        await page.waitForTimeout(1200);
        floorClick = { cell, placementsBefore: n0, placementsAfter: (await roomFacts(page)).placements, status: await page.locator('#room-status').innerText() };
      }
      await page.screenshot({ path: `${SHOTS}/S05-after-place-attempts.png` });
      o.placeMode = { afterToggle, gridCounts: g2.counts, floorPct: +(((g2.counts.floor || 0) / g2.total) * 100).toFixed(1), centreClick: afterCentreClick, voidClick: { voidHit, placementsBefore: before, ...afterVoid, bounds: f2.bounds, placedOutsideRoom: outside }, floorClick };
    }
    out[preset] = o;
    await ctx.close();
  }
  return out;
});

// ---- S06 UX-10 finishes into the room -------------------------------------------------------------------
await section('S06', 'UX-10 verify: does a finish chosen in Product carry into the room? Placed vs turntable materials', async () => {
  const { ctx, page } = await fresh();
  const mats = () => page.evaluate(() => {
    const v = window.__rv.viewer();
    const summarize = (root) => {
      const set = {};
      root.traverse((o) => {
        if (!o.isMesh) return;
        const ms = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of ms) {
          const key = `${m.name || '(unnamed)'} | #${m.color ? m.color.getHexString() : '------'} | map:${m.map ? (m.map.image?.currentSrc || m.map.image?.src || m.map.name || 'yes').toString().split('/').pop().slice(0, 40) : 'none'}`;
          set[key] = (set[key] || 0) + 1;
        }
      });
      return set;
    };
    return { turntable: v.getModelRoot() ? summarize(v.getModelRoot()) : null, placed: [...(v.placementRoots?.values?.() ?? [])].map(summarize), slots: v.getSlots().map((s) => [s.def.id, s.materialId]) };
  });
  const before = await mats();
  await page.click('.slot[data-slot=frame] .swatch[data-material=wood-walnut]');
  await page.click('.slot[data-slot=pillow] .swatch[data-material=wool-terracotta]');
  await page.waitForTimeout(600);
  const afterSwatch = await mats();
  await openRoom(page);
  await createRoom(page, 'living');
  await page.evaluate(() => window.__rv.simulateRoomPointer({ kind: 'floor', point: { x: 2.5, y: 0, z: 2 } }, 'place'));
  await page.waitForFunction(() => window.__rv.roomGraph().placements.length === 1, null, { timeout: 10000 });
  await page.waitForTimeout(800);
  const afterPlace = await mats();
  const binding = await page.evaluate(() => window.__rv.roomGraph().placements[0].slot_bindings);
  const pos = await page.evaluate(() => window.__rv.roomGraph().placements[0].position);
  // Evidence shot: top-down so the placed chair is not hidden by walls.
  await page.evaluate(() => { const v = window.__rv.viewer(); v.setCeilingVisible(false); const t = v.controls.target; v.camera.position.set(t.x + 0.6, 5.5, t.z + 2.2); v.controls.update(); });
  await page.waitForTimeout(600);
  const c = await page.evaluate(() => { const r = document.querySelector('#viewer-host canvas').getBoundingClientRect(); return { x: r.left, y: r.top, width: r.width, height: r.height }; });
  await page.screenshot({ path: `${SHOTS}/S06-placed-chair-after-walnut-terracotta.png`, clip: c });
  await page.locator('#workspace-mode button[data-mode=catalog]').click();
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${SHOTS}/S06-product-chair-walnut-terracotta.png`, clip: c });
  await ctx.close();
  return { slotsBefore: before.slots, turntableDefault: before.turntable, slotsAfterSwatch: afterSwatch.slots, turntableAfterSwatch: afterSwatch.turntable, placedRootMaterials: afterPlace.placed, storedSlotBindings: binding, placedAt: pos };
});

// ---- S07 Clear room ---------------------------------------------------------------------------------------
await section('S07', 'UX-03 reproduce: Clear room with a placed chair', async () => {
  const { ctx, page } = await fresh();
  await openRoom(page);
  await createRoom(page, 'living');
  await page.evaluate(() => window.__rv.simulateRoomPointer({ kind: 'floor', point: { x: 2.5, y: 0, z: 2 } }, 'place'));
  await page.waitForFunction(() => window.__rv.roomGraph().placements.length === 1);
  const btn = await page.evaluate(() => { const b = document.getElementById('btn-clear-room'), c = document.getElementById('btn-create-room'); const rb = b.getBoundingClientRect(), rc = c.getBoundingClientRect(); return { clearW: Math.round(rb.width), createW: Math.round(rc.width), gapBelowCreatePx: Math.round(rb.top - rc.bottom), clearBg: getComputedStyle(b).backgroundColor, clearColor: getComputedStyle(b).color }; });
  let dialogSeen = false;
  page.on('dialog', () => { dialogSeen = true; });
  await page.click('#btn-clear-room');
  await page.waitForTimeout(700);
  const after = await page.evaluate(() => ({ workspace: document.body.dataset.workspace, roomGraph: window.__rv.roomGraph(), undoVisible: window.__qa.vis(document.getElementById('btn-undo')), roomStatus: document.getElementById('room-status').innerText }));
  await page.locator('#workspace-mode button[data-mode=room]').click();
  await page.keyboard.press('Meta+z');
  await page.keyboard.press('Control+z');
  await page.waitForTimeout(300);
  const afterUndoKeys = await page.evaluate(() => ({ roomGraphRestored: !!window.__rv.roomGraph() }));
  await ctx.close();
  return { button: btn, confirmDialogShown: dialogSeen, after, afterUndoKeys };
});

// ---- S08 K1 units -------------------------------------------------------------------------------------------
await section('S08', 'K1 reproduce: switch units to cm with defaults, then Create room', async () => {
  const { ctx, page } = await fresh();
  await openRoom(page);
  const read = () => page.evaluate(() => Object.fromEntries(['room-length', 'room-width', 'room-ceiling', 'room-thickness'].map((id) => [id, document.getElementById(id).value])));
  const m = await read();
  await page.selectOption('#room-units', 'cm');
  await page.waitForTimeout(200);
  const cm = await read();
  const labels = await page.evaluate(() => [...document.querySelectorAll('#room-custom-fields .field > span')].map((s) => s.innerText));
  await page.click('#btn-create-room');
  await page.waitForFunction(() => !!window.__rv.roomGraph());
  const room = await roomFacts(page);
  const status = await page.locator('#room-status').innerText();
  await ctx.close();
  return { fieldsInMeters: m, fieldsAfterSwitchToCm: cm, fieldLabels: labels, room, status };
});

// ---- S09 Mobile 375x812 -----------------------------------------------------------------------------------------
await section('S09', 'Mobile 375x812 (touch): metrics, tool/canvas separation, touch scroll over canvas', async () => {
  const { ctx, page } = await fresh({ viewport: { width: 375, height: 812 }, mobile: true });
  const pageY = (sel) => page.evaluate((sel) => { const e = document.querySelector(sel); return e ? Math.round(e.getBoundingClientRect().top + scrollY) : null; }, sel);
  const product = await page.evaluate(() => ({ ...window.__qa.snippet(), topbarH: Math.round(document.querySelector('.topbar').getBoundingClientRect().height), stage: (() => { const r = document.querySelector('.stage').getBoundingClientRect(); return { top: Math.round(r.top + scrollY), h: Math.round(r.height), w: Math.round(r.width) }; })() }));
  product.slotsPageY = await pageY('#slots');
  product.screensToSlots = +(product.slotsPageY / 812).toFixed(2);
  product.productSelectPageY = await pageY('#product-select');
  product.presetsPageY = await pageY('#presets');
  await page.screenshot({ path: `${SHOTS}/S09-mobile-product-375.png` });
  // touch swipe over canvas vs over panel
  const cdp = await ctx.newCDPSession(page);
  const swipe = async (x, y1, y2) => {
    const y0 = await page.evaluate(() => scrollY);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y: y1 }] });
    for (let i = 1; i <= 12; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y1 + ((y2 - y1) * i) / 12 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForTimeout(600);
    const y = await page.evaluate(() => scrollY);
    await page.evaluate(() => scrollTo(0, 0));
    await page.waitForTimeout(200);
    return Math.round(y - y0);
  };
  const stageMidY = product.stage.top + product.stage.h / 2;
  const swipeOverCanvas = await swipe(187, stageMidY + 100, stageMidY - 150);
  const swipeOverPanel = await swipe(187, 780, 530);
  const swipeInGutter = await swipe(6, stageMidY + 100, stageMidY - 150);
  const canvasShareOfViewport = +((Math.min(812, product.stage.top + product.stage.h) - product.stage.top) / 812).toFixed(2);
  // Room mode with a room
  await page.locator('#workspace-mode button[data-mode=room]').tap();
  await page.waitForTimeout(700);
  await page.selectOption('#room-preset', 'living');
  await page.locator('#btn-create-room').tap();
  await page.waitForFunction(() => !!window.__rv.roomGraph());
  await page.waitForTimeout(700);
  const room = await page.evaluate(() => ({ ...window.__qa.snippet(), scrollYAfterCreate: Math.round(scrollY) }));
  const stageBottom = product.stage.top + product.stage.h;
  room.placeBtnPageY = await pageY('#btn-place-mode');
  room.roomStatusPageY = await pageY('#room-status');
  room.openingBtnPageY = await pageY('#btn-opening-mode');
  room.productSelectPageY = await pageY('#product-select');
  room.stageBottomPageY = stageBottom;
  room.placeBtnBelowStageBottomPx = room.placeBtnPageY - stageBottom;
  room.screensBetweenCanvasAndPlaceBtn = +(room.placeBtnBelowStageBottomPx / 812).toFixed(2);
  await page.locator('#btn-place-mode').scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  room.canvasVisibleWhenPlaceBtnInView = await page.evaluate(() => { const r = document.querySelector('.stage').getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight; });
  await page.screenshot({ path: `${SHOTS}/S09-mobile-room-place-button-in-view.png` });
  await page.evaluate(() => scrollTo(0, 0));
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${SHOTS}/S09-mobile-room-top.png` });
  const targets = await page.evaluate(() => window.__qa.targets());
  const pointerCoarse = await page.evaluate(() => matchMedia('(pointer: coarse)').matches);
  await ctx.close();
  return { product, canvasShareOfFirstViewport: canvasShareOfViewport, touchSwipeScrollDeltaPx: { overCanvas: swipeOverCanvas, overPanel: swipeOverPanel, inLeft6pxGutter: swipeInGutter }, room, pointerCoarse, targetsUnder44: targets.filter((t) => t.h < 44 || t.w < 44).length, targetsUnder24: targets.filter((t) => t.h < 24 || t.w < 24), targetsTotal: targets.length };
});

// ---- S10 Keyboard ---------------------------------------------------------------------------------------------------
await section('S10', 'Keyboard: tab order, focus indicators, radio groups, canvas', async () => {
  const { ctx, page } = await fresh();
  const stops = [];
  for (let i = 0; i < 90; i++) {
    await page.keyboard.press('Tab');
    const s = await page.evaluate(() => {
      const e = document.activeElement;
      if (!e || e === document.body) return null;
      const cs = getComputedStyle(e);
      const card = e.closest('[data-workspace-panel]');
      const r = e.getBoundingClientRect();
      return { el: window.__qa.d(e), outline: `${cs.outlineStyle} ${cs.outlineWidth} ${cs.outlineColor} off:${cs.outlineOffset}`, focusVisible: e.matches(':focus-visible'), card: card ? card.dataset.workspacePanel : (e.closest('.panel') ? 'panel-other' : e.closest('.stage') ? 'stage' : 'topbar'), inViewport: r.top >= 0 && r.bottom <= innerHeight };
    });
    if (!s) break;
    stops.push(s);
  }
  const idx = (re) => stops.findIndex((s) => re.test(s.el)) + 1;
  const outlineKinds = {};
  for (const s of stops) { const k = s.outline.replace(/rgba?\([^)]+\)/, (m) => m); outlineKinds[k] = (outlineKinds[k] || 0) + 1; }
  const noIndicator = stops.filter((s) => /^none|0px/.test(s.outline) || / 0px /.test(s.outline)).map((s) => s.el);
  // Radio group arrow keys
  await page.locator('#workspace-mode button[data-mode=catalog]').focus();
  await page.keyboard.press('ArrowRight');
  const afterArrow = await page.evaluate(() => ({ active: window.__qa.d(document.activeElement), workspace: document.body.dataset.workspace, checked: [...document.querySelectorAll('#workspace-mode button')].map((b) => `${b.dataset.mode}:${b.getAttribute('aria-checked')}:tabindex=${b.getAttribute('tabindex')}`) }));
  await page.locator('#workspace-mode button[data-mode=room]').focus();
  await page.keyboard.press('Space');
  await page.waitForTimeout(400);
  const afterSpace = await page.evaluate(() => document.body.dataset.workspace);
  await page.keyboard.press('Enter');
  const canvas = await page.evaluate(() => { const c = document.querySelector('#viewer-host canvas'); return { tabindex: c.getAttribute('tabindex'), role: c.getAttribute('role'), ariaLabel: c.getAttribute('aria-label'), testid: c.getAttribute('data-testid'), stageLabel: document.querySelector('.stage').getAttribute('aria-label') }; });
  // Esc in place mode
  await createRoom(page, 'living');
  await page.click('#btn-place-mode');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  const escLeavesPlace = await page.evaluate(() => document.getElementById('btn-place-mode').getAttribute('aria-pressed'));
  await ctx.close();
  return {
    totalTabStopsProductMode: stops.length,
    stopsBeforeProductSelect: idx(/#product-select/) - 1,
    stopsBeforeFirstSwatch: idx(/button\.swatch/) - 1,
    stopIndex: { roomToggle: idx(/Room workspace/), createRoom: idx(/#btn-create-room/), productSelect: idx(/#product-select/), firstSwatch: idx(/button\.swatch/), firstPreset: idx(/Studio soft/) },
    stopsInDimmedRoomCardWhileInProductMode: stops.filter((s) => s.card === 'room').length,
    outlineKinds,
    focusStopsWithoutVisibleOutline: noIndicator,
    order: stops.map((s) => s.el),
    radioArrowRight: afterArrow,
    radioSpaceSwitchesTo: afterSpace,
    canvas,
    escapeLeavesPlaceMode_ariaPressedAfterEsc: escLeavesPlace,
  };
});

// ---- S11 A11y static structure ------------------------------------------------------------------------------------------
await section('S11', 'Accessibility structure (DOM facts)', async () => {
  const { ctx, page } = await fresh();
  await openRoom(page);
  await createRoom(page, 'living');
  const m = await page.evaluate(() => {
    const q = window.__qa;
    const fields = [...document.querySelectorAll('input,select,textarea')];
    const name = (e) => (e.getAttribute('aria-label') || (e.labels && [...e.labels].map((l) => l.innerText.trim()).join(' ')) || e.getAttribute('title') || e.getAttribute('placeholder') || '').trim();
    const ids = [...document.querySelectorAll('[id]')].map((e) => e.id);
    return {
      lang: document.documentElement.lang,
      h1: document.querySelectorAll('h1').length,
      headings: [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')].filter(q.vis).map((h) => `${h.tagName} ${h.innerText.trim().replace(/\s+/g, ' ')}`),
      landmarks: [...document.querySelectorAll('header,nav,main,aside,footer,section[aria-label],[role=banner],[role=main],[role=navigation],[role=complementary]')].map((e) => `${e.tagName.toLowerCase()}${e.getAttribute('aria-label') ? `[${e.getAttribute('aria-label')}]` : ''}`),
      asideHasLabel: !!document.querySelector('aside').getAttribute('aria-label'),
      roleStatusCount: document.querySelectorAll('[role=status]').length,
      roleStatusVisibleNow: [...document.querySelectorAll('[role=status]')].filter(q.vis).map((e) => q.d(e)),
      ariaLiveExplicit: document.querySelectorAll('[aria-live]').length,
      roleAlertCount: document.querySelectorAll('[role=alert]').length,
      fieldsWithoutAccessibleName: fields.filter((e) => !name(e)).map(q.d),
      fieldsNamedOnlyByAriaLabelDifferentFromVisibleLabel: fields.filter((e) => e.getAttribute('aria-label') && e.labels && e.labels.length && !e.getAttribute('aria-label').toLowerCase().includes([...e.labels][0].innerText.trim().toLowerCase().split(/\s*\(/)[0])).map((e) => `${q.d(e)} aria-label="${e.getAttribute('aria-label')}" visible="${[...e.labels][0].innerText.trim()}"`),
      duplicateIds: ids.filter((id, i) => ids.indexOf(id) !== i),
      radiogroups: [...document.querySelectorAll('[role=radiogroup]')].map((g) => ({ id: g.id, named: !!(g.getAttribute('aria-label') || g.getAttribute('aria-labelledby')), radios: g.querySelectorAll('[role=radio]').length, rovingTabindex: [...g.querySelectorAll('[role=radio]')].some((r) => r.getAttribute('tabindex') === '-1') })),
      buttonsWithoutText: [...document.querySelectorAll('button')].filter(q.vis).filter((b) => !b.innerText.trim() && !b.getAttribute('aria-label')).map(q.d),
      swatchNames: [...document.querySelectorAll('.swatch')].slice(0, 3).map((b) => ({ ariaLabel: b.getAttribute('aria-label'), title: b.title, pressed: b.getAttribute('aria-pressed') })),
      imagesWithoutAlt: [...document.querySelectorAll('img:not([alt])')].length,
      planSvg: (() => { const s = document.querySelector('#room-plan svg'); return s ? { role: s.getAttribute('role'), ariaLabel: s.getAttribute('aria-label'), title: !!s.querySelector('title') } : null; })(),
      titleOnlyHelp: [...document.querySelectorAll('[title]')].filter(q.vis).map((e) => `${q.d(e)} title="${e.title}"`).slice(0, 12),
      metaViewport: document.querySelector('meta[name=viewport]')?.content,
      toolButtonsPressedAttr: ['btn-place-mode', 'btn-opening-mode', 'btn-draw-wall-mode'].map((id) => `${id}:${document.getElementById(id).getAttribute('aria-pressed')}`),
    };
  });
  await ctx.close();
  return m;
});

// ---- S12 Contrast -----------------------------------------------------------------------------------------------------------
await section('S12', 'Text contrast (WCAG 1.4.3) and non-text contrast (1.4.11), per state', async () => {
  const summarize = (rows) => {
    const fails = rows.filter((r) => r.ratio < r.need);
    const uniq = {};
    for (const r of fails) { const k = `${r.fg} on ${r.bg} = ${r.ratio}:1 (${r.size}px/${r.weight}${r.opacityChain < 1 ? `, opacity ${r.opacityChain}` : ''}${r.overCanvas ? ', over canvas: backdrop approximated' : ''})`; (uniq[k] ||= []).push(r.el); }
    const pairs = {};
    for (const r of rows) { const k = `${r.fg} on ${r.bg}`; if (!pairs[k]) pairs[k] = { ratio: r.ratio, n: 0 }; pairs[k].n++; }
    return { textElements: rows.length, failing: fails.length, failingGroups: Object.entries(uniq).map(([k, v]) => ({ pair: k, count: v.length, examples: v.slice(0, 4) })), lowestPassing: Object.entries(pairs).filter(([, v]) => v.ratio >= 4.5).sort((a, b) => a[1].ratio - b[1].ratio).slice(0, 4).map(([k, v]) => `${k} = ${v.ratio}:1 (${v.n})`) };
  };
  const out = {};
  const { ctx, page } = await fresh();
  out.productMode = summarize(await page.evaluate(() => window.__qa.textAudit()));
  out.nonText = await page.evaluate(() => {
    const q = window.__qa;
    const borderVs = (sel) => { const e = document.querySelector(sel); if (!e) return null; const cs = getComputedStyle(e); const bg = q.bgOf(e.parentElement); const own = q.bgOf(e); const b = q.over(q.parse(cs.borderTopColor), bg); return { el: sel, border: q.hex(b), fill: q.hex(own), outside: q.hex(bg), borderVsOutside: +q.ratio(b, bg).toFixed(2), fillVsOutside: +q.ratio(own, bg).toFixed(2) }; };
    const seg = document.querySelector('#workspace-mode button[aria-checked=true]');
    const segOff = document.querySelector('#workspace-mode button[aria-checked=false]');
    return {
      inputBoundaries: ['#product-select', '#texture-name', '#btn-reset', '.swatch'].map(borderVs),
      focusRingAccentVsWhite: +q.ratio(q.parse('rgb(0,128,96)'), [255, 255, 255, 1]).toFixed(2),
      focusRingAccentVsPageBg: +q.ratio(q.parse('rgb(0,128,96)'), [241, 241, 241, 1]).toFixed(2),
      segmentedSelectedFillVsTrack: +q.ratio(q.bgOf(seg), q.bgOf(seg.parentElement)).toFixed(2),
      segmentedSelectedText: getComputedStyle(seg).color, segmentedUnselectedText: getComputedStyle(segOff).color,
      segmentedSelectedVsUnselectedTextRatio: +q.ratio(q.parse(getComputedStyle(seg).color), q.parse(getComputedStyle(segOff).color)).toFixed(2),
      placeholder: (() => { const e = document.getElementById('texture-name'); const { fg, bg } = q.effective(e, 'color', '::placeholder'); return { fg: q.hex(fg), bg: q.hex(bg), ratio: +q.ratio(fg, bg).toFixed(2) }; })(),
      swatchPressedRing: 'box-shadow 2px surface + 2px accent (accent vs white = see focusRingAccentVsWhite)',
    };
  });
  await openRoom(page);
  await createRoom(page, 'living');
  await page.click('#btn-place-mode');
  out.roomModeWithRoomPlaceOn = summarize(await page.evaluate(() => window.__qa.textAudit()));
  out.pressedToolButton = await page.evaluate(() => { const q = window.__qa; const b = document.getElementById('btn-place-mode'); const { fg, bg } = q.effective(b); return { fg: q.hex(fg), bg: q.hex(bg), ratio: +q.ratio(fg, bg).toFixed(2) }; });
  // error state
  await page.evaluate(() => window.__rv.simulateRoomPointer(null, 'place'));
  out.errorStatus = await page.evaluate(() => { const q = window.__qa; const e = document.getElementById('room-status'); const { fg, bg } = q.effective(e); return { text: e.innerText, fg: q.hex(fg), bg: q.hex(bg), ratio: +q.ratio(fg, bg).toFixed(2), errorVsNormalTextColorRatio: +q.ratio(fg, q.parse('rgb(97,97,97)')).toFixed(2), hasIconOrPrefix: /error|⚠|!/i.test(e.innerText), role: e.getAttribute('role') }; });
  // import review
  await page.locator('#room-ingress button[data-ingress=import]').click();
  await page.click('#btn-import-fixture');
  await page.waitForSelector('#import-review:not([hidden])');
  await page.waitForTimeout(400);
  out.importReview = summarize(await page.evaluate(() => window.__qa.textAudit()));
  await page.locator('#import-review').scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${SHOTS}/S12-import-review-1440.png` });
  await ctx.close();
  return out;
});

// ---- S13 Reduced motion -------------------------------------------------------------------------------------------------------
await section('S13', 'prefers-reduced-motion: is the smooth panel scroll / card transition still animated?', async () => {
  const run = async (reducedMotion) => {
    const { ctx, page } = await fresh({ reducedMotion });
    await page.evaluate(() => { const p = document.querySelector('.panel'); p.scrollTop = 1500; });
    await page.waitForTimeout(100);
    const samples = await page.evaluate(async () => {
      const p = document.querySelector('.panel');
      const s = [Math.round(p.scrollTop)];
      document.querySelector('#workspace-mode button[data-mode=room]').click();
      for (let i = 0; i < 8; i++) { await new Promise((r) => setTimeout(r, 40)); s.push(Math.round(p.scrollTop)); }
      await new Promise((r) => setTimeout(r, 700));
      s.push(Math.round(p.scrollTop));
      return s;
    });
    const mq = await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
    const transition = await page.evaluate(() => getComputedStyle(document.getElementById('room-card')).transitionDuration);
    await ctx.close();
    return { mediaQueryReduce: mq, panelScrollTopSamples_40msApart: samples, distinctIntermediateValues: new Set(samples).size, cardTransitionDuration: transition };
  };
  return { noPreference: await run('no-preference'), reduce: await run('reduce'), cssHasReducedMotionQuery: /prefers-reduced-motion/.test(readFileSync(`${VIEWER}/src/styles.css`, 'utf8')) };
});

// ---- S14 Breakpoint sweep --------------------------------------------------------------------------------------------------------
await section('S14', 'Responsive sweep: overflow, clipping, layout per width (Product, then Room with a room)', async () => {
  const sizes = [[1920, 1080], [1440, 900], [1280, 800], [1024, 768], [900, 700], [861, 700], [860, 700], [768, 1024], [721, 800], [720, 450], [640, 400], [480, 800], [375, 812], [320, 568]];
  const { ctx, page } = await fresh();
  const measure = () => page.evaluate(() => {
    const q = window.__qa;
    const offenders = [...document.querySelectorAll('body *')].filter((e) => q.vis(e) && e.getBoundingClientRect().right > innerWidth + 1 && !e.closest('.code')).map(q.d).slice(0, 6);
    const clipped = [...document.querySelectorAll('button,label,h2,h3,.badge,select,p')].filter((e) => q.vis(e) && e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).overflowX !== 'visible').map(q.d).slice(0, 6);
    const st = document.querySelector('.stage').getBoundingClientRect();
    const tb = document.querySelector('.topbar').getBoundingClientRect();
    const tog = document.getElementById('workspace-mode').getBoundingClientRect();
    return { w: innerWidth, h: innerHeight, overflowX: document.documentElement.scrollWidth - innerWidth, pageScrollsVertically: document.documentElement.scrollHeight > innerHeight + 1, cols: getComputedStyle(document.querySelector('.layout')).gridTemplateColumns, topbarH: Math.round(tb.height), stage: `${Math.round(st.width)}x${Math.round(st.height)}`, stageAspect: +(st.width / st.height).toFixed(2), toggleW: Math.round(tog.width), panelW: Math.round(document.querySelector('.panel').getBoundingClientRect().width), panelClientH: document.querySelector('.panel').clientHeight, offenders, clipped };
  });
  const product = [];
  for (const [w, h] of sizes) { await page.setViewportSize({ width: w, height: h }); await page.waitForTimeout(250); product.push(await measure()); }
  await page.setViewportSize({ width: 1440, height: 900 });
  await openRoom(page);
  await createRoom(page, 'living');
  const room = [];
  for (const [w, h] of sizes) { await page.setViewportSize({ width: w, height: h }); await page.waitForTimeout(250); room.push(await measure()); }
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${SHOTS}/S14-room-1024.png` });
  await page.setViewportSize({ width: 320, height: 568 });
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${SHOTS}/S14-room-320.png` });
  await ctx.close();
  return { product, room };
});

// ---- S15 Interaction states --------------------------------------------------------------------------------------------------------
await section('S15', 'Interaction states: hover, disabled, pressed, active', async () => {
  const { ctx, page } = await fresh();
  const style = (sel) => page.evaluate((sel) => { const e = document.querySelector(sel); const cs = getComputedStyle(e); return { bg: cs.backgroundColor, color: cs.color, border: cs.borderTopColor, opacity: cs.opacity, cursor: cs.cursor, shadow: cs.boxShadow.slice(0, 60) }; }, sel);
  const hoverDiff = async (sel) => { await page.mouse.move(2, 2); const a = await style(sel); await page.hover(sel); await page.waitForTimeout(250); const b = await style(sel); return { sel, changes: Object.keys(a).filter((k) => a[k] !== b[k]).map((k) => `${k}: ${a[k]} -> ${b[k]}`) }; };
  const hover = [];
  for (const sel of ['#btn-reset', '#btn-add-texture', '#workspace-mode button[data-mode=room]', '.swatch[aria-pressed=false]', '#product-select', '#texture-name']) hover.push(await hoverDiff(sel));
  await openRoom(page);
  await createRoom(page, 'living');
  const disabled = { undoDisabledAttr: await page.evaluate(() => document.getElementById('btn-undo').disabled), undo: await style('#btn-undo'), enabledSibling: await style('#btn-export-project') };
  disabled.visuallyIdentical = JSON.stringify({ ...disabled.undo, cursor: 0 }) === JSON.stringify({ ...disabled.enabledSibling, cursor: 0 });
  await page.locator('#btn-undo').scrollIntoViewIfNeeded();
  const r = await page.evaluate(() => { const a = document.getElementById('btn-undo').parentElement.getBoundingClientRect(); const b = document.getElementById('btn-export-project').parentElement.getBoundingClientRect(); return { x: a.left - 8, y: a.top - 8, width: a.width + 16, height: b.bottom - a.top + 16 }; });
  await page.screenshot({ path: `${SHOTS}/S15-disabled-undo-vs-enabled-export.png`, clip: r });
  await page.evaluate(() => window.__rv.simulateRoomPointer({ kind: 'floor', point: { x: 2.5, y: 0, z: 2 } }, 'place'));
  await page.waitForFunction(() => window.__rv.roomGraph().placements.length === 1);
  await page.waitForTimeout(300);
  hover.push(await hoverDiff('#placement-list li button'));
  const listBtn = await page.evaluate(() => { const b = document.querySelector('#placement-list li button'); const r = b.getBoundingClientRect(); const cs = getComputedStyle(b); return { w: Math.round(r.width), h: Math.round(r.height), font: cs.fontSize, text: b.innerText }; });
  const pressed = { before: await style('#btn-place-mode') };
  await page.click('#btn-place-mode');
  pressed.after = await style('#btn-place-mode');
  pressed.labelAfter = await page.locator('#btn-place-mode').innerText();
  const activeRule = /:active/.test(readFileSync(`${VIEWER}/src/styles.css`, 'utf8'));
  await ctx.close();
  return { hover, disabled, placementDeleteButton: listBtn, pressed, cssHasActiveRule: activeRule };
});

// ---- S16 Content states ---------------------------------------------------------------------------------------------------------------
await section('S16', 'Content: empty, error, loading and long-content states', async () => {
  const { ctx, page } = await fresh();
  const st = (id) => page.evaluate((id) => { const e = document.getElementById(id); return { text: e.innerText, isError: e.classList.contains('error'), color: getComputedStyle(e).color }; }, id);
  const out = {};
  // bad model uploads
  await page.setInputFiles('#model-files', { name: 'broken.glb', mimeType: 'model/gltf-binary', buffer: Buffer.from('this is not a glb') });
  await page.waitForTimeout(1200);
  out.badGlb = await st('model-upload-status');
  await page.setInputFiles('#model-files', { name: 'chair.fbx', mimeType: 'application/octet-stream', buffer: Buffer.from('x') });
  await page.waitForTimeout(800);
  out.fbx = await st('model-upload-status');
  await page.click('#btn-add-texture');
  out.textureNoFile = await st('texture-upload-status');
  await openRoom(page);
  out.emptyRoomStatus = await st('room-status');
  await page.locator('#room-ingress button[data-ingress=template]').click();
  out.emptyTemplates = await st('template-status');
  await page.locator('#room-ingress button[data-ingress=import]').click();
  await page.click('#btn-import-plan');
  out.importNoFile = await st('import-status');
  await page.setInputFiles('#plan-file', { name: 'plan.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4') });
  await page.click('#btn-import-plan');
  await page.waitForTimeout(300);
  out.importPdf = await st('import-status');
  await page.setInputFiles('#plan-file', { name: 'garbage.dwg', mimeType: 'application/octet-stream', buffer: Buffer.from(Array.from({ length: 512 }, (_, i) => (i * 37) % 256)) });
  await page.click('#btn-import-plan');
  await page.waitForSelector('#import-review:not([hidden])', { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(400);
  out.garbageDwg = { status: await st('import-status'), banner: await page.locator('#import-extract-banner').innerText().catch(() => null), walls: await page.locator('#import-wall-list li').allInnerTexts() };
  // invalid size
  await page.locator('#room-ingress button[data-ingress=scratch]').click();
  await page.selectOption('#room-preset', 'custom');
  await page.fill('#room-length', '');
  await page.click('#btn-create-room');
  await page.waitForTimeout(200);
  out.blankLength = await st('room-status');
  // long template title
  await page.fill('#room-length', '4');
  await page.click('#btn-create-room');
  await page.waitForFunction(() => !!window.__rv.roomGraph());
  await page.fill('#template-title', 'W'.repeat(64));
  await page.click('#btn-save-template-scratch');
  await page.waitForTimeout(400);
  out.longTemplateTitle = await page.evaluate(() => { const li = document.querySelector('#template-list li'); const p = document.querySelector('.panel'); const card = document.getElementById('room-card'); return li ? { liScrollW: li.scrollWidth, liClientW: li.clientWidth, liRight: Math.round(li.getBoundingClientRect().right), cardRight: Math.round(card.getBoundingClientRect().right), spillsOutOfCardPx: Math.round(li.getBoundingClientRect().right - card.getBoundingClientRect().right), panelScrollW: p.scrollWidth, panelClientW: p.clientWidth, buttonsRight: Math.round(li.querySelector('button:last-child').getBoundingClientRect().right), viewportW: innerWidth, docOverflowX: document.documentElement.scrollWidth - innerWidth, status: document.getElementById('template-status').innerText } : 'no template row'; });
  await page.locator('#template-list').scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${SHOTS}/S16-long-template-title.png` });
  out.loadingOverlayText = 'Loading… (static: index.html:34 and main.ts setStatus)';
  await ctx.close();
  return out;
});

// ---- S17 Style inventory (aesthetic consistency) -------------------------------------------------------------------------------------------
await section('S17', 'Aesthetic consistency: computed type/spacing/radius/height inventory + styles.css static parse', async () => {
  const { ctx, page } = await fresh();
  await openRoom(page);
  await createRoom(page, 'living');
  await page.evaluate(() => window.__rv.simulateRoomPointer({ kind: 'floor', point: { x: 2.5, y: 0, z: 2 } }, 'place'));
  await page.waitForFunction(() => window.__rv.roomGraph().placements.length === 1);
  const computed = await page.evaluate(() => {
    const q = window.__qa;
    const tally = (arr) => { const o = {}; for (const v of arr) o[v] = (o[v] || 0) + 1; return Object.fromEntries(Object.entries(o).sort((a, b) => b[1] - a[1])); };
    const textEls = [...document.querySelectorAll('body *')].filter((e) => q.vis(e) && [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()) && !e.closest('svg'));
    const controls = [...document.querySelectorAll('button,select,input:not([type=checkbox]),summary')].filter(q.vis);
    const lefts = [...document.querySelectorAll('#room-card > *, #room-card .field, #room-card .btn, #room-card h3, #room-card .segmented')].filter(q.vis).map((e) => Math.round(e.getBoundingClientRect().left));
    const btnWidths = [...document.querySelectorAll('#room-card .btn')].filter(q.vis).map((b) => ({ id: b.id, w: Math.round(b.getBoundingClientRect().width), primary: b.classList.contains('btn-primary') }));
    const cardW = Math.round(document.getElementById('room-card').clientWidth - 28);
    return {
      fontSizes: tally(textEls.map((e) => getComputedStyle(e).fontSize)),
      fontWeights: tally(textEls.map((e) => getComputedStyle(e).fontWeight)),
      fontFamiliesResolved: tally(textEls.map((e) => getComputedStyle(e).fontFamily.split(',')[0].trim())),
      textColors: tally(textEls.map((e) => q.hex(q.parse(getComputedStyle(e).color)))),
      controlHeights: tally(controls.map((e) => `${e.tagName.toLowerCase()}${e.type && e.tagName === 'INPUT' ? `[${e.type}]` : ''}${e.closest('.segmented') ? '.segmented' : e.closest('.room-list') ? '.room-list' : e.classList.contains('swatch') ? '.swatch' : ''} ${Math.round(e.getBoundingClientRect().height)}px`)),
      radii: tally([...document.querySelectorAll('body *')].filter(q.vis).map((e) => getComputedStyle(e).borderTopLeftRadius).filter((r) => r !== '0px')),
      roomCardLeftEdges: tally(lefts),
      roomCardButtonWidths: btnWidths, roomCardContentWidth: cardW,
      fullWidthButtons: btnWidths.filter((b) => Math.abs(b.w - cardW) <= 2).map((b) => b.id), autoWidthButtons: btnWidths.filter((b) => Math.abs(b.w - cardW) > 2).map((b) => `${b.id}:${b.w}`),
      nativeFileInputsVisible: [...document.querySelectorAll('input[type=file]')].filter(q.vis).length,
      badges: [...document.querySelectorAll('.badge')].filter(q.vis).map((b) => b.innerText),
    };
  });
  await ctx.close();
  const css = readFileSync(`${VIEWER}/src/styles.css`, 'utf8');
  const rootBlock = css.match(/:root\s*{[^}]*}/)?.[0] ?? '';
  const rest = css.replace(rootBlock, '');
  const decls = [...rest.matchAll(/([a-z-]+)\s*:\s*([^;{}]+);/g)].map((m) => [m[1], m[2].trim()]);
  const tallyPx = (re) => { const s = {}; for (const [p, v] of decls) if (re.test(p)) for (const n of v.matchAll(/(-?\d*\.?\d+)px/g)) s[n[1]] = (s[n[1]] || 0) + 1; return Object.fromEntries(Object.entries(s).sort((a, b) => +a[0] - +b[0])); };
  const spacing = tallyPx(/^(padding|margin|gap)(-[a-z]+)?$/);
  const offGrid = Object.keys(spacing).filter((v) => +v % 4 !== 0 && +v !== 0);
  const rawHex = {}; for (const m of rest.matchAll(/#[0-9a-fA-F]{3,8}\b/g)) rawHex[m[0].toLowerCase()] = (rawHex[m[0].toLowerCase()] || 0) + 1;
  const tokens = [...rootBlock.matchAll(/(--[a-z-]+)\s*:\s*([^;]+);/g)].map((m) => `${m[1]}: ${m[2].trim()}`);
  return {
    computed,
    cssStatic: {
      tokens,
      spacingPxValuesUsed: spacing, spacingDistinct: Object.keys(spacing).length, spacingOff4pxGrid: offGrid,
      fontSizeDecls: tallyPx(/^font-size$/), fontShorthand: decls.filter(([p]) => p === 'font').map(([, v]) => v),
      fontWeightDecls: (() => { const s = {}; for (const [p, v] of decls) if (p === 'font-weight') s[v] = (s[v] || 0) + 1; return s; })(),
      radiusDecls: (() => { const s = {}; for (const [p, v] of decls) if (p === 'border-radius') s[v] = (s[v] || 0) + 1; return s; })(),
      rawHexOutsideRoot: rawHex, rawHexDistinct: Object.keys(rawHex).length, rawHexUses: Object.values(rawHex).reduce((a, b) => a + b, 0),
      rawRgba: [...rest.matchAll(/rgba\([^)]+\)/g)].map((m) => m[0]),
      transitions: decls.filter(([p]) => p === 'transition').map(([, v]) => v),
      mediaQueries: [...css.matchAll(/@media[^{]+/g)].map((m) => m[0].trim()),
      darkModeSupport: /prefers-color-scheme/.test(css), colorSchemeDecl: /color-scheme:\s*light/.test(css),
      inlineStylesInMainTs: (readFileSync(`${VIEWER}/src/main.ts`, 'utf8').match(/\.style\.[a-zA-Z]+\s*=|style="/g) || []).length,
    },
  };
});

// ---- S18 Text spacing ------------------------------------------------------------------------------------------------------------------------
await section('S18', 'WCAG 1.4.12 text-spacing override: clipped or overlapping text?', async () => {
  const { ctx, page } = await fresh();
  await openRoom(page);
  await createRoom(page, 'living');
  const count = () => page.evaluate(() => [...document.querySelectorAll('button,label,h2,h3,.badge,select,p,li,span')].filter((e) => window.__qa.vis(e) && (e.scrollWidth > e.clientWidth + 1 || e.scrollHeight > e.clientHeight + 1) && getComputedStyle(e).overflow !== 'visible').map(window.__qa.d));
  const before = await count();
  await page.addStyleTag({ content: '* { line-height: 1.5 !important; letter-spacing: 0.12em !important; word-spacing: 0.16em !important; } p { margin-bottom: 2em !important; }' });
  await page.waitForTimeout(300);
  const after = await count();
  const overflowX = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  const toggle = await page.evaluate(() => [...document.querySelectorAll('#workspace-mode button, #room-ingress button, #presets button')].map((b) => ({ t: b.innerText, clipped: b.scrollWidth > b.clientWidth + 1, wraps: b.getBoundingClientRect().height > 40 })));
  await page.screenshot({ path: `${SHOTS}/S18-text-spacing-1440.png` });
  await ctx.close();
  return { clippedBefore: before, clippedAfter: after, overflowX, segmentedButtons: toggle.filter((t) => t.clipped || t.wraps) };
});

// ---- S19 Static copy word count ----------------------------------------------------------------------------------------------------------------
await section('S19', 'Static helper-text word count in index.html (validates the "284 words" figure)', async () => {
  const html = readFileSync(`${VIEWER}/index.html`, 'utf8');
  const ps = [...html.matchAll(/<p\b([^>]*)>([\s\S]*?)<\/p>/g)].map((m) => {
    const id = (m[1].match(/id="([^"]+)"/) || [])[1] ?? null;
    const text = m[2].replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
    const tokens = text.split(' ').filter(Boolean);
    return { id, inPanel: html.indexOf(m[0]) > html.indexOf('<aside class="panel">'), words: tokens.filter((t) => !/^[·—]+$/.test(t)).length, wordsAlsoSkippingArrows: tokens.filter((t) => !/^[·—→]+$/.test(t)).length, text: text.slice(0, 60) };
  }).filter((p) => p.words > 0);
  const sum = (arr, k = 'words') => arr.reduce((a, p) => a + p[k], 0);
  return { paragraphsWithStaticText: ps.length, allWords: sum(ps), panelOnlyParagraphs: ps.filter((p) => p.inPanel).length, panelOnlyWords: sum(ps.filter((p) => p.inPanel)), allWordsSkippingArrows: sum(ps, 'wordsAlsoSkippingArrows'), excludingDynamicStatusLines: sum(ps.filter((p) => !/status$/.test(p.id ?? ''))), perParagraph: ps };
});

// ---- S20 Reload persistence + console errors ----------------------------------------------------------------------------------------------------
await section('S20', 'Cold reload with a saved room: lands on Product with the chair; console errors across the run', async () => {
  const { ctx, page } = await fresh();
  await openRoom(page);
  await createRoom(page, 'living');
  await page.reload();
  await page.waitForFunction(() => document.body.dataset.viewerStatus === 'ready', null, { timeout: 30000 });
  await page.waitForTimeout(500);
  const m = await page.evaluate(() => ({ workspace: document.body.dataset.workspace, roomRestored: !!window.__rv.roomGraph(), turntableVisible: window.__rv.viewer().turntable.visible, anyNoticeThatARoomIsSaved: document.getElementById('room-status').innerText, roomStatusVisibleWithoutScroll: (() => { const p = document.querySelector('.panel').getBoundingClientRect(); const s = document.getElementById('room-status').getBoundingClientRect(); return s.top >= p.top && s.bottom <= p.bottom; })() }));
  await ctx.close();
  return { ...m, consoleAndPageErrorsAcrossWholeRun: [...new Set(allErrors)] };
});

await browser.close();
writeFileSync(`${OUT}/viewer-results.json`, JSON.stringify(results, null, 2));
console.log(`\nWrote ${OUT}/viewer-results.json`);
