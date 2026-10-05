import { describe, expect, it } from 'vitest';
import { copy, fmt, plain, plural, rich, type CopyShape } from '../../src/copy';

/** Every string in a group, with its dotted key. */
function leaves(node: unknown, path: string, out: Array<[string, string]> = []): Array<[string, string]> {
  if (typeof node === 'string') out.push([path, node]);
  else for (const [k, v] of Object.entries(node as object)) leaves(v, path ? `${path}.${k}` : k, out);
  return out;
}

const ALL = leaves(copy, '');

describe('plural', () => {
  it('picks the form with Intl.PluralRules and fills {n}', () => {
    expect(plural(1, copy.roomTools.productCount)).toBe('1 product');
    expect(plural(2, copy.roomTools.productCount)).toBe('2 products');
    expect(plural(0, copy.roomTools.openingCount)).toBe('0 openings');
    expect(plural(1, copy.roomTools.openingCount)).toBe('1 opening');
  });

  it('accepts (n, one, other) as the copy handoff names it', () => {
    expect(plural(1, '{n} wall', '{n} walls')).toBe('1 wall');
    expect(plural(4, '{n} wall', '{n} walls')).toBe('4 walls');
    expect(plural(1, 'template', 'templates')).toBe('template');
    expect(plural(3, 'template', 'templates')).toBe('templates');
  });

  it('formats large counts and leaves other placeholders for fmt', () => {
    expect(plural(1200, copy.modelMessages.partCount)).toBe('1,200 parts');
    const forms = copy.slotWarnings.noUv;
    expect(fmt(plural(1, forms), { parts: 'seat' })).toBe(
      'seat has no UV mapping, so textures will look flat or wrong. Re-export with UVs.',
    );
    expect(fmt(plural(2, forms), { parts: 'seat, leg' })).toBe(
      'seat, leg have no UV mapping, so textures will look flat or wrong. Re-export with UVs.',
    );
  });

  it('uses extra CLDR forms when a translation supplies them', () => {
    expect(plural(0, { zero: 'none', one: 'one', other: 'many' })).toBe('many'); // English has no "zero" category
    expect(plural(1.5, { one: 'one', other: '{n} other' })).toBe('1.5 other');
  });
});

describe('fmt', () => {
  it('fills placeholders', () => {
    expect(fmt(copy.roomMessages.placed, { name: 'Lounge chair (demo)' })).toBe('Placed “Lounge chair (demo)”.');
    expect(fmt(copy.stageHints.placeProduct, { product: 'Side table (demo)' })).toBe(
      'Click the floor to place “Side table (demo)”.',
    );
    expect(fmt(copy.roomStart.lengthLabel, { unit: copy.notInDeck.unitAbbrev.cm })).toBe('Length (cm)');
    expect(fmt(copy.roomStart.scaleSuggested, { length: 5 })).toBe('The drawing suggests this wall is 5 m.');
  });

  it('inserts values as text, including regex replacement patterns', () => {
    expect(fmt(copy.roomMessages.placed, { name: '$& $1 {name} <b>x</b>' })).toBe('Placed “$& $1 {name} <b>x</b>”.');
  });

  it('leaves a placeholder that has no value, and ignores prototype keys', () => {
    const loose: string = copy.roomMessages.placed;
    expect(fmt(loose, {})).toBe('Placed “{name}”.');
    const tricky: string = 'a {toString} b';
    expect(fmt(tricky, {})).toBe('a {toString} b');
  });

  it('builds the deck examples from their pieces', () => {
    // Deck §3.6: Living · 5.00 × 4.00 m · ceiling 2.70 m · 1 opening · 2 products
    expect(
      fmt(copy.roomTools.roomSummary, {
        name: 'Living',
        size: fmt(copy.roomTools.roomSize, { length: '5.00', width: '4.00', unit: 'm' }),
        ceiling: '2.70 m',
        openings: plural(1, copy.roomTools.openingCount),
        products: plural(2, copy.roomTools.productCount),
      }),
    ).toBe('Living · 5.00 × 4.00 m · ceiling 2.70 m · 1 opening · 2 products');
    // Deck §4.A: Added “X” · 3 parts · 2 materials from the .mtl · gone when you refresh
    expect(
      fmt(copy.modelMessages.addedWithMtl, {
        name: 'X',
        parts: plural(3, copy.modelMessages.partCount),
        materials: plural(2, copy.modelMessages.mtlMaterialCount),
      }),
    ).toBe('Added “X” · 3 parts · 2 materials from the .mtl · gone when you refresh');
    // Deck §3.5: Title · 4 walls / 3 saved in this browser. / Door · 0.90 m · estimated
    expect(fmt(copy.roomStart.templateRow, { title: 'Title', walls: plural(4, copy.roomStart.wallCount) })).toBe(
      'Title · 4 walls',
    );
    expect(plural(3, copy.roomStart.templateCount)).toBe('3 saved in this browser.');
    expect(fmt(copy.roomStart.openingRowEstimated, { type: copy.roomStart.openingTypes.door, width: '0.90 m' })).toBe(
      'Door · 0.90 m · estimated',
    );
    // Deck §4.F: 3 corners. Click the first one to close. / Room closed · 6 walls.
    expect(plural(3, copy.roomMessages.drawProgress)).toBe('3 corners. Click the first one to close.');
    expect(plural(6, copy.roomMessages.drawClosed)).toBe('Room closed · 6 walls.');
  });

  it('type-checks placeholders of literal templates', () => {
    // @ts-expect-error "name" is required by the template
    fmt(copy.roomMessages.placed, {});
    // @ts-expect-error "nmae" is not a placeholder of the template
    fmt(copy.roomMessages.placed, { nmae: 'x' });
    expect(fmt(copy.roomMessages.undid, {})).toBe('Undid last change.');
  });
});

