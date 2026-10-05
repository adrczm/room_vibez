/**
 * E2E (QA-02, engine part): Place mode never drops a product outside the room.
 * Real pointer clicks on the canvas; the engine decides through raycastRoom, the host is unchanged.
 * "Inside the room" is `rooms[0].floor_polygon` (inner wall faces). The floor slab also runs under
 * the walls; that strip is not floor for placing.
 */
import { expect, test, type Page } from '@playwright/test';

test.describe.configure({ timeout: 120_000 });

const ready = (page: Page) =>
  expect(page.locator('body')).toHaveAttribute('data-viewer-status', 'ready', { timeout: 30_000 });

/** Client coordinates of a world point, through the live camera. */
const toClient = (page: Page, x: number, y: number, z: number) =>
  page.evaluate(
    ([x, y, z]) => {
      const v = window.__rv.viewer() as any;
      const r = v.canvas.getBoundingClientRect();
      const p = new v.camera.position.constructor(x, y, z).project(v.camera);
      return { x: r.left + ((p.x + 1) / 2) * r.width, y: r.top + ((1 - p.y) / 2) * r.height };
    },
    [x, y, z] as const,
  );

const placements = (page: Page) =>
  page.evaluate(() => window.__rv.roomGraph()!.placements.map((p) => ({ x: p.position.x, z: p.position.z })));

test('place mode: void and under-wall clicks add nothing, a floor click places inside the room', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await ready(page);
  await page.evaluate(() => localStorage.removeItem('catalog3d.roomGraph'));
  await page.reload();
  await ready(page);
  await page.click('#workspace-mode button[data-mode=room]');
  await page.selectOption('#room-preset', 'living');
  await page.click('#btn-create-room');
  await expect.poll(async () => page.evaluate(() => window.__rv.roomGraph()?.walls.length ?? 0)).toBe(4);
  // Enter Place mode through the engine (as room-from-scratch.spec does), so this spec does not
  // depend on where the panel keeps the Place button. Every canvas click below is a real pointer click.
  await page.evaluate(() => window.__rv.viewer()!.setInteractionMode('place'));
  await page.waitForTimeout(500);

  // 1. Whole canvas, 21×21 grid (the audit's S05 question): no floor hit lies outside the room.
  const grid = await page.evaluate(() => {
    const v = window.__rv.viewer() as any;
    const r = v.canvas.getBoundingClientRect();
    const poly = window.__rv.roomGraph()!.rooms[0]!.floor_polygon;
    const xs = poly.map((p) => p.x), zs = poly.map((p) => p.z);
    const N = 21;
    const out = { mode: v.getInteractionMode() as string, floorInside: 0, floorOutside: 0, wall: 0, none: 0 };
    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++) {
        const h = v.raycastRoom(r.left + ((i + 0.5) * r.width) / N, r.top + ((j + 0.5) * r.height) / N);
        if (!h) out.none++;
        else if (h.kind === 'wall') out.wall++;
        else if (h.point.x >= Math.min(...xs) && h.point.x <= Math.max(...xs) && h.point.z >= Math.min(...zs) && h.point.z <= Math.max(...zs)) out.floorInside++;
        else out.floorOutside++;
      }
    }
    return out;
  });
  expect(grid.mode).toBe('place');
  expect(grid.floorOutside).toBe(0);
  expect(grid.floorInside).toBeGreaterThan(0);

  // 2. Real click on the empty stage, bottom-left (the audit's void click): nothing is placed.
  const box = (await page.locator('#viewer-host canvas').boundingBox())!;
  await page.mouse.click(box.x + 40, box.y + box.height - 60);
  await page.waitForTimeout(1200);
  expect(await placements(page)).toEqual([]);

  // 3. Real click on the floor slab under a wall the cutaway has hidden (6 cm outside the polygon).
  const strip = await page.evaluate(() => {
    const v = window.__rv.viewer() as any;
    const g = window.__rv.roomGraph()!;
    const hiddenId = [...v.roomBuilt.wallMeshes].find(([, m]: any) => !m.visible)![0] as string;
    const w = g.walls.find((x) => x.id === hiddenId)!;
    const c = v.roomBuilt.wallMeshes.get(hiddenId).userData.cutaway;
    return { x: (w.a.x + w.b.x) / 2 + c.nx * 0.06, z: (w.a.z + w.b.z) / 2 + c.nz * 0.06 };
  });
  const stripPx = await toClient(page, strip.x, 0, strip.z);
  expect(await page.evaluate(({ x, y }) => (window.__rv.viewer() as any).raycastRoom(x, y), stripPx)).toBeNull();
  await page.mouse.click(stripPx.x, stripPx.y);
  await page.waitForTimeout(1200);
  expect(await placements(page)).toEqual([]);

  // 4. Real click on the floor in the room: one product, where the pointer was, inside the polygon.
  const target = { x: 0.8, z: -0.5 };
  const floorPx = await toClient(page, target.x, 0, target.z);
  await page.mouse.click(floorPx.x, floorPx.y);
  await expect.poll(async () => (await placements(page)).length).toBe(1);
  const placed = (await placements(page))[0]!;
  expect(Math.hypot(placed.x - target.x, placed.z - target.z)).toBeLessThan(0.05);

  // 5. Draw-wall mode keeps its old rule: any point on the slab is a drawing point.
  const drawHit = await page.evaluate(({ x, y }) => {
    const v = window.__rv.viewer() as any;
    v.setInteractionMode('draw-wall');
    const h = v.raycastRoom(x, y);
    v.setInteractionMode('place');
    return h?.kind ?? null;
  }, stripPx);
  expect(drawHit).toBe('floor');

  expect(errors).toEqual([]);
});

test('a pick in the same tick as a room rebuild is tested against the rebuilt room', async ({ page }) => {
  // Every graph change rebuilds the shell meshes. three.js refreshes world matrices when a frame is
  // rendered, so until then the new walls would be picked at the origin. On slow (software) WebGL a
  // click can arrive in that gap. raycastRoom must not depend on a frame having been drawn.
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await ready(page);
  await page.evaluate(() => localStorage.removeItem('catalog3d.roomGraph'));
  await page.reload();
  await ready(page);
  await page.click('#workspace-mode button[data-mode=room]');
  await page.selectOption('#room-preset', 'living');
  await page.click('#btn-create-room');
  await expect.poll(async () => page.evaluate(() => window.__rv.roomGraph()?.walls.length ?? 0)).toBe(4);
  await page.waitForTimeout(500);

  const px = await toClient(page, 1.0, 0, -0.5);
  const hits = await page.evaluate(({ x, y }) => {
    const v = window.__rv.viewer() as any;
    const settled = v.raycastRoom(x, y)?.kind ?? null;
    // Rebuild and pick with no frame in between (one synchronous task).
    v.setRoomGraph(window.__rv.roomGraph(), { frame: false });
    const h = v.raycastRoom(x, y);
    return { settled, sameTick: h?.kind ?? null, point: h?.point ?? null };
  }, px);
  expect(hits.settled).toBe('floor');
  expect(hits.sameTick).toBe('floor');
  expect(Math.hypot(hits.point!.x - 1.0, hits.point!.z + 0.5)).toBeLessThan(0.05);
});
