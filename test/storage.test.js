import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync } from 'node:fs';
import { resolve } from 'node:path';
import { Store, periodStart } from '../src/store.js';
import { Game } from '../src/game.js';
const player = i => ({ id: String(i), name: `Player ${i}` });
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
  g.phase = 'night'; g.actions.set('1','3'); g.votes.set('4','2'); g.reports.set('2',[{targetId:'1',isMafia:true}]); g.deadline=Date.now()+5000;
  store.save(g); store.close(); store = new Store(file);
  const loaded = store.load().get(g.id); assert.deepEqual(loaded.snapshot(), g.snapshot()); assert.equal(loaded.view('1').me.actionSubmitted,true); store.close();
});
test('results are idempotent; repeated roster and short games earn no points', () => {
  const store = new Store(), now = Date.now();
  const first = completed(now); store.save(first); store.save(first);
  assert.equal(store.rankings('all').groups[0].points,16); assert.equal(store.profile('0').games,1);
  store.save(completed(now+1000)); assert.equal(store.rankings('all').groups[0].points,16);
  const short=completed(now+2000,true,10);short.startedAt=now;store.save(short);
  assert.equal(store.rankings('all').groups[0].games,1);
  const independent=completed(now+3000,false,20);store.save(independent);
  assert.equal(store.rankings('all').groups[0].games,1);assert.ok(store.profile('20').points>0);store.close();
});
test('group daily cap and Asia/Tashkent week and month boundaries', () => {
  const store = new Store(), now = Date.parse('2026-10-21T10:00:00Z');
  for(let i=0;i<6;i++)store.save(completed(now+i*1000,true,i*10));
  assert.equal(store.rankings('week',now+10000).groups[0].games,5);
  assert.equal(new Date(periodStart('week',now)).toISOString(),'2026-10-18T19:00:00.000Z');
  assert.equal(new Date(periodStart('month',now)).toISOString(),'2026-09-30T19:00:00.000Z');store.close();
});
