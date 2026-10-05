/**
 * E2E: the side panel split by workspace and the Room workspace organised by task
 * (UX-07, UX-08, Picker A1 as corrected by QA C15, Picker A2, QA-03, QA-09 tab stops, QA-15 scroll,
 * the two stepper lines of UX-13, and the toast that no longer blocks the canvas).
 *
 * What each test pins:
 *  - only the active workspace's controls are rendered, in every state (the A2 console script)
 *  - Product on arrival: Materials are visible with no panel scroll; the light presets are on the stage
 *  - a workspace switch puts the panel at its top at once
 *  - 375×812: the page does not scroll the 3D view away (QA-03's three conditions)
 *  - the four steps: one open at a time, `aria-current="step"`, focus on the next heading after Create room
 *  - one product picker that travels between the Product card and the "Place products" step
 *  - "Add to room" places inside the room with no pointer, also in an L-shaped room
 *  - the room toolbar: what shows with and without a room
 *  - a real click on the floor under an open toast reaches the room
 * Buttons are used with real pointer or keyboard input. Writes no files.
 */
import { expect, test, type Page } from '@playwright/test';

test.describe.configure({ timeout: 120_000 });

const ready = (page: Page) =>
  expect(page.locator('body')).toHaveAttribute('data-viewer-status', 'ready', { timeout: 30_000 });

const ROOM_TOGGLE = '#workspace-mode button[data-mode=room]';
const PRODUCT_TOGGLE = '#workspace-mode button[data-mode=catalog]';
const TOAST_TEXT = '#stage-toast .stage-toast-text';

async function load(page: Page) {
  await page.goto('/');
  await ready(page);
}

async function createRoom(page: Page) {
  await page.selectOption('#room-preset', 'living');
  await page.click('#btn-create-room');
  await expect.poll(async () => page.evaluate(() => window.__rv.roomGraph()?.walls.length ?? 0)).toBe(4);
}

const openStep = (page: Page, step: 'room' | 'openings' | 'place' | 'finish') =>
  page.click(`.step[data-step=${step}] .step-toggle`);

/**
 * The console script of the picker handoff (A2), unchanged: the ids that are still rendered and
 * must not be. In Product: room creation and room uploads. In Room: product uploads.
 */
const a2 = (page: Page) =>
  page.evaluate(() => {
    const gone = (ids: string[]) =>
      ids.filter((id) => {
        const el = document.getElementById(id);
        return el && el.offsetParent !== null;
      });
    return document.body.dataset.workspace === 'catalog'
      ? gone(['btn-create-room', 'room-preset', 'plan-file', 'btn-import-plan', 'btn-import-fixture', 'project-file',
          'btn-import-project', 'btn-export-project', 'btn-clear-room', 'btn-draw-wall-mode', 'btn-opening-mode',
          'btn-place-mode', 'room-wall-material'])
      : gone(['model-files', 'pack-files', 'module-file', 'texture-file']);
  });

/** Native file inputs on screen, counted as the UX handoff's measurement snippet counts them. */
const visibleFileInputs = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll('input[type=file]')]
      .filter((e) => (e as HTMLElement).offsetParent !== null && getComputedStyle(e).display !== 'none')
      .map((e) => e.id),
  );

/** Tab from the first top-bar control through the whole page; the panel group each stop is in. */
async function tabStops(page: Page) {
  await page.focus(PRODUCT_TOGGLE);
  const stops: (string | null)[] = [];
  for (let i = 0; i < 120; i++) {
    await page.keyboard.press('Tab');
    const stop = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el || el === document.body) return 'END';
      if (el.matches('#workspace-mode button[data-mode=catalog]')) return 'END';
      return (el.closest('[data-workspace-panel]') as HTMLElement | null)?.dataset.workspacePanel ?? null;
    });
    if (stop === 'END') break;
    stops.push(stop);
  }
  return stops;
}

/** Share of the stage (the 3D view) that is inside the viewport, and the page scroll. */
const stageView = (page: Page) =>
  page.evaluate(() => {
    const r = document.querySelector('.stage')!.getBoundingClientRect();
    const visible = Math.max(0, Math.min(innerHeight, r.bottom) - Math.max(0, r.top));
    return { scrollY: Math.round(scrollY), visiblePct: Math.round((visible / r.height) * 100) };
  });

const placements = (page: Page) => page.evaluate(() => window.__rv.roomGraph()?.placements ?? []);

