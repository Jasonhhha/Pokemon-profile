import type { FortressRoom } from './field-fortress-state';
import type { GridReading } from './fortress-power';

type Pen = CanvasRenderingContext2D;
const W = 600, H = 370;
const gold = '#baaa83', brass = '#8c7959', dark = '#172a31', stone = '#59686a';
export const sectionRows = { sluice: 111, aqueduct: 178, catacomb: 251, seal: 324 } as const;
function line(p: Pen, x: number, y: number, endX: number, endY: number, tint: string, weight = 1) {
  p.beginPath(); p.moveTo(x,y); p.lineTo(endX,endY); p.strokeStyle=tint; p.lineWidth=weight; p.stroke();
}
function rect(p: Pen, x: number, y: number, w: number, h: number, tint: string) {
  p.fillStyle=tint; p.fillRect(x,y,w,h);
}
function shape(p: Pen, vertices: number[][], tint: string) {
  p.beginPath(); vertices.forEach(([x,y],i)=>i?p.lineTo(x,y):p.moveTo(x,y)); p.closePath(); p.fillStyle=tint; p.fill();
}
function ellipse(p: Pen, x: number,y: number, rx: number,ry: number, color: string, width=1) {
  p.beginPath(); p.ellipse(x,y,rx,ry,0,0,2*Math.PI); p.strokeStyle=color; p.lineWidth=width; p.stroke();
}
function arcade(p: Pen, x: number, base: number, span: number, count: number, rise: number, tint: string) {
  const bay=span/count;
  for (let i=0;i<count;i++) {
    const a=x+i*bay, spring=base-rise*.48;
    p.beginPath(); p.moveTo(a,base); p.lineTo(a,spring);
    p.bezierCurveTo(a,spring-rise*.69,a+bay,spring-rise*.69,a+bay,spring); p.lineTo(a+bay,base);
    p.strokeStyle=tint; p.lineWidth=2.2; p.stroke();
    rect(p,a-1.8,spring-1,3.6,2,brass); rect(p,a-2.7,base-1.5,5.4,2.2,tint);
  }
}
function slab(p: Pen,x: number,y: number,length: number,thickness: number) {
  rect(p,x,y,length,thickness,stone); rect(p,x,y,length,1.5,gold); rect(p,x+3,y+thickness-2,length-6,1,brass);
  for(let i=13;i<length;i+=19)line(p,x+i,y+2,x+i-3,y+thickness-2,'#313e40',.7);
}
function roof(p: Pen,x: number,y: number,w: number,h: number) {
  shape(p,[[x,y],[x+w*.5,y-h],[x+w,y]],'#455257');
  line(p,x,y,x+w*.5,y-h,'#ab9c7e');
}

