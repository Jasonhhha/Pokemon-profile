import { harborHeight } from './field-city-layout';
import { fortressLiftDepth, type FortressView } from './field-fortress-state';
import { ringAngle, ringRadius } from './field-ring-coordinates';

type Ground = { x: number; z: number };
type Screen = { x: number; y: number };
type Project = (ground: Ground, altitude?: number) => Screen;
type Vertex = [bearing: number, radius: number, elevation: number];

export const bastionRadius = ringRadius(harborHeight + 1);
const gate = ringAngle(3.5);
const turn = Math.PI * 2;
const radial = (angle: number, r: number): Ground => ({ x: Math.sin(angle) * r, z: Math.cos(angle) * r });
const noise = (key: number) => { const n = Math.sin(key * 78.41 + .65) * 43541.78; return n - Math.floor(n); };

export function drawBastionSea(ctx: CanvasRenderingContext2D, project: Project, size: number, lift: number, time: number, night: boolean) {
  const sea = -.58 - fortressLiftDepth * lift;
  const tint = ctx.createLinearGradient(0, 0, 0, ctx.canvas.height);
  tint.addColorStop(0, night ? '#374e64' : '#afcbd1');
  tint.addColorStop(.30, night ? '#2b485e' : '#739eac');
  tint.addColorStop(.65, night ? '#1b394e' : '#487e92');
  tint.addColorStop(1, night ? '#152c3e' : '#295c75');
  ctx.fillStyle = tint;
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  for (let i=0;i<580;i++) {
    const r=26.4 + 65 * noise(i), p=project(radial(i*2.39996,r),sea);
    if (p.x < -size || p.x > ctx.canvas.width+size || p.y < 0 || p.y > ctx.canvas.height) continue;
    const phase=Math.sin(time/1420+r*.63+i*.85), w=size*(.25+.7*noise(i+438))*(1+phase*.20);
    ctx.beginPath(); ctx.moveTo(p.x-w*.45,p.y);
    ctx.quadraticCurveTo(p.x,p.y+size*.035,p.x+w*.55,p.y-size*.016);
    ctx.strokeStyle=i%5?'#c6e2df37':'#d9e7d95c';ctx.lineWidth=Math.max(.6,size*.023);ctx.stroke();
  }
}

