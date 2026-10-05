/**
 * E2E: products placed in the room (host wave 4).
 *  - UX-16 step 2: the finish chosen on the Materials card is the finish placed, by a click on the
 *    floor and by "Add to room"; it survives undo, redo and a reload of the page
 *  - UX-16 step 3: the one Materials card moves into the "Place products" step, with its state line
 *  - UX-09 host part: numbered rows, selecting from the canvas and from the list, rotate, nudge and
 *    delete by key and by button, Undo of each, the soft overlap warning, the room's edge
 *  - UX-16 step 4 ("16b"): the selected product's own finish
 *  - Copy §6 C: a saved room whose uploaded model is gone after a refresh says so
 * Each was a defect reproduced before the fix (placed products were flat grey whatever was
 * chosen; nothing could be selected; the missing model was skipped in silence).
 * Clicks on the canvas are real pointer clicks. Writes no files.
 */
import { expect, test, type Page } from '@playwright/test';

test.describe.configure({ timeout: 150_000 });
test.use({ viewport: { width: 1440, height: 900 } });

const ROOM_TOGGLE = '#workspace-mode button[data-mode=room]';
const PRODUCT_TOGGLE = '#workspace-mode button[data-mode=catalog]';
const TOAST = '#stage-toast';
const TOAST_TEXT = '#stage-toast .stage-toast-text';
const ROWS = '#placement-list li';
const IDLE_HINT = 'Drag to orbit · scroll to zoom · right-drag to pan';
const SELECTED_HINT = 'Arrow keys to move · R to rotate · Delete to remove';
const NEXT_PRODUCT = 'Applies to the next product you place.';
const CHAIR_DEFAULT = { frame: ['wood-oak'], handles: ['plastic-black'], pillow: ['wool-cream'] };

const ready = (page: Page) =>
  expect(page.locator('body')).toHaveAttribute('data-viewer-status', 'ready', { timeout: 30_000 });

/** A fresh page in the Room workspace with a 5 × 4 m room and the "Place products" step open. */
async function roomWithPlaceStep(page: Page) {
  await page.goto('/');
  await ready(page);
  await page.click(ROOM_TOGGLE);
  await page.selectOption('#room-preset', 'living');
  await page.click('#btn-create-room');
  await expect.poll(async () => page.evaluate(() => window.__rv.roomGraph()?.walls.length ?? 0)).toBe(4);
  await page.click('.step[data-step=place] .step-toggle');
  await page.waitForTimeout(500);
}

const placements = (page: Page) => page.evaluate(() => window.__rv.roomGraph()?.placements ?? []);

/** Wait until the room has `n` placed products and each one's model is in the 3D room. */
const placed = (page: Page, n: number) =>
  expect
    .poll(
      async () =>
        page.evaluate(() => {
          const g = window.__rv.roomGraph();
          return g ? g.placements.filter((p) => !!window.__rv.viewer()!.getPlacementRoot(p.id)).length : -1;
        }),
      { timeout: 30_000 },
    )
    .toBe(n);

async function addToRoom(page: Page, expected: number) {
  await page.click('#btn-add-to-room');
  await expect.poll(async () => (await placements(page)).length, { timeout: 30_000 }).toBe(expected);
  await placed(page, expected);
}

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

/** A point on screen where the engine's own picking finds this placed product (mode `room`). */
const pointOn = (page: Page, id: string) =>
  page.evaluate((id) => {
    const v = window.__rv.viewer() as any;
    const r = v.canvas.getBoundingClientRect();
    const fp = v.getPlacementFootprint(id);
    const Vec = v.camera.position.constructor;
    const xs: number[] = [], ys: number[] = [];
    for (const x of [fp.minX, fp.maxX]) for (const y of [0, 0.8]) for (const z of [fp.minZ, fp.maxZ]) {
      const p = new Vec(x, y, z).project(v.camera);
      xs.push(r.left + ((p.x + 1) / 2) * r.width);
      ys.push(r.top + ((1 - p.y) / 2) * r.height);
    }
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    const N = 14;
    let best: { x: number; y: number; d: number } | null = null;
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const x = x0 + ((i + 0.5) / N) * (x1 - x0), y = y0 + ((j + 0.5) / N) * (y1 - y0);
      const h = v.raycastRoom(x, y);
      if (h?.kind === 'placement' && h.placementId === id) {
        const d = Math.hypot(x - (x0 + x1) / 2, y - (y0 + y1) / 2);
        if (!best || d < best.d) best = { x, y, d };
      }
    }
    return best ? { x: best.x, y: best.y } : null;
  }, id);

async function clickProduct(page: Page, id: string) {
  const point = await pointOn(page, id);
  expect(point, 'a point on screen that picks the product').not.toBeNull();
  await page.mouse.click(point!.x, point!.y);
}

