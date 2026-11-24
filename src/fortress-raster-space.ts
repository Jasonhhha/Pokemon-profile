import {palaceProjection} from './fortress-palace-camera';
import { drawFieldActor } from './field-actors';
import { creatureGaits } from './field-creature-motion';
import { kyuremTiming, type FortressInteriorFrame } from './field-fortress-state';
import { isMazeRoom, mazeFloors, palaceElevation } from './fortress-maze';

export type Vertex = [x: number, z: number, elevation: number];
export type Screen = { x: number; y: number };
export type Layer = { z: number; draw: () => void };
export const tau = Math.PI * 2;
export const clamp = (value:number,low=0,high=1) => Math.min(high,Math.max(low,value));
export const noise = (key:number) => { const n=Math.sin(key*127.1+311.7)*43758.545;return n-Math.floor(n); };
export const loop = (x:number,z:number,rx:number,rz:number,h:number,count=32):Vertex[] =>
  Array.from({length:count},(_,i)=>[x+Math.cos(i*tau/count)*rx,z+Math.sin(i*tau/count)*rz,h]);

export function projection(ctx: CanvasRenderingContext2D, frame: FortressInteriorFrame) {
  if(isMazeRoom(frame.room))return palaceProjection(ctx,frame,frame.room);
  return hallProjection(ctx,frame);
}

function hallProjection(ctx: CanvasRenderingContext2D, frame: FortressInteriorFrame) {
  const { width, height } = ctx.canvas;
  const maze=isMazeRoom(frame.room) ? mazeFloors[frame.room] : undefined;
  const seal=frame.room==='seal', close=seal && frame.inspecting;
  // Move towards a side aisle before its terminal leaves the frame; the bridge keeps the frontal composition.
  const gallery = seal && !close ? clamp((Math.abs(frame.x-8.5)-1.4)/4.0) : 0;
  const pitch=maze ? .52 : close ? .52 : seal ? .74+gallery*.22 : .43;
  const yaw=maze ? (frame.room==='aqueduct' ? .14 : -.13) : close ? -.13 : seal ? .075-gallery*.13*Math.sign(frame.x-8.5) : .10;
  const sin=Math.sin(yaw), cos=Math.cos(yaw), flat=Math.sin(pitch), up=Math.cos(pitch);
  const anchorX=maze ? clamp(frame.x,3.7,maze.width-3.7) : close ? 8.5 : 8.5+(frame.x-8.5)*(seal ? .18+gallery*.61 : .60);
  const anchorZ=maze ? clamp(frame.y-4.15+Math.max(0,Math.min(1.5,(frame.y-38)*.30)),1,maze.height-3.6)
    : close ? 6.91 : seal ? 10.55+(frame.y-13.5)*(.22+gallery*.49)+gallery*.92 : frame.y-4.25;
  const scale=Math.min(height/(maze?13.6:close?8.15:seal?13.4-gallery*3.0 : 15.4),width/(maze?15.8:close?11.85:seal?14.1-gallery*2.25 : 19.8));
  const altitude=isMazeRoom(frame.room)?palaceElevation(frame.room,frame.x,frame.y):0;
  const distance=maze?29:close?25:seal?31 : 20.6;
  const small=width/height<1.50;
  const age=frame.roarAge;
  const shake=seal&&!frame.reduced&&age>=kyuremTiming.voice&&age<2.1 ? Math.exp(-3.8*(age-kyuremTiming.voice)) : 0;
  const hit=seal&&!frame.reduced&&age>=kyuremTiming.impact&&age<1.95 ? Math.exp(-6.8*(age-kyuremTiming.impact)) : 0;
  const x0=width*.5+(shake||hit?scale*(Math.sin(age*72)*.061*shake+Math.sin(age*104)*.041*hit):0);
  const y0=height*(close?(small ? .655 : .70):seal ? .535 : maze ? .52 : .67)+(shake||hit?scale*Math.cos(age*86)*(.053*shake+.031*hit):0);
  const depth=(x:number,z:number)=>(x-anchorX)*sin+(z-anchorZ)*cos;
  const point=(x:number,z:number,elevation=0):Screen=>{
    elevation-=altitude;
    const forward=depth(x,z), across=(x-anchorX)*cos-(z-anchorZ)*sin;
    const gain=scale/Math.max(.35,1-(forward*up+elevation*flat)/distance);
    return {x:x0+across*gain,y:y0+(forward*flat-elevation*up)*gain};
  };
  const atHeight=(px:number,py:number,elevation:number):Screen|undefined=>{
    elevation-=altitude;
    const sy=(py-y0)/scale, denominator=flat+sy*up/distance;
    if(denominator<=.04)return;
    const f=(sy+elevation*(up-sy*flat/distance))/denominator;
    const across=(px-x0)/scale*(1-(f*up+elevation*flat)/distance);
    return {x:anchorX+across*cos+f*sin,y:anchorZ-across*sin+f*cos};
  };
  const ground=(px:number,py:number):Screen|undefined=>{
    const p=atHeight(px,py,0);
    if(p&&p.x>=0&&p.y>=0&&p.x<(maze?.width??17)&&p.y<(maze?.height??20))return p;
  };
  return {point,ground,atHeight,depth,scale,anchorX,anchorZ,clipDepth:undefined,eye:undefined};
}
export type Projection = ReturnType<typeof projection>;

