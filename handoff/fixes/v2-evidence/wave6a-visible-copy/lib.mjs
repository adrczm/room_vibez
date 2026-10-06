import { chromium } from '/Users/adrian/Desktop/Room Vibez/v2/hackathon-3d-viewer/node_modules/playwright/index.mjs';
export const BASE = process.env.RV_BASE || 'http://127.0.0.1:18777/';
export const OUT = '/private/tmp/claude-501/-Users-adrian-Desktop-Room-Vibez/7ac663fe-e0d6-4b3c-af69-487be083d847/scratchpad/h6a';
export const launch = (extra = []) => chromium.launch({ channel: 'chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', ...extra] });
export const ready = (page) => page.waitForSelector('body[data-viewer-status="ready"]', { timeout: 60000 });
export async function fresh(browser, { viewport = { width: 1280, height: 800 }, mobile = false, settle = 800, url = BASE } = {}) {
  const ctx = await browser.newContext({ viewport, ...(mobile ? { hasTouch: true, isMobile: true, deviceScaleFactor: 2 } : {}) });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`console.error: ${m.text()}`); });
  await page.goto(url);
  await ready(page);
  if (settle) await page.waitForTimeout(settle);
  return { ctx, page, errors };
}
export async function createRoom(page, preset = 'living') {
  await page.click('#workspace-mode button[data-mode=room]');
  await page.selectOption('#room-preset', preset);
  await page.click('#btn-create-room');
  await page.waitForFunction(() => (window.__rv.roomGraph()?.walls.length ?? 0) === 4);
}
export const openStep = (page, step) => page.click(`.step[data-step=${step}] .step-toggle`);
export const waitPlacements = (page, n) => page.waitForFunction((n) => { const g = window.__rv.roomGraph(); return !!g && g.placements.length === n && g.placements.every((p) => !!window.__rv.viewer().getPlacementRoot(p.id)); }, n, { timeout: 30000 });
export const VOCAB = '(SoT|SoR|MVP|\\bstub\\b|ingress|candidates|fixture|Polyfork|material_slot_id|\\bmock\\b|createAsset|COLOR_0|normalizeRoomGraph|Unknown \\/ not in public)';
/** Every match of the Copy §8 regex in body.innerText, with the line it is on. */
export const vocab = (page) => page.evaluate((src) => {
  const text = document.body.innerText; const re = new RegExp(src, 'gi'); const out = []; let m;
  while ((m = re.exec(text))) { const s = text.lastIndexOf('\n', m.index) + 1; let e = text.indexOf('\n', m.index); if (e < 0) e = text.length; out.push({ match: m[0], line: text.slice(s, e).trim().slice(0, 160) }); }
  return { test: new RegExp(src, 'i').test(text), count: out.length, matches: out, sPlurals: (text.match(/\w+\(s\)/g) ?? []) };
}, VOCAB);
