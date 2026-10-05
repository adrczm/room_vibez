/**
 * Capture Catalog 3D room floor before/after screenshots via Playwright Chromium
 * (not Chrome.app). Usage: node scripts/capture-room-floor.mjs before|after
 */
import { chromium } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';

const tag = process.argv[2] === 'after' ? 'after' : 'before';
const MEDIA =
  '/Users/adrian/Library/Application Support/Cursor/AgentStores/cursor_agent_stores/bc-8afce985-5ced-40f9-8185-0e7758d59d72/files/media/room-floor-fix';
const ARTIFACTS =
  '/Users/adrian/Library/Application Support/Cursor/AgentStores/cursor_agent_stores/bc-0b87c73e-5da1-5b13-9e5d-bbbb3553903c/files/artifacts';

fs.mkdirSync(MEDIA, { recursive: true });
fs.mkdirSync(ARTIFACTS, { recursive: true });

const browser = await chromium.launch({
  // Explicitly NOT channel:'chrome' — Chong verify policy: non-Chrome.app first
  headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.on('pageerror', (e) => console.error('PAGEERROR', e.message));

await page.goto('http://127.0.0.1:18777/', { waitUntil: 'networkidle' });
await page.waitForFunction(() => document.body?.dataset.viewerStatus === 'ready', null, {
  timeout: 30_000,
});
await page.evaluate(() => localStorage.removeItem('catalog3d.roomGraph'));
await page.reload({ waitUntil: 'networkidle' });
await page.waitForFunction(() => document.body?.dataset.viewerStatus === 'ready', null, {
  timeout: 30_000,
});

await page.selectOption('#room-preset', 'living');
await page.click('#btn-create-room');
await page.waitForFunction(() => window.__rv?.roomGraph()?.walls?.length === 4, null, {
  timeout: 10_000,
});
await page.waitForTimeout(700);

const canvas = page.locator('[data-testid=viewer-canvas]');

const liveMetrics = await page.evaluate(() => {
  const g = window.__rv.roomGraph();
  const poly = g?.rooms?.[0]?.floor_polygon ?? [];
  const xs = poly.map((p) => p.x);
  const zs = poly.map((p) => p.z);
  return {
    walls: g?.walls?.length ?? 0,
    thickness: g?.walls?.[0]?.thickness ?? null,
    floorPolySizeX: xs.length ? Math.max(...xs) - Math.min(...xs) : null,
    floorPolySizeZ: zs.length ? Math.max(...zs) - Math.min(...zs) : null,
  };
});

await page.evaluate(() => {
  const v = window.__rv.viewer();
  const t = v.controls.target;
  const r = 6.5;
  v.camera.position.set(t.x + r * 0.75, t.y + 2.4, t.z + r * 0.75);
  v.camera.lookAt(t);
  v.controls.update();
});
await page.waitForTimeout(250);
await page.screenshot({ path: path.join(MEDIA, `${tag}-01-room-angle.png`), fullPage: true });
await canvas.screenshot({ path: path.join(MEDIA, `${tag}-03-canvas-orbit.png`) });
await canvas.screenshot({ path: path.join(ARTIFACTS, `${tag}-03-canvas-orbit.png`) });

await page.evaluate(() => {
  const v = window.__rv.viewer();
  const t = v.controls.target;
  v.camera.position.set(t.x, t.y + 9, t.z + 0.05);
  v.camera.lookAt(t);
  v.controls.update();
});
await page.waitForTimeout(250);
await page.screenshot({ path: path.join(MEDIA, `${tag}-02-room-topish.png`), fullPage: true });
await canvas.screenshot({ path: path.join(MEDIA, `${tag}-04-canvas-topish.png`) });
await canvas.screenshot({ path: path.join(ARTIFACTS, `${tag}-04-canvas-topish.png`) });

fs.writeFileSync(path.join(MEDIA, `${tag}-metrics.json`), JSON.stringify({ tag, ...liveMetrics }, null, 2));
console.log(JSON.stringify({ tag, ...liveMetrics }, null, 2));
await browser.close();
