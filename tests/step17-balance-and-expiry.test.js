import test from 'node:test';
import assert from 'node:assert/strict';
import {RoomManager} from '../server/rooms.mjs';
import {STARTING_COINS} from '../server/radar.mjs';
import {randomLoadout,ABILITIES,POWER_RULES,usePower,currentEffects} from '../server/powers.mjs';
import {predictedEffects} from '../client/power-ui.js';
import {terrainY} from '../shared/world.js';
const fakeSocket=()=>({readyState:1,messages:[],send(m){this.messages.push(JSON.parse(m));}});
function game(){const mgr=new RoomManager(),s=Array.from({length:3},fakeSocket);
 mgr.make(s[0],{name:'A',capacity:3});const room=[...mgr.rooms.values()][0];
 mgr.join(s[1],{name:'B',code:room.code});mgr.join(s[2],{name:'C',code:room.code});mgr.start(s[0]);
 const runners=[...room.players.values()].filter(p=>p.role==='runner');
 return {mgr,room,runners,s};}
function assign(p,key){p.loadout[0]=key;p.powerReadyAt=0;}

test('Rune Cage has been completely removed from available and assigned skills',()=>{
 assert.equal(POWER_RULES.trap,undefined);
 assert.ok(!ABILITIES.includes('trap'));
 for(let i=0;i<40;i++)assert.ok(!randomLoadout().includes('trap'));
});
test('a fresh match and a rematch give exactly 300 coins to every player',()=>{
 assert.equal(STARTING_COINS,300);
 const {mgr,room,s}=game();
 assert.ok([...room.players.values()].every(p=>p.coins===300));
 for(const p of room.players.values())p.coins=7;
 mgr.endRound(room,{reason:'timeout'});mgr.start(s[0]);
 assert.ok([...room.players.values()].every(p=>p.coins===300));
});
test('victim freeze lasts exactly twenty seconds; server releases movement and emits expiry',()=>{
 const {mgr,room,runners}=game(),[caster,victim]=runners,now=Date.now();
 assign(caster,'freeze');caster.coins=300;
 victim.x=0;victim.z=0;victim.y=terrainY(0,0);
 const cast=usePower(room,caster,'freeze',victim.id,now);
 assert.ok(cast.ok);assert.equal(cast.durationMs,20000);
 assert.equal(currentEffects(victim,now+500).freezeMs,19500);
 victim.input={dx:1,dz:0,jump:false,climb:false,sprint:false};victim.lastInputAt=now+19900;
 mgr.stepPlayer(victim,.05,now+19900,room);assert.equal(victim.x,0);
 victim.lastInputAt=now+20000;mgr.stepPlayer(victim,.05,now+20000,room);
 assert.equal(currentEffects(victim,now+20000).frozen,false);
 assert.ok(victim.x>0,'victim must move at the exact expiry');
 assert.ok(victim.socket.messages.some(m=>m.type==='effectExpired'&&m.effect==='freeze'));
});
test('gravity ends at 20 seconds, lands safely, and its short stun also expires',()=>{
 const {mgr,room,runners}=game(),[caster,victim]=runners,now=Date.now();
 assign(caster,'gravity');caster.coins=300;
 victim.x=0;victim.z=0;victim.y=terrainY(0,0);
 assert.equal(usePower(room,caster,'gravity',victim.id,now).durationMs,20000);
 mgr.stepPlayer(victim,.05,now+20001,room);
 assert.equal(victim.gravityUntil,0);
 assert.equal(victim.y,terrainY(victim.x,victim.z));
 assert.equal(currentEffects(victim,now+20001).frozen,true);
 victim.input={dx:1,dz:0,jump:false,climb:false,sprint:false};victim.lastInputAt=now+21202;
 const x=victim.x;mgr.stepPlayer(victim,.05,now+21202,room);
 assert.equal(currentEffects(victim,now+21202).frozen,false);
 assert.ok(victim.x>x);
});
test('client expires frozen and floating flags locally if snapshots are delayed',()=>{
 const incoming={frozen:true,freezeMs:20000,zeroGravity:true,gravityMs:20000,
   scramble:{up:'jump'},scrambleMs:30000};
 assert.equal(predictedEffects(incoming,19999).frozen,true);
 assert.equal(predictedEffects(incoming,20000).frozen,false);
 assert.equal(predictedEffects(incoming,20000).zeroGravity,false);
 assert.equal(predictedEffects(incoming,30000).scramble,null);
});
