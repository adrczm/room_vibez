// Does the picker's CSS survive a production build? Builds the HARNESS page into scratch (nothing is written
// to the workspace's dist) and looks for the rules a minifier could drop or mangle.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { build } from '/private/tmp/claude-501/-Users-adrian-Desktop-Room-Vibez/7ac663fe-e0d6-4b3c-af69-487be083d847/scratchpad/ws-picker/node_modules/vite/dist/node/index.js';

const WS = '/private/tmp/claude-501/-Users-adrian-Desktop-Room-Vibez/7ac663fe-e0d6-4b3c-af69-487be083d847/scratchpad/ws-picker';
const OUT = new URL('./build-check/', import.meta.url).pathname;

await build({
  root: WS,
  logLevel: 'warn',
  build: { outDir: OUT, emptyOutDir: true, rollupOptions: { input: join(WS, 'picker-harness.html') } },
});
const assets = readdirSync(join(OUT, 'assets'));
const css = assets.filter((f) => f.endsWith('.css')).map((f) => readFileSync(join(OUT, 'assets', f), 'utf8')).join('\n');
const js = assets.filter((f) => f.endsWith('.js')).map((f) => readFileSync(join(OUT, 'assets', f), 'utf8')).join('\n');
const has = (re) => re.test(css);
const report = {
  assets,
  cssBytes: css.length,
  '@starting-style kept': has(/@starting-style/),
  ':popover-open kept': has(/:popover-open/),
  '::backdrop kept': has(/::backdrop/),
  'prefers-reduced-motion kept': has(/prefers-reduced-motion:\s*no-preference/),
  'pointer: coarse kept': has(/pointer:\s*coarse/),
  'sheet query kept': has(/max-width:\s*860px|width\s*<=\s*860px/),
  'dvh max-height kept': has(/80dvh/),
  'clip-path on the hidden select kept': has(/select\.tpicker-native[^}]*clip-path/),
  'hatched placeholder kept': has(/repeating-linear-gradient/),
  'picker JS bundled': /tpicker-trigger/.test(js) && /catalog3d\.pickerView\./.test(js),
};
console.log(JSON.stringify(report, null, 2));
const bad = Object.entries(report).filter(([, v]) => v === false).map(([k]) => k);
console.log(bad.length ? 'MISSING: ' + bad.join(', ') : 'build check passed');
process.exit(bad.length ? 1 : 0);
