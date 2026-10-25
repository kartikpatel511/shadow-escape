import test from 'node:test';
import assert from 'node:assert/strict';
import {RoomManager} from '../server/rooms.mjs';
import {PORTAL_SITES,ROUND_SECONDS,selectSecretExit,visiblePortal,canEscape,exitSignal} from '../server/round.mjs';
import {controllerPositionAllowed,terrainY} from '../shared/world.js';
import {usePower,powerSelf,compassContacts} from '../server/powers.mjs';
import {WorldRenderer} from '../client/renderer.js';

const socket=()=>({readyState:1,messages:[],send(raw){this.messages.push(JSON.parse(raw));}});
const latest=(p,t)=>p.socket.messages.findLast(m=>m.type===t);
function game(n=4){const manager=new RoomManager(),sockets=Array.from({length:n},socket);
 manager.make(sockets[0],{name:'Host',capacity:n});const code=sockets[0].messages.findLast(m=>m.type==='joined').room.code;
 for(let i=1;i<n;i++)manager.join(sockets[i],{name:`Runner${i}`,code});
 manager.start(sockets[0]);const room=manager.rooms.get(code);
 return {manager,room,players:[...room.players.values()],runners:[...room.players.values()].filter(p=>p.role==='runner'),hunter:[...room.players.values()].find(p=>p.role==='hunter')};}

test('26 stable candidate locations are reachable, selected once per round, and not leaked globally',()=>{
 assert.equal(PORTAL_SITES.length,26);
 assert.equal(new Set(PORTAL_SITES.map(p=>`${p.x}:${p.z}`)).size,26);
 for(const spot of PORTAL_SITES)assert.equal(controllerPositionAllowed(spot.x,spot.z,2),true);
 const exits=PORTAL_SITES.map((_,i)=>selectSecretExit(()=>i));
 assert.equal(new Set(exits.map(e=>`${e.x}:${e.z}`)).size,26);
 const {manager,room,players}=game();const old=room.secretExit;
 for(const player of players){player.x=-5;player.z=5;}
 manager.snapshotRoom(room);
 assert.deepEqual(room.secretExit,old);
 for(const player of players){
  const m=latest(player,'snapshot');
  assert.ok(!('secretExit' in m), 'full secret location must never be broadcast');
  assert.ok(!('secretExit' in m.radar), 'the minimap cannot leak the portal');
 }
 manager.close();
});
test('3D portal is visible to all roles only when close enough; entry requires grounded un-frozen runner',()=>{
 const {manager,room,runners,hunter}=game();const gate=room.secretExit,near=runners[0],far=runners[1];
 near.x=gate.x+10;near.z=gate.z;near.y=gate.y;
 hunter.x=gate.x+15;hunter.z=gate.z;hunter.y=gate.y;
 far.x=gate.x>0?-170:170;far.z=gate.z>0?-170:170;
 manager.snapshotRoom(room);
 assert.deepEqual(latest(near,'snapshot').portal,visiblePortal(near,gate));
 assert.deepEqual(latest(hunter,'snapshot').portal,visiblePortal(hunter,gate),'monster sees visual portal too');
 assert.equal(latest(far,'snapshot').portal,null);
 assert.equal(latest(hunter,'snapshot').exitSignal,null,'hunter receives no private escape hint');
 assert.equal(canEscape(near,gate),false,'must be within 7.5m');
 near.x=gate.x;near.z=gate.z;near.y=gate.y;
 assert.equal(canEscape(near,gate),true);
 near.freezeUntil=Date.now()+10000;assert.equal(canEscape(near,gate),false);
 near.freezeUntil=0;near.gravityUntil=Date.now()+10000;assert.equal(canEscape(near,gate),false);
 near.gravityUntil=0;near.driving=true;assert.equal(canEscape(near,gate),false);
 assert.equal(canEscape(hunter,gate),false);
 manager.close();
});
test('server counts down from eight minutes and awards hunter a timeout win once',()=>{
 const {manager,room,runners,hunter}=game();const st=latest(runners[0],'started');
 assert.equal(st.roundRemainingMs,ROUND_SECONDS*1000);
 assert.equal(room.roundEndsAt-room.startedAt,480000);
 manager.snapshotRoom(room);
 assert.ok(latest(runners[0],'snapshot').roundRemainingMs<=480000);
 room.roundEndsAt=Date.now()-1;
 manager.tick(1/30);
 assert.equal(room.phase,'finished');assert.equal(room.winnerId,hunter.id);assert.equal(room.endReason,'timeout');
 assert.equal(latest(hunter,'ended').reason,'timeout');
 manager.tick(1/30);
 assert.equal(hunter.socket.messages.filter(m=>m.type==='ended').length,1);
 manager.close();
});
test('only first runner reaching portal before deadline escapes and no later power reverses win',()=>{
 const {manager,room,runners,hunter}=game();const gate=room.secretExit;
 const winner=runners[0];winner.x=gate.x;winner.z=gate.z;winner.y=gate.y;
 manager.handle(winner.socket,{type:'escape'});
 assert.equal(room.winnerId,winner.id);assert.equal(room.phase,'finished');
 for(const player of runners.slice(1)){
  player.x=gate.x;player.z=gate.z;player.y=gate.y;
  manager.handle(player.socket,{type:'escape'});
 }
 manager.tick(1/30);
 assert.equal(room.winnerId,winner.id);assert.notEqual(room.winnerId,hunter.id);
 manager.close();
});
test('zero gravity performs multiple unpredictable server-side throws and lands at its 20s deadline',()=>{
 const {manager,room,runners}=game();const [caster,victim,witness]=runners,now=Date.now();
 caster.loadout=['gravity'];caster.powerReadyAt=0;
 const effect=usePower(room,caster,'gravity',victim.id,now);
 assert.equal(effect.ok,true);assert.equal(effect.durationMs,20000);
 const start={x:victim.x,z:victim.z};
 for(let i=1;i<=400;i++)manager.stepPlayer(victim,1/30,now+i*50,room); // 20 sec simulated at discrete points
 const tosses=victim.socket.messages.filter(m=>m.type==='gravityToss');
 assert.ok(tosses.length>=2,`expected several throws, received ${tosses.length}`);
 assert.ok(tosses.every(t=>t.targetId===victim.id));
 assert.ok(tosses.every(t=>Math.hypot(t.to.x-t.from.x,t.to.z-t.from.z)>15));
 assert.ok(Math.hypot(victim.x-start.x,victim.z-start.z)>3);
 assert.equal(victim.gravityUntil,0);assert.equal(victim.gravityLastUntil,0);
 assert.equal(victim.grounded,true);assert.equal(victim.y,terrainY(victim.x,victim.z));
 assert.equal(latest(victim,'gravityLanded').y,victim.y);
 manager.close();
});
test('Shattered Compass stays universal and its tracking downside still applies with interior portals',()=>{
 const {manager,room,runners,hunter}=game();const runner=runners[0],now=Date.now();
 for(const p of runners)assert.ok(p.loadout.includes('shattered'));
 assert.deepEqual(hunter.loadout,[]);
 runner.powerReadyAt=0;
 assert.equal(usePower(room,runner,'shattered',null,now).ok,true);
 const hint=powerSelf(runner,now,room).hints.shattered;
 assert.ok(hint&&!('x' in hint)&&!('z' in hint));
 assert.equal(compassContacts(room,hunter,now)[0].id,runner.id);
 assert.deepEqual(compassContacts(room,runners[1],now),[]);
 manager.close();
});
