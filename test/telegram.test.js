import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/server.js';
import { Telegram } from '../src/telegram.js';
test('webhook secret, admin checks, group room binding and duplicate update protection', async t => {
  const messages=[];const bot={username:'test_bot',member:async(g,u,admin)=>{assert.equal(g,'-1001');assert.equal(u,'1');assert.equal(admin,true);},send:async(...args)=>messages.push(args)};
  const app=createApp({botToken:'test',webhookSecret:'test-secret',telegram:bot});
  await new Promise(r=>app.http.listen(0,'127.0.0.1',r));t.after(()=>app.close());
  const url=`http://127.0.0.1:${app.http.address().port}/telegram/webhook`;
  const data={update_id:1,message:{from:{id:1,first_name:'Owner'},chat:{id:-1001,type:'supergroup',title:'Guruh'},text:'/mafia'}};
  const post=secret=>fetch(url,{method:'POST',headers:{'Content-Type':'application/json','X-Telegram-Bot-Api-Secret-Token':secret},body:JSON.stringify(data)});
  assert.equal((await post('wrong')).status,403);assert.equal(app.rooms.size,0);
  assert.equal((await post('test-secret')).status,200);assert.equal(app.rooms.size,1);
  assert.equal((await post('test-secret')).status,200);assert.equal(messages.length,1);
  assert.equal([...app.rooms.values()][0].group.id,'-1001');
});
test('group membership rejects nonmembers; links use startapp URL button', async () => {
  const bot=new Telegram('fake','test_bot',async()=>({ok:true,json:async()=>({ok:true,result:{status:'left'}})}));
  await assert.rejects(()=>bot.member('-1001','1'));assert.equal(bot.link('room-123'),'https://t.me/test_bot?startapp=room-123');
});
