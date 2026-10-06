// Finding check: with only a WALL material chosen, what colour does the unedited host give the floor?
import { chromium } from '/private/tmp/claude-501/-Users-adrian-Desktop-Room-Vibez/7ac663fe-e0d6-4b3c-af69-487be083d847/scratchpad/ws-engine/node_modules/playwright/index.mjs';
const browser = await chromium.launch({ channel: 'chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
await page.goto('http://127.0.0.1:18781/');
await page.waitForFunction(() => document.body.dataset.viewerStatus === 'ready', null, { timeout: 60000 });
await page.locator('#workspace-mode button[data-mode=room]').click();
await page.selectOption('#room-preset', 'living'); await page.click('#btn-create-room'); await page.waitForFunction(() => !!window.__rv.roomGraph()); await page.waitForTimeout(800);
const read = () => page.evaluate(() => { const m = window.__rv.viewer().roomBuilt.materials; const r = window.__rv.roomGraph().rooms[0]; return { wall_material_id: r.wall_material_id ?? null, floor_material_id: r.floor_material_id ?? null, wall: m.wall.name + ' #' + m.wall.color.getHexString(), floor: m.floor.name + ' #' + m.floor.color.getHexString() }; });
const before = await read();
const opt = await page.evaluate(() => [...document.querySelectorAll('#room-wall-material option')].map((o) => o.value));
await page.selectOption('#room-wall-material', 'plastic-white'); await page.waitForTimeout(800);
const wallOnly = await read();
console.log(JSON.stringify({ wallOptions: opt.length, defaultShell: before, afterChoosingOnlyAWallMaterial: wallOnly }, null, 1));
await browser.close();