/** Even-odd point-in-polygon, written out here so the test does not lean on the code it checks. */
const onFloor = (page: Page, x: number, z: number) =>
  page.evaluate(
    ([x, z]) => {
      const poly = window.__rv.roomGraph()!.rooms[0]!.floor_polygon;
      let inside = false;
      for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const a = poly[i]!, b = poly[j]!;
        if (a.z > z !== b.z > z && x < ((b.x - a.x) * (z - a.z)) / (b.z - a.z) + a.x) inside = !inside;
      }
      return inside;
    },
    [x, z] as const,
  );

test('only the active workspace is rendered: the A2 check passes in every state, and no tab stop is in the hidden group', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

  await load(page);
  // A fresh load: the first Tab goes to the first control of the top bar (QA-09).
  await page.keyboard.press('Tab');
  await expect(page.locator(PRODUCT_TOGGLE)).toBeFocused();

  // Product, no room.
  await expect(page.locator('body')).toHaveAttribute('data-workspace', 'catalog');
  await expect(page.locator('#panel-catalog')).toBeVisible();
  await expect(page.locator('#panel-room')).toBeHidden();
  expect(await a2(page)).toEqual([]);
  expect(await visibleFileInputs(page)).toEqual(['model-files']);
  expect((await tabStops(page)).filter((group) => group === 'room')).toEqual([]);

  // "Advanced" is closed and holds the texture, pack and module uploads.
  const advanced = page.locator('#product-advanced');
  await expect(advanced.locator('summary')).toHaveText('Advanced');
  await expect(advanced).not.toHaveAttribute('open');
  for (const id of ['texture-file', 'pack-files', 'pack-glb-mate', 'module-file', 'mjs-enabled', 'btn-add-texture']) {
    await expect(page.locator(`#${id}`)).toBeHidden();
  }
  await advanced.locator('summary').click();
  for (const id of ['texture-file', 'pack-files', 'pack-glb-mate', 'module-file', 'mjs-enabled', 'btn-add-texture']) {
    await expect(page.locator(`#${id}`)).toBeVisible();
  }
  await advanced.locator('summary').click();
  expect(await visibleFileInputs(page)).toEqual(['model-files']);

  // Room, no room.
  await page.click(ROOM_TOGGLE);
  await expect(page.locator('#panel-room')).toBeVisible();
  await expect(page.locator('#panel-catalog')).toBeHidden();
  expect(await a2(page)).toEqual([]);
  expect(await visibleFileInputs(page)).toEqual([]); // the plan file input is on the Import plan tab
  await expect(page.locator('#model-files')).toBeHidden();

  // Room, with a room.
  await createRoom(page);
  expect(await a2(page)).toEqual([]);
  const roomStops = await tabStops(page);
  expect(roomStops.filter((group) => group === 'catalog')).toEqual([]);
  expect(roomStops.filter((group) => group === 'room').length).toBeGreaterThan(5);

  // Product while a room exists: none of the room's controls come back.
  await page.click(PRODUCT_TOGGLE);
  expect(await a2(page)).toEqual([]);
  expect(await visibleFileInputs(page)).toEqual(['model-files']);
  expect((await tabStops(page)).filter((group) => group === 'room')).toEqual([]);

  expect(errors).toEqual([]);
});

