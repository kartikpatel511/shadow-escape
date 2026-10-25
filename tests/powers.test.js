import test from 'node:test';
import assert from 'node:assert/strict';
import {RoomManager} from '../server/rooms.mjs';
import {ABILITIES,randomAbility,randomLoadout,POWER_RULES,POWER_COOLDOWN_MS,PICKUP_COOLDOWN_MS,
  usePower,nearbyPickup,takePickup,currentEffects,powerSelf,stealthContacts} from '../server/powers.mjs';
import {contactsFor} from '../server/radar.mjs';
import {WORLD,terrainY} from '../shared/world.js';
import {shoot} from '../server/combat.mjs';
const fakeSocket=()=>({readyState:1,messages:[],send(raw){this.messages.push(JSON.parse(raw));}});
const last=(s,t)=>s.messages.findLast(m=>m.type===t);
function session(n=3){const mgr=new RoomManager(),socks=Array.from({length:n},fakeSocket);
  mgr.handle(socks[0],{type:'create',capacity:n,name:'Player0'});
  const code=last(socks[0],'joined').room.code;
  for(let i=1;i<n;i++)mgr.handle(socks[i],{type:'join',code,name:`Player${i}`});
  mgr.handle(socks[0],{type:'start'});
  const room=mgr.rooms.get(code);
  return {mgr,socks,room,players:[...room.players.values()]};}
function grant(p,key){if(!p.loadout.includes(key))p.loadout[0]=key;p.powerReadyAt=0;}

