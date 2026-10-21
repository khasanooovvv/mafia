import { io } from 'socket.io-client';
import { Room, RoomEvent, Track } from 'livekit-client';

const $ = s => document.querySelector(s);
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const icons = { home: '<path d="m3 10 9-7 9 7v10H3z"/><path d="M9 20v-7h6v7"/>', game: '<circle cx="12" cy="12" r="9"/><path d="m8 10 2 2-2 2m6-4 2 2-2 2"/>', rank: '<path d="M8 3h8v6a4 4 0 0 1-8 0zM8 5H4v2a4 4 0 0 0 4 4m8-6h4v2a4 4 0 0 1-4 4m-4 2v7m-5 0h10"/>', user: '<circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>', plus: '<path d="M12 4v16M4 12h16"/>', arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>', lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V6a4 4 0 0 1 8 0v4"/>' };
const icon = n => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[n] || icons.game}</svg>`;
const roles = { mafia: ['🎩', 'Mafiya', 'Shaharni sezdirmasdan egallang. Tunda nishonni tanlang.'], detective: ['🔎', 'Komissar', 'Har tunda bir kishini tekshirib, mafiyani aniqlang.'], doctor: ['✚', 'Shifokor', 'Har tunda bir o‘yinchini himoya qiling.'], citizen: ['◈', 'Tinch aholi', 'Muhokamada haqiqatni toping. Ovoz berishda mafiyani chiqaring.'] };
const phases = { lobby: 'O‘yinchilar kutilmoqda', night: 'Shahar uxlamoqda', discussion: 'Muhokama vaqti', voting: 'Ovoz berish', finished: 'O‘yin yakunlandi' };
const tg = window.Telegram?.WebApp;
tg?.ready(); tg?.expand();
try { tg?.setHeaderColor('#101114'); tg?.setBackgroundColor('#101114'); } catch {}
const config = await fetch('/api/config').then(r => r.json());
let demo = config.demo, socket, game = null, home = { me: { id: 'demo', name: 'Mehmon' }, profile: { games: 0, wins: 0, points: 0 }, rooms: [] };
let page = location.hash.slice(1) || 'home', target = null, rankKind = 'groups', period = 'week', rankings = { groups: [], players: [] }, voiceRoom = null, mic = false, busy = false, serverOffset = 0;
let pendingJoin = tg?.initDataUnsafe?.start_param || new URLSearchParams(location.search).get('room');
const menu = [['home','home','O‘yinlar'],['game','game','O‘yin stoli'],['rank','rank','Reyting'],['profile','user','Profil']];
function toast(message) { $('#toast').textContent = message; $('#toast').style.display = 'block'; clearTimeout(toast.timer); toast.timer = setTimeout(() => $('#toast').style.display = 'none', 4200); }
async function request(event, data = {}) {
  if (!socket?.connected) throw new Error('Mini App’ni Telegram bot orqali oching');
  const response = await socket.timeout(12000).emitWithAck(event, data);
  if (!response.ok) throw new Error(response.error); return response;
}
function setGame(next) {
  if (game?.phase !== next.phase || game?.id !== next.id) { target = null; $('#dialog').close(); }
  game = next; serverOffset = next.serverTime - Date.now();
  if (!next.voice.enabled) disconnectVoice();
  sessionStorage.setItem('mafia-room', next.id); render();
}
function navigate(next) { location.hash = next; }
window.addEventListener('hashchange', async () => { page = location.hash.slice(1) || 'home'; render(); try { if (page === 'rank') await loadRanks(); if (page === 'home' || page === 'profile') await refreshHome(); } catch (e) { toast(e.message); } });
function demoGame() {
  const names = ['Siz', 'Aziza', 'Javohir', 'Madina', 'Sardor', 'Malika', 'Bekzod', 'Shahnoza'];
  return { id: 'demo-room', ownerId: 'demo', group: null, phase: 'lobby', round: 0, revision: 1, deadline: null, serverTime: Date.now(), rules: { minPlayers: 6, maxPlayers: 12 }, players: names.map((name,i) => ({ id: i ? String(i) : 'demo', name, alive: true })), me: { id: 'demo', role: null, alive: true, actionSubmitted: false, voteSubmitted: false, reports: [], teammates: [] }, voice: { enabled: false, configured: false } };
}
async function refreshHome() {
  if (demo || !socket?.connected) return;
  home = await request('home:get'); $('#my-avatar').textContent = home.me.name[0] || 'M';
  if (['home', 'profile'].includes(page)) render();
}
async function loadRanks() { if (!demo && socket?.connected) rankings = await request('rankings:get', { period }); render(); }
async function join(roomId) { if (demo) setGame(demoGame()); else setGame((await request('room:join', { roomId })).state); navigate('game'); }
function render() {
  page = menu.some(m => m[0] === page) ? page : 'home';
  const nav = menu.map(([id, glyph, name]) => `<a class="nav-item ${page === id ? 'active' : ''}" href="#${id}" ${page === id ? 'aria-current="page"' : ''}>${icon(glyph)}<span>${name}</span></a>`).join('');
  $('#desktop-nav').innerHTML = nav; $('#mobile-nav').innerHTML = nav; $('#page-name').textContent = menu.find(m => m[0] === page)[2];
  if (page === 'home') renderHome(); else if (page === 'game') renderGame(); else if (page === 'rank') renderRank(); else renderProfile();
  updateClock();
}
function renderHome() {
  const rooms = demo ? [{ id:'sample', name:'Do‘stlar davrasi', count:8, max:12 }] : home.rooms;
  $('#main').innerHTML = `<div class="page-heading"><div><h1>Xush kelibsiz${demo ? '' : ', '+escape(home.me.name)}.</h1><p class="muted">Bugun kimning sirini ochamiz?</p></div><span class="pill">☾ TUN SHAHRI</span></div>
    <section class="hero"><div class="hero-content"><span class="eyebrow">ISHONCH. SHUBHA. STRATEGIYA.</span><h2>Shahar uxlaydi.<br>Mafiya uyg‘onadi.</h2><p>Do‘stlaringizni bir stolga yig‘ing.<br>Har bir ovoz o‘yin taqdirini o‘zgartiradi.</p><button class="primary" data-action="create">${icon('plus')}Xona yaratish</button></div><div class="hero-art" aria-hidden="true"><div class="moon"></div><div class="skyline">${'<i></i>'.repeat(9)}</div><div class="silhouette"></div><div class="hat"></div></div></section>
    <div class="content-grid"><section><div class="section-heading"><h2>Ochiq xonalar</h2><button class="text-button" data-action="refresh">Yangilash ↻</button></div>
    ${home.activeRoom ? '<button class="secondary full" data-action="resume">Davom etayotgan o‘yinimga qaytish →</button><br><br>' : ''}
    ${rooms.length ? rooms.map(r => `<article class="card room-row"><span class="room-icon">♠</span><div class="room-info"><h3>${escape(r.name)}</h3><small>${demo ? 'Namuna xona' : 'Klassik Mafia'} <span class="room-count">${r.count}/${r.max} o‘yinchi</span></small></div><button class="secondary" data-join="${escape(r.id)}">Kirish →</button></article>`).join('') : `<div class="card empty">${icon('game')}Hozircha ochiq xona yo‘q.<br>Birinchi xonani siz yarating.</div>`}
    <form id="join-form" class="join-form"><input id="room-code" aria-label="Xona havolasi yoki kodi" placeholder="Xona havolasi yoki kodi" required maxlength="250"><button class="ghost">Qo‘shilish</button></form></section>
    <aside class="side-content"><section class="card side-card"><span class="eyebrow">GURUHINGIZ BILAN</span><h3>Bir guruh. Bir jamoa.</h3><p>Guruhingizdagi o‘yinlarni yakunlang va reytingda yuqorilang.</p><button class="text-button" data-action="rank">Guruhlar reytingi →</button></section><section class="card side-card"><h3>O‘yin qanday kechadi?</h3><ol class="steps"><li><b>1</b>Yashirin rolingizni bilib oling</li><li><b>2</b>Tunda vazifangizni bajaring</li><li><b>3</b>Muhokama qiling va ovoz bering</li></ol></section></aside></div>
    <div class="section-heading" style="margin-top:28px"><h2>Har rolning o‘z siri bor</h2><button class="text-button" data-action="rules">Qoidalar ↗</button></div><div class="roles">${Object.entries(roles).map(([id,r])=>`<button class="role-tile" data-role="${id}" style="text-align:left;color:inherit"><span>${r[0]}</span><b>${r[1]}</b><small>${id === 'mafia' ? 'Soyada harakat qiladi' : id === 'detective' ? 'Haqiqatni izlaydi' : id === 'doctor' ? 'Hayotni asraydi' : 'Shaharni himoya qiladi'}</small></button>`).join('')}</div>`;
}
function hint() {
  if (game.phase === 'lobby') return `${game.players.length}/${game.rules.maxPlayers} o‘yinchi. Boshlash uchun kamida ${game.rules.minPlayers} kishi kerak.`;
  if (!game.me.alive) return 'Siz o‘yindan chiqdingiz. O‘yinni kuzatishingiz mumkin.';
  if (game.phase === 'discussion') return 'Fikrlaringizni ayting. Kim shubhali ko‘rinyapti?';
  if (game.phase === 'night') return game.me.actionSubmitted ? 'Harakatingiz qabul qilindi. Tongni kuting.' : game.me.role === 'citizen' ? 'Shahar uxlamoqda. Tongni kuting.' : 'Harakat uchun o‘yinchini tanlang.';
  return game.me.voteSubmitted ? 'Ovozingiz qabul qilindi.' : 'O‘yindan chiqarish uchun o‘yinchini tanlang.';
}
function canTarget(p) {
  if (!game.me.alive || !p.alive) return false;
  if (game.phase === 'voting') return !game.me.voteSubmitted && p.id !== game.me.id;
  if (game.phase !== 'night' || game.me.actionSubmitted || game.me.role === 'citizen') return false;
  if (game.me.role === 'mafia') return p.id !== game.me.id && !game.me.teammates.includes(p.id);
  if (game.me.role === 'detective') return p.id !== game.me.id;
  return true;
}
function renderGame() {
  if (!game) { $('#main').innerHTML = `<div class="page-heading"><div><h1>O‘yin stoli</h1><p class="muted">Stolingiz sizni kutmoqda.</p></div></div><section class="card empty">${icon('game')}Avval xonaga qo‘shiling yoki o‘z xonangizni yarating.<br><br><button class="primary" data-action="create">Xona yaratish</button></section>`; return; }
  if (game.phase === 'finished') {
    $('#main').innerHTML = `<section class="card result"><span style="font-size:55px">${game.winner === 'mafia' ? '🎩' : '☀'}</span><h2>${game.winner === 'draw' ? 'Durang' : game.winner === 'mafia' ? 'Mafiya g‘alaba qozondi' : 'Shahar tinchligi tiklandi'}</h2><p class="muted">Har bir sirning javobi bor.</p>${game.players.map(p=>`<div class="leader-row"><span class="avatar">${escape(p.name[0])}</span><b>${escape(p.name)}</b><span>${roles[p.role]?.[1] || '—'}</span></div>`).join('')}<br><button class="primary" data-action="home">Bosh sahifaga</button></section>`; return;
  }
  $('#main').innerHTML = `<div class="page-heading"><div><h1>${game.group ? escape(game.group.name) : 'Do‘stlar davrasi'}</h1><p class="muted">Klassik Mafia · ${game.players.length} o‘yinchi ${demo ? '· Namuna' : ''}</p></div><button class="ghost" data-action="invite">Taklif qilish ↗</button></div><div class="game-layout"><section class="table-wrap"><div class="table-top"><span class="phase-label">${game.phase === 'night' ? '☾' : '◉'} ${phases[game.phase]}</span><span class="timer" id="timer">—</span></div><div class="game-table"><div class="table-center"><strong>MAFIA</strong><small>${game.phase === 'lobby' ? 'TUN SHAHRI' : `${game.round}-DAVRA`}</small></div>${game.players.map((p,i)=>{const a = i*2*Math.PI/game.players.length-Math.PI/2;return `<button class="seat ${p.alive?'':'dead'} ${target === p.id?'target':''}" style="left:${50+42*Math.cos(a)}%;top:${50+40*Math.sin(a)}%" data-target="${escape(p.id)}" ${canTarget(p)?'':'disabled'} aria-label="${escape(p.name)}${p.alive?'':' — o‘yindan chiqqan'}"><span class="avatar">${escape(p.name[0])}</span><small>${escape(p.name)}${p.id === game.me.id?' • siz':''}</small></button>`;}).join('')}</div><p class="table-hint">${hint()}</p><div class="game-actions">${game.phase === 'lobby' ? `${game.ownerId === game.me.id ? `<button class="primary" data-action="start" ${game.players.length<game.rules.minPlayers?'disabled':''}>O‘yinni boshlash →</button>` : ''}<button class="ghost" data-action="leave">Xonadan chiqish</button>` : `${target ? `<button class="primary" data-action="submit">${game.phase === 'voting'?'Ovoz berish':'Harakatni tasdiqlash'}</button>` : ''}${demo ? '<button class="ghost" data-action="demo-next">Keyingi bosqich (demo) →</button>' : ''}`}</div></section><aside class="game-side"><section class="card role-card"><div class="big-symbol">♠</div><h3>Sizning yashirin rolingiz</h3><p>Bu ma’lumot faqat sizga ko‘rinadi.<br>Siringizni asrang.</p><button class="secondary full" data-action="reveal" ${game.me.role?'':'disabled'}>${icon('lock')}Rolimni ko‘rish</button>${game.me.reports.map(r=>`<div class="report">${r.round}-tun: ${escape(game.players.find(p=>p.id===r.targetId)?.name)} — ${r.isMafia?'mafiya':'mafiya emas'}</div>`).join('')}</section><section class="card voice-card"><h3>Ovozli muhokama</h3><div class="voice-state"><span class="wave">${'<i></i>'.repeat(6)}</span>${game.phase === 'discussion'?'Muhokama ochiq':'Mikrofonlar yopiq'}</div><p>${!game.voice.configured ? 'Ovoz serveri sozlangandan keyin bu yerda gaplashasiz.' : 'Ovoz faqat muhokamada va tirik o‘yinchilarga ochiladi.'}</p><button class="${mic?'primary':'secondary'} full" data-action="mic" ${game.voice.enabled?'':'disabled'}>${mic?'Mikrofonni o‘chirish':voiceRoom?'Mikrofonni yoqish':'Muhokamaga qo‘shilish'}</button></section></aside></div>`;
}
function renderRank() {
  const list = rankings[rankKind];
  $('#main').innerHTML = `<div class="page-heading"><div><h1>Shahar yetakchilari</h1><p class="muted">Faol o‘yinlar. Kuchli jamoalar. Haqiqiy raqobat.</p></div><span class="pill">♜ REYTING</span></div><div class="ranking-tabs"><button data-kind="groups" class="${rankKind==='groups'?'active':''}">Guruhlar</button><button data-kind="players" class="${rankKind==='players'?'active':''}">O‘yinchilar</button></div><div class="periods">${[['week','Haftalik'],['month','Oylik'],['all','Umumiy']].map(([id,name])=>`<button data-period="${id}" class="${period===id?'active':''}">${name}</button>`).join('')}</div><section class="card">${list.length ? list.map((r,i)=>`<div class="leader-row"><span class="place">${String(i+1).padStart(2,'0')}</span><div><b>${escape(r.name)}</b><small>${r.games} hisoblangan o‘yin${rankKind==='players'?` · ${r.wins} g‘alaba`:''}</small></div><strong>${r.points}<small>ochko</small></strong></div>`).join('') : `<div class="empty">${icon('rank')}Reyting hali shakllanmagan.<br>Birinchi hisobga olinadigan o‘yinni yakunlang.</div>`}</section><p class="rule-copy" style="margin-top:20px">Guruhga har bir mos o‘yin uchun 10 + ishtirokchilar sonicha ochko. Bir xil tarkib kuniga bir marta, guruh kuniga 5 ta o‘yingacha hisoblanadi. O‘yin kamida 3 daqiqa davom etishi va kamida yarmi harakat yoki ovoz yuborishi kerak. Davrlar Toshkent vaqti bo‘yicha hisoblanadi.</p>`;
}
function renderProfile() {
  $('#main').innerHTML = `<div class="page-heading"><div><h1>Mening profilim</h1><p class="muted">Har bir o‘yin — yangi hikoya.</p></div></div><section class="card"><div class="profile-head"><span class="avatar">${escape(home.me.name[0])}</span><h2>${escape(home.me.name)}</h2><span class="pill">${demo?'DEMO PROFIL':'MAFIA O‘YINCHISI'}</span></div><div class="stats"><div class="card stat"><strong>${home.profile.games}</strong><small>O‘yinlar</small></div><div class="card stat"><strong>${home.profile.wins}</strong><small>G‘alabalar</small></div><div class="card stat"><strong>${home.profile.points}</strong><small>Ochko</small></div></div><p class="rule-copy">Hisobga olinadigan o‘yinda faol ishtirok uchun 1 ochko, g‘alaba uchun yana 3 ochko. Kuniga 5 ta o‘yingacha hisoblanadi.</p><button class="ghost full" data-action="rules">O‘yin qoidalarini ko‘rish</button></section>`;
}
function showRole(role) { const r = roles[role]; if (!r) return; $('#dialog-content').innerHTML = `<div class="role-emoji">${r[0]}</div><span class="eyebrow">YASHIRIN ROL</span><h2 style="margin-top:15px">${r[1]}</h2><p>${r[2]}</p>${role === 'mafia' && game?.me.teammates.length ? `<p>Jamoadoshlar: ${game.me.teammates.map(id=>escape(game.players.find(p=>p.id===id)?.name)).join(', ')}</p>` : ''}`; $('#dialog').showModal(); }
$('#close-dialog').onclick = () => $('#dialog').close();
async function disconnectVoice() { const old = voiceRoom; voiceRoom = null; mic = false; if (old) await old.disconnect(); $('#audio-tracks').replaceChildren(); }
async function toggleMic() {
  if (voiceRoom) { mic = !mic; await voiceRoom.localParticipant.setMicrophoneEnabled(mic); render(); return; }
  const grant = await request('voice:token');
  const room = new Room({ adaptiveStream: true }); voiceRoom = room;
  room.on(RoomEvent.TrackSubscribed, track => { if (track.kind === Track.Kind.Audio) $('#audio-tracks').append(track.attach()); });
  room.on(RoomEvent.TrackUnsubscribed, track => track.detach().forEach(el=>el.remove()));
  room.on(RoomEvent.Disconnected, () => { if (voiceRoom === room) { voiceRoom = null; mic = false; render(); } });
  try {
    await room.connect(grant.url, grant.token); await request('voice:ready'); await room.startAudio();
    if (!game?.voice.enabled || voiceRoom !== room) throw new Error('Muhokama tugadi');
    mic = false; render(); toast('Muhokamaga ulandingiz. Mikrofon hozir o‘chiq.');
  } catch (e) { await disconnectVoice(); throw new Error(e.message || 'Mikrofon ruxsatini tekshiring'); }
}
function updateClock() {
  const clock = $('#timer'); if (!clock || !game?.deadline) return;
  const seconds = Math.max(0, Math.ceil((game.deadline - (Date.now()+serverOffset))/1000));
  clock.textContent = `${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;
  if (!seconds && voiceRoom) disconnectVoice().then(render);
}
setInterval(updateClock, 250);
document.addEventListener('visibilitychange', () => { if (document.hidden) { $('#dialog').close(); disconnectVoice(); } else if (!demo && game && socket?.connected) request('game:sync').then(r=>setGame(r.state)).catch(e=>toast(e.message)); });
$('#main').addEventListener('submit', async event => { if(event.target.id !== 'join-form') return; event.preventDefault(); let code = $('#room-code').value.trim(); try { if(code.startsWith('https://')) { const u=new URL(code); code=u.searchParams.get('startapp')||u.searchParams.get('room'); } await join(code); } catch(e) {toast(e.message);} });
$('#main').addEventListener('click', async event => {
  const b = event.target.closest('button'); if (!b || b.disabled || busy) return;
  busy = true;
  try {
    if (b.dataset.join) await join(b.dataset.join);
    else if (b.dataset.role) showRole(b.dataset.role);
    else if (b.dataset.target) { target = b.dataset.target; render(); }
    else if (b.dataset.kind) { rankKind = b.dataset.kind; render(); }
    else if (b.dataset.period) { period = b.dataset.period; await loadRanks(); }
    else switch (b.dataset.action) {
      case 'create': if(demo) setGame(demoGame()); else setGame((await request('room:create')).state); navigate('game'); break;
      case 'refresh': await refreshHome(); toast(demo?'Bu namuna xonalar ro‘yxati':'Xonalar yangilandi'); break;
      case 'resume': await join(home.activeRoom); break;
      case 'home': if(game?.phase==='finished') {game=null;sessionStorage.removeItem('mafia-room');} await refreshHome(); navigate('home'); break;
      case 'rank': navigate('rank'); break;
      case 'leave': if(!demo) await request('room:leave'); game=null; sessionStorage.removeItem('mafia-room'); navigate('home'); break;
      case 'start': if(demo) {game.phase='night';game.round=1;game.me.role='detective';game.deadline=Date.now()+45000;render();} else await request('game:start'); break;
      case 'reveal': showRole(game.me.role); break;
      case 'submit': if(demo) {if(game.phase==='voting')game.me.voteSubmitted=true;else game.me.actionSubmitted=true;target=null;render();toast('Demo: tanlov qabul qilindi');} else {setGame((await request(game.phase==='voting'?'game:vote':'game:night-action',{targetId:target,revision:game.revision})).state);target=null;render();} break;
      case 'demo-next': {const order=['night','discussion','voting'];game.phase=order[(order.indexOf(game.phase)+1)%3];if(game.phase==='night')game.round++;game.me.actionSubmitted=false;game.me.voteSubmitted=false;game.deadline=Date.now()+45000;target=null;render();break;}
      case 'invite': if(demo) {toast('Namuna xona uchun haqiqiy taklif yo‘q');break;} {const link=config.botUsername?`https://t.me/${config.botUsername}?startapp=${encodeURIComponent(game.id)}`:`${location.origin}/?room=${encodeURIComponent(game.id)}`;await navigator.clipboard.writeText(link);toast('Taklif havolasi nusxalandi');break;}
      case 'mic': await toggleMic(); break;
      case 'rules': $('#dialog-content').innerHTML='<span class="eyebrow">KLASSIK MAFIA</span><h2 style="margin-top:20px">Shahar qoidalari</h2><p>6–12 o‘yinchi. Tun: 45 soniya. Muhokama: 90 soniya. Ovoz: 30 soniya.</p><p>Tunda mafiya nishon tanlaydi, shifokor himoya qiladi, komissar tekshiradi. Kunduzi muhokama va ovoz berish bo‘ladi.</p><p>Teng ovozda hech kim chiqmaydi. Harakat va ovoz bir marta yuboriladi. Mafiya qolmasa aholi yutadi; mafiya soni qolganlarga tenglashsa mafiya yutadi.</p>';$('#dialog').showModal(); break;
    }
  } catch(e) { toast(e.message); } finally {busy=false;}
});
render();
if (demo) { $('#connection').textContent='Dizayn namoyishi'; $('#notice').hidden=false; $('#notice').textContent='DEMO REJIM · Xona va o‘yinchilar namuna. Haqiqiy o‘yin, ovoz va reyting uchun Telegram orqali ulaning.'; }
else if (!tg?.initData) { $('#connection').textContent='Telegram talab etiladi'; $('#notice').hidden=false; $('#notice').textContent='O‘ynash uchun Mini App’ni Telegram botdagi tugma orqali oching. Bu sahifa dizaynini ko‘rishingiz mumkin.'; }
else {
  socket=io({auth:{initData:tg.initData}});
  socket.on('connect', async()=>{ $('#connection').textContent='Ulangan';try {await refreshHome(); const id=pendingJoin||sessionStorage.getItem('mafia-room')||home.activeRoom;pendingJoin=null;if(id)await join(id);if(page==='rank')await loadRanks();}catch(e){sessionStorage.removeItem('mafia-room');toast(e.message);} });
  socket.on('game:state',setGame); socket.on('room:left',()=>{game=null;sessionStorage.removeItem('mafia-room');navigate('home');});
  socket.on('room:expired',()=>{game=null;sessionStorage.removeItem('mafia-room');disconnectVoice();navigate('home');toast('Xona muddati tugadi');});
  socket.on('disconnect',()=>{$('#connection').textContent='Ulanish uzildi';disconnectVoice();});
  socket.on('connect_error',e=>{$('#connection').textContent='Ulanib bo‘lmadi';toast(e.message);});
}

