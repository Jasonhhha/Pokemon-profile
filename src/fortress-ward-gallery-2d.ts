import type { FortressInteriorFrame } from './field-fortress-state';
import { wardArrival, wardPosts, wardServiceLight, wardWalkway } from './fortress-ward-service';
import { clamp, loop, noise, tau, type Layer, type Projection, type RasterPaint, type Screen, type Vertex } from './fortress-raster-space';

type WardPost = (typeof wardPosts)[number];

function bearings(post: WardPost) {
  const nx = Math.sin(post.bearing), nz = Math.cos(post.bearing);
  return {nx, nz, x: 8.5 + nx * 5.85, z: 6.5 + nz * 5.85};
}

function handwheel(post: WardPost, frame: FortressInteriorFrame) {
  const {x,z}=bearings(post);
  const fault=frame.ward?.fault===post.id;
  const age=frame.wardAdjustmentAge ?? Infinity;
  const progress=clamp((age-.12)/.55), eased=progress*progress*(3-2*progress);
  const turned=fault && (frame.ward?.phase==='braced'||frame.ward?.phase==='stable');
  const spin=turned ? (frame.reduced ? 2.20 : 2.20*eased) : 0;
  const cx=x+(post.tile.x+.5-x)*.32,cz=z+(post.tile.y+.5-z)*.32;
  const onRim=(angle:number,r:number):Vertex=>[cx+Math.cos(angle)*r,cz+.04*Math.sin(angle),.86+Math.sin(angle)*r];
  const handle=onRim(spin+(post.tile.x+.5<x ? Math.PI-.35 : .35),.231);
  return {cx,cz,spin,onRim,handle};
}

export function wardGrip(frame: FortressInteriorFrame, p: RasterPaint) {
  const age=frame.wardAdjustmentAge??Infinity;
  if(frame.reduced || age<0 || age>=.85 || frame.ward?.phase!=='braced')return;
  const post=wardPosts.find(post=>post.id===frame.ward?.fault);
  if(!post || Math.hypot(frame.x-post.tile.x-.5,frame.y-post.tile.y-.5)>.22)return;
  const weight=clamp(age/.12)*clamp((.85-age)/.18);
  if(weight<=0)return;
  return {point:p.point(...handwheel(post,frame).handle),weight};
}

export function pickWardPost(camera: Projection, px: number, py: number, floor?: Screen) {
  // Preserve a deliberate tap on the centre of a walkway, even if a tall spindle overlaps its edge.
  if (floor && wardWalkway(Math.floor(floor.x), Math.floor(floor.y)) &&
      Math.hypot(floor.x % 1 - .5, floor.y % 1 - .5) < .23) return;
  for (const post of wardPosts) {
    const {x, z} = bearings(post);
    const head = camera.point(x, z, 1.88), foot = camera.point(x, z);
    const radius = Math.abs(camera.point(x + .46, z, .6).x - camera.point(x, z, .6).x);
    const t = clamp((py - head.y) / Math.max(1, foot.y - head.y));
    if (py >= head.y - radius * .50 && py <= foot.y + radius * .38 &&
        Math.abs(px - (head.x + t * (foot.x - head.x))) <= radius * (.67 + .33*t))
      return {x: post.tile.x + .5, y: post.tile.y + .5};
  }
}

