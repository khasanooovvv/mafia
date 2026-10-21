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
      CREATE TABLE IF NOT EXISTS updates(id INTEGER PRIMARY KEY, room_id TEXT, sent INTEGER NOT NULL DEFAULT 0);
    `);
  }
  load() { return new Map(this.db.prepare('SELECT state FROM rooms').all().map(row => { const game = Game.restore(JSON.parse(row.state)); return [game.id, game]; })); }
  save(game) {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      this.db.prepare('INSERT INTO rooms VALUES(?,?) ON CONFLICT(id) DO UPDATE SET state=excluded.state').run(game.id, JSON.stringify(game.snapshot()));
      if (game.phase === 'finished') this.recordResult(game);
      this.db.exec('COMMIT');
    } catch (e) { this.db.exec('ROLLBACK'); throw e; }
  }
  recordResult(game) {
    if (this.db.prepare('SELECT id FROM results WHERE id=?').get(game.id)) return;
    const ended = game.finishedAt, day = periodStart('day', ended);
    const roster = createHash('sha256').update(game.players.map(p => p.id).sort().join(',')).digest('hex');
    const repeated = this.db.prepare('SELECT id FROM results WHERE roster=? AND finished>=? AND qualified=1').get(roster, day);
    const groupToday = game.group ? this.db.prepare('SELECT COUNT(*) n FROM results WHERE group_id=? AND finished>=? AND qualified=1').get(game.group.id, day).n : 0;
    const qualified = ['citizens', 'mafia'].includes(game.winner) && ended - game.startedAt >= 180000 && game.players.length >= 6 && game.activity.size >= Math.ceil(game.players.length / 2) && !repeated && groupToday < 5;
    this.db.prepare('INSERT INTO results VALUES(?,?,?,?,?,?,?)').run(game.id, ended, game.group?.id ?? null, game.group?.name ?? null, roster, Number(qualified), qualified ? 10 + game.players.length : 0);
    for (const p of game.players) {
      const count = this.db.prepare('SELECT COUNT(*) n FROM scores s JOIN results r ON r.id=s.game_id WHERE s.user_id=? AND r.finished>=? AND s.points>0').get(p.id, day).n;
      const won = (p.role === 'mafia' ? 'mafia' : 'citizens') === game.winner;
      const points = qualified && game.activity.has(p.id) && count < 5 ? 1 + (won ? 3 : 0) : 0;
      this.db.prepare('INSERT INTO scores VALUES(?,?,?,?,?)').run(game.id, p.id, p.name, points, Number(won));
    }
  }
  remove(id) { this.db.prepare('DELETE FROM rooms WHERE id=?').run(id); }
  rankings(period = 'week', now = Date.now()) {
    const start = periodStart(period, now);
    return {
      groups: this.db.prepare(`SELECT group_id AS id, MAX(group_name) AS name, SUM(points) AS points, COUNT(*) AS games FROM results WHERE finished>=? AND group_id IS NOT NULL AND qualified=1 GROUP BY group_id ORDER BY points DESC, games DESC, id LIMIT 50`).all(start),
      players: this.db.prepare(`SELECT user_id AS id, MAX(name) AS name, SUM(s.points) AS points, COUNT(*) AS games, SUM(won) AS wins FROM scores s JOIN results r ON s.game_id=r.id WHERE r.finished>=? AND s.points>0 GROUP BY user_id ORDER BY points DESC, wins DESC, id LIMIT 50`).all(start)
    };
  }
  profile(id) {
    return this.db.prepare(`SELECT COUNT(*) AS games, COALESCE(SUM(won),0) AS wins, COALESCE(SUM(points),0) AS points FROM scores WHERE user_id=?`).get(id);
  }
  update(id) { return this.db.prepare('SELECT * FROM updates WHERE id=?').get(id); }
  rememberUpdate(id, roomId = null) { this.db.prepare('INSERT OR IGNORE INTO updates(id,room_id) VALUES(?,?)').run(id, roomId); }
  sent(id) { this.db.prepare('UPDATE updates SET sent=1 WHERE id=?').run(id); }
  close() { this.db.close(); }
}
