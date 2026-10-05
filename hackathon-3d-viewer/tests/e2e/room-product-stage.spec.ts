/**
 * E2E, engine level:
 * - QA-05: picking a product while a room is on stage does not move the camera; the product is
 *   framed again when the Product workspace comes back.
 * - UX-06 (engine part): with `hideProductInEmptyRoom` the turntable product is hidden in a room
 *   mode that has no room; without it nothing changes; Product mode always shows the product.
 */
import { expect, test, type Page } from '@playwright/test';
import { PNG } from 'pngjs';

test.describe.configure({ timeout: 120_000 });

const ready = (page: Page) =>
  expect(page.locator('body')).toHaveAttribute('data-viewer-status', 'ready', { timeout: 30_000 });

async function freshLoad(page: Page) {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  await ready(page);
  await page.evaluate(() => localStorage.removeItem('catalog3d.roomGraph'));
  await page.reload();
  await ready(page);
}

const stage = (page: Page) =>
  page.evaluate(() => {
    const v = window.__rv.viewer() as any;
    const c = v.camera.position, t = v.controls.target;
    return {
      mode: v.getInteractionMode() as string,
      turntable: v.turntable.visible as boolean,
      ground: v.ground.visible as boolean,
      room: (v.roomBuilt?.root?.visible ?? null) as boolean | null,
      cam: [c.x, c.y, c.z, t.x, t.y, t.z] as number[],
      camDist: Math.hypot(c.x - t.x, c.y - t.y, c.z - t.z),
      product: window.__rv.parts()?.productId ?? null,
    };
  });

/** Camera pose once orbit damping has stopped moving it. */
async function settledCam(page: Page): Promise<number[]> {
  let prev = (await stage(page)).cam;
  for (let i = 0; i < 20; i++) {
    await page.waitForTimeout(150);
    const next = (await stage(page)).cam;
    if (next.every((n, k) => Math.abs(n - prev[k]!) < 1e-9)) return next;
    prev = next;
  }
  return prev;
}

const sameCam = (a: number[], b: number[]) => a.forEach((n, i) => expect(n).toBeCloseTo(b[i]!, 6));

async function woodPixels(page: Page): Promise<number> {
  await page.waitForTimeout(400);
  const png = PNG.sync.read(await page.locator('#viewer-host canvas').screenshot());
  const d = png.data;
  let wood = 0;
  for (let i = 0; i < d.length; i += 4 * 31) {
    const r = d[i]!, g = d[i + 1]!, b = d[i + 2]!;
    if (r > 120 && g > 90 && b < 140 && r > g + 10) wood++;
  }
  return wood;
}

async function pick(page: Page, productId: string) {
  await page.selectOption('#product-select', productId);
  await expect.poll(async () => (await stage(page)).product).toBe(productId);
  await ready(page);
}

test('QA-05: picking a product with a room on stage leaves the camera alone', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await freshLoad(page);

  // Reference: how the Product workspace frames each demo product.
  await pick(page, 'demo-side-table');
  const tableFramed = await settledCam(page);
  await pick(page, 'demo-lounge-chair');
  const chairFramed = await settledCam(page);
  expect(tableFramed).not.toEqual(chairFramed);

  await page.click('#workspace-mode button[data-mode=room]');
  await page.selectOption('#room-preset', 'living');
  await page.click('#btn-create-room');
  await expect.poll(async () => page.evaluate(() => !!window.__rv.roomGraph())).toBe(true);
  // In the Room workspace the product picker is in the "Place products" step (UX-08): open it.
  await page.click('.step[data-step=place] .step-toggle');
  const roomCam = await settledCam(page);
  expect((await stage(page)).mode).toBe('room');

  // Mode `room`.
  await pick(page, 'demo-side-table');
  sameCam(await settledCam(page), roomCam);
  // Mode `place` (set through the engine so the test does not depend on the panel layout).
  await page.evaluate(() => window.__rv.viewer()!.setInteractionMode('place'));
  await pick(page, 'demo-lounge-chair');
  sameCam(await settledCam(page), roomCam);
  await pick(page, 'demo-side-table');
  sameCam(await settledCam(page), roomCam);
  const inRoom = await stage(page);
  expect(inRoom.turntable).toBe(false);
  expect(inRoom.room).toBe(true);

  // Back to Product: the product picked in the room is on the turntable and framed as usual.
  await page.click('#workspace-mode button[data-mode=catalog]');
  sameCam(await settledCam(page), tableFramed);
  const product = await stage(page);
  expect(product.mode).toBe('catalog');
  expect(product.turntable).toBe(true);
  expect(product.room).toBe(false);
  expect(product.camDist).toBeLessThan(4);

  // Product workspace still frames on pick.
  await pick(page, 'demo-lounge-chair');
  sameCam(await settledCam(page), chairFramed);
  expect(await woodPixels(page)).toBeGreaterThan(20);

  expect(errors).toEqual([]);
});