export function makeRasterPaint(ctx:CanvasRenderingContext2D, frame:FortressInteriorFrame,camera:Projection){
  const {point,scale}=camera;
  const viewDepth=camera.clipDepth;
  const near=.25;
  const through=(a:Vertex,b:Vertex,da:number,db:number):Vertex=>{
    const t=(near-da)/(db-da);return[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t];
  };
  const path=(vertices:readonly Vertex[])=>{
    ctx.beginPath();let started=false;
    const add=(v:Vertex)=>{const q=point(...v);if(started)ctx.lineTo(q.x,q.y);else{ctx.moveTo(q.x,q.y);started=true;}};
    if(!viewDepth){for(const v of vertices)add(v);return;}
    let prev=vertices[vertices.length-1];if(!prev)return;
    let before=viewDepth(...prev);
    for(const v of vertices){
      const d=viewDepth(...v);
      if((d<near)!==(before<near))add(through(prev,v,before,d));
      if(d>=near)add(v);
      prev=v;before=d;
    }
  };
  const face=(vertices:readonly Vertex[],color:string|CanvasGradient)=>{
    path(vertices);ctx.closePath();ctx.fillStyle=color;ctx.fill();
  };
  const stroke=(vertices:readonly Vertex[],color:string,weight:number)=>{
    if(!viewDepth)path(vertices);
    else{
      ctx.beginPath();let previous=vertices[0];if(!previous)return;let before=viewDepth(...previous);
      const first=point(...previous);if(before>=near)ctx.moveTo(first.x,first.y);
      for(const v of vertices.slice(1)){
        const d=viewDepth(...v);
        if(before<near&&d>=near){const q=point(...through(previous,v,before,d));ctx.moveTo(q.x,q.y);}
        if(d>=near){const q=point(...v);ctx.lineTo(q.x,q.y);}
        else if(before>=near){const q=point(...through(previous,v,before,d));ctx.lineTo(q.x,q.y);}
        previous=v;before=d;
      }
    }
    ctx.strokeStyle=color;ctx.lineWidth=Math.max(.65,weight*scale);ctx.stroke();
  };
  const top=(x:number,z:number,w:number,d:number,h:number,color:string|CanvasGradient)=>
    face([[x,z,h],[x+w,z,h],[x+w,z+d,h],[x,z+d,h]],color);
  const plate=(x:number,z:number,w:number,d:number,b:number,h:number,roof:string,front:string,side:string)=>{
    face([[x,z+d,b],[x+w,z+d,b],[x+w,z+d,h],[x,z+d,h]],front);
    const edge=x<frame.x?x+w:x;
    face([[edge,z,b],[edge,z+d,b],[edge,z+d,h],[edge,z,h]],side);
    top(x,z,w,d,h,roof);
  };
  const groundGlow=(x:number,z:number,rx:number,rz:number,color:string,h=-.4)=>{
    const p=point(x,z,h),right=point(x+rx,z,h),near=point(x,z+rz,h);
    ctx.save();ctx.transform(right.x-p.x,right.y-p.y,near.x-p.x,near.y-p.y,p.x,p.y);
    const glow=ctx.createRadialGradient(0,0,0,0,0,1);
    glow.addColorStop(0,color);glow.addColorStop(1,'transparent');
    ctx.fillStyle=glow;ctx.fillRect(-1,-1,2,2);ctx.restore();
  };
  return {ctx,point,scale,path,face,stroke,top,plate,groundGlow};
}
export type RasterPaint=ReturnType<typeof makeRasterPaint>;

