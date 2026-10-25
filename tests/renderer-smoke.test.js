import test from 'node:test';
import assert from 'node:assert/strict';
import {WorldRenderer} from '../client/renderer.js';

function fakeContext(){
  const calls={instanced:0,programs:0};
  const values={FRAMEBUFFER_COMPLETE:36053,NO_ERROR:0};
  const make=()=>({});
  const gl=new Proxy({
    getShaderParameter:()=>true,getProgramParameter:()=>true,
    getShaderInfoLog:()=>'',getProgramInfoLog:()=>'',
    checkFramebufferStatus:()=>values.FRAMEBUFFER_COMPLETE,
    getUniformLocation:()=>({}),
    createShader:make,createProgram:()=>{calls.programs++;return {};},
    createBuffer:make,createVertexArray:make,createTexture:make,
    createFramebuffer:make,createRenderbuffer:make,
    drawArraysInstanced:()=>{calls.instanced++;},getError:()=>0
  },{get(target,key){if(key in target)return target[key];if(key in values)return values[key];
    if(typeof key==='string'&&key===key.toUpperCase())return key;
    return ()=>{};
  }});
  return {gl,calls};
}
test('renderer builds all 3 presets and executes a color and optional shadow/post pass',()=>{
  const {gl,calls}=fakeContext();
  globalThis.innerWidth=900;globalThis.innerHeight=600;
  const canvas={width:0,height:0,getContext:()=>gl};
  const scene=new WorldRenderer(canvas,'balanced');
  assert.ok(scene.static.shapes.blade);
  scene.target=[0,2,0];scene.cam=[25,35,50];scene.render(0.1,[{x:0,y:0,z:0,skin:0,moving:false,role:'runner'}]);
  assert.ok(calls.instanced>6);
  const baseShapes=[...scene.dynamic.data.values()].reduce((n,a)=>n+a.length/24,0);
  scene.render(0.3,[{x:0,y:0,z:0,skin:0,moving:false,role:'runner'}],
    {portal:{x:5,y:0,z:7,yaw:0.7},gravityBursts:[{from:{x:1,y:12,z:4},to:{x:15,y:19,z:12},at:performance.now()}]});
  const portalShapes=[...scene.dynamic.data.values()].reduce((n,a)=>n+a.length/24,0);
  assert.ok(portalShapes>baseShapes+70,'giant time portal and gravity teleport must render in the 3D world');
  assert.ok(scene.shadowOK);
  assert.ok(scene.sceneTarget);
  const balancedWidth=scene.width;
  scene.setQuality('performance');
  assert.equal(scene.shadowOK,false);
  assert.equal(scene.sceneTarget,null);
  assert.ok(scene.width<balancedWidth);
  scene.render(1.5);
  scene.setQuality('cinematic');
  assert.ok(scene.shadowOK);
  assert.ok(scene.sceneTarget);
  assert.ok(scene.width>balancedWidth);
  scene.render(2.5);
  assert.ok(calls.programs>=4);
});
