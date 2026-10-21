import { createServer } from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Server } from 'socket.io';
import { Game, GameError } from './game.js';
import { authenticate } from './auth.js';
import { Store } from './store.js';
import { Telegram } from './telegram.js';
import { Voice } from './voice.js';

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
  const bot = telegram || new Telegram(botToken, botUsername), audio = voice || new Voice();
  let queue = Promise.resolve(), closed = false;
  const serial = action => { const result = queue.then(action); queue = result.catch(() => {}); return result; };
  const activeRoom = id => [...rooms.values()].find(g => g.phase !== 'finished' && g.players.some(p => p.id === id));
  const makeRoom = (user, group = null) => {
    if (activeRoom(user.id)) throw new GameError('Avval mavjud xonangizni tark eting');
    if (rooms.size >= 1000) throw new GameError('Server band');
    const game = new Game(user, { ...gameOptions, group }); rooms.set(game.id, game); store.save(game); return game;
  };
  const state = (game, id) => ({ ...game.view(id), voice: { enabled: audio.allowed(game, id), configured: audio.enabled, transport: audio.enabled ? 'livekit' : 'not-configured' } });
  async function advance(game) {
    if (game.deadline !== null && game.now() >= game.deadline && game.phase === 'discussion') {
      try { await audio.close(game); } catch { throw new GameError('Ovozli xona yopilmoqda, biroz kuting'); }
    }
    if (game.tick()) { store.save(game); publish(game); }
  }
  async function updateBot(update) {
    if (!Number.isSafeInteger(update.update_id)) throw new GameError('Update noto‘g‘ri');
    const previous = store.update(update.update_id); if (previous?.sent) return;
    const m = update.message;
    if (!m?.from || m.from.is_bot || typeof m.text !== 'string') { store.rememberUpdate(update.update_id); store.sent(update.update_id); return; }
    const match = /^\/(mafia|start|help)(?:@([\w]+))?(?:\s|$)/i.exec(m.text);
    if (!match || (match[2] && match[2].toLowerCase() !== bot.username.toLowerCase())) return;
    if (!Number.isSafeInteger(m.from.id) || !Number.isSafeInteger(m.chat?.id)) throw new GameError('Update noto‘g‘ri');
    if (match[1].toLowerCase() === 'mafia' && ['group', 'supergroup'].includes(m.chat.type)) {
      await bot.member(String(m.chat.id), String(m.from.id), true);
      let game = previous?.room_id ? rooms.get(previous.room_id) : [...rooms.values()].find(g => g.group?.id === String(m.chat.id) && g.phase !== 'finished');
      if (!game) game = makeRoom({ id: String(m.from.id), name: m.from.first_name || 'O‘yinchi' }, { id: String(m.chat.id), name: String(m.chat.title || 'Guruh').slice(0, 100) });
      store.rememberUpdate(update.update_id, game.id);
      await bot.send(m.chat.id, `${game.group.name}\nMafia xonasi ochiq. Mini App ichida o‘ynash uchun qo‘shiling.`, game.id);
    } else {
      store.rememberUpdate(update.update_id);
      await bot.send(m.chat.id, 'Mafia • Tun shahri\nMini App ichida xona yarating yoki guruhda /mafia buyrug‘idan foydalaning. Guruh xonasini administrator ochadi.');
    }
    store.sent(update.update_id);
  }
  const http = createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store'); res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('Referrer-Policy', 'no-referrer');
    const json = (code, data) => { res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(data)); };
    try {
      const pathname = new URL(req.url, 'http://localhost').pathname;
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
      const assets = { '/': ['index.html', 'text/html'], '/app.js': ['app.js', 'text/javascript'], '/styles.css': ['styles.css', 'text/css'] };
      if (!assets[pathname]) return json(404, { error: 'Not found' });
      const [file, type] = assets[pathname], data = await readFile(resolve(PUBLIC, file));
      res.writeHead(200, { 'Content-Type': `${type}; charset=utf-8` }); res.end(data);
    } catch (e) { json(e instanceof SyntaxError ? 400 : 503, { error: 'So‘rov bajarilmadi. Sozlamalarni tekshiring.' }); }
  });
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
    handle('home:get', () => ({ me: user, profile: store.profile(user.id), activeRoom: activeRoom(user.id)?.id ?? null, rooms: [...rooms.values()].filter(g => g.phase === 'lobby' && !g.group).map(g => ({ id: g.id, name: `${g.players[0]?.name || 'Mafia'} xonasi`, count: g.players.length, max: g.rules.maxPlayers })) }));
    handle('rankings:get', ({ period }) => { if (!['week', 'month', 'all'].includes(period)) throw new GameError('Davr noto‘g‘ri'); return store.rankings(period); });
    handle('room:create', () => { const game = makeRoom(user); socket.data.roomId = game.id; publish(game); return { state: state(game, user.id) }; });
    handle('room:join', async ({ roomId }) => {
      const game = rooms.get(roomId); if (!game) throw new GameError('Xona topilmadi yoki muddati tugagan');
      const current = activeRoom(user.id); if (current && current.id !== roomId) throw new GameError('Siz boshqa xonadasiz');
      if (game.group) await bot.member(game.group.id, user.id);
      await advance(game); game.join(user); store.save(game); socket.data.roomId = roomId; publish(game); return { state: state(game, user.id) };
    });
    async function current() { const game = rooms.get(socket.data.roomId); if (!game) throw new GameError('Avval xonaga kiring'); game.member(user.id); await advance(game); return game; }
    handle('room:leave', async () => {
      const game = await current(); game.leave(user.id);
      for (const peer of io.sockets.sockets.values()) if (peer.data.user.id === user.id && peer.data.roomId === game.id) { peer.data.roomId = null; peer.emit('room:left'); }
      if (!game.players.length) { rooms.delete(game.id); store.remove(game.id); } else { store.save(game); publish(game); } return {};
    });
    handle('game:start', async () => { const game = await current(); game.start(user.id); store.save(game); publish(game); return {}; });
    handle('game:sync', async () => { const game = await current(); return { state: state(game, user.id) }; });
    handle('game:night-action', async ({ targetId, revision }) => {
      const game = await current(), previous = game.revision;
      try { game.nightAction(user.id, targetId, revision); return { state: state(game, user.id) }; }
      finally { store.save(game); if (game.revision !== previous) publish(game); }
    });
    handle('game:vote', async ({ targetId, revision }) => {
      const game = await current(), previous = game.revision;
      try { game.vote(user.id, targetId, revision); return { state: state(game, user.id) }; }
      finally { store.save(game); if (game.revision !== previous) publish(game); }
    });
    handle('voice:token', async () => { const game = await current(); return audio.token(game, user.id); });
    handle('voice:ready', async () => { const game = await current(); await audio.ready(game, user.id); return {}; });
  });
  let ticking = false;
  const timer = setInterval(() => {
    if (ticking || closed) return; ticking = true;
    serial(async () => {
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
  return { http, io, rooms, store, close: async () => { closed = true; clearInterval(timer); await queue; await new Promise(resolve => io.close(resolve)); store.close(); } };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const demo = process.env.DEMO_MODE === 'true';
  if (demo && process.env.NODE_ENV === 'production') throw new Error('Production’da demo rejimi taqiqlangan');
  const app = createApp({ botToken: process.env.BOT_TOKEN, botUsername: process.env.BOT_USERNAME, origin: process.env.APP_ORIGIN, dbPath: process.env.DB_PATH || 'data/mafia.sqlite', webhookSecret: process.env.TELEGRAM_WEBHOOK_SECRET, demo, voice: new Voice({ url: process.env.LIVEKIT_URL, apiKey: process.env.LIVEKIT_API_KEY, apiSecret: process.env.LIVEKIT_API_SECRET }) });
  const host = demo ? '127.0.0.1' : process.env.HOST || '127.0.0.1', port = Number(process.env.PORT || 3000);
  app.http.listen(port, host, () => console.log(`Mafia Mini App: http://${host}:${port}`));
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, async () => { await app.close(); process.exit(0); });
}
