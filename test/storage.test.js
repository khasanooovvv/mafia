import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync } from 'node:fs';
import { resolve } from 'node:path';
import { Store, periodStart } from '../src/store.js';
import { Game } from '../src/game.js';
const player = i => ({ id: String(i), name: `Player ${i}` });

test('profile and ranking agree for both teams, eliminated winners, inactive players and unqualified games', () => {
  const store = new Store(), now = Date.now();
  try {
    for (const winner of ['citizens', 'mafia']) {
      const g = completed(now, false, winner === 'mafia' ? 10 : 0);
      g.winner = winner; g.players[0].alive = false;
      g.activity.delete(g.players[5].id);
      store.save(g); store.save(g);
      for (const p of g.players) {
        const won = (p.role === 'mafia' ? 'mafia' : 'citizens') === winner;
        const active = g.activity.has(p.id);
        const expected = { games: Number(active), wins: Number(active && won), points: active ? (won ? (p.alive ? 10 : 5) : 1) : 0 };
        assert.deepEqual({ ...store.profile(p.id) }, expected);
        const rank = store.rankings('all').players.find(r => r.id === p.id);
        if (active) assert.deepEqual({ games: rank.games, wins: rank.wins, points: rank.points }, expected);
        else assert.equal(rank, undefined);
      }
      const repeat = completed(now + 1000, false, winner === 'mafia' ? 10 : 0);
      store.save(repeat);
      assert.equal(store.profile(g.players[0].id).games, 1);
    }
    const draw = completed(now, false, 20); draw.winner = 'draw'; store.save(draw);
    const short = completed(now, false, 30); short.startedAt = now - 179999; store.save(short);
    const inactive = completed(now, false, 40); inactive.activity = new Set(['40', '41']); store.save(inactive);
    for (const id of ['20', '30', '40']) assert.deepEqual({ ...store.profile(id) }, { games: 0, wins: 0, points: 0 });
  } finally { store.close(); }
});

