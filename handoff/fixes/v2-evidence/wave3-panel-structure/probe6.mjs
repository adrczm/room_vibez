// Add to room with "Snap to nearest wall" ticked; and Add to room until the room is full (fallback path).
import { launch, fresh } from './lib.mjs';
const browser = await launch();
{
  const { ctx, page, errors } = await fresh(browser, { viewport: { width: 1440, height: 900 }, settle: 500 });
  await page.click('#workspace-mode button[data-mode=room]');
  await page.selectOption('#room-preset', 'living');
  await page.click('#btn-create-room');
  await page.waitForFunction(() => !!window.__rv.roomGraph());
  await page.click('.step[data-step=place] .step-toggle');
  await page.check('#place-wall-snap');
  for (let n = 1; n <= 2; n++) {
    await page.click('#btn-add-to-room');
    await page.waitForFunction((n) => window.__rv.roomGraph().placements.length === n, n, { timeout: 20000 });
    await page.waitForTimeout(400);
    console.log('snap on, add', n, await page.evaluate(() => { const p = window.__rv.roomGraph().placements.at(-1); return { x: +p.position.x.toFixed(2), z: +p.position.z.toFixed(2), rot: +p.rotation_y.toFixed(2) }; }), '| toast:', await page.evaluate(() => document.querySelector('#stage-toast .stage-toast-text').textContent));
  }
  console.log('errors', errors);
  await ctx.close();
}
{
  // Small bedroom 3x3: keep adding until no free spot is left; the next one goes to the centre with the overlap warning.
  const { ctx, page, errors } = await fresh(browser, { viewport: { width: 1440, height: 900 }, settle: 500 });
  await page.click('#workspace-mode button[data-mode=room]');
  await page.click('#btn-create-room');
  await page.waitForFunction(() => !!window.__rv.roomGraph());
  await page.click('.step[data-step=place] .step-toggle');
  let last = '';
  for (let n = 1; n <= 30; n++) {
    await page.click('#btn-add-to-room');
    await page.waitForFunction((n) => window.__rv.roomGraph().placements.length === n, n, { timeout: 20000 });
    await page.waitForFunction(() => /^Placed/.test(document.querySelector('#stage-toast .stage-toast-text').textContent), null, { timeout: 20000 });
    await page.waitForTimeout(250);
    last = await page.evaluate(() => document.querySelector('#stage-toast .stage-toast-text').textContent);
    if (/overlaps/.test(last)) { console.log('3x3 room: first overlap at product', n, await page.evaluate(() => window.__rv.roomGraph().placements.at(-1).position), '| toast:', last); break; }
  }
  console.log('3x3 room: products placed', await page.evaluate(() => window.__rv.roomGraph().placements.length), '| all on floor:', await page.evaluate(() => window.__rv.roomGraph().placements.every((p) => Math.abs(p.position.x) <= 1.5 && Math.abs(p.position.z) <= 1.5)));
  console.log('errors', errors);
  await ctx.close();
}
await browser.close();
