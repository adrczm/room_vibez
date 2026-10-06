// Acceptance line, before and after: count research-label matches in document.body.innerText on each of the five screens. Works on both copies (DOM clicks, shared ids only).
import { pathToFileURL } from 'node:url';
import { chromium } from '/Users/adrian/Desktop/Room Vibez/v2/hackathon-3d-viewer/node_modules/playwright/index.mjs';
const URL_ = pathToFileURL(process.argv[2]).href;
const RX = 'Unknown \\/ not in public|Partial \\/ beta in public|\\bstub\\b|\\(owned\\)|\\bCMS\\b|Planner BOM manager';
const browser = await chromium.launch({ channel: 'chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } }); const page = await ctx.newPage(); await page.goto(URL_); await page.waitForTimeout(900);
const count = (name) => page.evaluate(([rx, name]) => { const t = document.body.innerText; const m = t.match(new RegExp(rx, 'gi')) || []; return `${name.padEnd(14)} matches=${String(m.length).padEnd(3)} disabledControls=${[...document.querySelectorAll('.screen.active :disabled')].filter((e) => e.getClientRects().length).length}  BOM/Cart/furniture words=${(t.match(/\bBOM\b|\bCart\b|furniture/gi) || []).length}  ${[...new Set(m)].join(' | ')}`; }, [RX, name]);
const dom = (sel) => page.evaluate((s) => document.querySelector(s).click(), sel);
const out = [];
await dom('.role-card[data-role=architect]'); out.push(await count('1 role'));
await dom('#btnContinueAuth'); out.push(await count('2 project'));
await dom('#tplStarter'); await dom('#btnCreateProject'); await dom('.file-chip[data-fmt=DWG]'); await page.locator('#confirmCard').waitFor({ state: 'visible', timeout: 8000 }); out.push(await count('3 plan'));
await page.evaluate(() => { document.getElementById('confirmDims').click(); document.getElementById('btnConfirmPlan').click(); }); await page.waitForTimeout(2600); out.push(await count('4 edit'));
await dom('#btnOpenBom'); out.push(await count('5 parts list'));
console.log(out.join('\n'));
await browser.close();
