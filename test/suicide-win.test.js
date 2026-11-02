import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/game.js';
import { Store } from '../src/store.js';

function hanging() {
 let now=Date.now()-300000;
 const g=new Game({id:'1',name:'Suidsid'},{now:()=>now});
 for(let i=2;i<=6;i++)g.join({id:String(i),name:'P'+i});
 g.start('1');g.players.forEach(p=>{p.role='citizen';p.office=null;});
 g.member('1').role='suicide';g.member('2').role='mafia';g.member('2').office='don';
 g.setPhase('confirmation');g.pendingExecution='1';g.confirmations.set('3',true);
 now=g.deadline;g.tick();
 return {g,advance:()=>{now+=300000;}};
}

test('hanged Suidsid keeps a win without ending the game, including after restore',()=>{
 const {g}=hanging();assert.equal(g.phase,'night');assert.equal(g.winner,null);
 assert.equal(g.member('1').alive,false);assert.equal(g.member('1').suicideWon,true);
 const restored=Game.restore(g.snapshot(),g.now);
 assert.equal(restored.member('1').suicideWon,true);
 assert.deepEqual(restored.view('3').coWinners,[]);
});

for(const winner of ['citizens','mafia'])test(`hanged Suidsid shares ${winner} victory and receives dead winner reward`,()=>{
 const {g,advance}=hanging();advance();
 g.activity=new Set(g.players.map(p=>p.id));g.winner=winner;g.setPhase('finished');
 assert.deepEqual(g.view('3').coWinners,[{id:'1',name:'Suidsid',role:'suicide'}]);
 const store=new Store();try{store.save(g);store.save(g);assert.deepEqual({...store.profile('1')},{games:1,wins:1,points:5});}finally{store.close();}
});

test('Suidsid without a hanging or with a maniac victory is not a co-winner',()=>{
 const {g}=hanging();g.winner='maniac';assert.deepEqual(g.view('3').coWinners,[]);
 g.member('1').suicideWon=false;g.winner='citizens';assert.deepEqual(g.view('3').coWinners,[]);
});
