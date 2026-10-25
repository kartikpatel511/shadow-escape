import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {POWER_RULES} from '../shared/skills.js';
import {ABILITIES,randomLoadout,usePower,currentEffects} from '../server/powers.mjs';
import {RoomManager} from '../server/rooms.mjs';

const fakeSocket=()=>({readyState:1,messages:[],send(x){this.messages.push(JSON.parse(x));}});
function session(){
 const manager=new RoomManager(),sockets=[fakeSocket(),fakeSocket(),fakeSocket()];
 manager.make(sockets[0],{name:'Host',capacity:3});
 const room=[...manager.rooms.values()][0];
 manager.join(sockets[1],{name:'Second',code:room.code});manager.join(sockets[2],{name:'Third',code:room.code});
 manager.start(sockets[0]);
 return {manager,room,runners:[...room.players.values()].filter(p=>p.role==='runner')};
}
test('Step 18 power balance and retired skills are server-authoritative',()=>{
 assert.deepEqual([POWER_RULES.freeze.durationMs,POWER_RULES.gravity.durationMs,POWER_RULES.scramble.durationMs,POWER_RULES.invisible.durationMs],[20000,20000,30000,20000]);
 assert.equal(POWER_RULES.slow.durationMs,8000);
 assert.ok(!('ice' in POWER_RULES)&&!('reverse' in POWER_RULES));
 assert.ok(!ABILITIES.includes('ice')&&!ABILITIES.includes('reverse'));
 for(let i=0;i<100;i++){
  const deck=randomLoadout();assert.equal(deck.length,6);
  assert.ok(!deck.includes('ice')&&!deck.includes('reverse'));
  assert.ok(deck.includes('shattered'));
 }
 const {manager,room,runners:[a,b]}=session();a.loadout=['freeze','gravity','slow','scramble','invisible','shattered'];a.powerReadyAt=0;
 assert.equal(usePower(room,a,'ice',b.id).ok,false);
 assert.equal(usePower(room,a,'reverse',b.id).ok,false);
 assert.equal(usePower(room,a,'freeze',b.id).durationMs,20000);
 manager.close();
});
test('Step 18 slow reduces authoritative walking speed to 10% and expires normally',()=>{
 const {manager,room,runners:[a,b]}=session(),now=Date.now();
 a.loadout=['slow'];a.powerReadyAt=0;
 b.x=0;b.z=0;b.y=0;b.grounded=true;b.input={dx:1,dz:0,sprint:false,jump:false,climb:false};b.lastInputAt=now;
 const result=usePower(room,a,'slow',b.id,now);assert.equal(result.ok,true);
 manager.stepPlayer(b,.05,now+100,room);
 assert.ok(b.x>0&&b.x<.07,`slow moved ${b.x} m; expected <= 10%`);
 assert.equal(currentEffects(b,now+8000).slow,false);
 manager.close();
});
test('cinematic home page is rebranded while original avatars stay and player model scales shrink',()=>{
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 const css=readFileSync(new URL('../client/style.css',import.meta.url),'utf8');
 const renderer=readFileSync(new URL('../client/renderer.js',import.meta.url),'utf8');
 const lobby=readFileSync(new URL('../client/lobby.js',import.meta.url),'utf8');
 assert.match(html,/<title>RIFTBOUND — Escape the Veil<\/title>/);
 assert.match(html,/RIFT<span>BOUND<\/span>/);
 assert.match(html,/lobby-pills/);
 assert.match(css,/lobby-scene-note/);
 assert.match(renderer,/scale=hunter\?1\.12:\.80/);
 assert.equal((lobby.match(/'#(?:[0-9a-f]{6})'/g)||[]).length>=9,true);
});
