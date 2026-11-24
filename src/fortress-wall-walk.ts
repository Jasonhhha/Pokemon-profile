import { harborHeight } from './field-city-layout';
import { ringAngle, ringRadius } from './field-ring-coordinates';
import type { FieldMap } from './field-layout';

export const wallTop = { x: 3, y: 83 };
export const wallGate = { x: 3, y: 1 };
const radius = ringRadius(harborHeight + 1);
const west = ringAngle(3.5);
export type WallPoint = { x: number; y: number; z: number };
export type WallFace = { vertices: WallPoint[]; color: string; light?: boolean };
const landings = [[21,24], [39,42], [56,60], [76,83]];
const halfWidth = (distance: number) => landings.some(([a,b]) => distance >= a && distance <= b) ? 2 : 1;
const surface = Array.from({ length: 85 }, (_, y) => Array.from({ length: 7 }, (_, x) =>
  y >= 1 && y <= 83 && Math.abs(x - 3) <= halfWidth(83-y)));
export const wallMap: FieldMap = { width: 7, height: 85, walkable: surface, grass: surface.map(row => row.map(() => false)),
  spawn: { x:3, y:82 }, npcs: [], exits: [] };

const stations = [
  // Distance along the route, bearing from the dock, radius, height above the original waterline.
  [0,0,ringRadius(12.9),.08], [20,.035,radius+1.05,.08], [24,.13,radius+1.65,.08],
  [39,.51,radius+2.65,-5.38], [42,.59,radius+3.26,-5.38],
  [56,.99,radius+4.29,-11.49], [60,1.12,radius+5.5,-11.49],
  [76,Math.PI*2/3-.10,radius+7.6,-18.78], [79,Math.PI*2/3,radius+6.0,-18.78],
  [82,Math.PI*2/3,radius+1.6,-18.78],
];
function axis(distance: number) {
  const d = Math.max(0, Math.min(82, distance));
  const end = stations.findIndex((s, i) => i > 0 && s[0] >= d);
  const a = stations[end-1], b = stations[end];
  const t = (d-a[0])/(b[0]-a[0]);
  const angle = west+a[1]+(b[1]-a[1])*t;
  const r = a[2]+(b[2]-a[2])*t;
  return { x: Math.sin(angle)*r, z: Math.cos(angle)*r, y: a[3]+(b[3]-a[3])*t, angle };
}

// Grid coordinates are continuous here, with integer values at the centre of each tile.
export function wallPoint(column: number, row: number): WallPoint {
  const d = 83-row;
  const p = axis(d), a = axis(d-.65), b = axis(d+.65);
  const dx = b.x-a.x, dz = b.z-a.z, length = Math.hypot(dx,dz) || 1;
  const lateral = (column-3)*.55;
  return { x:p.x-dz/length*lateral, z:p.z+dx/length*lateral, y:p.y };
}

export function wallSection(row: number) {
  if (row >= 63) return '西栈桥引桥';
  if (row >= 43) return '上层扶壁阶梯';
  if (row >= 25) return '中层泄水拱廊';
  if (row > 6) return '下层环壁长阶';
  return '下层王门';
}

export function wallCamera(column: number, row: number, compact: boolean) {
  const position = wallPoint(column,row), axisPoint = axis(83-row);
  const ahead = wallPoint(column,Math.max(1,row-2.3));
  return { center: { x: position.x*.73+ahead.x*.27, z:position.z*.73+ahead.z*.27, y:position.y+.96 },
    yaw: axisPoint.angle + (row>62 ? .83 : .34), pitch: row>62 ? .62 : .34,
    span: compact ? 8.2 : 10.4, distance: compact ? 13 : 18 };
}

export function pickWallTile(px: number, py: number, row: number, project: (p: WallPoint) => {x:number;y:number;depth:number}) {
  let result: {x:number;y:number} | undefined, nearest = Infinity;
  for (let y = Math.max(1, Math.floor(row)-15); y <= Math.min(83, Math.ceil(row)+15); y++) {
    for (let x = 1; x <= 5; x++) {
      if (!surface[y][x]) continue;
      const corners = [[-.5,-.5],[.5,-.5],[.5,.5],[-.5,.5]].map(([dx,dy])=>project(wallPoint(x+dx,y+dy)));
      let inside = false;
      for (let i=0,j=3;i<4;j=i++) {
        const a=corners[i], b=corners[j];
        if ((a.y>py)!==(b.y>py) && px < (b.x-a.x)*(py-a.y)/(b.y-a.y)+a.x) inside=!inside;
      }
      const depth=project(wallPoint(x,y)).depth;
      if (inside && depth<nearest) { nearest=depth; result={x:(x+.5)*16,y:(y+.5)*16}; }
    }
  }
  return result;
}

