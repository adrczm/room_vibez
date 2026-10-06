// (a) A roughness map added to a library material reaches placed products that wear it.
// (b) Keyboard: keys with focus on a radio group are left alone; R with Cmd/Ctrl is not taken.
// (c) Holding focus in the list: Delete by key moves focus to the neighbour row.
import { launch, fresh, ready, createRoom, openStep, placements, waitPlacements } from './lib.mjs';
const out = {};
const browser = await launch();
try {
  const { ctx, page, errors } = await fresh(browser);
  await createRoom(page);
  await openStep(page, 'place');
  await page.click('#btn-add-to-room');
  await waitPlacements(page, 1);
  await page.click('#btn-add-to-room');
  await waitPlacements(page, 2);
  const [a, b] = (await placements(page)).map((p) => p.id);
  const frameMat = (id) => page.evaluate((id) => { let m = null; window.__rv.viewer().getPlacementRoot(id).traverse((o) => { if (!m && o.isMesh && o.material.userData.libraryId === 'wood-oak') m = o.material; }); return m ? { rough: !!m.roughnessMap, uuid: m.uuid } : null; }, id);
  out.before = await frameMat(a);
  // (b) radio group focus: arrows do not nudge; then Cmd/Ctrl+R is not swallowed (we only check preventDefault)
  await page.click('#placement-list li:nth-child(1) .placement-name');
  await page.focus('#presets button[data-preset=studio-soft]');
  const p0 = (await placements(page))[0].position;
  await page.keyboard.press('ArrowLeft');
  const p1 = (await placements(page))[0].position;
  out.radioGroup = { unchanged: p0.x === p1.x && p0.z === p1.z };
  out.modR = await page.evaluate(() => { const e = new KeyboardEvent('keydown', { key: 'r', metaKey: true, bubbles: true, cancelable: true }); document.body.dispatchEvent(e); const e2 = new KeyboardEvent('keydown', { key: 'r', altKey: true, bubbles: true, cancelable: true }); document.body.dispatchEvent(e2); return { metaPrevented: e.defaultPrevented, altPrevented: e2.defaultPrevented, rot: window.__rv.roomGraph().placements[0].rotation_y }; });
  // (c) Delete by key with focus on the selected row → focus goes to the neighbour row
  await page.click('#placement-list li:nth-child(1) .placement-name');
  await page.keyboard.press('Delete');
  out.focusAfterDelete = await page.evaluate(() => ({ tag: document.activeElement.tagName, action: document.activeElement.dataset?.action, row: document.activeElement.closest('li')?.dataset.placementId }));
  out.remaining = (await placements(page)).map((p) => p.id).join() === b;
  await page.keyboard.press('ControlOrMeta+z');
  await waitPlacements(page, 2);
  // (a) add a roughness map to wood-oak in Product → Advanced
  await page.click('#workspace-mode button[data-mode=catalog]');
  await page.click('#product-advanced-summary');
  await page.selectOption('#texture-role', 'roughnessMap');
  await page.selectOption('#texture-target', 'wood-oak');
  const png = await page.request.get('http://127.0.0.1:18777/assets/textures/wood-oak.png');
  out.pngStatus = png.status();
  await page.setInputFiles('#texture-file', { name: 'rough.png', mimeType: 'image/png', buffer: await png.body() });
  await page.click('#btn-add-texture');
  await page.waitForFunction(() => /Attached/.test(document.getElementById('texture-upload-status').textContent), null, { timeout: 15000 });
  await page.waitForTimeout(1500);
  out.after = [await frameMat(a), await frameMat(b)];
  out.turntableRough = await page.evaluate(() => { let r = false; window.__rv.viewer().getModelRoot().traverse((o) => { if (o.isMesh && o.material.userData.libraryId === 'wood-oak' && o.material.roughnessMap) r = true; }); return r; });
  out.errors = errors;
  await ctx.close();
} finally { await browser.close(); }
console.log(JSON.stringify(out, null, 1));
