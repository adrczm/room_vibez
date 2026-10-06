import { launch, fresh, OUT } from './lib.mjs';
const browser = await launch();
const { ctx, page } = await fresh(browser, { viewport: { width: 1440, height: 900 } });
await page.click('#product-advanced > summary');
await page.evaluate(() => { const p = document.querySelector('.panel'); const a = document.getElementById('product-advanced'); p.scrollTop += a.getBoundingClientRect().top - p.getBoundingClientRect().top - 12; });
await page.waitForTimeout(300);
await page.screenshot({ path: `${OUT}/shots/1440x900-4-advanced-open.png` });
await ctx.close();
await browser.close();
