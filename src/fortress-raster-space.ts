import { drawFieldActor } from './field-actors';
import { creatureGaits } from './field-creature-motion';
import { kyuremTiming, type FortressInteriorFrame } from './field-fortress-state';
import { isMazeRoom, mazeFloors } from './fortress-maze';

export type Vertex = [x: number, z: number, elevation: number];
export type Screen = { x: number; y: number };
export type Layer = { z: number; draw: () => void };
export const tau = Math.PI * 2;
export const clamp = (value:number,low=0,high=1) => Math.min(high,Math.max(low,value));
export const noise = (key:number) => { const n=Math.sin(key*127.1+311.7)*43758.545;return n-Math.floor(n); };
export const loop = (x:number,z:number,rx:number,rz:number,h:number,count=32):Vertex[] =>
  Array.from({length:count},(_,i)=>[x+Math.cos(i*tau/count)*rx,z+Math.sin(i*tau/count)*rz,h]);

export function projection(ctx: CanvasRenderingContext2D, frame: FortressInteriorFrame) {
  const { width, height } = ctx.canvas;
  const maze=isMazeRoom(frame.room) ? mazeFloors[frame.room] : undefined;
  const seal=frame.room==='seal', close=seal && frame.inspecting;
  const pitch=maze ? .95 : close ? .52 : seal ? .74 : .64;
  const yaw=maze ? (frame.room==='aqueduct' ? .24 : -.17) : close ? -.13 : seal ? .075 : .10;
  const sin=Math.sin(yaw), cos=Math.cos(yaw), flat=Math.sin(pitch), up=Math.cos(pitch);
  const anchorX=maze ? clamp(frame.x,3.7,maze.width-3.7) : close ? 8.5 : 8.5+(frame.x-8.5)*(seal ? .18 : .60);
  const anchorZ=maze ? clamp(frame.y-1.28,3.6,maze.height-3.6)
    : close ? 6.91 : seal ? 10.55+(frame.y-13.5)*.22 : frame.y-2.95;
  const scale=Math.min(height/(maze?9.8:close?8.15:seal?13.4 : 10.75),width/(maze?11.15:close?11.85:seal?14.1 : 11.8));
  const distance=maze?28:close?25:seal?31 : 20.6;
  const small=width/height<1.50;
  const age=frame.roarAge;
  const shake=seal&&!frame.reduced&&age>=kyuremTiming.voice&&age<2.1 ? Math.exp(-3.8*(age-kyuremTiming.voice)) : 0;
  const hit=seal&&!frame.reduced&&age>=kyuremTiming.impact&&age<1.95 ? Math.exp(-6.8*(age-kyuremTiming.impact)) : 0;
  const x0=width*.5+(shake||hit?scale*(Math.sin(age*72)*.061*shake+Math.sin(age*104)*.041*hit):0);
  const y0=height*(close?(small ? .655 : .70):seal ? .535 : .52)+(shake||hit?scale*Math.cos(age*86)*(.053*shake+.031*hit):0);
  const depth=(x:number,z:number)=>(x-anchorX)*sin+(z-anchorZ)*cos;
  const point=(x:number,z:number,elevation=0):Screen=>{
    const forward=depth(x,z), across=(x-anchorX)*cos-(z-anchorZ)*sin;
    const gain=scale/Math.max(.35,1-(forward*up+elevation*flat)/distance);
    return {x:x0+across*gain,y:y0+(forward*flat-elevation*up)*gain};
  };
  const ground=(px:number,py:number):Screen|undefined=>{
    const sy=(py-y0)/scale, denominator=flat+sy*up/distance;
    if(denominator<=.04)return;
    const f=sy/denominator,across=(px-x0)/scale*(1-f*up/distance);
    const x=anchorX+across*cos+f*sin, y=anchorZ-across*sin+f*cos;
    if(x>=0&&y>=0&&x<(maze?.width??17)&&y<(maze?.height??20))return {x,y};
  };
  return {point,ground,depth,scale,anchorX,anchorZ};
}
export type Projection = ReturnType<typeof projection>;

export function makeRasterPaint(ctx:CanvasRenderingContext2D, frame:FortressInteriorFrame,camera:Projection){
  const {point,scale}=camera;
  const path=(vertices:readonly Vertex[])=>{
    ctx.beginPath();
    for(let i=0;i<vertices.length;i++){
      const p=point(...vertices[i]);
      if(i)ctx.lineTo(p.x,p.y);else ctx.moveTo(p.x,p.y);
    }
  };
  const face=(vertices:readonly Vertex[],color:string|CanvasGradient)=>{
    path(vertices);ctx.closePath();ctx.fillStyle=color;ctx.fill();
  };
  const stroke=(vertices:readonly Vertex[],color:string,weight:number)=>{
    path(vertices);ctx.strokeStyle=color;ctx.lineWidth=Math.max(.65,weight*scale);ctx.stroke();
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

export function addRasterActors(layers:Layer[],frame:FortressInteriorFrame,camera:Projection,ctx:CanvasRenderingContext2D,sortDepth=false,surfaceAt?:(x:number,z:number)=>number){
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
    const alpha=reflection(frame.x,frame.y);
    if(alpha){
      ctx.save();ctx.globalAlpha=alpha;ctx.translate(p.x,p.y);ctx.scale(sz/16,-sz/16*.31);
      drawFieldActor(ctx,'player',frame.facing,step,0,0);ctx.restore();
    }
    shadow(p,sz,.70);
    ctx.save();ctx.translate(p.x,p.y);ctx.scale(sz/16,sz/16);ctx.imageSmoothingEnabled=false;
    drawFieldActor(ctx,'player',frame.facing,step,0,0);ctx.restore();
  }});
}
