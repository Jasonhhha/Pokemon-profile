import { fortressLiftStops, type FortressInteriorFrame } from './field-fortress-state';
import { isMazeRoom, mazeFloors, type MazeRoom, type MazeTile } from './fortress-maze';
import { createPontoonMotion } from './fortress-pontoons';
import { addAqueductWorks } from './fortress-aqueduct-2d';
import { drawFortressLift2D, tileSkin } from './fortress-raster-materials';
import { addRasterActors, clamp, loop, noise, projection, tau, type Layer, type Projection, type RasterPaint, type Screen, type Vertex } from './fortress-raster-space';

type Floor=typeof mazeFloors[MazeRoom];
type Cell={x:number;z:number;tile:MazeTile;seed:number;salt:number;n:MazeTile;s:MazeTile;e:MazeTile;w:MazeTile};
type Pick={polygon:Screen[];tile:Screen};
type Surface=CanvasRenderingContext2D;
const picks=new WeakMap<Surface,{room:MazeRoom;x:number;y:number;open:boolean;width:number;height:number;items:Pick[]}>();
const wall=(t:MazeTile)=>t==='wall';
const channel=(t:MazeTile)=>t==='channel';
const cells:Partial<Record<MazeRoom,Cell[]>>={};
const pontoons=new WeakMap<Surface,ReturnType<typeof createPontoonMotion>>();
function prepare(room:MazeRoom):Cell[]{
  const floor=mazeFloors[room], at=(x:number,z:number)=>floor.tiles[z]?.[x]??'wall';
  return floor.tiles.flatMap((row,z)=>row.map((tile,x)=>{
    const seed=z*floor.width+x;
    return {x,z,tile,seed,salt:noise(seed),n:at(x,z-1),s:at(x,z+1),e:at(x+1,z),w:at(x-1,z)};
  }));
}
function insidePolygon(vertices:Screen[],px:number,py:number){
  let inside=false;
  for(let i=0,j=vertices.length-1;i<vertices.length;j=i++){
    const a=vertices[i],b=vertices[j];
    if((a.y>py)!==(b.y>py)&&px<(b.x-a.x)*(py-a.y)/(b.y-a.y)+a.x)inside=!inside;
  }
  return inside;
}
export function pickFortressMaze2D(ctx:Surface,frame:FortressInteriorFrame,px:number,py:number){
  const saved=picks.get(ctx);
  if(isMazeRoom(frame.room)&&saved?.room===frame.room&&saved.x===frame.x&&saved.y===frame.y&&saved.open===frame.shortcutOpen&&
     saved.width===ctx.canvas.width&&saved.height===ctx.canvas.height){
    for(let i=saved.items.length-1;i>=0;i--){
      const h=saved.items[i];
      if(insidePolygon(h.polygon,px,py))return h.tile;
    }
  }
  return projection(ctx,frame).ground(px,py);
}

const aqueduct={
  void:'#18292f', deep:'#173d44', fluid:'#538b88', glint:'#c0d3b4', floor:['#a39c83','#b0a68d','#aa9f86','#9b947f'],
  mortar:'#576665', wall:'#667a72', cap:'#89958a', face:'#506663', dark:'#354b4c', light:'#d4ba89', active:'#a7edd0', edge:'#886d48',
};
const catacomb={
  void:'#111e31', deep:'#16324a', fluid:'#466f8c', glint:'#b8deed', floor:['#8c9aa0','#9ca8aa','#99a7aa','#8e9da5'],
  mortar:'#515f70', wall:'#586c83', cap:'#7d90a0', face:'#41546a', dark:'#28394f', light:'#c5c9c6', active:'#a6f5ee', edge:'#817e84',
};
type Palette=typeof aqueduct;
const isPoint=(cell:Cell,p:{x:number;y:number})=>cell.x===p.x&&cell.z===p.y;

