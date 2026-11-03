import test from 'node:test';
import assert from 'node:assert/strict';
import {createApp} from '../src/server.js';
import {TOKEN,signed} from '../support/signing.js';
import {io} from 'socket.io-client';

test('start menu links and automatic group discovery enforce admin ownership',async t=>{
 let admin=true;const sent=[];
 const bot={username:'test_bot',link:id=>`https://t.me/test_bot?startapp=${id||''}`,
  send:async(chat,text,room,button,options={})=>{sent.push({chat_id:chat,text,...options});return {};},member:async(g,id)=>{if(id==='2'||(id==='1'&&!admin))throw Error('not admin');},
  call:async(method,body)=>{
   if(method==='sendMessage'){sent.push(body);return {};}
   if(method==='getMe')return {id:99};
   if(method==='getChat')return {id:-1001,type:'supergroup',title:'My group'};
   if(method==='getChatAdministrators')return [{user:{id:1}},{user:{id:2}},{user:{id:99,is_bot:true}}];
   return {};
  }};
 const app=createApp({botToken:TOKEN,telegram:bot,webhookSecret:'secret'});
 await new Promise(r=>app.http.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${app.http.address().port}`;let seq=0;const sockets=[];
 t.after(async()=>{sockets.forEach(s=>s.disconnect());await app.close();});
 const post=async data=>{const r=await fetch(base+'/telegram/webhook',{method:'POST',headers:{'Content-Type':'application/json','X-Telegram-Bot-Api-Secret-Token':'secret'},body:JSON.stringify({update_id:++seq,...data})});assert.equal(r.status,200);};
 await post({message:{from:{id:1},chat:{id:1,type:'private'},text:'/start'}});
 assert(sent.at(-1).text.startsWith('MafiaUz'));
 const bold=sent.at(-1).entities[0];assert.equal(sent.at(-1).text.slice(bold.offset,bold.offset+bold.length),'MafiaUz');
 const buttons=sent.at(-1).reply_markup.inline_keyboard.flat();
 assert(buttons.some(b=>b.url?.includes('startgroup=mafia')));
 for(const section of ['groups','profile','game','shop','roles','referrals'])assert(buttons.some(b=>b.callback_data==='nav|'+section));
 const click=async(data,id=1)=>post({callback_query:{id:'q'+seq,from:{id},message:{chat:{id:1,type:'private'}},data}});
 for(const section of ['profile','shop','roles','referrals','game','groups']){
  await click('nav|'+section);assert(sent.at(-1).text.length>10);
  assert(!sent.at(-1).reply_markup.inline_keyboard.flat().some(b=>b.url?.includes('startapp')));
 }
 await click('nav|groups');const links=sent.at(-1).reply_markup.inline_keyboard.flat().filter(b=>b.url);assert.deepEqual(links.map(b=>b.url),['https://t.me/MafiaUzAppGr']);
 app.store.inventory('1');app.store.db.prepare('UPDATE inventories SET coins=200 WHERE user_id=?').run('1');
 await click('nav|buy|protection');const pay=sent.at(-1).reply_markup.inline_keyboard[0][0].callback_data;
 await click(pay,2);assert.equal(app.store.inventory('1').coins,200);
 await click(pay);assert.equal(app.store.inventory('1').coins,100);assert.equal(app.store.inventory('1').protection,1);
 await click(pay);assert.equal(app.store.inventory('1').coins,100);
 await post({my_chat_member:{chat:{id:-1001,type:'supergroup'},from:{id:2},new_chat_member:{status:'administrator'}}});
 assert.equal(app.store.managedGroups('1').length,1);assert.equal(app.store.managedGroups('2').length,0);
 const socket=io(base,{auth:{initData:signed(1)},reconnection:false});sockets.push(socket);await new Promise(r=>socket.once('connect',r));
 const list=()=>socket.timeout(2000).emitWithAck('groups:list',{});
 assert.equal((await list()).groups[0].name,'My group');
 admin=false;assert.deepEqual((await list()).groups,[]);
 admin=true;
 const command=text=>post({message:{from:{id:1,first_name:'Owner'},chat:{id:-1001,type:'supergroup',title:'My group'},text}});
 await command('/game@test_bot');let g=[...app.rooms.values()][0];assert.equal(g.entryMode,'telegram');
 let keyboard=sent.at(-1).reply_markup.inline_keyboard.flat();assert(keyboard.some(b=>b.url?.includes('start=join_')));assert(!keyboard.some(b=>b.url?.includes('startapp')));
 await command('/AppGame');assert.equal(app.rooms.size,1);assert.equal(g.entryMode,'telegram');
 g.phase='finished';
 await command('/AppGame@test_bot');g=[...app.rooms.values()].find(g=>g.phase==='lobby');assert.equal(g.entryMode,'miniapp');
 keyboard=sent.at(-1).reply_markup.inline_keyboard.flat();assert.equal(keyboard.length,1);assert(keyboard[0].url.includes('startapp='));
 const restored=(await import('../src/game.js')).Game.restore(g.snapshot());assert.equal(restored.entryMode,'miniapp');

});
