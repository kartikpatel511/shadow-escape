// Step 04 HUD for location purchases. All balances, reveals and locations come
// from the server; this module handles only display and button clicks.
const $=id=>document.getElementById(id);
const DEFAULT_COST=150;
export function createRadarUI(send,notice){
  let active=false,coins=0,cost=DEFAULT_COST,durationMs=12_000;
  let playerRecords=[],selfId=null,snapshotTime=0,contacts=new Map();
  let lastDraw=-1;
  function start(message,id){
    active=true;selfId=id;coins=message.coins??300;cost=message.radarRules?.cost??DEFAULT_COST;durationMs=message.radarRules?.durationMs??12_000;
    playerRecords=message.players.filter(p=>p.id!==id);
    contacts.clear();snapshotTime=performance.now();lastDraw=-1;
    $('radarShop').hidden=true;$('radarPrice').textContent=cost;$('radarDuration').textContent=durationMs/1000;draw(true);
  }
  function snapshot(data){
    if(!active||!data)return;
    coins=data.coins;
    snapshotTime=performance.now();
    contacts=new Map((data.contacts||[]).map(contact=>[contact.id,{...contact}]));
    draw(true);
  }
  function purchaseResult(message){
    coins=message.coins;
    notice(`◈ -${message.cost} COINS · ${message.targetName.toUpperCase()} REVEALED · THEY CAN SEE YOU TOO`);
    draw(true);
  }
  function alert(message){
    notice(`⚠ ${message.buyerName.toUpperCase()} REVEALED YOUR LOCATION · YOU CAN TRACK THEM TOO`);
    draw(true);
  }
  function playerLeft(id){playerRecords=playerRecords.filter(p=>p.id!==id);contacts.delete(id);draw(true);}
  function getContacts(){
    if(!active)return [];
    const elapsed=performance.now()-snapshotTime;
    return [...contacts.values()].map(c=>({...c,remainingMs:c.remainingMs-elapsed})).filter(c=>c.remainingMs>0);
  }
  function draw(force=false){
    if(!active)return;
    const time=Math.floor(performance.now()/250);
    if(!force && time===lastDraw)return;
    lastDraw=time;
    $('coinBalance').textContent=coins.toLocaleString();
    const activeContacts=new Map(getContacts().map(c=>[c.id,c]));
    $('revealCount').textContent=`${activeContacts.size} ACTIVE`;
    const list=$('radarTargets');
    // Roster is capped at 12 so rebuilding it is cheap, and all strings use
    // textContent rather than HTML to prevent player-name injection.
    list.replaceChildren();
    for(const player of playerRecords){
      const contact=activeContacts.get(player.id);
      const item=document.createElement('div');item.className='radar-target';
      const marker=document.createElement('span');marker.className='radar-role-icon';
      marker.textContent=player.role==='hunter'?'♜':'✦';marker.classList.toggle('danger',player.role==='hunter');
      const name=document.createElement('div');name.className='radar-target-name';
      const strong=document.createElement('strong');strong.textContent=player.name;
      const small=document.createElement('small');small.textContent=player.role==='hunter'?'HUNTER':'RUNNER';
      name.append(strong,small);
      const button=document.createElement('button');button.type='button';button.className='reveal-buy';
      if(contact){button.disabled=true;button.classList.add('tracking');button.textContent=`${contact.source==='stealth'?'GHOST':contact.source==='shattered'?'COMPASS':'LIVE'} ${Math.ceil(contact.remainingMs/1000)}s`;
        if(contact.source==='stealth')button.title='Your one-way Ghost Radar power. This target cannot see your position.';}
      else{button.disabled=coins<cost;button.textContent=`◈ ${cost}`;button.title=`Spend ${cost} coins to show ${player.name} on both of your minimaps for ${durationMs/1000} seconds`;button.addEventListener('click',()=>send({type:'reveal',targetId:player.id}));}
      item.append(marker,name,button);list.append(item);
    }
    $('radarEmpty').hidden=playerRecords.length!==0;
  }
  function update(){draw();}
  function end(){active=false;contacts.clear();playerRecords=[];$('radarShop').hidden=true;}
  function reset(){end();coins=0;}
  return {start,snapshot,purchaseResult,alert,playerLeft,getContacts,update,end,reset,get coins(){return coins;}};
}
