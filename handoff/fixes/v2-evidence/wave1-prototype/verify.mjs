// Phase 5 acceptance checks for the planner prototype. Real Chrome, file URL. Writes out/verify-<label>.json.
// usage: node verify.mjs [path-to-index.html] [label]
import { pathToFileURL } from 'node:url';
import { readFileSync, writeFileSync } from 'node:fs';
import { chromium } from '/Users/adrian/Desktop/Room Vibez/v2/hackathon-3d-viewer/node_modules/playwright/index.mjs';
const target = process.argv[2] || '/Users/adrian/Desktop/Room Vibez/v2/prototypes/room-vibez-planner-flows/index.html';
const label = process.argv[3] || 'v2';
const URL_ = pathToFileURL(target).href;
const DECK = readFileSync('/Users/adrian/Desktop/Room Vibez/docs/ux-copy-deck.md', 'utf8').replace(/\*\*/g, '').replace(/\*/g, '').replace(/\s+/g, ' ');
const inDeck = (s) => DECK.includes(s.replace(/\s+/g, ' ').trim());

const checks = []; const data = {};
const check = (id, pass, detail) => { checks.push({ id, pass: !!pass, detail }); console.log(`${pass ? 'PASS' : 'FAIL'}  ${id}${detail !== undefined ? '  ' + JSON.stringify(detail).slice(0, 600) : ''}`); };

// Phase 5 names these research labels. BOM is allowed only in the reseller role card (deck §6).
const RESEARCH = /Unknown \/ not in public|Partial \/ beta in public|\bstub\b|\(owned\)|\bCMS\b|Planner BOM manager|Owned|illustrative|\bSLA\b|\bERP\b|\b4K\b|multi-slot|Slot:|system-of-record|not official|Planner 5D/i;
const VOCAB = /\bCart\b|furniture|\bDrop\b|Manual draw|AI recognition|Human confirm|\bpersona\b/i;
const HANDOFF_S8 = /(SoT|SoR|MVP|\bstub\b|ingress|candidates|fixture|Polyfork|material_slot_id|\bmock\b|createAsset|COLOR_0|normalizeRoomGraph|Unknown \/ not in public)/i;