test('Product on arrival at 1440×900: Materials need no panel scroll, the light presets are on the stage, and a switch starts the panel at its top', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await load(page);
  // The page used to scroll itself for most of a second after `ready`. Measure once that time has passed.
  await page.waitForTimeout(2000);

  // Cold boot lands on Product with the chair's three material slots.
  await expect(page.locator('body')).toHaveAttribute('data-workspace', 'catalog');
  await expect(page.locator('.slot')).toHaveCount(3);
  const arrival = await page.evaluate(() => {
    const panel = document.querySelector('.panel')!;
    const pr = panel.getBoundingClientRect();
    const inView = (el: Element) => {
      const r = el.getBoundingClientRect();
      return r.height > 0 && r.top >= pr.top && r.bottom <= pr.bottom;
    };
    return {
      panelScrollTop: panel.scrollTop,
      pageScrollY: scrollY,
      slotsInView: inView(document.getElementById('slots')!),
      swatchRowsInView: [...document.querySelectorAll('#slots .swatches')].map(inView),
      order: [...document.querySelectorAll('#panel-catalog > *')].map((el) => el.id),
    };
  });
  expect(arrival.panelScrollTop).toBe(0);
  expect(arrival.pageScrollY).toBe(0);
  expect(arrival.slotsInView).toBe(true);
  expect(arrival.swatchRowsInView).toEqual([true, true, true]);
  // Product, Materials, Add 3D model, Advanced, Parts list (UX-07 item 2).
  expect(arrival.order).toEqual(['catalog-card', 'materials-card', 'add-model-card', 'product-advanced', 'parts-card']);
  await expect(page.locator('#model-files')).toBeVisible();

  // The light presets are a stage control, named with the deck's word, in both workspaces.
  const presets = page.locator('.stage-toolbar #presets');
  await expect(presets).toHaveAttribute('aria-label', 'Lighting');
  await expect(presets.locator('button[data-preset]')).toHaveCount(3);
  await expect(page.locator('.panel #presets')).toHaveCount(0);
  await expect(page.locator('.stage-toolbar #btn-remount')).toBeVisible();
  await page.click(ROOM_TOGGLE);
  await expect(presets).toBeVisible();
  await page.click('#presets button[data-preset=warm-interior]');
  expect(await page.evaluate(() => window.__rv.viewer()!.getPresetId())).toBe('warm-interior');
  await page.click(PRODUCT_TOGGLE);

  // A workspace switch puts the panel at its top, at once (UX-07 item 4, QA-15: no animation).
  const panelTop = () => page.evaluate(() => document.querySelector('.panel')!.scrollTop);
  await page.evaluate(() => document.querySelector('.panel')!.scrollTo({ top: 250, behavior: 'instant' }));
  expect(await panelTop()).toBe(250);
  await page.click(ROOM_TOGGLE);
  expect(await panelTop()).toBe(0);
  // Since the copy pass (five paragraphs and three sub-heads gone), the Room panel with no room is
  // exactly as tall as the panel at 1440×900 and cannot scroll at all. The plan review is long:
  // open it, so that there is a scroll position for the switch back to Product to reset.
  await page.click('#room-ingress button[data-ingress=import]');
  await page.click('#btn-import-fixture');
  await expect(page.locator('#import-review')).toBeVisible({ timeout: 10_000 });
  await page.evaluate(() => document.querySelector('.panel')!.scrollTo({ top: 60, behavior: 'instant' }));
  expect(await panelTop()).toBeGreaterThan(0);
  await page.click(PRODUCT_TOGGLE);
  expect(await panelTop()).toBe(0);
});

test.describe('small screen', () => {
  test.use({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });

  test('375×812 (QA-03): the 3D view is on screen on arrival, after Room workspace and after Create room', async ({ page }) => {
    await load(page);
    await page.waitForTimeout(2000);
    // 1. Two seconds after ready: the page has not moved and the canvas is on screen.
    const arrival = await stageView(page);
    expect(arrival.scrollY).toBe(0);
    expect(arrival.visiblePct).toBeGreaterThanOrEqual(90);
    // Materials are reached within a screen and a half of the top (UX §2: "scrolls to reach Material slots").
    // The bottom of the slots is not asserted: since UX-15 gave every swatch a visible name and a
    // 44 px target on touch, it sits at about 1.59 screens (it was 1.37 with bare 34 px swatches).
    const slots = await page.evaluate(() => {
      const r = document.getElementById('slots')!.getBoundingClientRect();
      return { topScreens: (r.top + scrollY) / innerHeight };
    });
    expect(slots.topScreens).toBeLessThan(1.5);

    // 2. After Room workspace.
    await page.tap(ROOM_TOGGLE);
    await expect(page.locator('body')).toHaveAttribute('data-workspace', 'room');
    await page.waitForTimeout(1000);
    expect((await stageView(page)).visiblePct).toBeGreaterThanOrEqual(50);

    // 3. After Create room. The button is below the first screen, so the tap scrolls down to it first.
    await page.selectOption('#room-preset', 'living');
    await page.locator('#btn-create-room').scrollIntoViewIfNeeded();
    expect((await stageView(page)).visiblePct).toBeLessThan(50); // the form really is below the 3D view
    await page.tap('#btn-create-room');
    await expect.poll(async () => page.evaluate(() => window.__rv.roomGraph()?.walls.length ?? 0)).toBe(4);
    await page.waitForTimeout(1000);
    expect((await stageView(page)).visiblePct).toBeGreaterThanOrEqual(50);

    // Back to Product: the 3D view is still on screen.
    await page.tap(PRODUCT_TOGGLE);
    await expect(page.locator('body')).toHaveAttribute('data-workspace', 'catalog');
    await page.waitForTimeout(500);
    expect((await stageView(page)).visiblePct).toBeGreaterThanOrEqual(90);

    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
  });
});

