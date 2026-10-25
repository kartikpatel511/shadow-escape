import test from 'node:test';
import assert from 'node:assert/strict';
import {RoomManager} from '../server/rooms.mjs';
import {POWER_RULES,usePower,currentEffects} from '../server/powers.mjs';
import {remapControls} from '../shared/controls.js';
import {WALK_SPEED,RUN_SPEED,directionalMotion,walkHorizontal,allowedPosition,vehicleStep,cameraGoal,overviewGoal,playableHeight,wrapAngle,MAX_DT} from '../shared/movement.js';
const sock=()=>({readyState:1,messages:[],send(data){this.messages.push(JSON.parse(data));}});
const last=(s,t)=>s.messages.findLast(m=>m.type===t);
function session(n=3){const mgr=new RoomManager(),socks=Array.from({length:n},sock);
 mgr.handle(socks[0],{type:'create',name:'One',capacity:n});const code=last(socks[0],'joined').room.code;
 for(let i=1;i<n;i++)mgr.handle(socks[i],{type:'join',name:`Guest${i}`,code});mgr.handle(socks[0],{type:'start'});
 return {mgr,room:mgr.rooms.get(code),socks};}
test('exact world forward/right axes and diagonal normalization',()=>{
 assert.deepEqual(directionalMotion(0,1,0),{x:0,z:1});
 const r=directionalMotion(0,0,1);assert.equal(r.x,-1);assert.equal(r.z,0);
 const diag=directionalMotion(Math.PI,1,1);assert.ok(Math.abs(Math.hypot(diag.x,diag.z)-1)<1e-12);
 const c=remapControls(1,1,false,Math.PI);assert.ok(Math.abs(Math.hypot(c.dx,c.dz)-1)<1e-10);
 assert.equal(WALK_SPEED,7.5);assert.equal(RUN_SPEED,14);assert.equal(MAX_DT,.05);
});
test('per-axis X/Z collision slides along blocked surfaces and respects water/circle colliders',()=>{
 const p={x:0,y:0,z:0};let calls=[];
 const next=walkHorizontal(p,4,6,.05,(x,z)=>{calls.push([x,z]);return x===0;});
 assert.deepEqual(next,{x:0,z:.30000000000000004});assert.equal(calls.length,2);
 assert.equal(allowedPosition(0,52),true);assert.ok(playableHeight(0,52)>.3);
 assert.equal(allowedPosition(225,0),false);
});
test('first person, third person, and overview camera match specified numeric equations',()=>{
 const player={x:0,z:52,y:0};
 const f=cameraGoal(player,Math.PI,.35,.01);
 assert.deepEqual(f.position,[0,1.65,52]);assert.ok(f.target[2]<52);
 const t=cameraGoal(player,Math.PI,.35,6);
 assert.ok(Math.abs(t.position[2]-(52+Math.cos(.35)*6))<1e-10);
 assert.ok(t.position[1]>=1.65+Math.sin(.35)*6);
 const o=overviewGoal(.8,1,170);assert.equal(o.target[1],6);
 assert.ok(Math.abs(wrapAngle(3*Math.PI)-Math.PI)<1e-9);
});
test('car accelerates, steers only with movement, stops at a collision, and obeys 50ms dt limit',()=>{
 const car={x:0,z:52,yaw:0,v:0,driverId:null};
 const a=vehicleStep(car,1,1,.05,()=>true);
 assert.ok(Math.abs(a.v-1.2)<1e-12);assert.ok(a.yaw>0);
 const stopped=vehicleStep(car,0,1,.05,()=>true);assert.equal(stopped.yaw,0);
 const crash=vehicleStep(a,1,1,.05,()=>false);assert.ok(crash.v<0);assert.equal(crash.x,a.x);
 assert.deepEqual(vehicleStep(car,1,0,.5,()=>true),vehicleStep(car,1,0,.05,()=>true));
});
test('first runner starts at (0,52), and enter/exit car is authoritative',()=>{
 const {mgr,room,socks}=session(3),runner=[...room.players.values()].find(p=>p.role==='runner'&&p.x===0&&p.z===52);
 assert.ok(runner);assert.equal(room.vehicle.driverId,null);
 mgr.handle(runner.socket,{type:'vehicle'});assert.equal(room.vehicle.driverId,runner.id);
 assert.equal(last(runner.socket,'vehicleAction').driving,true);
 mgr.handle(runner.socket,{type:'input',seq:1,dx:0,dz:1,localForward:1,localRight:0,yaw:0});
 mgr.tick(.05);assert.ok(room.vehicle.v>0);assert.equal(runner.x,room.vehicle.x);
 mgr.handle(runner.socket,{type:'vehicle'});assert.equal(room.vehicle.driverId,null);
 assert.equal(last(runner.socket,'vehicleAction').driving,false);
 assert.ok(Math.abs(Math.hypot(runner.x-room.vehicle.x,runner.z-room.vehicle.z)-2.8)<.001);
});
test('freeze affects real server movement and is reported immediately to its victim',()=>{
 const {mgr,room}=session(3),runners=[...room.players.values()].filter(p=>p.role==='runner');
 const [a,b]=runners;a.loadout[0]='freeze';a.powerReadyAt=0;
 mgr.handle(a.socket,{type:'power',ability:'freeze',targetId:b.id});
 const hit=last(b.socket,'powerHit');assert.equal(hit.ability,'freeze');assert.equal(hit.effects.frozen,true);
 const before=[b.x,b.y,b.z];
 mgr.handle(b.socket,{type:'input',seq:1,dx:1,dz:0,localRight:-1,localForward:0,yaw:0,jump:true});
 mgr.tick(.05);assert.deepEqual([b.x,b.y,b.z],before);
 assert.equal(currentEffects(b).frozen,true);assert.equal(POWER_RULES.freeze.durationMs,20000);
});
