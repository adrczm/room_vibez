/**
 * E2E: feedback where the user is looking, and guards before work is lost
 * (UX-03, UX-04, UX-06 host part, QA-02 host part, QA-04, and two defects found on the way).
 * Each test is a defect that was reproduced before the fix:
 *  - Clear room, replacing a room and Delete template destroyed work with no question, and Clear
 *    sent the user to the Product workspace
 *  - a cleared room came back after a reload when the project had been exported
 *  - a missed click in Place mode was answered in the side panel, far from the canvas; the tool
 *    buttons renamed themselves
 *  - the Room workspace with no room showed the demo chair and the orbit hint
 *  - "Import project" could not be reached until a room existed
 *  - a floor point outside the room could still be placed on through `placeCurrentProduct`
 *  - choosing only a wall finish turned the floor white
 * Canvas clicks and tool buttons use real pointer input unless a line says why not.
 * Writes no files (downloads stay in Playwright's own temporary folder).
 */
import { expect, test, type Page } from '@playwright/test';

test.describe.configure({ timeout: 120_000 });

const CONFIRM = 'dialog.confirm-dialog [data-action="confirm"]';
const CANCEL = 'dialog.confirm-dialog [data-action="cancel"]';
const TOAST_TEXT = '#stage-toast .stage-toast-text';

const ready = (page: Page) =>
  expect(page.locator('body')).toHaveAttribute('data-viewer-status', 'ready', { timeout: 30_000 });

async function openRoomWorkspace(page: Page) {
  await page.goto('/');
  await ready(page);
  await page.click('#workspace-mode button[data-mode=room]');
  await expect(page.locator('body')).toHaveAttribute('data-workspace', 'room');
}

async function createRoom(page: Page) {
  await page.selectOption('#room-preset', 'living');
  await page.click('#btn-create-room');
  await expect.poll(async () => page.evaluate(() => window.__rv.roomGraph()?.walls.length ?? 0)).toBe(4);
  await page.waitForTimeout(500);
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

/** Midpoint of a wall the cutaway has left standing (the far walls on arrival). */
const standingWall = (page: Page) =>
  page.evaluate(() => {
    const v = window.__rv.viewer() as any;
    const g = window.__rv.roomGraph()!;
    const id = [...v.roomBuilt.wallMeshes].find(([, m]: any) => m.visible)![0] as string;
    const w = g.walls.find((x) => x.id === id)!;
    return { id, x: (w.a.x + w.b.x) / 2, z: (w.a.z + w.b.z) / 2 };
  });

const counts = (page: Page) =>
  page.evaluate(() => {
    const g = window.__rv.roomGraph();
    return g ? { placements: g.placements.length, openings: g.openings.length } : null;
  });

const stage = (page: Page) =>
  page.evaluate(() => {
    const v = window.__rv.viewer() as any;
    return {
      workspace: document.body.dataset.workspace,
      mode: v.getInteractionMode() as string,
      turntable: v.turntable.visible as boolean,
      room: (v.roomBuilt?.root?.visible ?? null) as boolean | null,
    };
  });

/** One product and one door, put there through the test hook (these tests are about what follows). */
async function addProductAndDoor(page: Page) {
  await page.evaluate(() => {
    const g = window.__rv.roomGraph()!;
    const wall = g.walls[0]!;
    window.__rv.simulateRoomPointer(
      { kind: 'wall', wallId: wall.id, offsetAlongWall: 1.5, point: { x: 0, y: 1, z: wall.a.z } },
      'opening',
    );
    window.__rv.simulateRoomPointer({ kind: 'floor', point: { x: 0.6, y: 0, z: -0.4 } }, 'place');
  });
  await expect.poll(() => counts(page), { timeout: 15_000 }).toEqual({ placements: 1, openings: 1 });
}

/** Is the copy of the project that Export leaves in IndexedDB still there? */
const exportCopyInIdb = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<boolean>((resolve) => {
        const open = indexedDB.open('catalog3d-local', 1);
        open.onerror = () => resolve(false);
        open.onsuccess = () => {
          const db = open.result;
          if (!db.objectStoreNames.contains('kv')) {
            db.close();
            resolve(false);
            return;
          }
          const get = db.transaction('kv').objectStore('kv').get('project');
          get.onsuccess = () => {
            db.close();
            resolve(get.result != null);
          };
          get.onerror = () => resolve(false);
        };
      }),
  );

