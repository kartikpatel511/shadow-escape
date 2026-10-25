import {WORLD,HALF,GATES,riverX,terrainY} from '../shared/world.js';
import {GRAPHICS_PRESETS,normalizeGraphics,seededRandom} from './graphics-config.js';
const PI=Math.PI,TAU=2*PI;
const RGB={stone:[.63,.68,.65],moss:[.35,.55,.37],dark:[.13,.25,.30],gold:[1,.72,.29],red:[.95,.3,.36],mint:[.41,.98,.74]};
const lighter=(c,k)=>c.map(v=>Math.min(1,v*k));
function cube(){const face=(points,n)=>points.map(([x,y,z])=>({x,y,z,n}));let verts=[];
 const sides=[
  [[[ -.5,-.5,.5],[.5,-.5,.5],[.5,.5,.5],[-.5,.5,.5]],[0,0,1]],
  [[[.5,-.5,-.5],[-.5,-.5,-.5],[-.5,.5,-.5],[.5,.5,-.5]],[0,0,-1]],
  [[[.5,-.5,.5],[.5,-.5,-.5],[.5,.5,-.5],[.5,.5,.5]],[1,0,0]],
  [[[-.5,-.5,-.5],[-.5,-.5,.5],[-.5,.5,.5],[-.5,.5,-.5]],[-1,0,0]],
  [[[-.5,.5,.5],[.5,.5,.5],[.5,.5,-.5],[-.5,.5,-.5]],[0,1,0]],
  [[[-.5,-.5,-.5],[.5,-.5,-.5],[.5,-.5,.5],[-.5,-.5,.5]],[0,-1,0]]];
 for(const [p,n] of sides){for(const i of [0,1,2,0,2,3])verts.push(...p[i],...n);}return new Float32Array(verts);}
function cone(sides=10){let a=[];for(let i=0;i<sides;i++){const t=i/sides*TAU,t2=(i+1)/sides*TAU;let n=[Math.cos((t+t2)/2)*.85,.47,Math.sin((t+t2)/2)*.85];a.push(0,1,0,...n,Math.cos(t2)*.5,0,Math.sin(t2)*.5,...n,Math.cos(t)*.5,0,Math.sin(t)*.5,...n);a.push(0,0,0,0,-1,0,Math.cos(t)*.5,0,Math.sin(t)*.5,0,-1,0,Math.cos(t2)*.5,0,Math.sin(t2)*.5,0,-1,0);}return new Float32Array(a);}
function cylinder(sides=10){let a=[];for(let i=0;i<sides;i++){let t=i/sides*TAU,u=(i+1)/sides*TAU;const p=[Math.cos(t)*.5,Math.sin(t)*.5],q=[Math.cos(u)*.5,Math.sin(u)*.5],nv=[Math.cos((t+u)/2),0,Math.sin((t+u)/2)];
 for(const v of [[p[0],0,p[1]],[q[0],0,q[1]],[q[0],1,q[1]],[p[0],0,p[1]],[q[0],1,q[1]],[p[0],1,p[1]]])a.push(...v,...nv);
 a.push(0,1,0,0,1,0,q[0],1,q[1],0,1,0,p[0],1,p[1],0,1,0);
 a.push(0,0,0,0,-1,0,p[0],0,p[1],0,-1,0,q[0],0,q[1],0,-1,0);
 }return new Float32Array(a);}
function sphere(rings=7,cols=11){let a=[];const pt=(theta,phi)=>[.5*Math.sin(theta)*Math.cos(phi),.5*Math.cos(theta),.5*Math.sin(theta)*Math.sin(phi)];
 for(let y=0;y<rings;y++)for(let x=0;x<cols;x++){const v=[pt(y/rings*PI,x/cols*TAU),pt((y+1)/rings*PI,x/cols*TAU),pt((y+1)/rings*PI,(x+1)/cols*TAU),pt(y/rings*PI,(x+1)/cols*TAU)];for(const j of [0,1,2,0,2,3]){const p=v[j];a.push(...p,...p.map(t=>2*t));}}return new Float32Array(a);}
function ring(segments=16,minor=7){let a=[];function pt(u,v){const c=.5+.095*Math.cos(v);return [c*Math.cos(u),.095*Math.sin(v)+.5,c*Math.sin(u)];}function norm(u,v){return [Math.cos(u)*Math.cos(v),Math.sin(v),Math.sin(u)*Math.cos(v)];}
 for(let i=0;i<segments;i++)for(let j=0;j<minor;j++){let u=i*TAU/segments,u2=(i+1)*TAU/segments,v=j*TAU/minor,v2=(j+1)*TAU/minor;
 for(const [uu,vv] of [[u,v],[u2,v],[u2,v2],[u,v],[u2,v2],[u,v2]])a.push(...pt(uu,vv),...norm(uu,vv));}return new Float32Array(a);}
function blade(){ // A crossed, tapered grass tuft: two triangles, no alpha blending required.
 const a=[];
 for(const angle of [0,Math.PI/2]){const dx=Math.cos(angle),dz=Math.sin(angle);
  const l=[-dx*.36,0,-dz*.36],r=[dx*.36,0,dz*.36],top=[Math.sin(angle)*.2,1.45,Math.cos(angle)*.2];
  for(const pts of [[l,r,top],[top,r,l]])for(const p of pts)a.push(...p,Math.sin(angle),.36,Math.cos(angle));
 }return new Float32Array(a);
}
function octa(){let a=[];let v=[[0,.5,0],[.5,0,0],[0,0,.5],[-.5,0,0],[0,0,-.5],[0,-.5,0]];for(let i=0;i<4;i++){let j=i+1;if(j===4)j=1;let b=i+1,c=j+1;const tris=[[0,b,c],[5,c,b]];for(const ids of tris){const p=ids.map(k=>v[k]);const u=p[1].map((x,k)=>x-p[0][k]),w=p[2].map((x,k)=>x-p[0][k]);const n=[u[1]*w[2]-u[2]*w[1],u[2]*w[0]-u[0]*w[2],u[0]*w[1]-u[1]*w[0]],l=Math.hypot(...n)||1;for(const q of p)a.push(...q,...n.map(x=>x/l));}}return new Float32Array(a);}
// The renderer is a dependency-free instanced WebGL2 engine. Objects are authored in world units.
const VERT=`#version 300 es
precision highp float;
layout(location=0)in vec3 aPos;layout(location=1)in vec3 aNormal;
layout(location=2)in vec4 iM0;layout(location=3)in vec4 iM1;layout(location=4)in vec4 iM2;layout(location=5)in vec4 iM3;
layout(location=6)in vec4 iColor;layout(location=7)in vec4 iMat;
uniform mat4 uVP;uniform mat4 uLightVP;uniform float uTime;
out vec3 vPos;out vec3 vNormal;out vec4 vColor;out vec4 vMat;out vec4 vShadow;
void main(){mat4 m=mat4(iM0,iM1,iM2,iM3);vec4 p=m*vec4(aPos,1.);
 if(iMat.z>.1){float sway=sin(uTime*1.5+p.x*.21+p.z*.32)*.22+sin(uTime*.87+p.z*.3)*.13;
  float weight=iMat.x>8.5?clamp(aPos.y,0.,1.):clamp(aPos.y+.5,0.,1.);
  p.x+=sway*iMat.z*weight;p.z+=sway*.5*iMat.z*weight;}
 vPos=p.xyz;vNormal=normalize(mat3(m)*aNormal);vColor=iColor;vMat=iMat;vShadow=uLightVP*p;gl_Position=uVP*p;}`;
