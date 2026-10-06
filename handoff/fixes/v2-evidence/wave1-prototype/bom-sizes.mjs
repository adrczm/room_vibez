// Which element carries the extra font size on the parts list screen in the audit's timing (500 ms after opening it)?
import { pathToFileURL } from 'node:url';
import { chromium } from '/Users/adrian/Desktop/Room Vibez/v2/hackathon-3d-viewer/node_modules/playwright/index.mjs';
const URL_ = pathToFileURL('/Users/adrian/Desktop/Room Vibez/v2/prototypes/room-vibez-planner-flows/index.html').href;
const browser = await chromium.launch({ channel: 'chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } }); const page = await ctx.newPage(); await page.goto(URL_); await page.waitForTimeout(1500);
await page.click('#btnSkipDemo'); await page.waitForTimeout(900); await page.click('#btnOpenBom'); await page.waitForTimeout(500);
const sizes = () => page.evaluate(() => { const vis = (el) => el.getClientRects().length > 0 && el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }); const o = {}; for (const e of document.querySelectorAll('body *')) { if (!vis(e) || e.closest('svg') || ![...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue; const k = parseFloat(getComputedStyle(e).fontSize).toFixed(1); (o[k] ||= []).push(e.id || e.className || e.tagName); } return Object.fromEntries(Object.entries(o).map(([k, v]) => [k, v.length + ' e.g. ' + [...new Set(v)].slice(0, 3).join(', ')])); });
console.log('500 ms after opening (toast still showing):', JSON.stringify(await sizes()));
await page.waitForTimeout(2600);
console.log('after the toast has faded:               ', JSON.stringify(await sizes()));
await browser.close();
