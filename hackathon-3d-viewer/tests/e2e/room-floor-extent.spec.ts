/**
 * E2E: room floor outer footprint matches walls; no coplanar shadow-ground fight.
 * Uses Playwright Chromium (not Chrome.app) per Chong verify policy.
 */
import { expect, test, type Page } from '@playwright/test';
import path from 'node:path';

const MEDIA =
  '/Users/adrian/Library/Application Support/Cursor/AgentStores/cursor_agent_stores/bc-8afce985-5ced-40f9-8185-0e7758d59d72/files/media/room-floor-fix';

const ready = (page: Page) =>
  expect(page.locator('body')).toHaveAttribute('data-viewer-status', 'ready', { timeout: 30_000 });

test.use({
  // Override project chrome channel — Chromium first.
  channel: undefined,
  launchOptions: {
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  },
});

test('room floor outer footprint matches walls and ground is hidden', async ({ page }) => {
  await page.goto('/');
  await ready(page);
  await page.evaluate(() => localStorage.removeItem('catalog3d.roomGraph'));
  await page.reload();
  await ready(page);

  await page.selectOption('#room-preset', 'living');
  await page.click('#btn-create-room');
  await expect.poll(async () => page.evaluate(() => window.__rv.roomGraph()?.walls.length ?? 0)).toBe(4);

  const metrics = await page.evaluate(() => {
    const v = window.__rv.viewer();
    let floor = null as any;
    const walls: any[] = [];
    let ground: { visible: boolean; y: number } | null = null;
    v.scene.traverse((o: any) => {
      if (o.userData?.kind === 'floor') floor = o;
      if (o.userData?.kind === 'wall') walls.push(o);
      if (o.userData?.kind === 'shadow-ground') ground = { visible: o.visible, y: o.position.y };
    });
    const worldBox = (m: any) => {
      m.updateWorldMatrix(true, true);
      const pos = m.geometry.attributes.position;
      const min = [Infinity, Infinity, Infinity];
      const max = [-Infinity, -Infinity, -Infinity];
      const arr = pos.array as ArrayLike<number>;
      const e = m.matrixWorld.elements as number[];
      for (let i = 0; i < pos.count; i++) {
        const x = arr[i * 3]!;
        const y = arr[i * 3 + 1]!;
        const z = arr[i * 3 + 2]!;
        const wx = e[0]! * x + e[4]! * y + e[8]! * z + e[12]!;
        const wy = e[1]! * x + e[5]! * y + e[9]! * z + e[13]!;
        const wz = e[2]! * x + e[6]! * y + e[10]! * z + e[14]!;
        min[0] = Math.min(min[0]!, wx);
        max[0] = Math.max(max[0]!, wx);
        min[1] = Math.min(min[1]!, wy);
        max[1] = Math.max(max[1]!, wy);
        min[2] = Math.min(min[2]!, wz);
        max[2] = Math.max(max[2]!, wz);
      }
      return { min, max, sx: max[0]! - min[0]!, sz: max[2]! - min[2]! };
    };
    const fb = worldBox(floor);
    const wbs = walls.map(worldBox);
    const wminX = Math.min(...wbs.map((b) => b.min[0]!));
    const wmaxX = Math.max(...wbs.map((b) => b.max[0]!));
    const wminZ = Math.min(...wbs.map((b) => b.min[2]!));
    const wmaxZ = Math.max(...wbs.map((b) => b.max[2]!));
    const wminY = Math.min(...wbs.map((b) => b.min[1]!));
    return {
      floorSx: fb.sx,
      floorSz: fb.sz,
      floorMaxY: fb.max[1],
      wallSx: wmaxX - wminX,
      wallSz: wmaxZ - wminZ,
      wallMinY: wminY,
      footprint: floor.userData.footprint,
      groundVisible: ground?.visible ?? null,
    };
  });

  expect(metrics.footprint).toBe('outer');
  expect(metrics.groundVisible).toBe(false);
  expect(metrics.floorSx).toBeCloseTo(metrics.wallSx, 3);
  expect(metrics.floorSz).toBeCloseTo(metrics.wallSz, 3);
  expect(metrics.floorMaxY).toBeLessThan(metrics.wallMinY);

  // Visual evidence shot
  await page.evaluate(() => {
    const v = window.__rv.viewer();
    const t = v.controls.target;
    v.camera.position.set(t.x + 5, t.y + 1.8, t.z + 5);
    v.camera.lookAt(t);
    v.controls.update();
  });
  await page.waitForTimeout(300);
  await page.locator('[data-testid=viewer-canvas]').screenshot({
    path: path.join(MEDIA, 'e2e-floor-extent-orbit.png'),
  });
});
