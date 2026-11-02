import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/game.js';
import {completeNight} from '../support/night-fixture.js';
function room(){let now=0;const g=new Game({id:'0',name:'P0'},{now:()=>now,rules:{enableBuffs:true,skipNight:true}});for(let i=1;i<6;i++)g.join({id:String(i),name:'P'+i});g.start('0');g.players.forEach(p=>{p.role='citizen';p.office=null;});return {g,next(){completeNight(g);now=g.deadline;g.tick();}};}
for(const role of ['citizen','sergeant','lucky','suicide','kamikaze','mayor'])test(`${role} cannot submit or skip an ordinary night action`,()=>{const {g}=room();g.member('0').role=role;assert.throws(()=>g.nightAction('0',{targetId:'1'},g.revision));assert.throws(()=>g.nightAction('0',{skip:true},g.revision));assert.equal(g.actions.has('0'),false);});
for(const order of [['0','3'],['3','0']])test(`documents cover journalist and commissioner regardless of submission order ${order}`,()=>{
 const {g,next}=room();g.member('0').role='journalist';g.member('1').role='mafia';g.member('1').buffs={documents:1};g.member('3').role='commissioner';
 for(const id of order)g.nightAction(id,id==='0'?{targetIds:['1','2']}:{targetId:'1',mode:'check'},g.revision);
 next();assert.equal(g.reports.get('0')[0].sameSide,true);assert.equal(g.reports.get('3')[0].role,'citizen');assert.equal(g.member('1').buffSpent.documents,1);
 g.setPhase('night');g.round++;g.nightAction('0',{targetIds:['1','2']},g.revision);next();assert.equal(g.reports.get('0').at(-1).sameSide,false);
});
