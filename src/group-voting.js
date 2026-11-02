import { nightNarrative, dawnNarrative } from './night-narrative.js';
import { Game } from './game.js';
import { groupKeyboard } from './telegram-game.js';

const roleNames = { citizen:'Tinch aholi', mafia:'Mafia', don:'Don', commissioner:'Komissar', sergeant:'Serjant', doctor:'Shifokor', maniac:'Qotil', mistress:'Ma’shuqa', lawyer:'Advokat', suicide:'Suidsid', hobo:'Daydi', lucky:'Omadli', kamikaze:'Kamikaze', journalist:'Jurnalist', bodyguard:'Tansoqchi', mayor:'Mer' };
// Only public voting information is sent; secret roles stay private until elimination.
export class GroupVoting {
  constructor(bot, save = () => {}) { this.bot = bot; this.save = save; this.queue = Promise.resolve(); }
  publish(game) {
    if (!game.group) return;
    const snapshot = game.snapshot();
    this.queue = this.queue.then(() => this.deliver(game, snapshot)).catch(() => console.error('Guruh ovoz xabarini yuborib bo‘lmadi'));
  }
  async deliver(game, snapshot) {
    const g = Game.restore(snapshot), name = id => g.players.find(p=>p.id===id)?.name || 'O‘yinchi';
    const notices = game.groupVotingNotices ||= [];
    const send = async (key, text, button) => {
      if (notices.includes(key)) return;
      if(!g.rules.showEmoji) {text=text.replace(/\p{Extended_Pictographic}|[\uFE0F\u200D]/gu,'');button=button?.replace(/\p{Extended_Pictographic}|[\uFE0F\u200D]/gu,'');}
      await this.bot.send(g.group.id, text, g.id, button, {protect_content:g.rules.protectContent,...(this.bot.link?{reply_markup:groupKeyboard(this.bot,g)}:{})});
      notices.push(key); this.save(game);
    };
    const phaseKey = `${g.round}:${g.phase}`;
    if(g.phase==='night'&&g.round===1)await send('started','O‘yin boshlandi! Bir necha soniyada kartalar tarqatiladi va o‘z rolingizni bilib olasiz.','Rolimni ko‘rish');
    if(g.phase==='lobby')await send(`lobby:${g.players.map(p=>p.id).join(',')}`,`Ro‘yxat: ${g.players.length}/${g.rules.maxPlayers}\n${g.players.map((p,i)=>`${i+1}. ${p.name}`).join('\n')}`,'O‘yinga qo‘shilish');
    if(g.phase==='night'||g.phase==='discussion')await send(phaseKey,g.phase==='night'?'🌃 Tun boshlandi. Ko‘chaga faqat jasur va qo‘rqmas odamlar chiqadi. Ertalab tirik qolganlarni sanaymiz. Tungi harakatlar botning shaxsiy chatida.':'☀️ Kun boshlandi. Guruhda suhbatlashing.','Botdagi o‘yinim');
    if(g.phase==='night' && g.rules.showActions) for(const [id,action] of g.actions) await send(`action:${g.round}:${id}`, nightNarrative(g.view(id).me.role,action), 'O‘yinni ochish');
    if(g.lastResult?.phase==='night') for(const [i,event] of (g.lastResult.events||[]).entries()) {
      if(['eliminated','donSuccession'].includes(event.type))await send(`death:${g.round}:${i}`,dawnNarrative(event,name(event.id)),'O‘yinni ochish');
      if(event.lastWords)await send(`lastwords:${g.round}:${event.id}`,`O‘limidan oldin kimdir ${name(event.id)} qichqirganini eshitdi:\n${event.lastWords}`,'O‘yinni ochish');
      if(event.type==='article')await send(`article:${g.round}:${i}`, `Jurnalist maqolasi: ${event.targetIds.map(name).join(' va ')} — ${event.sameSide?'bir tomonda':'qarama-qarshi tomonda'}.`, 'O‘yinni ochish');
    }
    if (g.phase === 'voting') {
      await send(phaseKey, `Aybdorlarni aniqlash va jazolash vaqti keldi.\nOvoz berish uchun ${Math.ceil(g.rules.votingMs/1000)} soniya.`, '🗳 Ovoz berish');
      if(!g.rules.hiddenVoting) for (const [voter,target] of g.votes) await send(`${phaseKey}:${voter}`, target ? `${name(voter)} → ${name(target)} ga ovoz berdi.` : `${name(voter)} ovoz berishni o‘tkazib yubordi.`, '🗳 Ovoz berish');
    }
    if (g.phase === 'confirmation') await send(phaseKey, `Rostdan ham ${name(g.pendingExecution)}ni osmoqchimisiz?\nTasdiqlash uchun ${Math.ceil(g.rules.confirmationMs/1000)} soniya.`, '👍 / 👎 Hukmni tasdiqlash');
    if (g.lastResult?.phase === 'confirmation') {
      const r=g.lastResult;
      await send(`result:${g.round}:${r.nominee}`, `Ovoz berish natijalari: ${r.approvals} 👍 | ${r.rejections} 👎\n${r.approved ? `${name(r.eliminated)} osildi.${r.role ? ` Roli: ${roleNames[r.role] || r.role}.` : ''}` : `${name(r.nominee)}ga chiqarilgan hukm rad etildi.`}`, 'Natijani ko‘rish');
    } else if (g.lastResult?.phase === 'voting' && !g.lastResult.nominee) {
      await send(`tie:${g.round}`, 'Yagona nomzod aniqlanmadi. Hech kim osilmaydi.', 'O‘yinni ochish');
    }
    if (g.phase === 'night' && ['confirmation','voting'].includes(g.lastResult?.phase)) await send(phaseKey, '🌃 Tun boshlandi. Tungi harakatingizni tanlang.', 'Botdagi o‘yinni ochish');
    if(g.phase==='finished'&&['citizens','mafia'].includes(g.winner))for(const p of g.players.filter(p=>p.suicideWon))await send(`cowinner:${p.id}`,`${p.name} — Suidsid ham g‘alaba qozondi.`,'Natijani ko‘rish');
    if (g.phase === 'finished') await send(phaseKey, `O‘yin tugadi! G‘olib: ${g.winner === 'citizens' ? 'Tinch aholi' : g.winner === 'mafia' ? 'Mafia' : g.winner}.`, 'Natijani ko‘rish');
  }
}