export function drawFortressMaze2D(frame:FortressInteriorFrame,room:MazeRoom,camera:Projection,p:RasterPaint){
  const {ctx,point,top,face,stroke,plate,groundGlow}=p;
  const {width,height}=ctx.canvas,floor=mazeFloors[room],cold=room==='catacomb',pal=cold?catacomb:aqueduct;
  const time=frame.reduced?0:frame.now/1000, map=cells[room]??=prepare(room);
  let flotilla=pontoons.get(ctx);
  if(!cold){
    if(!flotilla){flotilla=createPontoonMotion(room);pontoons.set(ctx,flotilla);}
    flotilla.update(frame);
  }
  const layers:Layer[]=[], hits:Pick[]=[];
  const deep=-.49,level=cold?1.17 : 1.02;
  const playerDepth=camera.depth(frame.x,frame.y);
  const heightAt=(x:number,z:number)=>{
    const facing=clamp((camera.depth(x+.5,z+.5)-playerDepth+.25)/.85);
    if(!facing)return level;
    const near=1-clamp((Math.hypot(x+.5-frame.x,z+.5-frame.y)-1.55)/1.65);
    return level-(level-.34)*near*facing*facing*(3-2*facing);
  };
  const gate=frame.shortcutOpen?(frame.reduced?1:clamp((frame.gateAge??2)/1.18)):0;
  const gateProgress=gate*gate*(3-2*gate);
  const register=(c:Cell,vertices:Vertex[])=>hits.push({tile:{x:c.x+.5,y:c.z+.5},polygon:vertices.map(v=>point(...v))});
  const visible=map.filter(c=>{
    const q=point(c.x+.5,c.z+.5,.45), pad=camera.scale*2.15;
    return q.x>-pad&&q.x<width+pad&&q.y>-pad&&q.y<height+pad;
  });

  ctx.save();
  const ambient=ctx.createLinearGradient(0,0,0,height);
  ambient.addColorStop(0,cold?'#253751':'#314846');ambient.addColorStop(1,pal.void);
  ctx.fillStyle=ambient;ctx.fillRect(0,0,width,height);
  top(0,0,floor.width,floor.height,deep,pal.deep);
  for(const c of visible){
    const {x,z,tile,seed,salt}=c;
    if(channel(tile)||tile==='gate'){
      tileSkin(p,x,z,deep+.006,cold?'ice':'water',seed);
      // Reflections lengthen beneath the wet masonry, then break into the flow.
      if(wall(c.n)){
        const reach=.30+.23*salt;
        face([[x,z,deep+.013],[x+1,z,deep+.013],[x+1,z+reach*.92,deep+.013],[x+.64,z+reach,deep+.013],[x+.35,z+reach*.88,deep+.013],[x,z+reach*.93,deep+.013]],cold?'#23394d52':'#1d333a69');
        for(let i=0;i<3;i++){
          const zz=z+reach*(.30+i*.30),dx=frame.reduced?0 : .035*Math.sin(time*.93+i+seed);
          stroke([[x+.08,zz,deep+.017],[x+.40+dx,zz+.018,deep+.017],[x+.85+dx,zz,deep+.017]],cold?'#7691a32e':'#81968c55',.025);
        }
      }
      if(!channel(c.n))stroke([[x,z+.068,deep+.025],[x+.47,z+.047,deep+.025],[x+1,z+.056,deep+.025]],cold?'#b7d8e187':'#a9c9b489',.036);
      if(!channel(c.w))stroke([[x+.058,z,deep+.025],[x+.042,z+.56,deep+.025],[x+.062,z+1,deep+.025]],cold?'#b1d4e580':'#aac5bb7c',.034);
      for(let k=0;k<(cold?2 : 3);k++){
        const f=seed*4+k,shift=time*(cold ? .035 : .24);
        const s=(noise(f)+shift)%1, xx=x+.12+.65*noise(f+821), zz=z+s;
        const bend=cold ? .06 : .026*Math.sin(time*1.7+f);
        stroke([[xx-.07,zz,deep+.016],[xx+.07,zz+bend,deep+.018],[xx+.18+.14*noise(f+16),zz+.017,deep+.018]],
          cold?'#74a5c269':k%2?'#9cbfb16b':'#5d958f88',.018);
      }
      if(cold&&salt>.67){
        const xx=x+.30,zz=z+.39;
        face([[xx-.25,zz,deep+.025],[xx+.15,zz-.18,deep+.025],[xx+.36,zz+.16,deep+.025],[xx-.09,zz+.20,deep+.025]],'#76a6bd60');
      }
      continue;
    }
    if(wall(tile))continue;
    if(channel(c.s))face([[x,z+1,deep],[x+1,z+1,deep],[x+1,z+1,0],[x,z+1,0]],pal.face);
    for(const sign of [-1,1])if(channel(sign<0?c.w:c.e)){
      const edge=x+(sign>0?1 : 0);
      face([[edge,z,deep],[edge,z+1,deep],[edge,z+1,0],[edge,z,0]],pal.dark);
    }
    if(tile==='bridge'||tile==='grate'){
      drawGrating(c,pal,p,cold?0:flotilla!.surfaceAt(x+.5,z+.5));
    }else{
      top(x,z,1.008,1.008,0,pal.mortar);
      for(let row=0;row<2;row++){
        const split=(seed+row)%2 ? .32 : .66;
        top(x+.016,z+row*.5+.015,split-.024,.463,.012,pal.floor[(seed+row)%4]);
        top(x+split+.004,z+row*.50+.015,.974-split,.463,.012,pal.floor[(seed+2+row)%4]);
      }
      tileSkin(p,x,z,.015,cold?'froststone':'sandstone',seed,.31);
      if(salt>.61||tile==='ice'){
        const frigid=tile==='ice', cx=x+.50,cz=z+.50;
        const v:Vertex[]=Array.from({length:12},(_,i)=>{
          const t=i*tau/12,r=.64+.33*noise(seed+i);
          return [cx+Math.cos(t)*r*.54,cz+Math.sin(t)*r*.49,.021];
        });
        face(v,frigid?'#72a5ba99':'#70878056');
        stroke(v.slice(2,6),frigid?'#d2eff065':'#c9c2a577',.022);
        if(frigid)stroke([[cx-.37,cz+.16,.028],[cx-.09,cz-.03,.028],[cx+.08,cz+.02,.028],[cx+.36,cz-.23,.028]],'#d4f4fb8f',.022);
      }
    }
    const up=isPoint(c,floor.up),down=isPoint(c,floor.down);
    if(up||down){
      drawStairs(c,down,cold,p);
      layers.push({z:camera.depth(x+.50,z-.02),draw(){drawStairPortal(c,down,cold,p,register);}});
    }
    if(cold&&isPoint(c,fortressLiftStops.catacomb))drawFortressLift2D(x,z,frame.liftUnlocked,p);
    if(isPoint(c,floor.switch)){
      layers.push({z:camera.depth(x+.5,z+.5),draw:()=>drawSwitch(c,gateProgress,cold,p,register)});
    }
  }
  if(cold){
    ctx.save();ctx.beginPath();
    for(const c of visible)if(channel(c.tile)){
      const corners=[[c.x,c.z],[c.x+1,c.z],[c.x+1,c.z+1],[c.x,c.z+1]];
      corners.forEach(([x,z],i)=>{const q=point(x,z,deep);if(i)ctx.lineTo(q.x,q.y);else ctx.moveTo(q.x,q.y);});ctx.closePath();
    }
    ctx.clip();
    for(const [cx,cz] of [[17.5,12.5],[7.5,3.5],[8.5,10.5]]){
      groundGlow(cx,cz,4.1,2.8,'#8ed9f16a',deep+.016);
      for(let k=0;k<6;k++){
        const a=k*tau/6+cx*.51,crease:Vertex[]=[];
        for(let j=0;j<10;j++){
          const r=.15+j*.51,theta=a+(noise(cx+j*21+k*47)-.5)*.24;
          crease.push([cx+Math.cos(theta)*r,cz+Math.sin(theta)*r,deep+.023]);
          if(j===4){
            const [x,z]=crease[j];
            stroke([[x,z,deep+.022],[x+.45*Math.cos(a+.85),z+.45*Math.sin(a+.85),deep+.022],[x+1.05*Math.cos(a+.62),z+1.05*Math.sin(a+.62),deep+.022]],'#a2deea79',.032);
          }
        }
        stroke(crease,'#446a8baf',.077);
        stroke(crease.map(([x,z,h]):Vertex=>[x-.027,z+.015,h]),'#a5e7eaac',.027);
      }
    }
    ctx.restore();
  }else if(!frame.reduced&&flotilla){
    for(const wake of flotilla.wakes){
      const age=time-wake.time;
      if(age<0||age>1.35)continue;
      ctx.save();ctx.beginPath();
      for(const c of visible)if(channel(c.tile)&&Math.hypot(c.x+.5-wake.x,c.z+.5-wake.z)<2){
        const v=[[c.x,c.z],[c.x+1,c.z],[c.x+1,c.z+1],[c.x,c.z+1]];
        v.forEach(([x,z],i)=>{const q=point(x,z,deep);if(i)ctx.lineTo(q.x,q.y);else ctx.moveTo(q.x,q.y);});ctx.closePath();
      }
      ctx.clip();
      for(const lag of [0,.27]){
        const r=age*.83-lag;
        if(r<=0)continue;
        const wave=loop(wake.x,wake.z,r,r,deep+.025,28);
        stroke([...wave,wave[0]],'rgba(203,231,207,'+((1-age/1.35)*wake.strength*.73)+')',.035);
      }
      ctx.restore();
    }
  }
  // Pools of light mark fittings without obscuring forked paths or their stone edges.
  for(const fixture of [floor.switch,...floor.landmarks]){
    const x=fixture.x+.5,z=fixture.y+.5,q=point(x,z,0);
    if(q.x< -p.scale*3||q.x>width+p.scale*3||q.y< -p.scale*3||q.y>height+p.scale*3)continue;
    const isLever=fixture===floor.switch;
    groundGlow(x,z,isLever?1.84 : 2.31,isLever?1.47 : 1.78,cold?'#a9d5e735':isLever?'#e5c88952':'#f1d29535',.035);
  }
  for(const c of visible){
    if(!wall(c.tile))continue;
    const {x,z}=c;
    const h=heightAt(x,z);
    if(!wall(c.s))face([[x,z+1,.015],[x+1,z+1,.015],[x+1.21,z+1.32,.015],[x+.18,z+1.32,.015]],cold?'#1d364b32':'#233e3c35');
    layers.push({z:camera.depth(x+.5,z+.5),draw(){drawWall(c,h,cold,pal,p,register,heightAt);}});
  }
  const gateCell=map[floor.gate.y*floor.width+floor.gate.x];
  layers.push({z:camera.depth(gateCell.x+.5,gateCell.z+.50),draw(){drawGate(gateCell,gateProgress,cold,pal,p,register);}});
  if(!cold)addAqueductWorks(layers,camera,p,time,(surface,x,z)=>{
    const c=map[Math.floor(z)*floor.width+Math.floor(x)];
    if(channel(c.tile))register(c,surface);
  });
  for(const landmark of floor.landmarks){
    const c=map[landmark.y*floor.width+landmark.x];
    const x=c.x+.5,z=c.z+.50;
    const q=point(x,z,.9);
    if(q.x< -p.scale||q.x>width+p.scale||q.y< -p.scale*2||q.y>height+p.scale*2)continue;
    layers.push({z:camera.depth(x,z)+.09,draw(){drawLandmark(landmark.kind,x,z,time,pal,p);}});
  }
  addRasterActors(layers,frame,camera,ctx,true,cold?undefined:flotilla?.surfaceAt);
  layers.sort((a,b)=>a.z-b.z).forEach(item=>item.draw());
  for(const location of [floor.down,floor.switch]){
    const x=location.x+.5,z=location.y+.5;
    if(location===floor.switch&&frame.shortcutOpen)continue;
    groundGlow(x,z,.51,.50,cold?'#9ae6e530':'#d0c19637',.055);
  }
  const shade=ctx.createRadialGradient(width*.5,height*.51,height*.29,width*.5,height*.54,Math.max(width*.73,height*.79));
  shade.addColorStop(0,'#11243700');shade.addColorStop(1,cold?'#0a172471':'#0b211d60');
  ctx.fillStyle=shade;ctx.fillRect(0,0,width,height);ctx.restore();
  picks.set(ctx,{room,x:frame.x,y:frame.y,open:frame.shortcutOpen,width,height,items:hits});
}

