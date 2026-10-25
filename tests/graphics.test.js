import test from 'node:test';
import assert from 'node:assert/strict';
import {GRAPHICS_PRESETS,normalizeGraphics,chooseGraphicsMode,seededRandom} from '../client/graphics-config.js';
test('all three selectable modes have ordered render demands',()=>{
 assert.ok(GRAPHICS_PRESETS.cinematic.resolution>GRAPHICS_PRESETS.balanced.resolution);
 assert.ok(GRAPHICS_PRESETS.balanced.resolution>GRAPHICS_PRESETS.performance.resolution);
 assert.ok(GRAPHICS_PRESETS.cinematic.grass>GRAPHICS_PRESETS.performance.grass);
 assert.equal(GRAPHICS_PRESETS.performance.shadows,0);
});
test('unrecognized or blocked setting falls back safely',()=>{
 assert.equal(normalizeGraphics('__proto__'),'balanced');
 assert.equal(chooseGraphicsMode({getItem:()=>{throw Error('private mode');}}),'balanced');
 assert.equal(chooseGraphicsMode({getItem:()=> 'cinematic'}),'cinematic');
});
test('decorative distribution is reproducible and bounded',()=>{
 const r1=seededRandom(100),r2=seededRandom(100);
 for(let i=0;i<300;i++){let x=r1();assert.equal(x,r2());assert.ok(x>=0&&x<1);}
});
