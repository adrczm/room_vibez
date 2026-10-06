// "Before" word count on the wave-5 snapshot's index.html, deck §8 tokenizer (whitespace split; bare "·" and "—" skipped).
import fs from 'node:fs';
const html = fs.readFileSync(process.argv[2], 'utf8').replace(/<!--[\s\S]*?-->/g, '');
const count = (t) => t.trim().split(/\s+/).filter((w) => w && w !== '·' && w !== '—').length;
const ps = [...html.matchAll(/<p\b([^>]*)>([\s\S]*?)<\/p>/g)].map((m) => ({ attrs: m[1], text: m[2].replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim() })).filter((p) => p.text);
let total = 0, sidebar = 0;
for (const p of ps) { const n = count(p.text); total += n; const inTopOrStage = /workspace-mode-hint|stage-hint/.test(p.attrs); if (!inTopOrStage) sidebar += n; console.log(String(n).padStart(4), inTopOrStage ? 'top/stage' : 'sidebar  ', p.text.slice(0, 70)); }
console.log('paragraphs with text:', ps.length, 'total words:', total, 'sidebar only:', sidebar);