/** Per slot of a placed product: the library materials on its meshes ("embedded:<name>" for a material the model came with). */
const finishOf = (page: Page, id: string) =>
  page.evaluate((id) => {
    const root = (window.__rv.viewer() as any).getPlacementRoot(id);
    const bySlot: Record<string, string[]> = {};
    let meshes = 0, grey = 0, mapped = 0;
    // No model in the room (yet): nothing to report. Callers that poll get the finish once it is there.
    root?.traverse((o: any) => {
      if (!o.isMesh) return;
      meshes++;
      let slot: string | null = null;
      for (let n = o; n && !slot; n = n.parent) {
        slot = n.userData?.material_slot_id ?? /^slot_([a-z0-9-]+(?:_[a-z0-9-]+)*?)(?:__.*)?$/i.exec(n.name ?? '')?.[1] ?? null;
      }
      const m = o.material;
      if (`#${m.color.getHexString()}` === '#e7e7e7') grey++;
      if (m.map) mapped++;
      const key = slot ?? '(none)';
      const value = m.userData?.libraryId ?? `embedded:${m.name}`;
      if (!(bySlot[key] ??= []).includes(value)) bySlot[key].push(value);
    });
    return { bySlot, meshes, grey, mapped };
  }, id);

/** What shows which product is selected: the row, the engine's outline, the hint, the Materials card. */
const selection = (page: Page) =>
  page.evaluate(() => {
    const v = window.__rv.viewer() as any;
    const state = document.getElementById('materials-state')!;
    return {
      row: [...document.querySelectorAll<HTMLElement>('#placement-list li[aria-current]')].map((li) => li.dataset.placementId),
      outline: v.getPlacementHighlight() as string | null,
      outlines: v.placementsRoot.children.filter((c: any) => c.userData.kind === 'placement-highlight').length as number,
      hint: document.getElementById('stage-hint')!.textContent,
      state: state.hidden ? null : state.textContent,
    };
  });

/** Where the room graph and the 3D model have a placed product. */
const poseOf = (page: Page, id: string) =>
  page.evaluate((id) => {
    const p = window.__rv.roomGraph()!.placements.find((q) => q.id === id)!;
    const root = (window.__rv.viewer() as any).getPlacementRoot(id);
    const r = (n: number) => Number(n.toFixed(4));
    return {
      x: r(p.position.x), z: r(p.position.z), rot: r(p.rotation_y),
      model: root ? { x: r(root.position.x), z: r(root.position.z), rot: r(root.rotation.y) } : null,
    };
  }, id);

const toast = (page: Page) =>
  page.evaluate(() => ({
    open: document.getElementById('stage-toast')!.dataset.open,
    kind: document.getElementById('stage-toast')!.dataset.kind,
    text: document.querySelector('#stage-toast .stage-toast-text')!.textContent,
  }));

const undoKey = (page: Page) => page.keyboard.press('ControlOrMeta+z');

const QUARTER = Number((Math.PI / 2).toFixed(4));

test('UX-16: a product is placed with the finish the Materials card shows, by Add to room and by a click on the floor', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await roomWithPlaceStep(page);

  // The Materials card is in the step, under the picker, and says what a swatch applies to.
  await expect(page.locator('#materials-card')).toHaveCount(1);
  await expect(page.locator('#step-place-body #materials-card .slot')).toHaveCount(3);
  await expect(page.locator('#materials-state')).toHaveText(NEXT_PRODUCT);

  // 1. Nothing chosen: the default finish, which is oak, not the model's flat grey placeholders.
  await addToRoom(page, 1);
  const [first] = await placements(page);
  expect(first!.slot_bindings).toEqual({ frame: 'wood-oak', handles: 'plastic-black', pillow: 'wool-cream' });
  const oak = await finishOf(page, first!.id);
  expect(oak.bySlot).toEqual(CHAIR_DEFAULT);
  expect(oak.meshes).toBe(14);
  expect(oak.grey).toBe(0);
  expect(oak.mapped).toBeGreaterThanOrEqual(10); // the ten frame meshes carry the oak texture

  // 2. Walnut chosen in the room, then a real click on the floor with the Place product tool.
  await page.click('.slot[data-slot=frame] .swatch[data-material=wood-walnut]');
  await expect(page.locator('.slot[data-slot=frame] [data-role=value]')).toHaveText('Walnut');
  await page.click('#btn-place-mode');
  await expect(page.locator('#btn-place-mode')).toHaveAttribute('aria-pressed', 'true');
  const floor = await toClient(page, 1.4, 0, -1);
  await page.mouse.click(floor.x, floor.y);
  await expect.poll(async () => (await placements(page)).length, { timeout: 30_000 }).toBe(2);
  await placed(page, 2);
  await page.keyboard.press('Escape');
  const second = (await placements(page))[1]!;
  expect(second.slot_bindings.frame).toBe('wood-walnut');
  const walnut = await finishOf(page, second.id);
  expect(walnut.bySlot).toEqual({ ...CHAIR_DEFAULT, frame: ['wood-walnut'] });
  expect(walnut.grey).toBe(0);
  // The swatch was for the next product: the chair already in the room kept its oak.
  expect((await finishOf(page, first!.id)).bySlot).toEqual(CHAIR_DEFAULT);
  expect((await placements(page))[0]!.slot_bindings.frame).toBe('wood-oak');

  // 3. A swatch and "Add to room" in quick succession: the product gets what the card shows.
  await page.click('.slot[data-slot=pillow] .swatch[data-material=wool-terracotta]');
  await addToRoom(page, 3);
  const third = (await placements(page))[2]!;
  expect(third.slot_bindings).toEqual({ frame: 'wood-walnut', handles: 'plastic-black', pillow: 'wool-terracotta' });
  expect((await finishOf(page, third.id)).bySlot).toEqual({
    frame: ['wood-walnut'], handles: ['plastic-black'], pillow: ['wool-terracotta'],
  });
  expect((await finishOf(page, second.id)).bySlot.pillow).toEqual(['wool-cream']);

  // 4. A product that keeps its own materials is placed as it came. The demo catalog has none, so
  //    the side table is flagged for this test before it is chosen.
  await page.evaluate(() => {
    window.__rv.catalog().products.find((p) => p.id === 'demo-side-table')!.preserveMaterials = true;
  });
  await page.selectOption('#product-select', 'demo-side-table');
  await expect.poll(async () => page.evaluate(() => window.__rv.parts()?.productId)).toBe('demo-side-table');
  await ready(page);
  await expect(page.locator('#materials-state')).toHaveText("This model keeps its own materials, so library swatches won't change it.");
  await addToRoom(page, 4);
  const table = (await placements(page))[3]!;
  const own = await finishOf(page, table.id);
  expect(Object.values(own.bySlot).flat().every((m) => m.startsWith('embedded:'))).toBe(true);
  expect(table.slot_bindings).toEqual({ top: 'stone-marble', legs: 'metal-brass' });

  expect(errors).toEqual([]);
});

