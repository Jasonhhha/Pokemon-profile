import { kyuremTiming, type FortressInteriorFrame } from './field-fortress-state';
import { clamp, loop, noise, tau, type RasterPaint, type Screen, type Vertex } from './fortress-raster-space';

const cx=8.5,cz=6.5, radius=4.74, depth=4.55, height=5.65, iceLevel=-.60;
const frames=[0,0.12,0.24,0.32,0.38,0.42,0.46,0.49,0.52,0.55,0.58,0.62,0.67,0.72,0.78,0.86,0.97,1.1,1.25,1.43,1.61,1.79,2.03,2.46];
// Muzzle and skinned sole contacts projected from the pose rig, in thousandths of its atlas tile.
const tracks=[
  [[64,762],[402,792],[764,933]],
  [[78,777],[408,790],[771,929]],
  [[105,802],[421,785],[784,922]],
  [[114,809],[425,784],[789,920]],
  [[114,810],[425,784],[789,920]],
  [[115,810],[425,784],[789,920]],
  [[109,793],[422,785],[786,921]],
  [[98,761],[416,788],[780,924]],
  [[86,717],[409,791],[773,928]],
  [[75,663],[400,795],[764,932]],
  [[67,607],[390,799],[754,936]],
  [[62,538],[379,804],[743,940]],
  [[61,482],[369,809],[733,944]],
  [[60,473],[367,810],[731,945]],
  [[60,473],[366,810],[731,945]],
  [[58,486],[366,810],[731,944]],
  [[49,527],[366,810],[731,944]],
  [[50,527],[366,810],[731,944]],
  [[51,526],[366,810],[731,944]],
  [[52,572],[373,807],[738,942]],
  [[57,656],[385,801],[751,937]],
  [[69,729],[396,795],[762,933]],
  [[75,745],[400,793],[766,931]],
  [[75,734],[399,793],[766,931]],
  [[31,661],[400,789],[754,938]],
  [[40,697],[401,790],[757,936]],
  [[49,731],[401,791],[760,935]],
  [[59,755],[402,792],[763,933]],
  [[67,764],[402,792],[765,932]],
  [[72,758],[401,793],[766,931]],
  [[75,738],[400,793],[766,931]],
  [[76,710],[398,793],[765,931]],
  [[75,682],[396,793],[764,931]],
  [[72,660],[393,793],[761,932]],
  [[66,650],[391,793],[759,933]],
  [[59,654],[389,792],[756,934]],
] as const;
type KyuremArt={poses:HTMLImageElement;started:number;portrait?:HTMLImageElement;sprite?:HTMLImageElement};
let artwork:KyuremArt|undefined;

function texture(file:string){
  const image=new Image();
  image.decoding='async';
  image.src=import.meta.env.BASE_URL+'assets/'+file;
  void image.decode().catch(()=>{});
  return image;
}
export function warmIceSeal2D():KyuremArt{
  return artwork??={poses:texture('kyurem-roar.webp'),started:performance.now()};
}
function shell(lon:number,lat:number,gain=1):Vertex{
  const horizontal=Math.cos(lat),vertical=Math.sin(lat);
  const stretch=gain/(horizontal**3.5+Math.max(0,vertical)**3.5)**(1/3.5);
  const ring=horizontal*stretch;
  return [cx+Math.cos(lon)*radius*ring,cz+Math.sin(lon)*depth*ring,iceLevel+vertical*height*stretch];
}
function convexHull(points:Screen[]):Screen[]{
  points.sort((a,b)=>a.x-b.x||a.y-b.y);
  const half=(arr:Screen[])=>{
    const result:Screen[]=[];
    for(const q of arr){
      while(result.length>=2){
        const a=result[result.length-2],b=result[result.length-1];
        if((b.x-a.x)*(q.y-a.y)-(b.y-a.y)*(q.x-a.x)>0)break;
        result.pop();
      }
      result.push(q);
    }
    result.pop();return result;
  };
  return [...half(points),...half(points.reverse())];
}
const silhouettePoints:Vertex[]=[];
for(let y=0;y<=10;y++)for(let a=0;a<32;a++)silhouettePoints.push(shell(a*tau/32,y*Math.PI/20));
const anchors=Array.from({length:4},(_,i)=>Math.PI*(.25+i*.5));

