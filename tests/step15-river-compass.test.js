import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {RoomManager} from '../server/rooms.mjs';
import {CONTROL} from '../shared/controls.js';
import {riverX,controllerPositionAllowed,WORLD} from '../shared/world.js';
import {ROUND_SECONDS,PORTAL_SITES} from '../server/round.mjs';
import {POWER_RULES,randomLoadout} from '../server/powers.mjs';

const fake=()=>({readyState:1,messages:[],send(data){this.messages.push(JSON.parse(data));}});
const last=(s,type)=>s.messages.findLast(m=>m.type===type);
function session(){
 const mgr=new RoomManager(),a=fake(),b=fake();
 mgr.make(a,{capacity:2,name:'One'});const code=last(a,'joined').room.code;
 mgr.join(b,{code,name:'Two'});mgr.start(a);
 const room=mgr.rooms.get(code),runner=[...room.players.values()].find(p=>p.role==='runner');
 return {mgr,room,runner};
}
test('Step 15 walking and sprinting speeds are shared by client and server',()=>{
 assert.equal(CONTROL.WALK_SPEED,7.5);
 assert.equal(CONTROL.RUN_SPEED,14);
 assert.ok(CONTROL.RUN_SPEED>CONTROL.WALK_SPEED);
});
test('runner can walk entirely across the river without a bridge; trees and walls remain solid',()=>{
 const z=55,cx=riverX(z);
 for(let x=cx-14;x<=cx+14;x+=.7)assert.equal(controllerPositionAllowed(x,z),true,`river point ${x}`);
 const {mgr,runner,room}=session();
 runner.x=cx-14;runner.z=z;runner.y=0;runner.grounded=true;
 runner.input={dx:1,dz:0,sprint:true,jump:false,climb:false};runner.lastInputAt=Date.now();
 for(let i=0;i<70;i++)mgr.stepPlayer(runner,1/30,Date.now(),room);
 assert.ok(runner.x>cx+9,`the runner must cross both river banks, x=${runner.x}`);
 assert.equal(controllerPositionAllowed(231,50),false,'outer wall is still solid');
 const tree=WORLD.trees[0];assert.equal(controllerPositionAllowed(tree.x,tree.z),false,'tree remains solid');
 mgr.close();
});
test('Shattered Compass is guaranteed but stays vague and its hunter reveal cost is described',()=>{
 assert.equal(randomLoadout()[0],'shattered');
 assert.equal(POWER_RULES.shattered.cost,75);
 assert.equal(POWER_RULES.shattered.durationMs,20000);
 assert.ok(POWER_RULES.shattered.description.includes('hunter'));
 assert.equal(ROUND_SECONDS,480);
 assert.ok(PORTAL_SITES.every(p=>!WORLD.ponds.some(q=>Math.hypot(p.x-q.x,p.z-q.z)<q.r+4)));
});
test('real round tutorial, direct compass button, minimap guidance, and no decorative crystal rings',()=>{
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 const main=readFileSync(new URL('../client/main.js',import.meta.url),'utf8');
 const ui=readFileSync(new URL('../client/power-ui.js',import.meta.url),'utf8');
 const match=readFileSync(new URL('../client/match-ui.js',import.meta.url),'utf8');
 const renderer=readFileSync(new URL('../client/renderer.js',import.meta.url),'utf8');
 for(const id of ['compassAction','compassBars','compassArrow','compassRoute','roundInstructions','roundSkillGuide','roundNotifications__none']){
   if(id==='roundNotifications__none')continue;
   assert.ok(html.includes(`id="${id}"`),`missing ${id}`);
 }
 assert.ok(main.includes("k==='g'"));
 assert.ok(main.includes('powerUI.getCompassGuide()'));
 assert.ok(match.includes("$('roleIntro').hidden=false"));
 assert.ok(ui.includes('function castCompass()'));
 assert.ok(!renderer.includes('Faint enchanted stones are environmental landmarks'));
});
