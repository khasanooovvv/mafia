import test from 'node:test';
import assert from 'node:assert/strict';
import { Voice } from '../src/voice.js';
import { Game } from '../src/game.js';
test('voice token has no initial media grants; only living players can be granted microphone in discussion', async () => {
  const calls=[];const voice=new Voice({url:'wss://voice.example',apiKey:'test-key',apiSecret:'test-secret-that-is-at-least-32-bytes',service:{updateParticipant:async(...args)=>calls.push(args),deleteRoom:async room=>calls.push(room)}});
  const g=new Game({id:'1',name:'One'});g.phase='night';g.deadline=Date.now()+10000;
  await assert.rejects(()=>voice.token(g,'1'));g.phase='discussion';g.round=1;
  const grant=await voice.token(g,'1'),jwt=JSON.parse(Buffer.from(grant.token.split('.')[1],'base64url'));
  assert.equal(jwt.video.canPublish,false);assert.equal(jwt.video.canSubscribe,false);assert.equal(jwt.video.canPublishData,false);
  await voice.ready(g,'1');assert.deepEqual(calls[0][2].permission.canPublishSources,[2]);
  g.member('1').alive=false;await assert.rejects(()=>voice.ready(g,'1'));
  g.member('1').alive=true;g.deadline=Date.now()-1;await assert.rejects(()=>voice.token(g,'1'));
  await voice.close(g);assert.equal(calls[1],voice.room(g));
});
test('invalid voice webhook cannot change media permissions', async () => {
  let called=false;
  const voice=new Voice({url:'wss://voice.example',apiKey:'test-key',apiSecret:'test-secret',service:{deleteRoom:async()=>called=true}});
  await assert.rejects(()=>voice.handleWebhook('{}','invalid',new Map()));assert.equal(called,false);
});
