import test from 'node:test';
import assert from 'node:assert/strict';

function receive(socket,type,timeout=4500){
 return new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>{socket.removeEventListener('message',check);reject(Error(`Timed out waiting for ${type}`));},timeout);
  function check(e){try{const msg=JSON.parse(e.data);if(msg.type===type){clearTimeout(timer);socket.removeEventListener('message',check);resolve(msg);}}catch{}}
  socket.addEventListener('message',check);
 });
}
function connected(url){return new Promise((resolve,reject)=>{const ws=new WebSocket(url);ws.addEventListener('open',()=>resolve(ws),{once:true});ws.addEventListener('error',reject,{once:true});});}
test('two real WebSocket clients can create, join, start and move in one shared 3D world',async()=>{
 process.env.NODE_ENV='test';
 const {server}=await import('../server.mjs');
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const url=`ws://127.0.0.1:${server.address().port}/ws`;
 const a=await connected(url),b=await connected(url);
 try{
  const hostJoin=receive(a,'joined');a.send(JSON.stringify({type:'create',capacity:2,name:'Amber',skin:5}));
  const {room}=await hostJoin;assert.equal(room.players.length,1);
  const guestJoin=receive(b,'joined');const updated=receive(a,'room');
  b.send(JSON.stringify({type:'join',code:room.code,name:'Nova',skin:3}));
  assert.equal((await guestJoin).room.code,room.code);assert.equal((await updated).room.players.length,2);
  const hostStarted=receive(a,'started'),guestStarted=receive(b,'started');a.send(JSON.stringify({type:'start'}));
  const startA=await hostStarted,startB=await guestStarted;
  assert.equal(startA.players.length,2);assert.equal(startB.players.length,2);
  assert.notEqual(startA.players[0].skin,startA.players[1].skin);
  const before=startA.players.find(p=>p.id===startA.room.players[0].id);
  a.send(JSON.stringify({type:'input',seq:1,localRight:0,localForward:1,yaw:0,jump:false,sprint:true}));
  const first=await receive(a,'snapshot');assert.ok(first.players.some(p=>p.id===before.id));
  await new Promise(resolve=>setTimeout(resolve,380));
  const another=receive(a,'snapshot');const snap=await another;
  const moved=snap.players.find(p=>p.id===before.id);
  assert.ok(moved.z>before.z+1.2,`expected movement from ${before.z}, got ${moved.z}`);
  a.send(JSON.stringify({type:'input',seq:2,localRight:0,localForward:0,yaw:0}));
  const hostChanged=receive(b,'room');a.send(JSON.stringify({type:'leave'}));
  const updatedRoom=(await hostChanged).room;assert.equal(updatedRoom.players.length,1);
  assert.equal(updatedRoom.hostId,updatedRoom.players[0].id);
 }finally{
  a.close();b.close();
  await new Promise(resolve=>server.close(resolve));
 }
});