function drawGrating(c:Cell,pal:Palette,p:RasterPaint,bob:number){
  const {x,z}=c, iron=c.tile==='grate', alongX=channel(c.n)&&channel(c.s)||!channel(c.w)&&!wall(c.w);
  const rect=(l:number,w:number,b:number,d:number,h:number,ink:string)=>
    alongX?p.top(x+l,z+b,w,d,h+bob,ink):p.top(x+b,z+l,d,w,h+bob,ink);
  rect(0,1,0,1,0,iron?'#485f60':'#514b3c');
  for(let i=0;i<7;i++)rect(i/7+.009,.119,.075,.85,.023,iron?(i%2?'#71837c':'#83918a'):(i%3?'#a59372':'#b0a184'));
  for(const j of [.06,.90]){
    rect(0,1,j,.056,.039,iron?pal.edge:'#786c52');
    for(const i of [.08,.50,.88])rect(i,.043,j,.040,.047,'#d4c7a5');
  }
}
type Register=(c:Cell,v:Vertex[])=>void;
function drawWall(c:Cell,h:number,cold:boolean,pal:Palette,p:RasterPaint,register:Register,heightAt:(x:number,z:number)=>number){
  const {x,z,salt}=c,{face,stroke,top}=p;
  const front:Vertex[]=[[x,z+1,-.49],[x+1,z+1,-.49],[x+1,z+1,h],[x,z+1,h]];
  const roof:Vertex[]=[[x,z,h],[x+1,z,h],[x+1,z+1,h],[x,z+1,h]];
  if(!wall(c.s)){
    face(front,pal.face);register(c,front);
    for(let y=-.09;y<h-.18;y+=.37){
      stroke([[x,z+1.006,y],[x+1,z+1.006,y]],pal.dark,.026);
      const xx=x+((Math.round(y*3)+c.seed)%2 ? .32 : .69);
      stroke([[xx,z+1.006,y],[xx,z+1.006,Math.min(h-.06,y+.35)]],pal.dark,.021);
    }
  }else if(h>heightAt(x,z+1)+.025){
    const low=heightAt(x,z+1),ledge:Vertex[]=[[x,z+1,low],[x+1,z+1,low],[x+1,z+1,h],[x,z+1,h]];
    face(ledge,pal.face);register(c,ledge);
  }
  for(const sign of [-1,1]){
    const neighbor=sign<0?c.w:c.e;
    const low=wall(neighbor)?heightAt(x+sign,z):-.48;
    if(low>=h-.025)continue;
    const xx=x+(sign>0?1 : 0),side:Vertex[]=[[xx,z,low],[xx,z+1,low],[xx,z+1,h],[xx,z,h]];
    face(side,sign<0?pal.dark:pal.wall);register(c,side);
    for(let y=low+.38;y<h-.18;y+=.37)stroke([[xx,z,y],[xx,z+1,y]],pal.dark,.023);
  }
  const core=wall(c.n)&&wall(c.s)&&wall(c.w)&&wall(c.e);
  face(roof,cold?(core?'#3c5064':'#526777'):(core?'#4c5d59':'#66766b'));register(c,roof);
  tileSkin(p,x,z,h+.008,cold?'slate':'cap',c.seed,core ? .25 : .40);
  const rim=(zz:number)=>stroke([[x,zz,h+.014],[x+1,zz,h+.014]],'#5267728c',.022);
  if(c.s!=='wall'||c.n!=='wall'){
    rim(z+.15);rim(z+.83);
    const joint=x+(c.seed%2 ? .40 : .68);
    stroke([[joint,z+.16,h+.017],[joint,z+.82,h+.017]],'#556b738d',.025);
  }else if(salt>.61){
    stroke([[x+.11,z+.32,h+.014],[x+.76,z+.32,h+.014],[x+.76,z+.88,h+.014]],'#52667571',.025);
  }
  if(!wall(c.s)&&h>.69)wallBay(c,h,cold,pal,p);
  if(!cold&&c.s==='channel'&&h>.66){
    // A length of service pipe and its split couplings follow the exposed quay face.
    const front=z+1.040,pipe=h-.255;
    stroke([[x,front,pipe],[x+1,front,pipe]],'#3b504b',.107);
    stroke([[x,front+.014,pipe+.016],[x+1,front+.014,pipe+.016]],'#948565',.063);
    for(const off of [.115,.87]){
      stroke([[x+off,front+.027,pipe-.054],[x+off,front+.027,pipe+.063]],'#ac9b75',.046);
    }
    if(c.seed%3===2)stroke([[x+.56,front+.008,pipe],[x+.56,front+.065,pipe-.20],[x+.56,front+.24,pipe-.23]],'#7b816a',.092);
  }
  const ink=cold?'#b2bdb984':'#c8bc997c';
  if(!wall(c.s))top(x+.011,z+.90,.98,.093,h+.012,ink);
  if(!wall(c.e))top(x+.91,z+.016,.073,.98,h+.012,ink);
  if(salt>.72){
    stroke([[x+.12,z+.10,h+.012],[x+.33,z+.28,h+.012],[x+.23,z+.42,h+.012],[x+.47,z+.58,h+.012]],
      cold?'#accbdc8a':'#687a708a',.019);
  }
}
function drawStairs(c:Cell,down:boolean,cold:boolean,p:RasterPaint){
  const {x,z}=c,{plate,stroke,top}=p,brass=down?(cold?'#c6eff0':'#a7ded1'):'#e4bc76';
  for(let i=0;i<6;i++){
    const front=z+.08+i*.14, h=.05+(down?5-i:i)*.047;
    plate(x+.07,front,.86,.144,-.06,h,cold?'#a1b4bf':'#b9b393','#6c7774','#566969');
    stroke([[x+.09,front+.134,h+.007],[x+.91,front+.134,h+.007]],i===0||i===5?brass:'#c6cabe',.029);
  }
  for(const xx of [x+.04,x+.91])top(xx,z+.035,.052,.93,.10,brass);
}
function drawSwitch(c:Cell,progress:number,cold:boolean,p:RasterPaint,register:Register){
  const x=c.x+.50,z=c.z+.42,{plate,face,stroke}=p;
  const top=.53;
  plate(x-.26,z-.18,.52,.38,0,.13,'#a7aaa0','#697c79','#425b5c');
  plate(x-.16,z-.13,.32,.26,.13,top,'#9d967c','#7f7961','#435b62');
  const wheel=(a:number,r:number):Vertex=>[x+Math.cos(a)*r,z+.16,top+.11+Math.sin(a)*r];
  for(const [r,w,ink] of [[.28,.052,'#e2be81'],[.21,.034,progress>.55?'#a2f2dc':cold?'#a1c2d1':'#8aaea4']] as const){
    for(let i=0;i<20;i++)face([wheel(i*tau/20,r),wheel((i+1)*tau/20,r),wheel((i+1)*tau/20,r-w),wheel(i*tau/20,r-w)],ink);
  }
  for(let i=0;i<6;i++){const a=i*tau/6+progress*2.7;stroke([wheel(a,.036),wheel(a,.23)],'#cba778',.037);}
  register(c,[[x-.32,z+.19,.10],[x+.32,z+.19,.10],[x+.32,z+.19,.95],[x-.32,z+.19,.95]]);
}
function drawGate(c:Cell,progress:number,cold:boolean,pal:Palette,p:RasterPaint,register:Register){
  const {x,z}=c,{plate,face,stroke}=p;
  if(!cold){
    const theta=(1-progress)*1.44;
    const deck=(u:number,v:number):Vertex=>[x+.026+u*.95*Math.cos(theta),z+.09+v*.82,.08+u*.95*Math.sin(theta)];
    plate(x+.94,z+.045,.123,.91,-.36,.074,'#b2b19b','#586964','#475753');
    for(const v of [0,1]){
      const zz=z+.08+v*.84;
      plate(x-.11,zz-.077,.25,.154,-.35,.073,'#999c82','#53665e','#485551');
      stroke([[x-.075,zz,.07],[x+.014,zz,.88],[x+.139,zz,.07]],'#485852',.084);
      stroke([[x-.066,zz-.006,.07],[x+.021,zz-.006,.85]],'#a58b61',.032);
    }
    const plank=[deck(0,0),deck(1,0),deck(1,1),deck(0,1)];
    face(plank,'#5b584c');register(c,plank);
    for(let i=0;i<7;i++){
      const a=i/7+.008,b=(i+1)/7-.013;
      face([deck(a,.04),deck(b,.04),deck(b,.96),deck(a,.96)],i%3?'#a58f6a':'#b9a781');
    }
    for(const v of [0,1]){
      stroke([deck(0,v),deck(1,v)],pal.light,.054);
      plate(x-.032,z+.075+v*.84,.12,.12,-.10,.39,pal.light,pal.face,pal.dark);
      const end=deck(.87,v),start:Vertex=[x+.012,z+.08+v*.84,.85];
      const sag:Vertex=[(start[0]+end[0])*.5,(start[1]+end[1])*.5,(end[2]+start[2])*.5-.042];
      stroke([start,sag,end],'#514f43',.052);
      stroke([[start[0]-.012,start[1],start[2]+.013],sag,end],'#b19b76',.020);
      plate(x-.027,z+.051+v*.84,.075,.060,.83,.92,'#ecdba0',progress>.70?'#99d5b7':'#b1885c',pal.dark);
    }
  }else{
    const lift=.05+progress*1.01;
    p.top(x+.04,z+.04,.92,.92,-.015,'#718b9b');
    tileSkin(p,x,z,-.012,'froststone',c.seed,.48);
    for(const xx of [x-.045,x+.91])plate(xx,z+.41,.135,.25,-.05,1.38,'#9ab3ba','#657d90','#3c5268');
    for(let i=0;i<7;i++){
      const xx=x+.105+i*.131;
      stroke([[xx,z+.53,lift],[xx,z+.53,1.37]],'#6c8997',.084);
      stroke([[xx-.016,z+.53,lift+.02],[xx-.016,z+.53,1.37]],'#a4cad1',.024);
      face([[xx-.046,z+.54,lift+.095],[xx+.045,z+.54,lift+.095],[xx,z+.55,lift-.058]],'#bbd5df');
      if(progress<.96)register(c,[[xx-.042,z+.53,lift],[xx+.042,z+.53,lift],[xx+.042,z+.53,1.37],[xx-.042,z+.53,1.37]]);
    }
    stroke([[x+.05,z+.53,lift+.07],[x+.95,z+.53,lift+.07]],'#7eaaa9',.09);
    plate(x-.08,z+.39,1.16,.28,1.38,1.56,'#a8c3c7','#8198a8','#53677a');
    for(const xx of [x+.04,x+.96]){
      stroke([[xx,z+.67,.095],[xx,z+.67,1.23]],'#375568',.046);
      stroke([[xx,z+.678,.095],[xx,z+.678,1.23]],progress>.50?'#b1f0e8':'#80abc0',.021);
    }
    if(progress<.96)register(c,[[x+.05,z+.53,lift+.025],[x+.95,z+.53,lift+.025],[x+.95,z+.53,lift+.115],[x+.05,z+.53,lift+.115]]);
  }
}
function drawLandmark(kind:Floor['landmarks'][number]['kind'],x:number,z:number,t:number,pal:Palette,p:RasterPaint){
  const {face,plate,stroke,groundGlow}=p;
  if(kind==='gauge'){
    plate(x-.18,z-.13,.36,.28,-.48,1.39,'#a99b79','#aeac8e','#5b6c65');
    for(let i=0;i<9;i++)stroke([[x-.14,z+.154,-.23+i*.17],[x+(i%3===0 ? .13:-.015),z+.154,-.23+i*.17]],'#385954',.033);
    plate(x-.22,z-.19,.44,.38,1.38,1.48,'#c5a575','#8f795c','#53605b');return;
  }
  if(kind==='turbine'){
    const hub=.25;
    const polar=(a:number,r:number,offset:number):Vertex=>[x+Math.cos(a)*r,z+offset,hub+Math.sin(a)*r];
    const wheelRim=(offset:number,edge:string,shine:string)=>{
      for(const [r,w] of [[.59,.068],[.20,.05]]){
        const arc=Array.from({length:29},(_,i)=>polar(i*tau/28,r,offset));
        stroke(arc,edge,w);
        stroke(arc.slice(0,14),shine,.025);
      }
    };
    for(const dz of [-.33,.33]){
      plate(x-.25,z+dz-.11,.50,.22,-.49,.02,'#929884','#5e6d66','#46524d');
      stroke([[x-.16,z+dz,.04],[x,z+dz,hub+.08],[x+.16,z+dz,.04]],'#8e8c70',.095);
    }
    wheelRim(-.18,'#57695c','#b6ad82');
    const rotation=t*.49;
    for(let i=0;i<10;i++){
      const a=i*tau/10+rotation;
      face([polar(a,.54,-.18),polar(a+.07,.69,-.18),polar(a+.07,.69,.19),polar(a,.54,.19)],i%2?'#938e68':'#7d9279');
      stroke([polar(a,.12,.18),polar(a,.56,.18)],'#b1a579',.048);
    }
    wheelRim(.19,'#8f8e6d','#dfc99b');
    stroke([[x,z+.04,hub],[x,z+.41,hub]],'#d0be91',.12);
    // Foam follows the submerged paddle tips on the downstream side.
    for(let i=0;i<6;i++){
      const a=t*1.2+i*1.31,r=.43+.035*Math.sin(a);
      stroke([[x-r,z+.19+i*.052,-.45],[x-.12,z+.24+i*.054,-.45],[x+.18+Math.sin(a+1)*.10,z+.23+i*.056,-.45]],i%2?'#bdd2bb77':'#80b0a35c',.029);
    }
    return;
  }
  if(kind==='sarcophagus'){
    plate(x-.48,z-.54,.96,1.08,-.49,.14,'#8296a5','#46586c','#31485d');
    plate(x-.43,z-.45,.86,.90,.14,.25,'#b0b9ba','#718994','#526d7f');
    const body=(h:number,k:number):Vertex[]=>[[-.32,-.44],[.32,-.44],[.40,-.19],[.30,.43],[-.30,.43],[-.40,-.19]].map(([dx,dz])=>[x+dx*k,z+dz*k,h]);
    const base=body(.23,.95),lid=body(.71,1.01),crest=body(.84,.80);
    for(let i=0;i<6;i++){
      face([base[i],base[(i+1)%6],lid[(i+1)%6],lid[i]],i<2?'#526a80':'#728697');
      face([lid[i],lid[(i+1)%6],crest[(i+1)%6],crest[i]],i<2?'#8fa7b5':'#a9bbc1');
    }
    face(crest,'#bcc8ca');
    stroke([...crest,crest[0]],'#dbe4e1',.030);
    const seal=loop(x,z-.028,.172,.205,.851,16);
    stroke([...seal,seal[0]],'#7b8c9d',.039);
    for(const s of [-1,1])stroke([[x+s*.25,z-.19,.85],[x+s*.19,z-.24,.85],[x+s*.15,z-.16,.85]],'#8d9aa7',.034);
    stroke([[x,z-.13,.85],[x+.068,z,.85],[x,z+.13,.85],[x-.068,z,.85],[x,z-.13,.85]],'#78b7c5',.04);
    return;
  }
  groundGlow(x,z,.88,.66,'#93d6dc5a');
  for(const [dx,dz,r,h] of [[-.18,.07,.20,1.09],[.08,-.07,.25,1.67],[.29,.09,.13,.80]]){
    const ring=loop(x+dx,z+dz,r,r*.76,-.34,6), tip:Vertex=[x+dx+.14,z+dz-.04,h];
    for(let i=0;i<6;i++)face([ring[i],ring[(i+1)%6],tip],[pal.active,'#76a4b9','#cedee3','#8ab5c4','#6291ad','#c5e9e8'][i]);
  }
}

