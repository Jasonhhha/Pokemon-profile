import { drawFieldActor } from './field-actors';
import { creatureGaits } from './field-creature-motion';
import { fortressMaps, type FortressInteriorFrame } from './field-fortress-state';

type Screen = { x: number; y: number };
type Vertex = [x: number, z: number, elevation: number];
type Context = CanvasRenderingContext2D;
const tau = Math.PI * 2;
const poolX = 8.5, poolZ = 6.5;
const noise = (i: number) => { const n = Math.sin(i * 127.1 + 311.7) * 43758.545; return n - Math.floor(n); };
let kyogre: HTMLImageElement | undefined;
let submergedKyogre: HTMLCanvasElement | undefined;
let finPose: { canvas: HTMLCanvasElement; context: CanvasRenderingContext2D; phase: number } | undefined;

function projection(ctx: Context, frame: FortressInteriorFrame) {
  const { width, height } = ctx.canvas;
  const seal = frame.room === 'seal';
  const close = seal && frame.inspecting;
  const pitch = close ? .58 : seal ? .80 : .64;
  const yaw = close ? -.14 : seal ? .075 : .10;
  const sin = Math.sin(yaw), cos = Math.cos(yaw), flat = Math.sin(pitch), up = Math.cos(pitch);
  const anchorX = close ? poolX : 8.5 + (frame.x - 8.5) * (seal ? .18 : .6);
  const anchorZ = close ? poolZ + .45 : seal ? 10.55 + (frame.y - 13.5) * .25 : frame.y - 2.95;
  const scale = Math.min(height / (close ? 6.8 : seal ? 12.4 : 10.75), width / (close ? 10.1 : seal ? 13.5 : 11.8));
  const distance = close ? 25 : seal ? 31 : 20.6;
  const inspectionY = width / height < 1.5 ? .37 : .54;
  const baseY = height * (close ? inspectionY : .52);
  const point = (x: number, z: number, elevation = 0): Screen => {
    const across = (x - anchorX) * cos - (z - anchorZ) * sin;
    const forward = (x - anchorX) * sin + (z - anchorZ) * cos;
    const gain = scale / Math.max(.35, 1 - (forward * up + elevation * flat) / distance);
    return { x: width / 2 + across * gain, y: baseY + (forward * flat - elevation * up) * gain };
  };
  const ground = (px: number, py: number) => {
    const screenY = (py - baseY) / scale;
    const denominator = flat + screenY * up / distance;
    if (denominator <= .04) return;
    const forward = screenY / denominator;
    const across = (px - width / 2) / scale * (1 - forward * up / distance);
    const x = anchorX + across * cos + forward * sin, y = anchorZ - across * sin + forward * cos;
    if (x >= 0 && x < 17 && y >= 0 && y < 20) return { x, y };
  };
  return { point, ground, scale };
}

export function fortressInteriorPoint2D(ctx: Context, frame: FortressInteriorFrame, px: number, py: number) {
  return projection(ctx, frame).ground(px, py);
}

export function fortressInteriorProject2D(ctx: Context, frame: FortressInteriorFrame, x: number, y: number) {
  return projection(ctx, frame).point(x, y);
}