export function drawFrozenMasonry(p:RasterPaint) {
  const {face,stroke,groundGlow}=p, back=1.84;
  // Meltwater has frozen to the rear cornice, and the long curtains catch the light from below.
  for(const [x,left,width] of [[1.6,.19,2.5],[6.38,.12,.93],[10.83,.09,1.14],[13.76,.16,1.55]]){
    const crust:Vertex[]=[];
    const count=Math.ceil(width/.16);
    for(let i=0;i<=count;i++)crust.push([x+i*width/count,back,3.66-.10*noise(i+x)]);
    face([[x,back,3.90],[x+width,back,3.90],...crust.reverse()],'#a2bdc5bb');
    for(let i=0;i<count;i++){
      const a=x+left+i*(width-left)/count,wide=.028+.07*noise(x+i+54),drop=.19+.69*noise(i+x*4);
      const tip:Vertex=[a+wide*.28,back+.028,3.66-drop];
      face([[a-wide,back,3.69],[a+.011,back+.045,3.70],tip],'#809db2b0');
      face([[a+.011,back+.045,3.70],[a+wide,back,3.68],tip],'#c5dfe4c4');
    }
  }
  for(const sign of [-1,1]){
    const x=sign<0?2.04 : 15.0;
    for(let i=0;i<16;i++){
      const z=3.2+i*.92,l=.24+noise(i+81)*1.08,s=.13+.26*noise(i+69);
      const tip:Vertex=[x-sign*l*.18,z+s*.26,-.65+l];
      face([[x-s,z-s,-.66],[x+s,z-s,-.66],tip],'#8caebd');
      face([[x+s,z-s,-.66],[x+s*.72,z+s,-.66],tip],'#7192a5');
      face([[x+s*.72,z+s,-.66],[x-s,z+s*.44,-.66],tip],'#9fbec9');
    }
    groundGlow(x,10.85,1.88,4.9,'#a5d5e23e',-.65);
  }
}

