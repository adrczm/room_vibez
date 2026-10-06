import { chromium } from '/Users/adrian/Desktop/Room Vibez/v2/hackathon-3d-viewer/node_modules/playwright/index.mjs';
import { readFileSync } from 'node:fs';
const svg = readFileSync('plan.svg', 'utf8');
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1200, height: 1000 }, deviceScaleFactor: 1 });
await page.setContent(`<body style="margin:0">${svg}</body>`);
await page.screenshot({ path: 'T3-floor-plan-6.0x4.5m.png', clip: { x: 0, y: 0, width: 1200, height: 1000 } });
await browser.close();
