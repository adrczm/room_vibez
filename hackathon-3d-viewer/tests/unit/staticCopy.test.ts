/**
 * index.html holds no visible words of its own: each element names a string of `src/copy.ts`
 * (`data-copy`, `data-copy-aria-label`, `data-copy-title`, `data-copy-placeholder`, and
 * `data-unit-label` for the labels that end in a unit), and `main.ts` writes them at boot
 * (`initStaticCopy`, `syncUnitLabels`). A key that does not exist would leave a control without
 * its label, and only at run time. This test reads index.html and checks every key.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { copy } from '../../src/copy';

const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
// Comments explain the attributes and quote them; they are not elements.
const markup = html.replace(/<!--[\s\S]*?-->/g, '');

function keysOf(attribute: string): string[] {
  const re = new RegExp(`\\s${attribute}="([^"]*)"`, 'g');
  return [...markup.matchAll(re)].map((m) => m[1]!);
}

function copyAt(path: string): unknown {
  let node: unknown = copy;
  for (const key of path.split('.')) {
    node = node && typeof node === 'object' ? (node as Record<string, unknown>)[key] : undefined;
  }
  return node;
}

const STATIC_ATTRIBUTES = ['data-copy', 'data-copy-aria-label', 'data-copy-title', 'data-copy-placeholder'];

describe('index.html takes its words from src/copy.ts', () => {
  it('names an existing, plain string with every data-copy attribute', () => {
    const keys = STATIC_ATTRIBUTES.flatMap((attribute) => keysOf(attribute).map((key) => [attribute, key] as const));
    expect(keys.length).toBeGreaterThan(80);
    for (const [attribute, key] of keys) {
      const text = copyAt(key);
      expect(typeof text, `${attribute}="${key}"`).toBe('string');
      // These are written as they are: no placeholder to fill, no ** emphasis to turn into nodes.
      expect(text, `${attribute}="${key}"`).not.toMatch(/\{\w+\}|\*\*/);
    }
  });

  it('names a string with a {unit} placeholder with every data-unit-label attribute', () => {
    const keys = keysOf('data-unit-label');
    // The four room size fields and the three opening fields (deck §3.5 and §3.6).
    expect(keys).toEqual([
      'roomStart.lengthLabel',
      'roomStart.widthLabel',
      'roomStart.ceilingHeightLabel',
      'roomStart.wallThicknessLabel',
      'roomTools.openingWidthLabel',
      'roomTools.openingHeightLabel',
      'roomTools.openingSillLabel',
    ]);
    for (const key of keys) expect(copyAt(key), key).toMatch(/\(\{unit\}\)$/);
  });

  it('has a unit abbreviation for every option of the Units select', () => {
    const units = [...markup.matchAll(/<option value="([^"]+)" data-copy="roomStart\.units\./g)].map((m) => m[1]!);
    expect(units).toEqual(['m', 'cm', 'ft-in']);
    for (const unit of units) expect(typeof copyAt(`notInDeck.unitAbbrev.${unit}`), unit).toBe('string');
  });

  it('keeps visible words out of the markup', () => {
    // Text between tags, outside comments, script and the three texts that show before the
    // script runs (the title, the brand, "Loading…") and the one technical sentence that is kept
    // unchanged under "Technical details" (Copy Phase 1 step 6; it is not in copy.ts on purpose).
    const allowed = new Set([
      'Catalog 3D',
      'Loading…',
      'ODA / APS not available here',
      '— DWG/DXF use a clearly labeled mock fixture extract, not real entity parsing.',
      'null', // the room graph JSON view before the script fills it
    ]);
    const body = markup.slice(markup.indexOf('<body'));
    const texts = body
      .replace(/<script[\s\S]*?<\/script>/g, '')
      .split(/<[^>]+>/)
      .map((t) => t.trim())
      .filter((t) => t && /[A-Za-z]/.test(t));
    // (The step numbers 1 to 4 are digits, not words, and are not looked at.)
    expect(texts.filter((t) => !allowed.has(t))).toEqual([]);
    // No attribute carries typed words either.
    expect(body).not.toMatch(/\s(aria-label|title|placeholder|alt)="/);
  });
});
