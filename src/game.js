import { randomInt, randomUUID } from 'node:crypto';

export class GameError extends Error {}
const requireThat = (condition, message) => { if (!condition) throw new GameError(message); };
export const DEFAULT_RULES = Object.freeze({ minPlayers: 6, maxPlayers: 12, nightMs: 45000, discussionMs: 90000, votingMs: 30000 });
function uniqueLeader(values) {
  const counts = new Map();
  for (const value of values) counts.set(value, (counts.get(value) || 0) + 1);
  const sorted = [...counts].sort((a, b) => b[1] - a[1]);
  return sorted.length && (sorted.length === 1 || sorted[0][1] > sorted[1][1]) ? sorted[0][0] : null;
}

export class Game {
  constructor(owner, { rules = {}, group = null, now = Date.now, pick = randomInt } = {}) {
    this.rules = { ...DEFAULT_RULES, ...rules };
    requireThat(Number.isInteger(this.rules.minPlayers) && this.rules.minPlayers >= 6, 'Kamida 6 o‘yinchi kerak');
    requireThat(Number.isInteger(this.rules.maxPlayers) && this.rules.maxPlayers >= this.rules.minPlayers && this.rules.maxPlayers <= 12, 'O‘yinchilar chegarasi noto‘g‘ri');
    for (const key of ['nightMs', 'discussionMs', 'votingMs']) requireThat(Number.isInteger(this.rules[key]) && this.rules[key] >= 1000 && this.rules[key] <= 600000, 'Taymer noto‘g‘ri');
    this.id = randomUUID(); this.ownerId = owner.id; this.group = group;
    this.now = now; this.pick = pick; this.phase = 'lobby'; this.round = 0;
    this.players = []; this.actions = new Map(); this.votes = new Map(); this.reports = new Map();
    this.deadline = null; this.winner = null; this.lastResult = null; this.revision = 0;
    this.createdAt = now(); this.updatedAt = now(); this.startedAt = null; this.finishedAt = null; this.activity = new Set(); this.join(owner);
  }
  touch() { this.revision++; this.updatedAt = this.now(); }
  member(id) { const p = this.players.find(p => p.id === id); requireThat(p, 'Xonaga a’zo emassiz'); return p; }
  alive(id) { const p = this.member(id); requireThat(p.alive, 'Siz o‘yindan chiqqansiz'); return p; }
  join(user) {
    requireThat(user && typeof user.id === 'string' && user.id.length > 0 && typeof user.name === 'string', 'Foydalanuvchi noto‘g‘ri');
    if (this.players.some(p => p.id === user.id)) return;
    requireThat(this.phase === 'lobby', 'O‘yin boshlangan');
    requireThat(this.players.length < this.rules.maxPlayers, 'Xona to‘lgan');
    this.players.push({ id: user.id, name: user.name.slice(0, 80), alive: true, role: null }); this.touch();
  }
  leave(id) {
    this.member(id); requireThat(this.phase === 'lobby', 'Boshlangan o‘yinni tark etib qayta qo‘shilib bo‘lmaydi');
    this.players = this.players.filter(p => p.id !== id);
    if (this.ownerId === id) this.ownerId = this.players[0]?.id ?? null;
    this.touch();
  }
  start(id) {
    requireThat(id === this.ownerId, 'Faqat xona egasi boshlaydi');
    requireThat(this.phase === 'lobby', 'O‘yin boshlangan');
    requireThat(this.players.length >= this.rules.minPlayers, 'Kamida 6 o‘yinchi kerak');
    const roles = Array(Math.floor(this.players.length / 3)).fill('mafia');
    roles.push('detective', 'doctor');
    while (roles.length < this.players.length) roles.push('citizen');
    for (let i = roles.length - 1; i > 0; i--) { const j = this.pick(i + 1); [roles[i], roles[j]] = [roles[j], roles[i]]; }
    this.players.forEach((p, i) => p.role = roles[i]); this.startedAt = this.now(); this.round = 1; this.setPhase('night');
  }
  setPhase(phase) {
    this.phase = phase;
    if (phase === 'finished') this.finishedAt = this.now();
    this.deadline = phase === 'finished' ? null : this.now() + this.rules[`${phase}Ms`];
    this.touch();
  }
  nightAction(id, targetId, revision) {
    this.tick(); requireThat(this.phase === 'night', 'Hozir tun emas');
    requireThat(revision === this.revision, 'Holat yangilangan, qayta urinib ko‘ring');
    const actor = this.alive(id), target = this.alive(targetId);
    requireThat(actor.role !== 'citizen', 'Tinch aholi tunda harakat qilmaydi');
    requireThat(!this.actions.has(id), 'Harakat allaqachon yuborilgan');
    if (actor.role === 'mafia') requireThat(target.role !== 'mafia', 'Mafiyani nishonga olib bo‘lmaydi');
    if (actor.role === 'detective') requireThat(id !== targetId, 'O‘zingizni tekshira olmaysiz');
    this.actions.set(id, targetId);
    this.activity.add(id);
    // Do not change public revision for private actions: this would leak activity.
  }
  vote(id, targetId, revision) {
    this.tick(); requireThat(this.phase === 'voting', 'Hozir ovoz berish vaqti emas');
    requireThat(revision === this.revision, 'Holat yangilangan, qayta urinib ko‘ring');
    this.alive(id); this.alive(targetId); requireThat(id !== targetId, 'O‘zingizga ovoz bera olmaysiz');
    requireThat(!this.votes.has(id), 'Ovoz allaqachon berilgan'); this.votes.set(id, targetId); this.activity.add(id);
  }
  checkWinner() {
    const alive = this.players.filter(p => p.alive), mafia = alive.filter(p => p.role === 'mafia').length;
    this.winner = mafia === 0 ? 'citizens' : mafia >= alive.length - mafia ? 'mafia' : null;
    if (this.winner) this.setPhase('finished');
    return Boolean(this.winner);
  }
  tick() {
    if (this.deadline === null || this.now() < this.deadline) return false;
    if (this.startedAt !== null && this.now() - this.startedAt > 7200000) {
      this.winner = 'draw'; this.setPhase('finished'); return true;
    }
    if (this.phase === 'night') {
      const mafiaTargets = [], saved = new Set();
      for (const [id, targetId] of this.actions) {
        const actor = this.member(id);
        if (actor.role === 'mafia') mafiaTargets.push(targetId);
        if (actor.role === 'doctor') saved.add(targetId);
        if (actor.role === 'detective') {
          const reports = this.reports.get(id) || [];
          reports.push({ round: this.round, targetId, isMafia: this.member(targetId).role === 'mafia' });
          this.reports.set(id, reports);
        }
      }
      const target = uniqueLeader(mafiaTargets);
      const eliminated = target && !saved.has(target) ? target : null;
      if (eliminated) this.member(eliminated).alive = false;
      this.lastResult = { phase: 'night', eliminated }; this.actions.clear();
      if (!this.checkWinner()) this.setPhase('discussion');
    } else if (this.phase === 'discussion') { this.votes.clear(); this.setPhase('voting'); }
    else if (this.phase === 'voting') {
      const eliminated = uniqueLeader([...this.votes.values()]);
      if (eliminated) this.member(eliminated).alive = false;
      this.lastResult = { phase: 'voting', eliminated }; this.votes.clear();
      if (!this.checkWinner()) { this.round++; this.setPhase('night'); }
    }
    return true;
  }
  view(id) {
    const me = this.member(id);
    return {
      id: this.id, ownerId: this.ownerId, group: this.group, phase: this.phase, round: this.round,
      revision: this.revision, deadline: this.deadline, serverTime: this.now(), rules: { ...this.rules },
      winner: this.winner, lastResult: this.lastResult,
      players: this.players.map(p => ({ id: p.id, name: p.name, alive: p.alive, ...(this.phase === 'finished' ? { role: p.role } : {}) })),
      me: { id, role: me.role, alive: me.alive, actionSubmitted: this.actions.has(id), voteSubmitted: this.votes.has(id),
        reports: this.reports.get(id) || [],
        teammates: me.role === 'mafia' ? this.players.filter(p => p.role === 'mafia' && p.id !== id).map(p => p.id) : [] },
      voice: { enabled: this.phase === 'discussion' && me.alive, transport: 'not-configured' }
    };
  }
  snapshot() {
    const { now, pick, ...state } = this;
    return { ...state, actions: [...this.actions], votes: [...this.votes], reports: [...this.reports], activity: [...this.activity] };
  }
  static restore(state, now = Date.now) {
    const game = Object.create(Game.prototype);
    Object.assign(game, state, { now, pick: randomInt, actions: new Map(state.actions), votes: new Map(state.votes), reports: new Map(state.reports), activity: new Set(state.activity || []) });
    return game;
  }
}
