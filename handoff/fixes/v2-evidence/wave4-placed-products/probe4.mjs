// Pack case with the real pack in Room Vibez/models (not demo data): a placed pack keeps its own materials.
import { launch, fresh, ready, createRoom, openStep, placements, waitPlacements, OUT } from './lib.mjs';
const out = {};
const browser = await launch();
try {
  const { ctx, page, errors } = await fresh(browser);
  const dialogs = [];
  page.on('dialog', async (d) => { dialogs.push(d.message().slice(0, 80)); await d.accept(); });
  await page.setInputFiles('#pack-files', ['/Users/adrian/Desktop/Room Vibez/models/core-rulebook-4aedc7.mjs', '/Users/adrian/Desktop/Room Vibez/models/core-rulebook-4aedc7.glb']);
  await page.waitForFunction(() => window.__rv.catalog().products.length === 3, null, { timeout: 30000 });
  await ready(page);
  await page.waitForTimeout(1500);
  out.product = await page.evaluate(() => { const p = window.__rv.catalog().products[2]; return { id: p.id, name: p.name, sourceKind: p.sourceKind, preserveMaterials: p.preserveMaterials, pack: p.pack && { mappingMode: p.pack.mappingMode, completeness: p.pack.completeness }, slots: p.slots.map((s) => s.id + '=' + s.default) }; });
  out.packStatus = await page.textContent('#pack-upload-status');
  out.turntable = await page.evaluate(() => { const v = window.__rv.viewer(); const mats = new Set(); v.getModelRoot().traverse((o) => { if (o.isMesh) mats.add(`${o.material.name}|lib:${o.material.userData?.libraryId ?? '-'}|vc:${!!o.material.vertexColors}|#${o.material.color?.getHexString?.()}`); }); return [...mats]; });
  await createRoom(page);
  await openStep(page, 'place');
  out.stateLine = await page.textContent('#materials-state');
  out.slotsShown = await page.$$eval('#slots .slot', (els) => els.map((e) => e.dataset.slot));
  await page.click('#btn-add-to-room');
  await waitPlacements(page, 1);
  const pl = (await placements(page))[0];
  out.placed = { bindings: pl.slot_bindings, mats: await page.evaluate((id) => { const mats = new Set(); window.__rv.viewer().getPlacementRoot(id).traverse((o) => { if (o.isMesh) mats.add(`${o.material.name}|lib:${o.material.userData?.libraryId ?? '-'}|vc:${!!o.material.vertexColors}|#${o.material.color?.getHexString?.()}`); }); return [...mats]; }, pl.id) };
  out.toast = await page.textContent('#stage-toast .stage-toast-text');
  // select it, click a swatch → notice, nothing changes
  await page.click('#placement-list li .placement-name');
  out.selectedState = await page.textContent('#materials-state');
  const sw = await page.$('#slots .swatch[aria-pressed=false]');
  if (sw) { await sw.click(); await page.waitForTimeout(300); out.swatchClick = { toast: await page.textContent('#stage-toast .stage-toast-text'), bindingsSame: JSON.stringify((await placements(page))[0].slot_bindings) === JSON.stringify(pl.slot_bindings), undoDisabledAfter: null }; }
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/shots/dev-pack-in-room-1440.png` });
  out.dialogs = dialogs; out.errors = errors;
  await ctx.close();
} finally { await browser.close(); }
console.log(JSON.stringify(out, null, 1));