test('UX-16: the finish survives undo, redo and a reload of the page', async ({ page }) => {
  await roomWithPlaceStep(page);
  await page.click('.slot[data-slot=frame] .swatch[data-material=wood-walnut]');
  await addToRoom(page, 1);
  await page.click('.slot[data-slot=frame] .swatch[data-material=wood-black]');
  await addToRoom(page, 2);
  const [walnut, black] = (await placements(page)).map((p) => p.id);
  const finishes = async () => [(await finishOf(page, walnut!)).bySlot.frame, (await finishOf(page, black!)).bySlot.frame];
  expect(await finishes()).toEqual([['wood-walnut'], ['wood-black']]);

  // Undo and redo of a placement rebuild the placed products from the room graph, finishes included.
  await page.click('#btn-undo');
  await expect.poll(async () => (await placements(page)).length).toBe(1);
  await placed(page, 1);
  expect((await finishOf(page, walnut!)).bySlot.frame).toEqual(['wood-walnut']);
  await page.click('#btn-redo');
  await expect.poll(async () => (await placements(page)).length).toBe(2);
  await placed(page, 2);
  expect(await finishes()).toEqual([['wood-walnut'], ['wood-black']]);

  // Reload: the room comes back from storage with the same finishes on the models.
  await page.reload();
  await ready(page);
  await placed(page, 2);
  expect((await placements(page)).map((p) => p.slot_bindings.frame)).toEqual(['wood-walnut', 'wood-black']);
  expect(await finishes()).toEqual([['wood-walnut'], ['wood-black']]);
  expect((await finishOf(page, walnut!)).grey).toBe(0);
  await page.click(ROOM_TOGGLE);
  await page.click('.step[data-step=place] .step-toggle');
  await expect(page.locator(`${ROWS} .placement-name`)).toHaveText(['Lounge chair (demo) 1', 'Lounge chair (demo) 2']);
});