export function drawFortressInterior2D(ctx: Context, frame: FortressInteriorFrame) {
  const {width, height} = ctx.canvas;
  if (!width || !height) return;
  const {point, scale} = projection(ctx, frame);
  const seal = frame.room === 'seal';
  const time = frame.reduced ? 0 : frame.now / 1000;
  const resonance = Math.min(1,Math.max(0,frame.resonance ?? 0));
  const map = fortressMaps[frame.room].walkable;
  if (!kyogre && seal) {
    kyogre = new Image();
    kyogre.onload = () => {
      if (!kyogre) return;
      const texture = document.createElement('canvas');
      texture.width = kyogre.naturalWidth;
      texture.height = kyogre.naturalHeight;
      const ink = texture.getContext('2d');
      if (!ink) return;
      ink.drawImage(kyogre, 0, 0);
      ink.globalCompositeOperation = 'source-atop';
      const cast = ink.createLinearGradient(0, texture.height*.24, texture.width*.42, texture.height*.73);
      cast.addColorStop(0,'#e2f4f00c');cast.addColorStop(.48,'#387d8c2c');cast.addColorStop(1,'#215a6763');
      ink.fillStyle = cast;
      ink.fillRect(0,0,texture.width,texture.height);
      submergedKyogre=texture;
    };
    kyogre.src = import.meta.env.BASE_URL + 'assets/kyogre.png';
  }
  const loop = (x: number,z: number,rx: number,rz: number,h: number,count=32): Vertex[] =>
    Array.from({length:count},(_,i) => [x+Math.cos(i*tau/count)*rx, z+Math.sin(i*tau/count)*rz,h]);
  const path = (vertices: readonly Vertex[]) => {
    ctx.beginPath();
    for(let i=0;i<vertices.length;i++) {
      const p=point(...vertices[i]); if(i)ctx.lineTo(p.x,p.y);else ctx.moveTo(p.x,p.y);
    }
  };
  const face = (vertices: Vertex[], color: string | CanvasGradient) => {
    path(vertices);ctx.closePath();ctx.fillStyle=color;ctx.fill();
  };
  const stroke = (vertices: Vertex[],color: string,weight: number) => {
    path(vertices);ctx.strokeStyle=color;ctx.lineWidth=Math.max(.65,weight*scale);ctx.stroke();
  };
  const top = (x: number,z: number,w: number,d: number,h: number,color: string | CanvasGradient) =>
    face([[x,z,h],[x+w,z,h],[x+w,z+d,h],[x,z+d,h]],color);
  const plate = (x: number,z: number,w: number,d: number,b: number,h: number,roof: string,front: string,side: string) => {
    face([[x,z+d,b],[x+w,z+d,b],[x+w,z+d,h],[x,z+d,h]],front);
    const edge = x < frame.x ? x+w : x;
    face([[edge,z,b],[edge,z+d,b],[edge,z+d,h],[edge,z,h]],side);
    top(x,z,w,d,h,roof);
  };
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
  const groundGlow = (x:number,z:number,rx:number,rz:number,color:string) => {
    const p=point(x,z,-.4), right=point(x+rx,z,-.4), near=point(x,z+rz,-.4);
    ctx.save();
    ctx.transform(right.x-p.x,right.y-p.y,near.x-p.x,near.y-p.y,p.x,p.y);
    const glow=ctx.createRadialGradient(0,0,0,0,0,1);
    glow.addColorStop(0,color);glow.addColorStop(1,'transparent');
    ctx.fillStyle=glow;ctx.fillRect(-1,-1,2,2);
    ctx.restore();
  };
  ctx.save();
  const shade=ctx.createLinearGradient(0,0,0,height);
  shade.addColorStop(0,'#0b1b27');shade.addColorStop(.65,seal?'#154454':'#23434b');shade.addColorStop(1,'#0c2734');
  ctx.fillStyle=shade;ctx.fillRect(0,0,width,height);
  const waterTone=ctx.createLinearGradient(0,height*.13,0,height);
  waterTone.addColorStop(0,'#133746');waterTone.addColorStop(.5,'#28555b');waterTone.addColorStop(1,'#102e3d');
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
    drawPool();
  }
  const stones=['#728582','#829087','#6b8083','#7b8d89','#8a948b'];
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
  }
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
    sheen.addColorStop(0,'#3b5f668c');sheen.addColorStop(.36,'#567b7ca6');
    sheen.addColorStop(.60,'#9ba99b98');sheen.addColorStop(1,'#335661a3');
    face(outline,sheen);
    stroke(outline.slice(2,12),'#afc6bb8f',.019);
    for(let j=0;j<4;j++){
      const offset=(noise(i*7+j)-.5)*rz, glint=cx-rx*.16+j*.07;
      stroke([[glint,cz+offset,.028],[glint+.08+noise(j+i)*.20,cz+offset,.028]],'#c2c7b06c',.017);
    }
  }
  // Stair treads lead into the northern portal and up to the dry upper chamber.
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
  const rails = seal ? [[7.02,11,15],[9.98,11,15]] : [[7.04,7,12],[9.96,7,12],[7.04,13,15.8],[9.96,13,15.8]];
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
    for(const x of [6.56,10.44])layers.push({z:11.1,draw(){
      plate(x-.20,10.94,.40,.40,-.46,.38,'#b1a990','#617a78','#465e66');
      plate(x-.13,11.00,.26,.27,.37,1.09,'#718a89','#425f69','#314c57');
      lamp(x,11.11,1.17,true);
    }});
  }
  if(frame.companionImage){
    const img=frame.companionImage, cx=frame.companionX??frame.x-.40,cz=frame.companionY??frame.y+.55;
    layers.push({z:cz, draw(){
      const p=point(cx,cz),sz=Math.hypot(point(cx,cz,1).y-p.y,point(cx+1,cz).x-p.x)*.63;
      const gait=creatureGaits[frame.companionId??'piplup'], stride=frame.reduced?0:frame.stride;
      const face=frame.facing==='left'?-1:frame.facing==='right'?1:gait.sourceFacing;
      const bob=sz*(Math.abs(stride)*gait.bounce + gait.airborne*(1+.11*Math.sin(time*gait.pace)));
      ctx.save();ctx.translate(p.x,p.y-bob);ctx.rotate(stride*gait.sway*.72);ctx.scale(face*gait.sourceFacing,1);
      ctx.imageSmoothingEnabled=false;ctx.drawImage(img,-sz*.50,-sz*img.height/img.width,sz,sz*img.height/img.width);
      ctx.restore();
    }});
  }
  layers.push({z:frame.y,draw(){
    const p=point(frame.x,frame.y);
    const sz=Math.abs(point(frame.x+.7,frame.y).x-p.x)/.7;
    ctx.save();ctx.translate(p.x,p.y);ctx.scale(sz/16,sz/16);
    ctx.imageSmoothingEnabled=false;
    drawFieldActor(ctx,'player',frame.facing,frame.reduced||Math.abs(frame.stride)<.08?0:frame.stride>0?1:2,0,0);ctx.restore();
  }});
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

  function drawPool(){
    const rx=6.26,rz=4.94;
    face(loop(poolX,poolZ,rx+.34,rz+.37,-.19,64),'#374f57');
    face(loop(poolX,poolZ,rx+.19,rz+.22,-.15,64),'#7b8e88');
    const rim=loop(poolX,poolZ,rx,rz,-.19,72);
    face(rim,'#1d3745');
    const p=point(poolX,poolZ),light=ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,Math.max(.1,scale*rx));
    light.addColorStop(0,'#0e2338');light.addColorStop(.46,'#0b3e52');light.addColorStop(.76,'#127082');light.addColorStop(.91,'#245d68');light.addColorStop(1,'#173c4c');
    const waterFace=loop(poolX,poolZ,rx-.11,rz-.10,-.51,72);face(waterFace,light);
    ctx.save();path(waterFace);ctx.closePath();ctx.clip();
    groundGlow(poolX-.60,poolZ,4.28,3.15,'rgba(180,228,218,'+(.15+.32*resonance)+')');
    for(const sign of [-1,1]){
      const x=poolX+sign*3.65;
      const topLight=point(x,poolZ-1.95,3.3),bottomLight=point(x-sign*1.14,poolZ-.10,-.50);
      const shaft=ctx.createLinearGradient(topLight.x,topLight.y,bottomLight.x,bottomLight.y);
      shaft.addColorStop(0,'rgba(221,239,229,'+(.09+resonance*.14)+')');shaft.addColorStop(1,'#d9ece000');
      face([[x-.20,poolZ-1.95,3.3],[x+.21,poolZ-1.95,3.3],[x-sign*1.14+.82,poolZ-.10,-.50],
        [x-sign*1.14-.79,poolZ-.10,-.50]],shaft);
    }
    for(let i=0;i<10;i++){
      const a=i*tau/10+.23, x=poolX+Math.cos(a)*rx*.85,z=poolZ+Math.sin(a)*rz*.85;
      groundGlow(x,z,1.18,.77,'#81cec65b');
    }
    // Windrows follow the faster current at the eye and spread into small broken crests at the rim.
    for(let i=0;i<138;i++){
      const r=.19+noise(i+400)*.80, phase=i*2.4+time*(1.25+.56/r);
      const span=.07+.48*noise(i+366);
      const trace:Vertex[]=[];
      for(let step=0;step<=5;step++){
        const a=phase+span*step/5;
        const d=r-.024*step/5+.008*Math.sin(i+step);
        trace.push([poolX+Math.cos(a)*rx*d,poolZ+Math.sin(a)*rz*d,-.46]);
      }
      stroke(trace,i%4?'#92c7bc3c':'#072e445c',i%4?.015:.066);
    }
    const spiral=(arm:number,offset:number,frontHalf:boolean) => {
      const points:Vertex[]=[];
      const direction=time*2.9 + arm*tau/7 + offset*.41;
      for(let j=0;j<=38;j++){
        const t=j/38, a=direction+t*2.76+.14*Math.sin(t*8+arm);
        const r=.19+t*.765+offset*.025+.018*Math.sin(arm*4.1+t*27);
        const z=poolZ+Math.sin(a)*rz*r;
        if(frontHalf && (z<poolZ+.12 || r<.61)){if(points.length>1)stroke(points,'#93d9cfb8',.029);points.length=0;continue;}
        points.push([poolX+Math.cos(a)*rx*r,z,-.43-.59*(1-r)**2]);
      }
      if(points.length>1)stroke(points,frontHalf?'#a4e6d9be':offset?'#73c5c2a6':'#357d89',frontHalf?.029:offset?.040:.14);
    };
    for(let i=0;i<7;i++){spiral(i,0,false);spiral(i,1,false);}
    groundGlow(poolX+.20,poolZ+.32,3.66,1.55,'#051c31b3');
    const bob=frame.reduced?0:Math.sin(time*1.55)*.085;
    if(submergedKyogre){
      const art=submergedKyogre, center=point(poolX,poolZ,-.32+bob);
      const width=Math.abs(point(poolX+3.98,poolZ).x-point(poolX-3.98,poolZ).x);
      const imageH=width*art.height/art.width;
      ctx.save();ctx.translate(center.x,center.y);ctx.rotate(-.085+Math.sin(time*.56)*.018);
      ctx.globalAlpha=.96;ctx.imageSmoothingEnabled=true;
      if(!finPose){
        const canvas=document.createElement('canvas');canvas.width=art.width;canvas.height=art.height;
        const context=canvas.getContext('2d');
        if(context)finPose={canvas,context,phase:NaN};
      }
      const phase = Math.round(Math.sin(time*.92)*6);
      if(finPose && finPose.phase!==phase){
        const {context}=finPose;
        context.clearRect(0,0,art.width,art.height);
        const slice=16;
        for(let sx=0;sx<art.width;sx+=slice){
          const wing=Math.pow(Math.abs(sx/art.width-.5)*2,2.4);
          context.drawImage(art,sx,0,slice,art.height,sx,Math.round(wing*phase),slice,art.height);
        }
        context.save();
        context.globalCompositeOperation='source-atop';
        context.strokeStyle='#c0e7d819';
        context.lineWidth=1.7;
        for(let k=0;k<7;k++){
          const h=art.height*(.29+.064*k);
          context.beginPath();context.moveTo(-4,h+phase*1.2);
          context.bezierCurveTo(art.width*.27,h-32,art.width*.61,h+14,art.width+4,h-23+phase);
          context.stroke();
        }
        context.restore();
        finPose.phase=phase;
      }
      ctx.drawImage(finPose?.canvas??art,-width/2,-imageH/2,width,imageH);
      ctx.globalCompositeOperation='screen';ctx.globalAlpha=.10+.20*resonance;
      ctx.drawImage(finPose?.canvas??art,-width/2,-imageH/2,width,imageH);
      ctx.restore();
    }
    for(let i=0;i<7;i++)spiral(i,.56,true);
    for(let i=0;i<69;i++){
      const r=.27+noise(i+109)*.67, a=i*2.39+time*(1.81/r);
      const span=.018+noise(i)*.072;
      stroke([[poolX+Math.cos(a)*rx*r,poolZ+Math.sin(a)*rz*r,-.42],[poolX+Math.cos(a+span)*rx*r,poolZ+Math.sin(a+span)*rz*r,-.425]],'#c1ece0a3',i%4?.016:.035);
    }
    for(let i=0;i<20;i++){
      const r=.64+noise(i+245)*.31, a=i*2.67+time*(1.41+.56/r);
      const x=poolX+Math.cos(a)*rx*r, z=poolZ+Math.sin(a)*rz*r;
      const edge=loop(x,z,.05+noise(i)*.11,.035,-.36,8);
      stroke(edge.slice(1,6),'#d0f4dfac',.022);
    }
    ctx.restore();
    for(let i=0;i<8;i++){
      const a=i*tau/8+.065, x=poolX+Math.cos(a)*(rx+.07), z=poolZ+Math.sin(a)*(rz+.07);
      plate(x-.24,z-.22,.48,.44,-.48,.22,'#8e9c92','#54696b','#384e55');
      plate(x-.13,z-.12,.26,.24,.18,.65,'#859e9b','#3e6570','#33535e');
      lamp(x,z,.70,true);
      if(resonance>.02){
        groundGlow(x,z,1.55,1.1,'rgba(113,247,221,'+resonance*.49+')');
        const gateLight=loop(x,z,.34,.34,.27,16);
        stroke([...gateLight,gateLight[0]],'rgba(179,255,227,'+resonance+')',.065);
      }
      const chain:Vertex[]=[];
      for(let link=0;link<=12;link++){
        const f=link/12,r=1-.35*f;
        chain.push([poolX+Math.cos(a)*rx*r,poolZ+Math.sin(a)*rz*r,.55-.72*f-.19*Math.sin(f*Math.PI)]);
      }
      stroke(chain,'#b5beb1',.034);
      for(let link=1;link<chain.length;link+=2)stroke([chain[link-1],chain[link]],'#304f59',.048);
    }
  }
}
