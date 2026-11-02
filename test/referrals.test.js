import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {Store} from '../src/store.js';
import {Game} from '../src/game.js';
import {createHmac} from 'node:crypto';
import {io} from 'socket.io-client';
import {createApp} from '../src/server.js';
import {TOKEN,signed} from '../support/signing.js';

function result(offset=10){
 let now=Date.now()-300000;
 const g=new Game({id:'2',name:'Invited'},{now:()=>now});
 for(let i=0;i<5;i++)g.join({id:String(offset+i),name:'P'+i});
 g.start('2');g.players.forEach(p=>{p.role='citizen';p.office=null;});g.players[1].role='mafia';
 now+=300000;g.activity=new Set(g.players.map(p=>p.id));g.winner='citizens';g.setPhase('finished');return g;
}
test('only a new user can bind to an existing different inviter, once',()=>{
 const s=new Store();try{
  s.registerUser('1');assert.equal(s.registerUser('2','1'),true);
  for(const [id,parent] of [['2','3'],['3','3'],['4','999'],['1','2']])assert.equal(s.registerUser(id,parent),false);
  s.registerUser('5');assert.equal(s.registerUser('5','1'),false);
  assert.deepEqual(s.referralStats('1'),{invited:1,qualified:0,earned:0,bonus:0,rewardEach:10});
 }finally{s.close();}
});
test('both earn ten coins once, without inflating ranking points',()=>{
 const s=new Store();try{
  s.registerUser('1');s.registerUser('2','1');const g=result();s.save(g);s.save(g);
  assert.equal(s.inventory('1').coins,10);assert.equal(s.inventory('2').coins,20);
  assert.equal(s.profile('2').points,10);assert.equal(s.referralStats('1').earned,10);assert.equal(s.referralStats('2').bonus,10);
  s.save(result(20));assert.equal(s.inventory('1').coins,10);assert.equal(s.inventory('2').coins,30);
 }finally{s.close();}
});
test('short and inactive games do not unlock rewards, a later qualifying game does',()=>{
 for(const reason of ['short','inactive']){
  const s=new Store();try{
   s.registerUser('1');s.registerUser('2','1');const g=result();
   if(reason==='short')g.startedAt=g.finishedAt-179999;else g.activity.delete('2');
   s.save(g);assert.equal(s.referralStats('1').qualified,0);
   s.save(result(20));assert.equal(s.referralStats('1').qualified,1);
  }finally{s.close();}
 }
});
test('game result and referral payments roll back together',()=>{
 const s=new Store();try{
  s.registerUser('1');s.registerUser('2','1');const reward=s.rewardReferral.bind(s);
  s.rewardReferral=(id,game)=>{reward(id,game);throw Error('fixture failure');};
  assert.throws(()=>s.save(result()));assert.equal(s.referralStats('1').qualified,0);
  assert.equal(s.db.prepare('SELECT COUNT(*) n FROM results').get().n,0);assert.equal(s.inventory('1').coins,0);
 }finally{s.close();}
});
test('restart preserves rewards and excludes existing inventory holders',()=>{
 const path=join(mkdtempSync(join(tmpdir(),'mafia-ref-')),'test.sqlite');let s=new Store(path);
 try{
  s.inventory('7');s.registerUser('1');s.registerUser('2','1');s.save(result());s.close();s=new Store(path);
  assert.equal(s.registerUser('7','1'),false);assert.equal(s.referralStats('1').qualified,1);
  s.save(result(20));assert.equal(s.inventory('1').coins,10);
 }finally{s.close();}
});
function withReferral(id,inviter){
 const p=new URLSearchParams(signed(id));p.delete('hash');p.set('start_param','ref_'+inviter);
 const key=createHmac('sha256','WebAppData').update(TOKEN).digest();
 const value=[...p].sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>`${k}=${v}`).join('\n');
 p.set('hash',createHmac('sha256',key).update(value).digest('hex'));return p.toString();
}
test('webhook and signed launch links share referrals; unsigned claims fail',async t=>{
 const sent=[];
 const bot={username:'test_bot',call:async()=>({}),send:async(...args)=>{sent.push(args);return {};},link:()=> 'https://t.me/test_bot?startapp'};
 const app=createApp({botToken:TOKEN,telegram:bot,webhookSecret:'secret'});
 await new Promise(r=>app.http.listen(0,'127.0.0.1',r));
 const url=`http://127.0.0.1:${app.http.address().port}`,peers=[];
 t.after(async()=>{peers.forEach(s=>s.disconnect());await app.close();});app.store.registerUser('1');
 const response=await fetch(url+'/telegram/webhook',{method:'POST',headers:{'Content-Type':'application/json','X-Telegram-Bot-Api-Secret-Token':'secret'},body:JSON.stringify({update_id:1,message:{from:{id:2,first_name:'P2'},chat:{id:2,type:'private'},text:'/start ref_1'}})});
 assert.equal(response.status,200);assert.equal(app.store.referralStats('1').invited,1);
 const command=await fetch(url+'/telegram/webhook',{method:'POST',headers:{'Content-Type':'application/json','X-Telegram-Bot-Api-Secret-Token':'secret'},body:JSON.stringify({update_id:2,message:{from:{id:1,first_name:'P1'},chat:{id:1,type:'private'},text:'/referral'}})});
 assert.equal(command.status,200);assert.match(sent.at(-1)[1],/https:\/\/t.me\/test_bot\?start=ref_1/);
 assert.equal(app.store.inventory('1').coins,0);
 async function connect(data){const s=io(url,{auth:{initData:data},forceNew:true,reconnection:false});peers.push(s);await new Promise((r,j)=>{s.once('connect',r);s.once('connect_error',j);});return s;}
 const s=await connect(withReferral(3,1));
 const home=await s.timeout(2000).emitWithAck('home:get',{});assert.equal(home.ok,true);assert.equal(home.referrals.rewardEach,10);
 assert.equal(app.store.referralStats('1').invited,2);
 const bad=new URLSearchParams(signed(4));bad.set('start_param','ref_1');await assert.rejects(()=>connect(bad.toString()));
 assert.equal(app.store.db.prepare('SELECT user_id FROM bot_users WHERE user_id=?').get('4'),undefined);
});
