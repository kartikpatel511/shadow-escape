// Original ambient score synthesized by the browser with the Web Audio API.
// No licensed samples or external downloads. It starts only on a user gesture.
const CHORDS=[ [146.83,174.61,220.00], [116.54,146.83,174.61], [130.81,164.81,196], [130.81,164.81,220] ];
const MELODY=[293.66,349.23,440,349.23,261.63,329.63,392,329.63];
export function createAudio(){
  let ctx=null,bus=null,interval=null,beat=0,next=0,muted=false,started=false;
  try{muted=localStorage.getItem('shadowEscapeMuted')==='yes';}catch{}
  const button=document.getElementById('musicToggle');
  function display(){button.textContent=muted?'♫ MUSIC OFF':'♫ MUSIC ON';button.setAttribute('aria-pressed',String(!muted));}
  display();
  function setup(){
    if(ctx)return !!ctx;
    const AudioContext=window.AudioContext||window.webkitAudioContext;
    if(!AudioContext)return false;
    try{ctx=new AudioContext();bus=ctx.createGain();bus.gain.value=.10;bus.connect(ctx.destination);next=ctx.currentTime+.08;return true;}
    catch{return false;}
  }
  function tone(frequency,at,length,vol=.065,type='sine'){
    if(!ctx||!bus)return;
    const oscillator=ctx.createOscillator(),gain=ctx.createGain(),lowpass=ctx.createBiquadFilter();
    oscillator.type=type;oscillator.frequency.setValueAtTime(frequency,at);
    lowpass.type='lowpass';lowpass.frequency.value=type==='sine'?950:650;
    gain.gain.setValueAtTime(.0001,at);gain.gain.exponentialRampToValueAtTime(vol,at+Math.min(.5,length/4));
    gain.gain.exponentialRampToValueAtTime(.0001,at+length);
    oscillator.connect(lowpass);lowpass.connect(gain);gain.connect(bus);
    oscillator.start(at);oscillator.stop(at+length+.01);
  }
  function schedule(){
    if(!ctx||muted)return;
    // 68 BPM; gentle minor progression, airy drones and restrained bell motif.
    const duration=60/68;
    while(next<ctx.currentTime+.9){
      const bar=Math.floor(beat/4)%4,which=beat%4;
      if(which===0){for(const freq of CHORDS[bar]){tone(freq,next,duration*3.96,.11,'sine');tone(freq/2,next,duration*3.96,.023,'triangle');}}
      if(beat%2===0)tone(MELODY[(beat/2)%MELODY.length],next+.12,duration*1.40,.075,'sine');
      if(which===2)tone(CHORDS[bar][0]*2,next+.15,duration*1.25,.026,'triangle');
      beat++;next+=duration;
    }
  }
  async function start(){
    if(muted||!setup())return;
    try{await ctx.resume();}catch{return;}
    if(interval===null){next=ctx.currentTime+.04;schedule();interval=setInterval(schedule,350);}started=true;display();
  }
  function stop(){if(interval!==null){clearInterval(interval);interval=null;}if(bus&&ctx)bus.gain.setTargetAtTime(muted?0:.10,ctx.currentTime,.08);}
  function toggle(){muted=!muted;try{localStorage.setItem('shadowEscapeMuted',muted?'yes':'no');}catch{}
    if(muted)stop();else{if(bus&&ctx)bus.gain.value=.10;start();}display();}
  function sound(frequency=640){
    if(muted||!ctx||ctx.state!=='running')return;
    tone(frequency,ctx.currentTime,.42,.12,'triangle');tone(frequency*1.5,ctx.currentTime+.06,.50,.055,'sine');
  }
  // First pointer/keyboard interaction permits audio under browser autoplay rules.
  document.addEventListener('pointerdown',()=>start(),{once:true});
  document.addEventListener('keydown',()=>start(),{once:true});
  button.addEventListener('click',()=>toggle());
  return {start,toggle,sound,get muted(){return muted;}};
}
