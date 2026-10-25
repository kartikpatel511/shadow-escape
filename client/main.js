// Step 14 client: responsive movement, portal victory, hunter scope and magical audio.
// Room state and movement authority remain on the Node server.
import {WorldRenderer} from './renderer.js';
import {CONTROL,remapControls,steerVehicle,wrapAngle} from '../shared/controls.js';
import {GRAPHICS_PRESETS,chooseGraphicsMode} from './graphics-config.js';
import {GameConnection} from './network.js';
import {createLobby} from './lobby.js';
import {createMatchUI} from './match-ui.js';
import {createRadarUI} from './radar-ui.js';
import {createPowerUI} from './power-ui.js';
import {createCombatUI} from './combat-ui.js';
import {createAudio} from './audio.js';
import {WORLD, HALF, riverX, terrainY, insideBuilding, inWater, GRAVITY, PLAYER_RADIUS,controllerPositionAllowed} from '../shared/world.js';
const $ = id => document.getElementById(id);
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const TAU=Math.PI*2;
const keys=new Set();
const canvas=$('world');
const audio=createAudio();
let portalWasNear=false;
const graphicsPicker=$('graphicsQuality');
let graphicsMode=chooseGraphicsMode({getItem:key=>{try{return localStorage.getItem(key);}catch{return null;}}});
let renderer;
try{renderer=new WorldRenderer(canvas,graphicsMode);}catch(e){$('error').hidden=false;$('error').textContent='3D graphics unavailable: '+e.message;throw e;}
graphicsPicker.value=graphicsMode;
graphicsPicker.addEventListener('change',()=>{
 graphicsMode=graphicsPicker.value;
 renderer.setQuality(graphicsMode);
 try{localStorage.setItem('shadow-escape-graphics',graphicsMode);}catch{}
 $('graphicsHint').textContent=`${GRAPHICS_PRESETS[graphicsMode].label} MODE ACTIVE`;
});
$('graphicsHint').textContent=`${GRAPHICS_PRESETS[graphicsMode].label} MODE ACTIVE`;
const character={id:'explorer-01',name:'Wanderer',x:0,y:terrainY(0,52),z:52,vx:0,vy:0,vz:0,angle:Math.PI,grounded:true,role:'runner',moving:false,skin:0,down:false};
let spectateId=null,spectateFirstPerson=false,secretPortal=null,gravityBursts=[];
// Camera/movement tunables live in CONTROL (shared/controls.js).
let playing=false,yaw=CONTROL.INITIAL_YAW,pitch=CONTROL.INITIAL_PITCH,distance=CONTROL.INITIAL_DIST;
let overview=false,theta=CONTROL.OVERVIEW_THETA,phi=CONTROL.OVERVIEW_PHI,radius=CONTROL.OVERVIEW_RADIUS;
let cameraPos=[0,12,65],cameraTarget=[0,6,0];
let vehicle={x:0,z:46,yaw:0,v:0,driverId:null},driving=false;
const remotePlayers=new Map(), remoteTargets=new Map();
const visibleNames=new Map();
let savedSession=null;
try{savedSession=JSON.parse(sessionStorage.getItem('shadow-escape-session')||'null');}catch{}
let net, lobby, match, radarUI, powerUI, combatUI, playerId=null, resumeToken=null, reconnecting=false, latestSnapshotSeq=0, inputSeq=0, lastInputSent=0;
let connectionWasRestored=false;
function saveResumeSession(){
  if(!resumeToken||!lobby.room)return;
  try{sessionStorage.setItem('shadow-escape-session',JSON.stringify({code:lobby.room.code,resumeToken}));}catch{}
}
function clearResumeSession(){try{sessionStorage.removeItem('shadow-escape-session');}catch{}}

