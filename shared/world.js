// Shared deterministic map; used by authoritative server and WebGL client.
export const HALF = 225;
export const WORLD_SIZE = HALF * 2;
// Server and client enforce the same interior playable boundary.
export const PLAY_LIMIT = HALF - 16;
export const START_COINS = 300;
export const DOWN_SECONDS = 30;
export const ROUND_SECONDS = 8 * 60;
export const REVEAL_COST = 20;
export const REVEAL_TIME = 10;
export const RUNNER_SPEED = 9.0;
export const HUNTER_SPEED = 10.5;
export const GRAVITY = 22;
export const PLAYER_RADIUS = 0.85;
export const PLAYER_HEIGHT = 3.1;
// Skill prices / durations are defined once in shared/skills.js.
import {POWER_RULES} from './skills.js';
export const POWER_DATA = POWER_RULES;
export const POWER_KEYS = Object.keys(POWER_DATA).filter(k=>k!=='swap');
const fract=x=>x-Math.floor(x);
const rng=(seed)=>()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
export const riverX=z=>67+Math.sin(z*.021)*10+Math.sin(z*.053)*2.5;
export const inWater=(x,z)=>Math.abs(x-riverX(z))<9;
export const terrainY=(x,z)=>0.18*Math.sin(x*.034)*Math.sin(z*.04); // kept small for smooth traversability
export const SPAWNS=[[-173,-155],[-157,158],[-42,-171],[153,-150],[185,157],[-46,171],[8,-100],[149,14],[-174,0],[-20,84],[37,168]];
export const GATES=[
  {x:-140,z:-HALF,yaw:0},{x:153,z:-HALF,yaw:0},{x:-HALF,z:-110,yaw:Math.PI/2},
  {x:-HALF,z:137,yaw:Math.PI/2},{x:HALF,z:-143,yaw:Math.PI/2},
  {x:HALF,z:114,yaw:Math.PI/2},{x:-125,z:HALF,yaw:0},{x:115,z:HALF,yaw:0}
];
export function buildWorld(){
  const r=rng(129814), trees=[],buildings=[],flowers=[],lamps=[], benches=[],rocks=[], powerSites=[],
        bridges=[-146,-3,143], ponds=[{x:-129,z:89,r:14},{x:-131,z:-89,r:12}];
  // Structured neighborhoods, separated by streets, central civic square and river.
  const zones=[[-174,-137],[-124,-137],[-74,-137],[-174,-67],[-121,-65],[-72,-65],[-173,37],[-74,36],[-174,159],[-92,154],[-26,-140],[8,-55],[9,73],[23,160],[121,-157],[159,-88],[121,29],[155,100],[113,167],[27,20],[137,-16],[-63,113],[-77,-13]];
  let b=0;
  for (const [cx,cz] of zones){
    if (Math.abs(cx-riverX(cz))<32 || (Math.abs(cx)<30&&Math.abs(cz)<30)) continue;
    let w=13+r()*11,d=12+r()*13,h=9+r()*18;
    const type=b%6===0?'tower':b%5===0?'house':b%7===0?'chapel':'townhouse';
    if(type==='tower'){w=12;d=12;h=29+r()*10;}
    const yaw=r()<.4?Math.PI/2:0;
    buildings.push({id:b++,x:cx,z:cz,w,d,h,yaw,type,roof:r(),tone:r()});
  }
  // Park pavilions and an identifiable clocktower near the square.
  buildings.push({id:b++,x:-32,z:14,w:15,d:15,h:38,yaw:0,type:'clock',roof:0,tone:.2});
  buildings.push({id:b++,x:152,z:164,w:20,d:19,h:23,yaw:0,type:'tower',roof:.4,tone:.68});
  // Stylized forests + landscape clearings. Exclusion zones keep roads, buildings, and river readable.
  for(let i=0,attempt=0;i<470&&attempt<5000;attempt++){
    const x=(r()-.5)*421,z=(r()-.5)*421;
    const inRoad=Math.abs(x)<8||Math.abs(z)<8||Math.abs(x+103)<7||Math.abs(z+104)<6||Math.abs(z-113)<7;
    if(inRoad || Math.abs(x-riverX(z))<17 || buildings.some(q=>Math.abs(x-q.x)<q.w/2+5&&Math.abs(z-q.z)<q.d/2+5))continue;
    if(ponds.some(p=>Math.hypot(x-p.x,z-p.z)<p.r+5))continue;
    const kind=r()<.68?'pine':r()<.73?'birch':'oak';
    trees.push({x,z,h:7+r()*11,r:1.8+r()*2.2,kind,shade:r()});i++;
  }
  for(let i=0;i<210;i++){
    const x=(r()-.5)*416,z=(r()-.5)*416;
    if(Math.abs(x-riverX(z))<11||Math.abs(x)<7||Math.abs(z)<7)continue;
    if(buildings.some(q=>Math.abs(x-q.x)<q.w/2+2&&Math.abs(z-q.z)<q.d/2+2))continue;
    flowers.push({x,z,hue:r(),scale:.55+r()*.95});
  }
  // Park promenade lighting and benches; sculpture circle in civic square.
  for(let x=-199;x<=199;x+=24)for(const z of [-16,16]){
    if(Math.abs(x-riverX(z))<18)continue;lamps.push({x,z});
  }
  for(let z=-192;z<=192;z+=28)for(const x of [-17,17]){
    if(Math.abs(x-riverX(z))<18)continue;lamps.push({x,z});
  }
  for(let i=0;i<23;i++){
    const x=-201+(i%9)*45,z=-199+Math.floor(i/9)*170;
    if(Math.abs(x-riverX(z))<18)continue;
    benches.push({x,z,yaw:i%3*Math.PI/2});
  }
  for(let i=0;i<100;i++){
    let x=(r()-.5)*424,z=(r()-.5)*424;
    if(Math.abs(x)<10||Math.abs(z)<10||Math.abs(x-riverX(z))<10)continue;
    rocks.push({x,z,s:.7+r()*1.6,t:r()});
  }
  for(let i=0;i<30;i++){
    const x=(r()-.5)*382,z=(r()-.5)*382;
    if(Math.abs(x-riverX(z))<14||buildings.some(q=>Math.abs(x-q.x)<q.w/2+6&&Math.abs(z-q.z)<q.d/2+6))continue;
    powerSites.push({x,z,id:i});
  }
  return {trees,buildings,flowers,lamps,benches,rocks,powerSites,bridges,ponds,gates:GATES};
}
export const WORLD=buildWorld();
export function insideBuilding(x,z,buffer=0){return WORLD.buildings.find(b=>Math.abs(x-b.x)<b.w/2+buffer&&Math.abs(z-b.z)<b.d/2+buffer);}
export function isBlocked(x,z,r=PLAYER_RADIUS){return !!insideBuilding(x,z,r);}
export function validPosition(x,z){return Math.abs(x)<HALF-2 && Math.abs(z)<HALF-2 && !isBlocked(x,z,PLAYER_RADIUS);}
export function chooseSpawn(index){let a=SPAWNS[index%SPAWNS.length];return {x:a[0],y:terrainY(...a),z:a[1]};}
export function segmentBlocked(ax,az,bx,bz){const dist=Math.hypot(bx-ax,bz-az), steps=Math.max(2,Math.ceil(dist/2.4));for(let i=1;i<steps;i++){let t=i/steps;if(insideBuilding(ax+(bx-ax)*t,az+(bz-az)*t,0.3))return true;}return false;}

// Legacy map geometry is centered around y=0. Normalize dry ground above the
// controller's 0.3 water threshold without lifting the rendered scene.
export function controllerTerrainHeight(x,z){
  // Water is shallow, swimmable/wadeable terrain rather than a movement barrier.
  return terrainY(x,z)+0.5;
}
// The map has buildings plus hundreds of trees and rocks: circular colliders
// stop players and cars from passing through physical trunks/boulders.
export const CIRCULAR_COLLIDERS=Object.freeze([
  ...WORLD.trees.map(t=>({x:t.x,z:t.z,radius:Math.max(0.65,t.r*.30)})),
  ...WORLD.rocks.map(r=>({x:r.x,z:r.z,radius:Math.max(.45,r.s*.7)}))
]);
export function controllerPositionAllowed(x,z,radius=PLAYER_RADIUS){
  if(!Number.isFinite(x)||!Number.isFinite(z)||Math.abs(x)>PLAY_LIMIT||Math.abs(z)>PLAY_LIMIT)return false;
  if(insideBuilding(x,z,radius))return false;
  return !CIRCULAR_COLLIDERS.some(c=>Math.hypot(x-c.x,z-c.z)<=c.radius+radius);
}
