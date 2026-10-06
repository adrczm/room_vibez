// UX-04 extras: opening that does not fit, draw-walls close (failed and successful). Real pointer input.
import { launch, fresh, toRoom, createRoom, toClient, placements, stageState, ready, SHOTS, OUT } from './lib.mjs';
import fs from 'node:fs';
const browser = await launch();
const out = {};
const clickWorld = async (page, x, y, z) => { const p = await toClient(page, x, y, z); await page.mouse.click(p.x, p.y); await page.waitForTimeout(450); };
const toast = (page) => page.evaluate(() => { const t = document.getElementById('stage-toast'); const x = t.querySelector('.stage-toast-text'); return { text: x.textContent, kind: t.dataset.kind ?? null, role: x.getAttribute('role') }; });
const visibleWall = (page) => page.evaluate(() => { const v = window.__rv.viewer(); const g = window.__rv.roomGraph(); const vis = [...v.roomBuilt.wallMeshes].filter(([, m]) => m.visible).map(([id]) => id); const w = g.walls.find((x) => x.id === vis[0]); return { id: w.id, x: (w.a.x + w.b.x) / 2, z: (w.a.z + w.b.z) / 2 }; });
const { ctx, page, errors } = await fresh(browser);
await toRoom(page); await createRoom(page);
// opening wider than the wall
await page.fill('#opening-width', '9'); await page.locator('#opening-width').dispatchEvent('change');
await page.click('#btn-opening-mode');
const wall = await visibleWall(page);
await clickWorld(page, wall.x, 1.4, wall.z);
out.openingTooWide = { ...(await toast(page)), openings: await page.evaluate(() => window.__rv.roomGraph().openings.length), roomStatus: (await stageState(page)).roomStatus };
await page.screenshot({ path: `${SHOTS}/toast-opening-does-not-fit-1440x900.png` });
await page.fill('#opening-width', '0.9'); await page.locator('#opening-width').dispatchEvent('change');
await page.fill('#opening-height', '9'); 
await page.click('.brand');
await clickWorld(page, wall.x, 1.4, wall.z);
out.openingTooTall = await toast(page);
await page.fill('#opening-height', '2.1');
await page.keyboard.press('Escape');
// draw walls: A, B, back on A (3 points), then on A again -> close with too few distinct corners
await page.click('#btn-draw-wall-mode');
await clickWorld(page, -1.5, 0, -1.0);
await clickWorld(page, 1.5, 0, -1.0);
await clickWorld(page, -1.5, 0, -1.0);
out.drawThree = await toast(page);
await clickWorld(page, -1.5, 0, -1.0);
out.drawCloseTooFew = { ...(await toast(page)), mode: (await stageState(page)).mode, walls: await page.evaluate(() => window.__rv.roomGraph().walls.length) };
await page.click('#btn-draw-wall-mode'); await page.waitForTimeout(200);
// draw walls: a proper rectangle, closed on the first corner
await page.click('#btn-draw-wall-mode');
for (const [x, z] of [[-1.5, -1], [1.5, -1], [1.5, 1], [-1.5, 1]]) await clickWorld(page, x, 0, z);
out.drawFour = await toast(page);
await clickWorld(page, -1.5, 0, -1.0);
await page.waitForTimeout(600);
const st = await stageState(page);
out.drawClosed = { ...(await toast(page)), mode: st.mode, hint: st.hint, walls: await page.evaluate(() => window.__rv.roomGraph().walls.length), pressed: await page.evaluate(() => document.getElementById('btn-draw-wall-mode').getAttribute('aria-pressed')), roomStatus: st.roomStatus };
out.errors = errors;
console.log(JSON.stringify(out, null, 1));
fs.writeFileSync(`${OUT}/after3b.json`, JSON.stringify(out, null, 1));
await browser.close();
