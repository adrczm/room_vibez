// Scratch check: every string in the deck groups of copy.ts appears verbatim in deck §3–§5.
import { readFileSync } from 'node:fs';
const WS = process.env.WS!;
const DECK = process.env.DECK!;
const { copy } = await import(`${WS}/src/copy.ts`);
const deckAll = readFileSync(DECK, 'utf8').split('\n');
const start = deckAll.findIndex((l) => l.startsWith('## 3. Catalog 3D viewer'));
const end = deckAll.findIndex((l) => l.startsWith('## 6. Planner-flows prototype'));
const sec2 = deckAll.findIndex((l) => l.startsWith('## 2. The ? pop-up'));
const norm = (s: string) => s.replace(/\*\*/g, '').replace(/\*/g, '').replace(/`/g, '');
const deck = norm(deckAll.slice(start, end).join('\n'));
const deckWithSec2 = norm(deckAll.slice(sec2, end).join('\n'));
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const toRe = (s: string) =>
  new RegExp('(?<![A-Za-z{])(?:' + 
    norm(s)
      .split(/(\{\w+\})/)
      .map((part) => (/^\{\w+\}$/.test(part) ? '.+?' : esc(part)))
      .join('') + ')(?![A-Za-z}])',
  );
let total = 0;
const misses: string[] = [];
const walk = (node: unknown, path: string) => {
  if (typeof node === 'string') {
    total++;
    if (/^\{\w+\}$/.test(node)) return; // bare placeholder
    if (!toRe(node).test(deck)) misses.push(`${path}${toRe(node).test(deckWithSec2) ? '  [found in §2 only]' : ''}: ${node}`);
    return;
  }
  for (const [k, v] of Object.entries(node as object)) walk(v, path ? `${path}.${k}` : k);
};
for (const [group, value] of Object.entries(copy)) if (group !== 'notInDeck') walk(value, group);
console.log(`checked ${total} deck-group strings; not found verbatim in deck §3-§5: ${misses.length}`);
for (const m of misses) console.log('  MISS ' + m);
let n = 0; const count = (node: unknown) => { if (typeof node === 'string') n++; else for (const v of Object.values(node as object)) count(v); };
count(copy.notInDeck); console.log(`notInDeck strings: ${n}`);
