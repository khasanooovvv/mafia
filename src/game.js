import { nightNarrative } from './night-narrative.js';
import { ADVANCED_DEFAULTS, ROLE_ORDER } from './settings.js';
import { randomInt, randomUUID } from 'node:crypto';

export class GameError extends Error {}
const requireThat = (condition, message) => { if (!condition) throw new GameError(message); };
export const DEFAULT_RULES = Object.freeze({ minPlayers: 6, maxPlayers: 20, nightMs: 45000, discussionMs: 90000, votingMs: 45000, confirmationMs: 30000 });
const MAFIA = new Set(['don', 'mafia', 'lawyer']);
const SOLO = new Set(['maniac', 'suicide']);
const TEAM = role => MAFIA.has(role) ? 'mafia' : SOLO.has(role) ? role : 'citizens';
const isDon = player => player.role === 'don' || (player.role === 'mafia' && player.office === 'don');
const roleOf = player => isDon(player) ? 'don' : player.role;
function uniqueLeader(values) {
  const counts = new Map();
  for (const value of values) counts.set(value, (counts.get(value) || 0) + 1);
  const sorted = [...counts].sort((a, b) => b[1] - a[1]);
  return sorted.length && (sorted.length === 1 || sorted[0][1] > sorted[1][1]) ? sorted[0][0] : null;
}
export const OPTIONAL_ROLES = ['don','commissioner','doctor','lucky','suicide','kamikaze','hobo','mistress','sergeant','bodyguard','maniac','lawyer','mayor','journalist'];
export const EXTRA_RULES = Object.freeze(ADVANCED_DEFAULTS);
function assignRoles(count, enabled, rules) {
  const roles = Array(Math.floor(count / rules.mafiaDivisor)).fill('mafia');
  const threshold = { doctor: 6, commissioner: 6, lucky: 7, suicide: 8, kamikaze: 8, hobo: 10, mistress: 12, sergeant: 14, bodyguard: 14, maniac: 16, lawyer: 18, mayor: 18, journalist: 20 };
  const slots = ROLE_ORDER.filter(r=>count >= threshold[r]).length;
  roles.push(...rules.roleOrder.filter(r=>enabled.includes(r)).slice(0,slots));
  while (roles.length < count) roles.push('citizen');
  return roles.slice(0, count);
}

