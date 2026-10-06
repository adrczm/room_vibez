// Edge states: remount in the empty Room state and in Place mode; Clear from the Product workspace;
// product change in empty Room then back to Product (pixels); cold load with a persisted room.
import { launch, fresh, toRoom, createRoom, toClient, placements, stageState, ready, SHOTS, OUT } from './lib.mjs';
import fs from 'node:fs';
const browser = await launch();
const out = {};
const CONFIRM = 'dialog.confirm-dialog [data-action="confirm"]';
const wood = async (page) => {
  const { PNG } = await import('/Users/adrian/Desktop/Room Vibez/v2/hackathon-3d-viewer/node_modules/pngjs/lib/png.js').then((m) => m.default ?? m);
  await page.waitForTimeout(500);
  const png = PNG.sync.read(await page.locator('#viewer-host canvas').screenshot());
  let w = 0; const d = png.data;
  for (let i = 0; i < d.length; i += 4 * 31) { const r = d[i], g = d[i + 1], b = d[i + 2]; if (r > 120 && g > 90 && b < 140 && r > g + 10) w++; }
  return w;
};
{
  const { ctx, page, errors } = await fresh(browser);
  const r = {};
  r.productWood = await wood(page);
  await toRoom(page); await page.waitForTimeout(600);
  // remount in the empty Room state
  await page.click('#btn-remount'); await ready(page); await page.waitForTimeout(800);
  r.remountEmptyRoom = await stageState(page);
  // product change in empty Room, then Reset camera, then back to Product
  await page.selectOption('#product-select', 'demo-side-table'); await ready(page); await page.waitForTimeout(400);
  r.pickInEmptyRoom = await stageState(page);
  await page.click('#btn-reset'); await page.waitForTimeout(300);
  r.resetInEmptyRoom = await stageState(page);
  await page.selectOption('#product-select', 'demo-lounge-chair'); await ready(page);
  await page.click('#workspace-mode button[data-mode=catalog]'); await page.waitForTimeout(900);
  r.backToProduct = { ...(await stageState(page)), wood: await wood(page), camDist: await page.evaluate(() => { const v = window.__rv.viewer(); return +v.camera.position.distanceTo(v.controls.target).toFixed(3); }) };
  // room + Place mode, then remount: tool and chip survive
  await toRoom(page); await createRoom(page);
  await page.click('#btn-place-mode'); await page.waitForTimeout(200);
  await page.click('#btn-remount'); await ready(page); await page.waitForTimeout(1000);
  const st = await stageState(page);
  r.remountInPlace = { mode: st.mode, hint: st.hint, tool: await page.evaluate(() => document.getElementById('stage-hint').dataset.tool ?? null), pressed: await page.evaluate(() => document.getElementById('btn-place-mode').getAttribute('aria-pressed')), room: st.room, card: st.empty };
  // place after remount (real click) still works and reports on the stage
  const p = await toClient(page, 0.8, 0, -0.5); await page.mouse.click(p.x, p.y);
  await page.waitForFunction(() => window.__rv.roomGraph().placements.length === 1, null, { timeout: 20000 });
  await page.waitForTimeout(500);
  r.placeAfterRemount = (await stageState(page)).toast;
  // Clear from the Product workspace (the room card is still visible there until the panel is split)
  await page.click('#workspace-mode button[data-mode=catalog]'); await page.waitForTimeout(600);
  await page.locator('#btn-clear-room').scrollIntoViewIfNeeded();
  await page.click('#btn-clear-room'); await page.click(CONFIRM); await page.waitForTimeout(600);
  r.clearFromProduct = { ...(await stageState(page)), wood: await wood(page) };
  r.errors = errors.slice();
  out.edge = r;
  await ctx.close();
}
// cold load with a persisted room: lands on Product, chair visible, no card; Room shows the room, no card
{
  const { ctx, page, errors } = await fresh(browser);
  await toRoom(page); await createRoom(page);
  await page.reload({ waitUntil: 'networkidle' }); await ready(page); await page.waitForTimeout(600);
  const cold = { ...(await stageState(page)), wood: await wood(page) };
  await toRoom(page); await page.waitForTimeout(600);
  out.coldWithRoom = { cold, room: await stageState(page), errors };
  await ctx.close();
}
fs.writeFileSync(`${OUT}/after4.json`, JSON.stringify(out, null, 1));
const brief = (s) => s && ({ ws: s.workspace, mode: s.mode, turntable: s.turntable, room: s.room, hasRoom: s.hasRoom, hint: s.hint, card: s.empty?.shown, toast: s.toast, wood: s.wood, camDist: s.camDist });
for (const [k, v] of Object.entries(out.edge)) console.log(k, JSON.stringify(v && v.workspace ? brief(v) : v));
console.log('cold', JSON.stringify(brief(out.coldWithRoom.cold)), '\nroom', JSON.stringify(brief(out.coldWithRoom.room)), out.coldWithRoom.errors);
await browser.close();
