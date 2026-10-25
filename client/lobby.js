// Forms and lobby presentation, not gameplay authority.
const $=id=>document.getElementById(id);
const colorValues=['#73e8b6','#e2a17b','#bc91e7','#76b9ee','#edc16d','#eb809d','#87dfe7','#c4dd8c','#f3b2bd'];
export function createLobby(send,notice){
  let room=null,selfId=null,selectedSkin=0,online=false;
  const name=$('playerName'),code=$('joinCode'),capacity=$('roomCapacity'),screen=$('startScreen');
  const swatches=$('skinPicker');
  const avatarNames=['MINT','EMBER','VIOLET','SKY','GOLD','ROSE','CYAN','LIME','BLUSH'];
  colorValues.forEach((color,index)=>{
    const btn=document.createElement('button');btn.type='button';btn.className='skin-option';btn.style.setProperty('--swatch',color);btn.title=`Character color ${index+1}`;btn.setAttribute('aria-label',`Character color ${index+1}`);
    btn.innerHTML='<span class="mini-avatar"><i></i><b></b></span>';btn.addEventListener('click',()=>{selectedSkin=index;updateSwatches();});swatches.append(btn);
  });
  function updateSwatches(){[...swatches.children].forEach((btn,i)=>btn.classList.toggle('selected',i===selectedSkin));
    $('selectedAvatar').style.setProperty('--avatar-color',colorValues[selectedSkin]);$('avatarLabel').textContent=`${avatarNames[selectedSkin]} EXPLORER`;}updateSwatches();
  const fromLink=new URLSearchParams(location.search).get('room');if(fromLink)code.value=fromLink.toUpperCase().slice(0,5);
  try{name.value=localStorage.getItem('shadowEscapeName')||'';}catch{}
  function readyToConnect(){$('lobbyError').textContent='';if(!online){notice('Connecting to game server…');return false;}try{localStorage.setItem('shadowEscapeName',name.value.trim());}catch{}return true;}
  function values(){return {name:name.value.trim().slice(0,16)||'Explorer',skin:selectedSkin};}
  $('createRoom').addEventListener('click',()=>{if(readyToConnect())send({type:'create',...values(),capacity:Number(capacity.value)});});
  $('joinRoom').addEventListener('click',()=>{if(readyToConnect())send({type:'join',...values(),code:code.value.trim().toUpperCase()});});
  code.addEventListener('input',()=>code.value=code.value.toUpperCase().replace(/[^A-Z2-9]/g,'').slice(0,5));
  code.addEventListener('keydown',e=>{if(e.key==='Enter')$('joinRoom').click();});
  $('launchRoom').addEventListener('click',()=>send({type:'start'}));
  // Clicking 'leave' once only arms a confirmation. Keyboard space/enter
  // on a focused HUD button must never silently disconnect a playing user.
  let leaveConfirmUntil=0;
  function leave(event){
    if(event?.detail===0 && document.body.classList.contains('in-game')&&$('roundEnd').hidden)return;
    if(document.body.classList.contains('in-game')&&performance.now()>leaveConfirmUntil){
      leaveConfirmUntil=performance.now()+3500;
      $('leaveGame').textContent='CONFIRM LEAVE?';
      notice('Click LEAVE again to exit the multiplayer room.');
      event?.currentTarget?.blur();return;
    }
    leaveConfirmUntil=0;send({type:'leave'});setRoom(null);screen.hidden=false;document.body.classList.remove('in-game');
    $('leaveGame').textContent='LEAVE ROOM ↗';
  }
  $('leaveRoom').addEventListener('click',leave);
  $('leaveGame').addEventListener('click',leave);
  $('copyCode').addEventListener('click',async()=>{
    if(!room)return;
    const link=new URL(location.href);link.searchParams.set('room',room.code);
    try{await navigator.clipboard.writeText(link.toString());notice('Invite link copied • Friends open the same server');}
    catch{notice(`Room code: ${room.code} • Share this with friends`);}
  });
  function setOnline(value){online=value;$('netStatus').textContent=value?'● SERVER CONNECTED':'○ CONNECTING…';$('netStatus').classList.toggle('offline',!value);
    $('createRoom').disabled=!value;$('joinRoom').disabled=!value;
  }
  function setRoom(data,id=selfId){room=data;selfId=id;
    screen.hidden=data?.phase==='exploring' || data?.phase==='finished';
    $('entryView').hidden=!!room;$('roomView').hidden=!room;
    if(!room){$('roomBadge').textContent='NO ROOM';$('sessionState').textContent='CREATE A ROOM TO BEGIN';$('playerTotal').textContent='0 / 0';$('squadList').replaceChildren();return;}
    $('roomCode').textContent=room.code;$('roomBadge').textContent=`ROOM ${room.code}`;
    $('playerTotal').textContent=`${room.players.length} / ${room.capacity}`;
    $('sessionState').textContent=room.phase==='lobby'?'LOBBY • WAITING FOR PLAYERS':room.phase==='finished'?'ROUND FINISHED':'HUNT & ESCAPE • LIVE';
    $('lobbyCount').textContent=`${room.players.length} OF ${room.capacity} CONNECTED`;
    const isHost=room.hostId===selfId;
    $('hostHint').textContent=isHost?'You are the host. Invite friends and launch the session.':'Waiting for the host to launch the session.';
    $('launchRoom').hidden=!isHost;
    $('launchRoom').disabled=room.players.length<2;
    $('launchRoom').textContent=room.players.length<2?'WAITING FOR 2 PLAYERS':'START ESCAPE ROUND ↗';
    for(const target of [$('lobbyRoster'),$('squadList')]){
      target.replaceChildren();
      for(const p of room.players){const item=document.createElement('div');item.className='squad-member';
        const dot=document.createElement('span');dot.className='squad-swatch mini-avatar';dot.style.setProperty('--swatch',colorValues[p.skin]||colorValues[0]);
        dot.innerHTML='<i></i><b></b>';
        const label=document.createElement('span');label.textContent=p.name+(p.id===selfId?' (YOU)':'');
        const badge=document.createElement('small');badge.textContent=p.host?'HOST':'PLAYER';
        item.append(dot,label,badge);target.append(item);
      }
    }
  }
  function started(){screen.hidden=true;document.body.classList.add('in-game');document.activeElement?.blur?.();leaveConfirmUntil=0;$('leaveGame').textContent='LEAVE ROOM ↗';}
  function reset(){setRoom(null);document.body.classList.remove('in-game');}
  return {setOnline,setRoom,started,reset,get room(){return room;},get selfId(){return selfId;},get skin(){return selectedSkin;},show:()=>screen.hidden=false};
}