let drag=false, pointer=null, frames=0, displayedFPS=0, countFrames=0, lastFPS=performance.now(), last=performance.now();
let currentArea='CENTRAL VALLEY', lastNotice=0, previousArea='', nextMap=0;
function resetRoom(){
 playing=false;playerId=null;resumeToken=null;reconnecting=false;portalWasNear=false;clearResumeSession();spectateId=null;secretPortal=null;gravityBursts=[];driving=false;overview=false;vehicle={x:0,z:46,yaw:0,v:0,driverId:null};document.body.classList.remove('skills-minimized');remotePlayers.clear();remoteTargets.clear();
 for(const tag of visibleNames.values())tag.remove();visibleNames.clear();
 lobby.reset();match.reset();radarUI.reset();powerUI.reset();combatUI.reset();keys.clear();
}
function onServerMessage(m){
 switch(m.type){
  case 'hello':break;
  case 'joined':$('networkIndicator').hidden=true;playerId=m.selfId;resumeToken=m.resumeToken||null;lobby.setRoom(m.room,m.selfId);saveResumeSession();notice(`ROOM ${m.room.code} • SHARE THIS CODE WITH FRIENDS`);break;
  case 'room':lobby.setRoom(m.room,playerId);break;
  case 'resumed':{
    $('networkIndicator').hidden=true;reconnecting=false;savedSession=null;playerId=m.selfId;resumeToken=m.resumeToken;lobby.setRoom(m.room,playerId);saveResumeSession();
    if(m.room.phase==='exploring'){
      // A reconnect must NEVER reopen the blocking round-introduction modal.
      onServerMessage({...m,type:'started',resumeExisting:true});
      $('roleIntro').hidden=true;
      notice('CONNECTION RESTORED · BACK IN THE SAME MATCH');
    }else if(m.room.phase==='finished'){
      lobby.setRoom(m.room,playerId);
      notice('RECONNECTED · ROUND HAS FINISHED');
    }else lobby.setRoom(m.room,playerId);
    break;
  }
  case 'started':{
    lobby.setRoom(m.room,playerId);
    const local=m.players.find(p=>p.id===playerId);if(local){Object.assign(character,local,{vx:0,vy:0,vz:0,grounded:true});cameraTarget=[character.x,character.y+1.5,character.z];}
    portalWasNear=false;
    yaw=CONTROL.INITIAL_YAW;pitch=CONTROL.INITIAL_PITCH;distance=CONTROL.INITIAL_DIST;overview=false;driving=false;vehicle={...(m.vehicle||vehicle)};secretPortal=m.portal||null;gravityBursts=[];syncCameraButtons();
    remotePlayers.clear();remoteTargets.clear();latestSnapshotSeq=0;inputSeq=0;
    for(const p of m.players){if(p.id!==playerId && Number.isFinite(p.x) && Number.isFinite(p.z)){remoteTargets.set(p.id,p);remotePlayers.set(p.id,{...p});}}
    playing=true;spectateId=null;setSpectator(null);lobby.started();match.start(m,playerId);radarUI.start(m,playerId);powerUI.start(m,playerId);combatUI.start(m,playerId);
    if(m.resumeExisting)$('roleIntro').hidden=true;
    notice(character.role==='hunter'?'YOU ARE THE HUNTER • DEFEND THE WALL':'YOU ARE A RUNNER • FIND THE SECRET GATE');break;
  }
  case 'snapshot':{
    if(!playing||m.seq<=latestSnapshotSeq)break;latestSnapshotSeq=m.seq;
    secretPortal=m.portal||null;match.snapshot(m.exitSignal??null,m.roundRemainingMs,m.portal);
    if(m.exitSignal&&!portalWasNear){audio.sound(622);portalWasNear=true;}
    if(!m.exitSignal)portalWasNear=false;radarUI.snapshot(m.radar);powerUI.snapshot(m);combatUI.snapshot(m);
    if(m.vehicle){vehicle={...m.vehicle};driving=vehicle.driverId===playerId;}syncCameraButtons();
    const active=new Set();
    for(const p of m.players){
      if(p.id===playerId){
        character.down=!!p.down;character.shielded=!!p.shielded;character.effects=p.effects||{};character.driving=!!p.driving;
        if(p.effects?.frozen){character.moving=false;character.vx=character.vz=character.vy=0;}
        const drift=Math.hypot(character.x-p.x,character.y-p.y,character.z-p.z);
        if(p.effects?.frozen||p.effects?.zeroGravity||p.driving||drift>3.2){character.x=p.x;character.y=p.y;character.z=p.z;character.vy=0;}
        else if(drift>.20){character.x+=(p.x-character.x)*.23;character.y+=(p.y-character.y)*.20;character.z+=(p.z-character.z)*.23;}
      }else{
        active.add(p.id);remoteTargets.set(p.id,p);
        if(!remotePlayers.has(p.id))remotePlayers.set(p.id,{...p});
      }
    }
    for(const id of remotePlayers.keys()){if(!active.has(id)){remotePlayers.delete(id);remoteTargets.delete(id);const tag=visibleNames.get(id);tag?.remove();visibleNames.delete(id);}}
    if(combatUI.down){const available=[...remotePlayers.values()].filter(p=>!p.down);
      if(!available.some(p=>p.id===spectateId))setSpectator(available[0]?.id||null);
      updateSpectatorTitle();}
    break;
  }
  case 'left':{radarUI.playerLeft(m.id);powerUI.playerLeft(m.id);remotePlayers.delete(m.id);remoteTargets.delete(m.id);visibleNames.get(m.id)?.remove();visibleNames.delete(m.id);notice('A PLAYER LEFT THE ROOM');break;}
  case 'leftRoom':resetRoom();notice('LEFT MULTIPLAYER ROOM');break;
  case 'ended':playing=false;lobby.setRoom(m.room,playerId);match.end(m,playerId);radarUI.end();powerUI.end();combatUI.end();keys.clear();audio.sound(m.winnerId===playerId?880:440);break;
  case 'radarReceipt':radarUI.purchaseResult(m);break;
  case 'radarAlert':radarUI.alert(m);break;
  case 'compassAlert':notice(`⟡ ${m.runnerName.toUpperCase()} BROKE THE COMPASS · TRACK THEM ON YOUR MAP`);break;
  case 'vehicleAction':driving=!!m.driving;if(m.vehicle)vehicle={...m.vehicle};if(!driving&&Number.isFinite(m.x)){Object.assign(character,{x:m.x,y:m.y,z:m.z,vy:0});}syncCameraButtons();break;
  case 'powerResult':powerUI.result(m);if(m.warp){Object.assign(character,m.warp,{vy:0,grounded:true});cameraTarget=[character.x,character.y+2.25,character.z];}break;
  case 'powerHit':powerUI.hit(m);character.effects=m.effects||powerUI.getEffects();
    if(m.ability==='freeze'){if(vehicle.driverId===playerId)vehicle.driverId=null;driving=false;character.driving=false;
      character.vx=character.vz=character.vy=0;character.moving=false;
      if(m.position){character.x=m.position.x;character.y=m.position.y;character.z=m.position.z;}
      keys.delete('w');keys.delete('a');keys.delete('s');keys.delete('d');stick.x=stick.y=0;}break;
  case 'effectExpired':powerUI.effectExpired(m.effect);character.effects=powerUI.getEffects();break;
  case 'powerPickup':powerUI.picked(m);break;
  case 'gravityToss':{
    gravityBursts.push({from:m.from,to:m.to,at:performance.now()});
    if(gravityBursts.length>10)gravityBursts.shift();
    if(m.targetId===playerId){Object.assign(character,{x:m.to.x,y:m.to.y,z:m.to.z,vx:0,vz:0,vy:0});notice('✦ VOID TOSS! THE SKY HAS THROWN YOU SOMEWHERE ELSE');}
    break;
  }
  case 'gravityLanded':powerUI.land();Object.assign(character,{x:m.x,y:m.y,z:m.z,vx:0,vz:0,vy:0,grounded:true,effects:powerUI.getEffects()});notice('✦ GRAVITY RELEASED · BACK ON THE GROUND');break;
  case 'forcedWarp':Object.assign(character,{x:m.x,y:m.y,z:m.z,vy:0,grounded:true});cameraTarget=[m.x,m.y+2.25,m.z];break;
  case 'shot':combatUI.shot(m);break;
  case 'hitConfirmed':combatUI.hitConfirmed(m);audio.sound(510);break;
  case 'knockout':character.down=true;character.moving=false;combatUI.knockout(m);keys.clear();spectateId=null;break;
  case 'respawned':spectateId=null;setSpectator(null);remotePlayers.clear();remoteTargets.clear();character.down=false;character.shielded=true;Object.assign(character,{x:m.x,y:m.y,z:m.z,vy:0,vx:0,vz:0,grounded:true,moving:false});
    cameraTarget=[character.x,character.y+2.25,character.z];combatUI.respawned(m);keys.clear();break;
  case 'powerEvent':if(m.actorId!==playerId){notice(`${m.actorName.toUpperCase()} USED A SKILL`);}break;
  case 'error':if(m.message?.startsWith('Resume failed:')){$('networkIndicator').hidden=true;savedSession=null;resetRoom();}notice('⚠ '+m.message);$('lobbyError').textContent=m.message;break;
 }
}
lobby=createLobby(m=>net?.send(m),text=>notice(text));
match=createMatchUI(m=>net?.send(m));
radarUI=createRadarUI(m=>net?.send(m),message=>notice(message));
powerUI=createPowerUI(m=>net?.send(m),message=>notice(message));
combatUI=createCombatUI(m=>net?.send(m),message=>notice(message));
net=new GameConnection(onServerMessage,state=>{
 lobby.setOnline(state==='connected');
 if(state==='offline'){
   $('networkIndicator').hidden=false;
   const firstLoss=!reconnecting;
   reconnecting=!!resumeToken||!!savedSession;
   keys.clear();stick.x=stick.y=0;stick.run=false;
   if(firstLoss)notice('CONNECTION LOST · AUTO-RECONNECT IN PROGRESS · YOUR ROOM IS SAVED');
 }else if(state==='connected'){
   if(!resumeToken&&!savedSession)$('networkIndicator').hidden=true;
   const roomInfo=(resumeToken&&lobby.room)?{code:lobby.room.code,resumeToken}:savedSession;
   if(roomInfo&&(reconnecting||!playerId)){
     reconnecting=true;
     net.send({type:'resume',...roomInfo});
   }
 }
});
net.connect();
function notice(message){
 $('crossNotice').textContent=message;$('crossNotice').classList.add('visible');lastNotice=performance.now();
 // Stack readable gameplay events. Older ones fade out; no modal blocks controls.
 const feed=$('gameToasts');if(!feed)return;
 const item=document.createElement('div');item.className='game-toast';item.textContent=message;
 if(/⚠|FROZEN|USED ON YOU|REVEAL|HUNTER CAN TRACK|RECONNECT/.test(message))item.classList.add('is-warning');
 feed.prepend(item);while(feed.children.length>3)feed.lastElementChild.remove();
 setTimeout(()=>item.remove(),4400);
}
function setSpectator(id){spectateId=id;updateSpectatorTitle();}
function updateSpectatorTitle(){const target=remotePlayers.get(spectateId);
 $('spectateName').textContent=target?`${target.role==='hunter'?'☠ HUNTER':'✦ RUNNER'} · ${target.name}`:'WAITING FOR PLAYER…';
}
function cycleSpectator(delta){const candidates=[...remotePlayers.values()].filter(p=>!p.down);
 if(!candidates.length)return setSpectator(null);
 const i=candidates.findIndex(p=>p.id===spectateId);
 setSpectator(candidates[(i+delta+candidates.length)%candidates.length].id);
}
function toggleSpectatorView(){spectateFirstPerson=!spectateFirstPerson;
 $('spectateView').textContent=spectateFirstPerson?'FPP':'TPP';}
