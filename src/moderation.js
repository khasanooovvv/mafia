export function shouldDeleteGroupMessage(game,message) {
 const r=game.rules,p=game.players.find(p=>p.id===String(message.from.id));
 const active=!['lobby','finished'].includes(game.phase);if(!active)return false;
 const media=['photo','video','animation','audio','voice','sticker','document','video_note'].some(k=>message[k]);
 const banned=/(?:^|\s)(?:blya\w*|suka|бля\w*|сука|нахуй|fuck\w*|shit)(?:\s|[!.,?]|$)/iu.test(message.text||message.caption||'');
 return Boolean((r.blockOutsiders&&!p)||(p&&r.blockDead&&!p.alive)||(p&&r.blockNight&&game.phase==='night')||(p&&r.blockMistress&&game.phase!=='night'&&game.mistressBlocked?.includes(p.id))||(p&&r.deleteMedia&&media)||(r.profanityFilter&&banned));
}
