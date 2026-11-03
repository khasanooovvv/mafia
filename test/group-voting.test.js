import { completeNight } from '../support/night-fixture.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/game.js';
import { GroupVoting } from '../src/group-voting.js';

test('group voting announces votes once, confirmation, result and next night without leaking living roles', async()=>{
  let now=0; const g=new Game({id:'0',name:'A'},{now:()=>now,group:{id:'-1',name:'Group'},pick:n=>n-1});
  for(let i=1;i<6;i++)g.join({id:String(i),name:'P'+i}); g.start('0');
  const messages=[], bridge=new GroupVoting({send:async(...args)=>messages.push(args)});
  const next=()=>{completeNight(g);now=g.deadline;g.tick();bridge.publish(g);};
  next();next();g.vote('0',{targetId:'1'},g.revision);bridge.publish(g);bridge.publish(g); await bridge.queue;
  assert.equal(messages.filter(m=>m[1].includes('A → P1')).length,1);
  assert(!messages.some(m=>m[1].includes('Roli:')));
  next();await bridge.queue; assert(messages.some(m=>m[1].includes('P1ni osmoqchimisiz')));
  for(const p of g.players.slice(0,4))g.vote(p.id,{confirm:true},g.revision);
  assert.equal(g.view('0').voting.approvals,4);
  next();await bridge.queue;
  assert(messages.some(m=>m[1].includes('4 👍 | 0 👎')));
  assert(messages.some(m=>m[1].includes('Roli:')));
  assert(messages.some(m=>m[1].includes('Tun boshlandi')));
  const before=messages.length;const restored=Game.restore(JSON.parse(JSON.stringify(g.snapshot())));bridge.publish(restored);await bridge.queue;assert.equal(messages.length,before);
});

test('ungrouped games never send Telegram notifications',async()=>{const g=new Game({id:'0',name:'A'});const bridge=new GroupVoting({send:async()=>assert.fail('sent')});bridge.publish(g);await bridge.queue;});

test('confirmation counts cast votes: small majority passes; tie and no votes reject',()=>{
  for(const votes of [[true,true,false],[true,false],[]]) {
    let now=0;const g=new Game({id:'0',name:'A'},{now:()=>now,pick:n=>n-1});for(let i=1;i<6;i++)g.join({id:String(i),name:'P'+i});g.start('0');
    const next=()=>{completeNight(g);now=g.deadline;g.tick();};next();next();g.vote('0',{targetId:'1'},g.revision);next();
    votes.forEach((confirm,i)=>g.vote(String(i),{confirm},g.revision));next();
    assert.equal(g.lastResult.approved,votes.length===3);assert.equal(g.players[1].alive,votes.length!==3);
  }
});
