import {createAdmin} from './admin.js';
import {isOfficialGroup, OFFICIAL_GROUP_USERNAME, OFFICIAL_GROUP_URL} from './official-group.js';
import {GROUP_COMMANDS} from './bot-commands.js';
import { validateProduction } from './config.js';
import { BOOLEAN_RULES, ADVANCED_DEFAULTS, ROLE_ORDER } from './settings.js';
import { createServer } from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Server } from 'socket.io';
import { Game, GameError, DEFAULT_RULES, EXTRA_RULES, OPTIONAL_ROLES } from './game.js';
import { authenticate } from './auth.js';
import { Store } from './store.js';
import { Telegram } from './telegram.js';
import { shouldDeleteGroupMessage } from './moderation.js';
import { GroupVoting } from './group-voting.js';
import { TelegramGame, groupKeyboard } from './telegram-game.js';

const PUBLIC = fileURLToPath(new URL('../public/', import.meta.url));
const sameSecret = (a, b) => typeof a === 'string' && typeof b === 'string' && a.length > 0 && Buffer.byteLength(a) === Buffer.byteLength(b) && timingSafeEqual(Buffer.from(a), Buffer.from(b));
async function body(req) {
  let size = 0; const chunks = [];
  for await (const chunk of req) { size += chunk.length; if (size > 64000) throw new GameError('Sörov juda katta'); chunks.push(chunk); }
  return Buffer.concat(chunks).toString();
}
export function createApp({ botToken, botUsername = '', origin = 'http://localhost:3000', gameOptions = {}, dbPath = ':memory:', webhookSecret = '', telegram, developerUsername = '', adminLogin = '', adminPassword = '', registrationExtensionMs = 30000, requireOfficialGroup = false, requireLinkedRooms = false, demo = false } = {}) {
  if (!botToken && !demo) throw new Error('BOT_TOKEN sozlanmagan. .env.example asosida .env yarating.');
  const store = new Store(dbPath), rooms = store.load();
  store.settleWeeklyRewards();
  let nextRewardCheck=Date.now()+60000;
  const bot = telegram || new Telegram(botToken, botUsername);
  async function subscriptionError(id) {
    if (!requireOfficialGroup || demo) return null;
    try {
      const member = await bot.call('getChatMember', { chat_id: '@'+OFFICIAL_GROUP_USERNAME, user_id: Number(id) });
      if (['creator', 'administrator', 'member'].includes(member.status) ||
          (member.status === 'restricted' && member.is_member)) return null;
      return 'Avval @'+OFFICIAL_GROUP_USERNAME+' guruhiga a’zo bo‘ling.';
    } catch {
      return 'A’zolikni tekshirib bo‘lmadi. Birozdan keyin qayta urinib ko‘ring.';
    }
  }
  async function sendSubscriptionPrompt(chatId, error) {
    await bot.call('sendMessage', {
      chat_id: chatId, text: error,
      reply_markup: { inline_keyboard: [
        [{ text: 'Guruhga a’zo bo‘lish', url: OFFICIAL_GROUP_URL }],
        [{ text: 'Tekshirish ✅', callback_data: 'sub|verify' }]
      ] }
    });
  }
  const groupVoting = new GroupVoting(bot, game => store.save(game));
  function rateTelegram(id){const key='tg:'+id;const l=limits.get(key)||{start:Date.now(),n:0};if(Date.now()-l.start>10000){l.start=Date.now();l.n=0;}l.n++;limits.set(key,l);if(l.n>40)throw new GameError('Juda köp sörov, biroz kuting');}
  const telegramGame=new TelegramGame(bot,{
    rate:rateTelegram,store,developer:/^[a-zA-Z0-9_]{5,32}$/.test(developerUsername.replace(/^@/,''))?developerUsername.replace(/^@/,''):'',
    groups:async id=>{const groups=[];for(const group of store.managedGroups(id)){try{groups.push(await verifyGroup(group.id,id));}catch{}}return groups;},
    rooms,active:id=>activeRoom(id),cooldown:(group,id)=>store.groupCooldown(group,id),
    advance:game=>advance(game),save:game=>store.save(game),publish:game=>publish(game),
    start:async(game,id)=>{if(game.group&&game.rules.adminOnlyStart){await bot.member(game.group.id,id,true);startGame(game,game.ownerId);}else startGame(game,id);},
    leave:async(game,id)=>leaveGame(game,id)
  });
  let queue = Promise.resolve(), closed = false;
  const serial = action => { const result = queue.then(action); queue = result.catch(() => {}); return result; };
  const groupCards = new Map();
  async function groupCard(id) {
    const cached=groupCards.get(id);
    if(cached && cached.expires>Date.now())return cached;
    const chat=await bot.call('getChat',{chat_id:id});
    const username=/^[a-zA-Z0-9_]{5,32}$/.test(chat.username||'')?chat.username:null;
    const card={official:isOfficialGroup(username),name:String(chat.title||'Guruh').slice(0,100),url:username?`https://t.me/${username}`:/^-100[0-9]+$/.test(id)?`https://t.me/c/${id.slice(4)}/1`:null,photoId:chat.photo?.small_file_id||null,expires:Date.now()+300000};
    groupCards.set(id,card);return card;
  }
  async function rankedGroups(period) {
    const result=store.rankings(period);
    for(let i=0;i<result.groups.length;i+=5)await Promise.all(result.groups.slice(i,i+5).map(async row=>{
      try {const card=await groupCard(row.id);row.official=card.official;row.name=card.name;row.url=card.url;row.photoUrl=card.photoId?`/api/group-photo/${encodeURIComponent(row.id)}`:null;}catch {row.official=false;row.url=null;row.photoUrl=null;}
    }));
    for (const player of result.players) player.verified = isVerifiedPlayer(player.id);
    return result;
  }
  const activeRoom = id => [...rooms.values()].find(g => g.phase !== 'finished' && g.players.some(p => p.id === id));
  store.db.exec('CREATE TABLE IF NOT EXISTS room_numbers (number INTEGER PRIMARY KEY AUTOINCREMENT)');
  for (const game of rooms.values()) {
    if (!game.number) {
      game.number = Number(store.db.prepare('INSERT INTO room_numbers DEFAULT VALUES').run().lastInsertRowid);
      store.save(game);
    }
  }
  const makeRoom = (user, group = null, { entryMode, visibility } = {}) => {
    if (activeRoom(user.id)) throw new GameError('Avval mavjud xonangizni tark eting');
    if (rooms.size >= 1000) throw new GameError('Server band');
    const game = new Game(user, { ...gameOptions, rules:{...gameOptions.rules,...(group?store.groupSettings(group.id):{})}, group }); game.number = Number(store.db.prepare('INSERT INTO room_numbers DEFAULT VALUES').run().lastInsertRowid); game.entryMode = entryMode; game.visibility = visibility; rooms.set(game.id, game); if(group) game.deadline=game.now()+game.rules.registrationMs; store.save(game); return game;
  };
  const isVerifiedPlayer = id => id === '6322372175';
  const state = (game, id) => game.view(id);
  function startGame(game,id){for(const p of game.players)p.buffs={...store.inventory(p.id)};game.start(id);}
  async function advance(game) {
    if(game.phase==='lobby' && game.deadline!==null && game.now()>=game.deadline) {
      if(game.players.length>=game.rules.minPlayers) startGame(game,game.ownerId);
      else {game.deadline=null;game.touch();}
      store.save(game);publish(game);return;
    }
    if (game.tick()) { store.save(game); publish(game); }
  }
  async function updateBot(update) {
    if (!Number.isSafeInteger(update.update_id)) throw new GameError('Update notöğri');
    const previous = store.update(update.update_id); if (previous?.sent) return;
    if(update.my_chat_member){
      const change=update.my_chat_member,chat=change.chat;
      if(chat&&['group','supergroup'].includes(chat.type)&&change.new_chat_member?.status!=='administrator')store.db.prepare('INSERT OR REPLACE INTO registered_groups VALUES(?,0)').run(String(chat.id));
      if(chat && ['group','supergroup'].includes(chat.type) && change.new_chat_member?.status==='administrator'){
        // Capture verified admins, never trust the person who merely added the bot.
        const admins=await bot.call('getChatAdministrators',{chat_id:chat.id});
        for(const admin of admins)if(!admin.user?.is_bot && Number.isSafeInteger(admin.user?.id)){
          try{const group=await verifyGroup(String(chat.id),String(admin.user.id));store.manageGroup(group,String(admin.user.id));}catch{}
        }
      }
      store.rememberUpdate(update.update_id);store.sent(update.update_id);return;
    }

    const query = update.callback_query;
    if (requireOfficialGroup && query?.from && !query.from.is_bot &&
        Number.isSafeInteger(query.from.id) && /^sub\|[a-z0-9_-]{1,60}$/i.test(query.data || '')) {
      const error = await subscriptionError(query.from.id);
      const privateChat = query.message?.chat?.type === 'private' && query.message.chat.id === query.from.id;
      await bot.call('answerCallbackQuery', {
        callback_query_id: query.id,
        ...(error ? { text: error, show_alert: true } : {})
      });
      if (!error && privateChat) {
        const id = String(query.from.id);
        store.registerUser(id);
        await telegramGame.home(id);
      }
      store.rememberUpdate(update.update_id);store.sent(update.update_id);return;
    }
    if(query && bot.call){
      const error = query.from?.id && await subscriptionError(query.from.id);
      if (error) await bot.call('answerCallbackQuery', { callback_query_id: query.id, text: error+' Botga /start yuboring.', show_alert: true });
      else await telegramGame.callback(query);
      store.rememberUpdate(update.update_id);store.sent(update.update_id);return;
    }
    const m = update.message;
    const command = /^\/([a-z]+)(?:@([a-z0-9_]+))?(?:\s|$)/i.exec(m?.text || '');
    if (m?.from?.id && !m.from.is_bot && command && (!command[2] || command[2].toLowerCase() === bot.username?.toLowerCase()) &&
        (m.chat?.type === 'private' || /^(mafia|game|appgame|start|extended|stop|next|top|all|share|lastwords)$/i.test(command[1]))) {
      const error = await subscriptionError(m.from.id);
      if (error) {
        await sendSubscriptionPrompt(m.chat.id, error);
        store.rememberUpdate(update.update_id);store.sent(update.update_id);return;
      }
    }
    if(m?.from && Number.isSafeInteger(m.from.id) && !m.from.is_bot && ['group','supergroup'].includes(m.chat?.type)){
      const chatId=String(m.chat.id),userId=String(m.from.id);
      store.db.prepare('INSERT INTO known_group_members VALUES(?,?,?) ON CONFLICT(group_id,user_id) DO UPDATE SET name=excluded.name').run(chatId,userId,String(m.from.first_name||'Öyinçi').slice(0,80));
      for(const u of m.new_chat_members||[])if(Number.isSafeInteger(u.id)&&!u.is_bot)store.db.prepare('INSERT OR REPLACE INTO known_group_members VALUES(?,?,?)').run(chatId,String(u.id),String(u.first_name||'Öyinçi').slice(0,80));
      if(m.left_chat_member)store.db.prepare('DELETE FROM known_group_members WHERE group_id=? AND user_id=?').run(chatId,String(m.left_chat_member.id));
      const cmd=/^\/(extended|stop|next|top|all|share|help)(?:@([a-zA-Z0-9_]+))?(?:\s|$)/i.exec(m.text||'');
      if(cmd&&(!cmd[2]||cmd[2].toLowerCase()===bot.username.toLowerCase())){
        rateTelegram(userId);const command=cmd[1].toLowerCase();
        const game=[...rooms.values()].find(g=>!g.visibility&&g.group?.id===chatId&&g.phase!=='finished');
        let text='';
        if(['extended','stop','all'].includes(command))await bot.member(chatId,userId,true);
        if(command==='extended'){
          if(!game||game.phase!=='lobby'||!game.deadline||game.deadline<=game.now())text='Faol registratsiya yöq.';
          else {game.deadline+=registrationExtensionMs;game.touch();store.save(game);text=`Registratsiya ${registrationExtensionMs/1000} soniyaga uzaytirildi.`;publish(game);}
        }else if(command==='stop'){
          if(!game||game.phase!=='lobby')text='Töxtatiladigan registratsiya yöq.';
          else {rooms.delete(game.id);store.remove(game.id);for(const peer of io.sockets.sockets.values())if(peer.data.roomId===game.id){peer.data.roomId=null;peer.emit('room:expired');}text='Röyxatga oliş töxtatildi.';}
        }else if(command==='next'){
          store.db.prepare('INSERT OR IGNORE INTO next_game_subscriptions VALUES(?,?)').run(chatId,userId);text='Keyingi yangi öyin oçilganda botdan şaxsiy bildirişnoma olasiz. Botni şaxsiy çatda /start bilan oçib qöying.';
        }else if(command==='top'){
          const rows=store.db.prepare('SELECT s.user_id,MAX(s.name) name,COUNT(*) games,SUM(s.won) wins,SUM(s.points) coins FROM scores s JOIN results r ON r.id=s.game_id WHERE r.group_id=? AND s.points>0 GROUP BY s.user_id ORDER BY coins DESC,wins DESC,s.user_id LIMIT 30').all(chatId);
          text='🏆 Guruh öyinçilari reytingi\n'+(rows.map((p,i)=>`${i+1}. ${p.name} — ${p.coins} tanga · ${p.wins} ğalaba`).join('\n')||'Hali hisoblangan öyinlar yöq.');
        }else if(command==='share'){store.registerUser(userId);text=`Döstlaringizni taklif qiling!\nhttps://t.me/${bot.username}?start=ref_${userId}`;}
        else if(command==='help')text=GROUP_COMMANDS.map(c=>`/${c.command} — ${c.description}`).join('\n');
        else if(command==='all'){
          const last=store.db.prepare('SELECT sent FROM group_call_cooldowns WHERE group_id=?').get(chatId);
          if(last?.sent && Date.now()-last.sent<300000)text='Ça qirişdan keyin 5 daqiqa kuting.'.replace('Ça q','Çaq');
          else {
            const members=store.db.prepare('SELECT * FROM known_group_members WHERE group_id=? LIMIT 200').all(chatId);
            const esc=s=>s.replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
            for(let i=0;i<members.length;i+=20){const active=[];for(const u of members.slice(i,i+20))try{await bot.member(chatId,u.user_id);active.push(u);}catch{}if(active.length)await bot.call('sendMessage',{chat_id:chatId,text:'📣 Öyinga marhamat!\n'+active.map(u=>`<a href="tg://user?id=${u.user_id}">${esc(u.name)}</a>`).join(' · '),parse_mode:'HTML'});}
            store.db.prepare('INSERT OR REPLACE INTO group_call_cooldowns VALUES(?,?)').run(chatId,Date.now());
            text='Bot tanigan a’zolar çaqirildi. Telegram barça a’zolar röyxatini bermaydi.';
          }
        }
        await bot.send(chatId,text);store.rememberUpdate(update.update_id);store.sent(update.update_id);return;
      }
    }

    if(m?.chat?.type==='private' && m.from && !m.from.is_bot && Number.isSafeInteger(m.from.id) && String(m.chat.id)===String(m.from.id)) {
      const ref=/^\/start(?:@([a-zA-Z0-9_]+))?\s+ref_([1-9][0-9]{0,19})\s*$/.exec(m.text||'');
      const own=!ref?.[1] || ref[1].toLowerCase()===bot.username.toLowerCase();
      store.registerUser(String(m.from.id),own?ref?.[2]:null);
      store.db.prepare('INSERT OR REPLACE INTO user_directory VALUES(?,?)').run(String(m.from.id),String(m.from.first_name||'Öyinçi').slice(0,80));
    }
    const referralCommand=/^\/(?:referral|referal)(?:@([a-zA-Z0-9_]+))?\s*$/.exec(m?.text||'');
    if(m?.chat?.type==='private' && m.from && !m.from.is_bot && referralCommand && (!referralCommand[1] || referralCommand[1].toLowerCase()===bot.username.toLowerCase())) {
      rateTelegram(String(m.from.id));
      const stats=store.referralStats(String(m.from.id));
      await bot.send(m.chat.id,`Döstlarni taklif qiling!\nhttps://t.me/${bot.username}?start=ref_${m.from.id}\n\nTakliflar: ${stats.invited}\nFaol referallar: ${stats.qualified}\nMukofot: ${stats.earned} tanga\n\nYangi döstingiz birinchi hisoblangan öyinida faol qatnaşsa, ikkalangizga 10 tangadan beriladi.`,'','Mini App’ni oçiş');
      store.rememberUpdate(update.update_id);store.sent(update.update_id);return;
    }
    if(bot.call && await telegramGame.privateMessage(m||{})){store.rememberUpdate(update.update_id);store.sent(update.update_id);return;}
    if(m?.chat && ['group','supergroup'].includes(m.chat.type) && /^\/start(?:@[\w]+)?\s+mafia\s*$/.test(m.text||'')){
      const group=await verifyGroup(String(m.chat.id),String(m.from.id));store.manageGroup(group,String(m.from.id));
      await bot.send(m.chat.id,'Guruh ulandi! Mini App → Guruhlarim bölümida körinadi. Öyinni /mafia bilan oçing.');
      store.rememberUpdate(update.update_id);store.sent(update.update_id);return;
    }
    if(m?.chat && ['group','supergroup'].includes(m.chat.type) && /^\/start(?:@[\w]+)?(?:\s|$)/i.test(m.text||'')){
      const game=[...rooms.values()].find(g=>!g.visibility&&g.group?.id===String(m.chat.id)&&g.phase==='lobby');
      if(game){
        try{await advance(game);if(game.rules.adminOnlyStart){await bot.member(game.group.id,String(m.from.id),true);startGame(game,game.ownerId);}else startGame(game,String(m.from.id));store.save(game);publish(game);}
        catch(e){await bot.send(m.chat.id,e instanceof GameError?e.message:'Öyin boşlanmadi.');}
        store.rememberUpdate(update.update_id);store.sent(update.update_id);return;
      }
    }
    if(m?.from && !m.from.is_bot && ['group','supergroup'].includes(m.chat?.type)) {
      const game=[...rooms.values()].find(g=>!g.visibility&&g.group?.id===String(m.chat.id)&&!['lobby','finished'].includes(g.phase));
      const rules=game?.rules || {...ADVANCED_DEFAULTS,...store.groupSettings(String(m.chat.id))};
      const p=game?.players.find(p=>p.id===String(m.from.id));
      const command=/^\/(mute|unmute)(?:@([\w]+))?(?:\s|$)/i.exec(m.text||'');
      if(command && (!command[2] || command[2].toLowerCase()===bot.username.toLowerCase()) && rules.moderatorEnabled && m.reply_to_message?.from && !m.reply_to_message.from.is_bot) {
        await bot.member(String(m.chat.id),String(m.from.id),true);
        const target=m.reply_to_message.from.id; const member=await bot.call('getChatMember',{chat_id:m.chat.id,user_id:target});
        if(!['creator','administrator'].includes(member.status))await bot.call('restrictChatMember',{chat_id:m.chat.id,user_id:target,permissions:{can_send_messages:command[1].toLowerCase()==='unmute'},...(command[1].toLowerCase()==='mute'?{until_date:Math.floor(Date.now()/1000)+3600}:{})});
        store.rememberUpdate(update.update_id);store.sent(update.update_id);return;
      }
      if(game && shouldDeleteGroupMessage(game,m)) {
        const member=await bot.call('getChatMember',{chat_id:m.chat.id,user_id:m.from.id});
        if(!['creator','administrator'].includes(member.status))await bot.call('deleteMessage',{chat_id:m.chat.id,message_id:m.message_id});
        store.rememberUpdate(update.update_id);store.sent(update.update_id);return;
      }
    }
    if (!m?.from || m.from.is_bot || typeof m.text !== 'string') { store.rememberUpdate(update.update_id); store.sent(update.update_id); return; }
    const match = /^\/(mafia|game|appgame|sozlash|start|help)(?:@([\w]+))?(?:\s|$)/i.exec(m.text);
    if (!match || (match[2] && match[2].toLowerCase() !== bot.username.toLowerCase())) return;
    if (!Number.isSafeInteger(m.from.id) || !Number.isSafeInteger(m.chat?.id)) throw new GameError('Update notöğri');
    if(match[1].toLowerCase()==='sozlash' && ['group','supergroup'].includes(m.chat.type)) {
      const group=await verifyGroup(String(m.chat.id),String(m.from.id));
      store.manageGroup(group,String(m.from.id)); store.rememberUpdate(update.update_id);
      await bot.send(m.chat.id,'Guruh ulandi. Mini App → Profil → Guruhlarim orqali sozlang.');
      store.sent(update.update_id); return;
    }
    if (['mafia','game','appgame'].includes(match[1].toLowerCase()) && ['group', 'supergroup'].includes(m.chat.type)) {
      await bot.member(String(m.chat.id), String(m.from.id), true);
      let game = previous?.room_id ? rooms.get(previous.room_id) : [...rooms.values()].find(g => g.group?.id === String(m.chat.id) && g.phase !== 'finished');
      if (game?.visibility) {
        await bot.send(m.chat.id, 'Bu guruhda Mini App xonasi faol.');
        store.rememberUpdate(update.update_id);store.sent(update.update_id);return;
      }
      if (!game) game = makeRoom({ id: String(m.from.id), name: m.from.first_name || 'Öyinçi' }, { id: String(m.chat.id), name: String(m.chat.title || 'Guruh').slice(0, 100) });
      const watchers=store.db.prepare('SELECT user_id FROM next_game_subscriptions WHERE group_id=?').all(String(m.chat.id));
      if(!game.nextNotified){for(const watcher of watchers)try{await bot.send(watcher.user_id,`${game.group.name}: yangi öyin oçildi!`,game.id);store.db.prepare('DELETE FROM next_game_subscriptions WHERE group_id=? AND user_id=?').run(String(m.chat.id),watcher.user_id);}catch{}game.nextNotified=true;store.save(game);}
      if(!game.entryMode){game.entryMode=match[1].toLowerCase()==='appgame'?'miniapp':'telegram';store.save(game);}
      store.rememberUpdate(update.update_id, game.id);
      const sent=await bot.send(m.chat.id, `${game.group.name} · #${game.number}\n${game.entryMode==='miniapp'?'Mini App öyin xonasi oçiq. Mini App orqali qöşiling.':'Guruh öyin xonasi oçiq. Telegram orqali qöşiling.'}`, game.id,'',{...(bot.link?{reply_markup:groupKeyboard(bot,game)}:{})});
      if (sent?.message_id) { game.registrationMessageId = sent.message_id; store.save(game); }
      if(game.rules.pinRegistration && sent?.message_id)await bot.call('pinChatMessage',{chat_id:m.chat.id,message_id:sent.message_id,disable_notification:true});
    } else {
      store.rememberUpdate(update.update_id);
      await bot.send(m.chat.id, 'Mafia • Tun şahri\nMini App içida xona yarating yoki guruhda /mafia buyruğidan foydalaning. Guruh xonasini administrator oçadi.');
    }
    store.sent(update.update_id);
  }
  async function verifyGroup(ref,userId) {
    if(typeof ref!=='string'||!/^(-[0-9]{1,18}|@[a-zA-Z0-9_]{5,32})$/.test(ref)) throw new GameError('Guruh @username yoki Telegram ID sini kiriting');
    const chat=await bot.call('getChat',{chat_id:ref});
    if(!['group','supergroup'].includes(chat.type)) throw new GameError('Faqat guruh ulaş mumkin');
    const id=String(chat.id); await bot.member(id,userId,true);
    const me=await bot.call('getMe',{}); await bot.member(id,String(me.id),true);
    return {id,name:String(chat.title||'Guruh').slice(0,100)};
  }
  function validateSettings(settings) {
    if(!settings||typeof settings!=='object'||Array.isArray(settings)) throw new GameError('Sozlamalar notöğri');
    const result={};
    for(const key of Object.keys(DEFAULT_RULES)) {
      const value=settings[key],min=key.endsWith('Ms')?10000:6,max=key.endsWith('Ms')?120000:20;
      if(!Number.isInteger(value)||value<min||value>max) throw new GameError('Öyinçilar 6–20, bosqiç vaqtlari 10–120 soniya bölsin');
      result[key]=value;
    }
    if(result.minPlayers>result.maxPlayers) throw new GameError('Minimal son maksimal sondan katta');
    for(const key of Object.keys(BOOLEAN_RULES)) {
      if(settings[key] !== undefined && typeof settings[key] !== 'boolean') throw new GameError('Sozlama notöğri');
      result[key]=settings[key] ?? BOOLEAN_RULES[key];
    }
    for(const [key,allowed] of [['mafiaDivisor',[3,4]],['exitCooldownMs',[0,1800000,3600000,7200000,10800000,21600000,43200000,86400000]]]) {
      result[key]=settings[key] ?? ADVANCED_DEFAULTS[key]; if(!allowed.includes(result[key])) throw new GameError('Sozlama notöğri');
    }
    result.registrationMs=settings.registrationMs ?? ADVANCED_DEFAULTS.registrationMs;
    if(!Number.isInteger(result.registrationMs)||result.registrationMs<30000||result.registrationMs>600000)throw new GameError('Röyxat vaqti 30–600 soniya bölsin');
    result.roleOrder=settings.roleOrder ?? ROLE_ORDER;
    if(!Array.isArray(result.roleOrder)||result.roleOrder.length!==ROLE_ORDER.length||new Set(result.roleOrder).size!==ROLE_ORDER.length||result.roleOrder.some(r=>!ROLE_ORDER.includes(r)))throw new GameError('Rollar tartibi notöğri');
    const enabled=settings.enabledRoles ?? OPTIONAL_ROLES;
    if(!Array.isArray(enabled)||enabled.some(r=>!OPTIONAL_ROLES.includes(r))||new Set(enabled).size!==enabled.length) throw new GameError('Rollar notöğri');
    result.enabledRoles=[...enabled];
    return result;
  }
  const adminHandler=createAdmin({login:adminLogin,password:adminPassword,origin,store,rooms});
  const http = createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store'); res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('Referrer-Policy', 'no-referrer');
    const json = (code, data) => { res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(data)); };
    try {
      const pathname = new URL(req.url, 'http://localhost').pathname;
      if(pathname.startsWith('/api/admin/'))return await serial(()=>adminHandler(req,res,pathname,body));
      if(req.method==='GET' && pathname.startsWith('/api/group-photo/')) {
        const id=decodeURIComponent(pathname.slice('/api/group-photo/'.length));
        const card=groupCards.get(id);
        if(!card?.photoId || !bot.photo) return json(404,{error:'Photo unavailable'});
        const data=await bot.photo(card.photoId);
        res.writeHead(200,{'Content-Type':'image/jpeg','Cache-Control':'public, max-age=300'});res.end(data);return;
      }
      if (req.method === 'GET' && pathname === '/health') return json(200, { ok: true, stage: 'mini-app-v0.2', storage: dbPath === ':memory:' ? 'memory' : 'sqlite', demo });
      if (req.method === 'GET' && pathname === '/api/config') return json(200, { botUsername: bot.username, demo });
      if (req.method === 'POST' && pathname === '/telegram/webhook') {
        if (demo || !sameSecret(req.headers['x-telegram-bot-api-secret-token'], webhookSecret)) return json(403, { error: 'Forbidden' });
        const data = JSON.parse(await body(req)); await serial(() => updateBot(data)); return json(200, { ok: true });
      }
      if (req.method !== 'GET') return json(405, { error: 'Method not allowed' });
      const assets = { '/admin':['admin.html','text/html'], '/admin/':['admin.html','text/html'], '/admin.js':['admin.js','text/javascript'], '/admin.css':['admin.css','text/css'], '/': ['index.html', 'text/html'], '/app.js': ['app.js', 'text/javascript'], '/app.css': ['app.css', 'text/css'], '/styles.css': ['styles.css', 'text/css'], '/theme.css': ['theme.css', 'text/css'], '/tabler.css': ['tabler.css', 'text/css'] };
      for (const id of ['commissioner', 'sergeant', 'doctor', 'maniac', 'mistress', 'lawyer', 'suicide', 'hobo', 'lucky', 'kamikaze', 'bodyguard', 'mayor', 'journalist', 'citizen']) assets[`/images/${id}-2d.png`] = [`images/${id}-2d.png`, 'image/png'];
      if (!assets[pathname]) return json(404, { error: 'Not found' });
      const [file, type] = assets[pathname], data = await readFile(resolve(PUBLIC, file));
      res.writeHead(200, { 'Content-Type': type === 'image/png' ? type : `${type}; charset=utf-8` }); res.end(data);
    } catch (e) { json(e instanceof SyntaxError ? 400 : 503, { error: 'Sörov bajarilmadi. Sozlamalarni tekşiring.' }); }
  });
  async function leaveGame(game,id){
    if(game.phase!=='lobby'&&game.phase!=='finished'){
      game.alive(id);game.eliminate(id);game.touch();if(game.group&&game.rules.exitCooldownMs)store.setGroupCooldown(game.group.id,id,Date.now()+game.rules.exitCooldownMs);game.checkWinner();
    }else if(game.phase==='lobby')game.leave(id);
    for(const peer of io.sockets.sockets.values())if(peer.data.user.id===id&&peer.data.roomId===game.id){peer.data.roomId=null;peer.emit('room:left');}
    if(!game.players.length){rooms.delete(game.id);store.remove(game.id);}else{store.save(game);publish(game);}
  }
  const io = new Server(http, { cors: { origin }, maxHttpBufferSize: 20000, allowRequest: (req, callback) => callback(null, !req.headers.origin || req.headers.origin === origin) });
  io.use(async (socket, next) => {
    try {
      socket.data.user = authenticate(socket.handshake.auth?.initData, botToken);
      const error = await subscriptionError(socket.data.user.id);
      if (error) {
        const denied = new Error(error);
        denied.data = { subscriptionUrl: OFFICIAL_GROUP_URL };
        return next(denied);
      }
      store.db.prepare('INSERT OR REPLACE INTO user_directory VALUES(?,?)').run(socket.data.user.id,socket.data.user.name);
      const startParam=new URLSearchParams(socket.handshake.auth.initData).get('start_param');
      store.registerUser(socket.data.user.id,/^ref_([1-9][0-9]{0,19})$/.exec(startParam||'')?.[1]);
      const expiry = (Number(new URLSearchParams(socket.handshake.auth.initData).get('auth_date')) + 3600) * 1000;
      const timer = setTimeout(() => socket.disconnect(true), Math.max(1, expiry - Date.now())); timer.unref();
      socket.once('disconnect', () => clearTimeout(timer)); next();
    } catch { next(new Error('Telegram orqali qayta kiring')); }
  });
  function publish(game) {
    if (!game.visibility) groupVoting.publish(game);
    telegramGame.publish(game);
    for (const socket of io.sockets.sockets.values()) if (socket.data.roomId === game.id && game.players.some(p => p.id === socket.data.user.id)) socket.emit('game:state', state(game, socket.data.user.id));
  }
  const limits = new Map();
  io.on('connection', socket => {
    const user = socket.data.user;
    function handle(event, action) {
      socket.on(event, (payload, ack) => {
        if (typeof ack !== 'function') return;
        const limit = limits.get(user.id) || { start: Date.now(), n: 0 }; if (Date.now() - limit.start > 10000) { limit.start = Date.now(); limit.n = 0; }
        limit.n++; limits.set(user.id, limit);
        if (limit.n > 40) return ack({ ok: false, error: 'Juda köp sörov, biroz kuting' });
        if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return ack({ ok: false, error: 'Sörov notöğri' });
        serial(async () => { if (!socket.connected) return; try { ack({ ok: true, ...await action(payload) }); } catch (error) { ack({ ok: false, error: error instanceof GameError ? error.message : 'Sörovni bajarib bölmadi' }); } });
      });
    }
    handle('home:get', async () => {
      const active = activeRoom(user.id);
      const listed = [...rooms.values()].filter(g =>
        g.entryMode === 'telegram' ? g.phase !== 'finished' :
        g.phase === 'lobby' && (g.visibility === 'public' || (!g.group && !g.visibility)));
      const visibleRooms = await Promise.all(listed.map(async g => {
        const telegramOnly = g.entryMode === 'telegram';
        let url = null;
        if (telegramOnly) {
          try {
            const card = await groupCard(g.group.id);
            url = card.url;
            if (g.registrationMessageId && url) url = url.startsWith('https://t.me/c/')
              ? `https://t.me/c/${g.group.id.slice(4)}/${g.registrationMessageId}`
              : `${url}/${g.registrationMessageId}`;
          } catch {}
        }
        return {
          id: telegramOnly ? undefined : g.id, number: g.number,
          name: g.group?.name || `${g.players[0]?.name || 'Mafia'} xonasi`,
          count: g.players.length, max: g.rules.maxPlayers, telegramOnly, started: g.phase !== 'lobby', url
        };
      }));
      return { me: { ...user, verified: isVerifiedPlayer(user.id) }, profile: store.profile(user.id), inventory:store.inventory(user.id),
        referrals:store.referralStats(user.id), weeklyRewards:store.weeklyRewards(user.id),
        activeRoom: active && (!requireLinkedRooms || active.entryMode !== 'telegram') ? active.id : null, rooms: visibleRooms };
    });
    handle('shop:buy',({item})=>{try{return {inventory:store.buyItem(user.id,item)};}catch(e){throw new GameError(e.message);}});
    handle('groups:list',async()=>{
      const groups=[];
      for(const group of store.managedGroups(user.id)) {
        try { const current=await verifyGroup(group.id,user.id); groups.push({...current,settings:{...DEFAULT_RULES,...ADVANCED_DEFAULTS,...group.settings}}); } catch {}
      }
      return {groups};
    });
    handle('groups:add',async({ref})=>{const group=await verifyGroup(ref,user.id);return {group:store.manageGroup(group,user.id,{...DEFAULT_RULES,...store.groupSettings(group.id)})};});
    handle('groups:save',async({groupId,settings})=>{const group=await verifyGroup(groupId,user.id);return {group:store.manageGroup(group,user.id,validateSettings(settings))};});
    handle('players:profile', ({userId}) => {
      if(typeof userId!=='string'||!/^\d{1,20}$/.test(userId))throw new GameError('Öyinçi ID notöğri');
      const row=store.db.prepare('SELECT name FROM scores WHERE user_id=? ORDER BY rowid DESC LIMIT 1').get(userId);
      if(!row)throw new GameError('Öyinçi topilmadi');
      return {player:{id:userId,name:row.name,...store.profile(userId)}};
    });
    handle('rankings:get', ({ period }) => { if (!['week', 'month', 'all'].includes(period)) throw new GameError('Davr notöğri'); return rankedGroups(period); });
    handle('room:create', async ({ groupId, visibility }) => {
      let group = null;
      if (requireLinkedRooms || groupId) {
        if (!store.managedGroups(user.id).some(g => g.id === groupId)) throw new GameError('Avval guruhingizni ulang');
        if (!['public', 'private'].includes(visibility)) throw new GameError('Xona turini tanlang');
        group = await verifyGroup(groupId, user.id);
        if ([...rooms.values()].some(g => g.group?.id === groupId && g.phase !== 'finished')) {
          throw new GameError('Bu guruhda faol xona bor');
        }
      }
      const game = makeRoom(user, group, group ? { entryMode: 'miniapp', visibility } : {});
      socket.data.roomId = game.id; publish(game); return { state: state(game, user.id) };
    });
    handle('room:join', async ({ roomId }) => {
      const game = rooms.get(roomId); if (!game) throw new GameError('Xona topilmadi yoki muddati tugagan');
      if (requireLinkedRooms && game.entryMode === 'telegram') throw new GameError('Bu o‘yinga Telegram guruhidan qo‘shiling');
      const current = activeRoom(user.id); if (current && current.id !== roomId) throw new GameError('Siz boşqa xonadasiz');
      if (game.group) {if (!game.visibility) await bot.member(game.group.id, user.id);const cooldown=store.groupCooldown(game.group.id,user.id);if(cooldown>Date.now())throw new GameError('Oldingi öyindan çiqiş çeklovi hali tugamagan');}
      await advance(game); game.join(user); store.save(game); socket.data.roomId = roomId; publish(game); return { state: state(game, user.id) };
    });
    async function current() { const game = rooms.get(socket.data.roomId); if (!game) throw new GameError('Avval xonaga kiring'); game.member(user.id); await advance(game); return game; }
    handle('room:leave', async () => {
      const game=await current();await leaveGame(game,user.id);return {};
    });
    handle('game:start', async () => { const game = await current(); if(game.group && game.rules.adminOnlyStart) {await bot.member(game.group.id,user.id,true);startGame(game,game.ownerId);} else startGame(game,user.id); store.save(game); publish(game); return {}; });
    handle('game:sync', async () => { const game = await current(); return { state: state(game, user.id) }; });
    handle('game:night-action', async ({ targetId, targetIds, mode, skip, revision }) => {
      const game = await current(), previous = game.revision;
      try { game.nightAction(user.id, { targetId, targetIds, mode, skip }, revision); return { state: state(game, user.id) }; }
      finally { store.save(game); if (game.revision !== previous) publish(game); }
    });
    handle('game:kamikaze', async ({ targetId, revision }) => {
      const game = await current(), previous = game.revision;
      try { game.kamikazeAction(user.id, targetId, revision); return { state: state(game, user.id) }; }
      finally { store.save(game); if (game.revision !== previous) publish(game); }
    });
    handle('game:vote', async ({ targetId, confirm, skip, revision }) => {
      const game = await current(), previous = game.revision;
      try { game.vote(user.id, { targetId, confirm, skip }, revision); return { state: state(game, user.id) }; }
      finally { store.save(game); if (game.revision !== previous) publish(game); }
    });
    handle('game:last-words',async({text})=>{const game=await current();game.lastWords(user.id,text);store.save(game);publish(game);return {state:state(game,user.id)};});
    handle('game:chat',async({text})=>{const game=await current();game.sendChat(user.id,text);store.save(game);publish(game);return {state:state(game,user.id)};});
  });
  let ticking = false;
  const timer = setInterval(() => {
    if (ticking || closed) return; ticking = true;
    serial(async () => {
      if(Date.now()>=nextRewardCheck){store.settleWeeklyRewards();nextRewardCheck=Date.now()+60000;}
      for (const [id, game] of rooms) {
        try { await advance(game); } catch { continue; }
        if (['lobby', 'finished'].includes(game.phase) && Date.now() - game.updatedAt > 3600000) {
          rooms.delete(id); store.remove(id);
          for (const peer of io.sockets.sockets.values()) if (peer.data.roomId === id) { peer.data.roomId = null; peer.emit('room:expired'); }
        }
      }
      for (const [id, limit] of limits) if (Date.now() - limit.start > 60000) limits.delete(id);
    }).catch(() => console.error('Game timer/storage operation failed')).finally(() => ticking = false);
  }, 250); timer.unref();
  return { http, io, rooms, store, close: async () => { closed = true; clearInterval(timer); await queue; await groupVoting.queue; await telegramGame.queue; await new Promise(resolve => io.close(resolve)); store.close(); } };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  validateProduction(process.env);
  const demo = process.env.DEMO_MODE === 'true';
  if (demo && process.env.NODE_ENV === 'production') throw new Error('Production’da demo rejimi taqiqlangan');
  const app = createApp({ botToken: process.env.BOT_TOKEN, botUsername: process.env.BOT_USERNAME, origin: process.env.APP_ORIGIN, dbPath: process.env.DB_PATH || 'data/mafia.sqlite', webhookSecret: process.env.TELEGRAM_WEBHOOK_SECRET, developerUsername:process.env.DEVELOPER_USERNAME, adminLogin:process.env.ADMIN_LOGIN, adminPassword:process.env.ADMIN_PASSWORD, requireOfficialGroup: true, requireLinkedRooms: true, demo });
  const host = demo ? '127.0.0.1' : process.env.HOST || '127.0.0.1', port = Number(process.env.PORT || 3000);
  app.http.listen(port, host, () => console.log(`Mafia Mini App: http://${host}:${port}`));
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, async () => { await app.close(); process.exit(0); });
}
