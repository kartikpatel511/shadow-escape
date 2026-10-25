import test from 'node:test';
import assert from 'node:assert/strict';
import {RoomManager,RUNNER_STARTS} from '../server/rooms.mjs';
import {POWER_RULES} from '../shared/skills.js';
const sock=()=>({readyState:1,messages:[],send(m){this.messages.push(JSON.parse(m));}});
const last=(s,t)=>s.messages.findLast(m=>m.type===t);
function setup(n=3){
 const manager=new RoomManager(),socks=Array.from({length:n},sock);
 manager.make(socks[0],{capacity:n,name:'A'});
 const roomCode=last(socks[0],'joined').room.code;
 for(let i=1;i<n;i++)manager.join(socks[i],{code:roomCode,name:`P${i}`});
 manager.start(socks[0]);
 return {manager,socks,room:manager.rooms.get(roomCode),roomCode};
}
test('runner avatars start close enough to see each other, but the minimap has no unpaid location pins',()=>{
 const {manager,room,socks}=setup(5),runners=[...room.players.values()].filter(p=>p.role==='runner');
 assert.deepEqual(runners.map(p=>[p.x,p.z]),RUNNER_STARTS.slice(0,4));
 manager.snapshotRoom(room);
 for(const socket of socks){
  const packet=last(socket,'snapshot');
  assert.equal(packet.players.length,5,'3D stream includes distant avatars');
  assert.deepEqual(packet.radar.contacts,[],'paid minimap contacts stay private');
 }
});
test('freeze immediately reaches its victim and remains server-authoritative while WASD is held',()=>{
 const {manager,room}=setup(3),[caster,target]=[...room.players.values()].filter(p=>p.role==='runner');
 caster.loadout=['freeze'];caster.powerReadyAt=0;
 manager.power(caster.socket,{ability:'freeze',targetId:target.id});
 const hit=last(target.socket,'powerHit');
 assert.equal(hit.effects.frozen,true);
 assert.equal(hit.durationMs,POWER_RULES.freeze.durationMs);
 assert.deepEqual(hit.position,{x:target.x,y:target.y,z:target.z});
 const coords=[target.x,target.y,target.z];
 for(let i=1;i<=12;i++){
  manager.input(target.socket,{seq:i,localRight:1,localForward:1,yaw:0,jump:true,sprint:true});
  manager.stepPlayer(target,1/30,Date.now(),room);
 }
 assert.deepEqual([target.x,target.y,target.z],coords);
 manager.snapshotRoom(room);
 const seen=last(caster.socket,'snapshot').players.find(p=>p.id===target.id);
 assert.equal(seen.effects.frozen,true,'caster also sees the frozen player in 3D');
 assert.equal(seen.moving,false);
});
test('brief socket loss does not force an exit; resume restores player identity and same match',()=>{
 const {manager,room,roomCode}=setup(2);
 const original=[...room.players.values()].find(p=>p.role==='hunter');
 const old=original.socket,token=original.resumeToken;
 manager.leave(old,{grace:true});
 assert.equal(room.phase,'exploring');assert.equal(room.players.size,2);
 assert.equal(original.socket,null);
 const recon=sock();manager.resume(recon,{code:roomCode,resumeToken:token});
 assert.equal(last(recon,'resumed').selfId,original.id);
 assert.equal(room.players.get(original.id).socket,recon);
 assert.equal(room.phase,'exploring');assert.equal(manager.disconnectTimers.size,0);
 const outsider=sock();manager.resume(outsider,{code:roomCode,resumeToken:'wrong'});
 assert.match(last(outsider,'error').message,/Resume failed/);
 manager.close();
});
test('intentional room leave is still immediate and terminates the round when monster quits',()=>{
 const {manager,room}=setup(3),hunter=[...room.players.values()].find(p=>p.role==='hunter');
 manager.handle(hunter.socket,{type:'leave'});
 assert.equal(room.phase,'finished');
 assert.equal(room.endReason,'hunter_disconnected');
 manager.close();
});
