import { expect, test, type Page } from '@playwright/test';

const ready = (page: Page) => expect(page.locator('body')).toHaveAttribute('data-viewer-status', 'ready', { timeout: 30_000 });
const parts = (page: Page) => page.evaluate(() => window.__rv.parts());

/** Sample the WebGL canvas and return the number of distinct colours (proves something rendered). */
async function canvasColourCount(page: Page): Promise<number> {
  const png = await page.locator('#viewer-host canvas').screenshot();
  return page.evaluate(async (b64) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.width; c.height = img.height;
    const ctx = c.getContext('2d')!;
    ctx.drawImage(img, 0, 0);
    const d = ctx.getImageData(0, 0, c.width, c.height).data;
    const seen = new Set<number>();
    for (let i = 0; i < d.length; i += 4 * 97) seen.add((d[i] >> 3) << 10 | (d[i + 1] >> 3) << 5 | (d[i + 2] >> 3));
    return seen.size;
  }, png.toString('base64'));
}

test('viewer loads, swaps slot materials, switches presets, remounts cleanly', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

  await page.goto('/');
  await ready(page);
  await expect(page.locator('.slot')).toHaveCount(3);
  expect(await canvasColourCount(page)).toBeGreaterThan(20);
  await page.screenshot({ path: 'tests/e2e/screenshots/01-chair-default.png' });

  // Turntable: horizontal drag spins the model; camera stays fixed.
  const before = await page.evaluate(() => {
    const v = window.__rv.viewer() as any;
    return { yaw: v.turntable.rotation.y, cam: JSON.stringify(v.camera.position) };
  });
  const box = (await page.locator('#viewer-host canvas').boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 200, box.y + box.height / 2 + 40, { steps: 10 });
  await page.mouse.up();
  await page.waitForTimeout(300);
  const after = await page.evaluate(() => {
    const v = window.__rv.viewer() as any;
    return { yaw: v.turntable.rotation.y, cam: JSON.stringify(v.camera.position) };
  });
  expect(after.yaw).not.toBe(before.yaw);
  expect(after.cam).toBe(before.cam);

  // Two slots changed independently.
  await page.click('.slot[data-slot=frame] .swatch[data-material=wood-walnut]');
  await expect.poll(async () => (await parts(page))?.parts.find((p) => p.slotId === 'frame')?.materialId).toBe('wood-walnut');
  await page.click('.slot[data-slot=pillow] .swatch[data-material=wool-terracotta]');
  await expect.poll(async () => (await parts(page))?.parts.find((p) => p.slotId === 'pillow')?.materialId).toBe('wool-terracotta');
  const p1 = (await parts(page))!;
  expect(p1.parts.find((p) => p.slotId === 'frame')!.materialId).toBe('wood-walnut');
  expect(p1.parts.find((p) => p.slotId === 'handles')!.materialId).toBe('plastic-black');
  await expect(page.getByTestId('parts-list')).toContainText('STUB-MAT-WL-TER');

  // Mesh-level check: frame meshes carry the walnut library material, pillow meshes the terracotta one.
  const bound = await page.evaluate(() => {
    const v = window.__rv.viewer() as any;
    const ids = (slot: string) => [...new Set(v.slotMeshes.get(slot).map((m: any) => m.material.userData.libraryId))];
    return { frame: ids('frame'), pillow: ids('pillow'), handles: ids('handles') };
  });
  expect(bound).toEqual({ frame: ['wood-walnut'], pillow: ['wool-terracotta'], handles: ['plastic-black'] });

  // Light presets.
  for (const id of ['warm-interior', 'neutral', 'studio-soft']) {
    await page.click(`#presets button[data-preset=${id}]`);
    expect(await page.evaluate(() => window.__rv.viewer()!.getPresetId())).toBe(id);
  }
  await page.click('#presets button[data-preset=warm-interior]');
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'tests/e2e/screenshots/02-chair-walnut-terracotta-warm.png' });

  // Lifecycle: dispose & remount keeps choices and leaves exactly one canvas.
  await page.click('#btn-remount');
  await ready(page);
  await expect(page.locator('#viewer-host canvas')).toHaveCount(1);
  await expect.poll(async () => (await parts(page))?.parts.find((p) => p.slotId === 'frame')?.materialId).toBe('wood-walnut');

  // Second product, name-convention slots.
  await page.selectOption('#product-select', 'demo-side-table');
  await ready(page);
  await expect(page.locator('.slot')).toHaveCount(2);
  await page.click('.slot[data-slot=legs] .swatch[data-material=metal-black]');
  await expect.poll(async () => (await parts(page))?.parts.find((p) => p.slotId === 'legs')?.materialId).toBe('metal-black');
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'tests/e2e/screenshots/03-table.png' });

  expect(errors).toEqual([]);
});

test('mobile layout has no horizontal scroll', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await ready(page);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await page.screenshot({ path: 'tests/e2e/screenshots/04-mobile.png', fullPage: true });
});
