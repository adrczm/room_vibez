// A toast does not follow the user into the other workspace, and does not outlive a cleared room.
import { launch, fresh, toRoom, createRoom, toClient, stageState } from './lib.mjs';
const browser = await launch();
const { ctx, page, errors } = await fresh(browser);
const out = {};
await toRoom(page); await createRoom(page);
await page.click('#btn-place-mode');
const p = await toClient(page, 0.8, 0, -0.5); await page.mouse.click(p.x, p.y);
await page.waitForFunction(() => /^Placed/.test(document.querySelector('#stage-toast .stage-toast-text').textContent), null, { timeout: 20000 });
out.afterPlace = (await stageState(page)).toastOpen;
await page.click('#workspace-mode button[data-mode=catalog]'); await page.waitForTimeout(300);
out.afterSwitchToProduct = { open: (await stageState(page)).toastOpen, text: (await stageState(page)).toast };
await toRoom(page); await page.click('#btn-place-mode');
await page.mouse.click(p.x, p.y);
await page.waitForFunction(() => window.__rv.roomGraph().placements.length === 2, null, { timeout: 20000 }); await page.waitForTimeout(600);
out.beforeClear = (await stageState(page)).toastOpen;
await page.keyboard.press('Escape');
await page.click('#btn-clear-room'); await page.click('dialog.confirm-dialog [data-action="confirm"]'); await page.waitForTimeout(400);
out.afterClear = { open: (await stageState(page)).toastOpen, card: (await stageState(page)).empty };
// project import from the Product workspace: the toast comes after the switch and stays
out.errors = errors;
console.log(JSON.stringify(out));
await browser.close();
