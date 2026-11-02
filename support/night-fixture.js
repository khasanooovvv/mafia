// Submit an explicit skip for unrelated actors so AFK deaths do not obscure the scenario.
export function completeNight(game) {
 if(game.phase!=='night')return;
 for(const p of game.players)if(p.alive&&!['citizen','sergeant','lucky','suicide','kamikaze','mayor'].includes(p.role)&&!game.actions.has(p.id)) {
  const skipNight=game.rules.skipNight;
  game.rules.skipNight=true;
  try { game.nightAction(p.id,{skip:true},game.revision); } finally { game.rules.skipNight=skipNight; }
 }
}
