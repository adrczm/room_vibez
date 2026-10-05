/**
 * E2E, engine level, on products placed with real pointer clicks:
 * - UX-09 (engine part): `placement` hits in mode `room` only, setPlacementPose, setPlacementHighlight,
 *   getPlacementRoot.
 * - UX-16 step 1: applySlotBindings puts library materials on a placed product.
 * The host in this build does not call these yet; they are driven through `window.__rv.viewer()`.
 */
import { expect, test, type Page } from '@playwright/test';

test.describe.configure({ timeout: 120_000 });

const ready = (page: Page) =>
  expect(page.locator('body')).toHaveAttribute('data-viewer-status', 'ready', { timeout: 30_000 });

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

const placementIds = (page: Page) => page.evaluate(() => window.__rv.roomGraph()!.placements.map((p) => p.id));

/** Room with a lounge chair and a side table, both placed by a real click in Place mode. Ends in mode `room`. */
async function roomWithTwoProducts(page: Page) {
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
  // In the Room workspace the product picker is in the "Place products" step (UX-08): open it.
  await page.click('.step[data-step=place] .step-toggle');
  await page.waitForTimeout(500);

  const place = async (productId: string, x: number, z: number, expected: number) => {
    await page.selectOption('#product-select', productId);
    await expect.poll(async () => page.evaluate(() => window.__rv.parts()?.productId)).toBe(productId);
    await ready(page);
    await page.evaluate(() => window.__rv.viewer()!.setInteractionMode('place'));
    const px = await toClient(page, x, 0, z);
    await page.mouse.click(px.x, px.y);
    await expect.poll(async () => (await placementIds(page)).length).toBe(expected);
    await expect
      .poll(async () => page.evaluate(() => { const ids = window.__rv.roomGraph()!.placements.map((p) => p.id); return ids.every((id) => !!window.__rv.viewer()!.getPlacementRoot(id)); }))
      .toBe(true);
  };
  await place('demo-lounge-chair', 0.8, -0.5, 1);
  await place('demo-side-table', -1.2, 0.8, 2);
  await page.evaluate(() => window.__rv.viewer()!.setInteractionMode('room'));
  await page.waitForTimeout(300);
  const [chair, table] = await placementIds(page);
  return { chair: chair!, table: table! };
}

/** Scan the screen area a placement covers; returns what raycastRoom reports and one point that hits it. */
const scanPlacement = (page: Page, id: string) =>
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
    const kinds: Record<string, number> = {};
    let best: { x: number; y: number; d: number } | null = null;
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const x = x0 + ((i + 0.5) / N) * (x1 - x0), y = y0 + ((j + 0.5) / N) * (y1 - y0);
      const h = v.raycastRoom(x, y);
      const key = !h ? 'none' : h.kind === 'placement' ? `placement:${h.placementId}` : h.kind;
      kinds[key] = (kinds[key] ?? 0) + 1;
      if (h?.kind === 'placement' && h.placementId === id) {
        const d = Math.hypot(x - (x0 + x1) / 2, y - (y0 + y1) / 2);
        if (!best || d < best.d) best = { x, y, d };
      }
    }
    return { kinds, point: best ? { x: best.x, y: best.y } : null };
  }, id);

