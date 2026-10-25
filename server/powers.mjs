// Step 09: strategic six-skill runner loadouts, chaotic runner-vs-runner powers,
// and ground-only Swap pickups. The hunter/monster does not receive skills.
import {randomInt} from 'node:crypto';
import {WORLD,HALF,insideBuilding,terrainY,validPosition,chooseSpawn} from '../shared/world.js';
import {pairKey} from './radar.mjs';
import {POWER_RULES} from '../shared/skills.js';
export {POWER_RULES};

export const POWER_COOLDOWN_MS=20_000;
export const PICKUP_COOLDOWN_MS=60_000;
export const PICKUP_RADIUS=6;
export const LOADOUT_SIZE=6;
export const SWAP_COST=120;

export const ABILITIES=Object.freeze(Object.keys(POWER_RULES).filter(k=>k!=='swap'));
const INTEL_POOL=Object.freeze(['see','stealth','zone','shattered']);
const ATTACK_POOL=Object.freeze(['slow','setSpeed','gravity','freeze','scramble','teleport','yank']);
const SELF_POOL=Object.freeze(['bribe','boost','rewind','invisible']);
const CHAOS_MAPPINGS=Object.freeze([
  Object.freeze({up:'right',right:'down',down:'left',left:'up'}),
  Object.freeze({up:'left',left:'down',down:'right',right:'up'}),
  Object.freeze({up:'down',down:'up',left:'right',right:'left'}),
  Object.freeze({up:'jump',down:'left',left:'up',right:'down'}),
  Object.freeze({up:'right',down:'jump',left:'down',right:'left'}),
  Object.freeze({up:'left',down:'right',left:'jump',right:'up'})
]);