test('Room workspace with no room: empty stage, a card with four ways to start, the right hint; Product is unaffected', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

  await page.goto('/');
  await ready(page);
  expect(await stage(page)).toMatchObject({ workspace: 'catalog', mode: 'catalog', turntable: true });
  await expect(page.locator('#stage-empty')).toBeHidden();
  await expect(page.locator('#stage-hint')).toHaveText('Drag to spin · scroll to zoom · right-drag to pan');

  await page.click('#workspace-mode button[data-mode=room]');
  // No chair on the stage, a card over it, and the hint for this state (deck §3.3).
  expect(await stage(page)).toMatchObject({ workspace: 'room', mode: 'room', turntable: false, room: null });
  await expect(page.locator('#stage-empty')).toBeVisible();
  await expect(page.locator('#stage-hint')).toHaveText('Create or import a room to start.');
  await expect(page.locator('#stage-hint')).not.toHaveAttribute('data-tool');
  const entries = page.locator('#stage-empty button[data-empty-action]');
  await expect(entries).toHaveCount(4);
  expect(await entries.evaluateAll((els) => els.map((b) => (b as HTMLElement).dataset.emptyAction))).toEqual([
    'scratch',
    'import',
    'template',
    'project',
  ]);
  for (const text of await entries.allTextContents()) expect(text.trim()).not.toBe('');
  // The card lies inside the stage and covers neither the stage toolbar nor the hint.
  const layout = await page.evaluate(() => {
    const rect = (sel: string) => document.querySelector(sel)!.getBoundingClientRect();
    const card = rect('.stage-empty-card'), st = rect('.stage'), toolbar = rect('.stage-toolbar'), hint = rect('#stage-hint');
    return {
      inside: card.left >= st.left && card.right <= st.right && card.top >= st.top && card.bottom <= st.bottom,
      belowToolbar: card.top >= toolbar.bottom,
      aboveHint: card.bottom <= hint.top,
    };
  });
  expect(layout).toEqual({ inside: true, belowToolbar: true, aboveHint: true });

  // The three starts open their form in the panel. There is still no room, so the card stays.
  for (const start of ['import', 'template', 'scratch'] as const) {
    await page.click(`#stage-empty button[data-empty-action=${start}]`);
    await expect(page.locator('body')).toHaveAttribute('data-room-ingress', start);
    await expect(page.locator(`#room-ingress-${start}`)).toBeVisible();
    await expect(page.locator(`#room-ingress button[data-ingress=${start}]`)).toHaveAttribute('aria-checked', 'true');
    await expect(page.locator(`#room-ingress button[data-ingress=${start}]`)).toBeFocused();
    await expect(page.locator('#stage-empty')).toBeVisible();
  }

  // The fourth entry opens the project file picker (QA-04). The panel's own button needs a room.
  await expect(page.locator('#btn-import-project')).toBeHidden();
  const [chooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.click('#stage-empty button[data-empty-action=project]'),
  ]);
  expect(chooser.isMultiple()).toBe(false);

  // Product still shows the product.
  await page.click('#workspace-mode button[data-mode=catalog]');
  expect(await stage(page)).toMatchObject({ workspace: 'catalog', mode: 'catalog', turntable: true });
  await expect(page.locator('#stage-empty')).toBeHidden();
  await expect(page.locator('#stage-hint')).toHaveText('Drag to spin · scroll to zoom · right-drag to pan');

  // With a room the card is gone and the hint is the idle one.
  await page.click('#workspace-mode button[data-mode=room]');
  await createRoom(page);
  await expect(page.locator('#stage-empty')).toBeHidden();
  await expect(page.locator('#stage-hint')).toHaveText('Drag to orbit · scroll to zoom · right-drag to pan');
  expect(await stage(page)).toMatchObject({ mode: 'room', turntable: false, room: true });

  expect(errors).toEqual([]);
});