const browser = await chromium.launch({ channel: 'chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
async function fresh({ viewport = { width: 1280, height: 800 }, three = 'real' } = {}) {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  const errors = []; const nativeDialogs = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('dialog', (d) => { nativeDialogs.push(d.type() + ':' + d.message()); d.dismiss(); });
  if (three === 'blocked') await page.route(/unpkg\.com/, (r) => r.abort());
  if (three === 'throws') await page.route(/unpkg\.com/, (r) => r.fulfill({ contentType: 'application/javascript', body: 'window.THREE = { WebGLRenderer: function () { throw new Error("no webgl"); } };' }));
  if (three === 'nocontext') await page.route(/unpkg\.com/, (r) => r.fulfill({ contentType: 'application/javascript', body: 'window.THREE = { WebGLRenderer: function () { this.domElement = document.createElement("canvas"); this.setSize = function () {}; this.setPixelRatio = function () {}; this.getContext = function () { return null; }; }, Scene: function () {}, Color: function () {}, PerspectiveCamera: function () { this.position = { set: function () {} }; this.lookAt = function () {}; } };' }));
  await page.goto(URL_);
  await page.waitForTimeout(700);
  // record every toast as it is written
  await page.evaluate(() => { window.__toasts = []; const t = document.getElementById('toast'); new MutationObserver(() => { if (t.textContent) window.__toasts.push(t.textContent); }).observe(t, { childList: true, characterData: true, subtree: true }); });
  return { ctx, page, errors, nativeDialogs };
}
const active = (page) => page.evaluate(() => document.querySelector('.screen.active')?.id);
const bodyText = (page) => page.evaluate(() => document.body.innerText);
const lastToast = (page) => page.evaluate(() => ({ text: document.getElementById('toast').textContent, shown: document.getElementById('toast').classList.contains('show'), visible: document.getElementById('toast').getClientRects().length > 0 }));
// Every visible text run on the active screen (plus top bar), for the "is it in the deck" listing.
const textRuns = (page) => page.evaluate(() => { const out = []; const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let n; while ((n = w.nextNode())) { const el = n.parentElement; const t = n.textContent.replace(/\s+/g, ' ').trim(); if (!t || !el || el.closest('script,style,svg')) continue; if (!el.getClientRects().length) continue; if (el.closest('dialog:not([open])')) continue; out.push(t); } return [...new Set(out)]; });
const screens = {};
async function snap(page, name) {
  const txt = await bodyText(page);
  screens[name] = { innerTextLength: txt.length, research: txt.match(new RegExp(RESEARCH.source, 'gi')) || [], vocab: txt.match(new RegExp(VOCAB.source, 'gi')) || [], handoffS8: txt.match(new RegExp(HANDOFF_S8.source, 'gi')) || [], bomMentions: (txt.match(/\bBOM\b/g) || []).length, parenS: (txt.match(/\(s\)/g) || []).length, runs: await textRuns(page) };
  check(`labels:${name}: innerText has no research label`, screens[name].research.length === 0, screens[name].research);
  check(`labels:${name}: no retired vocabulary (Cart, furniture, Drop, Manual draw…)`, screens[name].vocab.length === 0, screens[name].vocab);
  check(`labels:${name}: handoff §8 team-vocabulary regex is false`, screens[name].handoffS8.length === 0, screens[name].handoffS8);
}

// ---------- A. Five screens, long way round (architect, template, real file input) ----------
{ const { ctx, page, errors, nativeDialogs } = await fresh();
  await snap(page, '1-auth (nothing picked)');
  check('auth: top-bar badge', (await page.locator('.topbar .sim-badge').innerText()) === 'Prototype · nothing is saved');
  check('auth: honesty badge kept', (await page.locator('#screen-auth .sim-badge').innerText()) === 'Click-through prototype · no real accounts');
  check('auth: pills', (await page.locator('#rolePill').innerText()) === 'No account needed' && (await page.locator('#projectPill').innerText()) === 'No project yet');
  check('auth: email is empty with placeholder and helper', await page.evaluate(() => { const e = document.getElementById('email'); return e.value === '' && e.placeholder === 'you@example.com' && document.querySelector('label[for=email]').innerText === 'Email (optional)' && document.getElementById(e.getAttribute('aria-describedby')).innerText === 'Nothing is sent or saved.'; }));
  check('auth: BOM appears once, in the reseller card only', await page.evaluate(() => (document.body.innerText.match(/\bBOM\b/g) || []).length === 1 && /\bBOM\b/.test(document.querySelector('.role-card[data-role=reseller]').innerText)));
  check('brand unchanged', (await page.locator('.brand').innerText()) === 'Room Vibez' && (await page.title()) === 'Room Vibez — Planner flows prototype');
  await page.click('.role-card[data-role=architect]');
  await snap(page, '1-auth (architect picked)');
  await page.click('#btnContinueAuth');
  await snap(page, '2-project');
  check('project: name is empty with placeholder', await page.evaluate(() => { const e = document.getElementById('projectName'); return e.value === '' && e.placeholder === 'e.g. Living room'; }));
  check('project: no disabled controls left', (await page.locator('#screen-project :disabled').count()) === 0);
  await page.fill('#projectName', 'Loft test');
  await page.click('#tplStarter'); await page.click('#btnCreateProject');
  check('toast: Template added. (visible on the upload screen)', await page.evaluate(() => { const t = document.getElementById('toast'); return t.textContent === 'Template added.' && t.classList.contains('show') && t.getClientRects().length > 0 && document.querySelector('.screen.active').id === 'screen-upload'; }));
  await snap(page, '3-upload (before a file)');
  check('upload: zone label has no "Drop"', await page.evaluate(() => { const z = document.getElementById('uploadZone'); return z.querySelector('strong').innerText === 'Choose a file' && !/drop/i.test(z.innerText); }), await page.locator('#uploadZone').innerText());
  check('upload: architect note shows the deck sentence', (await page.locator('#architectNote p').innerText()) === "DWG is import-only here. You can't edit CAD in this prototype.");
  check('upload: no disabled controls and no #btnManualOnly', (await page.locator('#screen-upload button:disabled:visible').count()) === 0 && (await page.locator('#btnManualOnly').count()) === 0);
  // a type chip starts the demo and does not open the picker
  let chooser = false; const pc = page.waitForEvent('filechooser', { timeout: 1200 }).then(() => (chooser = true)).catch(() => {});
  await page.click('.file-chip[data-fmt=DWG]'); await pc;
  check('upload: a type chip does not open the file picker', chooser === false);
  const statuses = new Set();
  for (let i = 0; i < 40; i++) { statuses.add(await page.locator('#aiStatus').innerText()); if (await page.locator('#confirmCard').isVisible()) break; await page.waitForTimeout(90); }
  statuses.add(await page.locator('#aiStatus').innerText());
  data.recognitionStatuses = [...statuses];
  check('upload: recognition statuses are the deck strings', [...statuses].every((s) => ['Reading your DWG…', 'Finding walls…', 'Building the room…', 'Ready to review.'].includes(s)) && statuses.has('Ready to review.'), [...statuses]);
  await snap(page, '3-upload (result shown, architect)');
  check('upload: exactly one "Draw it myself" button', (await page.locator('button', { hasText: 'Draw it myself' }).count()) === 1 && (await page.locator('button', { hasText: /manual/i }).count()) === 0);
  check('upload: confirm disabled until ticked', await page.locator('#btnConfirmPlan').isDisabled());
  await page.check('#confirmDims');
  await page.setInputFiles('#fileInput', { name: 'my-plan.png', mimeType: 'image/png', buffer: Buffer.from('x') });
  check('state bug 1: new file unticks and re-disables straight away', await page.evaluate(() => !document.getElementById('confirmDims').checked && document.getElementById('btnConfirmPlan').disabled));
  check('upload: status names the new type', (await page.locator('#aiStatus').innerText()) === 'Reading your PNG…');
  await page.locator('#confirmCard').waitFor({ state: 'visible', timeout: 8000 });
  check('state bug 1: still unticked and disabled when the new result shows', await page.evaluate(() => !document.getElementById('confirmDims').checked && document.getElementById('btnConfirmPlan').disabled));
  await page.check('#confirmDims'); await page.click('#btnConfirmPlan');
  check('toast: Plan confirmed.', (await lastToast(page)).text === 'Plan confirmed.' && (await active(page)) === 'screen-editor');
  await snap(page, '4-editor (2D, template chair)');
  check('editor: role and project pills', (await page.locator('#rolePill').innerText()) === 'Architect' && (await page.locator('#projectPill').innerText()) === 'Loft test');
  check('editor: no disabled controls before the starter is used', (await page.locator('#screen-editor button:disabled').count()) === 0);
  check('editor: tool hint default', (await page.locator('#toolHint').innerText()) === 'Select a product');
  await page.click('.tool-btn[data-tool=wall]');
  check('editor: wall hint', (await page.locator('#toolHint').innerText()) === 'Click the plan to draw walls. The demo always draws the same room shape.');
  await page.locator('#planSvg').click({ position: { x: 300, y: 200 } });
  check('toast: Walls updated (sample shape).', (await lastToast(page)).text === 'Walls updated (sample shape).');
  await page.click('.tool-btn[data-tool=place]');
  check('editor: place hint names the product (tool button)', (await page.locator('#toolHint').innerText()) === 'Click the plan to place “Loft Chair”');
  await page.click('.catalog-item[data-sku="TABLE-OAK-02"]');
  check('editor: place hint names the product (product click)', (await page.locator('#toolHint').innerText()) === 'Click the plan to place “Oak Side Table”');
  await page.locator('#planSvg').click({ position: { x: 420, y: 300 } });
  check('toast: Placed Oak Side Table (unchanged)', (await lastToast(page)).text === 'Placed Oak Side Table');
  check('editor: table selection meta', (await page.locator('#selMeta').innerText()) === 'TABLE-OAK-02 · Wood: Oak');
  await page.click('.mat-grid[data-slot=plastic] .mat-btn[data-mat=ink]');
  check('toast: finish with no matching product', (await lastToast(page)).text === 'Select a Loft Chair to change its finishes.');
  await page.click('.catalog-item[data-sku="CHAIR-LOFT-01"]');
  await page.locator('#planSvg').click({ position: { x: 250, y: 330 } });
  check('toast: Placed Loft Chair (unchanged)', (await lastToast(page)).text === 'Placed Loft Chair');
  check('editor: chair selection meta', (await page.locator('#selMeta').innerText()) === 'CHAIR-LOFT-01 · Wood: Oak · Plastic: Slate · Wool: Sand', await page.locator('#selMeta').innerText());
  const finishToasts = [];
  for (const [slot, mat] of [['wood', 'walnut'], ['wood', 'ash'], ['wood', 'oak'], ['plastic', 'ink'], ['plastic', 'mist'], ['plastic', 'slate'], ['wool', 'clay'], ['wool', 'sage'], ['wool', 'sand']]) { await page.click(`.mat-grid[data-slot=${slot}] .mat-btn[data-mat=${mat}]`); finishToasts.push((await lastToast(page)).text); }
  data.finishToasts = finishToasts;
  check('toast: finish changes', JSON.stringify(finishToasts) === JSON.stringify(['Wood changed to Walnut.', 'Wood changed to Ash.', 'Wood changed to Oak.', 'Plastic changed to Ink.', 'Plastic changed to Mist.', 'Plastic changed to Slate.', 'Wool changed to Clay.', 'Wool changed to Sage.', 'Wool changed to Sand.']), finishToasts);
  const light = []; for (let i = 0; i < 3; i++) { await page.click('#btnLightPreset'); light.push([(await page.locator('#btnLightPreset').innerText()), (await lastToast(page)).text]); }
  data.lightCycle = light;
  check('toast + label: lighting', JSON.stringify(light) === JSON.stringify([['Lighting: Gallery', 'Lighting: Gallery.'], ['Lighting: Evening warm', 'Lighting: Evening warm.'], ['Lighting: Soft day', 'Lighting: Soft day.']]), light);
  const render = []; for (let i = 0; i < 3; i++) { await page.click('#btnRenderPreset'); render.push([(await page.locator('#btnRenderPreset').innerText()), (await lastToast(page)).text]); }
  data.renderCycle = render;
  check('toast + label: render style kept, with the honest toast', JSON.stringify(render) === JSON.stringify([['Render style: Contrast+', "Render style set to Contrast+. It doesn't change the image yet."], ['Render style: Neutral commerce', "Render style set to Neutral commerce. It doesn't change the image yet."], ['Render style: Preview', "Render style set to Preview. It doesn't change the image yet."]]), render);
  check('editor: #btnRenderPreset is enabled and visible', await page.locator('#btnRenderPreset').isEnabled() && await page.locator('#btnRenderPreset').isVisible());
  const before = await page.locator('#furnGroup > g').count();
  await page.click('#btnApplyTemplate');
  const after1 = await page.locator('#furnGroup > g').count();
  check('toast: Starter products added.', (await lastToast(page)).text === 'Starter products added.');
  for (let i = 0; i < 4; i++) await page.locator('#btnApplyTemplate').click({ force: true });
  await page.evaluate(() => document.getElementById('btnApplyTemplate').click());
  const after5 = await page.locator('#furnGroup > g').count();
  data.starter = { before, after1, after5, label: await page.locator('#btnApplyTemplate').innerText() };
  check('state bug 3: starter products added once only', after1 === before + 1 && after5 === after1 && data.starter.label === 'Starter products added', data.starter);
  await snap(page, '4-editor (2D, products placed, starter used)');
  const sideTotal = await page.locator('#bomTotal').innerText();
  // 3D with the real Three.js
  await page.click('.mode-toggle button[data-mode="3d"]'); await page.waitForTimeout(900);
  data.threeReal = await page.evaluate(() => ({ threeLoaded: typeof THREE !== 'undefined', canvas: !!document.querySelector('#three-host canvas'), caption: document.querySelector('#three-host .draw-hint')?.innerText ?? null, captionInWindow: (() => { const r = document.querySelector('#three-host .draw-hint')?.getBoundingClientRect(); return !!r && r.top >= 0 && r.bottom <= innerHeight && r.right <= innerWidth; })(), fallbackHidden: document.getElementById('css3d').hidden }));
  check('3D caption (Three.js loaded), inside the window with products placed', data.threeReal.caption === '3D preview shows one sample chair, not your whole room yet.' && data.threeReal.captionInWindow, data.threeReal);
  await snap(page, '4-editor (3D)');
  await page.click('.mode-toggle button[data-mode="2d"]');
  await page.click('#btnOpenBom');
  await snap(page, '5-parts list');
  const fullTotal = await page.locator('#bomTotalFull').innerText();
  data.totals = { sideTotal, fullTotal };
  check('total line in both places', /^Total \(placeholder prices\): €\d+$/.test(sideTotal) && sideTotal === fullTotal, data.totals);
  check('parts list: headings', JSON.stringify(await page.locator('#screen-bom h1, #screen-bom h3').allInnerTexts()) === JSON.stringify(['Parts list', 'Items', 'Catalog SKUs', 'Share']), await page.locator('#screen-bom h1, #screen-bom h3').allInnerTexts());
  check('parts list: no disabled controls', (await page.locator('#screen-bom :disabled').count()) === 0);
  const exp = [];
  for (const id of ['#btnExportPdf', '#btnExportPng', '#btnExportGlb']) { await page.click(id); await page.waitForTimeout(120); const t = await lastToast(page); exp.push([await page.locator(id).innerText(), t.text, t.shown && t.visible]); }
  data.exports = exp;
  check('toast + label: exports, and the toast is visible on this screen', JSON.stringify(exp) === JSON.stringify([['Export plan as PDF', "PDF export isn't available yet.", true], ['Export as PNG', "PNG export isn't available yet.", true], ['Export 3D package', "3D package export isn't available yet.", true]]), exp);
  // SKU list button leads to the same screen
  await page.click('#btnBackEditor'); await page.click('#btnSkuList');
  check('SKU list button opens the parts list screen', (await active(page)) === 'screen-bom');

  // ---------- Start over ----------
  const n = await page.locator('#furnGroup > g').count();
  const restartStyle = await page.evaluate(() => { const b = document.getElementById('btnRestart'); const cs = getComputedStyle(b); return { className: b.className, bg: cs.backgroundColor, color: cs.color }; });
  data.restartButton = restartStyle;
  check('Start over button is secondary (not the primary green)', !/primary/.test(restartStyle.className) && restartStyle.bg === 'rgb(255, 255, 255)', restartStyle);
  await page.focus('#btnRestart'); await page.keyboard.press('Enter');
  const dlg = await page.evaluate(() => { const d = document.getElementById('restartDialog'); const c = document.getElementById('btnRestartConfirm'); const k = document.getElementById('btnRestartCancel'); const cs = getComputedStyle(c); return { open: d.open, modal: d.matches(':modal'), title: document.getElementById('restartTitle').innerText, body: document.getElementById('restartBody').innerText, buttons: [...d.querySelectorAll('button')].map((b) => b.innerText), confirmBg: cs.backgroundColor, confirmColor: cs.color, cancelBg: getComputedStyle(k).backgroundColor, focus: document.activeElement.id, labelledby: d.getAttribute('aria-labelledby'), describedby: d.getAttribute('aria-describedby') }; });
  data.restartDialog = { placed: n, ...dlg };
  check('Start over: confirmation opens (keyboard), with the deck words and the count', dlg.open && dlg.modal && dlg.title === 'Start over?' && dlg.body === `This clears your project and ${n} placed items.` && JSON.stringify(dlg.buttons) === JSON.stringify(['Start over', 'Keep working']), data.restartDialog);
  check('Start over: destructive button is critical, not primary; focus starts on Keep working', dlg.confirmBg === 'rgb(139, 58, 47)' && dlg.focus === 'btnRestartCancel', dlg);
  check('Start over: no native confirm()/alert() used', nativeDialogs.length === 0, nativeDialogs);
  await page.keyboard.press('Escape');
  check('Start over: Esc keeps everything and returns focus', await page.evaluate((n) => !document.getElementById('restartDialog').open && document.activeElement.id === 'btnRestart' && document.querySelectorAll('#furnGroup > g').length === n && document.querySelector('.screen.active').id === 'screen-bom', n));
  await page.click('#btnRestart'); await page.click('#btnRestartCancel');
  check('Start over: Keep working keeps everything and returns focus', await page.evaluate((n) => !document.getElementById('restartDialog').open && document.activeElement.id === 'btnRestart' && document.querySelectorAll('#furnGroup > g').length === n && document.getElementById('projectPill').innerText === 'Loft test', n));
  await page.click('#btnRestart'); await page.click('#btnRestartConfirm'); await page.waitForTimeout(900);
  check('Start over: confirming clears the project', await page.evaluate(() => document.querySelector('.screen.active').id === 'screen-auth' && document.querySelectorAll('#furnGroup > g').length === 0 && document.getElementById('projectPill').innerText === 'No project yet' && document.getElementById('rolePill').innerText === 'No account needed'));
  check('no page errors on the long path', errors.length === 0, errors);
  await ctx.close(); }

// ---------- B. Start over count wording: 0 and 1 ----------
{ const { ctx, page } = await fresh();
  await page.click('.role-card[data-role=consumer]'); await page.click('#btnContinueAuth'); await page.click('#tplBlank'); await page.click('#btnCreateProject');
  await page.click('.file-chip[data-fmt=PDF]'); await page.locator('#confirmCard').waitFor({ state: 'visible', timeout: 8000 });
  await page.click('#btnManualDraw');
  check('toast: Drawing from scratch.', (await lastToast(page)).text === 'Drawing from scratch.' && (await active(page)) === 'screen-editor');
  check('editor: empty selection and list wording', (await page.locator('#selTitle').innerText()) === 'Nothing selected' && (await page.locator('#selMeta').innerText()) === 'Place a Loft Chair, then pick it to change its finishes.' && (await page.locator('#bomList').innerText()) === 'Nothing here yet. Place a product to start your list.' && (await page.locator('#bomTotal').innerText()) === 'Total (placeholder prices): €0');
  await snap(page, '4-editor (empty)');
  await page.click('#btnOpenBom');
  await snap(page, '5-parts list (empty)');
  check('parts list: empty wording in the full list', (await page.locator('#bomListFull').innerText()) === 'Nothing here yet. Place a product to start your list.' && (await page.locator('#bomTotalFull').innerText()) === 'Total (placeholder prices): €0');
  await page.click('#btnRestart'); const b0 = await page.locator('#restartBody').innerText(); await page.keyboard.press('Escape');
  await page.click('#btnBackEditor'); await page.click('.tool-btn[data-tool=place]'); await page.locator('#planSvg').click({ position: { x: 300, y: 250 } });
  await page.click('#btnOpenBom'); await page.click('#btnRestart'); const b1 = await page.locator('#restartBody').innerText(); await page.keyboard.press('Escape');
  data.restartBodies = { zero: b0, one: b1 };
  check('Start over: count wording for 0 and 1', b0 === 'This clears your project and 0 placed items.' && b1 === 'This clears your project and 1 placed item.', data.restartBodies);
  await ctx.close(); }

// ---------- C. Skip to a demo project ----------
{ const res = {};
  for (const role of ['consumer', 'designer', 'architect', 'reseller', null]) {
    const { ctx, page } = await fresh();
    if (role) await page.click(`.role-card[data-role=${role}]`);
    const before = await page.locator('#rolePill').innerText();
    await page.click('#btnSkipDemo'); await page.waitForTimeout(250);
    const t = await lastToast(page);
    res[role ?? 'none'] = { before, after: await page.locator('#rolePill').innerText(), toast: t.text, toastVisible: t.shown && t.visible, toastsInOrder: await page.evaluate(() => window.__toasts), screen: await active(page), project: await page.locator('#projectPill').innerText() };
    if (!role) await snap(page, '4-editor (skip to demo, no role)');
    await ctx.close();
  }
  data.skipDemo = res;
  check('state bug 2: Skip to a demo project keeps the chosen role', ['consumer', 'designer', 'architect', 'reseller'].every((r) => res[r].before === res[r].after && res[r].screen === 'screen-editor'), Object.fromEntries(Object.entries(res).map(([k, v]) => [k, `${v.before} -> ${v.after}`])));
  check('state bug 2: with no role it defaults to Interior designer and says so', res.none.after === 'Interior designer' && res.none.toast === 'No role picked, so the demo opens as Interior designer.' && res.none.toastVisible, res.none);
}

// ---------- D. 3D fallbacks ----------
for (const [mode, expectToast] of [['blocked', '3D preview needs an internet connection. Showing a simple version instead.'], ['throws', "Your browser can't run full 3D. Showing a simple version instead."], ['nocontext', "Your browser can't run full 3D. Showing a simple version instead."]]) {
  const { ctx, page, errors } = await fresh({ three: mode });
  await page.click('#btnSkipDemo'); await page.waitForTimeout(200);
  await page.click('.mode-toggle button[data-mode="3d"]'); await page.waitForTimeout(300);
  const r = await page.evaluate(() => ({ toast: document.getElementById('toast').textContent, fallbackVisible: !document.getElementById('css3d').hidden, caption: document.querySelector('#css3d .draw-hint').innerText, captionInWindow: (() => { const r = document.querySelector('#css3d .draw-hint').getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight && r.right <= innerWidth; })() }));
  data['three_' + mode] = { ...r, errors };
  check(`3D fallback (${mode}): toast and caption`, r.toast === expectToast && r.fallbackVisible && r.caption === '3D preview shows one sample chair, not your whole room yet.' && r.captionInWindow, data['three_' + mode]);
  if (mode === 'blocked') await snap(page, '4-editor (3D fallback)');
  await ctx.close();
}

// ---------- E. The ? pop-up, keyboard only ----------
{ const { ctx, page, errors } = await fresh();
  const btn = await page.evaluate(() => { const b = document.getElementById('btnHelp'); const r = b.getBoundingClientRect(); return { text: b.innerText, title: b.title, ariaLabel: b.getAttribute('aria-label'), haspopup: b.getAttribute('aria-haspopup'), size: [Math.round(r.width), Math.round(r.height)], inTopbar: !!b.closest('.topbar') }; });
  data.helpButton = btn;
  check('?: button has an accessible name and tooltip', btn.text === '?' && btn.title === 'How this works' && btn.ariaLabel === 'Help: how this works' && btn.haspopup === 'dialog' && btn.inTopbar, btn);
  check('?: never opens by itself', await page.evaluate(() => !document.getElementById('helpDialog').open));
  check('?: closed dialog text is not in innerText', !(await bodyText(page)).includes('Five steps'));
  let tabs = 0; let reached = false;
  for (; tabs < 30; tabs++) { await page.keyboard.press('Tab'); if (await page.evaluate(() => document.activeElement?.id === 'btnHelp')) { reached = true; break; } }
  data.helpTabStop = { reached, tabPresses: tabs + 1 };
  check('?: reachable with Tab', reached, data.helpTabStop);
  await page.keyboard.press('Enter');
  const open1 = await page.evaluate(() => { const d = document.getElementById('helpDialog'); return { open: d.open, modal: d.matches(':modal'), title: document.getElementById(d.getAttribute('aria-labelledby')).innerText, focusInside: d.contains(document.activeElement), focus: document.activeElement.id, tabs: [...d.querySelectorAll('[role=tab]')].map((t) => `${t.innerText}|${t.getAttribute('aria-selected')}|${t.tabIndex}`), closeName: document.getElementById('btnHelpClose').getAttribute('aria-label') }; });
  data.helpOpen = open1;
  check('?: Enter opens a modal dialog with focus inside', open1.open && open1.modal && open1.focusInside && open1.title === 'How this works', open1);
  check('?: four tabs, first selected, roving tabindex', JSON.stringify(open1.tabs) === JSON.stringify(['Walkthrough|true|0', 'Roles|false|-1', "What's simulated|false|-1", "Why it's shaped this way|false|-1"]), open1.tabs);
  // focus trap: Tab many times, focus never leaves the dialog
  const trail = []; let escaped = false;
  for (let i = 0; i < 14; i++) { await page.keyboard.press('Tab'); const f = await page.evaluate(() => { const d = document.getElementById('helpDialog'); const a = document.activeElement; return { id: a?.id || a?.tagName, inside: d.contains(a) || a === document.body }; }); trail.push(f.id); if (!f.inside) escaped = true; }
  data.helpFocusTrail = trail;
  check('?: Tab stays inside the dialog', !escaped, trail);
  // arrow keys through the tabs; panel text must be the deck text
  await page.focus('#helpTab-walkthrough');
  const panels = {};
  const readPanel = () => page.evaluate(() => { const d = document.getElementById('helpDialog'); const sel = d.querySelector('[role=tab][aria-selected=true]'); const vis = [...d.querySelectorAll('[role=tabpanel]')].filter((p) => !p.hidden); return { tab: sel.innerText, focusOnTab: document.activeElement === sel, visiblePanels: vis.length, labelledBy: vis[0].getAttribute('aria-labelledby') === sel.id, text: [...vis[0].querySelectorAll('p, li')].map((e) => e.innerText) }; });
  let p = await readPanel(); panels[p.tab] = p;
  for (let i = 0; i < 3; i++) { await page.keyboard.press('ArrowRight'); p = await readPanel(); panels[p.tab] = p; }
  await page.keyboard.press('ArrowRight'); const wrapped = (await readPanel()).tab;
  await page.keyboard.press('ArrowLeft'); const wrappedBack = (await readPanel()).tab;
  await page.keyboard.press('Home'); const home = (await readPanel()).tab; await page.keyboard.press('End'); const end = (await readPanel()).tab;
  data.helpPanels = panels; data.helpArrows = { wrapped, wrappedBack, home, end };
  check('?: arrow keys move through the four tabs (with wrap, Home, End), one panel at a time, focus follows', Object.keys(panels).length === 4 && Object.values(panels).every((x) => x.focusOnTab && x.visiblePanels === 1 && x.labelledBy) && wrapped === 'Walkthrough' && wrappedBack === "Why it's shaped this way" && home === 'Walkthrough' && end === "Why it's shaped this way", data.helpArrows);
  const allPanelText = Object.values(panels).flatMap((x) => x.text);
  data.helpTextNotInDeck = allPanelText.filter((t) => !inDeck(t));
  check('?: every paragraph and bullet is in deck §6.3 word for word', allPanelText.length === 7 && data.helpTextNotInDeck.length === 0, data.helpTextNotInDeck);
  await page.keyboard.press('Escape');
  check('?: Esc closes and focus returns to the ?', await page.evaluate(() => !document.getElementById('helpDialog').open && document.activeElement.id === 'btnHelp'));
  await page.keyboard.press('Space');
  check('?: Space opens it again, on the tab last used', await page.evaluate(() => document.getElementById('helpDialog').open && document.querySelector('#helpDialog [role=tab][aria-selected=true]').innerText === "Why it's shaped this way"));
  await page.focus('#btnHelpClose'); await page.keyboard.press('Enter');
  check('?: its Close button closes and focus returns to the ?', await page.evaluate(() => !document.getElementById('helpDialog').open && document.activeElement.id === 'btnHelp'));
  await page.click('#btnHelp'); await page.mouse.click(8, 8);
  check('?: click on the backdrop closes and focus returns', await page.evaluate(() => !document.getElementById('helpDialog').open && document.activeElement.id === 'btnHelp'));
  await page.click('#btnHelp'); await page.locator('#helpPanel-why').click();
  check('?: click inside the dialog does not close it', await page.evaluate(() => document.getElementById('helpDialog').open));
  await page.click('#helpTab-roles');
  check('?: tabs also work by click', (await readPanel()).tab === 'Roles');
  await page.keyboard.press('Escape');
  // it opens from every screen
  await page.click('#btnSkipDemo'); await page.waitForTimeout(200);
  await page.focus('#btnHelp'); await page.keyboard.press('Enter');
  const onEditor = await page.evaluate(() => document.getElementById('helpDialog').open); await page.keyboard.press('Escape');
  await page.click('#btnOpenBom'); await page.focus('#btnHelp'); await page.keyboard.press('Enter');
  const onBom = await page.evaluate(() => document.getElementById('helpDialog').open); await page.keyboard.press('Escape');
  check('?: opens from the editor and the parts list too', onEditor && onBom);
  check('?: no page errors', errors.length === 0, errors);
  await ctx.close(); }

// ---------- F. ? pop-up and layout at 375 ----------
{ const { ctx, page } = await fresh({ viewport: { width: 375, height: 812 } });
  await page.click('#btnHelp');
  const m = await page.evaluate(() => { const d = document.getElementById('helpDialog'); const r = d.getBoundingClientRect(); return { overflowX: document.documentElement.scrollWidth - innerWidth, dialog: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)], dialogScrollW: d.scrollWidth - d.clientWidth, tabsOffscreen: [...d.querySelectorAll('[role=tab]')].filter((t) => t.getBoundingClientRect().right > innerWidth).length }; });
  data.help375 = m;
  check('?: fits at 375 px with no horizontal scroll', m.overflowX === 0 && m.dialog[0] >= 0 && m.dialog[0] + m.dialog[2] <= 375 && m.dialogScrollW === 0 && m.tabsOffscreen === 0, m);
  await ctx.close(); }