$('spectatePrev').addEventListener('click',()=>cycleSpectator(-1));
$('spectateNext').addEventListener('click',()=>cycleSpectator(1));
$('spectateView').addEventListener('click',toggleSpectatorView);
function syncCameraButtons(){
  $('cameraMode').textContent=overview?'◉ OVERVIEW [ O ]':distance<1?'◉ FIRST PERSON [ V ]':'◉ THIRD PERSON [ V ]';
  $('overviewButton').textContent=overview?'WALK MODE [ O ]':'OVERVIEW [ O ]';
  $('vehicleButton').textContent=driving?'EXIT CAR [ E ]':'ENTER CAR [ E ]';
  const near=Math.hypot(character.x-vehicle.x,character.z-vehicle.z)<=CONTROL.VEHICLE_ENTER_RANGE;
  $('vehicleButton').disabled=!playing||combatUI.down||(!driving&&(!near||!!vehicle.driverId));
}
function togglePerspective(){if(overview)overview=false;distance=distance<1?CONTROL.TP_DIST:CONTROL.FP_DIST;syncCameraButtons();}
function toggleOverview(){overview=!overview;syncCameraButtons();}
function toggleVehicle(){if(!playing||combatUI.down)return;net.send({type:'vehicle'});}
$('cameraMode').addEventListener('click',togglePerspective);
$('overviewButton').addEventListener('click',toggleOverview);
$('vehicleButton').addEventListener('click',toggleVehicle);
$('toggleHud').addEventListener('click',()=>{document.body.classList.toggle('skills-minimized');
 $('toggleHud').querySelector('span').textContent=document.body.classList.contains('skills-minimized')?'▴':'▾';});
