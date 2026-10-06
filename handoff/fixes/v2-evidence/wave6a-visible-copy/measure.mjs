// Copy handoff §8 measurements on the live app: vocabulary regex in four states, static helper word count,
// fixed labels of button[aria-pressed], the F5 label-in-name audit.
import { launch, fresh, openStep, vocab, waitPlacements, OUT } from './lib.mjs';
import fs from 'node:fs';
const browser = await launch();
const res = {};

// ---- deck §8 tokenizer: split on whitespace, skip bare "·" and "—" marks
const countWords = `(t) => t.trim().split(/\\s+/).filter((w) => w && w !== '·' && w !== '—').length`;

{
  const { ctx, page, errors } = await fresh(browser, { viewport: { width: 1280, height: 800 } });
  // ---------- word count, default Product state ----------
  res.words = await page.evaluate((countSrc) => {
    const count = eval(countSrc);
    const txt = (el) => (el ? el.textContent.replace(/\s+/g, ' ').trim() : null);
    const q = (s) => document.querySelector(s);
    // The deck §3.1 rows that remain ("10 short lines"), as they are in the DOM in the default Product state.
    const deckRows = {
      '1 #workspace-mode-hint': q('#workspace-mode-hint'),
      '2 #stage-hint': q('#stage-hint'),
      '5 #import-oda-note (visible line, with Why?)': q('#import-oda-note .import-note-line'),
      '7 #template-status': q('#template-status'),
      '10 Add 3D model hint': q('#add-model-card .upload-hint'),
      '11 Load pack hint': q('label[for=pack-files] + .upload-hint'),
      '12 Load module hint': q('label[for=module-file] + .upload-hint'),
      '13 Add texture hint': q('.advanced-block .upload-hint'),
      '14 #room-status (no room)': q('#room-status'),
      'new Parts list note (with Why?)': q('#parts-note'),
    };
    const rows = Object.fromEntries(Object.entries(deckRows).map(([k, el]) => [k, { text: txt(el), words: el ? count(txt(el)) : null }]));
    const total = Object.values(rows).reduce((a, r) => a + (r.words ?? 0), 0);
    // Every <p> in the document that holds static helper text (not a status line the script fills later).
    const allP = [...document.querySelectorAll('p')].map((p) => ({ id: p.id || p.className, text: txt(p), words: txt(p) ? count(txt(p)) : 0, inSidebar: !!p.closest('.panel'), rendered: p.getClientRects().length > 0 })).filter((p) => p.words > 0);
    return { deckRows: rows, deckRowsTotal: total, allNonEmptyP: allP, allPTotal: allP.reduce((a, p) => a + p.words, 0), sidebarPTotal: allP.filter((p) => p.inSidebar).reduce((a, p) => a + p.words, 0), renderedPTotal: allP.filter((p) => p.rendered).reduce((a, p) => a + p.words, 0) };
  }, countWords);

  // ---------- F5 label in name (QA-14) ----------
  const f5 = () => page.evaluate(() => [...document.querySelectorAll('input,select,textarea')].filter((e) => e.getAttribute('aria-label')).map((e) => {
    let visible = ''; const lab = e.labels && e.labels[0];
    if (lab) { const c = lab.cloneNode(true); c.querySelectorAll('select,input,textarea').forEach((x) => x.remove()); visible = c.textContent.trim().replace(/\s+/g, ' '); }
    const name = e.getAttribute('aria-label');
    return { id: e.id, visibleLabel: visible || '(none)', accessibleName: name, ok: visible ? name.toLowerCase().includes(visible.toLowerCase()) : null };
  }));
  res.f5 = await f5();
  res.six = await page.evaluate(() => ['plan-file', 'model-files', 'pack-files', 'pack-glb-mate', 'module-file', 'texture-target'].map((id) => { const e = document.getElementById(id); const lab = e.labels?.[0] ?? document.querySelector(`label[for="${id}"]`) ?? e.closest('label'); return { id, ariaLabel: e.getAttribute('aria-label'), ariaHidden: e.getAttribute('aria-hidden'), label: lab ? (lab.querySelector('span') ?? lab).textContent.trim() : null }; }));

  // ---------- vocabulary, four states ----------
  res.vocab = {};
  res.vocab.product = await vocab(page);
  res.pressed = {};
  const pressed = () => page.evaluate(() => [...document.querySelectorAll('button[aria-pressed]')].filter((b) => b.getClientRects().length).map((b) => ({ key: b.id || b.dataset.material || `${b.closest('li')?.dataset.candidateId}:${b.dataset.include}`, label: b.textContent.trim() || b.getAttribute('aria-label'), pressed: b.getAttribute('aria-pressed') })));
  res.pressed.productBefore = await pressed();
  await page.click('.slot[data-slot=frame] .swatch[data-material=wood-walnut]');
  await page.waitForTimeout(600);
  res.pressed.productAfterSwatch = await pressed();

  await page.click('#workspace-mode button[data-mode=room]');
  await page.waitForTimeout(200);
  res.vocab.roomEmpty = await vocab(page);
  await page.click('#room-ingress button[data-ingress=import]');
  res.vocab.importTabNoReview = await vocab(page);
  await page.click('#btn-import-fixture');
  await page.waitForSelector('#import-review:not([hidden])');
  res.vocab.importReview = await vocab(page);
  res.pressed.reviewBefore = await pressed();
  await page.click('#import-wall-list li:nth-child(1) button[data-include=false]');
  res.pressed.reviewAfter = await pressed();
  res.vocab.importReviewAfterToggle = await vocab(page);
  // technical details open: what it then adds
  await page.click('#import-extract-banner summary');
  res.vocab.importReviewTechnicalOpen = await vocab(page);

  await page.click('#room-ingress button[data-ingress=scratch]');
  await page.selectOption('#room-preset', 'living');
  await page.click('#btn-create-room');
  await page.waitForFunction(() => (window.__rv.roomGraph()?.walls.length ?? 0) === 4);
  await page.waitForTimeout(300);
  res.vocab.roomAfterCreate = await vocab(page);
  await openStep(page, 'place');
  await page.click('#btn-add-to-room');
  await waitPlacements(page, 1);
  await page.waitForTimeout(600);
  res.vocab.roomWithProduct = await vocab(page);
  res.pressed.toolsOff = await pressed();
  await page.click('#btn-place-mode');
  res.pressed.placeOn = await pressed();
  await page.click('#btn-place-mode');
  await openStep(page, 'openings');
  await page.click('#btn-opening-mode');
  res.pressed.openingOn = await pressed();
  await page.click('#btn-opening-mode');
  await page.click('#btn-step-room-change');
  await page.click('#btn-draw-wall-mode');
  res.pressed.drawOn = await pressed();
  await page.click('#btn-draw-wall-mode');
  res.errors = errors;
  await ctx.close();
}
// fixed labels: a button key must map to one label across every snapshot
const labels = new Map(); const renamed = [];
for (const [state, list] of Object.entries(res.pressed)) for (const b of list) { if (labels.has(b.key) && labels.get(b.key) !== b.label) renamed.push({ key: b.key, was: labels.get(b.key), now: b.label, state }); labels.set(b.key, b.label); }
res.pressedSummary = { buttonsSeen: labels.size, renamed, statesSeen: Object.fromEntries(Object.entries(res.pressed).map(([k, v]) => [k, v.filter((b) => b.pressed === 'true').map((b) => `${b.key}=${b.label}`)])) };
fs.writeFileSync(`${OUT}/out/measure.json`, JSON.stringify(res, null, 2));
console.log('WORDS deck rows total', res.words.deckRowsTotal); for (const [k, r] of Object.entries(res.words.deckRows)) console.log('  ', String(r.words).padStart(3), k, '|', r.text);
console.log('all non-empty <p>:', res.words.allPTotal, 'sidebar:', res.words.sidebarPTotal, 'rendered:', res.words.renderedPTotal); for (const p of res.words.allNonEmptyP) console.log('  ', String(p.words).padStart(3), p.inSidebar ? 'S' : '-', p.rendered ? 'R' : '-', p.id, '|', p.text);
console.log('F5', JSON.stringify(res.f5)); console.log('SIX', JSON.stringify(res.six));
for (const [k, v] of Object.entries(res.vocab)) { console.log('VOCAB', k, 'count', v.count, '(s):', v.sPlurals.join(',')); for (const m of v.matches) console.log('     ', m.match, '|', m.line); }
console.log('PRESSED', JSON.stringify(res.pressedSummary, null, 1));
console.log('errors', res.errors);
await browser.close();
