import { expect, test, type Page } from '@playwright/test';
import path from 'node:path';

const MEDIA =
  '/Users/adrian/Library/Application Support/Cursor/AgentStores/cursor_agent_stores/bc-8afce985-5ced-40f9-8185-0e7758d59d72/files/media/room-from-scratch';
const ARTIFACTS =
  '/Users/adrian/Library/Application Support/Cursor/AgentStores/cursor_agent_stores/bc-72eda3de-df85-5edd-a696-f5a69a79c06c/files/artifacts';

const ready = (page: Page) =>
  expect(page.locator('body')).toHaveAttribute('data-viewer-status', 'ready', { timeout: 30_000 });

test('room from scratch: create, opening cutout, place catalog GLB', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

  await page.goto('/');
  await ready(page);
  await page.evaluate(() => localStorage.removeItem('catalog3d.roomGraph'));
  await page.reload();
  await ready(page);

  await expect(page.locator('.brand')).toHaveText('Catalog 3D');
  await expect(page.locator('#model-files')).toBeVisible();

  // Create Living 5×4 room. The room controls are only rendered in the Room workspace (UX-07).
  await page.click('#workspace-mode button[data-mode=room]');
  await page.selectOption('#room-preset', 'living');
  await page.click('#btn-create-room');
  await expect.poll(async () => page.evaluate(() => window.__rv.roomGraph()?.walls.length ?? 0)).toBe(4);
  await expect(page.locator('#room-tools')).toBeVisible();
  await expect(page.locator('#room-plan')).toBeVisible();
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(MEDIA, '01-room-create.png'), fullPage: true });
  await page.screenshot({ path: path.join(ARTIFACTS, 'room-create.png'), fullPage: true });

  // Add door opening (simulate wall click — same handler as canvas raycast)
  await page.click('#btn-opening-mode');
  await expect(page.locator('#btn-opening-mode')).toHaveAttribute('aria-pressed', 'true');
  await page.evaluate(() => {
    const g = window.__rv.roomGraph()!;
    const wall = g.walls[0]!;
    window.__rv.simulateRoomPointer(
      {
        kind: 'wall',
        wallId: wall.id,
        offsetAlongWall: 1.5,
        point: { x: 0, y: 1, z: wall.a.z },
      },
      'opening',
    );
  });
  await expect
    .poll(async () => page.evaluate(() => window.__rv.roomGraph()?.openings.length ?? 0))
    .toBe(1);

  // Window on adjacent wall
  await page.click('#opening-type button[data-type=window]');
  await page.evaluate(() => {
    const g = window.__rv.roomGraph()!;
    const wall = g.walls[1]!;
    window.__rv.simulateRoomPointer(
      {
        kind: 'wall',
        wallId: wall.id,
        offsetAlongWall: 1.2,
        point: { x: wall.a.x, y: 1.5, z: 0 },
      },
      'opening',
    );
  });
  await expect
    .poll(async () => page.evaluate(() => window.__rv.roomGraph()?.openings.length ?? 0))
    .toBe(2);

  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(MEDIA, '02-opening-mark.png'), fullPage: true });
  await page.screenshot({ path: path.join(ARTIFACTS, 'room-opening.png'), fullPage: true });

  // Place lounge chair on floor. The picker and the Place button are in step 3 (UX-08): open it.
  await page.click('.step[data-step=place] .step-toggle');
  await page.selectOption('#product-select', 'demo-lounge-chair');
  await ready(page);
  await page.click('#btn-place-mode');
  await expect(page.locator('#btn-place-mode')).toHaveAttribute('aria-pressed', 'true');
  await page.evaluate(() => {
    window.__rv.simulateRoomPointer({ kind: 'floor', point: { x: 0.6, y: 0, z: -0.4 } }, 'place');
  });
  await expect
    .poll(async () => page.evaluate(() => window.__rv.roomGraph()?.placements.length ?? 0))
    .toBe(1);
  await page.waitForTimeout(600);

  // Place side table as second item
  await page.selectOption('#product-select', 'demo-side-table');
  await ready(page);
  await page.evaluate(() => {
    window.__rv.viewer()?.setInteractionMode('place');
    window.__rv.simulateRoomPointer({ kind: 'floor', point: { x: -1.2, y: 0, z: 0.8 } }, 'place');
  });
  await expect
    .poll(async () => page.evaluate(() => window.__rv.roomGraph()?.placements.length ?? 0))
    .toBe(2);

  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(MEDIA, '03-furniture-place.png'), fullPage: true });
  await page.screenshot({ path: path.join(ARTIFACTS, 'room-furniture.png'), fullPage: true });

  // Persist + catalog path still alive
  const stored = await page.evaluate(() => localStorage.getItem('catalog3d.roomGraph'));
  expect(stored).toBeTruthy();
  expect(JSON.parse(stored!).openings.length).toBeGreaterThanOrEqual(2);

  await page.click('#workspace-mode button[data-mode=catalog]');
  await page.selectOption('#product-select', 'demo-lounge-chair');
  await ready(page);
  await expect(page.locator('.slot')).toHaveCount(3);

  // OBJ accept still present
  await expect(page.locator('#model-files')).toHaveAttribute('accept', /obj/i);

  expect(errors.filter((e) => !/favicon/i.test(e))).toEqual([]);
});
