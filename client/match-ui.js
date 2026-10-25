// Competitive eight-minute round presentation. The server alone decides
// portal contact, who escaped first, and why the match ended.
import {POWER_RULES} from '../shared/skills.js';
const $=id=>document.getElementById(id);
const ROUND_MS=8*60*1000;
const PORTAL_USE_METERS=7.5;
const SKIN_COLORS=['#73e8b6','#e2a17b','#bc91e7','#76b9ee','#edc16d','#eb809d','#87dfe7','#c4dd8c','#f3b2bd'];
const REASONS=Object.freeze({
  escaped:'A runner reached the time portal first and returned to the real world.',
  timeout:'The eight-minute countdown expired before any runner escaped.',
  hunter_disconnected:'The hunter left and did not reconnect. The match was cancelled.',
  all_runners_left:'Every runner left the realm. There was no one left to hunt.',
  abandoned:'The match was stopped before an escape could happen.'
});
export function createMatchUI(send){
  let localRole=null,active=false,signal=null,host=false,remainingMs=ROUND_MS,syncedAt=0,warned=false,previousRange=null;
  function requestEscape(){
    if(!active||localRole!=='runner'||!signal||signal.distance>PORTAL_USE_METERS)return false;
    send({type:'escape'});return true; // No confusing double-tap confirmation.
  }
  $('escapeButton').addEventListener('click',requestEscape);
  $('dismissRole').addEventListener('click',()=>{$('roleIntro').hidden=true;});
  $('rematchButton').addEventListener('click',()=>send({type:'start'}));
  $('endLeave').addEventListener('click',()=>{$('leaveGame').click();$('roundEnd').hidden=true;});
  function start(message,id){
    const self=message.players.find(p=>p.id===id);
    localRole=self?.role??'runner';active=true;signal=null;host=message.room.hostId===id;previousRange=null;
    remainingMs=message.roundRemainingMs??ROUND_MS;syncedAt=performance.now();warned=false;
    $('roundEnd').hidden=true;$('roleIntro').hidden=false;$('escapeButton').hidden=true;$('portalNotice').hidden=true;
    const hunter=localRole==='hunter';
    document.body.classList.toggle('is-hunter',hunter);
    $('roleIntro').className='match-modal'+(hunter?' hunter-modal':'');
    $('roleIcon').textContent=hunter?'♜':'✦';
    $('roleHeading').textContent=hunter?'YOU ARE THE HUNTER':'YOU ARE A RUNNER';
    $('roleDescription').textContent=hunter?
      'Protect the hidden portal. Aim through your hunter scope [B / right-click], fire with H or the fire button, and stop every escape until the clock reaches zero.':
      'Find the shining time-travel portal before anyone else. Shattered Compass gives a rough heading but reveals your location to the hunter. Reach the gate to win instantly!';
    $('roundInstructions').textContent=hunter?
      'WASD to move, Shift sprint, mouse drag to look. Press B or right-click for scope, H or FIRE to shoot. Prevent escapes for 8:00 to win.':
      'WASD to move in any direction, Shift sprint, SPACE jump, E car, V switch camera. Cross rivers and ponds freely. First runner through the glowing portal wins within 8:00. Press G to use Shattered Compass: face the arrow until it points ↑ and move forward. The hunter sees you while it is active.';
    const guide=$('roundSkillGuide');guide.replaceChildren();
    $('roundSkillTitle').textContent=hunter?'YOUR HUNTER ABILITIES':'YOUR POWERS — 1–6 SELECT · Q CAST · G COMPASS';
    const assigned=hunter?[]:(message.power?.abilities||[]);
    if(hunter){const b=document.createElement('span');b.textContent='Use your scope and blaster. You do not get runner skills.';guide.append(b);}
    for(const [i,key] of assigned.entries()){
      const rule=POWER_RULES[key];if(!rule)continue;
      const item=document.createElement('div'),title=document.createElement('strong'),body=document.createElement('small');
      title.textContent=`${i+1} · ${rule.label} (${rule.cost} coins)`;
      body.textContent=rule.description;
      item.append(title,body);guide.append(item);
    }
    $('roleBadge').textContent=hunter?'HUNTER':'RUNNER';
    $('roleObjective').textContent=hunter?'STOP THE ESCAPE':'FIND THE SECRET GATE';
    $('objectiveHint').textContent=hunter?'B toggles scope · H fires · survive all eight minutes.':
      'Search for the brilliant blue time portal. Shattered Compass offers an approximate heading.';
    $('roleBadge').classList.toggle('hunter',hunter);$('roleHUD').hidden=false;
    $('missionTitle').textContent=hunter?'HUNT THE RUNNERS':'FIND THE SECRET EXIT';
    $('missionSub').textContent=hunter?'Scope · fire · stop escapes':'First runner through the portal wins';
    $('sessionState').textContent=hunter?'HUNTER ASSIGNED':'ESCAPE ROUND ACTIVE';
    $('matchTimer').textContent='08:00';$('roleHUD').classList.remove('time-critical');
  }
  function snapshot(nextSignal,serverRemainingMs,portalVisible=null){
    if(!active)return;
    if(Number.isFinite(serverRemainingMs)){remainingMs=Math.max(0,serverRemainingMs);syncedAt=performance.now();}
    if(localRole!=='runner')return;
    signal=nextSignal;
    const near=signal!==null,atGate=near&&signal.distance<=PORTAL_USE_METERS;
    $('portalNotice').hidden=!near;
    if(near){
      const bands=atGate?'ENTER':signal.distance<=18?'VERY CLOSE':'NEAR';
      $('portalNotice').classList.toggle('portal-imminent',atGate);
      $('portalNoticeTitle').textContent=atGate?'THE PORTAL IS OPEN — ESCAPE!':'YOU ARE NEAR THE DOOR!';
      $('portalNoticeHint').textContent=atGate?'STEP THROUGH TO WIN · OR PRESS F':
        `ONLY ${Math.ceil(signal.distance)}m AWAY · FOLLOW THE BRIGHT BLUE GLOW`;
      previousRange=bands;
    }else previousRange=null;
    $('escapeButton').hidden=!near;
    $('escapeButton').disabled=!atGate;
    $('escapeButton').textContent=atGate?'✦ ENTER PORTAL · WIN THE MATCH [ F ]':
      `✧ TIME PORTAL NEARBY · ${Math.ceil(signal.distance)} m`;
    $('objectiveHint').textContent=atGate?'CROSS THE PORTAL TO WIN NOW!':near?
      `You are ${Math.ceil(signal.distance)}m from the door. Follow its blue aura.`:
      portalVisible?'The huge shining portal is in sight—head toward its light.':
      'Search for the time portal. Shattered Compass gives a rough bearing at a risk.';
  }
  function end(message,id){
    active=false;signal=null;previousRange=null;$('roleIntro').hidden=true;$('roundEnd').hidden=false;
    $('escapeButton').hidden=true;$('portalNotice').hidden=true;
    const winner=message.winnerId!=null,won=message.winnerId===id;
    const hunterWon=message.reason==='timeout'&&winner;
    const escaped=message.reason==='escaped';
    $('endSymbol').textContent=winner?'🏆': '⌛';
    $('winnerCrown').hidden=!winner;$('winnerName').hidden=!winner;
    $('winnerPodium').hidden=!winner;
    const winnerSkin=message.room?.players?.find(p=>p.id===message.winnerId)?.skin??0;
    $('winnerAvatar').style.setProperty('--avatar-color',hunterWon?'#9e344d':(SKIN_COLORS[winnerSkin]||SKIN_COLORS[0]));
    $('winnerPodium').classList.toggle('hunter-winner',hunterWon);
    $('winnerName').textContent=winner?message.winnerName||'Unknown winner':'';
    $('endHeading').textContent=won?'YOU WON THE MATCH!':winner?'MATCH OVER':'GAME ENDED';
    $('endReason').textContent=message.reason==='timeout'?'TIME LIMIT REACHED':
      escaped?'FIRST RUNNER ESCAPED':message.reason==='hunter_disconnected'?'HUNTER DISCONNECTED':
      message.reason==='all_runners_left'?'RUNNERS LEFT THE GAME':'ROUND CANCELLED';
    const summary=REASONS[message.reason]||'The round ended.';
    $('endDescription').textContent=winner?(won?
      `${summary} Congratulations, ${message.winnerName}! You are the ${hunterWon?'ultimate hunter':'first survivor'}!`:
      `${summary} ${message.winnerName} (${hunterWon?'HUNTER':'RUNNER'}) takes the crown.`):summary;
    host=message.room.hostId===id;
    $('rematchButton').hidden=!host;$('endWaiting').hidden=host;
    $('endWaiting').textContent='Waiting for the host to launch another round…';
    $('roleObjective').textContent=won?'VICTORY':winner?'MATCH FINISHED':'GAME ENDED';
    $('sessionState').textContent=won?'YOU WON THE MATCH':winner?'MATCH OVER':'ROUND CANCELLED';
  }
  function update(now){if(!active)return;
    const ms=Math.max(0,remainingMs-(now-syncedAt));const total=Math.ceil(ms/1000);
    $('matchTimer').textContent=`${String(Math.floor(total/60)).padStart(2,'0')}:${String(total%60).padStart(2,'0')}`;
    $('roleHUD').classList.toggle('time-critical',ms<=60000);
    if(ms<=60000&&!warned){warned=true;$('missionSub').textContent='FINAL MINUTE · ESCAPE OR BE HUNTED';}
  }
  function reset(){localRole=null;active=false;signal=null;previousRange=null;
    document.body.classList.remove('is-hunter');$('roleHUD').hidden=true;$('roleHUD').classList.remove('time-critical');
    $('roleIntro').hidden=true;$('roundEnd').hidden=true;$('escapeButton').hidden=true;$('portalNotice').hidden=true;}
  return {start,snapshot,end,update,reset,requestEscape,get role(){return localRole;},get signal(){return signal;},get active(){return active;}};
}
