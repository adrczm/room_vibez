// After-fix checks, part 3: UX-04 (toast + state line), QA-02 host part. Real pointer input on the canvas and tool buttons.
import { launch, fresh, toRoom, createRoom, toClient, placements, stageState, ready, SHOTS, OUT } from './lib.mjs';
import fs from 'node:fs';
const browser = await launch();
const out = {};
const stageIntoView = async (page) => { await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(150); };
const clickWorld = async (page, x, y, z) => { await stageIntoView(page); const p = await toClient(page, x, y, z); await page.mouse.click(p.x, p.y); return p; };
const visibleWall = (page) => page.evaluate(() => { const v = window.__rv.viewer(); const g = window.__rv.roomGraph(); const vis = [...v.roomBuilt.wallMeshes].filter(([, m]) => m.visible).map(([id]) => id); const w = g.walls.find((x) => x.id === vis[0]); return { id: w.id, x: (w.a.x + w.b.x) / 2, z: (w.a.z + w.b.z) / 2 }; });
const toastInfo = (page) => page.evaluate(() => {
  const t = document.getElementById('stage-toast'); const st = document.querySelector('.stage').getBoundingClientRect(); const r = t.getBoundingClientRect(); const hint = document.getElementById('stage-hint').getBoundingClientRect(); const tb = document.querySelector('.stage-toolbar').getBoundingClientRect();
  const txt = t.querySelector('.stage-toast-text'); const cs = getComputedStyle(t);
  return { text: txt.textContent, open: t.dataset.open, kind: t.dataset.kind ?? null, role: txt.getAttribute('role'), live: txt.getAttribute('aria-live'),
    insideStage: r.left >= st.left && r.right <= st.right && r.top >= st.top && r.bottom <= st.bottom, inViewport: r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth,
    aboveHint: r.bottom <= hint.top, belowToolbar: r.top >= tb.bottom, fontPx: cs.fontSize, rect: [Math.round(r.left - st.left), Math.round(r.top - st.top), Math.round(r.width), Math.round(r.height)],
    roomStatus: document.getElementById('room-status').textContent, roomStatusIsSame: document.getElementById('room-status').textContent === txt.textContent, dismissLabel: t.querySelector('.stage-toast-close').getAttribute('aria-label') };
});
const hintInfo = (page) => page.evaluate(() => { const h = document.getElementById('stage-hint'); const cs = getComputedStyle(h); const st = document.querySelector('.stage').getBoundingClientRect(); const r = h.getBoundingClientRect();
  return { text: h.textContent, tool: h.dataset.tool ?? null, fontPx: cs.fontSize, color: cs.color, background: cs.backgroundColor, border: cs.borderTopWidth + ' ' + cs.borderTopColor, insideStage: r.left >= st.left && r.right <= st.right && r.bottom <= st.bottom, w: Math.round(r.width), h: Math.round(r.height) }; });
const labels = (page) => page.evaluate(() => ['btn-opening-mode', 'btn-place-mode', 'btn-draw-wall-mode'].map((id) => { const b = document.getElementById(id); return b.textContent + ' [' + b.getAttribute('aria-pressed') + ']'; }));
const waitToast = (page, re) => page.waitForFunction((src) => new RegExp(src).test(document.querySelector('#stage-toast .stage-toast-text')?.textContent ?? ''), re.source, { timeout: 20000 });