test('UX-16 step 3: one Materials card, after the Product card in Product and under the picker in the Place products step', async ({ page }) => {
  await page.goto('/');
  await ready(page);
  const where = () =>
    page.evaluate(() => {
      const card = document.getElementById('materials-card')!;
      const state = document.getElementById('materials-state')!;
      const top = (id: string) => document.getElementById(id)!.getBoundingClientRect().top;
      return {
        cards: document.querySelectorAll('#materials-card').length,
        slotLists: document.querySelectorAll('#slots').length,
        parent: card.parentElement!.id,
        after: card.previousElementSibling?.id ?? null,
        shown: card.offsetParent !== null,
        state: state.hidden ? null : state.textContent,
        underPicker: top('materials-card') > top('product-select'),
        aboveAddToRoom: top('materials-card') < top('btn-add-to-room'),
      };
    });

  // Product: right after the Product card, no state line (the swatches are about the product on stage).
  expect(await where()).toMatchObject({ cards: 1, slotLists: 1, parent: 'panel-catalog', after: 'catalog-card', shown: true, state: null });

  // Room, in the Place products step: the same card, under the picker and above "Add to room".
  await page.click(ROOM_TOGGLE);
  await page.selectOption('#room-preset', 'living');
  await page.click('#btn-create-room');
  await expect.poll(async () => page.evaluate(() => window.__rv.roomGraph()?.walls.length ?? 0)).toBe(4);
  await page.click('.step[data-step=place] .step-toggle');
  expect(await where()).toEqual({
    cards: 1, slotLists: 1, parent: 'materials-home-room', after: null, shown: true, state: NEXT_PRODUCT,
    underPicker: true, aboveAddToRoom: true,
  });
  // Opening the step brings the whole of it into view: the picker, the swatches and "Add to room".
  for (const id of ['product-select', 'slots', 'btn-add-to-room', 'btn-place-mode']) {
    await expect(page.locator(`#${id}`)).toBeInViewport({ ratio: 1 });
  }

  // A swatch here is a choice for the next product. It changes the (hidden) turntable product and nothing in the room.
  await page.click('#btn-add-to-room');
  await expect.poll(async () => (await placements(page)).length, { timeout: 30_000 }).toBe(1);
  await placed(page, 1);
  await page.click('.slot[data-slot=frame] .swatch[data-material=wood-walnut]');
  await expect
    .poll(async () => page.evaluate(() => window.__rv.parts()?.parts.find((p) => p.slotId === 'frame')?.materialId))
    .toBe('wood-walnut');
  const only = (await placements(page))[0]!;
  expect(only.slot_bindings.frame).toBe('wood-oak');
  expect((await finishOf(page, only.id)).bySlot.frame).toEqual(['wood-oak']);
  await expect(page.locator('#btn-redo')).toBeDisabled(); // a choice for the next product is not a room change
  // The picker's other product: its two slots, the same line.
  await page.selectOption('#product-select', 'demo-side-table');
  await ready(page);
  await expect(page.locator('#step-place-body .slot')).toHaveCount(2);
  await expect(page.locator('#materials-state')).toHaveText(NEXT_PRODUCT);

  // Back in Product: the card is where it was, with the choice made in the room.
  await page.selectOption('#product-select', 'demo-lounge-chair');
  await ready(page);
  await page.click('.slot[data-slot=frame] .swatch[data-material=wood-walnut]');
  await page.click(PRODUCT_TOGGLE);
  expect(await where()).toMatchObject({ cards: 1, slotLists: 1, parent: 'panel-catalog', after: 'catalog-card', shown: true, state: null });
  await expect(page.locator('.slot')).toHaveCount(3);
  await expect(page.locator('.slot[data-slot=frame] .swatch[data-material=wood-walnut]')).toHaveAttribute('aria-pressed', 'true');
  expect(await page.evaluate(() => [...document.querySelectorAll('#panel-catalog > *')].map((el) => el.id))).toEqual([
    'catalog-card', 'materials-card', 'add-model-card', 'product-advanced', 'parts-card',
  ]);
});