function wallBay(c:Cell,h:number,cold:boolean,pal:Palette,p:RasterPaint){
  const {x,z,seed}=c,{face,stroke,top,plate}=p, f=z+1.018;
  if(seed%5===2||seed%5===3){
    const k=cold ? .19 : .22;
    const arch=(i:number):Vertex=>{
      const a=i*Math.PI/10;
      return [x+.50+Math.cos(a)*k,f,.13+Math.sin(a)*(cold ? .34 : .22)];
    };
    const v=Array.from({length:11},(_,i)=>arch(i));
    face([[x+.5+k,f,-.23],...v,[x+.5-k,f,-.23]],cold?'#253448':'#2a4346');
    stroke(v,pal.cap,.064);
    for(let i=-1;i<=1;i++)stroke([[x+.5+i*.104,f,-.24],[x+.5+i*.104,f,.20+(!i ? .10 : 0)]],cold?'#43586e':'#626f64',.034);
    stroke([[x+.26,f,-.18],[x+.74,f,-.18]],pal.edge,.041);
  }
  if(cold&&seed%4===1){
    // Tomb niches repeat an inset lintel, chamfered tablet and raised frost seal.
    const tab:Vertex[]=[[x+.18,f,.10],[x+.82,f,.10],[x+.82,f,h-.32],[x+.68,f,h-.21],[x+.32,f,h-.21],[x+.18,f,h-.32]];
    face(tab,'#364b63');stroke([...tab,tab[0]],'#8e9ea8',.036);
    for(const dx of [.33,.50,.67])stroke([[x+dx,f,.24],[x+dx+.035,f,.32],[x+dx-.013,f,.43]],'#728d9e',.027);
  }
  if(seed%4===0){
    const trim=cold?'#8397ad':'#91a18f';
    plate(x+.07,z+.98,.14,.105,-.44,h-.04,trim,pal.face,pal.dark);
    top(x+.04,z+.95,.20,.18,h+.015,trim);
  }
  if(seed%7===0){
    const xx=x+.74,yy=h*.59;
    stroke([[xx,f,yy+.22],[xx,f+.05,yy+.12]],pal.edge,.041);
    const glow=cold?'#a6dcf0':'#efd394';
    plate(xx-.057,f,.114,.097,yy-.12,yy+.09,pal.cap,glow,pal.dark);
    const pos=p.point(xx,f+.11,yy),r=p.scale*.51,g=p.ctx.createRadialGradient(pos.x,pos.y,0,pos.x,pos.y,r);
    g.addColorStop(0,cold?'#83c9ea79':'#ead08a82');g.addColorStop(1,'transparent');
    p.ctx.fillStyle=g;p.ctx.fillRect(pos.x-r,pos.y-r,r*2,r*2);
  }
  if(cold&&seed%3===0){
    for(let i=0;i<3;i++){
      const xx=x+.12+i*.28,lip=Math.min(.47,.13+.30*noise(seed+i));
      face([[xx-.036,f,h-.01],[xx+.061,f,h-.02],[xx+.020,f+.012,h-lip]],i%2?'#b4d8e0':'#8fb6ca');
    }
  }
}