test('personal daily limit counts five games and resets at Tashkent midnight', () => {
  const store = new Store(), now = Date.parse('2026-10-21T10:00:00Z');
  try {
    for (let i = 0; i < 7; i++) {
      const g = completed(i === 6 ? Date.parse('2026-10-21T19:00:00Z') : now + i * 1000, false, i * 10);
      g.players[0].id = 'same-player'; g.players[0].role = 'citizen'; g.activity.add('same-player');
      store.save(g);
      const count = Math.min(i + 1, 5) + Number(i === 6);
      assert.deepEqual({ ...store.profile('same-player') }, { games: count, wins: count, points: count * 10 });
    }
  } finally { store.close(); }
});
function completed(now, group = true, offset = 0) {
  let clock = now - 300000;
  const g = new Game(player(offset), { now: () => clock, group: group ? { id: '-1001', name: 'Test group' } : null });
  for (let i = 1; i < 6; i++) g.join(player(i + offset));
  g.start(String(offset)); clock = now; g.activity = new Set(g.players.map(p => p.id)); g.winner = 'citizens'; g.setPhase('finished'); return g;
}
test('SQLite restores roles, private actions, timers and votes after restart', () => {
  const dir = resolve('../../../work/storage-tests'); mkdirSync(dir, { recursive: true });
  const file = resolve(mkdtempSync(resolve(dir,'run-')), 'test.sqlite');
  let store = new Store(file); const g = completed(Date.now());
  g.players[0].username = 'player_zero'; g.players[0].photoUrl = 'https://t.me/i/userpic/320/photo.jpg';
  g.phase = 'night'; g.actions.set('1',{targetIds:['3'],mode:null}); g.votes.set('4','2'); g.reports.set('2',[{targetId:'1',isMafia:true}]); g.deadline=Date.now()+5000;
  store.save(g); store.close(); store = new Store(file);
  const loaded = store.load().get(g.id); assert.deepEqual(loaded.snapshot(), g.snapshot()); assert.equal(loaded.view('1').me.actionSubmitted,true);
  assert.equal(loaded.view('0').players[0].photoUrl, g.players[0].photoUrl);
  const role = loaded.member('0').role;
  loaded.join({ id: '0', name: 'Updated Telegram name', username: 'new_name', photoUrl: null });
  assert.equal(loaded.member('0').role, role); assert.equal(loaded.member('0').username, 'new_name'); assert.equal(loaded.member('0').photoUrl, null);
  store.close();
});
test('results are idempotent; repeated roster earns half group points and short games earn none', () => {
  const store = new Store(), now = Date.now();
  const first = completed(now); store.save(first); store.save(first);
  assert.equal(store.rankings('all').groups[0].points,16); assert.equal(store.profile('0').games,1);
  store.save(completed(now+1000)); assert.equal(store.rankings('all').groups[0].points,24); assert.equal(store.profile('0').games,1);
  const short=completed(now+2000,true,10);short.startedAt=now;store.save(short);
  assert.equal(store.rankings('all').groups[0].games,2);
  const independent=completed(now+3000,false,20);store.save(independent);
  assert.equal(store.rankings('all').groups[0].games,2);assert.ok(store.profile('20').points>0);store.close();
});
test('group daily 100-point cap clips final award and resets at Tashkent midnight', () => {
  const store = new Store(), now = Date.parse('2026-10-21T10:00:00Z');
  for(let i=0;i<8;i++)store.save(completed(now+i*1000,true,i*10));
  assert.equal(store.rankings('week',now+10000).groups[0].points,100);
  assert.equal(store.rankings('week',now+10000).groups[0].games,8);
  const awards=store.db.prepare('SELECT points FROM results ORDER BY finished').all().map(r=>r.points);
  assert.deepEqual(awards,[16,16,16,16,16,16,4,0]);
  store.save(completed(Date.parse('2026-10-21T19:00:00Z'),true,100));
  assert.equal(store.rankings('week',now+86400000).groups[0].points,116);
  assert.equal(new Date(periodStart('week',now)).toISOString(),'2026-10-18T19:00:00.000Z');
  assert.equal(new Date(periodStart('month',now)).toISOString(),'2026-09-30T19:00:00.000Z');store.close();
});


test('earned currency credits wallet once and purchases do not reduce earned ranking', () => {
 const store = new Store(), now = Date.parse('2026-11-02T10:00:00Z');
 try {
  const g=completed(now); g.players.forEach(p=>p.role='citizen');g.players[1].role='mafia';g.activity.delete('5');
  store.save(g);store.save(g);
  assert.equal(store.inventory('0').coins,10);
  assert.equal(store.inventory('1').coins,1);
  assert.equal(store.inventory('5').coins,0);
  store.save(completed(now+1000));assert.equal(store.inventory('0').coins,10);
  for(let i=1;i<3;i++){const next=completed(now+2000+i*1000,true,i*10);next.players[0].id='0';next.players[0].role='citizen';next.activity.add('0');store.save(next);}
  assert.equal(store.inventory('0').coins,30);
  store.db.prepare('UPDATE inventories SET coins=coins+100 WHERE user_id=?').run('0');
  assert.equal(store.buyItem('0','protection').coins,30);
  assert.equal(store.profile('0').points,30);
  assert.equal(store.rankings('all').players.find(p=>p.id==='0').points,30);
 } finally {store.close();}
});


test('winning rewards distinguish surviving and eliminated active teammates', () => {
 const store=new Store();
 try {
  const g=completed(Date.parse('2026-11-02T10:00:00Z'));
  g.players.forEach(p=>{p.role='citizen';p.alive=true;});
  g.players[1].alive=false;g.players[2].role='mafia';g.players[3].alive=false;g.activity.delete('3');
  store.save(g);store.save(g);
  assert.equal(store.inventory('0').coins,10);
  assert.equal(store.inventory('1').coins,5);
  assert.equal(store.profile('1').points,5);
  assert.equal(store.profile('1').wins,1);
  assert.equal(store.inventory('2').coins,1);
  assert.equal(store.inventory('3').coins,0);
 } finally {store.close();}
});
