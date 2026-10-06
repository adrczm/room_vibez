// After-fix checks, part 1: UX-06 empty state, QA-04 import from the card, UX-03 confirms, IDB defect, T6.
import { launch, fresh, toRoom, createRoom, toClient, placements, stageState, ready, SHOTS, OUT } from './lib.mjs';
import fs from 'node:fs';
const browser = await launch();
const out = {};
const dlg = (page) => page.evaluate(() => { const d = document.querySelector('dialog.confirm-dialog[open]'); return d ? { title: d.querySelector('.app-dialog-title').textContent, body: d.querySelector('.confirm-body').textContent, strong: [...d.querySelectorAll('.confirm-body strong')].map((s) => s.textContent), confirm: d.querySelector('[data-action=confirm]').textContent, cancel: d.querySelector('[data-action=cancel]').textContent, confirmClass: d.querySelector('[data-action=confirm]').className, focus: document.activeElement?.dataset?.action ?? null } : null; });
const wood = async (page) => {
  // canvas pixels only: hide overlays for the capture
  const { PNG } = await import('/Users/adrian/Desktop/Room Vibez/v2/hackathon-3d-viewer/node_modules/pngjs/lib/png.js').then((m) => m.default ?? m);
  await page.evaluate(() => { for (const id of ['stage-empty', 'stage-hint', 'stage-toast']) { const e = document.getElementById(id); if (e) e.style.visibility = 'hidden'; } document.querySelector('.stage-toolbar').style.visibility = 'hidden'; });
  await page.waitForTimeout(400);
  const png = PNG.sync.read(await page.locator('#viewer-host canvas').screenshot());
  await page.evaluate(() => { for (const id of ['stage-empty', 'stage-hint', 'stage-toast']) { const e = document.getElementById(id); if (e) e.style.visibility = ''; } document.querySelector('.stage-toolbar').style.visibility = ''; });
  let w = 0; const d = png.data;
  for (let i = 0; i < d.length; i += 4 * 31) { const r = d[i], g = d[i + 1], b = d[i + 2]; if (r > 120 && g > 90 && b < 140 && r > g + 10) w++; }
  return w;
};
const placeReal = async (page, x, z) => { const p = await toClient(page, x, 0, z); await page.mouse.click(p.x, p.y); };
const visibleWall = (page) => page.evaluate(() => { const v = window.__rv.viewer(); const g = window.__rv.roomGraph(); const vis = [...v.roomBuilt.wallMeshes].filter(([, m]) => m.visible).map(([id]) => id); const w = g.walls.find((x) => x.id === vis[0]); return { id: w.id, x: (w.a.x + w.b.x) / 2, z: (w.a.z + w.b.z) / 2 }; });

// ---------- UX-06 + QA-04 ----------
for (const [w, h] of [[1440, 900], [375, 812]]) {
  const key = `${w}x${h}`;
  const { ctx, page, errors } = await fresh(browser, { width: w, height: h });
  const r = {};
  r.productBefore = { ...(await stageState(page)), wood: await wood(page) };
  await toRoom(page); await page.waitForTimeout(900);
  r.emptyRoom = { ...(await stageState(page)), wood: await wood(page) };
  r.card = await page.evaluate(() => {
    const e = document.getElementById('stage-empty'); const c = e.querySelector('.stage-empty-card').getBoundingClientRect(); const st = document.querySelector('.stage').getBoundingClientRect();
    const tb = document.querySelector('.stage-toolbar').getBoundingClientRect(); const hint = document.getElementById('stage-hint').getBoundingClientRect();
    return { title: document.getElementById('stage-empty-title').textContent, body: document.getElementById('stage-empty-body').textContent,
      buttons: [...e.querySelectorAll('button')].map((b) => ({ action: b.dataset.emptyAction, text: b.textContent, h: Math.round(b.getBoundingClientRect().height), w: Math.round(b.getBoundingClientRect().width) })),
      insideStage: c.left >= st.left && c.right <= st.right && c.top >= st.top && c.bottom <= st.bottom,
      clearOfToolbar: c.top >= tb.bottom, clearOfHint: c.bottom <= hint.top, cardRect: [Math.round(c.left - st.left), Math.round(c.top - st.top), Math.round(c.width), Math.round(c.height)], stage: [Math.round(st.width), Math.round(st.height)],
      overflowX: document.documentElement.scrollWidth - innerWidth, hiddenButDisplayed: [...document.querySelectorAll('[hidden]')].filter((el) => getComputedStyle(el).display !== 'none').map((el) => el.id || el.tagName) };
  });
  await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(300);
  await page.screenshot({ path: `${SHOTS}/empty-room-card-${key}.png` });
  // three starts (real clicks)
  r.starts = {};
  for (const action of ['import', 'template', 'scratch']) {
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.click(`#stage-empty button[data-empty-action=${action}]`); await page.waitForTimeout(400);
    r.starts[action] = await page.evaluate((action) => { const tab = document.querySelector(`#room-ingress button[data-ingress="${action}"]`); const tr = tab.getBoundingClientRect(); const panel = document.querySelector('.panel').getBoundingClientRect();
      return { ingress: document.body.dataset.roomIngress, sectionShown: !!document.getElementById(`room-ingress-${action}`).getClientRects().length, tabChecked: tab.getAttribute('aria-checked'), focusOnTab: document.activeElement === tab, tabInViewport: tr.top >= 0 && tr.bottom <= innerHeight, tabInPanel: tr.top >= panel.top - 1, cardStillShown: !!document.getElementById('stage-empty').getClientRects().length }; }, action);
  }
  // Product is unaffected
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.click('#workspace-mode button[data-mode=catalog]'); await page.waitForTimeout(900);
  r.productAfter = { ...(await stageState(page)), wood: await wood(page) };
  // QA-04: export from a room with one placed product, in ANOTHER context; open it here from the card
  r.errors = errors.slice();
  out[key] = r;
  await ctx.close();
}

