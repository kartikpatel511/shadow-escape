// HTTP and websocket entry point. Run with npm start; uses only Node built-ins.
import http from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {dirname,extname,resolve,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {RoomManager} from './server/rooms.mjs';
import {upgrade} from './server/websocket.mjs';

const ROOT=dirname(fileURLToPath(import.meta.url));
const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml'};
const port=Number(process.env.PORT||3000);
export const rooms=new RoomManager();
export const server=http.createServer(async(req,res)=>{
  try{
    if(req.method!=='GET'){res.writeHead(405);res.end('Method not allowed');return;}
    const decoded=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    const target=resolve(ROOT,'.'+(decoded==='/'?'/index.html':decoded));
    if(target!==ROOT&&!target.startsWith(ROOT+sep)){res.writeHead(403);res.end('Forbidden');return;}
    const s=await stat(target);if(!s.isFile())throw Error('not file');
    res.writeHead(200,{'Content-Type':MIME[extname(target)]||'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
    res.end(await readFile(target));
  }catch{res.writeHead(404,{'Content-Type':'text/plain'});res.end('File not found');}
});
server.on('upgrade',(req,socket,head)=>{
  if(new URL(req.url,'http://localhost').pathname!=='/ws'){socket.destroy();return;}
  upgrade(req,socket,head,conn=>{
    conn.onmessage=msg=>rooms.handle(conn,msg);
    conn.onclose=()=>rooms.leave(conn,{grace:true});
    conn.send(JSON.stringify({type:'hello',message:'Connected to Riftbound server'}));
  });
});
// Server ticks at 30Hz. Snapshot updates sent at 10Hz; clients smoothly interpolate.
const tickTimer=setInterval(()=>rooms.tick(1/30),1000/30);
const snapshotTimer=setInterval(()=>rooms.snapshot(),100);
server.on('close',()=>{clearInterval(tickTimer);clearInterval(snapshotTimer);rooms.close();});
if(process.env.NODE_ENV!=='test')server.listen(port,'0.0.0.0',()=>console.log(`RIFTBOUND STEP 18 | http://localhost:${port} | Local-network play enabled`));