export function randomAbility(except=null,randomIndex=limit=>randomInt(limit)){
  const excluded=Array.isArray(except)?except:[except];
  const choices=ABILITIES.filter(k=>!excluded.includes(k));
  const idx=randomIndex(choices.length);
  if(!Number.isInteger(idx)||idx<0||idx>=choices.length)throw Error('Invalid ability selection');
  return choices[idx];
}
function pickFromPool(pool,result,roll){
  const excluded=[...result,...ABILITIES.filter(k=>!pool.includes(k))];
  const choice=roll(excluded);
  if(!pool.includes(choice)||result.includes(choice))throw Error('Invalid or repeated skill assignment');
  result.push(choice);
}
export function randomLoadout(roll=randomAbility,role='runner'){
  if(role==='hunter')return [];
  // Every runner can choose the risky compass; the other five skills are random.
  const result=['shattered'];
  pickFromPool(INTEL_POOL,result,roll);
  for(let i=0;i<3;i++)pickFromPool(ATTACK_POOL,result,roll);
  for(let i=0;i<1;i++)pickFromPool(SELF_POOL,result,roll);
  return result;
}
function randomChaosMap(index=randomInt(CHAOS_MAPPINGS.length)){return CHAOS_MAPPINGS[index];}
export function initPowers(room,now=Date.now(),roll=randomAbility){
  room.stealthReveals=new Map();room.compassExposures=new Map();room.powerPickups=new Map();room.reveals??=new Map();
  for(const p of room.players.values()){
    p.loadout=randomLoadout(roll,p.role);p.power=p.loadout[0]||null;p.powerReadyAt=now;p.swapCharges=0;
    p.slowUntil=0;p.boostUntil=0;p.freezeUntil=0;p.gravityUntil=0;
    p.invisibleUntil=0;p.bribeUntil=0;p.speedUntil=0;p.scrambleUntil=0;p.scrambleMap=null;
    p.zoneUntil=0;p.shatteredUntil=0;p.gravityHeight=0;p.gravityLastUntil=0;
    p.gravityStartAt=0;p.gravityNextTossAt=0;p.gravityTossCount=0;p.gravitySeed=0;
    p.history=[{at:now,x:p.x,y:p.y,z:p.z}];p.lastVelocityX=0;p.lastVelocityZ=0;
  }
}
export function currentEffects(p,now=Date.now()){
  // Every countdown comes from the SAME authoritative clock. The browser
  // extrapolates these remaining times between snapshots, never permanent booleans.
  const remaining=(key)=>Math.max(0,(p[key]||0)-now);
  return {slow:remaining('slowUntil')>0,slowMs:remaining('slowUntil'),
    boost:remaining('boostUntil')>0,boostMs:remaining('boostUntil'),
    frozen:remaining('freezeUntil')>0,freezeMs:remaining('freezeUntil'),
    zeroGravity:remaining('gravityUntil')>0,gravityMs:remaining('gravityUntil'),
    scramble:remaining('scrambleUntil')>0?(p.scrambleMap||CHAOS_MAPPINGS[0]):null,
    scrambleMs:remaining('scrambleUntil'),
    invisible:remaining('invisibleUntil')>0,invisibleMs:remaining('invisibleUntil'),
    bribed:remaining('bribeUntil')>0,bribeMs:remaining('bribeUntil'),
    speedScale:remaining('speedUntil')>0?(p.speedMultiplier||.5):1,
    speedMs:remaining('speedUntil')};
}
export function doorWall(exit){
  if(!exit)return null;
  if(Math.abs(exit.x)<70&&Math.abs(exit.z)<70)return 'CENTRAL REGION';
  const northSouth=exit.z>=0?'NORTH':'SOUTH';
  const eastWest=exit.x>=0?'EAST':'WEST';
  return `${northSouth}-${eastWest} REGION`;
}
export function powerSelf(p,now=Date.now(),room=null){
  
  // Direction only: quantized to eight rough sectors, no coordinate/distance leak.
  // Intensity communicates approach without giving exact meters.
  let shattered=null;
  if(p.shatteredUntil>now&&room?.secretExit){
    const dx=room.secretExit.x-p.x,dz=room.secretExit.z-p.z;
    const bearing=Math.atan2(dx,dz);
    const sector=((Math.round(bearing/(Math.PI/4))%8)+8)%8;
    const distance=Math.hypot(dx,dz);
    shattered={sector,strength:distance<55?'STRONG':distance<145?'GROWING':'FAINT',remainingMs:p.shatteredUntil-now};
  }
  const hints={zone:p.zoneUntil>now?doorWall(room?.secretExit):null,shattered};
  return {abilities:p.loadout||[],ability:p.loadout?.[0]||null,cooldownMs:Math.max(0,(p.powerReadyAt||0)-now),
    effects:currentEffects(p,now),swapCharges:p.swapCharges||0,coins:p.coins,hints};
}
export function stealthContacts(room,viewer,now=Date.now()){
  const contacts=[];
  for(const link of room.stealthReveals?.values()||[]){
    if(link.expiresAt<=now||link.viewerId!==viewer.id)continue;
    const target=room.players.get(link.targetId);
    if(target)contacts.push({id:target.id,name:target.name,role:target.role,x:target.x,z:target.z,remainingMs:link.expiresAt-now,source:'stealth'});
  }
  return contacts;
}
// The hunter sees precise live coordinates only while the runner is broadcasting
// their position through Shattered Compass. Other runners never receive them.
export function compassContacts(room,viewer,now=Date.now()){
  if(viewer.role!=='hunter')return [];
  const result=[];
  for(const [id,until] of room.compassExposures||[]){
    if(until<=now)continue;
    const runner=room.players.get(id);
    if(runner?.role==='runner')result.push({id:runner.id,name:runner.name,role:'runner',x:runner.x,z:runner.z,remainingMs:until-now,source:'shattered'});
  }
  return result;
}
export function expirePowers(room,now=Date.now()){ 
  for(const [key,link] of room.stealthReveals||[]){
    if(link.expiresAt<=now||!room.players.has(link.viewerId)||!room.players.has(link.targetId))room.stealthReveals.delete(key);
  }
  for(const [key,until] of room.powerPickups||[]){if(until<=now)room.powerPickups.delete(key);}
  for(const [id,until] of room.compassExposures||[]){if(until<=now||!room.players.has(id))room.compassExposures.delete(id);}
  for(const p of room.players.values()){if(p.history?.length>240)p.history.splice(0,p.history.length-240);}
}
const okTarget=(room,p,targetId,{runnersOnly=false}={})=>{
  if(typeof targetId!=='string'||targetId===p.id||!room.players.has(targetId))return false;
  const target=room.players.get(targetId);
  return !runnersOnly || target.role==='runner';
};
function validRewind(p,now){
  const cutoff=now-5000;const frame=[...(p.history||[])].reverse().find(f=>f.at<=cutoff);
  if(!frame)return null;
  const roof=insideBuilding(frame.x,frame.z,0);
  return Number.isFinite(frame.y)&&Math.abs(frame.x)<HALF-3&&Math.abs(frame.z)<HALF-3&&
    (validPosition(frame.x,frame.z)||!!roof&&frame.y>=roof.h-.4)?frame:null;
}
function warp(p,pos,now){
  p.x=pos.x;p.z=pos.z;p.y=pos.y??terrainY(pos.x,pos.z);p.vy=0;p.grounded=true;p.priorJump=false;
  p.lastVelocityX=0;p.lastVelocityZ=0;p.history=[{at:now,x:p.x,y:p.y,z:p.z}];
  return {id:p.id,x:p.x,y:p.y,z:p.z};
}
export function usePower(room,p,ability,targetId,now=Date.now(),tier='basic',speedValue=.5){
  if(room.phase!=='exploring')return {ok:false,error:'Skills only work during an active round.'};
  if(p.role==='hunter')return {ok:false,error:'The monster does not use player skills.'};
  if((p.downUntil||0)>now)return {ok:false,error:'Cannot use skills while knocked out.'};
  const config=POWER_RULES[ability];
  if(!config || (ability==='swap'?!(p.swapCharges>0):!p.loadout?.includes(ability)))return {ok:false,error:'This skill is not in your assigned chaos loadout.'};
  if((p.powerReadyAt||0)>now)return {ok:false,error:`Skills recharging: ${Math.ceil((p.powerReadyAt-now)/1000)}s.`};
  const runnersOnly=config.category==='attack'||ability==='swap';
  if(config.targeted&&!okTarget(room,p,targetId,{runnersOnly}))return {ok:false,error:runnersOnly?'Choose another runner as your target.':'Choose another player as your target.'};
  if(ability==='setSpeed'&&![.25,.5,1.5].includes(speedValue))return {ok:false,error:'Choose a valid target speed.'};
  if(config.category==='intel'&&p.role!=='runner'&&['zone'].includes(ability))return {ok:false,error:'Only runners can search for the door.'};
  if(ability==='bribe'&&p.role==='hunter')return {ok:false,error:'The hunter cannot bribe themselves.'};
  if(ability==='see'&&room.reveals.get(pairKey(p.id,targetId))?.expiresAt>now)return {ok:false,error:'Both players already have this reveal.'};
  const cost=config.cost,durationMs=config.durationMs;
  if(p.coins<cost)return {ok:false,error:`Not enough coins: ${config.label} costs ${cost}.`};
  const target=config.targeted?room.players.get(targetId):null;
  if(ability==='swap'&&target?.downUntil>now)return {ok:false,error:'Swap requires a standing player.'};
  const historical=ability==='rewind'?validRewind(p,now):null;
  if(ability==='rewind'&&!historical)return {ok:false,error:'Explore for five seconds before rewinding.'};
  const until=now+durationMs;
  // A moving car cannot bypass an attack: eject the target and keep the effect
  // controlled by the server for its full duration.
  if(target?.driving&&config.category==='attack'&&room.vehicle?.driverId===target.id){
    room.vehicle.driverId=null;room.vehicle.v=0;target.driving=false;
    target.x=room.vehicle.x;target.z=room.vehicle.z;target.y=terrainY(target.x,target.z);
  }
  const warps=[];
  switch(ability){
    case 'see':room.reveals.set(pairKey(p.id,targetId),{a:p.id,b:targetId,expiresAt:until});break;
    case 'stealth':room.stealthReveals.set(`${p.id}:${targetId}`,{viewerId:p.id,targetId,expiresAt:until});break;
    case 'zone':p.zoneUntil=until;break;
    case 'shattered':p.shatteredUntil=until;room.compassExposures.set(p.id,until);break;
    case 'slow':target.slowUntil=Math.max(target.slowUntil||0,until);break;
    case 'setSpeed':target.speedUntil=until;target.speedMultiplier=speedValue;break;
    case 'gravity':
      target.gravityUntil=Math.max(target.gravityUntil||0,until);
      target.gravityLastUntil=target.gravityUntil;
      target.gravityHeight=Math.min(28,Math.max(terrainY(target.x,target.z)+15,target.y+15));
      target.gravityStartAt=now;target.gravityNextTossAt=now+4500;target.gravityTossCount=0;target.gravitySeed=randomInt(1,1000000000);
      target.vy=0;target.grounded=false;
      // Levitation reveals the target visibly even if they were invisible.
      target.invisibleUntil=0;
      break;
    case 'freeze':target.freezeUntil=Math.max(target.freezeUntil||0,until);target.invisibleUntil=0;target.vy=0;target.lastVelocityX=0;target.lastVelocityZ=0;break;
    case 'scramble':target.scrambleUntil=Math.max(target.scrambleUntil||0,until);target.scrambleMap=randomChaosMap();break;
    case 'yank':{
      const frames=(target.history||[]).filter(f=>f.at<=now-4000&&f.at>=now-9000);
      if(!frames.length)return {ok:false,error:'Target must be moving for four seconds before Time Yank.'};
      const frame=frames[frames.length-1];
      warps.push(warp(target,frame,now));break;
    }
    case 'teleport':{
      const possible=[...room.players.values()].filter(q=>q.id!==p.id&&q.role==='runner'&&!(q.downUntil>now));
      if(!possible.length)return {ok:false,error:'No active rival to teleport.'};
      const victim=possible[randomInt(possible.length)];
      const spawn=chooseSpawn(randomInt(8));warps.push(warp(victim,spawn,now));targetId=victim.id;
      break;
    }
    case 'bribe':p.bribeUntil=until;break;
    case 'boost':p.boostUntil=until;break;
    case 'rewind':warps.push(warp(p,historical,now));break;
    case 'invisible':p.invisibleUntil=until;break;
    case 'swap':{
      const a={x:p.x,y:p.y,z:p.z},b={x:target.x,y:target.y,z:target.z};
      warps.push(warp(p,b,now),warp(target,a,now));p.swapCharges--;break;
    }
    default:return {ok:false,error:'Unsupported ability.'};
  }
  p.coins-=cost;p.powerReadyAt=now+POWER_COOLDOWN_MS;
  return {ok:true,ability,targetId:targetId||null,durationMs,cost,coins:p.coins,readyAt:p.powerReadyAt,warps};
}
export function nearbyPickup(room,p,now=Date.now()){
  if(room.phase!=='exploring'||p.role==='hunter')return null;
  let best=null,d=Infinity;
  for(const site of WORLD.powerSites){const distance=Math.hypot(p.x-site.x,p.z-site.z);
    if(distance<PICKUP_RADIUS&&distance<d){best=site;d=distance;}}
  return best?{id:best.id,ready:(room.powerPickups.get(best.id)||0)<=now,
    remainingMs:Math.max(0,(room.powerPickups.get(best.id)||0)-now)}:null;
}
export function takePickup(room,p,now=Date.now()){
  if(room.phase!=='exploring')return {ok:false,error:'Swap crystals exist only during a round.'};
  if(p.role==='hunter')return {ok:false,error:'The monster cannot carry Swap crystals.'};
  if((p.downUntil||0)>now)return {ok:false,error:'Cannot collect crystals while knocked out.'};
  if(p.swapCharges>0)return {ok:false,error:'You already carry a Swap crystal.'};
  const site=nearbyPickup(room,p,now);
  if(!site)return {ok:false,error:'Move closer to a glowing Swap crystal.'};
  if(!site.ready)return {ok:false,error:'This Swap crystal is recharging.'};
  p.swapCharges=1;room.powerPickups.set(site.id,now+PICKUP_COOLDOWN_MS);
  return {ok:true,ability:'swap',swapCharges:1,siteId:site.id};
}