const FRAG=`#version 300 es
precision highp float;
in vec3 vPos;in vec3 vNormal;in vec4 vColor;in vec4 vMat;in vec4 vShadow;
out vec4 outColor;uniform vec3 uCamera;uniform float uTime;uniform sampler2D uShadowMap;uniform float uShadowEnabled;uniform vec2 uShadowTexel;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
float shadowFactor(vec3 N,vec3 L){
 if(uShadowEnabled<.5)return 1.;
 vec3 c=vShadow.xyz/vShadow.w; c=c*.5+.5;
 if(c.x<=.005||c.x>=.995||c.y<=.005||c.y>=.995||c.z>=.999||c.z<=0.)return 1.;
 float bias=max(.00038,.00165*(1.-dot(N,L)));
 float visibility=0.;
 for(int x=-1;x<=1;x++)for(int y=-1;y<=1;y++){
  float closest=texture(uShadowMap,c.xy+vec2(float(x),float(y))*uShadowTexel).r;
  visibility+=c.z-bias<=closest?1.:0.;
 }
 return mix(1.,visibility/9.,.82);
}
void main(){
 vec3 N=normalize(vNormal),L=normalize(vec3(-.46,.84,-.32));
 vec3 col=vColor.rgb;float mat=vMat.x;
 if(mat>.5&&mat<1.5){
  float g=noise(vPos.xz*1.8)*.13+noise(vPos.xz*7.)*.06;
  col*=.80+g+.13*sin(vPos.x*.27)*sin(vPos.z*.24);
 }
 if(mat>1.5&&mat<2.5){
  vec2 tile=fract(vPos.xz*.42);float joints=step(.96,tile.x)+step(.97,tile.y);
  col*=.92+noise(vPos.xz*.8)*.18-.25*min(1.,joints);
  col*=.93+.12*noise(vPos.xz*7.);
 }
 if(mat>2.5&&mat<3.5){
  float wave=sin(vPos.z*1.8+uTime*1.45)+sin(vPos.x*.75-uTime*1.2);
  float sparkle=pow(max(0.,sin(vPos.x*3.4+vPos.z*2.1+uTime*2.)),16.);
  col*=.85+.16*wave;col+=vec3(.16,.24,.23)*sparkle;
 }
 if(mat>4.5&&mat<5.5){
  float freckles=noise(vPos.xz*2.8+vPos.yy*.3);
  col*=.77+.28*freckles;
  float edge=pow(max(0.,dot(N,normalize(vPos-uCamera))),2.);
  col*=1.-edge*.05;
 }
 if(mat>5.5&&mat<6.5){
  vec2 brick=vec2(vPos.x*.32+floor(vPos.y*.71)*.5,vPos.y*.71);
  float seam=step(.945,fract(brick.x))+step(.955,fract(brick.y));
  col*=.89+.18*noise(vPos.xz*.8+vPos.yy*.6)-.19*min(1.,seam);
 }
 if(mat>6.5&&mat<7.5){
  float shingles=step(.93,fract(vPos.z*.88+floor(vPos.x*.55)*.5));
  col*=.85+.13*noise(vPos.xz*1.3)-.16*shingles;
 }
 if(mat>7.5&&mat<8.5){col*=.81+.18*abs(sin(vPos.z*1.9));}
 if(mat>8.5){col*=.72+.4*noise(vPos.xz*2.5);}
 float diff=max(dot(N,L),0.);
 float sh=shadowFactor(N,L);
 vec3 ambient=vec3(.39,.46,.72);
 vec3 sunlight=vec3(.69,.78,1.15)*diff*sh*.90;
 vec3 lit=col*(ambient+sunlight);
 vec3 V=normalize(uCamera-vPos),H=normalize(L+V);
 float gloss=mat>2.5&&mat<3.5?72.:mat>6.5&&mat<7.5?38.:19.;
 float spec=pow(max(dot(N,H),0.),gloss)*(mat>2.5&&mat<3.5?.95:.16);
 lit+=spec*vec3(1.,.93,.72)*sh;
 float rim=pow(1.-max(dot(V,N),0.),3.)*.15;
 lit+=col*rim*vec3(.35,.69,1.);
 if(mat>3.5&&mat<4.5)lit=col*2.6+vec3(.16,.22,.13);
 lit+=col*vMat.y*1.65;
 // Height-dependent aerial perspective for the large 450 m world.
 float d=distance(vPos,uCamera);
 float fog=1.-exp(-pow(max(d-15.,0.)/245.,1.53));
 vec3 fogColor=mix(vec3(.25,.30,.47),vec3(.075,.12,.24),clamp((vPos.y+5.)/90.,0.,1.));
 lit=mix(lit,fogColor,clamp(fog,0.,.93));
 lit=lit/(lit+vec3(.43));lit=pow(lit,vec3(.87));
 outColor=vec4(lit,1.);
}`;
const SHADOWVERT=`#version 300 es
precision highp float;
layout(location=0)in vec3 aPos;
layout(location=2)in vec4 iM0;layout(location=3)in vec4 iM1;layout(location=4)in vec4 iM2;layout(location=5)in vec4 iM3;
layout(location=7)in vec4 iMat;
uniform mat4 uLightVP;uniform float uTime;
void main(){vec4 p=mat4(iM0,iM1,iM2,iM3)*vec4(aPos,1.);
 if(iMat.z>.1){float sway=sin(uTime*1.5+p.x*.21+p.z*.32)*.22+sin(uTime*.87+p.z*.3)*.13;
  float weight=iMat.x>8.5?clamp(aPos.y,0.,1.):clamp(aPos.y+.5,0.,1.);
  p.x+=sway*iMat.z*weight;p.z+=sway*.5*iMat.z*weight;}
 gl_Position=uLightVP*p;}`;
const SHADOWFRAG=`#version 300 es
precision mediump float;void main(){}`;
const POSTFRAG=`#version 300 es
precision highp float;
in vec2 vUV;out vec4 outColor;
uniform sampler2D uScene;uniform vec2 uTexel;uniform float uGlow;uniform float uTime;uniform int uSamples;
vec3 bright(vec3 c){return max(c-vec3(.68,.71,.68),vec3(0.));}
void main(){vec2 uv=gl_FragCoord.xy*uTexel;vec3 color=texture(uScene,uv).rgb;
 vec3 bloom=bright(color)*.30;
 for(int i=0;i<12;i++){
  if(i>=uSamples)break;
  float a=float(i)*6.2831853/float(uSamples);
  vec2 o=vec2(cos(a),sin(a))*uTexel*7.;
  bloom+=bright(texture(uScene,uv+o).rgb)*.050;
  bloom+=bright(texture(uScene,uv+o*.44).rgb)*.031;
 }
 color+=bloom*uGlow;
 float vignette=1.-.20*smoothstep(.32,.9,length((uv-.5)*vec2(1.12,.9)));
 color*=vignette;
 // A soft analog-film finish without hiding players or crucial minimap information.
 float grain=fract(sin(dot(gl_FragCoord.xy+uTime*83.,vec2(12.9898,78.233)))*43758.5453)-.5;
 color+=grain*.012;
 outColor=vec4(clamp(color,0.,1.),1.);
}`;
const SKYVERT=`#version 300 es
precision highp float;out vec2 vUV;void main(){vec2 p=vec2((gl_VertexID<<1)&2,gl_VertexID&2);vUV=p;gl_Position=vec4(p*2.-1.,0.,1.);}`;
const SKYFRAG=`#version 300 es
precision highp float;
in vec2 vUV;out vec4 outColor;uniform vec2 uRes;uniform float uTime;uniform float uYaw;uniform float uPitch;
float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float n(vec2 x){vec2 i=floor(x),f=fract(x);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}
float fbm(vec2 uv){float sum=0.,weight=.5;for(int i=0;i<4;i++){sum+=n(uv)*weight;uv=uv*2.07+12.7;weight*=.5;}return sum;}
void main(){
 vec2 uv=(gl_FragCoord.xy/uRes-.5);uv.x*=uRes.x/uRes.y;
 float vertical=clamp(uv.y+uPitch*.28+.48,0.,1.);
 vec3 horizon=vec3(.33,.30,.51),zenith=vec3(.025,.045,.14);
 vec3 col=mix(horizon,zenith,pow(vertical,.9));
 float haze=exp(-pow((vertical-.24)*5.,2.));col+=vec3(.11,.06,.22)*haze;
 vec2 sun=vec2(.34-sin(uYaw*.30)*.22,.22-uPitch*.19);
 float sd=length(uv-sun);
 col+=vec3(.50,.55,1.)*.27*exp(-sd*8.)+vec3(.80,.87,1.)*.82*exp(-sd*85.);
 col+=vec3(.90,.92,1.)*.76*(1.-smoothstep(.007,.021,sd));
 vec2 cloudUV=uv*vec2(2.3,4.5)+vec2(uYaw*.14,uTime*.004);
 float cloud=fbm(cloudUV+fbm(cloudUV*.55)*.5);
 float mass=smoothstep(.49,.69,cloud)*smoothstep(.19,.54,vertical);
 col=mix(col,vec3(.48,.47,.67),mass*.37);
 col+=vec3(.11,.10,.22)*mass*exp(-sd*2.);
 float stars=step(.9991,h(floor((uv+vec2(uYaw*.018,uPitch*.012))*520.)))*smoothstep(.78,.95,vertical);
 col+=stars*vec3(.68,.75,1.)*.38;
 outColor=vec4(pow(col,vec3(.92)),1.);
}`;
function shader(gl,type,src){const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;}
function program(gl,vert,frag){const p=gl.createProgram();gl.attachShader(p,shader(gl,gl.VERTEX_SHADER,vert));gl.attachShader(p,shader(gl,gl.FRAGMENT_SHADER,frag));gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(p));return p;}
export function mat4Perspective(fov,aspect,near,far){const f=1/Math.tan(fov/2),nf=1/(near-far);return new Float32Array([f/aspect,0,0,0,0,f,0,0,0,0,(far+near)*nf,-1,0,0,2*far*near*nf,0]);}
export function mat4Ortho(l,r,b,t,n,f){return new Float32Array([
 2/(r-l),0,0,0,0,2/(t-b),0,0,0,0,-2/(f-n),0,-(r+l)/(r-l),-(t+b)/(t-b),-(f+n)/(f-n),1
]);}
export function mat4LookAt(e,c){let zx=e[0]-c[0],zy=e[1]-c[1],zz=e[2]-c[2],n=Math.hypot(zx,zy,zz)||1;zx/=n;zy/=n;zz/=n;
 let xx=zz,xz=-zx,n2=Math.hypot(xx,xz)||1;xx/=n2;xz/=n2;let xy=0;
 let yx=zy*xz,yz=-zy*xx,yy=zz*xx-zx*xz;
 return new Float32Array([xx,yx,zx,0,xy,yy,zy,0,xz,yz,zz,0,-(xx*e[0]+xy*e[1]+xz*e[2]),-(yx*e[0]+yy*e[1]+yz*e[2]),-(zx*e[0]+zy*e[1]+zz*e[2]),1]);}