export function drawIceBed2D(resonance:number,p:RasterPaint){
  const {ctx,point,face,stroke,groundGlow}=p;
  const charged=clamp(resonance||0);
  // Square flagstones give way to a single cracked ice bed held inside an bronze collar.
  face(loop(cx,cz,6.18,5.06,-.48,12),'#354959');
  face(loop(cx,cz,6.20,5.04,-.13,12),'#8e9fa5');
  face(loop(cx,cz,6.02,4.92,-.10,12),'#a6adac');
  face(loop(cx,cz,5.84,4.79,-.10,12),'#566a77');
  const basal=loop(cx,cz,5.65,4.65,iceLevel,36);
  const a=point(cx-3.8,cz-3.1,0), b=point(cx+3.2,cz+3.8,0);
  const shelf=ctx.createLinearGradient(a.x,a.y,b.x,b.y);
  shelf.addColorStop(0,'#8ca8b2');shelf.addColorStop(.39,'#51818e');shelf.addColorStop(.77,'#79a5ad');shelf.addColorStop(1,'#6b8593');
  face(basal,shelf);
  // Refracted sublayers meet at irregular facets beneath the continuous glacier surface.
  const facet=(i:number,band:number):Vertex=>{
    const k=(i+12)%12,a=k*tau/12+.15*Math.sin(k*2.12+band)*Math.min(1,band*.7);
    const r=[0,.30,.57,.81,.963][band]*(.95+.05*noise(k*9+band*33));
    return [cx+Math.cos(a)*5.54*r,cz+Math.sin(a)*4.54*r,iceLevel+.011];
  };
  for(let band=0;band<4;band++)for(let i=0;i<12;i++){
    const tint=['#c2e0e129','#698ea13c','#c5d7d82f','#406c9439','#d0e1d820'];
    face([facet(i,band),facet(i,band+1),facet(i+1,band+1)],tint[(band*5+i*7)%5]);
    if(band)face([facet(i,band),facet(i+1,band+1),facet(i+1,band)],tint[(i+band*3)%5]);
  }
  for(let i=0;i<8;i++){
    const a=i*tau/8+.21,rmax=4.35+noise(i+156)*.42;
    const fissure:Vertex[]=[];
    for(let j=0;j<=11;j++){
      const t=j/11,r=.77+(rmax-.77)*t,angle=a+(noise(i*19+j)-.50)*.17;
      const q:Vertex=[cx+Math.cos(angle)*r,cz+Math.sin(angle)*r*.84,iceLevel+.025];
      fissure.push(q);
      if(j===5||j===8){
        const tx=q[0]+Math.cos(a+.62)*.70,tz=q[1]+Math.sin(a+.62)*.63;
        stroke([q,[tx,tz,iceLevel+.025],[tx+Math.cos(a-.18)*.47,tz+Math.sin(a-.18)*.41,iceLevel+.025]],'#5b899b9c',.030);
      }
    }
    stroke(fissure,'#3c6b81b3',.073);
    stroke(fissure.map(([x,z,h]):Vertex=>[x+.041,z+.028,h]),'#d3e5dfaa',.028);
  }
  for(let i=0;i<58;i++){
    const angle=noise(i+71)*tau,r1=.6+noise(190+i)*4.68,k=.28+noise(270+i)*.67;
    const x=cx+Math.cos(angle)*r1,z=cz+Math.sin(angle)*r1*.81;
    const fissure:Vertex[]=[[x,z,iceLevel+.05],[x+k*.19,z-k*.27,iceLevel+.05],[x+k*.52,z-k*.30,iceLevel+.05],[x+k*.68,z-k*.50,iceLevel+.05]];
    stroke(fissure,i%3?'#375e6d84':'#c6dde0a8',i%5 ? .018 : .032);
    if(i%4===0)stroke([fissure[1],[x-k*.19,z-k*.60,iceLevel+.05]],'#3c657274',.016);
  }
  groundGlow(cx,cz,4.4,3.48,'rgba(178,233,227,'+(.22+charged*.28)+')',iceLevel+.03);
  for(const r of [radius-.17,radius+.1]){
    const ring=loop(cx,cz,r,r*.98,iceLevel+.06,80);
    stroke([...ring,ring[0]],r<radius?'#acd9d4':'#596e82',r<radius ? .046 : .095);
  }
  for(let i=0;i<32;i++){
    const a=i*tau/32;
    const foot=(r:number):Vertex=>[cx+Math.cos(a)*r,cz+Math.sin(a)*r,iceLevel+.10];
    stroke([foot(radius-.22),foot(radius+(i%4===0 ? .44 : .16))],i%4?'#a4a5a2':'#d4c4a1',.055);
  }
}

