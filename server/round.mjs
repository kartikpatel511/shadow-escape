// Server-authoritative race to the time-travel portal.
// Each round rolls ONE secret portal location. It never moves during that round.
import {randomInt} from 'node:crypto';
import {GATES, HALF, PLAY_LIMIT, WORLD, inWater, terrainY, controllerPositionAllowed} from '../shared/world.js';

export const ROUND_SECONDS = 8*60;
export const EXIT_NOTICE_RADIUS = 36;
export const EXIT_USE_RADIUS = 7.5;
export const PORTAL_VISIBILITY_RADIUS = 130;

// The initial eight sites preserve the old perimeter landmarks. Additional
// validated clearings make the portal spawn *inside* the fantasy world too.
// Bring ancient boundary gates inside the actual playable realm; never put a
// portal inside the wall or beyond terrain the character can stand on.
const boundarySites=GATES.map((gate,index)=>({index,
  x:index===6?-128:index===7?114:Math.max(-187,Math.min(187,gate.x)),
  z:index===6?190:index===7?180:Math.max(-187,Math.min(187,gate.z)),yaw:gate.yaw}));
const clearingSites=[
  [0,157],[-194,60],[-111,13],[-182,104],[-55,188],[190,-54],
  [185,29],[189,182],[-7,-181],[40,108],[80,-98],[-122,194],
  [-45,109],[11,194],[-158,12],[132,66],[-10,116],[-99,72]
].map(([x,z],i)=>({index:GATES.length+i,x,z,yaw:i*Math.PI/4}));
export const PORTAL_SITES=Object.freeze([...boundarySites,...clearingSites]
  // Clearance around the entrance prevents blocking it with buildings/trees.
  .filter(p=>Math.abs(p.x)<=PLAY_LIMIT-14&&Math.abs(p.z)<=PLAY_LIMIT-14&&
    controllerPositionAllowed(p.x,p.z,5.0)&&!inWater(p.x,p.z)&&!WORLD.ponds.some(q=>Math.hypot(p.x-q.x,p.z-q.z)<q.r+4))
  .map((p)=>Object.freeze(p)));

export function selectSecretExit(randomIndex=limit=>randomInt(limit)){
  const selected=randomIndex(PORTAL_SITES.length);
  if(!Number.isInteger(selected)||selected<0||selected>=PORTAL_SITES.length)throw Error('Invalid gate index');
  const spot=PORTAL_SITES[selected];
  return {gateIndex:selected,x:spot.x,z:spot.z,y:terrainY(spot.x,spot.z),yaw:spot.yaw};
}
export function distanceToExit(player,exit){return Math.hypot(player.x-exit.x,player.z-exit.z);}
export function exitSignal(player,exit){
  if(!exit||player.role!=='runner')return null;
  const distance=distanceToExit(player,exit);
  return distance<=EXIT_NOTICE_RADIUS?{x:exit.x,z:exit.z,distance:Math.round(distance*10)/10}:null;
}
// Visual-world visibility only; never put this information in paid minimap data.
export function visiblePortal(player,exit){
  if(!exit||distanceToExit(player,exit)>PORTAL_VISIBILITY_RADIUS)return null;
  return {x:exit.x,y:exit.y,z:exit.z,yaw:exit.yaw};
}
export function canEscape(player,exit,now=Date.now()){
  if(!exit||player.role!=='runner'||(player.downUntil||0)>now||(player.freezeUntil||0)>now||player.gravityUntil>now||player.driving)return false;
  return distanceToExit(player,exit)<=EXIT_USE_RADIUS&&Math.abs(player.y-exit.y)<4.5;
}
