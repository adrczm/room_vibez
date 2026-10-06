import { fileURLToPath } from 'node:url';
// Stress script for prototypes/room-vibez-planner-flows (static click-through prototype).
// Writes only to ./out (screenshots + results.json). Uses an isolated Playwright profile (not the user's Chrome profile).
import { chromium } from '../../hackathon-3d-viewer/node_modules/playwright/index.mjs';
import { writeFileSync, mkdirSync } from 'node:fs';

const OUT = fileURLToPath(new URL('./out/proto', import.meta.url));
mkdirSync(OUT, { recursive: true });
const URL_ = new URL('../../prototypes/room-vibez-planner-flows/index.html', import.meta.url).href;
const results = [];
const rec = (id, name, observed) => { results.push({ id, name, observed }); console.log(id, '|', name, '|', JSON.stringify(observed)); };

const browser = await chromium.launch({ channel: 'chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });

async function fresh({ blockCdn = true, viewport = { width: 1280, height: 800 } } = {}) {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('dialog', (d) => { errors.push('DIALOG:' + d.type() + ':' + d.message()); d.dismiss(); });
  if (blockCdn) await page.route(/unpkg\.com|fonts\.g/, (r) => r.abort());
  await page.goto(URL_);
  return { ctx, page, errors };
}
const active = (page) => page.evaluate(() => document.querySelector('.screen.active')?.id);
async function toUpload(page, { role = 'consumer', tpl = false, name } = {}) {
  await page.click(`.role-card[data-role=${role}]`);
  await page.click('#btnContinueAuth');
  if (name !== undefined) await page.fill('#projectName', name);
  if (tpl) await page.click('#tplStarter'); else await page.click('#tplBlank');
  await page.click('#btnCreateProject');
}
async function toEditor(page, opts) { await toUpload(page, opts); await page.click('#btnManualOnly'); }

// P01 gate on role
{ const { ctx, page } = await fresh();
  rec('P01', 'Continue disabled until a role is chosen', { disabledAtStart: await page.locator('#btnContinueAuth').isDisabled() });
  // P02 email validation
  await page.fill('#email', 'not-an-email'); await page.click('.role-card[data-role=consumer]'); await page.click('#btnContinueAuth');
  rec('P02', 'Invalid email accepted?', { screenAfterContinue: await active(page), emailValue: 'not-an-email', note: 'no validation / no account created' });
  rec('P02b', 'Pill wording after role pick (no sign-in happened)', { rolePill: await page.locator('#rolePill').textContent() });
  await ctx.close(); }

// P25 skip-demo overrides chosen role
{ const { ctx, page } = await fresh();
  await page.click('.role-card[data-role=architect]'); await page.click('#btnSkipDemo');
  rec('P25', 'Pick Architect then "Open demo project"', { rolePillAfter: await page.locator('#rolePill').textContent(), screen: await active(page) });
  await ctx.close(); }

// P03 project name edge cases
{ const { ctx, page, errors } = await fresh();
  await toUpload(page, { name: '' });
  const emptyName = await page.locator('#projectPill').textContent();
  await page.click('#btnBackProject');
  await page.fill('#projectName', '<img src=x onerror="window.__xss=1">'); await page.click('#btnCreateProject');
  const xss = await page.evaluate(() => window.__xss === 1);
  await page.waitForTimeout(150);
  const htmlName = await page.locator('#projectPill').textContent();
  await page.click('#btnBackProject');
  await page.fill('#projectName', 'L'.repeat(300)); await page.click('#btnCreateProject');
  const overflow = await page.evaluate(() => { const t = document.querySelector('.topbar'); return { topbarScrollW: t.scrollWidth, topbarClientW: t.clientWidth, docScrollW: document.documentElement.scrollWidth, innerW: innerWidth }; });
  await page.screenshot({ path: OUT + '/P03-long-name.png' });
  rec('P03', 'Project name empty / HTML / 300 chars', { emptyBecomes: emptyName, htmlRenderedAsText: htmlName, xssExecuted: xss, longNameOverflow: overflow, errors });
  await ctx.close(); }

// P04 template seeded into a later "blank" project
{ const { ctx, page } = await fresh();
  await page.click('.role-card[data-role=designer]'); await page.click('#btnContinueAuth');
  await page.click('#tplStarter'); await page.click('#btnCreateProject'); // seeds chair
  await page.click('#btnBackProject'); await page.click('#tplBlank'); await page.click('#btnCreateProject');
  await page.click('#btnManualOnly');
  const n = await page.locator('#furnGroup > g').count();
  rec('P04', 'Create from template -> Back -> choose Blank -> Create: furniture in the "blank" project', { furnitureCount: n, bom: (await page.locator('#bomList').innerText()).slice(0, 80) });
  await page.screenshot({ path: OUT + '/P04-blank-has-chair.png' });
  await ctx.close(); }

// P05 stale confirm checkbox after re-selecting a file
{ const { ctx, page } = await fresh();
  await toUpload(page);
  await page.click('.file-chip[data-fmt=DWG]'); await page.locator('#confirmCard').waitFor({ state: 'visible', timeout: 6000 });
  await page.check('#confirmDims');
  await page.click('.file-chip[data-fmt=PNG]');
  const hiddenDuring = await page.locator('#confirmCard').isHidden();
  await page.locator('#confirmCard').waitFor({ state: 'visible', timeout: 6000 });
  rec('P05', 'Re-pick a different file after ticking "Dimensions look right"', { confirmHiddenWhileReprocessing: hiddenDuring, checkboxStillChecked: await page.locator('#confirmDims').isChecked(), confirmButtonEnabledWithoutReview: await page.locator('#btnConfirmPlan').isEnabled() });
  await ctx.close(); }

// P06/P07/P08 file handling
{ const { ctx, page } = await fresh();
  await toUpload(page);
  await page.setInputFiles('#fileInput', { name: 'tiny-3x3m-plan.png', mimeType: 'image/png', buffer: Buffer.from('x') });
  await page.locator('#confirmCard').waitFor({ state: 'visible', timeout: 6000 });
  rec('P06', 'Any file -> same hard-coded detection result', { confirmText: (await page.locator('#confirmCard p').first().innerText()) });
  await page.click('#btnBackProject'); await page.click('#btnCreateProject');
  await page.setInputFiles('#fileInput', { name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('hello') });
  rec('P07', 'Unsupported .txt bypassing accept filter', { aiCardVisible: await page.locator('#aiCard').isVisible(), status: await page.locator('#aiStatus').innerText(), activeChip: await page.locator('.file-chip.active').allInnerTexts() });
  await page.setInputFiles('#fileInput', { name: 'empty.dwg', mimeType: 'application/acad', buffer: Buffer.alloc(0) });
  await page.waitForTimeout(200);
  rec('P08', 'Zero-byte .dwg', { aiCardVisible: await page.locator('#aiCard').isVisible(), status: await page.locator('#aiStatus').innerText() });
  await ctx.close(); }

// P09 drag & drop + P10 keyboard on upload zone
{ const { ctx, page } = await fresh();
  await toUpload(page);
  const drop = await page.evaluate(() => {
    const z = document.querySelector('#uploadZone');
    const dt = new DataTransfer(); dt.items.add(new File(['x'], 'plan.png', { type: 'image/png' }));
    const over = new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt });
    const dr = new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt });
    z.dispatchEvent(over); z.dispatchEvent(dr);
    return { dragoverDefaultPrevented: over.defaultPrevented, dropDefaultPrevented: dr.defaultPrevented, aiCardShown: !document.querySelector('#aiCard').hidden };
  });
  rec('P09', 'Zone says "Drop or click" - drop handler?', drop);
  await page.focus('#uploadZone');
  let enter = false, space = false;
  const p1 = page.waitForEvent('filechooser', { timeout: 800 }).then(() => (enter = true)).catch(() => {});
  await page.keyboard.press('Enter'); await p1;
  const p2 = page.waitForEvent('filechooser', { timeout: 800 }).then(() => (space = true)).catch(() => {});
  await page.keyboard.press('Space'); await p2;
  rec('P10', 'Upload zone is role=button tabindex=0: Enter / Space open picker?', { enterOpensPicker: enter, spaceOpensPicker: space });
  await ctx.close(); }

