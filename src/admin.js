import {randomBytes,scryptSync,timingSafeEqual} from 'node:crypto';
export function createAdmin({login,password,origin,store,rooms}){
 const salt=randomBytes(16),hash=password?scryptSync(password,salt,32):null;
 const sessions=new Map(),attempts=new Map();
 const secure=new URL(origin).protocol==='https:';
 const cookie=(value,age)=>`mafia_admin=${value}; HttpOnly; SameSite=Strict; Path=/api/admin; Max-Age=${age}${secure?'; Secure':''}`;
 return async(req,res,path,readBody)=>{
  const json=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(data));};
  if(!hash||!login)return json(503,{error:'Admin login va paroli sozlanmagan.'});
  if(req.method==='POST' && req.headers.origin && req.headers.origin!==new URL(origin).origin)return json(403,{error:'Forbidden'});
  const token=/(?:^|;\s*)mafia_admin=([a-f0-9]{64})(?:;|$)/.exec(req.headers.cookie||'')?.[1];
  for(const [key,expiry] of sessions)if(expiry<Date.now())sessions.delete(key);
  for(const [key,value]of attempts)if(Date.now()-value.start>900000)attempts.delete(key);
  if(path==='/api/admin/login'&&req.method==='POST'){
   const ip=req.socket.remoteAddress||'local',a=attempts.get(ip)||{start:Date.now(),count:0};
   if(a.count>=10)return json(429,{error:'Juda köp uriniş. 15 daqiqa kuting.'});
   a.count++;attempts.set(ip,a);
   let input;try{input=JSON.parse(await readBody(req));}catch{return json(400,{error:'Sörov notöğri'});}
   const candidate=typeof input?.password==='string'&&input.password.length<=256?input.password:'';
   const valid=timingSafeEqual(scryptSync(candidate,salt,32),hash)&&input.login===login;
   if(!valid)return json(401,{error:'Login yoki parol notöğri.'});
   if(sessions.size>=1000)return json(503,{error:'Server band'});
   const value=randomBytes(32).toString('hex');sessions.set(value,Date.now()+3600000);attempts.delete(ip);
   res.setHeader('Set-Cookie',cookie(value,3600));return json(200,{ok:true});
  }
  if(!token||!sessions.has(token))return json(401,{error:'Admin sifatida kiring.'});
  if(path==='/api/admin/logout'&&req.method==='POST'){sessions.delete(token);res.setHeader('Set-Cookie',cookie('',0));return json(200,{ok:true});}
  if(path==='/api/admin/overview'&&req.method==='GET'){
   const url=new URL(req.url,'http://localhost');const page=Math.max(0,Math.min(100000,Number(url.searchParams.get('page'))||0))|0;
   const users=store.db.prepare(`SELECT u.user_id id,COALESCE(d.name,'Öyinçi') name,u.first_seen firstSeen,COALESCE(i.coins,0) coins FROM bot_users u LEFT JOIN user_directory d ON d.user_id=u.user_id LEFT JOIN inventories i ON i.user_id=u.user_id ORDER BY u.first_seen DESC,u.user_id LIMIT 50 OFFSET ?`).all(page*50);
   const groups=store.db.prepare(`SELECT g.id,g.name,COALESCE(r.active,1) active FROM managed_groups g LEFT JOIN registered_groups r ON r.group_id=g.id ORDER BY g.name LIMIT 50 OFFSET ?`).all(page*50);
   return json(200,{page,stats:{users:store.db.prepare('SELECT COUNT(*) n FROM bot_users').get().n,groups:store.db.prepare('SELECT COUNT(*) n FROM registered_groups WHERE active=1').get().n,games:store.db.prepare('SELECT COUNT(*) n FROM results').get().n,activeGames:[...rooms.values()].filter(g=>g.phase!=='finished').length},users,groups,rooms:[...rooms.values()].filter(g=>g.phase!=='finished').slice(0,100).map(g=>({id:g.id,group:g.group?.name||'Şaxsiy xona',phase:g.phase,players:g.players.length}))});
  }
  return json(404,{error:'Not found'});
 };
}
