import { launch, fresh, toRoom, createRoom, toClient, placements, stageState, SHOTS, OUT } from './lib.mjs';
import fs from 'node:fs';
const browser = await launch();
const out = {};

// ---- T3 / T4: Room workspace with no room
{
  const { ctx, page } = await fresh(browser);
  await toRoom(page); await page.waitForTimeout(800);
  out.T3_emptyRoom = await stageState(page);
  out.T4_importProjectVisible = await page.locator('#btn-import-project').isVisible();
  await page.screenshot({ path: `${SHOTS}/before-room-empty-1440.png` });
  await ctx.close();
}

// ---- T1: Clear / Replace / Delete template unguarded, Clear switches to Product
{
  const { ctx, page } = await fresh(browser);
  await toRoom(page); await createRoom(page);
  await page.evaluate(() => window.__rv.simulateRoomPointer({ kind: 'floor', point: { x: 0.5, y: 0, z: 0.2 } }, 'place'));
  await page.waitForFunction(() => window.__rv.roomGraph().placements.length === 1);
  // Replace: Create room again with a placed product
  const before = await page.evaluate(() => window.__rv.roomGraph().id ?? JSON.stringify(window.__rv.roomGraph().placements.length));
  await page.click('#btn-create-room'); await page.waitForTimeout(600);
  out.T1_replace = { dialogs: await page.locator('dialog[open]').count(), placementsAfterCreateAgain: (await placements(page)).length };
  // Clear
  await page.evaluate(() => window.__rv.simulateRoomPointer({ kind: 'floor', point: { x: 0.5, y: 0, z: 0.2 } }, 'place'));
  await page.waitForFunction(() => window.__rv.roomGraph().placements.length === 1);
  const clearBox = await page.locator('#btn-clear-room').boundingBox();
  const createBox = await page.locator('#btn-create-room').boundingBox();
  out.T1_clearButton = { clear: clearBox, create: createBox, gapBelowCreate: clearBox.y - (createBox.y + createBox.height) };
  await page.click('#btn-clear-room'); await page.waitForTimeout(600);
  out.T1_clear = { dialogs: await page.locator('dialog[open]').count(), hasRoom: await page.evaluate(() => !!window.__rv.roomGraph()), workspace: await page.evaluate(() => document.body.dataset.workspace) };
  // Delete template
  await toRoom(page); await createRoom(page);
  await page.fill('#template-title', 'T-one'); await page.click('#btn-save-template-scratch'); await page.waitForTimeout(300);
  out.T1_templatesBefore = await page.locator('#template-list li').count();
  await page.click('#template-list li button:has-text("Delete")'); await page.waitForTimeout(300);
  out.T1_deleteTemplate = { dialogs: await page.locator('dialog[open]').count(), templatesAfter: await page.locator('#template-list li').count() };
  await ctx.close();
}

// ---- T1 defect: Clear room comes back after reload (IndexedDB copy from Export)
{
  const { ctx, page } = await fresh(browser);
  await toRoom(page); await createRoom(page);
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#btn-export-project')]);
  await dl.path();
  await page.waitForTimeout(500);
  await page.click('#btn-clear-room'); await page.waitForTimeout(500);
  const afterClear = await page.evaluate(() => ({ room: !!window.__rv.roomGraph(), ls: localStorage.getItem('catalog3d.roomGraph') }));
  await page.reload(); await page.waitForFunction(() => document.body.dataset.viewerStatus === 'ready'); await page.waitForTimeout(500);
  out.T1_idb = { afterClear, afterReloadHasRoom: await page.evaluate(() => !!window.__rv.roomGraph()), walls: await page.evaluate(() => window.__rv.roomGraph()?.walls.length ?? 0) };
  await ctx.close();
}

