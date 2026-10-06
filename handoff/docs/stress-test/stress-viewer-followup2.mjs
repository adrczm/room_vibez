import { chromium } from '../../hackathon-3d-viewer/node_modules/playwright/index.mjs';
const BASE = 'http://127.0.0.1:18767/';
const browser = await chromium.launch({ channel: 'chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const waitReady = (page, ms = 15000) => page.waitForFunction(() => document.body.getAttribute('data-viewer-status') === 'ready', null, { timeout: ms }).then(() => true).catch(() => false);
const log = (id, o) => console.log(id, '|', JSON.stringify(o));
const fresh = async (init) => { const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } }); const page = await ctx.newPage(); const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('dialog', (d) => d.dismiss()); await page.goto(BASE); await waitReady(page); return { ctx, page, errs }; };
const geom = (page) => page.evaluate(() => { const g = window.__rv.roomGraph(); if (!g) return null; const r = (n) => Math.round(n * 1000) / 1000; return JSON.stringify({ walls: g.walls.map((w) => [r(w.a.x), r(w.a.z), r(w.b.x), r(w.b.z), r(w.thickness)]).sort(), poly: g.rooms[0].floor_polygon.map((p) => [r(p.x), r(p.z)]), h: g.rooms[0].ceiling_height }); });

// (F4a removed: Playwright fill() cannot type non-numeric text into <input type=number>; a real browser blocks it too.)

// F4c non-Latin / spaced / long file names on model + project uploads (use a valid tiny OBJ)
{ const { ctx, page, errs } = await fresh();
  const obj = 'v 0 0 0\nv 1 0 0\nv 0 1 0\nf 1 2 3\n';
  const names = ['客厅 沙发.obj', 'كرسي.obj', 'café table (final) v2.obj', 'a'.repeat(200) + '.obj'];
  const out = [];
  for (const n of names) {
    await page.setInputFiles('#model-files', { name: n, mimeType: 'text/plain', buffer: Buffer.from(obj) }); await page.waitForTimeout(800);
    out.push({ file: n.slice(0, 24), msg: (await page.locator('#model-upload-status').innerText()).slice(0, 90), optionLabel: (await page.locator('#product-select option:checked').innerText()).slice(0, 50) });
  }
  log('F4c', { out, errs: errs.slice(0, 2) }); await ctx.close(); }

// F5: formats the docs say are blocked / not built, via the plan + model inputs
{ const { ctx, page } = await fresh(); await page.locator('#workspace-mode button[data-mode=room]').click();
  await page.locator('#room-ingress button:has-text("Import")').first().click().catch(() => {});
  const out = [];
  for (const [n, mt] of [['plan.pdf', 'application/pdf'], ['plan.dxf', 'application/dxf'], ['plan.ifc', 'application/octet-stream']]) {
    await page.setInputFiles('#plan-file', { name: n, mimeType: mt, buffer: Buffer.from('%PDF-1.4 fake') }); await page.click('#btn-import-plan').catch(() => {}); await page.waitForTimeout(600);
    out.push({ file: n, importStatus: (await page.locator('#import-status').innerText()).slice(0, 170), underlayStatus: (await page.locator('#underlay-status').innerText().catch(() => '')).slice(0, 170) });
  }
  log('F5a', out);
  const acc = await page.locator('#model-files').getAttribute('accept');
  const out2 = [];
  for (const n of ['chair.fbx', 'chair.usdz', 'chair.blend', 'chair.dwg']) {
    await page.setInputFiles('#model-files', { name: n, mimeType: 'application/octet-stream', buffer: Buffer.from('x') }); await page.waitForTimeout(500);
    out2.push({ file: n, msg: (await page.locator('#model-upload-status').innerText()).slice(0, 150) });
  }
  log('F5b', { modelAccept: acc, out2 }); await ctx.close(); }

// F6: ingress parity - same 5x4 room through preset, custom(m), custom(cm), custom(ft)
{ const { ctx, page } = await fresh(); await page.locator('#workspace-mode button[data-mode=room]').click();
  await page.selectOption('#room-preset', 'living'); await page.click('#btn-create-room'); await page.waitForTimeout(300); const preset = await geom(page);
  await page.selectOption('#room-preset', 'custom'); await page.fill('#room-length', '5'); await page.fill('#room-width', '4'); await page.fill('#room-ceiling', '2.7'); await page.click('#btn-create-room'); await page.waitForTimeout(300); const custom = await geom(page);
  await page.selectOption('#room-units', 'cm').catch(() => {}); await page.fill('#room-length', '500'); await page.fill('#room-width', '400'); await page.fill('#room-ceiling', '270'); await page.click('#btn-create-room'); await page.waitForTimeout(300); const cm = await geom(page);
  log('F6', { presetEqualsCustomM: preset === custom, customMEqualsCm: custom === cm, presetGeom: preset?.slice(0, 120), cmGeom: cm?.slice(0, 120) });
  await ctx.close(); }

// F7: fixture import vs scratch parity (what the mock extract produces vs 5x4)
{ const { ctx, page } = await fresh(); await page.locator('#workspace-mode button[data-mode=room]').click();
  await page.selectOption('#room-preset', 'living'); await page.click('#btn-create-room'); await page.waitForTimeout(300); const scratch = await geom(page);
  await page.locator('#room-ingress button:has-text("Import")').first().click().catch(() => {});
  await page.click('#btn-import-fixture').catch(() => {}); await page.waitForTimeout(500);
  await page.click('#btn-import-start-editing').catch(() => {}); await page.waitForTimeout(500);
  const imported = await geom(page);
  log('F7', { scratchEqualsFixtureImport: scratch === imported, importedGeom: imported?.slice(0, 140), scratchGeom: scratch?.slice(0, 140) });
  await ctx.close(); }
await browser.close();
