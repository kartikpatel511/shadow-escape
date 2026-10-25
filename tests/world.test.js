import test from 'node:test';
import assert from 'node:assert/strict';
import {WORLD, HALF, chooseSpawn, validPosition, terrainY, inWater, riverX, insideBuilding, START_COINS, DOWN_SECONDS, REVEAL_COST, POWER_KEYS} from '../shared/world.js';

test('world has a large enclosed boundary, forest, town, gardens and bridges', () => {
  assert.equal(HALF * 2, 450);
  assert.ok(WORLD.trees.length >= 400);
  assert.ok(WORLD.buildings.length >= 20);
  assert.ok(WORLD.flowers.length >= 100);
  assert.equal(WORLD.bridges.length, 3);
  assert.equal(WORLD.gates.length, 8);
  assert.ok(WORLD.ponds.length >= 2);
});

test('all spawn points are inside the arena and do not intersect buildings', () => {
  for (let i = 0; i < 11; i++) {
    const {x, y, z} = chooseSpawn(i);
    assert.ok(Math.abs(x) < HALF && Math.abs(z) < HALF);
    assert.ok(validPosition(x,z),`invalid spawn ${i}`);
    assert.equal(y,terrainY(x,z));
  }
});

test('buildings and perimeter are solid', () => {
  const b = WORLD.buildings[0];
  assert.ok(insideBuilding(b.x,b.z));
  assert.equal(validPosition(b.x,b.z),false);
  assert.equal(validPosition(HALF+2,0),false);
});

test('river is continuous and bridges intersect river', () => {
  for(const z of [-200,-100,0,100,200])assert.ok(inWater(riverX(z),z));
  for(const z of WORLD.bridges)assert.ok(inWater(riverX(z),z));
});

test('future game configuration includes requested initial rules', () => {
  assert.equal(START_COINS,300);
  assert.equal(DOWN_SECONDS,30);
  assert.ok(REVEAL_COST > 0);
  assert.ok(POWER_KEYS.includes('slow')&&POWER_KEYS.includes('boost')&&POWER_KEYS.includes('stealth'));
  assert.ok(!POWER_KEYS.includes('swap')); 
});
