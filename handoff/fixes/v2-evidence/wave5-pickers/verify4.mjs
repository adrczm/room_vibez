// Task 4: a placed product is selected; the keys used inside the real picker must not reach it.
import fs from 'node:fs';
import { launch, OUT, BASE } from './lib.mjs';
const browser = await launch();
const TRIG = '.tpicker[data-picker-for=product-select] .tpicker-trigger';
const POP = '.tpicker-popup[data-picker-for=product-select]';
const WTRIG = '.tpicker[data-picker-for=room-wall-material] .tpicker-trigger';
const WPOP = '.tpicker-popup[data-picker-for=room-wall-material]';
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => { if (m.type() === 'error') errors.push(`console.error: ${m.text().slice(0, 200)}`); });
await page.goto(BASE);
const ready = () => page.waitForSelector('body[data-viewer-status="ready"]', { timeout: 60000 });
await ready();
await page.click('#workspace-mode button[data-mode=room]');
await page.selectOption('#room-preset', 'living');
await page.click('#btn-create-room');
await page.waitForFunction(() => (window.__rv.roomGraph()?.walls.length ?? 0) === 4);
await page.click('.step[data-step=place] .step-toggle');
await page.click('#btn-add-to-room');
await page.waitForFunction(() => { const g = window.__rv.roomGraph(); return g.placements.length === 1 && !!window.__rv.viewer().getPlacementRoot(g.placements[0].id); }, null, { timeout: 30000 });
const state = () => page.evaluate(([p, w]) => {
  const g = window.__rv.roomGraph();
  const pl = g.placements[0];
  return { n: g.placements.length, pos: pl ? [pl.position.x, pl.position.z, pl.rotation_y] : null, selectedRow: document.querySelector('#placement-list li[aria-current]')?.dataset.placementId ?? null,
    outline: window.__rv.viewer().getPlacementHighlight(), productOpen: document.querySelector(p).matches(':popover-open'), wallOpen: document.querySelector(w).matches(':popover-open'),
    focus: document.activeElement?.className || document.activeElement?.tagName, focusId: document.activeElement?.dataset?.id ?? null, product: document.querySelector('#product-select').value, undo: !document.getElementById('btn-undo').disabled };
}, [POP, WPOP]);
const out = {};
await page.click('#placement-list li .placement-name');
out.selected = await state();
const id = out.selected.selectedRow;
// 1. open by pointer; arrows, Home, End, a letter, Delete, Backspace inside the popup
await page.click(TRIG);
await page.waitForSelector(`${POP}:popover-open`);
for (const k of ['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp', 'Home', 'End', 'r', 'Shift+R', 'Delete', 'Backspace', 'Shift+ArrowLeft']) await page.keyboard.press(k);
out.afterKeysInPopup = await state();
await page.keyboard.press('Escape');
out.afterEsc = await state();
// 2. open from the keyboard on the trigger (Arrow Down), close with Esc
await page.keyboard.press('ArrowDown');
await page.waitForSelector(`${POP}:popover-open`);
out.afterArrowDownOnTrigger = await state();
await page.keyboard.press('ArrowUp'); // on an option
await page.keyboard.press('Escape');
out.afterSecondEsc = await state();
// 3. Enter on the product that is already chosen: nothing changes
await page.keyboard.press('ArrowUp'); // on the trigger: opens
await page.waitForSelector(`${POP}:popover-open`);
await page.keyboard.press('Enter');
out.afterEnterSame = await state();
// 4. Enter on another product: the product changes; wave 4's rule lets go of the selection; the placed product is untouched
await page.keyboard.press('ArrowDown');
await page.waitForSelector(`${POP}:popover-open`);
await page.keyboard.press('ArrowRight');
await page.keyboard.press('Enter');
await page.waitForFunction(() => window.__rv.parts()?.productId === 'demo-side-table');
out.afterEnterOther = await state();
// 5. the wall picker, with the product selected again
await page.click('#placement-list li .placement-name');
await page.click('.step[data-step=finish] .step-toggle');
out.afterOpeningFinishStep = await state();
await page.click(WTRIG);
await page.waitForSelector(`${WPOP}:popover-open`);
for (const k of ['ArrowRight', 'ArrowRight', 'ArrowDown', 'ArrowLeft', 'Home', 'ArrowRight']) await page.keyboard.press(k);
out.wallKeys = await state();
await page.keyboard.press('Enter');
await page.waitForFunction(() => !!window.__rv.roomGraph().rooms[0].wall_material_id);
out.afterWallEnter = { ...(await state()), wall: await page.evaluate(() => window.__rv.roomGraph().rooms[0].wall_material_id) };
await page.keyboard.press('ArrowDown'); // on the wall trigger: opens, must not nudge
await page.waitForSelector(`${WPOP}:popover-open`);
await page.keyboard.press('Escape');
out.afterWallEsc = await state();
// 6. control: with the popup closed and focus on the page, the keys do reach the product
await page.evaluate(() => document.activeElement?.blur());
await page.keyboard.press('ArrowRight');
out.controlNudge = await state();
out.id = id;
out.errors = errors;
fs.writeFileSync(`${OUT}/verify4.out.json`, JSON.stringify(out, null, 1));
for (const [k, v] of Object.entries(out)) console.log(k, JSON.stringify(v));
await browser.close();