test('UX-09 engine: placement hits, pose changes and the highlight', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  const { chair, table } = await roomWithTwoProducts(page);

  // --- placement hits: only in mode `room`
  const inRoom = await scanPlacement(page, chair);
  expect(inRoom.point, `raycast kinds over the chair: ${JSON.stringify(inRoom.kinds)}`).not.toBeNull();
  expect(inRoom.kinds[`placement:${chair}`]).toBeGreaterThan(0);
  expect(inRoom.kinds[`placement:${table}`] ?? 0).toBe(0);
  for (const mode of ['place', 'opening', 'draw-wall'] as const) {
    await page.evaluate((mode) => window.__rv.viewer()!.setInteractionMode(mode), mode);
    const scan = await scanPlacement(page, chair);
    expect(Object.keys(scan.kinds).filter((k) => k.startsWith('placement'))).toEqual([]);
    expect(scan.kinds.floor).toBeGreaterThan(0);
  }
  await page.evaluate(() => window.__rv.viewer()!.setInteractionMode('room'));

  // --- a real click reaches the host callback as a `placement` hit; floor and void clicks as before
  await page.evaluate(() => {
    const v = window.__rv.viewer() as any;
    const original = v.opts.onRoomPointer;
    (window as any).__hits = [];
    v.opts.onRoomPointer = (hit: unknown, mode: string) => {
      (window as any).__hits.push({ hit, mode });
      original(hit, mode);
    };
  });
  await page.mouse.click(inRoom.point!.x, inRoom.point!.y);
  const emptyFloor = await toClient(page, 1.8, 0, 1.2);
  await page.mouse.click(emptyFloor.x, emptyFloor.y);
  const box = (await page.locator('#viewer-host canvas').boundingBox())!;
  // The void click goes to the bottom-right corner. The bottom-left one now holds the stage toast
  // ("Placed …", UX-04), which sits over the canvas there and takes the click itself.
  await page.mouse.click(box.x + box.width - 40, box.y + box.height - 60);
  const hits = await page.evaluate(() => (window as any).__hits as { hit: any; mode: string }[]);
  expect(hits.map((h) => h.mode)).toEqual(['room', 'room', 'room']);
  expect(hits[0]!.hit).toMatchObject({ kind: 'placement', placementId: chair });
  expect(hits[1]!.hit.kind).toBe('floor');
  expect(hits[2]!.hit).toBeNull();
  expect((await placementIds(page)).length).toBe(2); // the unchanged host ignores mode `room` clicks

  // --- setPlacementPose keeps the same root (no dispose, no reload)
  const pose = await page.evaluate((id) => {
    const v = window.__rv.viewer() as any;
    const root = v.getPlacementRoot(id);
    root.userData.__sameRoot = true;
    let disposed = 0;
    root.traverse((o: any) => o.isMesh && o.geometry.addEventListener('dispose', () => disposed++));
    const centre = () => { const f = v.getPlacementFootprint(id); return { x: (f.minX + f.maxX) / 2, z: (f.minZ + f.maxZ) / 2, sx: f.maxX - f.minX, sz: f.maxZ - f.minZ }; };
    const start = { x: root.position.x, y: root.position.y, z: root.position.z, rot: root.rotation.y, fp: centre() };
    const moved = v.setPlacementPose(id, { x: start.x + 0.5, z: start.z + 0.75 });
    const afterMove = { x: root.position.x, y: root.position.y, z: root.position.z, rot: root.rotation.y, fp: centre() };
    const turned = v.setPlacementPose(id, { x: afterMove.x, z: afterMove.z }, Math.PI / 2);
    const afterTurn = { rot: root.rotation.y, fp: centre() };
    const after = v.getPlacementRoot(id);
    return {
      moved, turned, start, afterMove, afterTurn, disposed,
      sameRoot: after === root && after.userData.__sameRoot === true,
      attached: after.parent === v.placementsRoot,
      unknown: v.setPlacementPose('no-such-placement', { x: 0, z: 0 }, 0),
      graphUntouched: window.__rv.roomGraph()!.placements.find((p) => p.id === id)!.position,
    };
  }, chair);
  expect(pose.moved).toBe(true);
  expect(pose.turned).toBe(true);
  expect(pose.unknown).toBe(false);
  expect(pose.sameRoot).toBe(true);
  expect(pose.attached).toBe(true);
  expect(pose.disposed).toBe(0);
  expect(pose.afterMove.x - pose.start.x).toBeCloseTo(0.5, 6);
  expect(pose.afterMove.z - pose.start.z).toBeCloseTo(0.75, 6);
  expect(pose.afterMove.y).toBeCloseTo(pose.start.y, 9); // stays on the floor
  expect(pose.afterMove.rot).toBeCloseTo(pose.start.rot, 9); // rotation omitted = kept
  expect(pose.afterMove.fp.x - pose.start.fp.x).toBeCloseTo(0.5, 4);
  expect(pose.afterMove.fp.z - pose.start.fp.z).toBeCloseTo(0.75, 4);
  expect(pose.afterTurn.rot).toBeCloseTo(Math.PI / 2, 9);
  expect(pose.afterTurn.fp.sx).toBeCloseTo(pose.afterMove.fp.sz, 3); // quarter turn swaps the footprint
  expect(pose.afterTurn.fp.sz).toBeCloseTo(pose.afterMove.fp.sx, 3);
  expect(pose.graphUntouched.x).toBeCloseTo(pose.start.x, 6); // the host commits with updatePlacement
  // Picking follows the new pose.
  await page.waitForTimeout(200);
  const movedScan = await scanPlacement(page, chair);
  expect(movedScan.kinds[`placement:${chair}`]).toBeGreaterThan(0);
  const oldSpot = await toClient(page, pose.start.fp.x, 0, pose.start.fp.z);
  expect(await page.evaluate(({ x, y }) => (window.__rv.viewer() as any).raycastRoom(x, y)?.kind, oldSpot)).toBe('floor');

  // --- highlight
  const highlight = () =>
    page.evaluate(() => {
      const v = window.__rv.viewer() as any;
      const helpers = v.placementsRoot.children.filter((c: any) => c.userData.kind === 'placement-highlight');
      const b = helpers[0]?.box;
      return {
        id: v.getPlacementHighlight() as string | null,
        helpers: helpers.length as number,
        isMesh: helpers[0] ? !!helpers[0].isMesh : null,
        box: b ? { minX: b.min.x, maxX: b.max.x, minZ: b.min.z, maxZ: b.max.z } : null,
      };
    });
  const footprint = (id: string) => page.evaluate((id) => window.__rv.viewer()!.getPlacementFootprint(id)!, id);
  const wraps = (box: { minX: number; maxX: number; minZ: number; maxZ: number }, fp: { minX: number; maxX: number; minZ: number; maxZ: number }) => {
    expect(box.minX).toBeCloseTo(fp.minX - 0.02, 4);
    expect(box.maxX).toBeCloseTo(fp.maxX + 0.02, 4);
    expect(box.minZ).toBeCloseTo(fp.minZ - 0.02, 4);
    expect(box.maxZ).toBeCloseTo(fp.maxZ + 0.02, 4);
  };
  expect(await highlight()).toMatchObject({ id: null, helpers: 0 });
  expect(await page.evaluate((id) => window.__rv.viewer()!.setPlacementHighlight(id), chair)).toBe(true);
  let h = await highlight();
  expect(h).toMatchObject({ id: chair, helpers: 1, isMesh: false });
  wraps(h.box!, await footprint(chair)); // the outline does not change the footprint it wraps
  // It follows a pose change.
  await page.evaluate((id) => { const v = window.__rv.viewer()!; const f = v.getPlacementFootprint(id)!; v.setPlacementPose(id, { x: (f.minX + f.maxX) / 2 - 0.3, z: (f.minZ + f.maxZ) / 2 }); }, chair);
  wraps((await highlight()).box!, await footprint(chair));
  // It does not get in the way of picking.
  expect((await scanPlacement(page, chair)).kinds[`placement:${chair}`]).toBeGreaterThan(0);
  // One outline at a time.
  expect(await page.evaluate((id) => window.__rv.viewer()!.setPlacementHighlight(id), table)).toBe(true);
  h = await highlight();
  expect(h).toMatchObject({ id: table, helpers: 1 });
  wraps(h.box!, await footprint(table));
  // The id is remembered across a reload of the placements: Undo removes the table, Redo brings it back.
  await page.click('#btn-undo');
  await expect.poll(async () => (await placementIds(page)).length).toBe(1);
  await expect.poll(async () => page.evaluate((id) => !!window.__rv.viewer()!.getPlacementRoot(id), chair)).toBe(true);
  expect(await highlight()).toMatchObject({ id: table, helpers: 0 });
  await page.click('#btn-redo');
  await expect.poll(async () => page.evaluate((id) => !!window.__rv.viewer()!.getPlacementRoot(id), table)).toBe(true);
  h = await highlight();
  expect(h).toMatchObject({ id: table, helpers: 1 });
  wraps(h.box!, await footprint(table));
  // Unknown id: nothing shown. Null: cleared.
  expect(await page.evaluate(() => window.__rv.viewer()!.setPlacementHighlight('no-such-placement'))).toBe(false);
  expect(await highlight()).toMatchObject({ id: 'no-such-placement', helpers: 0 });
  expect(await page.evaluate(() => window.__rv.viewer()!.setPlacementHighlight(null))).toBe(false);
  expect(await highlight()).toMatchObject({ id: null, helpers: 0 });

  expect(errors).toEqual([]);
});

