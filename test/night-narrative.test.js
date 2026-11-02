import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/game.js';

test('night narrative shares only action flavor, never actor identity, target or check result',()=>{
 let now=0;const g=new Game({id:'1',name:'SecretActor'},{now:()=>now,pick:n=>n-1});
 for(let i=2;i<=6;i++)g.join({id:String(i),name:'PrivateTarget'+i});g.start('1');
 g.players[0].role='commissioner';g.nightAction('1',{targetId:'2',mode:'check'},g.revision);
 const view=g.view('6');assert(view.nightEvents[0].includes('Komissar'));
 assert(!JSON.stringify(view.nightEvents).includes('SecretActor'));assert(!JSON.stringify(view.nightEvents).includes('PrivateTarget'));
 assert.equal(view.me.reports.length,0);assert.equal(view.me.nightAction,null);
 g.rules.showActions=false;assert.deepEqual(g.view('6').nightEvents,[]);
 now=g.deadline;g.tick();assert.deepEqual(g.view('6').nightEvents,[]);
});


test('dawn announces dead roles and Don succession without exposing the successor identity',()=>{
 let now=0;const g=new Game({id:'1',name:'Old Don'},{now:()=>now,pick:n=>n-1});
 for(let i=2;i<=6;i++)g.join({id:String(i),name:'Player '+i});g.start('1');
 g.players.forEach(p=>{p.role='citizen';p.office=null;});g.players[0].role='mafia';g.players[0].office='don';g.players[1].role='mafia';g.players[2].role='maniac';
 g.nightAction('1',{targetId:'4'},g.revision);g.nightAction('2',{targetId:'4'},g.revision);g.nightAction('3',{targetId:'1'},g.revision);now=g.deadline;g.tick();
 const events=g.view('6').lastResult.events;
 assert.equal(events.find(e=>e.id==='1').role,'don');
 assert.deepEqual(events.find(e=>e.id==='1').killerRoles,['maniac']);
 assert.deepEqual(events.find(e=>e.type==='donSuccession'),{type:'donSuccession'});
 assert(!g.lastResult.eliminated.includes(undefined));
});


test('missing active night action eliminates, while passive, blocked and explicit skip survive',()=>{
 let now=0;const g=new Game({id:'1',name:'P1'},{now:()=>now,pick:n=>n-1,rules:{skipNight:true}});
 for(let i=2;i<=8;i++)g.join({id:String(i),name:'P'+i});g.start('1');
 const roles=['doctor','commissioner','citizen','sergeant','lucky','mayor','mistress','hobo'];
 g.players.forEach((p,i)=>{p.role=roles[i];p.office=null;});
 g.nightAction('2',{skip:true},g.revision);
 g.nightAction('7',{targetId:'8'},g.revision);
 now=g.deadline;g.tick();
 assert.equal(g.member('1').alive,false);
 const death=g.lastResult.events.find(e=>e.id==='1');assert.equal(death.reason,'inactivity');assert.equal(death.inactive,true);
 for(const id of ['2','3','4','5','6','7','8'])assert.equal(g.member(id).alive,true,id);
});

test('last words are single-use, limited to attack victims and the following day',()=>{
 let now=0;const g=new Game({id:'1',name:'A'},{now:()=>now,pick:n=>n-1});for(let i=2;i<=6;i++)g.join({id:String(i),name:'P'+i});g.start('1');
 g.players.forEach(p=>{p.role='citizen';p.office=null;});g.players[0].role='maniac';g.players[1].role='mafia';g.players[1].office='don';
 g.nightAction('1',{targetId:'6'},g.revision);g.nightAction('2',{targetId:'6'},g.revision);now=g.deadline;g.tick();
 assert.equal(g.phase,'discussion');assert.throws(()=>g.lastWords('3','No'));
 g.lastWords('6','Maylide');assert.equal(g.lastResult.events.find(e=>e.id==='6').lastWords,'Maylide');assert.throws(()=>g.lastWords('6','Again'));
 g.phase='voting';assert.throws(()=>g.lastWords('6','Late'));
});
