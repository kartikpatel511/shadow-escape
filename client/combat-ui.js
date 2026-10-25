// Step 06 combat presentation. No browser-calculated hits or respawns.
const $=id=>document.getElementById(id);
export function createCombatUI(send,notice){
  let active=false,isHunter=false,downUntil=0,shieldUntil=0,shotCooldown=0,scope=false;
  let cooldownAt=0,lastFired=0,shots=[],bonks=[];
  const button=$('fireButton'),scopeButton=$('scopeButton'),overlay=$('knockoutOverlay'),timer=$('knockoutTimer');
  function toggleScope(){if(!active||!isHunter)return;scope=!scope;scopeButton.textContent=scope?'◉ SCOPE ON [ B ]':'⌖ SCOPE [ B ]';document.body.classList.toggle('hunter-scoped',scope);}
  function display(){
    $('combatHUD').hidden=!active;
    button.hidden=!active||!isHunter;scopeButton.hidden=!active||!isHunter;
    document.body.classList.toggle('has-blaster',active&&isHunter);
  }
  button.addEventListener('click',()=>fire(window.shadowAim?.()));
  scopeButton.addEventListener('click',toggleScope);
  function start(message,id){
    active=true;isHunter=message.players.find(p=>p.id===id)?.role==='hunter';scope=false;document.body.classList.remove('hunter-scoped');scopeButton.textContent='⌖ SCOPE [ B ]';
    downUntil=0;shieldUntil=0;lastFired=-Infinity;shotCooldown=0;cooldownAt=0;shots=[];bonks=[];
    $('blasterState').textContent=isHunter?'HUNTER BLASTER · READY':'RUNNER · AVOID THE BLASTER';
    overlay.hidden=true;display();
  }
  function fire(aim){
    if(!active||!isHunter||!aim)return;
    if(performance.now()-lastFired<850)return;
    lastFired=performance.now();
    shotCooldown=850;cooldownAt=lastFired;
    send({type:'fire',aimX:aim.x,aimZ:aim.z});
    $('blasterState').textContent='BLASTER RECHARGING';
  }
  function shot(message){
    const t=performance.now()/1000;
    shots.push({t,origin:message.origin,end:message.end,hit:!!message.hitId});
    if(message.hitId){bonks.push({t,x:message.end.x,y:message.end.y-1.5,z:message.end.z});}
    if(shots.length>12)shots.shift();if(bonks.length>8)bonks.shift();
  }
  function hitConfirmed(m){notice(`💥 BONK! ${m.victimName.toUpperCase()} WILL RETURN IN 30s`);}
  function knockout(m){
    downUntil=m.downUntil;
    $('knockoutBy').textContent=`${m.hunterName} caught you!`;overlay.hidden=false;
    timer.textContent='30';
    notice('💥 BOING! YOU GOT BONKED!');
  }
  function snapshot(m){
    if(!active||!m?.combat)return;
    const c=m.combat;
    downUntil=c.downUntil||0;shieldUntil=c.shieldUntil||0;
    shotCooldown=c.shotCooldownMs||0;cooldownAt=performance.now();
    if(isHunter)display();
    // The server countdown is authoritative; this overlay is only a display.
    if(!isHunter&&downUntil>Date.now())overlay.hidden=false;
  }
  function respawned(m){downUntil=0;shieldUntil=Date.now()+(m.shieldMs||3000);overlay.hidden=true;
    notice('✦ BACK IN THE GAME! 3s SHIELD ACTIVE');}
  function update(){
    if(!active)return;
    const left=Math.max(0,downUntil-Date.now());
    overlay.hidden=left<=0;
    if(left>0)timer.textContent=String(Math.ceil(left/1000)).padStart(2,'0');
    if(isHunter){
      const cooldown=Math.max(0,shotCooldown-(performance.now()-cooldownAt));
      button.disabled=cooldown>0;
      button.textContent=cooldown>0?`◌ RECHARGING ${Math.ceil(cooldown/100)/10}s`:'◎ FIRE · H';
      $('blasterState').textContent=cooldown>0?'BLASTER RECHARGING':'HUNTER BLASTER · READY';
    }else if(shieldUntil>Date.now()){
      $('blasterState').textContent=`✦ RESPAWN SHIELD · ${Math.ceil((shieldUntil-Date.now())/1000)}s`;
    }else $('blasterState').textContent=left>0?'KNOCKED OUT':'RUNNER · AVOID THE BLASTER';
    const now=performance.now()/1000;
    shots=shots.filter(x=>now-x.t<.42);bonks=bonks.filter(x=>now-x.t<2.4);
  }
  function end(){scope=false;document.body.classList.remove('hunter-scoped');active=false;isHunter=false;downUntil=0;shieldUntil=0;shots=[];bonks=[];overlay.hidden=true;$('combatHUD').hidden=true;document.body.classList.remove('has-blaster');}
  const reset=end;
  return {start,fire,shot,hitConfirmed,knockout,snapshot,respawned,update,end,reset,toggleScope,get scope(){return scope;},
    get down(){return downUntil>Date.now();},get shielded(){return shieldUntil>Date.now();},
    get shots(){return shots;},get bonks(){return bonks;},get hunter(){return isHunter;}};
}
