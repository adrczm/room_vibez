import { launch, fresh, toRoom, createRoom, toClient, placements, stageState, SHOTS } from './lib.mjs';
const browser = await launch();
for (let i = 0; i < 4; i++) {
  const { ctx, page, errors } = await fresh(browser, { width: 1440, height: 900 });
  await toRoom(page); await createRoom(page);
  await page.click('#btn-place-mode');
  const p = await toClient(page, 0.8, 0, -0.5);
  await page.evaluate(() => { window.__ev = []; const c = window.__rv.viewer().canvas; for (const t of ['pointerdown', 'pointerup', 'pointercancel']) c.addEventListener(t, (e) => window.__ev.push([t, Math.round(e.clientX), Math.round(e.clientY), e.button, e.isPrimary]), true); });
  await page.mouse.click(p.x, p.y);
  await page.waitForTimeout(2500);
  const st = await stageState(page);
  console.log(i, JSON.stringify({ p, ev: await page.evaluate(() => window.__ev), mode: st.mode, toast: st.toast, pl: await placements(page), errors }));
  await ctx.close();
}
await browser.close();
