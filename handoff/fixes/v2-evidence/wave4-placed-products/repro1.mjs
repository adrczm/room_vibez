// Reproduce, on the wave-3 state, the three defects wave 4 fixes. Real pointer input on the canvas.
import { launch, fresh, ready, toClient, createRoom, openStep, placements, waitPlacements, meshes, summarise, pointOn } from './lib.mjs';
const out = {};
const browser = await launch();
try {
  // ---- A. Finish test (Picker §2), real pointer click + Add to room, then reload
  {
    const { ctx, page, errors } = await fresh(browser);
    await page.click('.slot[data-slot=frame] .swatch[data-material=wood-walnut]');
    await page.waitForFunction(() => window.__rv.parts()?.parts.find((p) => p.slotId === 'frame')?.materialId === 'wood-walnut');
    const cardSays = await page.textContent('.slot[data-slot=frame] [data-role=value]');
    await createRoom(page);
    await openStep(page, 'place');
    await page.click('#btn-place-mode');
    await page.waitForTimeout(800);
    const px = await toClient(page, 0.8, 0, -0.5);
    await page.mouse.click(px.x, px.y);
    await waitPlacements(page, 1);
    await page.click('#btn-place-mode'); // off
    await page.click('#btn-add-to-room');
    await waitPlacements(page, 2);
    const pls = await placements(page);
    out.finish = {
      cardSays,
      turntable: await page.evaluate(() => Object.fromEntries(window.__rv.viewer().getSlots().map((s) => [s.def.id, s.materialId]))),
      byClick: { bindings: pls[0].slot_bindings, meshes: summarise(await meshes(page, pls[0].id)) },
      byAddToRoom: { bindings: pls[1].slot_bindings, meshes: summarise(await meshes(page, pls[1].id)) },
      materialsCardVisibleInRoom: await page.evaluate(() => document.getElementById('slots').offsetParent !== null),
    };
    await page.screenshot({ path: `${process.env.OUT_DIR}/shots/before-walnut-not-in-room-1440.png` });
    await page.reload();
    await ready(page);
    await page.click('#workspace-mode button[data-mode=room]');
    await waitPlacements(page, 2);
    const again = await placements(page);
    out.finish.afterReload = { bindings: again[0].slot_bindings, meshes: summarise(await meshes(page, again[0].id)) };

    // ---- B. Selection: two identical rows, a real click on a product does nothing
    await openStep(page, 'place');
    await page.waitForTimeout(800);
    const rows = await page.$$eval('#placement-list li', (els) => els.map((li) => ({ text: li.querySelector('span')?.textContent, buttons: [...li.querySelectorAll('button')].map((b) => b.textContent), ariaCurrent: li.getAttribute('aria-current') })));
    const pt = await pointOn(page, again[0].id);
    let afterClick = null;
    if (pt) {
      await page.mouse.click(pt.x, pt.y);
      await page.waitForTimeout(400);
      afterClick = await page.evaluate(() => ({
        highlight: window.__rv.viewer().getPlacementHighlight(),
        ariaCurrentRows: document.querySelectorAll('#placement-list li[aria-current]').length,
        hint: document.getElementById('stage-hint').textContent,
      }));
      const before = (await placements(page)).map((p) => [p.position.x, p.position.z, p.rotation_y]);
      for (const k of ['r', 'ArrowLeft', 'Delete']) await page.keyboard.press(k);
      await page.waitForTimeout(300);
      afterClick.keysChangedAnything = JSON.stringify(before) !== JSON.stringify((await placements(page)).map((p) => [p.position.x, p.position.z, p.rotation_y]));
    }
    out.selection = { rows, clickPointFound: !!pt, afterClick };
    out.errorsA = errors;
    await ctx.close();
  }
  // ---- C. Uploaded model placed, then reload: the list still shows it, nothing in 3D, no message
  {
    const { ctx, page, errors } = await fresh(browser);
    await page.setInputFiles('#model-files', '/Users/adrian/Desktop/Room Vibez/v2/hackathon-3d-viewer/public/assets/models/side-table.glb');
    await page.waitForFunction(() => window.__rv.catalog().products.some((p) => p.userAdded));
    await ready(page);
    await page.waitForTimeout(500);
    const uploaded = await page.evaluate(() => { const p = window.__rv.catalog().products.find((p) => p.userAdded); return { id: p.id, name: p.name, sku: p.sku }; });
    await createRoom(page);
    await openStep(page, 'place');
    await page.click('#btn-add-to-room');
    await waitPlacements(page, 1);
    const beforeRows = await page.$$eval('#placement-list li', (els) => els.map((li) => li.textContent));
    const consoleMsgs = [];
    page.on('console', (m) => consoleMsgs.push(`${m.type()}: ${m.text()}`));
    await page.reload();
    await ready(page);
    await page.click('#workspace-mode button[data-mode=room]');
    await openStep(page, 'place');
    await page.waitForTimeout(2500);
    out.upload = {
      uploaded, beforeRows,
      afterReload: await page.evaluate(() => {
        const g = window.__rv.roomGraph();
        return {
          placements: g.placements.map((p) => ({ product_id: p.product_id, sku_id: p.sku_id, asset_ref: p.asset_ref.slice(0, 20), hasRoot: !!window.__rv.viewer().getPlacementRoot(p.id) })),
          rows: [...document.querySelectorAll('#placement-list li')].map((li) => li.textContent),
          toastOpen: document.getElementById('stage-toast')?.dataset.open,
          toastText: document.querySelector('#stage-toast .stage-toast-text')?.textContent,
          roomStatus: document.getElementById('room-status').textContent,
          inCatalog: window.__rv.catalog().products.map((p) => p.id),
        };
      }),
      consoleAfterReload: consoleMsgs.filter((m) => !m.startsWith('debug')),
    };
    out.errorsC = errors;
    await ctx.close();
  }
} finally {
  await browser.close();
}
console.log(JSON.stringify(out, null, 2));
