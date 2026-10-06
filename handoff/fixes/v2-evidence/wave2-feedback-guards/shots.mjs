// Final screenshots of the new states at 1440x900 and 375x812 (taken after animations have ended).
import { launch, fresh, toRoom, createRoom, toClient, ready, SHOTS } from './lib.mjs';
const browser = await launch();
const top = async (page) => { await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(200); };
const visibleWall = (page) => page.evaluate(() => { const v = window.__rv.viewer(); const g = window.__rv.roomGraph(); const vis = [...v.roomBuilt.wallMeshes].filter(([, m]) => m.visible).map(([id]) => id); const w = g.walls.find((x) => x.id === vis[0]); return { x: (w.a.x + w.b.x) / 2, z: (w.a.z + w.b.z) / 2 }; });
const clickWorld = async (page, x, y, z) => { await top(page); const p = await toClient(page, x, y, z); await page.mouse.click(p.x, p.y); };
const report = {};
for (const [w, h] of [[1440, 900], [375, 812]]) {
  const key = `${w}x${h}`;
  const { ctx, page } = await fresh(browser, { width: w, height: h });
  await toRoom(page); await page.waitForTimeout(900); await top(page);
  await page.screenshot({ path: `${SHOTS}/empty-room-card-${key}.png` });
  await createRoom(page);
  await page.click('#btn-place-mode'); await top(page); await page.waitForTimeout(300);
  await page.screenshot({ path: `${SHOTS}/state-chip-place-${key}.png` });
  const wall = await visibleWall(page);
  await clickWorld(page, wall.x, 1.3, wall.z); await page.waitForTimeout(700);
  await page.screenshot({ path: `${SHOTS}/toast-place-wall-click-${key}.png` });
  const box = await page.locator('#viewer-host canvas').boundingBox();
  await page.mouse.click(box.x + box.width - 30, box.y + 90); await page.waitForTimeout(700);
  await page.screenshot({ path: `${SHOTS}/toast-place-outside-room-${key}.png` });
  await clickWorld(page, 0.8, 0, -0.5);
  await page.waitForFunction(() => /^Placed/.test(document.querySelector('#stage-toast .stage-toast-text').textContent), null, { timeout: 20000 }); await page.waitForTimeout(700);
  await page.screenshot({ path: `${SHOTS}/toast-placed-${key}.png` });
  await clickWorld(page, 0.8, 0, -0.5);
  await page.waitForFunction(() => /overlaps/.test(document.querySelector('#stage-toast .stage-toast-text').textContent), null, { timeout: 20000 }); await page.waitForTimeout(700);
  await page.screenshot({ path: `${SHOTS}/toast-overlap-warning-${key}.png` });
  await page.keyboard.press('Escape');
  // Replace + Clear dialogs
  await page.locator('#btn-create-room').scrollIntoViewIfNeeded();
  await page.click('#btn-create-room'); await page.waitForTimeout(500);
  await page.screenshot({ path: `${SHOTS}/confirm-replace-room-${key}.png` });
  await page.click('dialog.confirm-dialog [data-action="cancel"]');
  await page.locator('#btn-clear-room').scrollIntoViewIfNeeded();
  await page.click('#btn-clear-room'); await page.waitForTimeout(500);
  await page.screenshot({ path: `${SHOTS}/confirm-clear-room-${key}.png` });
  report[key] = await page.evaluate(() => { const d = document.querySelector('dialog.confirm-dialog'); const r = d.getBoundingClientRect(); return { dialogW: Math.round(r.width), dialogInViewport: r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight, overflowX: document.documentElement.scrollWidth - innerWidth }; });
  await page.click('dialog.confirm-dialog [data-action="confirm"]'); await page.waitForTimeout(700); await top(page);
  await page.screenshot({ path: `${SHOTS}/after-clear-stays-in-room-${key}.png` });
  // error toast (bad project file from the card)
  const fs = await import('node:fs'); const bad = `${SHOTS}/../out/not-a-project.json`; fs.writeFileSync(bad, '{"hello": 1}');
  const [ch] = await Promise.all([page.waitForEvent('filechooser'), page.click('#stage-empty button[data-empty-action=project]')]);
  await ch.setFiles(bad); await page.waitForTimeout(900); await top(page);
  await page.screenshot({ path: `${SHOTS}/toast-error-import-${key}.png` });
  await ctx.close();
}
console.log(JSON.stringify(report));
await browser.close();