// P11-P17 editor behaviours
{ const { ctx, page } = await fresh();
  await toEditor(page, { role: 'designer', tpl: false });
  await page.click('.catalog-item[data-sku="CHAIR-LOFT-01"]');
  await page.locator('#planSvg').click({ position: { x: 5, y: 5 } });
  const outside = await page.evaluate(() => { const g = document.querySelector('#furnGroup > g'); const tr = g.getAttribute('transform'); const poly = document.querySelector('#roomPoly').getAttribute('points'); return { transform: tr, roomPolygon: poly }; });
  rec('P11', 'Place furniture far outside the room polygon', outside);
  await page.click('.tool-btn[data-tool=wall]');
  await page.locator('#planSvg').click({ position: { x: 300, y: 200 } });
  const p1 = await page.locator('#roomPoly').getAttribute('points');
  await page.locator('#planSvg').click({ position: { x: 100, y: 100 } });
  const p2 = await page.locator('#roomPoly').getAttribute('points');
  rec('P12', '"Draw wall" tool: do different clicks draw different walls?', { afterClickA: p1, afterClickB: p2, identical: p1 === p2 });
  // P16/P17 deselect, delete, undo
  await page.click('.tool-btn[data-tool=select]');
  const selBefore = await page.locator('#selTitle').textContent();
  await page.locator('#planSvg').click({ position: { x: 700, y: 480 } });
  const selAfterEmptyClick = await page.locator('#selTitle').textContent();
  const n0 = await page.locator('#furnGroup > g').count();
  await page.keyboard.press('Delete'); await page.keyboard.press('Backspace'); await page.keyboard.press('Meta+z'); await page.keyboard.press('Control+z');
  const n1 = await page.locator('#furnGroup > g').count();
  rec('P16', 'Click empty canvas with Select tool', { before: selBefore, after: selAfterEmptyClick, deselected: selAfterEmptyClick !== selBefore });
  rec('P17', 'Delete / Backspace / Undo on a mistaken placement', { countBefore: n0, countAfter: n1, removable: n1 < n0 });
  // drag to move
  const g = page.locator('#furnGroup > g').first(); const bb = await g.boundingBox();
  await page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2); await page.mouse.down(); await page.mouse.move(bb.x + 150, bb.y + 90, { steps: 5 }); await page.mouse.up();
  const bb2 = await page.locator('#furnGroup > g').first().boundingBox();
  rec('P17b', 'Drag a placed item to move it', { moved: Math.abs(bb2.x - bb.x) > 5 || Math.abs(bb2.y - bb.y) > 5 });
  await page.screenshot({ path: OUT + '/P11-editor-outside.png' });
  await ctx.close(); }