for (const [w, h] of [[1440, 900], [375, 812]]) {
  const key = `${w}x${h}`; const r = {};
  const { ctx, page, errors } = await fresh(browser, { width: w, height: h });
  await toRoom(page); await createRoom(page);
  r.idle = { hint: await hintInfo(page), labels: await labels(page) };

  // ---- Place mode (real button click)
  await page.click('#btn-place-mode'); await page.waitForTimeout(200);
  r.placeOn = { hint: await hintInfo(page), labels: await labels(page), mode: (await stageState(page)).mode };
  await stageIntoView(page);
  await page.screenshot({ path: `${SHOTS}/state-chip-place-${key}.png` });
  // real click on a visible wall
  const wall = await visibleWall(page);
  await clickWorld(page, wall.x, 1.3, wall.z); await page.waitForTimeout(400);
  r.wallClick = { ...(await toastInfo(page)), placements: (await placements(page)).length, panelScrollTop: await page.evaluate(() => document.querySelector('.panel').scrollTop) };
  await page.screenshot({ path: `${SHOTS}/toast-place-wall-click-${key}.png` });
  // real void click (corner of the canvas, away from toast and toolbar)
  await stageIntoView(page);
  const box = await page.locator('#viewer-host canvas').boundingBox();
  await page.mouse.click(box.x + box.width - 30, box.y + 90); await page.waitForTimeout(600);
  r.voidClick = { ...(await toastInfo(page)), placements: (await placements(page)).length };
  await page.screenshot({ path: `${SHOTS}/toast-place-outside-room-${key}.png` });
  // test hook: null hit, and a floor "hit" outside the room (the placeCurrentProduct guard)
  await page.evaluate(() => document.querySelector('.stage-toast-close').click());
  await page.evaluate(() => window.__rv.simulateRoomPointer(null, 'place')); await page.waitForTimeout(200);
  r.hookNull = { text: (await toastInfo(page)).text, placements: (await placements(page)).length };
  await page.evaluate(() => document.querySelector('.stage-toast-close').click());
  await page.evaluate(() => window.__rv.simulateRoomPointer({ kind: 'floor', point: { x: -0.48, y: 0, z: 3.74 } }, 'place')); await page.waitForTimeout(1500);
  r.hookOutsideFloor = { text: (await toastInfo(page)).text, kind: (await toastInfo(page)).kind, placements: await placements(page) };
  // real floor click
  await clickWorld(page, 0.8, 0, -0.5);
  await waitToast(page, /^Placed/);
  r.floorClick = { ...(await toastInfo(page)), placements: await placements(page) };
  await page.screenshot({ path: `${SHOTS}/toast-placed-${key}.png` });
  // overlap: same spot again
  await clickWorld(page, 0.8, 0, -0.5);
  await page.waitForFunction(() => window.__rv.roomGraph().placements.length === 2, null, { timeout: 20000 });
  await waitToast(page, /overlaps/);
  r.overlap = await toastInfo(page);
  await page.screenshot({ path: `${SHOTS}/toast-overlap-warning-${key}.png` });
  // product change while Place is on: the chip names the new product
  await page.selectOption('#product-select', 'demo-side-table'); await ready(page); await page.waitForTimeout(300);
  r.placeOtherProduct = (await hintInfo(page)).text;
  await page.selectOption('#product-select', 'demo-lounge-chair'); await ready(page);
  // undo / redo by keyboard (focus not in a field)
  await page.click('.brand');
  await page.keyboard.press('ControlOrMeta+z'); await page.waitForTimeout(400);
  r.undo = { ...(await toastInfo(page)), placements: (await placements(page)).length };
  await page.keyboard.press('ControlOrMeta+Shift+z'); await page.waitForTimeout(400);
  r.redo = { text: (await toastInfo(page)).text, kind: (await toastInfo(page)).kind, placements: (await placements(page)).length };
  // Esc leaves the tool: chip gone
  await page.keyboard.press('Escape'); await page.waitForTimeout(200);
  r.afterEsc = { hint: await hintInfo(page), labels: await labels(page), mode: (await stageState(page)).mode };

  // ---- Opening mode
  await page.click('#btn-opening-mode'); await page.waitForTimeout(200);
  r.openingOn = { hint: (await hintInfo(page)).text, tool: (await hintInfo(page)).tool, labels: await labels(page) };
  await page.click('#opening-type button[data-type=window]'); await page.waitForTimeout(200);
  r.openingWindowHint = (await hintInfo(page)).text;
  await clickWorld(page, -1.5, 0, 1.2); await page.waitForTimeout(400); // floor, not a wall
  r.openingFloorClick = { ...(await toastInfo(page)), openings: await page.evaluate(() => window.__rv.roomGraph().openings.length) };
  await clickWorld(page, wall.x, 1.4, wall.z); await page.waitForTimeout(500);
  r.openingAdded = { text: (await toastInfo(page)).text, kind: (await toastInfo(page)).kind, openings: await page.evaluate(() => window.__rv.roomGraph().openings.length), roomStatus: (await toastInfo(page)).roomStatus };
  // an opening wider than the wall -> deck message, warning
  await page.fill('#opening-width', '9'); await page.locator('#opening-width').dispatchEvent('change');
  await page.click('.brand');
  await clickWorld(page, wall.x, 1.4, wall.z); await page.waitForTimeout(500);
  r.openingTooWide = { text: (await toastInfo(page)).text, kind: (await toastInfo(page)).kind, role: (await toastInfo(page)).role };
  await page.fill('#opening-width', '0.9'); await page.locator('#opening-width').dispatchEvent('change');
  await page.click('#btn-opening-mode'); await page.waitForTimeout(200); // off

  // ---- Draw walls
  await page.click('#btn-draw-wall-mode'); await page.waitForTimeout(200);
  r.drawOn = { hint: (await hintInfo(page)).text, tool: (await hintInfo(page)).tool, labels: await labels(page) };
  await clickWorld(page, -1.5, 0, -1.0); await page.waitForTimeout(400);
  r.drawOne = { text: (await toastInfo(page)).text, kind: (await toastInfo(page)).kind };
  await clickWorld(page, 1.5, 0, -1.0); await page.waitForTimeout(400);
  r.drawTwo = (await toastInfo(page)).text;
  await clickWorld(page, -1.5, 0, -1.0); await page.waitForTimeout(500); // back on the first corner with only 2 points
  r.drawCloseTooFew = { text: (await toastInfo(page)).text, kind: (await toastInfo(page)).kind };
  await page.click('#btn-draw-wall-mode'); await page.waitForTimeout(200); // off
  r.end = { hint: await hintInfo(page), labels: await labels(page) };
  r.errors = errors.slice();
  out[key] = r;
  await ctx.close();
}
fs.writeFileSync(`${OUT}/after3.json`, JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 1));
await browser.close();