test('the Room workspace is four steps, one open at a time; Create room opens the next step and moves focus to its heading', async ({
  page,
}) => {
  await load(page);
  await page.click(ROOM_TOGGLE);
  const steps = () =>
    page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>('#room-tools .step')].map((step) => ({
        step: step.dataset.step,
        title: step.querySelector('.step-toggle')!.textContent!.replace(/\s+/g, ' ').trim(),
        current: step.getAttribute('aria-current'),
        expanded: step.querySelector('.step-toggle')!.getAttribute('aria-expanded'),
        disabled: (step.querySelector('.step-toggle') as HTMLButtonElement).disabled,
        bodyShown: (step.querySelector('.step-body') as HTMLElement).offsetParent !== null,
      })),
    );

  // No room: #room-tools is there, step 1 is open, and the steps that need a room wait for one.
  await expect(page.locator('#room-tools')).toBeVisible();
  expect(await steps()).toEqual([
    { step: 'room', title: '1 Room', current: 'step', expanded: 'true', disabled: false, bodyShown: true },
    { step: 'openings', title: '2 Openings', current: null, expanded: 'false', disabled: true, bodyShown: false },
    { step: 'place', title: '3 Place products', current: null, expanded: 'false', disabled: true, bodyShown: false },
    { step: 'finish', title: '4 Wall and floor finish', current: null, expanded: 'false', disabled: true, bodyShown: false },
  ]);
  await expect(page.locator('#btn-step-room-change')).toBeHidden();
  await expect(page.locator('#btn-draw-wall-mode')).toBeDisabled(); // it reshapes a room, so it needs one
  // Step 1 holds the create tabs, the form, Units and Draw walls. Save as template is under "More".
  for (const id of ['room-ingress', 'room-units', 'room-preset', 'btn-create-room', 'btn-draw-wall-mode']) {
    await expect(page.locator(`#step-room-body #${id}`)).toBeVisible();
  }
  await expect(page.locator('#room-ingress-scratch #btn-save-template-scratch')).toHaveCount(0);
  await expect(page.locator('#btn-save-template-scratch')).toBeHidden();
  await page.click('#room-more > summary');
  await expect(page.locator('#room-more > summary')).toHaveText('More');
  await expect(page.locator('#btn-save-template-scratch')).toBeVisible();
  await expect(page.locator('#btn-save-template-scratch')).toBeDisabled();
  await page.click('#room-more > summary');

  // The size fields: behind "Adjust size" for a preset, shown as they are for Custom.
  await expect(page.locator('#room-size-adjust > summary')).toHaveText('Adjust size');
  await expect(page.locator('#room-length')).toBeHidden();
  await page.selectOption('#room-preset', 'custom');
  await expect(page.locator('#room-length')).toBeVisible();
  await expect(page.locator('#room-thickness')).toBeVisible();
  await expect(page.locator('#room-size-adjust > summary')).toBeHidden();
  await page.selectOption('#room-preset', 'studio');
  await expect(page.locator('#room-length')).toBeHidden();
  await expect(page.locator('#room-length')).toHaveValue('6');
  // Opened by hand, it stays open when another preset is picked.
  await page.click('#room-size-adjust > summary');
  await expect(page.locator('#room-length')).toBeVisible();
  await page.selectOption('#room-preset', 'living');
  await expect(page.locator('#room-length')).toBeVisible();
  await expect(page.locator('#room-length')).toHaveValue('5');

  // Create room: step 1 folds to its summary with "Change", step 2 opens, focus is on its heading.
  await page.click('#btn-create-room');
  await expect.poll(async () => page.evaluate(() => window.__rv.roomGraph()?.walls.length ?? 0)).toBe(4);
  expect((await steps()).map((s) => [s.step, s.current, s.expanded, s.disabled, s.bodyShown])).toEqual([
    ['room', null, 'false', false, false],
    ['openings', 'step', 'true', false, true],
    ['place', null, 'false', false, false],
    ['finish', null, 'false', false, false],
  ]);
  await expect(page.locator('#room-tools [aria-current="step"]')).toHaveCount(1);
  await expect(page.locator('#step-openings-title')).toBeFocused();
  await expect(page.locator('#room-status')).toBeVisible();
  await expect(page.locator('#room-status')).toContainText('5.00 m × 4.00 m');
  await expect(page.locator('#btn-step-room-change')).toBeVisible();
  await expect(page.locator('#btn-step-room-change')).toHaveText('Change');
  await expect(page.locator('#btn-create-room')).toBeHidden();
  await expect(page.locator('#btn-opening-mode')).toBeVisible();
  // The heading is on screen without scrolling, and so is the room that was just made.
  const view = await page.evaluate(() => {
    const panel = document.querySelector('.panel')!.getBoundingClientRect();
    const title = document.getElementById('step-openings-title')!.getBoundingClientRect();
    return { panelScrollTop: document.querySelector('.panel')!.scrollTop, titleInPanel: title.top >= panel.top && title.bottom <= panel.bottom };
  });
  expect(view).toEqual({ panelScrollTop: 0, titleInPanel: true });

  // One open at a time. A tool that is on is switched off when its step is folded away.
  await page.click('#btn-opening-mode');
  await expect(page.locator('#btn-opening-mode')).toHaveAttribute('aria-pressed', 'true');
  await openStep(page, 'place');
  expect((await steps()).filter((s) => s.bodyShown).map((s) => s.step)).toEqual(['place']);
  await expect(page.locator('#room-tools [aria-current="step"]')).toHaveCount(1);
  await expect(page.locator('.step[data-step=place]')).toHaveAttribute('aria-current', 'step');
  await expect(page.locator('#btn-opening-mode')).toHaveAttribute('aria-pressed', 'false');
  expect(await page.evaluate(() => window.__rv.viewer()!.getInteractionMode())).toBe('room');
  await expect(page.locator('#stage-hint')).not.toHaveAttribute('data-tool');
  // The open step's own heading does nothing: the step stays open.
  await openStep(page, 'place');
  await expect(page.locator('#btn-add-to-room')).toBeVisible();
  // Step 3 holds the picker, the snap option, Add to room, Place product and the list.
  for (const id of ['product-select', 'place-wall-snap', 'btn-add-to-room', 'btn-place-mode']) {
    await expect(page.locator(`#step-place-body #${id}`)).toBeVisible();
  }
  await expect(page.locator('#btn-add-to-room')).toHaveText('Add to room');
  await expect(page.locator('#btn-add-to-room')).toHaveClass(/btn-primary/);
  await expect(page.locator('#btn-place-mode')).not.toHaveClass(/btn-primary/);
  await openStep(page, 'finish');
  await expect(page.locator('#step-finish-body #room-wall-material')).toBeVisible();
  await expect(page.locator('#step-finish-body #room-floor-material')).toBeVisible();
  await expect(page.locator('#btn-add-to-room')).toBeHidden();

  // "Change" reopens step 1 and puts focus on its heading.
  await page.click('#btn-step-room-change');
  await expect(page.locator('.step[data-step=room]')).toHaveAttribute('aria-current', 'step');
  await expect(page.locator('#step-room-title')).toBeFocused();
  await expect(page.locator('#btn-create-room')).toBeVisible();
  await expect(page.locator('#btn-step-room-change')).toBeHidden();
  await expect(page.locator('#btn-draw-wall-mode')).toBeEnabled();

  // Clear room: back to step 1 only.
  await page.click('#btn-clear-room');
  await page.click('dialog.confirm-dialog [data-action="confirm"]');
  await expect.poll(async () => page.evaluate(() => window.__rv.roomGraph())).toBeNull();
  expect((await steps()).map((s) => [s.step, s.current, s.disabled])).toEqual([
    ['room', 'step', false],
    ['openings', null, true],
    ['place', null, true],
    ['finish', null, true],
  ]);

  // A room saved from the last visit: Product on arrival, and the Room workspace opens past step 1.
  await createRoom(page);
  await page.reload();
  await ready(page);
  await expect(page.locator('body')).toHaveAttribute('data-workspace', 'catalog');
  await page.click(ROOM_TOGGLE);
  await expect(page.locator('.step[data-step=openings]')).toHaveAttribute('aria-current', 'step');
  await expect(page.locator('#btn-step-room-change')).toBeVisible();
});