// ---- T2 / T5: feedback location; tool labels; void click; outside placement through the hook
{
  const { ctx, page } = await fresh(browser);
  await toRoom(page); await createRoom(page);
  out.T2_labelsOff = await page.evaluate(() => ['btn-opening-mode', 'btn-place-mode', 'btn-draw-wall-mode'].map((id) => document.getElementById(id).textContent));
  await page.click('#btn-place-mode'); await page.waitForTimeout(300);
  out.T2_labelPlaceOn = await page.evaluate(() => document.getElementById('btn-place-mode').textContent);
  out.T2_hintPlaceOn = (await stageState(page)).hint;
  // real click on a visible wall: far wall centre at half height
  const wallPx = await page.evaluate(() => {
    const v = window.__rv.viewer(); const g = window.__rv.roomGraph();
    const vis = [...v.roomBuilt.wallMeshes].filter(([, m]) => m.visible).map(([id]) => id);
    const w = g.walls.find((x) => x.id === vis[0]);
    return { id: w.id, x: (w.a.x + w.b.x) / 2, z: (w.a.z + w.b.z) / 2 };
  });
  const wp = await toClient(page, wallPx.x, 1.3, wallPx.z);
  const hit = await page.evaluate(({ x, y }) => window.__rv.viewer().raycastRoom(x, y)?.kind ?? null, wp);
  await page.mouse.click(wp.x, wp.y); await page.waitForTimeout(500);
  const s1 = await stageState(page);
  const dist = await page.evaluate(() => {
    const a = document.getElementById('room-status').getBoundingClientRect(); const b = document.getElementById('btn-place-mode').getBoundingClientRect();
    const st = document.querySelector('.stage').getBoundingClientRect();
    return { statusTop: a.top, placeTop: b.top, apart: Math.round(b.top - a.top), statusInsideStage: a.left >= st.left && a.right <= st.right };
  });
  out.T2_wallClick = { raycast: hit, roomStatus: s1.roomStatus, toast: s1.toast, toastEl: await page.locator('#stage-toast').count(), dist, placements: (await placements(page)).length };
  // T5: real void click
  const box = await page.locator('#viewer-host canvas').boundingBox();
  await page.mouse.click(box.x + 40, box.y + box.height - 60); await page.waitForTimeout(800);
  const s2 = await stageState(page);
  out.T5_voidClick = { placements: (await placements(page)).length, roomStatus: s2.roomStatus, toast: s2.toast };
  // T5: placeCurrentProduct is not guarded: a floor "hit" outside the room through the hook
  await page.evaluate(() => window.__rv.simulateRoomPointer({ kind: 'floor', point: { x: -0.48, y: 0, z: 3.74 } }, 'place'));
  await page.waitForTimeout(2500);
  const s3 = await stageState(page);
  out.T5_outsideViaHook = { placements: await placements(page), roomStatus: s3.roomStatus };
  await page.screenshot({ path: `${SHOTS}/before-place-outside-1440.png` });
  await ctx.close();
}

// ---- T6: wall material turns the floor white
{
  const { ctx, page } = await fresh(browser);
  await toRoom(page); await createRoom(page);
  const floorColor = () => page.evaluate(() => {
    const v = window.__rv.viewer(); let c = null, wall = null;
    v.roomBuilt.root.traverse((o) => { if (o.isMesh && o.userData.kind === 'floor' && !c) c = { hex: '#' + o.material.color.getHexString(), name: o.material.name }; if (o.isMesh && o.userData.kind === 'wall' && !wall) wall = { hex: '#' + o.material.color.getHexString(), name: o.material.name }; });
    return { floor: c, wall };
  });
  const b = await floorColor();
  const opts = await page.evaluate(() => [...document.getElementById('room-wall-material').options].map((o) => o.value + '|' + o.text));
  await page.selectOption('#room-wall-material', { index: 2 }); await page.waitForTimeout(500);
  const a = await floorColor();
  out.T6 = { before: b, afterWallOnly: a, options: opts.slice(0, 4), graph: await page.evaluate(() => ({ wall: window.__rv.roomGraph().rooms[0].wall_material_id, floor: window.__rv.roomGraph().rooms[0].floor_material_id ?? null })) };
  await ctx.close();
}

fs.writeFileSync(`${OUT}/before.json`, JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 1));
await browser.close();
