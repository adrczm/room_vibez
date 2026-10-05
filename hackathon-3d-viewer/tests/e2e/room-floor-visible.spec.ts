/**
 * E2E (UX-05, QA correction C5): right after "Create room", with no camera input, the whole floor
 * is on screen and unobstructed. Checked with raycasts, not screenshots alone.
 * Also: the wall cutaway follows the camera, hidden walls do not catch clicks, and a ceiling the
 * host switches on cannot cover the view from above.
 */
import { expect, test, type Page } from '@playwright/test';
import { PNG } from 'pngjs';

// Software WebGL on a shared machine: the first load alone can take most of the default 60 s.
test.describe.configure({ timeout: 120_000 });

const ready = (page: Page) =>
  expect(page.locator('body')).toHaveAttribute('data-viewer-status', 'ready', { timeout: 30_000 });

async function createLivingRoom(page: Page) {
  await page.goto('/');
  await ready(page);
  await page.evaluate(() => localStorage.removeItem('catalog3d.roomGraph'));
  await page.reload();
  await ready(page);
  await page.click('#workspace-mode button[data-mode=room]');
  await page.selectOption('#room-preset', 'living');
  await page.click('#btn-create-room');
  await expect.poll(async () => page.evaluate(() => window.__rv.roomGraph()?.walls.length ?? 0)).toBe(4);
  // Let a few frames render. No pointer or keyboard input reaches the canvas from here on.
  await page.waitForTimeout(600);
}

/** Raycast facts for the current view. Runs in the page; reads the viewer through the test hook. */
function floorFacts(page: Page) {
  return page.evaluate(() => {
    const v = window.__rv.viewer() as any;
    const rect = v.canvas.getBoundingClientRect();
    const poly = window.__rv.roomGraph()!.rooms[0]!.floor_polygon;
    const xs = poly.map((p) => p.x);
    const zs = poly.map((p) => p.z);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minZ = Math.min(...zs), maxZ = Math.max(...zs);
    const Vec = v.camera.position.constructor;
    const toClient = (x: number, z: number) => {
      const p = new Vec(x, 0, z).project(v.camera);
      const cx = rect.left + ((p.x + 1) / 2) * rect.width;
      const cy = rect.top + ((1 - p.y) / 2) * rect.height;
      return { cx, cy, onCanvas: p.z < 1 && cx >= rect.left && cx <= rect.right && cy >= rect.top && cy <= rect.bottom };
    };
    const N = 12;
    let samples = 0, onCanvas = 0, visible = 0;
    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++) {
        const x = minX + 0.05 + ((i + 0.5) / N) * (maxX - minX - 0.1);
        const z = minZ + 0.05 + ((j + 0.5) / N) * (maxZ - minZ - 0.1);
        samples++;
        const s = toClient(x, z);
        if (!s.onCanvas) continue;
        onCanvas++;
        const h = v.raycastRoom(s.cx, s.cy);
        if (h?.kind === 'floor' && Math.hypot(h.point.x - x, h.point.z - z) < 0.05) visible++;
      }
    }
    const centre = toClient((minX + maxX) / 2, (minZ + maxZ) / 2);
    const centreHit = v.raycastRoom(centre.cx, centre.cy);
    const cam = v.camera.position, t = v.controls.target;
    const walls: { id: string; visible: boolean; cameraOutside: boolean; footprintVisible: boolean }[] = [];
    for (const [id, mesh] of v.roomBuilt.wallMeshes) {
      const c = mesh.userData.cutaway;
      walls.push({
        id,
        visible: mesh.visible,
        cameraOutside: c.nx * (cam.x - c.px) + c.nz * (cam.z - c.pz) > 0,
        footprintVisible: v.roomBuilt.wallFootprints.get(id).visible,
      });
    }
    return {
      samples, onCanvas, visible,
      cornersOnCanvas: poly.filter((p) => toClient(p.x, p.z).onCanvas).length,
      corners: poly.length,
      centreKind: centreHit?.kind ?? null,
      centreOffset: centreHit ? Math.hypot(centreHit.point.x - (minX + maxX) / 2, centreHit.point.z - (minZ + maxZ) / 2) : null,
      centrePx: [Math.round(centre.cx - rect.left), Math.round(centre.cy - rect.top)],
      elevationDeg: (Math.atan2(cam.y - t.y, Math.hypot(cam.x - t.x, cam.z - t.z)) * 180) / Math.PI,
      walls,
      mode: v.getInteractionMode(),
    };
  });
}

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 375, height: 812 },
]) {
  test(`floor is visible on arrival at ${viewport.width}×${viewport.height} (no camera input)`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    await page.setViewportSize(viewport);
    await createLivingRoom(page);

    const f = await floorFacts(page);
    expect(f.mode).toBe('room');
    // Done-when: a raycast through the projected room centre returns the floor.
    expect(f.centreKind).toBe('floor');
    expect(f.centreOffset!).toBeLessThan(0.05);
    // "Whole floor": every corner and every sampled floor point is on the canvas and unobstructed.
    expect(f.cornersOnCanvas).toBe(f.corners);
    expect(f.onCanvas).toBe(f.samples);
    expect(f.visible).toBe(f.samples);
    // The handoff's camera range.
    expect(f.elevationDeg).toBeGreaterThanOrEqual(44.9);
    expect(f.elevationDeg).toBeLessThanOrEqual(55);
    // Cutaway: a wall is hidden exactly when the camera is on its outer side; it leaves a footprint.
    expect(f.walls.filter((w) => !w.visible).length).toBe(2);
    for (const w of f.walls) {
      expect(w.visible).toBe(!w.cameraOutside);
      expect(w.footprintVisible).toBe(!w.visible);
    }

    // The floor is really drawn there: the pixel at the room centre is not the stage background.
    const png = PNG.sync.read(await page.locator('#viewer-host canvas').screenshot());
    const scale = png.width / (await page.locator('#viewer-host canvas').evaluate((c) => c.getBoundingClientRect().width));
    const px = (x: number, y: number) => {
      const k = (Math.round(y * scale) * png.width + Math.round(x * scale)) * 4;
      return [png.data[k]!, png.data[k + 1]!, png.data[k + 2]!];
    };
    const bg = px(2, Math.round(png.height / scale / 2));
    const floor = px(f.centrePx[0]!, f.centrePx[1]!);
    expect(Math.max(...floor.map((c, i) => Math.abs(c - bg[i]!)))).toBeGreaterThan(25);

    expect(errors).toEqual([]);
  });
}