// Vaults outside the service walls recede over the cistern rather than ending at the screen edge.
export function drawWardSideArcades(p: RasterPaint) {
  const {face, plate, stroke, groundGlow} = p;
  for (const side of [-1,1]) {
    const wall = side<0 ? 1.45 : 15.54;
    const outer = wall+side*8.6;
    face([[wall,-8,-.83],[outer,-8,-.83],[outer,24,-.83],[wall,24,-.83]],'#233b46');
    for (let bay=0;bay<6;bay++) {
      const z=-6.4+bay*5.4;
      const pier=wall+side*3.05;
      groundGlow(pier,z,1.5,2.25,'#73949d37',-.81);
      for (const col of [pier+side*4.55,pier]) {
        plate(col-.55,z-.48,1.10,.96,-.82,-.38,'#59696c','#374d54','#2c414c');
        plate(col-.43,z-.38,.86,.76,-.38,-.15,'#627273','#43575c','#32464f');
        const edges=[-.33,-.15,.16,.33];
        for(let i=0;i<3;i++) {
          face([[col+edges[i],z+.23,-.15],[col+edges[i+1],z+.23,-.15],
            [col+edges[i+1]*.85,z+.20,3.78],[col+edges[i]*.85,z+.20,3.78]],
            ['#475e63','#708082','#56696b'][i]);
        }
        plate(col-.41,z-.36,.82,.72,3.74,3.96,'#6d7b77','#4d6365','#374e59');
      }
      // Stone voussoirs span between the two piers. The opening gives a view along the second aisle.
      const centre=pier+side*2.275;
      const voussoir=(j:number,r:number,dz:number):Vertex=>{
        const a=Math.PI*j/12;
        return [centre+Math.cos(a)*(2.06+r),z+dz,3.92+Math.sin(a)*(1.42+r)];
      };
      for(let j=0;j<12;j++) {
        face([voussoir(j,0,-.17),voussoir(j+1,0,-.17),voussoir(j+1,0,.22),voussoir(j,0,.22)],'#2f4751');
        face([voussoir(j,0,.22),voussoir(j+1,0,.22),voussoir(j+1,.23,.22),voussoir(j,.23,.22)],
          j%3===0?'#657572':'#536769');
      }
      if(bay%2===0) {
        for(let i=0;i<5;i++){
          const dx=side*(1.20+i*.41);
          stroke([[pier+dx,z+.1,-.80],[pier+dx+side*.26,z+.09,-.80]],'#74929a56',.033);
        }
      }
    }
  }
}

export function drawWardDeck(p: RasterPaint) {
  const {stroke, top, face, plate} = p;
  // A recessed gutter crosses the access bridge and turns up each side aisle.
  for (const side of [-1, 1]) {
    const edge = side < 0 ? 2.17 : 14.83;
    const inner = edge - side * .105;
    stroke([[edge,3.08,.047],[edge,12.80,.047],[8.5,12.80,.047]], '#405658', .12);
    stroke([[inner,3.08,.052],[inner,12.69,.052],[8.5,12.69,.052]], '#a99b79', .040);
    for (let z=4; z<12;z+=2) {
      top(edge-.099,z+.10,.198,.62,.054,'#405355');
      for (let i=0;i<5;i++) top(edge-.094,z+.14+i*.11,.188,.037,.057,'#918c79');
    }
    for (let z=3;z<=11;z+=2) {
      const x=side < 0 ? 1.99 : 14.99;
      plate(x-.06,z+.22,.12,.32,-.62,-.038,'#819092','#3a515a','#4e6870');
    }
  }
  for (const post of wardPosts) {
    const {x, z} = bearings(post), sx = post.tile.x+.5, sz = post.tile.y+.5;
    const dx=x-sx, dz=z-sz, d=Math.hypot(dx,dz), ox=-dz/d*.22, oz=dx/d*.22;
    const abutment=(h:number):Vertex[]=>[[sx+ox,sz+oz,h],[x+ox,z+oz,h],[x-ox,z-oz,h],[sx-ox,sz-oz,h]];
    const base=abutment(-.35), cap=abutment(.022);
    for(let i=0;i<4;i++)face([base[i],base[(i+1)%4],cap[(i+1)%4],cap[i]],'#445b60');
    face(cap,'#677875');
    stroke([[sx,sz,.037],[x,z,.037]],'#99906c',.062);
    for(const f of [.30,.66]){
      const ax=sx+dx*f, az=sz+dz*f;
      stroke([[ax-ox*.8,az-oz*.8,.042],[ax+ox*.8,az+oz*.8,.042]],'#b2a282',.036);
    }
  }
}

