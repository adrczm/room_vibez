// Reproduce the three state bugs (and two side checks) on a given prototype copy.
// usage: node repro-base.mjs <path-to-index.html> <label>
import { pathToFileURL } from 'node:url';
import { writeFileSync } from 'node:fs';
import { chromium } from '/Users/adrian/Desktop/Room Vibez/v2/hackathon-3d-viewer/node_modules/playwright/index.mjs';
const target = process.argv[2]; const label = process.argv[3] || 'base';
const URL_ = pathToFileURL(target).href;
const out = {};
const browser = await chromium.launch({ channel: 'chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
async function fresh(viewport = { width: 1280, height: 800 }, mobile = false) {
  const ctx = await browser.newContext({ viewport, ...(mobile ? { hasTouch: true, isMobile: true, deviceScaleFactor: 2 } : {}) });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('dialog', (d) => { errors.push('DIALOG:' + d.type() + ':' + d.message()); d.dismiss(); });
  await page.goto(URL_);
  await page.waitForTimeout(600);
  return { ctx, page, errors };
}
const active = (page) => page.evaluate(() => document.querySelector('.screen.active')?.id);
const manualSel = async (page) => (await page.locator('#btnManualOnly').count()) ? '#btnManualOnly' : '#btnManualDraw';
async function toUpload(page, role = 'consumer') {
  await page.click(`.role-card[data-role=${role}]`); await page.click('#btnContinueAuth'); await page.click('#tplBlank'); await page.click('#btnCreateProject');
}
// Bug 1 (R2 / P05): tick survives a new file choice, confirm button stays enabled
{ const { ctx, page } = await fresh();
  await toUpload(page);
  await page.click('.file-chip[data-fmt=DWG]'); await page.locator('#confirmCard').waitFor({ state: 'visible', timeout: 8000 });
  const before = { checked: await page.locator('#confirmDims').isChecked(), confirmEnabled: await page.locator('#btnConfirmPlan').isEnabled() };
  await page.check('#confirmDims');
  const ticked = { checked: await page.locator('#confirmDims').isChecked(), confirmEnabled: await page.locator('#btnConfirmPlan').isEnabled() };
  await page.click('.file-chip[data-fmt=PNG]');
  const during = { cardHidden: await page.locator('#confirmCard').isHidden(), checked: await page.locator('#confirmDims').isChecked(), confirmDisabledProp: await page.evaluate(() => document.getElementById('btnConfirmPlan').disabled) };
  await page.locator('#confirmCard').waitFor({ state: 'visible', timeout: 8000 });
  const afterChip = { checked: await page.locator('#confirmDims').isChecked(), confirmEnabled: await page.locator('#btnConfirmPlan').isEnabled() };
  // same again through the real file input
  await page.check('#confirmDims');
  await page.setInputFiles('#fileInput', { name: 'another-plan.pdf', mimeType: 'application/pdf', buffer: Buffer.from('x') });
  await page.locator('#confirmCard').waitFor({ state: 'visible', timeout: 8000 });
  const afterFileInput = { checked: await page.locator('#confirmDims').isChecked(), confirmEnabled: await page.locator('#btnConfirmPlan').isEnabled(), status: await page.locator('#aiStatus').innerText() };
  out.bug1_confirmTick = { before, ticked, during, afterChip, afterFileInput };
  await ctx.close(); }
// Bug 2 (K3 / P25): skip-to-demo overrides chosen role
{ const res = {};
  for (const role of ['consumer', 'designer', 'architect', 'reseller', null]) {
    const { ctx, page } = await fresh();
    if (role) await page.click(`.role-card[data-role=${role}]`);
    const pillBefore = await page.locator('#rolePill').innerText();
    await page.click('#btnSkipDemo'); await page.waitForTimeout(300);
    res[role ?? 'none'] = { pillBefore, pillAfter: await page.locator('#rolePill').innerText(), screen: await active(page), toast: await page.locator('#toast').textContent(), selectedCard: await page.evaluate(() => document.querySelector('.role-card[data-role].selected')?.dataset.role ?? null) };
    await ctx.close();
  }
  out.bug2_skipDemoRole = res; }
// Bug 3 (A9 / P24): starter template is not idempotent
{ const { ctx, page } = await fresh();
  await toUpload(page, 'designer'); await page.click(await manualSel(page)).catch(async () => { await page.click('.file-chip[data-fmt=PNG]'); await page.locator('#confirmCard').waitFor({ state: 'visible', timeout: 8000 }); await page.click('#btnManualDraw'); });
  await page.waitForTimeout(200);
  const counts = [await page.locator('#furnGroup > g').count()]; const labels = [await page.locator('#btnApplyTemplate').innerText()]; const totals = [await page.locator('#bomTotal').innerText()];
  for (let i = 0; i < 5; i++) { await page.locator('#btnApplyTemplate').click({ force: true }).catch(() => {}); counts.push(await page.locator('#furnGroup > g').count()); labels.push(await page.locator('#btnApplyTemplate').innerText()); totals.push(await page.locator('#bomTotal').innerText()); }
  out.bug3_starter = { furnitureCountAfterEachClick: counts, buttonLabelAfterEachClick: labels, totalAfterEachClick: totals, disabledAtEnd: await page.locator('#btnApplyTemplate').isDisabled(), toast: await page.locator('#toast').textContent() };
  await ctx.close(); }
// Side check: is the toast visible when it fires on a screen other than the editor?
{ const { ctx, page } = await fresh();
  await page.click('#btnSkipDemo'); await page.waitForTimeout(300); await page.click('#btnOpenBom'); await page.waitForTimeout(2600);
  await page.click('#btnExportPdf'); await page.waitForTimeout(350);
  out.side_toastOnBomScreen = await page.evaluate(() => { const t = document.getElementById('toast'); const r = t.getBoundingClientRect(); const cs = getComputedStyle(t); return { screen: document.querySelector('.screen.active')?.id, text: t.textContent, hasShowClass: t.classList.contains('show'), rects: t.getClientRects().length, box: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)], opacity: cs.opacity, inInnerText: document.body.innerText.includes(t.textContent) }; });
  await ctx.close(); }
