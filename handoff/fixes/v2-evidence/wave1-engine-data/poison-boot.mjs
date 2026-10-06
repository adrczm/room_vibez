// Task 2 evidence: which saved-room payloads break boot? Poison catalog3d.roomGraph, reload, record what the build does.
import { chromium } from '/private/tmp/claude-501/-Users-adrian-Desktop-Room-Vibez/7ac663fe-e0d6-4b3c-af69-487be083d847/scratchpad/ws-data/node_modules/playwright/index.mjs';
const BASE = process.env.RV_BASE || 'http://127.0.0.1:18782/';
const browser = await chromium.launch({ channel: 'chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const waitReady = (page, ms = 20000) => page.waitForFunction(() => ['ready', 'error'].includes(document.body.getAttribute('data-viewer-status')), null, { timeout: ms }).then(() => true).catch(() => false);

const P = { x: 0, z: 0 };
const okRoom = { id: 'r', name: 'R', floor_polygon: [{ x: -2, z: -2 }, { x: 2, z: -2 }, { x: 2, z: 2 }, { x: -2, z: 2 }], ceiling_height: 2.7, wall_ids: ['w1', 'w2', 'w3', 'w4'] };
const okWalls = [
  { id: 'w1', a: { x: -2, z: -2 }, b: { x: 2, z: -2 }, thickness: 0.12, height: 2.7, connected_room_ids: ['r'] },
  { id: 'w2', a: { x: 2, z: -2 }, b: { x: 2, z: 2 }, thickness: 0.12, height: 2.7, connected_room_ids: ['r'] },
  { id: 'w3', a: { x: 2, z: 2 }, b: { x: -2, z: 2 }, thickness: 0.12, height: 2.7, connected_room_ids: ['r'] },
  { id: 'w4', a: { x: -2, z: 2 }, b: { x: -2, z: -2 }, thickness: 0.12, height: 2.7, connected_room_ids: ['r'] },
];
const g = (over) => JSON.stringify({ schema_version: 1, units: 'm', rooms: [okRoom], walls: okWalls, openings: [], placements: [], source_assets: [], provenance: { kind: 'authored', confirm_status: 'confirmed' }, ...over });
const cases = [
  ['control: valid room', g({})],
  ['F1 (stress test R6): null coord, ceiling "tall", thickness 0', JSON.stringify({ schema_version: 1, rooms: [{ id: 'r', floor_polygon: [{ x: null, z: 0 }], ceiling_height: 'tall' }], walls: [{ id: 'w', a: P, b: P, thickness: 0 }], openings: [], placements: [] })],
  ['not JSON', '{bad'],
  ['wrong shape', '{"walls":null,"rooms":"x"}'],
  ['rooms: []', g({ rooms: [] })],
  ['rooms: [null]', g({ rooms: [null] })],
  ['polygon with 2 points', g({ rooms: [{ ...okRoom, floor_polygon: okRoom.floor_polygon.slice(0, 2) }] })],
  ['polygon point x null', g({ rooms: [{ ...okRoom, floor_polygon: [{ x: null, z: -2 }, ...okRoom.floor_polygon.slice(1)] }] })],
  ['ceiling_height "tall"', g({ rooms: [{ ...okRoom, ceiling_height: 'tall' }] })],
  ['ceiling_height 0', g({ rooms: [{ ...okRoom, ceiling_height: 0 }] })],
  ['wall a.x null', g({ walls: [{ ...okWalls[0], a: { x: null, z: -2 } }, ...okWalls.slice(1)] })],
  ['wall missing b', g({ walls: [{ id: 'w1', a: P, thickness: 0.12, height: 2.7, connected_room_ids: ['r'] }, ...okWalls.slice(1)] })],
  ['wall thickness 0', g({ walls: [{ ...okWalls[0], thickness: 0 }, ...okWalls.slice(1)] })],
  ['wall thickness -1', g({ walls: [{ ...okWalls[0], thickness: -1 }, ...okWalls.slice(1)] })],
  ['wall height null', g({ walls: [{ ...okWalls[0], height: null }, ...okWalls.slice(1)] })],
  ['walls: [null]', g({ walls: [null] })],
  ['walls: []', g({ walls: [] })],
  ['opening width null', g({ openings: [{ id: 'o', wall_id: 'w1', type: 'door', offset_along_wall: 1, width: null, height: 2.1, sill_height: 0 }] })],
  ['openings: [null]', g({ openings: [null] })],
  ['placement position null', g({ placements: [{ id: 'p', sku_id: 's', asset_ref: 'a', product_id: 'demo-lounge-chair', position: null, rotation_y: 0, scale: 1, slot_bindings: {} }] })],
  ['placement position.x null', g({ placements: [{ id: 'p', sku_id: 's', asset_ref: 'a', product_id: 'demo-lounge-chair', position: { x: null, y: 0, z: 0 }, rotation_y: 0, scale: 1, slot_bindings: {} }] })],
  ['placements: [null]', g({ placements: [null] })],
  ['room missing wall_ids', g({ rooms: [{ id: 'r', floor_polygon: okRoom.floor_polygon, ceiling_height: 2.7 }] })],
];

const rows = [];
for (const [name, payload] of cases) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  page.on('console', (m) => m.type() === 'error' && errs.push('console: ' + m.text().slice(0, 160)));
  await page.goto(BASE); await waitReady(page);
  await page.evaluate((p) => localStorage.setItem('catalog3d.roomGraph', p), payload);
  errs.length = 0;
  await page.reload(); await waitReady(page); await page.waitForTimeout(700);
  const row = await page.evaluate(() => ({
    status: document.body.getAttribute('data-viewer-status'),
    appHasRoom: !!window.__rv?.roomGraph?.(),
    mainKeyPresent: localStorage.getItem('catalog3d.roomGraph') !== null,
    otherKeys: Object.keys(localStorage).filter((k) => k !== 'catalog3d.roomGraph'),
    overlay: (document.getElementById('viewer-overlay')?.innerText ?? '').slice(0, 110),
  }));
  // Does opening the Room workspace then break? (boot lands on Product)
  let roomWorkspace = 'n/a';
  if (row.status === 'ready') {
    const before = errs.length;
    await page.locator('#workspace-mode button[data-mode=room]').click().catch(() => {});
    await page.waitForTimeout(900);
    roomWorkspace = { status: await page.evaluate(() => document.body.getAttribute('data-viewer-status')), newErrors: errs.slice(before).map((e) => e.slice(0, 120)) };
  }
  rows.push({ case: name, ...row, firstError: errs[0]?.slice(0, 150) ?? null, roomWorkspace });
  await ctx.close();
}
for (const r of rows) console.log(JSON.stringify(r));
await browser.close();