export function drawSectionStone(p:Pen, selected:FortressRoom) {
  const air=p.createLinearGradient(0,0,0,88);
  air.addColorStop(0,'#233942');air.addColorStop(1,'#7d897e');
  p.fillStyle=air; p.fillRect(0,0,W,88);
  const sea=p.createLinearGradient(0,67,0,H);
  sea.addColorStop(0,'#3c666b');sea.addColorStop(.42,'#1b3d46');sea.addColorStop(1,'#101e2a');
  p.fillStyle=sea;p.fillRect(0,68,W,H-68);
  for(let i=0;i<74;i++){
    const x=(i*83.3)%610,y=69+(i*i*7.1)%291;
    line(p,x,y,x+5+i%11,y,'rgba(175,209,196,.15)',.65);
  }
  // The settlement occupies the roof slab; the greater mass lies below the sea line.
  for(let layer=0;layer<2;layer++){
    const count=layer?20:26;
    for(let i=0;i<count;i++){
      const x=88+i*(420/count)+(layer?2:0),w=420/count-2,h=(layer?6:9)+((i*47+layer*5)%16),base=layer?64:57;
      rect(p,x,base-h,w,h,layer?'#536064':'#52696c');roof(p,x-1,base-h,w+2,4+i%4);
      rect(p,x+w*.72,base-h-5,2,5,'#586062');
      if(layer) for(let k=3;k<w-2;k+=5)rect(p,x+k,base-h+4,1.4,3,'#9d9c82');
    }
  }
  rect(p,294,26,13,37,'#556267');rect(p,291,25,19,3,gold);roof(p,290,25,21,10);
  line(p,300.5,16,300.5,8,brass,1.3); ellipse(p,300.5,34,3.9,3.9,'#c1b999');
  shape(p,[[75,64],[525,64],[540,84],[533,139],[551,161],[544,222],[521,237],[520,283],[460,302],[430,350],[375,365],[225,365],[170,350],[140,302],[80,283],[79,237],[56,222],[49,161],[67,139],[60,84]],'#576463');
  shape(p,[[81,68],[520,68],[525,134],[507,152],[519,217],[492,230],[498,271],[442,290],[415,343],[369,353],[230,353],[185,343],[158,290],[102,271],[108,230],[81,217],[93,152],[75,134]],dark);
  const y=sectionRows[selected], highlight=p.createLinearGradient(0,y-38,0,y+16);
  highlight.addColorStop(0,'#25474400');highlight.addColorStop(.70,'#406e6055');highlight.addColorStop(1,'#406e6000');
  p.fillStyle=highlight;p.fillRect(103,y-38,393,54);
  slab(p,65,64,470,8);
  // B1, paired galleries carrying the surface.
  arcade(p,100,106,400,14,32,'#7b8580');
  arcade(p,115,107,370,10,21,'#adb0a0');
  for(const x of [99,438]){arcade(p,x,95,64,5,12,stone);slab(p,x-4,96,72,4);}
  slab(p,74,109,452,8);
  // B2, cascading reservoirs and a triple arcade.
  for(const dir of [-1,1]){
    for(let k=0;k<4;k++)slab(p,dir===-1?84+k*9:448-k*9,143+k*7,66,5);
    rect(p,dir===-1?105:402,171,93,3,'#608e8c');
  }
  arcade(p,116,171,368,9,44,'#57696b'); arcade(p,167,174,266,5,43,'#89968e');
  slab(p,57,177,486,9);
  // B3, a ring gallery set into a ribbed dome.
  for(let i=0;i<7;i++){
    const r=38+i*13;
    p.beginPath();p.ellipse(300,238,r,45,0,Math.PI,Math.PI*2);p.strokeStyle=i%2?brass:stone;p.lineWidth=1.2;p.stroke();
  }
  arcade(p,105,247,390,11,24,'#7c8580');
  for(const x of [166,424]){rect(p,x,209,9,38,'#626e70');rect(p,x-3,207,15,4,gold);}
  ellipse(p,300,221,34,9,brass);ellipse(p,300,218,16,20,'#a1a28a');
  slab(p,79,250,442,9);
  // B4, a suspended pressure shield between two canted load-bearing ribs.
  for(const side of [-1,1]){
    const x=(offset:number)=>300+side*offset;
    shape(p,[[x(127),322],[x(111),320],[x(85),277],[x(31),268],[x(26),262],[x(91),266],[x(108),284]],'#637370');
    line(p,x(119),318,x(89),273,brass,2);line(p,x(89),273,x(35),265,gold);
    for(let i=0;i<6;i++) slab(p,side<0?174-i*4:362+i*4,322+i*3,66,3.5);
  }
  p.beginPath();p.ellipse(300,324,45,44,0,Math.PI,Math.PI*2);p.strokeStyle='#63a59e';p.lineWidth=1.3;p.stroke();
  ellipse(p,300,324,46,5,'#789c8e',1.4);slab(p,252,331,96,7);
  for(const x of [232,368]){
    rect(p,x-3,69,6,205,'#655e4f');rect(p,x-1.1,68,2.2,207,'#63837b');
    for(let h=74;h<275;h+=12)rect(p,x-3.7,h,7.4,2,'#9a8a67');
  }
}

export function drawSectionPower(p:Pen, reading:GridReading, reduced:boolean, sprite:HTMLImageElement, selected:FortressRoom, current?:FortressRoom) {
  if(sprite.naturalWidth){p.imageSmoothingEnabled=false;p.drawImage(sprite,267,266,66,66);p.imageSmoothingEnabled=true;}
  const {source,bus,city,phase}=reading;
  for(const side of [-1,1]){
    const xx=300+side*68;
    p.beginPath();p.moveTo(300+side*13,305);p.lineTo(300+side*36,297);p.lineTo(xx,274);p.lineTo(xx,68);p.lineTo(300+side*188,68);
    p.lineWidth=1.8;p.strokeStyle=`rgba(135,235,207,${.15+bus*.68})`;p.stroke();
    for(let k=0;k<8;k++){
      const f=(k+(reduced?.45:phase))/8, y=274-(274-68)*f;
      line(p,xx,y+2.7,xx,y-2.7,`rgba(190,255,227,${.15+bus*.86})`,2.4);
    }
    for(let i=0;i<8;i++)rect(p,300+side*(19+i*22),48+(i*13)%12,2,3,`rgba(255,224,147,${city*.88})`);
  }
  ellipse(p,300,324,45,5,`rgba(159,246,232,${.16+source*.62})`,1.4);
  const tagY=sectionRows[selected]-13;
  line(p,438,tagY,535,tagY,'#c3b38f',.8);
  p.font='600 10px ui-monospace, monospace';p.textAlign='left';p.fillStyle='#e2d4ae';p.fillText('B'+(['sluice','aqueduct','catacomb','seal'].indexOf(selected)+1),540,tagY+3);
  if(current){const yy=sectionRows[current]-2;shape(p,[[50,yy],[43,yy-4],[43,yy+4]],'#cae8ba');}
}