export function drawIceSeal2D(frame:FortressInteriorFrame,p:RasterPaint){
  const {ctx,point,face,stroke,groundGlow,scale}=p;
  const age=frame.roarAge, gentle=frame.reduced, t=gentle?0:frame.now/1000;
  const charged=clamp(frame.resonance||0);
  const interacting=age>=0&&age<kyuremTiming.decay;
  const impact=age>=kyuremTiming.impact&&age<kyuremTiming.decay?(gentle ? .31:Math.exp(-(age-kyuremTiming.impact)*2.05)):0;
  const hull=convexHull(silhouettePoints.map(v=>point(...v)));
  const traceHull=()=>{
    ctx.beginPath();
    hull.forEach((s,i)=>i?ctx.lineTo(s.x,s.y):ctx.moveTo(s.x,s.y));ctx.closePath();
  };

  for(const a of anchors.filter(a=>Math.sin(a)<0))drawPylon(a);
  for(let i=0;i<16;i++){
    const a=i*tau/16+.12;
    if(Math.sin(a)<.05)drawShard(cx+Math.cos(a)*5.41,cz+Math.sin(a)*4.27,.25+noise(i)*.18,.60+noise(i+19)*.84,a);
  }

  drawLattice(false);
  const bottom=point(cx,cz,iceLevel),crown=point(cx,cz,iceLevel+height);
  const volume=ctx.createLinearGradient(crown.x,crown.y,bottom.x,bottom.y);
  volume.addColorStop(0,'#d3f5ff27');volume.addColorStop(.38,'#8fb6dd13');volume.addColorStop(1,'#83dbe525');
  traceHull();ctx.fillStyle=volume;ctx.fill();
  const muzzle=paintKyurem(age,interacting,gentle,t,charged,p);
  if(!interacting){
    // Frost condenses on the exhale; the jaw position follows the animation frame.
    const exhale=gentle ? .040:Math.max(0,Math.sin(t*1.18-.65))**1.6*.23;
    if(exhale>.004){
      ctx.save();traceHull();ctx.clip();
      for(let i=0;i<8;i++){
        const f=gentle?noise(i+16):(t*.71+noise(i*3+1))%1,r=scale*(.062+f*.184);
        const x=muzzle.x-scale*(.075+f*.85);
        const y=muzzle.y+scale*(.115*f-.29*f*f+(noise(i+9)-.50)*f*.21);
        const mist=ctx.createRadialGradient(x,y,0,x,y,r);
        mist.addColorStop(0,'rgba(214,244,248,'+exhale*Math.sin(Math.PI*f)+')');mist.addColorStop(1,'transparent');
        ctx.fillStyle=mist;ctx.fillRect(x-r,y-r,r*2,r*2);
      }
      ctx.restore();
    }
  }

  // The front film is drawn separately, so the beast remains visibly inside the shield.
  const midpoint=point(cx,cz+1.1,1.50);
  const sheen=ctx.createRadialGradient(midpoint.x,midpoint.y,scale*.62,midpoint.x,midpoint.y,scale*5.0);
  sheen.addColorStop(0,'#94d1e600');sheen.addColorStop(.70,'#acdce407');
  sheen.addColorStop(.91,'rgba(168,234,244,'+(.065+impact*.13)+')');sheen.addColorStop(1,'#cae5f24e');
  traceHull();ctx.fillStyle=sheen;ctx.fill();
  drawLattice(true);
  ctx.strokeStyle='rgba(172,238,243,'+(.56+impact*.24)+')';ctx.lineWidth=Math.max(.72,scale*(.036+impact*.044));
  traceHull();ctx.stroke();
  const footRing=loop(cx,cz,radius,radius,iceLevel+.042,76);
  stroke([...footRing.slice(0,39)],'#bcf1e4c6',.06);
  if(interacting)drawRoar();
  for(const a of anchors.filter(a=>Math.sin(a)>=0))drawPylon(a);
  for(let i=0;i<12;i++){
    const a=i*tau/12+.16;
    if(Math.sin(a)>.03&&Math.abs(Math.cos(a))>.27)drawShard(cx+Math.cos(a)*5.57,cz+Math.sin(a)*4.38,.20+noise(17+i)*.14,.40+noise(i+53)*.49,a);
  }

  function drawShard(x:number,z:number,r:number,h:number,bearing:number,base=iceLevel+.05){
    const bed=loop(x,z,r,r*.76,base,6);
    const top:Vertex=[x+Math.cos(bearing)*h*.19,z+Math.sin(bearing)*h*.16,base+h];
    const palette=['#a0c4d1','#c9e5e5','#acd3da','#779ba9','#799faf','#8fbcc8'];
    for(let i=0;i<6;i++)face([bed[i],bed[(i+1)%6],top],palette[i]);
    stroke([bed[1],top],'#deeff0b5',.020);
  }
  function drawPylon(a:number){
    const x=cx+Math.cos(a)*4.83,z=cz+Math.sin(a)*4.54;
    const {plate}=p;
    const arrival=kyuremTiming.impact+Math.acos(clamp(Math.cos(2.46-a)*Math.cos(.73),-1,1))/3.7;
    const after=age-arrival;
    const tension=gentle ? (impact ? .21 : 0)
      : after>=0&&after<1.12 ? Math.exp(-after*3.1)*Math.sin(Math.min(1,after/.078)*Math.PI/2) : 0;
    groundGlow(x,z,.92,.76,'rgba(109,222,219,'+(.17+charged*.17+tension*.40)+')',iceLevel+.04);
    plate(x-.42,z-.36,.84,.72,-.40,.03,'#839299','#526876','#3b5564');
    plate(x-.30,z-.25,.60,.50,.02,.83,'#8e9c9b','#677d84','#425e6c');
    plate(x-.34,z-.28,.68,.56,.75,.90,'#c3b6a2','#8f8d83','#697d80');
    const ring=loop(x,z,.25,.20,.96,18);
    stroke([...ring,ring[0]],'#accac9',.076);
    drawShard(x,z,.19,.68,Math.PI,.90);
    const hinge:Vertex=[x,z,1.50],socket=shell(a,.31,1.005);
    const middle:Vertex=[(x+socket[0])*.5,(z+socket[1])*.5,(hinge[2]+socket[2])*.5-.115*(1-tension)];
    const beam:Vertex[]=[hinge,middle,socket];
    stroke(beam,'#536f778c',.107);
    stroke(beam,'rgba(150,229,229,'+(.18+.30*charged+.19*impact)+')',.10);
    stroke(beam,'rgba(203,248,242,'+(.55+.19*charged)+')',.024);
    const peak=point(x-.09,z,1.49);
    const g=ctx.createRadialGradient(peak.x,peak.y,0,peak.x,peak.y,Math.max(1,scale*.37));
    g.addColorStop(0,'rgba(173,255,241,'+(.50+impact*.27)+')');g.addColorStop(1,'transparent');
    ctx.fillStyle=g;ctx.fillRect(peak.x-scale*.37,peak.y-scale*.37,scale*.74,scale*.74);
    if(!gentle&&after>.08&&after<1.07){
      for(let i=0;i<8;i++){
        const delay=.08+.20*noise(i+17),f=after-delay;if(f<0)continue;
        const h=1.47+f*(.12+noise(i+20)*.50)-f*f*2.82;
        if(h<iceLevel+.10)continue;
        const xx=x+Math.cos(i*2.4)*f*(.22+noise(i+63)*.46),zz=z+Math.sin(i*2.4)*f*.54;
        stroke([[xx,zz,h],[xx+.022,zz-.012,h+.055]],'#d9efedbb',.031);
      }
    }
  }
  function drawLattice(front:boolean){
    const opacity=front ? .13+impact*.055 : .25+charged*.06;
    for(let i=0;i<12;i++){
      const a=i*tau/12+.24;
      if((Math.sin(a)>.02)!==front)continue;
      const v=Array.from({length:18},(_,j)=>shell(a+.08*Math.sin(j/17*Math.PI),j*Math.PI/36));
      stroke(v,'rgba(170,222,239,'+opacity+')',front ? .022 : .038);
    }
    for(const latitude of [.24,.68,1.03]){
      for(let j=0;j<12;j++){
        const start=j*tau/12+.10;
        if((Math.sin(start+.23)>0)!==front)continue;
        const v=Array.from({length:7},(_,k)=>shell(start+k*.072,latitude));
        stroke(v,'rgba(177,227,241,'+(opacity*.82)+')',.026);
      }
    }
  }
  function drawRoar(){
    const hit=2.46, altitude=.73;
    const impactV=shell(hit,altitude,1.001);
    if(!gentle&&age>=kyuremTiming.voice&&age<1.38){
      const src:Vertex=[cx-2.26,cz+.49,1.42];
      for(let i=0;i<4;i++){
        const k=clamp((age-kyuremTiming.voice-i*.086)/.32);
        if(k<=0||k>=1)continue;
        const pos=src.map((v,j)=>v+(impactV[j]-v)*k) as Vertex;
        const ring:Vertex[]=Array.from({length:23},(_,j)=>{
          const a=j*tau/22,r=.13+.59*k;
          return [pos[0]+Math.cos(a)*r*.25,pos[1]+Math.cos(a)*r*.95,pos[2]+Math.sin(a)*r];
        });
        const projected=point(...src);
        ctx.save();ctx.translate((muzzle.x-projected.x)*(1-k),(muzzle.y-projected.y)*(1-k));
        stroke(ring,'rgba(227,245,238,'+(.78*(1-k*.48))+')',.048);
        ctx.restore();
      }
    }
    if(age<kyuremTiming.impact)return;
    const after=age-kyuremTiming.impact,fade=gentle ? .54:Math.min(1,after/.075)*clamp((1.82-after)/.58);
    for(let branch=0;branch<8;branch++){
      const dir=tau*branch/8,crack:Vertex[]=[];
      const steps=gentle?7:Math.floor(clamp(after/(.42+noise(branch)*.31))*8);
      for(let k=0;k<=steps;k++){
        const f=k/8,warp=.11*Math.sin(branch*3.18+k*2.11)*f;
        const lon=hit+Math.cos(dir)*1.07*f+warp,lat=clamp(altitude+Math.sin(dir)*.73*f+warp*.6,.018,1.51);
        crack.push(shell(lon,lat,1.002));
        if(k===5||k===7){
          const twig=[crack[k],shell(lon+.10*Math.cos(dir+.92),clamp(lat+.14*Math.sin(dir+.92),.018,1.52),1.003)];
          stroke(twig,'rgba(199,245,244,'+(.66*fade)+')',.024);
        }
      }
      if(crack.length>1){
        stroke(crack,'rgba(136,220,239,'+(.35*fade)+')',.114);
        stroke(crack,'rgba(233,255,246,'+(.93*fade)+')',.036);
      }
    }
    if(gentle)return;
    const n=[Math.cos(hit)*Math.cos(altitude),Math.sin(hit)*Math.cos(altitude),Math.sin(altitude)];
    const u=[-Math.sin(hit),Math.cos(hit),0],v=[-Math.cos(hit)*Math.sin(altitude),-Math.sin(hit)*Math.sin(altitude),Math.cos(altitude)];
    for(let echo=0;echo<2;echo++){
      const f=clamp((after-echo*.14)/1.14);
      if(f<=0||f>=1)continue;
      let arcs:Vertex[]=[];
      const angular=f*2.69;
      for(let j=0;j<=76;j++){
        const a=j*tau/76;
        const xyz=n.map((nv,k)=>Math.cos(angular)*nv+Math.sin(angular)*(u[k]*Math.cos(a)+v[k]*Math.sin(a)));
        if(xyz[2]<0){
          if(arcs.length>1)stroke(arcs,'rgba(194,248,245,'+((1-f)*.86)+')',echo ? .035 : .070);
          arcs=[];continue;
        }
        arcs.push([cx+radius*xyz[0],cz+depth*xyz[1],iceLevel+height*xyz[2]]);
      }
      if(arcs.length>1)stroke(arcs,'rgba(201,252,244,'+((1-f)*.86)+')',echo ? .035 : .070);
    }
    for(let i=0;i<22;i++){
      const life=after-noise(431+i)*.155;
      if(life<=0||life>1.55)continue;
      const a=hit+(noise(138+i)-.5)*1.1, speed=.82+noise(739+i)*1.90;
      const x=impactV[0]+Math.cos(a)*life*speed,z=impactV[1]+Math.sin(a)*life*speed;
      const y=Math.max(iceLevel+.07,impactV[2]+life*(1.0+noise(932+i)*1.8)-3.95*life*life);
      const s=(.052+noise(101+i)*.089)*clamp((1.58-life)/.45);
      const swing=Math.sin(life*(4+i%5)+i);
      face([[x-s,z,y],[x+s*swing,z+s*.44,y+s*1.55],[x+s,z,y-s*.42]],i%3?'#d0edf0d5':'#9dbfcfe8');
    }
  }
}