test('UX-09: rows are numbered per product; a product is selected by a real click on it and from its row', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await roomWithPlaceStep(page);
  await addToRoom(page, 1);
  await addToRoom(page, 2);
  await page.selectOption('#product-select', 'demo-side-table');
  await ready(page);
  await addToRoom(page, 3);
  const [chair1, chair2, table] = (await placements(page)).map((p) => p.id);

  // Two chairs are two rows that can be told apart, each with Delete; nothing is selected yet.
  await expect(page.locator(`${ROWS} .placement-name`)).toHaveText([
    'Lounge chair (demo) 1', 'Lounge chair (demo) 2', 'Side table (demo) 1',
  ]);
  await expect(page.locator(`${ROWS} button[data-action=delete]`)).toHaveCount(3);
  expect(await selection(page)).toEqual({ row: [], outline: null, outlines: 0, hint: IDLE_HINT, state: NEXT_PRODUCT });

  // A real click on chair 2 in the room: its row is the current one, the chair is outlined, the hint gives the keys.
  await clickProduct(page, chair2!);
  await expect(page.locator(`${ROWS}[aria-current]`)).toHaveCount(1);
  expect(await selection(page)).toEqual({
    row: [chair2], outline: chair2, outlines: 1, hint: SELECTED_HINT, state: 'Applies to “Lounge chair (demo) 2”.',
  });
  await expect(page.locator(`${ROWS}:nth-child(2)`)).toHaveAttribute('aria-current', 'true');
  await expect(page.locator(`${ROWS}:nth-child(2) button[data-action^=rotate]`)).toHaveText(['Rotate left', 'Rotate right']);
  await expect(page.locator(`${ROWS}:not([aria-current]) button[data-action^=rotate]`)).toHaveCount(0);
  await expect(page.locator('#stage-hint')).not.toHaveAttribute('data-tool');
  expect((await placements(page)).length).toBe(3); // selecting places nothing

  // A real click on the empty floor lets go of it.
  const empty = await toClient(page, -1.9, 0, 1.5);
  expect(await page.evaluate(({ x, y }) => (window.__rv.viewer() as any).raycastRoom(x, y)?.kind, empty)).toBe('floor');
  await page.mouse.click(empty.x, empty.y);
  expect(await selection(page)).toEqual({ row: [], outline: null, outlines: 0, hint: IDLE_HINT, state: NEXT_PRODUCT });

  // From the list: the row's name selects. The picker holds the side table (two slots) and the
  // Materials card above the list now shows the chair (three): the card grows, and the row that
  // was clicked must still be the one under the pointer, not "Add to room" or another row.
  const cardHeight = () => page.evaluate(() => document.getElementById('materials-card')!.getBoundingClientRect().height);
  const rowAt = (point: { x: number; y: number }) =>
    page.evaluate(({ x, y }) => (document.elementFromPoint(x, y)?.closest('#placement-list li') as HTMLElement | null)?.dataset.placementId ?? null, point);
  const name1 = (await page.locator(`${ROWS}:nth-child(1) .placement-name`).boundingBox())!;
  const pointer = { x: name1.x + name1.width / 2, y: name1.y + name1.height / 2 };
  const heightBefore = await cardHeight();
  await page.mouse.click(pointer.x, pointer.y);
  expect(await selection(page)).toMatchObject({ row: [chair1], outline: chair1, outlines: 1, hint: SELECTED_HINT });
  expect(Math.abs((await cardHeight()) - heightBefore)).toBeGreaterThan(20); // the card did change height
  expect(await rowAt(pointer)).toBe(chair1);
  await page.hover(`${ROWS}:nth-child(3) .placement-name`);
  expect(await selection(page)).toMatchObject({ row: [chair1], outline: table });
  await page.mouse.move(400, 500);
  expect(await selection(page)).toMatchObject({ row: [chair1], outline: chair1 });

  // Esc lets go of the selection. So does the canvas click the handoff's test hook stands in for.
  await page.keyboard.press('Escape');
  expect((await selection(page)).row).toEqual([]);
  await page.evaluate((id) => window.__rv.simulateRoomPointer({ kind: 'placement', placementId: id, point: { x: 0, y: 0.4, z: 0 } }, 'room'), table!);
  expect(await selection(page)).toMatchObject({ row: [table], outline: table, state: 'Applies to “Side table (demo) 1”.' });
  await page.evaluate(() => window.__rv.simulateRoomPointer(null, 'room'));
  expect((await selection(page)).row).toEqual([]);

  // A tool that is switched on takes the canvas: the selection goes. Choosing a row leaves the tool again.
  await page.click(`${ROWS}:nth-child(2) .placement-name`);
  await page.click('#btn-place-mode');
  expect(await selection(page)).toMatchObject({ row: [], outline: null });
  await expect(page.locator('#stage-hint')).toHaveAttribute('data-tool', 'place');
  await page.click(`${ROWS}:nth-child(2) .placement-name`);
  await expect(page.locator('#btn-place-mode')).toHaveAttribute('aria-pressed', 'false');
  expect(await page.evaluate(() => window.__rv.viewer()!.getInteractionMode())).toBe('room');
  expect(await selection(page)).toMatchObject({ row: [chair2], outline: chair2, hint: SELECTED_HINT });

  // Choosing a product in the picker, and leaving the room, let go of it too.
  await page.mouse.move(400, 500); // off the row, which would otherwise keep its product outlined
  await page.selectOption('#product-select', 'demo-lounge-chair');
  await ready(page);
  expect(await selection(page)).toMatchObject({ row: [], outline: null, state: NEXT_PRODUCT });
  await page.click(`${ROWS}:nth-child(2) .placement-name`);
  await page.click(PRODUCT_TOGGLE);
  await page.click(ROOM_TOGGLE);
  expect(await selection(page)).toMatchObject({ row: [], outline: null, hint: IDLE_HINT });

  expect(errors).toEqual([]);
});