describe('rich and plain', () => {
  it('splits ** runs and fills placeholders after the split', () => {
    expect(rich(copy.roomStart.sampleBanner)).toEqual([
      { text: 'Sample result.', strong: true },
      {
        text: ' Your file was kept but not read. These walls come from a built-in example, not your drawing.',
        strong: false,
      },
    ]);
    expect(rich(copy.roomMessages.sizeInvalidField, { field: 'Wall **thickness**' })).toEqual([
      { text: 'Wall **thickness**', strong: true },
      { text: ' needs a number above 0.', strong: false },
    ]);
    expect(rich(copy.roomMessages.savingBlocked).filter((s) => s.strong).map((s) => s.text)).toEqual([
      "Your browser won't save your work.",
      'Export project',
    ]);
    expect(rich(copy.roomMessages.undid)).toEqual([{ text: 'Undid last change.', strong: false }]);
  });

  it('plain() gives the sentence without markers', () => {
    expect(plain(copy.topBarAndStage.overlayCouldntStart)).toBe(
      "The viewer couldn't start. Reload the page. If it happens again, your saved room may be damaged.",
    );
    expect(plain(copy.roomMessages.importFailed)).toBe(
      "Couldn't open that file. It isn't a Catalog 3D project, or it's damaged. Your current room is unchanged.",
    );
  });

  it('builds the two destructive confirmation bodies of deck §5', () => {
    const clear = fmt(copy.confirm.clearRoom.body, {
      openings: plural(1, copy.confirm.clearRoom.openingCount),
      products: plural(2, copy.confirm.clearRoom.placedProductCount),
    });
    expect(plain(clear)).toBe(
      "This removes the walls, 1 opening and 2 placed products. You can't undo it. Export project first if you want to keep it.",
    );
    const replace = rich(copy.confirm.replaceRoom.body, {
      products: plural(2, copy.confirm.replaceRoom.placedProductCount),
    });
    expect(replace.map((s) => s.text).join('')).toBe(
      "Your current room and its 2 placed products will be replaced, and you won't be able to undo it. Export project first to keep a copy.",
    );
    expect(replace.find((s) => s.strong)?.text).toBe("you won't be able to undo it.");
  });
});

