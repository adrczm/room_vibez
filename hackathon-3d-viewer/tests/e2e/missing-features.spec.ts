import { expect, test, type Page } from '@playwright/test';
import path from 'node:path';
import { mkdirSync, writeFileSync } from 'node:fs';

const MEDIA =
  '/Users/adrian/Library/Application Support/Cursor/AgentStores/cursor_agent_stores/bc-8afce985-5ced-40f9-8185-0e7758d59d72/files/media/missing-features-build';

const ready = (page: Page) =>
  expect(page.locator('body')).toHaveAttribute('data-viewer-status', 'ready', { timeout: 30_000 });

test.beforeAll(() => {
  mkdirSync(MEDIA, { recursive: true });
});

test('missing features: undo, materials, snap, export, underlay path', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('dialog', (d) => d.accept());

  await page.goto('/');
  await ready(page);
  await page.evaluate(() => {
    localStorage.removeItem('catalog3d.roomGraph');
    localStorage.removeItem('catalog3d.roomTemplates');
  });
  await page.reload();
  await ready(page);

  await page.locator('#workspace-mode button[data-mode=room]').click();
  await page.selectOption('#room-preset', 'living');
  await page.click('#btn-create-room');
  await expect.poll(async () => page.evaluate(() => window.__rv.roomGraph()?.walls.length ?? 0)).toBe(4);

  // Opening → undo → redo
  await page.click('#btn-opening-mode');
  await page.evaluate(() => {
    const g = window.__rv.roomGraph()!;
    const wall = g.walls[0]!;
    window.__rv.simulateRoomPointer(
      {
        kind: 'wall',
        wallId: wall.id,
        offsetAlongWall: 1.2,
        point: { x: 0, y: 1, z: wall.a.z },
      },
      'opening',
    );
  });
  await expect.poll(async () => page.evaluate(() => window.__rv.roomGraph()?.openings.length ?? 0)).toBe(1);
  await page.click('#btn-undo');
  await expect.poll(async () => page.evaluate(() => window.__rv.roomGraph()?.openings.length ?? 0)).toBe(0);
  await page.click('#btn-redo');
  await expect.poll(async () => page.evaluate(() => window.__rv.roomGraph()?.openings.length ?? 0)).toBe(1);

  // Wall/floor materials
  const wallOpts = await page.locator('#room-wall-material option').count();
  expect(wallOpts).toBeGreaterThan(1);
  await page.selectOption('#room-wall-material', { index: 1 });
  await expect
    .poll(async () =>
      page.evaluate(() => window.__rv.roomGraph()?.rooms[0]?.wall_material_id ?? ''),
    )
    .not.toBe('');

  // Wall snap + place
  await page.check('#place-wall-snap');
  await page.selectOption('#product-select', 'demo-lounge-chair');
  await page.click('#btn-place-mode');
  await page.evaluate(() => {
    window.__rv.simulateRoomPointer({ kind: 'floor', point: { x: 0, y: 0, z: -1.7 } }, 'place');
  });
  await expect
    .poll(async () => page.evaluate(() => window.__rv.roomGraph()?.placements.length ?? 0))
    .toBeGreaterThan(0);

  // Save template from scratch
  await page.fill('#template-title', 'E2E living');
  await page.click('#btn-save-template-scratch');

  // Export project
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.click('#btn-export-project'),
  ]);
  expect(download.suggestedFilename()).toMatch(/\.json$/i);

  // Plan SVG present with scale bar text
  await expect(page.locator('#room-plan svg')).toBeVisible();

  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(MEDIA, '01-room-undo-materials-place.png'), fullPage: true });

  // Raster underlay path (synthetic PNG)
  const pngPath = path.join(MEDIA, '_tmp-underlay.png');
  // Minimal 1x1 PNG
  writeFileSync(
    pngPath,
    Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      'base64',
    ),
  );
  await page.locator('#room-ingress button[data-ingress=import]').click();
  await page.setInputFiles('#plan-file', pngPath);
  await page.click('#btn-import-plan');
  await expect(page.locator('#underlay-review')).toBeVisible({ timeout: 10_000 });
  await page.fill('#underlay-width', '5');
  await page.fill('#underlay-depth', '4');
  await page.click('#btn-underlay-confirm');
  await expect
    .poll(async () => page.evaluate(() => window.__rv.roomGraph()?.underlay?.uri ? 1 : 0))
    .toBe(1);
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(MEDIA, '02-underlay-confirm.png'), fullPage: true });

  expect(errors.filter((e) => !/SwiftShader|WebGL/i.test(e))).toEqual([]);
});
