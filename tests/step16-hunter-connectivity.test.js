import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {RoomManager} from '../server/rooms.mjs';
import {PORTAL_SITES,selectSecretExit} from '../server/round.mjs';
import {PLAY_LIMIT,controllerPositionAllowed} from '../shared/world.js';
import {CONTROL} from '../shared/controls.js';
const sock=()=>({readyState:1,messages:[],send(raw){this.messages.push(JSON.parse(raw));}});
const last=(s,t)=>s.messages.findLast(x=>x.type===t);
function game(){const m=new RoomManager(),sockets=[sock(),sock(),sock()];
 m.make(sockets[0],{name:'Host',capacity:3});const code=last(sockets[0],'joined').room.code;
 for(let i=1;i<3;i++)m.join(sockets[i],{name:'P'+i,code});
 m.start(sockets[0]);const room=m.rooms.get(code),hunter=[...room.players.values()].find(p=>p.role==='hunter');
 return {m,room,hunter,code};}
test('hunter can receive server-authoritative WASD movement and is not affected by runner skill slots',()=>{
 const {m,room,hunter}=game();const start={x:hunter.x,z:hunter.z};
 assert.deepEqual(hunter.loadout,[]);
 let moved=false;
 for(let i=1;i<=18;i++){
  m.input(hunter.socket,{type:'input',seq:i,localRight:0,localForward:1,yaw:Math.PI,sprint:true});
  m.stepPlayer(hunter,1/30,Date.now(),room);
  if(Math.hypot(hunter.x-start.x,hunter.z-start.z)>.7)moved=true;
 }
 assert.ok(moved,`monster should move under input: ${JSON.stringify(start)} -> ${hunter.x},${hunter.z}`);
 m.close();
});
test('temporary hunter websocket loss does not end match and same monster resumes with its original identity',()=>{
 const {m,room,hunter,code}=game();const old=hunter.socket,id=hunter.id;
 m.leave(old,{grace:true});assert.equal(room.phase,'exploring');assert.equal(hunter.socket,null);
 const newSocket=sock();m.resume(newSocket,{code,resumeToken:hunter.resumeToken});
 assert.equal(room.phase,'exploring');assert.equal(hunter.socket,newSocket);
 assert.equal(last(newSocket,'resumed').selfId,id);
 assert.ok(!newSocket.messages.some(packet=>packet.type==='ended'));
 m.close();
});
test('all secret portals are reachable well inside the playable perimeter with a clear doorway',()=>{
 assert.equal(PORTAL_SITES.length,26);
 for(let i=0;i<PORTAL_SITES.length;i++){
  const p=selectSecretExit(()=>i);
  assert.ok(Math.abs(p.x)<=PLAY_LIMIT-14&&Math.abs(p.z)<=PLAY_LIMIT-14);
  assert.equal(controllerPositionAllowed(p.x,p.z,5),true,`portal ${i} must have a clear 5m entrance`);
 }
 assert.equal(controllerPositionAllowed(PLAY_LIMIT+1,0),false);
});
test('hunters have a non-sniper right-shoulder aiming optic and smaller avatar labels',()=>{
 const main=readFileSync(new URL('../client/main.js',import.meta.url),'utf8');
 const renderer=readFileSync(new URL('../client/renderer.js',import.meta.url),'utf8');
 const stylesheet=readFileSync(new URL('../client/style.css',import.meta.url),'utf8');
 assert.ok(CONTROL.HUNTER_SCOPE_DIST>1.5&&CONTROL.HUNTER_SCOPE_RIGHT>0);
 assert.ok(main.includes('CONTROL.HUNTER_SCOPE_RIGHT'));
 assert.ok(main.includes("if(m.resumeExisting)$('roleIntro').hidden=true"));
 assert.ok(main.includes("if(['w','a','s','d'"),'the tutorial must not trap movement keys');
 assert.ok(renderer.includes('scale=hunter?1.12:.80'));
 assert.ok(renderer.includes('this.scopeZoom?PI/4.4:PI/3.05'));
 assert.ok(stylesheet.includes('.name-tag{font-size:8px'));
});
