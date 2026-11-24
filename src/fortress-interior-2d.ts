import { fortressLiftStops, fortressMaps, type FortressInteriorFrame } from './field-fortress-state';
import { isMazeRoom, mazeFloors } from './fortress-maze';
import { drawFortressMaze2D, pickFortressMaze2D } from './fortress-maze-2d';
import { drawFrozenMasonry, drawIceBed2D, drawIceSeal2D, warmIceSeal2D } from './fortress-ice-seal-2d';
import { drawFortressLift2D, tileSkin } from './fortress-raster-materials';
import { addWardPosts, drawWardDeck, drawWardSideArcades, pickWardPost, wardGrip } from './fortress-ward-gallery-2d';
import { addRasterActors, loop, makeRasterPaint, noise, projection, tau, type Vertex } from './fortress-raster-space';

type Context = CanvasRenderingContext2D;
type SealBackdrop={canvas:HTMLCanvasElement;x:number;y:number;inspecting:boolean;resonance:number;originX:number;originY:number};
const sealBackdrops=new WeakMap<Context,SealBackdrop>();

export function fortressInteriorPoint2D(ctx: Context, frame: FortressInteriorFrame, px: number, py: number) {
  if (isMazeRoom(frame.room)) return pickFortressMaze2D(ctx,frame,px,py);
  const camera = projection(ctx, frame);
  const floor = camera.ground(px, py);
  if (frame.room === 'seal' && !frame.inspecting) return pickWardPost(camera,px,py,floor) ?? floor;
  return floor;
}

export function fortressInteriorProject2D(ctx: Context, frame: FortressInteriorFrame, x: number, y: number) {
  return projection(ctx, frame).point(x, y);
}