test('UX-09: rotate, nudge and delete the selected product by key and by button; Undo reverses each step', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await roomWithPlaceStep(page);
  await addToRoom(page, 1);
  await addToRoom(page, 2);
  const [a, b] = (await placements(page)).map((p) => p.id);
  // "Add to room" put the first chair in the middle of the room and the second on the first free
  // spot beside it (panel-structure.spec.ts pins that search).
  const start = await poseOf(page, b!);
  expect(start).toEqual({ x: -0.75, z: 0, rot: 0, model: { x: -0.75, z: 0, rot: 0 } });
  const expectPose = async (id: string, pose: { x: number; z: number; rot: number }) => {
    const now = await poseOf(page, id);
    expect(now.x).toBeCloseTo(pose.x, 4);
    expect(now.z).toBeCloseTo(pose.z, 4);
    expect(now.rot).toBeCloseTo(pose.rot, 4);
    // The model in the room is where the room graph says.
    expect(now.model!.x).toBeCloseTo(pose.x, 4);
    expect(now.model!.z).toBeCloseTo(pose.z, 4);
    expect(now.model!.rot).toBeCloseTo(pose.rot, 4);
  };

  // Nothing selected: the keys do nothing.
  for (const key of ['r', 'ArrowLeft', 'Delete']) await page.keyboard.press(key);
  expect((await placements(page)).length).toBe(2);
  await expectPose(b!, start);

  // Select chair 2 with a real click, then the keys. Each press is one step.
  await clickProduct(page, b!);
  expect((await selection(page)).row).toEqual([b]);
  await page.keyboard.press('r'); // rotate right: clockwise seen from above
  await expectPose(b!, { ...start, rot: -QUARTER });
  await page.keyboard.press('Shift+R'); // rotate left
  await expectPose(b!, start);
  await page.keyboard.press('ArrowRight'); // 5 cm along the room's x axis
  await expectPose(b!, { ...start, x: start.x + 0.05 });
  await page.keyboard.press('ArrowUp'); // 5 cm along z
  await expectPose(b!, { ...start, x: start.x + 0.05, z: start.z - 0.05 });
  await page.keyboard.press('Shift+ArrowLeft'); // 25 cm
  await expectPose(b!, { ...start, x: start.x - 0.2, z: start.z - 0.05 });
  await page.keyboard.press('Shift+ArrowDown');
  await expectPose(b!, { ...start, x: start.x - 0.2, z: start.z + 0.2 });
  // The same root was moved: nothing was reloaded, and the other chair did not move.
  await expectPose(a!, { x: 0, z: 0, rot: 0 });

  // Undo reverses each of the six steps, one at a time; the chair stays selected.
  const back = [
    { ...start, x: start.x - 0.2, z: start.z - 0.05 },
    { ...start, x: start.x + 0.05, z: start.z - 0.05 },
    { ...start, x: start.x + 0.05 },
    start,
    { ...start, rot: -QUARTER },
    start,
  ];
  for (const pose of back) {
    await undoKey(page);
    await placed(page, 2);
    await expectPose(b!, pose);
  }
  expect((await selection(page)).row).toEqual([b]);

  // The Rotate buttons of the selected row do the same, and keep keyboard focus for the next press.
  await page.click(`${ROWS}[aria-current] button[data-action=rotate-left]`);
  await expectPose(b!, { ...start, rot: QUARTER });
  await expect(page.locator(`${ROWS}[aria-current] button[data-action=rotate-left]`)).toBeFocused();
  await page.keyboard.press('Enter');
  await expectPose(b!, { ...start, rot: Number(Math.PI.toFixed(4)) });
  await page.click(`${ROWS}[aria-current] button[data-action=rotate-right]`);
  await page.click(`${ROWS}[aria-current] button[data-action=rotate-right]`);
  await expectPose(b!, start);

  // A key typed into a field belongs to the field (QA-06's guard).
  await page.click('#room-more-summary');
  await page.fill('#template-title', 'Ward');
  for (const key of ['r', 'ArrowLeft', 'Backspace', 'Delete']) await page.keyboard.press(key);
  expect((await placements(page)).length).toBe(2);
  await expectPose(b!, start);
  expect(await page.inputValue('#template-title')).not.toBe('Ward'); // the field took the keys
  await page.click('#room-more-summary');

  // Moved onto the other chair: allowed, with the soft warning on the stage. Moved away again: the warning goes.
  await page.click(`${ROWS}:nth-child(2) .placement-name`);
  await page.keyboard.press('Shift+ArrowRight');
  await page.keyboard.press('Shift+ArrowRight');
  await expectPose(b!, { ...start, x: -0.25 }); // the first chair stands at x = 0
  await expect(page.locator(TOAST_TEXT)).toHaveText('“Lounge chair (demo) 2” overlaps “Lounge chair (demo) 1”. You can leave it, or move it again.');
  await expect(page.locator(TOAST)).toHaveAttribute('data-kind', 'warning');
  await page.keyboard.press('Shift+ArrowLeft');
  await page.keyboard.press('Shift+ArrowLeft');
  await expectPose(b!, start);
  await expect(page.locator(TOAST)).toHaveAttribute('data-open', 'false');

  // The room's edge: a step that would take the product's floor point outside the room is refused.
  // The room is 4 m deep (z from -2 to 2). Eight 25 cm steps from the middle reach the wall line.
  await page.click(`${ROWS}:nth-child(1) .placement-name`);
  for (let i = 0; i < 8; i++) await page.keyboard.press('Shift+ArrowDown');
  await expectPose(a!, { x: 0, z: 2, rot: 0 });
  await page.keyboard.press('Shift+ArrowDown');
  await expectPose(a!, { x: 0, z: 2, rot: 0 });
  await expect(page.locator(TOAST_TEXT)).toHaveText('That would put “Lounge chair (demo) 1” outside the room, so it stayed where it is.');
  await page.keyboard.press('ArrowDown');
  await expectPose(a!, { x: 0, z: 2, rot: 0 });
  // The refused steps are not in the history: one Undo takes back the last step that happened.
  await undoKey(page);
  await placed(page, 2);
  await expectPose(a!, { x: 0, z: 1.75, rot: 0 });

  // Delete removes the selected product; Undo brings it back. Backspace does the same.
  // (The pointer leaves the list first: a row under it would outline its product, see the test above.)
  await page.mouse.move(400, 500);
  await page.keyboard.press('Delete');
  await expect.poll(async () => (await placements(page)).map((p) => p.id)).toEqual([b]);
  expect(await selection(page)).toMatchObject({ row: [], outlines: 0, hint: IDLE_HINT });
  await expect(page.locator(`${ROWS} .placement-name`)).toHaveText(['Lounge chair (demo) 1']); // the row behind it moved up
  expect(await page.evaluate((id) => !!window.__rv.viewer()!.getPlacementRoot(id), a!)).toBe(false);
  await undoKey(page);
  await placed(page, 2);
  await expect(page.locator(`${ROWS} .placement-name`)).toHaveText(['Lounge chair (demo) 1', 'Lounge chair (demo) 2']);
  await page.click(`${ROWS}:nth-child(2) .placement-name`);
  await page.keyboard.press('Backspace');
  await expect.poll(async () => (await placements(page)).map((p) => p.id)).toEqual([a]);
  await undoKey(page);
  await placed(page, 2);

  // The row's Delete button, on a row that is not selected.
  await page.click(`${ROWS}:nth-child(1) button[data-action=delete]`);
  await expect.poll(async () => (await placements(page)).map((p) => p.id)).toEqual([b]);
  await page.click('#btn-undo');
  await placed(page, 2);
  expect((await placements(page)).map((p) => p.id)).toEqual([a, b]);

  expect(errors).toEqual([]);
});

