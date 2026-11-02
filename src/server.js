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
import { Voice } from './voice.js';
import { shouldDeleteGroupMessage } from './moderation.js';
import { GroupVoting } from './group-voting.js';
import { TelegramGame, groupKeyboard } from './telegram-game.js';

const PUBLIC = fileURLToPath(new URL('../public/', import.meta.url));
const sameSecret = (a, b) => typeof a === 'string' && typeof b === 'string' && a.length > 0 && Buffer.byteLength(a) === Buffer.byteLength(b) && timingSafeEqual(Buffer.from(a), Buffer.from(b));
async function body(req) {
  let size = 0; const chunks = [];
  for await (const chunk of req) { size += chunk.length; if (size > 64000) throw new GameError('So‘rov juda katta'); chunks.push(chunk); }
  return Buffer.concat(chunks).toString();
}
export function createApp({ botToken, botUsername = '', origin = 'http://localhost:3000', gameOptions = {}, dbPath = ':memory:', webhookSecret = '', telegram, voice, demo = false } = {}) {
  if (!botToken && !demo) throw new Error('BOT_TOKEN sozlanmagan. .env.example asosida .env yarating.');
  const store = new Store(dbPath), rooms = store.load();
  store.settleWeeklyRewards();
  let nextRewardCheck=Date.now()+60000;
  const bot = telegram || new Telegram(botToken, botUsername), audio = voice || new Voice();
  const groupVoting = new GroupVoting(bot, game => store.save(game));
  const telegramGame=new TelegramGame(bot,{
    rate:id=>{const key='tg:'+id;const l=limits.get(key)||{start:Date.now(),n:0};if(Date.now()-l.start>10000){l.start=Date.now();l.n=0;}l.n++;limits.set(key,l);if(l.n>40)throw new GameError('Juda ko‘p so‘rov, biroz kuting');},
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
    const card={name:String(chat.title||'Guruh').slice(0,100),url:username?`https://t.me/${username}`:/^-100[0-9]+$/.test(id)?`https://t.me/c/${id.slice(4)}/1`:null,photoId:chat.photo?.small_file_id||null,expires:Date.now()+300000};
    groupCards.set(id,card);return card;
  }
  async function rankedGroups(period) {
    const result=store.rankings(period);
    for(let i=0;i<result.groups.length;i+=5)await Promise.all(result.groups.slice(i,i+5).map(async row=>{
      try {const card=await groupCard(row.id);row.name=card.name;row.url=card.url;row.photoUrl=card.photoId?`/api/group-photo/${encodeURIComponent(row.id)}`:null;}catch {row.url=null;row.photoUrl=null;}
    }));
    return result;
  }
  const activeRoom = id => [...rooms.values()].find(g => g.phase !== 'finished' && g.players.some(p => p.id === id));
  const makeRoom = (user, group = null) => {
    if (activeRoom(user.id)) throw new GameError('Avval mavjud xonangizni tark eting');
    if (rooms.size >= 1000) throw new GameError('Server band');
    const game = new Game(user, { ...gameOptions, rules:{...gameOptions.rules,...(group?store.groupSettings(group.id):{})}, group }); rooms.set(game.id, game); if(group) game.deadline=game.now()+game.rules.registrationMs; store.save(game); return game;
  };
  const state = (game, id) => ({ ...game.view(id), voice: { enabled: audio.allowed(game, id), configured: audio.enabled, transport: audio.enabled ? 'livekit' : 'not-configured' } });
  function startGame(game,id){for(const p of game.players)p.buffs={...store.inventory(p.id)};game.start(id);}
  async function advance(game) {
    if(game.phase==='lobby' && game.deadline!==null && game.now()>=game.deadline) {
      if(game.players.length>=game.rules.minPlayers) startGame(game,game.ownerId);
      else {game.deadline=null;game.touch();}
      store.save(game);publish(game);return;
    }
    if (game.deadline !== null && game.now() >= game.deadline && game.phase === 'discussion') {
      try { await audio.close(game); } catch { throw new GameError('Ovozli xona yopilmoqda, biroz kuting'); }
    }
    if (game.tick()) { store.save(game); publish(game); }
  }
  async function updateBot(update) {
    if (!Number.isSafeInteger(update.update_id)) throw new GameError('Update noto‘g‘ri');
    const previous = store.update(update.update_id); if (previous?.sent) return;
    if(update.callback_query && bot.call){await telegramGame.callback(update.callback_query);store.rememberUpdate(update.update_id);store.sent(update.update_id);return;}
    const m = update.message;
    if(bot.call && await telegramGame.privateMessage(m||{})){store.rememberUpdate(update.update_id);store.sent(update.update_id);return;}
    if(m?.chat && ['group','supergroup'].includes(m.chat.type) && /^\/start(?:@[\w]+)?(?:\s|$)/i.test(m.text||'')){
      const game=[...rooms.values()].find(g=>g.group?.id===String(m.chat.id)&&g.phase==='lobby');
      if(game){
        try{await advance(game);if(game.rules.adminOnlyStart){await bot.member(game.group.id,String(m.from.id),true);startGame(game,game.ownerId);}else startGame(game,String(m.from.id));store.save(game);publish(game);}
        catch(e){await bot.send(m.chat.id,e instanceof GameError?e.message:'O‘yin boshlanmadi.');}
        store.rememberUpdate(update.update_id);store.sent(update.update_id);return;
      }
    }
    if(m?.from && !m.from.is_bot && ['group','supergroup'].includes(m.chat?.type)) {
      const game=[...rooms.values()].find(g=>g.group?.id===String(m.chat.id)&&!['lobby','finished'].includes(g.phase));
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
    const match = /^\/(mafia|game|sozlash|start|help)(?:@([\w]+))?(?:\s|$)/i.exec(m.text);
    if (!match || (match[2] && match[2].toLowerCase() !== bot.username.toLowerCase())) return;
    if (!Number.isSafeInteger(m.from.id) || !Number.isSafeInteger(m.chat?.id)) throw new GameError('Update noto‘g‘ri');
    if(match[1].toLowerCase()==='sozlash' && ['group','supergroup'].includes(m.chat.type)) {
      const group=await verifyGroup(String(m.chat.id),String(m.from.id));
      store.manageGroup(group,String(m.from.id)); store.rememberUpdate(update.update_id);
      await bot.send(m.chat.id,'Guruh ulandi. Mini App → Profil → Guruhlarim orqali sozlang.');
      store.sent(update.update_id); return;
    }
    if (['mafia','game'].includes(match[1].toLowerCase()) && ['group', 'supergroup'].includes(m.chat.type)) {
      await bot.member(String(m.chat.id), String(m.from.id), true);
      let game = previous?.room_id ? rooms.get(previous.room_id) : [...rooms.values()].find(g => g.group?.id === String(m.chat.id) && g.phase !== 'finished');
      if (!game) game = makeRoom({ id: String(m.from.id), name: m.from.first_name || 'O‘yinchi' }, { id: String(m.chat.id), name: String(m.chat.title || 'Guruh').slice(0, 100) });
      store.rememberUpdate(update.update_id, game.id);
      const sent=await bot.send(m.chat.id, `${game.group.name}\nMafia xonasi ochiq. Telegram orqali yoki Mini App’dan qo‘shiling.`, game.id,'',{...(bot.link?{reply_markup:groupKeyboard(bot,game)}:{})});
      if(game.rules.pinRegistration && sent?.message_id)await bot.call('pinChatMessage',{chat_id:m.chat.id,message_id:sent.message_id,disable_notification:true});
    } else {
      store.rememberUpdate(update.update_id);
      await bot.send(m.chat.id, 'Mafia • Tun shahri\nMini App ichida xona yarating yoki guruhda /mafia buyrug‘idan foydalaning. Guruh xonasini administrator ochadi.');
    }
    store.sent(update.update_id);
  }
  async function verifyGroup(ref,userId) {
    if(typeof ref!=='string'||!/^(-[0-9]{1,18}|@[a-zA-Z0-9_]{5,32})$/.test(ref)) throw new GameError('Guruh @username yoki Telegram ID sini kiriting');
    const chat=await bot.call('getChat',{chat_id:ref});
    if(!['group','supergroup'].includes(chat.type)) throw new GameError('Faqat guruh ulash mumkin');
    const id=String(chat.id); await bot.member(id,userId,true);
    const me=await bot.call('getMe',{}); await bot.member(id,String(me.id),true);
    return {id,name:String(chat.title||'Guruh').slice(0,100)};
  }
  function validateSettings(settings) {
    if(!settings||typeof settings!=='object'||Array.isArray(settings)) throw new GameError('Sozlamalar noto‘g‘ri');
    const result={};
    for(const key of Object.keys(DEFAULT_RULES)) {
      const value=settings[key],min=key.endsWith('Ms')?10000:6,max=key.endsWith('Ms')?120000:20;
      if(!Number.isInteger(value)||value<min||value>max) throw new GameError('O‘yinchilar 6–20, bosqich vaqtlari 10–120 soniya bo‘lsin');
      result[key]=value;
    }
    if(result.minPlayers>result.maxPlayers) throw new GameError('Minimal son maksimal sondan katta');
    for(const key of Object.keys(BOOLEAN_RULES)) {
      if(settings[key] !== undefined && typeof settings[key] !== 'boolean') throw new GameError('Sozlama noto‘g‘ri');
      result[key]=settings[key] ?? BOOLEAN_RULES[key];
    }
    for(const [key,allowed] of [['mafiaDivisor',[3,4]],['exitCooldownMs',[0,1800000,3600000,7200000,10800000,21600000,43200000,86400000]]]) {
      result[key]=settings[key] ?? ADVANCED_DEFAULTS[key]; if(!allowed.includes(result[key])) throw new GameError('Sozlama noto‘g‘ri');
    }
    result.registrationMs=settings.registrationMs ?? ADVANCED_DEFAULTS.registrationMs;
    if(!Number.isInteger(result.registrationMs)||result.registrationMs<30000||result.registrationMs>600000)throw new GameError('Ro‘yxat vaqti 30–600 soniya bo‘lsin');
    result.roleOrder=settings.roleOrder ?? ROLE_ORDER;
    if(!Array.isArray(result.roleOrder)||result.roleOrder.length!==ROLE_ORDER.length||new Set(result.roleOrder).size!==ROLE_ORDER.length||result.roleOrder.some(r=>!ROLE_ORDER.includes(r)))throw new GameError('Rollar tartibi noto‘g‘ri');
    const enabled=settings.enabledRoles ?? OPTIONAL_ROLES;
    if(!Array.isArray(enabled)||enabled.some(r=>!OPTIONAL_ROLES.includes(r))||new Set(enabled).size!==enabled.length) throw new GameError('Rollar noto‘g‘ri');
    result.enabledRoles=[...enabled];
    return result;
  }
  const http = createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store'); res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('Referrer-Policy', 'no-referrer');
    const json = (code, data) => { res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(data)); };
    try {
      const pathname = new URL(req.url, 'http://localhost').pathname;
      if(req.method==='GET' && pathname.startsWith('/api/group-photo/')) {
        const id=decodeURIComponent(pathname.slice('/api/group-photo/'.length));
        const card=groupCards.get(id);
        if(!card?.photoId || !bot.photo) return json(404,{error:'Photo unavailable'});
        const data=await bot.photo(card.photoId);
        res.writeHead(200,{'Content-Type':'image/jpeg','Cache-Control':'public, max-age=300'});res.end(data);return;
      }
      if (req.method === 'GET' && pathname === '/health') return json(200, { ok: true, stage: 'mini-app-v0.2', storage: dbPath === ':memory:' ? 'memory' : 'sqlite', voice: audio.enabled, demo });
      if (req.method === 'GET' && pathname === '/api/config') return json(200, { botUsername: bot.username, demo, voice: audio.enabled });
      if (req.method === 'POST' && pathname === '/telegram/webhook') {
        if (demo || !sameSecret(req.headers['x-telegram-bot-api-secret-token'], webhookSecret)) return json(403, { error: 'Forbidden' });
        const data = JSON.parse(await body(req)); await serial(() => updateBot(data)); return json(200, { ok: true });
      }
      if (req.method === 'POST' && pathname === '/livekit/webhook') {
        if (!audio.enabled) return json(503, { error: 'Voice unavailable' });
        const data = await body(req); await serial(() => audio.handleWebhook(data, req.headers.authorization, rooms)); return json(200, { ok: true });
      }
      if (req.method !== 'GET') return json(405, { error: 'Method not allowed' });
      const assets = { '/': ['index.html', 'text/html'], '/app.js': ['app.js', 'text/javascript'], '/app.css': ['app.css', 'text/css'], '/styles.css': ['styles.css', 'text/css'], '/theme.css': ['theme.css', 'text/css'], '/tabler.css': ['tabler.css', 'text/css'] };
      for (const id of ['commissioner', 'sergeant', 'doctor', 'maniac', 'mistress', 'lawyer', 'suicide', 'hobo', 'lucky', 'kamikaze', 'bodyguard', 'mayor', 'journalist', 'citizen']) assets[`/images/${id}-2d.png`] = [`images/${id}-2d.png`, 'image/png'];
      if (!assets[pathname]) return json(404, { error: 'Not found' });
      const [file, type] = assets[pathname], data = await readFile(resolve(PUBLIC, file));
      res.writeHead(200, { 'Content-Type': type === 'image/png' ? type : `${type}; charset=utf-8` }); res.end(data);
    } catch (e) { json(e instanceof SyntaxError ? 400 : 503, { error: 'So‘rov bajarilmadi. Sozlamalarni tekshiring.' }); }
  });
  async function leaveGame(game,id){
    if(game.phase!=='lobby'&&game.phase!=='finished'){
      game.alive(id);game.eliminate(id);game.touch();if(game.group&&game.rules.exitCooldownMs)store.setGroupCooldown(game.group.id,id,Date.now()+game.rules.exitCooldownMs);game.checkWinner();
    }else if(game.phase==='lobby')game.leave(id);
    for(const peer of io.sockets.sockets.values())if(peer.data.user.id===id&&peer.data.roomId===game.id){peer.data.roomId=null;peer.emit('room:left');}
    if(!game.players.length){rooms.delete(game.id);store.remove(game.id);}else{store.save(game);publish(game);}
  }
  const io = new Server(http, { cors: { origin }, maxHttpBufferSize: 20000, allowRequest: (req, callback) => callback(null, !req.headers.origin || req.headers.origin === origin) });
  io.use((socket, next) => {
    try {
      socket.data.user = authenticate(socket.handshake.auth?.initData, botToken);
      const expiry = (Number(new URLSearchParams(socket.handshake.auth.initData).get('auth_date')) + 3600) * 1000;
      const timer = setTimeout(() => socket.disconnect(true), Math.max(1, expiry - Date.now())); timer.unref();
      socket.once('disconnect', () => clearTimeout(timer)); next();
    } catch { next(new Error('Telegram orqali qayta kiring')); }
  });
  function publish(game) {
    groupVoting.publish(game);
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
        if (limit.n > 40) return ack({ ok: false, error: 'Juda ko‘p so‘rov, biroz kuting' });
        if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return ack({ ok: false, error: 'So‘rov noto‘g‘ri' });
        serial(async () => { if (!socket.connected) return; try { ack({ ok: true, ...await action(payload) }); } catch (error) { ack({ ok: false, error: error instanceof GameError ? error.message : 'So‘rovni bajarib bo‘lmadi' }); } });
      });
    }
    handle('home:get', () => ({ me: user, profile: store.profile(user.id), inventory:store.inventory(user.id), weeklyRewards:store.weeklyRewards(user.id), activeRoom: activeRoom(user.id)?.id ?? null, rooms: [...rooms.values()].filter(g => g.phase === 'lobby' && !g.group).map(g => ({ id: g.id, name: `${g.players[0]?.name || 'Mafia'} xonasi`, count: g.players.length, max: g.rules.maxPlayers })) }));
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
      if(typeof userId!=='string'||!/^\d{1,20}$/.test(userId))throw new GameError('O‘yinchi ID noto‘g‘ri');
      const row=store.db.prepare('SELECT name FROM scores WHERE user_id=? ORDER BY rowid DESC LIMIT 1').get(userId);
      if(!row)throw new GameError('O‘yinchi topilmadi');
      return {player:{id:userId,name:row.name,...store.profile(userId)}};
    });
    handle('rankings:get', ({ period }) => { if (!['week', 'month', 'all'].includes(period)) throw new GameError('Davr noto‘g‘ri'); return rankedGroups(period); });
    handle('room:create', () => { const game = makeRoom(user); socket.data.roomId = game.id; publish(game); return { state: state(game, user.id) }; });
    handle('room:join', async ({ roomId }) => {
      const game = rooms.get(roomId); if (!game) throw new GameError('Xona topilmadi yoki muddati tugagan');
      const current = activeRoom(user.id); if (current && current.id !== roomId) throw new GameError('Siz boshqa xonadasiz');
      if (game.group) {await bot.member(game.group.id, user.id);const cooldown=store.groupCooldown(game.group.id,user.id);if(cooldown>Date.now())throw new GameError('Oldingi o‘yindan chiqish cheklovi hali tugamagan');}
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
    handle('voice:token', async () => { const game = await current(); return audio.token(game, user.id); });
    handle('voice:ready', async () => { const game = await current(); await audio.ready(game, user.id); return {}; });
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
  const app = createApp({ botToken: process.env.BOT_TOKEN, botUsername: process.env.BOT_USERNAME, origin: process.env.APP_ORIGIN, dbPath: process.env.DB_PATH || 'data/mafia.sqlite', webhookSecret: process.env.TELEGRAM_WEBHOOK_SECRET, demo, voice: new Voice({ url: process.env.LIVEKIT_URL, apiKey: process.env.LIVEKIT_API_KEY, apiSecret: process.env.LIVEKIT_API_SECRET }) });
  const host = demo ? '127.0.0.1' : process.env.HOST || '127.0.0.1', port = Number(process.env.PORT || 3000);
  app.http.listen(port, host, () => console.log(`Mafia Mini App: http://${host}:${port}`));
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, async () => { await app.close(); process.exit(0); });
}
