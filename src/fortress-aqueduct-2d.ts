import { loop, noise, tau, type Layer, type Projection, type RasterPaint, type Vertex } from './fortress-raster-space';

type BlockedSurface=(vertices:Vertex[],x:number,z:number)=>void;

export function addAqueductWorks(layers:Layer[],camera:Projection,p:RasterPaint,time:number,blocked:BlockedSurface){
  const {point,plate,top,face,stroke,ctx}=p;
  const visible=(x:number,z:number)=>{
    const q=point(x,z,.52),b=p.scale*2;
    return q.x> -b&&q.x<ctx.canvas.width+b&&q.y> -b&&q.y<ctx.canvas.height+b;
  };
  const bed=13.21;
  for(let bay=0;bay<3;bay++){
    const x=7.86+bay*1.62,mid=x+.81;
    if(!visible(mid,bed))continue;
    layers.push({z:camera.depth(mid,bed+.12),draw(){
      for(const col of (bay===2?[x,x+1.62]:[x])){
        plate(col-.19,bed-.30,.38,.60,-.49,.42,'#a6a78e','#747d6f','#56665f');
        plate(col-.235,bed-.34,.47,.68,.36,.50,'#c6bf9d','#948f78','#6b7a6c');
      }
      const a=(i:number,outer:boolean,back:boolean):Vertex=>{
        const theta=i*Math.PI/12;
        return [mid+Math.cos(theta)*(outer ? .79 : .61),bed+(back?-.28:.29),.43+Math.sin(theta)*(outer ? .66 : .49)];
      };
      for(let i=0;i<12;i++){
        face([a(i,false,true),a(i+1,false,true),a(i+1,false,false),a(i,false,false)],'#4c645e');
        const stone=[a(i,false,false),a(i+1,false,false),a(i+1,true,false),a(i,true,false)];
        face(stone,i%3?'#9d9f87':'#b8ac8a');blocked(stone,mid,bed);
        if(i%2===0)stroke([stone[0],stone[3]],'#6b796f',.018);
      }
      plate(x-.03,bed-.35,1.68,.70,1.04,1.16,'#b3b299','#7f897a','#586d67');
      plate(x-.01,bed-.36,1.64,.098,1.14,1.31,'#bdbda4','#8c9786','#687c72');
      top(x-.01,bed-.24,1.64,.48,1.17,'#608d83');
      for(let i=0;i<6;i++){
        const u=(i/6+.13*time)%1,xx=x+u*1.39,zz=bed-.17+(i%3)*.12;
        stroke([[xx,zz,1.18],[xx+.17,zz+.02,1.18]],'#a5c3aa',.021);
      }
      const lips=bay===2?[[x,.50],[x+1.12,.50]]:[[x,1.62]];
      for(const [xx,w] of lips)plate(xx,bed+.26,w,.10,1.14,1.30,'#c0bea1','#97a28d','#6c8176');
      const cap:Vertex[]=[[x-.03,bed-.35,1.31],[x+1.64,bed-.35,1.31],[x+1.64,bed+.37,1.18],[x-.03,bed+.37,1.18]];
      blocked(cap,mid,bed);
      if(bay===2)fall(11.91,13.74,1.18,0,1,.5,.65);
    }});
  }
  for(const [x,z,dx,dz] of [[5.31,1.91,0,1],[21.09,8.6,-1,0],[21.09,17.6,-1,0]]){
    if(!visible(x,z))continue;
    layers.push({z:camera.depth(x+dx*.37,z+dz*.37),draw(){
      const cross=(i:number,r:number,e:number):Vertex=>{
        const a=i*tau/16;
        return [x+dx*e+dz*Math.cos(a)*r,z+dz*e-dx*Math.cos(a)*r,.77+Math.sin(a)*r];
      };
      const rim=Array.from({length:16},(_,i)=>cross(i,.30,.28));
      face(rim,'#83917b');
      face(Array.from({length:16},(_,i)=>cross(i,.23,.286)),'#334c4d');
      stroke([...rim,rim[0]],'#b5a87c',.046);
      fall(x+dx*.26,z+dz*.26,.67,dx,dz,.34,.58);
    }});
  }
  function fall(x:number,z:number,h:number,dx:number,dz:number,width:number,reach:number){
    const run=(u:number,t:number):Vertex=>{
      const r=Math.sin(t*1.24)*reach,sw=width*u*(1+.22*t);
      return [x+dx*r+dz*sw,z+dz*r-dx*sw,h-(h+.44)*t**1.7];
    };
    for(let i=0;i<5;i++){
      const t=i/5,n=(i+1)/5;
      face([run(-.5,t),run(.5,t),run(.5,n),run(-.5,n)],i>2?'#a0cec5b8':'#72b0acb8');
    }
    for(let j=0;j<8;j++){
      const u=(j+.5)/8-.5,t=(time*(.70+noise(j)*.26)+noise(j+21))%1;
      stroke([run(u,t),run(u,Math.min(1,t+.13+noise(j+81)*.18))],j%2?'#d4e5d2c4':'#93c8bdaf',.027);
    }
    const end=run(0,1);
    for(let j=0;j<2;j++){
      const f=(time*.77+j*.5)%1,r=.16+f*.45;
      const wave=loop(end[0]+dx*f*.13,end[1]+dz*f*.13,r,r*.79,-.43,24);
      stroke([...wave,wave[0]],'rgba(192,223,205,'+(.78*(1-f))+')',.033);
    }
  }
}
