import {OFFICIAL_GROUP_URL} from './official-group.js';
import { randomUUID } from 'node:crypto';
import { Game, GameError } from './game.js';

export const roleNames={citizen:'Tinch aholi',don:'Don',mafia:'Mafiya',commissioner:'Komissar',sergeant:'Serjant',doctor:'Shifokor',maniac:'Manyak',mistress:'Ma’shuqa',lawyer:'Advokat',suicide:'Suidsid',hobo:'Darbadar',lucky:'Omadli',kamikaze:'Kamikadze',journalist:'Jurnalist',bodyguard:'Tansoqchi',mayor:'Mer'};
const phases={lobby:'l',night:'n',discussion:'d',voting:'v',confirmation:'c',finished:'f'};
const check=(value,text)=>{if(!value)throw new GameError(text);};
export function gameButton(g,text,action,arg=''){
 const data=`mf|${g.id}|${g.round}|${phases[g.phase]}|${action}|${arg}`;
 check(Buffer.byteLength(data)<=64,'Tugma ma’lumoti juda katta');
 return {text,callback_data:data};
}
export function privateGameLink(bot,g,join=false){return `https://t.me/${bot.username}?start=${join?'join_':'play_'}${g.id}`;}
export function groupKeyboard(bot, g, label) {
 if (g.phase === 'finished') return { inline_keyboard: [] };
 if (g.entryMode === 'miniapp') return { inline_keyboard: [[{ text: label || 'Mini App’da qo‘shilish', url: bot.link(g.id) }]] };
 if (g.phase === 'confirmation') {
  const { approvals, rejections } = g.view(g.ownerId).voting;
  return { inline_keyboard: [
   [gameButton(g, `👍 ${approvals}`, 'yes')],
   [gameButton(g, `👎 ${rejections}`, 'no')]
  ] };
 }
 const join = g.phase === 'lobby';
 const text = label || (join ? 'Qo‘shilish' : g.phase === 'voting' ? 'Ovoz berish' : 'Botga o‘tish');
 return { inline_keyboard: [[{ text, url: privateGameLink(bot, g, join) }]] };
}

