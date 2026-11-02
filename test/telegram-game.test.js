import test from 'node:test';
import assert from 'node:assert/strict';
import { io } from 'socket.io-client';
import { createApp } from '../src/server.js';
import { Game, GameError } from '../src/game.js';
import { TelegramGame, gameButton, groupKeyboard } from '../src/telegram-game.js';
import { TOKEN,signed } from '../support/signing.js';

test('Telegram webhook and Mini App share joins, secret actions, voting, results and rewards',async t=>{
 let clock=Date.now(),updateId=0;const sent=[],answers=[];
 const bot={username:'test_bot',link:id=>`https://t.me/test_bot?startapp=${id||''}`,
  member:async(group,id,admin)=>{if(id==='99'||(admin&&id!=='1'))throw new GameError('Ruxsat yo‘q');},
  call:async(method,body)=>{if(method==='sendMessage')sent.push(body);if(method==='answerCallbackQuery')answers.push(body);return {message_id:sent.length};},
  send:async(chat,text,room,button,options={})=>{sent.push({chat_id:chat,text,...options});return {message_id:sent.length};}};
 const app=createApp({botToken:TOKEN,webhookSecret:'secret',telegram:bot,gameOptions:{now:()=>clock,pick:n=>n-1}});
 await new Promise(r=>app.http.listen(0,'127.0.0.1',r));const url=`http://127.0.0.1:${app.http.address().port}`;
 let socket;t.after(async()=>{socket?.disconnect();await app.close();});
 async function post(payload){const r=await fetch(url+'/telegram/webhook',{method:'POST',headers:{'Content-Type':'application/json','X-Telegram-Bot-Api-Secret-Token':'secret'},body:JSON.stringify({update_id:++updateId,...payload})});assert.equal(r.status,200);}
 const message=(id,text,group=false)=>({message:{from:{id,first_name:'P'+id},chat:group?{id:-1001,type:'supergroup',title:'Test group'}:{id,type:'private'},text}});
 await post(message(1,'/game',true));const g=[...app.rooms.values()][0];assert(g);
 assert(sent[0].reply_markup.inline_keyboard.flat().some(b=>b.url?.includes('start=join_')));
 for(let id=1;id<=6;id++)await post(message(id,`/start join_${g.id}`));
 assert.equal(g.players.length,6);
 await post(message(99,`/start join_${g.id}`));assert.equal(g.players.length,6);
 socket=io(url,{auth:{initData:signed(4)},forceNew:true});await new Promise((r,j)=>{socket.once('connect',r);socket.once('connect_error',j);});
 const ask=(event,p={})=>socket.timeout(3000).emitWithAck(event,p);
 assert.equal((await ask('room:join',{roomId:g.id})).ok,true);
 async function click(id,action,arg='',group=false,data){await post({callback_query:{id:'q'+updateId,from:{id},message:{chat:group?{id:-1001,type:'supergroup'}:{id,type:'private'}},data:data||gameButton(g,'Test',action,arg).callback_data}});}
 await click(2,'start','',true);assert.equal(g.phase,'lobby');
 const old=gameButton(g,'Old','start').callback_data;
 await click(1,'start','',true);assert.equal(g.phase,'night');
 await post(message(4,'/start'));
 assert(sent.some(m=>String(m.chat_id)==='4'&&m.text.includes('Sizning rolingiz: Komissar')));
 assert(!sent.some(m=>String(m.chat_id)==='-1001'&&m.text.includes('Sizning rolingiz')));
 await click(1,'start','',true,old);assert.match(answers.at(-1).text,/eskirgan/);
 await click(1,'night','4',true);assert.equal(g.actions.has('1'),false);
 await click(1,'night','4');await click(2,'night','4');await click(3,'night','5');
 let state=(await ask('game:sync')).state;
 assert.equal((await ask('game:night-action',{targetId:'1',mode:'check',revision:state.revision})).ok,true);
 assert.equal(g.actions.get('4').targetIds[0],'1');
 const accepted=gameButton(g,'Again','night','5').callback_data;
 await click(1,'night','5');assert.equal(g.actions.get('1').targetIds[0],'5');
 clock=g.deadline;await ask('game:sync');assert.equal(g.phase,'discussion');
 assert.equal(g.member('5').alive,false);
 await post(message(4,'/start'));assert(sent.filter(m=>String(m.chat_id)==='4').at(-1).text.includes('P1: Don'));
 clock=g.deadline;await ask('game:sync');assert.equal(g.phase,'voting');
 await click(1,'night','5',false,accepted);assert.match(answers.at(-1).text,/eskirgan/);
 state=(await ask('game:sync')).state;
 assert.equal((await ask('game:vote',{targetId:'1',revision:state.revision})).ok,true);
 for(const id of [2,3,6])await click(id,'vote','0',true);
 await click(5,'vote','0',true);assert.equal(g.votes.has('5'),false);
 clock=g.deadline;await ask('game:sync');assert.equal(g.phase,'confirmation');
 for(const id of [2,3,4,6])await click(id,'yes','',true);
 clock=g.deadline;await ask('game:sync');assert.equal(g.member('1').alive,false);
 // Finish the same shared room; record result once and verify a dead active winner gets five coins.
 g.startedAt=clock-180001;g.winner='citizens';g.setPhase('finished');app.store.save(g);app.store.save(g);
 assert.equal(app.store.inventory('4').coins,10);
 assert.equal(app.store.rankings('all').groups[0].games,1);
 assert.equal(app.store.profile('4').games,1);
});