export function mat4Multiply(a,b){const out=new Float32Array(16);for(let j=0;j<4;j++)for(let i=0;i<4;i++)out[j*4+i]=a[i]*b[j*4]+a[4+i]*b[j*4+1]+a[8+i]*b[j*4+2]+a[12+i]*b[j*4+3];return out;}
export function project(point,m,w,h){const x=point[0],y=point[1],z=point[2],cw=m[3]*x+m[7]*y+m[11]*z+m[15];if(cw<=.1)return null;const cx=m[0]*x+m[4]*y+m[8]*z+m[12],cy=m[1]*x+m[5]*y+m[9]*z+m[13];return [(cx/cw*.5+.5)*w,(-cy/cw*.5+.5)*h,cw];}
class InstanceBatch {
 constructor(gl,shapes){this.gl=gl;this.shapes={};this.data=new Map();for(const [name,vert] of Object.entries(shapes)){
  const vao=gl.createVertexArray(),vbo=gl.createBuffer(),ib=gl.createBuffer();gl.bindVertexArray(vao);gl.bindBuffer(gl.ARRAY_BUFFER,vbo);gl.bufferData(gl.ARRAY_BUFFER,vert,gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.FLOAT,false,24,0);gl.enableVertexAttribArray(1);gl.vertexAttribPointer(1,3,gl.FLOAT,false,24,12);
  gl.bindBuffer(gl.ARRAY_BUFFER,ib);for(let i=0;i<6;i++){const loc=i+2;gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,4,gl.FLOAT,false,96,i*16);gl.vertexAttribDivisor(loc,1);}
  this.shapes[name]={vao,ib,count:vert.length/6,instances:0};gl.bindVertexArray(null);
 } }
 clear(){this.data.clear();}
 add(mesh,x,y,z,sx,sy,sz,color,material=0,emiss=0,sway=0,yaw=0,alpha=1){
  if(!this.shapes[mesh])return;const c=Math.cos(yaw),s=Math.sin(yaw),inst=[c*sx,0,-s*sx,0,0,sy,0,0,s*sz,0,c*sz,0,x,y,z,1,
   color[0],color[1],color[2],alpha,material,emiss,sway,0];
  if(!this.data.has(mesh))this.data.set(mesh,[]);this.data.get(mesh).push(...inst);
 }
 upload(usage){const gl=this.gl;for(const [name,shape]of Object.entries(this.shapes)){let arr=this.data.get(name)||[];shape.instances=arr.length/24;gl.bindBuffer(gl.ARRAY_BUFFER,shape.ib);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(arr),usage);}}
 draw(skip=null){const gl=this.gl;for(const [name,shape] of Object.entries(this.shapes)){
 if(!shape.instances||name===skip)continue;gl.bindVertexArray(shape.vao);
 gl.drawArraysInstanced(gl.TRIANGLES,0,shape.count,shape.instances);
 }gl.bindVertexArray(null);}
}
function insideDecorBuilding(x,z){return WORLD.buildings.some(b=>Math.abs(x-b.x)<b.w/2+2&&Math.abs(z-b.z)<b.d/2+2);}
function makeWorld(batch,settings=GRAPHICS_PRESETS.balanced){const add=(...args)=>batch.add(...args),B='cube',C='cyl',S='sphere',K='cone',R='ring',O='octa';
 // Meadow floor, alternating field inlays and terraced borders.
 add(B,0,-.32,0,450,.48,450,[.28,.51,.38],1);
 for(let i=0;i<125;i++){const x=-207+(i%13)*35,z=-209+Math.floor(i/13)*43;add(B,x,-.065,z,27,.045,33,[.31+.04*(i%3),.55+.04*(i%2),.39],1);}
 // Ancient cobblestone cross-roads with lane markers and curbs.
 for(const x of [-105,0,154]){
  add(B,x,.07,0,12,.10,444,[.29,.38,.38],2);for(const side of [-1,1])add(B,x+side*6.4,.16,0,.6,.2,444,[.73,.75,.65],6);
  for(let z=-210;z<=210;z+=9)add(B,x,.14,z,.18,.03,3,[.84,.81,.62],4,.15);
 }
 for(const z of [-106,0,114]){
  add(B,0,.09,z,444,.11,12,[.27,.37,.38],2);for(const side of [-1,1])add(B,0,.17,z+side*6.4,444,.2,.55,[.70,.74,.66],6);
  for(let x=-210;x<=210;x+=8)add(B,x,.15,z,3,.04,.16,[.85,.82,.64],4,.15);
 }
 // River curves through the right half of the world.
 for(let z=-220;z<221;z+=5){const x=riverX(z),yaw=Math.atan((riverX(z+2)-riverX(z-2))/4);
  add(B,x,-.045,z,17,.09,5.75,[.09,.44,.48],3,.25,0,yaw);
  add(B,x-9,.06,z,1.5,.13,5.8,[.63,.63,.46],1);add(B,x+9,.06,z,1.5,.13,5.8,[.57,.66,.46],1);
 }
 // Robust timber suspension bridges, balustrades, structural piers and warm torches.
 for(const z of WORLD.bridges){const x=riverX(z);add(B,x,.67,z,43,1.05,10,[.37,.26,.18],8);
  for(let j=-19;j<=19;j+=2){add(B,x+j,1.3,z,1.82,.24,10.6,[.57+(j%4)*.02,.41,.27],8);}
  for(const side of [-1,1]){for(let i=-20;i<=20;i+=6){add(C,x+i,1.75,z+side*5.3,.67,2.15,.67,[.64,.51,.35],8);}
   add(B,x,2.77,z+side*5.4,43,.26,.26,[.82,.65,.38],8);add(B,x,1.67,z+side*5.4,43,.18,.2,[.60,.51,.36],8);}
  for(const j of [-18,18]){add(C,x+j,.6,z,2.3,3.8,2.3,[.42,.45,.42],6);add(S,x+j,2.8,z,2.9,1.3,2.9,[.58,.63,.61],6);}
 }
 // Village blocks: masonry, pitched roofs, glazed windows, awnings, corner lamps and balconies.
 const walls=[[.70,.63,.54],[.63,.69,.62],[.57,.64,.68],[.77,.67,.56],[.68,.59,.61],[.80,.75,.66]];
 let idx=0;for(const q of WORLD.buildings){let pal=walls[idx++%walls.length],col=lighter(pal,.87+q.tone*.25),roof=q.type==='chapel'?[.18,.36,.42]:q.type==='tower'?[.22,.30,.41]:[.32+q.roof*.18,.27,.30+q.roof*.08];
  const {x,z,w,d,h}=q;add(B,x,-.2,z,w+2,.8,d+2,[.40,.44,.41],6);
  add(B,x,h*.5,z,w,h,d,col,6);add(B,x,h,z,w+.9,.65,d+.9,[.36,.46,.46],6);
  if(q.type==='tower'||q.type==='clock'){
   add(K,x,h+.1,z,w+3,7,d+3,roof,7);add(C,x,h+5.65,z,1,6,1,[.75,.67,.42],8);
   for(let side of [-1,1])for(let n=0;n<4;n++){const a=n*PI/2;add(B,x+Math.sin(a)*(w*.52)*side,h*.75,z+Math.cos(a)*(d*.52)*side,1.9,3,.3,[.94,.77,.43],4,.32,a);}
  }else{ // Layered roof and central ridge spire.
   add(B,x,h+1.12,z,w+2,2.2,d+2,roof,7);
   for(let i=0;i<4;i++)add(B,x,h+2.32,z-d/2+i*d/3,w+2,.18,.20,lighter(roof,.8),7);
   if(q.type==='chapel'){add(K,x,h+2,z,6,7,6,[.33,.42,.47],7);add(C,x,h+8,z,.4,3,.4,[.89,.78,.46],4);}
  }
  add(B,x-w*.25,2.0,z+d*.505,2.2,4,.12,[.22,.28,.31],8); // front door
  add(B,x-w*.25,3.62,z+d*.56,2.6,.19,.27,[.8,.59,.32],8);
  const levels=Math.max(2,Math.floor((h-3)/4.3)),cols=Math.max(2,Math.floor((w-3)/4.3));
  for(let iy=0;iy<levels;iy++)for(let ix=0;ix<cols;ix++){
   let wx=x-w/2+(ix+1)*w/(cols+1),wy=3.4+iy*4.3;
   const wc=(ix+iy)%4===0?[1,.84,.54]:[.49,.79,.82];
   for(const side of [-1,1]){add(B,wx,wy,z+side*(d/2+.05),1.65,2.08,.18,[.24,.28,.31],8);
    add(B,wx,wy,z+side*(d/2+.19),1.25,1.66,.06,wc,4,.5);add(B,wx,wy,z+side*(d/2+.26),.12,1.72,.06,[.37,.33,.30],8);}
  }
  const backCols=Math.max(2,Math.floor((d-2)/5));
  for(let iy=0;iy<levels;iy++)for(let ix=0;ix<backCols;ix++)for(const side of [-1,1]){
   let wz=z-d/2+(ix+1)*d/(backCols+1),wy=3.2+iy*4.3;
   add(B,x+side*(w/2+.15),wy,wz,.14,1.6,1.28,[.87,.75,.50],4,.45);}
  for(const side of [-1,1]){add(B,x+side*(w/2+.6),1.4,z+d/2+1.2,.33,2.8,.33,[.31,.38,.34],8);add(S,x+side*(w/2+.6),3,z+d/2+1.2,.85,.85,.85,[.98,.79,.39],4,1);}
 }
 // Forest: thin trunks, layered needles, white birches, leafy crowns, shadow patches.
 for(let i=0;i<WORLD.trees.length;i++){const t=WORLD.trees[i],{x,z,h,r}=t;
  add(C,x,h*.27,z,r*.31,h*.54,r*.31,t.kind==='birch'?[.78,.81,.71]:[.43,.31,.22],8);
  const green=t.kind==='pine'?[.19+t.shade*.13,.39+t.shade*.20,.31+t.shade*.09]:t.kind==='birch'?[.47,.68,.32]:[.28+t.shade*.11,.57+t.shade*.14,.28];
  if(t.kind==='pine'){add(K,x,h*.27,z,r*2.5,h*.47,r*2.5,lighter(green,.67),5,.0,1.3);
   add(K,x,h*.45,z,r*2.1,h*.48,r*2.1,green,5,0,1.3);add(K,x,h*.67,z,r*1.6,h*.46,r*1.6,lighter(green,1.2),5,0,1.5);
  }else{add(S,x,h*.75,z,r*2.05,r*1.9,r*2.05,green,5,0,.3);add(S,x-r*.5,h*.67,z+r*.4,r*1.3,r*1.4,r*1.5,lighter(green,.82),5,0,.4);}
 }
 for(const q of WORLD.rocks){add(S,q.x,.42*q.s,q.z,q.s*1.9,.75*q.s,q.s*1.5,q.t>.5?[.56,.62,.59]:[.47,.54,.50],6);}
 // Gardens with sculpted hedges, varied rosebeds and reflective marble fountains.
 for(const g of [{x:-130,z:88,r:22},{x:-130,z:-88,r:18},{x:157,z:76,r:24},{x:-35,z:157,r:17}]){
  add(C,g.x,.12,g.z,g.r*2,.23,g.r*2,[.48,.62,.38],1);
  add(C,g.x,.2,g.z,g.r*1.60,.25,g.r*1.60,[.82,.76,.57],2);
  add(C,g.x,.25,g.z,g.r*1.47,.28,g.r*1.47,[.36,.58,.39],1);
  for(let i=0;i<20;i++){const t=i*TAU/20;add(S,g.x+Math.cos(t)*(g.r*.87),.9,g.z+Math.sin(t)*(g.r*.87),3,2.3,3,[.23+i%3*.025,.42+i%4*.023,.29],5);}
  add(C,g.x,.37,g.z,6,.6,6,[.75,.77,.71],6);add(C,g.x,.73,g.z,5,1,5,[.19,.55,.58],3,.3);
  add(C,g.x,1.2,g.z,2,1.4,2,[.83,.87,.75],6);add(S,g.x,2.4,g.z,2,2,2,[.78,.97,.89],4,.4);
  for(let i=0;i<23;i++){const t=i*TAU/23,rr=g.r*(.43+(i%3)*.13),x=g.x+Math.cos(t)*rr,z=g.z+Math.sin(t)*rr;
   add(S,x,.4,z,1.4,.8,1.4,[.23,.54,.31],5);add(S,x,.85,z,.65,.7,.65,i%3===0?[.97,.59,.68]:i%3===1?[.98,.76,.43]:[.92,.72,.86],5);}
 }
 for(const f of WORLD.flowers){add(C,f.x,.16,f.z,.07,.4,.07,[.28,.59,.28],5);add(S,f.x,.43,f.z,.37*f.scale,.39*f.scale,.37*f.scale,
  f.hue<.33?[.98,.58,.66]:f.hue<.66?[.96,.74,.36]:[.78,.65,.96],5);}
 // Benches and lamps along promenades.
 for(const p of WORLD.benches){add(B,p.x,.72,p.z,3,.23,1.1,[.61,.37,.23],8,0,0,p.yaw);add(B,p.x,1.4,p.z-.5,3,1.35,.2,[.55,.34,.23],8,0,0,p.yaw);
  for(const side of [-1,1])add(B,p.x+side*1.1,.37,p.z,.23,.7,1.1,[.36,.35,.31],6,0,0,p.yaw);}
 for(const p of WORLD.lamps){add(C,p.x,.03,p.z,1.3,.25,1.3,[.38,.43,.40],6);add(C,p.x,.2,p.z,.28,7,.28,[.21,.31,.32],8);
  add(S,p.x,7.3,p.z,1.9,1.9,1.9,[1,.73,.41],4,1.4);add(K,p.x,8.18,p.z,1.9,1.35,1.9,[.26,.35,.35],7);}
 // Clockwork stone monument and arena circle near the town center.
 add(C,-34,.12,14,30,.26,30,[.78,.78,.67],2);add(C,-34,.32,14,21,.3,21,[.39,.54,.54],2);
 for(let i=0;i<12;i++){let t=i*TAU/12,x=-34+Math.cos(t)*12,z=14+Math.sin(t)*12;add(C,x,0,z,1.1,3.7,1.1,[.8,.8,.67],6);add(S,x,3.8,z,1.4,1.4,1.4,[.96,.78,.36],4,.6);}
 // The massive outer barrier, ancient watch towers, false portals and ruins.
 for(let a=-HALF;a<=HALF;a+=9){
  for(const side of [-1,1])for(const axis of ['x','z']){
   const x=axis==='x'?a:side*HALF,z=axis==='z'?a:side*HALF;
   if(GATES.some(g=>Math.hypot(g.x-x,g.z-z)<7))continue;
   add(B,x,4.25,z,axis==='x'?9.1:2.9,8.5,axis==='z'?9.1:2.9,[.31,.40,.39],6);
   add(B,x,8.7,z,axis==='x'?9.2:3.2,1,axis==='z'?9.2:3.2,[.48,.53,.47],6);
   if(Math.round(a/9)%2===0)add(B,x,9.6,z,axis==='x'?3.3:3.3,1.5,axis==='z'?3.3:3.3,[.49,.54,.47],6);
  }
 }
 for(const gate of GATES){const along=gate.yaw===0;add(B,gate.x,10,gate.z,along?15:3,2.3,along?3:15,[.63,.61,.49],6);
  for(const side of [-1,1]){add(C,gate.x+(along?side*7:0),.4,gate.z+(along?0:side*7),3.3,11.5,3.3,[.52,.58,.53],6);
   add(K,gate.x+(along?side*7:0),12,gate.z+(along?0:side*7),4.6,4.5,4.6,[.37,.51,.48],7);}
  add(B,gate.x,4.3,gate.z,along?10:1,8.6,along?1:10,[.21,.36,.34],8);
  add(O,gate.x,10.2,gate.z,2,2.6,2,[.86,.79,.42],4,.28);
 }
 // Keep ancient landmarks readable but free of hovering diamond/ring clutter.
 // Only the actual secret time portal has conspicuous floating magic effects.
 // STEP 7 ART PASS: architectural accents, riverbank boulders, wildflowers, and village clutter.
 if(settings.detail>1){
  const rand=seededRandom(0x5ad0b);
  for(const q of WORLD.buildings){
   // Handmade cornices and chimneys sit outside the server collision footprint.
   if(q.type!=='tower'){
    const c=[.75,.69,.54],roofY=q.h+2.45;
    add(B,q.x,roofY,q.z-q.d/2,q.w+2,.28,.5,c,6);
    add(B,q.x,roofY,q.z+q.d/2,q.w+2,.28,.5,c,6);
    add(B,q.x+q.w*.28,q.h+3.5,q.z-q.d*.25,1.35,3.2,1.6,[.55,.43,.39],6);
    add(B,q.x+q.w*.28,q.h+5.1,q.z-q.d*.25,1.65,.32,1.85,[.35,.35,.36],6);
   }
   // Hanging lanterns and cobbled planting boxes.
   for(const side of [-1,1]){
    add(B,q.x+side*(q.w*.30),.35,q.z+q.d*.58,2.6,.72,1.8,[.54,.54,.47],6);
    add(S,q.x+side*(q.w*.30),1.35,q.z+q.d*.58,1.6,1.25,1.2,[.24,.50,.31],5);
    add(S,q.x+side*(q.w*.30),2.06,q.z+q.d*.58,.5,.5,.5,[.96,.65,.43],5);
   }
  }
  for(let i=0;i<160;i++){
   let z=(rand()-.5)*423,x=riverX(z)+(rand()<.5?-1:1)*(11+rand()*7);
   if(WORLD.bridges.some(bz=>Math.abs(z-bz)<15))continue;
   add(S,x,.19,z,.7+rand()*2.7,.35+rand()*.9,.7+rand()*2.2,[.50,.57,.52],6);
  }
  // Roadside planter boxes and trimmed flowering bushes.
  for(let i=0;i<65;i++){
   let z=-205+i*6.3,x=(i%2===0?-1:1)*(12+rand()*5);
   if(insideDecorBuilding(x,z)||Math.abs(x-riverX(z))<16)continue;
   add(C,x,.3,z,1.25,.65,1.25,[.70,.61,.49],6);
   add(S,x,.95,z,1.8,1.45,1.8,[.24,.51,.33],5);
   add(S,x,1.53,z,.5,.55,.5,[.99,.67,.53],5);
  }
 }
 // Instanced blades sway in the vertex shader; this adds rich ground texture with one draw call.
 {
  const rand=seededRandom(0x7aee27);
  for(let i=0;i<settings.grass;i++){
   const x=(rand()-.5)*428,z=(rand()-.5)*428;
   if(Math.abs(x-riverX(z))<12||Math.abs(x)<7||Math.abs(z)<7||Math.abs(x+105)<7||Math.abs(x-154)<7||Math.abs(z+106)<7||Math.abs(z-114)<7)continue;
   if(insideDecorBuilding(x,z))continue;
   const h=.50+rand()*1.6,w=.40+rand()*.75;
   add('blade',x,terrainY(x,z)-.15,z,w,h,w,[.29+rand()*.13,.54+rand()*.15,.27+rand()*.13],9,0,1.5,rand()*TAU);
  }
 }
 // Multi-layered mountain silhouettes beyond the 450m playable boundary.
 if(settings.detail>1){const rand=seededRandom(0x82926);
  for(let i=0;i<58;i++){const angle=i*TAU/58,r=285+rand()*100;
   const x=Math.cos(angle)*r,z=Math.sin(angle)*r,h=25+rand()*85;
   add(K,x,-6,z,35+rand()*35,h,35+rand()*35,[.24+.06*rand(),.34+.07*rand(),.36+.07*rand()],6);
  }
 }
 // Distinctive road markers across whole map.
 for(let i=-180;i<=180;i+=65){add(C,-11,.2,i,.9,.4,.9,[.87,.78,.45],4,.35);add(C,11,.2,i,.9,.4,.9,[.87,.78,.45],4,.35);}
 batch.upload(batch.gl.STATIC_DRAW);
}
const SKINS=[ [.45,.92,.77],[.88,.63,.48],[.76,.53,.92],[.44,.72,.97],[.96,.75,.39],[.95,.49,.58],[.53,.88,.94],[.83,.92,.56],[.99,.72,.75]];
export class WorldRenderer{
 constructor(canvas,quality='balanced'){
  this.canvas=canvas;
  const gl=canvas.getContext('webgl2',{antialias:true,alpha:false,depth:true,powerPreference:'high-performance'});
  if(!gl)throw Error('WebGL2 is required. Try Chrome or Edge with hardware acceleration enabled.');
  this.gl=gl;this.quality=normalizeGraphics(quality);this.settings=GRAPHICS_PRESETS[this.quality];
  this.shader=program(gl,VERT,FRAG);this.sky=program(gl,SKYVERT,SKYFRAG);
  this.shadowShader=program(gl,SHADOWVERT,SHADOWFRAG);
  this.postShader=program(gl,SKYVERT,POSTFRAG);
  this.loc={vp:gl.getUniformLocation(this.shader,'uVP'),camera:gl.getUniformLocation(this.shader,'uCamera'),time:gl.getUniformLocation(this.shader,'uTime'),
   lightVP:gl.getUniformLocation(this.shader,'uLightVP'),shadowMap:gl.getUniformLocation(this.shader,'uShadowMap'),shadowEnabled:gl.getUniformLocation(this.shader,'uShadowEnabled'),shadowTexel:gl.getUniformLocation(this.shader,'uShadowTexel')};
  this.shadowLoc={vp:gl.getUniformLocation(this.shadowShader,'uLightVP'),time:gl.getUniformLocation(this.shadowShader,'uTime')};
  this.postLoc={scene:gl.getUniformLocation(this.postShader,'uScene'),pixel:gl.getUniformLocation(this.postShader,'uTexel'),glow:gl.getUniformLocation(this.postShader,'uGlow'),time:gl.getUniformLocation(this.postShader,'uTime'),samples:gl.getUniformLocation(this.postShader,'uSamples')};
  this.skyLoc={res:gl.getUniformLocation(this.sky,'uRes'),time:gl.getUniformLocation(this.sky,'uTime'),yaw:gl.getUniformLocation(this.sky,'uYaw'),pitch:gl.getUniformLocation(this.sky,'uPitch')};
  const shapes={cube:cube(),cyl:cylinder(),cone:cone(),sphere:sphere(),ring:ring(),octa:octa(),blade:blade()};
  this.static=new InstanceBatch(gl,shapes);this.dynamic=new InstanceBatch(gl,shapes);makeWorld(this.static,this.settings);
  this.cam=[15,16,22];this.target=[0,2,0];this.yaw=.57;this.pitch=.25;this.distance=17;
  this.vp=null;this.lightVP=mat4Ortho(-1,1,-1,1,1,400);this.width=1;this.height=1;this.frameNo=0;
  this.shadowTarget=null;this.sceneTarget=null;this.shadowOK=false;
  gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.disable(gl.CULL_FACE);
  this.setupShadow();this.resize();
 }
 setQuality(mode){
  const next=normalizeGraphics(mode);if(this.quality===next)return;
  this.quality=next;this.settings=GRAPHICS_PRESETS[next];
  this.static.clear();makeWorld(this.static,this.settings);
  this.destroyShadow();this.destroyScene();this.setupShadow();this.resize(true);
 }
 destroyShadow(){const gl=this.gl,s=this.shadowTarget;if(!s)return;
  gl.deleteFramebuffer(s.fb);gl.deleteTexture(s.texture);this.shadowTarget=null;this.shadowOK=false;
 }
 setupShadow(){
  const gl=this.gl,n=this.settings.shadows;if(!n)return;
  const texture=gl.createTexture(),fb=gl.createFramebuffer();
  gl.bindTexture(gl.TEXTURE_2D,texture);
  gl.texImage2D(gl.TEXTURE_2D,0,gl.DEPTH_COMPONENT24,n,n,0,gl.DEPTH_COMPONENT,gl.UNSIGNED_INT,null);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
  gl.bindFramebuffer(gl.FRAMEBUFFER,fb);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.TEXTURE_2D,texture,0);
  gl.drawBuffers([gl.NONE]);gl.readBuffer(gl.NONE);
  this.shadowOK=gl.checkFramebufferStatus(gl.FRAMEBUFFER)===gl.FRAMEBUFFER_COMPLETE;
  gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.bindTexture(gl.TEXTURE_2D,null);
  this.shadowTarget={fb,texture,n};if(!this.shadowOK)this.destroyShadow();
 }
 destroyScene(){const gl=this.gl,s=this.sceneTarget;if(!s)return;
  gl.deleteFramebuffer(s.fb);gl.deleteRenderbuffer(s.depth);gl.deleteTexture(s.texture);this.sceneTarget=null;
 }
 setupScene(){
  if(!this.settings.bloom)return;
  const gl=this.gl,w=this.width,h=this.height;
  const texture=gl.createTexture(),fb=gl.createFramebuffer(),depth=gl.createRenderbuffer();
  gl.bindTexture(gl.TEXTURE_2D,texture);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,w,h,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
  gl.bindRenderbuffer(gl.RENDERBUFFER,depth);gl.renderbufferStorage(gl.RENDERBUFFER,gl.DEPTH_COMPONENT24,w,h);
  gl.bindFramebuffer(gl.FRAMEBUFFER,fb);
  gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,texture,0);
  gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.RENDERBUFFER,depth);
  const ok=gl.checkFramebufferStatus(gl.FRAMEBUFFER)===gl.FRAMEBUFFER_COMPLETE;
  gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.bindTexture(gl.TEXTURE_2D,null);gl.bindRenderbuffer(gl.RENDERBUFFER,null);
  this.sceneTarget={fb,texture,depth,w,h};if(!ok)this.destroyScene();
 }
 resize(force=false){
  const scale=this.settings.resolution;
  const w=Math.min(2800,Math.max(2,Math.floor(innerWidth*scale)));
  const h=Math.min(1800,Math.max(2,Math.floor(innerHeight*scale)));
  if(force||this.canvas.width!==w||this.canvas.height!==h){
   this.canvas.width=w;this.canvas.height=h;this.width=w;this.height=h;
   this.destroyScene();this.setupScene();
  }
 }
 renderShadow(t){
  if(!this.shadowOK)return;
  const gl=this.gl,s=this.shadowTarget;
  // Follow the current play area; a focused sun-map produces much crisper character shadows.
  const eye=[this.target[0]-100,this.target[1]+170,this.target[2]-80];
  const lv=mat4LookAt(eye,this.target);
  this.lightVP=mat4Multiply(mat4Ortho(-104,104,-104,104,1,400),lv);
  gl.bindFramebuffer(gl.FRAMEBUFFER,s.fb);gl.viewport(0,0,s.n,s.n);
  gl.clearDepth(1);gl.clear(gl.DEPTH_BUFFER_BIT);
  gl.colorMask(false,false,false,false);gl.enable(gl.DEPTH_TEST);
  gl.enable(gl.POLYGON_OFFSET_FILL);gl.polygonOffset(1.2,2.8);
  gl.useProgram(this.shadowShader);gl.uniformMatrix4fv(this.shadowLoc.vp,false,this.lightVP);gl.uniform1f(this.shadowLoc.time,t);
  this.static.draw('blade');this.dynamic.draw('blade');
  gl.disable(gl.POLYGON_OFFSET_FILL);gl.colorMask(true,true,true,true);
  gl.bindFramebuffer(gl.FRAMEBUFFER,null);
 }
 addCharacter(p,t){
  const D=this.dynamic,add=(...args)=>D.add(...args),B='cube',C='cyl',S='sphere',K='cone',O='octa';
  const hunter=p.role==='hunter',body=hunter?[.27,.24,.35]:SKINS[(p.skin||0)%SKINS.length];
  const x=p.x,y=p.y+(p.bob||0),z=p.z,a=(p.angle||0)+Math.PI,scale=hunter?1.12:.80;
  const pace=p.moving&&!p.down?Math.sin(t*10.5+(p.skin||0)*.11):0;
  const bounce=p.moving&&!p.down?Math.abs(pace)*.07:0;
  const rot=(dx,dz)=>[dx*Math.cos(a)+dz*Math.sin(a),-dx*Math.sin(a)+dz*Math.cos(a)];
  const part=(mesh,dx,dy,dz,sx,sy,sz,color,mat=0,emiss=0,angle=a)=>{
    const [rx,rz]=rot(dx*scale,dz*scale);
    add(mesh,x+rx,y+(dy+bounce)*scale,z+rz,sx*scale,sy*scale,sz*scale,color,mat,emiss,0,angle);
  };
  if(p.down){
    part(S,0,.36,0,2.7,.62,1.5,body);
    part(S,.9,.57,-.12,1.1,1.05,1.05,[.87,.7,.58]);
    for(const side of [-1,1])part(S,side*1.04,.20,.25,.5,.28,.8,[.24,.30,.37]);
    for(let j=0;j<5;j++){const v=t*2.7+j*TAU/5;
      add(O,x+Math.cos(v)*1.45,y+2+Math.sin(v*1.6)*.18,z+Math.sin(v)*1.45,.4,.48,.4,[1,.77,.33],4,1.2,0,v);}
    return;
  }
  // Retain every original skin and outfit choice, while articulating each arm and leg.
  const step=pace*.44,armSwing=pace*.42,breath=Math.sin(t*2.7)*.035;
  const boots=[.14,.17,.25],fabric=hunter?[.13,.12,.19]:[.24,.30,.39];
  for(const side of [-1,1]){
    const phase=step*side,kneeZ=phase*.65,footZ=phase*.93;
    const lift=Math.max(0,phase)*.27;
    // Hip, knee, shin and separate boots follow alternating stride arcs.
    part(S,side*.39,.80,0,.43,.49,.44,fabric);
    part(C,side*.39,.48,kneeZ*.45,.34,.80,.36,hunter?[.19,.17,.22]:[.25,.31,.40]);
    part(S,side*.39,.37,kneeZ,.37,.36,.41,hunter?[.32,.20,.27]:[.37,.43,.48]);
    part(C,side*.39,.17+lift*.35,(kneeZ+footZ)*.48,.28,.68,.32,[.20,.25,.34]);
    part(S,side*.39,.08+lift,footZ,.62,.30,.85,boots);
    // Two articulated arm sections with elbow and gloved hand.
    const shoulder=side*.92,elbowZ=-side*armSwing*.55,handZ=-side*armSwing;
    part(S,shoulder,1.48,.02,.43,.47,.42,hunter?[.36,.19,.29]:body);
    part(C,shoulder*1.08,1.14,elbowZ*.53,.29,.64,.32,hunter?[.36,.22,.29]:body);
    part(S,side*1.04,.91,elbowZ,.33,.36,.34,hunter?[.25,.23,.27]:lighter(body,.75));
    part(C,side*1.07,.62,(elbowZ+handZ)*.5,.24,.63,.29,hunter?[.34,.22,.27]:lighter(body,.86));
    part(S,side*1.07,.34,handZ,.38,.38,.43,hunter?[.16,.16,.22]:[.87,.71,.56]);
    if(hunter){ // Three wicked claws per hand, angled like hooked talons.
      for(let c=-1;c<=1;c++)part(K,side*1.07+c*.23,.06,handZ-.27,.15,.46,.17,[.74,.77,.81],6,.18);
    }
  }
  // Cloth tunic, detailed shoulder armor, belt, bracers and chest emblem.
  part(C,0,1.17+breath,0,1.35,1.68,.95,body);
  part(S,0,1.88,0,1.36,.72,1.2,hunter?[.16,.14,.2]:lighter(body,.76));
  part(B,0,.84,-.02,1.35,.20,1.01,[.24,.23,.29],8);
  part(O,0,1.45,-.57,.44,.49,.17,hunter?[1,.20,.32]:[.91,.80,.51],4,hunter?2.2:.65);
  // Backpack and utility belt stay intact for all nine avatars.
  if(!hunter){
    part(B,0,1.05,.57,.82,1.02,.55,[.28,.38,.43],8);
    part(B,0,1.0,.87,.55,.19,.11,[.72,.75,.64],4,.18);
  }
  const face=hunter?[.15,.13,.21]:[.87,.71,.57];
  part(S,0,2.31,.04,1.14,1.18,1.1,face);
  part(S,0,2.65,.15,1.25,.57,1.14,hunter?[.15,.13,.2]:lighter(body,.68));
  // Distinct hairstyle accents, keyed to existing avatar index, not replacement skins.
  if(!hunter){
    const skin=p.skin||0;
    if(skin%3===0){part(S,-.44,2.71,.07,.43,.56,.80,[.14,.18,.25]);}
    if(skin%3===1){part(K,0,2.77,.15,.70,.78,.75,[.21,.18,.24]);}
    if(skin%3===2){part(S,.40,2.66,.3,.38,.56,.51,[.22,.23,.32]);}
    part(S,-.38,2.27,-.72,.16,.16,.12,[.08,.16,.22],4,.25);
    part(S,.38,2.27,-.72,.16,.16,.12,[.08,.16,.22],4,.25);
  }else{
    // Hunter is 1.4x a runner (1.12 vs 0.80); horns and cloak retain its menace.
    for(const side of [-1,1]){
      part(K,side*.69,3.0,.1,.59,1.30,.55,[.17,.15,.23],8);
      part(S,side*.39,2.30,-.78,.24,.22,.18,[1,.09,.18],4,2.6);
      part(K,side*.93,1.55,.3,.45,.82,.48,[.25,.24,.31],7);
      part(K,side*.88,.74,.54,.58,1.34,.42,[.24,.15,.22],7);
    }
    part(O,0,2.65,-.40,1.03,.72,.56,[.09,.10,.14],8);
    part(B,0,1.38,.73,1.65,1.92,.36,[.17,.12,.22],7);
    part(K,0,.66,1.10,1.8,1.45,.60,[.21,.14,.23],8);
    part(O,0,3.5,.16,.55,.76,.52,[.74,.20,.29],4,1.3);
    for(let j=0;j<5;j++){const th=t*.8+j*TAU/5;
      add(S,x+Math.sin(th)*2.2,y+(1.6+Math.sin(t*2+j)*.7)*scale,z+Math.cos(th)*2.2,.20,.25,.20,[.76,.11,.31],4,.95);}
  }
 }
 addVehicle(vehicle){
  if(!vehicle)return;
  const D=this.dynamic, a=vehicle.yaw||0,x=vehicle.x,z=vehicle.z,y=.65;
  // The vehicle model faces +z and shares yaw with server-side physics.
  D.add('cube',x,y+0.55,z,3.4,1.08,5.2,[.13,.25,.34],8,0,0,a);
  D.add('cube',x,y+1.40,z-.35,2.75,1.15,2.6,[.17,.29,.44],8,0,0,a);
  D.add('cube',x,y+1.42,z-1.72,2.55,.83,.14,[.42,.81,.93],4,.14,0,a);
  const c=Math.cos(a),sn=Math.sin(a);
  for(const side of [-1,1])for(const front of [-1,1]){
    const lx=side*1.75,lz=front*1.45;
    D.add('cyl',x+lx*c+lz*sn,y+.13,z-lx*sn+lz*c,.83,.42,.83,[.08,.11,.16],8,0,0,a+Math.PI/2);
  }
  for(const side of [-1,1]){
    D.add('sphere',x+side*1.0*c+2.55*sn,y+.95,z-side*1.0*sn+2.55*c,.32,.31,.18,[1,.95,.67],4,1,0,a);
    D.add('sphere',x+side*1.0*c-2.55*sn,y+.95,z-side*1.0*sn-2.55*c,.25,.26,.18,[.95,.18,.25],4,.5,0,a);
  }
 }
 addEffects(t,extras){const D=this.dynamic;
  // Swap pickups: small stone plaques on the ground instead of white diamonds/rings.
  // These are functional pickups; approach one and press R to collect it.
  for(const p of WORLD.powerSites){
    D.add('cyl',p.x,.08,p.z,1.25,.18,1.25,[.30,.34,.43],6,.0);
    D.add('cube',p.x,.19,p.z,.51,.12,.51,[.49,.40,.67],4,.12);
  }
  // Ember fireflies around trees and buildings. Curated rather than thousands of expensive point lights.
  for(let i=0;i<this.settings.fireflies;i++){const a=(i*173.1)%TAU,r=35+(i*19.32)%178,x=Math.cos(a)*r,z=Math.sin(a)*r;
   D.add('sphere',x+Math.sin(t*.58+i)*1.1,2.3+Math.sin(t*1.3+i)*1.6,z+Math.cos(t*.3+i)*.9,.15,.15,.15,
    i%4===0?[1,.69,.39]:[.42,1,.79],4,1.7);}
  // STEP 13: A REAL, VERY LARGE TIME-TRAVEL PORTAL, not a tiny radar marker.
  // Portal positions are streamed only within visual range; all nearby users
  // (including the hunter) see the exact same portal instance in the 3D world.
  const gate=extras?.portal;
  if(gate){
   const {x,z}=gate,ground=gate.y||0,yaw=gate.yaw||0;
   const wave=Math.sin(t*2.6),glimmer=Math.sin(t*4.3)*.5+.5;
   // A horizontal platform with luminous circles and four rune obelisks.
   D.add('cyl',x,ground+.25,z,18,.9,15,[.16,.13,.25],7,.16,0,yaw);
   D.add('cyl',x,ground+.65,z,14,.18,11,[.38,.34,.52],6,.27,0,yaw);
   for(let j=0;j<3;j++)D.add('ring',x,ground+.85+j*.12,z,13+j*2,.16,13+j*2,j===1?[.34,.88,1]:[.75,.48,1],4,1.3,0,t*(j%2?.4:-.5));
   const axisX=Math.cos(yaw),axisZ=-Math.sin(yaw),normalX=Math.sin(yaw),normalZ=Math.cos(yaw);
   const point=(u,h,depth=0)=>[x+axisX*u+normalX*depth,ground+h,z+axisZ*u+normalZ*depth];
   const piece=(shape,u,h,depth,sx,sy,sz,color,emission=0,material=4,rot=yaw)=>
     D.add(shape,...point(u,h,depth),sx,sy,sz,color,material,emission,0,rot);
   // Dark inner plane makes the colors read as a gate, not free-floating rings.
   piece('sphere',0,9.8,0,10.6,17.7,1.3,[.07,.045,.24],.3);
   piece('sphere',0,9.8,.14,9.25,16.0,.85,[.24,.15,.57],1.05);
   piece('sphere',0,9.8,.38,7.4,13.5,.61,[.25,.56,.90],1.6);
   piece('sphere',0,9.8,.58,5.9,10.8,.44,[.73,.98,1],3.5+glimmer*1.6);
   // Bloom-rich layered energy veils and a beacon visible through the fog.
   piece('sphere',0,9.8,.84,6.3,12.1,.20,[.44,.80,1],2.6+glimmer);
   for(let j=0;j<7;j++){const yy=23+j*5.5;
     D.add('ring',x,ground+yy,z,2.3+j*.24,.22,2.3+j*.24,[.48,.75,1],4,1.5+wave*.2,0,t*(j%2?-.5:.6));
     D.add('sphere',x,ground+yy,z,.52,.8,.52,[.59,.75,1],4,1.7);
   }
   // Runic outer arch: 32 glowing, large segmented crystal stones form a real doorway.
   for(let j=0;j<32;j++){
     const a=j*Math.PI*2/32,u=Math.cos(a)*5.8,h=9.8+Math.sin(a)*9.1;
     const color=j%4===0?[.90,.77,1]:j%2?[.26,.81,1]:[.60,.39,.98];
     piece('octa',u,h,.12,1.48,1.78,1.1,color,1.15);
     if(j%2===0)piece('sphere',u*.92,9.8+(h-9.8)*.93,.95,.38,.38,.38,[.93,.98,1],1.9);
   }
   // Portal frame and towers rise above characters and surrounding scenery.
   for(const side of [-1,1]){
     piece('cyl',side*6.7,5.1,-.3,2.0,10.1,2.0,[.30,.28,.41],.15,6);
     piece('cone',side*6.7,11.6,-.3,2.7,4.6,2.7,[.55,.40,.83],.36,6);
     piece('octa',side*6.7,15.6,-.3,1.7,3.7,1.7,[.48,.89,1],1.5);
     piece('octa',side*6.7,18.3,-.3,.65,1.1,.65,[1,.84,.97],2);
   }
   // Fast moving streaks make the portal resemble a luminous time warp.
   for(let j=0;j<22;j++){
     const a=j*2.39996+t*(.33+(j%3)*.13);
     const radial=1.2+((j*11)%41)/10;
     const u=Math.sin(a)*radial,h=9.8+Math.cos(a*1.17)*radial*1.7;
     piece('octa',u,h,1.08+Math.sin(t*2+j)*.35,.24+(j%4)*.05,.53,.2,
       j%2?[.87,.75,1]:[.50,1,1],1.8+glimmer*.3);
   }
   // Floating crown and aura signal to players that this is the escape goal.
   piece('octa',0,21.5,0,2.2,3.4,2.2,[.70,.95,1],4.2,4,t*.9);
   for(let j=0;j<4;j++)piece('ring',0,10,0,13+j*1.8,12+j*1.3,.22,
     j%2?[.67,.29,1]:[.39,.88,1],1.5+glimmer*.7,4,t*(j%2?-.28:.24));
   piece('ring',0,.8,0,2,.16,2,[.78,.9,1],1.6);
  }
  for(const b of extras?.gravityBursts||[]){
    const age=(performance.now()-b.at)/1000,fade=Math.max(0,1-age/1.15);
    for(const loc of [b.from,b.to]){
      if(!loc)continue;
      D.add('ring',loc.x,loc.y+.25,loc.z,3+age*13,.2,3+age*13,[.83,.36,1],4,fade*2);
      for(let j=0;j<9;j++){
        const angle=j*TAU/9+t*5,rad=(1+age*9)*(1+(j%3)*.13);
        D.add('octa',loc.x+Math.sin(angle)*rad,loc.y+Math.cos(angle*2)*(1+age*4),loc.z+Math.cos(angle)*rad,
          .37*fade+.08,.54*fade+.08,.35*fade+.08,[.69,.44,1],4,fade*2);
      }
    }
  }

  for(const shot of extras?.shots||[]){
   const dt=t-shot.t;if(dt<0||dt>.45)continue;
   const a=shot.origin,b=shot.end,fade=1-dt/.45;
   for(let j=0;j<13;j++){const q=j/12;
     D.add('sphere',a.x+(b.x-a.x)*q,a.y+(b.y-a.y)*q,a.z+(b.z-a.z)*q,
       .16+fade*.30,.16+fade*.30,.16+fade*.30,
       shot.hit?[1,.53,.34]:[.59,.90,1],4,1.2);
   }
   if(shot.hit){D.add('ring',b.x,b.y,b.z,2.8+dt*7,.25,2.8+dt*7,[1,.76,.34],4,1.4);
     D.add('sphere',b.x,b.y,b.z,1.6+dt*2,1.6+dt*2,1.6+dt*2,[1,.38,.35],4,1.1);}
  }
  for(const b of extras?.bonks||[]){let dt=t-b.t;if(dt>2.3)continue;
   for(let i=0;i<9;i++){const a=i*TAU/9+dt*7;D.add('octa',b.x+Math.cos(a)*(1+dt*2),b.y+2.6+Math.sin(a*2)*.6+dt*1.4,b.z+Math.sin(a)*(1+dt*2),
    .66,.73,.66,i%2?[.99,.72,.38]:[1,.34,.47],4,1);}
   // giant rubber mallet swings above bonked target, followed by a burst of stars.
   const swing=Math.sin(dt*13)*.75;D.add('cyl',b.x+1.3,b.y+3.2,b.z,.25,2.1,.25,[.65,.39,.23],8,0,0,swing);
   D.add('cyl',b.x+1.3,b.y+4.05,b.z,2.1,1.0,1.0,[.96,.35,.43],0,0,0,swing+PI/2);
  }
 }
 addPowerAuras(t,players){
  const D=this.dynamic;
  for(const p of players){
   if(p.down)continue;
   const effects=p.effects||{};
   if(effects.slow){
    for(let j=0;j<3;j++)D.add('ring',p.x,p.y+.32+j*.72,p.z,1.65,.22,1.65,[.79,.39,1],4,.62,0,t*.6+j);
   }
   // Frozen players get a visible icy lock on every camera, not just a notice.
   if(effects.frozen){
    D.add('cyl',p.x,p.y+.1,p.z,.18,4.1,.18,[.21,.80,1],4,.85);
    for(let i=0;i<4;i++){const v=i*TAU/4+t*.55;
      D.add('octa',p.x+Math.cos(v)*1.12,p.y+1.5+Math.sin(t*2+i)*.45,p.z+Math.sin(v)*1.12,.26,.39,.26,[.49,.87,1],4,1.4);}
    for(let j=0;j<2;j++)D.add('ring',p.x,p.y+.85+j*.8,p.z,1.25,.12,1.25,[.38,.9,1],4,1.1,0,t*.15+j);
    D.add('octa',p.x,p.y+(p.role==='hunter'?6.2:3.1),p.z,.33,.45,.33,[.56,.94,1],4,1.45,0,t*.8);
   }
   if(effects.zeroGravity){
    D.add('ring',p.x,p.y-1.2,p.z,2.9,.17,2.9,[.90,.37,1],4,1.15,0,t*1.1);
    D.add('ring',p.x,p.y+2.1,p.z,2.6,.15,2.6,[.44,.84,1],4,1.0,0,-t*.95);
    D.add('octa',p.x,p.y+3.4,p.z,.65,.9,.65,[.88,.43,1],4,1.2,0,t*.7);
    // Ground locator helps other players spot a floating victim.
    D.add('cyl',p.x,.35,p.z,.22,5.0,.22,[.50,.29,.97],4,.55);
    for(let i=0;i<5;i++){const v=t*.9+i*TAU/5;
      D.add('sphere',p.x+Math.cos(v)*1.65,p.y+1.2+Math.sin(v*1.7)*.8,p.z+Math.sin(v)*1.65,.2,.2,.2,[.89,.61,1],4,.95);}
   }
   if(effects.scramble){
    D.add('ring',p.x,p.y+2.1,p.z,2.2,.2,2.2,[1,.55,.79],4,.8,0,-t*1.5);
   }
   if(effects.boost){
    for(let j=0;j<8;j++){const theta=t*4+j*TAU/8;
     D.add('octa',p.x+Math.cos(theta)*.9,p.y+.25+(j%4)*.43,p.z+Math.sin(theta)*.9,
        .23,.32,.23,[1,.79,.34],4,1.1,0,theta);}
   }
   if(effects.slide){
    D.add('ring',p.x,p.y+.18,p.z,2.4,.18,2.4,[.43,.85,1],4,.92,0,t*1.2);
    D.add('ring',p.x,p.y+.65,p.z,1.6,.17,1.6,[.65,.94,1],4,.55,0,-t*.8);
   }
   if(p.shielded||effects.bribed){
    for(let j=0;j<2;j++)D.add('ring',p.x,p.y+1.25,p.z,3.9,3.4,3.9,
      j?[.77,1,.75]:[.52,.93,1],4,.53,0,t*.7+j*PI/2);
   }
  }
 }
 render(t,players=[],extras={}){
  this.resize();const gl=this.gl,w=this.width,h=this.height;
  this.frameNo++;
  // Populate dynamic instances once, reusing the same data for both shadow and color passes.
  this.dynamic.clear();for(const p of players){if(!p.driving)this.addCharacter(p,t);}this.addVehicle(extras?.vehicle);
  this.addEffects(t,extras);this.addPowerAuras(t,players);this.dynamic.upload(gl.DYNAMIC_DRAW);
  if(this.shadowOK&&(this.frameNo%this.settings.shadowEvery===0||this.frameNo<3))this.renderShadow(t);
  gl.bindFramebuffer(gl.FRAMEBUFFER,this.sceneTarget?.fb??null);
  gl.viewport(0,0,w,h);gl.clearColor(.08,.22,.29,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
  gl.disable(gl.DEPTH_TEST);gl.useProgram(this.sky);
  gl.uniform2f(this.skyLoc.res,w,h);gl.uniform1f(this.skyLoc.time,t);
  gl.uniform1f(this.skyLoc.yaw,this.yaw);gl.uniform1f(this.skyLoc.pitch,this.pitch);
  gl.drawArrays(gl.TRIANGLES,0,3);
  const proj=mat4Perspective(this.scopeZoom?PI/4.4:PI/3.05,w/h,.13,675),view=mat4LookAt(this.cam,this.target);
  this.vp=mat4Multiply(proj,view);
  gl.enable(gl.DEPTH_TEST);gl.useProgram(this.shader);
  gl.uniformMatrix4fv(this.loc.vp,false,this.vp);
  gl.uniformMatrix4fv(this.loc.lightVP,false,this.lightVP);
  gl.uniform3f(this.loc.camera,...this.cam);gl.uniform1f(this.loc.time,t);
  gl.uniform1f(this.loc.shadowEnabled,this.shadowOK?1:0);
  gl.uniform2f(this.loc.shadowTexel,this.shadowOK?1/this.shadowTarget.n:0,this.shadowOK?1/this.shadowTarget.n:0);
  gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,this.shadowTarget?.texture??null);
  gl.uniform1i(this.loc.shadowMap,1);
  this.static.draw();this.dynamic.draw();
  if(this.sceneTarget){
   gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.viewport(0,0,w,h);
   gl.disable(gl.DEPTH_TEST);gl.useProgram(this.postShader);
   gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,this.sceneTarget.texture);
   gl.uniform1i(this.postLoc.scene,0);gl.uniform2f(this.postLoc.pixel,1/w,1/h);
   gl.uniform1f(this.postLoc.glow,this.settings.bloom);gl.uniform1f(this.postLoc.time,t);gl.uniform1i(this.postLoc.samples,this.quality==='cinematic'?10:5);
   gl.drawArrays(gl.TRIANGLES,0,3);
  }
 }
}
