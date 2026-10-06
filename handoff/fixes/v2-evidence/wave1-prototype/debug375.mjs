import { pathToFileURL } from 'node:url';
import { chromium } from '/Users/adrian/Desktop/Room Vibez/v2/hackathon-3d-viewer/node_modules/playwright/index.mjs';
const URL_ = pathToFileURL(process.argv[2]).href;
const browser = await chromium.launch({ channel: 'chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
for (const mobile of [false, true]) {
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, ...(mobile ? { hasTouch: true, isMobile: true, deviceScaleFactor: 2 } : {}) });
  const page = await ctx.newPage(); await page.goto(URL_); await page.waitForTimeout(800);
  const dump = () => page.evaluate(() => { const r = (s) => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return [Math.round(b.left), Math.round(b.top), Math.round(b.width), Math.round(b.height)]; }; return { innerWidth, innerHeight, docScrollW: document.documentElement.scrollWidth, docScrollH: document.documentElement.scrollHeight, bodyH: document.body.getBoundingClientRect().height, shell: r('.app-shell'), topbar: r('.topbar'), topbarScrollW: document.querySelector('.topbar').scrollWidth, main: r('.main'), screen: r('.screen.active'), compose: r('.screen.active .compose'), grid: r('.screen.active .role-grid'), cards: [...document.querySelectorAll('.screen.active .role-card')].map((e) => { const b = e.getBoundingClientRect(); return [Math.round(b.left), Math.round(b.top), Math.round(b.width), Math.round(b.height)]; }), row: r('.screen.active .compose > .row'), cont: r('#btnContinueAuth'), skip: r('#btnSkipDemo'), topbarKids: [...document.querySelector('.topbar').children].map((e) => { const b = e.getBoundingClientRect(); return `${e.className}:${Math.round(b.left)}-${Math.round(b.right)}`; }) }; });
  console.log(mobile ? 'MOBILE EMU' : 'PLAIN 375', JSON.stringify(await dump()));
  await page.evaluate(() => document.querySelector('.role-card[data-role=designer]').click());
  await page.evaluate(() => document.getElementById('btnSkipDemo').click()); await page.waitForTimeout(500);
  console.log(' editor', JSON.stringify(await page.evaluate(() => ({ innerWidth, docScrollW: document.documentElement.scrollWidth, offenders: [...document.querySelectorAll('body *')].filter((e) => e.getClientRects().length && e.getBoundingClientRect().right > innerWidth + 1).map((e) => `${e.tagName.toLowerCase()}${e.id ? '#' + e.id : ''}${typeof e.className === 'string' && e.className ? '.' + e.className.trim().split(/\s+/).join('.') : ''} ${Math.round(e.getBoundingClientRect().left)}-${Math.round(e.getBoundingClientRect().right)}`).slice(0, 14), topbarKids: [...document.querySelector('.topbar').children].map((e) => { const b = e.getBoundingClientRect(); return `${e.className}:${Math.round(b.left)}-${Math.round(b.right)}`; }) }))));
  await ctx.close();
}
await browser.close();