test('one product picker: it is in the Product card in Product and in the Place products step in Room, and keeps its choice', async ({
  page,
}) => {
  await load(page);
  await expect(page.locator('#product-select')).toHaveCount(1);
  await expect(page.locator('#catalog-card #product-picker-slot #product-select')).toBeVisible();

  await page.click(ROOM_TOGGLE);
  await createRoom(page);
  await openStep(page, 'place');
  await expect(page.locator('#product-select')).toHaveCount(1);
  await expect(page.locator('#step-place-body #product-picker-slot #product-select')).toBeVisible();
  await expect(page.locator('#catalog-card #product-select')).toHaveCount(0);
  // No other Product-card control shows in Room (UX-08 done-when). The Materials card is the one
  // exception since UX-16 step 3 (DT6): it travels with the picker, to right under it.
  for (const id of ['product-meta', 'model-files', 'product-advanced', 'parts-list']) {
    await expect(page.locator(`#${id}`)).toBeHidden();
  }
  await expect(page.locator('#step-place-body #materials-card #slots')).toBeVisible();

  // A choice made in the room is the product on the turntable back in Product.
  await page.selectOption('#product-select', 'demo-side-table');
  await expect.poll(async () => page.evaluate(() => window.__rv.parts()?.productId)).toBe('demo-side-table');
  await ready(page);
  await expect(page.locator('#stage-hint')).not.toHaveAttribute('data-tool');
  await page.click(PRODUCT_TOGGLE);
  await expect(page.locator('#catalog-card #product-picker-slot #product-select')).toBeVisible();
  await expect(page.locator('#product-select')).toHaveValue('demo-side-table');
  await expect(page.locator('.slot')).toHaveCount(2);
  await page.selectOption('#product-select', 'demo-lounge-chair');
  await ready(page);
  await expect(page.locator('.slot')).toHaveCount(3);
});

