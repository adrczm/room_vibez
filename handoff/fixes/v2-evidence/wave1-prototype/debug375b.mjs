import { pathToFileURL } from 'node:url';
import { chromium } from '/Users/adrian/Desktop/Room Vibez/v2/hackathon-3d-viewer/node_modules/playwright/index.mjs';
const URL_ = pathToFileURL(process.argv[2]).href;
const browser = await chromium.launch({ channel: 'chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: 375, height: 812 } });
const page = await ctx.newPage(); await page.goto(URL_); await page.waitForTimeout(800);
await page.click('.role-card[data-role=designer]');
await page.locator('#btnContinueAuth').scrollIntoViewIfNeeded();
await page.waitForTimeout(300);
const info = await page.evaluate(() => { const b = document.getElementById('btnContinueAuth'); const r = b.getBoundingClientRect(); const e = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return { scrollX, scrollY, rect: [r.left, r.top, r.width, r.height].map(Math.round), hit: e ? e.tagName + '#' + e.id + '.' + e.className + ' ' + (e.innerText || '').slice(0, 30) : null, vv: [visualViewport.width, visualViewport.height, visualViewport.offsetLeft, visualViewport.offsetTop, visualViewport.scale], inner: [innerWidth, innerHeight], docClient: [document.documentElement.clientWidth, document.documentElement.clientHeight] }; });
console.log(JSON.stringify(info));
await page.screenshot({ path: new URL('./out/debug375b-' + (process.argv[3] || 'base') + '.png', import.meta.url).pathname });
try { await page.click('#btnContinueAuth', { timeout: 4000 }); console.log('click OK ->', await page.evaluate(() => document.querySelector('.screen.active').id)); } catch (e) { console.log('click FAILED:', String(e.message).split('\n').slice(0, 9).join(' | ')); }
await browser.close();