export class Game {
  constructor(owner, { rules = {}, group = null, now = Date.now, pick = randomInt } = {}) {
    this.rules = { ...DEFAULT_RULES, ...EXTRA_RULES, ...rules, roleOrder:[...(rules.roleOrder || ROLE_ORDER)], enabledRoles: [...(rules.enabledRoles || OPTIONAL_ROLES)] };
    requireThat(Number.isInteger(this.rules.minPlayers) && this.rules.minPlayers >= 6, 'Kamida 6 öyinçi kerak');
    requireThat(Number.isInteger(this.rules.maxPlayers) && this.rules.maxPlayers >= this.rules.minPlayers && this.rules.maxPlayers <= 20, 'Öyinçilar çegarasi notöğri');
    for (const key of ['nightMs', 'discussionMs', 'votingMs', 'confirmationMs']) requireThat(Number.isInteger(this.rules[key]) && this.rules[key] >= 1000 && this.rules[key] <= 600000, 'Taymer notöğri');
    this.id = randomUUID(); this.ownerId = owner.id; this.group = group;
    this.now = now; this.pick = pick; this.phase = 'lobby'; this.round = 0;
    this.players = []; this.actions = new Map(); this.votes = new Map(); this.confirmations = new Map(); this.reports = new Map(); this.pendingExecution = null; this.sergeantId = null;
    this.luckyUsed = new Set(); this.doctorSelfSaveUsed = new Set(); this.lastBodyguardTarget = new Map(); this.lastHoboTarget = new Map();
    this.pendingKamikaze = null; this.pendingKamikazeChooser = null; this.deadline = null; this.winner = null; this.lastResult = null; this.revision = 0;
    this.createdAt = now(); this.updatedAt = now(); this.startedAt = null; this.finishedAt = null; this.activity = new Set(); this.join(owner);
  }
  touch() { this.revision++; this.updatedAt = this.now(); }
  member(id) { const p = this.players.find(p => p.id === id); requireThat(p, 'Xonaga a’zo emassiz'); return p; }
  alive(id) { const p = this.member(id); requireThat(p.alive, 'Siz öyindan çiqqansiz'); return p; }
  join(user) {
    requireThat(user && typeof user.id === 'string' && user.id.length > 0 && typeof user.name === 'string', 'Foydalanuvçi notöğri');
    const existing = this.players.find(p => p.id === user.id);
    if (existing) { existing.name = user.name.slice(0, 80); existing.username = user.username ?? null; existing.photoUrl = user.photoUrl ?? null; this.touch(); return; }
    requireThat(this.phase === 'lobby', 'Öyin boşlangan');
    requireThat(this.players.length < this.rules.maxPlayers, 'Xona tölgan');
    this.players.push({ id: user.id, name: user.name.slice(0, 80), username: user.username ?? null, photoUrl: user.photoUrl ?? null, alive: true, role: null, office: null }); this.touch();
  }
  leave(id) {
    this.member(id); requireThat(this.phase === 'lobby', 'Boşlangan öyinni tark etib qayta qöşilib bölmaydi');
    this.players = this.players.filter(p => p.id !== id);
    if (this.ownerId === id) this.ownerId = this.players[0]?.id ?? null;
    this.touch();
  }
  start(id) {
    requireThat(!this.rules.adminOnlyStart || id === this.ownerId, 'Faqat xona egasi yoki guruh administratori boşlaydi');
    requireThat(this.phase === 'lobby', 'Öyin boşlangan');
    requireThat(this.players.length >= this.rules.minPlayers, 'Kamida 6 öyinçi kerak');
    const roles = assignRoles(this.players.length, this.rules.enabledRoles, this.rules);
    for (let i = roles.length - 1; i > 0; i--) { const j = this.pick(i + 1); [roles[i], roles[j]] = [roles[j], roles[i]]; }
    this.players.forEach((p, i) => { p.role = roles[i]; p.office = null; });
    if(this.rules.enableBuffs)for(const p of this.players.filter(p=>p.buffs?.active_role>0)){
      if(['citizen','suicide','lucky','kamikaze','sergeant','mayor'].includes(p.role)){const other=this.players.find(o=>o!==p&&!(o.buffs?.active_role>0)&&!['citizen','suicide','lucky','kamikaze','sergeant','mayor'].includes(o.role));if(other)[p.role,other.role]=[other.role,p.role];}
      if(!['citizen','suicide','lucky','kamikaze','sergeant','mayor'].includes(p.role))this.spendBuff(p,'active_role');
    }
    const don = this.players.find(p => p.role === 'mafia'); if (don && this.rules.enabledRoles.includes('don')) don.office = 'don';
    this.sergeantId = this.players.find(p => p.role === 'sergeant')?.id ?? null;
    this.promoteSergeant(); this.startedAt = this.now(); this.round = 1; this.setPhase('night');
  }
  spendBuff(player,item) {if((player.buffs?.[item]||0)<=0)return false;player.buffs[item]--;player.buffSpent ||= {};player.buffSpent[item]=(player.buffSpent[item]||0)+1;return true;}
  setPhase(phase) {
    this.phase = phase;
    if (phase === 'finished') this.finishedAt = this.now();
    this.deadline = phase === 'finished' ? null : this.now() + this.rules[`${phase}Ms`];
    this.touch();
  }
  promoteSergeant() {
    if (!this.players.some(p => p.alive && p.role === 'commissioner')) {
      const sergeant = this.players.find(p => p.alive && p.role === 'sergeant');
      if (sergeant) sergeant.role = 'commissioner';
    }
  }
  promoteDon() {
    if (!this.rules.enabledRoles.includes('don')) return;
    if (!this.players.some(p => p.alive && isDon(p))) {
      const successors = this.players.filter(p => p.alive && p.role === 'mafia');
      if (successors.length) successors[this.pick(successors.length)].office = 'don';
    }
  }
  nightAction(id, input, revision) {
    this.tick(); requireThat(this.phase === 'night', 'Hozir tun emas');
    requireThat(revision === this.revision, 'Holat yangilangan, qayta urinib köring');
    const actor = this.alive(id); requireThat(!this.actions.has(id), 'Harakat allaqachon yuborilgan');
    const action = typeof input === 'string' ? { targetId: input } : input;
    requireThat(action && typeof action === 'object', 'Nişon notöğri');
    const role = actor.role;
    if (action.skip === true) {
      requireThat(this.rules.skipNight && !['citizen','sergeant','lucky','suicide','kamikaze','mayor'].includes(role), 'Tungi harakatni ötkaziş yopiq');
      this.actions.set(id,{targetIds:[],mode:null,skip:true}); this.activity.add(id); return;
    }
    const targets = role === 'journalist' ? action.targetIds : [action.targetId];
    const pumpkin = role==='citizen' && this.rules.halloween && actor.buffs?.pumpkin>0;
    const requiredTargets = role === 'journalist' ? 2 : ['citizen','sergeant','lucky','suicide','kamikaze','mayor'].includes(role) && !pumpkin ? 0 : 1;
    if(pumpkin)requireThat(id!==action.targetId,'Özingizni tanlay olmaysiz');
    if (requiredTargets === 0) throw new GameError('Bu rol tunda harakat qilmaydi');
    requireThat(Array.isArray(targets) && targets.length === requiredTargets, 'Kerakli öyinçini tanlang');
    for (const targetId of targets) this.alive(targetId);
    if (role === 'journalist') requireThat(new Set(targets).size === 2 && !targets.includes(id), 'Ikki boşqa tirik öyinçini tanlang');
    else if (role === 'commissioner') {
      action.mode ||= 'check';
      requireThat(['check', 'kill'].includes(action.mode), 'Tekşiriş yoki otişni tanlang');
      if(action.mode==='kill') requireThat(this.rules.commissionerShoot && (this.round>1 || this.rules.firstNightShoot), 'Komissarning otişi bu tunda yopiq');
      requireThat(id !== action.targetId, 'Özingizni tanlay olmaysiz');
    } else if (role === 'don' || role === 'mafia' || role === 'lawyer' || role === 'maniac') {
      requireThat(id !== action.targetId, 'Özingizni nişonga olmaysiz');
      if (action.mode==='search') requireThat(isDon(actor) && this.rules.donSearch, 'Don qidiruvi yopiq');
      if (['don', 'mafia'].includes(role) && !this.rules.friendlyFire) requireThat(!['don','mafia'].includes(roleOf(this.member(action.targetId))), 'Mafiya a’zosini nişonga olib bölmaydi');
    } else if (role === 'doctor') {
      if(this.rules.doctorNoRepeat) requireThat(this.lastDoctorTarget?.[id] !== action.targetId, 'Keçagi odamni qayta davolay olmaysiz');
      if (id === action.targetId) requireThat(!this.doctorSelfSaveUsed.has(id), 'Özingizni faqat bir marta qutqara olasiz');
    } else if (role === 'bodyguard') {
      requireThat(id !== action.targetId && this.lastBodyguardTarget.get(id) !== action.targetId, 'Özingizni yoki keçagi nişonni qöriqlay olmaysiz');
    } else if (role === 'hobo') {
      requireThat(this.lastHoboTarget.get(id) !== action.targetId, 'Ketma-ket keçalarda bir nişonni kuzata olmaysiz');
    } else if (role === 'mistress') requireThat(id !== action.targetId, 'Özingizni tanlay olmaysiz');
    this.actions.set(id, { targetIds: [...targets], mode: action.mode || null });
    this.activity.add(id);
  }
  vote(id, input, revision) {
    this.tick(); requireThat(['voting','confirmation'].includes(this.phase), 'Hozir ovoz beriş vaqti emas');
    requireThat(revision === this.revision, 'Holat yangilangan, qayta urinib köring');
    const actor = this.alive(id), action = typeof input === 'string' ? { targetId: input } : input;
    if (this.phase === 'confirmation') {
      requireThat(typeof action?.confirm === 'boolean', 'Hukmni tasdiqlang yoki rad eting');
      requireThat(!this.confirmations.has(id), 'Tasdiq ovozi allaqachon berilgan'); this.confirmations.set(id, action.confirm);
    } else {
      const targetId = action?.skip === true ? null : action?.targetId;
      if (action?.skip === true) requireThat(this.rules.skipVoting, 'Ovozni ötkaziş yopiq');
      else this.alive(targetId); requireThat(id !== targetId, 'Özingizga ovoz bera olmaysiz');
      requireThat(!this.votes.has(id), 'Ovoz allaqachon berilgan'); this.votes.set(id, targetId);
    }
    this.activity.add(id);
  }
  lastWords(id,text){
    this.tick();const p=this.member(id);
    requireThat(!p.alive&&this.phase==='discussion'&&this.lastResult?.phase==='night','Oxirgi söz faqat halok bölgan tongda yoziladi');
    const event=this.lastResult.events.find(e=>e.type==='eliminated'&&e.id===id&&e.lastWordsAllowed);
    requireThat(event&&!event.lastWords,'Oxirgi sözni bir marta yoziş mumkin');
    requireThat(typeof text==='string'&&text.trim().length>0&&text.length<=200,'Xabar 1–200 belgidan iborat bölsin');
    event.lastWords=text.trim();this.touch();
  }
  chatChannel(id) {
    if(this.deadline!==null && this.now()>=this.deadline)return null;
    const player=this.member(id);
    if(!player.alive)return null;
    if(this.phase==='discussion')return 'discussion';
    if(this.phase==='night' && ['don','mafia'].includes(player.role))return 'mafia';
    return null;
  }
  chatView(id) {
    const channel=this.chatChannel(id);
    return {channel, ...(channel==='discussion' && this.rules.blockMistress && this.mistressBlocked?.includes(id)?{muted:true}:{}), messages:channel?(this.chatMessages||[]).filter(m=>m.channel===channel && m.round===this.round).map(({id,userId,name,text,at})=>({id,userId,name,text,at})):[]};
  }
  sendChat(id, input) {
    this.tick();
    const channel=this.chatChannel(id);requireThat(channel,'Bu bosqiçda çat sizga yopiq');
    requireThat(!(channel==='discussion' && this.rules.blockMistress && this.mistressBlocked?.includes(id)), 'Ma’şuqa ta’sirida bu muhokamada yoza olmaysiz');
    requireThat(typeof input==='string' && input.trim().length>0 && input.length<=500,'Xabar 1–500 belgidan iborat bölsin');
    const text=input.trim().replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g,'');
    requireThat(text.length>0,'Xabar böş');
    const recent=(this.chatMessages||[]).findLast(m=>m.userId===id);
    requireThat(!recent || this.now()-recent.at>=1000,'Xabarlar orasida bir soniya kuting');
    const message={id:randomUUID(),userId:id,name:this.member(id).name,text,channel,round:this.round,at:this.now()};
    this.chatMessages=[...(this.chatMessages||[]),message].slice(-200);this.activity.add(id);
  }
  kamikazeAction(id, targetId, revision) {
    this.tick(); requireThat(this.phase === 'night' && this.pendingKamikazeChooser === id, 'Hozir qasos nişonini tanlay olmaysiz');
    requireThat(revision === this.revision, 'Holat yangilangan, qayta urinib köring');
    const actor = this.member(id); requireThat(!actor.alive && actor.role === 'kamikaze', 'Bu harakat faqat kamikadze uçun');
    const target = this.alive(targetId); requireThat(targetId !== id, 'Özingizni tanlay olmaysiz');
    this.pendingKamikaze = target.id; this.pendingKamikazeChooser = null; this.activity.add(id);
  }
  checkWinner() {
    const alive = this.players.filter(p => p.alive), mafia = alive.filter(p => MAFIA.has(p.role)).length;
    const maniac = alive.filter(p => p.role === 'maniac').length;
    if (maniac && alive.length === 1) this.winner = 'maniac';
    else if (mafia === 0 && maniac === 0) this.winner = 'citizens';
    else if (mafia && mafia >= alive.length - mafia) this.winner = 'mafia';
    else this.winner = null;
    if (this.winner) this.setPhase('finished');
    return Boolean(this.winner);
  }
  eliminate(id) {
    const player = this.players.find(p => p.id === id && p.alive);
    if (!player) return null;
    player.alive = false;
    if (player.role === 'commissioner') this.promoteSergeant();
    if (isDon(player)) this.promoteDon();
    return player;
  }
  tick() {
    if (this.deadline === null || this.now() < this.deadline) return false;
    if (this.startedAt !== null && this.now() - this.startedAt > 7200000) { this.winner = 'draw'; this.setPhase('finished'); return true; }
    if (this.phase === 'night') {
      const getTarget = id => this.actions.get(id)?.targetIds?.[0];
      const attackTargets = [], protectedByDoctor = new Set(), protectedByGuard = new Map(), blocked = new Set();
      for (const player of this.players.filter(p => p.alive && p.role === 'mistress')) {
        const target = getTarget(player.id); if (target) blocked.add(target);
      }
      for (const lover of this.players.filter(p => p.alive && p.role === 'mistress')) {
        const hit = this.players.some(p => p.alive && !blocked.has(p.id) && ((['mafia','don'].includes(roleOf(p)) && getTarget(p.id) === lover.id) || (p.role === 'maniac' && getTarget(p.id) === lover.id) || (p.role === 'commissioner' && this.actions.get(p.id)?.mode === 'kill' && getTarget(p.id) === lover.id)));
        const saved = this.players.some(p => p.alive && p.role === 'doctor' && getTarget(p.id) === lover.id) || this.players.some(p => p.alive && p.role === 'bodyguard' && getTarget(p.id) === lover.id);
        if (hit && !saved) blocked.delete(getTarget(lover.id));
      }
      for (const player of this.players.filter(p => p.alive)) {
        const target = getTarget(player.id), action = this.actions.get(player.id); if (!target || blocked.has(player.id)) continue;
        if ((player.role === 'mafia' || isDon(player)) && action.mode!=='search') attackTargets.push({ target, actor: player.id, type: 'mafia' });
        if(player.role==='citizen' && this.rules.halloween && this.spendBuff(player,'pumpkin')) attackTargets.push({target,actor:player.id,type:'pumpkin'});
        if (player.role === 'maniac') attackTargets.push({ target, actor: player.id, type: 'maniac' });
        if (player.role === 'commissioner' && action.mode === 'kill') attackTargets.push({ target, actor: player.id, type: 'commissioner' });
        if (player.role === 'doctor') { (this.lastDoctorTarget ||= {})[player.id]=target; protectedByDoctor.add(target); if (target === player.id) this.doctorSelfSaveUsed.add(player.id); }
        if (player.role === 'bodyguard') { protectedByGuard.set(target, player.id); this.lastBodyguardTarget.set(player.id, target); }
        if (player.role === 'hobo') this.lastHoboTarget.set(player.id, target);
      }
      for (const incident of attackTargets) if (incident.type === 'mafia') {
        const lawyer = this.players.find(p => p.alive && p.role === 'lawyer');
        if (lawyer && !blocked.has(lawyer.id) && getTarget(lawyer.id) === incident.target) incident.disguised = true;
      }
      const mafiaVotes = attackTargets.filter(a => a.type === 'mafia'), don = this.players.find(p => p.alive && isDon(p) && !blocked.has(p.id));
      const mafiaTarget = don && this.actions.get(don.id)?.mode!=='search' && getTarget(don.id) ? getTarget(don.id) : uniqueLeader(mafiaVotes.map(a => a.target));
      const attacks = [...attackTargets.filter(a => a.type !== 'mafia')];
      if (mafiaTarget) attacks.push({ target: mafiaTarget, actor:(don && getTarget(don.id)===mafiaTarget && this.actions.get(don.id)?.mode!=='search' ? don.id : mafiaVotes.find(a=>a.target===mafiaTarget)?.actor), type: 'mafia', disguised: attackTargets.some(a => a.type === 'mafia' && a.target === mafiaTarget && a.disguised) });
      const deaths = new Set(), events = [];
      if (this.pendingKamikaze) {
        const target = this.pendingKamikaze; this.pendingKamikaze = null;
        if (!protectedByDoctor.has(target) && !protectedByGuard.has(target)) deaths.add(target);
      }
      for (const hit of attacks) {
        if (hit.type==='pumpkin' && this.spendBuff(this.member(hit.target),'candy'))continue;
        if (protectedByDoctor.has(hit.target)) continue;
        let victim = hit.target;
        if (protectedByGuard.has(victim)) victim = protectedByGuard.get(victim);
        const person = this.member(victim);
        if(this.rules.enableBuffs && !person.buffSpent?.protection && this.spendBuff(person,'protection'))continue;
        if (person.role === 'lucky' && !this.luckyUsed.has(victim) && this.pick(3) < 2) { this.luckyUsed.add(victim); continue; }
        deaths.add(victim);
        if(this.rules.kamikazeNight && person.role==='kamikaze' && hit.actor) deaths.add(hit.actor);
      }
      const inactiveDeaths=new Set();
      for(const player of this.players){
        const passive=['citizen','sergeant','lucky','suicide','kamikaze','mayor'].includes(player.role);
        if(player.alive&&!passive&&!blocked.has(player.id)&&!this.actions.has(player.id)){
          inactiveDeaths.add(player.id);deaths.add(player.id);
        }
      }
      const previousDon=this.players.find(p=>p.alive&&isDon(p))?.id;
      for (const id of deaths) { const player = this.eliminate(id); if (player) events.push({ type: 'eliminated', id, ...(attacks.some(a=>a.target===id)?{lastWordsAllowed:true}:{}), ...(inactiveDeaths.has(id)?{inactive:true,reason:'inactivity'}:{}), ...(this.rules.revealRoles?{role:roleOf(player)}:{}), ...(this.rules.showKillers?{killerRoles:attacks.filter(a=>a.target===id).map(a=>a.type==='mafia'?'don':a.type)}:{}) }); }
      const successor=this.players.find(p=>p.alive&&isDon(p));
      if(previousDon&&deaths.has(previousDon)&&successor)events.push({type:'donSuccession'});
      const disguised = new Set();
      const documents = target => {
        if (disguised.has(target.id)) return true;
        if (this.rules.enableBuffs && !target.buffSpent?.documents && this.spendBuff(target,'documents')) { disguised.add(target.id); return true; }
        return false;
      };
      for (const [id, action] of this.actions) {
        const actor = this.member(id), targetId = action.targetIds[0];
        if (action.skip) continue;
        if (this.rules.nightNotifications && !blocked.has(id) && !['citizen','sergeant','lucky','suicide','kamikaze'].includes(actor.role)) {
          for (const target of action.targetIds) { const notices=this.reports.get(target)||[]; notices.push({round:this.round,notification:true}); this.reports.set(target,notices); }
        }
        if(isDon(actor) && this.rules.donSearch && action.mode==='search' && !blocked.has(id)) {
          const found=this.member(targetId).role==='commissioner' && !(documents(this.member(targetId)));
          for(const ally of this.players.filter(p=>MAFIA.has(p.role))) {const reports=this.reports.get(ally.id)||[];reports.push({round:this.round,targetId,donSearch:true,isCommissioner:found});this.reports.set(ally.id,reports);}
        }
        if (actor.role === 'commissioner' && !blocked.has(id) && action.mode === 'check') {
          const target = this.member(targetId), lawyerCovered = this.players.some(p => p.alive && p.role === 'lawyer' && !blocked.has(p.id) && getTarget(p.id) === targetId && MAFIA.has(target.role));
          const reports = this.reports.get(id) || [];
          const hasDocuments=documents(target);
          const role = lawyerCovered || (hasDocuments && MAFIA.has(target.role)) ? 'citizen' : target.role === 'suicide' ? 'don' : roleOf(target), isMafia = !lawyerCovered && !(hasDocuments && MAFIA.has(target.role)) && (MAFIA.has(target.role) || target.role === 'suicide');
          reports.push({ round: this.round, targetId, role, isMafia }); this.reports.set(id, reports);
          if (this.sergeantId) { const shared = this.reports.get(this.sergeantId) || []; shared.push({ round: this.round, targetId, role, isMafia }); this.reports.set(this.sergeantId, shared); }
        }
        if (actor.role === 'journalist' && !blocked.has(id)) {
          const [a, b] = action.targetIds, ma = this.member(a), mb = this.member(b);
          const lawyer = this.players.find(p => p.alive && p.role === 'lawyer' && !blocked.has(p.id)), lawyerTarget = lawyer && getTarget(lawyer.id);
          const maskedRole = p => { const hidden=documents(p); return MAFIA.has(p.role) && (hidden || lawyerTarget===p.id) ? 'citizen' : roleOf(p); };
          const ra=maskedRole(ma), rb=maskedRole(mb);
          const aligned = !SOLO.has(ra) && !SOLO.has(rb) && (MAFIA.has(ra) === MAFIA.has(rb));
          const reports = this.reports.get(id) || []; reports.push({ round: this.round, targetIds: [a, b], sameSide: aligned }); this.reports.set(id, reports);
          if(this.rules.journalistArticle) events.push({type:'article',targetIds:[a,b],sameSide:aligned});
        }
        if (actor.role === 'hobo' && !blocked.has(id)) {
          const visitors = this.players.filter(p => !blocked.has(p.id) && p.id !== id && (p.role === 'mafia' ? isDon(p) : ['commissioner','doctor','mistress','lawyer','journalist','bodyguard','maniac'].includes(p.role)) && (this.actions.get(p.id)?.targetIds || []).includes(targetId)).map(p => p.id);
          const reports = this.reports.get(id) || []; reports.push({ round: this.round, targetId, visitors }); this.reports.set(id, reports);
        }
      }
      this.mistressBlocked=[...blocked];
      this.lastResult = { phase: 'night', eliminated: events.filter(e=>e.type==='eliminated').map(e => e.id), events }; this.actions.clear();
      if (!this.checkWinner()) this.setPhase('discussion');
    } else if (this.phase === 'discussion') { this.votes.clear(); this.setPhase('voting'); }
    else if (this.phase === 'voting') {
      const target = uniqueLeader([...this.votes].flatMap(([voter, targetId]) => Array(this.member(voter).role === 'mayor' ? 2 : 1).fill(targetId)));
      this.pendingExecution = target;
      if (target) { this.lastResult = { phase: 'voting', nominee: target, eliminated: null }; this.confirmations.clear(); this.setPhase('confirmation'); }
      else { this.lastResult = { phase: 'voting', eliminated: null }; this.votes.clear(); if (!this.checkWinner()) { this.round++; this.setPhase('night'); } }
    } else if (this.phase === 'confirmation') {
      const approvals = [...this.confirmations].reduce((sum,[id,yes]) => sum + (yes ? (this.member(id).role === 'mayor' ? 2 : 1) : 0),0);
      const rejections = [...this.confirmations].reduce((sum,[id,yes]) => sum + (!yes ? (this.member(id).role === 'mayor' ? 2 : 1) : 0),0);
      const approved = approvals > rejections;
      const eliminated = approved && this.pendingExecution ? this.eliminate(this.pendingExecution) : null;
      this.lastResult = { phase: 'confirmation', nominee: this.pendingExecution, eliminated: eliminated?.id ?? null, approved, approvals, rejections, role: eliminated && this.rules.revealRoles ? roleOf(eliminated) : null };
      if (eliminated?.role === 'suicide') { eliminated.suicideWon=true;this.activity.add(eliminated.id); }
      if (eliminated?.role === 'kamikaze') this.pendingKamikazeChooser = eliminated.id;
      this.pendingExecution = null; this.votes.clear(); this.confirmations.clear();
      if (!this.checkWinner()) { this.round++; this.setPhase('night'); }
    }
    return true;
  }
  view(id) {
    const me = this.member(id);
    const faction = role => MAFIA.has(role) ? 'mafia' : SOLO.has(role) ? role : 'citizens';
    return {
      id: this.id, number: this.number, visibility: this.visibility, ownerId: this.ownerId, group: this.group, phase: this.phase, round: this.round,
      revision: this.revision, deadline: this.deadline, serverTime: this.now(), rules: { ...this.rules },
      nightEvents:this.phase==='night'&&this.rules.showActions?[...this.actions].map(([actor,action])=>nightNarrative(roleOf(this.member(actor)),action)):[],
      coWinners:['mafia','citizens'].includes(this.winner)?this.players.filter(p=>p.suicideWon).map(p=>({id:p.id,name:p.name,role:'suicide'})):[],
      winner: this.winner, lastResult: this.lastResult, chat:this.chatView(id),
      voting: { votes: [...this.votes].filter(([v])=>!this.rules.hiddenVoting || v===id).map(([voterId,targetId]) => ({voterId,targetId,weight:this.member(voterId).role==='mayor'?2:1})), approvals: [...this.confirmations].reduce((n,[v,yes])=>n+(yes?(this.member(v).role==='mayor'?2:1):0),0), rejections: [...this.confirmations].reduce((n,[v,yes])=>n+(!yes?(this.member(v).role==='mayor'?2:1):0),0) },
      players: this.players.map(p => ({ id: p.id, name: p.name, username: p.username ?? null, photoUrl: p.photoUrl ?? null, alive: p.alive, ...((this.phase === 'finished' || (!p.alive && this.rules.revealRoles)) ? { role: roleOf(p) } : {}) })),
      me: { id, buffs:{...(me.buffs||{})}, role: roleOf(me), alive: me.alive, actionSubmitted: this.actions.has(id), nightAction: this.actions.has(id) ? { ...this.actions.get(id), targetIds:[...(this.actions.get(id).targetIds||[])] } : null, voteSubmitted: this.votes.has(id), confirmationSubmitted: this.confirmations.has(id),
        reports: this.reports.get(id) || [], kamikazeChoice: this.pendingKamikazeChooser === id,
        teammates: MAFIA.has(roleOf(me)) && me.role !== 'lawyer' ? this.players.filter(p => MAFIA.has(roleOf(p)) && p.role !== 'lawyer' && p.id !== id).map(p => p.id) : [],
        faction: faction(me.role), commissionerId: me.role === 'sergeant' ? this.players.find(p => p.alive && p.role === 'commissioner')?.id ?? null : null }
    };
  }
  snapshot() {
    const { now, pick, ...state } = this;
    return { ...state, luckyUsed:[...this.luckyUsed], doctorSelfSaveUsed:[...this.doctorSelfSaveUsed], lastBodyguardTarget:[...this.lastBodyguardTarget], lastHoboTarget:[...this.lastHoboTarget], actions: [...this.actions], votes: [...this.votes], confirmations: [...this.confirmations], reports: [...this.reports], activity: [...this.activity] };
  }
  static restore(state, now = Date.now) {
    const game = Object.create(Game.prototype);
    const players = state.players.map(p => ({ ...p, role: p.role === 'detective' ? 'commissioner' : p.role, office: p.office ?? null }));
    const legacyDon = players.find(p => p.role === 'mafia'); if (legacyDon && state.players.some(p=>!Object.hasOwn(p,'office')) && !players.some(p => p.office === 'don' || p.role === 'don')) legacyDon.office = 'don';
    const actions = state.actions.map(([id, action]) => [id, typeof action === 'string' ? { targetIds: [action], mode: players.find(p => p.id === id)?.role === 'commissioner' ? 'check' : null } : action]);
    Object.assign(game, state, { players, rules: { ...DEFAULT_RULES, ...EXTRA_RULES, ...state.rules, roleOrder:[...(state.rules.roleOrder || ROLE_ORDER)], enabledRoles:[...(state.rules.enabledRoles || OPTIONAL_ROLES)] }, luckyUsed: new Set(state.luckyUsed || []), doctorSelfSaveUsed: new Set(state.doctorSelfSaveUsed || []), lastBodyguardTarget: new Map(state.lastBodyguardTarget || []), lastHoboTarget: new Map(state.lastHoboTarget || []), now, pick: randomInt, actions: new Map(actions), votes: new Map(state.votes), confirmations: new Map(state.confirmations || []), reports: new Map(state.reports), activity: new Set(state.activity || []) });
    return game;
  }
}
