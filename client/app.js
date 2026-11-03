import { nightNarrative, dawnNarrative } from '../src/night-narrative.js';
import { SETTING_SECTIONS, BOOLEAN_RULES, ADVANCED_DEFAULTS, ROLE_ORDER } from '../src/settings.js';
import { renderMarkup } from './ui.js';
import ph_home from '@phosphor-icons/core/assets/regular/house.svg';
import ph_game from '@phosphor-icons/core/assets/regular/game-controller.svg';
import ph_rank from '@phosphor-icons/core/assets/regular/trophy.svg';
import ph_user from '@phosphor-icons/core/assets/regular/user-circle.svg';
import ph_plus from '@phosphor-icons/core/assets/regular/plus.svg';
import ph_arrow from '@phosphor-icons/core/assets/regular/arrow-right.svg';
import ph_lock from '@phosphor-icons/core/assets/regular/lock-key.svg';
import ph_users from '@phosphor-icons/core/assets/regular/users-three.svg';
import ph_clock from '@phosphor-icons/core/assets/regular/clock.svg';
import ph_chat from '@phosphor-icons/core/assets/regular/chat-circle.svg';
import ph_mafia from '@phosphor-icons/core/assets/regular/detective.svg';
import ph_detective from '@phosphor-icons/core/assets/regular/eye.svg';
import ph_doctor from '@phosphor-icons/core/assets/regular/heartbeat.svg';
import ph_citizen from '@phosphor-icons/core/assets/regular/shield-check.svg';
import ph_book from '@phosphor-icons/core/assets/regular/book-open.svg';
import ph_chevron from '@phosphor-icons/core/assets/regular/caret-right.svg';
import ph_verified from '@phosphor-icons/core/assets/regular/seal-check.svg';
import ph_help from '@phosphor-icons/core/assets/regular/question.svg';
import ph_shop from '@phosphor-icons/core/assets/regular/shopping-bag.svg';
import ph_sparkle from '@phosphor-icons/core/assets/regular/sparkle.svg';
import ph_home_fill from '@phosphor-icons/core/assets/fill/house-fill.svg';
import ph_game_fill from '@phosphor-icons/core/assets/fill/game-controller-fill.svg';
import ph_rank_fill from '@phosphor-icons/core/assets/fill/trophy-fill.svg';
import ph_user_fill from '@phosphor-icons/core/assets/fill/user-circle-fill.svg';
import donHat from '../public/images/don-hat-2d.png';
import mafiaHat from '../public/images/mafia-hat-2d.png';
import santaHat from '../public/images/santa-hat-black-drops-transparent.png';
import { io } from 'socket.io-client';

const $ = s => document.querySelector(s);
// Native dialogs trap focus, but do not lock the document scroll on every platform.
let modalScroll = null;
function syncModalScroll() {
 const open = !!document.querySelector('dialog[open]');
 if (open && modalScroll === null) {
  modalScroll = { x: window.scrollX, y: window.scrollY };
  document.body.style.setProperty('--modal-scroll-top', `-${modalScroll.y}px`);
  document.documentElement.classList.add('modal-open');
 } else if (!open && modalScroll !== null) {
  const position = modalScroll; modalScroll = null;
  document.documentElement.classList.remove('modal-open');
  document.body.style.removeProperty('--modal-scroll-top');
  window.scrollTo({ left: position.x, top: position.y, behavior: 'instant' });
 }
}
const modalObserver = new MutationObserver(syncModalScroll);
for (const dialog of document.querySelectorAll('dialog')) {
 modalObserver.observe(dialog, { attributes: true, attributeFilter: ['open'] });
 dialog.addEventListener('close', syncModalScroll);
}

const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const icons = { shop: ph_shop, home: ph_home, game: ph_game, rank: ph_rank, user: ph_user, plus: ph_plus, arrow: ph_arrow, lock: ph_lock, users: ph_users, clock: ph_clock, chat: ph_chat, mafia: ph_mafia, detective: ph_detective, doctor: ph_doctor, citizen: ph_citizen, book: ph_book, chevron: ph_chevron, verified: ph_verified, help: ph_help, sparkle: ph_sparkle };
const filledIcons = { home: ph_home_fill, game: ph_game_fill, rank: ph_rank_fill, user: ph_user_fill };
const icon = (name, filled = false) => (filled && filledIcons[name] || icons[name] || ph_game).replace('<svg ', '<svg aria-hidden="true" focusable="false" width="20" height="20" ');
const roles = {
  don:[icon('mafia'),'Don','Mafia oilasining boshlig‘i. Tungi nishonni belgilaydi; tirik mafiyalar bilan birga shaharni egallashga intiladi.'],
  mafia:[icon('mafia'),'Mafia','Tunda Don va oilangiz bilan qurbon tanlang. Don halok bo‘lsa, uning o‘rnini egallaysiz.'],
  commissioner:[icon('detective'),'Komissar','Har kecha bir kishining aniq rolini tekshiring yoki uni otib tashlang. Tekshiruvni serjant ham biladi.'],
  sergeant:[icon('detective'),'Serjant','Komissarning kimligini va uning tekshiruvlarini bilasiz. Komissar halok bo‘lsa, uning vazifasini olasiz.'],
  doctor:[icon('doctor'),'Shifokor','Har kecha bir kishini qutqaring. O‘zingizni butun o‘yin davomida faqat bir marta davolay olasiz.'],
  maniac:[icon('mafia'),'Manyak','Har kecha alohida nishonga hujum qiling. Yakka g‘alaba uchun tirik qolgan oxirgi o‘yinchi bo‘ling.'],
  mistress:[icon('user'),'Ma’shuqa','Bir o‘yinchini chalg‘itib, tun harakatini bekor qilasiz. Agar o‘zingiz hujum qurboni bo‘lsangiz, chalg‘itish ishlamaydi.'],
  lawyer:[icon('lock'),'Advokat','Mafia tomonida, lekin mafiyani tanimaysiz. Har kecha Don yoki mafiyani komissar tekshiruvidan yashiring.'],
  suicide:[icon('user'),'Suidsid','Kunduzi ovoz bilan osilsangiz, g‘alabangiz saqlanadi. O‘yin davom etadi; Mafia yoki tinch aholi yutsa, siz ham ular bilan g‘olib bo‘lasiz. Tunda o‘lsangiz yutqazasiz.'],
  hobo:[icon('users'),'Darbadar','Har kecha bir uyni kuzatib, u yerga borgan tirik rollarni bilib olasiz; rollari ochilmaydi. Nishonni ketma-ket tanlamang.'],
  lucky:[icon('sparkle'),'Omadli','Tungi hujumdan bir marta 2/3 ehtimol bilan omon qolasiz. Ovoz bilan chiqarilishdan himoya yo‘q.'],
  kamikaze:[icon('sparkle'),'Kamikadze','Kunduzi ovoz bilan chiqarilsangiz, istalgan tirik o‘yinchini qasos uchun tanlaysiz. Natija keyingi tongda hal bo‘ladi.'],
  bodyguard:[icon('lock'),'Tansoqchi','Har kecha boshqa kishini qo‘riqlang. Unga oddiy hujum tushsa, siz uning o‘rniga halok bo‘lasiz. Kechagi nishonni qayta qo‘riqlab bo‘lmaydi.'],
  mayor:[icon('rank'),'Mer','Fuqarolar tomonidasiz. Kunduzi sizning ovozingiz ikki hissa sanaladi; shaxsingiz o‘yin tugamaguncha sir.'],
  journalist:[icon('book'),'Jurnalist','Har kecha ikki tirik kishini tanlang. Ularning bir tomondami yoki qarama-qarshi tomondami ekanini bilasiz, rollarini emas.'],
  citizen:[icon('citizen'),'Tinch aholi','Tunda uxlang. Kunduzi ma’lumotlarni muhokama qilib, ovoz bilan mafiyani va manyakni toping.']
};
// Custom, hand-authored vector emblems for the role cards.
const cardArt = {
  mafia:'♟', don:'♛', commissioner:'⚖', sergeant:'⚜', doctor:'✚', maniac:'☠', mistress:'✦', lawyer:'§', suicide:'♜', hobo:'⌖', lucky:'✧', kamikaze:'✹', bodyguard:'⬟', mayor:'♜', journalist:'✎', citizen:'♙', santa:'❄'
};
for (const [id,role] of Object.entries(roles)) role[0] = `<span class="card-art card-art-${id}" aria-hidden="true">${cardArt[id] || '✦'}</span>`;
roles.don[0] = `<img class="role-object-art" src="${donHat}" alt="Don shlyapasi">`;
roles.mafia[0] = `<img class="role-object-art" src="${mafiaHat}" alt="Mafia shlyapasi">`;
const illustratedRoles = ['commissioner', 'sergeant', 'doctor', 'maniac', 'mistress', 'lawyer', 'suicide', 'hobo', 'lucky', 'kamikaze', 'bodyguard', 'mayor', 'journalist', 'citizen'];
for (const id of illustratedRoles) roles[id][0] = `<img class="role-object-art" src="/images/${id}-2d.png" alt="${roles[id][1]}" loading="lazy" decoding="async">`;
roles.citizen[0] = `<img class="role-object-art" src="/images/citizen-2d.png?v=city-20261102" alt="Tinch aholi shahri" loading="lazy" decoding="async">`;
const roleEntries = Object.entries(roles);
const roleTiers = { common:['Tinch aholi','Mafia'], rare:['Shifokor','Komissar','Darbadar','Omadli'], epic:['Don','Serjant','Ma’shuqa','Advokat','Kamikadze','Tansoqchi','Mer','Jurnalist'], legendary:['Manyak','Suidsid'] };
const roleTier = name => Object.entries(roleTiers).find(([,names])=>names.includes(name))?.[0] || 'common';
const santaArt = `<img class="santa-hat" src="${santaHat}" alt="Telegram Santa Hat NFT · Black Drops">`;
const santaCardArt = `<span class="santa-card-visual"><img class="santa-card-hat" src="${santaHat}" alt=""><img class="santa-card-corner santa-card-corner-tl" src="${santaHat}" alt=""><img class="santa-card-corner santa-card-corner-br" src="${santaHat}" alt=""></span>`;
const cardVisual = (id,role,carousel=false) => id === 'santa' ? (carousel ? santaArt : santaCardArt) : role[0];
const extraCards = [['santa',[santaArt,'Qorbobo','Afsonaviy bayram kartasi. Maxsus kolleksion karta; o‘yin roliga ta’sir qilmaydi.'],'mythic']];
const cardEntries = [...roleEntries.map(([id,r])=>[id,r,roleTier(r[1])]),...extraCards];
const tierOrder = { mythic: 0, legendary: 1, epic: 2, rare: 3, common: 4 };
const catalogEntries = [...cardEntries].sort((a,b)=>tierOrder[a[2]]-tierOrder[b[2]]);
const tierLabels = { common:'COMMON', rare:'RARE', epic:'EPIC', legendary:'LEGENDARY', mythic:'MYTHIC' };
const phases = { lobby: 'O‘yinchilar kutilmoqda', night: 'Shahar uxlamoqda', discussion: 'Kun', voting: 'Ovoz berish', confirmation: 'Hukmni tasdiqlash', finished: 'O‘yin yakunlandi' };
const tg = window.Telegram?.WebApp;
tg?.ready(); tg?.expand();

