/**
 * E2E: the small "trust" fixes (UX-01, UX-02 + QA-08, QA-01, QA-06, QA-07, QA-18).
 * Each test is a defect that was reproduced before the fix:
 *  - a room tool could not be switched off, and choosing one reset the camera
 *  - a typed room size was ignored while a preset was selected; switching units did not convert the fields
 *  - Cmd/Ctrl+Z typed in a field undid a room change
 *  - `hidden` was overridden by class rules; disabled buttons looked enabled; room-only buttons worked with no room
 * Tool buttons and the orbit drag use real pointer input (`simulateRoomPointer` skips those code paths).
 * Writes no files.
 */
import { expect, test, type Page } from '@playwright/test';

const ready = (page: Page) =>
  expect(page.locator('body')).toHaveAttribute('data-viewer-status', 'ready', { timeout: 30_000 });

async function openRoomWorkspace(page: Page) {
  await page.goto('/');
  await ready(page);
  await page.click('#workspace-mode button[data-mode=room]');
  await expect(page.locator('body')).toHaveAttribute('data-workspace', 'room');
}

async function createRoom(page: Page, preset?: string) {
  if (preset) await page.selectOption('#room-preset', preset);
  await page.click('#btn-create-room');
  await expect.poll(async () => page.evaluate(() => window.__rv.roomGraph()?.walls.length ?? 0)).toBe(4);
}

const mode = (page: Page) => page.evaluate(() => window.__rv.viewer()!.getInteractionMode());

/** The Room workspace shows one step at a time (UX-08). Open one from its heading; a no-op if it is open. */
const openStep = (page: Page, step: 'room' | 'openings' | 'place' | 'finish') =>
  page.click(`.step[data-step=${step}] .step-toggle`);

/** With a preset selected the size fields are behind "Adjust size" (UX-08 item 4). */
const openAdjustSize = (page: Page) => page.click('#room-size-adjust > summary');

/**
 * Where the camera comes to rest. OrbitControls damping spreads a drag over many frames, so
 * under SwiftShader the camera keeps drifting for seconds after the mouse is released (about
 * 30° after a 100 px drag, measured). Reading it early mistakes that drift for a reset, and
 * waiting for it depends on the frame rate. So run the controls' own per-frame update to the
 * end of the damping first (0.95^400 of the drag is left), then read.
 */
const restingCamera = (page: Page) =>
  page.evaluate(() => {
    const v = window.__rv.viewer() as any;
    for (let i = 0; i < 400; i++) v.controls.update();
    const t = v.controls.target;
    const c = v.camera.position;
    return {
      x: c.x as number,
      y: c.y as number,
      z: c.z as number,
      elevationDeg: (Math.atan2(c.y - t.y, Math.hypot(c.x - t.x, c.z - t.z)) * 180) / Math.PI,
    };
  });

type Cam = Awaited<ReturnType<typeof restingCamera>>;
const moved = (a: Cam, b: Cam) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

const roomSize = (page: Page) =>
  page.evaluate(() => {
    const g = window.__rv.roomGraph()!;
    const p = g.rooms[0]!.floor_polygon;
    return {
      length: Math.abs(p[1]!.x - p[0]!.x),
      width: Math.abs(p[2]!.z - p[1]!.z),
      ceiling: g.rooms[0]!.ceiling_height,
      wallThickness: g.walls[0]!.thickness,
    };
  });

const placementCount = (page: Page) => page.evaluate(() => window.__rv.roomGraph()?.placements.length ?? 0);