test('UX-16 step 4: with a placed product selected, the Materials card shows and changes that product; Undo reverses it', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await roomWithPlaceStep(page);
  await addToRoom(page, 1);
  await addToRoom(page, 2);
  // The picker moves on to the other product: the selected placement's product is not the picker's.
  await page.selectOption('#product-select', 'demo-side-table');
  await ready(page);
  await expect(page.locator('#step-place-body .slot')).toHaveCount(2);
  const [chair1, chair2] = (await placements(page)).map((p) => p.id);
  const pressed = () =>
    page.evaluate(() =>
      Object.fromEntries(
        [...document.querySelectorAll<HTMLElement>('#slots .slot')].map((s) => [
          s.dataset.slot,
          s.querySelector<HTMLElement>('.swatch[aria-pressed=true]')?.dataset.material ?? null,
        ]),
      ),
    );

  // Select chair 2 in the room: the card is about it, with the chair's three slots.
  await clickProduct(page, chair2!);
  await expect(page.locator('#materials-state')).toHaveText('Applies to “Lounge chair (demo) 2”.');
  expect(await pressed()).toEqual({ frame: 'wood-oak', handles: 'plastic-black', pillow: 'wool-cream' });
  expect(await page.inputValue('#product-select')).toBe('demo-side-table');

  // A swatch changes that chair, in the room graph and on its model, and nothing else.
  await page.click('.slot[data-slot=frame] .swatch[data-material=wood-walnut]');
  await expect.poll(async () => (await finishOf(page, chair2!)).bySlot.frame, { timeout: 15_000 }).toEqual(['wood-walnut']);
  expect((await placements(page)).map((p) => p.slot_bindings.frame)).toEqual(['wood-oak', 'wood-walnut']);
  expect((await finishOf(page, chair1!)).bySlot).toEqual(CHAIR_DEFAULT);
  expect(await pressed()).toEqual({ frame: 'wood-walnut', handles: 'plastic-black', pillow: 'wool-cream' });
  await expect(page.locator('.slot[data-slot=frame] [data-role=value]')).toHaveText('Walnut');
  await expect(page.locator('.slot[data-slot=frame] .swatch[data-material=wood-walnut]')).toBeFocused();
  expect(await page.evaluate(() => window.__rv.parts()?.productId)).toBe('demo-side-table'); // the turntable was not touched
  expect((await selection(page)).row).toEqual([chair2]);
  // A second slot, straight after.
  await page.click('.slot[data-slot=pillow] .swatch[data-material=wool-forest]');
  await expect.poll(async () => (await finishOf(page, chair2!)).bySlot, { timeout: 15_000 }).toEqual({
    frame: ['wood-walnut'], handles: ['plastic-black'], pillow: ['wool-forest'],
  });

  // Undo takes back one change at a time; Redo puts it back. The card follows the room.
  await page.click('#btn-undo');
  await expect.poll(async () => (await placements(page))[1]!.slot_bindings.pillow).toBe('wool-cream');
  await placed(page, 2);
  await expect.poll(async () => (await finishOf(page, chair2!)).bySlot.pillow, { timeout: 15_000 }).toEqual(['wool-cream']);
  expect((await finishOf(page, chair2!)).bySlot.frame).toEqual(['wood-walnut']);
  expect(await pressed()).toEqual({ frame: 'wood-walnut', handles: 'plastic-black', pillow: 'wool-cream' });
  await page.click('#btn-undo');
  await expect.poll(async () => (await placements(page))[1]!.slot_bindings.frame).toBe('wood-oak');
  await placed(page, 2);
  await expect.poll(async () => (await finishOf(page, chair2!)).bySlot, { timeout: 15_000 }).toEqual(CHAIR_DEFAULT);
  expect(await pressed()).toEqual({ frame: 'wood-oak', handles: 'plastic-black', pillow: 'wool-cream' });
  await page.click('#btn-redo');
  await expect.poll(async () => (await placements(page))[1]!.slot_bindings.frame).toBe('wood-walnut');
  await placed(page, 2);
  await expect.poll(async () => (await finishOf(page, chair2!)).bySlot.frame, { timeout: 15_000 }).toEqual(['wood-walnut']);

  // Nothing selected: the card is back to the picker's product and the next placement.
  await page.keyboard.press('Escape');
  await expect(page.locator('#materials-state')).toHaveText(NEXT_PRODUCT);
  expect(await pressed()).toEqual({ top: 'stone-marble', legs: 'metal-brass' });

  // The changed finish is what the page comes back with.
  await page.reload();
  await ready(page);
  await placed(page, 2);
  expect((await finishOf(page, chair2!)).bySlot.frame).toEqual(['wood-walnut']);
  expect((await finishOf(page, chair1!)).bySlot.frame).toEqual(['wood-oak']);

  expect(errors).toEqual([]);
});