test('Add to room places the selected product inside the room with no pointer: centre first, then a free spot; also from the keyboard', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

  await load(page);
  await page.click(ROOM_TOGGLE);
  await createRoom(page);
  await openStep(page, 'place');

  // First product: the middle of the 5 × 4 m room, and the stage says so.
  await page.click('#btn-add-to-room');
  await expect.poll(async () => (await placements(page)).length, { timeout: 20_000 }).toBe(1);
  const [first] = await placements(page);
  expect(first!.product_id).toBe('demo-lounge-chair');
  expect(Math.hypot(first!.position.x, first!.position.z)).toBeLessThan(0.01);
  await expect(page.locator(TOAST_TEXT)).toHaveText('Placed “Lounge chair (demo)”.');
  await expect(page.locator('#stage-toast')).toHaveAttribute('data-kind', 'success');
  await expect(page.locator('#placement-list li')).toHaveCount(1);
  // The tool was never on: no pointer mode is involved.
  expect(await page.evaluate(() => window.__rv.viewer()!.getInteractionMode())).toBe('room');

  // Second and third: each lands on the floor, clear of the walls and of the ones before it.
  // The third is asked for from the keyboard, and two quick requests do not land on one spot.
  await page.click('#btn-add-to-room');
  await page.focus('#btn-add-to-room');
  await page.keyboard.press('Enter');
  await expect.poll(async () => (await placements(page)).length, { timeout: 30_000 }).toBe(3);
  await expect
    .poll(async () => page.evaluate(() => window.__rv.roomGraph()!.placements.every((p) => !!window.__rv.viewer()!.getPlacementRoot(p.id))), { timeout: 20_000 })
    .toBe(true);
  await expect(page.locator(TOAST_TEXT)).toHaveText('Placed “Lounge chair (demo)”.'); // no overlap warning
  const layout = await page.evaluate(() => {
    const v = window.__rv.viewer()!;
    const g = window.__rv.roomGraph()!;
    const poly = g.rooms[0]!.floor_polygon;
    const xs = poly.map((p) => p.x), zs = poly.map((p) => p.z);
    const boxes = g.placements.map((p) => v.getPlacementFootprint(p.id)!);
    // 2 cm of contact is not an overlap: the same tolerance the app's own collision check has.
    const T = 0.02;
    const overlap = (a: (typeof boxes)[number], b: (typeof boxes)[number]) =>
      a.minX < b.maxX - T && a.maxX > b.minX + T && a.minZ < b.maxZ - T && a.maxZ > b.minZ + T;
    let overlaps = 0;
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) if (overlap(boxes[i]!, boxes[j]!)) overlaps++;
    return {
      overlaps,
      // Whole footprints inside the rectangle of the floor, not only the centres.
      inside: boxes.every((b) => b.minX >= Math.min(...xs) && b.maxX <= Math.max(...xs) && b.minZ >= Math.min(...zs) && b.maxZ <= Math.max(...zs)),
      distinct: new Set(g.placements.map((p) => `${p.position.x.toFixed(3)},${p.position.z.toFixed(3)}`)).size,
    };
  });
  expect(layout).toEqual({ overlaps: 0, inside: true, distinct: 3 });

  // The other product, picked in this step, is the one that is added.
  await page.selectOption('#product-select', 'demo-side-table');
  await expect.poll(async () => page.evaluate(() => window.__rv.parts()?.productId)).toBe('demo-side-table');
  await ready(page);
  await page.click('#btn-add-to-room');
  await expect.poll(async () => (await placements(page)).length, { timeout: 20_000 }).toBe(4);
  expect((await placements(page))[3]!.product_id).toBe('demo-side-table');
  await expect(page.locator(TOAST_TEXT)).toHaveText('Placed “Side table (demo)”.');

  // Undo takes the last one back, as for a product placed with a click.
  await page.click('#btn-undo');
  await expect.poll(async () => (await placements(page)).length).toBe(3);

  expect(errors).toEqual([]);
});

