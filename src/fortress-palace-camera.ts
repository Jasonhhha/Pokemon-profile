import {palaceOverlook} from './palace-overlook';
import {palaceElevation,type MazeRoom} from './fortress-maze';
import type {FortressInteriorFrame} from './field-fortress-state';

export function palaceView(room: MazeRoom, x:number, z:number, aspect:number, reveal=0) {
  const fit=Math.max(1,1.26/aspect);
  const wing=Math.max(-1,Math.min(1,(x-24.5)/15)),side=Math.abs(wing)**1.6;
  const southern=Math.max(0,Math.min(1,(z-32)/11)),approach=southern*southern*(3-2*southern);
  const northern=Math.max(0,Math.min(1,(26-z)/13)),recess=northern*northern*(3-2*northern);
  const level=palaceElevation(room,x,z);
  const eye=[x+(1.25+wing*side*4.35+reveal*4.80)*fit,
    level+(7.18+approach*1.71+side*2.75+reveal*5.78+recess*.9)*fit,
    z+(13.75+approach*4.23+side*1.9+reveal*2.9+recess*3.2)*fit] as const;
  const aim=[x-wing*side*2.45,level+2.22+approach*2.31+side*.92+reveal*1.41+recess*2.30,
    z-4.65+approach*.85-reveal*5.0-recess*1.60] as const;
  return {eye,aim};
}

export function behindTraveller(eye:readonly number[],x:number,z:number,siteX:number,siteZ:number){
  if(eye[1]>=16||Math.hypot(eye[0]-siteX,eye[2]-siteZ)>=14)return false;
  const dx=eye[0]-x,dz=eye[2]-z,length=Math.hypot(dx,dz);
  if(length<.00001)return false;
  const a=siteX-x,b=siteZ-z;
  return (a*dx+b*dz)/length>2.7&&Math.abs(b*dx-a*dz)/length<5.5;
}

type ViewStart={room:MazeRoom;x:number;z:number;time:number};
const arrivals=new WeakMap<CanvasRenderingContext2D,ViewStart>();
export function palaceProjection(ctx:CanvasRenderingContext2D,frame:FortressInteriorFrame,room:MazeRoom){
  const {width,height}=ctx.canvas;
  let start=arrivals.get(ctx);
  if(!start||start.room!==room||start.time>frame.now){start={room,x:frame.x,z:frame.y,time:frame.now};arrivals.set(ctx,start);}
  if(frame.reduced||frame.gaitPhase!==undefined||Math.hypot(frame.x-start.x,frame.y-start.z)>.1)start.time=-Infinity;
  const t=Math.min(1,Math.max(0,(frame.now-start.time)/1000));
  const reveal=start.z>40&&Math.abs(start.x-24.5)<3?1-t*t*(3-2*t):0;
  const {eye,aim}=frame.palaceView ? palaceOverlook(frame.palaceView,width/height) : palaceView(room,frame.x,frame.y,width/height,reveal),[ex,ey,ez]=eye;
  const fx=aim[0]-ex,fy=aim[1]-ey,fz=aim[2]-ez,horizontal=Math.hypot(fx,fz),length=Math.hypot(horizontal,fy);
  const dx=fx/length,dy=fy/length,dz=fz/length,rx=-fz/horizontal,rz=fx/horizontal;
  const ux=-rz*dy,uy=rz*dx-rx*dz,uz=rx*dy;
  const focal=height/(2*Math.tan(22*Math.PI/180)),halfW=width*.5,halfH=height*.5;
  const depthAt=(x:number,z:number,h:number)=>dx*(x-ex)+dy*(h-ey)+dz*(z-ez);
  const point=(x:number,z:number,h=0)=>{
    const scale=focal/Math.max(.20,depthAt(x,z,h));
    return {x:halfW+((x-ex)*rx+(z-ez)*rz)*scale,y:halfH-((x-ex)*ux+(h-ey)*uy+(z-ez)*uz)*scale};
  };
  const atHeight=(px:number,py:number,h:number)=>{
    const vx=(px-halfW)/focal,vy=(halfH-py)/focal,y=dy+vy*uy;
    if(Math.abs(y)<.00001)return;
    const t=(h-ey)/y;
    // Projection for picking uses the entire ray line, including a sample plane behind the eye.
    return{x:ex+t*(dx+vx*rx+vy*ux),y:ez+t*(dz+vx*rz+vy*uz)};
  };
  const ground=(px:number,py:number)=>{
    const p=atHeight(px,py,0);if(p&&p.x>=0&&p.y>=0&&p.x<49&&p.y<49)return p;
  };
  return {eye,point,atHeight,ground,clipDepth:depthAt,depth:(x:number,z:number)=>-dx*(x-ex)-dz*(z-ez),
    scale:focal/Math.max(1,depthAt(frame.x,frame.y,palaceElevation(room,frame.x,frame.y))),anchorX:aim[0],anchorZ:aim[2]};
}
