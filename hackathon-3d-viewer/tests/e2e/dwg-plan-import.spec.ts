import { expect, test, type Page } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';

const MEDIA =
  '/Users/adrian/Library/Application Support/Cursor/AgentStores/cursor_agent_stores/bc-8afce985-5ced-40f9-8185-0e7758d59d72/files/media/dwg-plan-import';
const ARTIFACTS =
  '/Users/adrian/Library/Application Support/Cursor/AgentStores/cursor_agent_stores/bc-7e0db58f-7636-5eea-bba8-97cb5781771b/files/artifacts';

const ready = (page: Page) =>
  expect(page.locator('body')).toHaveAttribute('data-viewer-status', 'ready', { timeout: 30_000 });

test.beforeAll(() => {
  fs.mkdirSync(MEDIA, { recursive: true });
  fs.mkdirSync(ARTIFACTS, { recursive: true });
});

test('DWG plan import: mock fixture → confirm → immediate room + template', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

  await page.goto('/');
  await ready(page);
  await page.evaluate(() => {
    localStorage.removeItem('catalog3d.roomGraph');
    localStorage.removeItem('catalog3d.roomTemplates');
  });
  await page.reload();
  await ready(page);

  await expect(page.locator('.brand')).toHaveText('Catalog 3D');
  await expect(page.locator('#model-files')).toBeVisible();

  // Switch to Import plan ingress
  await page.click('#room-ingress button[data-ingress=import]');
  await expect(page.locator('#room-ingress-import')).toBeVisible();
  await expect(page.locator('#import-oda-note')).toContainText('ODA / APS not available');

  await page.click('#btn-import-fixture');
  await expect(page.locator('#import-review')).toBeVisible({ timeout: 10_000 });
  await expect(page.locator('#import-extract-banner')).toContainText('mock_fixture');
  await expect(page.locator('#import-extract-banner')).toContainText('ODA available: no');
  await expect
    .poll(async () => page.evaluate(() => window.__rv.importJob()?.candidates.walls.length ?? 0))
    .toBe(4);

  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(MEDIA, '01-import-review.png'), fullPage: true });
  await page.screenshot({ path: path.join(ARTIFACTS, 'dwg-import-review.png'), fullPage: true });

  // Immediate room
  await page.click('#btn-import-start-editing');
  await expect
    .poll(async () => page.evaluate(() => window.__rv.roomGraph()?.walls.length ?? 0))
    .toBe(4);
  await expect
    .poll(async () => page.evaluate(() => window.__rv.roomGraph()?.provenance.kind))
    .toBe('dwg_import');
  await expect
    .poll(async () => page.evaluate(() => window.__rv.roomGraph()?.source_assets.length ?? 0))
    .toBe(1);
  await expect
    .poll(async () => page.evaluate(() => window.__rv.roomGraph()?.placements.length ?? 0))
    .toBe(0);
  await expect(page.locator('#room-tools')).toBeVisible();

  // Place catalog GLB into imported room
  await page.selectOption('#product-select', 'demo-lounge-chair');
  await page.click('#btn-place-mode');
  await page.evaluate(() => {
    window.__rv.simulateRoomPointer(
      { kind: 'floor', point: { x: 0, y: 0, z: 0 } },
      'place',
    );
  });
  await expect
    .poll(async () => page.evaluate(() => window.__rv.roomGraph()?.placements.length ?? 0))
    .toBe(1);

  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(MEDIA, '02-immediate-room.png'), fullPage: true });
  await page.screenshot({ path: path.join(ARTIFACTS, 'dwg-immediate-room.png'), fullPage: true });

  // Save as template from a fresh import
  await page.evaluate(() => {
    localStorage.removeItem('catalog3d.roomGraph');
  });
  await page.click('#btn-clear-room');
  // UX-03: Clear room asks first ("Clear this room?"). The user confirms and stays in the Room workspace.
  await page.click('dialog.confirm-dialog [data-action="confirm"]');
  await expect.poll(async () => page.evaluate(() => window.__rv.roomGraph())).toBeNull();
  await expect(page.locator('body')).toHaveAttribute('data-workspace', 'room');
  await page.click('#room-ingress button[data-ingress=import]');
  await page.click('#btn-import-fixture');
  await expect(page.locator('#import-review')).toBeVisible({ timeout: 10_000 });
  await page.click('#btn-import-save-template');
  await expect(page.locator('#room-ingress-template')).toBeVisible();
  await expect(page.locator('#template-list li')).toHaveCount(1);

  await page.click('#template-list li button:has-text("Instantiate")');
  await expect
    .poll(async () => page.evaluate(() => window.__rv.roomGraph()?.provenance.kind))
    .toBe('template_instance');
  await expect
    .poll(async () => page.evaluate(() => window.__rv.roomGraph()?.walls.length ?? 0))
    .toBe(4);

  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(MEDIA, '03-template-instantiate.png'), fullPage: true });
  await page.screenshot({ path: path.join(ARTIFACTS, 'dwg-template.png'), fullPage: true });

  expect(errors.filter((e) => !/favicon/i.test(e))).toEqual([]);
});
