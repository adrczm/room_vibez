import { chromium } from '/private/tmp/claude-501/-Users-adrian-Desktop-Room-Vibez/7ac663fe-e0d6-4b3c-af69-487be083d847/scratchpad/ws-engine/node_modules/playwright/index.mjs';
import pngjs from '/private/tmp/claude-501/-Users-adrian-Desktop-Room-Vibez/7ac663fe-e0d6-4b3c-af69-487be083d847/scratchpad/ws-engine/node_modules/pngjs/lib/png.js';
const { PNG } = pngjs;
const OUT = '/private/tmp/claude-501/-Users-adrian-Desktop-Room-Vibez/7ac663fe-e0d6-4b3c-af69-487be083d847/scratchpad/out-engine';
const cands = JSON.parse(process.argv[2]);
const browser = await chromium.launch({ channel: 'chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
await page.goto('http://127.0.0.1:18781/');
await page.waitForFunction(() => document.body.dataset.viewerStatus === 'ready', null, { timeout: 60000 });
await page.waitForTimeout(1500);
await page.locator('#workspace-mode button[data-mode=room]').click(); await page.waitForTimeout(800);
await page.selectOption('#room-preset', 'living'); await page.click('#btn-create-room'); await page.waitForFunction(() => !!window.__rv.roomGraph()); await page.waitForTimeout(1500);
const cells = (N = 31) => page.evaluate((N) => { const v = window.__rv.viewer(); const c = document.querySelector('#viewer-host canvas').getBoundingClientRect(); const g = window.__rv.roomGraph().rooms[0].floor_polygon; const xs = g.map((p) => p.x), zs = g.map((p) => p.z); const out = { floorIn: [], wall: [], none: [] }; for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const x = Math.round(c.left + ((i + 0.5) * c.width) / N), y = Math.round(c.top + ((j + 0.5) * c.height) / N); const h = v.raycastRoom(x, y); if (!h) out.none.push({ x, y }); else if (h.kind === 'wall') out.wall.push({ x, y }); else if (h.point.x > Math.min(...xs) + 0.6 && h.point.x < Math.max(...xs) - 0.6 && h.point.z > Math.min(...zs) + 0.6 && h.point.z < Math.max(...zs) - 0.6) out.floorIn.push({ x, y }); } return out; }, N);
const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
const ratio = (a, b) => { const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x); return +((l1 + 0.05) / (l2 + 0.05)).toFixed(2); };
const hex = (c) => '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');
const g = await cells();
for (const [floor, wall] of cands) {
  await page.evaluate(([floor, wall]) => { const m = window.__rv.viewer().roomBuilt.materials; m.floor.color.set(floor); m.wall.color.set(wall); }, [floor, wall]);
  const row = [];
  for (const preset of ['studio-soft', 'warm-interior', 'neutral']) {
    await page.locator('#presets button[data-preset=' + preset + ']').click();
    await page.waitForTimeout(700);
    const img = PNG.sync.read(await page.screenshot());
    const avg = (pts) => { const acc = [0, 0, 0]; for (const p of pts) { const k = (p.y * img.width + p.x) * 4; acc[0] += img.data[k]; acc[1] += img.data[k + 1]; acc[2] += img.data[k + 2]; } return acc.map((v) => Math.round(v / pts.length)); };
    const f = avg(g.floorIn), w = avg(g.wall), b = avg(g.none);
    row.push(`${preset}: floor ${hex(f)} wall ${hex(w)} bg ${hex(b)} F/W ${ratio(f, w)} F/BG ${ratio(f, b)} W/BG ${ratio(w, b)}`);
    if (process.argv[3]) { const clip = await page.evaluate(() => { const r = document.querySelector('#viewer-host canvas').getBoundingClientRect(); return { x: r.left, y: r.top, width: r.width, height: r.height }; }); await page.screenshot({ path: `${OUT}/shots/tune-${floor.slice(1)}-${wall.slice(1)}-${preset}.png`, clip }); }
  }
  console.log(`floor ${floor} wall ${wall}\n  ` + row.join('\n  '));
}
await browser.close();