// Side check: A1 keyboard on upload zone
{ const { ctx, page } = await fresh();
  await toUpload(page);
  await page.focus('#uploadZone');
  let enter = false, space = false;
  const p1 = page.waitForEvent('filechooser', { timeout: 1000 }).then(() => (enter = true)).catch(() => {});
  await page.keyboard.press('Enter'); await p1;
  const p2 = page.waitForEvent('filechooser', { timeout: 1000 }).then(() => (space = true)).catch(() => {});
  await page.keyboard.press('Space'); await p2;
  out.side_uploadZoneKeyboard = { enterOpensPicker: enter, spaceOpensPicker: space, label: await page.locator('#uploadZone strong').innerText() };
  await ctx.close(); }
// Side check: Start over
{ const { ctx, page, errors } = await fresh();
  await page.click('#btnSkipDemo'); await page.waitForTimeout(300); await page.click('#btnOpenBom');
  const cls = await page.locator('#btnRestart').getAttribute('class');
  await page.click('#btnRestart'); await page.waitForTimeout(600);
  out.side_startOver = { restartClass: cls, nativeDialogs: errors.filter((e) => e.startsWith('DIALOG')), htmlDialogOpen: await page.evaluate(() => !!document.querySelector('dialog[open]')), screenAfter: await active(page) };
  await ctx.close(); }
// Side check: overflow at 375 (plain viewport, like the stress test) and with mobile emulation (like the QA audit)
for (const mobile of [false, true]) {
  const { ctx, page } = await fresh({ width: 375, height: 812 }, mobile);
  const m = async () => page.evaluate(() => ({ screen: document.querySelector('.screen.active')?.id, innerWidth, scrollWidth: document.documentElement.scrollWidth, overflowX: document.documentElement.scrollWidth - innerWidth, offenders: [...document.querySelectorAll('body *')].filter((e) => e.getClientRects().length && e.getBoundingClientRect().right > innerWidth + 1).map((e) => `${e.tagName.toLowerCase()}${e.id ? '#' + e.id : ''}${typeof e.className === 'string' && e.className ? '.' + e.className.trim().split(/\s+/).join('.') : ''} right=${Math.round(e.getBoundingClientRect().right)}`).slice(0, 10) }));
  const r = { auth: await m() };
  // DOM clicks here: with mobile emulation and a page wider than the device, Playwright's pointer clicks miss (the QA audit hit the same thing).
  const dom = (sel) => page.evaluate((s) => document.querySelector(s).click(), sel);
  await dom('.role-card[data-role=designer]'); await dom('#btnContinueAuth'); r.project = await m();
  await dom('#btnCreateProject'); r.upload = await m();
  // can a real pointer click reach Back on this screen?
  try { await page.click('#btnBackProject', { timeout: 4000 }); r.realPointerClickWorks = (await active(page)) === 'screen-project'; } catch { r.realPointerClickWorks = false; }
  await page.evaluate(() => document.getElementById('btnSkipDemo').click()); await page.waitForTimeout(400); r.editor = await m();
  await page.evaluate(() => document.getElementById('btnOpenBom').click()); await page.waitForTimeout(200); r.bom = await m();
  out[mobile ? 'side_overflow375_mobileEmulation' : 'side_overflow375_plainViewport'] = r;
  await ctx.close();
}
await browser.close();
writeFileSync(new URL(`./out/repro-${label}.json`, import.meta.url), JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 1));
