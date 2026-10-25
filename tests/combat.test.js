import test from 'node:test';
import assert from 'node:assert/strict';
import {shoot,occluded,respawn,isDown,COMBAT} from '../server/combat.mjs';
import {RoomManager} from '../server/rooms.mjs';
import {WORLD,terrainY} from '../shared/world.js';
const now=1_800_000_000_000;
const fakeSocket=()=>({readyState:1,messages:[],send(data){this.messages.push(JSON.parse(data));}});
const last=(s,t)=>s.messages.findLast(x=>x.type===t);
const create=(n=3)=>{
 const mgr=new RoomManager(),sockets=Array.from({length:n},fakeSocket);
 mgr.handle(sockets[0],{type:'create',capacity:n,name:'Creator'});
 const code=last(sockets[0],'joined').room.code;
 for(let i=1;i<n;i++)mgr.handle(sockets[i],{type:'join',code,name:'Guest'+i});
 mgr.handle(sockets[0],{type:'start'});
 const room=mgr.rooms.get(code);
 return {mgr,room,sockets,hunter:[...room.players.values()].find(p=>p.role==='hunter'),runners:[...room.players.values()].filter(p=>p.role==='runner')};
};
const move=(p,x,z)=>{p.x=x;p.z=z;p.y=terrainY(x,z);};

test('blaster ignores fake hit IDs, target locations, supplied shot timing and invalid directions',()=>{
 const {room,hunter,runners}=create();move(hunter,0,0);move(runners[0],0,-15);
 const result=shoot(room,hunter,{aimX:0,aimZ:-1,hitId:'FAKE',targetId:'FAKE',x:300,z:300,damage:999,now:0},now);
 assert.equal(result.ok,true);assert.equal(result.hitId,runners[0].id);assert.equal(runners[0].downUntil,now+30000);
 assert.equal(COMBAT.knockoutMs,30000);
 assert.equal(shoot(room,hunter,{aimX:0,aimZ:-1},now+100).ok,false);
 assert.equal(shoot(room,hunter,{aimX:Infinity,aimZ:-1},now+900).ok,false);
 assert.equal(shoot(room,hunter,{aimX:5000,aimZ:-1},now+900).ok,false);
});

test('only active hunter can shoot, no shots after round ends',()=>{
 const {room,hunter,runners}=create();
 assert.match(shoot(room,runners[0],{aimX:1,aimZ:0},now).error,/hunter/i);
 room.phase='finished';assert.match(shoot(room,hunter,{aimX:0,aimZ:-1},now).error,/round/i);
});

test('misses targets outside range, behind hunter, or off aim line',()=>{
 const {room,hunter,runners}=create(2);move(hunter,0,0);move(runners[0],0,-75);
 let result=shoot(room,hunter,{aimX:0,aimZ:-1},now);assert.equal(result.hitId,null);
 move(runners[0],0,14);result=shoot(room,hunter,{aimX:0,aimZ:-1},now+900);assert.equal(result.hitId,null);
 move(runners[0],4,-14);result=shoot(room,hunter,{aimX:0,aimZ:-1},now+1800);assert.equal(result.hitId,null);
});

test('buildings block shots and high roof positions can have clear sightlines',()=>{
 const b=WORLD.buildings[0],x=b.x,z=b.z;
 assert.equal(occluded(x-b.w,x?1.6:1.6,z,x+b.w,1.6,z),true);
 assert.equal(occluded(x-b.w,b.h+12,z,x+b.w,b.h+12,z),false);
 const {room,hunter,runners}=create(2);
 move(hunter,x-b.w/2-8,z);move(runners[0],x+b.w/2+8,z);
 const r=shoot(room,hunter,{aimX:1,aimZ:0},now);assert.equal(r.hitId,null);
});

test('nearest unobstructed runner is hit, others remain upright',()=>{
 const {room,hunter,runners}=create(3);
 move(hunter,0,0);move(runners[0],0,-12);move(runners[1],0,-31);
 const result=shoot(room,hunter,{aimX:0,aimZ:-1},now);
 assert.equal(result.hitId,runners[0].id);assert.equal(runners[1].downUntil,0);
});

test('30-second knockout means respawn only on or after deadline with 3-second shield',()=>{
 const {room,hunter,runners}=create(2),runner=runners[0];
 move(hunter,0,0);move(runner,0,-13);
 shoot(room,hunter,{aimX:0,aimZ:-1},now);
 assert.equal(isDown(runner,now+29999),true);
 assert.equal(respawn(room,runner,now+29999),false);
 assert.equal(respawn(room,runner,now+30000),true);
 assert.equal(isDown(runner,now+30000),false);
 assert.equal(runner.shieldUntil,now+33000);
 assert.ok(Math.hypot(hunter.x-runner.x,hunter.z-runner.z)>=95);
 move(hunter,runner.x,runner.z+12);hunter.nextShotAt=0;
 const r=shoot(room,hunter,{aimX:0,aimZ:-1},now+31000);
 assert.equal(r.hitId,null,'shield must prevent spawn camping');
 hunter.nextShotAt=0;assert.equal(shoot(room,hunter,{aimX:0,aimZ:-1},now+34001).hitId,runner.id);
});

test('knocked-out players cannot walk, jump, escape, buy movement advantages, or collect powers',()=>{
 const {mgr,room,hunter,runners}=create(2),runner=runners[0];
 runner.downUntil=Date.now()+30_000;runner.input={dx:0,dz:0,sprint:false};
 const before={x:runner.x,z:runner.z};
 mgr.handle(runner.socket,{type:'input',seq:1,dx:1,dz:1,jump:true});
 mgr.tick(1/30);assert.equal(runner.x,before.x);assert.equal(runner.z,before.z);
 runner.x=room.secretExit.x;runner.z=room.secretExit.z;runner.y=room.secretExit.y;
 mgr.handle(runner.socket,{type:'escape'});assert.match(last(runner.socket,'error').message,/knocked out/i);
 mgr.handle(runner.socket,{type:'power'});assert.match(last(runner.socket,'error').message,/knocked out/i);
 mgr.handle(runner.socket,{type:'pickup'});assert.match(last(runner.socket,'error').message,/knocked out/i);
 mgr.handle(runner.socket,{type:'fire',aimX:0,aimZ:-1});assert.match(last(runner.socket,'error').message,/hunter/i);
});

test('realtime room snapshot shows down/shield states; rematch clears everything',()=>{
 const {mgr,room,hunter,runners,sockets}=create();const runner=runners[0];
 runner.downUntil=Date.now()+25000;mgr.snapshot();
 const snap=last(runner.socket,'snapshot');
 assert.ok(snap.combat.downUntil>Date.now());
 assert.equal(snap.players.find(p=>p.id===runner.id).down,true);
 runner.downUntil=Date.now()-1;mgr.tick();
 assert.equal(last(runner.socket,'respawned').type,'respawned');
 assert.equal(runner.downUntil,0);assert.ok(runner.shieldUntil>Date.now());
 mgr.endRound(room,{reason:'abandoned'});mgr.handle(sockets[0],{type:'start'});
 assert.equal(runner.shieldUntil,0);assert.equal(runner.downUntil,0);assert.equal(hunter.nextShotAt,0);
});