test('Clear room asks first: Keep room changes nothing; confirming empties the room, stays in Room, and a reload after an Export stays empty', async ({
  page,
}) => {
  await openRoomWorkspace(page);
  await createRoom(page);
  await addProductAndDoor(page);

  // Export leaves a copy of the project in IndexedDB. Boot falls back to that copy when no room is saved.
  const [download] = await Promise.all([page.waitForEvent('download'), page.click('#btn-export-project')]);
  expect(download.suggestedFilename()).toMatch(/\.json$/i);
  await expect.poll(() => exportCopyInIdb(page)).toBe(true);

  // The button is no longer a full-width button under the primary one.
  const button = await page.evaluate(() => {
    const clear = document.getElementById('btn-clear-room')!.getBoundingClientRect();
    const create = document.getElementById('btn-create-room')!.getBoundingClientRect();
    return { narrower: clear.width < create.width * 0.6, gap: clear.top - create.bottom };
  });
  expect(button.narrower).toBe(true);
  expect(button.gap).toBeGreaterThan(100);

  // Ask, with the counts (deck §5).
  await page.click('#btn-clear-room');
  const dialog = page.locator('dialog.confirm-dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('.app-dialog-title')).toHaveText('Clear this room?');
  await expect(dialog.locator('.confirm-body')).toContainText('1 opening and 1 placed product');
  await expect(dialog.locator('.confirm-body')).toContainText("You can't undo it.");
  await expect(page.locator(CONFIRM)).toHaveText('Clear room');
  await expect(page.locator(CANCEL)).toHaveText('Keep room');
  expect(await counts(page)).toEqual({ placements: 1, openings: 1 }); // nothing happens before the answer

  // Keep room: nothing changes, undo history included.
  await page.click(CANCEL);
  await expect(dialog).toHaveCount(0);
  expect(await counts(page)).toEqual({ placements: 1, openings: 1 });
  await expect(page.locator('#btn-undo')).toBeEnabled();
  await expect(page.locator('body')).toHaveAttribute('data-workspace', 'room');
  expect(await exportCopyInIdb(page)).toBe(true);
  // Esc is "Keep room" too.
  await page.click('#btn-clear-room');
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  expect(await counts(page)).toEqual({ placements: 1, openings: 1 });

  // Clear room: the room is gone and the user is still in the Room workspace, on its empty state.
  await page.click('#btn-clear-room');
  await page.click(CONFIRM);
  await expect.poll(() => counts(page)).toBeNull();
  await expect(page.locator('body')).toHaveAttribute('data-workspace', 'room');
  await expect(page.locator('#stage-empty')).toBeVisible();
  await expect(page.locator('#stage-hint')).toHaveText('Create or import a room to start.');
  expect(await stage(page)).toMatchObject({ mode: 'room', turntable: false, room: null });
  expect(await page.evaluate(() => (window.__rv.viewer() as any).placementsRoot.children.length)).toBe(0);
  expect(await page.evaluate(() => localStorage.getItem('catalog3d.roomGraph'))).toBeNull();
  await expect(page.locator('#stage-empty button[data-empty-action=scratch]')).toBeFocused();

  // The exported copy is cleared with the room, so the room does not come back.
  await expect.poll(() => exportCopyInIdb(page)).toBe(false);
  await page.reload();
  await ready(page);
  expect(await page.evaluate(() => window.__rv.roomGraph())).toBeNull();
  await page.click('#workspace-mode button[data-mode=room]');
  await expect(page.locator('#stage-empty')).toBeVisible();
});

test('replacing a room that has work in it asks first; an untouched room is replaced without a question; Delete template asks', async ({
  page,
}) => {
  await openRoomWorkspace(page);
  await createRoom(page);
  const dialog = page.locator('dialog.confirm-dialog');

  // A room with nothing in it and no history: Create room again just replaces it.
  await page.click('#btn-create-room');
  await page.waitForTimeout(300);
  await expect(dialog).toHaveCount(0);
  expect(await counts(page)).toEqual({ placements: 0, openings: 0 });

  await addProductAndDoor(page);

  // Create room over it.
  await page.click('#btn-create-room');
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('.app-dialog-title')).toHaveText('Replace your current room?');
  await expect(dialog.locator('.confirm-body')).toContainText('its 1 placed product will be replaced');
  await expect(page.locator(CONFIRM)).toHaveText('Replace room');
  await expect(page.locator(CANCEL)).toHaveText('Keep current room');
  await page.click(CANCEL);
  expect(await counts(page)).toEqual({ placements: 1, openings: 1 });

  // A size that cannot make a room is reported first. There is nothing to confirm yet.
  await page.fill('#room-length', '0');
  await page.click('#btn-create-room');
  await page.waitForTimeout(300);
  await expect(dialog).toHaveCount(0);
  await expect(page.locator('#room-status')).toHaveClass(/error/);
  await page.fill('#room-length', '5');

  // Use template over it. Saving the template itself replaces nothing.
  await page.fill('#template-title', 'Guard test');
  await page.click('#btn-save-template-scratch');
  await expect(page.locator('#template-list li')).toHaveCount(1);
  await page.locator('#template-list li button').first().click();
  await expect(dialog.locator('.app-dialog-title')).toHaveText('Replace your current room?');
  await page.click(CANCEL);
  expect(await counts(page)).toEqual({ placements: 1, openings: 1 });

  // Create room from plan over it (the built-in sample).
  await page.click('#room-ingress button[data-ingress=import]');
  await page.click('#btn-import-fixture');
  await expect(page.locator('#import-review')).toBeVisible({ timeout: 10_000 });
  await page.click('#btn-import-start-editing');
  await expect(dialog.locator('.app-dialog-title')).toHaveText('Replace your current room?');
  await page.click(CANCEL);
  expect(await counts(page)).toEqual({ placements: 1, openings: 1 });
  expect(await page.evaluate(() => window.__rv.roomGraph()!.provenance.kind)).toBe('authored');

  // Delete template: Keep template keeps it, Delete template removes it.
  await page.click('#room-ingress button[data-ingress=template]');
  await page.locator('#template-list li button', { hasText: 'Delete' }).click();
  await expect(dialog.locator('.app-dialog-title')).toHaveText('Delete “Guard test”?');
  await expect(page.locator(CONFIRM)).toHaveText('Delete template');
  await page.click(CANCEL);
  await expect(page.locator('#template-list li')).toHaveCount(1);
  await page.locator('#template-list li button', { hasText: 'Delete' }).click();
  await page.click(CONFIRM);
  await expect(page.locator('#template-list li')).toHaveCount(0);

  // Replace room: confirmed this time.
  await page.click('#room-ingress button[data-ingress=scratch]');
  await page.click('#btn-create-room');
  await page.click(CONFIRM);
  await expect.poll(() => counts(page)).toEqual({ placements: 0, openings: 0 });
  await expect(page.locator('#btn-undo')).toBeDisabled();
  await expect(page.locator('body')).toHaveAttribute('data-workspace', 'room');
});