test('UX-16 step 1: applySlotBindings puts the chosen finish on a placed product', async ({ page }) => {
  const errors: string[] = [];
  const warnings: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
    if (m.type() === 'warning' && m.text().includes('[slots]')) warnings.push(m.text());
  });
  const { chair, table } = await roomWithTwoProducts(page);

  /** Per mesh of a placement: its slot (nearest tagged ancestor / name convention) and its material. */
  const meshes = (id: string) =>
    page.evaluate((id) => {
      const v = window.__rv.viewer() as any;
      const out: { slot: string | null; libraryId: string | null; name: string; color: string; map: string | null }[] = [];
      v.getPlacementRoot(id).traverse((o: any) => {
        if (!o.isMesh) return;
        let slot: string | null = null;
        for (let n = o; n && !slot; n = n.parent) {
          slot = n.userData?.material_slot_id ?? /^slot_([a-z0-9-]+(?:_[a-z0-9-]+)*?)(?:__.*)?$/i.exec(n.name ?? '')?.[1] ?? null;
        }
        const m = o.material;
        out.push({
          slot,
          libraryId: m.userData?.libraryId ?? null,
          name: m.name,
          color: `#${m.color.getHexString()}`,
          map: m.map ? String(m.map.image?.currentSrc || m.map.image?.src || 'yes').split('/').pop()! : null,
        });
      });
      return out;
    }, id);
  const bySlot = (list: Awaited<ReturnType<typeof meshes>>) => {
    const o: Record<string, string[]> = {};
    for (const m of list) (o[m.slot ?? '(none)'] ??= []).push(m.libraryId ?? `embedded:${m.name}`);
    return Object.fromEntries(Object.entries(o).map(([k, v]) => [k, [...new Set(v)]]));
  };
  const apply = (id: string, productId: string, bindings: unknown, extra: Record<string, unknown> = {}) =>
    page.evaluate(
      async ({ id, productId, bindings, extra }) => {
        const v = window.__rv.viewer() as any;
        const product = { ...window.__rv.catalog().products.find((p) => p.id === productId)!, ...extra };
        return (await v.applySlotBindings(v.getPlacementRoot(id), product, bindings)) as Record<string, string>;
      },
      { id, productId, bindings, extra },
    );

  // Before: what the unchanged host places (QA correction C4): the GLB's grey placeholders.
  const before = await meshes(chair);
  expect(before.length).toBe(14);
  expect(before.every((m) => m.libraryId === null && m.map === null)).toBe(true);

  // Walnut frame, defaults elsewhere.
  expect(await apply(chair, 'demo-lounge-chair', { frame: 'wood-walnut' })).toEqual({
    frame: 'wood-walnut', handles: 'plastic-black', pillow: 'wool-cream',
  });
  let now = await meshes(chair);
  expect(bySlot(now)).toEqual({ frame: ['wood-walnut'], handles: ['plastic-black'], pillow: ['wool-cream'] });
  expect(now.filter((m) => m.slot === 'frame').length).toBe(10);
  expect(now.filter((m) => m.slot === 'frame').every((m) => m.map === 'wood-walnut.png')).toBe(true);
  expect(now.some((m) => m.color === '#e7e7e7')).toBe(false);
  // The turntable copy of the same product is a different object and keeps its own choice.
  const turntable = await page.evaluate(() => {
    const v = window.__rv.viewer() as any;
    return [...v.slotMeshes.entries()].map(([slot, ms]: any) => [slot, [...new Set(ms.map((m: any) => m.material.userData.libraryId))]]);
  });
  expect(Object.fromEntries(turntable)).toEqual({ top: ['stone-marble'], legs: ['metal-brass'] }); // side table is selected

  // Default placement = the product's default finish (oak), not flat grey.
  expect(await apply(table, 'demo-side-table', undefined)).toEqual({ top: 'stone-marble', legs: 'metal-brass' });
  expect(bySlot(await meshes(table))).toEqual({ top: ['stone-marble'], legs: ['metal-brass'] });
  expect(await apply(chair, 'demo-lounge-chair', {})).toEqual({ frame: 'wood-oak', handles: 'plastic-black', pillow: 'wool-cream' });
  now = await meshes(chair);
  expect(now.filter((m) => m.slot === 'frame').every((m) => m.libraryId === 'wood-oak' && m.map === 'wood-oak.png')).toBe(true);

  // Changing a finish again: replaced materials are freed once, textures come from the shared cache.
  const swap = await page.evaluate(async (id) => {
    const v = window.__rv.viewer() as any;
    const root = v.getPlacementRoot(id);
    const product = window.__rv.catalog().products.find((p) => p.id === 'demo-lounge-chair')!;
    const frameMesh = () => { let m: any = null; root.traverse((o: any) => { if (!m && o.isMesh && o.material.userData.libraryId?.startsWith('wood-')) m = o; }); return m; };
    await v.applySlotBindings(root, product, { frame: 'wood-walnut' });
    const first = frameMesh().material;
    let disposed = 0;
    first.addEventListener('dispose', () => disposed++);
    const cacheBefore = v.textureCache.size;
    await v.applySlotBindings(root, product, { frame: 'wood-walnut' });
    const second = frameMesh().material;
    return { disposed, newInstance: second !== first, sameTexture: second.map === first.map, cacheBefore, cacheAfter: v.textureCache.size };
  }, chair);
  expect(swap.disposed).toBe(1);
  expect(swap.newInstance).toBe(true);
  expect(swap.sameTexture).toBe(true);
  expect(swap.cacheAfter).toBe(swap.cacheBefore);

  // A bad saved binding never throws and never blocks: each bad entry falls back to the slot default.
  warnings.length = 0;
  expect(
    await apply(chair, 'demo-lounge-chair', { frame: 'no-such-material', handles: 'wool-cream', pillow: 123, ghost: 'x' }),
  ).toEqual({ frame: 'wood-oak', handles: 'plastic-black', pillow: 'wool-cream' });
  expect(bySlot(await meshes(chair))).toEqual({ frame: ['wood-oak'], handles: ['plastic-black'], pillow: ['wool-cream'] });
  expect(warnings.length).toBe(4);

  // preserveMaterials: the asset keeps its own materials.
  const tableBefore = await meshes(table);
  expect(await apply(table, 'demo-side-table', { legs: 'metal-black' }, { preserveMaterials: true })).toEqual({});
  expect(await meshes(table)).toEqual(tableBefore);

  // Removing the placement frees its library materials too.
  const freed = await page.evaluate((id) => {
    const v = window.__rv.viewer() as any;
    const mats = new Set<any>();
    v.getPlacementRoot(id).traverse((o: any) => o.isMesh && mats.add(o.material));
    let disposed = 0;
    for (const m of mats) m.addEventListener('dispose', () => disposed++);
    v.detachPlacement(id);
    return { materials: mats.size, disposed, root: v.getPlacementRoot(id) };
  }, chair);
  expect(freed).toEqual({ materials: 3, disposed: 3, root: null });

  expect(errors).toEqual([]);
});
