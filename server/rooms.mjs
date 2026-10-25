// Authoritative multiplayer room state. No player-supplied coordinates are trusted.
import {randomInt,randomBytes} from 'node:crypto';
import {COMBAT, shoot, respawn, isDown, isShielded} from './combat.mjs';
import {selectSecretExit, exitSignal, canEscape, visiblePortal, ROUND_SECONDS} from './round.mjs';
import {STARTING_COINS, REVEAL_COST, REVEAL_DURATION_MS, contactsFor, expireReveals} from './radar.mjs';
import {initPowers, usePower, takePickup, nearbyPickup, currentEffects, powerSelf, expirePowers, stealthContacts, compassContacts, POWER_RULES, POWER_COOLDOWN_MS} from './powers.mjs';
import {CONTROL,clamp as clampControl,remapControls,steerVehicle} from '../shared/controls.js';
import {HALF, PLAY_LIMIT, chooseSpawn, terrainY, insideBuilding, inWater, WORLD, GRAVITY, PLAYER_RADIUS, validPosition,controllerPositionAllowed} from '../shared/world.js';

// Runners enter as a visible group instead of spawning out of sight across
// the valley. This does not reveal anyone on the paid location minimap.
export const RUNNER_STARTS=Object.freeze([[0,52],[6,52],[-6,52],[12,54],[-12,54],[0,62],[6,62],[-6,62],[18,52],[-18,52],[12,64]]);
export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 12;
const SPEED = CONTROL.WALK_SPEED;
const SPRINT_SPEED = CONTROL.RUN_SPEED;
const CODES = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const emit = (socket, message) => { if (socket?.readyState === 1) socket.send(JSON.stringify(message)); };
const displayName = v => String(v ?? '').replace(/[<>\x00-\x1F]/g, '').trim().slice(0, 16) || 'Explorer';
const formatPlayer = (p,now=Date.now()) => ({id:p.id, name:p.name, skin:p.skin, x:p.x, y:p.y, z:p.z, angle:p.angle, moving:p.moving, grounded:p.grounded, role:p.role, down:isDown(p,now), shielded:isShielded(p,now), driving:!!p.driving, effects:currentEffects(p,now)});
const mergeContacts=(reciprocal,stealth)=>{const seen=new Map(stealth.map(p=>[p.id,p]));for(const p of reciprocal)seen.set(p.id,{...p,source:'reciprocal'});return [...seen.values()];};
const publicRoom = room => ({ code:room.code, capacity:room.capacity, hostId:room.hostId, phase:room.phase, players:[...room.players.values()].map(p=>({id:p.id,name:p.name,skin:p.skin,host:p.id===room.hostId})) });