test('Place mode answers on the stage: fixed tool labels, a state chip, a toast for a missed click, and nothing is placed outside the room', async ({
  page,
}) => {
  await openRoomWorkspace(page);
  await createRoom(page);
  const hint = page.locator('#stage-hint');
  const toast = page.locator('#stage-toast');
  const placements = () => page.evaluate(() => window.__rv.roomGraph()!.placements.length);
  const summary = await page.locator('#room-status').textContent();

  // The tool buttons keep their labels. State is aria-pressed plus the hint on the canvas.
  const labels = () =>
    page.evaluate(() =>
      ['btn-opening-mode', 'btn-place-mode', 'btn-draw-wall-mode'].map((id) => document.getElementById(id)!.textContent),
    );
  expect(await labels()).toEqual(['Add opening', 'Place product', 'Draw walls']);
  await expect(hint).not.toHaveAttribute('data-tool');
  await page.click('#btn-place-mode');
  await expect(page.locator('#btn-place-mode')).toHaveAttribute('aria-pressed', 'true');
  expect(await labels()).toEqual(['Add opening', 'Place product', 'Draw walls']);
  await expect(hint).toHaveAttribute('data-tool', 'place');
  await expect(hint).toHaveText('Click the floor to place “Lounge chair (demo)”.');
  expect(await hint.evaluate((el) => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(12);

  // The hook the handoff names: a null hit in Place mode shows a toast on the stage.
  await page.evaluate(() => window.__rv.simulateRoomPointer(null, 'place'));
  await expect(toast).toHaveAttribute('data-open', 'true');
  await expect(page.locator(TOAST_TEXT)).not.toHaveText('');
  const outsideMessage = await page.locator(TOAST_TEXT).textContent();
  const where = await page.evaluate(() => {
    const t = document.getElementById('stage-toast')!.getBoundingClientRect();
    const st = document.querySelector('.stage')!.getBoundingClientRect();
    return {
      insideStage: t.left >= st.left && t.right <= st.right && t.top >= st.top && t.bottom <= st.bottom,
      inViewport: t.top >= 0 && t.bottom <= innerHeight,
    };
  });
  expect(where).toEqual({ insideStage: true, inViewport: true });
  // One announcer per message: the panel line still holds the room summary.
  await expect(page.locator('#room-status')).toHaveText(summary!);
  await page.click('#stage-toast .stage-toast-close');
  await expect(toast).toHaveAttribute('data-open', 'false');

  // A real click on the empty stage: nothing is placed and the same message appears (QA-02, D-QA1).
  const box = (await page.locator('#viewer-host canvas').boundingBox())!;
  const voidPoint = { x: box.x + box.width - 40, y: box.y + box.height - 60 };
  expect(await page.evaluate(({ x, y }) => (window.__rv.viewer() as any).raycastRoom(x, y), voidPoint)).toBeNull();
  await page.mouse.click(voidPoint.x, voidPoint.y);
  await expect(page.locator(TOAST_TEXT)).toHaveText(outsideMessage!);
  await expect(toast).toHaveAttribute('data-kind', 'warning');
  await page.waitForTimeout(1200);
  expect(await placements()).toBe(0);

  // A real click on a wall: the deck's message for it.
  const wall = await standingWall(page);
  const wallPx = await toClient(page, wall.x, 1.3, wall.z);
  expect(await page.evaluate(({ x, y }) => (window.__rv.viewer() as any).raycastRoom(x, y)?.kind, wallPx)).toBe('wall');
  await page.mouse.click(wallPx.x, wallPx.y);
  await expect(page.locator(TOAST_TEXT)).toHaveText('Click the floor inside the room.');
  expect(await placements()).toBe(0);

  // A floor point outside the room cannot be placed on by any path: the guard is in placeCurrentProduct.
  // (The hook is the only way to hand it such a point; the canvas never produces one.)
  await page.click('#stage-toast .stage-toast-close');
  await page.evaluate(() =>
    window.__rv.simulateRoomPointer({ kind: 'floor', point: { x: -0.48, y: 0, z: 3.74 } }, 'place'),
  );
  await expect(page.locator(TOAST_TEXT)).toHaveText(outsideMessage!);
  await page.waitForTimeout(1500);
  expect(await placements()).toBe(0);

  // A real click on the floor places the product and says so on the stage.
  const floorPx = await toClient(page, 0.8, 0, -0.5);
  await page.mouse.click(floorPx.x, floorPx.y);
  await expect.poll(placements, { timeout: 15_000 }).toBe(1);
  await expect(page.locator(TOAST_TEXT)).toHaveText('Placed “Lounge chair (demo)”.');
  await expect(toast).toHaveAttribute('data-kind', 'success');
  await expect(page.locator('#room-status')).not.toContainText('Placed');

  // The same spot again: allowed, with the overlap warning.
  await page.mouse.click(floorPx.x, floorPx.y);
  await expect.poll(placements, { timeout: 15_000 }).toBe(2);
  await expect(page.locator(TOAST_TEXT)).toContainText('It overlaps “Lounge chair (demo)”.');
  await expect(toast).toHaveAttribute('data-kind', 'warning');

  // Undo is said on the stage as well.
  await page.click('.brand');
  await page.keyboard.press('ControlOrMeta+z');
  await expect.poll(placements).toBe(1);
  await expect(page.locator(TOAST_TEXT)).toHaveText('Undid last change.');
  await expect(page.locator('#room-status')).not.toContainText('Undid');

  // Esc leaves the tool: the chip is gone, the idle hint is back, the labels never moved.
  await page.keyboard.press('Escape');
  await expect(page.locator('#btn-place-mode')).toHaveAttribute('aria-pressed', 'false');
  await expect(hint).not.toHaveAttribute('data-tool');
  await expect(hint).toHaveText('Drag to orbit · scroll to zoom · right-drag to pan');
  expect(await labels()).toEqual(['Add opening', 'Place product', 'Draw walls']);

  // The opening tool names the type it will add.
  await page.click('#btn-opening-mode');
  await expect(hint).toHaveAttribute('data-tool', 'opening');
  await expect(hint).toHaveText('Click a wall to add a door.');
  await page.click('#opening-type button[data-type=window]');
  await expect(hint).toHaveText('Click a wall to add a window.');
});

test('a project file can be opened in the Room workspace before any room exists, and its placed product comes back', async ({
  page,
  browser,
  baseURL,
}) => {
  // Someone exports a project that has one placed product (placed with a real click).
  await openRoomWorkspace(page);
  await createRoom(page);
  await page.click('#btn-place-mode');
  const floorPx = await toClient(page, 0.8, 0, -0.5);
  await page.mouse.click(floorPx.x, floorPx.y);
  await expect.poll(() => counts(page), { timeout: 15_000 }).toEqual({ placements: 1, openings: 0 });
  const [download] = await Promise.all([page.waitForEvent('download'), page.click('#btn-export-project')]);
  const file = await download.path();

  // They open the app in another browser (a fresh profile) and go to the Room workspace.
  const context = await browser.newContext({ baseURL });
  const other = await context.newPage();
  try {
    await openRoomWorkspace(other);
    expect(await other.evaluate(() => window.__rv.roomGraph())).toBeNull();
    const [chooser] = await Promise.all([
      other.waitForEvent('filechooser'),
      other.click('#stage-empty button[data-empty-action=project]'),
    ]);
    await chooser.setFiles(file);
    await expect.poll(() => counts(other), { timeout: 15_000 }).toEqual({ placements: 1, openings: 0 });
    // The product is back in the scene, not only in the data.
    await expect
      .poll(
        async () =>
          other.evaluate(() => {
            const id = window.__rv.roomGraph()!.placements[0]!.id;
            return !!window.__rv.viewer()!.getPlacementRoot(id);
          }),
        { timeout: 20_000 },
      )
      .toBe(true);
    const position = await other.evaluate(() => window.__rv.roomGraph()!.placements[0]!.position);
    expect(Math.hypot(position.x - 0.8, position.z + 0.5)).toBeLessThan(0.05);
    await expect(other.locator('#stage-empty')).toBeHidden();
    await expect(other.locator('body')).toHaveAttribute('data-workspace', 'room');
    await expect(other.locator('#stage-toast')).toHaveAttribute('data-kind', 'success');
  } finally {
    await context.close();
  }
});

test('choosing only a wall finish leaves the floor as it was, and the other way round', async ({ page }) => {
  await openRoomWorkspace(page);
  await createRoom(page);
  const shell = () =>
    page.evaluate(() => {
      const v = window.__rv.viewer() as any;
      const out: Record<string, string> = {};
      v.roomBuilt.root.traverse((o: any) => {
        const kind = o.userData?.kind as string | undefined;
        if (o.isMesh && (kind === 'floor' || kind === 'wall') && !out[kind]) {
          out[kind] = `#${o.material.color.getHexString()} ${o.material.name}`;
        }
      });
      return out;
    });
  const untouched = await shell();

  await page.selectOption('#room-wall-material', { index: 1 });
  await expect
    .poll(async () => page.evaluate(() => window.__rv.roomGraph()!.rooms[0]!.wall_material_id ?? ''))
    .not.toBe('');
  const wallOnly = await shell();
  expect(wallOnly.floor).toBe(untouched.floor);
  expect(wallOnly.wall).not.toBe(untouched.wall);

  await page.selectOption('#room-wall-material', '');
  await page.selectOption('#room-floor-material', { index: 1 });
  await expect
    .poll(async () => page.evaluate(() => window.__rv.roomGraph()!.rooms[0]!.floor_material_id ?? ''))
    .not.toBe('');
  const floorOnly = await shell();
  expect(floorOnly.wall).toBe(untouched.wall);
  expect(floorOnly.floor).not.toBe(untouched.floor);
});