function drawStairPortal(c:Cell,down:boolean,cold:boolean,p:RasterPaint,register:Register){
  const {x,z}=c,{face,stroke,plate}=p,ox=x+.5,oz=z+.045,h=.92;
  const metal=down?(cold?'#91c9d7':'#73aa9b'):'#bc9c69';
  for(const sign of [-1,1]){
    const xx=ox+sign*.51;
    plate(xx-.10,oz-.14,.20,.28,-.06,1.00,'#abb2ab',cold?'#687f92':'#819182','#586d6d');
    plate(xx-.14,oz-.16,.28,.32,.82,1.00,'#d0c6a9','#91968a','#6a7d7a');
    register(c,[[xx-.10,oz+.14,0],[xx+.10,oz+.14,0],[xx+.10,oz+.14,1],[xx-.10,oz+.14,1]]);
    stroke([[xx,oz+.16,.12],[xx,oz+.16,.64]],metal,.040);
  }
  const v=(i:number,extra:number):Vertex=>{
    const a=i*Math.PI/16;
    return [ox+Math.cos(a)*(.51+extra),oz+.10,h+Math.sin(a)*(.54+extra)];
  };
  for(let i=0;i<16;i++){
    const archStone=[v(i,0),v(i+1,0),v(i+1,.14),v(i,.14)];
    face(archStone,i%3?'#a9b2a7':'#c4c0a8');register(c,archStone);
  }
  stroke(Array.from({length:17},(_,i)=>v(i,.084)),metal,.040);
  const yy=1.57;
  const marker:Vertex[]=[[ox,oz+.12,yy+.13],[ox+.14,oz+.12,yy],[ox,oz+.12,yy-.13],[ox-.14,oz+.12,yy]];
  face(marker,down?'#b3ebdc':'#e5c98f');register(c,marker);
  const up=down?1:-1;
  stroke([[ox-.064,oz+.12,yy+.030*up],[ox,oz+.12,yy-.045*up],[ox+.064,oz+.12,yy+.030*up]],'#455b5f',.027);
}