test('cutaway is what uncovers the near floor; hidden walls and their openings do not catch clicks', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await createLivingRoom(page);

  // A floor point close to the corner nearest the camera (the camera sits on the +x/+z side).
  const probe = () =>
    page.evaluate(() => {
      const v = window.__rv.viewer() as any;
      const rect = v.canvas.getBoundingClientRect();
      const p = new v.camera.position.constructor(2.2, 0, 1.7).project(v.camera);
      const h = v.raycastRoom(rect.left + ((p.x + 1) / 2) * rect.width, rect.top + ((1 - p.y) / 2) * rect.height);
      return h?.kind ?? null;
    });
  expect(await probe()).toBe('floor');
  // With the cutaway switched off the same ray is stopped by a wall: camera height alone is not enough (C5).
  await page.evaluate(() => (window.__rv.viewer() as any).setWallCutaway(false));
  expect(await probe()).toBe('wall');
  expect(await page.evaluate(() => [...(window.__rv.viewer() as any).roomBuilt.wallMeshes.values()].every((m: any) => m.visible))).toBe(true);
  await page.evaluate(() => (window.__rv.viewer() as any).setWallCutaway(true));
  expect(await probe()).toBe('floor');

  // An opening on a hidden wall: its placeholder is hidden with the wall.
  await page.evaluate(() => {
    const v = window.__rv.viewer() as any;
    const hidden = [...v.roomBuilt.wallMeshes].find(([, m]: any) => !m.visible)![0] as string;
    const wall = window.__rv.roomGraph()!.walls.find((w) => w.id === hidden)!;
    window.__rv.simulateRoomPointer(
      { kind: 'wall', wallId: wall.id, offsetAlongWall: 1.2, point: { x: wall.a.x, y: 1, z: wall.a.z } },
      'opening',
    );
  });
  await expect.poll(async () => page.evaluate(() => window.__rv.roomGraph()?.openings.length ?? 0)).toBe(1);
  await page.waitForTimeout(200);
  const afterOpening = await page.evaluate(() => {
    const v = window.__rv.viewer() as any;
    const placeholders = v.roomBuilt.root.children.filter((c: any) => c.userData.kind === 'opening-placeholder');
    return {
      placeholders: placeholders.length,
      followWall: placeholders.every((g: any) => g.visible === v.roomBuilt.wallMeshes.get(g.userData.wallId).visible),
      hiddenWalls: [...v.roomBuilt.wallMeshes.values()].filter((m: any) => !m.visible).length,
    };
  });
  expect(afterOpening).toEqual({ placeholders: 1, followWall: true, hiddenWalls: 2 });
  expect(await probe()).toBe('floor');

  // Real orbit drag to the other side of the room: the cutaway follows the camera.
  const before = await floorFacts(page);
  const box = (await page.locator('#viewer-host canvas').boundingBox())!;
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx + box.height / 2, cy, { steps: 12 }); // OrbitControls: 2π per canvas height
  await page.mouse.up();
  await page.waitForTimeout(900); // damping settles
  const after = await floorFacts(page);
  const hiddenIds = (f: typeof before) => f.walls.filter((w) => !w.visible).map((w) => w.id).sort();
  expect(hiddenIds(after)).not.toEqual(hiddenIds(before));
  for (const w of after.walls) expect(w.visible).toBe(!w.cameraOutside);
  expect(after.centreKind).toBe('floor');
  expect(after.visible).toBe(after.onCanvas);
});

test('a ceiling switched on by the host is hidden while the camera is above it', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await createLivingRoom(page);
  const state = () =>
    page.evaluate(() => {
      const v = window.__rv.viewer() as any;
      return { ceiling: v.roomBuilt.ceiling.visible as boolean, camAbove: v.camera.position.y > v.roomBuilt.ceiling.position.y };
    });
  expect(await state()).toEqual({ ceiling: false, camAbove: true }); // hidden by default
  await page.evaluate(() => window.__rv.viewer()!.setCeilingVisible(true));
  await page.waitForTimeout(150);
  expect(await state()).toEqual({ ceiling: false, camAbove: true });
  expect((await floorFacts(page)).centreKind).toBe('floor');
  // Camera inside the room, below the ceiling: now the ceiling shows, and so do all four walls.
  await page.evaluate(() => {
    const v = window.__rv.viewer() as any;
    v.controls.target.set(0, 1.2, 0);
    v.camera.position.set(0.4, 1.4, 0.6);
    v.controls.update();
  });
  await page.waitForTimeout(600);
  const inside = await page.evaluate(() => {
    const v = window.__rv.viewer() as any;
    return {
      ceiling: v.roomBuilt.ceiling.visible as boolean,
      camBelow: v.camera.position.y < v.roomBuilt.ceiling.position.y,
      wallsVisible: [...v.roomBuilt.wallMeshes.values()].filter((m: any) => m.visible).length,
    };
  });
  expect(inside).toEqual({ ceiling: true, camBelow: true, wallsVisible: 4 });
});
