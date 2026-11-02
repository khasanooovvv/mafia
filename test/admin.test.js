import test from 'node:test';
import assert from 'node:assert/strict';
import {createApp} from '../src/server.js';
import {Store} from '../src/store.js';

test('registered users and admin groups appear at zero in all ranking periods',()=>{
 const s=new Store();try{
  s.registerUser('123');s.manageGroup({id:'-1001',name:'New group'},'123');
  for(const period of ['week','month','all']){
   const r=s.rankings(period);assert.equal(r.groups[0].points,0);assert.equal(r.groups[0].games,0);
   assert.equal(r.players[0].id,'123');assert.equal(r.players[0].points,0);
  }
  s.db.prepare('UPDATE registered_groups SET active=0 WHERE group_id=?').run('-1001');assert.deepEqual(s.rankings().groups,[]);
 }finally{s.close();}
});
test('admin requires a password, issues expiring httpOnly cookies and rejects outsiders',async t=>{
 const app=createApp({demo:true,adminLogin:'admin',adminPassword:'test-password'});
 await new Promise(r=>app.http.listen(0,'127.0.0.1',r));t.after(()=>app.close());
 const base=`http://127.0.0.1:${app.http.address().port}`;
 const login=(data,origin)=>fetch(base+'/api/admin/login',{method:'POST',headers:{'Content-Type':'application/json',...(origin?{Origin:origin}:{})},body:JSON.stringify(data)});
 assert.equal((await fetch(base+'/admin')).status,200);
 assert.equal((await fetch(base+'/api/admin/overview')).status,401);
 assert.equal((await login({login:'admin',password:'bad'})).status,401);
 assert.equal((await login({login:'admin',password:'test-password'},'https://evil.example')).status,403);
 const r=await login({login:'admin',password:'test-password'});assert.equal(r.status,200);
 const cookie=r.headers.get('set-cookie');assert.match(cookie,/HttpOnly/);assert.match(cookie,/SameSite=Strict/);
 const headers={Cookie:cookie.split(';')[0]};
 app.store.registerUser('1');app.store.manageGroup({id:'-1001',name:'Example'},'1');
 const overview=await(await fetch(base+'/api/admin/overview',{headers})).json();assert.equal(overview.stats.users,1);assert.equal(overview.groups[0].name,'Example');
 assert(!JSON.stringify(overview).includes('test-password'));assert.equal(overview.rooms.length,0);
 assert.equal((await fetch(base+'/api/admin/logout',{method:'POST',headers})).status,200);
 assert.equal((await fetch(base+'/api/admin/overview',{headers})).status,401);
 for(let i=0;i<10;i++)await login({login:'bad',password:'bad'});
 assert.equal((await login({login:'admin',password:'test-password'})).status,429);
});
