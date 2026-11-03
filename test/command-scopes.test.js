import test from 'node:test';
import assert from 'node:assert/strict';
import {createApp} from '../src/server.js';
import {TOKEN} from '../support/signing.js';
import {GROUP_COMMANDS,PRIVATE_COMMANDS} from '../src/bot-commands.js';

test('command scopes preserve the requested order',()=>{
 assert.deepEqual(GROUP_COMMANDS.map(c=>c.command),['game','appgame','extended','start','stop','next','top','all','share','help']);
 assert.deepEqual(PRIVATE_COMMANDS.map(c=>c.command),['profile','start','leave','language','issue']);
});
test('registration controls, next subscriptions, group ranking and mentions work in Telegram',async t=>{
 const sent=[];
 const bot={username:'test_bot',link:id=>'https://t.me/test_bot?startapp='+id,
  member:async(g,id,admin)=>{if(admin&&id!=='1')throw Error('admin only');},
  send:async(chat,text,room,button,options={})=>{sent.push({chat_id:chat,text,...options});return {};},
  call:async(method,data)=>{if(method==='sendMessage')sent.push(data);return {};}};
 const app=createApp({botToken:TOKEN,telegram:bot,webhookSecret:'secret',developerUsername:'test_developer'});
 await new Promise(r=>app.http.listen(0,'127.0.0.1',r));t.after(()=>app.close());
 const url=`http://127.0.0.1:${app.http.address().port}/telegram/webhook`;let seq=0;
 const post=async(text,id=1,group=-1001)=>{
  const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json','X-Telegram-Bot-Api-Secret-Token':'secret'},body:JSON.stringify({update_id:++seq,message:{from:{id,first_name:'A<&'},chat:{id:group,type:group<0?'supergroup':'private',title:'Group'},text}})});return r.status;
 };
 assert.equal(await post('/next',2),200);
 await post('/game');const g=[...app.rooms.values()][0];assert(sent.some(m=>String(m.chat_id)==='2'&&m.text.includes('yangi o‘yin')));
 assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM next_game_subscriptions').get().n,0);
 const deadline=g.deadline;await post('/extended');assert.equal(g.deadline,deadline+30000);
 await post('/extended',2);assert.equal(g.deadline,deadline+30000);
 await post('/all');assert(sent.some(m=>m.parse_mode==='HTML'&&m.text.includes('A&lt;&amp;')));
 const count=sent.filter(m=>m.parse_mode==='HTML').length;await post('/all');assert.equal(sent.filter(m=>m.parse_mode==='HTML').length,count);
 app.store.db.prepare('INSERT INTO results VALUES(?,?,?,?,?,?,?)').run('r',Date.now(),'-1001','Group','roster',1,10);
 app.store.db.prepare('INSERT INTO results VALUES(?,?,?,?,?,?,?)').run('other',Date.now(),'-1002','Other','roster',1,10);
 app.store.db.prepare('INSERT INTO scores VALUES(?,?,?,?,?)').run('r','2','Local',10,1);
 app.store.db.prepare('INSERT INTO scores VALUES(?,?,?,?,?)').run('other','3','Foreign',100,1);
 await post('/top');assert(sent.at(-1).text.includes('Local'));assert(!sent.at(-1).text.includes('Foreign'));
 await post('/stop',2);assert(app.rooms.has(g.id));await post('/stop');assert(!app.rooms.has(g.id));
 await post('/profile',1,1);assert(sent.at(-1).text.includes('Profil'));
 await post('/language',1,1);assert(sent.at(-1).text.includes('O‘zbekcha'));
 await post('/issue',1,1);assert(sent.at(-1).text.includes('@test_developer'));
});
