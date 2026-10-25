// Reliable browser WebSocket with reconnect and app-level heartbeat.
// Short blips do not destroy room state; session resume is handled by main.js.
export class GameConnection {
  constructor(onMessage,onStatus){
    this.onMessage=onMessage;this.onStatus=onStatus;this.socket=null;
    this.retry=null;this.heartbeat=null;this.attempt=0;this.enabled=true;
    this.state='connecting';
  }
  connect(){
    if(!this.enabled)return;
    // A stale socket cannot silently deliver packets after a new socket opens.
    if(this.socket&&[WebSocket.CONNECTING,WebSocket.OPEN].includes(this.socket.readyState))this.socket.close();
    clearTimeout(this.retry);clearInterval(this.heartbeat);
    this.state='connecting';this.onStatus('connecting');
    const scheme=location.protocol==='https:'?'wss':'ws';
    if(location.protocol==='file:'){
      this.onStatus('offline');return;
    }
    const ws=new WebSocket(`${scheme}://${location.host}/ws`);
    this.socket=ws;
    ws.onopen=()=>{
      if(ws!==this.socket)return;
      this.attempt=0;this.state='connected';this.onStatus('connected');
      this.heartbeat=setInterval(()=>{
        if(ws===this.socket&&ws.readyState===WebSocket.OPEN)
          ws.send(JSON.stringify({type:'ping',sent:Date.now()}));
      },12000);
    };
    ws.onmessage=e=>{
      if(ws!==this.socket)return;
      try{this.onMessage(JSON.parse(e.data));}catch(err){console.warn('Invalid multiplayer packet',err);}
    };
    ws.onerror=()=>{};
    ws.onclose=()=>{
      if(ws!==this.socket)return;
      clearInterval(this.heartbeat);
      this.state='offline';this.onStatus('offline');
      if(this.enabled){
        // Fast retry with a small capped exponential backoff for longer outages.
        const delay=Math.min(5000,750*(1.5**Math.min(this.attempt++,5)));
        this.retry=setTimeout(()=>this.connect(),delay);
      }
    };
  }
  send(message){
    if(this.socket?.readyState!==WebSocket.OPEN)return false;
    try{
      // Drop stale movement packets if network is already congested; snapshots
      // and gameplay events continue, and the latest movement replaces them.
      if(message?.type==='input'&&this.socket.bufferedAmount>24000)return false;
      this.socket.send(JSON.stringify(message));return true;
    }catch{return false;}
  }
  close(){this.enabled=false;clearTimeout(this.retry);clearInterval(this.heartbeat);this.socket?.close();}
}
