// Light QA pass over the static planner-flows prototype (file://). Isolated Playwright contexts; writes only to RV_QA_OUT.
// Run: RV_QA_OUT=<writable dir> node audit-prototype.mjs
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from '../../hackathon-3d-viewer/node_modules/playwright/index.mjs';
import { writeFileSync, mkdirSync } from 'node:fs';

const OUT = process.env.RV_QA_OUT || fileURLToPath(new URL('./out', import.meta.url));
const SHOTS = `${OUT}/shots`;
mkdirSync(SHOTS, { recursive: true });
const URL_ = pathToFileURL(fileURLToPath(new URL('../../prototypes/room-vibez-planner-flows/index.html', import.meta.url))).href;
const results = {};
const rec = (id, name, observed) => { results[id] = { name, observed }; console.log(`\n## ${id} | ${name}\n${JSON.stringify(observed, null, 1).slice(0, 5000)}`); };

function qaInit() {
  const parse = (s) => { const m = String(s).match(/rgba?\(([^)]+)\)/); if (!m) return [0, 0, 0, 0]; const p = m[1].split(/[,\s/]+/).filter(Boolean).map(Number); return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1]; };
  const over = (top, bot) => [0, 1, 2].map((i) => top[i] * top[3] + bot[i] * (1 - top[3])).concat(1);
  const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
  const ratio = (a, b) => { const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x); return (l1 + 0.05) / (l2 + 0.05); };
  const hex = (c) => '#' + c.slice(0, 3).map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
  // Body uses gradients (background-image); approximate the page backdrop with the mid gradient stop.
  const bgOf = (el) => { const chain = []; for (let e = el; e; e = e.parentElement) chain.push(e); let bg = [232, 236, 230, 1]; for (const e of chain.reverse()) { const c = parse(getComputedStyle(e).backgroundColor); if (c[3] > 0) bg = over(c, bg); } return bg; };
  const vis = (el) => !!el && el.getClientRects().length > 0 && (el.checkVisibility ? el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }) : true);
  const d = (el) => { if (!el) return null; const t = (el.innerText || el.value || el.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 40); return `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${!el.id && typeof el.className === 'string' && el.className ? '.' + el.className.trim().split(/\s+/).join('.') : ''}${t ? ` "${t}"` : ''}`; };
  const textAudit = () => {
    const out = [];
    for (const el of document.querySelectorAll('body *')) {
      if (!vis(el) || el.closest('svg')) continue;
      const isField = /^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName) && !/file|checkbox/.test(el.type);
      if (![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()) && !isField) continue;
      const cs = getComputedStyle(el);
      let bg = bgOf(el); let fg = over(parse(cs.color), bg); let op = 1;
      for (let e = el; e && e !== document.documentElement; e = e.parentElement) { const o = parseFloat(getComputedStyle(e).opacity); if (o < 1) { op *= o; const bd = e.parentElement ? bgOf(e.parentElement) : bg; fg = over([fg[0], fg[1], fg[2], o], bd); bg = over([bg[0], bg[1], bg[2], o], bd); } }
      const size = parseFloat(cs.fontSize), weight = parseInt(cs.fontWeight, 10);
      const large = size >= 24 || (size >= 18.66 && weight >= 700);
      out.push({ el: d(el), size: +size.toFixed(1), fg: hex(fg), bg: hex(bg), ratio: +ratio(fg, bg).toFixed(2), need: large ? 3 : 4.5, disabled: !!el.closest('[disabled]'), opacity: +op.toFixed(2) });
    }
    return out;
  };
  const targets = () => [...document.querySelectorAll('a[href],button,select,input:not([type=hidden]),textarea,summary,[tabindex]:not([tabindex="-1"])')].filter(vis).map((e) => { const r = e.getBoundingClientRect(); return { el: d(e), w: Math.round(r.width), h: Math.round(r.height), disabled: !!e.disabled }; });
  const facts = () => {
    const tally = (arr) => { const o = {}; for (const v of arr) o[v] = (o[v] || 0) + 1; return Object.fromEntries(Object.entries(o).sort((a, b) => b[1] - a[1])); };
    const textEls = [...document.querySelectorAll('body *')].filter((e) => vis(e) && [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()) && !e.closest('svg'));
    return {
      screen: document.querySelector('.screen.active')?.id,
      overflowX: document.documentElement.scrollWidth - innerWidth,
      offenders: [...document.querySelectorAll('body *')].filter((e) => vis(e) && e.getBoundingClientRect().right > innerWidth + 1).map(d).slice(0, 6),
      headings: [...document.querySelectorAll('h1,h2,h3,h4')].filter(vis).map((h) => `${h.tagName} ${h.innerText.trim().slice(0, 50)}`),
      fontSizes: tally(textEls.map((e) => `${parseFloat(getComputedStyle(e).fontSize).toFixed(1)}px`)),
      fontFamilies: tally(textEls.map((e) => getComputedStyle(e).fontFamily.split(',')[0].trim())),
      fontsLoaded: [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family).filter((v, i, a) => a.indexOf(v) === i),
      brand: document.querySelector('.brand')?.innerText,
      title: document.title,
    };
  };
  window.__qa = { textAudit, targets, facts, d, vis };
}
const QA_SRC = `(${qaInit.toString()})()`;
const browser = await chromium.launch({ channel: 'chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });

async function open(viewport, mobile = false) {
  const ctx = await browser.newContext({ viewport, ...(mobile ? { hasTouch: true, isMobile: true, deviceScaleFactor: 2 } : {}) });
  await ctx.addInitScript(QA_SRC);
  const page = await ctx.newPage();
  const requests = []; const failed = []; const errors = [];
  page.on('request', (r) => { if (!r.url().startsWith('file:')) requests.push(new URL(r.url()).host); });
  page.on('requestfailed', (r) => failed.push(r.url().slice(0, 80)));
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(URL_);
  await page.waitForTimeout(1500);
  return { ctx, page, requests, failed, errors };
}
const summarize = (rows) => {
  const fails = rows.filter((r) => r.ratio < r.need);
  const g = {};
  for (const r of fails) { const k = `${r.fg} on ${r.bg} = ${r.ratio}:1 (${r.size}px${r.disabled ? ', disabled control' : ''}${r.opacity < 1 ? `, opacity ${r.opacity}` : ''})`; (g[k] ||= []).push(r.el); }
  return { textElements: rows.length, failing: fails.length, failingExcludingDisabled: fails.filter((r) => !r.disabled).length, groups: Object.entries(g).map(([pair, els]) => ({ pair, count: els.length, examples: els.slice(0, 3) })) };
};
const section = async (id, name, fn) => { try { rec(id, name, await fn()); } catch (err) { rec(id, name, { SCRIPT_ERROR: String(err?.message ?? err).slice(0, 400) }); } };
const toEditor = async (page) => { await page.click('#btnSkipDemo'); await page.waitForTimeout(900); };

await section('P01', 'Auth screen 1440x900: structure, contrast, targets, external requests, keyboard', async () => {
  const { ctx, page, requests, failed, errors } = await open({ width: 1440, height: 900 });
  const facts = await page.evaluate(() => window.__qa.facts());
  const contrast = summarize(await page.evaluate(() => window.__qa.textAudit()));
  const targets = await page.evaluate(() => window.__qa.targets());
  const stops = [];
  for (let i = 0; i < 20; i++) { await page.keyboard.press('Tab'); const s = await page.evaluate(() => { const e = document.activeElement; if (!e || e === document.body) return null; const cs = getComputedStyle(e); return { el: window.__qa.d(e), outline: `${cs.outlineStyle} ${cs.outlineWidth}` }; }); if (!s) break; stops.push(s); }
  await page.screenshot({ path: `${SHOTS}/P01-auth-1440.png` });
  await ctx.close();
  return { facts, contrast, targetsUnder24: targets.filter((t) => t.h < 24 || t.w < 24), targetsUnder44: targets.filter((t) => t.h < 44).length, targetsTotal: targets.length, tabOrder: stops.map((s) => `${s.el} [${s.outline}]`), externalHostsRequested: [...new Set(requests)], failedRequests: failed, errors };
});

await section('P02', 'Editor screen 1440x900 (via "Open demo project")', async () => {
  const { ctx, page, errors } = await open({ width: 1440, height: 900 });
  await toEditor(page);
  const facts = await page.evaluate(() => window.__qa.facts());
  const contrast = summarize(await page.evaluate(() => window.__qa.textAudit()));
  const targets = await page.evaluate(() => window.__qa.targets());
  const rolePill = await page.locator('#rolePill').innerText();
  await page.screenshot({ path: `${SHOTS}/P02-editor-1440.png` });
  await page.click('#btnOpenBom');
  await page.waitForTimeout(500);
  const bom = { facts: await page.evaluate(() => window.__qa.facts()), contrast: summarize(await page.evaluate(() => window.__qa.textAudit())), restart: await page.evaluate(() => { const b = document.getElementById('btnRestart'); const cs = getComputedStyle(b); return { className: b.className, bg: cs.backgroundColor, color: cs.color }; }) };
  await page.screenshot({ path: `${SHOTS}/P02-bom-1440.png` });
  await ctx.close();
  return { facts, rolePillAfterSkipDemo: rolePill, contrast, targetsUnder24: targets.filter((t) => t.h < 24 || t.w < 24), targetsUnder32: targets.filter((t) => t.h < 32).map((t) => `${t.el} ${t.w}x${t.h}`), targetsTotal: targets.length, bom, errors };
});

await section('P03', 'Mobile 375x812: horizontal overflow per screen', async () => {
  const { ctx, page } = await open({ width: 375, height: 812 }, true);
  const auth = await page.evaluate(() => { const f = window.__qa.facts(); return { overflowX: f.overflowX, offenders: f.offenders }; });
  await page.screenshot({ path: `${SHOTS}/P03-mobile-auth-375.png` });
  await page.locator('#btnSkipDemo').scrollIntoViewIfNeeded();
  // A real pointer click on this button timed out in the first run because another element sat on top of it. Record what covers it.
  auth.skipDemoButton = await page.evaluate(() => { const b = document.getElementById('btnSkipDemo'); const r = b.getBoundingClientRect(); const pts = [[r.left + r.width / 2, r.top + r.height / 2], [r.left + 6, r.top + 6], [r.right - 6, r.bottom - 6]]; const hits = pts.map(([x, y]) => { const e = document.elementFromPoint(x, y); return e === b || b.contains(e) ? 'button' : window.__qa.d(e); }); return { rect: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)], viewport: [innerWidth, innerHeight], elementAtCentreAndCorners: hits, pageScrollX: Math.round(scrollX), mainOverflow: getComputedStyle(document.querySelector('.main')).overflow }; });
  await page.screenshot({ path: `${SHOTS}/P03-mobile-auth-375-skip-button.png` });
  await page.evaluate(() => document.getElementById('btnSkipDemo').click());
  await page.waitForTimeout(900);
  const editor = await page.evaluate(() => { const f = window.__qa.facts(); return { screen: f.screen, overflowX: f.overflowX, offenders: f.offenders }; });
  await page.screenshot({ path: `${SHOTS}/P03-mobile-editor-375.png` });
  await ctx.close();
  return { auth, editor };
});

await browser.close();
writeFileSync(`${OUT}/prototype-results.json`, JSON.stringify(results, null, 2));
console.log(`\nWrote ${OUT}/prototype-results.json`);
