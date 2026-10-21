import test from 'node:test';
import assert from 'node:assert/strict';
import { io } from 'socket.io-client';
import { createApp } from '../src/server.js';
import { Game, GameError } from '../src/game.js';
import { TOKEN, signed } from '../support/signing.js';

test('server will not advance to voting until media teardown succeeds', async t => {
  let unavailable = true, closes = 0;
  const voice = { enabled: true, allowed:()=>false, close: async()=>{closes++;if(unavailable)throw new Error('media unavailable');} };
  const app=createApp({botToken:TOKEN,voice});await new Promise(r=>app.http.listen(0,'127.0.0.1',r));
  const socket=io(`http://127.0.0.1:${app.http.address().port}`,{auth:{initData:signed(1)},reconnection:false});
  t.after(async()=>{socket.disconnect();await app.close();});await new Promise(r=>socket.once('connect',r));
  const ask=(event,p={})=>socket.timeout(2000).emitWithAck(event,p);
  const {state}=await ask('room:create'),g=app.rooms.get(state.id);
  for(let i=2;i<=6;i++)g.join({id:String(i),name:`P${i}`});g.start('1');g.phase='discussion';g.deadline=0;
  assert.equal((await ask('game:sync')).ok,false);assert.equal(g.phase,'discussion');assert.ok(closes>0);
  unavailable=false;assert.equal((await ask('game:sync')).state.phase,'voting');
});
test('group socket join checks membership and does not trust client group affiliation', async t => {
  let allow=false;
  const bot={username:'test_bot',member:async()=>{if(!allow)throw new GameError('Not a member');}};
  const app=createApp({botToken:TOKEN,telegram:bot});const group=new Game({id:'1',name:'Owner'},{group:{id:'-1001',name:'Test'}});app.rooms.set(group.id,group);
  await new Promise(r=>app.http.listen(0,'127.0.0.1',r));
  const socket=io(`http://127.0.0.1:${app.http.address().port}`,{auth:{initData:signed(2)},reconnection:false});t.after(async()=>{socket.disconnect();await app.close();});await new Promise(r=>socket.once('connect',r));
  const join=()=>socket.timeout(2000).emitWithAck('room:join',{roomId:group.id});
  assert.equal((await join()).ok,false);assert.equal(group.players.length,1);allow=true;
  assert.equal((await join()).ok,true);assert.equal(group.players.length,2);
});
