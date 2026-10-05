import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  MJS_NATIVE_CONFIRM_HINT,
  formatMjsGuardMessage,
  mjsGuardPrompt,
  parseMjsGuardMessage,
  scanMjsSource,
} from '../../src/viewer/mjsGuardrails';
import { importModuleFile } from '../../src/viewer/modules';

const PACK_SOURCE = `export function createAsset() { return { isObject3D: true }; }\nexport const params = {};\n`;
const RISKY_SOURCE = `export function createAsset() { fetch('/x'); localStorage.getItem('k'); return {}; }`;
const NOT_A_PACK = `console.log('hello');`;

// Wording copied from docs/ux-copy-deck.md §5, row "Load .mjs".
const TITLE = 'Run code from “chair.mjs”?';
const BASE =
  'An .mjs file is a program, not a model. It runs in this page and can do anything the page can. Only continue if you trust where it came from.';
const FLAGGED = 'A quick scan flagged: localStorage, fetch(. These are unusual for a furniture pack.';
const NOT_PACK_LIKE = "This file doesn't look like a furniture pack.";

describe('.mjs confirmation wording (deck §5)', () => {
  it('clean pack: title and the fixed warning only', () => {
    const prompt = mjsGuardPrompt(scanMjsSource(PACK_SOURCE), 'chair.mjs');
    expect(prompt).toEqual({ title: TITLE, paragraphs: [BASE] });
  });

  it('flagged source adds the scan line, naming what was flagged', () => {
    const prompt = mjsGuardPrompt(scanMjsSource(RISKY_SOURCE), 'chair.mjs');
    expect(prompt.paragraphs).toEqual([BASE, FLAGGED]);
  });

  it('source that is not pack-like adds the last line', () => {
    const prompt = mjsGuardPrompt(scanMjsSource(NOT_A_PACK), 'chair.mjs');
    expect(prompt.paragraphs).toEqual([BASE, NOT_PACK_LIKE]);
  });

  it('flagged and not pack-like: scan line first, as in the deck', () => {
    const scan = scanMjsSource(`fetch('/x'); localStorage.clear();`);
    expect(scan.looksLikeAssetModule).toBe(false);
    expect(mjsGuardPrompt(scan, 'chair.mjs').paragraphs).toEqual([BASE, FLAGGED, NOT_PACK_LIKE]);
  });

  it('the message string is title, blank line, body; parse splits it back', () => {
    const scan = scanMjsSource(`fetch('/x'); localStorage.clear();`);
    const message = formatMjsGuardMessage(scan, 'chair.mjs');
    expect(message).toBe(`${TITLE}\n\n${BASE}\n\n${FLAGGED}\n\n${NOT_PACK_LIKE}`);
    expect(message.split('\n')[0]).toBe(TITLE);
    expect(parseMjsGuardMessage(message)).toEqual(mjsGuardPrompt(scan, 'chair.mjs'));
  });

  it('keeps the words the deck retires out of the message', () => {
    const message = formatMjsGuardMessage(scanMjsSource(NOT_A_PACK), 'chair.mjs');
    expect(message).not.toMatch(/createAsset|trusted|Static scan|Warning:/);
  });
});

describe('importModuleFile awaits the confirmation', () => {
  const file = () => new File([PACK_SOURCE], 'chair.mjs', { type: 'text/javascript' });
  const urls = { three: 'http://127.0.0.1/three.js', addonsBase: 'http://127.0.0.1/jsm/' };
  let nativeConfirmCalls: string[];
  let blobUrlsCreated: number;
  const realCreateObjectURL = URL.createObjectURL;

  beforeEach(() => {
    nativeConfirmCalls = [];
    blobUrlsCreated = 0;
    URL.createObjectURL = (blob: Blob) => {
      blobUrlsCreated += 1;
      return realCreateObjectURL(blob);
    };
    // importModuleFile only asks when a window exists; give it a minimal one.
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: {
        confirm: (message: string) => {
          nativeConfirmCalls.push(message);
          return false;
        },
      },
    });
  });
  afterEach(() => {
    Reflect.deleteProperty(globalThis, 'window');
    URL.createObjectURL = realCreateObjectURL;
  });

  it('an async confirmFn that resolves false cancels the load (a Promise is not treated as a yes)', async () => {
    const seen: string[] = [];
    await expect(
      importModuleFile(file(), urls, {
        enabled: true,
        confirmFn: async (message) => {
          seen.push(message);
          return false;
        },
      }),
    ).rejects.toThrow('MJS load cancelled by user');
    expect(seen).toEqual([`${TITLE}\n\n${BASE}`]);
    expect(nativeConfirmCalls).toEqual([]);
    expect(blobUrlsCreated).toBe(0);
  });

  it('a synchronous confirmFn still works: false cancels', async () => {
    await expect(importModuleFile(file(), urls, { enabled: true, confirmFn: () => false })).rejects.toThrow(
      'MJS load cancelled by user',
    );
  });

  it('an async confirmFn that resolves true goes on to load the module', async () => {
    // The module blob is created only after the confirmation passes. Importing a blob: URL does not
    // work under vitest, so this test stops at "the load was attempted"; the full load is checked in a browser.
    const attempt = importModuleFile(file(), urls, { enabled: true, confirmFn: async () => true });
    const outcome = await attempt.then(
      () => 'loaded',
      (err: unknown) => String((err as Error)?.message ?? err),
    );
    expect(outcome).not.toMatch(/cancelled/);
    expect(blobUrlsCreated).toBe(1);
  });

  it('without a confirmFn it falls back to window.confirm and ends with the OK / Cancel hint', async () => {
    await expect(importModuleFile(file(), urls, { enabled: true })).rejects.toThrow('MJS load cancelled by user');
    expect(nativeConfirmCalls).toEqual([`${TITLE}\n\n${BASE}\n\n${MJS_NATIVE_CONFIRM_HINT}`]);
    expect(MJS_NATIVE_CONFIRM_HINT).toBe('Choose OK to load, or Cancel to stop.');
  });

  it('a rejected confirmFn does not load the module', async () => {
    await expect(
      importModuleFile(file(), urls, {
        enabled: true,
        confirmFn: () => Promise.reject(new Error('dialog failed')),
      }),
    ).rejects.toThrow('dialog failed');
    expect(blobUrlsCreated).toBe(0);
  });
});
