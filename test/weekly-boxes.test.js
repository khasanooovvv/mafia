import test from 'node:test';
import assert from 'node:assert/strict';
import { Store, periodStart } from '../src/store.js';

const start=periodStart('week',Date.parse('2026-11-02T10:00:00Z'));
const end=start+7*86400000;
function seed(store,group,players=['1','2','3'],points=16){
 for(let i=0;i<3;i++){
  const id=`${group}-${i}`;
  store.db.prepare('INSERT INTO results VALUES(?,?,?,?,?,?,?)').run(id,start+1000+i,group,`Group ${group}`,id,1,points);
  for(const user of players)store.db.prepare('INSERT INTO game_activity VALUES(?,?)').run(id,user);
 }
}
test('weekly coins are shared only among three-game active players, once, at Tashkent boundary',()=>{
 const s=new Store();try{
  s.settleWeeklyRewards(start);seed(s,'-1001');
  s.db.prepare('INSERT INTO game_activity VALUES(?,?)').run('-1001-0','inactive');
  s.settleWeeklyRewards(end-1);assert.equal(s.inventory('1').coins,0);
  s.settleWeeklyRewards(end);
  for(const id of ['1','2','3'])assert.equal(s.inventory(id).coins,id==='1'?334:333);
  assert.equal(s.inventory('inactive').coins,0);
  assert.equal(s.weeklyRewards('1')[0].coins,334);
  s.settleWeeklyRewards(end+10000);assert.equal(s.inventory('1').coins,334);
  assert.equal(s.db.prepare('SELECT COUNT(*) n FROM group_boxes').get().n,1);
 }finally{s.close();}
});
test('coin remainder preserves the whole reward without awarding cards',()=>{
 const s=new Store();try{
  s.settleWeeklyRewards(start);seed(s,'-1001',['1','2','3','4','5','6','7']);
  s.settleWeeklyRewards(end);
  assert.equal(s.db.prepare('SELECT SUM(coins) n FROM box_payouts').get().n,1000);
  assert.equal(s.db.prepare('SELECT SUM(active_role) n FROM box_payouts').get().n,0);
 }finally{s.close();}
});
test('only top 30 qualify, weeks without eligible players do not pay, failed payout rolls back',()=>{
 const s=new Store();try{
  s.settleWeeklyRewards(start);
  for(let i=0;i<31;i++)seed(s,String(-100000-i),[String(i+1)],31-i);
  s.settleWeeklyRewards(end);
  assert.equal(s.db.prepare('SELECT COUNT(*) n FROM group_boxes').get().n,30);
  assert.equal(s.db.prepare('SELECT COUNT(*) n FROM group_boxes WHERE group_id=?').get('-100030').n,0);
  assert.equal(s.db.prepare('SELECT SUM(coins) total FROM inventories').get().total,13200);
  const tiers=s.db.prepare('SELECT b.rank,SUM(p.coins) AS total FROM group_boxes b JOIN box_payouts p ON b.week_start=p.week_start AND b.group_id=p.group_id GROUP BY b.rank ORDER BY b.rank').all();
  for(const r of tiers)assert.equal(r.total,r.rank<=3?1000:r.rank<=10?600:r.rank<=20?400:200);
 }finally{s.close();}
 const empty=new Store();try{empty.settleWeeklyRewards(start);seed(empty,'-1001',[]);empty.settleWeeklyRewards(end);assert.equal(empty.db.prepare('SELECT reward FROM group_boxes').get().reward,'no_active_players');}finally{empty.close();}
 const failed=new Store();try{failed.settleWeeklyRewards(start);seed(failed,'-1001');failed.db.exec("CREATE TRIGGER fail_reward BEFORE INSERT ON box_payouts BEGIN SELECT RAISE(ABORT, 'test failure'); END");assert.throws(()=>failed.settleWeeklyRewards(end));assert.equal(failed.db.prepare('SELECT COUNT(*) n FROM group_boxes').get().n,0);failed.db.exec('DROP TRIGGER fail_reward');failed.settleWeeklyRewards(end);assert.equal(failed.inventory('1').coins,334);}finally{failed.close();}
});


test('each player earns from only their highest ranked eligible group each week',()=>{
 const s=new Store();try{
  s.settleWeeklyRewards(start);
  seed(s,'-1001',['1','2'],30);
  seed(s,'-1002',['1','3'],20);
  seed(s,'-1003',['1'],10);
  s.settleWeeklyRewards(end);
  assert.equal(s.inventory('1').coins,500);
  assert.equal(s.inventory('2').coins,500);
  assert.equal(s.inventory('3').coins,1000);
  assert.equal(s.weeklyRewards('1').length,1);
  assert.equal(s.weeklyRewards('1')[0].rank,1);
  assert.equal(s.db.prepare('SELECT COUNT(*) n FROM box_payouts WHERE user_id=?').get('1').n,1);
  assert.equal(s.db.prepare('SELECT reward FROM group_boxes WHERE group_id=?').get('-1003').reward,'no_active_players');
  s.settleWeeklyRewards(end+1000);assert.equal(s.inventory('1').coins,500);
  s.db.prepare('INSERT INTO results VALUES(?,?,?,?,?,?,?)').run('next-week',end+1,'-1002','Next group','next',1,16);
  // Three separate qualifying games in the next week make the same player eligible again.
  for(let i=0;i<3;i++){
   const id='week-two-'+i;s.db.prepare('INSERT INTO results VALUES(?,?,?,?,?,?,?)').run(id,end+2+i,'-1002','Next group',id,1,16);
   s.db.prepare('INSERT INTO game_activity VALUES(?,?)').run(id,'1');
  }
  s.settleWeeklyRewards(end+7*86400000);assert.equal(s.inventory('1').coins,1500);
 }finally{s.close();}
});
