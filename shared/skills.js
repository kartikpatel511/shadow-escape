// Shared, read-only skill costs and durations; server remains authoritative.
export const POWER_RULES=Object.freeze({
  see:{label:'PLAYER PING',category:'intel',cost:20,durationMs:10000,targeted:true,description:'Reveal each other on the radar.'},
  stealth:{label:'SECRET SIGHT',category:'intel',cost:60,durationMs:10000,targeted:true,description:'Track a player without notifying them.'},
  shattered:{label:'SHATTERED COMPASS',category:'intel',cost:75,durationMs:20000,description:'Get a vague magical bearing that strengthens near the door. The hunter sees you on their minimap for 20 seconds.'},
  zone:{label:'PORTAL REGION',category:'intel',cost:150,durationMs:15000,description:'Hear a rumor about the broad region where the time portal appeared.'},
  slow:{label:'SLOW PLAYER',category:'attack',cost:40,durationMs:8000,targeted:true,description:'Reduce a rival to 10% movement speed for 8 seconds.'},
  setSpeed:{label:'SET PLAYER SPEED',category:'attack',cost:50,durationMs:10000,targeted:true,description:'Change rival speed for 10 seconds.'},
  gravity:{label:'ZERO GRAVITY',category:'attack',cost:90,durationMs:20000,targeted:true,description:'Chaotic aerial tosses for 20 seconds, followed by a guaranteed landing.'},
  freeze:{label:'FREEZE',category:'attack',cost:80,durationMs:20000,targeted:true,description:'Freeze a rival in place for 20 seconds.'},
  scramble:{label:'CHAOS CONTROLS',category:'attack',cost:110,durationMs:30000,targeted:true,description:'Scramble a rival’s controls for 30 seconds.'},
  yank:{label:'TIME YANK',category:'attack',cost:95,durationMs:0,targeted:true,description:'Yank a rival four seconds back along their own path. Their progress disappears instantly.'},
  teleport:{label:'RANDOM TELEPORT',category:'attack',cost:120,durationMs:0,description:'Send a random rival somewhere else.'},
  bribe:{label:'BRIBE THE HUNTER',category:'self',cost:150,durationMs:12000,description:'Protect yourself from hunter shots for 12 seconds.'},
  boost:{label:'SPEED BOOST',category:'self',cost:50,durationMs:12000,description:'Sprint faster for 12 seconds.'},
  rewind:{label:'TIME REWIND',category:'self',cost:60,durationMs:0,description:'Go back to where you stood 5 seconds ago.'},
  invisible:{label:'INVISIBILITY',category:'self',cost:100,durationMs:20000,description:'Hide from rivals for 20 seconds.'},
  swap:{label:'SWAP POSITIONS',category:'pickup',cost:120,durationMs:0,targeted:true,description:'Ground-only crystal: swap places with a rival.'}
});
