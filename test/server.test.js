import test from 'node:test';
import assert from 'node:assert/strict';
import { io } from 'socket.io-client';
import { createApp } from '../src/server.js';
import { TOKEN, signed } from '../support/signing.js';

test('six authenticated sockets play a full game; reconnect and isolation', async t => {
  const app = createApp({ botToken: TOKEN });
  await new Promise(resolve => app.http.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${app.http.address().port}`, clients = [];
  t.after(async () => { clients.forEach(c => c.disconnect()); await app.close(); });
  assert.equal((await (await fetch(`${url}/health`)).json()).ok, true);
  async function connect(id) {
    const socket = io(url, { auth: { initData: signed(id) }, forceNew: true, reconnection: false }); clients.push(socket);
    await new Promise((resolve, reject) => { socket.once('connect', resolve); socket.once('connect_error', reject); }); return socket;
  }
  const ask = (c, event, payload = {}) => c.timeout(2000).emitWithAck(event, payload);
  const peers = []; for (let i = 1; i <= 6; i++) peers.push(await connect(i));
  const created = await ask(peers[0], 'room:create', { group: { id: 'fake' } }); assert.equal(created.ok, true);
  const roomId = created.state.id; assert.equal(created.state.group, null);
  for (const peer of peers.slice(1)) assert.equal((await ask(peer, 'room:join', { roomId })).ok, true);
  assert.equal((await ask(peers[1], 'game:start')).ok, false);
  assert.equal((await ask(peers[0], 'game:start')).ok, true);
  let states = await Promise.all(peers.map(p => ask(p, 'game:sync')));
  assert.ok(states.every(r => r.state.players.every(p => !('role' in p))));
  const originalRole = states[2].state.me.role; peers[2].disconnect(); peers[2] = await connect(3);
  assert.equal((await ask(peers[2], 'room:join', { roomId })).state.me.role, originalRole);
  const outsider = await connect(99); assert.equal((await ask(outsider, 'game:sync')).ok, false);
  assert.equal((await ask(outsider, 'room:join', { roomId })).ok, false);
  const game = app.rooms.get(roomId);
  const advance = () => { game.deadline = 0; game.tick(); };
  advance(); advance();
  const mafias = states.filter(r => r.state.me.role === 'mafia').map(r => r.state.me.id);
  for (const targetId of mafias) {
    for (let i = 0; i < peers.length; i++) {
      if (game.member(String(i + 1)).alive && String(i + 1) !== targetId) {
        assert.equal((await ask(peers[i], 'game:vote', { targetId, revision: game.revision })).ok, true);
      }
    }
    advance(); if (game.phase !== 'finished') { advance(); advance(); }
  }
  assert.equal((await ask(peers[0], 'game:sync')).state.winner, 'citizens');
  const invalid = io(url, { auth: { initData: 'forged' }, forceNew: true, reconnection: false }); clients.push(invalid);
  await new Promise((resolve, reject) => { invalid.once('connect_error', resolve); invalid.once('connect', () => reject(new Error('Unauthenticated connection accepted'))); });
});