function showArea(x,z){
 if(Math.abs(x)>HALF-27||Math.abs(z)>HALF-27)return 'ANCIENT PERIMETER';
 if(Math.abs(x-riverX(z))<20)return 'RIVER CROSSING';
 if(Math.abs(x)<45&&Math.abs(z)<55)return 'CLOCKTOWER SQUARE';
 if(x>90&&z>80)return 'EAST GARDEN QUARTER';
 if(x<-90&&z>60)return 'WESTERN GROVE';
 if(z<-125)return 'SOUTHERN VILLAGE';
 if(z>135)return 'NORTHERN PINES';
 if(x>100)return 'RIVERSIDE DISTRICT';
 return 'WHISPERWOOD VALLEY';
}
function rawControls(){
 const right=Number(keys.has('d'))-Number(keys.has('a'))+stick.x;
 const forward=Number(keys.has('w')||keys.has('arrowup'))-Number(keys.has('s')||keys.has('arrowdown'))-stick.y;
 const len=Math.max(1,Math.hypot(right,forward));return {right:right/len,forward:forward/len};
}
function inputVector(){
 const c=rawControls(),jump=keys.has(' ')||keys.has('jump');
 const mapped=remapControls(c.right,c.forward,jump,yaw,powerUI.getEffects().scramble);
 return {x:mapped.dx,z:mapped.dz,active:Math.hypot(mapped.dx,mapped.dz)>.01,jump:mapped.jump};
}
function simulate(dt,now){
 if(!playing||combatUI.down||overview||reconnecting)return;
 if(keys.has('arrowleft'))yaw+=dt*CONTROL.TURN_SPEED;
 if(keys.has('arrowright'))yaw-=dt*CONTROL.TURN_SPEED;
 if(driving){
  // Predict immediately; the server still decides the real car position.
  const raw=rawControls();steerVehicle(vehicle,raw.forward,-raw.right,dt,(x,z)=>controllerPositionAllowed(x,z,2.0));
  character.x=vehicle.x;character.z=vehicle.z;character.y=terrainY(character.x,character.z);
  character.angle=vehicle.yaw;character.moving=Math.abs(vehicle.v)>.05;
  character.vx=character.vz=character.vy=0;character.driving=true;
  yaw+=wrapAngle(vehicle.yaw-yaw)*Math.min(1,dt*CONTROL.VEHICLE_YAW_CHASE);
  distance=Math.max(distance,CONTROL.VEHICLE_MIN_CAMERA_DIST);
  return;
 }
 const move=inputVector(),effects=powerUI.getEffects();character.driving=false;
 let speed=keys.has('shift')||stick.run?CONTROL.RUN_SPEED:CONTROL.WALK_SPEED;
 if(effects.slow)speed*=.1;if(effects.speedScale)speed*=effects.speedScale;if(effects.boost)speed*=1.7;
 if(inWater(character.x,character.z)||WORLD.ponds.some(q=>Math.hypot(q.x-character.x,q.z-character.z)<q.r))speed*=.85;
 if(effects.frozen||effects.zeroGravity){
  character.vx=character.vz=character.vy=0;character.moving=false;character.effects=effects;return;
 }
 const floatAngle=Date.now()*.002+playerId.length*1.7;
 const vx=effects.zeroGravity?Math.cos(floatAngle)*2.4+move.x*speed*.12:move.x*speed;
 const vz=effects.zeroGravity?Math.sin(floatAngle)*2.4+move.z*speed*.12:move.z*speed;
 character.vx=vx;character.vz=vz;
 const nx=character.x+vx*dt,nz=character.z+vz*dt;
 // Independently resolve X/Z, allowing natural sliding along trees/buildings.
 if(controllerPositionAllowed(nx,character.z))character.x=nx;
 if(controllerPositionAllowed(character.x,nz))character.z=nz;
 const near=insideBuilding(character.x,character.z,2.9);
 const climbing=keys.has('c')&&near&&character.y<near.h+.45;
 if(climbing){character.vy=7.1;character.grounded=false;}
 else if(move.jump&&character.grounded){character.vy=11;character.grounded=false;}
 else if(effects.zeroGravity){character.vy=0;character.grounded=false;}
 else if(!character.grounded)character.vy-=GRAVITY*dt;
 const floor=terrainY(character.x,character.z);
 if(effects.zeroGravity){const sky=terrainY(character.x,character.z)+11;
   character.y+=(sky+Math.sin(Date.now()*.004)*.7-character.y)*Math.min(1,dt*3.4);
   character.vy=0;character.grounded=false;
 }else character.y+=character.vy*dt;
 // Never sink underground. For normal steps ease to terrain over 12/s.
 if(!effects.zeroGravity&&(character.grounded||character.y<=floor)){ character.y+=(floor-character.y)*Math.min(1,dt*CONTROL.GROUND_LERP);character.vy=0;character.grounded=true;}
 else if(!effects.zeroGravity&&Math.abs(character.y-floor)<.12&&character.vy<=0){character.y=floor;character.vy=0;character.grounded=true;}
 character.y=clamp(character.y,-1,50);
 character.moving=Math.hypot(vx,vz)>.05;
 if(character.moving)character.angle=Math.atan2(vx,vz);
 character.bob=character.moving?Math.abs(Math.sin(now*.009))*0.07:0;
 character.effects=effects;
 currentArea=showArea(character.x,character.z);$('area').textContent=currentArea;
 if(currentArea!==previousArea){previousArea=currentArea;notice('✧  '+currentArea+'  ✧');}
}
window.addEventListener('keydown',e=>{if(!playing||['INPUT','SELECT','TEXTAREA'].includes(document.activeElement?.tagName))return;const k=e.key.toLowerCase(); // Beginning to move closes the tutorial, especially important for the hunter.
 if(!$('roleIntro').hidden){
   if(['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright',' ','shift'].includes(k))$('roleIntro').hidden=true;
   else return;
 }
 if([' ','arrowup','arrowdown','arrowleft','arrowright'].includes(k))e.preventDefault();
 if(k==='enter'&&document.activeElement?.id==='leaveGame')e.preventDefault();if(k==='f'&&!e.repeat&&match.active)match.requestEscape();
 if(['1','2','3','4','5','6','7'].includes(k)&&!e.repeat)powerUI.selectSlot(Number(k)-1);
 if(k==='q'&&!e.repeat&&!combatUI.down)powerUI.cast();
 if(k==='g'&&!e.repeat&&!combatUI.down)powerUI.castCompass();
 if(k==='['&&!e.repeat&&combatUI.down)cycleSpectator(-1);
 if(k===']'&&!e.repeat&&combatUI.down)cycleSpectator(1);
 if(k==='v'&&!e.repeat&&combatUI.down)toggleSpectatorView();
 if(k==='r'&&!e.repeat&&!combatUI.down)powerUI.collect();
 if(k==='h'&&!e.repeat)combatUI.fire(window.shadowAim?.());
 if(k==='b'&&!e.repeat&&combatUI.hunter)combatUI.toggleScope();
 if(k==='v'&&!e.repeat&&!combatUI.down)togglePerspective();
 if(k==='o'&&!e.repeat)toggleOverview();
 if(k==='e'&&!e.repeat)toggleVehicle();
 if(combatUI.down)return;keys.add(k);});
