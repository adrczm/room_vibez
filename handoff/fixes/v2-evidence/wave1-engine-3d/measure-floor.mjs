// UX-05 / C5 measurement, usable before and after the engine change.
// usage: node measure-floor.mjs <label> [baseUrl]
// Writes $OUT/floor-<label>.json and canvas screenshots. No camera input after Create room unless stated.
import { chromium } from '/private/tmp/claude-501/-Users-adrian-Desktop-Room-Vibez/7ac663fe-e0d6-4b3c-af69-487be083d847/scratchpad/ws-engine/node_modules/playwright/index.mjs';
import pngjs from '/private/tmp/claude-501/-Users-adrian-Desktop-Room-Vibez/7ac663fe-e0d6-4b3c-af69-487be083d847/scratchpad/ws-engine/node_modules/pngjs/lib/png.js';
import { writeFileSync, mkdirSync } from 'node:fs';

const { PNG } = pngjs;
const label = process.argv[2] || 'run';
const BASE = process.argv[3] || 'http://127.0.0.1:18781/';
const OUT = '/private/tmp/claude-501/-Users-adrian-Desktop-Room-Vibez/7ac663fe-e0d6-4b3c-af69-487be083d847/scratchpad/out-engine';
mkdirSync(`${OUT}/shots`, { recursive: true });

