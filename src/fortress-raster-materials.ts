import { type RasterPaint, type Vertex, noise } from './fortress-raster-space';

type Surface='sandstone'|'froststone'|'cap'|'slate'|'water'|'ice';
const size=64;
const tiles=new Map<string,HTMLCanvasElement>();
const tones:Record<Surface,[number,number,number]> = {
  sandstone:[145,145,124],froststone:[139,153,163],cap:[117,135,123],slate:[103,120,143],
  water:[34,79,82],ice:[36,62,86],
};

// Seamless optical patterns are baked once. The projected film moves independently above the bed.
function material(surface:Surface,variant:number) {
  const key=surface+variant, cached=tiles.get(key);
  if(cached)return cached;
  const tile=document.createElement('canvas');tile.width=tile.height=size;
  const ctx=tile.getContext('2d')!,image=ctx.createImageData(size,size), rgb=tones[surface];
  const liquid=surface==='water'||surface==='ice',cold=surface==='ice'||surface==='slate'||surface==='froststone';
  const points=Array.from({length:9},(_,k)=>[(k%3+.20+.55*noise(variant*13+k))/3,(Math.floor(k/3)+.16+.65*noise(variant*17+k+4))/3]);
  for(let j=0;j<size;j++)for(let i=0;i<size;i++){
    const x=i/size,y=j/size;
    const ox=x+.021*Math.sin(y*12.57+variant),oy=y+.042*Math.sin(x*6.28+variant);
    let d1=4,d2=4;
    for(const [u,v] of points){
      let dx=Math.abs(ox-u),dy=Math.abs(oy-v);dx=Math.min(dx,1-dx);dy=Math.min(dy,1-dy);
      const dist=dx*dx+dy*dy;
      if(dist<d1){d2=d1;d1=dist;}else if(dist<d2)d2=dist;
    }
    const ridge=Math.exp(-(d2-d1)*(liquid?197 : 466));
    const warp=Math.sin((x*2.0+y)*6.283+Math.sin(y*12.57)*.65+variant);
    const grain=(noise(i+j*size+variant*472)-.50)*(liquid?5 : 19);
    const run=liquid ? ridge*(surface==='ice'?14 : 18)+3*warp : -ridge*14+warp*3.7;
    const idx=(j*size+i)*4;
    for(let c=0;c<3;c++)image.data[idx+c]=rgb[c]+grain+run*(c===2&&cold?1.28 : 1);
    image.data[idx+3]=255;
  }
  ctx.putImageData(image,0,0);
  tiles.set(key,tile);
  return tile;
}

export function tileSkin(p:RasterPaint,x:number,z:number,h:number,surface:Surface,variant:number,alpha=1){
  const {ctx,point}=p;
  const p0=point(x,z,h),px=point(x+1,z,h),pz=point(x,z+1,h);
  ctx.save();
  ctx.globalAlpha=alpha;
  ctx.transform((px.x-p0.x)/size,(px.y-p0.y)/size,(pz.x-p0.x)/size,(pz.y-p0.y)/size,p0.x,p0.y);
  ctx.imageSmoothingEnabled=true;ctx.drawImage(material(surface,variant%4),-.25,-.25,size+.5,size+.5);ctx.restore();
}

export function drawFortressLift2D(x:number,z:number,unlocked:boolean,p:RasterPaint){
  const {top,plate,stroke,face}=p;
  const copper=unlocked?'#ade7cf':'#a49472', low=unlocked?'#5ca99b':'#67776f';
  top(x+.04,z+.04,.92,.92,.042,'#263e47');
  for(let i=0;i<8;i++)top(x+.09+i*.105,z+.08,.057,.84,.055,i%2?'#9c9075':'#ac9c7d');
  for(const zz of [.08,.44,.87])top(x+.06,z+zz,.87,.056,.065,low);
  for(const dir of [-1,1]){
    const xx=x+.5+.46*dir;
    plate(xx-.062,z+.10,.124,.76,0,.13,'#b6a88b','#6c7066','#4b6064');
    for(let i=0;i<6;i++){
      const zz=z+.18+i*.118;
      stroke([[xx-.038,zz,.14],[xx+.028,zz+.045,.14],[xx-.02,zz+.084,.14]],copper,.036);
    }
  }
  const mark:Vertex[]=[[x+.5,z+.23,.084],[x+.65,z+.40,.084],[x+.55,z+.40,.084],[x+.55,z+.66,.084],[x+.45,z+.66,.084],[x+.45,z+.40,.084],[x+.35,z+.40,.084]];
  face(mark,copper);
  if(unlocked)p.groundGlow(x+.5,z+.52,.58,.50,'#8cf7d35b',.087);
}
