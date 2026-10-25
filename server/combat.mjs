// Step 06 — authoritative, arcade-style hunter combat.
// A browser may request a firing direction, but cannot choose hits, damage,
// target IDs, player positions, timers, or respawn destinations.
import {chooseSpawn, terrainY, WORLD} from '../shared/world.js';

export const COMBAT = Object.freeze({range:72, cooldownMs:850, knockoutMs:30_000,
  respawnShieldMs:3000, targetRadius:1.65, maxAimLength:1.15});
const norm2=(x,z)=>Math.hypot(x,z);
export const isDown=(p,now=Date.now())=>Number.isFinite(p?.downUntil)&&p.downUntil>now;
export const isShielded=(p,now=Date.now())=>Number.isFinite(p?.shieldUntil)&&p.shieldUntil>now;

// Ray / axis-aligned house collision; includes rooftop height and prevents
// shots through buildings while allowing legitimate shots above short roofs.
export function occluded(sx,sy,sz,ex,ey,ez){
  const dx=ex-sx,dy=ey-sy,dz=ez-sz;
  for(const b of WORLD.buildings){
    const min=[b.x-b.w/2,0,b.z-b.d/2],max=[b.x+b.w/2,b.h+2.6,b.z+b.d/2];
    let t0=0.0001,t1=.9999;
    const start=[sx,sy,sz],dir=[dx,dy,dz];
    let intersects=true;
    for(let i=0;i<3;i++){
      if(Math.abs(dir[i])<1e-8){if(start[i]<=min[i]||start[i]>=max[i]){intersects=false;break;}continue;}
      const a=(min[i]-start[i])/dir[i],c=(max[i]-start[i])/dir[i];
      t0=Math.max(t0,Math.min(a,c));t1=Math.min(t1,Math.max(a,c));
      if(t0>=t1){intersects=false;break;}
    }
    if(intersects)return true;
  }
  return false;
}

export function shoot(room,hunter,data,now=Date.now()){
  if(room.phase!=='exploring')return {ok:false,error:'No active round.'};
  if(hunter?.role!=='hunter')return {ok:false,error:'Only the hunter can fire the blaster.'};
  if(isDown(hunter,now))return {ok:false,error:'You cannot fire while knocked out.'};
  if((hunter.nextShotAt||0)>now)return {ok:false,error:'Blaster recharging.',silent:true};
  let ax=Number(data.aimX),az=Number(data.aimZ);
  const magnitude=norm2(ax,az);
  if(!Number.isFinite(magnitude)||magnitude<.75||magnitude>COMBAT.maxAimLength)
    return {ok:false,error:'Invalid firing direction.'};
  ax/=magnitude;az/=magnitude;
  hunter.nextShotAt=now+COMBAT.cooldownMs;
  let best=null,near=COMBAT.range+1;
  for(const target of room.players.values()){
    if(target.role!=='runner'||isDown(target,now)||isShielded(target,now)||(target.bribeUntil||0)>now)continue;
    // Only authoritative server positions are used for hits.
    const dx=target.x-hunter.x,dz=target.z-hunter.z;
    const forward=dx*ax+dz*az,lateral=Math.abs(dx*az-dz*ax);
    if(forward<=0||forward>COMBAT.range||lateral>COMBAT.targetRadius||forward>=near)continue;
    const sx=hunter.x,sy=hunter.y+1.6,sz=hunter.z;
    const tx=target.x,ty=target.y+1.5,tz=target.z;
    if(occluded(sx,sy,sz,tx,ty,tz))continue;
    near=forward;best=target;
  }
  const origin={x:hunter.x,y:hunter.y+1.7,z:hunter.z};
  const end=best?{x:best.x,y:best.y+1.5,z:best.z}:{x:hunter.x+ax*COMBAT.range,y:hunter.y+1.6,z:hunter.z+az*COMBAT.range};
  if(best){
    best.downUntil=now+COMBAT.knockoutMs;
    best.shieldUntil=0;
    best.input={dx:0,dz:0,jump:false,climb:false,sprint:false};
    best.moving=false;best.vy=0;best.sliding=null;
    best.slowUntil=0;best.boostUntil=0;
    // Preserve ghost/radar ownership, but block newly cast abilities while down.
  }
  return {ok:true,shooterId:hunter.id,hitId:best?.id??null,origin,end,
    downUntil:best?.downUntil??null,cooldownMs:COMBAT.cooldownMs};
}

export function respawn(room,p,now=Date.now()){
  if(!Number.isFinite(p.downUntil)||p.downUntil===0||p.downUntil>now)return false;
  const hunter=[...room.players.values()].find(x=>x.role==='hunter');
  // Prefer an unobstructed spawn far from the hunter so respawning is fair.
  const order=(Number.parseInt(p.id.slice(1),10)||0)+Math.floor(now/30000);
  let spawn=null,furthest=-1;
  for(let k=0;k<11;k++){
    const candidate=chooseSpawn((order+k)%11);
    const d=hunter?Math.hypot(candidate.x-hunter.x,candidate.z-hunter.z):Infinity;
    if(d>furthest){spawn=candidate;furthest=d;}
    if(d>=95){spawn=candidate;break;}
  }
  p.x=spawn.x;p.z=spawn.z;p.y=terrainY(p.x,p.z);
  p.downUntil=0;p.shieldUntil=now+COMBAT.respawnShieldMs;
  p.vy=0;p.grounded=true;p.moving=false;p.angle=0;p.priorJump=false;
  p.input={dx:0,dz:0,sprint:false,climb:false,jump:false};
  p.lastInputAt=0;p.lastVelocityX=0;p.lastVelocityZ=0;p.sliding=null;
  p.slowUntil=0;p.boostUntil=0;
  p.history=[{at:now,x:p.x,y:p.y,z:p.z}];
  return true;
}
