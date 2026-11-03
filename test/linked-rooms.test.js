import test from 'node:test';
import assert from 'node:assert/strict';
import { io } from 'socket.io-client';
import { createApp } from '../src/server.js';
import { TOKEN, signed } from '../support/signing.js';

test('linked rooms enforce discovery, invitations, and Telegram-only entry', async t => {
  const bot = {
    username: 'test_bot', link: id => 'https://t.me/test_bot?startapp='+id,
    member: async () => {}, send: async () => ({ message_id: 77 }),
    call: async method => method === 'getMe' ? { id: 99 } :
      { id: -1001, type: 'supergroup', title: 'Linked group', username: 'linked_group' }
  };
  const app = createApp({ botToken: TOKEN, telegram: bot, webhookSecret: 'secret', requireLinkedRooms: true });
  await new Promise(resolve => app.http.listen(0, '127.0.0.1', resolve));
  const url = 'http://127.0.0.1:'+app.http.address().port;
  const sockets = [1, 2, 3].map(id => io(url, { auth: { initData: signed(id) }, reconnection: false }));
  t.after(async () => { sockets.forEach(socket => socket.disconnect()); await app.close(); });
  await Promise.all(sockets.map(socket => new Promise((resolve, reject) => {
    socket.once('connect', resolve); socket.once('connect_error', reject);
  })));
  const ask = (i, event, data = {}) => sockets[i].timeout(3000).emitWithAck(event, data);
  const create = visibility => ask(0, 'room:create', { groupId: '-1001', visibility });
  assert.equal((await create('public')).ok, false);
  app.store.manageGroup({ id: '-1001', name: 'Linked group' }, '1');
  const closed = (await create('private')).state;
  assert.equal(closed.group.name, 'Linked group');
  assert.deepEqual((await ask(1, 'home:get')).rooms, []);
  assert.equal((await ask(1, 'room:join', { roomId: String(closed.number) })).ok, false);
  assert.equal((await ask(1, 'room:join', { roomId: closed.id })).ok, true);
  await ask(1, 'room:leave');
  await ask(0, 'room:leave');
  const open = (await create('public')).state;
  assert.ok(open.number > closed.number);
  assert.equal((await ask(1, 'home:get')).rooms[0].id, open.id);
  const game = app.rooms.get(open.id);
  game.phase = 'discussion';
  assert.equal((await ask(1, 'room:join', { roomId: open.id })).ok, false);
  game.phase = 'lobby';
  await ask(0, 'room:leave');
  const response = await fetch(url+'/telegram/webhook', {
    method: 'POST', headers: { 'X-Telegram-Bot-Api-Secret-Token': 'secret' },
    body: JSON.stringify({ update_id: 1, message: {
      from: { id: 1, first_name: 'Admin' }, chat: { id: -1001, type: 'supergroup', title: 'Linked group' }, text: '/game'
    } })
  });
  assert.equal(response.status, 200);
  const [telegramRoom] = (await ask(2, 'home:get')).rooms;
  assert.equal(telegramRoom.telegramOnly, true);
  assert.equal(telegramRoom.url, 'https://t.me/linked_group/77');
  assert.equal(telegramRoom.id, undefined);
  const telegramGame = [...app.rooms.values()].find(room => room.entryMode === 'telegram');
  assert.equal((await ask(2, 'room:join', { roomId: telegramGame.id })).ok, false);
});