window.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));
window.shadowAim=()=>({x:Math.sin(yaw),z:Math.cos(yaw)});
// Click-to-fire is preserved for the hunter; dragging does not fire.
let shotPointer=null;
canvas.addEventListener('pointerdown',e=>{
 if(e.button===2&&combatUI.hunter&&!overview){combatUI.toggleScope();return;}
 if(e.pointerType!=='touch'&&e.button===0)shotPointer={id:e.pointerId,x:e.clientX,y:e.clientY,at:performance.now()};
});
canvas.addEventListener('pointerup',e=>{if(!shotPointer||e.pointerId!==shotPointer.id)return;
 const distance=Math.hypot(e.clientX-shotPointer.x,e.clientY-shotPointer.y);
 if(distance<8&&performance.now()-shotPointer.at<320&&!overview)combatUI.fire(window.shadowAim?.());
 shotPointer=null;
});
window.addEventListener('blur',()=>{keys.clear();stick.x=stick.y=0;stick.run=false;});
canvas.addEventListener('contextmenu',e=>e.preventDefault());
// Separate pointer tracking permits simultaneous left joystick and right look.
const stick={x:0,y:0,run:false};let stickPointer=null,lookPointer=null;
const joystick=$('movePad'),joystickKnob=$('moveKnob');
const hideJoystick=()=>{stickPointer=null;stick.x=stick.y=0;stick.run=false;joystick.hidden=true;};
canvas.addEventListener('pointerdown',e=>{
 if(e.pointerType==='touch'&&e.clientX<innerWidth*.45&&!overview&&!combatUI.down&&playing&&stickPointer===null){
  stickPointer=e.pointerId;joystick.hidden=false;
  joystick.style.left=`${e.clientX}px`;joystick.style.top=`${e.clientY}px`;
  joystick.dataset.cx=e.clientX;joystick.dataset.cy=e.clientY;
 }else if(lookPointer===null){lookPointer=e.pointerId;pointer=[e.clientX,e.clientY];}
 canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove',e=>{
 if(e.pointerId===stickPointer){
  const dx=e.clientX-Number(joystick.dataset.cx),dy=e.clientY-Number(joystick.dataset.cy);
  const mag=Math.hypot(dx,dy),f=Math.min(1,CONTROL.JOYSTICK_MAX/Math.max(1,mag));
  stick.x=dx*f/CONTROL.JOYSTICK_MAX;stick.y=dy*f/CONTROL.JOYSTICK_MAX;
  stick.run=Math.min(1,mag/CONTROL.JOYSTICK_MAX)>CONTROL.JOYSTICK_RUN_AT;
  joystickKnob.style.transform=`translate(calc(-50% + ${dx*f}px),calc(-50% + ${dy*f}px))`;
 }else if(e.pointerId===lookPointer&&pointer){
  const dx=e.clientX-pointer[0],dy=e.clientY-pointer[1];
  if(overview){theta-=dx*CONTROL.OVERVIEW_LOOK_X;phi=clamp(phi-dy*CONTROL.OVERVIEW_LOOK_Y,CONTROL.OVERVIEW_MIN_PHI,CONTROL.OVERVIEW_MAX_PHI);}
  else {yaw-=dx*CONTROL.LOOK_X;pitch=clamp(pitch+dy*CONTROL.LOOK_Y,CONTROL.PIT_MIN,CONTROL.PIT_MAX);}
  pointer=[e.clientX,e.clientY];
 }
});
const pointerEnd=e=>{if(e.pointerId===stickPointer)hideJoystick();if(e.pointerId===lookPointer){lookPointer=null;pointer=null;}};
canvas.addEventListener('pointerup',pointerEnd);canvas.addEventListener('pointercancel',pointerEnd);
canvas.addEventListener('wheel',e=>{
 e.preventDefault();
 if(overview)radius=clamp(radius*(1+e.deltaY*.001),CONTROL.OVERVIEW_MIN_RADIUS,CONTROL.OVERVIEW_MAX_RADIUS);
 else distance=clamp(distance*(1+e.deltaY*.001),CONTROL.MIN_DIST,CONTROL.MAX_DIST);
 syncCameraButtons();
},{passive:false});
// Retain touch action buttons; the large virtual joystick appears where the
// left thumb touches the screen instead of occupying a fixed control location.
$('touchFire').addEventListener('click',()=>combatUI.fire(window.shadowAim?.()));
for(const [id,key]of [['touchJump','jump'],['touchClimb','c'],['touchSprint','shift']]){
 const el=$(id);el.addEventListener('pointerdown',e=>{e.preventDefault();keys.add(key);});
 el.addEventListener('pointerup',()=>keys.delete(key));el.addEventListener('pointercancel',()=>keys.delete(key));
}
// The minimap draws only server-authorized location contacts, never unpurchased positions.
const minimap=$('minimap'),ctx=minimap.getContext('2d');const backdrop=document.createElement('canvas');backdrop.width=256;backdrop.height=256;
const b=backdrop.getContext('2d');const mapPoint=(x,z)=>[128+x*(235/(HALF*2)),128+z*(235/(HALF*2))];
function paintBase(){const gradient=b.createLinearGradient(0,0,256,256);gradient.addColorStop(0,'#446e60');gradient.addColorStop(1,'#254e55');b.fillStyle=gradient;b.fillRect(0,0,256,256);
 b.strokeStyle='#b4d5b819';b.lineWidth=.65;for(let x=0;x<256;x+=15){b.beginPath();b.moveTo(x,0);b.lineTo(x,256);b.moveTo(0,x);b.lineTo(256,x);b.stroke();}
 const drawPath=(start,end,color,width)=>{b.beginPath();b.moveTo(...mapPoint(...start));b.lineTo(...mapPoint(...end));b.strokeStyle=color;b.lineWidth=width;b.stroke();};
 for(const x of [-105,0,154])drawPath([x,-HALF],[x,HALF],'#b7bba8',7);
 for(const z of [-106,0,114])drawPath([-HALF,z],[HALF,z],'#b7bba8',7);
 for(const x of [-105,0,154])drawPath([x,-HALF],[x,HALF],'#455358',5);
 for(const z of [-106,0,114])drawPath([-HALF,z],[HALF,z],'#455358',5);
 b.beginPath();for(let z=-HALF;z<=HALF;z+=2){const p=mapPoint(riverX(z),z);if(z===-HALF)b.moveTo(...p);else b.lineTo(...p);}b.strokeStyle='#4daab0';b.lineWidth=11;b.stroke();
 for(const z of WORLD.bridges){const x=riverX(z);drawPath([x-21,z],[x+21,z],'#f3c98c',5);}
 for(const p of WORLD.ponds){let [x,z]=mapPoint(p.x,p.z);b.beginPath();b.ellipse(x,z,p.r*.54,p.r*.54,0,0,TAU);b.fillStyle='#5ab3b4';b.fill();}
 for(const t of WORLD.trees){const [x,z]=mapPoint(t.x,t.z);b.fillStyle=t.kind==='birch'?'#81b78e':'#184d44';b.beginPath();b.arc(x,z,t.r*.44+.6,0,TAU);b.fill();}
 for(const q of WORLD.buildings){let [x,z]=mapPoint(q.x,q.z);b.fillStyle=q.type==='clock'?'#f3daae':'#bdd0b5';b.fillRect(x-q.w*.25,z-q.d*.25,q.w*.5,q.d*.5);}
 b.strokeStyle='#f0ddb2';b.lineWidth=3;b.strokeRect(6,6,244,244);
 b.fillStyle='#f9e6b4';b.font='900 10px sans-serif';b.textAlign='center';b.fillText('N',128,14);
}
paintBase();
function paintRadar(){
 ctx.clearRect(0,0,256,256);ctx.save();ctx.beginPath();ctx.arc(128,128,124,0,TAU);ctx.clip();
 ctx.translate(128,128);ctx.rotate(Math.PI+yaw);const [mx,mz]=mapPoint(character.x,character.z);ctx.translate(-mx,-mz);ctx.drawImage(backdrop,0,0);
 const exit=match.signal; if(exit){const [ex,ez]=mapPoint(exit.x,exit.z);ctx.strokeStyle='#fcffb8';ctx.lineWidth=2;ctx.beginPath();ctx.arc(ex,ez,6+Math.sin(performance.now()*.009)*1.6,0,TAU);ctx.stroke();ctx.fillStyle='#fff6bd';ctx.font='bold 13px sans-serif';ctx.textAlign='center';ctx.fillText('✦',ex,ez+4);}
 // Reciprocal bought signals: coordinates are supplied privately by the server.
 const blips=radarUI.getContacts();
 for(const contact of blips){
  const [px,pz]=mapPoint(contact.x,contact.z);
  const hunter=contact.role==='hunter';const tint=hunter?'#ff838c':'#ffd999';
  ctx.strokeStyle=hunter?'#ff596b66':'#ffe4a955';ctx.lineWidth=1;
  ctx.setLineDash([2,6]);ctx.beginPath();ctx.moveTo(...mapPoint(character.x,character.z));ctx.lineTo(px,pz);ctx.stroke();ctx.setLineDash([]);
  const pulse=7+Math.sin(performance.now()*.01)*2;
  ctx.fillStyle=hunter?'#ff66742c':'#ffdb8824';ctx.beginPath();ctx.arc(px,pz,pulse+3,0,TAU);ctx.fill();
  ctx.strokeStyle=tint;ctx.lineWidth=1.8;ctx.beginPath();ctx.arc(px,pz,pulse,0,TAU);ctx.stroke();
  ctx.fillStyle=tint; ctx.beginPath();ctx.arc(px,pz,2.4,0,TAU);ctx.fill();
  if(contact.source==='shattered'){ctx.font='bold 12px sans-serif';ctx.fillStyle='#dfb1ff';ctx.fillText('⟡',px+12,pz+3);}
  if(contact.source==='stealth'){ctx.font='bold 12px sans-serif';ctx.fillStyle='#b4fff4';ctx.fillText('◉',px+11,pz+3);}
  ctx.fillStyle='#071b25';ctx.strokeStyle=tint;ctx.lineWidth=2;ctx.font='bold 9px sans-serif';
  ctx.textAlign='center';const tag=(hunter?'☠ ':'')+contact.name.slice(0,10);
  ctx.strokeText(tag,px,pz-13);ctx.fillStyle=tint;ctx.fillText(tag,px,pz-13);
 }
 ctx.restore();
 // Shattered Compass draws only a fuzzy direction ray relative to camera yaw.
 // It never puts the actual secret portal position onto the minimap.
 const guide=powerUI.getCompassGuide();
 if(guide){
  const angle=guide.sector*Math.PI/4;
  const x=128+Math.sin(angle)*68,y=128-Math.cos(angle)*68;
  ctx.save();ctx.strokeStyle=guide.strength==='STRONG'?'#91f5ff':'#d4aaff';
  ctx.lineWidth=4;ctx.setLineDash([10,7]);ctx.shadowColor='#ad9aff';ctx.shadowBlur=12;
  ctx.beginPath();ctx.moveTo(128,128);ctx.lineTo(x,y);ctx.stroke();
  ctx.setLineDash([]);ctx.fillStyle='#ffe8ac';ctx.beginPath();ctx.arc(x,y,6,0,TAU);ctx.fill();ctx.restore();
 }
 // Fixed yellow direction arrow always points upward in screen coordinates.
 ctx.fillStyle='#ffdf69';ctx.strokeStyle='#142d38';ctx.lineWidth=2;
 ctx.beginPath();ctx.moveTo(128,116);ctx.lineTo(120,140);ctx.lineTo(128,135);ctx.lineTo(136,140);ctx.closePath();ctx.fill();ctx.stroke();
 $('coords').textContent=`X ${Math.round(character.x)} · Z ${Math.round(character.z)}`;
}
function paintNames(){
 const vp=renderer.vp;if(!vp)return;
 for(const [id,p] of remotePlayers){
  let tag=visibleNames.get(id);
  if(!tag){tag=document.createElement('div');tag.className='name-tag';tag.textContent=p.name;$('nameTags').append(tag);visibleNames.set(id,tag);}
  tag.classList.toggle('hunter-tag',p.role==='hunter');tag.classList.toggle('magic-hit',!!p.effects?.frozen||!!p.effects?.zeroGravity);tag.textContent=p.effects?.frozen?'❄ FROZEN · '+p.name:p.effects?.zeroGravity?'✦ FLOATING · '+p.name:p.role==='hunter'?'☠ '+p.name:p.name;
  const x=p.x,y=p.y+(p.role==='hunter'?5.9:3.4),z=p.z;
  const clipX=vp[0]*x+vp[4]*y+vp[8]*z+vp[12],clipY=vp[1]*x+vp[5]*y+vp[9]*z+vp[13],clipW=vp[3]*x+vp[7]*y+vp[11]*z+vp[15];
  const near=Math.hypot(character.x-p.x,character.z-p.z)<(p.effects?.frozen||p.effects?.zeroGravity?170:66);
  tag.style.display=clipW>.1&&near&&Math.abs(clipX/clipW)<1&&Math.abs(clipY/clipW)<1?'block':'none';
  if(tag.style.display!=='none'){tag.style.left=`${(clipX/clipW*.5+.5)*innerWidth}px`;tag.style.top=`${(-clipY/clipW*.5+.5)*innerHeight}px`;}
 }
}
function frame(now){requestAnimationFrame(frame);const dt=Math.min(CONTROL.MAX_DT,(now-last)/1000);last=now;
 if(playing)character.effects=powerUI.getEffects();
 simulate(dt,now);match.update(now);radarUI.update();powerUI.setYaw(yaw);powerUI.update();combatUI.update();frames++;
 if(playing&&now-lastInputSent>50){
  lastInputSent=now;const direction=inputVector(),raw=rawControls();
  if(!combatUI.down&&!overview)net.send({type:'input',seq:++inputSeq,localRight:$('roleIntro').hidden?raw.right:0,localForward:$('roleIntro').hidden?raw.forward:0,yaw,sprint:$('roleIntro').hidden&&(keys.has('shift')||stick.run),jump:$('roleIntro').hidden&&(keys.has(' ')||keys.has('jump')),climb:$('roleIntro').hidden&&keys.has('c')});
 }
 // Smoothly approach server snapshots for remote avatars.
 for(const [id,p] of remotePlayers){const target=remoteTargets.get(id);if(!target)continue;
  const s=1-Math.exp(-13*dt);
  // A frozen target must not look like they keep gliding on the attacker's screen.
  if(target.effects?.frozen){p.x=target.x;p.y=target.y;p.z=target.z;p.vx=p.vz=0;}
  else {p.x+=(target.x-p.x)*s;p.y+=(target.y-p.y)*s;p.z+=(target.z-p.z)*s;}
  p.angle=target.angle;p.moving=target.effects?.frozen?false:target.moving;p.skin=target.skin;p.name=target.name;p.role=target.role;p.effects=target.effects;p.down=target.down;p.shielded=target.shielded;
 }

 // First/third-person chase camera and an independent orbit overview camera.
 const observed=playing&&combatUI.down?remotePlayers.get(spectateId):null;
 const focus=observed||character;
 let goal,lookGoal,k=Math.min(1,dt*CONTROL.CAMERA_LERP);
 if(overview){
  goal=[radius*Math.sin(phi)*Math.sin(theta),radius*Math.cos(phi)+4,radius*Math.sin(phi)*Math.cos(theta)];
  lookGoal=[0,6,0];
 }else{
  const a=observed?(observed.angle||0):yaw;
  const scoped=combatUI.scope&&combatUI.hunter&&!overview&&!observed;
  const d=observed?(spectateFirstPerson?CONTROL.FP_DIST:CONTROL.TP_DIST):scoped?CONTROL.HUNTER_SCOPE_DIST:distance;
  const fX=Math.sin(a),fZ=Math.cos(a),eye=focus.y+CONTROL.CAMERA_EYE,c=Math.cos(pitch);
  if(d<1){goal=[focus.x,eye,focus.z];lookGoal=[focus.x+fX*c*5,eye-Math.sin(pitch)*5,focus.z+fZ*c*5];k=1;}
  else if(scoped){
   // Right-shoulder hunter optic: the monster remains visible on the left,
   // the centre reticle follows the same forward bearing used by the server.
   const rightX=-Math.cos(a),rightZ=Math.sin(a);
   const cx=focus.x-fX*d*c+rightX*CONTROL.HUNTER_SCOPE_RIGHT;
   const cz=focus.z-fZ*d*c+rightZ*CONTROL.HUNTER_SCOPE_RIGHT;
   goal=[cx,Math.max(eye+CONTROL.HUNTER_SCOPE_ELEVATION,terrainY(cx,cz)+.8),cz];
   lookGoal=[cx+fX*c*35,goal[1]-Math.sin(pitch)*35,cz+fZ*c*35];
  }else {const cx=focus.x-fX*d*c,cz=focus.z-fZ*d*c;
   goal=[cx,Math.max(eye+Math.sin(pitch)*d,terrainY(cx,cz)+.8),cz];
   lookGoal=[focus.x,focus.y+1.5,focus.z];}
 }
 for(let i=0;i<3;i++){cameraPos[i]+=(goal[i]-cameraPos[i])*k;cameraTarget[i]+=(lookGoal[i]-cameraTarget[i])*k;}
 renderer.cam=[...cameraPos];renderer.target=[...cameraTarget];renderer.yaw=yaw;renderer.pitch=pitch;renderer.scopeZoom=combatUI.hunter&&combatUI.scope&&!overview;
 $('hunterReticle').hidden=!(playing&&combatUI.hunter&&!overview);
 // Hide local character when the camera is in first person or when driving.
 const visible=[...remotePlayers.values()];
 if(!playing||(!driving&&(overview||combatUI.scope||(distance>1.5))))visible.unshift(character);
 gravityBursts=gravityBursts.filter(b=>now-b.at<1150);
 renderer.render(now*.001,visible,{portal:secretPortal,gravityBursts,shots:combatUI.shots,bonks:combatUI.bonks,vehicle});
 if(frames%10===0)syncCameraButtons();
 if(playing&&frames%3===0)paintNames();
 if(now>nextMap){paintRadar();nextMap=now+105;}
 if(now-lastFPS>1000){displayedFPS=Math.round(frames*1000/(now-lastFPS));$('fps').textContent=`WEBGL2 · ${displayedFPS} FPS · ${GRAPHICS_PRESETS[graphicsMode].label}`;lastFPS=now;frames=0;}
 if(lastNotice&&now-lastNotice>3200){$('crossNotice').classList.remove('visible');lastNotice=0;}
}
requestAnimationFrame(frame);
