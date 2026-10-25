import test from 'node:test';
import assert from 'node:assert/strict';
import {RoomManager} from '../server/rooms.mjs';
import {STARTING_COINS,REVEAL_COST,REVEAL_DURATION_MS,contactsFor,pairKey,expireReveals} from '../server/radar.mjs';
import {usePower} from '../server/powers.mjs';
const sock=()=>({readyState:1,messages:[],send(raw){this.messages.push(JSON.parse(raw));}});
const last=(s,t)=>s.messages.findLast(m=>m.type===t);
const setup=(n=3)=>{const mgr=new RoomManager(),socks=Array.from({length:n},sock);
  mgr.handle(socks[0],{type:'create',capacity:n,name:'A'});const code=last(socks[0],'joined').room.code;
  for(let i=1;i<n;i++)mgr.handle(socks[i],{type:'join',code,name:`B${i}`});
  mgr.handle(socks[0],{type:'start'});const room=mgr.rooms.get(code);
  return {mgr,socks,room,players:[...room.players.values()]};};
const grant=(p,key)=>{p.loadout[0]=key;p.powerReadyAt=0;};
test('each player starts with 300 private coins, and ping is 20 coins for 10s',()=>{
 assert.equal(REVEAL_COST,20);assert.equal(REVEAL_DURATION_MS,10000);
 const {players,socks}=setup(4);
 for(let i=0;i<4;i++){assert.equal(players[i].coins,STARTING_COINS);
   assert.equal(last(socks[i],'started').coins,STARTING_COINS);
   assert.ok(last(socks[i],'started').players.filter(q=>q.id!==players[i].id).every(q=>q.coins===undefined));}
});
test('mutual ping is limited to skill owners and contacts update with real movement',()=>{
 const {room,mgr,socks,players}=setup(3),a=players.find(p=>p.role==='runner'),b=players.find(p=>p.id!==a.id),c=players.find(p=>p.id!==a.id&&p.id!==b.id),now=Date.now();grant(a,'see');
 a.x=0;a.z=0;b.x=159;b.z=147;c.x=-150;c.z=155;
 assert.equal(usePower(room,a,'see',b.id,now).ok,true);assert.equal(a.coins,280);
 assert.equal(b.coins,300);assert.equal(c.coins,300);
 mgr.snapshot();const snapA=last(socks[players.indexOf(a)],'snapshot'),snapB=last(socks[players.indexOf(b)],'snapshot'),snapC=last(socks[players.indexOf(c)],'snapshot');
 assert.equal(snapA.radar.contacts[0].x,159);assert.equal(snapB.radar.contacts[0].id,a.id);
 assert.deepEqual(snapC.radar.contacts,[]);
 b.x=155;mgr.snapshot();assert.equal(last(socks[players.indexOf(a)],'snapshot').radar.contacts[0].x,155);
});
test('cannot track twice during a paid reveal; expiry clears contacts and allows next purchase',()=>{
 const {room,players}=setup(2),a=players.find(p=>p.role==='runner'),b=players.find(p=>p.id!==a.id),now=Date.now();grant(a,'see');
 assert.equal(usePower(room,a,'see',b.id,now).ok,true);
 assert.equal(usePower(room,a,'see',b.id,now+1).ok,false);
 assert.equal(contactsFor(room,a,now+9999).length,1);
 assert.equal(contactsFor(room,a,now+10000).length,0);
 expireReveals(room,now+10000);assert.equal(room.reveals.size,0);
 a.powerReadyAt=0;
 assert.equal(usePower(room,a,'see',b.id,now+20001).ok,true);
 assert.equal(a.coins,260);
});
test('inactive rooms, self-ping, bad target, and insufficient coins never deduct money',()=>{
 const {room,players}=setup(2),a=players.find(p=>p.role==='runner'),b=players.find(p=>p.id!==a.id),now=Date.now();grant(a,'see');
 for(const target of [a.id,'nobody',null])assert.equal(usePower(room,a,'see',target,now).ok,false);
 a.coins=10;assert.equal(usePower(room,a,'see',b.id,now).ok,false);assert.equal(a.coins,10);
 room.phase='finished';assert.equal(usePower(room,a,'see',b.id,now).ok,false);
});
test('round end, rematch, and disconnect clean up paid radar contacts',()=>{
 const {room,mgr,players,socks}=setup(3),a=players.find(p=>p.role==='runner'),b=players.find(p=>p.id!==a.id);grant(a,'see');
 assert.equal(usePower(room,a,'see',b.id,Date.now()).ok,true);
 assert.equal(room.reveals.size,1);
 mgr.leave(socks[players.indexOf(b)]);assert.equal(room.reveals.size,0);
 mgr.endRound(room,{reason:'abandoned'});mgr.handle(room.players.get(room.hostId).socket,{type:'start'});
 assert.ok([...room.players.values()].every(p=>p.coins===300));
 assert.equal(room.reveals.size,0);
});