const browser = await chromium.launch({ channel: 'chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
async function fresh({ viewport = { width: 1440, height: 900 }, mobile = false } = {}) {
  const ctx = await browser.newContext({ viewport, ...(mobile ? { hasTouch: true, isMobile: true, deviceScaleFactor: 2 } : {}) });
  const page = await ctx.newPage();
  page.on('dialog', (d) => d.dismiss());
  await page.goto(BASE);
  await page.waitForFunction(() => document.body.dataset.viewerStatus === 'ready', null, { timeout: 60000 });
  await page.waitForTimeout(2200);
  return { ctx, page };
}
const openRoom = async (page) => { await page.locator('#workspace-mode button[data-mode=room]').click(); await page.waitForTimeout(1500); };
const createRoom = async (page, preset = 'living') => { await page.selectOption('#room-preset', preset); await page.click('#btn-create-room'); await page.waitForFunction(() => !!window.__rv.roomGraph()); await page.waitForTimeout(1500); };

// F8 grid, copied from fixes/qa-evidence/audit-viewer-followup.mjs (section F8).
const f8grid = (page) => page.evaluate(() => { const v = window.__rv.viewer(); const c = document.querySelector('#viewer-host canvas').getBoundingClientRect(); const N = 21; const g = window.__rv.roomGraph().rooms[0].floor_polygon; const xs = g.map((p) => p.x), zs = g.map((p) => p.z); let floorIn = 0, wall = 0; for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const h = v.raycastRoom(c.left + ((i + 0.5) * c.width) / N, c.top + ((j + 0.5) * c.height) / N); if (h?.kind === 'floor' && h.point.x > Math.min(...xs) && h.point.x < Math.max(...xs) && h.point.z > Math.min(...zs) && h.point.z < Math.max(...zs)) floorIn++; else if (h?.kind === 'wall') wall++; } const cam = v.camera.position, t = v.controls.target; return { inRoomFloorPct: +((floorIn / (N * N)) * 100).toFixed(1), wallPct: +((wall / (N * N)) * 100).toFixed(1), elevationDeg: +((Math.atan2(cam.y - t.y, Math.hypot(cam.x - t.x, cam.z - t.z)) * 180) / Math.PI).toFixed(1) }; });

// Share of the room's floor area that is on screen and unobstructed, plus the projected-room-centre raycast.
const floorCoverage = (page) => page.evaluate(() => {
  const v = window.__rv.viewer();
  const rect = document.querySelector('#viewer-host canvas').getBoundingClientRect();
  const poly = window.__rv.roomGraph().rooms[0].floor_polygon;
  const xs = poly.map((p) => p.x), zs = poly.map((p) => p.z);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minZ = Math.min(...zs), maxZ = Math.max(...zs);
  const Vec = v.camera.position.constructor;
  const toClient = (x, y, z) => { const p = new Vec(x, y, z).project(v.camera); return { cx: rect.left + ((p.x + 1) / 2) * rect.width, cy: rect.top + ((1 - p.y) / 2) * rect.height, inFront: p.z < 1 }; };
  const N = 15; let total = 0, onScreen = 0, visible = 0;
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const x = minX + 0.05 + ((i + 0.5) / N) * (maxX - minX - 0.1), z = minZ + 0.05 + ((j + 0.5) / N) * (maxZ - minZ - 0.1);
    total++;
    const s = toClient(x, 0, z);
    const inside = s.inFront && s.cx >= rect.left && s.cx <= rect.right && s.cy >= rect.top && s.cy <= rect.bottom;
    if (!inside) continue;
    onScreen++;
    const h = v.raycastRoom(s.cx, s.cy);
    if (h && h.kind === 'floor' && Math.hypot(h.point.x - x, h.point.z - z) < 0.05) visible++;
  }
  const corners = poly.map((p) => { const s = toClient(p.x, 0, p.z); return { x: p.x, z: p.z, onScreen: s.inFront && s.cx >= rect.left && s.cx <= rect.right && s.cy >= rect.top && s.cy <= rect.bottom, px: [Math.round(s.cx - rect.left), Math.round(s.cy - rect.top)] }; });
  const c = toClient((minX + maxX) / 2, 0, (minZ + maxZ) / 2);
  const ch = v.raycastRoom(c.cx, c.cy);
  const cam = v.camera.position, t = v.controls.target;
  let hiddenWalls = 0, walls = 0;
  v.roomBuilt.root.traverse((o) => { if (o.userData?.kind === 'wall') { walls++; if (!o.visible) hiddenWalls++; } });
  return {
    canvas: [Math.round(rect.width), Math.round(rect.height)],
    floorAreaOnScreenPct: +((onScreen / total) * 100).toFixed(1),
    floorAreaVisiblePct: +((visible / total) * 100).toFixed(1),
    cornersOnScreen: corners.filter((k) => k.onScreen).length + '/' + corners.length,
    corners,
    roomCentreRaycast: ch ? { kind: ch.kind, x: +ch.point.x.toFixed(3), z: +ch.point.z.toFixed(3) } : null,
    camera: [cam.x, cam.y, cam.z].map((n) => +n.toFixed(2)),
    target: [t.x, t.y, t.z].map((n) => +n.toFixed(2)),
    camDist: +cam.distanceTo(t).toFixed(2),
    walls, hiddenWalls,
    ceilingVisible: v.roomBuilt?.ceiling ? v.roomBuilt.ceiling.visible : null,
    mode: v.getInteractionMode(),
  };
});

// W12 cells, copied from fixes/qa-evidence/walkthrough-tasks.mjs.
const cells = (page, N = 25) => page.evaluate((N) => { const v = window.__rv.viewer(); const c = document.querySelector('#viewer-host canvas').getBoundingClientRect(); const g = window.__rv.roomGraph().rooms[0].floor_polygon; const xs = g.map((p) => p.x), zs = g.map((p) => p.z); const out = { floorIn: [], wall: [], none: [] }; for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const x = Math.round(c.left + ((i + 0.5) * c.width) / N), y = Math.round(c.top + ((j + 0.5) * c.height) / N); const h = v.raycastRoom(x, y); if (!h) out.none.push({ x, y }); else if (h.kind === 'wall') out.wall.push({ x, y, wallId: h.wallId }); else if (h.point.x > Math.min(...xs) + 0.6 && h.point.x < Math.max(...xs) - 0.6 && h.point.z > Math.min(...zs) + 0.6 && h.point.z < Math.max(...zs) - 0.6) out.floorIn.push({ x, y }); } return out; }, N);
const orbitDown = async (page, px = 100) => { const c = await page.evaluate(() => { const r = document.querySelector('#viewer-host canvas').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }); await page.mouse.move(c.x, c.y - 150); await page.mouse.down(); await page.mouse.move(c.x, c.y - 150 + px, { steps: 8 }); await page.mouse.up(); await page.waitForTimeout(800); };
const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
const ratio = (a, b) => { const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x); return +((l1 + 0.05) / (l2 + 0.05)).toFixed(2); };
const hex = (c) => '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');