test('private controls cover journalist pairs, commissioner modes, kamikaze and stale or foreign chats',async()=>{
 let now=Date.now();const g=new Game({id:'1',name:'P1'},{now:()=>now,pick:n=>n-1,group:{id:'-1001',name:'Group'}});
 for(let i=2;i<=6;i++)g.join({id:String(i),name:'P'+i});g.start('1');
 const sent=[],answers=[];const bot={username:'test_bot',link:()=> 'https://t.me/test_bot?startapp',member:async()=>{},call:async(method,b)=>{(method==='answerCallbackQuery'?answers:sent).push(b);}};
 const bridge=new TelegramGame(bot,{rooms:new Map([[g.id,g]]),save:()=>{},publish:()=>{},advance:async()=>{},active:()=>g});
 const click=(id,action,arg='',chat=id)=>bridge.callback({id:'q',from:{id:Number(id)},message:{chat:{id:Number(chat),type:chat===id?'private':'supergroup'}},data:gameButton(g,'Action',action,arg).callback_data});
 g.member('1').role='journalist';await click('1','j1','1');assert(sent.at(-1).text.includes('Ikkinchi'));
 await click('1','j2','1_2');assert.deepEqual(g.actions.get('1').targetIds,['2','3']);
 g.actions.clear();g.member('1').role='commissioner';await click('1','mode','kill');assert(sent.at(-1).reply_markup.inline_keyboard.flat().every(b=>b.callback_data.includes('|kill|')));
 await click('1','kill','1');assert.equal(g.actions.get('1').mode,'kill');
 g.member('6').role='kamikaze';g.member('6').alive=false;g.pendingKamikazeChooser='6';await click('6','revenge','1');assert.equal(g.pendingKamikaze,'2');
 const count=sent.length;await click('1','refresh','','-1002');assert.equal(sent.length,count);assert.match(answers.at(-1).text,/boshqa chat/);
 const keyboard=groupKeyboard(bot,g);assert(!JSON.stringify(keyboard).includes('commissioner'));
 for(const b of sent.flatMap(m=>m.reply_markup?.inline_keyboard.flat()||[]))if(b.callback_data)assert(Buffer.byteLength(b.callback_data)<=64);
});

test('a complete Telegram-only game records the same qualified result without opening Mini App',async t=>{
 let clock=Date.now(),seq=0;const messages=[];
 const bot={username:'test_bot',link:()=> 'https://t.me/test_bot?startapp',member:async(g,id,admin)=>{if(admin&&id!=='1')throw new GameError('Admin kerak');},call:async(method,b)=>{messages.push({method,...b});return {message_id:messages.length};},send:async()=>({message_id:1})};
 const app=createApp({botToken:TOKEN,telegram:bot,webhookSecret:'secret',gameOptions:{now:()=>clock,pick:n=>n-1}});
 await new Promise(r=>app.http.listen(0,'127.0.0.1',r));t.after(()=>app.close());
 const url=`http://127.0.0.1:${app.http.address().port}/telegram/webhook`;
 const post=async data=>{const res=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json','X-Telegram-Bot-Api-Secret-Token':'secret'},body:JSON.stringify({update_id:++seq,...data})});assert.equal(res.status,200);};
 const message=(id,text,group=false)=>post({message:{from:{id,first_name:'P'+id},chat:group?{id:-1001,type:'supergroup',title:'Native group'}:{id,type:'private'},text}});
 await message(1,'/mafia',true);const g=[...app.rooms.values()][0];
 for(let id=1;id<=6;id++)await message(id,`/start join_${g.id}`);
 await message(1,'/start',true);
 const click=(id,action,arg='')=>post({callback_query:{id:'q'+seq,from:{id:Number(id)},message:{chat:{id:Number(id),type:'private'}},data:gameButton(g,'Choose',action,arg).callback_data}});
 const next=async()=>{clock=g.deadline;await message(3,'/start');};
 for(const mafia of ['1','2']){
  assert.equal(g.phase,'night');
  const killers=g.players.filter(p=>p.alive&&p.role==='mafia');
  for(const p of killers)await click(p.id,'night','4');
  await click('3','night','4'); // doctor protects the mafia target
  await click('4','check',String(g.players.findIndex(p=>p.id===mafia)));
  await next();assert.equal(g.phase,'discussion');await next();assert.equal(g.phase,'voting');
  const alive=g.players.filter(p=>p.alive);
  for(const p of alive.filter(p=>p.id!==mafia))await click(p.id,'vote',String(g.players.findIndex(p=>p.id===mafia)));
  await next();assert.equal(g.phase,'confirmation');
  for(const p of alive)await click(p.id,'yes');await next();
 }
 assert.equal(g.phase,'finished');assert.equal(g.winner,'citizens');
 assert.equal(app.store.rankings('all').groups[0].points,16);
 assert.equal(app.store.inventory('3').coins,10);
 assert.equal(app.store.profile('3').games,1);
 const before=app.store.inventory('3').coins;app.store.save(g);assert.equal(app.store.inventory('3').coins,before);
});