test('balanced six-skill runner loadouts have two intel, three attacks and one self; hunter has none',()=>{
  assert.ok(ABILITIES.length>=15);assert.ok(!ABILITIES.includes('swap'));
  const deck=randomLoadout();assert.equal(new Set(deck).size,6);
  assert.equal(randomAbility(['see'],()=>0),'stealth');
  assert.throws(()=>randomAbility(null,()=>999),/Invalid/);
  for(let round=0;round<5;round++){
    const {players,socks}=session(4);
    for(const [i,p] of players.entries()){
      assert.equal(p.loadout.length,p.role==='hunter'?0:6);
      assert.equal(new Set(p.loadout).size,p.loadout.length);
      assert.ok(!p.loadout.includes('swap'));
      assert.deepEqual(last(socks[i],'started').power.abilities,p.loadout);
      assert.ok(last(socks[i],'started').players.every(q=>!('loadout' in q)));
      if(p.role==='runner'){
        const counts={intel:0,attack:0,self:0};
        for(const skill of p.loadout)counts[POWER_RULES[skill].category]++;
        assert.deepEqual(counts,{intel:2,attack:3,self:1});
      }
    }
  }
});
test('costs and durations mirror the skill menu; each successful cast enforces one global 20s cooldown',()=>{
  assert.deepEqual([POWER_RULES.see.cost,POWER_RULES.stealth.cost,POWER_RULES.zone.cost],[20,60,150]);
  assert.equal(POWER_RULES.ice,undefined);assert.equal(POWER_RULES.reverse,undefined);
  assert.equal(POWER_RULES.freeze.durationMs,20000);assert.equal(POWER_RULES.gravity.durationMs,20000);
  assert.equal(POWER_RULES.scramble.durationMs,30000);assert.equal(POWER_RULES.invisible.durationMs,20000);
  assert.ok(!POWER_RULES.grow&&!POWER_RULES.shrink);
  const {room,players}=session(3),[a,b]=players.filter(p=>p.role==='runner'),now=Date.now();
  grant(a,'slow');const result=usePower(room,a,'slow',b.id,now);
  assert.equal(result.ok,true);assert.equal(result.cost,40);assert.equal(a.coins,260);
  assert.equal(b.slowUntil,now+8000);assert.equal(a.powerReadyAt,now+POWER_COOLDOWN_MS);
  grant(a,'boost');a.powerReadyAt=now+POWER_COOLDOWN_MS;
  assert.match(usePower(room,a,'boost',null,now+50).error,/recharging/);
  assert.equal(a.coins,260);
  assert.equal(currentEffects(b,now+8000).slow,false);
});
test('spoofed skills, invalid targets, insufficient coins and forged tracking requests are rejected',()=>{
  const {room,players,mgr,socks}=session(2),a=players.find(p=>p.role==='runner'),b=players.find(p=>p.id!==a.id),now=Date.now();
  const notGranted=ABILITIES.find(k=>!a.loadout.includes(k));
  assert.equal(usePower(room,a,notGranted,b.id,now).ok,false);
  grant(a,'freeze');
  for(const id of [a.id,'not-real',null])assert.equal(usePower(room,a,'freeze',id,now).ok,false);
  a.coins=50;assert.equal(usePower(room,a,'freeze',b.id,now).ok,false);
  assert.equal(a.coins,50);assert.equal(a.powerReadyAt,0);
  mgr.handle(socks[0],{type:'reveal',targetId:b.id});
  assert.match(last(socks[0],'error').message,/assigned/i);
});
test('one-way Secret Sight is private and costs 60; Player Ping costs 20 and is reciprocal',()=>{
  const {room,players}=session(3),a=players.find(p=>p.role==='runner'),b=players.find(p=>p.id!==a.id),c=players.find(p=>p.id!==a.id&&p.id!==b.id),now=Date.now();
  grant(a,'stealth');const result=usePower(room,a,'stealth',b.id,now);
  assert.equal(result.ok,true);assert.equal(a.coins,240);
  assert.equal(stealthContacts(room,a,now)[0].id,b.id);
  assert.deepEqual(stealthContacts(room,b,now),[]);assert.deepEqual(stealthContacts(room,c,now),[]);
  grant(a,'see');const then=now+POWER_COOLDOWN_MS;a.powerReadyAt=0;
  assert.equal(usePower(room,a,'see',b.id,then).ok,true);
  assert.equal(a.coins,220);assert.equal(contactsFor(room,b,then).length,1);
  assert.equal(contactsFor(room,c,then).length,0);
});
test('attacks affect runners but never the hunter, and removed Rune Cage is rejected',()=>{
  const {mgr,room,players}=session(3);
  const [a,b]=players.filter(p=>p.role==='runner'),hunter=players.find(p=>p.role==='hunter'),now=Date.now();
  grant(a,'slow');assert.equal(usePower(room,a,'slow',b.id,now).ok,true);
  b.x=0;b.z=0;b.lastInputAt=Date.now();b.input={dx:1,dz:0,sprint:false,jump:false,climb:false};
  mgr.stepPlayer(b,.05,now+100);
  assert.ok(b.x>0&&b.x<.1,'slow should reduce travel to 10%');
  a.powerReadyAt=0;grant(a,'freeze');assert.equal(usePower(room,a,'freeze',b.id,now).ok,true);
  assert.equal(b.freezeUntil,now+20000);
  const x=b.x,z=b.z;mgr.stepPlayer(b,.05,now+300);assert.equal(b.x,x);assert.equal(b.z,z);
  a.powerReadyAt=0;grant(a,'freeze');assert.equal(usePower(room,a,'trap',b.id,now).ok,false);
  assert.equal(usePower(room,a,'ice',b.id,now).ok,false);
  assert.equal(usePower(room,a,'reverse',b.id,now).ok,false);
  assert.equal(usePower(room,a,'freeze',hunter.id,now).ok,false);
});
test('door zone hint stays private, disappears after duration, and does not work for hunters',()=>{
  const {room,players}=session(2),runner=players.find(p=>p.role==='runner'),hunter=players.find(p=>p.role==='hunter');const now=Date.now();
  assert.ok(!POWER_RULES.warm&&!POWER_RULES.compass);
  grant(runner,'zone');runner.powerReadyAt=0;
  assert.equal(usePower(room,runner,'zone',null,now).ok,true);
  assert.match(powerSelf(runner,now,room).hints.zone,/REGION/);
  grant(hunter,'zone');assert.equal(usePower(room,hunter,'zone',null,now).ok,false);
});
test('server restricts custom Set Speed values and applies chosen multiplier to player movement',()=>{
 const {room,mgr,players}=session(3),[a,b]=players.filter(p=>p.role==='runner'),now=Date.now();grant(a,'setSpeed');
 assert.equal(usePower(room,a,'setSpeed',b.id,now,'basic',99).ok,false);
 assert.equal(a.coins,300);
 assert.equal(usePower(room,a,'setSpeed',b.id,now,'basic',.25).ok,true);
 assert.equal(currentEffects(b,now+100).speedScale,.25);
 b.x=0;b.z=0;b.lastInputAt=Date.now();b.input={dx:1,dz:0,sprint:false,jump:false,climb:false};
 mgr.stepPlayer(b,.1,now+100);
 assert.ok(b.x>0&&b.x<.3);
 assert.equal(currentEffects(b,now+10000).speedScale,1);
});
test('time rewind requires 5 seconds of real server history and returns an authoritative warp',()=>{
  const {room,players}=session(2),a=players.find(p=>p.role==='runner'),now=Date.now();grant(a,'rewind');
  a.history=[{at:now-3000,x:0,y:0,z:0}];assert.equal(usePower(room,a,'rewind',null,now).ok,false);
  const destination={at:now-5500,x:12,y:terrainY(12,13),z:13};
  a.history.unshift(destination);a.x=65;a.z=65;
  const result=usePower(room,a,'rewind',null,now);
  assert.equal(result.ok,true);assert.equal(a.x,12);assert.equal(a.z,13);
  assert.deepEqual(result.warps[0],{id:a.id,x:12,y:terrainY(12,13),z:13});
  assert.equal(a.history.length,1);
});
test('Swap can ONLY be collected on the map as a seventh extra slot, and costs 120',()=>{
  const {room,players}=session(3),[a,b]=players.filter(p=>p.role==='runner'),now=Date.now(),site=WORLD.powerSites[0];
  assert.equal(usePower(room,a,'swap',b.id,now).ok,false);
  a.x=0;a.z=0;assert.equal(takePickup(room,a,now).ok,false);
  a.x=site.x;a.z=site.z;b.x=site.x+12;b.z=site.z+14;
  assert.equal(takePickup(room,a,now).ok,true);assert.equal(a.swapCharges,1);
  assert.equal(takePickup(room,a,now).ok,false);
  assert.equal(nearbyPickup(room,a,now+100).ready,false);
  const oldA={x:a.x,z:a.z},oldB={x:b.x,z:b.z};a.powerReadyAt=0;
  const used=usePower(room,a,'swap',b.id,now+200);
  assert.equal(used.ok,true);assert.equal(used.cost,120);assert.equal(a.coins,180);
  assert.equal(a.x,oldB.x);assert.equal(a.z,oldB.z);assert.equal(b.x,oldA.x);assert.equal(b.z,oldA.z);
  assert.equal(a.swapCharges,0);assert.equal(usePower(room,a,'swap',b.id,now+300).ok,false);
  assert.equal(nearbyPickup(room,b,now+PICKUP_COOLDOWN_MS)?.ready,true,'crystal respawns after its global cooldown');
});
test('bribe protects runners from hunter projectiles, and stealth hides a player outside spectator mode',()=>{
  const {mgr,room,players,socks}=session(2),hunter=players.find(p=>p.role==='hunter'),runner=players.find(p=>p.role==='runner');
  const now=Date.now();grant(runner,'bribe');runner.powerReadyAt=0;
  assert.equal(usePower(room,runner,'bribe',null,now).ok,true);
  hunter.x=0;hunter.z=0;hunter.y=terrainY(0,0);runner.x=0;runner.z=-10;runner.y=terrainY(0,-10);
  const shot=shoot(room,hunter,{aimX:0,aimZ:-1},now+100);
  assert.equal(shot.hitId,null);
  runner.invisibleUntil=Date.now()+10000;
  mgr.snapshotRoom(room);
  const hunterIndex=players.indexOf(hunter);
  assert.equal(last(socks[hunterIndex],'snapshot').players.some(p=>p.id===runner.id),false);
  hunter.downUntil=Date.now()+5000;
  mgr.snapshotRoom(room);
  assert.equal(last(socks[hunterIndex],'snapshot').spectating,true);
  assert.equal(last(socks[hunterIndex],'snapshot').players.some(p=>p.id===runner.id),true);
});
test('rematch resets coins, effects, pickup charges, and draws balanced six-slot loadouts',()=>{
  const {mgr,room,players,socks}=session(2);const a=players[0];
  a.coins=123;a.swapCharges=1;a.freezeUntil=Date.now()+40000;
  room.powerPickups.set(1,Date.now()+30000);
  mgr.endRound(room,{reason:'abandoned'});mgr.handle(socks[0],{type:'start'});
  assert.equal(room.powerPickups.size,0);
  assert.ok(players.every(p=>p.coins===300&&p.swapCharges===0&&p.freezeUntil===0));
  assert.ok(players.every(p=>p.loadout.length===(p.role==='hunter'?0:6)));
});

test('gravity lifts victims for 20s and chaos controls scramble for 30s',()=>{
 const {room,mgr,players}=session(3),[a,b]=players.filter(p=>p.role==='runner'),now=Date.now();
 grant(a,'gravity');assert.equal(usePower(room,a,'gravity',b.id,now).ok,true);
 assert.equal(b.gravityUntil,now+20000);
 b.x=10;b.z=10;b.y=terrainY(10,10);b.grounded=true;b.vy=0;
 mgr.stepPlayer(b,.04,now+200,room);assert.ok(b.y>terrainY(10,10));
 a.powerReadyAt=0;grant(a,'scramble');assert.equal(usePower(room,a,'scramble',b.id,now).ok,true);
 assert.equal(b.scrambleUntil,now+30000);assert.ok(currentEffects(b,now).scramble);
 assert.equal(currentEffects(b,now+30000).scramble,null);
});
