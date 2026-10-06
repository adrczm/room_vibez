// Shared helpers for H2 ad-hoc browser checks (headless Chrome, SwiftShader, fresh context per run).
export { chromium } from '/Users/adrian/Desktop/Room Vibez/v2/hackathon-3d-viewer/node_modules/playwright/index.mjs';
import { chromium } from '/Users/adrian/Desktop/Room Vibez/v2/hackathon-3d-viewer/node_modules/playwright/index.mjs';
export const BASE = process.env.RV_BASE || 'http://127.0.0.1:18777/';
export const SHOTS = '/private/tmp/claude-501/-Users-adrian-Desktop-Room-Vibez/7ac663fe-e0d6-4b3c-af69-487be083d847/scratchpad/h2/shots';
export const OUT = '/private/tmp/claude-501/-Users-adrian-Desktop-Room-Vibez/7ac663fe-e0d6-4b3c-af69-487be083d847/scratchpad/h2/out';
export async function launch() {
  return chromium.launch({ channel: 'chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
}
export async function fresh(browser, viewport = { width: 1440, height: 900 }, extra = {}) {
  const ctx = await browser.newContext({ viewport, acceptDownloads: true, ...extra });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push('console: ' + m.text()));
  await page.goto(BASE);
  await ready(page);
  return { ctx, page, errors };
}
export const ready = (page) => page.waitForFunction(() => document.body.dataset.viewerStatus === 'ready', null, { timeout: 60000 });
export async function toRoom(page) {
  await page.click('#workspace-mode button[data-mode=room]');
  await page.waitForFunction(() => document.body.dataset.workspace === 'room');
}
export async function createRoom(page, preset = 'living') {
  await page.selectOption('#room-preset', preset);
  await page.click('#btn-create-room');
  await page.waitForFunction(() => (window.__rv.roomGraph()?.walls.length ?? 0) === 4);
  await page.waitForTimeout(600);
}
/** Client coordinates of a world point through the live camera. */
export const toClient = (page, x, y, z) =>
  page.evaluate(([x, y, z]) => {
    const v = window.__rv.viewer();
    const r = v.canvas.getBoundingClientRect();
    const p = new v.camera.position.constructor(x, y, z).project(v.camera);
    return { x: r.left + ((p.x + 1) / 2) * r.width, y: r.top + ((1 - p.y) / 2) * r.height };
  }, [x, y, z]);
export const placements = (page) => page.evaluate(() => (window.__rv.roomGraph()?.placements ?? []).map((p) => ({ x: +p.position.x.toFixed(3), z: +p.position.z.toFixed(3) })));
export const stageState = (page) =>
  page.evaluate(() => {
    const v = window.__rv.viewer();
    return {
      workspace: document.body.dataset.workspace,
      mode: v.getInteractionMode(),
      turntable: v.turntable.visible,
      ground: v.ground.visible,
      room: v.roomBuilt?.root?.visible ?? null,
      hasRoom: !!window.__rv.roomGraph(),
      hint: document.getElementById('stage-hint')?.textContent,
      hintShown: !!document.getElementById('stage-hint')?.getClientRects().length,
      roomStatus: document.getElementById('room-status')?.textContent,
      toast: document.querySelector('#stage-toast .stage-toast-text')?.textContent ?? null,
      toastOpen: document.getElementById('stage-toast')?.dataset.open ?? null,
      toastKind: document.getElementById('stage-toast')?.dataset.kind ?? null,
      empty: (() => { const e = document.getElementById('stage-empty'); return e ? { shown: !!e.getClientRects().length } : null; })(),
    };
  });