function paintKyurem(age:number,active:boolean,gentle:boolean,time:number,charge:number,p:RasterPaint){
  const images=warmIceSeal2D(),{poses}=images;
  const {ctx,point,groundGlow}=p;
  groundGlow(cx+.12,cz+.08,3.08,1.35,'#213b57ab',iceLevel+.045);
  const foot=point(cx,cz,iceLevel+.09);
  const width=Math.abs(point(cx+3.36,cz).x-point(cx-3.36,cz).x);
  let muzzle=point(cx-2.87,cz+.59,1.69);
  const art=poses.complete&&poses.naturalWidth>0?poses:undefined;
  if(art){
    const sw=art.naturalWidth/6,sh=art.naturalHeight/6,height=width*sh/sw;
    const idleFrame=Math.round(time*1.18/tau*12)%12;
    let index=active?0:frames.length+(gentle?0:idleFrame);
    if(active&&gentle)index=age>kyuremTiming.voice&&age<1.83?10 : 0;
    else if(active)for(let i=1;i<frames.length;i++){if(Math.abs(frames[i]-age)<Math.abs(frames[index]-age))index=i;}
    const left=foot.x-width*0.508136,upper=foot.y-height*0.898517,drawH=height;
    const [jaw,...feet]=tracks[index];
    muzzle={x:left+width*jaw[0]/1000,y:upper+drawH*jaw[1]/1000};
    for(const toe of feet){
      const xx=left+width*toe[0]/1000,yy=upper+drawH*toe[1]/1000;
      ctx.save();ctx.translate(xx,yy);ctx.scale(width*.074,width*.018);
      const contact=ctx.createRadialGradient(0,0,0,0,0,1);
      contact.addColorStop(0,'#263e50b4');contact.addColorStop(.44,'#36596981');contact.addColorStop(1,'transparent');
      ctx.fillStyle=contact;ctx.fillRect(-1,-1,2,2);ctx.restore();
    }
    ctx.save();ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
    ctx.drawImage(art,(index%6)*sw,Math.floor(index/6)*sh,sw,sh,left,upper,width,drawH);
    ctx.restore();
  }else{
    // The 1.4 kB BW sprite can stand in on the first visit. Fetch the full HOME image only if the pose sheet stalls.
    images.sprite??=texture('kyurem-bw.png');
    if(poses.complete||performance.now()-images.started>=2200)images.portrait??=texture('kyurem.png');
    const image=images.portrait?.naturalWidth?images.portrait:images.sprite;
    if(image?.complete&&image.naturalWidth){
      const pixel=image===images.sprite,span=width*.96,h=span*image.naturalHeight/image.naturalWidth;
      const left=foot.x-span*.5,upper=foot.y-h*(pixel ? .79 : .96);
      ctx.save();ctx.imageSmoothingEnabled=!pixel;ctx.drawImage(image,left,upper,span,h);ctx.restore();
      muzzle={x:left+span*.046,y:upper+h*(pixel ? .64 : .736)};
    }
  }
  if(charge>.01)groundGlow(cx-.3,cz+.40,2.5,.47,'rgba(153,216,228,'+(.14*charge)+')',iceLevel+.05);
  return muzzle;
}