const addHeight = (p: WallPoint, delta: number) => ({ ...p, y:p.y+delta });
let baked: WallFace[] | undefined;
export function wallFaces() {
  if (baked) return baked;
  const faces: WallFace[] = [];
  function plate(vertices: WallPoint[], color: string, light = false) { faces.push({vertices,color,light}); }
  function rod(a: WallPoint,b: WallPoint,r: number,color: string,light = false) {
    const dx=b.x-a.x,dy=b.y-a.y,dz=b.z-a.z, len=Math.hypot(dx,dy,dz);
    if(len<.0001)return;
    const h=Math.hypot(dx,dz);
    const ux = h>0.0001 ? dz/h : 1, uz=h>0.0001 ? -dx/h : 0;
    const vx=dy*uz/len, vy=(dz*ux-dx*uz)/len, vz=-dy*ux/len;
    const side=(p:WallPoint,i:number) => {const c=Math.cos(i*Math.PI/2)*r,s=Math.sin(i*Math.PI/2)*r;return {x:p.x+c*ux+s*vx,y:p.y+s*vy,z:p.z+c*uz+s*vz};};
    for(let i=0;i<4;i++)plate([side(a,i),side(b,i),side(b,i+1),side(a,i+1)],color,light);
  }
  const palette=['#ad9f86','#b5a78c','#a39a88','#b9ae94'];
  for (let d=0;d<82;d++) {
    const half=halfWidth(d)+.5, left=3-half,right=3+half;
    const count=Math.abs(axis(d+1).y-axis(d).y)>.06 ? 3 : 1;
    for(let k=0;k<count;k++){
      const r0=83-d-k/count,r1=83-d-(k+1)/count;
      const a=wallPoint(left,r0),b=wallPoint(right,r0),nextA=wallPoint(left,r1),nextB=wallPoint(right,r1);
      const c={...nextA,y:a.y},e={...nextB,y:a.y};
      plate([a,b,e,c],palette[(d+k)%4]);plate([c,e,nextB,nextA],'#6a7066');
      plate([a,c,addHeight(nextA,-.32),addHeight(a,-.32)],'#666c63');
      plate([b,e,addHeight(nextB,-.32),addHeight(b,-.32)],'#817d6e');
      if (count>1) rod(c,e,.022,'#c6b58b');
    }
    for (const side of [left,right]) {
      const a=wallPoint(side,83-d),b=wallPoint(side,82-d);
      rod(addHeight(a,.63),addHeight(b,.63),.037,'#a78b62');
      rod(addHeight(a,.30),addHeight(b,.30),.021,'#485957');
      if(d%2===0)rod(a,addHeight(a,.69),.055,'#53605a');
      if(side===right)rod(addHeight(a,-.20),addHeight(b,-.20),.048,'#80d8d0',true);
      if(d%5===0) {
        const norm=Math.hypot(a.x,a.z);
        const support=d<20 ? {...a,y:-.66} : {x:a.x*(1-3.3/norm),y:a.y-2.0,z:a.z*(1-3.3/norm)};
        rod(addHeight(a,-.13),support,.13,'#525f58');
      }
    }
  }
  // The royal entrance occupies a real open bay of the lowest colonnade.
  const gateY=3.45, left=wallPoint(.15,gateY), right=wallPoint(5.85,gateY);
  const mid={x:(left.x+right.x)/2,y:left.y,z:(left.z+right.z)/2},hx=(right.x-left.x)/2,hz=(right.z-left.z)/2;
  for(const p of [left,right]) {
    rod(p,addHeight(p,2.15),.18,'#bdb396'); rod(addHeight(p,.38),addHeight(p,1.5),.072,'#80d8d0',true);
  }
  const arch=(a:number,rad:number)=>({x:mid.x+hx*Math.cos(a)*rad,y:mid.y+2.06+1.46*Math.sin(a)*rad,z:mid.z+hz*Math.cos(a)*rad});
  for(let k=0;k<17;k++){
    const a=k*Math.PI/17+.009,b=(k+1)*Math.PI/17-.009;
    plate([arch(a,1),arch(b,1),arch(b,1.23),arch(a,1.23)],k===8?'#c49755':'#cebd97');
  }
  // Open bronze leaves fold into the depth of the bay, clear of the walkable sill.
  for (const col of [.35,5.65]) {
    const front=wallPoint(col,gateY), back=wallPoint(col,1.05);
    plate([addHeight(front,.10),addHeight(back,.10),addHeight(back,2.28),addHeight(front,2.28)],'#486661');
    for(const y of [.26,1.14,2.08])rod(addHeight(front,y),addHeight(back,y),.064,'#b48f5c');
    rod(addHeight(front,.10),addHeight(front,2.31),.064,'#b98f5e');
    const lamp=wallPoint(col,gateY+.36);
    rod(addHeight(lamp,1.32),addHeight(lamp,1.75),.10,'#f2ca80',true);
  }
  const a=wallPoint(.43,gateY),b=wallPoint(5.57,gateY);
  rod(addHeight(a,.035),addHeight(b,.035),.036,'#c7a65c');
  return baked=faces;
}

export function wallPulse(index:number,phase:number) {
  const row = 1 + ((index + phase) % 10) * 8.2;
  const p = wallPoint(3+halfWidth(83-row)+.5, row);
  return { ...p, y:p.y-.16 };
}