test('room tools: a second click switches the tool off, Esc leaves it, and neither a tool nor a tab moves the camera', async ({
  page,
}) => {
  await openRoomWorkspace(page);
  await createRoom(page, 'living');

  // Each tool button is in its own step (UX-08), so the user opens that step first.
  const tools = [
    ['#btn-place-mode', 'place', 'place'],
    ['#btn-opening-mode', 'opening', 'openings'],
    ['#btn-draw-wall-mode', 'draw-wall', 'room'],
  ] as const;

  // Toggle: on, off, on again, off.
  for (const [button, tool, step] of tools) {
    await openStep(page, step);
    await page.click(button);
    await expect(page.locator(button)).toHaveAttribute('aria-pressed', 'true');
    expect(await mode(page)).toBe(tool);
    await page.click(button);
    await expect(page.locator(button)).toHaveAttribute('aria-pressed', 'false');
    expect(await mode(page)).toBe('room');
  }

  // Esc leaves the tool (focus is on the button that was just clicked, not in a field).
  await openStep(page, 'place');
  await page.click('#btn-place-mode');
  expect(await mode(page)).toBe('place');
  await page.keyboard.press('Escape');
  await expect(page.locator('#btn-place-mode')).toHaveAttribute('aria-pressed', 'false');
  expect(await mode(page)).toBe('room');

  // Orbit with a real drag, then choose each tool: the view the user set up must stay.
  const arrival = await restingCamera(page);
  const box = (await page.locator('#viewer-host canvas').boundingBox())!;
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  await page.mouse.move(cx - 40, cy - 60);
  await page.mouse.down();
  await page.mouse.move(cx + 40, cy, { steps: 8 });
  await page.mouse.up();
  const orbited = await restingCamera(page);
  expect(moved(arrival, orbited)).toBeGreaterThan(0.5); // the drag really orbited

  for (const [button, tool, step] of tools) {
    await openStep(page, step); // opening a step must not move the camera either
    await page.click(button);
    expect(await mode(page)).toBe(tool);
    const after = await restingCamera(page);
    expect(Math.abs(after.elevationDeg - orbited.elevationDeg)).toBeLessThan(1);
    expect(moved(orbited, after)).toBeLessThan(0.15);
  }

  // A create-path tab inside the Room workspace keeps the camera and the active tool.
  await page.click('#room-ingress button[data-ingress=template]');
  await expect(page.locator('body')).toHaveAttribute('data-room-ingress', 'template');
  const afterTab = await restingCamera(page);
  expect(Math.abs(afterTab.elevationDeg - orbited.elevationDeg)).toBeLessThan(1);
  expect(moved(orbited, afterTab)).toBeLessThan(0.15);
  expect(await mode(page)).toBe('draw-wall');

  // Product → Room is a real workspace change: the room is framed again (the arrival view).
  await page.click('#workspace-mode button[data-mode=catalog]');
  await expect(page.locator('body')).toHaveAttribute('data-workspace', 'catalog');
  await page.click('#workspace-mode button[data-mode=room]');
  await expect(page.locator('body')).toHaveAttribute('data-workspace', 'room');
  const reframed = await restingCamera(page);
  expect(moved(arrival, reframed)).toBeLessThan(0.15);
  expect(await mode(page)).toBe('room');
});

test('room size: the fields win over the preset, and typing in one flips the preset to Custom', async ({ page }) => {
  await openRoomWorkspace(page);
  await expect(page.locator('#room-preset')).toHaveValue('small-bedroom');

  // A preset is selected, so the fields are behind "Adjust size": open it, then type.
  await expect(page.locator('#room-length')).toBeHidden();
  await openAdjustSize(page);
  await page.fill('#room-length', '6');
  await expect(page.locator('#room-preset')).toHaveValue('custom');
  // Custom shows the fields as they are, with no "Adjust size" to open.
  await expect(page.locator('#room-length')).toBeVisible();
  await expect(page.locator('#room-size-adjust > summary')).toBeHidden();

  await createRoom(page);
  const size = await roomSize(page);
  expect(size.length).toBe(6);
  expect(size.width).toBe(3);
  expect(size.ceiling).toBe(2.7);
  await expect(page.locator('#room-status')).toContainText('6.00 m × 3.00 m');
  await expect(page.locator('#room-preset')).toHaveValue('custom');
});

test('room units: switching to cm converts the fields and their limits; the walls are still 0.12 m thick', async ({
  page,
}) => {
  await openRoomWorkspace(page);
  const fields = () =>
    page.evaluate(() =>
      ['room-length', 'room-width', 'room-ceiling', 'room-thickness', 'opening-width', 'opening-height', 'opening-sill'].map(
        (id) => {
          const el = document.getElementById(id) as HTMLInputElement;
          return `${id} ${el.value} min ${el.min} step ${el.step}`;
        },
      ),
    );
  const metres = await fields();
  expect(metres).toEqual([
    'room-length 3 min 0.5 step 0.1',
    'room-width 3 min 0.5 step 0.1',
    'room-ceiling 2.7 min 0.5 step 0.1',
    'room-thickness 0.12 min 0.05 step 0.01',
    'opening-width 0.9 min 0.2 step 0.05',
    'opening-height 2.1 min 0.2 step 0.05',
    'opening-sill 0 min 0 step 0.05',
  ]);

  await page.selectOption('#room-units', 'cm');
  expect(await fields()).toEqual([
    'room-length 300 min 50 step 10',
    'room-width 300 min 50 step 10',
    'room-ceiling 270 min 50 step 10',
    'room-thickness 12 min 5 step 1',
    'opening-width 90 min 20 step 5',
    'opening-height 210 min 20 step 5',
    'opening-sill 0 min 0 step 5',
  ]);
  // Converting is not typing: the preset the user chose is still selected.
  await expect(page.locator('#room-preset')).toHaveValue('small-bedroom');

  await createRoom(page);
  expect(await roomSize(page)).toEqual({ length: 3, width: 3, ceiling: 2.7, wallThickness: 0.12 });

  // Feet and back: the numbers return to where they started.
  // Units is in step 1, which folded to its summary when the room was created: "Change" reopens it.
  await page.click('#btn-step-room-change');
  await page.selectOption('#room-units', 'ft-in');
  await expect(page.locator('#room-length')).toHaveValue('9.84252');
  await page.selectOption('#room-units', 'm');
  expect(await fields()).toEqual(metres);
});

