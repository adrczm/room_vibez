// Extra checks after the fix: guard boundaries, pressed+hover colour, empty-field behaviour, a screenshot of the disabled look.
import { chromium } from '/Users/adrian/Desktop/Room Vibez/v2/hackathon-3d-viewer/node_modules/playwright/index.mjs';
import { fileURLToPath } from 'node:url';
const here = (f) => fileURLToPath(new URL(f, import.meta.url));
const browser = await chromium.launch({ channel: 'chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const errors = []; page.on('pageerror', (e) => errors.push(e.message)); page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await page.goto('http://127.0.0.1:18777/');
await page.waitForFunction(() => document.body.dataset.viewerStatus === 'ready');
await page.waitForTimeout(1500);
const out = {};
const mode = () => page.evaluate(() => window.__rv.viewer().getInteractionMode());
const n = () => page.evaluate(() => window.__rv.roomGraph()?.placements.length ?? 0);
const mod = process.platform === 'darwin' ? 'Meta' : 'Control';
await page.locator('#workspace-mode button[data-mode=room]').click(); await page.waitForTimeout(1200);
// disabled look with no room
await page.locator('#btn-clear-room').scrollIntoViewIfNeeded();
await page.screenshot({ path: here('./shot-room-no-room-disabled.png'), clip: await page.evaluate(() => { const r = document.querySelector('.panel').getBoundingClientRect(); return { x: r.left, y: r.top, width: r.width, height: r.height }; }) });
// empty Length: error, no room
await page.fill('#room-length', '');
await page.click('#btn-create-room', { force: true }); await page.waitForTimeout(500);
out.emptyLength = { hasRoom: await page.evaluate(() => !!window.__rv.roomGraph()), status: await page.locator('#room-status').textContent(), preset: await page.inputValue('#room-preset') };
// unit switch with an empty field leaves it empty
await page.selectOption('#room-units', 'cm');
out.emptyFieldAfterUnitSwitch = await page.inputValue('#room-length');
await page.selectOption('#room-units', 'm');
// choosing a preset again refills the fields
await page.selectOption('#room-preset', 'living');
out.presetRefill = [await page.inputValue('#room-length'), await page.inputValue('#room-width'), await page.inputValue('#room-ceiling')];
// thickness typed by hand does not flip the preset (presets carry no thickness)
await page.fill('#room-thickness', '0.2');
out.presetAfterThicknessEdit = await page.inputValue('#room-preset');
await page.click('#btn-create-room'); await page.waitForFunction(() => !!window.__rv.roomGraph()); await page.waitForTimeout(1200);
out.created = await page.evaluate(() => { const g = window.__rv.roomGraph(); const p = g.rooms[0].floor_polygon; return { name: g.rooms[0].name, length: Math.abs(p[1].x - p[0].x), width: Math.abs(p[2].z - p[1].z), thickness: g.walls[0].thickness }; });
// pressed tool button: colour at rest and on hover
await page.click('#btn-place-mode'); await page.waitForTimeout(300);
const bg = () => page.evaluate(() => { const s = getComputedStyle(document.getElementById('btn-place-mode')); return `${s.backgroundColor} / ${s.color}`; });
await page.mouse.move(5, 5); await page.waitForTimeout(200);
out.pressedAtRest = await bg();
await page.hover('#btn-place-mode'); await page.waitForTimeout(200);
out.pressedOnHover = await bg();
await page.hover('#btn-opening-mode'); await page.waitForTimeout(200);
out.unpressedOnHover = await page.evaluate(() => getComputedStyle(document.getElementById('btn-opening-mode')).backgroundColor);
// guard boundaries. Place is on.
await page.evaluate(() => window.__rv.simulateRoomPointer({ kind: 'floor', point: { x: 0.5, y: 0, z: 0.2 } }, 'place'));
await page.waitForFunction(() => window.__rv.roomGraph().placements.length === 1, null, { timeout: 15000 }); await page.waitForTimeout(400);
await page.locator('#place-wall-snap').click();
out.focusAfterCheckbox = await page.evaluate(() => document.activeElement.id);
await page.keyboard.press('Escape'); await page.waitForTimeout(200);
out.escWithCheckboxFocused_mode = await mode();
await page.keyboard.press(`${mod}+z`); await page.waitForTimeout(600);
out.undoWithCheckboxFocused_placements = await n();
await page.keyboard.press(`${mod}+Shift+z`); await page.waitForTimeout(800);
out.redo_placements = await n();
// select focused: Esc and undo are left to the select
await page.click('#btn-place-mode'); await page.waitForTimeout(200);
await page.locator('#room-preset').focus();
await page.keyboard.press('Escape'); await page.waitForTimeout(200);
out.escWithSelectFocused_mode = await mode();
await page.keyboard.press(`${mod}+z`); await page.waitForTimeout(500);
out.undoWithSelectFocused_placements = await n();
// text field focused (template title)
await page.locator('#template-title').focus();
await page.keyboard.type('abc');
await page.keyboard.press('Escape'); await page.waitForTimeout(200);
out.escWithTextFieldFocused_mode = await mode();
await page.keyboard.press(`${mod}+z`); await page.waitForTimeout(500);
out.undoWithTextFieldFocused = { placements: await n(), field: await page.inputValue('#template-title') };
// Ctrl+Y redo outside a field still works (undo first)
await page.click('.brand');
await page.keyboard.press(`${mod}+z`); await page.waitForTimeout(600);
const afterUndo = await n();
await page.keyboard.press(`${mod}+y`); await page.waitForTimeout(800);
out.undoThenRedoWithY = [afterUndo, await n()];
out.errors = errors;
console.log(JSON.stringify(out, null, 1));
await browser.close();
