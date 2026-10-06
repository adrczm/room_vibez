// Every user-facing string that is new or changed versus the pristine copy, and whether deck §5-§7 has it word for word.
import { readFileSync, writeFileSync } from 'node:fs';
const BASE = process.argv[2], NEW = '/Users/adrian/Desktop/Room Vibez/v2/prototypes/room-vibez-planner-flows';
const deckLines = readFileSync('/Users/adrian/Desktop/Room Vibez/docs/ux-copy-deck.md', 'utf8').split('\n');
const deck = deckLines.slice(449, 596).join('\n').replace(/\*\*/g, '').replace(/\*/g, '').replace(/`/g, '').replace(/\s+/g, ' ');
const norm = (s) => s.replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
function htmlStrings(src) {
  const body = src.slice(src.indexOf('<body'));
  const out = new Set();
  for (const m of body.replace(/<!--[\s\S]*?-->/g, '').replace(/<script[\s\S]*?<\/script>/g, '').matchAll(/>([^<]+)</g)) { const t = norm(m[1]); if (t) out.add(t); }
  for (const m of body.matchAll(/\b(placeholder|title|aria-label|value)="([^"]*)"/g)) { const t = norm(m[2]); if (t) out.add(`[${m[1]}] ${t}`); }
  return out;
}
function jsStrings(src) {
  const out = new Set();
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  for (const m of code.matchAll(/"((?:[^"\\]|\\.)*)"|`((?:[^`\\]|\\.)*)`/g)) { const t = norm(m[1] ?? m[2]); if (/[A-Za-z]{3}/.test(t) && / |\.$|^[A-Z][a-z]+ [a-z]/.test(t) && !/^[#.\[]|querySelector|translate\(|position:|<rect|<div|<p class/.test(t)) out.add(t); }
  return out;
}
const oldS = new Set([...htmlStrings(readFileSync(BASE + '/index.html', 'utf8')), ...jsStrings(readFileSync(BASE + '/app.js', 'utf8'))]);
const newS = [...htmlStrings(readFileSync(NEW + '/index.html', 'utf8')), ...jsStrings(readFileSync(NEW + '/app.js', 'utf8'))];
const added = newS.filter((s) => !oldS.has(s));
const removed = [...oldS].filter((s) => !newS.includes(s));
const inDeck = (s) => deck.includes(s.replace(/^\[[a-z-]+\] /, '').replace(/\$\{[^}]+\}/g, '\u0000').split('\u0000').sort((a, b) => b.length - a.length)[0].trim());
const rows = added.map((s) => ({ s, inDeck: inDeck(s) }));
console.log('NEW OR CHANGED STRINGS: ' + rows.length + '\n-- found in deck §5-§7 (' + rows.filter((r) => r.inDeck).length + '):'); rows.filter((r) => r.inDeck).forEach((r) => console.log('   ' + r.s));
console.log('-- NOT in deck §5-§7 (' + rows.filter((r) => !r.inDeck).length + '):'); rows.filter((r) => !r.inDeck).forEach((r) => console.log('   ' + r.s));
console.log('\nREMOVED STRINGS: ' + removed.length); removed.forEach((s) => console.log('   ' + s));
writeFileSync(new URL('./out/strings-diff.json', import.meta.url), JSON.stringify({ added: rows, removed }, null, 2));
