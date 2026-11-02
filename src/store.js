import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { Game } from './game.js';

export function periodStart(period, now = Date.now()) {
  // All leaderboard boundaries use Asia/Tashkent, UTC+5 (no DST).
  if (period === 'all') return 0;
  const d = new Date(now + 5 * 3600000); d.setUTCHours(0, 0, 0, 0);
  if (period === 'month') d.setUTCDate(1);
  else if (period === 'week') d.setUTCDate(d.getUTCDate() - (d.getUTCDay() + 6) % 7);
  else if (period !== 'day') throw new Error('Davr noto‘g‘ri');
  return d.getTime() - 5 * 3600000;
}
export class Store {
  constructor(path = ':memory:') {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS rooms(id TEXT PRIMARY KEY, state TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS results(id TEXT PRIMARY KEY, finished INTEGER NOT NULL, group_id TEXT, group_name TEXT, roster TEXT NOT NULL, qualified INTEGER NOT NULL, points INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS scores(game_id TEXT NOT NULL REFERENCES results(id), user_id TEXT NOT NULL, name TEXT NOT NULL, points INTEGER NOT NULL, won INTEGER NOT NULL, PRIMARY KEY(game_id,user_id));
      CREATE INDEX IF NOT EXISTS result_date ON results(finished);
      CREATE INDEX IF NOT EXISTS score_user ON scores(user_id);
      CREATE TABLE IF NOT EXISTS managed_groups(id TEXT PRIMARY KEY, name TEXT NOT NULL, settings TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS group_admins(group_id TEXT NOT NULL, user_id TEXT NOT NULL, PRIMARY KEY(group_id,user_id));
      CREATE TABLE IF NOT EXISTS inventories(user_id TEXT PRIMARY KEY, coins INTEGER NOT NULL DEFAULT 0, protection INTEGER NOT NULL DEFAULT 0, documents INTEGER NOT NULL DEFAULT 0, active_role INTEGER NOT NULL DEFAULT 0, pumpkin INTEGER NOT NULL DEFAULT 0, candy INTEGER NOT NULL DEFAULT 0);
      CREATE TABLE IF NOT EXISTS buff_spending(game_id TEXT NOT NULL,user_id TEXT NOT NULL,item TEXT NOT NULL,quantity INTEGER NOT NULL,PRIMARY KEY(game_id,user_id,item));
      CREATE TABLE IF NOT EXISTS group_cooldowns(group_id TEXT NOT NULL,user_id TEXT NOT NULL,until_ms INTEGER NOT NULL,PRIMARY KEY(group_id,user_id));
      CREATE TABLE IF NOT EXISTS game_activity(game_id TEXT NOT NULL REFERENCES results(id),user_id TEXT NOT NULL,PRIMARY KEY(game_id,user_id));
      CREATE TABLE IF NOT EXISTS reward_state(id INTEGER PRIMARY KEY CHECK(id=1),week_start INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS group_boxes(week_start INTEGER NOT NULL,group_id TEXT NOT NULL,group_name TEXT NOT NULL,rank INTEGER NOT NULL,reward TEXT NOT NULL,PRIMARY KEY(week_start,group_id));
      CREATE TABLE IF NOT EXISTS box_payouts(week_start INTEGER NOT NULL,group_id TEXT NOT NULL,user_id TEXT NOT NULL,coins INTEGER NOT NULL,active_role INTEGER NOT NULL,PRIMARY KEY(week_start,group_id,user_id));
      CREATE INDEX IF NOT EXISTS weekly_reward_user ON box_payouts(week_start,user_id);
      CREATE TABLE IF NOT EXISTS registered_groups(group_id TEXT PRIMARY KEY,active INTEGER NOT NULL DEFAULT 1);
      CREATE TABLE IF NOT EXISTS user_directory(user_id TEXT PRIMARY KEY,name TEXT NOT NULL);
      INSERT OR IGNORE INTO registered_groups SELECT id,1 FROM managed_groups;
      CREATE TABLE IF NOT EXISTS group_call_cooldowns(group_id TEXT PRIMARY KEY,sent INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS known_group_members(group_id TEXT NOT NULL,user_id TEXT NOT NULL,name TEXT NOT NULL,PRIMARY KEY(group_id,user_id));
      CREATE TABLE IF NOT EXISTS next_game_subscriptions(group_id TEXT NOT NULL,user_id TEXT NOT NULL,PRIMARY KEY(group_id,user_id));
      CREATE TABLE IF NOT EXISTS updates(id INTEGER PRIMARY KEY, room_id TEXT, sent INTEGER NOT NULL DEFAULT 0);
      CREATE TABLE IF NOT EXISTS bot_users(user_id TEXT PRIMARY KEY,first_seen INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS referrals(invitee_id TEXT PRIMARY KEY,inviter_id TEXT NOT NULL REFERENCES bot_users(user_id),created_at INTEGER NOT NULL,rewarded_game TEXT REFERENCES results(id),inviter_coins INTEGER NOT NULL DEFAULT 0,invitee_coins INTEGER NOT NULL DEFAULT 0);
      CREATE INDEX IF NOT EXISTS referral_inviter ON referrals(inviter_id);
      INSERT OR IGNORE INTO bot_users SELECT user_id,0 FROM inventories;
      INSERT OR IGNORE INTO bot_users SELECT user_id,0 FROM scores;
    `);
  }
  registerUser(id, inviter = null, now = Date.now()) {
    if(!/^[1-9][0-9]{0,19}$/.test(id))return false;
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const fresh=this.db.prepare('INSERT OR IGNORE INTO bot_users VALUES(?,?)').run(id,now).changes;
      const eligible=fresh && inviter!==id && /^[1-9][0-9]{0,19}$/.test(inviter||'') && this.db.prepare('SELECT user_id FROM bot_users WHERE user_id=?').get(inviter);
      if(eligible)this.db.prepare('INSERT INTO referrals(invitee_id,inviter_id,created_at) VALUES(?,?,?)').run(id,inviter,now);
      this.db.exec('COMMIT');return !!eligible;
    } catch(e){this.db.exec('ROLLBACK');throw e;}
  }
  referralStats(id) {
    const row=this.db.prepare('SELECT COUNT(*) invited,COALESCE(SUM(rewarded_game IS NOT NULL),0) qualified,COALESCE(SUM(inviter_coins),0) earned FROM referrals WHERE inviter_id=?').get(id);
    const bonus=this.db.prepare('SELECT invitee_coins FROM referrals WHERE invitee_id=?').get(id)?.invitee_coins||0;
    return {...row,bonus,rewardEach:10};
  }
  rewardReferral(id, gameId) {
    // Called inside save's transaction, only after a counted active game.
    const row=this.db.prepare('SELECT inviter_id FROM referrals WHERE invitee_id=? AND rewarded_game IS NULL').get(id);
    if(!row)return;
    this.db.prepare('UPDATE referrals SET rewarded_game=?,inviter_coins=10,invitee_coins=10 WHERE invitee_id=? AND rewarded_game IS NULL').run(gameId,id);
    for(const user of [id,row.inviter_id]) {
      this.inventory(user);
      this.db.prepare('UPDATE inventories SET coins=coins+10 WHERE user_id=?').run(user);
    }
  }
  settleWeeklyRewards(now=Date.now()) {
    const current=periodStart('week',now), weekMs=7*86400000;
    this.db.exec('BEGIN IMMEDIATE');
    try {
      let start=this.db.prepare('SELECT week_start FROM reward_state WHERE id=1').get()?.week_start;
      if(start===undefined){start=current;this.db.prepare('INSERT INTO reward_state VALUES(1,?)').run(start);}
      for(;start<current;start+=weekMs){
        const end=start+weekMs;
        const groups=this.db.prepare('SELECT group_id AS id,MAX(group_name) AS name,SUM(points) AS points,COUNT(*) AS games FROM results WHERE finished>=? AND finished<? AND group_id IS NOT NULL AND qualified=1 GROUP BY group_id HAVING SUM(points)>0 ORDER BY points DESC,games DESC,id LIMIT 30').all(start,end);
        const rewarded=new Set(this.db.prepare('SELECT user_id FROM box_payouts WHERE week_start=?').all(start).map(r=>r.user_id));
        groups.forEach((group,index)=>{
          const players=this.db.prepare('SELECT a.user_id AS id,COUNT(*) AS games FROM game_activity a JOIN results r ON r.id=a.game_id WHERE r.group_id=? AND r.finished>=? AND r.finished<? AND r.qualified=1 GROUP BY a.user_id HAVING COUNT(*)>=3 ORDER BY games DESC,a.user_id').all(group.id,start,end).filter(p=>!rewarded.has(p.id));
          const reward=players.length?'coins':'no_active_players';
          const pool=index<3?1000:index<10?600:index<20?400:200;
          const inserted=this.db.prepare('INSERT OR IGNORE INTO group_boxes VALUES(?,?,?,?,?)').run(start,group.id,group.name,index+1,reward);
          if(!inserted.changes||!players.length)return;
          players.forEach((player,i)=>{
            rewarded.add(player.id);
            const coins=Math.floor(pool/players.length)+Number(i<pool%players.length);
            const card=0;
            this.inventory(player.id);
            this.db.prepare('UPDATE inventories SET coins=coins+?,active_role=active_role+? WHERE user_id=?').run(coins,card,player.id);
            this.db.prepare('INSERT INTO box_payouts VALUES(?,?,?,?,?)').run(start,group.id,player.id,coins,card);
          });
        });
      }
      this.db.prepare('UPDATE reward_state SET week_start=? WHERE id=1').run(current);
      this.db.exec('COMMIT');
    }catch(e){this.db.exec('ROLLBACK');throw e;}
  }
  weeklyRewards(id){return this.db.prepare('SELECT p.week_start AS weekStart,b.group_name AS groupName,b.rank,p.coins,p.active_role AS activeRole FROM box_payouts p JOIN group_boxes b ON b.week_start=p.week_start AND b.group_id=p.group_id WHERE p.user_id=? AND (p.coins>0 OR p.active_role>0) ORDER BY p.week_start DESC,b.rank LIMIT 20').all(id);}
  inventory(id) {this.db.prepare('INSERT OR IGNORE INTO inventories(user_id) VALUES(?)').run(id);return this.db.prepare('SELECT coins,protection,documents,active_role,pumpkin,candy FROM inventories WHERE user_id=?').get(id);}
  buyItem(id,item) {
    const prices={protection:100,documents:150,active_role:200,pumpkin:100,candy:30};if(!Object.hasOwn(prices,item))throw new Error('Buyum noto‘g‘ri');
    this.inventory(id);const result=this.db.prepare(`UPDATE inventories SET coins=coins-?,${item}=${item}+1 WHERE user_id=? AND coins>=?`).run(prices[item],id,prices[item]);if(!result.changes)throw new Error('Mablag‘ yetarli emas');return this.inventory(id);
  }
  groupCooldown(group,id) {return this.db.prepare('SELECT until_ms FROM group_cooldowns WHERE group_id=? AND user_id=?').get(group,id)?.until_ms || 0;}
  setGroupCooldown(group,id,until) {this.db.prepare('INSERT INTO group_cooldowns VALUES(?,?,?) ON CONFLICT(group_id,user_id) DO UPDATE SET until_ms=excluded.until_ms').run(group,id,until);}
  load() { return new Map(this.db.prepare('SELECT state FROM rooms').all().map(row => { const game = Game.restore(JSON.parse(row.state)); return [game.id, game]; })); }
  save(game) {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      this.db.prepare('INSERT INTO rooms VALUES(?,?) ON CONFLICT(id) DO UPDATE SET state=excluded.state').run(game.id, JSON.stringify(game.snapshot()));
      for(const p of game.players)for(const [item,n] of Object.entries(p.buffSpent||{})) {
        if(!['protection','documents','active_role','pumpkin','candy'].includes(item))continue;
        const old=this.db.prepare('SELECT quantity FROM buff_spending WHERE game_id=? AND user_id=? AND item=?').get(game.id,p.id,item)?.quantity||0;
        if(n>old){this.db.prepare(`UPDATE inventories SET ${item}=MAX(0,${item}-?) WHERE user_id=?`).run(n-old,p.id);this.db.prepare('INSERT INTO buff_spending VALUES(?,?,?,?) ON CONFLICT(game_id,user_id,item) DO UPDATE SET quantity=excluded.quantity').run(game.id,p.id,item,n);}
      }
      if (game.phase === 'finished') this.recordResult(game);
      this.db.exec('COMMIT');
    } catch (e) { this.db.exec('ROLLBACK'); throw e; }
  }
  recordResult(game) {
    if (this.db.prepare('SELECT id FROM results WHERE id=?').get(game.id)) return;
    const ended = game.finishedAt, day = periodStart('day', ended);
    const roster = createHash('sha256').update(game.players.map(p => p.id).sort().join(',')).digest('hex');
    const repeated = this.db.prepare('SELECT id FROM results WHERE roster=? AND finished>=? AND qualified=1').get(roster, day);
    const groupToday = game.group ? this.db.prepare('SELECT COALESCE(SUM(points),0) n FROM results WHERE group_id=? AND finished>=? AND qualified=1').get(game.group.id, day).n : 0;
    const qualified = ['citizens', 'mafia', 'maniac', 'suicide'].includes(game.winner) && ended - game.startedAt >= 180000 && game.players.length >= 6 && game.activity.size >= Math.ceil(game.players.length / 2);
    const earnedGroupPoints = qualified ? Math.floor((10 + game.players.length) * (repeated ? 0.5 : 1)) : 0;
    const groupPoints = game.group ? Math.min(earnedGroupPoints, Math.max(0, 100 - groupToday)) : earnedGroupPoints;
    this.db.prepare('INSERT INTO results VALUES(?,?,?,?,?,?,?)').run(game.id, ended, game.group?.id ?? null, game.group?.name ?? null, roster, Number(qualified), groupPoints);
    for (const p of game.players) {
      if(qualified && game.activity.has(p.id))this.db.prepare('INSERT OR IGNORE INTO game_activity VALUES(?,?)').run(game.id,p.id);
      const count = this.db.prepare('SELECT COUNT(*) n FROM scores s JOIN results r ON r.id=s.game_id WHERE s.user_id=? AND r.finished>=? AND s.points>0').get(p.id, day).n;
      const won = (p.role==='suicide' && p.suicideWon && ['mafia','citizens'].includes(game.winner)) || (['don', 'mafia', 'lawyer'].includes(p.role) ? 'mafia' : ['maniac', 'suicide'].includes(p.role) ? p.role : 'citizens') === game.winner;
      const points = qualified && !repeated && game.activity.has(p.id) && count < 5 ? (won ? (p.alive ? 10 : 5) : 1) : 0;
      if (points > 0) {
        this.inventory(p.id);
        this.db.prepare('UPDATE inventories SET coins=coins+? WHERE user_id=?').run(points, p.id);
        this.rewardReferral(p.id,game.id);
      }
      this.db.prepare('INSERT INTO scores VALUES(?,?,?,?,?)').run(game.id, p.id, p.name, points, Number(won));
    }
  }
  remove(id) { this.db.prepare('DELETE FROM rooms WHERE id=?').run(id); }
  rankings(period = 'week', now = Date.now()) {
    const start = periodStart(period, now);
    return {
      groups: this.db.prepare(`WITH totals AS (SELECT group_id id,MAX(group_name) name,SUM(points) points,COUNT(*) games FROM results WHERE finished>=? AND group_id IS NOT NULL AND qualified=1 GROUP BY group_id), ids AS (SELECT id FROM totals UNION SELECT group_id FROM registered_groups WHERE active=1) SELECT ids.id,COALESCE(g.name,t.name,'Guruh') name,COALESCE(t.points,0) points,COALESCE(t.games,0) games FROM ids LEFT JOIN totals t ON t.id=ids.id LEFT JOIN managed_groups g ON g.id=ids.id LEFT JOIN registered_groups rg ON rg.group_id=ids.id WHERE COALESCE(rg.active,1)=1 ORDER BY points DESC,games DESC,ids.id LIMIT 100`).all(start),
      players: this.db.prepare(`WITH totals AS (SELECT s.user_id id,MAX(s.name) name,SUM(s.points) points,COUNT(*) games,SUM(won) wins FROM scores s JOIN results r ON r.id=s.game_id WHERE r.finished>=? AND s.points>0 GROUP BY s.user_id), ids AS (SELECT id FROM totals UNION SELECT user_id FROM bot_users) SELECT ids.id,COALESCE(d.name,t.name,'Öyinçi') name,COALESCE(t.points,0) points,COALESCE(t.games,0) games,COALESCE(t.wins,0) wins FROM ids LEFT JOIN totals t ON t.id=ids.id LEFT JOIN user_directory d ON d.user_id=ids.id ORDER BY points DESC,wins DESC,ids.id LIMIT 100`).all(start)
    };
  }
  profile(id) {
    return this.db.prepare(`SELECT COUNT(*) AS games, COALESCE(SUM(won),0) AS wins, COALESCE(SUM(points),0) AS points FROM scores WHERE user_id=? AND points>0`).get(id);
  }
  managedGroups(userId) { return this.db.prepare('SELECT g.* FROM managed_groups g JOIN group_admins a ON a.group_id=g.id WHERE a.user_id=?').all(userId).map(g=>({...g,settings:JSON.parse(g.settings)})); }
  groupSettings(id) { const row=this.db.prepare('SELECT settings FROM managed_groups WHERE id=?').get(id); return row?JSON.parse(row.settings):{}; }
  manageGroup(group,userId,settings=this.groupSettings(group.id)) {
    this.db.prepare('INSERT INTO managed_groups VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,settings=excluded.settings').run(group.id,group.name,JSON.stringify(settings));
    this.db.prepare('INSERT OR REPLACE INTO registered_groups VALUES(?,1)').run(group.id);
    this.db.prepare('INSERT OR IGNORE INTO group_admins VALUES(?,?)').run(group.id,userId);
    return {...group,settings};
  }
  update(id) { return this.db.prepare('SELECT * FROM updates WHERE id=?').get(id); }
  rememberUpdate(id, roomId = null) { this.db.prepare('INSERT OR IGNORE INTO updates(id,room_id) VALUES(?,?)').run(id, roomId); }
  sent(id) { this.db.prepare('UPDATE updates SET sent=1 WHERE id=?').run(id); }
  close() { this.db.close(); }
}