async function contrast(page, tag) {
  const g = await cells(page, 31);
  const out = { cellCounts: { floorIn: g.floorIn.length, wall: g.wall.length, none: g.none.length } };
  for (const preset of ['studio-soft', 'warm-interior', 'neutral']) {
    await page.locator('#presets button[data-preset=' + preset + ']').click();
    await page.waitForTimeout(900);
    const img = PNG.sync.read(await page.screenshot());
    const avg = (pts) => { if (!pts.length) return null; const acc = [0, 0, 0]; let n = 0; for (const p of pts) { const k = (p.y * img.width + p.x) * 4; acc[0] += img.data[k]; acc[1] += img.data[k + 1]; acc[2] += img.data[k + 2]; n++; } return acc.map((v) => Math.round(v / n)); };
    const one = (floor, wall, bg) => ({ floor: floor && hex(floor), wall: wall && hex(wall), background: bg && hex(bg), floorVsWall: floor && wall ? ratio(floor, wall) : null, floorVsBackground: floor && bg ? ratio(floor, bg) : null, wallVsBackground: wall && bg ? ratio(wall, bg) : null });
    out[preset] = {
      w12_first60: one(avg(g.floorIn.slice(0, 60)), avg(g.wall.slice(0, 60)), avg(g.none.slice(0, 60))),
      allCells: one(avg(g.floorIn), avg(g.wall), avg(g.none)),
    };
    const clip = await page.evaluate(() => { const r = document.querySelector('#viewer-host canvas').getBoundingClientRect(); return { x: r.left, y: r.top, width: r.width, height: r.height }; });
    await page.screenshot({ path: `${OUT}/shots/${label}-contrast-${tag}-${preset}.png`, clip });
  }
  await page.locator('#presets button[data-preset=studio-soft]').click();
  await page.waitForTimeout(500);
  return out;
}

const results = { label, base: BASE, when: new Date().toISOString() };

// A. arrival, both viewports, no camera input after Create room
for (const [name, opts] of [['1440x900', { viewport: { width: 1440, height: 900 } }], ['375x812', { viewport: { width: 375, height: 812 }, mobile: true }]]) {
  const { ctx, page } = await fresh(opts);
  await openRoom(page);
  await createRoom(page, 'living');
  results[`arrival_${name}`] = { f8: await f8grid(page), coverage: await floorCoverage(page) };
  await page.locator('#viewer-host canvas').screenshot({ path: `${OUT}/shots/${label}-arrival-${name}.png` });
  if (name === '1440x900') {
    // other presets on arrival
    for (const preset of ['small-bedroom', 'studio']) {
      await createRoom(page, preset).catch(() => {});
      results[`arrival_${name}_${preset}`] = { f8: await f8grid(page), coverage: await floorCoverage(page) };
    }
  }
  await ctx.close();
}

// B. contrast on arrival (no camera input)
{
  const { ctx, page } = await fresh();
  await openRoom(page); await createRoom(page, 'living');
  results.contrast_arrival = await contrast(page, 'arrival');
  await ctx.close();
}
// C. contrast with the W12 camera move (orbit down 100 px), like-for-like with the QA baseline
{
  const { ctx, page } = await fresh();
  await openRoom(page); await createRoom(page, 'living');
  await orbitDown(page, 100);
  results.contrast_w12_orbit100 = await contrast(page, 'orbit100');
  await ctx.close();
}

await browser.close();
writeFileSync(`${OUT}/floor-${label}.json`, JSON.stringify(results, null, 1));
console.log(JSON.stringify(results, (k, v) => (k === 'corners' ? undefined : v), 1));
