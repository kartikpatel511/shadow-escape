// Rendering presets contain *client-only* visual settings; none affect multiplayer physics.
export const GRAPHICS_PRESETS = Object.freeze({
  cinematic: Object.freeze({label:'CINEMATIC',resolution:1.55,shadows:2048,shadowEvery:1,bloom:1.2,grass:5200,fireflies:145,detail:3}),
  balanced: Object.freeze({label:'BALANCED',resolution:1.15,shadows:1024,shadowEvery:2,bloom:.72,grass:2200,fireflies:90,detail:2}),
  performance: Object.freeze({label:'PERFORMANCE',resolution:.8,shadows:0,shadowEvery:0,bloom:0,grass:480,fireflies:28,detail:1})
});
export const DEFAULT_GRAPHICS='balanced';
export function normalizeGraphics(v){return Object.hasOwn(GRAPHICS_PRESETS,v)?v:DEFAULT_GRAPHICS;}
export function chooseGraphicsMode(storage){try{return normalizeGraphics(storage?.getItem('shadow-escape-graphics'));}catch{return DEFAULT_GRAPHICS;}}
// Explicit deterministic sequence so all clients decorate the same world independently.
export function seededRandom(seed=0x9e3779b9){let n=seed>>>0;return ()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296;};}
