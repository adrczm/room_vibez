// Responsive sanity: overflowX and top-bar height at many widths in both workspaces; scroll sampling (QA-15);
// model top vs stage toolbar at 375; sticky toolbar screenshots.
import { launch, fresh, OUT } from './lib.mjs';
const browser = await launch();
const rows = [];
for (const [w, h] of [[320, 568], [375, 812], [390, 844], [720, 900], [721, 900], [800, 900], [860, 900], [861, 900], [1024, 768], [1280, 800], [1440, 900], [1920, 1080]]) {
  const { ctx, page, errors } = await fresh(browser, { viewport: { width: w, height: h }, settle: 800 });
  const snap = () => page.evaluate(() => ({
    ovX: document.documentElement.scrollWidth - innerWidth,
    topbar: Math.round(document.querySelector('.topbar').getBoundingClientRect().height),
    stageToolbarH: Math.round(document.querySelector('.stage-toolbar').getBoundingClientRect().height),
    roomToolbarH: Math.round(document.getElementById('room-toolbar').getBoundingClientRect().height),
    panelOvX: document.querySelector('.panel').scrollWidth - document.querySelector('.panel').clientWidth,
  }));
  const product = await snap();
  await page.click('#workspace-mode button[data-mode=room]');
  await page.waitForTimeout(400);
  const roomEmpty = await snap();
  const cardClear = await page.evaluate(() => { const c = document.querySelector('.stage-empty-card').getBoundingClientRect(), t = document.querySelector('.stage-toolbar').getBoundingClientRect(), hnt = document.getElementById('stage-hint').getBoundingClientRect(), s = document.querySelector('.stage').getBoundingClientRect(); return { belowToolbar: c.top >= t.bottom, aboveHint: c.bottom <= hnt.top, inside: c.top >= s.top && c.bottom <= s.bottom && c.left >= s.left && c.right <= s.right }; });
  await page.selectOption('#room-preset', 'living');
  await page.click('#btn-create-room');
  await page.waitForFunction(() => !!window.__rv.roomGraph());
  await page.waitForTimeout(600);
  const room = await snap();
  rows.push({ size: `${w}x${h}`, productOvX: product.ovX, roomEmptyOvX: roomEmpty.ovX, roomOvX: room.ovX, panelOvX: [product.panelOvX, roomEmpty.panelOvX, room.panelOvX].join('/'), topbarProduct: product.topbar, topbarRoom: room.topbar, stageToolbarH: product.stageToolbarH, roomToolbarH: `${roomEmpty.roomToolbarH}/${room.roomToolbarH}`, emptyCard: JSON.stringify(cardClear), errors: errors.length });
  if (w === 800 || w === 1024) await page.screenshot({ path: `${OUT}/shots/extra-${w}-room-created.png` });
  await ctx.close();
}
console.table(rows);

// QA-15: scroll positions sampled every frame across a workspace switch (reduced motion on and off).
for (const reducedMotion of ['reduce', 'no-preference']) {
  const { ctx, page } = await fresh(browser, { viewport: { width: 1440, height: 900 }, reducedMotion, settle: 800 });
  const samples = await page.evaluate(async () => {
    const p = document.querySelector('.panel');
    p.scrollTo({ top: 300, behavior: 'instant' });
    await new Promise((r) => setTimeout(r, 200));
    const seen = [Math.round(p.scrollTop)];
    document.querySelector('#workspace-mode button[data-mode=room]').click();
    for (let i = 0; i < 40; i++) { seen.push(Math.round(p.scrollTop)); await new Promise((r) => requestAnimationFrame(r)); }
    return [...new Set(seen)];
  });
  console.log('QA-15', reducedMotion, 'distinct panel scroll positions across a switch:', samples);
  await ctx.close();
}

// 375: where the framed chair's top is against the stage toolbar; and the sticky room toolbar while scrolled.
{
  const { ctx, page } = await fresh(browser, { viewport: { width: 375, height: 812 }, mobile: true, settle: 1500 });
  const m = await page.evaluate(() => {
    const v = window.__rv.viewer();
    const root = v.getModelRoot();
    const Vec = v.camera.position.constructor;
    root.updateMatrixWorld(true);
    let minY = Infinity;
    const r = v.canvas.getBoundingClientRect();
    root.traverse((o) => { if (!o.isMesh) return; o.geometry.computeBoundingBox(); const b = o.geometry.boundingBox; for (const x of [b.min.x, b.max.x]) for (const y of [b.min.y, b.max.y]) for (const z of [b.min.z, b.max.z]) { const p = new Vec(x, y, z).applyMatrix4(o.matrixWorld).project(v.camera); minY = Math.min(minY, r.top + ((1 - p.y) / 2) * r.height); } });
    const s = document.querySelector('.stage').getBoundingClientRect();
    const t = document.querySelector('.stage-toolbar').getBoundingClientRect();
    const firstRowBottom = document.getElementById('btn-reset').getBoundingClientRect().bottom;
    return { modelTopInStage: Math.round(minY - s.top), toolbarBottomInStage: Math.round(t.bottom - s.top), firstRowBottomInStage: Math.round(firstRowBottom - s.top), stageH: Math.round(s.height) };
  });
  console.log('375 model top vs toolbar:', m);
  await page.locator('#workspace-mode button[data-mode=room]').tap();
  await page.selectOption('#room-preset', 'living');
  await page.locator('#btn-create-room').tap();
  await page.waitForFunction(() => !!window.__rv.roomGraph());
  await page.waitForTimeout(800);
  await page.evaluate(() => scrollTo({ top: 900, behavior: 'instant' }));
  await page.waitForTimeout(300);
  console.log('375 scrolled 900: room toolbar top in viewport =', await page.evaluate(() => Math.round(document.getElementById('room-toolbar').getBoundingClientRect().top)), 'scrollY', await page.evaluate(() => Math.round(scrollY)));
  await page.screenshot({ path: `${OUT}/shots/extra-375-room-scrolled-sticky-toolbar.png` });
  await ctx.close();
}
await browser.close();