// QA-04 round trip
{
  const a = await fresh(browser);
  await toRoom(a.page); await createRoom(a.page);
  await a.page.click('#btn-place-mode');
  await placeReal(a.page, 0.8, -0.5);
  await a.page.waitForFunction(() => window.__rv.roomGraph().placements.length === 1);
  const [dl] = await Promise.all([a.page.waitForEvent('download'), a.page.click('#btn-export-project')]);
  const file = `${OUT}/exported-project.json`;
  await dl.saveAs(file);
  const exported = JSON.parse(fs.readFileSync(file, 'utf8'));
  await a.ctx.close();

  const b = await fresh(browser);
  await toRoom(b.page); await b.page.waitForTimeout(500);
  const visibleBefore = await b.page.locator('#btn-import-project').isVisible();
  const [chooser] = await Promise.all([b.page.waitForEvent('filechooser'), b.page.click('#stage-empty button[data-empty-action=project]')]);
  await chooser.setFiles(file);
  await b.page.waitForFunction(() => (window.__rv.roomGraph()?.placements.length ?? 0) === 1, null, { timeout: 15000 });
  await b.page.waitForFunction(() => { const v = window.__rv.viewer(); const id = window.__rv.roomGraph().placements[0].id; return !!v.getPlacementRoot(id); }, null, { timeout: 20000 });
  const st = await stageState(b.page);
  out.QA04 = { exportedPlacements: exported.room_graph.placements.length, exportedLabel: exported.label ?? null, panelImportButtonVisibleWithNoRoom: visibleBefore, chooserOpenedFromCard: true,
    restored: await placements(b.page), meshInScene: await b.page.evaluate(() => { const v = window.__rv.viewer(); const root = v.getPlacementRoot(window.__rv.roomGraph().placements[0].id); let n = 0; root.traverse((o) => o.isMesh && n++); return { meshes: n, visible: v.placementsRoot.visible }; }),
    after: st, errors: b.errors };
  await b.page.screenshot({ path: `${SHOTS}/qa04-project-opened-from-card-1440x900.png` });
  // bad file from the card of a fresh context -> error toast on the stage, nothing changes
  const c = await fresh(browser);
  await toRoom(c.page);
  const bad = `${OUT}/not-a-project.json`; fs.writeFileSync(bad, '{"hello": 1}');
  const [ch2] = await Promise.all([c.page.waitForEvent('filechooser'), c.page.click('#stage-empty button[data-empty-action=project]')]);
  await ch2.setFiles(bad); await c.page.waitForTimeout(600);
  const st2 = await stageState(c.page);
  out.QA04_badFile = { toast: st2.toast, kind: st2.toastKind, role: await c.page.evaluate(() => document.querySelector('.stage-toast-text').getAttribute('role')), roomStatus: st2.roomStatus, hasRoom: st2.hasRoom };
  await c.page.screenshot({ path: `${SHOTS}/toast-error-import-1440x900.png` });
  await b.ctx.close(); await c.ctx.close();
}

fs.writeFileSync(`${OUT}/after1.json`, JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 1));
await browser.close();
