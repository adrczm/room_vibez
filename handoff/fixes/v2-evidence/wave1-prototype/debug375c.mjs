import { pathToFileURL } from 'node:url';
import { chromium } from '/Users/adrian/Desktop/Room Vibez/v2/hackathon-3d-viewer/node_modules/playwright/index.mjs';
const URL_ = pathToFileURL(process.argv[2]).href;
const browser = await chromium.launch({ channel: 'chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
for (let i = 0; i < 3; i++) {
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 } });
  const page = await ctx.newPage(); await page.goto(URL_); await page.waitForTimeout(600);
  await page.click('.role-card[data-role=designer]');
  try { await page.click('#btnContinueAuth', { timeout: 5000 }); console.log(i, 'click OK'); }
  catch (e) {
    const info = await page.evaluate(() => { const b = document.getElementById('btnContinueAuth'); const r = b.getBoundingClientRect(); const pts = [[r.left + r.width / 2, r.top + r.height / 2]]; const e = document.elementFromPoint(...pts[0]); const g = document.querySelector('.role-grid').getBoundingClientRect(); return { scrollX, scrollY, rect: [r.left, r.top, r.width, r.height].map(Math.round), grid: [g.left, g.top, g.width, g.height].map(Math.round), cards: [...document.querySelectorAll('.role-card[data-role]')].map((c) => { const q = c.getBoundingClientRect(); return [q.left, q.top, q.width, q.height].map(Math.round); }), hit: e ? e.tagName + '#' + e.id + ' ' + (e.innerText || '').slice(0, 30) : null, inner: [innerWidth, innerHeight], docScroll: [document.documentElement.scrollWidth, document.documentElement.scrollHeight] }; });
    console.log(i, 'click FAILED', JSON.stringify(info));
    await page.screenshot({ path: new URL('./out/debug375c-fail.png', import.meta.url).pathname });
  }
  await ctx.close();
}
await browser.close();