export function drawFortressInterior2D(ctx: Context, frame: FortressInteriorFrame) {
  const {width, height} = ctx.canvas;
  if (!width || !height) return;
  const camera=projection(ctx,frame);
  const paint=makeRasterPaint(ctx,frame,camera);
  if(isMazeRoom(frame.room)) {
    if(frame.room==='catacomb'){
      const stair=mazeFloors.catacomb.down;
      if(Math.hypot(frame.x-stair.x-.5,frame.y-stair.y-.5)<4.5)warmIceSeal2D();
    }
    drawFortressMaze2D(frame,frame.room,camera,paint);
    return;
  }
  const {point,scale,path,face,stroke,top,plate,groundGlow}=paint;
  const seal = frame.room === 'seal';
  const time = frame.reduced ? 0 : frame.now / 1000;
  const resonance = Math.min(1,Math.max(0,frame.resonance ?? 0));
  const map = fortressMaps[frame.room].walkable;
  const lamp = (x: number,z: number,h: number,cool=false) => {
    const p=point(x,z,h), r=Math.max(1,scale*.76);
    const g=ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,r);
    g.addColorStop(0,cool?'#a3f6eeac':'#ffdb8aaf');g.addColorStop(.23,cool?'#4bdac68b':'#f6af536a');g.addColorStop(1,'transparent');
    ctx.fillStyle=g;ctx.fillRect(p.x-r,p.y-r,r*2,r*2);
    plate(x-.105,z-.095,.21,.19,h-.24,h+.19,'#a09575','#544f44','#354541');
    face([[x-.081,z+.102,h-.16],[x+.081,z+.102,h-.16],[x+.081,z+.102,h+.12],[x-.081,z+.102,h+.12]],cool?'#ace8d7':'#ffe5a3');
    stroke([[x,z+.108,h-.16],[x,z+.108,h+.12]],'#615941',.017);
  };
  const arch = (cx: number,z: number,half: number,spring: number,base: number,barred=true) => {
    const curve = (rad: number):Vertex[]=>Array.from({length:19},(_,i)=>{
      const a=Math.PI-i*Math.PI/18;return [cx+rad*Math.cos(a),z,spring+rad*Math.sin(a)];
    });
    face([[cx-half,z,base],...curve(half),[cx+half,z,base]],'#081923');
    const outer=curve(half+.23),inner=curve(half);
    for(let i=0;i<18;i++)face([outer[i],outer[i+1],inner[i+1],inner[i]],['#698083','#708080','#576f73'][i%3]);
    for(const side of [-1,1]) {
      for(let row=0;row<5;row++){
        const h=(spring-base)/5;
        plate(cx+side*half-(side<0?.23:0),z-.05,.23,.15,base+h*row,base+h*(row+1)-.018,'#859086','#556b6c','#354849');
      }
    }
    for(let i=-3;barred && i<=3;i++){
      const off=i*half/3.75;
      stroke([[cx+off,z+.012,base],[cx+off,z+.012,spring+Math.sqrt(half*half-off*off)]],'#3d5255',.044);
    }
    if(!barred){
      const far=curve(half*.78);
      stroke(far,'#476367',.08);
      for(const side of [-1,1])stroke([[cx+half*.78*side,z,base],[cx+half*.78*side,z,spring]],'#476367',.08);
      for(let i=0;i<5;i++)stroke([[cx-half*.78,z,base+.05+i*.12],[cx+half*.78,z,base+.05+i*.12]],'#304c53',.042);
    }
  };
  ctx.save();
  const cache=seal?sealBackdrops.get(ctx):undefined,origin=point(8.5,6.5);
  if(cache&&cache.x===frame.x&&cache.y===frame.y&&cache.inspecting===frame.inspecting&&cache.resonance===resonance&&cache.canvas.width===width&&cache.canvas.height===height){
    // The roar shakes the camera as a whole. Reuse the unmoving masonry and ice underneath it.
    ctx.fillStyle='#0b1b27';ctx.fillRect(0,0,width,height);
    ctx.drawImage(cache.canvas,origin.x-cache.originX,origin.y-cache.originY);
  }else{
    const shade=ctx.createLinearGradient(0,0,0,height);
    shade.addColorStop(0,'#0b1b27');shade.addColorStop(.65,seal?'#154454':'#23434b');shade.addColorStop(1,'#0c2734');
    ctx.fillStyle=shade;ctx.fillRect(0,0,width,height);
    if(seal)drawWardSideArcades(paint);
    const waterTone=ctx.createLinearGradient(0,height*.13,0,height);
    waterTone.addColorStop(0,seal?'#536c81':'#133746');waterTone.addColorStop(.5,seal?'#526f82':'#28555b');waterTone.addColorStop(1,seal?'#233f52':'#102e3d');
    face([[.7,1,-.8],[16.3,1,-.8],[16.3,19.3,-.8],[.7,19.3,-.8]],waterTone);
    // Stone backing, block courses and recessed portals make the near walks read as elevated dry ground.
    face([[1,1.6,-.8],[16,1.6,-.8],[16,1.6,4.3],[1,1.6,4.3]],'#3b5159');
    for(let i=0;i<10;i++){
      const y=i*.52-.79;
      stroke([[1,1.605,y],[16,1.605,y]],'#293d46',.035);
      for(let x=1.18+(i%2)*.76;x<16;x+=1.53)stroke([[x,1.61,y],[x,1.61,y+.49]],'#2d4249',.031);
    }
    const farLintel=point(8.5,1.65,4.3), farFoot=point(8.5,1.65,-.72);
    const stain=ctx.createLinearGradient(0,farLintel.y,0,farFoot.y);
    stain.addColorStop(0,'#0b1d2d15');stain.addColorStop(.52,'#17404d27');stain.addColorStop(1,'#12363ec9');
    face([[1,1.614,-.7],[16,1.614,-.7],[16,1.614,4.3],[1,1.614,4.3]],stain);
    for(const h of [3.52,3.78])plate(1,1.47,15,.29,h,h+.15,'#8d9486','#657975','#364c52');
    for(const cx of [3.5,8.5,13.5])arch(cx,1.78,cx===8.5?1.28:1.0,1.18,-.69,seal||cx!==8.5);
    for(const cx of [5.8,11.2]){
      plate(cx-.26,1.69,.52,.31,-.68,3.4,'#75847c','#506468','#374d54');
      plate(cx-.38,1.63,.76,.44,3.35,3.6,'#9a9e8c','#647b79','#465d63');
      lamp(cx,2.02,2.00,seal);
    }
    for(const x of [1.2,15.05]){
      const inside=x<8?x+.32:x+.39;
      face([[inside,1.4,-.65],[inside,19.5,-.65],[inside,19.5,3.55],[inside,1.4,3.55]],'#354e58');
      for(let row=0;row<9;row++){
        const h=-.58+row*.50;
        stroke([[inside,1.4,h],[inside,19.5,h]],'#253c47',.027);
        for(let z=1.48+(row%2)*.65;z<19.5;z+=1.30)stroke([[inside,z,h],[inside,z,h+.48]],'#2b424b',.029);
      }
      for(let z=3.1;z<19;z+=3){
        const keystone=(r:number):Vertex[]=>Array.from({length:13},(_,i)=>[inside,z+r*Math.cos(Math.PI*i/12),1.09+r*Math.sin(Math.PI*i/12)]);
        face([[inside,z+1,-.26],...keystone(1),[inside,z-1,-.26]],'#102c39');
        stroke(keystone(1.07),'#72847e',.15);
        for(const dz of [-1,1])stroke([[inside,z+dz,-.26],[inside,z+dz,1.13]],'#597176',.13);
        for(let i=-2;i<=2;i++)stroke([[inside,z+i*.36,-.26],[inside,z+i*.36,1.09+Math.sqrt(1-(i*.36)**2)]],'#344c57',.050);
      }
      plate(x,1.35,.73,18.05,-.78,.16,'#607776','#314949','#263c44');
      for(let z=2.2;z<19;z+=2.7){
        plate(x-.06,z,.87,.60,-.62,1.44,'#788680','#496065','#314852');
        plate(x-.12,z-.03,.99,.69,1.36,1.55,'#92a091','#506566','#354b52');
      }
      stroke([[x+.35,1.4,1.44],[x+.35,19.45,1.44]],'#526a6b',.12);
      stroke([[inside,1.4,3.15],[inside,19.45,3.15]],'#a09276',.12);
    }
    if(!seal){
      for(const x of [4.8,12.3])for(const z of [4.16,9.13,14.4]){
        groundGlow(x,z,2.1,2.4,'#8db4a346');
        groundGlow(x,z,.46,1.55,'#d9b17a40');
      }
      ctx.save();
      path([[.7,1,-.58],[16.3,1,-.58],[16.3,19.3,-.58],[.7,19.3,-.58]]);ctx.closePath();ctx.clip();
      for(const z of [3.82,7.55,10.96,14.85,18.20])for(const x of [2.3,5.72,11.28,14.7]){
        for(let band=0;band<13;band++){
          const h=-.62-band*.26, dx=Math.sin(time*1.9+z+band*1.6)*(.025+.014*band);
          const width=.27+(band===11?.19:0);
          face([[x-width+dx,z,h],[x+width+dx,z,h],[x+width+dx,z,h-.19],[x-width+dx,z,h-.19]],
            band%3?'#8fa39a32':'#9fa58e44');
          if(band>=6&&band<=9)stroke([[x-.10+dx,z,h],[x+.12+dx,z,h]],'#cfa0645c',.075);
        }
      }
      ctx.restore();
      for(let i=0;i<215;i++){
        const x=2+12.5*noise(i),z=2.9+15.3*noise(i+691);
        const wind=Math.sin(time*.95+z*1.9+i*2.16)*.058;
        stroke([[x+wind,z,-.6],[x+.15+noise(i+37)*.42+wind,z+.02,-.6]],i%4?'#84b2ac46':'#a7c3b587',.014);
      }
      // Seven stone courses descend from each side gallery into the collecting channels.
      for(const [z,length] of [[4.20,1.70],[7.03,4.82],[13.06,2.91]]){
        for(const side of [-1,1])for(let k=0;k<7;k++){
          const x=side<0?3.98+k*.185:12.83-k*.185, h=.14-k*.105;
          plate(x,z,.19,length,-.68,h,'#828e85','#405861','#526c6c');
          stroke([[x+(side<0?.16:.025),z,h+.013],[x+(side<0?.16:.025),z+length,h+.013]],'#b1b09a',.028);
          for(let seam=.66;seam<length;seam+=.92)stroke([[x,z+seam,h+.017],[x+.18,z+seam,h+.017]],'#526366',.025);
        }
      }
      for(const x of [5.25,11.75]){
        for(let z=4;z<16;z+=3.05){
          stroke([[x,z-.04,-.52],[x,z-.04,.7],[x+.25,z+.24,1.03],[x+.25,z+.88,1.03]],'#263e44',.22);
          stroke([[x-.03,z,.68],[x+.23,z+.24,1.05],[x+.23,z+.88,1.05]],'#96775c',.126);
          for(let k=0;k<4;k++)stroke([[x+.14,z+.31+k*.15,1.07],[x+.32,z+.31+k*.15,1.07]],'#394f50',.065);
          const age=(time*.83+z*.3)%1, dropX=x+.25,dropZ=z+.88;
          stroke([[dropX,dropZ,.91-1.44*age**2],[dropX,dropZ,.96-1.44*age**2]],'#a9d8cd',.030);
          const ripple=loop(dropX,dropZ,.08+.38*age,.08+.38*age,-.57,16);
          stroke([...ripple,ripple[0]],'rgba(169,211,202,'+(.54*(1-age))+')',.022);
        }
      }
    }else{
      drawFrozenMasonry(paint);
      drawIceBed2D(resonance,paint);
      if(!frame.stride){
        const buffer=cache?.canvas??document.createElement('canvas');
        if(buffer.width!==width||buffer.height!==height){buffer.width=width;buffer.height=height;}
        const ink=buffer.getContext('2d');
        if(ink){
          ink.drawImage(ctx.canvas,0,0);
          sealBackdrops.set(ctx,{canvas:buffer,x:frame.x,y:frame.y,inspecting:frame.inspecting,resonance,originX:origin.x,originY:origin.y});
        }
      }
    }
  }
  const stones=seal?['#7b8d99','#899aa3','#8295a2','#91a2aa','#8396a3']:['#728582','#829087','#6b8083','#7b8d89','#8a948b'];
  for(let z=0;z<map.length;z++)for(let x=0;x<map[z].length;x++){
    if(!map[z][x])continue;
    const bridge=seal && z<15 || !seal && (z===6||z===12) && (x<7||x>9);
    if(!map[z+1]?.[x])face([[x,z+1,-.69],[x+1,z+1,-.69],[x+1,z+1,0],[x,z+1,0]],'#344e54');
    for(const side of [-1,1])if(!map[z][x+side]){
      const edge=x+(side>0?1:0);
      face([[edge,z,-.69],[edge,z+1,-.69],[edge,z+1,0],[edge,z,0]],'#2f4a50');
    }
    top(x,z,1.008,1.006,0,bridge?'#586d71':'#52676a');
    for(let row=0;row<2;row++){
      const joint=(row+z+x)%2? .35:.65;
      top(x+.017,z+row*.5+.018,joint-.029,.468,.012,stones[(z*11+x*3+row)%5]);
      top(x+joint+.008,z+row*.5+.018,1-joint-.024,.468,.012,stones[(z*7+x*2+row+2)%5]);
      const sx=x+.06+noise(x*72+z+row)*.77,sz=z+row*.5+.10+noise(z*8+x)*.25;
      stroke([[sx,sz,.015],[sx+.04+noise(x+row+z)*.09,sz+.004,.015]],'#bac0ab74',.017);
    }
    if(bridge && !seal){
      for(let bar=1;bar<7;bar++)top(x+.10,z+bar*.126,.80,.034,.028,'#3a5155');
    }
    if(seal){
      tileSkin(paint,x,z,.021,'froststone',z*17+x,.31);
      if(!map[z][x-1]||!map[z][x+1]){
        const e=x+(map[z][x-1] ? .98 : .01);
        stroke([[e,z+.03,.034],[e+.026,z+.29,.034],[e-.011,z+.59,.034],[e+.013,z+.98,.034]],'#c1daddaf',.058);
      }
    }
  }
  if(seal)drawWardDeck(paint);
  // Residual pools span slab joints and mirror the lamps along the flooded walkway.
  const pools=seal ? [[8.3,12.15,.58,1.0],[8.76,14.64,.94,.41],[5.64,16.1,1.15,.56],[10.1,16.44,1.65,.72],[7.7,17.4,.58,.27]]
    : [[8.03,4.72,.68,.56],[9.05,7.64,.72,1.14],[7.71,10.05,.64,.46],[8.49,12.50,1.12,.55],[8.30,15.64,1.1,.80],
       [7.66,17.07,.52,.39],[3.55,8.72,.40,1.24],[13.57,14.25,.41,1.48]];
  for(const [i,[cx,cz,rx,rz]] of pools.entries()){
    const n=i*1.62;
    const outline:Vertex[]=Array.from({length:30},(_,j)=>{
      const a=j*tau/30,r=.81+.13*Math.sin(3*a+n)+.075*Math.cos(a*5+n*2)+.05*Math.sin(a*8+n);
      return [cx+Math.cos(a)*rx*r,cz+Math.sin(a)*rz*r,.025];
    });
    const p=point(cx-rx,cz),q=point(cx+rx,cz);
    const sheen=ctx.createLinearGradient(p.x,p.y,q.x,q.y);
    sheen.addColorStop(0,seal?'#698899a8':'#3b5f668c');sheen.addColorStop(.36,seal?'#8da9b4bf':'#567b7ca6');
    sheen.addColorStop(.60,seal?'#c7d6d7b3':'#9ba99b98');sheen.addColorStop(1,seal?'#617f91ad':'#335661a3');
    face(outline,sheen);
    stroke(outline.slice(2,12),'#afc6bb8f',.019);
    for(let j=0;j<4;j++){
      const offset=(noise(i*7+j)-.5)*rz, glint=cx-rx*.16+j*.07;
      stroke([[glint,cz+offset,.028],[glint+.08+noise(j+i)*.20,cz+offset,.028]],'#c2c7b06c',.017);
    }
    if(seal){
      const joint:Vertex[]=[[cx-rx*.69,cz+rz*.32,.037],[cx-rx*.25,cz+rz*.13,.037],[cx-.04,cz+rz*.19,.037],[cx+rx*.31,cz-rz*.10,.037],[cx+rx*.56,cz-rz*.41,.037]];
      stroke(joint,'#698195bb',.039);stroke([joint[2],[cx-rx*.10,cz-rz*.46,.037]],'#96aebaaa',.027);
    }
  }
  // Stair treads lead into the northern portal and up to the dry upper chamber.
  if(!seal)drawFortressLift2D(fortressLiftStops.sluice.x,fortressLiftStops.sluice.y,frame.liftUnlocked,paint);
  const stairsZ = seal ? 17.32 : 3.10;
  for(let i=0;i<7;i++){
    const z=stairsZ+i*.17,h=seal?i*.068:(6-i)*.075;
    plate(7.25,z,2.50,.173,0,h+.036,'#93a19b','#4a6267','#40585e');
    stroke([[7.28,z+.163,h+.041],[9.72,z+.163,h+.041]],'#bfbea8',.025);
  }
  if(!seal){
    top(7.20,1.83,2.6,1.34,.38,'#596d6c');
    for(const x of [7.33,9.67])lamp(x,2.02,1.05);
    for(let i=0;i<4;i++)stroke([[7.28,2.12+i*.26,.40],[9.72,2.12+i*.26,.40]],'#adb0a0',.03);
    for(let i=0;i<6;i++){
      const z=17.90+i*.19, h=.035+i*.072;
      plate(7.28,z,2.44,.20,-.47,h,'#8a9a94','#4a6265','#374f56');
      stroke([[7.31,z+.18,h+.013],[9.69,z+.18,h+.013]],'#aaa994',.026);
    }
  }
  const layers:{z:number; draw:()=>void}[]=[];
  if(!seal){
    const ax=8.5, az=8.5;
    for(const sign of [-1,1]){
      const channel:Vertex[]=[[ax+sign*.66,az,.066],[ax+sign*1.24,az-.55,.066],[ax+sign*1.24,3.57,.066]];
      stroke(channel,'#7d684c',.13);stroke(channel,resonance>.15?'#93e6ca':'#578c83',.052);
      if(resonance>0)for(let j=0;j<5;j++){
        const z=3.68+(j+.20+time*.48)%5*.82;
        stroke([[ax+sign*1.24,z,.07],[ax+sign*1.24,z+.21,.07]],'rgba(210,250,222,'+resonance+')',.068);
      }
    }
    const dialPoint=(a:number,r:number,h:number):Vertex=>[ax+Math.cos(a)*r,az+Math.sin(a)*r,h];
    face(loop(ax,az,1.12,1.12,.045,40),'#324d52');
    for(const [r,w,c] of [[1.06,.11,'#cba56a'],[.88,.038,'#ddc793'],[.70,.076,'#6faaa1'],[.38,.06,'#c9a878']] as const){
      for(let i=0;i<40;i++){
        const a=i*tau/40,b=(i+1)*tau/40;
        face([dialPoint(a,r,.055),dialPoint(b,r,.055),dialPoint(b,r-w,.055),dialPoint(a,r-w,.055)],c);
      }
    }
    for(let i=0;i<8;i++){
      const a=i*tau/8+resonance*.31;
      face([dialPoint(a,.24,.072),dialPoint(a+.15,.35,.072),dialPoint(a+.47,.77,.072),dialPoint(a+.35,.67,.072)],i%2?'#c19a65':'#83aea1');
      stroke([dialPoint(a,.93,.074),dialPoint(a,1.14,.074)],'#d6c09b',.065);
    }
    face(loop(ax,az,.23,.23,.090,16),resonance>.1?'#b7f8d6':'#79b5a8');
    if(resonance>.02){
      const tint='rgba(187,250,216,'+resonance*.78+')';
      const glow=loop(ax,az,.67,.67,.084,38);
      stroke([...glow,glow[0]],tint,.060);
      stroke([[7.46,3.22,.46],[7.46,2.14,.48],[7.46,2.14,1.62]],tint,.065);
      stroke([[9.54,3.22,.46],[9.54,2.14,.48],[9.54,2.14,1.62]],tint,.065);
    }
    for(const z of [3.82,7.55,10.96,14.85,18.20]){
      for(const x of [2.3,5.72,11.28,14.7])layers.push({z,draw(){ column(x,z); }});
      for(const [left,right] of [[2.3,5.72],[11.28,14.7]])layers.push({z:z+.04,draw(){ arcade(left,right,z); }});
      if(z<8)layers.push({z:z+.05,draw(){arcade(5.72,11.28,z);}});
    }
  }
  const rails = seal ? [[7.02,11,11.94],[9.98,11,11.94],[7.02,13.05,15],[9.98,13.05,15]] : [[7.04,7,12],[9.96,7,12],[7.04,13,15.8],[9.96,13,15.8]];
  for(const [x,za,zb] of rails){
    layers.push({z:(za+zb)/2,draw(){
      for(let z=za;z<=zb;z+=1.0){
        plate(x-.064,z-.064,.128,.128,0,.66,'#b6a887','#4c6462','#334b4e');
      }
      for(const h of [.35,.66])stroke([[x,za,h],[x,zb,h]],'#485e5c',.057);
      stroke([[x-.018,za,.69],[x-.018,zb,.69]],'#c1aa80',.022);
    }});
  }
  if(!seal)for(const [x,z] of [[7.03,7.01],[9.94,11.92],[7.03,15.86]]){
    layers.push({z,draw(){
      const facing=x<8?-1:1;
      const xx=x+facing*.15;
      plate(xx-.12,z-.12,.24,.24,-.35,.13,'#848b79','#586d67','#455d5e');
      stroke([[xx,z,.11],[xx,z,.83]],'#6e715d',.085);
      lamp(xx,z,.87);
    }});
  }
  if(seal){
    layers.push({z:6.5,draw(){drawIceSeal2D(frame,paint);}});
    addWardPosts(layers,frame,paint);
    for(const x of [6.56,10.44])layers.push({z:11.1,draw(){
      plate(x-.20,10.94,.40,.40,-.46,.38,'#b1a990','#617a78','#465e66');
      plate(x-.13,11.00,.26,.27,.37,1.09,'#718a89','#425f69','#314c57');
      lamp(x,11.11,1.17,true);
    }});
  }
  addRasterActors(layers,frame,camera,ctx,false,undefined,seal?wardGrip(frame,paint):undefined);
  layers.sort((a,b)=>a.z-b.z).forEach(l=>l.draw());
  const vignette=ctx.createRadialGradient(width*.49,height*.47,height*.26,width*.50,height*.50,Math.max(width*.62,height*.76));
  vignette.addColorStop(0,'#04131e00');vignette.addColorStop(1,'#03101bd6');
  ctx.fillStyle=vignette;ctx.fillRect(0,0,width,height);
  ctx.restore();

  function column(x:number,z:number){
    const h=3.23;
    plate(x-.39,z-.38,.78,.76,-.65,.10,'#929387','#546567','#405658');
    plate(x-.34,z-.33,.68,.66,.10,.23,'#a8a391','#6c7971','#516466');
    const shades=['#596d6b','#84928a','#acaa94','#9a9b8a','#748782','#586e72'];
    for(let i=0;i<6;i++){
      const a=i*Math.PI/6,b=(i+1)*Math.PI/6;
      const v=(theta:number,r:number,y:number):Vertex=>[x+Math.cos(theta)*r,z+Math.sin(theta)*r,y];
      face([v(a,.27,.22),v(b,.27,.22),v(b,.218,h-.42),v(a,.218,h-.42)],shades[i]);
      const m=(a+b)/2;
      stroke([v(m,.269,.25),v(m,.216,h-.45)],'#4d62634f',.029);
    }
    for(const [y,r,t] of [[.24,.31,.09],[.39,.285,.075],[h-.44,.26,.085],[h-.31,.31,.105]]){
      face(loop(x,z,r,r,y+t,12),'#b0ab95');
      stroke(loop(x,z,r,r,y,12).slice(0,7),'#657874',.09);
    }
    plate(x-.35,z-.30,.70,.60,h-.20,h+.02,'#c0b89c','#889085','#617673');
    for(const s of [-1,1])face(loop(x+s*.24,z+.27,.105,.055,h-.11,12),'#716d59');
    if(x===5.72||x===11.28)lamp(x,z+.275,1.43);
  }

  function arcade(x0:number,x1:number,z:number){
    const radius=(x1-x0)/2, mid=(x0+x1)/2, base=3.22;
    const v=(i:number,thick:number,dz:number):Vertex=>{
      const a=i*Math.PI/14;
      return [mid+Math.cos(a)*(radius+thick),z+dz,base+Math.sin(a)*(Math.min(2.02,radius*.9)+thick)];
    };
    for(let i=0;i<14;i++){
      face([v(i,0,-.15),v(i+1,0,-.15),v(i+1,0,.16),v(i,0,.16)],'#3b5058');
      face([v(i,0,.16),v(i+1,0,.16),v(i+1,.20,.16),v(i,.20,.16)],i%4===0?'#a9aa94':i%3===0?'#87928a':'#798982');
      if(i%2===0)stroke([v(i,.18,.165),v(i,0,.165)],'#4a615f',.024);
    }
  }
}
