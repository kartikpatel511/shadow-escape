import test from 'node:test';
import assert from 'node:assert/strict';
import {CONTROL,localToWorld,remapControls,steerVehicle} from '../shared/controls.js';
import {controllerPositionAllowed,controllerTerrainHeight} from '../shared/world.js';
import {RoomManager} from '../server/rooms.mjs';
import {usePower} from '../server/powers.mjs';

const sock=()=>({readyState:1,messages:[],send(message){this.messages.push(JSON.parse(message));}});
const last=(s,type)=>s.messages.findLast(m=>m.type===type);
function room3(){
 const mgr=new RoomManager(),clients=[sock(),sock(),sock()];
 mgr.make(clients[0],{capacity:3,name:'A'});const code=last(clients[0],'joined').room.code;
 mgr.join(clients[1],{code,name:'B'});mgr.join(clients[2],{code,name:'C'});mgr.start(clients[0]);
 const room=mgr.rooms.get(code),runners=[...room.players.values()].filter(p=>p.role==='runner');
 return {mgr,room,runners,clients};
}
test('exact camera, walking, steering and mobile control tunables remain stable',()=>{
 assert.equal(CONTROL.INITIAL_YAW,Math.PI);assert.equal(CONTROL.INITIAL_PITCH,.35);
 assert.equal(CONTROL.INITIAL_DIST,6);assert.equal(CONTROL.WALK_SPEED,7.5);
 assert.equal(CONTROL.RUN_SPEED,14);assert.equal(CONTROL.TURN_SPEED,1.8);
 assert.equal(CONTROL.LOOK_X,.005);assert.equal(CONTROL.LOOK_Y,.004);
 assert.equal(CONTROL.PIT_MIN,-.45);assert.equal(CONTROL.PIT_MAX,1.2);
 assert.equal(CONTROL.CAMERA_LERP,9);assert.equal(CONTROL.GROUND_LERP,12);
 assert.equal(CONTROL.VEHICLE_ACCEL_FWD,20);assert.equal(CONTROL.VEHICLE_ACCEL_BACK,8);
 assert.equal(CONTROL.JOYSTICK_RING,90);assert.equal(CONTROL.JOYSTICK_KNOB,30);
 assert.equal(CONTROL.JOYSTICK_MAX,45);assert.equal(CONTROL.MAX_DT,.05);
});
test('diagonal movement normalizes and uses independent new +z forward and left/right vectors',()=>{
 const forward=remapControls(0,1,false,0),right=remapControls(1,0,false,0);
 assert.deepEqual({x:forward.dx,z:forward.dz},{x:0,z:1});
 assert.deepEqual({x:right.dx,z:right.dz},{x:-1,z:0});
 const both=remapControls(1,1,false,Math.PI);
 assert.ok(Math.abs(Math.hypot(both.dx,both.dz)-1)<1e-12);
 assert.deepEqual(localToWorld(0,1,0),{dx:0,dz:1});
});
test('river water is traversable, and colliders remain physical',()=>{
 assert.ok(controllerTerrainHeight(0,52)>.3);
 assert.ok(controllerPositionAllowed(0,52));
 assert.ok(controllerPositionAllowed(73.99126888583712,23),'shallow river must be traversable');
 assert.ok(!controllerPositionAllowed(230,52));
});
test('car acceleration, rotation and blocked collisions enforce authoritative values',()=>{
 const car={x:0,z:0,yaw:0,v:0};
 steerVehicle(car,1,1,.05,()=>true);
 assert.ok(car.v>0);assert.ok(car.yaw>0);
 const prevV=car.v,prevZ=car.z;
 steerVehicle(car,1,0,.05,()=>false);
 assert.equal(car.z,prevZ);assert.ok(car.v<0&&Math.abs(car.v)<prevV);
});
test('vehicle entry is within 6m, movement is server-run, and right-side exit is enforced',()=>{
 const {mgr,room,runners}=room3(),p=runners.find(x=>Math.hypot(x.x,x.z-52)<1);
 assert.ok(p,'first runner must start at (0,52)');
 const car=room.vehicle;assert.equal(car.z,46);
 mgr.toggleVehicle(p.socket);assert.equal(car.driverId,p.id);assert.equal(p.driving,true);
 mgr.input(p.socket,{type:'input',seq:1,localRight:0,localForward:1,yaw:0,sprint:false});
 for(let i=0;i<20;i++)mgr.tick(1/30);
 assert.ok(car.z>46);assert.equal(p.x,car.x);assert.equal(p.z,car.z);
 const before={x:car.x,yaw:car.yaw};
 mgr.toggleVehicle(p.socket);
 assert.equal(p.driving,false);assert.equal(car.driverId,null);
 assert.ok(Math.abs(p.x-(before.x-Math.cos(before.yaw)*2.8))<1e-8);
});
test('freeze is genuine on authoritative movement and in victim snapshots, not only a notification',()=>{
 const {mgr,room,runners}=room3(),[attacker,victim]=runners,now=Date.now();
 attacker.loadout[0]='freeze';attacker.powerReadyAt=0;
 const cast=usePower(room,attacker,'freeze',victim.id,now);
 assert.equal(cast.ok,true);assert.equal(victim.freezeUntil,now+20000);
 const initial=[victim.x,victim.y,victim.z];
 mgr.input(victim.socket,{type:'input',seq:1,localRight:1,localForward:1,yaw:0,sprint:true,jump:true});
 mgr.stepPlayer(victim,.05,now+100,room);
 assert.deepEqual([victim.x,victim.y,victim.z],initial);
 mgr.snapshotRoom(room);
 assert.equal(last(victim.socket,'snapshot').power.effects.frozen,true);
 mgr.stepPlayer(victim,.05,now+8001,room);
 assert.equal(last(victim.socket,'snapshot').power.effects.frozen,true); // snapshot was at active time
});