export function addWardPosts(layers: Layer[], frame: FortressInteriorFrame, p: RasterPaint) {
  for (const post of wardPosts) {
    const pos = bearings(post);
    layers.push({z:pos.z, draw:()=>drawCapstan(post,pos,frame,p)});
  }
}

function drawCapstan(post: WardPost, pos: ReturnType<typeof bearings>, frame: FortressInteriorFrame, p: RasterPaint) {
  const {ctx,point,face,plate,stroke,groundGlow,scale} = p;
  const {x,z,nx,nz} = pos;
  const fault = frame.ward?.fault === post.id, seeking = fault && frame.ward?.phase === 'seeking';
  const repair = fault && frame.ward?.phase === 'braced' ? clamp((frame.wardAdjustmentAge ?? Infinity)/.9) : 1;
  const slack = seeking ? 1 : frame.reduced ? 0 : 1-repair;
  const arrival = wardArrival(post.bearing)-.102;
  const dt = frame.roarAge-arrival;
  const response = (t:number, frequency:number, damping:number) => !frame.reduced&&t>=0&&t<2.5 ? Math.sin(t*frequency)*Math.exp(-t*damping) : 0;
  const kick = response(dt-.102,22,5.6), echo = seeking ? response(dt-.38,15,2.2) : 0;
  const flash = dt>=0&&dt<1.2 ? Math.min(1,dt*15)*Math.exp(-dt*3.2) : 0;
  const amber = slack > .02;
  const service=frame.ward?.phase==='stable' ? wardServiceLight(post.bearing,frame.wardSettledAge??Infinity,frame.reduced) : 0;
  const light=amber?'#ffc577':service>0?
    `rgb(${Math.round(108+117*service)},${Math.round(156+96*service)},${Math.round(152+96*service)})`:'#9aafaa';
  const sweep = frame.reduced ? 0 : kick*.075 + echo*.15;
  const hx = x + nx*sweep, hz = z + nz*sweep;
  const toeX = 8.5+nx*4.74, toeZ=6.5+nz*4.55;
  const ring=(x:number,z:number,r:number,h:number,color:string,w:number) => {
    const vertices=loop(x,z,r,r,h,18); stroke([...vertices,vertices[0]],color,w);
  };

  function chain() {
    for(let j=0;j<13;j++){
      const u=(j+.5)/13;
      const wave=response(dt-u*.102,17.2,6.3); // A pull travels from the collar towards the post.
      const bounce=seeking ? response(dt-.38-u*.15,15,2.6) : 0;
      const y=-.41+2.256*u+Math.sin(Math.PI*u)*(-.14-.44*slack+.115*wave+.23*bounce);
      const left=Math.sin(Math.PI*u)*(.085*bounce+slack*.11);
      const cx=toeX+(hx-toeX)*u+nz*left, cz=toeZ+(hz-toeZ)*u-nx*left;
      const centre=point(cx,cz,y), above=point(cx+.016*nx,cz+.016*nz,y+.034);
      const angle=Math.atan2(above.y-centre.y,above.x-centre.x);
      ctx.save(); ctx.translate(centre.x,centre.y); ctx.rotate(angle);
      ctx.beginPath();ctx.ellipse(0,0,Math.max(1,scale*.12),Math.max(.50,scale*(j%2?.037:.066)),0,0,tau);
      ctx.strokeStyle='#3c4950';ctx.lineWidth=Math.max(.87,scale*.041);ctx.stroke();
      ctx.beginPath();ctx.ellipse(0,0,Math.max(1,scale*.12),Math.max(.50,scale*(j%2?.037:.066)),0,.26,2.95);
      ctx.strokeStyle=j%2?'#afae9e':'#9cacae';ctx.lineWidth=Math.max(.53,scale*.020);ctx.stroke();ctx.restore();
    }
  }
  if (nz>0) chain();
  groundGlow(x,z,.74,.61,amber?'#d5924e66':'#87cfca42',-.12);
  plate(x-.42,z-.36,.84,.72,-.48,.11,'#a4abaa','#647680','#425a67');
  plate(x-.34,z-.30,.68,.60,.11,.28,'#b2afa0','#617480','#3c5560');
  const shaft=(i:number,r:number,h:number):Vertex=>[x+Math.cos(i*tau/9)*r,z+Math.sin(i*tau/9)*r,h];
  const shades=['#7c8b88','#9aa19b','#b1af9d','#929b94','#708485'];
  for(let i=0;i<5;i++)face([shaft(i,.29,.28),shaft(i+1,.29,.28),shaft(i+1,.21,1.46),shaft(i,.21,1.46)],shades[i]);
  ring(x,z,.28,.49,'#b3a588',.058);
  ring(x,z,.23,1.43,'#776b54',.095);
  ring(x,z,.235,1.58,light,.065+service*.040);
  if(service>0)ring(x,z,.246,1.58,'rgba(145,251,238,'+service*.30+')',.12);
  // The enamel witness mark and extra tooth are legible even when motion is reduced.
  for(let j=0;j<(amber?2:1);j++){
    const h=1.18+j*.12;
    stroke([[x-.18,z+.19,h+.05],[x,z+.22,h-.04],[x+.18,z+.19,h+.05]],light,.050);
  }
  // A ratcheted handwheel, mounted at shoulder height on the side facing the gallery.
  const {cx:wx,cz:wz,spin,onRim:wheel,handle}=handwheel(post,frame);
  const wind=spin+kick*.15+echo*.28;
  const rim=Array.from({length:25},(_,i)=>wheel(i*tau/24,.245));
  stroke(rim,'#3e4c4c',.077);stroke(rim,'#c2a574',.042);
  for(let i=0;i<5;i++)stroke([wheel(wind+i*tau/5,.035),wheel(wind+i*tau/5,.231)],'#a8997b',.043);
  const boss=point(wx,wz,.86);ctx.fillStyle=amber?'#e7ad62':'#c3b18b';
  ctx.beginPath();ctx.arc(boss.x,boss.y,Math.max(1.05,scale*.075),0,tau);ctx.fill();
  const knob=point(...handle);
  ctx.fillStyle='#d5b279';ctx.beginPath();ctx.arc(knob.x,knob.y,Math.max(.85,scale*.046),0,tau);ctx.fill();
  const eye:Vertex[]=Array.from({length:21},(_,i)=>[hx+Math.cos(i*tau/20)*.175,hz+.038*Math.sin(i*tau/20),1.82+Math.sin(i*tau/20)*.18]);
  stroke(eye,'#485752',.073);stroke(eye,'#b6a481',.031);
  if (nz<0) chain();
  if (flash>.005 || amber || service>0) {
    const centre=point(hx,hz,1.54),r=Math.max(1,scale*(.37+flash*.18+service*.20));
    const glow=ctx.createRadialGradient(centre.x,centre.y,0,centre.x,centre.y,r);
    glow.addColorStop(0,amber?'rgba(255,185,98,'+(.45+flash*.38)+')':'rgba(174,252,241,'+Math.min(.92,flash*.70+service*.52)+')');
    glow.addColorStop(1,'transparent');ctx.fillStyle=glow;ctx.fillRect(centre.x-r,centre.y-r,r*2,r*2);
  }
  if(!frame.reduced&&dt>.07&&dt<1.2)for(let i=0;i<(seeking?11:7);i++){
    const f=dt-.07-noise(i+17)*.2;if(f<=0)continue;
    const h=1.55+f*(.14+noise(i+20)*.48)-f*f*2.9;
    if(h<-.30)continue;
    const xx=hx+Math.cos(i*2.4)*f*(.22+noise(i+63)*.46),zz=hz+Math.sin(i*2.4)*f*.54;
    stroke([[xx,zz,h],[xx+.024,zz-.01,h+.049]],'#dceff0b8',.032);
  }
}
