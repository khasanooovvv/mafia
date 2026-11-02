import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
const browser=await chromium.launch({channel:'msedge',headless:true});
const errors=[];
// Bound failures so a missing control cannot stall deployment checks.

try {
for (const width of [360,390,768,1280]) {
 const page=await browser.newPage({viewport:{width,height:900},colorScheme:'light'});
 page.setDefaultTimeout(12000);
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:3000'); await page.waitForSelector('.hero');
 for(const theme of ['light','dark']) {
  await page.emulateMedia({colorScheme:theme});
  await page.waitForFunction(t=>document.documentElement.dataset.theme===t,theme);
  for(const route of ['home','rank','profile','game']) {
   await page.evaluate(route=>location.hash=route,route);
   await page.waitForTimeout(60);
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`overflow ${width} ${theme} ${route}`);
  }
 }
 await page.evaluate(()=>location.hash='home');
 await page.locator('[data-action="catalog"]').click();
 assert.equal(await page.locator('.catalog-card').count(),19);
 await page.locator('[data-catalog-card="santa"]').click();
 await page.locator('.catalog-detail h2').waitFor();
 assert.match(await page.locator('.catalog-detail').innerText(),/Qorbobo/);
 await page.locator('#close-dialog').click();
 await page.locator('[data-action="create"]').click();
 await page.locator('[data-action="start"]').click();
 await page.locator('[data-action="flip-card"]').click();
 assert.match(await page.locator('.match-role').innerText(),/Komissar/);
 await page.locator('button[data-target]:not([disabled])').first().click();
 await page.locator('[data-mode="check"]').click();
 assert.match(await page.locator('.table-hint').innerText(),/qabul qilindi/);
 await page.locator('[data-action="demo-next"]').click();
 await page.locator('[data-chat-table]').click();
 assert.match(await page.locator('.table-phase').innerText(),/1-kun/);
 await page.locator('[data-action="demo-next"]').click();
 await page.locator('button[data-target]:not([disabled])').first().click();
 await page.locator('[data-action="submit"]').click();
 await page.locator('[data-action="demo-next"]').click();
 await page.locator('[data-confirm="true"]').click();
 assert.match(await page.locator('.table-hint').innerText(),/qabul qilindi/);
 await page.close(); console.log(`PASS ${width}px: themes, routes, catalog, game actions`);
}
// Telegram appearance must override a conflicting OS setting and update live.
const page=await browser.newPage({viewport:{width:390,height:844},colorScheme:'dark'});
await page.route('**/telegram-web-app.js',route=>route.fulfill({contentType:'text/javascript',body:`window.themeHandlers={};window.Telegram={WebApp:{platform:'ios',colorScheme:'light',ready(){},expand(){},onEvent(n,fn){window.themeHandlers[n]=fn},setHeaderColor(){},setBackgroundColor(){},safeAreaInset:{bottom:12},contentSafeAreaInset:{bottom:4}}};`}));
await page.goto('http://127.0.0.1:3000'); await page.waitForSelector('.hero');
assert.equal(await page.locator('html').getAttribute('data-theme'),'light');
await page.locator('#room-code').fill('saved-room');
await page.evaluate(()=>{Telegram.WebApp.colorScheme='dark';themeHandlers.themeChanged()});
assert.equal(await page.locator('html').getAttribute('data-theme'),'dark');
assert.equal(await page.locator('#room-code').inputValue(),'saved-room');
assert.equal(await page.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--app-safe-bottom')),'16px');
await page.close();
assert.deepEqual(errors,[]); console.log('PASS Telegram live theme, safe area, preserved form; no browser errors');
} finally { await browser.close(); }
