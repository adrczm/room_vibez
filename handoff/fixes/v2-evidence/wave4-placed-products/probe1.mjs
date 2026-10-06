// Verify the wave-4 build: finish in the room (both paths, reload), selection, keys, undo, 16b.
import { launch, fresh, ready, toClient, createRoom, openStep, placements, waitPlacements, meshes, summarise, pointOn, OUT } from './lib.mjs';
const out = {};
const browser = await launch();
const sel = (page) => page.evaluate(() => ({
  highlight: window.__rv.viewer().getPlacementHighlight(),
  current: [...document.querySelectorAll('#placement-list li[aria-current]')].map((li) => li.dataset.placementId),
  rows: [...document.querySelectorAll('#placement-list li')].map((li) => [...li.children].map((c) => c.textContent).join(' | ')),
  hint: document.getElementById('stage-hint').textContent,
  state: document.getElementById('materials-state').hidden ? null : document.getElementById('materials-state').textContent,
  slots: [...document.querySelectorAll('#slots .slot')].map((s) => `${s.dataset.slot}=${s.querySelector('.swatch[aria-pressed=true]')?.dataset.material}`),
  active: document.activeElement?.tagName + (document.activeElement?.id ? '#' + document.activeElement.id : ''),
}));
const pose = (page) => page.evaluate(() => window.__rv.roomGraph().placements.map((p) => ({ x: +p.position.x.toFixed(4), z: +p.position.z.toFixed(4), r: +p.rotation_y.toFixed(4), f: p.slot_bindings.frame ?? p.slot_bindings.top })));
try {
  const { ctx, page, errors } = await fresh(browser);
  // Walnut in Product, then both placement paths.
  await page.click('.slot[data-slot=frame] .swatch[data-material=wood-walnut]');
  await createRoom(page);
  await openStep(page, 'place');
  out.cardInRoom = await page.evaluate(() => ({
    parent: document.getElementById('materials-card').parentElement.id,
    count: document.querySelectorAll('#materials-card').length,
    visible: document.getElementById('slots').offsetParent !== null,
    state: document.getElementById('materials-state').textContent,
    pressed: document.querySelector('.slot[data-slot=frame] .swatch[aria-pressed=true]')?.dataset.material,
  }));
  await page.click('#btn-place-mode');
  await page.waitForTimeout(800);
  let px = await toClient(page, 0.8, 0, -0.5);
  await page.mouse.click(px.x, px.y);
  await waitPlacements(page, 1);
  await page.click('#btn-place-mode');
  // In Room: change the next finish to oak via the card, then Add to room at once (race check).
  await page.click('.slot[data-slot=frame] .swatch[data-material=wood-oak]');
  await page.click('#btn-add-to-room');
  await waitPlacements(page, 2);
  let pls = await placements(page);
  out.finish = {
    byClick: { bindings: pls[0].slot_bindings, meshes: summarise(await meshes(page, pls[0].id)) },
    byAddToRoom: { bindings: pls[1].slot_bindings, meshes: summarise(await meshes(page, pls[1].id)) },
  };
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/shots/dev-two-chairs-1440.png` });

  // Selection by a real canvas click on chair 2 (the oak one).
  out.before = await sel(page);
  const pt = await pointOn(page, pls[1].id);
  await page.mouse.click(pt.x, pt.y);
  await page.waitForTimeout(300);
  out.afterCanvasSelect = await sel(page);
  await page.screenshot({ path: `${OUT}/shots/dev-selected-1440.png` });
  // Keys.
  const p0 = await pose(page);
  await page.keyboard.press('r');
  const p1 = await pose(page);
  await page.keyboard.press('Shift+R');
  const p2 = await pose(page);
  await page.keyboard.press('ArrowLeft');
  const p3 = await pose(page);
  await page.keyboard.press('Shift+ArrowDown');
  const p4 = await pose(page);
  out.keys = { p0: p0[1], afterR: p1[1], afterShiftR: p2[1], afterLeft: p3[1], afterShiftDown: p4[1] };
  out.rootFollows = await page.evaluate((id) => { const r = window.__rv.viewer().getPlacementRoot(id); return { x: +r.position.x.toFixed(4), z: +r.position.z.toFixed(4), rot: +r.rotation.y.toFixed(4) }; }, pls[1].id);
  out.toastAfterMoves = await page.evaluate(() => ({ open: document.getElementById('stage-toast').dataset.open, text: document.querySelector('#stage-toast .stage-toast-text').textContent }));
  // Undo each step.
  const undo = [];
  for (let i = 0; i < 4; i++) { await page.keyboard.press('ControlOrMeta+z'); await page.waitForTimeout(150); undo.push((await pose(page))[1]); }
  out.undo = undo;
  await waitPlacements(page, 2);
  out.afterUndoSel = await sel(page);
  // 16b: selected chair 2 → walnut.
  await page.click('.slot[data-slot=frame] .swatch[data-material=wood-walnut]');
  await page.waitForFunction((id) => { const r = window.__rv.viewer().getPlacementRoot(id); let ok = false; r?.traverse((o) => { if (o.isMesh && o.material.userData.libraryId === 'wood-walnut') ok = true; }); return ok; }, pls[1].id, { timeout: 15000 });
  pls = await placements(page);
  out.sixteenB = { bindings: pls.map((p) => p.slot_bindings.frame), meshes2: summarise(await meshes(page, pls[1].id)), meshes1: summarise(await meshes(page, pls[0].id)), sel: await sel(page),
    turntable: await page.evaluate(() => Object.fromEntries(window.__rv.viewer().getSlots().map((s) => [s.def.id, s.materialId]))) };
  await page.keyboard.press('ControlOrMeta+z');
  await page.waitForFunction((id) => { const r = window.__rv.viewer().getPlacementRoot(id); let ok = false; r?.traverse((o) => { if (o.isMesh && o.material.userData.libraryId === 'wood-oak') ok = true; }); return ok; }, pls[1].id, { timeout: 15000 });
  out.sixteenBUndo = { bindings: (await placements(page)).map((p) => p.slot_bindings.frame), sel: await sel(page) };
  // Deselect by clicking empty floor.
  const empty = await toClient(page, -1.8, 0, 1.4);
  await page.mouse.click(empty.x, empty.y);
  await page.waitForTimeout(200);
  out.afterDeselect = await sel(page);
  // Select by row, delete by key, undo.
  await page.click('#placement-list li:nth-child(1) button[data-action=select]');
  out.afterRowSelect = await sel(page);
  await page.keyboard.press('Delete');
  await page.waitForTimeout(200);
  out.afterDelete = { n: (await placements(page)).length, sel: await sel(page) };
  await page.keyboard.press('ControlOrMeta+z');
  await waitPlacements(page, 2);
  out.afterDeleteUndo = { n: (await placements(page)).length, sel: await sel(page) };
  // Reload: finish survives.
  await page.reload();
  await ready(page);
  await page.click('#workspace-mode button[data-mode=room]');
  await waitPlacements(page, 2);
  pls = await placements(page);
  out.afterReload = pls.map((p) => ({ frame: p.slot_bindings.frame }));
  out.afterReloadMeshes = [summarise(await meshes(page, pls[0].id)), summarise(await meshes(page, pls[1].id))];
  out.errors = errors;
  await ctx.close();
} finally {
  await browser.close();
}
console.log(JSON.stringify(out, null, 2));
