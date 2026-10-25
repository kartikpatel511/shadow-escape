import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {RoomManager} from '../server/rooms.mjs';
import {ROUND_SECONDS,canEscape,EXIT_NOTICE_RADIUS} from '../server/round.mjs';
import {CONTROL} from '../shared/controls.js';
import {terrainY} from '../shared/world.js';

const socket=()=>({readyState:1,messages:[],send(raw){this.messages.push(JSON.parse(raw));}});
const last=(s,type)=>s.messages.findLast(m=>m.type===type);
function makeRound(){
 const m=new RoomManager(),clients=[socket(),socket(),socket()];
 m.make(clients[0],{capacity:3,name:'Host'});
 const code=last(clients[0],'joined').room.code;
 m.join(clients[1],{code,name:'NightRunner'});
 m.join(clients[2],{code,name:'Rival'});
 m.start(clients[0]);const room=m.rooms.get(code);
 return {m,clients,room,runners:[...room.players.values()].filter(p=>p.role==='runner'),hunter:[...room.players.values()].find(p=>p.role==='hunter')};
}
test('running onto the real portal automatically declares the first eligible runner winner',()=>{
 const {m,room,runners,hunter}=makeRound();const winner=runners[0],gate=room.secretExit;
 winner.x=gate.x;winner.z=gate.z;winner.y=terrainY(gate.x,gate.z);winner.grounded=true;
 assert.equal(canEscape(winner,gate),true);
 m.tick(1/30);
 assert.equal(room.phase,'finished');assert.equal(room.winnerId,winner.id);
 assert.equal(room.endReason,'escaped');
 for(const p of room.players.values()){
  const end=last(p.socket,'ended');
  assert.equal(end.winnerId,winner.id);
  assert.equal(end.winnerName,winner.name);
  assert.equal(end.winnerRole,'runner');
  assert.equal(end.reason,'escaped');
  assert.ok(Number.isFinite(end.elapsedMs));
 }
 assert.equal(hunter.role,'hunter');
 m.tick(1/30);
 assert.equal(winner.socket.messages.filter(m=>m.type==='ended').length,1);
 m.close();
});
test('incapacitated runner cannot auto-win on contact; hunter cannot claim escape',()=>{
 const {m,room,runners,hunter}=makeRound(),runner=runners[0],gate=room.secretExit;
 runner.x=gate.x;runner.z=gate.z;runner.y=gate.y;runner.freezeUntil=Date.now()+2000;
 hunter.x=gate.x;hunter.z=gate.z;hunter.y=gate.y;
 m.tick(1/30);assert.equal(room.phase,'exploring');
 runner.freezeUntil=0;runner.y=terrainY(runner.x,runner.z);m.tick(1/30);
 assert.equal(room.phase,'finished');assert.equal(room.winnerId,runner.id);
 m.close();
});
test('proximity indicator has a generous visual warning, while the server entrance remains strict',()=>{
 assert.equal(ROUND_SECONDS,480);assert.equal(EXIT_NOTICE_RADIUS,36);
 assert.ok(CONTROL.RUN_SPEED>9&&CONTROL.WALK_SPEED>4.5);
 const {m,room,runners}=makeRound(),p=runners[0],gate=room.secretExit;
 p.x=gate.x+22;p.z=gate.z;p.y=gate.y;
 // The server permits only entrance contact, not a 22m-away hint.
 assert.equal(canEscape(p,gate),false);
 m.snapshotRoom(room);assert.ok(last(p.socket,'snapshot').exitSignal?.distance>7.5);
 m.close();
});
test('portal, winner podium, hunter scope, music, and compass hints have matching HTML hooks',()=>{
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 const js=readFileSync(new URL('../client/main.js',import.meta.url),'utf8');
 const match=readFileSync(new URL('../client/match-ui.js',import.meta.url),'utf8');
 const audio=readFileSync(new URL('../client/audio.js',import.meta.url),'utf8');
 for(const id of ['portalNotice','portalNoticeTitle','portalNoticeHint','winnerPodium','winnerAvatar','winnerName','winnerCrown','endReason','scopeButton','hunterReticle','musicToggle','compassRoute']){
  assert.ok(html.includes(`id="${id}"`),`missing ${id}`);
 }
 assert.ok(js.includes('renderer.scopeZoom'));
 assert.ok(match.includes("send({type:'escape'})"));
 assert.ok(audio.includes('AudioContext')&&audio.includes('CHORDS'));
});