export class RoomManager {
  constructor(){ this.rooms = new Map(); this.connections = new Map(); this.serial=0; this.snapshots=0; this.disconnectTimers=new Map(); }
  error(sock, message){emit(sock,{type:'error',message});}
  code(){for(let i=0;i<100;i++){const code=Array.from({length:5},()=>CODES[randomInt(CODES.length)]).join('');if(!this.rooms.has(code))return code;}throw Error('Room codes exhausted');}
  player(sock,name,skin,order){const spawn=chooseSpawn(order);return {socket:sock, resumeToken:randomBytes(24).toString('hex'), id:`P${++this.serial}`, name:displayName(name),skin:clamp(Number.isInteger(skin)?skin:0,0,8),role:'runner',coins:STARTING_COINS,...spawn,angle:0,driving:false,vy:0,grounded:true,moving:false,input:{dx:0,dz:0,sprint:false,climb:false,jump:false},priorJump:false,lastSeq:0,lastInputAt:0,downUntil:0,shieldUntil:0,nextShotAt:0};}
  make(sock,data){
    if(this.connections.has(sock))return this.error(sock,'Leave your current room first.');
    const capacity=Number(data.capacity);if(!Number.isInteger(capacity)||capacity<MIN_PLAYERS||capacity>MAX_PLAYERS)return this.error(sock,'Choose 2 to 12 players.');
    if(this.rooms.size>=100)return this.error(sock,'Server room limit reached.');
    const p=this.player(sock,data.name,data.skin,0), room={code:this.code(),capacity,hostId:p.id,phase:'lobby',players:new Map([[p.id,p]]),reveals:new Map()};
    this.rooms.set(room.code,room);this.connections.set(sock,{code:room.code,id:p.id});
    emit(sock,{type:'joined',selfId:p.id,resumeToken:p.resumeToken,room:publicRoom(room)});
  }
  join(sock,data){
    if(this.connections.has(sock))return this.error(sock,'Leave your current room first.');
    const code=String(data.code||'').toUpperCase().replace(/[^A-Z2-9]/g,'').slice(0,5);
    const room=this.rooms.get(code);
    if(!room)return this.error(sock,'Room not found. Check the five-character code.');
    if(room.phase!=='lobby')return this.error(sock,'This session has already started.');
    if(room.players.size>=room.capacity)return this.error(sock,'This room is full.');
    const p=this.player(sock,data.name,data.skin,room.players.size);
    room.players.set(p.id,p);this.connections.set(sock,{code,id:p.id});
    emit(sock,{type:'joined',selfId:p.id,resumeToken:p.resumeToken,room:publicRoom(room)});
    this.broadcast(room,{type:'room',room:publicRoom(room)});
  }
  start(sock){
    const membership=this.connections.get(sock);if(!membership)return this.error(sock,'Join a room first.');
    const room=this.rooms.get(membership.code);
    if(room.hostId!==membership.id)return this.error(sock,'Only the host can launch the game.');
    if(room.phase!=='lobby' && room.phase!=='finished')return this.error(sock,'Game already launched.');
    if(room.players.size<MIN_PLAYERS)return this.error(sock,'At least two players must join before launch.');
    room.phase='exploring';
    room.winnerId=null;room.endReason=null;
    room.secretExit=selectSecretExit();
    room.startedAt=Date.now();
    room.roundEndsAt=room.startedAt+ROUND_SECONDS*1000;
    room.vehicle={x:0,z:46,yaw:0,v:0,driverId:null};
    room.reveals=new Map(); // Reset active locations and visibility for every round.
    const roster=[...room.players.values()];
    // Exactly one role is chosen using cryptographically secure server randomness.
    const hunterId=roster[randomInt(roster.length)].id;
    let runnerIndex=0;
    for(const p of roster){
      p.role=p.id===hunterId?'hunter':'runner';
      p.coins=STARTING_COINS;
      // The hunter begins at the plaza; runners are scattered around the enclosed world.
      let spawn;
      if(p.role==='hunter')spawn={x:-30,z:-46};
      else {const start=RUNNER_STARTS[runnerIndex++%RUNNER_STARTS.length];spawn={x:start[0],z:start[1]};}
      p.x=spawn.x;p.z=spawn.z;p.y=terrainY(p.x,p.z);
      p.vy=0;p.grounded=true;p.moving=false;p.priorJump=false;p.driving=false;
      p.downUntil=0;p.shieldUntil=0;p.nextShotAt=0;
      p.input={dx:0,dz:0,sprint:false,climb:false,jump:false};p.lastInputAt=0;p.lastSeq=0;
    }
    initPowers(room,room.startedAt);
    // 3D avatar data is distinct from paid minimap contacts. Every visible
    // participant needs transform data to be drawn in the world.
    for(const receiver of roster){
      const players=roster.filter(p=>p.id===receiver.id||p.freezeUntil>room.startedAt||p.gravityUntil>room.startedAt||(p.invisibleUntil||0)<=room.startedAt).map(p=>formatPlayer(p,room.startedAt));
      emit(receiver.socket,{type:'started',room:publicRoom(room),players,hunterId,coins:receiver.coins,
        radarRules:{startingCoins:STARTING_COINS,cost:REVEAL_COST,durationMs:REVEAL_DURATION_MS},
        power:powerSelf(receiver,room.startedAt,room),vehicle:room.vehicle,powerRules:POWER_RULES,powerCooldownMs:POWER_COOLDOWN_MS,combatRules:COMBAT,
        roundRemainingMs:ROUND_SECONDS*1000,portal:visiblePortal(receiver,room.secretExit)});
    }
  }
  power(sock,data){
    const membership=this.connections.get(sock);if(!membership)return this.error(sock,'Join a room first.');
    const room=this.rooms.get(membership.code),p=room?.players.get(membership.id);
    if(!p)return this.error(sock,'Player not found.');
    if(isDown(p))return this.error(sock,'Cannot use powers while knocked out.');
    const result=usePower(room,p,data.ability,data.targetId,Date.now(),data.tier,data.speedValue??.5);
    if(!result.ok)return this.error(sock,result.error);
    emit(sock,{type:'powerResult',...result});
    // Warps are sent only to the affected player(s); no global coordinate leak.
    for(const w of result.warps||[]){const player=room.players.get(w.id);
      if(player)emit(player.socket,{type:'forcedWarp',x:w.x,y:w.y,z:w.z});}
    if(!['stealth','see','zone','shattered','invisible'].includes(result.ability))
      this.broadcast(room,{type:'powerEvent',actorId:p.id,actorName:p.name,
        ability:result.ability,targetId:result.targetId,durationMs:result.durationMs});
    if(result.targetId && !['swap','see','stealth','teleport'].includes(result.ability)){
      const victim=room.players.get(result.targetId);
      if(victim)emit(victim.socket,{type:'powerHit',ability:result.ability,durationMs:result.durationMs,
        effects:currentEffects(victim,Date.now()),position:{x:victim.x,y:victim.y,z:victim.z}});
    }
    if(result.ability==='shattered'){
      for(const hunter of room.players.values())if(hunter.role==='hunter')
        emit(hunter.socket,{type:'compassAlert',runnerName:p.name,durationMs:result.durationMs});
    }
    if(result.ability==='see'){
      const target=room.players.get(result.targetId);
      emit(target.socket,{type:'radarAlert',buyerName:p.name,durationMs:result.durationMs});
    }
    this.snapshotRoom(room);
  }
  pickup(sock){
    const membership=this.connections.get(sock);if(!membership)return this.error(sock,'Join a room first.');
    const room=this.rooms.get(membership.code),p=room?.players.get(membership.id);
    if(!p)return this.error(sock,'Player not found.');
    if(isDown(p))return this.error(sock,'Cannot collect crystals while knocked out.');
    const result=takePickup(room,p);
    if(!result.ok)return this.error(sock,result.error);
    emit(sock,{type:'powerPickup',...result,power:powerSelf(p,Date.now(),room)});
    this.snapshotRoom(room);
  }
  escape(sock){
    const membership=this.connections.get(sock);if(!membership)return;
    const room=this.rooms.get(membership.code);
    if(!room || room.phase!=='exploring')return this.error(sock,'There is no active escape round.');
    if(Date.now()>=room.roundEndsAt){this.finishTimedOutRound(room);return this.error(sock,'Time has expired.');}
    const p=room.players.get(membership.id);
    if(!p || p.role!=='runner')return this.error(sock,'Only trapped runners can escape.');
    if(isDown(p))return this.error(sock,'Cannot escape while knocked out.');
    if(!canEscape(p,room.secretExit))return this.error(sock,'Secret gate not within reach or you are incapacitated. Reach the glowing time-travel gate on foot.');
    // Serialized on the Node.js event loop: only the first valid escape ends the match.
    this.endRound(room,{winnerId:p.id,reason:'escaped'});
  }
  finishTimedOutRound(room){
    if(room.phase!=='exploring')return false;
    const hunter=[...room.players.values()].find(p=>p.role==='hunter');
    return this.endRound(room,{winnerId:hunter?.id||null,reason:'timeout'});
  }
  endRound(room,{winnerId=null,reason='abandoned'}){
    if(room.phase!=='exploring')return false;
    if(room.vehicle)room.vehicle.driverId=null;
    room.phase='finished';room.winnerId=winnerId;room.endReason=reason;room.reveals.clear();room.stealthReveals?.clear();room.compassExposures?.clear();room.powerPickups?.clear();
    for(const p of room.players.values())p.input={dx:0,dz:0,sprint:false,jump:false,climb:false};
    const winner=room.players.get(winnerId);
    this.broadcast(room,{type:'ended',room:publicRoom(room),winnerId,winnerName:winner?.name??null,
      winnerRole:winner?.role??null,reason,elapsedMs:Math.max(0,Date.now()-(room.startedAt||Date.now()))});
    return true;
  }
  fire(sock,data){
    const membership=this.connections.get(sock);if(!membership)return;
    const room=this.rooms.get(membership.code),p=room?.players.get(membership.id);
    if(!p)return;
    const result=shoot(room,p,data);
    if(!result.ok){if(!result.silent)this.error(sock,result.error);return;}
    // Emit fire/impact data ONLY to players who already could see the shot
    // in the 3D scene. This must not become free long-range tracking.
    for(const viewer of room.players.values()){
      const nearShot=Math.hypot(viewer.x-result.origin.x,viewer.z-result.origin.z)<115;
      const nearImpact=Math.hypot(viewer.x-result.end.x,viewer.z-result.end.z)<115;
      if(viewer.id===p.id||nearShot||nearImpact){
        emit(viewer.socket,{type:'shot',shooterId:result.shooterId,hitId:result.hitId,
          origin:result.origin,end:result.end,cooldownMs:result.cooldownMs});
      }
    }
    if(result.hitId){
      const victim=room.players.get(result.hitId);
      emit(victim.socket,{type:'knockout',downUntil:result.downUntil,durationMs:COMBAT.knockoutMs,
        hunterName:p.name});
      emit(p.socket,{type:'hitConfirmed',victimName:victim.name});
    }
    this.snapshotRoom(room);
  }
  toggleVehicle(sock){
    const member=this.connections.get(sock);if(!member)return;
    const room=this.rooms.get(member.code),p=room?.players.get(member.id),car=room?.vehicle;
    if(!p||!car||room.phase!=='exploring'||isDown(p))return;
    if(p.freezeUntil>Date.now()||p.gravityUntil>Date.now())return this.error(sock,'This effect prevents entering or exiting the vehicle.');
    if(p.driving){
      // Right of the car is (-cos(yaw),sin(yaw)) in this coordinate system.
      const x=car.x-Math.cos(car.yaw)*CONTROL.VEHICLE_EXIT_OFFSET;
      const z=car.z+Math.sin(car.yaw)*CONTROL.VEHICLE_EXIT_OFFSET;
      if(!controllerPositionAllowed(x,z))return this.error(sock,'No safe space to exit on the right.');
      p.driving=false;car.driverId=null;car.v=0;p.x=x;p.z=z;p.y=terrainY(x,z);
      emit(sock,{type:'vehicleAction',driving:false,x,z,y:p.y});
    }else{
      if(car.driverId)return this.error(sock,'Someone else is driving.');
      if(Math.hypot(p.x-car.x,p.z-car.z)>CONTROL.VEHICLE_ENTER_RANGE)return this.error(sock,'Get within 6 m of the vehicle.');
      p.driving=true;car.driverId=p.id;p.x=car.x;p.z=car.z;p.y=terrainY(p.x,p.z);
      emit(sock,{type:'vehicleAction',driving:true,vehicle:car});
    }
    this.snapshotRoom(room);
  }
  input(sock,data){
    const membership=this.connections.get(sock);if(!membership)return;
    const room=this.rooms.get(membership.code);if(room?.phase!=='exploring')return;
    const p=room.players.get(membership.id);if(!p||isDown(p))return;
    const now=Date.now();
    // Trust only bounded local directions and yaw, never client world velocity,
    // positions, or claimed skill state. Server recomputes chaos controls.
    let localRight=Number(data.localRight),localForward=Number(data.localForward),yaw=Number(data.yaw);
    if(!Number.isFinite(localRight)||!Number.isFinite(localForward)||!Number.isFinite(yaw))return;
    localRight=clampControl(localRight,-1,1);localForward=clampControl(localForward,-1,1);
    const len=Math.max(1,Math.hypot(localRight,localForward));localRight/=len;localForward/=len;
    const mapped=remapControls(localRight,localForward,data.jump===true,yaw,p.scrambleUntil>now?p.scrambleMap:null);
    const seq=Number(data.seq);if(Number.isSafeInteger(seq)&&seq<=p.lastSeq)return;
    if(Number.isSafeInteger(seq))p.lastSeq=seq;
    p.input={dx:mapped.dx,dz:mapped.dz,localRight,localForward,sprint:data.sprint===true,
      climb:data.climb===true,jump:mapped.jump};p.lastInputAt=now;
  }
  tick(dt=1/30){
    dt=clamp(dt,0,0.05);
    for(const room of this.rooms.values()){
      if(room.phase!=='exploring')continue;
      const now=Date.now();
      if(now>=room.roundEndsAt){this.finishTimedOutRound(room);continue;}
      expirePowers(room,now);
      const car=room.vehicle;
      if(car?.driverId){const driver=room.players.get(car.driverId);
        if(!driver||isDown(driver,now)){car.driverId=null;car.v=0;if(driver)driver.driving=false;}
        else {const inp=now-driver.lastInputAt<=450?driver.input:{};
          if(driver.freezeUntil>now){car.v=0;}else{
            const effects=currentEffects(driver,now);
            const input=effects.scramble?remapControls(inp.localRight||0,inp.localForward||0,false,0,effects.scramble):{dx:-(inp.localRight||0),dz:inp.localForward||0};
            steerVehicle(car,input.dz,input.dx,dt,(x,z)=>controllerPositionAllowed(x,z,2.0));
            if(effects.slow)car.v*=.1;
          }
        }
      }
      for(const p of room.players.values()){
        if(isDown(p,now))continue;
        if(p.downUntil){if(respawn(room,p,now)){
          emit(p.socket,{type:'respawned',x:p.x,y:p.y,z:p.z,shieldMs:COMBAT.respawnShieldMs});
        }}
        this.stepPlayer(p,dt,now,room);
        // Crossing the threshold wins immediately. No hidden second F press,
        // and no client-supplied location or button can bypass verification.
        if(canEscape(p,room.secretExit,now)){this.endRound(room,{winnerId:p.id,reason:'escaped'});break;}
        p.history??=[];p.history.push({at:now,x:p.x,y:p.y,z:p.z});if(p.history.length>225)p.history.shift();
      }
    }
  }
  stepPlayer(p,dt,now=Date.now(),room=null){
    // Clear expired freeze on the server and tell its victim explicitly.
    // Also resets cached velocity so a player never remains frozen forever.
    if(p.freezeUntil && p.freezeUntil<=now){
      p.freezeUntil=0;p.priorJump=false;p.lastVelocityX=0;p.lastVelocityZ=0;
      emit(p.socket,{type:'effectExpired',effect:'freeze'});
    }
    if(p.driving&&room?.vehicle?.driverId===p.id){
      const car=room.vehicle;p.x=car.x;p.z=car.z;p.y=terrainY(p.x,p.z);
      p.angle=car.yaw;p.moving=Math.abs(car.v)>.05;p.vy=0;p.grounded=true;return;
    }
    const {dx,dz,sprint,jump,climb}=now-p.lastInputAt>450?{dx:0,dz:0,sprint:false,jump:false,climb:false}:p.input;
    let speed=sprint?SPRINT_SPEED:SPEED;
    if(p.slowUntil>now)speed*=.1;
    if(p.speedUntil>now)speed*=p.speedMultiplier||.5;
    if(p.boostUntil>now)speed*=1.7;
    if(inWater(p.x,p.z)||WORLD.ponds.some(q=>Math.hypot(q.x-p.x,q.z-p.z)<q.r))speed*=.85;
    const near=insideBuilding(p.x,p.z,2.9);
    // Gravity cannot trap someone permanently. Reset the character to a safe
    // ground position when its shortened gravity timer ends, independent of client timing.
    if(p.gravityLastUntil&&p.gravityLastUntil<=now){
      p.gravityLastUntil=0;p.gravityUntil=0;p.gravityHeight=0;p.gravityNextTossAt=0;p.gravityTossCount=0;
      p.y=terrainY(p.x,p.z);p.vy=0;p.grounded=true;
      p.freezeUntil=Math.max(p.freezeUntil||0,now+1200); // landing stumble
      p.input={dx:0,dz:0,sprint:false,jump:false,climb:false};
      emit(p.socket,{type:'gravityLanded',x:p.x,y:p.y,z:p.z});
    }
    const floating=p.gravityUntil>now;
    const locked=p.freezeUntil>now;
    if(locked){p.vy=0;p.lastVelocityX=0;p.lastVelocityZ=0;p.moving=false;return;}
    if(!locked&&climb&&near&&p.y<near.h+.45){p.vy=7.1;p.grounded=false;}
    else if(!locked&&jump&&!p.priorJump&&p.grounded){p.vy=11;p.grounded=false;}
    else if(floating){p.vy=0;p.grounded=false;}
    else if(!p.grounded)p.vy-=GRAVITY*dt;
    p.priorJump=locked?false:jump;
    const blocked=(x,z)=>!controllerPositionAllowed(x,z,PLAYER_RADIUS);
    // Zero Gravity is deliberately a CHAOTIC, server-owned effect, not free flight.
    // Sudden vortices reverse direction every few seconds, and the victim gets
    // thrown to safe, unpredictable locations at roughly 5–8 second intervals.
    // The victim's movement keys cannot counteract the throws.
    if(floating&&now>=p.gravityNextTossAt){
      let destination=null;
      for(let attempt=0;attempt<24;attempt++){
        const angle=randomInt(1000000)/1000000*Math.PI*2;
        const length=24+randomInt(43);
        const x=clamp(p.x+Math.cos(angle)*length,-HALF+6,HALF-6);
        const z=clamp(p.z+Math.sin(angle)*length,-HALF+6,HALF-6);
        if(controllerPositionAllowed(x,z,PLAYER_RADIUS+0.5)&&
           (!room?.secretExit||Math.hypot(x-room.secretExit.x,z-room.secretExit.z)>14)){
          destination={x,z};break;
        }
      }
      if(destination){
        const origin={x:p.x,y:p.y,z:p.z};p.x=destination.x;p.z=destination.z;
        p.gravityHeight=terrainY(p.x,p.z)+16+randomInt(13);
        p.y=Math.min(39,Math.max(10,p.y+2));
        p.gravityTossCount++;
        // A dedicated event can trigger audiovisual feedback; the authoritative
        // position also streams in regular snapshots to every nearby viewer.
        for(const viewer of room?.players.values()||[]){
          if(Math.hypot(viewer.x-p.x,viewer.z-p.z)<160||viewer.id===p.id)
            emit(viewer.socket,{type:'gravityToss',targetId:p.id,from:origin,to:{x:p.x,y:p.y,z:p.z},count:p.gravityTossCount});
        }
      }
      p.gravityNextTossAt=now+5000+randomInt(3000);
    }
    const age=Math.max(0,(now-(p.gravityStartAt||now))/1000);
    const phase=p.gravitySeed||23;
    const orbit=age*3.1+phase;
    const vx=locked?0:floating?(Math.cos(orbit)*7.5+Math.sin(age*1.7+phase)*2.5):dx*speed;
    const vz=locked?0:floating?(Math.sin(orbit*.81)*7.5+Math.cos(age*2.1+phase)*2.5):dz*speed;
    const nx=clamp(p.x+vx*dt,-PLAY_LIMIT,PLAY_LIMIT), nz=clamp(p.z+vz*dt,-PLAY_LIMIT,PLAY_LIMIT);
    const beforeX=p.x,beforeZ=p.z;
    if(!blocked(nx,p.z))p.x=nx;
    if(!blocked(p.x,nz))p.z=nz;
    if(floating){
      const height=p.gravityHeight||terrainY(p.x,p.z)+11;
      p.y+=(height+Math.sin(now*.004)*.7-p.y)*Math.min(1,dt*3.4);
      p.vy=0;p.grounded=false;
    }else p.y+=p.vy*dt;
    let floor=terrainY(p.x,p.z);
    const roof=insideBuilding(p.x,p.z,-.2);
    if(roof&&p.y>roof.h-2&&p.vy<=0)floor=Math.max(floor,roof.h);
    if(!floating&&p.y<=floor+.12&&p.vy<=0){p.y=floor;p.vy=0;p.grounded=true;}else p.grounded=false;
    p.y=clamp(p.y,-1,50);
    p.lastVelocityX=(p.x-beforeX)/Math.max(dt,.0001);p.lastVelocityZ=(p.z-beforeZ)/Math.max(dt,.0001);
    p.moving=Math.hypot(p.lastVelocityX,p.lastVelocityZ)>.05;
    if(p.moving)p.angle=Math.atan2(p.lastVelocityX,p.lastVelocityZ);
  }
  // Everyone can be drawn in 3D, even across the valley. Minimap markers are
  // a separate authorized data stream (radar.contacts), never players[].
  snapshotRoom(room){
      if(room.phase!=='exploring')return;
      const now=Date.now();
      expireReveals(room,now);expirePowers(room,now);
      const roster=[...room.players.values()];
      for(const receiver of roster){
        const spectating=isDown(receiver,now);
        const visible=roster.filter(p=>p.id===receiver.id||spectating||p.freezeUntil>now||p.gravityUntil>now||(p.invisibleUntil||0)<=now);
        emit(receiver.socket,{type:'snapshot',seq:++this.snapshots,players:visible.map(p=>formatPlayer(p,now)),
          exitSignal:exitSignal(receiver,room.secretExit),
          portal:visiblePortal(receiver,room.secretExit),
          roundRemainingMs:Math.max(0,room.roundEndsAt-now),
          radar:{coins:receiver.coins,contacts:mergeContacts(contactsFor(room,receiver,now),[...stealthContacts(room,receiver,now),...compassContacts(room,receiver,now)])},
          power:powerSelf(receiver,now,room),vehicle:room.vehicle,spectating,pickup:isDown(receiver,now)?null:nearbyPickup(room,receiver,now),
          combat:{downUntil:receiver.downUntil||0,shieldUntil:receiver.shieldUntil||0,
            shotCooldownMs:Math.max(0,(receiver.nextShotAt||0)-now)}});
      }
  }
  snapshot(){
    for(const room of this.rooms.values())this.snapshotRoom(room);
  }
  broadcast(room,message){for(const p of room.players.values())emit(p.socket,message);}
  // Socket lifecycle is separate from room membership. Timed-out sockets
  // cannot be looked up via this.connections (already removed on disconnect).
  removePlayer(room,id){
    const player=room.players.get(id);if(!player)return;
    const timer=this.disconnectTimers.get(id);
    if(timer){clearTimeout(timer);this.disconnectTimers.delete(id);}
    for(const [sock,m] of this.connections)if(m.code===room.code&&m.id===id)this.connections.delete(sock);
    room.players.delete(id);
    if(room.vehicle?.driverId===id){room.vehicle.driverId=null;room.vehicle.v=0;}
    if(room.reveals)expireReveals(room);
    if(room.stealthReveals)expirePowers(room);
    if(room.phase==='exploring'&&(player.role==='hunter'||![...room.players.values()].some(q=>q.role==='runner')))
      this.endRound(room,{reason:player.role==='hunter'?'hunter_disconnected':'all_runners_left'});
    if(!room.players.size){this.rooms.delete(room.code);return;}
    if(id===room.hostId)room.hostId=room.players.keys().next().value;
    this.broadcast(room,{type:'room',room:publicRoom(room)});
    if(room.phase==='exploring')this.broadcast(room,{type:'left',id});
  }
  leave(sock,{grace=false}={}){
    const membership=this.connections.get(sock);if(!membership)return;
    this.connections.delete(sock);
    const room=this.rooms.get(membership.code),player=room?.players.get(membership.id);
    if(!player||player.socket!==sock)return;
    if(grace&&!this.disconnectTimers.has(player.id)){
      player.socket=null;player.input={dx:0,dz:0,sprint:false,jump:false,climb:false};
      // Reconnects work even after a browser tab reload or a short network flap.
      const timer=setTimeout(()=>{
        if(room.players.get(player.id)?.socket===null)this.removePlayer(room,player.id);
      },90_000);
      timer.unref?.();this.disconnectTimers.set(player.id,timer);
      return;
    }
    this.removePlayer(room,player.id);
  }
  // Temporary websocket failures must not force a match to end. A player has
  // 90 seconds to resume using their private random token; deliberate LEAVE is immediate.
  resume(sock,data){
    if(this.connections.has(sock))return this.error(sock,'Already connected to a room.');
    const token=typeof data.resumeToken==='string'?data.resumeToken:'';
    const code=typeof data.code==='string'?data.code.toUpperCase():'';
    const room=this.rooms.get(code);
    const p=[...(room?.players.values()||[])].find(x=>x.resumeToken===token&&token.length>=40&&!x.socket);
    if(!p)return this.error(sock,'Resume failed: your previous session has expired. Rejoin with a room code.');
    const pending=this.disconnectTimers.get(p.id);
    if(pending){clearTimeout(pending);this.disconnectTimers.delete(p.id);}
    // Remove the obsolete socket-to-player mapping after reconnecting.
    for(const [old,m] of this.connections)if(m.id===p.id&&m.code===room.code)this.connections.delete(old);
    p.socket=sock;this.connections.set(sock,{code:room.code,id:p.id});
    emit(sock,{type:'resumed',selfId:p.id,resumeToken:p.resumeToken,room:publicRoom(room),
      players:[...room.players.values()].filter(q=>q.id===p.id||(q.invisibleUntil||0)<=Date.now()).map(q=>formatPlayer(q)),
      coins:p.coins,power:powerSelf(p,Date.now(),room),vehicle:room.vehicle,
      radarRules:{startingCoins:STARTING_COINS,cost:REVEAL_COST,durationMs:REVEAL_DURATION_MS},
      powerRules:POWER_RULES,powerCooldownMs:POWER_COOLDOWN_MS,combatRules:COMBAT,
      roundRemainingMs:Math.max(0,(room.roundEndsAt||Date.now())-Date.now()),portal:room.phase==='exploring'?visiblePortal(p,room.secretExit):null});
    if(room.phase==='exploring')this.snapshotRoom(room);
    else if(room.phase==='finished')emit(sock,{type:'ended',room:publicRoom(room),winnerId:room.winnerId,
      winnerName:room.players.get(room.winnerId)?.name||null,reason:room.endReason});
    this.broadcast(room,{type:'room',room:publicRoom(room)});
  }
  handle(sock,message){
    if(!message||typeof message!=='object'||Array.isArray(message))return;
    switch(message.type){
      case 'create':return this.make(sock,message);
      case 'join':return this.join(sock,message);
      case 'resume':return this.resume(sock,message);
      case 'start':return this.start(sock);
      case 'input':return this.input(sock,message);
      case 'vehicle':return this.toggleVehicle(sock);
      case 'fire':return this.fire(sock,message);
      case 'escape':return this.escape(sock);
      case 'reveal':return this.error(sock,'Location reveals are only available through the assigned PLAYER PING skill.');
      case 'power':return this.power(sock,message);
      case 'pickup':return this.pickup(sock);
      case 'leave':this.leave(sock);emit(sock,{type:'leftRoom'});return;
      case 'ping':emit(sock,{type:'pong',sent:message.sent});return;
      default:break;
    }
  }
  close(){for(const timer of this.disconnectTimers.values())clearTimeout(timer);this.disconnectTimers.clear();this.rooms.clear();this.connections.clear();}
}