test('Add to room in an L-shaped room: the centre of its bounds is not on the floor, the product still lands on it', async ({ page }) => {
  await load(page);
  await page.click(ROOM_TOGGLE);
  await createRoom(page);

  // Draw an L (6 × 6 m with 2 m wide arms) with the Draw walls tool. The corners go in through the
  // test hook: the point of this test is where Add to room puts the product, not the drawing.
  await page.click('#btn-step-room-change');
  await page.click('#btn-draw-wall-mode');
  await expect(page.locator('#btn-draw-wall-mode')).toHaveAttribute('aria-pressed', 'true');
  await page.evaluate(() => {
    const corners = [[-3, -3], [3, -3], [3, -1], [-1, -1], [-1, 3], [-3, 3], [-3, -3]];
    for (const [x, z] of corners) {
      window.__rv.simulateRoomPointer({ kind: 'floor', point: { x: x!, y: 0, z: z! } }, 'draw-wall');
    }
  });
  await expect.poll(async () => page.evaluate(() => window.__rv.roomGraph()!.walls.length)).toBe(6);
  expect(await onFloor(page, 0, 0)).toBe(false); // the middle of the bounds is outside the L
  expect(await onFloor(page, -2, 0)).toBe(true);

  await openStep(page, 'place');
  for (const n of [1, 2]) {
    await page.click('#btn-add-to-room');
    await expect.poll(async () => (await placements(page)).length, { timeout: 20_000 }).toBe(n);
    await expect(page.locator(TOAST_TEXT)).toHaveText('Placed “Lounge chair (demo)”.'); // on the floor, touching nothing
  }
  for (const p of await placements(page)) expect(await onFloor(page, p.position.x, p.position.z)).toBe(true);
  const [a, b] = await placements(page);
  expect(Math.hypot(a!.position.x - b!.position.x, a!.position.z - b!.position.z)).toBeGreaterThan(0.3);
});