test('Cmd/Ctrl+Z typed in a field undoes the typing, not the room', async ({ page }) => {
  await openRoomWorkspace(page);
  await createRoom(page, 'living');

  // Two placed products. The test hook is enough here: the path under test is the keyboard.
  for (const [n, x, z] of [
    [1, 0.6, -0.4],
    [2, -1, 0.5],
  ] as const) {
    await page.evaluate(
      ({ x, z }) => window.__rv.simulateRoomPointer({ kind: 'floor', point: { x, y: 0, z } }, 'place'),
      { x, z },
    );
    await expect.poll(() => placementCount(page), { timeout: 15_000 }).toBe(n);
  }

  // The Length field: step 1 ("Change"), then "Adjust size" (the Living preset is selected).
  await page.click('#btn-step-room-change');
  await openAdjustSize(page);
  await page.click('#room-length');
  await page.keyboard.press('End');
  await page.keyboard.type('9');
  await expect(page.locator('#room-length')).toHaveValue('59');
  await page.keyboard.press('ControlOrMeta+z');
  await page.waitForTimeout(400);
  expect(await placementCount(page)).toBe(2);
  await expect(page.locator('#room-status')).not.toContainText('Undid');
  await expect(page.locator('#room-length')).toHaveValue('5'); // the field undid its own text

  // Outside a field the shortcut still undoes the last room change.
  await page.click('.brand');
  await page.keyboard.press('ControlOrMeta+z');
  await expect.poll(() => placementCount(page)).toBe(1);
});

test('nothing marked hidden is displayed, and room-only buttons wait for a room', async ({ page }) => {
  await page.goto('/');
  await ready(page);
  const hiddenButDisplayed = () =>
    page.evaluate(() =>
      [...document.querySelectorAll('[hidden]')]
        .filter((el) => getComputedStyle(el).display !== 'none')
        .map((el) => el.id || el.tagName),
    );
  // "Target material" follows the map role: hidden for a new base-colour material, shown for normal / roughness.
  const targetDisplay = (role: string) =>
    page.evaluate((role) => {
      const select = document.getElementById('texture-role') as HTMLSelectElement;
      select.value = role;
      select.dispatchEvent(new Event('change'));
      return getComputedStyle(document.getElementById('texture-target-wrap')!).display;
    }, role);

  expect(await hiddenButDisplayed()).toEqual([]); // fresh Product
  expect(await targetDisplay('normalMap')).not.toBe('none');
  expect(await targetDisplay('roughnessMap')).not.toBe('none');
  expect(await targetDisplay('map')).toBe('none');

  await page.click('#workspace-mode button[data-mode=room]');
  expect(await hiddenButDisplayed()).toEqual([]); // Room, no room yet
  await expect(page.locator('#btn-download-plan')).toBeHidden();
  await expect(page.locator('#btn-clear-room')).toBeDisabled();
  await expect(page.locator('#btn-save-template-scratch')).toBeDisabled();
  // A disabled button must not look like an enabled one.
  const disabledLook = await page.evaluate(() => {
    const s = getComputedStyle(document.getElementById('btn-clear-room')!);
    return { opacity: Number(s.opacity), cursor: s.cursor };
  });
  expect(disabledLook.opacity).toBeLessThan(1);
  expect(disabledLook.cursor).not.toBe('pointer');

  await page.click('#room-ingress button[data-ingress=import]');
  expect(await hiddenButDisplayed()).toEqual([]); // Import tab

  await page.click('#room-ingress button[data-ingress=scratch]');
  await createRoom(page, 'living');
  expect(await hiddenButDisplayed()).toEqual([]); // Room with a room
  await expect(page.locator('#btn-download-plan')).toBeVisible();
  await expect(page.locator('#btn-clear-room')).toBeEnabled();
  await expect(page.locator('#btn-save-template-scratch')).toBeEnabled();
});
