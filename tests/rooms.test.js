import test from 'node:test';
import assert from 'node:assert/strict';
import {RoomManager} from '../server/rooms.mjs';
import {validPosition} from '../shared/world.js';
const socket=()=>({readyState:1,messages:[],send(text){this.messages.push(JSON.parse(text));}});
const last=(s,type)=>s.messages.findLast(x=>x.type===type);
const setup=(count=2)=>{
 const manager=new RoomManager(),users=Array.from({length:count},socket);
 manager.handle(users[0],{type:'create',name:'Host',skin:1,capacity:count});
 const code=last(users[0],'joined').room.code;
 for(let i=1;i<count;i++)manager.handle(users[i],{type:'join',code,name:`Guest ${i}`,skin:i%9});
 return {manager,users,code,room:manager.rooms.get(code)};
};
test('creates an isolated 2–12 person room with a unique five-character code',()=>{
 const {manager,users,room,code}=setup(4);
 assert.match(code,/^[A-Z2-9]{5}$/);
 assert.equal(room.players.size,4);assert.equal(room.capacity,4);
 assert.equal(last(users[0],'room').room.players.length,4);
 const stranger=socket();manager.handle(stranger,{type:'create',capacity:13});assert.equal(last(stranger,'error').type,'error');
 manager.handle(stranger,{type:'create',capacity:2,name:'Test'});assert.equal(manager.rooms.size,2);
 assert.notEqual(last(stranger,'joined').room.code,code);
});
test('rejects incorrect code, full rooms and uninvited starts',()=>{
 const {manager,users,room,code}=setup(2),extra=socket();
 manager.handle(extra,{type:'join',code:'XXXXX',name:'Hi'});assert.match(last(extra,'error').message,/not found/i);
 manager.handle(extra,{type:'join',code,name:'Hi'});assert.match(last(extra,'error').message,/full/i);
 manager.handle(users[1],{type:'start'});assert.equal(room.phase,'lobby');
 assert.match(last(users[1],'error').message,/host/i);
});
test('host launches session with correctly separated legal spawns and avatars',()=>{
 const {manager,users,room}=setup(12);
 manager.handle(users[0],{type:'start'});
 assert.equal(room.phase,'exploring');
 const {players}=last(users[0],'started');assert.equal(players.length,12);
 const authoritative=[...room.players.values()];
 for(const p of authoritative)assert.ok(validPosition(p.x,p.z));
 assert.equal(new Set(authoritative.map(p=>`${p.x},${p.z}`)).size,12);
 // The main 3D world receives full avatar positions independently of paid radar.
 const selfId=last(users[0],'joined').selfId;
 assert.ok(players.find(p=>p.id===selfId && Number.isFinite(p.x)));
 assert.ok(players.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.z)));
 assert.equal(players.filter(p=>p.role==='hunter').length,1);
 assert.equal(players.filter(p=>p.role==='runner').length,11);
 const late=socket();manager.handle(late,{type:'join',code:room.code});assert.match(last(late,'error').message,/started/i);
});
test('server rejects teleport positions and invalid/overspeed vectors',()=>{
 const {manager,users,room}=setup(2);manager.handle(users[0],{type:'start'});
 const p=[...room.players.values()][0],x=p.x,z=p.z;
 manager.handle(users[0],{type:'input',seq:1,localRight:999,localForward:999,yaw:0,x:198,z:198,sprint:true});
 manager.tick(1/30);
 assert.ok(Math.hypot(p.x-x,p.z-z)<.6);
 manager.handle(users[0],{type:'input',seq:2,localRight:Infinity,localForward:1,yaw:0});assert.equal(p.lastSeq,1);
 manager.handle(users[0],{type:'input',seq:0,localRight:0,localForward:0,yaw:0});assert.equal(p.input.sprint,true);
});
test('movement, jumping and collision run on the authoritative server',()=>{
 const {manager,users,room}=setup(2);manager.handle(users[0],{type:'start'});
 const p=[...room.players.values()][0],originalZ=p.z;
 manager.handle(users[0],{type:'input',seq:1,localRight:0,localForward:1,yaw:Math.PI,jump:true,sprint:false});
 manager.tick(1/30);assert.ok(p.z<originalZ);assert.ok(p.y>0);assert.equal(p.grounded,false);
 for(let i=0;i<130;i++)manager.tick(1/30);
 assert.ok(p.grounded);assert.ok(Math.abs(p.x)<225&&Math.abs(p.z)<225);
});
test('all avatars appear in 3D while distant players remain absent from free minimap radar',()=>{
 const {manager,users,room}=setup(2);manager.handle(users[0],{type:'start'});
 const [a,b]=[...room.players.values()];
 b.x=a.x+5;b.z=a.z+5;
 manager.snapshot();assert.equal(last(users[0],'snapshot').players.length,2);
 b.x=180;b.z=180;manager.snapshot();
 assert.equal(last(users[0],'snapshot').players.length,2);assert.equal(last(users[1],'snapshot').players.length,2);
 assert.deepEqual(last(users[0],'snapshot').radar.contacts,[]);
 assert.deepEqual(last(users[1],'snapshot').radar.contacts,[]);
});
test('host migration, leave, and room deletion on last disconnect',()=>{
 const {manager,users,room,code}=setup(3);
 manager.leave(users[0]);assert.equal(room.hostId,[...room.players.keys()][0]);
 assert.equal(last(users[1],'room').room.players.length,2);
 manager.handle(users[1],{type:'start'});assert.equal(room.phase,'exploring');
 manager.leave(users[1]);manager.leave(users[2]);assert.equal(manager.rooms.has(code),false);
});
