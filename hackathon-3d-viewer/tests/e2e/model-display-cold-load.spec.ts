/**
 * E2E: Cold load must show catalog demo GLBs even when a room graph is persisted.
 * Regression: boot auto-entered Room workspace, hid the turntable, and left an empty shell.
 * Playwright Chromium (SwiftShader) first — Chong policy.
 * Asserts pixels + turntable mesh count — not only mode switches.
 */
import { expect, test, type Page } from '@playwright/test';
import { PNG } from 'pngjs';
import fs from 'node:fs';
import path from 'node:path';

const MEDIA =
  '/Users/adrian/Library/Application Support/Cursor/AgentStores/cursor_agent_stores/bc-8afce985-5ced-40f9-8185-0e7758d59d72/files/media/model-display-deep-qa';

const ready = (page: Page) =>
  expect(page.locator('body')).toHaveAttribute('data-viewer-status', 'ready', { timeout: 30_000 });

function canvasStats(buf: Buffer) {
  const png = PNG.sync.read(buf);
  const seen = new Set<number>();
  const d = png.data;
  const bg = [d[0]!, d[1]!, d[2]!];
  let nonBg = 0;
  let wood = 0;
  for (let i = 0; i < d.length; i += 4 * 31) {
    const r = d[i]!, g = d[i + 1]!, b = d[i + 2]!;
    seen.add(((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3));
    if (Math.abs(r - bg[0]!) > 12 || Math.abs(g - bg[1]!) > 12 || Math.abs(b - bg[2]!) > 12) nonBg++;
    if (r > 120 && g > 90 && b < 140 && r > g + 10) wood++;
  }
  return { distinct: seen.size, nonBg, wood, bg };
}

async function productStageState(page: Page) {
  return page.evaluate(() => {
    const v = window.__rv.viewer() as {
      getInteractionMode: () => string;
      turntable: { visible: boolean; children: unknown[]; traverse: (fn: (o: { isMesh?: boolean }) => void) => void };
      roomBuilt?: { root?: { visible: boolean } };
      ground: { visible: boolean };
      camera: { position: { x: number; y: number; z: number } };
      controls: { target: { x: number; y: number; z: number } };
    };
    let meshCount = 0;
    v.turntable.traverse((o) => {
      if (o.isMesh) meshCount++;
    });
    return {
      workspace: document.body.dataset.workspace,
      mode: v.getInteractionMode(),
      turntable: v.turntable.visible,
      turntableChildren: v.turntable.children.length,
      roomVisible: v.roomBuilt?.root?.visible ?? null,
      ground: v.ground.visible,
      hasRoomGraph: !!window.__rv.roomGraph(),
      meshCount,
      camDist: Math.hypot(
        v.camera.position.x - v.controls.target.x,
        v.camera.position.y - v.controls.target.y,
        v.camera.position.z - v.controls.target.z,
      ),
    };
  });
}

test.use({
  channel: undefined,
  launchOptions: {
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  },
});

test.beforeAll(() => {
  fs.mkdirSync(MEDIA, { recursive: true });
});

test('cold load shows demo GLB pixels + meshes even with persisted roomGraph', async ({ page }) => {
  const errors: string[] = [];
  const failed: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('response', (r) => {
    if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`);
  });

  await page.goto('/');
  await ready(page);

  // Seed a real room via UI (valid localStorage shape), then cold reload.
  await page.click('#workspace-mode button[data-mode=room]');
  await page.selectOption('#room-preset', 'living');
  await page.click('#btn-create-room');
  await expect.poll(async () => page.evaluate(() => !!window.__rv.roomGraph())).toBe(true);
  await expect
    .poll(async () => page.evaluate(() => !!localStorage.getItem('catalog3d.roomGraph')))
    .toBe(true);

  const beforeCold = await page.locator('#viewer-host canvas').screenshot();
  fs.writeFileSync(path.join(MEDIA, '10-room-before-cold-reload.png'), beforeCold);

  // Hard reload — Chong's cold load with persisted room.
  await page.reload({ waitUntil: 'networkidle' });
  await ready(page);
  await page.waitForTimeout(500);

  const afterCold = await page.locator('#viewer-host canvas').screenshot();
  fs.writeFileSync(path.join(MEDIA, '11-cold-load-after-fix.png'), afterCold);
  await page.screenshot({ path: path.join(MEDIA, '12-cold-load-after-fix-full.png') });

  const stats = canvasStats(afterCold);
  const state = await productStageState(page);

  expect(state.workspace).toBe('catalog');
  expect(state.mode).toBe('catalog');
  expect(state.turntable).toBe(true);
  expect(state.turntableChildren).toBeGreaterThanOrEqual(1);
  expect(state.meshCount).toBeGreaterThan(5);
  expect(state.roomVisible).toBe(false);
  expect(state.ground).toBe(true);
  expect(state.hasRoomGraph).toBe(true);
  expect(state.camDist).toBeLessThan(4);
  expect(stats.distinct).toBeGreaterThan(20);
  expect(stats.wood).toBeGreaterThan(20);

  // Room workspace still works after Product landing.
  await page.click('#workspace-mode button[data-mode=room]');
  await page.waitForTimeout(400);
  const roomState = await productStageState(page);
  expect(roomState.workspace).toBe('room');
  expect(roomState.mode).toBe('room');
  expect(roomState.turntable).toBe(false);
  expect(roomState.roomVisible).toBe(true);

  fs.writeFileSync(
    path.join(MEDIA, 'cold-load-verify.json'),
    JSON.stringify({ stats, state, roomState, errors, failed }, null, 2),
  );
  expect(errors).toEqual([]);
  expect(failed.filter((u) => u.includes('.glb') || u.includes('catalog') || u.includes('materials'))).toEqual([]);
});

test('cold load without persistence shows lounge chair', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.removeItem('catalog3d.roomGraph');
  });
  await page.goto('/');
  await ready(page);
  await page.waitForTimeout(400);

  const shot = await page.locator('#viewer-host canvas').screenshot();
  fs.writeFileSync(path.join(MEDIA, '13-cold-load-empty-storage.png'), shot);
  const stats = canvasStats(shot);
  const state = await productStageState(page);

  expect(state.workspace).toBe('catalog');
  expect(state.turntable).toBe(true);
  expect(state.meshCount).toBeGreaterThan(5);
  expect(stats.wood).toBeGreaterThan(20);
});
