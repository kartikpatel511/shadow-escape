// Minimal standards-compliant browser WebSocket endpoint, no third-party dependencies.
import {createHash} from 'node:crypto';
export function upgrade(req,socket,head,onOpen){
 const key=req.headers['sec-websocket-key'];if(!key||req.headers.upgrade?.toLowerCase()!=='websocket')return socket.destroy();
 const accept=createHash('sha1').update(key+'258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
 socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: '+accept+'\r\n\r\n');
 let buffer=Buffer.alloc(0),closed=false,notified=false;
 const conn={readyState:1,send(msg){if(closed||socket.destroyed)return;
   // A slow client must not build an unbounded TCP queue and kill the room.
   if(msg.includes('\"type\":\"snapshot\"')&&socket.writableLength>256_000)return;
   const data=Buffer.from(msg),n=data.length;let h;
   if(n<126){h=Buffer.from([0x81,n]);}else if(n<=65535){h=Buffer.alloc(4);h[0]=0x81;h[1]=126;h.writeUInt16BE(n,2);}else{h=Buffer.alloc(10);h[0]=0x81;h[1]=127;h.writeBigUInt64BE(BigInt(n),2);}
   socket.write(Buffer.concat([h,data]));},close(){if(closed)return;closed=true;socket.end(Buffer.from([0x88,0]));},onmessage:null,onclose:null};
 function parse(){while(buffer.length>=2){const b0=buffer[0],b1=buffer[1];let n=b1&127,off=2;
   if(n===126){if(buffer.length<4)return;n=buffer.readUInt16BE(2);off=4;}
   if(n===127){if(buffer.length<10)return;const x=buffer.readBigUInt64BE(2);if(x>BigInt(100000))return conn.close();n=Number(x);off=10;}
   if(n>100000)return conn.close();if(!(b1&128))return conn.close();if(buffer.length<off+4+n)return;
   const mask=buffer.subarray(off,off+4),data=Buffer.from(buffer.subarray(off+4,off+4+n));buffer=buffer.subarray(off+4+n);
   for(let i=0;i<n;i++)data[i]^=mask[i%4];
   const opcode=b0&15;if(opcode===8){conn.close();return;}
   if(opcode===9){socket.write(Buffer.from([0x8a,data.length,...data]));continue;}
   if(opcode===1&&b0&0x80){try{conn.onmessage?.(JSON.parse(data.toString('utf8')));}catch{}}
  }}
 socket.on('data',d=>{if(closed)return;buffer=Buffer.concat([buffer,d]);if(buffer.length>110000)return conn.close();parse();});
 const end=()=>{if(notified)return;notified=true;closed=true;conn.readyState=3;conn.onclose?.();};
 socket.on('close',end);socket.on('error',end);if(head.length){buffer=Buffer.concat([buffer,head]);parse();}onOpen(conn);
}
