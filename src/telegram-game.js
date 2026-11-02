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
export function groupKeyboard(bot,g){
 const rows=[];
 if(g.phase==='lobby')rows.push([{text:'Telegram orqali qo‘shilish',url:privateGameLink(bot,g,true)}],[gameButton(g,'O‘yinni boshlash','start')]);
 else if(g.phase==='voting'){
  const targets=g.players.flatMap((p,i)=>p.alive?[gameButton(g,p.name,'vote',String(i))]:[]);
  for(let i=0;i<targets.length;i+=2)rows.push(targets.slice(i,i+2));
  if(g.rules.skipVoting)rows.push([gameButton(g,'Ovozni o‘tkazish','skipvote')]);
 }else if(g.phase==='confirmation')rows.push([gameButton(g,'👍 Tasdiqlash','yes'),gameButton(g,'👎 Rad etish','no')]);
 else if(g.phase!=='finished')rows.push([{text:'Botdagi o‘yinim',url:privateGameLink(bot,g)}]);
 rows.push([{text:'Mini App’da ochish',url:bot.link(g.id)}]);
 return {inline_keyboard:rows};
}

export class TelegramGame {
 constructor(bot,hooks){this.bot=bot;this.h=hooks;this.queue=Promise.resolve();}
 async send(chat,text,rows=[]){return this.bot.call('sendMessage',{chat_id:chat,text,reply_markup:{inline_keyboard:rows},protect_content:true});}
 targets(g,id,action,first){
  const buttons=g.players.flatMap((p,i)=>p.alive && !(action==='j2'&&String(i)===first)?[gameButton(g,p.name,action,first===undefined?String(i):`${first}_${i}`)]:[]);
  const rows=[];for(let i=0;i<buttons.length;i+=2)rows.push(buttons.slice(i,i+2));return rows;
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
  if(!game.group||!this.bot.call)return;
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
  const match=/^\/(start|game|leave|team|lastwords)(?:@[\w]+)?(?:\s+([\s\S]*))?$/.exec(m.text);if(!match)return false;
  const id=String(m.from.id), arg=match[2]||'';
  try{
   this.h.rate?.(id);
   if(match[1]==='start'&&/^ref_[1-9][0-9]{0,19}$/.test(arg)){await this.send(id,'Tun şahriga xuş kelibsiz! Yangi foydalanuvçi sifatida birinchi hisoblangan öyiningizda faol qatnaşsangiz, sizga va taklif qilgan döstingizga 10 tangadan beriladi.',[[{text:'Mini App’ni oçiş',url:this.bot.link()}]]);return true;}
   if(match[1]==='start'&&/^(join|play)_/.test(arg)){
    const g=this.h.rooms.get(arg.replace(/^(join|play)_/,''));check(g?.group,'O‘yin topilmadi');
    if(arg.startsWith('join_'))await this.join(g,m.from);
    else{g.member(id);await this.bot.member(g.group.id,id);await this.h.advance(g);await this.menu(g,id);}
   }else{
    const g=this.h.active(id);
    if(!g){await this.send(id,'Guruhda /mafia yoki /game yuboring. “Telegram orqali qo‘shilish” tugmasidan foydalaning.');return true;}
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
