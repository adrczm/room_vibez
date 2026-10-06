// Task 5: run the two snippets of fixes/usability-test-plan.md §7, verbatim, around a real
// "two chairs, one walnut" flow (T4), and report what they return.
import { readFileSync } from 'node:fs';
import { launch, fresh, toClient, openStep, waitPlacements, OUT } from './lib.mjs';
const md = readFileSync('/Users/adrian/Desktop/Room Vibez/fixes/usability-test-plan.md', 'utf8');
const block = (after) => { const i = md.indexOf(after); const a = md.indexOf('```js', i) + 5; const b = md.indexOf('```', a); return md.slice(a, b).trim(); };
const logger = block('**Logger**');
const outcome = block('**Outcome check**');
const out = { loggerChars: logger.length, outcomeChars: outcome.length };
const browser = await launch();
try {
  const { ctx, page, errors } = await fresh(browser);
  // Outcome check on the start state (Product, no room): it must run.
  try { out.startState = await page.evaluate(outcome); } catch (e) { out.startStateError = String(e); }
  // Logger: pasted once before the participant starts.
  try { out.loggerReturn = await page.evaluate(logger); out.loggerInstalled = await page.evaluate(() => JSON.parse(JSON.stringify(window.__ut))); } catch (e) { out.loggerError = String(e); }

  // T4 as a user would do it on this build: "Put two lounge chairs in the room. One of them should have a walnut frame."
  await page.click('#workspace-mode button[data-mode=room]');
  await page.selectOption('#room-preset', 'living');
  await page.click('#btn-create-room');
  await page.waitForFunction(() => (window.__rv.roomGraph()?.walls.length ?? 0) === 4);
  await openStep(page, 'place');
  await page.click('#btn-add-to-room');                       // chair 1, as it comes
  await waitPlacements(page, 1);
  await page.click('.slot[data-slot=frame] .swatch[data-material=wood-walnut]'); // walnut for the next one
  await page.click('#btn-place-mode');
  await page.waitForTimeout(600);
  const px = await toClient(page, 1.3, 0, -0.9);
  await page.mouse.click(px.x, px.y);                          // chair 2, by a real click on the floor
  await waitPlacements(page, 2);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(800);
  try { out.afterT4 = await page.evaluate(outcome); } catch (e) { out.afterT4Error = String(e); }
  const pls = out.afterT4?.placements ?? [];
  out.t4 = {
    twoPlacements: pls.length === 2,
    bothLoungeChairs: pls.every((p) => p.product === 'demo-lounge-chair'),
    bothInside: pls.every((p) => p.inside === true),
    walnutFrames: pls.filter((p) => p.finish?.frame === 'wood-walnut').length,
    tool: out.afterT4?.tool,
  };
  // What is on the models (the snippet reads the room graph only).
  out.onTheModels = await page.evaluate(() => window.__rv.roomGraph().placements.map((p) => { const ids = new Set(); window.__rv.viewer().getPlacementRoot(p.id).traverse((o) => { if (o.isMesh) ids.add(o.material.userData.libraryId ?? 'embedded:' + o.material.name); }); return [...ids]; }));
  // T5 with the new keys: select chair 1 from its row, move it 1 m (4 big steps), then the outcome check again.
  await page.click('#placement-list li:nth-child(1) .placement-name');
  for (let i = 0; i < 4; i++) await page.keyboard.press('Shift+ArrowLeft');
  out.afterMove = (await page.evaluate(outcome)).placements;
  // T1 expected values, on the same build, for completeness of "both snippets run".
  await page.click('#workspace-mode button[data-mode=catalog]');
  await page.selectOption('#product-select', 'demo-side-table');
  await page.waitForSelector('body[data-viewer-status="ready"]');
  await page.click('.slot[data-slot=top] .swatch[data-material=wood-walnut]');
  await page.waitForFunction(() => window.__rv.parts()?.parts.find((p) => p.slotId === 'top')?.materialId === 'wood-walnut');
  const t1 = await page.evaluate(outcome);
  out.t1 = { product: t1.product, top: t1.slots.top };
  out.loggerAtEnd = t1.log;
  await page.screenshot({ path: `${OUT}/shots/dev-snippets-end.png` });
  out.errors = errors;
  await ctx.close();
} finally { await browser.close(); }
console.log(JSON.stringify(out, null, 1));
