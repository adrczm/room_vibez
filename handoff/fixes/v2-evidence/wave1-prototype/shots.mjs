// Screenshots of the five screens and the ? pop-up at 1280x800 and 375 wide. Output: ./shots/
import { pathToFileURL } from 'node:url';
import { chromium } from '/Users/adrian/Desktop/Room Vibez/v2/hackathon-3d-viewer/node_modules/playwright/index.mjs';
const URL_ = pathToFileURL(process.argv[2] || '/Users/adrian/Desktop/Room Vibez/v2/prototypes/room-vibez-planner-flows/index.html').href;
const SHOTS = new URL('./shots/', import.meta.url).pathname;
const browser = await chromium.launch({ channel: 'chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const log = [];
for (const [tag, viewport] of [['1280x800', { width: 1280, height: 800 }], ['375', { width: 375, height: 812 }]]) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: tag === '375' ? 2 : 1 });
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(URL_); await page.waitForTimeout(1200);
  const shot = async (name, opts = {}) => { const m = await page.evaluate(() => ({ screen: document.querySelector('.screen.active')?.id, overflowX: document.documentElement.scrollWidth - innerWidth, innerWidth })); await page.screenshot({ path: `${SHOTS}${name}-${tag}.png`, fullPage: !!opts.full }); log.push(`${name}-${tag}.png  screen=${m.screen} innerWidth=${m.innerWidth} overflowX=${m.overflowX}`); };
  const toastGone = () => page.waitForFunction(() => !document.getElementById('toast').classList.contains('show'), null, { timeout: 5000 }).catch(() => {});
  // 1 Role
  await shot('1-role', { full: tag === '375' });
  // ? pop-up, all four tabs (opened from the keyboard)
  await page.focus('#btnHelp'); await page.keyboard.press('Enter'); await page.waitForTimeout(250);
  await shot('help-1-walkthrough');
  await page.focus('#helpTab-walkthrough');
  for (const n of ['help-2-roles', 'help-3-whats-simulated', 'help-4-why']) { await page.keyboard.press('ArrowRight'); await page.waitForTimeout(120); await shot(n); }
  await page.keyboard.press('Home'); await page.keyboard.press('Escape');
  await page.click('.role-card[data-role=architect]');
  await shot('1-role-architect-picked', { full: tag === '375' });
  // 2 Project
  await page.click('#btnContinueAuth'); await page.waitForTimeout(150);
  await shot('2-project', { full: tag === '375' });
  await page.fill('#projectName', 'Living room'); await page.click('#tplStarter'); await page.click('#btnCreateProject');
  await page.waitForTimeout(350);
  // 3 Plan
  await shot('3-plan-before-file-toast', { full: false });
  await toastGone();
  await shot('3-plan-before-file', { full: tag === '375' });
  await page.click('.file-chip[data-fmt=DWG]'); await page.waitForTimeout(500);
  await shot('3-plan-reading', { full: tag === '375' });
  await page.locator('#confirmCard').waitFor({ state: 'visible', timeout: 8000 }); await page.waitForTimeout(400);
  await shot('3-plan-result', { full: tag === '375' });
  await page.check('#confirmDims'); await page.click('#btnConfirmPlan'); await page.waitForTimeout(300);
  // 4 Edit
  await toastGone();
  await page.click('.catalog-item[data-sku="TABLE-OAK-02"]'); await page.locator('#planSvg').click({ position: tag === '375' ? { x: 230, y: 250 } : { x: 470, y: 330 } });
  await page.click('.catalog-item[data-sku="CHAIR-LOFT-01"]'); await page.locator('#planSvg').click({ position: tag === '375' ? { x: 120, y: 240 } : { x: 260, y: 330 } });
  await page.click('#btnApplyTemplate'); await toastGone();
  await page.evaluate(() => scrollTo(0, 0));
  await shot('4-edit', { full: tag === '375' });
  await page.click('#btnRenderPreset'); await page.waitForTimeout(350);
  await shot('4-edit-render-style-toast');
  await toastGone();
  await page.click('.mode-toggle button[data-mode="3d"]'); await page.waitForTimeout(1200);
  await shot('4-edit-3d', { full: tag === '375' });
  await page.click('.mode-toggle button[data-mode="2d"]');
  // 5 Parts list
  await page.evaluate(() => document.getElementById('btnOpenBom').scrollIntoView()); await page.click('#btnOpenBom'); await page.waitForTimeout(200);
  await page.evaluate(() => scrollTo(0, 0));
  await shot('5-parts-list', { full: tag === '375' });
  await page.click('#btnExportPdf'); await page.waitForTimeout(350);
  await shot('5-parts-list-export-toast');
  await toastGone();
  await page.click('#btnRestart'); await page.waitForTimeout(250);
  await shot('5-start-over-confirm');
  await page.keyboard.press('Escape');
  log.push(`  page errors (${tag}): ${JSON.stringify(errors)}`);
  await ctx.close();
}
await browser.close();
console.log(log.join('\n'));