const config = await fetch('/api/config').then(r => r.json());
let demo = config.demo, socket, game = null, home = { me: { id: 'demo', name: 'Mehmon' }, profile: { games: 0, wins: 0, points: 0 }, rooms: [] };
let page = location.hash.slice(1) || 'home', target = null, selectedTargets = [], actionMode = 'check', rankKind = 'groups', period = 'week', rankings = { groups: [], players: [] }, busy = false, serverOffset = 0;
let pendingJoin = tg?.initDataUnsafe?.start_param || new URLSearchParams(location.search).get('room');
let pendingMenu=/^menu_(groups|game|profile|shop|roles|referrals)$/.exec(pendingJoin||'')?.[1];
if(/^ref_|^menu_/.test(pendingJoin||''))pendingJoin=null;
const menu = [['home','home','O‘yinlar'],['game','game','O‘yin stoli'],['rank','rank','Reyting'],['profile','user','Profil']];
function avatar(user) {
  const initial = escape(Array.from(user.name || 'M')[0]);
  let photo = '';
  try { const url = new URL(user.photoUrl); if (url.protocol === 'https:') photo = `<img src="${escape(url.href)}" alt="" referrerpolicy="no-referrer" class="telegram-photo">`; } catch {}
  return `<span class="avatar-letter">${initial}</span>${photo}`;
}
document.addEventListener('error', event => {
  if (event.target.matches?.('.telegram-photo')) event.target.remove();
}, true);
function toast(message) { $('#toast').textContent = message; $('#toast').style.display = 'block'; clearTimeout(toast.timer); toast.timer = setTimeout(() => $('#toast').style.display = 'none', 4200); }
async function request(event, data = {}) {
  if (!socket?.connected) throw new Error('Mini App’ni Telegram bot orqali oching');
  const response = await socket.timeout(12000).emitWithAck(event, data);
  if (!response.ok) throw new Error(response.error); return response;
}
function setGame(next) {
  if (game?.phase !== next.phase || game?.id !== next.id) { chatDraft=''; if($('#match-chat-input'))$('#match-chat-input').value=''; target = null; selectedTargets = []; actionMode = 'check'; $('#dialog').close(); }
  game = next; serverOffset = next.serverTime - Date.now();
  sessionStorage.setItem('mafia-room', next.id); render();
}
function navigate(next) { location.hash = next; }
window.addEventListener('hashchange', async () => { page = location.hash.slice(1) || 'home'; window.scrollTo(0, 0); render(); try { if (page === 'rank') await loadRanks(); if (page === 'home' || page === 'profile') await refreshHome(); } catch (e) { toast(e.message); } });
function demoGame() {
  const names = ['Siz', 'Aziza', 'Javohir', 'Madina', 'Sardor', 'Malika', 'Bekzod', 'Shahnoza', 'Akmal', 'Dilnoza', 'Bobur', 'Sevara', 'Jasur', 'Nargiza', 'Temur', 'Zarina', 'Oybek', 'Lola', 'Anvar', 'Nilufar'].slice(0,new URLSearchParams(location.search).get('players')==='20'?20:8);
  return { id: 'demo-room', ownerId: 'demo', group: null, phase: 'lobby', round: 0, revision: 1, deadline: null, serverTime: Date.now(), rules: { minPlayers: 6, maxPlayers: 20 }, players: names.map((name,i) => ({ id: i ? String(i) : 'demo', name, alive: true })), me: { id: 'demo', role: null, alive: true, actionSubmitted: false, voteSubmitted: false, reports: [], teammates: [] } };
}
async function refreshHome() {
  if (demo || !socket?.connected) return;
  home = await request('home:get'); $('#my-avatar').innerHTML = avatar(home.me);
  if (['home', 'profile'].includes(page)) render();
}
async function loadRanks() { if (!demo && socket?.connected) rankings = await request('rankings:get', { period }); render(); }
async function join(roomId) { if (demo) setGame(demoGame()); else setGame((await request('room:join', { roomId })).state); navigate('game'); }
function render() {
  page = menu.some(m => m[0] === page) ? page : 'home';
  document.body.classList.toggle('rank-page', page === 'rank');
  const nav = menu.map(([id, glyph, name]) => `<a class="nav-item ${page === id ? 'active' : ''}" href="#${id}" ${page === id ? 'aria-current="page"' : ''}>${icon(glyph, page === id)}<span>${name}</span></a>`).join('');
  renderMarkup('#desktop-nav', nav); renderMarkup('#mobile-nav', nav); $('#page-name').textContent = menu.find(m => m[0] === page)[2];
  if (page === 'home') renderHome(); else if (page === 'game') renderGame(); else if (page === 'rank') renderRank(); else renderProfile();
  updateClock();
  syncChatOverlay();
}
function renderHome() {
  const rooms = demo ? [{ id:'sample', name:'Do‘stlar davrasi', count:8, max:20 }] : home.rooms;
  renderMarkup('#main', `<div class="page-heading"><div><h1>Xush kelibsiz${demo ? '' : ', '+escape(home.me.name)}.</h1><p class="muted">Bugun kimning sirini ochamiz?</p></div><span class="pill">☾ TUN SHAHRI</span></div>
    <section class="hero"><div class="hero-content"><span class="eyebrow">${icon('sparkle')} KLASSIK O‘YIN. YANGI HIKOYA.</span><h2>Har kimning siri bor.<br><em>Siz kimga ishonasiz?</em></h2><p>Do‘stlar bir stolda. Rollar yashirin.<br>Shahar taqdiri sizning qo‘lingizda.</p><div class="hero-buttons"><button class="primary" data-action="create">${icon('plus')}Xona yaratish</button><button class="ghost" data-action="rules">${icon('book')}Qanday o‘ynaladi?</button></div></div><div class="hero-art hero-role-cards" aria-hidden="true"><div class="catalog-card tier-mythic hero-role-card hero-santa"><span>${santaCardArt}</span><b>Qorbobo</b><i class="tier-badge">MYTHIC</i></div><div class="catalog-card tier-common hero-role-card hero-mafia"><span>${roles.mafia[0]}</span><b>Mafia</b><i class="tier-badge">COMMON</i></div></div></section>
    <div class="quick-facts"><div class="fact">${icon('users')}<div><b>6–20 o‘yinchi</b><small>Bir stol. Ming shubha.</small></div></div><div class="fact">${icon('chat')}<div><b>Muhokama chati</b><small>Haqiqatni birga toping</small></div></div><div class="fact">${icon('rank')}<div><b>16 xil rol</b><small>Har partiyada yangi sir</small></div></div></div>
    <div class="content-grid"><section><div class="section-heading"><h2>Ochiq xonalar</h2><button class="text-button" data-action="refresh">Yangilash ↻</button></div>
    ${home.activeRoom ? '<button class="secondary full" data-action="resume">Davom etayotgan o‘yinimga qaytish →</button><br><br>' : ''}
    ${rooms.length ? rooms.map(r => `<article class="card room-row"><span class="room-icon">${icon('game')}</span><div class="room-info"><h3>${escape(r.name)}</h3><small>${demo ? 'Namuna xona' : 'Klassik Mafia'} <span class="room-count">${r.count}/${r.max} o‘yinchi</span></small></div><button class="secondary" data-join="${escape(r.id)}">Kirish →</button></article>`).join('') : `<div class="card empty">${icon('game')}Hozircha ochiq xona yo‘q.<br>Birinchi xonani siz yarating.</div>`}
    <form id="join-form" class="join-form"><input id="room-code" aria-label="Xona havolasi yoki kodi" placeholder="Xona havolasi yoki kodi" required maxlength="250"><button class="ghost">Qo‘shilish</button></form></section>
    <aside class="side-content"><section class="card side-card"><div class="side-symbol">${icon('users')}</div><span class="eyebrow">GURUHINGIZ BILAN</span><h3>Bir guruh. Bir jamoa.</h3><p>Guruhingizdagi o‘yinlarni yakunlang va reytingda yuqorilang.</p><button class="text-button" data-action="rank">Guruhlar reytingi →</button></section><section class="card side-card"><h3>O‘yin qanday kechadi?</h3><ol class="steps"><li><b>1</b>Yashirin rolingizni bilib oling</li><li><b>2</b>Tunda vazifangizni bajaring</li><li><b>3</b>Muhokama qiling va ovoz bering</li></ol></section></aside></div>
    <div class="section-heading" style="margin-top:28px"><h2>Rollar</h2><button class="text-button" data-action="catalog">Rollar katalogi ↗</button></div><div class="roles" aria-label="O‘ngdan chapga harakatlanadigan rollar"><div class="roles-track">${[...cardEntries,...cardEntries].map(([id,r,tier],i)=>`<button class="role-tile tier-${tier}" data-tier="${tier}" data-role="${id}" data-card-copy="${i>=cardEntries.length?'true':'false'}" style="text-align:left;color:inherit"><span>${cardVisual(id,r,true)}</span><b>${r[1]}</b><small>${r[2].slice(0,62)}${r[2].length>62?'…':''}</small><i class="tier-badge">${tierLabels[tier]}</i></button>`).join('')}</div></div>`);
}
function showCatalog() {
  renderMarkup('#dialog-content', `<div class="catalog-header"><span class="eyebrow">MAFIA · ROLLAR</span><h2>Rollar katalogi</h2><p>Rolni tanlab, to‘liq ma’lumotini ko‘ring.</p></div><div class="catalog-grid">${catalogEntries.map(([id,r,tier])=>`<button class="catalog-card tier-${tier}" data-catalog-card="${id}" aria-label="${escape(r[1])}, ${tierLabels[tier]}"><span>${cardVisual(id,r)}</span><b>${escape(r[1])}</b><i class="tier-badge">${tierLabels[tier]}</i></button>`).join('')}</div>`);
  $('#dialog').showModal();
}
function showCardInfo(id) {
  const entry=cardEntries.find(([key])=>key===id); if(!entry) return;
  const [,r,tier]=entry;
  renderMarkup('#dialog-content', `<button class="text-button catalog-back" data-action="catalog">← Katalogga qaytish</button><article class="catalog-detail tier-${tier}"><span class="tier-badge">${tierLabels[tier]}</span><div class="catalog-detail-icon">${r[0]}</div><span class="eyebrow">${tierLabels[tier]} KARTA</span><h2>${escape(r[1])}</h2><p>${escape(r[2])}</p></article>`);
}
function hint() {
  if (game.phase === 'lobby') return `${game.players.length}/${game.rules.maxPlayers} o‘yinchi. Boshlash uchun kamida ${game.rules.minPlayers} kishi kerak.`;
  if (!game.me.alive) return 'Siz o‘yindan chiqdingiz. O‘yinni kuzatishingiz mumkin.';
  if (game.phase === 'discussion') return 'Fikrlaringizni ayting. Kim shubhali ko‘rinyapti?';
  if (game.phase === 'confirmation') return game.me.confirmationSubmitted ? 'Hukm ovozingiz qabul qilindi.' : `${escape(game.players.find(p=>p.id===game.lastResult?.nominee)?.name || 'Tanlangan o‘yinchi')}ni chiqarish hukmini tasdiqlang yoki rad eting.`;
  if (game.phase === 'night') return game.me.kamikazeChoice ? 'O‘zingiz bilan olib ketadigan o‘yinchini tanlang.' : game.me.actionSubmitted ? 'Harakatingiz qabul qilindi. Tongni kuting.' : ['citizen','sergeant','lucky','suicide','kamikaze','mayor'].includes(game.me.role) ? 'Shahar uxlamoqda. Tongni kuting.' : game.me.role === 'journalist' ? `Ikki kishini tanlang (${selectedTargets.length}/2).` : game.me.role==='commissioner'?(target?'Tekshirish yoki Otishni bosing.':'O‘yinchini tanlang, keyin Tekshirish yoki Otishni bosing.'):'Harakat uchun o‘yinchini tanlang.';
  return game.me.voteSubmitted ? 'Ovozingiz qabul qilindi.' : 'O‘yindan chiqarish uchun o‘yinchini tanlang.';
}
function canTarget(p) {
  if (!p.alive) return false;
  if (game.me.kamikazeChoice) return p.id !== game.me.id;
  if (!game.me.alive) return false;
  if (game.phase === 'voting') return !game.me.voteSubmitted && p.id !== game.me.id;
  if (game.phase !== 'night' || game.me.actionSubmitted || (['citizen','sergeant','lucky','suicide','kamikaze','mayor'].includes(game.me.role) && !(game.me.role==='citizen' && game.rules.halloween && game.me.buffs?.pumpkin>0))) return false;
  if (game.me.role === 'journalist') return p.id !== game.me.id && selectedTargets.length < 2 && !selectedTargets.includes(p.id);
  if (['mafia','don'].includes(game.me.role)) return p.id !== game.me.id && (game.rules.friendlyFire || !game.me.teammates.includes(p.id));
  if (['commissioner','mistress','bodyguard'].includes(game.me.role)) return p.id !== game.me.id;
  return true;
}
function tableDayInfo(){
 if(game.phase!=='discussion')return '';
 const events=game.lastResult?.phase==='night'?game.lastResult.events||[]:[];
 const notices=events.map(e=>{
  if(e.type==='article')return `📰 Jurnalist: ${e.targetIds.map(id=>game.players.find(p=>p.id===id)?.name||'O‘yinchi').join(' va ')} — ${e.sameSide?'bir tomonda':'qarama-qarshi tomonda'}.`;
  return dawnNarrative(e,game.players.find(p=>p.id===e.id)?.name||'O‘yinchi');
 }).filter(Boolean);
 const own=events.find(e=>e.id===game.me.id&&e.lastWordsAllowed&&!e.lastWords);
 return `<section class="table-day-info">${own?`<form id="last-words-form"><label>Oxirgi so‘zingiz<input name="text" maxlength="200" required placeholder="Bir marta xabar qoldiring…"></label><button class="secondary" type="submit">Yuborish</button></form>`:''}<h2>Tonggi xabarlar${demo?' · namuna':''}</h2><div>${notices.map(text=>`<p>${escape(text).replaceAll('\n','<br>')}</p>`).join('')||'<p>Bu tunda hech kim halok bo‘lmadi.</p>'}<p>Tirik qolganlar: <b>${game.players.filter(p=>p.alive).length}</b>. Endi kim shubhali ekanini muhokama qiling.</p></div></section>`;
}
function tableVoting(){
 if(!['voting','confirmation'].includes(game.phase))return '';
 const name=id=>escape(game.players.find(p=>p.id===id)?.name||'O‘yinchi');
 const votes=game.voting?.votes||[],counts=new Map();
 for(const v of votes)if(v.targetId)counts.set(v.targetId,(counts.get(v.targetId)||0)+(v.weight||1));
 const sorted=[...counts].sort((a,b)=>b[1]-a[1]);
 return `<section class="table-voting"><b>${game.phase==='voting'?'Aybdorlarni aniqlash va jazolash vaqti keldi.':`Rostdan ham ${name(game.lastResult?.nominee)}ni osmoqchimisiz?`}</b>${game.phase==='voting'?`${game.rules.hiddenVoting?'<p>Yashirin ovoz berish: boshqalarning ovozi ko‘rsatilmaydi.</p>':`<div class="vote-counts">${sorted.map(([id,n])=>`<span>${name(id)} <strong>${n}</strong></span>`).join('')||'<p>Hali ovoz berilmadi.</p>'}</div>`}<div class="table-vote-log">${votes.map(v=>`<p>${name(v.voterId)} — ${v.targetId?name(v.targetId)+'ga ovoz berdi':'ovozni o‘tkazdi'}.</p>`).join('')}</div>`:`<p class="verdict-count">${game.voting?.approvals||0} 👍 | ${game.voting?.rejections||0} 👎</p>`}</section>`;
}
function demoRole(id){return id==='demo'?'commissioner':['citizen','doctor','don','citizen','mafia'][Number(id)%5];}
function advanceDemoPhase(){
 resolveDemoInspection();
 if(game.phase==='night'){
  const alive=game.players.filter(p=>p.alive&&p.id!==game.me.id);
  const victim=alive.find(p=>p.name==='Lola')||alive.at(-1);
  const events=[];
  if(victim){victim.alive=false;events.push({type:'eliminated',id:victim.id,role:demoRole(victim.id),killerRoles:[['don','commissioner','maniac'][(game.round-1)%3]]});}
  game.lastResult={phase:'night',events,eliminated:events.map(e=>e.id)};game.phase='discussion';
 }
 else if(game.phase==='discussion'){game.phase='voting';game.voting={votes:[],approvals:0,rejections:0};}
 else if(game.phase==='voting'){
  const counts=new Map();for(const v of game.voting?.votes||[])if(v.targetId)counts.set(v.targetId,(counts.get(v.targetId)||0)+1);
  const sorted=[...counts].sort((a,b)=>b[1]-a[1]);
  if(sorted.length&&(!sorted[1]||sorted[0][1]>sorted[1][1])){game.lastResult={phase:'voting',nominee:sorted[0][0]};game.phase='confirmation';}
  else{game.lastResult={phase:'voting',nominee:null};game.phase='night';game.round++;}
 }else{const approved=(game.voting?.approvals||0)>(game.voting?.rejections||0),id=game.lastResult?.nominee;game.lastResult={phase:'confirmation',nominee:id,approved,eliminated:approved?id:null,role:approved&&id?demoRole(id):null,approvals:game.voting?.approvals||0,rejections:game.voting?.rejections||0};if(approved&&id)game.players.find(p=>p.id===id).alive=false;game.phase='night';game.round++;}
 game.me.actionSubmitted=false;game.me.nightAction=null;game.me.voteSubmitted=false;game.me.confirmationSubmitted=false;
 game.deadline=Date.now()+(game.phase==='discussion'?90000:45000);target=null;selectedTargets=[];chatDraft='';render();
}
function introStage(){
 if(page!=='game'||game?.phase!=='night'||!game.deadline)return '';
 const elapsed=Date.now()+serverOffset-(game.deadline-(game.rules.nightMs||45000));
 if(elapsed<0)return '';
 if(game.round===1&&elapsed<2800)return 'start';
 if(elapsed<(game.round===1?5800:2800))return 'night';
 return '';
}
function syncGameIntro(){
 const slot=$('#game-intro');if(!slot)return;
 const stage=introStage();if(slot.dataset.stage===stage)return;
 slot.dataset.stage=stage;
 renderMarkup('#game-intro',stage?`<div class="game-intro ${stage==='night'?'is-night':''}" role="status"><div><span>${stage==='start'?'✦':'☾'}</span><h2>${stage==='start'?'O‘yin boshlandi!':'Tun'}</h2><p>${stage==='start'?'Bir necha soniyada kartalar tarqatiladi va o‘z rolingizni bilib olasiz.':'Ko‘chaga faqat jasur va qo‘rqmas odamlar chiqadi.<br>Ertalab tirik qolganlarni sanaymiz.'}</p></div></div>`:'');
 if(stage)closeChatOverlay();else syncChatOverlay();
}
function nightStory(){
 if(game?.phase!=='night')return '';
 const events=demo?['commissioner','hobo','maniac','doctor','mistress','lawyer','mafia'].slice(0,Math.max(0,Math.floor((Date.now()-(game.deadline-45000)-5800)/1300)+1)).map(role=>nightNarrative(role)):game.nightEvents||[];
 return `<section class="night-story"><div class="night-story-heading"><h2>Tungi voqealar${demo?' · namuna':''}</h2>${events.length>2?`<button type="button" data-action="night-history">Barchasi · ${events.length}</button>`:''}</div>${events.slice(-2).map(text=>`<p>${escape(text)}</p>`).join('')||'<p>Shahar jimjit. Tungi harakatlar kutilmoqda...</p>'}</section>`;
}
function inspectionInfo(){
 if(!game)return '';
 const action=game.me.nightAction;
 if(game.phase==='night'&&game.me.role==='commissioner'&&action?.mode==='check'&&!action.skip){
  const name=escape(game.players.find(p=>p.id===action.targetIds?.[0])?.name||'tanlangan o‘yinchi');
  return `<div class="table-inspection" role="status">Siz ${name}nikiga tekshirishga bordingiz.<small>Natija tongda ma’lum bo‘ladi.</small></div>`;
 }
 const report=[...(game.me.reports||[])].reverse().find(r=>r.role&&r.targetId);
 if(!['commissioner','sergeant'].includes(game.me.role)||!report)return '';
 const name=escape(game.players.find(p=>p.id===report.targetId)?.name||'O‘yinchi');
 return `<div class="table-inspection" role="status"><small>${report.round}-tun · Shaxsiy tekshiruv</small>${game.me.role==='commissioner'?`Siz ${name}nikiga tekshirishga bordingiz.`:`Komissar ${name}ni tekshirdi.`}<b>${name} — ${escape(roles[report.role]?.[1]||report.role)}.</b></div>`;
}
function resolveDemoInspection(){
 if(game?.phase!=='night'||game.me.role!=='commissioner'||game.me.nightAction?.mode!=='check')return;
 const id=game.me.nightAction.targetIds[0];
 if(!(game.me.reports||[]).some(r=>r.round===game.round&&r.targetId===id))game.me.reports.push({round:game.round,targetId:id,role:demoRole(id)});
}
function renderGame() {
  if (!game) { renderMarkup('#main', `<div class="page-heading"><div><h1>O‘yin stoli</h1><p class="muted">Stolingiz sizni kutmoqda.</p></div></div><section class="card empty">${icon('game')}Avval xonaga qo‘shiling yoki o‘z xonangizni yarating.<br><br><button class="primary" data-action="create">Xona yaratish</button></section>`); return; }
  if (game.phase === 'finished') {
    const resultTitle = { mafia:'Mafia g‘alaba qozondi', citizens:'Shahar g‘alaba qozondi', maniac:'Manyak yolg‘iz g‘alaba qozondi', suicide:'Suidsid maqsadiga yetdi', draw:'Durang' };
    renderMarkup('#main', `<section class="card result"><span style="font-size:55px">${game.winner === 'mafia' ? '🎩' : game.winner === 'maniac' ? '🔪' : game.winner === 'suicide' ? '🎭' : '☀'}</span><h2>${resultTitle[game.winner] || 'O‘yin yakunlandi'}</h2>${(game.coWinners||[]).map(p=>`<p>${escape(p.name)} — Suidsid ham g‘alaba qozondi.</p>`).join('')}<p class="muted">Har bir sirning javobi bor.</p>${game.players.map(p=>`<div class="leader-row"><span class="avatar">${avatar(p)}</span><b>${escape(p.name)}</b><span>${roles[p.role]?.[1] || '—'}</span></div>`).join('')}<br><button class="primary" data-action="home">Bosh sahifaga</button></section>`); return;
  }
  const canSubmit = game.phase === 'confirmation' ? false : game.me.kamikazeChoice ? target : game.phase === 'voting' ? target : game.me.role === 'journalist' ? selectedTargets.length === 2 : target;
  const selectedIds = game.me.role === 'journalist' ? selectedTargets : [];
  const reportText = r => {
    if(r.donSearch)return `${r.round}-tun: ${escape(game.players.find(p=>p.id===r.targetId)?.name)} — ${r.isCommissioner?'komissar':'komissar emas'}`;
    if(r.notification) return `${r.round}-tun: Kimdir sizga tashrif buyurdi.`;
    if (r.targetIds) return `${r.round}-tun: ${escape(game.players.find(p=>p.id===r.targetIds[0])?.name)} va ${escape(game.players.find(p=>p.id===r.targetIds[1])?.name)} — ${r.sameSide?'bir tomonda':'qarama-qarshi tomonda'}`;
    if (r.visitors) return `${r.round}-tun: ${escape(game.players.find(p=>p.id===r.targetId)?.name)} oldiga borganlar: ${r.visitors.map(id=>escape(game.players.find(p=>p.id===id)?.name)).join(', ') || 'hech kim'}`;
    return `${r.round}-tun: ${escape(game.players.find(p=>p.id===r.targetId)?.name)} — ${roles[r.role]?.[1] || (r.isMafia?'mafiya':'fuqaro')}`;
  };
  const privateRole = roles[game.me.role] || null;
  const cardOpen = game.me.cardOpen === true;
  const aliveCount=game.players.filter(p=>p.alive).length;
  const playerName=id=>escape(game.players.find(p=>p.id===id)?.name || 'O‘yinchi');
  const messages=(game.lastResult?.events||[]).map(e=>e.type==='article'?`<p>📰 ${e.targetIds.map(playerName).join(' va ')} — ${e.sameSide?'bir tomonda':'qarama-qarshi tomonda'}.</p>`:['eliminated','donSuccession'].includes(e.type)?`<p class="dawn-notice">${escape(dawnNarrative(e,game.players.find(p=>p.id===e.id)?.name||'O‘yinchi')).replaceAll('\n','<br>')}</p>`:'').join('');
  const matchCommand = `<section class="match-command ${game.phase==='confirmation'?'table-verdict':''}"><p class="table-hint">${hint()}</p><div class="game-actions">${game.phase === 'lobby' ? `${(!game.rules.adminOnlyStart || game.ownerId === game.me.id) ? `<button class="primary" data-action="start" ${game.players.length<game.rules.minPlayers?'disabled':''}>O‘yinni boshlash →</button>` : ''}<button class="ghost" data-action="leave">Xonadan chiqish</button>` : game.phase === 'confirmation' ? `${game.me.alive&&!game.me.confirmationSubmitted?`<button class="primary" data-action="confirm" data-confirm="true">👍 Tasdiqlash</button><button class="ghost" data-action="confirm" data-confirm="false">👎 Rad etish</button>`:''}` : `${game.phase === 'night' && game.me.role === 'commissioner' && !game.me.actionSubmitted ? `<button class="secondary" data-mode="check" aria-pressed="${actionMode==='check'}">Tekshirish</button>${game.rules.commissionerShoot!==false&&(game.round>1||game.rules.firstNightShoot!==false)?`<button class="secondary" data-mode="kill" aria-pressed="${actionMode==='kill'}">Otish</button>`:''}` : ''}${game.phase==='night' && game.me.role==='don' && game.rules.donSearch && !game.me.actionSubmitted ? `<button class="secondary" data-mode="check" aria-pressed="${actionMode!=='search'}">Hujum</button><button class="secondary" data-mode="search" aria-pressed="${actionMode==='search'}">Komissarni qidirish</button>`:''}${canSubmit && game.phase==='voting' ? `<button class="primary" data-action="submit">${game.phase === 'voting'?'Ovoz berish':game.me.role === 'journalist'?'Taqqoslash':game.me.role==='commissioner'?(actionMode==='kill'?'Otishni tasdiqlash':'Tekshirishni tasdiqlash'):'Tungi harakatni yuborish'}</button>` : ''}${game.me.alive && !game.me.kamikazeChoice && ((game.phase==='night' && game.rules.skipNight && !game.me.actionSubmitted && !['citizen','sergeant','lucky','suicide','kamikaze','mayor'].includes(game.me.role)) || (game.phase==='voting' && game.rules.skipVoting && !game.me.voteSubmitted)) ? '<button class="ghost" data-action="skip">O‘tkazib yuborish</button>' : ''}${demo ? '<button class="ghost" data-action="demo-next">Keyingi bosqich (demo) →</button>' : ''}`}</div></section>`;
  renderMarkup('#main', `<div class="match-screen"><div id="game-intro"></div><div class="match-heading"><div><span class="eyebrow">${game.phase==='lobby'?'O‘YIN XONASI':`${game.round}-DAVRA`}</span><h1>${game.group ? escape(game.group.name) : 'Do‘stlar davrasi'}</h1></div><button class="ghost" data-action="invite" aria-label="Do‘stlarni taklif qilish">${icon('plus')} Taklif</button></div><section class="match-status"><div><span class="match-status-dot ${game.phase==='night'?'night':''}"></span><b>${phases[game.phase]}</b><small>${game.phase==='lobby'?`${game.players.length}/${game.rules.maxPlayers} ishtirokchi`:`${aliveCount} kishi o‘yinda`}</small></div><span class="timer" id="timer">—</span></section><button class="match-role ${cardOpen?'is-open':''}" data-action="flip-card" aria-label="${cardOpen?'Kartani yopish':'Rol kartangizni ochish'}" ${!privateRole?'disabled':''}><span class="match-role-icon">${privateRole?(cardOpen?privateRole[0]:icon('lock')):icon('game')}</span><span><small>SIZNING ROLINGIZ</small><b>${privateRole?(cardOpen?escape(privateRole[1]):'Yashirin karta'):'Hali tarqatilmadi'}</b><em>${privateRole?(cardOpen?'Tavsif va vazifangizni ko‘rish':'Ochish uchun bosing'):'O‘yin boshlanganda shu yerda ko‘rinadi'}</em></span><span class="match-role-arrow">›</span></button>${cardOpen&&privateRole?`<p class="match-role-description">${escape(privateRole[2])}</p>`:''}${['night','voting','confirmation'].includes(game.phase)?'':matchCommand}<section class="match-roster"><div class="match-section-heading"><h2>O‘yinchilar</h2><span>${game.players.length} kishi${game.phase!=='lobby'?` · ${game.players.length-aliveCount} chiqdi`:''}</span></div><div class="match-table ${game.players.length>12?'crowded':''}" style="--seats:${game.players.length};--table-height:${Math.ceil(game.players.length/2)*62+40}px"><div class="match-table-surface ${game.phase==='night'?'has-night-actions':''}"><div class="table-clock-group"><span class="table-phase">${game.phase==='night'?'Tun':game.phase==='lobby'?'':`${game.round}-kun`}</span><span class="table-timer" id="table-timer" role="timer" aria-label="Bosqich tugashigacha qolgan vaqt">—</span></div><div class="table-caption"><span>${escape(game.group?.name||'Do‘stlar davrasi')}</span><small>${game.phase==='lobby'?'O‘YIN XONASI':`${game.round}-DAVRA`}</small></div>${tableDayInfo()}${inspectionInfo()}${game.lastResult?.phase==='confirmation'?`<div class="table-verdict-result">Ovoz berish natijalari: ${game.lastResult.approvals} 👍 | ${game.lastResult.rejections} 👎<br>${game.lastResult.approved?`${escape(game.players.find(p=>p.id===game.lastResult.eliminated)?.name||'O‘yinchi')} — ni osamiz!${game.lastResult.role?`<br>${escape(roles[game.lastResult.role]?.[1]||game.lastResult.role)} edi.`:''}`:'Hukm rad etildi.'}</div>`:''}${['voting','confirmation'].includes(game.phase)?tableVoting()+matchCommand:''}${game.phase==='night'?`${target||selectedIds.length?`<p class="table-selected-target">Tanlangan: ${[...new Set([...(target?[target]:[]),...selectedIds])].map(id=>escape(game.players.find(p=>p.id===id)?.name||'')).join(', ')}</p>`:''}${matchCommand}<div id="night-story-slot"></div>`:''}</div>${game.players.map((p,i)=>{const n=game.players.length,topCount=Math.ceil(n/4),sideCount=Math.floor(n/4),bottomCount=n-topCount-2*sideCount,side=i<topCount?0:i<topCount+sideCount?1:i<topCount+sideCount+bottomCount?2:3,offset=side===0?i:side===1?i-topCount:side===2?i-topCount-sideCount:i-topCount-sideCount-bottomCount,count=side===0?topCount:side===2?bottomCount:sideCount,x=side===1?93:side===3?7:20+60*(offset+.5)/count,y=side===0?5:side===2?95:20+60*(offset+.5)/count,selected=target===p.id||selectedIds.includes(p.id);return `<button class="table-player ${p.alive?'':'is-dead'} ${selected?'is-selected':''}" style="left:${x}%;top:${y}%" data-target="${escape(p.id)}" ${canTarget(p)?'':'disabled'} aria-label="${escape(p.name)}${!p.alive?' — o‘yindan chiqqan':''}" aria-pressed="${selected}"><span class="avatar">${avatar(p)}</span><b>${escape(p.name)}</b><small>${String(i+1).padStart(2,'0')}${p.id===game.me.id?' · Siz':''}${!p.alive?' · Chiqdi':''}</small></button>`;}).join('')}</div></section>${renderMatchChat()}${game.phase==='voting'||game.phase==='confirmation'?`<section class="match-feed"><div class="match-section-heading"><h2>${game.phase==='confirmation'?'Hukm tasdig‘i':'Ovozlar'}</h2>${game.phase==='confirmation'?`<span>${game.voting?.approvals||0} 👍 · ${game.voting?.rejections||0} 👎</span>`:''}</div>${(game.voting?.votes||[]).map(v=>`<p>${playerName(v.voterId)} <span>→</span> ${v.targetId?playerName(v.targetId):'O‘tkazib yubordi'}</p>`).join('')||'<p class="muted">Hali ovoz berilmadi.</p>'}</section>`:''}${messages?`<section class="match-feed"><h2>Oxirgi voqealar</h2>${messages}</section>`:''}${game.me.reports.length?`<details class="match-feed"><summary>Shaxsiy hisobotlar <span>${game.me.reports.length}</span></summary>${game.me.reports.map(r=>`<p>${reportText(r)}</p>`).join('')}</details>`:''}</div>`);
}
let chatDraft='',chatDismissedKey=null,chatOverlayKey=null;
const chatKey=()=>game?`${game.id}:${game.round}:${game.phase}:${game.deadline}`:null;
function currentChat(){
 if(!game || document.hidden || (game.deadline && Date.now()+serverOffset>=game.deadline))return {channel:null,messages:[]};
 if(!demo)return game.chat||{channel:null,messages:[]};
 const channel=!game.me.alive?null:game.phase==='discussion'?'discussion':game.phase==='night'&&['don','mafia'].includes(game.me.role)?'mafia':null;
 return {channel,messages:(game.demoMessages||[]).filter(m=>m.channel===channel&&m.round===game.round)};
}
let outgoingChat=[];
function chatMessageMarkup(m){
 const p=game.players.find(p=>p.id===m.userId)||{name:m.name};
 return `<div class="chat-message ${m.userId===game.me.id?'own':''} ${m.failed?'is-failed':''}"><span class="chat-avatar">${avatar(p)}</span><div class="chat-bubble"><b>${escape(p.username?'@'+p.username:p.name||m.name)}</b><p>${escape(m.text)}</p><time>${m.failed?'Yuborilmadi':m.pending?'Yuborilmoqda…':new Date(m.at).toLocaleTimeString('uz-UZ',{hour:'2-digit',minute:'2-digit'})}</time></div></div>`;
}
function renderChatContents(){
 const chat=currentChat();
 if(!chat.channel)return '';
 return `<section class="match-chat ${chat.channel==='mafia'?'mafia-chat':''}"><div class="match-section-heading"><h2 id="match-chat-title">${chat.channel==='mafia'?'Don jamoasi · maxfiy chat':'Tirik o‘yinchilar chati'}</h2><span>${chat.channel==='mafia'?'Faqat Don va mafiyalar':'Muhokama'}</span></div><div class="chat-overlay-info"><span>Vaqt tugashi bilan chat yopiladi</span><b id="chat-countdown"></b></div><div class="chat-log" role="log" aria-label="${chat.channel==='mafia'?'Maxfiy jamoa yozishmalari':'Muhokama yozishmalari'}">${[...chat.messages,...outgoingChat.filter(m=>m.key===chatKey()&&!chat.messages.some(r=>r.userId===m.userId&&r.text===m.text&&Math.abs(r.at-m.at)<10000))].map(chatMessageMarkup).join('')||`<p class="chat-empty">${chat.channel==='mafia'?'Bu yozishmalar boshqa o‘yinchilarga ko‘rinmaydi.':'Muhokamani boshlang.'}</p>`}</div>${chat.muted?'<p class="chat-empty" role="status">Ma’shuqa ta’siri: bu muhokamada xabar yoza olmaysiz.</p>':''}<form id="match-chat-form"><input id="match-chat-input" name="text" aria-label="Chat xabari" placeholder="Xabar yozing…" maxlength="500" autocomplete="off" required ${chat.muted?'disabled':''} value="${escape(chatDraft)}"><button type="submit" class="primary" aria-label="Xabarni yuborish" ${chat.muted?'disabled':''}>↑</button></form><button type="button" class="ghost full" data-chat-table>Stolga qaytish</button></section>`;
}
function renderMatchChat(){
 const chat=currentChat();
 return chat.channel?`<button class="secondary full chat-reopen" data-action="open-chat">${chat.channel==='mafia'?'Don jamoasining maxfiy chatini ochish':'Muhokama chatini ochish'}</button>`:'';
}
function closeChatOverlay(){
 const dialog=$('#match-chat-dialog');
 if(dialog.open)dialog.close();
 renderMarkup('#match-chat-content','');chatOverlayKey=null;
}
function syncChatOverlay(){
 if(introStage()){closeChatOverlay();return;}
 const chat=currentChat(),key=chatKey(),dialog=$('#match-chat-dialog');
 if(page!=='game'||!chat.channel||chatDismissedKey===key){closeChatOverlay();return;}
 if(chatOverlayKey!==key){chatDraft='';if($('#match-chat-input'))$('#match-chat-input').value='';}
 chatOverlayKey=key;
 const log=$('.chat-log'),nearBottom=!log || log.scrollHeight-log.scrollTop-log.clientHeight<60;
 renderMarkup('#match-chat-content',renderChatContents());
 if(!dialog.open){$('#dialog').close();$('.match-table')?.scrollIntoView({block:'center'});dialog.showModal();}
 if(nearBottom && $('.chat-log'))$('.chat-log').scrollTop=$('.chat-log').scrollHeight;
 updateChatCountdown();
}
function updateChatCountdown(){const el=$('#chat-countdown');if(el&&game?.deadline){const seconds=Math.max(0,Math.ceil((game.deadline-Date.now()-serverOffset)/1000));el.textContent=`${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;}}
$('#match-chat-dialog').addEventListener('cancel',e=>{e.preventDefault();chatDismissedKey=chatKey();closeChatOverlay();});
$('#match-chat-content').addEventListener('click',e=>{if(e.target.closest('[data-chat-table]')){chatDismissedKey=chatKey();closeChatOverlay();$('.match-table')?.scrollIntoView({block:'center',behavior:'smooth'});}});
$('#match-chat-content').addEventListener('input',e=>{if(e.target.id==='match-chat-input')chatDraft=e.target.value;});
let chatBusy=false;
$('#match-chat-content').addEventListener('submit',async e=>{
 if(e.target.id!=='match-chat-form')return;e.preventDefault();if(chatBusy)return;
 const text=String(new FormData(e.target).get('text')||'').trim();if(!text || !currentChat().channel)return;
 chatBusy=true;const pending=chatDraft,sendingKey=chatKey();chatDraft='';
 const optimistic={id:crypto.randomUUID(),key:sendingKey,userId:game.me.id,name:game.players.find(p=>p.id===game.me.id)?.name||'Siz',text,at:Date.now()+serverOffset,pending:true};
 if(!demo){outgoingChat.push(optimistic);syncChatOverlay();const log=$('.chat-log');if(log)log.scrollTop=log.scrollHeight;}
 try{
  if(demo){const channel=currentChat().channel;game.demoMessages=[...(game.demoMessages||[]),{id:String(Date.now()),userId:game.me.id,name:'Siz',text,at:Date.now(),channel,round:game.round}];render();}
  else {const result=await request('game:chat',{text});outgoingChat=outgoingChat.filter(m=>m.id!==optimistic.id);setGame(result.state);}
  const log=$('.chat-log');if(log)log.scrollTop=log.scrollHeight;if($('#match-chat-input')){$('#match-chat-input').value='';$('#match-chat-input').focus();}
 }catch(err){optimistic.pending=false;optimistic.failed=true;chatDraft=sendingKey===chatKey()?pending:'';render();if($('#match-chat-input'))$('#match-chat-input').value=chatDraft;toast(err.message);}finally{chatBusy=false;}
});
function renderRank() {
  const list = rankings[rankKind];
  renderMarkup('#main', `<div class="page-heading"><div><h1>Shahar yetakchilari</h1><p class="muted">Faol o‘yinlar. Kuchli jamoalar. Haqiqiy raqobat.</p></div><details class="rank-help"><summary>Mukofot va qoidalar</summary><div class="rank-help-content"><p class="rule-copy">Haftalik mukofot: 1–3-o‘rin — 1000, 4–10 — 600, 11–20 — 400, 21–30 — 200 tanga. Bu har bir guruhning jami mukofoti. Mukofot kamida 3 ta hisoblangan o‘yinda faol qatnashganlarga tarqatiladi. Har o‘yinchi haftasiga faqat bitta — reytingda eng yuqori turgan mos guruhidan mukofot oladi. Hafta dushanba 00:00 da (Toshkent) yakunlanadi.</p><p class="rule-copy">Guruhga har bir mos o‘yin uchun 10 + ishtirokchilar sonicha ochko. Bir xil tarkibning shu kundagi takroriy o‘yinlariga yarim ball beriladi (pastga yaxlitlanadi). Guruh bir kunda ko‘pi bilan 100 ochko oladi; limitga yetgach qo‘shimcha ochko berilmaydi. O‘yin kamida 3 daqiqa davom etishi va kamida yarmi harakat yoki ovoz yuborishi kerak. Davrlar Toshkent vaqti bo‘yicha hisoblanadi.</p></div></details></div><div class="rank-filters"><div class="ranking-tabs"><button data-kind="groups" class="${rankKind==='groups'?'active':''}">Guruhlar</button><button data-kind="players" class="${rankKind==='players'?'active':''}">O‘yinchilar</button></div><div class="periods">${[['week','Haftalik'],['month','Oylik'],['all','Umumiy']].map(([id,name])=>`<button data-period="${id}" class="${period===id?'active':''}">${name}</button>`).join('')}</div></div><section class="card rank-list">${list.length ? list.map((r,i)=>`<div class="leader-row"><span class="place">${String(i+1).padStart(2,'0')}${rankKind==='groups'&&period==='week'&&i<30?'<small class="rank-reward-badge" title="Haftalik tanga mukofoti">🪙</small>':''}</span><div class="rank-identity">${rankKind==='groups'?`<span class="rank-group-avatar">${escape((r.name||'G').slice(0,1))}${r.photoUrl?`<img src="${escape(r.photoUrl)}" alt="" loading="lazy">`:''}</span>`:''}<div><b>${rankKind==='groups'&&r.url?`<a class="rank-group-link" href="${escape(r.url)}" target="_blank" rel="noopener noreferrer">${escape(r.name)}</a>`:rankKind==='players'?`<button class="rank-player-link" data-player-profile="${escape(r.id)}">${escape(r.name)}</button>`:escape(r.name)}${rankKind==='groups'&&r.official?'<span class="official-group-badge" role="img" aria-label="Rasmiy guruh" title="Rasmiy guruh"><svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#3390ec" d="m12 0 2.8 2 3.4-.1 1 3.2 2.8 2-.9 3.3 1.1 3.2-2.7 2.2-.8 3.3-3.4.1L12 22l-2.8-2-3.4.1-1-3.2L2 15l.9-3.3-1.1-3.2 2.7-2.2.8-3.3 3.4-.1Z"/><path d="m7.5 11.5 3 3 6-6" fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg></span>':''}</b><small>${r.games} hisoblangan o‘yin${rankKind==='players'?` · ${r.wins} g‘alaba`:''}</small></div></div><strong>${r.points}<small>${rankKind==='players'?'tanga':'ochko'}</small></strong></div>`).join('') : `<div class="empty">${icon('rank')}Reyting hali shakllanmagan.<br>Birinchi hisobga olinadigan o‘yinni yakunlang.</div>`}</section>`);
}
function showReferrals(){
 const r=home.referrals||{invited:0,qualified:0,earned:0,bonus:0};
 const link=config.botUsername&&!demo?`https://t.me/${config.botUsername}?start=ref_${home.me.id}`:'';
 $('#dialog').classList.remove('shop-screen','settings-screen');
 renderMarkup('#dialog-content',`<div class="referral-panel"><span class="eyebrow">DÖSTLAR BILAN ÖYNANG</span><h2>Referal mukofotlari</h2><p>Döstingizni taklif qiling. U birinchi hisoblangan öyinida faol qatnaşsa, <b>ikkalangizga 10 tangadan</b> beriladi.</p><div class="stats"><div class="stat"><strong>${r.invited}</strong><small>Taklif qilingan</small></div><div class="stat"><strong>${r.qualified}</strong><small>Faol referallar</small></div><div class="stat"><strong>${r.earned}</strong><small>Olingan tanga</small></div></div>${r.bonus?`<p>Taklif orqali olgan bonusingiz: <b>${r.bonus} tanga</b>.</p>`:''}${link?`<label>Şaxsiy havolangiz<input value="${escape(link)}" readonly aria-label="Referal havolasi"></label><button class="primary full" data-action="copy-referral">Havolani nusxalaş</button>`:'<p>Şaxsiy havola Telegram orqali kirganda körinadi.</p>'}<p>Faqat yangi foydalanuvçi hisoblanadi. Kamida 6 kişilik, 3 daqiqalik va faollik şartlari bajarilgan öyin kerak. Qisqa, takroriy yoki faol qatnaşilmagan öyinlar mukofot bermaydi. Bonus har bir yangi foydalanuvçi uçun bir marta beriladi.</p></div>`);
 if(!$('#dialog').open)$('#dialog').showModal();
}
function renderProfile() {
  const { games, wins, points } = home.profile;
  const rate = games ? Math.round(wins / games * 100) : 0;
  renderMarkup('#main', `<div class="page-heading"><div><h1>Mening profilim</h1><p class="muted">Shahardagi hikoyangiz shu yerdan boshlanadi.</p></div><span class="pill">O‘YINCHI KARTASI</span></div>
    <section class="card profile-card"><div class="profile-cover" aria-hidden="true"></div>
    <div class="profile-head"><span class="avatar">${avatar(home.me)}</span><h2>${escape(home.me.name)}</h2><p class="muted">${home.me.username ? '@'+escape(home.me.username) : demo ? 'Telegram orqali kirganda profilingiz ko‘rinadi' : 'Telegram o‘yinchisi'}</p></div>
    <div class="stats"><div class="card stat">${icon('game')}<strong>${games}</strong><small>Hisoblangan o‘yinlar</small></div><div class="card stat">${icon('rank')}<strong>${wins}</strong><small>G‘alabalar</small></div><div class="card stat">${icon('sparkle')}<strong>${points}</strong><small>Ishlab topilgan tanga</small></div></div>
    <div class="profile-summary"><div class="win-rate"><span>G‘alaba ulushi</span><b>${games ? rate+'%' : 'Hali o‘yin yo‘q'}</b></div><div class="progress" role="progressbar" aria-label="G‘alaba ulushi" aria-valuenow="${rate}" aria-valuemin="0" aria-valuemax="100"><div class="progress-bar" style="width:${rate}%"></div></div></div>
    <div class="profile-links"><button class="profile-link" data-action="referrals">${icon('users')}<span>Döstlarni taklif qiling<small>${home.referrals?.qualified||0} faol referal · ikkalangizga 10 tangadan</small></span>${icon('chevron')}</button><button class="profile-link" data-action="shop">${icon('shop')}<span>Do‘kon va inventar<small>${home.inventory?.coins||0} tanga · himoya, hujjat va faol rol</small></span>${icon('chevron')}</button><button class="profile-link" data-action="groups">${icon('users')}<span>Guruhlarim<small>Guruh qo‘shish va o‘yin sozlamalari</small></span>${icon('chevron')}</button><button class="profile-link" data-action="rank">${icon('rank')}<span>Shahar yetakchilari<small>Guruhlar va o‘yinchilar reytingi</small></span>${icon('chevron')}</button><button class="profile-link" data-action="scoring">${icon('help')}<span>Tanga qanday beriladi?<small>Ishtirok 1 · G‘alaba 10 · Halok bo‘lib yutsa 5</small></span>${icon('chevron')}</button><button class="profile-link" data-action="rules">${icon('book')}<span>O‘yin qoidalari<small>Rollar, muhokama va ovoz berish</small></span>${icon('chevron')}</button></div>${demo ? `<div class="profile-foot">${icon('verified')}Demo hisob · Natijalar saqlanmaydi</div>` : ''}</section>`);
}
async function showPlayerProfile(id){
 const player=demo?rankings.players.find(p=>p.id===id):(await request('players:profile',{userId:id})).player;
 if(!player)return;
 const rate=player.games?Math.round(player.wins/player.games*100):0;
 $('#dialog').classList.remove('settings-screen','shop-screen');
 renderMarkup('#dialog-content',`<span class="eyebrow">O‘YINCHI STATISTIKASI</span><h2 style="margin-top:14px">${escape(player.name)}</h2><p>Umumiy natijalar · barcha davrlar</p><div class="player-stat-grid"><div><strong>${player.games}</strong><small>Hisoblangan o‘yin</small></div><div><strong>${player.wins}</strong><small>G‘alaba</small></div><div><strong>${rate}%</strong><small>G‘alaba ulushi</small></div><div><strong>${player.points}</strong><small>Ishlab topilgan tanga</small></div></div>`);
 if(!$('#dialog').open)$('#dialog').showModal();
}
const shopItems=[['protection','Himoya',100,'Bir o‘yinda bitta tungi hujumdan saqlaydi.'],['documents','Hujjatlar',150,'Tekshiruvda mafiya rolini yashiradi.'],['active_role','Faol rol',200,'Faol rol bo‘sh bo‘lsa, bir o‘yinga beriladi.'],['pumpkin','Qovoq',100,'Halloween rejimida tinch aholi tunda hujum qiladi.'],['candy','Shirinlik',30,'Qovoq hujumidan saqlaydi.']];
let shopTab='store';
const shopSymbols={protection:'🛡',documents:'📂',active_role:'🎴',pumpkin:'🎃',candy:'🍬'};
function showShop(){
 $('#dialog').classList.remove('settings-screen');
 $('#dialog').classList.add('shop-screen');
 const inventory=home.inventory||{}, balance=inventory.coins||0;
 const owned=shopItems.filter(([id])=>(inventory[id]||0)>0);
 const items=shopTab==='inventory'?owned:shopItems;
 renderMarkup('#dialog-content',`<div class="shop-heading"><span class="eyebrow">MAFIA DO‘KONI</span><h2>Do‘kon va inventar</h2></div><section class="shop-wallet"><small>Hamyoningiz</small><strong>${balance}<span>tanga</span></strong><p>O‘yinda ishlab toping, kerakli buyumga sarflang.</p></section><div class="shop-tabs" role="tablist" aria-label="Do‘kon bo‘limlari"><button role="tab" aria-selected="${shopTab==='store'}" data-shop-tab="store">Do‘kon</button><button role="tab" aria-selected="${shopTab==='inventory'}" data-shop-tab="inventory">Inventar · ${shopItems.reduce((sum,[id])=>sum+(inventory[id]||0),0)}</button></div>${demo?'<p class="shop-note">Namuna rejimi: xaridlar Telegram orqali kirganda ishlaydi.</p>':''}<div class="shop-items" role="tabpanel" aria-label="${shopTab==='store'?'Do‘kon':'Inventar'}">${items.map(([id,name,price,description])=>`<article class="shop-item"><div class="shop-item-head"><span class="shop-item-icon" aria-hidden="true">${shopSymbols[id]}</span><div><h3>${name}</h3><small>Inventarda: ${inventory[id]||0} ta</small></div>${shopTab==='store'?`<b class="shop-price">${price}<small>tanga</small></b>`:''}</div><p>${description}</p>${shopTab==='store'?`<button type="button" class="secondary full" data-shop-buy="${id}" ${demo||balance<price?'disabled':''}>${balance<price?`${price-balance} tanga yetishmayapti`:`${price} tangaga sotib olish`}</button>`:'<small class="shop-use-note">Mos o‘yin holatida avtomatik ishlatiladi.</small>'}</article>`).join('')||'<div class="shop-empty">Inventaringiz hozircha bo‘sh.<p>Do‘kondan olgan buyumlaringiz shu yerda ko‘rinadi.</p><button class="secondary" data-shop-tab="store">Do‘konga o‘tish</button></div>'}</div><section class="shop-earn"><b>Haftalik tanga mukofotlari</b><p>Har bir guruhga: 1–3-o‘rin — 1000, 4–10 — 600, 11–20 — 400, 21–30 — 200 tanga. Kamida 3 ta hisoblangan o‘yinda faol qatnashganlar orasida tarqatiladi. Bir nechta guruhda o‘ynasangiz, haftasiga faqat eng yuqori o‘rindagi mos guruhdan mukofot olasiz.</p>${(home.weeklyRewards||[]).map(r=>`<p>${escape(r.groupName)} · #${r.rank} · ${new Date(r.weekStart).toLocaleDateString('uz-UZ',{timeZone:'Asia/Tashkent'})}<br><b>${r.coins?`+${r.coins} tanga`:`+${r.activeRole} faol rol kartasi`}</b></p>`).join('')||'<small>Haftalik mukofotlaringiz shu yerda ko‘rinadi.</small>'}</section><div class="shop-earn"><b>Tanga qanday olinadi?</b><p>Faol ishtirok — 1 tanga. Jamoangiz yutsa: tirik qolsangiz 10 tanga, halok bo‘lsangiz 5 tanga.</p><small>Kuniga 5 ta mos o‘yin; bir xil tarkib uchun kuniga bir marta. Baflar guruh sozlamasida yoqilganida buyumlar ishlaydi.</small></div>`);
 if(!$('#dialog').open)$('#dialog').showModal();
}
function showRole(role) { const r = roles[role]; if (!r) return; renderMarkup('#dialog-content', `<div class="role-emoji">${r[0]}</div><span class="eyebrow">YASHIRIN ROL · ${escape(({mafia:'MAFIYA',don:'MAFIYA',lawyer:'MAFIYA',maniac:'YAKKA',suicide:'NEYTRAL'})[role] || 'SHAHAR')}</span><h2 style="margin-top:15px">${r[1]}</h2><p>${r[2]}</p>${['mafia','don'].includes(role) && game?.me.teammates.length ? `<p>Jamoadoshlar: ${game.me.teammates.map(id=>escape(game.players.find(p=>p.id===id)?.name)).join(', ')}</p>` : role === 'sergeant' && game?.me.commissionerId ? `<p>Komissar: ${escape(game.players.find(p=>p.id===game.me.commissionerId)?.name)}</p>` : ''}`); $('#dialog').showModal(); }
$('#close-dialog').onclick = () => $('#dialog').close();
function updateClock() {
  if($('#match-chat-dialog').open && !currentChat().channel){chatDraft='';closeChatOverlay();}
  updateChatCountdown();
  syncGameIntro();
  const storySlot=$('#night-story-slot');if(storySlot){const story=nightStory();if(storySlot._story!==story){storySlot._story=story;renderMarkup('#night-story-slot',story);}}
  const clock = $('#timer'); if (!clock || !game?.deadline) return;
  const seconds = Math.max(0, Math.ceil((game.deadline - (Date.now()+serverOffset))/1000));
  const timeText = `${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;
  clock.textContent = timeText;
  const tableClock=$('#table-timer');if(tableClock)tableClock.textContent=timeText;
  if(!seconds && demo){advanceDemoPhase();return;}
}
setInterval(updateClock, 250);
document.addEventListener('visibilitychange', () => { if (document.hidden) { closeChatOverlay(); $('#dialog').close();  } else if (!demo && game && socket?.connected) request('game:sync').then(r=>setGame(r.state)).catch(e=>toast(e.message)); });
$('#main').addEventListener('submit', async event => { if(event.target.id !== 'join-form') return; event.preventDefault(); let code = $('#room-code').value.trim(); try { if(code.startsWith('https://')) { const u=new URL(code); code=u.searchParams.get('startapp')||u.searchParams.get('room'); } await join(code); } catch(e) {toast(e.message);} });
async function submitSelection(){
  if(demo) {if(game.phase==='voting'){game.me.voteSubmitted=true;game.voting||={votes:[],approvals:0,rejections:0};game.voting.votes.push({voterId:game.me.id,targetId:target});}else {game.me.actionSubmitted=true;game.me.nightAction={mode:actionMode,targetIds:[target]};}target=null;selectedTargets=[];render();toast('Demo: tanlov qabul qilindi');} else {const event=game.me.kamikazeChoice?'game:kamikaze':game.phase==='voting'?'game:vote':'game:night-action';const payload=game.phase==='voting'||game.me.kamikazeChoice?{targetId:target,revision:game.revision}:{targetId:target,targetIds:game.me.role==='journalist'?selectedTargets:undefined,mode:['commissioner','don'].includes(game.me.role)?actionMode:undefined,revision:game.revision};setGame((await request(event,payload)).state);target=null;selectedTargets=[];render();}
}
$('#main').addEventListener('submit',async e=>{
 if(e.target.id!=='last-words-form')return;e.preventDefault();if(busy)return;
 const text=String(new FormData(e.target).get('text')||'').trim();if(!text)return;busy=true;
 try{if(demo){const event=game.lastResult.events.find(r=>r.id===game.me.id);event.lastWords=text;render();}else setGame((await request('game:last-words',{text})).state);}catch(err){toast(err.message);}finally{busy=false;}
});
$('#main').addEventListener('click', async event => {
  const b = event.target.closest('button'); if (!b || b.disabled || busy) return;
  busy = true;
  try {
    if (b.dataset.playerProfile) await showPlayerProfile(b.dataset.playerProfile);
    else if (b.dataset.join) await join(b.dataset.join);
    else if (b.dataset.role) { showCardInfo(b.dataset.role); $('#dialog').showModal(); }
    else if (b.dataset.mode) { actionMode = b.dataset.mode; if(game?.phase==='night' && target && !game.me.actionSubmitted)await submitSelection();else render(); }
    else if (b.dataset.target) { if (game?.phase === 'night' && game.me.role === 'journalist') selectedTargets = [...selectedTargets, b.dataset.target]; else target = b.dataset.target; if(game?.phase==='night' && (game.me.kamikazeChoice || (game.me.role==='journalist'?selectedTargets.length===2:!['commissioner','don'].includes(game.me.role)||game.me.role==='don'&&!game.rules.donSearch)))await submitSelection();else render(); }
    else if (b.dataset.kind) { rankKind = b.dataset.kind; render(); }
    else if (b.dataset.period) { period = b.dataset.period; await loadRanks(); }
    else switch (b.dataset.action) {
      case 'open-chat': chatDismissedKey=null;syncChatOverlay();break;
      case 'create': if(demo) setGame(demoGame()); else setGame((await request('room:create')).state); navigate('game'); break;
      case 'refresh': await refreshHome(); toast(demo?'Bu namuna xonalar ro‘yxati':'Xonalar yangilandi'); break;
      case 'resume': await join(home.activeRoom); break;
      case 'home': if(game?.phase==='finished') {game=null;sessionStorage.removeItem('mafia-room');} await refreshHome(); navigate('home'); break;
      case 'rank': navigate('rank'); break;
      case 'leave': if(!demo) await request('room:leave'); game=null; sessionStorage.removeItem('mafia-room'); navigate('home'); break;
      case 'start': if(demo) {game.phase='night';game.round=1;game.me.role='commissioner';game.deadline=Date.now()+45000;render();} else await request('game:start'); break;
      case 'reveal': showRole(game.me.role); break;
      case 'flip-card': if(demo) { game.me.cardOpen = !game.me.cardOpen; render(); } else showRole(game.me.role); break;
      case 'skip': if(demo){if(game.phase==='voting')game.me.voteSubmitted=true;else game.me.actionSubmitted=true;render();}else setGame((await request(game.phase==='night'?'game:night-action':'game:vote',{skip:true,revision:game.revision})).state);break;
      case 'submit': await submitSelection(); break;
      case 'night-history': {
       const events=demo?['commissioner','hobo','maniac','doctor','mistress','lawyer','mafia'].slice(0,Math.max(0,Math.floor((Date.now()-(game.deadline-45000)-5800)/1300)+1)).map(role=>nightNarrative(role)):game.nightEvents||[];
       $('#dialog').classList.remove('shop-screen','settings-screen');
       renderMarkup('#dialog-content',`<h2>Tungi voqealar${demo?' · namuna':''}</h2>${events.map(text=>`<p>${escape(text)}</p>`).join('')}`);$('#dialog').showModal();break;
      }
      case 'referrals': await refreshHome();showReferrals();break;
      case 'shop': showShop(); break;
      case 'confirm': if(demo) {game.me.confirmationSubmitted=true;game.voting||={votes:[],approvals:0,rejections:0};game.voting[b.dataset.confirm==='true'?'approvals':'rejections']++;toast('Demo tasdiqlash qabul qilindi');render();} else setGame((await request('game:vote',{confirm:b.dataset.confirm==='true',revision:game.revision})).state); break;
      case 'demo-next': advanceDemoPhase();break;
      case 'invite': if(demo) {toast('Namuna xona uchun haqiqiy taklif yo‘q');break;} {const link=config.botUsername?`https://t.me/${config.botUsername}?startapp=${encodeURIComponent(game.id)}`:`${location.origin}/?room=${encodeURIComponent(game.id)}`;await navigator.clipboard.writeText(link);toast('Taklif havolasi nusxalandi');break;}
      case 'scoring': renderMarkup('#dialog-content', '<span class="eyebrow">ADOLATLI O‘YIN</span><h2 style="margin-top:20px">Tanga va xaridlar</h2><p>Hisoblangan o‘yinda faol ishtirok uchun <b>1 tanga</b>. Jamoangiz yutsa: tirik qolgan faol o‘yinchiga <b>10 tanga</b>, halok bo‘lgan faol o‘yinchiga <b>5 tanga</b> beriladi.</p><p>O‘yin kamida 3 daqiqa davom etishi, kamida 6 kishi o‘ynashi va o‘yinchilarning yarmi harakat yoki ovoz yuborishi kerak. Durang va talablarga mos kelmagan o‘yinlar hisoblanmaydi.</p><p>Bir xil tarkibdagi takroriy o‘yinlar guruhga yarim ball beradi (pastga yaxlitlanadi); tanga esa shu tarkib uchun kuniga bir marta beriladi. Har o‘yinchi kuniga 5 ta o‘yingacha tanga oladi. Guruhning kunlik limiti 100 ochko. Faol bo‘lmagan ishtirokchiga tanga berilmaydi. Tangaga do‘kondan himoya, hujjat va faol rol olinadi. Reyting jami ishlab topilgan tangadan hisoblanadi; xarid reytingni kamaytirmaydi. Kun Toshkent vaqti bilan almashadi.</p>'); $('#dialog').showModal(); break;
      case 'groups': await showGroups(); break;
      case 'catalog': showCatalog(); break;
      case 'rules': renderMarkup('#dialog-content', '<span class="eyebrow">TRUE MAFIA USLUBI</span><h2 style="margin-top:20px">Shahar qoidalari</h2><p>6–20 o‘yinchi. Tun 45 soniya, muhokama 90 soniya, ovoz berish 30 soniya davom etadi. Har kecha maxsus rollar yashirin harakat qiladi; tongda natija chiqadi. Tungi vazifasi bor rol harakat yubormasa, tongda o‘yindan chiqariladi. Ruxsat bilan harakatni o‘tkazgan yoki Ma’shuqa bloklagan o‘yinchi jazolanmaydi.</p><p>Kunduzi tiriklar dalillarni muhokama qiladi va bir o‘yinchiga ovoz beradi. Merning ovozi ikki hissa. Eng ko‘p ovoz tenglashsa hech kim chiqmaydi.</p><p>Mafia tarkibiga Don va mafiyalar kiradi; advokat ularni tekshiruvdan yashiradi. Komissar rolni bilishi yoki otishi mumkin, serjant tekshiruvlarni oladi. Shifokor davolaydi, tansoqchi hujumni o‘ziga oladi, omadli bir marta omon qolishi mumkin. Ma’shuqa tungi harakatni to‘xtatadi.</p><p>Darbadar tashriflarni kuzatadi; jurnalist ikki kishining bir tomondaligini tekshiradi. Manyak alohida hujum qiladi va oxirgi tirik qolsa yutadi. Suidsid kunduzi ovoz bilan chiqarilsa yutadi. Kamikadze chiqarilganda istalgan tirik o‘yinchini qasos uchun tanlaydi; natija keyingi tongda hal bo‘ladi.</p><p>Mafia qolmasa va manyak ham yo‘q bo‘lsa shahar yutadi. Mafia tiriklarning ko‘pchiligiga tenglashsa mafiyalar yutadi. Har bir rol haqida yuqoridagi kartani bosing.</p>');$('#dialog').showModal(); break;
    }
  } catch(e) { toast(e.message); } finally {busy=false;}
});
$('#dialog-content').addEventListener('click', event => {
  const button = event.target.closest('button'); if (!button) return;
  if (button.dataset.catalogCard) showCardInfo(button.dataset.catalogCard);
  else if (button.dataset.action === 'catalog') showCatalog();
});
render();
if (demo) { $('#connection').textContent='Dizayn namoyishi'; $('#notice').hidden=false; $('#notice').textContent='DEMO REJIM · Xona va o‘yinchilar namuna. Haqiqiy o‘yin, ovoz va reyting uchun Telegram orqali ulaning.'; }
else if (!tg?.initData) { $('#connection').textContent='Telegram talab etiladi'; $('#notice').hidden=false; $('#notice').textContent='O‘ynash uchun Mini App’ni Telegram botdagi tugma orqali oching. Bu sahifa dizaynini ko‘rishingiz mumkin.'; }
else {
  socket=io({auth:{initData:tg.initData}});
  socket.on('connect', async()=>{ $('#notice').hidden=true; $('#connection').textContent='Ulangan';try {await refreshHome(); const id=pendingJoin||sessionStorage.getItem('mafia-room')||home.activeRoom;pendingJoin=null;if(id)await join(id);if(pendingMenu){const section=pendingMenu;pendingMenu=null;navigate(section==='game'?'game':'profile');if(section==='groups')await showGroups();else if(section==='shop')showShop();else if(section==='roles')showCatalog();else if(section==='referrals')showReferrals();}if(page==='rank')await loadRanks();}catch(e){sessionStorage.removeItem('mafia-room');toast(e.message);} });
  socket.on('game:state',setGame); socket.on('room:left',()=>{game=null;sessionStorage.removeItem('mafia-room');navigate('home');});
  socket.on('room:expired',()=>{game=null;sessionStorage.removeItem('mafia-room');navigate('home');toast('Xona muddati tugadi');});
  socket.on('disconnect',()=>{$('#connection').textContent='Ulanish uzildi';});
  socket.on('connect_error', e => {
    $('#connection').textContent = 'Ulanib bo‘lmadi';
    if (!e.data?.subscriptionUrl) return toast(e.message);
    const notice = $('#notice');
    notice.hidden = false;
    renderMarkup('#notice', `<p>${escape(e.message)}</p><a class="secondary" href="${escape(e.data.subscriptionUrl)}" target="_blank" rel="noopener noreferrer">Guruhga a’zo bo‘lish</a> <button class="secondary" id="retry-subscription">A’zolikni tekshirish</button>`);
    $('#retry-subscription').onclick = () => socket.connect();
  });
}


