// Shared helpers for the wave-4 ad-hoc browser checks (headless Chrome, SwiftShader).
import { chromium } from '/Users/adrian/Desktop/Room Vibez/v2/hackathon-3d-viewer/node_modules/playwright/index.mjs';

export const BASE = process.env.RV_BASE || 'http://127.0.0.1:18777/';
export const OUT = '/private/tmp/claude-501/-Users-adrian-Desktop-Room-Vibez/7ac663fe-e0d6-4b3c-af69-487be083d847/scratchpad/h4';

export async function launch() {
  return chromium.launch({
    channel: 'chrome',
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  });
}

export async function fresh(browser, { viewport = { width: 1440, height: 900 }, mobile = false, settle = 1500 } = {}) {
  const ctx = await browser.newContext({
    viewport,
    ...(mobile ? { hasTouch: true, isMobile: true, deviceScaleFactor: 2 } : {}),
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`console.error: ${m.text()}`); });
  await page.goto(BASE);
  await ready(page);
  if (settle) await page.waitForTimeout(settle);
  return { ctx, page, errors };
}

export const ready = (page) => page.waitForSelector('body[data-viewer-status="ready"]', { timeout: 60000 });

export const toClient = (page, x, y, z) =>
  page.evaluate(([x, y, z]) => {
    const v = window.__rv.viewer();
    const r = v.canvas.getBoundingClientRect();
    const p = new v.camera.position.constructor(x, y, z).project(v.camera);
    return { x: r.left + ((p.x + 1) / 2) * r.width, y: r.top + ((1 - p.y) / 2) * r.height };
  }, [x, y, z]);

export async function createRoom(page, preset = 'living') {
  await page.click('#workspace-mode button[data-mode=room]');
  await page.selectOption('#room-preset', preset);
  await page.click('#btn-create-room');
  await page.waitForFunction(() => (window.__rv.roomGraph()?.walls.length ?? 0) === 4);
}

export const openStep = (page, step) => page.click(`.step[data-step=${step}] .step-toggle`);

export const placements = (page) => page.evaluate(() => window.__rv.roomGraph()?.placements ?? []);

export const waitPlacements = (page, n) =>
  page.waitForFunction((n) => {
    const g = window.__rv.roomGraph();
    return !!g && g.placements.length === n && g.placements.every((p) => !!window.__rv.viewer().getPlacementRoot(p.id));
  }, n, { timeout: 30000 });

/** Per mesh of a placement: slot, library id, material name, colour, map file. */
export const meshes = (page, id) =>
  page.evaluate((id) => {
    const v = window.__rv.viewer();
    const root = v.getPlacementRoot(id);
    if (!root) return null;
    const out = [];
    root.traverse((o) => {
      if (!o.isMesh) return;
      let slot = null;
      for (let n = o; n && !slot; n = n.parent) {
        slot = n.userData?.material_slot_id ?? /^slot_([a-z0-9-]+(?:_[a-z0-9-]+)*?)(?:__.*)?$/i.exec(n.name ?? '')?.[1] ?? null;
      }
      const m = o.material;
      out.push({ slot, libraryId: m.userData?.libraryId ?? null, name: m.name, color: `#${m.color.getHexString()}`,
        map: m.map ? String(m.map.image?.currentSrc || m.map.image?.src || 'yes').split('/').pop() : null });
    });
    return out;
  }, id);

export const summarise = (list) => {
  if (!list) return null;
  const o = {};
  for (const m of list) {
    const k = m.slot ?? '(none)';
    (o[k] ??= new Set()).add(`${m.libraryId ?? 'embedded:' + m.name}|${m.color}|${m.map ?? 'no-map'}`);
  }
  return Object.fromEntries(Object.entries(o).map(([k, v]) => [k, [...v]]));
};

/** A screen point over a placement that raycastRoom reports as that placement (mode room). */
export const pointOn = (page, id) =>
  page.evaluate((id) => {
    const v = window.__rv.viewer();
    const r = v.canvas.getBoundingClientRect();
    const fp = v.getPlacementFootprint(id);
    const Vec = v.camera.position.constructor;
    const xs = [], ys = [];
    for (const x of [fp.minX, fp.maxX]) for (const y of [0, 0.8]) for (const z of [fp.minZ, fp.maxZ]) {
      const p = new Vec(x, y, z).project(v.camera);
      xs.push(r.left + ((p.x + 1) / 2) * r.width);
      ys.push(r.top + ((1 - p.y) / 2) * r.height);
    }
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    const N = 14;
    let best = null;
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const x = x0 + ((i + 0.5) / N) * (x1 - x0), y = y0 + ((j + 0.5) / N) * (y1 - y0);
      const h = v.raycastRoom(x, y);
      if (h?.kind === 'placement' && h.placementId === id) {
        const d = Math.hypot(x - (x0 + x1) / 2, y - (y0 + y1) / 2);
        if (!best || d < best.d) best = { x, y, d };
      }
    }
    return best ? { x: best.x, y: best.y } : null;
  }, id);