export function addRasterActors(layers:Layer[],frame:FortressInteriorFrame,camera:Projection,ctx:CanvasRenderingContext2D,sortDepth=false,surfaceAt?:(x:number,z:number)=>number,grip?:{point:Screen;weight:number}){
  const {point}=camera;
  const order=sortDepth?camera.depth:(_x:number,z:number)=>z;
  const time=frame.reduced?0:frame.now/1000;
  const maze=isMazeRoom(frame.room)?mazeFloors[frame.room]:undefined;
  const reflection=(x:number,z:number)=>{
    if(!maze)return frame.room==='seal' ? .105 : .075;
    const ix=Math.floor(x),iz=Math.floor(z),tile=maze.tiles[iz]?.[ix];
    if(tile==='ice')return .18;
    return tile==='stone'&&noise(iz*maze.width+ix)>.61 ? .13 : 0;
  };
  const shadow=(foot:Screen,size:number,opacity:number)=>{
    ctx.save();ctx.translate(foot.x,foot.y);ctx.transform(size*.46,0,size*.095,size*.15,0,0);
    const falloff=ctx.createRadialGradient(0,0,0,0,0,1);
    falloff.addColorStop(0,'rgba(16,31,43,'+opacity+')');falloff.addColorStop(.56,'rgba(19,38,48,'+opacity*.51+')');falloff.addColorStop(1,'transparent');
    ctx.fillStyle=falloff;ctx.fillRect(-1,-1,2,2);ctx.restore();
  };
  if(frame.companionImage){
    const img=frame.companionImage,cx=frame.companionX??frame.x-.40,cz=frame.companionY??frame.y+.55;
    layers.push({z:order(cx,cz),draw(){
      const floor=surfaceAt?.(cx,cz)??0;
      const p=point(cx,cz,floor),sz=Math.hypot(point(cx,cz,floor+1).y-p.y,point(cx+1,cz,floor).x-p.x)*.63;
      const gait=creatureGaits[frame.companionId??'piplup'],stride=frame.reduced?0:frame.stride;
      const facing=frame.facing==='left'?-1:frame.facing==='right'?1:gait.sourceFacing;
      const bob=sz*(Math.abs(stride)*gait.bounce+gait.airborne*(1+.11*Math.sin(time*gait.pace)));
      const alpha=reflection(cx,cz);
      if(alpha){
        ctx.save();ctx.globalAlpha=alpha;ctx.translate(p.x,p.y+bob*.31);ctx.scale(facing*gait.sourceFacing,-.31);
        ctx.imageSmoothingEnabled=true;ctx.drawImage(img,-sz*.5,-sz*img.height/img.width,sz,sz*img.height/img.width);ctx.restore();
      }
      shadow(p,sz,gait.airborne ? .38 : .64);
      ctx.save();ctx.translate(p.x,p.y-bob);ctx.rotate(stride*gait.sway*.72);ctx.scale(facing*gait.sourceFacing,1);
      ctx.imageSmoothingEnabled=false;ctx.drawImage(img,-sz*.5,-sz*img.height/img.width,sz,sz*img.height/img.width);
      ctx.restore();
    }});
  }
  layers.push({z:order(frame.x,frame.y),draw(){
    const floor=surfaceAt?.(frame.x,frame.y)??0;
    const p=point(frame.x,frame.y,floor),sz=Math.abs(point(frame.x+.7,frame.y,floor).x-p.x)/.7;
    const step=frame.reduced||Math.abs(frame.stride)<.08?0:frame.stride>0?1 : 2;
    function traveler(){
      if(!grip){drawFieldActor(ctx,'player',frame.facing,step,0,0);return;}
      const k=grip.weight, side=grip.point.x<p.x?-1:1, pixel=sz/16;
      ctx.save();
      // The weight stays over the boots while the shoulders follow the handwheel.
      ctx.transform(1,0,-side*k*.13,1-.065*k,0,0);
      drawFieldActor(ctx,'player',side<0?'left':'right',0,0,0);ctx.restore();
      const shoulder={x:side*(3.7+k),y:-11+k*.7};
      const wrist={x:side*6*(1-k)+(grip.point.x-p.x)/pixel*k,y:-7*(1-k)+(grip.point.y-p.y)/pixel*k};
      const elbow={x:shoulder.x+(wrist.x-shoulder.x)*.41,y:Math.max(-7.8,(wrist.y+shoulder.y)*.5+2.9)};
      const segment=(a:Screen,b:Screen,color:string,width:number)=>{
        ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();
        ctx.moveTo(Math.round(a.x),Math.round(a.y));ctx.lineTo(Math.round(b.x),Math.round(b.y));ctx.stroke();
      };
      ctx.lineCap='square';
      segment(shoulder,elbow,'#38394a',3.1);segment(elbow,wrist,'#38394a',2.7);
      segment(shoulder,elbow,'#556c71',1.6);segment(elbow,wrist,'#9b7863',1.3);
      ctx.fillStyle='#e0b58a';ctx.fillRect(Math.round(wrist.x)-1,Math.round(wrist.y)-1,2,2);
    }
    const alpha=reflection(frame.x,frame.y);
    if(alpha){
      ctx.save();ctx.globalAlpha=alpha;ctx.translate(p.x,p.y);ctx.scale(sz/16,-sz/16*.31);
      traveler();ctx.restore();
    }
    shadow(p,sz,.70);
    ctx.save();ctx.translate(p.x,p.y);ctx.scale(sz/16,sz/16);ctx.imageSmoothingEnabled=false;
    traveler();ctx.restore();
  }});
}
