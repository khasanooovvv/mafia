import { nightNarrative, dawnNarrative } from './night-narrative.js';
import { Game } from './game.js';
import { groupKeyboard } from './telegram-game.js';

const roleNames = { citizen:'Tinç aholi', mafia:'Mafia', don:'Don', commissioner:'Komissar', sergeant:'Serjant', doctor:'Şifokor', maniac:'Qotil', mistress:'Ma’şuqa', lawyer:'Advokat', suicide:'Suidsid', hobo:'Daydi', lucky:'Omadli', kamikaze:'Kamikaze', journalist:'Jurnalist', bodyguard:'Tansoqçi', mayor:'Mer' };
// Only public voting information is sent; secret roles stay private until elimination.
export class GroupVoting {
  constructor(bot, save = () => {}) { this.bot = bot; this.save = save; this.queue = Promise.resolve(); }
  publish(game) {
    if (!game.group) return;
    const snapshot = game.snapshot();
    this.queue = this.queue.then(() => this.deliver(game, snapshot)).catch(() => console.error('Guruh ovoz xabarini yuborib bölmadi'));
  }
  async deliver(game, snapshot) {
    const g = Game.restore(snapshot), name = id => g.players.find(p=>p.id===id)?.name || 'Öyinçi';
    const notices = game.groupVotingNotices ||= [];
    const send = async (key, text, button) => {
      if (notices.includes(key)) return;
      if(!g.rules.showEmoji) {text=text.replace(/\p{Extended_Pictographic}|[\uFE0F\u200D]/gu,'');button=button?.replace(/\p{Extended_Pictographic}|[\uFE0F\u200D]/gu,'');}
      await this.bot.send(g.group.id, text, g.id, button, {protect_content:g.rules.protectContent,...(this.bot.link?{reply_markup:groupKeyboard(this.bot,g)}:{})});
      notices.push(key); this.save(game);
    };
    const phaseKey = `${g.round}:${g.phase}`;
    if(g.phase==='night'&&g.round===1)await send('started','Öyin boşlandi! Bir neça soniyada kartalar tarqatiladi va öz rolingizni bilib olasiz.','Rolimni köriş');
    if(g.phase==='lobby')await send(`lobby:${g.players.map(p=>p.id).join(',')}`,`Röyxat: ${g.players.length}/${g.rules.maxPlayers}\n${g.players.map((p,i)=>`${i+1}. ${p.name}`).join('\n')}`,'Öyinga qöşiliş');
    if(g.phase==='night'||g.phase==='discussion')await send(phaseKey,g.phase==='night'?'🌃 Tun boşlandi. Köçaga faqat jasur va qörqmas odamlar çiqadi. Ertalab tirik qolganlarni sanaymiz. Tungi harakatlar botning şaxsiy çatida.':'☀️ Kun boşlandi. Guruhda suhbatlaşing.','Botdagi öyinim');
    if(g.phase==='night' && g.rules.showActions) for(const [id,action] of g.actions) await send(`action:${g.round}:${id}`, nightNarrative(g.view(id).me.role,action), 'Öyinni oçiş');
    if(g.lastResult?.phase==='night') for(const [i,event] of (g.lastResult.events||[]).entries()) {
      if(['eliminated','donSuccession'].includes(event.type))await send(`death:${g.round}:${i}`,dawnNarrative(event,name(event.id)),'Öyinni oçiş');
      if(event.lastWords)await send(`lastwords:${g.round}:${event.id}`,`Ölimidan oldin kimdir ${name(event.id)} qichqirganini eshitdi:\n${event.lastWords}`,'Öyinni oçiş');
      if(event.type==='article')await send(`article:${g.round}:${i}`, `Jurnalist maqolasi: ${event.targetIds.map(name).join(' va ')} — ${event.sameSide?'bir tomonda':'qarama-qarshi tomonda'}.`, 'Öyinni oçiş');
    }
    if (g.phase === 'voting') {
      await send(phaseKey, `Aybdorlarni aniqlaş va jazolaş vaqti keldi.\nOvoz beriş uçun ${Math.ceil(g.rules.votingMs/1000)} soniya.`, '🗳 Ovoz berish');
      if(!g.rules.hiddenVoting) for (const [voter,target] of g.votes) await send(`${phaseKey}:${voter}`, target ? `${name(voter)} → ${name(target)} ga ovoz berdi.` : `${name(voter)} ovoz berişni ötkazib yubordi.`, '🗳 Ovoz berish');
    }
    if (g.phase === 'confirmation') await send(phaseKey, `Rostdan ham ${name(g.pendingExecution)}ni osmoqçimisiz?\nTasdiqlaş uçun ${Math.ceil(g.rules.confirmationMs/1000)} soniya.`, '👍 / 👎 Hukmni tasdiqlash');
    if (g.lastResult?.phase === 'confirmation') {
      const r=g.lastResult;
      await send(`result:${g.round}:${r.nominee}`, `Ovoz berish natijalari: ${r.approvals} 👍 | ${r.rejections} 👎\n${r.approved ? `${name(r.eliminated)} osildi.${r.role ? ` Roli: ${roleNames[r.role] || r.role}.` : ''}` : `${name(r.nominee)}ga chiqarilgan hukm rad etildi.`}`, 'Natijani köriş');
    } else if (g.lastResult?.phase === 'voting' && !g.lastResult.nominee) {
      await send(`tie:${g.round}`, 'Yagona nomzod aniqlanmadi. Hech kim osilmaydi.', 'Öyinni oçiş');
    }
    if (g.phase === 'night' && ['confirmation','voting'].includes(g.lastResult?.phase)) await send(phaseKey, '🌃 Tun boşlandi. Tungi harakatingizni tanlang.', 'Botdagi öyinni oçiş');
    if(g.phase==='finished'&&['citizens','mafia'].includes(g.winner))for(const p of g.players.filter(p=>p.suicideWon))await send(`cowinner:${p.id}`,`${p.name} — Suidsid ham ğalaba qozondi.`,'Natijani köriş');
    if (g.phase === 'finished') await send(phaseKey, `Öyin tugadi! Ğolib: ${g.winner === 'citizens' ? 'Tinç aholi' : g.winner === 'mafia' ? 'Mafia' : g.winner}.`, 'Natijani köriş');
  }
}
