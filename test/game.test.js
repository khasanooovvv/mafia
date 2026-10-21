import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/game.js';

const user = id => ({ id: String(id), name: `Player ${id}` });
function setup(n = 6) {
  let time = 100000;
  const game = new Game(user(0), { now: () => time, pick: n => n - 1, rules: { nightMs: 1000, discussionMs: 1000, votingMs: 1000 } });
  for (let i = 1; i < n; i++) game.join(user(i));
  game.start('0');
  return { game, advance: () => { time += 1000; game.tick(); } };
}
test('6–12 players get valid role distribution; only owner starts', () => {
  for (let n = 6; n <= 12; n++) {
    const { game } = setup(n);
    assert.equal(game.players.filter(p => p.role === 'mafia').length, Math.floor(n / 3));
    assert.equal(game.players.filter(p => p.role === 'doctor').length, 1);
    assert.throws(() => game.start('1'));
    assert.throws(() => game.join(user(20)));
  }
  const small = new Game(user(0)); assert.throws(() => small.start('0'));
});
test('private projection hides roles, actions, reports and other players votes', () => {
  const { game, advance } = setup();
  game.nightAction('2', '0', game.revision);
  assert.throws(() => game.nightAction('2', '1', game.revision));
  let view = game.view('4');
  assert.ok(view.players.every(p => !('role' in p)));
  assert.equal(view.me.role, 'citizen'); assert.deepEqual(view.me.reports, []);
  assert.equal('actions' in view, false); assert.equal('votes' in view, false);
  assert.deepEqual(game.view('0').me.teammates, ['1']);
  advance();
  assert.deepEqual(game.view('2').me.reports, [{ round: 1, targetId: '0', isMafia: true }]);
  assert.deepEqual(game.view('4').me.reports, []);
});
test('doctor protects; voice allowed only for alive players in discussion', () => {
  const { game, advance } = setup();
  assert.equal(game.view('0').voice.enabled, false);
  game.nightAction('0', '4', game.revision); game.nightAction('1', '4', game.revision);
  game.nightAction('3', '4', game.revision); advance();
  assert.equal(game.member('4').alive, true); assert.equal(game.phase, 'discussion');
  assert.equal(game.view('4').voice.enabled, true);
  assert.throws(() => game.vote('4', '0', game.revision)); advance();
  assert.equal(game.view('4').voice.enabled, false);
});
test('night ties and voting ties eliminate nobody', () => {
  const { game, advance } = setup();
  game.nightAction('0', '4', game.revision); game.nightAction('1', '5', game.revision); advance(); advance();
  game.vote('0', '4', game.revision); game.vote('1', '5', game.revision); advance();
  assert.equal(game.players.filter(p => p.alive).length, 6);
  assert.equal(game.round, 2); assert.equal(game.phase, 'night');
});
test('invalid, duplicate and stale actions fail; reconnect retains role', () => {
  const { game, advance } = setup();
  const revision = game.revision;
  assert.throws(() => game.nightAction('4', '0', revision));
  assert.throws(() => game.nightAction('0', '1', revision));
  assert.throws(() => game.nightAction('2', '2', revision));
  assert.throws(() => game.nightAction('0', 'missing', revision));
  assert.throws(() => game.view('outsider'));
  game.join(user(0)); assert.equal(game.players.length, 6); assert.equal(game.view('0').me.role, 'mafia');
  advance(); advance();
  assert.throws(() => game.vote('4', '0', revision));
  game.vote('4', '0', game.revision); assert.throws(() => game.vote('4', '1', game.revision));
});
test('full game ends in citizens win, dead players cannot act', () => {
  const { game, advance } = setup(); advance(); advance();
  for (const id of ['2', '3', '4']) game.vote(id, '0', game.revision);
  advance(); assert.equal(game.member('0').alive, false);
  assert.throws(() => game.nightAction('0', '4', game.revision));
  advance(); assert.equal(game.view('0').voice.enabled, false); advance();
  for (const id of ['2', '3', '4']) game.vote(id, '1', game.revision);
  advance(); assert.equal(game.phase, 'finished'); assert.equal(game.winner, 'citizens');
  assert.equal(game.deadline, null); assert.ok(game.view('0').players.every(p => p.role));
});
test('mafia wins at parity', () => {
  const { game, advance } = setup();
  game.nightAction('0', '4', game.revision); game.nightAction('1', '4', game.revision); advance(); advance();
  game.vote('0', '5', game.revision); game.vote('1', '5', game.revision); advance();
  assert.equal(game.winner, 'mafia'); assert.equal(game.phase, 'finished');
});
test('expired phase rejects late action', () => {
  let time = 0;
  const game = new Game(user(0), { now: () => time, rules: { nightMs: 1000 } });
  for (let i = 1; i < 6; i++) game.join(user(i)); game.start('0'); time = 1001;
  assert.throws(() => game.nightAction('0', '1', game.revision)); assert.equal(game.phase, 'discussion');
});
test('lobby owner transfers on leave and capacity is enforced', () => {
  const game = new Game(user(0)); for (let i = 1; i < 12; i++) game.join(user(i));
  assert.throws(() => game.join(user(12))); game.leave('0'); assert.equal(game.ownerId, '1');
});