test('the room toolbar: Import project with or without a room; Undo, Redo and Export project only with one; one file input', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await load(page);
  const shown = () =>
    page.evaluate(() =>
      ['btn-undo', 'btn-redo', 'btn-export-project', 'btn-import-project'].filter(
        (id) => document.getElementById(id)!.offsetParent !== null,
      ),
    );

  // Product: no part of the toolbar.
  expect(await shown()).toEqual([]);
  await expect(page.locator('#project-file')).toHaveCount(1);

  // Room, no room: Import project only (QA C15). It opens the one project file input.
  await page.click(ROOM_TOGGLE);
  expect(await shown()).toEqual(['btn-import-project']);
  await expect(page.locator('#room-toolbar #project-file')).toHaveCount(1);
  expect(await page.evaluate(() => getComputedStyle(document.getElementById('project-file')!).display)).toBe('none');
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.click('#btn-import-project')]);
  expect(chooser.isMultiple()).toBe(false);
  expect(await chooser.element().getAttribute('id')).toBe('project-file');
  // The empty-room card's fourth entry uses the same input.
  const [fromCard] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.click('#stage-empty button[data-empty-action=project]'),
  ]);
  expect(await fromCard.element().getAttribute('id')).toBe('project-file');

  // Room with a room: all four. Undo and Redo are there but have nothing to do yet.
  await createRoom(page);
  expect(await shown()).toEqual(['btn-undo', 'btn-redo', 'btn-export-project', 'btn-import-project']);
  await expect(page.locator('#btn-undo')).toBeDisabled();

  // The toolbar stays at the top of the panel while the panel scrolls, so Undo is always in reach.
  await openStep(page, 'place');
  await page.click('#btn-add-to-room');
  await expect.poll(async () => (await placements(page)).length, { timeout: 20_000 }).toBe(1);
  await expect(page.locator('#btn-undo')).toBeEnabled();
  const stuck = await page.evaluate(() => {
    const panel = document.querySelector('.panel')!;
    panel.scrollTo({ top: panel.scrollHeight, behavior: 'instant' });
    const bar = document.getElementById('room-toolbar')!.getBoundingClientRect();
    return { scrolled: panel.scrollTop > 0, barTop: Math.round(bar.top - panel.getBoundingClientRect().top) };
  });
  expect(stuck).toEqual({ scrolled: true, barTop: 0 });
  await page.click('#btn-undo');
  await expect.poll(async () => (await placements(page)).length).toBe(0);
  await page.click('#btn-redo');
  await expect.poll(async () => (await placements(page)).length).toBe(1);
  const [download] = await Promise.all([page.waitForEvent('download'), page.click('#btn-export-project')]);
  expect(download.suggestedFilename()).toMatch(/\.json$/i);

  // Product while the room exists: none of it (Picker A1).
  await page.click(PRODUCT_TOGGLE);
  expect(await shown()).toEqual([]);

  // After Clear room: Import project only again.
  await page.click(ROOM_TOGGLE);
  await page.click('#btn-clear-room');
  await page.click('dialog.confirm-dialog [data-action="confirm"]');
  await expect.poll(async () => page.evaluate(() => window.__rv.roomGraph())).toBeNull();
  expect(await shown()).toEqual(['btn-import-project']);
});

test('an open toast does not block the canvas: a real click on the floor under it places the product, and its close button still works', async ({
  page,
}) => {
  // A narrow stage, where a three-line toast lies over the near corner of the floor.
  await page.setViewportSize({ width: 375, height: 812 });
  await load(page);
  await page.click(ROOM_TOGGLE);
  await createRoom(page);
  await openStep(page, 'place');
  await page.click('#btn-place-mode');
  await expect(page.locator('#btn-place-mode')).toHaveAttribute('aria-pressed', 'true');
  await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
  await page.waitForTimeout(500);

  // A warning toast (12 s): the click outside the room that the hook stands in for.
  await page.evaluate(() => window.__rv.simulateRoomPointer(null, 'place'));
  await expect(page.locator('#stage-toast')).toHaveAttribute('data-open', 'true');
  await expect(page.locator('#stage-toast')).toHaveAttribute('data-kind', 'warning');
  // A point of the toast's text that has the room's floor behind it.
  const target = await page.evaluate(() => {
    const v = window.__rv.viewer() as any;
    const text = document.querySelector('#stage-toast .stage-toast-text')!.getBoundingClientRect();
    for (let j = 0; j < 8; j++) {
      for (let i = 0; i < 16; i++) {
        const x = text.left + ((i + 0.5) / 16) * text.width;
        const y = text.top + ((j + 0.5) / 8) * text.height;
        if (v.raycastRoom(x, y)?.kind === 'floor') return { x, y };
      }
    }
    return null;
  });
  expect(target, 'the toast should lie over part of the floor at this size').not.toBeNull();
  await page.mouse.click(target!.x, target!.y);
  await expect.poll(async () => (await placements(page)).length, { timeout: 20_000 }).toBe(1);

  // The close button is still a button: it closes the toast and the click does not reach the room.
  await expect(page.locator('#stage-toast')).toHaveAttribute('data-open', 'true');
  await page.click('#stage-toast .stage-toast-close');
  await expect(page.locator('#stage-toast')).toHaveAttribute('data-open', 'false');
  await page.waitForTimeout(1200);
  expect((await placements(page)).length).toBe(1);
});
