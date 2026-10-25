import test from 'node:test';
import assert from 'node:assert/strict';

function received(socket,type,timeout=5000){
 return new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>{socket.removeEventListener('message',handler);reject(Error(`Wait timed out: ${type}`));},timeout);
  function handler(e){try{const m=JSON.parse(e.data);if(m.type===type){clearTimeout(timer);socket.removeEventListener('message',handler);resolve(m);}}catch{}}
  socket.addEventListener('message',handler);
 });
}
const connect=url=>new Promise((resolve,reject)=>{const socket=new WebSocket(url);socket.addEventListener('open',()=>resolve(socket),{once:true});socket.addEventListener('error',reject,{once:true});});
test('real websocket connections receive private exit signals, shared victory and a rematch',async()=>{
 process.env.NODE_ENV='test';
 const {server,rooms}=await import('../server.mjs');
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const url=`ws://127.0.0.1:${server.address().port}/ws`;
 let host,guest;
 try{
  host=await connect(url);guest=await connect(url);
  const joined=received(host,'joined');host.send(JSON.stringify({type:'create',capacity:2,name:'Host'}));
  const {room}=await joined;
  const joinedGuest=received(guest,'joined');guest.send(JSON.stringify({type:'join',code:room.code,name:'Guest'}));await joinedGuest;
  const hStart=received(host,'started'),gStart=received(guest,'started');host.send(JSON.stringify({type:'start'}));
  const [h,g]=await Promise.all([hStart,gStart]);
  assert.equal(h.hunterId,g.hunterId);
  const actual=rooms.rooms.get(room.code);
  const runner=[...actual.players.values()].find(p=>p.role==='runner');
  const hunter=[...actual.players.values()].find(p=>p.role==='hunter');
  // Keep the runner just outside the auto-win radius until listeners are ready.
  // Otherwise the 30Hz server tick can declare victory before ended listeners exist.
  runner.x=actual.secretExit.x+9;runner.z=actual.secretExit.z;runner.y=actual.secretExit.y;
  const runnerSignal=received(runner.name==='Host'?host:guest,'snapshot');
  const hunterSignal=received(hunter.name==='Host'?host:guest,'snapshot');
  rooms.snapshot();
  const [rs,hs]=await Promise.all([runnerSignal,hunterSignal]);
  assert.equal(rs.exitSignal.distance,9);assert.equal(hs.exitSignal,null);
  runner.x=actual.secretExit.x;runner.z=actual.secretExit.z;runner.y=actual.secretExit.y;
  const hostEnd=received(host,'ended'),guestEnd=received(guest,'ended');
  (runner.name==='Host'?host:guest).send(JSON.stringify({type:'escape',x:99999,z:99999}));
  const [e1,e2]=await Promise.all([hostEnd,guestEnd]);
  assert.equal(e1.winnerId,runner.id);assert.equal(e2.winnerId,runner.id);
  assert.equal(actual.phase,'finished');
  const rematchHost=received(host,'started'),rematchGuest=received(guest,'started');
  host.send(JSON.stringify({type:'start'}));
  await Promise.all([rematchHost,rematchGuest]);
  assert.equal(actual.phase,'exploring');assert.equal(actual.winnerId,null);
 }finally{
  host?.close();guest?.close();await new Promise(resolve=>server.close(resolve));
 }
});
