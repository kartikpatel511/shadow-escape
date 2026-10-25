import test from 'node:test';
import assert from 'node:assert/strict';
const connect=url=>new Promise((resolve,reject)=>{const s=new WebSocket(url);s.addEventListener('open',()=>resolve(s),{once:true});s.addEventListener('error',reject,{once:true});});
const receive=(s,type,accept=()=>true,timeout=3500)=>new Promise((resolve,reject)=>{
 const timer=setTimeout(()=>{s.removeEventListener('message',fn);reject(Error(`Timed out awaiting ${type}`));},timeout);
 function fn(e){let m;try{m=JSON.parse(e.data);}catch{return;}if(m.type===type&&accept(m)){clearTimeout(timer);s.removeEventListener('message',fn);resolve(m);}}
 s.addEventListener('message',fn);
});
test('real websocket skill casting is charged, private, cooldown-protected and blocks unauthorized skills',async()=>{
 process.env.NODE_ENV='test';const {server,rooms}=await import('../server.mjs');
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const url=`ws://127.0.0.1:${server.address().port}/ws`,socks=[];
 try{
  for(let i=0;i<3;i++)socks.push(await connect(url));
  const created=receive(socks[0],'joined');socks[0].send(JSON.stringify({type:'create',capacity:3,name:'A'}));const host=await created;
  for(let i=1;i<3;i++){const joined=receive(socks[i],'joined');socks[i].send(JSON.stringify({type:'join',code:host.room.code,name:`B${i}`}));await joined;}
  const pending=socks.map(s=>receive(s,'started'));socks[0].send(JSON.stringify({type:'start'}));
  const starts=await Promise.all(pending),room=rooms.rooms.get(host.room.code),roster=[...room.players.values()];
  const actorIndex=roster.findIndex(p=>p.role==='runner');
  const targetIndex=roster.findIndex((p,i)=>p.role==='runner'&&i!==actorIndex);
  const actor=roster[actorIndex],target=roster[targetIndex],socket=socks[actorIndex];
  assert.equal(starts[actorIndex].power.abilities.length,6);
  assert.equal(starts[roster.findIndex(p=>p.role==='hunter')].power.abilities.length,0);
  actor.loadout=['stealth','freeze','boost','scramble','see','yank'];actor.powerReadyAt=0;
  target.x=175;target.z=172;actor.x=-100;actor.z=-100;
  const casted=receive(socket,'powerResult',m=>m.ability==='stealth');
  const observed=receive(socket,'snapshot',m=>m.radar?.contacts?.some(c=>c.id===target.id));
  socket.send(JSON.stringify({type:'power',ability:'stealth',targetId:target.id}));
  const [result,snap]=await Promise.all([casted,observed]);
  assert.equal(result.cost,60);assert.equal(result.coins,240);
  assert.equal(snap.radar.contacts[0].source,'stealth');
  assert.equal(room.stealthReveals.size,1);
  const blocked=receive(socket,'error',m=>/recharging/.test(m.message));
  socket.send(JSON.stringify({type:'power',ability:'freeze',targetId:target.id}));await blocked;
  actor.powerReadyAt=0;
  const freeze=receive(socket,'powerResult',m=>m.ability==='freeze');
  const impacted=receive(socks[targetIndex],'powerHit',m=>m.ability==='freeze');
  socket.send(JSON.stringify({type:'power',ability:'freeze',targetId:target.id}));
  await Promise.all([freeze,impacted]);
  assert.ok(target.freezeUntil>Date.now());assert.equal(actor.coins,160);
  const notOwned=receive(socket,'error',m=>/assigned chaos loadout/i.test(m.message));
  socket.send(JSON.stringify({type:'power',ability:'teleport'}));await notOwned;
 }finally{for(const s of socks)s.close();await new Promise(r=>server.close(r));}
});