export function drawRasterBastion(ctx: CanvasRenderingContext2D, project: Project, yaw: number, size: number, flatten: number,
  fortress: FortressView, milliseconds: number, night: boolean, resonance=0) {
  const sea = -.58 - fortressLiftDepth * fortress.lift;
  const seconds = milliseconds / 1000;
  const front = (a: number) => Math.cos(a-yaw) > -.018;
  const screen = ([a,r,y]:Vertex) => project(radial(a,r),y);
  const at = (a:number, x:number, r:number, y:number):Vertex => [a+x/r,r,y];
  const paint = (v:Vertex[], color:string) => {
    if(v.every(p=>p[2]<=sea)) return;
    ctx.beginPath();
    let first=true;
    const trace=(p:Vertex)=>{
      const q=screen(p);
      if(first){ctx.moveTo(q.x,q.y);first=false;}else ctx.lineTo(q.x,q.y);
    };
    let last=v[v.length-1];
    for(const p of v){
      if((last[2]<sea)!==(p[2]<sea)){
        const t=(sea-last[2])/(p[2]-last[2]);
        trace([last[0]+(p[0]-last[0])*t,last[1]+(p[1]-last[1])*t,sea]);
      }
      if(p[2]>=sea)trace(p);
      last=p;
    }
    ctx.closePath();ctx.fillStyle=color;ctx.fill();
  };
  const face=(a:number,r:number,l:number,b:number,w:number,h:number,color:string)=>{
    if(b+h<=sea||w<=0||h<=0)return;
    const low=Math.max(sea,b),high=b+h;
    paint([at(a,l,r,low),at(a,l+w,r,low),at(a,l+w,r,high),at(a,l,r,high)],color);
  };
  const line=(v:Vertex[],color:string,width:number)=>{
    ctx.beginPath();
    let continuing=false;
    for(const p of v){
      if(p[2]<sea){continuing=false;continue;}
      const q=screen(p);
      if(continuing)ctx.lineTo(q.x,q.y);else ctx.moveTo(q.x,q.y);
      continuing=true;
    }
    ctx.strokeStyle=color;ctx.lineWidth=Math.max(.55,width*size);ctx.stroke();
  };
  const stone=(a:number,variant:number,lower=false)=>{
    const t=.55+.42*Math.cos(a+1.75), n=(variant%5-2)*1.65;
    if(night)return 'rgb('+[26+21*t+n,45+22*t+n,57+20*t+n].map(Math.round)+')';
    const base=lower?[58,81,88]:[110,122,118];
    return 'rgb('+base.map((c,i)=>Math.round(c+(i===2?26:39)*t+n))+')';
  };
  const chalk=night?'#859195':'#c7c4a8', shade=night?'#243e4a':'#41595d';
  const rim=night?'#718588':'#afa98f', bronze=night?'#8b7359':'#ae8557', brass=night?'#c3a77c':'#d5b782';
  const jade=night?'#60c8bb':'#70c7ba', black=night?'#0d202e':'#19363f';

  // The exposed waterline clips the structure itself, including window surrounds and relief ornament.
  const segments=96;
  const bays=Array.from({length:segments},(_,i)=>({i,a:gate+i*turn/segments}))
    .sort((p,q)=>Math.cos(p.a-yaw)-Math.cos(q.a-yaw));
  function drum(r:number,inner:number,base:number,top:number,basalt:boolean){
    if(top<=sea)return;
    const half=r*Math.PI/segments;
    for(const {i,a} of bays){
      if(front(a)){
        face(a,r,-half-.018,base,half*2+.036,top-base,stone(a,i,basalt));
        const count=basalt?3:6;
        for(let j=0;j<count;j++){
          const y=base+(j+.33)*(top-base)/count;
          face(a,r+.015,-half,y,half*2,.028,shade);
          if(!basalt)face(a,r+.018,j%2?-.016:-half,y,.032,(top-base)/count,shade);
        }
        face(a,r+.028,-half,top-.28,half*2+.025,.22,shade);
        face(a,r+.035,-half,top-.15,half*2+.025,.12,basalt?rim:chalk);
      }
      paint([[a-Math.PI/segments,r+.04,top],[a+Math.PI/segments,r+.04,top],
        [a+Math.PI/segments,inner,top],[a-Math.PI/segments,inner,top]],basalt?'#718381':rim);
    }
  }
  function pillar(a:number,r:number,x:number,base:number,top:number,w:number){
    const bands:[number,number,number,string][]=[
      [base,.45,w*1.65,shade],[base+.38,.31,w*1.46,rim],[base+.69,top-base-1.6,w,stone(a,2)],
      [top-.93,.21,w*1.19,bronze],[top-.72,.26,w*1.48,rim],[top-.46,.43,w*1.76,chalk],
    ];
    for(const [h,t,width,c] of bands){
      face(a,r,x-width/2,h,width,t,c);
      face(a,r+.03,x+width*.23,h,width*.27,t,shade);
    }
    for(const dx of [-.24,.04,.30])face(a,r+.04,x+w*dx,base+.81,w*.055,top-base-1.84,shade);
  }
  function vault(a:number,r:number,half:number,base:number,spring:number,rise:number,pointed:boolean,open:number){
    if(!front(a)||spring+rise<=sea)return;
    const curve=(i:number,extra:number):Vertex=>{
      const t=i/16*2-1,k=pointed?.69:0;
      const dome=Math.sqrt(Math.max(0,1-((Math.abs(t)+k)/(1+k))**2))/Math.sqrt(1-(k/(1+k))**2);
      return at(a,t*(half+extra),r+.07,spring+(rise+extra)*dome);
    };
    const points=Array.from({length:17},(_,i)=>curve(i,0));
    paint([at(a,-half,r+.07,base),...points,at(a,half,r+.07,base)],black);
    ctx.save();ctx.clip();
    const depth=pointed?1.06:.58;
    const recess=points.map(([angle,,h]):Vertex=>[a+(angle-a)*.73,r-depth,spring+(h-spring)*.83-.2]);
    for(let i=0;i<16;i++)paint([points[i],points[i+1],recess[i+1],recess[i]],i<8?'#52686b':'#364d54');
    for(const s of [-1,1]){
      paint([at(a,s*half,r+.065,base),at(a,s*half,r+.065,spring),at(a,s*half*.73,r-depth,spring-.20),
        at(a,s*half*.73,r-depth,base+.37)],s<0?'#40585a':'#30474e');
    }
    paint([at(a,-half,r+.06,base),at(a,half,r+.06,base),at(a,half*.73,r-depth,base+.38),
      at(a,-half*.73,r-depth,base+.38)],'#667a73');
    if(pointed){
      line(recess,'#879187',.048);
      const rib=points.map(([angle,,h]):Vertex=>[a+(angle-a)*.55,r-depth-.31,spring+(h-spring)*.67-.37]);
      line(rib,'#455d60',.085);
      face(a,r-depth,-half*.62,base+.40,half*1.24,.12,'#5c716d');
      const side=Math.sin(a*35+2)>-.2;
      const x=half*(side?.47:-.47);
      face(a,r-depth+.03,x-.07,spring-.67,.14,.22,side?'#d0ad78':'#88aca6');
      face(a,r-depth+.05,x-.10,spring-.47,.20,.05,bronze);
    }
    ctx.restore();
    const border=pointed?.20:.16;
    for(let i=0;i<16;i++)paint([curve(i,border),curve(i+1,border),points[i+1],points[i]],i%4===0?rim:chalk);
    for(const s of [-1,1])face(a,r+.08,s*half-(s<0?border:0),base,border,spring-base,rim);
    const bottom=base+(spring+rise-base)*open;
    for(let i=2;i<=14;i+=3){
      const top=points[i][2],x=(i/8-1)*half;
      face(a,r+.09,x-.033,bottom,.066,top-bottom,'#647d79');
    }
  }
  function dial(a:number,r:number,h:number,rad:number){
    if(h+rad<sea)return;
    const xy=(theta:number,reach:number):Vertex=>at(a,Math.cos(theta)*reach,r,h+Math.sin(theta)*reach);
    for(const [reach,width,c] of [[rad,.17,brass],[rad*.83,.085,bronze],[rad*.56,.095,jade],[rad*.27,.13,brass]] as const){
      for(let i=0;i<36;i++)paint([xy(i*turn/36,reach),xy((i+1)*turn/36,reach),xy((i+1)*turn/36,reach-width),xy(i*turn/36,reach-width)],c);
    }
    for(let i=0;i<12;i++){
      const t=i*turn/12+.12;
      paint([xy(t,rad*.32),xy(t+.06,rad*.32),xy(t+.35,rad*.82),xy(t+.23,rad*.82)],i%3?bronze:brass);
      line([xy(t,rad*.90),xy(t,rad*1.06)],chalk,.065);
    }
  }
  const outlets=Array.from({length:8},(_,i)=>gate+(i+.5)*turn/8);
  const pressure=fortress.phase==='open'?0:Math.min(1,Math.max(0,(fortress.lift-.12)*3.7))*(1-fortress.drain**1.6);
  function cascade(a:number,r:number,lip:number,end:number,reach:number,halfWidth:number,id:number){
    if(pressure<=.012||sea>=lip-.10)return;
    const floor=Math.max(sea,end), drop=lip-floor;
    const span=reach*Math.sqrt(drop/(lip-end))*(.62+.38*pressure);
    const half=halfWidth*Math.sqrt(pressure);
    const shot=(t:number,side:number):Vertex=>{
      const d=r+span*t;
      const wave=.048*t*Math.sin(seconds*5.2+t*13+id+side*3.4)+.035*t*Math.sin(t*37-seconds*3.7+id*.89);
      const spread=half*(.78+.54*t+.08*Math.sin(t*13-seconds*2.1+id)*t)+wave;
      return [a+(side*spread+wave)/d,d+.10*Math.sin(t*17-seconds*3.2+side*9)*t,lip-drop*t*t];
    };
    const colors=night?['#518f9c','#70a9af','#a7cecb','#81b6b6','#6ca4aa']:['#84babb','#9fc7c3','#bfdbd0','#a2ceca','#92c4c5'];
    for(let j=0;j<10;j++){
      const e=j*.2-1, v=Array.from({length:10},(_,i)=>shot(i/9,e));
      v.push(...Array.from({length:10},(_,i)=>shot(1-i/9,e+.205)));
      paint(v,colors[(j+id)%colors.length]);
    }
    for(let i=0;i<38;i++){
      const t=(seconds*(.63+i%3*.12)+i*.127+id*.173)%1, s=noise(i+id*47)*1.9-.95;
      line([shot(t,s),shot(Math.min(1,t+.055+.11*noise(i)),s)],i%5?'#eef5e49a':'#5e9da296',.031+.040*noise(i+3));
    }
    const p=screen(shot(1,0)),w=(half+.25)*size;
    for(let i=0;i<3;i++){
      const age=(seconds*.78+i/3+id*.13)%1,ex=w*(.9+age*.78);
      ctx.beginPath();ctx.ellipse(p.x,p.y,ex,Math.max(.35,ex*flatten*.76),0,0,turn);
      ctx.strokeStyle='rgba(208,242,230,'+(.62*(1-age))+')';ctx.lineWidth=Math.max(.7,size*.072);ctx.stroke();
    }
    for(let i=0;i<23;i++){
      const age=(seconds*(.56+noise(i+20)*.52)+noise(i+id*17))%1,dir=i*2.398+id;
      const rr=r+span+(age*.8+.12)*Math.cos(dir), x=Math.sin(dir)*half*(.48+age);
      const q=screen(at(a,x,rr,floor+.05+age*(1-age)*3.5*pressure));
      const s=Math.max(.45,(.045+(1-age)*.105)*size);
      ctx.fillStyle=i%3?'#e0f2e3a1':'#a7d2d8a6';ctx.fillRect(q.x,q.y,s*1.4,s);
    }
  }
  function drain(a:number,i:number){
    cascade(a,25.83,-3.5,-9.98,2.22,1.03,i*3);
    cascade(a,28.30,-10.58,-14.80,3.48,1.42,i*3+1);
    cascade(a,32.05,-15.22,-.58-fortressLiftDepth,3.80,1.72,i*3+2);
  }
  outlets.forEach((a,i)=>{if(!front(a))drain(a,i);});
  const skirt=sea>-5.65?bastionRadius:sea>-12.25?27.02:sea>-19.55?30.40:32.2;
  for(let wave=0;wave<3;wave++){
    const age=(seconds*.18+wave/3)%1;
    const r=skirt+.24+age*(pressure?2.75:1.24);
    for(let i=0;i<18;i++){
      const a=gate+i*turn/18+.08*wave, length=.16+noise(i+wave)*.15;
      const points=Array.from({length:8},(_,j):Vertex=>[a+length*j/7,r+.06*Math.sin(j*.83+i+seconds),sea+.018]);
      line(points,'rgba(203,231,210,'+((.24+.27*pressure)*(1-age))+')',.072);
    }
  }

  drum(32.2,30.10,-22.9,-19.55,true);
  drum(30.40,26.86,-19.55,-12.25,true);
  for(let i=0;i<32;i++){
    const a=gate+i*turn/32;
    if(!front(a))continue;
    vault(a,30.46,1.49,-19.35,-16.36,2.60,true,.90);
    pillar(a,30.56,2.75,-19.55,-12.24,.56);
    if(i%4===0){
      face(a,30.65,-2.20,-18.76,4.4,5.9,shade);
      dial(a,30.73,-15.78,2.54);
      for(const sign of [-1,1]){
        line([at(a,sign*2.48,30.74,-15.74),at(a,sign*2.95,30.74,-15.74),
          at(a,sign*3.68,30.74,-14.95),at(a,sign*4.44,30.74,-14.95)],jade,.078);
      }
    }else if(i%4===2){
      for(let step=0;step<5;step++)face(a,30.71+step*.22,-2.2-step*.14,-15.85-step*.74,4.4+step*.28,.25,rim);
    }
  }
  drum(27.02,25.39,-12.25,-5.65,false);
  for(let i=0;i<36;i++){
    const a=gate+i*turn/36;
    if(!front(a))continue;
    vault(a,27.05,1.50,-11.92,-8.88,2.65,true,.83);
    pillar(a,27.14,2.25,-12.20,-5.65,.55);
  }
  drum(bastionRadius,25.20,-5.65,-.036,false);
  for(let i=0;i<64;i++){
    const a=gate+i*turn/64;
    if(!front(a))continue;
    if(i%4===0 && i!==0)pillar(a,bastionRadius+.10,0,-5.52,-.28,.48);
    if(i%4===1||i%4===3){
      face(a,bastionRadius+.06,-.19,-3.54,.38,1.55,black);
      face(a,bastionRadius+.08,-.24,-2.02,.48,.14,bronze);
    }
  }
  vault(gate,bastionRadius+.13,1.36,-5.02,-2.65,1.55,false,Math.min(1,Math.max(0,(fortress.drain-.8)*5)));
  if(front(gate)){
    for(const sign of [-1,1]) {
      face(gate,bastionRadius+.17,sign*1.87-.15,-3.15,.30,.86,shade);
      face(gate,bastionRadius+.20,sign*1.87-.078,-2.98,.156,.51,'#ffda91');
    }
    if(fortress.drain>.83){
      paint([at(gate,-1.33,bastionRadius+.16,-5.02),at(gate,1.33,bastionRadius+.16,-5.02),
        at(gate,.78,bastionRadius+.16,-4.27),at(gate,-.78,bastionRadius+.16,-4.27)],'#597679');
    }
    if(resonance>.01){
      for(const sign of [-1,1]){
        const duct:Vertex[]=[
          at(gate,sign*2.50,30.74,-15.78),at(gate,sign*3.47,30.74,-15.78),
          at(gate,sign*3.81,30.74,-15.41),at(gate,sign*3.81,30.74,-12.22),
          at(gate,sign*3.81,27.15,-12.22),at(gate,sign*3.81,27.15,-5.61),
          at(gate,sign*3.81,bastionRadius+.18,-5.60),at(gate,sign*2.62,bastionRadius+.20,-5.60),
          at(gate,sign*1.87,bastionRadius+.20,-4.88),at(gate,sign*1.87,bastionRadius+.20,-2.40),
        ];
        line(duct,'rgba(83,218,201,'+(.36*resonance)+')',.29);
        line(duct,'rgba(166,255,224,'+resonance+')',.095);
      }
      const halo=Array.from({length:49},(_,i)=>at(gate,Math.cos(i*turn/48)*2.10,30.76,-15.78+Math.sin(i*turn/48)*2.10));
      line(halo,'rgba(175,255,226,'+resonance+')',.113);
    }
  }
  outlets.forEach((a,i)=>{
    if(!front(a))return;
    for(const [r,y,w] of [[25.83,-3.5,1.07],[28.30,-10.58,1.52],[32.05,-15.22,1.79]]){
      const back=r===25.83?r-.13:r===28.30?26.94:30.31;
      paint([at(a,-w-.18,back,y+.20),at(a,w+.18,back,y+.20),at(a,w+.18,r,y),at(a,-w-.18,r,y)],'#546e6a');
      paint([at(a,-w+.03,back,y+.23),at(a,w-.03,back,y+.23),at(a,w-.03,r,y+.02),at(a,-w+.03,r,y+.02)],pressure?'#9bc9bf':'#39706f');
      for(const s of [-1,1]){
        const x=s*w;
        paint([at(a,x,back,y+.52),at(a,x,r,y+.31),at(a,x,r,y-.30),at(a,x,back,y-.51)],s<0?rim:shade);
        line([at(a,x,back,y+.52),at(a,x,r,y+.31)],chalk,.12);
        paint([at(a,x*.70,back,y-1.42),at(a,x*.70,r,y-.31),at(a,x*.70,back,y-.24)],bronze);
      }
      face(a,r,-w-.18,y-.39,w*2+.36,.32,chalk);
      face(a,r+.06,-w,y-.13,w*2,.13,jade);
      for(const s of [-1,1])face(a,r,s*(w+.07)-.094,y-.19,.188,.65,bronze);
    }
    vault(a,bastionRadius+.19,1.0,-3.53,-2.79,.88,false,.90);
    drain(a,i);
  });
}
