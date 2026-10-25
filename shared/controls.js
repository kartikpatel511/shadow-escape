// Controller constants requested for Shadow Escape. Shared by browser and server.
export const CONTROL = Object.freeze({
  WALK_SPEED:7.5, RUN_SPEED:14, TURN_SPEED:1.8,
  LOOK_X:.005, LOOK_Y:.004, PIT_MIN:-.45, PIT_MAX:1.2,
  INITIAL_YAW:Math.PI, INITIAL_PITCH:.35, INITIAL_DIST:6,
  FP_DIST:.01, TP_DIST:6, MIN_DIST:.01, MAX_DIST:14,
  CAMERA_EYE:1.65, CAMERA_LERP:9, GROUND_LERP:12,
  OVERVIEW_RADIUS:170, OVERVIEW_THETA:.8, OVERVIEW_PHI:1,
  OVERVIEW_MIN_RADIUS:30, OVERVIEW_MAX_RADIUS:420,
  OVERVIEW_MIN_PHI:.15, OVERVIEW_MAX_PHI:1.45,
  OVERVIEW_LOOK_X:.006, OVERVIEW_LOOK_Y:.005,
  VEHICLE_ENTER_RANGE:6, VEHICLE_EXIT_OFFSET:2.8,
  VEHICLE_ACCEL_FWD:20, VEHICLE_ACCEL_BACK:8, VEHICLE_RESPONSE:1.2,
  VEHICLE_STEER:1.6, VEHICLE_STEER_REF:6, VEHICLE_YAW_CHASE:3,
  VEHICLE_MIN_CAMERA_DIST:9, MAX_DT:.05,
  // Comfortable over-the-right-shoulder hunter scope, not a sniper zoom.
  HUNTER_SCOPE_DIST:3.5, HUNTER_SCOPE_RIGHT:1.25, HUNTER_SCOPE_ELEVATION:1.00,
  JOYSTICK_RING:90, JOYSTICK_KNOB:30, JOYSTICK_MAX:45, JOYSTICK_RUN_AT:.95
});
export const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
export const wrapAngle=a=>Math.atan2(Math.sin(a),Math.cos(a));
// +z is forward at yaw=0, as specified. Right = (-cos(yaw), sin(yaw)).
export function localToWorld(right,forward,yaw){
  const f=Math.sin(yaw),fz=Math.cos(yaw),rx=-Math.cos(yaw),rz=Math.sin(yaw);
  return {dx:f*forward+rx*right,dz:fz*forward+rz*right};
}
// Both the server and the client pass raw simultaneous strafe/forward controls.
export function remapControls(right,forward,jump,yaw,chaos=null){
  const cmds={right:0,forward:0,jump:!!jump};
  const move=(dir,value)=>{
    if(value<=0)return;
    const output=chaos?.[dir]||dir;
    if(output==='jump')cmds.jump=true;
    else if(output==='up')cmds.forward+=value;
    else if(output==='down')cmds.forward-=value;
    else if(output==='right')cmds.right+=value;
    else if(output==='left')cmds.right-=value;
  };
  const r=clamp(Number(right)||0,-1,1),f=clamp(Number(forward)||0,-1,1);
  if(f>0)move('up',f);else if(f<0)move('down',-f);
  if(r>0)move('right',r);else if(r<0)move('left',-r);
  const len=Math.max(1,Math.hypot(cmds.right,cmds.forward));
  const moved=localToWorld(cmds.right/len,cmds.forward/len,Number.isFinite(yaw)?yaw:0);
  return {...moved,jump:cmds.jump};
}
export function steerVehicle(vehicle,a,st,dt,allowed){
  dt=clamp(dt,0,CONTROL.MAX_DT);
  vehicle.v+=(clamp(a,-1,1)*(a>0?CONTROL.VEHICLE_ACCEL_FWD:CONTROL.VEHICLE_ACCEL_BACK)-vehicle.v)*dt*CONTROL.VEHICLE_RESPONSE;
  vehicle.yaw+=clamp(st,-1,1)*dt*CONTROL.VEHICLE_STEER*clamp(vehicle.v/CONTROL.VEHICLE_STEER_REF,-1,1);
  const nx=vehicle.x+Math.sin(vehicle.yaw)*vehicle.v*dt,nz=vehicle.z+Math.cos(vehicle.yaw)*vehicle.v*dt;
  if(allowed(nx,nz)){vehicle.x=nx;vehicle.z=nz;}else vehicle.v*=-.3;
  return vehicle;
}