let managedGroups=[];
const groupFields=[['registrationMs','Ro‘yxatdan o‘tish (soniya)',30,600,120],['minPlayers','Minimal o‘yinchi',6,20,6],['maxPlayers','Maksimal o‘yinchi',6,20,20],['nightMs','Tun (soniya)',10,600,45],['discussionMs','Muhokama (soniya)',10,600,90],['votingMs','Ovoz berish (soniya)',10,600,30],['confirmationMs','Hukm tasdig‘i (soniya)',10,600,30]];
async function showGroups() {
  $('#dialog').classList.remove('settings-screen');
  managedGroups=demo?[]:(await request('groups:list')).groups;
  renderMarkup('#dialog-content', `<div class="group-manager"><span class="eyebrow">GURUH BOSHQARUVI</span><h2>Guruhlarim</h2><p>Bot administrator bölgan va siz boshqaradigan guruhlar.</p><div class="group-list">${managedGroups.length?managedGroups.map(g=>`<button class="profile-link" data-group-edit="${escape(g.id)}"><span>${escape(g.name)}<small>Öyin sozlamalari →</small></span></button>`).join(''):'<div class="shop-empty">Hozircha guruhlar yöq.<p>Botni guruhingizga qöşib administrator qiling — guruh shu yerda avtomatik körinadi. Avval ulangan guruh körinmasa, guruhda /sozlash yuboring.</p></div>'}</div><button class="ghost full" data-group-refresh>Röyxatni yangilaş</button>${config.botUsername?`<a class="group-bot-link" href="https://t.me/${encodeURIComponent(config.botUsername)}?startgroup=mafia&admin=delete_messages+restrict_members+pin_messages" target="_blank" rel="noopener noreferrer">+ Botni guruhga qöşiş</a>`:''}${demo?'<p class="notice">Haqiqiy guruhlaringizni köriş uçun Telegram orqali kiring.</p><button class="secondary full" data-group-demo>Sozlamalar namunasini köriş</button>':''}</div>`);
  if(!$('#dialog').open) $('#dialog').showModal();
}
let settingsDraft = null;
const timeChoices=[30,45,60,75,90,120,180,240,300,360];
function editGroup(group) {
 settingsDraft={...group,settings:{...ADVANCED_DEFAULTS,...group.settings}};
 const settings=settingsDraft.settings;
 for(const key of ['nightMs','discussionMs','votingMs','confirmationMs'])if(settings[key]>120000)settings[key]=120000;
 $('#dialog').classList.add('settings-screen');
 const toggle=(key,label,description,checked,value='')=>`<label class="setting-row"><span class="setting-copy"><b>${escape(label)}</b><small>${escape(description)}</small></span><input class="ios-switch" type="checkbox" role="switch" aria-label="${escape(label)}" name="${key}" ${value?`value="${value}"`:''} ${checked?'checked':''}></label>`;
 const choice=(key,label,value,kind)=>`<div class="choice-setting"><input type="hidden" name="${key}" value="${value}"><button type="button" class="setting-choice" data-setting-choice="${key}" data-choice-kind="${kind}" data-choice-label="${escape(label)}"><b>${escape(label)}</b><span data-choice-value>${choiceLabel(kind,value)}</span><span aria-hidden="true">›</span></button></div>`;
 const rows=items=>items.map(([key,label,description])=>toggle(key,label,description,settings[key])).join('');
 const categories=[['roles','🎭','Rollar','O‘yinda qatnashadigan rollarni tanlash'],['times','◷','Vaqtlar','Ro‘yxat, tun, kun va ovoz berish'],['blocking','◌','Bloklash','Guruhda yozish va media cheklovlari'],['other','⚙','Boshqalar','O‘yin qoidalari va bildirishnomalar'],['season','🎃','Baflar va Halloween','Inventar va mavsumiy qoidalar']];
 renderMarkup('#dialog-content',`<div class="group-manager settings-page organized-settings"><header class="settings-header"><button type="button" class="ghost" data-settings-back>← Guruhlarim</button><button type="submit" form="group-settings-form" class="primary settings-header-save">Saqlash</button><span class="eyebrow">${escape(group.name)}</span><h2 id="settings-title">Guruh sozlamalari</h2><p id="settings-save-status" role="status">${demo?'Namuna · shu brauzerda saqlanadi':'Yangi o‘yinlardan qo‘llanadi'}</p></header><form id="group-settings-form" data-group-id="${escape(group.id)}"><div data-settings-menu><div class="settings-menu-list">${categories.map(([id,icon,title,description])=>`<button type="button" class="settings-category" data-settings-category="${id}"><span class="category-symbol" aria-hidden="true">${icon}</span><span><b>${title}</b><small>${description}</small></span><span aria-hidden="true">›</span></button>`).join('')}</div></div><div data-settings-panel="roles" hidden><section class="settings-section"><h3>O‘yindagi rollar</h3><p>Mafia va tinch aholi doim qatnashadi.</p>${Object.entries(roles).filter(([id])=>ROLE_ORDER.includes(id)||id==='don').map(([id,r])=>toggle('enabledRoles',r[1],'',!settings.enabledRoles||settings.enabledRoles.includes(id),id)).join('')}</section></div><div data-settings-panel="times" hidden><section class="settings-section"><h3>Bosqich vaqtlari</h3><p>Vaqt ustiga bosing va tayyor variantni tanlang.</p>${groupFields.filter(([key])=>key.endsWith('Ms')).map(([key,label,,,value])=>choice(key,label.replace(' (soniya)',''),settings[key]===undefined?value:settings[key]/1000,'time')).join('')}</section><section class="settings-section">${choice('exitCooldownMs','Erta chiqish cheklovi',settings.exitCooldownMs,'cooldown')}</section></div><div data-settings-panel="blocking" hidden><section class="settings-section"><h3>Guruhda yozish</h3><p>Botga xabarlarni o‘chirish uchun administrator huquqi kerak.</p>${rows(SETTING_SECTIONS.find(([title])=>title==='Guruhda yozishni cheklash')[1])}</section></div><div data-settings-panel="other" hidden><section class="settings-section"><h3>O‘yinchilar</h3>${groupFields.filter(([key])=>!key.endsWith('Ms')).map(([key,label,,,value])=>choice(key,label,settings[key]??value,'players')).join('')}${choice('mafiaDivisor','Mafia miqdori',settings.mafiaDivisor,'mafia')}</section>${SETTING_SECTIONS.filter(([title])=>['O‘yin qoidalari','Harakatlar va bildirishnomalar'].includes(title)).map(([title,items])=>`<section class="settings-section"><h3>${title}</h3>${rows(items)}</section>`).join('')}</div><div data-settings-panel="season" hidden><section class="settings-section"><h3>Baflar va Halloween</h3>${rows(SETTING_SECTIONS[0][1])}</section><p class="settings-note">Buyumlar Profil → Do‘kon va inventar bo‘limida olinadi. Faqat yoqilgan guruhlarda sarflanadi.</p></div></form><div id="settings-picker" hidden></div></div>`);
 if(!$('#dialog').open)$('#dialog').showModal();
 $('#dialog').scrollTop=0;
}
function choiceLabel(kind,value){
 value=Number(value);
 if(kind==='time')return value<60?`${value} soniya`:value%60===0?`${value/60} daqiqa`:`${value} soniya`;
 if(kind==='players')return `${value} kishi`;
 if(kind==='mafia')return `Har ${value} kishiga 1`;
 return value===0?'O‘chiq':value<3600000?'30 daqiqa':`${value/3600000} soat`;
}
function settingsCategory(id){
 const panel=$(`[data-settings-panel="${id}"]`);
 document.querySelectorAll('[data-settings-panel]').forEach(p=>p.hidden=p!==panel);
 $('[data-settings-menu]').hidden=Boolean(panel);
 $('#settings-title').textContent=panel?({roles:'Rollar',times:'Vaqtlar',blocking:'Bloklash',other:'Boshqalar',season:'Baflar va Halloween'})[id]:'Guruh sozlamalari';
 $('[data-settings-back]').textContent=panel?'← Sozlamalar':'← Guruhlarim';
 $('#dialog').scrollTop=0;
}
function showSettingChoices(button){
 const key=button.dataset.settingChoice,kind=button.dataset.choiceKind;
 const input=$(`#group-settings-form input[name="${key}"]`),current=Number(input.value);
 let values=kind==='time'?timeChoices.filter(v=>key==='registrationMs'||v<=120):kind==='players'?Array.from({length:15},(_,i)=>i+6):kind==='mafia'?[3,4]:[0,1800000,3600000,7200000,10800000,21600000,43200000,86400000];
 if(!values.includes(current) && !(kind==='time' && key!=='registrationMs' && current>120))values=[...values,current].sort((a,b)=>a-b);
 renderMarkup('#settings-picker',`<div class="picker-shade" data-picker-close></div><section class="choice-sheet" role="dialog" aria-modal="true" aria-label="${escape(button.dataset.choiceLabel)}"><div class="choice-sheet-head"><h3>${escape(button.dataset.choiceLabel)}</h3><button type="button" class="ghost" data-picker-close aria-label="Variantlarni yopish">×</button></div><div class="choice-grid">${values.map(v=>`<button type="button" class="choice-option ${v===current?'selected':''}" aria-pressed="${v===current}" data-choice-select="${v}" data-choice-key="${key}" data-choice-kind="${kind}">${choiceLabel(kind,v)}${v===current?'<span aria-hidden="true">✓</span>':''}</button>`).join('')}</div></section>`);
 $('#settings-picker').hidden=false;
 $('#group-settings-form').inert=true;$('.settings-header').inert=true;$('#close-dialog').inert=true;
 $('#settings-picker button.choice-option.selected')?.focus();
}
function closeSettingChoices(){
 const picker=$('#settings-picker');if(!picker)return;picker.hidden=true;
 $('#group-settings-form').inert=false;$('.settings-header').inert=false;$('#close-dialog').inert=false;
}
$('#dialog').addEventListener('cancel',event=>{if($('#settings-picker') && !$('#settings-picker').hidden){event.preventDefault();closeSettingChoices();}});
$('#dialog').addEventListener('close',()=>{$('#dialog').classList.remove('settings-screen','shop-screen');$('#close-dialog').inert=false;});
$('#dialog-content').addEventListener('click',async event=>{
 if(event.target.hasAttribute('data-picker-close')){closeSettingChoices();return;}
 const b=event.target.closest('button');if(!b||busy)return;
 try {
  if(b.dataset.action==='copy-referral'&&!demo&&config.botUsername){await navigator.clipboard.writeText(`https://t.me/${config.botUsername}?start=ref_${home.me.id}`);toast('Havola nusxalandi');}
  else if(b.hasAttribute('data-picker-close')){closeSettingChoices();}
  else if(b.dataset.choiceSelect!==undefined){const input=$(`#group-settings-form input[name="${b.dataset.choiceKey}"]`);input.value=b.dataset.choiceSelect;const trigger=$(`[data-setting-choice="${b.dataset.choiceKey}"]`);trigger.querySelector('[data-choice-value]').textContent=choiceLabel(b.dataset.choiceKind,b.dataset.choiceSelect);closeSettingChoices();trigger.focus();}
  else if(b.dataset.settingChoice)showSettingChoices(b);
  else if(b.dataset.settingsCategory)settingsCategory(b.dataset.settingsCategory);
  else if(b.hasAttribute('data-settings-back')){if($('[data-settings-menu]').hidden)settingsCategory(null);else {busy=true;await showGroups();}}
  else if(b.dataset.shopTab){shopTab=b.dataset.shopTab;showShop();}
  else if(b.dataset.shopBuy){busy=true;home.inventory=(await request('shop:buy',{item:b.dataset.shopBuy})).inventory;showShop();toast('Buyum inventarga qo‘shildi');}
  else if(b.hasAttribute('data-order-up')||b.hasAttribute('data-order-down')) {const row=b.closest('[data-role-order]');if(b.hasAttribute('data-order-up')&&row.previousElementSibling)row.parentNode.insertBefore(row,row.previousElementSibling);else if(b.hasAttribute('data-order-down')&&row.nextElementSibling)row.parentNode.insertBefore(row.nextElementSibling,row);}
  else if(b.hasAttribute('data-group-refresh')) {busy=true;await showGroups();}
  else if(b.hasAttribute('data-group-demo')) editGroup({id:'demo',name:'Namuna guruh',settings:JSON.parse(localStorage.getItem('mafia-demo-settings')||'{}')});
  else if(b.dataset.groupEdit) {const group=managedGroups.find(g=>g.id===b.dataset.groupEdit);if(group)editGroup(group);}
 } catch(e){toast(e.message);} finally{busy=false;}
});
$('#dialog-content').addEventListener('submit',async event=>{
 const form=event.target;if(form.id!=='group-settings-form')return;
 event.preventDefault();if(busy)return;busy=true;
 const button=$('.settings-header-save');button.disabled=true;
 try {
  const data=new FormData(form);
   const settings=Object.fromEntries(groupFields.map(([key])=>[key,Number(data.get(key))*(key.endsWith('Ms')?1000:1)]));
   for(const key of Object.keys(BOOLEAN_RULES))settings[key]=data.has(key);
   settings.enabledRoles=data.getAll('enabledRoles');
   settings.roleOrder=[...(settingsDraft?.settings.roleOrder || ROLE_ORDER)];
   settings.mafiaDivisor=Number(data.get('mafiaDivisor'));settings.exitCooldownMs=Number(data.get('exitCooldownMs'));
   if(settings.minPlayers>settings.maxPlayers)throw new Error('Minimal son maksimal sondan katta');
   if(demo)localStorage.setItem('mafia-demo-settings',JSON.stringify(settings));
   else {await request('groups:save',{groupId:form.dataset.groupId,settings});const group=managedGroups.find(g=>g.id===form.dataset.groupId);if(group)group.settings=settings;}
   $('#settings-save-status').textContent=demo?'Namuna sozlamalar shu brauzerda saqlandi.':'Guruh sozlamalari saqlandi.';toast('Sozlamalar saqlandi');
 }catch(e){toast(e.message);}finally{busy=false;if(button.isConnected)button.disabled=false;}
});

