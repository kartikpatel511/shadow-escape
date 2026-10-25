// Six strategically balanced server-owned runner skills; Q casts and R picks up Swap.
import {POWER_RULES} from '../shared/skills.js';
const $=id=>document.getElementById(id);
const ICONS={shattered:'⟡',yank:'↶',see:'◎',stealth:'◉',zone:'⌖',slow:'⌛',setSpeed:'↧',gravity:'✧',freeze:'◇',scramble:'☷',teleport:'⤨',bribe:'♡',boost:'⚡',rewind:'↶',invisible:'◌',swap:'⇄'};
// Client interpolation of server-authoritative expiry; pure so it can be tested.
// Never leave a victim trapped by a stale Boolean after the remaining time ends.
export function predictedEffects(effects,elapsedMs){
  const elapsed=Math.max(0,elapsedMs);
  const live=(key)=>Math.max(0,(effects[key]||0)-elapsed)>0;
  return {...effects,
    frozen:!!effects.frozen&&live('freezeMs'),
    zeroGravity:!!effects.zeroGravity&&live('gravityMs'),
    slow:!!effects.slow&&live('slowMs'),boost:!!effects.boost&&live('boostMs'),
    invisible:!!effects.invisible&&live('invisibleMs'),bribed:!!effects.bribed&&live('bribeMs'),
    scramble:live('scrambleMs')?effects.scramble:null,
    speedScale:live('speedMs')?effects.speedScale:1};
}
export function createPowerUI(send,notice){
  let active=false,roster=[],selfId=null,abilities=[],selected=0,cooldownMs=0,updatedAt=0,pickup=null,coins=300,swapCharges=0,hints={};
  let effects={},lastDraw=-1,facingYaw=0;
  const slots=$('skillSlots'),tier=$('powerTier');
  $('castPower').addEventListener('click',cast);
  $('collectPower').addEventListener('click',()=>send({type:'pickup'}));
  $('compassAction').addEventListener('click',castCompass);
  function currentSkill(){return abilities[selected]||null;}
  function castCompass(){
    if(!active||!abilities.includes('shattered'))return;
    if(timeLeft()>0){notice(`COMPASS RECHARGING · ${Math.ceil(timeLeft()/1000)}s LEFT`);return;}
    if(coins<POWER_RULES.shattered.cost){notice('NOT ENOUGH COINS FOR SHATTERED COMPASS');return;}
    send({type:'power',ability:'shattered'});
    notice('⟡ COMPASS ACTIVATED · ROTATE UNTIL THE ARROW POINTS UP · HUNTER CAN TRACK YOU');
  }
  function cast(){if(!active)return;const ability=currentSkill(),cfg=POWER_RULES[ability];if(!cfg)return;
    const targetId=cfg.targeted?$('powerTarget').value:undefined;
    if(cfg.targeted&&!targetId){notice('SELECT A RIVAL FIRST');return;}
    send({type:'power',ability,targetId,tier:tier.value,speedValue:Number($('powerSpeed').value)});
  }
  function rebuildTargets(){const el=$('powerTarget'),old=el.value;el.replaceChildren();
    const skill=POWER_RULES[currentSkill()],runnersOnly=skill?.category==='attack'||skill?.category==='pickup';
    const candidates=roster.filter(p=>p.id!==selfId&&(!runnersOnly||p.role==='runner'));
    const first=candidates[0]?.id;
    for(const p of candidates){const o=document.createElement('option');o.value=p.id;o.textContent=`${p.role==='hunter'?'☠':'✦'} ${p.name}`;el.append(o);}
    el.value=candidates.some(p=>p.id===old)?old:first||'';
  }
  function selectSlot(i){if(i<0||i>=abilities.length)return;selected=i;rebuildTargets();draw(true);}
  function showLoadout(){slots.replaceChildren();for(let i=0;i<abilities.length;i++){
      const k=abilities[i],cfg=POWER_RULES[k],button=document.createElement('button');button.type='button';button.className='skill-slot';
      button.textContent=`${i<6?i+1:'✦'}  ${ICONS[k]||'◇'}  ${cfg?.label||k}`;
      button.title=`${cfg?.description} · ${cfg?.cost} coins`;button.addEventListener('click',()=>selectSlot(i));slots.append(button);
    }}
  function start(msg,id){active=true;selfId=id;roster=msg.players;abilities=[...(msg.power?.abilities||[])];selected=0;
    cooldownMs=msg.power?.cooldownMs||0;updatedAt=performance.now();effects=msg.power?.effects||{};effectUpdatedAt=performance.now();hints=msg.power?.hints||{};
    coins=msg.power?.coins??msg.coins??300;swapCharges=msg.power?.swapCharges||0;pickup=null;
    $('powerHUD').hidden=abilities.length===0;$('shatteredCompassHUD').hidden=!abilities.includes('shattered');rebuildTargets();showLoadout();draw(true);}
  function snapshot(m){if(!active)return;const state=m.power||{};
    if(state.abilities?.length){const updated=[...state.abilities];if(swapCharges>0)updated.push('swap');
      if(updated.join('|')!==abilities.join('|')){abilities=updated;if(!abilities[selected])selected=0;showLoadout();}}
    if(state.cooldownMs!==undefined){cooldownMs=state.cooldownMs;updatedAt=performance.now();}
    if(state.coins!==undefined)coins=state.coins;
    if(state.swapCharges!==undefined){const changed=swapCharges!==state.swapCharges;swapCharges=state.swapCharges;
      abilities=abilities.filter(a=>a!=='swap');if(swapCharges)abilities.push('swap');
      if(selected>=abilities.length)selected=0;if(changed)showLoadout();}
    effects=state.effects||effects;effectUpdatedAt=performance.now();hints=state.hints||hints;pickup=m.pickup||null;draw(true);
  }
  function result(m){if(!active)return;coins=m.coins??coins;cooldownMs=Math.max(0,m.readyAt-Date.now());updatedAt=performance.now();
    const title=POWER_RULES[m.ability]?.label||m.ability;
    notice(`${ICONS[m.ability]||'✦'} ${title} · -${m.cost} COINS`);draw(true);}
  function hit(m){
    // Apply the effect immediately instead of relying on notification alone;
    // subsequent authoritative snapshots refresh/expire it on the victim.
    if(m.ability==='freeze')effects={...effects,frozen:true};
    if(m.ability==='gravity')effects={...effects,zeroGravity:true};
    if(m.ability==='scramble')effects={...effects,scramble:effects.scramble||{up:'right',right:'down',down:'left',left:'up'}};
    if(m.ability==='slow')effects={...effects,slow:true};
    // Prefer the full state verified by the server over local effect guesses.
    if(m.effects)effects=m.effects;
    effectUpdatedAt=performance.now();
    notice(`⚠ ${POWER_RULES[m.ability]?.label||m.ability} USED ON YOU`);draw(true);
  }
  function picked(m){swapCharges=m.swapCharges||1;abilities=abilities.filter(k=>k!=='swap').concat('swap');selected=abilities.length-1;
    pickup=null;showLoadout();notice('⇄ SWAP CRYSTAL COLLECTED · EXTRA GROUND SKILL UNLOCKED');draw(true);}
  function land(){effects={...effects,zeroGravity:false,gravityMs:0,frozen:true,freezeMs:1200};effectUpdatedAt=performance.now();draw(true);}
  function playerLeft(id){roster=roster.filter(p=>p.id!==id);rebuildTargets();}
  const timeLeft=()=>Math.max(0,cooldownMs-(performance.now()-updatedAt));
  function effectiveEffects(){return predictedEffects(effects,performance.now()-effectUpdatedAt);}
  function effectExpired(name){
    if(name==='freeze'){effects={...effects,frozen:false,freezeMs:0};effectUpdatedAt=performance.now();}
    draw(true);
  }
  function showVictimTimer(){
    const panel=$('effectTimerHUD');if(!panel)return;
    // The server sends the authoritative remaining milliseconds on every
    // snapshot. Only interpolate locally between updates for a smooth timer.
    const elapsed=Math.max(0,performance.now()-effectUpdatedAt);
    const freezeLeft=Math.max(0,(effects.freezeMs||0)-elapsed);
    const gravityLeft=Math.max(0,(effects.gravityMs||0)-elapsed);
    const isGravity=gravityLeft>0;
    const left=isGravity?gravityLeft:freezeLeft;
    panel.hidden=left<=0;
    if(left<=0)return;
    $('effectTimerIcon').textContent=isGravity?'✧':'❄';
    $('effectTimerName').textContent=isGravity?'ZERO GRAVITY':'FROZEN';
    $('effectTimerSeconds').textContent=`${Math.ceil(left/1000)}s LEFT`;
    $('effectTimerHelp').textContent=isGravity?'Aerial tosses end when this timer reaches zero.':'Movement unlocks when this timer reaches zero.';
    panel.classList.toggle('gravity-status',isGravity);
    const duration=isGravity?POWER_RULES.gravity.durationMs:POWER_RULES.freeze.durationMs;
    $('effectTimerFill').style.width=`${Math.max(0,Math.min(100,left/duration*100))}%`;
  }
  function draw(force=false){if(!active)return;const n=Math.floor(performance.now()/200);if(!force&&n===lastDraw)return;lastDraw=n;showVictimTimer();
    const ability=currentSkill(),cfg=POWER_RULES[ability];if(!cfg)return;
    [...slots.children].forEach((b,i)=>b.classList.toggle('selected',i===selected));
    $('powerIcon').textContent=ICONS[ability]||'✦';$('powerName').textContent=cfg.label;
    $('powerDescription').textContent=cfg.description;
    $('powerTargetRow').hidden=!cfg.targeted;tier.hidden=true;$('powerSpeed').hidden=ability!=='setSpeed';
    const cost=cfg.cost;
    $('skillCost').textContent=`◈ ${cost} COINS`;$('skillWallet').textContent=`◈ ${coins.toLocaleString()}`;
    const rem=timeLeft(),available=rem<=0&&coins>=cost;
    const btn=$('castPower');btn.disabled=!available;
    btn.textContent=rem>0?`COOLDOWN · ${Math.ceil(rem/1000)}s`:coins<cost?`NEED ${cost} COINS`:`USE ${cfg.label} [ Q ]`;
    $('powerProgress').style.width=`${Math.max(0,(1-rem/20000)*100)}%`;
    const liveEffects=effectiveEffects();
    const activeEffects=[liveEffects.frozen?'FROZEN':null,
      liveEffects.slow?'SLOWED':null,liveEffects.boost?'BOOSTED':null,liveEffects.invisible?'HIDDEN':null,liveEffects.bribed?'PROTECTED':null,
      liveEffects.scramble?'CONTROLS SCRAMBLED':null,liveEffects.zeroGravity?'FLOATING':null].filter(Boolean);
    $('powerEffects').textContent=activeEffects.join(' · ')||'20s GLOBAL COOLDOWN';
    const compass=hints.shattered;
    const screenSector=compass?((Math.round((facingYaw-compass.sector*Math.PI/4)/(Math.PI/4))%8)+8)%8:null;
    const dial=$('shatteredCompassHUD');dial.hidden=!abilities.includes('shattered');
    if(compass){
      $('compassArrow').textContent=['↑','↗','→','↘','↓','↙','←','↖'][screenSector];
      $('compassStrength').textContent=`${compass.strength} SIGNAL · ${Math.ceil(compass.remainingMs/1000)}s`;
      const instructions=['GO FORWARD','VEER RIGHT','TURN RIGHT','TURN RIGHT AND TURN AROUND','TURN AROUND','TURN LEFT AND TURN AROUND','TURN LEFT','VEER LEFT'];
      $('compassRoute').textContent=instructions[screenSector]+ ' · FACE ↑ AND RUN';
    }else{
      $('compassArrow').textContent='?';
      $('compassStrength').textContent='COMPASS INACTIVE';
      $('compassRoute').textContent='Press G or the button below to get a clue';
    }
    const strength=compass?.strength==='STRONG'?3:compass?.strength==='GROWING'?2:compass?1:0;
    [...$('compassBars').children].forEach((bar,i)=>bar.classList.toggle('lit',i<strength));
    const compassButton=$('compassAction');
    compassButton.disabled=!!compass||timeLeft()>0||coins<POWER_RULES.shattered.cost;
    compassButton.textContent=compass?`⟡ SIGNAL ACTIVE · ${Math.ceil(compass.remainingMs/1000)}s`:
      timeLeft()>0?`COOLDOWN · ${Math.ceil(timeLeft()/1000)}s`:
      coins<POWER_RULES.shattered.cost?'NEED 75 COINS':`⟡ USE COMPASS [ G ] · 75 COINS`;
    $('compassWarning').textContent=compass?'⚠ HUNTER CAN TRACK YOU ON THEIR RADAR RIGHT NOW':'⚠ USING IT REVEALS YOU TO THE HUNTER FOR 20s';
    dial.classList.toggle('compass-is-active',!!compass);
    const arrows=['↑','↗','→','↘','↓','↙','←','↖'];
    $('skillHint').textContent=compass?`⟡ SHATTERED COMPASS: ${arrows[screenSector]} · ${compass.strength} · HUNTER CAN TRACK YOU (${Math.ceil(compass.remainingMs/1000)}s)`:
      hints.zone?`PORTAL REGION: ${hints.zone}`:'1–6 SELECT · Q USE · R COLLECT SWAP';
    $('skillHint').classList.toggle('compass-active',!!compass);
    const near=!!pickup;$('collectPower').hidden=!near;
    if(near){$('collectPower').disabled=!pickup.ready||swapCharges>0;
      $('collectPower').textContent=swapCharges?'⇄ SWAP ALREADY HELD':pickup.ready?'⇄ PICK UP SWAP [ R ]':`SWAP CRYSTAL · ${Math.ceil(pickup.remainingMs/1000)}s`;}
  }
  tier.addEventListener('change',()=>draw(true));
  function update(){draw();}
  function end(){active=false;$('powerHUD').hidden=true;$('shatteredCompassHUD').hidden=true;$('effectTimerHUD').hidden=true;}
  function reset(){end();abilities=[];selected=0;roster=[];pickup=null;effects={};effectUpdatedAt=0;swapCharges=0;}
  return {start,snapshot,result,hit,picked,land,effectExpired,playerLeft,update,end,reset,cast,castCompass,selectSlot,setYaw:value=>{facingYaw=value;},
    collect:()=>{if(active&&pickup?.ready&&swapCharges===0)send({type:'pickup'});},
    getCompassGuide:()=>hints.shattered?{sector:((Math.round((facingYaw-hints.shattered.sector*Math.PI/4)/(Math.PI/4))%8)+8)%8,strength:hints.shattered.strength}:null,
    getEffects:effectiveEffects};
}
