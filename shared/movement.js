// Shared Step 10 walking/driving constants. Browser and multiplayer server use the SAME math.
import {HALF,WORLD,terrainY,inWater,insideBuilding,PLAYER_RADIUS} from './world.js';
export const WALK_SPEED=7.5;
export const RUN_SPEED=14;
export const TURN_SPEED=1.8;
export const LOOK_SENSITIVITY=.005;
export const PITCH_SENSITIVITY=.004;
export const CAMERA_SMOOTH=9;
export const CAMERA_EYE=1.65;
export const THIRD_PERSON_DIST=6;
export const FIRST_PERSON_DIST=.01;
export const WALK_PITCH=.35;
export const OVERVIEW_RADIUS=170;
export const OVERVIEW_THETA=.8;
export const OVERVIEW_PHI=1;
export const OVERVIEW_DRAG=.006;
export const OVERVIEW_PHI_DRAG=.005;
export const VEHICLE_ENTER_RADIUS=6;
export const VEHICLE_EXIT_OFFSET=2.8;
export const VEHICLE_ENGINE=20;
export const VEHICLE_REVERSE=8;
export const VEHICLE_RESPONSE=1.2;
export const VEHICLE_STEER=1.6;
export const MAX_DT=.05;
export const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const wrapAngle=a=>Math.atan2(Math.sin(a),Math.cos(a));
// Shallow streams and ponds are traversable. Preserve a positive playable
// height so the walking and vehicle paths share the exact same water rule.
export function playableHeight(x,z){return 1+terrainY(x,z);}

export function allowedPosition(x,z,height=0,includeCircles=true){
 if(!Number.isFinite(x)||!Number.isFinite(z)||Math.abs(x)>=HALF-3||Math.abs(z)>=HALF-3)return false;
 // Water is passable, so there is deliberately no dry-ground height check here.
 const b=insideBuilding(x,z,PLAYER_RADIUS);
 if(b&&height<b.h-.55)return false;
 if(includeCircles){
  // Natural circular colliders: trunks and rocks. They match existing world geometry.
  if(WORLD.trees.some(t=>Math.hypot(t.x-x,t.z-z)<t.r*.31+PLAYER_RADIUS))return false;
  if(WORLD.rocks.some(t=>Math.hypot(t.x-x,t.z-z)<t.s*.75+PLAYER_RADIUS))return false;
 }
 return true;
}
export function directionalMotion(yaw,forward,strafe){
 let a=clamp(forward,-1,1),s=clamp(strafe,-1,1);
 const len=Math.hypot(a,s);if(len>1){a/=len;s/=len;}
 return {x:Math.sin(yaw)*a-Math.cos(yaw)*s,z:Math.cos(yaw)*a+Math.sin(yaw)*s};
}
export function walkHorizontal(p,dx,dz,dt,canEnter=allowedPosition){
 const nextX=p.x+dx*dt,nextZ=p.z+dz*dt;
 const x=canEnter(nextX,p.z,p.y)?nextX:p.x;
 const z=canEnter(x,nextZ,p.y)?nextZ:p.z;
 return {x,z};
}
export function vehicleStep(vehicle,accelerator,steering,dt,canEnter=allowedPosition){
 const d=clamp(dt,0,MAX_DT);
 const a=clamp(accelerator,-1,1),st=clamp(steering,-1,1);
 let v=vehicle.v+(a*(a>0?VEHICLE_ENGINE:VEHICLE_REVERSE)-vehicle.v)*d*VEHICLE_RESPONSE;
 const yaw=vehicle.yaw+st*d*VEHICLE_STEER*clamp(v/6,-1,1);
 const x=vehicle.x+Math.sin(yaw)*v*d,z=vehicle.z+Math.cos(yaw)*v*d;
 if(!canEnter(x,z,terrainY(x,z),true))return {...vehicle,yaw,v:v*-.3};
 return {...vehicle,x,z,yaw,v};
}
export function cameraGoal(player,yaw,pit,dist){
 const eye=player.y+CAMERA_EYE,fx=Math.sin(yaw),fz=Math.cos(yaw),c=Math.cos(pit);
 if(dist<1)return {position:[player.x,eye,player.z],target:[player.x+fx*c*5,eye-Math.sin(pit)*5,player.z+fz*c*5]};
 const x=player.x-fx*dist*c,z=player.z-fz*dist*c;
 return {position:[x,Math.max(eye+Math.sin(pit)*dist,terrainY(x,z)+.8),z],target:[player.x,player.y+1.5,player.z]};
}
export function overviewGoal(theta,phi,radius){return {position:[radius*Math.sin(phi)*Math.sin(theta),radius*Math.cos(phi)+4,radius*Math.sin(phi)*Math.cos(theta)],target:[0,6,0]};}
