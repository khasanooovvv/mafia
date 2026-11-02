import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/game.js';
import { createApp } from '../src/server.js';
import { io } from 'socket.io-client';
import { TOKEN,signed } from '../support/signing.js';

function room(){let now=Date.now();const g=new Game({id:'1',name:'Don'},{now:()=>now,pick:n=>n-1});for(let i=2;i<=6;i++)g.join({id:String(i),name:'P'+i});g.start('1');g.players.forEach((p,i)=>{p.role=i<2?'mafia':i===3?'lawyer':'citizen';p.office=i===0?'don':null;});return {g,advance(ms=1001){now+=ms;}};}
test('private mafia chat is phase, life and role gated, including restored views',()=>{
 const {g}=room();g.sendChat('1','Maxfiy nishon');assert.equal(g.view('2').chat.messages[0].text,'Maxfiy nishon');
 for(const id of ['3','4']){assert.deepEqual(g.view(id).chat,{channel:null,messages:[]});assert.throws(()=>g.sendChat(id,'intrusion'));assert(!JSON.stringify(g.view(id)).includes('Maxfiy nishon'));}
 const restored=Game.restore(JSON.parse(JSON.stringify(g.snapshot())));assert(!JSON.stringify(restored.view('3')).includes('Maxfiy nishon'));
 g.players[1].alive=false;assert.equal(g.view('2').chat.channel,null);assert.throws(()=>g.sendChat('2','dead'));
 g.phase='discussion';assert.equal(g.view('3').chat.channel,'discussion');assert(!JSON.stringify(g.view('3')).includes('Maxfiy nishon'));
});
test('discussion permits living players only; later rounds start with a fresh log; messages are bounded',()=>{
 const {g,advance}=room();g.phase='discussion';g.sendChat('3','Salom');assert.equal(g.view('1').chat.messages.length,1);assert.throws(()=>g.sendChat('3','spam'));advance();assert.throws(()=>g.sendChat('3','x'.repeat(501)));assert.throws(()=>g.sendChat('3','   '));
 g.players[2].alive=false;assert.equal(g.view('3').chat.messages.length,0);assert.throws(()=>g.sendChat('3','dead'));g.phase='voting';assert.throws(()=>g.sendChat('1','late'));g.phase='discussion';g.round++;assert.deepEqual(g.view('1').chat.messages,[]);
});
test('authenticated sockets never deliver mafia messages to another role; spoofed channel and author ignored',async t=>{
 const app=createApp({botToken:TOKEN});await new Promise(r=>app.http.listen(0,'127.0.0.1',r));const clients=[];
 t.after(async()=>{clients.forEach(s=>s.disconnect());await app.close();});
 const ask=(s,event,p={})=>s.timeout(3000).emitWithAck(event,p);
 for(let i=1;i<=4;i++){const s=io(`http://127.0.0.1:${app.http.address().port}`,{auth:{initData:signed(i)},forceNew:true});clients.push(s);await new Promise((r,j)=>{s.once('connect',r);s.once('connect_error',j);});}
 const {state}=await ask(clients[0],'room:create');for(const s of clients.slice(1))await ask(s,'room:join',{roomId:state.id});
 const g=app.rooms.get(state.id);g.join({id:'5',name:'P5'});g.join({id:'6',name:'P6'});g.start('1');g.players.forEach((p,i)=>{p.role=i<2?'mafia':i===3?'lawyer':'citizen';p.office=i===0?'don':null;});
 const leaked=[];clients[2].on('game:state',state=>leaked.push(JSON.stringify(state)));
 const response=await ask(clients[0],'game:chat',{text:'private-plan',channel:'discussion',userId:'3'});assert(response.ok);assert.equal(response.state.chat.messages[0].userId,'1');
 assert.equal((await ask(clients[1],'game:sync')).state.chat.messages[0].text,'private-plan');assert.equal((await ask(clients[2],'game:sync')).state.chat.channel,null);
 assert.equal((await ask(clients[2],'game:chat',{text:'hack',channel:'mafia'})).ok,false);assert.equal((await ask(clients[3],'game:chat',{text:'lawyer'})).ok,false);assert(leaked.every(s=>!s.includes('private-plan')));
 g.phase='discussion';g.deadline=Date.now()+60000;assert((await ask(clients[2],'game:chat',{text:'public'})).ok);assert.equal((await ask(clients[0],'game:sync')).state.chat.messages[0].text,'public');
 g.players[2].alive=false;assert.equal((await ask(clients[2],'game:chat',{text:'dead'})).ok,false);
});

test('expired chat is immediately withheld even before a timer transition is processed',()=>{const {g,advance}=room();g.sendChat('1','hidden');advance(50000);assert.equal(g.view('1').chat.channel,null);assert.equal(g.view('1').chat.messages.length,0);g.phase='discussion';g.deadline=g.now()+1000;g.sendChat('3','public');advance(1001);assert.equal(g.view('3').chat.channel,null);});

test('mistress mute blocks discussion messages server-side but allows reading and expires next night',()=>{
 const {g,advance}=room();g.phase='discussion';g.rules.blockMistress=true;g.mistressBlocked=['3'];
 g.sendChat('1','Muhokama');assert.equal(g.view('3').chat.muted,true);assert.equal(g.view('3').chat.messages[0].text,'Muhokama');
 assert.throws(()=>g.sendChat('3','blocked'),/Ma’şuqa/);
 g.rules.blockMistress=false;g.sendChat('3','allowed');
 advance();g.rules.blockMistress=true;g.phase='night';g.players[2].role='mafia';assert.equal(g.view('3').chat.muted,undefined);g.sendChat('3','night');
});
