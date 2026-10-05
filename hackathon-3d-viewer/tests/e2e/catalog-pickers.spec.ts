/**
 * E2E: the catalog pickers in the real app (host wave 5).
 *  - UX-14: the product picker (thumbnail view and list view) on `#product-select`: open and pick
 *    a tile, the keyboard path, a select set in code plus `sync()`, the List view and back, the
 *    remembered view across a reload, blocked storage, an uploaded model with "your upload",
 *    30 products in a sheet at 375 px, and the pop-up not being clipped by the panel
 *  - UX-14 step 5: real thumbnails, drawn only for the thumbnail view; `ready` never waits for
 *    them; `thumbnailUrl` wins; exactly one thumbnail WebGL context beside the 3D view's; "Restart
 *    3D view" leaves pickers, thumbnails and the Materials card working
 *  - UX-15: pickers on the wall, floor and texture-target selects (the native selects keep every
 *    option and their `change` handlers), category tabs, and a visible name under each slot swatch
 *  - Wave 4 interplay: with a placed product selected, the keys used inside a picker do not reach it
 *
 * The native selects are driven with `selectOption` in every other spec; here the pickers
 * themselves are used, with real pointer and keyboard input. Writes no files.
 *
 * A thumbnail takes 0.3 to 2.7 s under software rendering, so the tests that need one wait with a
 * long timeout; the others never wait for one.
 */
import { expect, test, type Page } from '@playwright/test';

test.describe.configure({ timeout: 150_000 });
test.use({ viewport: { width: 1440, height: 900 } });

const ROOM_TOGGLE = '#workspace-mode button[data-mode=room]';
const THUMB_TIMEOUT = 60_000;

const trigger = (select: string) => `.tpicker[data-picker-for=${select}] .tpicker-trigger`;
const popup = (select: string) => `.tpicker-popup[data-picker-for=${select}]`;
const option = (select: string, id: string) => `${popup(select)} [role=option][data-id="${id}"]`;
const PRODUCT = 'product-select';
const WALL = 'room-wall-material';
const FLOOR = 'room-floor-material';
const TARGET = 'texture-target';

const ready = (page: Page) =>
  expect(page.locator('body')).toHaveAttribute('data-viewer-status', 'ready', { timeout: 30_000 });

