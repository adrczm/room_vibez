// Toast click-through: is a floor point under the open toast, and does a real click there place a product?
import { launch, fresh } from './lib.mjs';
const browser = await launch();
for (const [name, viewport] of [['375x812', { width: 375, height: 812 }], ['1440x900', { width: 1440, height: 900 }]]) {
  const { ctx, page, errors } = await fresh(browser, { viewport });
  await page.click('#workspace-mode button[data-mode=room]');
  await page.selectOption('#room-preset', 'living');
  await page.click('#btn-create-room');
  await page.waitForFunction(() => !!window.__rv.roomGraph());
  await page.waitForTimeout(1500);
  await page.click('.step[data-step=place] .step-toggle');
  await page.click('#btn-place-mode');
  await page.evaluate(() => scrollTo(0, 0));
  await page.waitForTimeout(300);
  await page.evaluate(() => window.__rv.simulateRoomPointer(null, 'place'));
  await page.waitForTimeout(400);
  const scan = await page.evaluate(() => {
    const v = window.__rv.viewer();
    const t = document.getElementById('stage-toast').getBoundingClientRect();
    const text = document.querySelector('#stage-toast .stage-toast-text').getBoundingClientRect();
    const pts = [];
    for (let j = 0; j < 6; j++) for (let i = 0; i < 12; i++) {
      const x = text.left + ((i + 0.5) / 12) * text.width, y = text.top + ((j + 0.5) / 6) * text.height;
      const h = v.raycastRoom(x, y);
      const top = document.elementFromPoint(x, y);
      pts.push({ x, y, kind: h?.kind ?? null, top: top?.tagName + (top?.id ? '#' + top.id : '') + (top?.className && typeof top.className === 'string' ? '.' + top.className : '') });
    }
    return { toast: { l: Math.round(t.left), t: Math.round(t.top), w: Math.round(t.width), h: Math.round(t.height) }, open: document.getElementById('stage-toast').dataset.open, floorPts: pts.filter((p) => p.kind === 'floor').length, tops: [...new Set(pts.map((p) => p.top))], firstFloor: pts.find((p) => p.kind === 'floor') ?? null, anyPt: pts[0] };
  });
  console.log(name, JSON.stringify(scan));
  const target = scan.firstFloor ?? scan.anyPt;
  await page.mouse.click(target.x, target.y);
  await page.waitForTimeout(2500);
  console.log(name, 'clicked', scan.firstFloor ? 'floor under toast' : 'void under toast', '→ placements:', await page.evaluate(() => window.__rv.roomGraph().placements.length), 'toast:', await page.evaluate(() => document.querySelector('#stage-toast .stage-toast-text').textContent));
  // The close button still works.
  const before = await page.evaluate(() => window.__rv.roomGraph().placements.length);
  await page.click('#stage-toast .stage-toast-close');
  await page.waitForTimeout(600);
  console.log(name, 'after close click: open =', await page.evaluate(() => document.getElementById('stage-toast').dataset.open), 'placements', before, '→', await page.evaluate(() => window.__rv.roomGraph().placements.length));
  console.log(name, 'errors', errors);
  await ctx.close();
}
await browser.close();
