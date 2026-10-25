import test from 'node:test';
import assert from 'node:assert/strict';
import {RoomManager} from '../server/rooms.mjs';
import {usePower,powerSelf,compassContacts,randomLoadout,POWER_RULES,expirePowers} from '../server/powers.mjs';
import {terrainY} from '../shared/world.js';
const fakeSocket=()=>({readyState:1,messages:[],send(s){this.messages.push(JSON.parse(s));}});
const latest=(sock,type)=>sock.messages.findLast(m=>m.type===type);
function game(size=4){
 const manager=new RoomManager(),sockets=Array.from({length:size},fakeSocket);
 manager.make(sockets[0],{name:'Alpha',capacity:size});
 const code=latest(sockets[0],'joined').room.code;
 for(let i=1;i<size;i++)manager.join(sockets[i],{code,name:`P${i}`});
 manager.start(sockets[0]);
 const room=manager.rooms.get(code),runners=[...room.players.values()].filter(p=>p.role==='runner');
 const hunter=[...room.players.values()].find(p=>p.role==='hunter');
 return {manager,sockets,code,room,runners,hunter};
}
function cast(room,caster,ability,target,now){
 caster.powerReadyAt=0;
 caster.loadout=[ability];
 return usePower(room,caster,ability,target?.id,now);
}
test('all runners have Shattered Compass and the hunter does not receive any skills',()=>{
 for(let i=0;i<60;i++){
  const runner=randomLoadout(),hunter=randomLoadout(undefined,'hunter');
  assert.equal(runner.length,6);assert.equal(new Set(runner).size,6);
  assert.ok(runner.includes('shattered'));assert.deepEqual(hunter,[]);
 }
});
test('Shattered Compass only reveals bearing and proximity bands, while exposing live runner coordinates to hunter for 20 seconds',()=>{
 const {manager,room,runners,hunter}=game();const p=runners[0],now=Date.now();
 room.secretExit={x:180,z:150};p.x=0;p.z=0;
 const result=cast(room,p,'shattered',null,now);
 assert.equal(result.ok,true);assert.equal(result.cost,75);
 const hint=powerSelf(p,now,room).hints.shattered;
 assert.ok(hint);assert.equal(hint.strength,'FAINT');
 assert.ok(Number.isInteger(hint.sector));assert.equal(hint.remainingMs,20000);
 assert.ok(!('x' in hint));assert.ok(!('z' in hint));assert.ok(!('distance' in hint));
 assert.deepEqual(compassContacts(room,runners[1],now),[]);
 assert.equal(compassContacts(room,hunter,now)[0].id,p.id);
 p.x=170;p.z=140;
 assert.equal(powerSelf(p,now,room).hints.shattered.strength,'STRONG');
 assert.equal(compassContacts(room,hunter,now)[0].x,170,'hunter gets live coordinates');
 assert.equal(compassContacts(room,hunter,now+20000).length,0);
 assert.equal(powerSelf(p,now+20000,room).hints.shattered,null);
 manager.snapshotRoom(room);
 const hunterSnapshot=latest(hunter.socket,'snapshot');
 assert.equal(hunterSnapshot.radar.contacts.some(c=>c.id===p.id),true);
 const runnerSnapshot=latest(runners[1].socket,'snapshot');
 assert.equal(runnerSnapshot.radar.contacts.some(c=>c.id===p.id),false);
 manager.close();
});
test('Zero Gravity disorients victim, rises, stays visibly airborne and always lands after the deadline',()=>{
 const {manager,room,runners}=game(),[caster,target,observer]=runners;
 const now=Date.now(),startY=target.y;
 const castResult=cast(room,caster,'gravity',target,now);
 assert.equal(castResult.ok,true);assert.equal(target.gravityUntil,now+20000);
 target.lastInputAt=Date.now();target.input={dx:1,dz:0,sprint:false,jump:false,climb:false};
 for(let i=0;i<130;i++)manager.stepPlayer(target,1/30,now+100+i*33,room);
 assert.ok(target.y>startY+9,'victim is visibly lifted');
 assert.ok(target.x!==0 || target.z!==0,'victim drifts autonomously');
 assert.equal(target.grounded,false);
 manager.snapshotRoom(room);
 const view=latest(observer.socket,'snapshot').players.find(p=>p.id===target.id);
 assert.ok(view?.effects.zeroGravity,'other runners receive floating opponent');
 const deadline=target.gravityLastUntil;
 manager.stepPlayer(target,1/30,deadline+1,room);
 assert.equal(target.gravityLastUntil,0);
 assert.equal(target.gravityUntil,0);
 assert.equal(target.y,terrainY(target.x,target.z));
 assert.equal(target.grounded,true);
 assert.equal(latest(target.socket,'gravityLanded').y,target.y);
 manager.close();
});
test('Freeze remains server-controlled and a formerly invisible victim is shown to every runner',()=>{
 const {manager,room,runners,hunter}=game(),[caster,target,observer]=runners,now=Date.now();
 target.invisibleUntil=now+10000;
 assert.equal(cast(room,caster,'freeze',target,now).ok,true);
 assert.equal(target.invisibleUntil,0);
 const before=[target.x,target.y,target.z];
 target.input={dx:1,dz:1,sprint:true,jump:true,climb:true};target.lastInputAt=Date.now();
 for(let i=0;i<10;i++)manager.stepPlayer(target,1/30,now+100+i*33,room);
 assert.deepEqual([target.x,target.y,target.z],before);
 manager.snapshotRoom(room);
 for(const player of [caster,observer,hunter]){
  const snapshot=latest(player.socket,'snapshot');const frozen=snapshot.players.find(p=>p.id===target.id);
  assert.equal(frozen?.effects.frozen,true);
 }
 manager.close();
});
test('Time Yank snaps only another runner back four seconds and is rejected with insufficient history',()=>{
 const {manager,room,runners,hunter}=game(),[caster,target]=runners,now=Date.now();
 assert.equal(cast(room,caster,'yank',target,now).ok,false);
 target.history=[{at:now-4600,x:44,y:terrainY(44,42),z:42},{at:now-100,x:80,y:terrainY(80,80),z:80}];
 target.x=80;target.z=80;
 const result=cast(room,caster,'yank',target,now);
 assert.equal(result.ok,true);assert.equal(result.cost,95);
 assert.equal(target.x,44);assert.equal(target.z,42);
 assert.equal(result.warps[0].id,target.id);
 assert.equal(cast(room,caster,'yank',hunter,now).ok,false);
 manager.close();
});
test('expired disconnected socket is removed, even though its original socket lookup is gone',()=>{
 const {manager,room,code,hunter}=game(3),socket=hunter.socket;
 manager.leave(socket,{grace:true});
 assert.equal(manager.connections.has(socket),false);
 assert.equal(manager.disconnectTimers.has(hunter.id),true);
 // Simulate what the cleanup timer does after the 45-second resume window.
 manager.removePlayer(room,hunter.id);
 assert.equal(room.players.has(hunter.id),false);
 assert.equal(manager.disconnectTimers.has(hunter.id),false);
 assert.equal(room.phase,'finished');
 const other=fakeSocket();manager.resume(other,{code,resumeToken:hunter.resumeToken});
 assert.match(latest(other,'error').message,/Resume failed/);
 manager.close();
});
