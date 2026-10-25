import test from 'node:test';
import assert from 'node:assert/strict';
import {RoomManager} from '../server/rooms.mjs';
import {GATES,HALF,validPosition} from '../shared/world.js';
import {canEscape,exitSignal,selectSecretExit} from '../server/round.mjs';
const fakeSocket=()=>({readyState:1,messages:[],send(raw){this.messages.push(JSON.parse(raw));}});
const last=(s,t)=>s.messages.findLast(m=>m.type===t);
function setup(n=3){
 const mgr=new RoomManager(),users=Array.from({length:n},fakeSocket);
 mgr.handle(users[0],{type:'create',capacity:n,name:'Host'});
 const code=last(users[0],'joined').room.code;
 for(let i=1;i<n;i++)mgr.handle(users[i],{type:'join',code,name:`Runner${i}`});
 const room=mgr.rooms.get(code);
 mgr.handle(users[0],{type:'start'});
 return {mgr,users,room};
}
test('all eight secret door sites are reachable, unique and inside world boundary',()=>{
 const sites=GATES.map((_,i)=>selectSecretExit(()=>i));
 assert.equal(new Set(sites.map(s=>`${s.x},${s.z}`)).size,8);
 for(const exit of sites){
  assert.ok(Math.abs(exit.x)<=HALF-7&&Math.abs(exit.z)<=HALF-7);
  assert.ok(validPosition(exit.x,exit.z),'Door must be physically reachable');
 }
});
test('each match selects exactly one hunter and the rest runners',()=>{
 for(let n=2;n<=12;n++){
  const {room,users}=setup(n),players=[...room.players.values()];
  assert.equal(players.filter(p=>p.role==='hunter').length,1);
  assert.equal(players.filter(p=>p.role==='runner').length,n-1);
  const started=last(users[0],'started');
  assert.equal(started.hunterId,players.find(p=>p.role==='hunter').id);
  assert.equal(started.players.length,n);
  assert.ok(!('secretExit' in started));
  assert.ok(!('secretExit' in started.room));
  assert.equal(new Set(players.map(p=>`${p.x},${p.z}`)).size,n);
 }
});
test('secret door is revealed only locally to a nearby runner, never to the hunter',()=>{
 const {mgr,users,room}=setup(),p=[...room.players.values()];
 for(const x of p){x.x=0;x.z=0;}
 mgr.snapshot();
 for(const u of users)assert.equal(last(u,'snapshot').exitSignal,null);
 const runner=p.find(x=>x.role==='runner');runner.x=room.secretExit.x;runner.z=room.secretExit.z;
 mgr.snapshot();
 const signal=last(runner.socket,'snapshot').exitSignal;
 assert.equal(signal?.distance,0);
 const hunter=p.find(x=>x.role==='hunter');hunter.x=runner.x;hunter.z=runner.z;
 mgr.snapshot();assert.equal(last(hunter.socket,'snapshot').exitSignal,null);
 const other=p.find(x=>x!==runner&&x!==hunter);
 if(other)assert.equal(last(other.socket,'snapshot').exitSignal,null);
});
test('escape checks server position, role and height; first valid runner wins atomically',()=>{
 const {mgr,room,users}=setup(4),players=[...room.players.values()];
 const hunter=players.find(p=>p.role==='hunter'),runners=players.filter(p=>p.role==='runner');
 mgr.handle(runners[0].socket,{type:'escape',x:room.secretExit.x,z:room.secretExit.z});
 assert.equal(room.phase,'exploring');
 assert.match(last(runners[0].socket,'error').message,/not within reach/i);
 hunter.x=room.secretExit.x;hunter.z=room.secretExit.z;hunter.y=room.secretExit.y;
 mgr.handle(hunter.socket,{type:'escape'});
 assert.equal(room.phase,'exploring');
 assert.match(last(hunter.socket,'error').message,/only trapped runners/i);
 runners[0].x=room.secretExit.x;runners[0].z=room.secretExit.z;runners[0].y=room.secretExit.y+30;
 mgr.handle(runners[0].socket,{type:'escape'});assert.equal(room.phase,'exploring');
 runners[0].y=room.secretExit.y;
 mgr.handle(runners[0].socket,{type:'escape'});
 assert.equal(room.phase,'finished');assert.equal(room.winnerId,runners[0].id);
 assert.equal(last(users[0],'ended').winnerName,runners[0].name);
 runners[1].x=room.secretExit.x;runners[1].z=room.secretExit.z;runners[1].y=room.secretExit.y;
 mgr.handle(runners[1].socket,{type:'escape'});
 assert.equal(room.winnerId,runners[0].id);
 assert.equal(users[0].messages.filter(m=>m.type==='ended').length,1);
});
test('rematch is host-only, resets win state and rerolls secret door',()=>{
 const {mgr,room,users}=setup(3);
 const runner=[...room.players.values()].find(p=>p.role==='runner');
 runner.x=room.secretExit.x;runner.z=room.secretExit.z;runner.y=room.secretExit.y;
 mgr.handle(runner.socket,{type:'escape'});assert.equal(room.phase,'finished');
 mgr.handle(users[1],{type:'start'}); // may be host? users[1] is always nonhost
 assert.match(last(users[1],'error').message,/host/i);
 mgr.handle(users[0],{type:'start'});
 assert.equal(room.phase,'exploring');assert.equal(room.winnerId,null);
 assert.equal(room.endReason,null);assert.equal([...room.players.values()].filter(p=>p.role==='hunter').length,1);
});
test('hunter disconnect ends the match without a fake escape winner',()=>{
 const {mgr,room,users}=setup(3);
 const hunter=[...room.players.values()].find(p=>p.role==='hunter');
 mgr.leave(hunter.socket);
 assert.equal(room.phase,'finished');assert.equal(room.winnerId,null);
 assert.equal(room.endReason,'hunter_disconnected');
 const survivors=users.filter(u=>u!==hunter.socket);
 assert.ok(survivors.every(u=>last(u,'ended')?.reason==='hunter_disconnected'));
});
test('exit utility allows only nearby grounded runners',()=>{
 const exit=selectSecretExit(()=>0),p={role:'runner',x:exit.x,z:exit.z,y:exit.y};
 assert.equal(canEscape(p,exit),true);
 assert.equal(exitSignal(p,exit).distance,0);
 assert.equal(canEscape({...p,role:'hunter'},exit),false);
 assert.equal(exitSignal({...p,role:'hunter'},exit),null);
 assert.equal(canEscape({...p,x:exit.x-20},exit),false);
});