/** Console errors and uncaught exceptions of the page, collected from now on. */
function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console.error: ${m.text()}`);
  });
  return errors;
}

/** Record every WebGL context the page creates, so a test can count the ones that are alive. */
async function countWebglContexts(page: Page) {
  await page.addInitScript(() => {
    const all: (WebGLRenderingContext | WebGL2RenderingContext)[] = [];
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...rest: unknown[]) {
      const ctx = (original as any).call(this, type, ...rest);
      if (ctx && /^webgl/.test(type) && !all.includes(ctx)) all.push(ctx);
      return ctx;
    } as typeof original;
    (window as any).__webgl = () => ({ created: all.length, live: all.filter((c) => !c.isContextLost()).length });
  });
}
const webgl = (page: Page) => page.evaluate(() => (window as any).__webgl() as { created: number; live: number });

const thumbStats = (page: Page) => page.evaluate(() => window.__rv.thumbnails());
const isOpen = (page: Page, select: string) =>
  page.evaluate((p) => document.querySelector(p)!.matches(':popover-open'), popup(select));
const viewOf = (page: Page, select: string) => page.locator(popup(select)).getAttribute('data-view');

async function openPicker(page: Page, select: string) {
  await page.click(trigger(select));
  await expect.poll(() => isOpen(page, select)).toBe(true);
}

async function createRoom(page: Page) {
  await page.click(ROOM_TOGGLE);
  await page.selectOption('#room-preset', 'living');
  await page.click('#btn-create-room');
  await expect.poll(async () => page.evaluate(() => window.__rv.roomGraph()?.walls.length ?? 0)).toBe(4);
}

const openStep = (page: Page, step: 'room' | 'openings' | 'place' | 'finish') =>
  page.click(`.step[data-step=${step}] .step-toggle`);

/** 28 copies of the two demo products (30 in all), added the way an upload adds one: catalog, option, `sync()`. */
const addTestProducts = (page: Page) =>
  page.evaluate(() => {
    const catalog = window.__rv.catalog();
    const select = document.querySelector<HTMLSelectElement>('#product-select')!;
    for (let i = 1; i <= 28; i++) {
      const source = catalog.products[i % 2]!;
      const copy = { ...source, id: `copy-${String(i).padStart(2, '0')}`, name: `${source.name.replace(' (demo)', '')} copy ${i}` };
      catalog.products.push(copy);
      select.add(new Option(copy.name, copy.id));
    }
    window.__rv.pickers().product!.sync();
    return catalog.products.length;
  });

// ------------------------------------------------------------------ UX-14: the product picker

test('UX-14: the product picker opens a tile grid over the stage; picking a tile changes the select, the turntable and the Materials card', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('/');
  await ready(page);

  // One picker, mounted on the select where the select is. The select stays rendered for `selectOption`.
  await expect(page.locator('.tpicker[data-picker-for=product-select]')).toHaveCount(1);
  await expect(page.locator('#catalog-card #product-picker-slot .tpicker #product-select')).toBeVisible();
  // ...and it still counts as on screen for a test that asks (placed-products.spec.ts does). It did
  // not while the picker hid it with `clip-path`: an IntersectionObserver saw nothing of it.
  await expect(page.locator('#product-select')).toBeInViewport({ ratio: 1 });
  await expect(page.locator(trigger(PRODUCT))).toHaveText(/Lounge chair \(demo\)/);
  await expect(page.locator(trigger(PRODUCT))).toHaveAttribute('aria-expanded', 'false');
  // `ready` did not wait for a thumbnail: none has been asked for, and no renderer exists.
  expect(await thumbStats(page)).toBeNull();

  await openPicker(page, PRODUCT);
  await expect(page.locator(trigger(PRODUCT))).toHaveAttribute('aria-expanded', 'true');
  expect(await viewOf(page, PRODUCT)).toBe('grid');
  // Tile = thumbnail + name, and nothing else: no SKU, maker, category or price (UX-14 step 4).
  const tiles = page.locator(`${popup(PRODUCT)} [role=option]`);
  await expect(tiles).toHaveText(['Lounge chair (demo)', 'Side table (demo)']);
  await expect(page.locator(option(PRODUCT, 'demo-lounge-chair'))).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator(`${popup(PRODUCT)} [role=listbox]`)).toHaveCount(1);
  // No search field and no group tabs for two products with no category data.
  await expect(page.locator(`${popup(PRODUCT)} .tpicker-search`)).toBeHidden();
  await expect(page.locator(`${popup(PRODUCT)} .tpicker-groups`)).toBeHidden();

  // Not clipped by the 340 px panel: the pop-up is wider than the panel, lies over the stage, and is on top there.
  const layout = await page.evaluate((p) => {
    const el = document.querySelector(p)!;
    const r = el.getBoundingClientRect();
    const panel = document.querySelector('.panel')!.getBoundingClientRect();
    const overStage = { x: r.left + 40, y: r.top + r.height / 2 };
    return {
      width: Math.round(r.width),
      leftOfPanel: r.left < panel.left - 100,
      rightEdgeOnPanel: Math.abs(r.right - panel.right) <= 1,
      onTop: el.contains(document.elementFromPoint(overStage.x, overStage.y)),
      insideViewport: r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight,
    };
  }, popup(PRODUCT));
  expect(layout).toEqual({ width: 520, leftOfPanel: true, rightEdgeOnPanel: true, onTop: true, insideViewport: true });

  // Pick "Side table (demo)": the existing `change` handler runs unchanged.
  await page.click(option(PRODUCT, 'demo-side-table'));
  await expect(page.locator('#product-select')).toHaveValue('demo-side-table');
  await expect.poll(async () => page.evaluate(() => window.__rv.parts()?.productId)).toBe('demo-side-table');
  await ready(page);
  await expect(page.locator('.slot')).toHaveCount(2);
  expect(await isOpen(page, PRODUCT)).toBe(false);
  await expect(page.locator(trigger(PRODUCT))).toHaveText(/Side table \(demo\)/);
  await expect(page.locator(trigger(PRODUCT))).toBeFocused();

  expect(errors).toEqual([]);
});

test('UX-14: keyboard only: open, arrow to a tile, Enter selects, Esc closes, focus returns to the trigger', async ({ page }) => {
  await page.goto('/');
  await ready(page);
  await page.focus(trigger(PRODUCT));
  await page.keyboard.press('ArrowDown');
  await expect.poll(() => isOpen(page, PRODUCT)).toBe(true);
  // Focus starts on the current product's tile.
  await expect(page.locator(option(PRODUCT, 'demo-lounge-chair'))).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator(option(PRODUCT, 'demo-side-table'))).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#product-select')).toHaveValue('demo-side-table');
  await expect(page.locator('.slot')).toHaveCount(2);
  expect(await isOpen(page, PRODUCT)).toBe(false);
  await expect(page.locator(trigger(PRODUCT))).toBeFocused();

  // Enter on the trigger opens it again; Esc closes it and changes nothing.
  await page.keyboard.press('Enter');
  await expect.poll(() => isOpen(page, PRODUCT)).toBe(true);
  await expect(page.locator(option(PRODUCT, 'demo-side-table'))).toBeFocused();
  await page.keyboard.press('Home');
  await expect(page.locator(option(PRODUCT, 'demo-lounge-chair'))).toBeFocused();
  await page.keyboard.press('Escape');
  expect(await isOpen(page, PRODUCT)).toBe(false);
  await expect(page.locator(trigger(PRODUCT))).toBeFocused();
  await expect(page.locator('#product-select')).toHaveValue('demo-side-table');
});

test('UX-14: a select set in code shows in the trigger after sync(); selectOption keeps the trigger in step by itself', async ({ page }) => {
  await page.goto('/');
  await ready(page);
  // Setting `.value` fires no `change`, so the trigger cannot know.
  await page.evaluate(() => {
    document.querySelector<HTMLSelectElement>('#product-select')!.value = 'demo-side-table';
  });
  await expect(page.locator(trigger(PRODUCT))).toHaveText(/Lounge chair \(demo\)/);
  await page.evaluate(() => window.__rv.pickers().product!.sync());
  await expect(page.locator(trigger(PRODUCT))).toHaveText(/Side table \(demo\)/);
  await openPicker(page, PRODUCT);
  await expect(page.locator(option(PRODUCT, 'demo-side-table'))).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('Escape');

  // `selectOption` (what every other spec uses) fires `change`: the app and the trigger both follow.
  await page.selectOption('#product-select', 'demo-lounge-chair');
  await expect.poll(async () => page.evaluate(() => window.__rv.parts()?.productId)).toBe('demo-lounge-chair');
  await expect(page.locator(trigger(PRODUCT))).toHaveText(/Lounge chair \(demo\)/);
  await page.selectOption('#product-select', 'demo-side-table');
  await expect(page.locator(trigger(PRODUCT))).toHaveText(/Side table \(demo\)/);
  await expect(page.locator('.slot')).toHaveCount(2);
});

test('UX-14 step 2b: List shows one row per item and selects the same way; the choice survives a reload, per picker kind; the list view draws no thumbnail', async ({ page }) => {
  const errors = collectErrors(page);
  await countWebglContexts(page);
  await page.goto('/');
  await ready(page);

  await openPicker(page, PRODUCT);
  expect(await viewOf(page, PRODUCT)).toBe('grid');
  await expect(page.locator(`${popup(PRODUCT)} [data-view-option=grid]`)).toHaveAttribute('aria-checked', 'true');
  await page.click(`${popup(PRODUCT)} [data-view-option=list]`);
  expect(await viewOf(page, PRODUCT)).toBe('list');
  await expect(page.locator(`${popup(PRODUCT)} [data-view-option=list]`)).toHaveAttribute('aria-checked', 'true');
  // The same options, one under the other.
  const rows = await page.evaluate(
    (p) => [...document.querySelectorAll(`${p} [role=option]`)].map((o) => Math.round(o.getBoundingClientRect().left)),
    popup(PRODUCT),
  );
  expect(rows).toHaveLength(2);
  expect(rows[0]).toBe(rows[1]);
  expect(await page.evaluate(() => localStorage.getItem('catalog3d.pickerView.product'))).toBe('list');
  // The material pickers have their own remembered view: still thumbnails.
  expect(await page.evaluate(() => localStorage.getItem('catalog3d.pickerView.material'))).toBeNull();
  await page.keyboard.press('Escape');

  // Reload: the product picker opens in List. Nothing is drawn: no renderer, one WebGL context.
  await page.reload();
  await ready(page);
  expect(await addTestProducts(page)).toBe(30);
  await openPicker(page, PRODUCT);
  expect(await viewOf(page, PRODUCT)).toBe('list');
  await expect(page.locator(`${popup(PRODUCT)} [role=option]`)).toHaveCount(30);
  // 30 items is past the point where the search field appears.
  await expect(page.locator(`${popup(PRODUCT)} .tpicker-search`)).toBeVisible();
  await expect(page.locator(`${popup(PRODUCT)} .tpicker-search`)).toHaveAttribute('placeholder', 'Search products');
  await page.fill(`${popup(PRODUCT)} .tpicker-search`, 'no such product');
  await expect(page.locator(`${popup(PRODUCT)} .tpicker-empty`)).toHaveText('No products match.');
  await page.fill(`${popup(PRODUCT)} .tpicker-search`, 'copy 12');
  await expect(page.locator(`${popup(PRODUCT)} [role=option]`)).toHaveText(['Lounge chair copy 12']);
  await page.fill(`${popup(PRODUCT)} .tpicker-search`, '');
  await page.waitForTimeout(1500);
  expect(await thumbStats(page)).toBeNull();
  expect(await webgl(page)).toEqual({ created: 1, live: 1 });
  await expect(page.locator(`${popup(PRODUCT)} [role=option] img`)).toHaveCount(0);

  // Selecting from the list works the same.
  await page.click(option(PRODUCT, 'demo-side-table'));
  await expect(page.locator('#product-select')).toHaveValue('demo-side-table');
  await expect(page.locator('.slot')).toHaveCount(2);

  // The material kind: wall picker to List, reload, still List; the product choice is separate.
  await createRoom(page);
  await openStep(page, 'finish');
  await openPicker(page, WALL);
  expect(await viewOf(page, WALL)).toBe('grid');
  await page.click(`${popup(WALL)} [data-view-option=list]`);
  expect(await viewOf(page, WALL)).toBe('list');
  await page.keyboard.press('Escape');
  await page.reload();
  await ready(page);
  await page.click(ROOM_TOGGLE);
  await openStep(page, 'finish');
  await openPicker(page, FLOOR); // the floor picker shares the "material" choice
  expect(await viewOf(page, FLOOR)).toBe('list');
  await expect(page.locator(`${popup(FLOOR)} [role=option]`)).toHaveCount(14);
  // ...and back to thumbnails.
  await page.click(`${popup(FLOOR)} [data-view-option=grid]`);
  expect(await viewOf(page, FLOOR)).toBe('grid');
  expect(await page.evaluate(() => localStorage.getItem('catalog3d.pickerView.material'))).toBe('grid');
  await page.keyboard.press('Escape');

  expect(errors).toEqual([]);
});

test('UX-14 step 2b: with localStorage.setItem throwing from before load, nothing throws and the view choice holds for the session', async ({ page }) => {
  const errors = collectErrors(page);
  await page.addInitScript(() => {
    Storage.prototype.setItem = function () {
      throw new DOMException('blocked by the test', 'SecurityError');
    };
  });
  await page.goto('/');
  await ready(page);
  await openPicker(page, PRODUCT);
  await page.click(`${popup(PRODUCT)} [data-view-option=list]`);
  expect(await viewOf(page, PRODUCT)).toBe('list');
  await page.keyboard.press('Escape');
  await openPicker(page, PRODUCT);
  expect(await viewOf(page, PRODUCT)).toBe('list');
  expect(await page.evaluate(() => localStorage.getItem('catalog3d.pickerView.product'))).toBeNull();
  await page.click(option(PRODUCT, 'demo-side-table'));
  await expect(page.locator('#product-select')).toHaveValue('demo-side-table');
  await expect(page.locator('.slot')).toHaveCount(2);
  expect(errors).toEqual([]);
});

test('UX-14: a model the user adds appears in the grid with "your upload" and a placeholder, then its thumbnail', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('/');
  await ready(page);
  const glb = await page.request.get('/assets/models/side-table.glb');
  await page.setInputFiles('#model-files', { name: 'my-table.glb', mimeType: 'model/gltf-binary', buffer: await glb.body() });
  await expect.poll(async () => page.evaluate(() => window.__rv.catalog().products.filter((p) => p.userAdded).length)).toBe(1);
  await ready(page);
  const uploadId = await page.evaluate(() => window.__rv.catalog().products.find((p) => p.userAdded)!.id);

  // `refreshProductSelect` told the picker: the trigger shows the new product, selected.
  await expect(page.locator(trigger(PRODUCT))).toHaveText(/my-table/);
  await expect(page.locator(trigger(PRODUCT))).toHaveText(/your upload/);
  await expect(page.locator('#product-select')).toHaveValue(uploadId);
  // Adding a model draws nothing by itself while the thumbnail view has not been used.
  expect(await thumbStats(page)).toBeNull();

  await openPicker(page, PRODUCT);
  const tile = page.locator(option(PRODUCT, uploadId));
  await expect(tile.locator('.tpicker-name')).toHaveText('my-table');
  await expect(tile.locator('.tpicker-sub')).toHaveText('your upload');
  await expect(tile).toHaveAttribute('aria-selected', 'true');
  // The demo products carry no second line.
  await expect(page.locator(`${option(PRODUCT, 'demo-lounge-chair')} .tpicker-sub`)).toHaveCount(0);
  // Placeholder first (a neutral box, never a made-up image), then the real thumbnail.
  expect(['none', 'thumb']).toContain(await tile.locator('.tpicker-visual').getAttribute('data-kind'));
  await expect(page.locator(`${popup(PRODUCT)} [role=option] img`)).toHaveCount(3, { timeout: THUMB_TIMEOUT });
  await expect(tile.locator('img')).toHaveAttribute('src', /^data:image\/png;base64,/);
  // The trigger shows the selected product's image too.
  await expect(page.locator(`${trigger(PRODUCT)} img`)).toHaveCount(1);
  await page.keyboard.press('Escape');

  // Now that thumbnails are in use, a second upload gets its image in the trigger without the pop-up.
  const chair = await page.request.get('/assets/models/lounge-chair.glb');
  await page.setInputFiles('#model-files', { name: 'my-chair.glb', mimeType: 'model/gltf-binary', buffer: await chair.body() });
  await expect(page.locator(trigger(PRODUCT))).toHaveText(/my-chair/);
  await expect(page.locator(`${trigger(PRODUCT)} img`)).toHaveCount(1, { timeout: THUMB_TIMEOUT });
  await expect.poll(async () => (await thumbStats(page))!.cached, { timeout: THUMB_TIMEOUT }).toBe(4);

  expect(errors).toEqual([]);
});

// ------------------------------------------------------------------ UX-14 step 5: thumbnails

test('thumbnails: real images in the default finish; one thumbnail WebGL context beside the 3D view; thumbnailUrl wins; Restart 3D view leaves pickers, thumbnails and Materials working', async ({ page }) => {
  const errors = collectErrors(page);
  await countWebglContexts(page);
  await page.goto('/');
  await ready(page);
  // Before the thumbnail view is used: the 3D view's context only.
  expect(await webgl(page)).toEqual({ created: 1, live: 1 });
  await expect(page.locator(`${trigger(PRODUCT)} img`)).toHaveCount(0);

  // A swatch choice on the turntable must not show in the thumbnails: they are the DEFAULT finish.
  await page.click('.slot[data-slot=frame] .swatch[data-material=wood-black]');
  await expect
    .poll(async () => page.evaluate(() => window.__rv.viewer()!.getSlots().find((s) => s.def.id === 'frame')!.materialId))
    .toBe('wood-black');

  await openPicker(page, PRODUCT);
  const images = page.locator(`${popup(PRODUCT)} [role=option] img`);
  await expect(images).toHaveCount(2, { timeout: THUMB_TIMEOUT });
  const srcs = await images.evaluateAll((list) => list.map((img) => (img as HTMLImageElement).src));
  for (const src of srcs) expect(src).toMatch(/^data:image\/png;base64,/);
  expect(srcs[0]).not.toBe(srcs[1]);
  // Drawn, not blank: the chair's image has opaque pixels, and its frame is light oak, not the
  // black-stained ash chosen on the turntable nor the model's grey placeholder (#e7e7e7).
  const pixels = await page.evaluate(async (src) => {
    const img = new Image();
    img.src = src;
    await img.decode();
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const g = canvas.getContext('2d')!;
    g.drawImage(img, 0, 0);
    const data = g.getImageData(0, 0, canvas.width, canvas.height).data;
    let opaque = 0, warm = 0, dark = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3]! < 250) continue;
      opaque++;
      const [r, gr, b] = [data[i]!, data[i + 1]!, data[i + 2]!];
      if (r > 150 && r - b > 25) warm++; // oak: light and clearly warmer than grey
      if (r < 70 && gr < 70 && b < 70) dark++;
    }
    return { size: img.naturalWidth, opaqueShare: opaque / (data.length / 4), warmShare: warm / Math.max(1, opaque), darkShare: dark / Math.max(1, opaque) };
  }, srcs[0]!);
  expect(pixels.size).toBeGreaterThanOrEqual(192);
  expect(pixels.opaqueShare).toBeGreaterThan(0.05);
  expect(pixels.warmShare).toBeGreaterThan(0.3);
  expect(pixels.darkShare).toBeLessThan(0.3);

  // Exactly one thumbnail context plus the 3D view's, however many were drawn.
  expect(await webgl(page)).toEqual({ created: 2, live: 2 });
  expect(await thumbStats(page)).toMatchObject({ contextAlive: true, contextsCreated: 1, renders: 2, cached: 2, pending: 0 });
  // The trigger shows the selected product's image.
  await expect(page.locator(`${trigger(PRODUCT)} img`)).toHaveAttribute('src', srcs[0]!);
  await page.keyboard.press('Escape');

  // A product that brings its own image is shown with it and never drawn.
  await page.evaluate(() => {
    const catalog = window.__rv.catalog();
    const own = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><rect width="8" height="8" fill="#c00"/></svg>');
    const product = { ...catalog.products[0]!, id: 'own-image', name: 'Own image', thumbnailUrl: own };
    catalog.products.push(product);
    document.querySelector<HTMLSelectElement>('#product-select')!.add(new Option(product.name, product.id));
    window.__rv.pickers().product!.sync();
  });
  await openPicker(page, PRODUCT);
  await expect(page.locator(`${option(PRODUCT, 'own-image')} img`)).toHaveAttribute('src', /^data:image\/svg\+xml,/);
  await page.waitForTimeout(1500);
  expect((await thumbStats(page))!.renders).toBe(2);
  await page.keyboard.press('Escape');

  // Restart 3D view: both contexts are replaced, never added to.
  await page.click('#btn-remount');
  await ready(page);
  // The trigger's image is drawn again by a new renderer, without the pop-up.
  await expect(page.locator(`${trigger(PRODUCT)} img`)).toHaveCount(1, { timeout: THUMB_TIMEOUT });
  await expect.poll(async () => (await thumbStats(page))?.pending, { timeout: THUMB_TIMEOUT }).toBe(0);
  expect(await webgl(page)).toEqual({ created: 4, live: 2 });
  // The Materials card still works, and kept the finish chosen before the restart.
  await expect(page.locator('.slot')).toHaveCount(3);
  await expect(page.locator('.slot[data-slot=frame] .swatch[data-material=wood-black]')).toHaveAttribute('aria-pressed', 'true');
  await page.click('.slot[data-slot=frame] .swatch[data-material=wood-walnut]');
  await expect
    .poll(async () => page.evaluate(() => window.__rv.viewer()!.getSlots().find((s) => s.def.id === 'frame')!.materialId))
    .toBe('wood-walnut');
  // The picker still works, and the other tile is drawn again.
  await openPicker(page, PRODUCT);
  await expect(page.locator(`${option(PRODUCT, 'demo-side-table')} img`)).toHaveCount(1, { timeout: THUMB_TIMEOUT });
  await page.click(option(PRODUCT, 'demo-side-table'));
  await expect.poll(async () => page.evaluate(() => window.__rv.parts()?.productId)).toBe('demo-side-table');
  await ready(page);
  await expect(page.locator('.slot')).toHaveCount(2);
  expect(await webgl(page)).toEqual({ created: 4, live: 2 });

  expect(errors).toEqual([]);
});

// ------------------------------------------------------------------ UX-15: material pickers and swatch names

test('UX-15: wall and floor pickers show swatches, names and category tabs; a pick goes through the existing handler; the native selects keep 14 options', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('/');
  await ready(page);
  await createRoom(page);
  await openStep(page, 'finish');
  await expect(page.locator(trigger(WALL))).toHaveText(/Default/);
  await expect(page.locator(trigger(FLOOR))).toHaveText(/Default/);
  // The native selects are still rendered, and on screen, for `selectOption` and viewport checks.
  await expect(page.locator('#room-wall-material')).toBeVisible();
  await expect(page.locator('#room-wall-material')).toBeInViewport({ ratio: 1 });
  await expect(page.locator('#room-floor-material')).toBeInViewport({ ratio: 1 });

  await openPicker(page, WALL);
  expect(await viewOf(page, WALL)).toBe('grid');
  const options = page.locator(`${popup(WALL)} [role=option]`);
  await expect(options).toHaveCount(14);
  // "Default" first (value ''), then the library; every material has a CSS swatch and its name.
  await expect(options.first()).toHaveText('Default');
  await expect(options.first()).toHaveAttribute('data-id', '');
  await expect(options.first()).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator(`${popup(WALL)} [role=option] .tpicker-visual[data-kind=swatch]`)).toHaveCount(13);
  await expect(page.locator(option(WALL, 'wood-walnut'))).toHaveText('Walnut');
  const walnut = await page.evaluate((sel) => {
    const style = (document.querySelector(`${sel} .tpicker-visual`) as HTMLElement).style;
    return { color: style.backgroundColor, image: style.backgroundImage };
  }, option(WALL, 'wood-walnut'));
  expect(walnut.color).toBe('rgb(255, 255, 255)');
  expect(walnut.image).toContain('/assets/textures/wood-walnut.png');
  // Tabs from the materials' categories, named with the deck's words.
  await expect(page.locator(`${popup(WALL)} .tpicker-group`)).toHaveText(['All', 'Wood', 'Plastic', 'Textile', 'Stone', 'Metal']);
  await page.click(`${popup(WALL)} .tpicker-group[data-group=stone]`);
  await expect(options).toHaveText(['White marble']);
  // 14 materials is under the point where a search field appears.
  await expect(page.locator(`${popup(WALL)} .tpicker-search`)).toBeHidden();

  // Pick: the select's own `change` handler (onRoomMaterialChange) updates the room.
  await page.click(option(WALL, 'stone-marble'));
  await expect.poll(async () => page.evaluate(() => window.__rv.roomGraph()!.rooms[0]!.wall_material_id)).toBe('stone-marble');
  await expect(page.locator('#room-wall-material')).toHaveValue('stone-marble');
  await expect(page.locator(trigger(WALL))).toHaveText(/White marble/);
  expect(await page.evaluate(() => window.__rv.roomGraph()!.rooms[0]!.floor_material_id ?? null)).toBeNull();

  // The native selects keep every option, and `selectOption` by index still works with the picker mounted.
  await expect(page.locator('#room-wall-material option')).toHaveCount(14);
  await expect(page.locator('#room-floor-material option')).toHaveCount(14);
  await page.selectOption('#room-floor-material', { index: 1 });
  await expect.poll(async () => page.evaluate(() => window.__rv.roomGraph()!.rooms[0]!.floor_material_id)).toBe('wood-oak');
  await expect(page.locator(trigger(FLOOR))).toHaveText(/Natural oak/);

  // Undo sets the selects in code (no `change`): the triggers follow through sync().
  await page.click('#btn-undo');
  await expect(page.locator(trigger(FLOOR))).toHaveText(/Default/);
  await expect(page.locator(trigger(WALL))).toHaveText(/White marble/);
  await page.click('#btn-undo');
  await expect(page.locator(trigger(WALL))).toHaveText(/Default/);
  await expect(page.locator('#room-wall-material')).toHaveValue('');

  // The floor through its own picker, in the List view; back to "Default" through the picker too.
  await openPicker(page, FLOOR);
  await page.click(`${popup(FLOOR)} [data-view-option=list]`);
  await page.click(option(FLOOR, 'wood-walnut'));
  await expect.poll(async () => page.evaluate(() => window.__rv.roomGraph()!.rooms[0]!.floor_material_id)).toBe('wood-walnut');
  await openPicker(page, FLOOR);
  await page.click(option(FLOOR, ''));
  await expect.poll(async () => page.evaluate(() => window.__rv.roomGraph()!.rooms[0]!.floor_material_id ?? null)).toBeNull();

  expect(errors).toEqual([]);
});

test('UX-15: the texture-target picker stays inside #texture-target-wrap and follows the map role; a new texture appears in every material picker; category and role stay native', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('/');
  await ready(page);
  await page.click('#product-advanced-summary');
  // Hidden with its wrapper while the role is "new material".
  await expect(page.locator('#texture-target-wrap .tpicker[data-picker-for=texture-target]')).toHaveCount(1);
  await expect(page.locator('#texture-target-wrap')).toBeHidden();
  await expect(page.locator(trigger(TARGET))).toBeHidden();
  await page.selectOption('#texture-role', 'normalMap');
  await expect(page.locator(trigger(TARGET))).toBeVisible();
  // #texture-category and #texture-role are plain selects.
  await expect(page.locator('.tpicker #texture-category, .tpicker #texture-role')).toHaveCount(0);
  await expect(page.locator('#texture-category')).toBeVisible();

  await openPicker(page, TARGET);
  const options = page.locator(`${popup(TARGET)} [role=option]`);
  await expect(options).toHaveCount(13); // the library, with no "Default"
  await expect(options.first()).toHaveText('Natural oak');
  await expect(page.locator(`${popup(TARGET)} .tpicker-group`)).toHaveCount(6);
  await page.click(option(TARGET, 'metal-brass'));
  await expect(page.locator('#texture-target')).toHaveValue('metal-brass');
  await expect(page.locator(trigger(TARGET))).toHaveText(/Brushed brass/);
  await expect(page.locator('#texture-target option')).toHaveCount(13);

  // "Add to library" with a colour image: the new material is in the target, wall and floor pickers.
  await page.selectOption('#texture-role', 'map');
  await expect(page.locator(trigger(TARGET))).toBeHidden();
  const png = await page.request.get('/assets/textures/wool-knit.png');
  await page.setInputFiles('#texture-file', { name: 'my-weave.png', mimeType: 'image/png', buffer: await png.body() });
  await page.click('#btn-add-texture');
  await expect(page.locator('#texture-upload-status')).toContainText('my-weave');
  await expect(page.locator('#texture-target option')).toHaveCount(14);
  await expect(page.locator('#room-wall-material option')).toHaveCount(15);
  await page.selectOption('#texture-role', 'roughnessMap');
  await openPicker(page, TARGET);
  await expect(options).toHaveCount(14);
  await expect(options.last()).toHaveText('my-weave');
  await page.keyboard.press('Escape');
  await createRoom(page);
  await openStep(page, 'finish');
  await openPicker(page, WALL);
  await expect(page.locator(`${popup(WALL)} [role=option]`)).toHaveCount(15);
  const added = page.locator(`${popup(WALL)} [role=option]`).last();
  await expect(added).toHaveText('my-weave');
  // Its swatch is the uploaded image (an Object URL), drawn in CSS.
  expect(await added.locator('.tpicker-visual').evaluate((el) => (el as HTMLElement).style.backgroundImage)).toContain('blob:');
  await added.click();
  const newId = await page.evaluate(() => window.__rv.library().materials.at(-1)!.id);
  await expect.poll(async () => page.evaluate(() => window.__rv.roomGraph()!.rooms[0]!.wall_material_id)).toBe(newId);

  expect(errors).toEqual([]);
});

test('UX-15 step 6: slot swatches stay inline buttons and each shows its name on one line; the tooltip keeps "Name (SKU)"; Materials still need no panel scroll at 1440×900', async ({ page }) => {
  await page.goto('/');
  await ready(page);
  await page.waitForTimeout(2000); // as the arrival check in panel-structure.spec.ts
  await expect(page.locator('.slot')).toHaveCount(3);
  const swatches = await page.evaluate(() => {
    const panel = document.querySelector('.panel')!;
    const pr = panel.getBoundingClientRect();
    const tiles = [...document.querySelectorAll<HTMLElement>('#slots .swatch-tile')].map((tile) => {
      const button = tile.querySelector<HTMLElement>('.swatch')!;
      const name = tile.querySelector<HTMLElement>('.swatch-name')!;
      const b = button.getBoundingClientRect();
      const n = name.getBoundingClientRect();
      return {
        tag: button.tagName,
        material: button.dataset.material,
        label: button.getAttribute('aria-label'),
        pressed: button.getAttribute('aria-pressed'),
        title: button.title,
        name: name.textContent,
        shown: getComputedStyle(name).visibility === 'visible' && n.width > 0 && n.height > 0,
        oneLine: n.height < 20,
        cut: name.scrollWidth > name.clientWidth,
        under: n.top >= b.bottom,
        size: [Math.round(b.width), Math.round(b.height)],
        inPanel: n.bottom <= pr.bottom && b.top >= pr.top,
      };
    });
    return { tiles, panelScrollTop: panel.scrollTop, pageScrollY: scrollY, buttons: document.querySelectorAll('#slots button.swatch[data-material]').length };
  });
  // Chair: frame 3, handles 6, pillow 3.
  expect(swatches.tiles).toHaveLength(12);
  expect(swatches.buttons).toBe(12);
  for (const t of swatches.tiles) {
    expect(t.tag).toBe('BUTTON');
    expect(t.name).toBe(t.label);
    expect(t, `swatch ${t.material}`).toMatchObject({ shown: true, oneLine: true, cut: false, under: true, size: [34, 34], inPanel: true });
  }
  // Deck §3.4: the tooltip is unchanged.
  expect(swatches.tiles.find((t) => t.material === 'wood-oak')!.title).toBe('Natural oak (STUB-MAT-WOOD-OAK)');
  expect(swatches.tiles.filter((t) => t.pressed === 'true').map((t) => t.name)).toEqual(['Natural oak', 'Matte black PP', 'Wool — cream']);
  // Every swatch and name is on screen on arrival, with nothing scrolled.
  expect(swatches.panelScrollTop).toBe(0);
  expect(swatches.pageScrollY).toBe(0);

  // A click on the name presses its swatch (nothing has to be opened first).
  await page.click('.slot[data-slot=frame] .swatch-tile:has(.swatch[data-material=wood-walnut]) .swatch-name');
  await expect(page.locator('.slot[data-slot=frame] .swatch[data-material=wood-walnut]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.slot[data-slot=frame] [data-role=value]')).toHaveText('Walnut');
  await expect
    .poll(async () => page.evaluate(() => window.__rv.viewer()!.getSlots().find((s) => s.def.id === 'frame')!.materialId))
    .toBe('wood-walnut');
});

// ------------------------------------------------------------------ wave 4 interplay

test('wave 4 interplay: with a placed product selected, arrows, Enter and Esc inside a picker do not move or deselect it; Esc closes the picker only', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('/');
  await ready(page);
  await createRoom(page);
  await openStep(page, 'place');
  await page.click('#btn-add-to-room');
  await expect
    .poll(
      async () =>
        page.evaluate(() => {
          const g = window.__rv.roomGraph();
          return g ? g.placements.filter((p) => !!window.__rv.viewer()!.getPlacementRoot(p.id)).length : -1;
        }),
      { timeout: 30_000 },
    )
    .toBe(1);
  await page.click('#placement-list li .placement-name');
  const state = () =>
    page.evaluate(() => {
      const g = window.__rv.roomGraph()!;
      const p = g.placements[0];
      return {
        count: g.placements.length,
        pose: p ? [p.position.x, p.position.z, p.rotation_y] : null,
        selected: document.querySelector<HTMLElement>('#placement-list li[aria-current]')?.dataset.placementId ?? null,
        outline: window.__rv.viewer()!.getPlacementHighlight(),
      };
    });
  const before = await state();
  expect(before.selected).not.toBeNull();
  expect(before.outline).toBe(before.selected);

  // Opened with the pointer. Every key the selected product listens for is pressed inside the pop-up.
  await openPicker(page, PRODUCT);
  for (const key of ['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp', 'Home', 'End', 'r', 'Shift+R', 'Delete', 'Backspace', 'Shift+ArrowLeft']) {
    await page.keyboard.press(key);
  }
  expect(await isOpen(page, PRODUCT)).toBe(true);
  expect(await state()).toEqual(before);
  // Esc closes the picker, and only the picker.
  await page.keyboard.press('Escape');
  expect(await isOpen(page, PRODUCT)).toBe(false);
  await expect(page.locator(trigger(PRODUCT))).toBeFocused();
  expect(await state()).toEqual(before);

  // Opened from the keyboard: Arrow Down on the trigger opens the pop-up and does not also nudge the product.
  await page.keyboard.press('ArrowDown');
  await expect.poll(() => isOpen(page, PRODUCT)).toBe(true);
  expect(await state()).toEqual(before);
  // Enter on the product that is already chosen changes nothing.
  await page.keyboard.press('Enter');
  expect(await isOpen(page, PRODUCT)).toBe(false);
  expect(await state()).toEqual(before);

  // A material picked with the keyboard in the wall picker: the room's wall changes, the product is as it was.
  await openStep(page, 'finish');
  expect(await state()).toEqual(before);
  await page.focus(trigger(WALL));
  await page.keyboard.press('ArrowUp');
  await expect.poll(() => isOpen(page, WALL)).toBe(true);
  expect(await state()).toEqual(before);
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await expect.poll(async () => page.evaluate(() => window.__rv.roomGraph()!.rooms[0]!.wall_material_id)).toBe('wood-oak');
  expect(await state()).toEqual(before);

  // Choosing ANOTHER product is a different matter: wave 4 lets go of the selection then (the
  // Materials card turns to the product just chosen). The placed product itself is untouched.
  await openStep(page, 'place');
  await openPicker(page, PRODUCT);
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await expect.poll(async () => page.evaluate(() => window.__rv.parts()?.productId)).toBe('demo-side-table');
  expect(await state()).toEqual({ ...before, selected: null, outline: null });

  // Control: with no pop-up open and focus on the page, the same key does reach a selected product.
  await page.click('#placement-list li .placement-name');
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.press('ArrowRight');
  expect((await state()).pose).toEqual([before.pose![0]! + 0.05, before.pose![1], before.pose![2]]);

  expect(errors).toEqual([]);
});

// ------------------------------------------------------------------ 375 px

test.describe('at 375×812 with a touch screen', () => {
  test.use({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true });

  test('the product picker is a full-width sheet: 30 products in the list view, no horizontal scroll, 44 px rows and swatches', async ({ page }) => {
    const errors = collectErrors(page);
    await page.addInitScript(() => localStorage.setItem('catalog3d.pickerView.product', 'list'));
    await page.goto('/');
    await ready(page);
    const overflowX = () => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(await overflowX()).toBe(0);
    // UX-12 / UX-15 step 6: 44 px swatches on a coarse pointer, each still with its name.
    expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(true);
    const swatch = await page.locator('#slots .swatch').first().boundingBox();
    expect(Math.round(swatch!.width)).toBe(44);
    expect(Math.round(swatch!.height)).toBe(44);
    await expect(page.locator('#slots .swatch-name')).toHaveCount(12);

    expect(await addTestProducts(page)).toBe(30);
    await openPicker(page, PRODUCT);
    await page.waitForTimeout(300); // the sheet fades in
    expect(await viewOf(page, PRODUCT)).toBe('list');
    await expect(page.locator(`${popup(PRODUCT)} [role=option]`)).toHaveCount(30);
    const sheet = await page.evaluate((p) => {
      const el = document.querySelector(p)!;
      const r = el.getBoundingClientRect();
      const rows = [...el.querySelectorAll('[role=option]')].map((o) => o.getBoundingClientRect());
      return {
        left: Math.round(r.left), right: Math.round(r.right), bottom: Math.round(r.bottom), topInside: r.top >= 0,
        rowHeight: Math.round(rows[0]!.height),
        rowsInsideWidth: rows.every((row) => row.left >= 0 && row.right <= innerWidth),
        onTop: el.contains(document.elementFromPoint(innerWidth / 2, r.top + r.height / 2)),
      };
    }, popup(PRODUCT));
    expect(sheet).toEqual({ left: 0, right: 375, bottom: 812, topInside: true, rowHeight: 44, rowsInsideWidth: true, onTop: true });
    expect(await overflowX()).toBe(0);
    // The list view draws nothing, also with 30 items.
    expect(await thumbStats(page)).toBeNull();

    // The last of the 30 is reachable and selectable.
    await page.locator(option(PRODUCT, 'copy-28')).scrollIntoViewIfNeeded();
    await page.click(option(PRODUCT, 'copy-28'));
    await expect(page.locator('#product-select')).toHaveValue('copy-28');
    await expect.poll(async () => page.evaluate(() => window.__rv.parts()?.productId)).toBe('copy-28');
    expect(await overflowX()).toBe(0);

    // The thumbnail view in the same sheet: still no horizontal scroll.
    await openPicker(page, PRODUCT);
    await page.click(`${popup(PRODUCT)} [data-view-option=grid]`);
    expect(await viewOf(page, PRODUCT)).toBe('grid');
    expect(await overflowX()).toBe(0);
    await page.keyboard.press('Escape');

    expect(errors).toEqual([]);
  });
});