// P13 flood
{ const { ctx, page } = await fresh();
  await toEditor(page, { role: 'designer' });
  await page.click('.catalog-item[data-sku="CHAIR-LOFT-01"]');
  const t0 = Date.now();
  await page.evaluate(() => { const svg = document.querySelector('#planSvg'); const r = svg.getBoundingClientRect(); for (let i = 0; i < 400; i++) svg.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: r.left + 100 + (i % 40) * 10, clientY: r.top + 100 + Math.floor(i / 40) * 10 })); });
  const ms = Date.now() - t0;
  const nodes = await page.evaluate(() => ({ furn: document.querySelectorAll('#furnGroup > g').length, domNodes: document.querySelectorAll('*').length, bomText: document.querySelector('#bomList').innerText.replace(/\n/g, ' ').slice(0, 90) }));
  rec('P13', '400 placements in one burst', { ms, ...nodes });
  await ctx.close(); }

// P14/P15/P24 materials + BOM variants + template re-apply
{ const { ctx, page } = await fresh();
  await toEditor(page, { role: 'designer' });
  await page.click('.catalog-item[data-sku="CHAIR-LOFT-01"]');
  await page.locator('#planSvg').click({ position: { x: 300, y: 250 } });
  await page.click('.mat-grid[data-slot=wood] .mat-btn[data-mat=walnut]');
  await page.locator('#planSvg').click({ position: { x: 450, y: 250 } });
  await page.click('.mat-grid[data-slot=wood] .mat-btn[data-mat=ash]');
  await page.click('#btnOpenBom');
  const bom = await page.locator('#bomListFull').innerText();
  const sku = await page.locator('#skuListFull').innerText();
  const total = await page.locator('#bomTotalFull').innerText();
  const lede = await page.locator('#screen-bom .lede').innerText();
  rec('P14', 'Two chairs with different wood finishes -> what does the BOM say?', { bomText: bom.replace(/\n/g, ' | '), totalText: total, ledeText: lede, variantInfoShown: /walnut|ash|oak/i.test(bom) });
  await page.screenshot({ path: OUT + '/P14-bom.png' });
  await page.click('#btnBackEditor');
  // P15: set wood on the table then place a new chair
  await page.click('.catalog-item[data-sku="TABLE-OAK-02"]'); await page.locator('#planSvg').click({ position: { x: 300, y: 380 } });
  await page.click('.mat-grid[data-slot=wood] .mat-btn[data-mat=walnut]');
  await page.click('.catalog-item[data-sku="CHAIR-LOFT-01"]'); await page.locator('#planSvg').click({ position: { x: 500, y: 380 } });
  rec('P15', 'Finish changed on a TABLE leaks into the next CHAIR placed?', { newChairMeta: await page.locator('#selMeta').innerText() });
  for (let i = 0; i < 5; i++) await page.click('#btnApplyTemplate');
  rec('P24', '"Apply starter template" clicked 5 more times', { furnitureCount: await page.locator('#furnGroup > g').count() });
  await ctx.close(); }