describe('copy object', () => {
  it('has the deck groups and a separate "not in the deck" group', () => {
    expect(Object.keys(copy)).toEqual([
      'common',
      'helperLines',
      'topBarAndStage',
      'stageHints',
      'productCard',
      'roomStart',
      'roomTools',
      'modelMessages',
      'textureMessages',
      'packMessages',
      'slotWarnings',
      'planMessages',
      'roomMessages',
      'confirm',
      'notInDeck',
    ]);
    const shape: CopyShape = copy; // a translation must have the same keys
    expect(shape.topBarAndStage.brand).toBe('Catalog 3D'); // pinned by e2e
  });

  it('holds only non-empty, trimmed strings', () => {
    expect(ALL.length).toBeGreaterThan(300);
    for (const [key, text] of ALL) {
      expect(text, key).not.toBe('');
      expect(text, key).toBe(text.trim());
    }
  });

  it('never writes a plural as "(s)"', () => {
    for (const [key, text] of ALL) expect(text, key).not.toMatch(/\(s\)/);
  });

  it('gives every plural group both English forms', () => {
    const groups = new Map<string, Set<string>>();
    for (const [key] of ALL) {
      const m = /^(.*)\.(one|other|zero|two|few|many)$/.exec(key);
      if (m) groups.set(m[1]!, (groups.get(m[1]!) ?? new Set()).add(m[2]!));
    }
    expect(groups.size).toBeGreaterThanOrEqual(12);
    for (const [key, forms] of groups) expect([...forms].sort(), key).toEqual(['one', 'other']);
  });

  it('uses word placeholders and curly quotes around names', () => {
    for (const [key, text] of ALL) {
      if (key === 'modelMessages.sidecarShape') continue; // a JSON example, braces and straight quotes on purpose
      for (const brace of text.match(/\{[^}]*\}/g) ?? []) expect(brace, key).toMatch(/^\{\w+\}$/);
      expect(text, key).not.toMatch(/"\{\w+\}"|'\{\w+\}'/);
      expect((text.match(/“/g) ?? []).length, key).toBe((text.match(/”/g) ?? []).length);
    }
  });

  it('keeps ** emphasis to the keys that document it, always in pairs', () => {
    const withMarkers = ALL.filter(([, text]) => text.includes('**')).map(([key]) => key);
    expect(withMarkers.sort()).toEqual(
      [
        'topBarAndStage.overlayNoWebgl',
        'topBarAndStage.overlayCouldntStart',
        'roomStart.sampleBanner',
        'roomMessages.sizeInvalidField',
        'roomMessages.importFailed',
        'roomMessages.savingBlocked',
        'roomMessages.savedRoomUnreadable',
        'confirm.clearRoom.body',
        'confirm.replaceRoom.body',
        'notInDeck.sampleBannerBuiltIn',
      ].sort(),
    );
    for (const [key, text] of ALL) {
      expect((text.match(/\*\*/g) ?? []).length % 2, key).toBe(0);
      expect(plain(text), key).not.toMatch(/\*/);
    }
  });

  it('keeps team vocabulary out of the strings (the regex of the copy handoff §8)', () => {
    const TEAM_WORDS =
      /(SoT|SoR|MVP|\bstub\b|ingress|candidates|fixture|Polyfork|material_slot_id|\bmock\b|createAsset|COLOR_0|normalizeRoomGraph|Unknown \/ not in public)/i;
    // The deck's own "Not a pack" message names createAsset (deck §4.C). Reported as a deck problem.
    const DECK_EXCEPTIONS = new Set(['packMessages.notAPack', 'packMessages.notAPackNoExports']);
    for (const [key, text] of ALL) {
      if (DECK_EXCEPTIONS.has(key)) continue;
      expect(text, key).not.toMatch(TEAM_WORDS);
    }
    expect(copy.packMessages.notAPack).toMatch(/createAsset/);
  });

  it('carries the strings the handoffs give word for word', () => {
    const n = copy.notInDeck;
    expect(n.addToRoom).toBe('Add to room'); // UX-08 item 3
    expect(n.picker.searchProducts).toBe('Search products'); // UX-14 step 7
    expect(n.picker.noProductsMatch).toBe('No products match.');
    expect(n.picker.close).toBe('Close');
    expect(n.picker.thumbnails).toBe('Thumbnails');
    expect(n.picker.list).toBe('List');
    expect(n.picker.viewLabel).toBe('View');
    expect(n.appliesToNextProduct).toBe('Applies to the next product you place.'); // UX-16 step 3
    expect(fmt(n.uploadNotRestored, { name: 'stool' })).toBe(
      "“stool” isn't available after a refresh, so it wasn't placed back. Add the model again to use it.",
    ); // Copy §6 C
    expect(fmt(n.placedProducts.row, { name: 'Lounge chair', n: 2 })).toBe('Lounge chair 2'); // UX-09 item 2
  });
});