test('Copy §6 C: a room saved with an uploaded model says, after a refresh, that the model was not placed back', async ({ page }) => {
  await page.goto('/');
  await ready(page);
  // A model the user adds lasts for the session only. The side table's GLB stands in for their file.
  const glb = await page.request.get('/assets/models/side-table.glb');
  await page.setInputFiles('#model-files', { name: 'my-table.glb', mimeType: 'model/gltf-binary', buffer: await glb.body() });
  await expect.poll(async () => page.evaluate(() => window.__rv.catalog().products.filter((p) => p.userAdded).length)).toBe(1);
  await ready(page);
  await page.click(ROOM_TOGGLE);
  await page.selectOption('#room-preset', 'living');
  await page.click('#btn-create-room');
  await expect.poll(async () => page.evaluate(() => window.__rv.roomGraph()?.walls.length ?? 0)).toBe(4);
  await page.click('.step[data-step=place] .step-toggle');
  await addToRoom(page, 1);
  await page.selectOption('#product-select', 'demo-lounge-chair');
  await ready(page);
  await addToRoom(page, 2);
  await expect(page.locator(`${ROWS} .placement-name`)).toHaveText(['my-table 1', 'Lounge chair (demo) 1']);
  const [upload, chair] = await placements(page);
  const message = `“${upload!.sku_id}” isn't available after a refresh, so it wasn't placed back. Add the model again to use it.`;

  // Refresh: the uploaded model is gone from the product list; its placement is still in the saved room.
  await page.reload();
  await ready(page);
  await placed(page, 1); // the chair is rebuilt, the upload cannot be
  expect((await placements(page)).map((p) => p.id)).toEqual([upload!.id, chair!.id]);
  await expect(page.locator(TOAST)).toHaveAttribute('data-open', 'false'); // nothing is said over the Product stage

  // Arriving in the room: the stage says so, once.
  await page.click(ROOM_TOGGLE);
  await expect(page.locator(TOAST_TEXT)).toHaveText(message);
  await expect(page.locator(TOAST)).toHaveAttribute('data-kind', 'warning');
  // And the list no longer shows it as if it were in the room: its row carries the same sentence and only Delete.
  await page.click('.step[data-step=place] .step-toggle');
  const missing = page.locator(`${ROWS}.placement-missing`);
  await expect(missing).toHaveCount(1);
  await expect(missing.locator('span')).toHaveText(message);
  await expect(missing.locator('button')).toHaveText(['Delete']);
  await expect(page.locator(`${ROWS}.placement-row .placement-name`)).toHaveText(['Lounge chair (demo) 1']);
  await missing.locator('span').click();
  expect((await selection(page)).row).toEqual([]); // there is nothing in the room to select
  await page.click(`${TOAST} .stage-toast-close`);
  await page.click(PRODUCT_TOGGLE);
  await page.click(ROOM_TOGGLE);
  await page.waitForTimeout(400);
  await expect(page.locator(TOAST)).toHaveAttribute('data-open', 'false'); // not repeated on every visit

  // Its row can be deleted, which takes the placement out of the saved room.
  await page.click('.step[data-step=place] .step-toggle');
  await missing.locator('button[data-action=delete]').click();
  await expect.poll(async () => (await placements(page)).map((p) => p.id)).toEqual([chair!.id]);
  await expect(page.locator(ROWS)).toHaveCount(1);
});