// P18/P19 3D view
for (const blockCdn of [true, false]) {
  const { ctx, page } = await fresh({ blockCdn });
  await toEditor(page, { role: 'designer' });
  await page.click('.catalog-item[data-sku="TABLE-OAK-02"]'); await page.locator('#planSvg').click({ position: { x: 400, y: 250 } });
  await page.click('.mode-toggle button[data-mode="3d"]'); await page.waitForTimeout(600);
  rec(blockCdn ? 'P19' : 'P18', `3D view with ONLY a table placed (CDN ${blockCdn ? 'blocked' : 'allowed'})`, await page.evaluate(() => ({ threeLoaded: typeof THREE !== 'undefined', fallbackVisible: !document.querySelector('#css3d').hidden, fallbackHasChairOnly: !!document.querySelector('.css3d-chair'), placed: [...document.querySelectorAll('#furnGroup text')].map((t) => t.textContent), toast: document.querySelector('#toast').textContent })));
  await page.screenshot({ path: OUT + (blockCdn ? '/P19-3d-fallback.png' : '/P18-3d-three.png') });
  await ctx.close();
}

// P20/P21 restart + history
{ const { ctx, page, errors } = await fresh();
  await toEditor(page, { role: 'designer', tpl: false });
  await page.click('.catalog-item[data-sku="CHAIR-LOFT-01"]'); await page.locator('#planSvg').click({ position: { x: 300, y: 250 } });
  await page.click('#btnOpenBom');
  const hist = await page.evaluate(() => ({ historyLength: history.length, hash: location.hash, href: location.href.slice(-30) }));
  const hasBeforeUnload = await page.evaluate(() => typeof window.onbeforeunload);
  await page.click('#btnRestart'); await page.waitForTimeout(500);
  rec('P20', '"Start over" on BOM screen', { confirmDialogShown: errors.some((e) => e.startsWith('DIALOG')), screenAfter: await active(page), furnitureAfter: await page.locator('#furnGroup > g').count(), beforeunloadHandler: hasBeforeUnload });
  rec('P21', 'URL / history per screen (deep link, browser Back)', hist);
  await ctx.close(); }

// P22 a11y signals
{ const { ctx, page } = await fresh();
  const a = await page.evaluate(() => ({ listboxHasSelectedState: [...document.querySelectorAll('[role=option]')].some((o) => o.hasAttribute('aria-selected')), optionCount: document.querySelectorAll('[role=option]').length, stepChipsAriaCurrent: !!document.querySelector('.step-chip[aria-current]'), h1Count: document.querySelectorAll('h1').length }));
  await page.click('.role-card[data-role=consumer]'); await page.click('#btnContinueAuth');
  a.activeElementAfterScreenChange = await page.evaluate(() => document.activeElement?.tagName + '#' + (document.activeElement?.id || ''));
  a.toastRole = await page.locator('#toast').getAttribute('role');
  a.optionSelectedAfterPick = await page.evaluate(() => [...document.querySelectorAll('.role-card[data-role]')].map((b) => b.getAttribute('aria-selected')));
  rec('P22', 'Accessibility signals (role=option without aria-selected, focus after screen change, step chips)', a);
  await ctx.close(); }

// P23 mobile
{ const { ctx, page } = await fresh({ viewport: { width: 375, height: 812 } });
  const m = {};
  m.auth = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  await page.click('.role-card[data-role=designer]'); await page.click('#btnSkipDemo');
  await page.waitForTimeout(300);
  m.editorOverflowPx = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  m.editorGrid = await page.evaluate(() => { const e = document.querySelector('.editor'); const cs = getComputedStyle(e); return { cols: cs.gridTemplateColumns, h: e.scrollHeight, canvasH: document.querySelector('.stage')?.getBoundingClientRect().height }; });
  await page.screenshot({ path: OUT + '/P23-mobile-editor.png', fullPage: false });
  rec('P23', 'Mobile 375x812: horizontal overflow (px) per screen', m);
  await ctx.close(); }

writeFileSync(OUT + '/results.json', JSON.stringify(results, null, 2));
await browser.close();
console.log('DONE', results.length);