export class TelegramGame {
 constructor(bot,hooks){this.bot=bot;this.h=hooks;this.queue=Promise.resolve();this.purchases=new Map();}
 async send(chat,text,rows=[]){const entities=text.startsWith('Salom!\nMen 🤵🏻MafiaUz')?[{type:'bold',offset:text.indexOf('MafiaUz'),length:7}]:undefined;return this.bot.call('sendMessage',{chat_id:chat,text,...(entities?{entities}:{}),reply_markup:{inline_keyboard:rows},protect_content:true});}
 targets(g,id,action,first){
  const buttons=g.players.flatMap((p,i)=>p.alive && !(action==='j2'&&String(i)===first)?[gameButton(g,p.name,action,first===undefined?String(i):`${first}_${i}`)]:[]);
  const rows=[];for(let i=0;i<buttons.length;i+=2)rows.push(buttons.slice(i,i+2));return rows;
 }
 async home(id){
  const button=(text,section)=>({text,callback_data:'nav|'+section});
  return this.send(id,'Salom!\nMen 🤵🏻MafiaUz o\'yinini rasmiy botiman.\nQuyidagi bo‘lumlardan birini tanlang.',[
   [{text:'🤵 Botni guruhga qo‘shish',url:`https://t.me/${this.bot.username}?startgroup=mafia&admin=delete_messages+restrict_members+pin_messages`}],
   [button('👥 Guruhlar','groups'),button('🎲 O‘yinga kirish','game')],
   [button('👤 Profil','profile'),button('🛒 Do‘kon','shop')],
   [button('🎭 Rollar','roles'),button('🎁 Referal','referrals')],
   [{text:'Mini App’ni ochish',url:this.bot.link()}]
  ]);
 }
 async section(id,section,arg=''){
  const store=this.h.store,back=[{text:'← Bosh menyu',callback_data:'nav|home'}];
  if(section==='home')return this.home(id);
  if(section==='profile'){
   const p=store.profile(id),i=store.inventory(id);
   return this.send(id,`👤 Profil\nO‘yinlar: ${p.games}\nG‘alabalar: ${p.wins}\n🪙 Tanga: ${i.coins}\n🛡 Himoya: ${i.protection}\n📂 Hujjatlar: ${i.documents}\n🎭 Faol rol: ${i.active_role}\n🎃 Qovoq: ${i.pumpkin}\n🍬 Shirinlik: ${i.candy}`,[[{text:'🛒 Do‘kon',callback_data:'nav|shop'}],back]);
  }
  if(section==='referrals'){
   const r=store.referralStats(id);return this.send(id,`🎁 Referal\nhttps://t.me/${this.bot.username}?start=ref_${id}\n\nTakliflar: ${r.invited}\nFaol referallar: ${r.qualified}\nOlingan tanga: ${r.earned}\n\nYangi do‘stingiz birinchi hisoblangan o‘yinida faol qatnashsa, ikkalangizga 10 tangadan beriladi.`,[back]);
  }
  if(section==='roles')return this.send(id,'🎭 Rollar\n'+Object.values(roleNames).join(' · ')+`\n\nTun: faol rollar shaxsiy chatda nishon tanlaydi.\nKun: guruhda muhokama, ovoz berish va hukm tasdig‘i.\nMafia — son jihatidan ustunlikka erishadi; tinchlar — Mafia va Qotilni topadi.`,[back]);
  if(section==='groups'){
   return this.send(id,'👥 Rasmiy guruh\n✅ MafiaUzAppGr\nDo‘stlar bilan o‘ynash uchun rasmiy guruhimizga qo‘shiling.',[[{text:'✅ MafiaUzAppGr — rasmiy guruh',url:OFFICIAL_GROUP_URL}],back]);
  }
  if(section==='game'){
   const g=this.h.active(id);if(g?.group){await this.bot.member(g.group.id,id);await this.h.advance(g);return this.menu(g,id);}
   return this.send(id,'🎲 Guruhda /mafia yuboring, so‘ng o‘yinga qo‘shilish tugmasini bosing. Rollar va tungi harakatlar shu shaxsiy chatda ko‘rinadi.',[back]);
  }
  const items={protection:['Himoya',100],documents:['Hujjatlar',150],active_role:['Faol rol',200],pumpkin:['Qovoq',100],candy:['Shirinlik',30]};
  if(section==='shop')return this.send(id,`🛒 Do‘kon · ${store.inventory(id).coins} tanga\nBuyumni tanlang. Xarid oldidan tasdiq so‘raladi.`,[...Object.entries(items).map(([key,[name,price]])=>[{text:`${name} — ${price} tanga`,callback_data:'nav|buy|'+key}]),back]);
  if(section==='buy'){
   check(Object.hasOwn(items,arg),'Buyum topilmadi');
   for(const [token,p]of this.purchases)if(p.id===id||p.expires<Date.now())this.purchases.delete(token);
   const token=randomUUID();this.purchases.set(token,{id,item:arg,expires:Date.now()+120000});
   return this.send(id,`${items[arg][0]}ni ${items[arg][1]} tangaga sotib olasizmi?`,[[{text:'Tasdiqlash',callback_data:'nav|pay|'+token}],[{text:'Bekor qilish',callback_data:'nav|shop'}]]);
  }
  if(section==='pay'){
   const p=this.purchases.get(arg);check(p&&p.id===id&&p.expires>Date.now(),'Xarid tasdig‘i eskirgan');this.purchases.delete(arg);
   try{store.buyItem(id,p.item);}catch{throw new GameError('Xarid bajarilmadi. Tanga yetarliligini tekshiring.');}
   return this.send(id,'Xarid qilindi. Buyum inventaringizga qo‘shildi.',[[{text:'👤 Profil',callback_data:'nav|profile'}],back]);
  }
  throw new GameError('Bo‘lum topilmadi');
 }
 async menu(g,id){
  const v=g.view(id), me=v.me, name=pid=>g.players.find(p=>p.id===pid)?.name||'O‘yinchi';
  let text=`${g.group.name}\n${g.round}-davra · ${g.phase}\n`;
  const rows=[];
  if(g.phase==='lobby'){
   text=`${g.group.name}\nRo‘yxat: ${g.players.length}/${g.rules.maxPlayers}\n${g.players.map((p,i)=>`${i+1}. ${p.name}`).join('\n')}`;
   rows.push([gameButton(g,'O‘yinni boshlash','start'),gameButton(g,'Ro‘yxatdan chiqish','leave')]);
  }else{
   text+=`Sizning rolingiz: ${roleNames[me.role]}${me.alive?'':' · O‘yindan chiqqansiz'}`;
   if(me.alive&&['don','mafia'].includes(g.member(id).role)&&g.phase==='night')text+='\nMaxfiy jamoaga yozish: /team xabaringiz';
   if(me.teammates.length)text+=`\nJamoadoshlar: ${me.teammates.map(name).join(', ')}`;
   if(me.commissionerId)text+=`\nKomissar: ${name(me.commissionerId)}`;
   for(const r of me.reports.slice(-8)){
    if(r.notification)text+='\nTunda yoningizga kimdir keldi.';
    else if(r.donSearch)text+=`\n${name(r.targetId)}: ${r.isCommissioner?'Komissar':'Komissar emas'}`;
    else if(r.targetIds)text+=`\n${r.targetIds.map(name).join(' / ')}: ${r.sameSide?'bir tomonda':'boshqa tomonda'}`;
    else if(r.visitors)text+=`\n${name(r.targetId)} yoniga kelganlar: ${r.visitors.map(name).join(', ')||'hech kim'}`;
    else text+=`\n${name(r.targetId)}: ${roleNames[r.role]|| (r.isMafia?'Mafiya':'Tinch aholi')}`;
   }
   if(g.phase==='night'&&me.kamikazeChoice){text+='\nQasos nishonini tanlang.';rows.push(...this.targets(g,id,'revenge'));}
   else if(g.phase==='night'&&me.alive&&!me.actionSubmitted){
    if(!['citizen','sergeant','lucky','suicide','kamikaze','mayor'].includes(g.member(id).role))text+='\nDiqqat: tonggacha harakat tanlamasangiz, o‘yindan chiqarilasiz.';
    const passive=['citizen','sergeant','lucky','suicide','kamikaze','mayor'].includes(g.member(id).role)&&!(me.role==='citizen'&&g.rules.halloween&&me.buffs.pumpkin>0);
    if(passive)text+='\nShahar uxlamoqda. Tongni kuting.';
    else if(me.role==='commissioner'){
     text+='\nTekshirish yoki otishni tanlang.';rows.push([gameButton(g,'Tekshirish','mode','check')]);
     if(g.rules.commissionerShoot&&(g.round>1||g.rules.firstNightShoot))rows.push([gameButton(g,'Otish','mode','kill')]);
    }else if(me.role==='don'&&g.rules.donSearch){rows.push([gameButton(g,'Hujum','mode','attack'),gameButton(g,'Komissarni qidirish','mode','search')]);}
    else {text+=me.role==='journalist'?'\nBirinchi o‘yinchini tanlang.':'\nNishonni tanlang.';rows.push(...this.targets(g,id,me.role==='journalist'?'j1':'night'));}
    if(!passive&&g.rules.skipNight)rows.push([gameButton(g,'Tungi harakatni o‘tkazish','skipnight')]);
   }else if(g.phase==='night'&&me.actionSubmitted)text+='\nHarakatingiz qabul qilingan. Tongni kuting.';
   else if(g.phase==='voting'&&me.alive&&!me.voteSubmitted){text+='\nKimga ovoz berasiz?';rows.push(...this.targets(g,id,'vote'));if(g.rules.skipVoting)rows.push([gameButton(g,'Ovozni o‘tkazish','skipvote')]);}
   else if(g.phase==='confirmation'&&me.alive&&!me.confirmationSubmitted){text+=`\n${name(g.pendingExecution)} uchun hukmni tasdiqlaysizmi?`;rows.push([gameButton(g,'👍 Ha','yes'),gameButton(g,'👎 Yo‘q','no')]);}
   else if(g.phase==='discussion'){text+='\nGuruhda muhokama qiling.';if(!me.alive&&g.lastResult?.events?.some(e=>e.id===id&&e.lastWordsAllowed&&!e.lastWords))text+='\nBir marta oxirgi so‘z qoldiring: /lastwords xabaringiz';}
   if(g.phase==='finished')text+=`\nO‘yin tugadi. G‘olib: ${g.winner}`;
  }
  rows.push([gameButton(g,'Yangilash','refresh')],[{text:'Mini App’da davom etish',url:this.bot.link(g.id)}]);
  await this.send(id,text,rows);
 }
 publish(game){
  if(!game.group||!this.bot.call||game.entryMode==='miniapp')return;
  const snapshot=game.snapshot();
  this.queue=this.queue.then(async()=>{
   const g=Game.restore(snapshot), notices=game.telegramNotices ||= [];
   if(g.phase==='lobby')return;
   for(const p of g.players){
    const me=g.view(p.id).me;
    const key=`${g.round}:${g.phase}:${p.id}:${me.role}:${me.kamikazeChoice}:${me.reports.length}`;
    if(notices.includes(key))continue;
    try{await this.menu(g,p.id);notices.push(key);this.h.save(game);}catch{ /* The player can open /start to retry a blocked private chat. */ }
   }
  }).catch(()=>console.error('Telegram shaxsiy o‘yin xabari yuborilmadi'));
 }
 async join(g,from){
  check(g.entryMode !== 'miniapp', 'Bu xonaga Mini App orqali qo‘shiling');
  const id=String(from.id), existing=this.h.active(id);
  check(!existing||existing.id===g.id,'Avval boshqa o‘yindan chiqing');
  await this.bot.member(g.group.id,id);
  check(this.h.cooldown(g.group.id,id)<=Date.now(),'O‘yindan chiqish cheklovi hali tugamagan');
  await this.h.advance(g);
  // Establish the private chat before adding the player to a game with secret roles.
  await this.send(id,'Telegram orqali o‘yinga ulanyapsiz.');
  g.join({id,name:from.first_name||'O‘yinchi',username:from.username||null});this.h.save(g);this.h.publish(g);await this.menu(g,id);
 }
 async callback(q){
  let message='Qabul qilindi';
  try{
   check(q.from&&!q.from.is_bot&&Number.isSafeInteger(q.from.id),'Foydalanuvchi noto‘g‘ri');
   this.h.rate?.(String(q.from.id));
   if(String(q.data||'').startsWith('nav|')){
    const id=String(q.from.id);check(q.message?.chat?.type==='private'&&String(q.message.chat.id)===id,'Bu menyu faqat shaxsiy chat uchun');
    const [,section,arg='']=q.data.split('|');await this.section(id,section,arg);return;
   }
   const [prefix,room,round,phase,action,arg='']=String(q.data||'').split('|');
   check(prefix==='mf','Tugma noto‘g‘ri');const g=this.h.rooms.get(room), id=String(q.from.id);
   check(g?.group,'O‘yin topilmadi');
   const privateChat=q.message?.chat?.type==='private';
   check(privateChat?String(q.message.chat.id)===id:String(q.message?.chat?.id)===g.group.id,'Bu tugma boshqa chatga tegishli');
   g.member(id);await this.bot.member(g.group.id,id);await this.h.advance(g);
   check(String(g.round)===round&&phases[g.phase]===phase,'Bu tugma eskirgan. /start orqali yangilang');
   const target=index=>{check(/^\d{1,2}$/.test(index)&&g.players[Number(index)],'Nishon noto‘g‘ri');return g.players[Number(index)].id;};
   if(action==='start')await this.h.start(g,id);
   else if(action==='leave'){await this.h.leave(g,id);message='Ro‘yxatdan chiqdingiz';return;}
   else if(['vote','yes','no','skipvote'].includes(action))g.vote(id,action==='vote'?{targetId:target(arg)}:action==='skipvote'?{skip:true}:{confirm:action==='yes'},g.revision);
   else{
    check(privateChat,'Tungi harakatlar faqat shaxsiy chatda');
    if(action==='refresh'){await this.menu(g,id);return;}
    if(action==='mode'){
     check(g.phase==='night'&&g.alive(id)&&!g.actions.has(id),'Tungi harakat allaqachon tanlangan');
     check(['check','kill','attack','search'].includes(arg),'Harakat noto‘g‘ri');
     const role=g.view(id).me.role;check(role==='commissioner'?['check','kill'].includes(arg):role==='don'&&['attack','search'].includes(arg),'Bu harakat sizga tegishli emas');
     await this.send(id,'Nishonni tanlang.',this.targets(g,id,{check:'check',kill:'kill',attack:'night',search:'search'}[arg]));return;
    }
    if(action==='j1'){
     check(g.phase==='night'&&g.alive(id).role==='journalist'&&!g.actions.has(id),'Bu harakat sizga tegishli emas');
     g.alive(target(arg));check(target(arg)!==id,'O‘zingizni tanlamang');
     await this.send(id,'Ikkinchi o‘yinchini tanlang.',this.targets(g,id,'j2',arg));return;
    }
    if(action==='revenge')g.kamikazeAction(id,target(arg),g.revision);
    else if(action==='skipnight')g.nightAction(id,{skip:true},g.revision);
    else if(action==='j2'){const ids=arg.split('_');check(ids.length===2,'Ikki o‘yinchi kerak');g.nightAction(id,{targetIds:ids.map(target)},g.revision);}
    else {check(['night','check','kill','search'].includes(action),'Harakat noto‘g‘ri');g.nightAction(id,{targetId:target(arg),mode:action==='night'?null:action},g.revision);}
   }
   this.h.save(g);this.h.publish(g);
   if(privateChat&&g.players.some(p=>p.id===id))await this.menu(g,id);
  }catch(e){message=e instanceof GameError?e.message:'Amal bajarilmadi. /start orqali qayta urinib ko‘ring';}
  finally {await this.bot.call('answerCallbackQuery',{callback_query_id:q.id,text:message.slice(0,180),show_alert:message!=='Qabul qilindi'});}
 }
 async privateMessage(m){
  if(m.chat?.type!=='private'||!m.from||m.from.is_bot||typeof m.text!=='string')return false;
  const match=/^\/(start|game|leave|team|lastwords|profile|language|issue)(?:@[\w]+)?(?:\s+([\s\S]*))?$/.exec(m.text);if(!match)return false;
  const id=String(m.from.id), arg=match[2]||'';
  try{
   this.h.rate?.(id);
   if(match[1]==='profile'){await this.section(id,'profile');return true;}
   if(match[1]==='language'){await this.send(id,'O‘yin tili: O‘zbekcha. Hozircha shu til mavjud.',[[{text:'← Bosh menyu',callback_data:'nav|home'}]]);return true;}
   if(match[1]==='issue'){const contact=this.h.developer;await this.send(id,contact?`Developer bilan bog‘lanish: @${contact}`:'Developer bilan bog‘lanish manzili hali sozlanmagan.');return true;}

   if(match[1]==='start'&&!arg){const active=this.h.active(id);if(active){if(active.group)await this.bot.member(active.group.id,id);await this.h.advance(active);}await this.home(id);if(active?.group)await this.menu(active,id);return true;}
   if(match[1]==='start'&&/^ref_[1-9][0-9]{0,19}$/.test(arg)){await this.send(id,'Salom!\nMen 🤵🏻MafiaUz o\'yinini rasmiy botiman.\nYangi foydalanuvchi sifatida birinchi hisoblangan o‘yiningizda faol qatnashsangiz, sizga va taklif qilgan do‘stingizga 10 tangadan beriladi.',[[{text:'Mini App’ni ochish',url:this.bot.link()}]]);return true;}
   if(match[1]==='start'&&/^(join|play)_/.test(arg)){
    const g=this.h.rooms.get(arg.replace(/^(join|play)_/,''));check(g?.group,'O‘yin topilmadi');
    if(arg.startsWith('join_'))await this.join(g,m.from);
    else{g.member(id);await this.bot.member(g.group.id,id);await this.h.advance(g);await this.menu(g,id);}
   }else{
    const g=this.h.active(id);
    if(!g){await this.home(id);return true;}
    check(g.group,'Bu xona Mini App orqali ochilgan');await this.bot.member(g.group.id,id);await this.h.advance(g);
    if(match[1]==='lastwords'){g.lastWords(id,arg);this.h.save(g);this.h.publish(g);await this.send(id,'Oxirgi so‘zingiz e’lon qilindi.');}
    else if(match[1]==='leave'){await this.h.leave(g,id);await this.send(id,'O‘yindan chiqdingiz.');}
    else if(match[1]==='team'){
     check(g.chatChannel(id)==='mafia','Maxfiy chat hozir sizga yopiq');g.sendChat(id,arg);this.h.save(g);this.h.publish(g);
     for(const p of g.players.filter(p=>p.alive&&['don','mafia'].includes(p.role)))try{await this.send(p.id,`Maxfiy jamoa chati · ${g.member(id).name}: ${arg}`);}catch{}
    }else await this.menu(g,id);
   }
  }catch(e){await this.send(id,e instanceof GameError?e.message:'O‘yinni ochib bo‘lmadi. Qayta urinib ko‘ring.');}
  return true;
 }
}
