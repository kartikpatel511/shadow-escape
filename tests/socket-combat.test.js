import test from 'node:test';
import assert from 'node:assert/strict';
import {terrainY} from '../shared/world.js';
const connect=url=>new Promise((resolve,reject)=>{
 const ws=new WebSocket(url);ws.addEventListener('open',()=>resolve(ws),{once:true});ws.addEventListener('error',reject,{once:true});
});
const receive=(ws,type,check=()=>true,timeout=6000)=>new Promise((resolve,reject)=>{
 let timer=setTimeout(()=>{ws.removeEventListener('message',handler);reject(Error('Timeout waiting for '+type));},timeout);
 function handler(e){const m=JSON.parse(e.data);if(m.type===type&&check(m)){clearTimeout(timer);ws.removeEventListener('message',handler);resolve(m);}}
 ws.addEventListener('message',handler);
});
test('real WebSockets: hunter fires, runner gets 30-second bonk and server respawns them',async()=>{
 process.env.NODE_ENV='test';const {server,rooms}=await import('../server.mjs');
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const url=`ws://127.0.0.1:${server.address().port}/ws`,socks=[];
 try{
  for(let j=0;j<3;j++)socks.push(await connect(url));
  const first=receive(socks[0],'joined');socks[0].send(JSON.stringify({type:'create',name:'Host',capacity:3}));const host=await first;
  for(let i=1;i<3;i++){
   const joined=receive(socks[i],'joined');socks[i].send(JSON.stringify({type:'join',code:host.room.code,name:'Player '+i}));await joined;
  }
  const starts=socks.map(s=>receive(s,'started'));socks[0].send(JSON.stringify({type:'start'}));await Promise.all(starts);
  const room=rooms.rooms.get(host.room.code),all=[...room.players.values()],hunter=all.find(p=>p.role==='hunter'),runners=all.filter(p=>p.role==='runner');
  const shootIdx=all.indexOf(hunter),victimIdx=all.indexOf(runners[0]),otherIdx=all.indexOf(runners[1]);
  Object.assign(hunter,{x:0,z:0,y:terrainY(0,0),nextShotAt:0});
  Object.assign(runners[0],{x:0,z:-16,y:terrainY(0,-16)});
  Object.assign(runners[1],{x:170,z:160,y:terrainY(170,160)});
  const knockout=receive(socks[victimIdx],'knockout');
  const bonk=receive(socks[shootIdx],'hitConfirmed');
  const shot=receive(socks[shootIdx],'shot',m=>m.hitId===runners[0].id);
  socks[shootIdx].send(JSON.stringify({type:'fire',aimX:0,aimZ:-1,targetId:runners[1].id}));
  const [hit,confirm,fx]=await Promise.all([knockout,bonk,shot]);
  assert.equal(hit.durationMs,30000);assert.ok(hit.downUntil>Date.now()+29000);
  assert.equal(confirm.victimName,runners[0].name);assert.equal(fx.hitId,runners[0].id);
  assert.equal(runners[1].downUntil,0);
  assert.ok(!socks[otherIdx].readyState || socks[otherIdx].readyState===1);
  const blocked=receive(socks[victimIdx],'error',m=>/knocked out/.test(m.message));
  socks[victimIdx].send(JSON.stringify({type:'power'}));await blocked;
  const revived=receive(socks[victimIdx],'respawned');
  runners[0].downUntil=Date.now()-1;rooms.tick(1/30);
  const packet=await revived;
  assert.ok(packet.shieldMs===3000);assert.equal(runners[0].downUntil,0);assert.ok(runners[0].shieldUntil>Date.now());
 }finally{
  for(const sock of socks)sock.close();await new Promise(resolve=>server.close(resolve));
 }
});