test('QA-05: a product loaded off stage is framed as soon as the turntable is shown again', async ({ page }) => {
  await freshLoad(page);
  await pick(page, 'demo-side-table');
  const tableFramed = await settledCam(page);
  await pick(page, 'demo-lounge-chair');

  await page.click('#workspace-mode button[data-mode=room]');
  await page.selectOption('#room-preset', 'living');
  await page.click('#btn-create-room');
  await expect.poll(async () => page.evaluate(() => !!window.__rv.roomGraph())).toBe(true);
  // In the Room workspace the product picker is in the "Place products" step (UX-08): open it.
  await page.click('.step[data-step=place] .step-toggle');
  await pick(page, 'demo-side-table');
  // Engine call only, no resetCamera(): the viewer itself must not leave the product unframed.
  await page.evaluate(() => window.__rv.viewer()!.setInteractionMode('catalog'));
  sameCam(await settledCam(page), tableFramed);
  expect((await stage(page)).turntable).toBe(true);
});

test('UX-06 engine: without the opt-in, a room mode with no room still shows the product', async ({ page }) => {
  await freshLoad(page);
  // This test is about the engine default. Once the host passes `hideProductInEmptyRoom: true`,
  // switch it off on the live viewer here so the default path stays covered.
  await page.evaluate(() => {
    (window.__rv.viewer() as any).opts.hideProductInEmptyRoom = false;
  });
  expect(await stage(page)).toMatchObject({ mode: 'catalog', turntable: true, ground: true });
  await page.evaluate(() => window.__rv.viewer()!.setInteractionMode('room'));
  expect(await stage(page)).toMatchObject({ mode: 'room', turntable: true, ground: true });
  await page.evaluate(() => window.__rv.viewer()!.setInteractionMode('catalog'));

  // Clearing the room drops back to the product turntable, as before.
  await page.click('#workspace-mode button[data-mode=room]');
  await page.selectOption('#room-preset', 'living');
  await page.click('#btn-create-room');
  await expect.poll(async () => page.evaluate(() => !!window.__rv.roomGraph())).toBe(true);
  expect(await stage(page)).toMatchObject({ mode: 'room', turntable: false, room: true });
  await page.evaluate(() => window.__rv.viewer()!.setRoomGraph(null));
  expect(await stage(page)).toMatchObject({ mode: 'catalog', turntable: true, ground: true, room: null });
});

test('UX-06 engine: with the opt-in, an empty Room stage has no product; Product always has it', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await freshLoad(page);
  expect(await woodPixels(page)).toBeGreaterThan(20);

  // The host opts in with `new RoomVibezViewer(host, { ..., hideProductInEmptyRoom: true })`.
  // The host in this build does not pass it yet, so the test sets the same option on the live viewer.
  await page.evaluate(() => {
    (window.__rv.viewer() as any).opts.hideProductInEmptyRoom = true;
  });
  // Product mode is not affected by the flag.
  await page.evaluate(() => window.__rv.viewer()!.setInteractionMode('catalog'));
  expect(await stage(page)).toMatchObject({ mode: 'catalog', turntable: true, ground: true });
  const productCam = await settledCam(page);

  // Room mode, no room: nothing on stage.
  await page.evaluate(() => window.__rv.viewer()!.setInteractionMode('room'));
  expect(await stage(page)).toMatchObject({ mode: 'room', turntable: false, ground: false, room: null });
  expect(await woodPixels(page)).toBeLessThan(5);
  // Picking a product there loads it without moving the camera.
  await pick(page, 'demo-side-table');
  sameCam(await settledCam(page), productCam);
  expect((await stage(page)).turntable).toBe(false);
  await pick(page, 'demo-lounge-chair');

  // Back to Product: the chair is there (pixels, not only flags).
  await page.evaluate(() => window.__rv.viewer()!.setInteractionMode('catalog'));
  expect(await stage(page)).toMatchObject({ mode: 'catalog', turntable: true, ground: true });
  expect(await woodPixels(page)).toBeGreaterThan(20);

  // A room appears: shell on stage, product hidden. Leaving for Product shows the chair again.
  await page.click('#workspace-mode button[data-mode=room]');
  await page.selectOption('#room-preset', 'living');
  await page.click('#btn-create-room');
  await expect.poll(async () => page.evaluate(() => !!window.__rv.roomGraph())).toBe(true);
  expect(await stage(page)).toMatchObject({ mode: 'room', turntable: false, room: true });
  await page.click('#workspace-mode button[data-mode=catalog]');
  expect(await stage(page)).toMatchObject({ mode: 'catalog', turntable: true, room: false });
  expect(await woodPixels(page)).toBeGreaterThan(20);

  // The room is cleared while a room mode is active: with the opt-in the stage stays an empty room stage.
  await page.evaluate(() => {
    const v = window.__rv.viewer()!;
    v.setInteractionMode('place');
    v.setRoomGraph(null);
  });
  expect(await stage(page)).toMatchObject({ mode: 'room', turntable: false, ground: false, room: null });
  // Cleared from Product mode: stays Product.
  await page.evaluate(() => {
    const v = window.__rv.viewer()!;
    v.setInteractionMode('catalog');
    v.setRoomGraph(null);
  });
  expect(await stage(page)).toMatchObject({ mode: 'catalog', turntable: true, ground: true });

  expect(errors).toEqual([]);
});
