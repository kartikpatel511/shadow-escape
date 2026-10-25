import test from 'node:test';
import assert from 'node:assert/strict';
import {remapControls} from '../shared/controls.js';
import {RoomManager} from '../server/rooms.mjs';
const sock=()=>({readyState:1,messages:[],send(str){this.messages.push(JSON.parse(str));}});
const last=(s,type)=>s.messages.findLast(m=>m.type===type);
test('Chaos Controls remaps WASD independently and can convert forward into a jump',()=>{
 const right=remapControls(0,1,false,0,{up:'right'});
 assert.equal(right.dx,-1);assert.ok(Math.abs(right.dz)<1e-10);assert.equal(right.jump,false);
 const hop=remapControls(0,1,false,0,{up:'jump'});
 assert.equal(hop.dx,0);assert.equal(hop.dz,0);assert.equal(hop.jump,true);
 const normal=remapControls(0,1,false,0,null);
 assert.ok(normal.dz > .99);
});
test('authoritative server ignores spoofed world directions during scrambled input',()=>{
 const mgr=new RoomManager(),a=sock(),b=sock(),c=sock();
 mgr.handle(a,{type:'create',name:'A',capacity:3});const code=last(a,'joined').room.code;
 mgr.handle(b,{type:'join',name:'B',code});mgr.handle(c,{type:'join',name:'C',code});mgr.handle(a,{type:'start'});
 const room=mgr.rooms.get(code),runner=[...room.players.values()].find(p=>p.role==='runner');
 runner.scrambleUntil=Date.now()+120000;runner.scrambleMap={up:'right',down:'jump',left:'down',right:'up'};
 mgr.input(runner.socket,{type:'input',seq:1,dx:0,dz:-1,localRight:0,localForward:1,yaw:0});
 assert.equal(runner.input.dx,-1);assert.ok(Math.abs(runner.input.dz)<1e-10);
 mgr.input(runner.socket,{type:'input',seq:2,dx:0,dz:-1,localRight:0,localForward:-1,yaw:0});
 assert.equal(runner.input.jump,true);
});
