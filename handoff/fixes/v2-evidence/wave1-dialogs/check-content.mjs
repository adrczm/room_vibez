// Compares the rendered text of each help tab with docs/ux-copy-deck.md §2, word for word.
import { readFileSync } from 'node:fs';
import { chromium } from '/private/tmp/claude-501/-Users-adrian-Desktop-Room-Vibez/7ac663fe-e0d6-4b3c-af69-487be083d847/scratchpad/ws-ui/node_modules/playwright/index.mjs';

const BASE = 'http://127.0.0.1:18783/ui-harness.html';
const deck = readFileSync('/Users/adrian/Desktop/Room Vibez/docs/ux-copy-deck.md', 'utf8').split('\n');

const starts = [];
deck.forEach((line, i) => {
  const m = /^### Tab (\d) — (.+)$/.exec(line);
  if (m) starts.push({ n: Number(m[1]), label: m[2].trim(), line: i });
});
const end = deck.findIndex((line, i) => i > starts[4].line && line.trim() === '---');
const sections = starts.map((s, k) => ({
  ...s,
  body: deck.slice(s.line + 1, k < 4 ? starts[k + 1].line : end),
}));

function mdToText(lines) {
  return lines
    .filter((l) => !l.startsWith('>')) // the "Hold this sentence until it's true" note
    .filter((l) => !/^\|\s*-+/.test(l)) // table separator rows
    .map((l) => l.replace(/^\s*(-|\d+\.)\s+/, '')) // list markers
    .map((l) => l.replace(/\|/g, ' '))
    .join(' ')
    .replace(/`#(import-plan|plans)`/g, '') // anchor markers
    .replace(/\(collapsed by default\)/g, '') // instruction
    .replace(/\*\*|`/g, '')
    .replace(/\*/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const INTERIM = 'If your browser blocks saving, your room only lasts while this tab is open.';
const SURFACED = 'If your browser blocks saving, the app tells you.';
const ids = ['start', 'product', 'room', 'files', 'built'];

const browser = await chromium.launch({ channel: 'chrome' });
let failures = 0;
let lastStep = 'start';
let lastStepAt = Date.now();
setInterval(() => {
  if (Date.now() - lastStepAt > 150000) {
    console.log(`WATCHDOG: no progress for 150 s after: ${lastStep}`);
    process.exit(3);
  }
}, 5000).unref();
for (const surfaced of [true, false]) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto(`${BASE}?surfaced=${surfaced ? 1 : 0}`);
  await page.waitForSelector('body[data-harness-ready="true"]');
  await page.click('.help-btn');
  await page.waitForSelector('#help-dialog[open]');
  const rendered = await page.evaluate(() => {
    const out = {};
    document.querySelectorAll('#help-dialog [role=tabpanel]').forEach((panel) => {
      const clone = panel.cloneNode(true);
      clone.querySelectorAll('th,td,li,p,h3,h4,summary').forEach((e) => e.append(' '));
      out[panel.dataset.helpPanel] = clone.textContent.replace(/\s+/g, ' ').trim();
    });
    return {
      panels: out,
      labels: [...document.querySelectorAll('#help-dialog [role=tab]')].map((t) => t.textContent),
      options: [...document.querySelectorAll('#help-topic option')].map((o) => o.textContent),
      title: document.getElementById('help-title').textContent,
    };
  });

  const labelsOk = JSON.stringify(rendered.labels) === JSON.stringify(sections.map((s) => s.label));
  const optionsOk = JSON.stringify(rendered.options) === JSON.stringify(sections.map((s) => s.label));
  console.log(`[surfaced=${surfaced}] tab labels match deck: ${labelsOk} ${JSON.stringify(rendered.labels)}`);
  console.log(`[surfaced=${surfaced}] Topic options match deck: ${optionsOk}`);
  console.log(`[surfaced=${surfaced}] title: ${JSON.stringify(rendered.title)}`);
  if (!labelsOk || !optionsOk || rendered.title !== 'How Catalog 3D works') failures++;

  sections.forEach((section, k) => {
    let expected = mdToText(section.body);
    if (ids[k] === 'files') {
      if (!expected.includes(SURFACED)) throw new Error('deck sentence not found in deck text');
      if (!surfaced) expected = expected.replace(SURFACED, INTERIM);
    }
    const actual = rendered.panels[ids[k]];
    const a = actual.split(' ');
    const e = expected.split(' ');
    let i = 0;
    while (i < Math.min(a.length, e.length) && a[i] === e[i]) i++;
    const same = a.length === e.length && i === a.length;
    console.log(`[surfaced=${surfaced}] tab ${k + 1} (${section.label}): ${same ? 'IDENTICAL' : 'DIFFERENT'} · ${e.length} words in deck, ${a.length} rendered`);
    if (!same) {
      failures++;
      console.log('   deck:     …' + e.slice(Math.max(0, i - 6), i + 8).join(' '));
      console.log('   rendered: …' + a.slice(Math.max(0, i - 6), i + 8).join(' '));
    }
  });
  if (!surfaced) {
    const files = rendered.panels.files;
    console.log(`[surfaced=false] interim sentence present: ${files.includes(INTERIM)}; deck sentence absent: ${!files.includes(SURFACED)}`);
    console.log(`[surfaced=false] "Use Export project to keep your work." appears ${files.split('Use Export project to keep your work.').length - 1} time(s)`);
  } else {
    const files = rendered.panels.files;
    console.log(`[surfaced=true] deck sentence present: ${files.includes(SURFACED)}; interim absent: ${!files.includes(INTERIM)}`);
  }
  await page.close();
}
await browser.close();
console.log(failures ? `FAILURES: ${failures}` : 'ALL CONTENT CHECKS PASSED');
process.exit(failures ? 1 : 0);
