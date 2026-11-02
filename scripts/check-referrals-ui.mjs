import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';
import {createApp} from '../src/server.js';
import {TOKEN,signed} from '../support/signing.js';

const app=createApp({botToken:TOKEN,botUsername:'test_bot'});
app.store.registerUser('1');app.store.registerUser('2','1');
await new Promise(r=>app.http.listen(0,'127.0.0.1',r));
const origin=`http://127.0.0.1:${app.http.address().port}`;
const browser=await chromium.launch({channel:'msedge',headless:true});
try {
 for(const width of [390,1280]) {
  const context=await browser.newContext({viewport:{width,height:844},permissions:['clipboard-read','clipboard-write']});
  const page=await context.newPage();page.setDefaultTimeout(15000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/telegram-web-app.js',r=>r.fulfill({contentType:'text/javascript',body:`window.Telegram={WebApp:{initData:${JSON.stringify(signed(1))},initDataUnsafe:{start_param:'ref_1'},platform:'ios',colorScheme:'dark',ready(){},expand(){},onEvent(){},setHeaderColor(){},setBackgroundColor(){}}};`}));
  await page.goto(origin+'/#profile');
  await page.locator('[data-action="referrals"]').click();
  await page.getByRole('heading',{name:'Referal mukofotlari'}).waitFor();
  assert.equal(await page.getByLabel('Referal havolasi').inputValue(),'https://t.me/test_bot?start=ref_1');
  assert.match(await page.locator('#dialog-content').innerText(),/ikkalangizga 10 tangadan/);
  await page.locator('[data-action="copy-referral"]').click();
  assert.equal(await page.evaluate(()=>navigator.clipboard.readText()),'https://t.me/test_bot?start=ref_1');
  assert.equal(await page.evaluate(()=>document.documentElement.classList.contains('modal-open')),true);
  assert.deepEqual(errors,[]);console.log(`PASS referral panel and copy ${width}px`);
  await context.close();
 }
} finally {await browser.close();await app.close();}
