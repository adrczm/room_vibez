// Why does toBeInViewport report ratio 0 for the hidden native select? Try the candidate CSS causes one at a time.
import { launch, fresh } from './lib.mjs';
const browser = await launch();
const { ctx, page } = await fresh(browser, { settle: 300 });
const ratio = () => page.evaluate(() => new Promise((resolve) => {
  const el = document.querySelector('#product-select');
  const io = new IntersectionObserver((entries) => { io.disconnect(); resolve({ ratio: entries[0].intersectionRatio, rect: [entries[0].boundingClientRect.width, entries[0].boundingClientRect.height], inter: [entries[0].intersectionRect.width, entries[0].intersectionRect.height] }); });
  io.observe(el);
}));
const out = { asShipped: await ratio() };
for (const [name, css] of [['noClipPath', 'clip-path: none !important'], ['noOverflow', 'overflow: visible !important'], ['noOpacity', 'opacity: 1 !important'], ['wider', 'width: 4px !important']]) {
  await page.addStyleTag({ content: `#product-select.tpicker-native { ${css}; }` }).then(async (tag) => { out[name] = await ratio(); await tag.evaluate((n) => n.remove()); });
}
out.afterRemovingAll = await ratio();
console.log(JSON.stringify(out, null, 1));
await ctx.close();
await browser.close();