// ---------- G. Which visible strings are not in the deck ----------
const allRuns = [...new Set(Object.values(screens).flatMap((s) => s.runs))];
data.visibleStringsNotInDeck = allRuns.filter((t) => !inDeck(t));
data.visibleStringsInDeck = allRuns.filter((t) => inDeck(t)).length;
data.screens = Object.fromEntries(Object.entries(screens).map(([k, v]) => [k, { innerTextLength: v.innerTextLength, research: v.research, vocab: v.vocab, handoffS8: v.handoffS8, bomMentions: v.bomMentions, parenS: v.parenS }]));
check('no "(s)" plurals on any screen', Object.values(screens).every((s) => s.parenS === 0));
check('BOM only ever appears on the role screen (reseller card)', Object.entries(screens).every(([k, s]) => (k.startsWith('1-auth') ? s.bomMentions === 1 : s.bomMentions === 0)), Object.fromEntries(Object.entries(screens).map(([k, s]) => [k, s.bomMentions])));
console.log('\nVisible strings that are not in the deck (' + data.visibleStringsNotInDeck.length + ' of ' + allRuns.length + '):\n  ' + data.visibleStringsNotInDeck.join('\n  '));

await browser.close();
const failed = checks.filter((c) => !c.pass);
writeFileSync(new URL(`./out/verify-${label}.json`, import.meta.url), JSON.stringify({ target, checks, data }, null, 2));
console.log(`\n${checks.length - failed.length}/${checks.length} checks passed` + (failed.length ? `\nFAILED:\n  ${failed.map((f) => f.id).join('\n  ')}` : ''));
process.exit(failed.length ? 1 : 0);
