/**
 * E2E: Product workspace must show the catalog GLB even after a room was loaded.
 * Regression: room shell + room camera occluded / dwarfed the turntable model.
 * Playwright Chromium (SwiftShader) first — Chong policy.
 */
import { expect, test, type Page } from '@playwright/test';
import { PNG } from 'pngjs';
import fs from 'node:fs';
import path from 'node:path';

const MEDIA =
  '/Users/adrian/Library/Application Support/Cursor/AgentStores/cursor_agent_stores/bc-8afce985-5ced-40f9-8185-0e7758d59d72/files/media/model-display-fix';

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
    seen.add((r >> 3) << 10 | (g >> 3) << 5 | (b >> 3));
    if (Math.abs(r - bg[0]!) > 12 || Math.abs(g - bg[1]!) > 12 || Math.abs(b - bg[2]!) > 12) nonBg++;
    if (r > 120 && g > 90 && b < 140 && r > g + 10) wood++;
  }
  return { distinct: seen.size, nonBg, wood, bg };
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

test('product GLB visible after room create → Product workspace', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

  await page.goto('/');
  await ready(page);
  await page.evaluate(() => localStorage.removeItem('catalog3d.roomGraph'));
  await page.reload();
  await ready(page);

  const before = await page.locator('#viewer-host canvas').screenshot();
  fs.writeFileSync(path.join(MEDIA, '01-product-fresh-chair.png'), before);
  expect(canvasStats(before).distinct).toBeGreaterThan(20);
  expect(canvasStats(before).wood).toBeGreaterThan(20);

  await page.click('#workspace-mode button[data-mode=room]');
  await page.selectOption('#room-preset', 'living');
  await page.click('#btn-create-room');
  await expect.poll(async () => page.evaluate(() => !!window.__rv.roomGraph())).toBe(true);

  const roomShot = await page.locator('#viewer-host canvas').screenshot();
  fs.writeFileSync(path.join(MEDIA, '02-room-created-turntable-hidden.png'), roomShot);

  const roomState = await page.evaluate(() => {
    const v = window.__rv.viewer() as any;
    return { mode: v.getInteractionMode(), turntable: v.turntable.visible, room: v.roomBuilt?.root?.visible };
  });
  expect(roomState).toEqual({ mode: 'room', turntable: false, room: true });

  await page.click('#workspace-mode button[data-mode=catalog]');
  await page.waitForTimeout(500);

  const after = await page.locator('#viewer-host canvas').screenshot();
  fs.writeFileSync(path.join(MEDIA, '03-product-after-room-switch.png'), after);
  const stats = canvasStats(after);
  expect(stats.distinct).toBeGreaterThan(20);
  expect(stats.wood).toBeGreaterThan(20);

  const productState = await page.evaluate(() => {
    const v = window.__rv.viewer() as any;
    return {
      workspace: document.body.dataset.workspace,
      mode: v.getInteractionMode(),
      turntable: v.turntable.visible,
      room: v.roomBuilt?.root?.visible ?? null,
      ground: v.ground.visible,
      camDist: Math.hypot(
        v.camera.position.x - v.controls.target.x,
        v.camera.position.y - v.controls.target.y,
        v.camera.position.z - v.controls.target.z,
      ),
    };
  });
  expect(productState.workspace).toBe('catalog');
  expect(productState.mode).toBe('catalog');
  expect(productState.turntable).toBe(true);
  expect(productState.room).toBe(false);
  expect(productState.ground).toBe(true);
  expect(productState.camDist).toBeLessThan(4);

  await page.selectOption('#product-select', 'demo-side-table');
  await ready(page);
  await page.waitForTimeout(400);
  const table = await page.locator('#viewer-host canvas').screenshot();
  fs.writeFileSync(path.join(MEDIA, '04-product-side-table.png'), table);
  expect(canvasStats(table).distinct).toBeGreaterThan(20);

  // Full-page proof shots
  await page.screenshot({ path: path.join(MEDIA, '05-full-product-chair.png') });
  await page.selectOption('#product-select', 'demo-lounge-chair');
  await ready(page);
  await page.screenshot({ path: path.join(MEDIA, '06-full-product-after-fix.png') });

  fs.writeFileSync(
    path.join(MEDIA, 'verify.json'),
    JSON.stringify({ stats, productState, errors }, null, 2),
  );
  expect(errors).toEqual([]);
});
