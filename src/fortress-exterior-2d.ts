import { harborHeight } from './field-city-layout';
import { ringAngle, ringRadius } from './field-ring-coordinates';
import type { FortressView } from './field-fortress-state';

type Ground = { x: number; z: number };
type Screen = { x: number; y: number };
type Project = (ground: Ground, altitude?: number) => Screen;

export const bastionRadius = ringRadius(harborHeight + 1);
const gateBearing = ringAngle(3.5);
const turn = Math.PI * 2;
const radial = (bearing: number, radius: number): Ground => ({ x: Math.sin(bearing) * radius, z: Math.cos(bearing) * radius });
const noise = (key: number) => { const n = Math.sin(key * 78.41 + .65) * 43541.78; return n - Math.floor(n); };

export function drawBastionSea(ctx: CanvasRenderingContext2D, project: Project, size: number, lift: number, time: number, night: boolean) {
  if (lift < .005) return;
  const sea = -.58 - 4.8 * lift;
  const origin = project({x:0,z:0}, sea);
  const tint = ctx.createLinearGradient(0, 0, 0, ctx.canvas.height);
  tint.addColorStop(0, night ? '#233d52' : '#6d9ead');
  tint.addColorStop(.48, night ? '#1c3d50' : '#427d93');
  tint.addColorStop(1, night ? '#183445' : '#23546c');
  ctx.fillStyle = tint;
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  for (let i = 0; i < 560; i++) {
    const bearing = i * 2.39996, r = bastionRadius + .3 + 52 * noise(i);
    const ground = radial(bearing, r);
    const p = project(ground, sea);
    if (p.x < -size || p.x > ctx.canvas.width + size || p.y < -1 || p.y > ctx.canvas.height+1) continue;
    const phase = Math.sin(time / 1420 + r * .63 + i * .85);
    const width = size * (.25 + .7 * noise(i+438)) * (1 + phase * .2);
    ctx.beginPath();ctx.moveTo(p.x-width*.45,p.y);
    ctx.quadraticCurveTo(p.x,p.y+size*.035,p.x+width*.55,p.y-size*.016);
    const glint = p.x > origin.x + size * 3;
    ctx.strokeStyle = glint ? '#bed6cf60' : '#b2d5d02e';
    ctx.lineWidth = Math.max(.6, size * .023);ctx.stroke();
  }
}

export function drawRasterBastion(
  ctx: CanvasRenderingContext2D, project: Project, yaw: number, size: number, flatten: number,
  fortress: FortressView, time: number, night: boolean,
) {
  if (!fortress || fortress.lift < .005) return;
  const sea = -.58 - 4.8 * fortress.lift;
  const radius = bastionRadius;
  const nod = (bearing: number, altitude: number, inset = 0) => project(radial(bearing, radius + inset), altitude);
  const polygon = (points: Screen[], color: string) => {
    ctx.beginPath();
    points.forEach((point, i) => i ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y));
    ctx.closePath(); ctx.fillStyle = color; ctx.fill();
  };
  const face = (bearing: number, a: number, b: number, lo: number, hi: number, color: string, offset = 0) => {
    if (hi <= Math.max(lo, sea)) return;
    const start = bearing + a / radius, end = bearing + b / radius;
    polygon([nod(start, Math.max(lo, sea), offset), nod(end, Math.max(lo, sea), offset),
      nod(end, hi, offset), nod(start, hi, offset)], color);
  };
  const pan = time / 1000;
  const front = (a: number) => Math.cos(a - yaw) > 0;
  const shades = night ? ['#273f4a','#324c54','#294954','#36555b'] : ['#667c78','#6e837c','#758780','#617871'];
  const dark = night ? '#132d38' : '#344c4b', lip = night ? '#718482' : '#b1afa0';
  const water = night ? '#509398' : '#95d5ce';
  const flow = fortress.phase === 'open' ? 0 : Math.min(1, Math.max(0, (fortress.lift - .27) * 1.55)) * (1 - fortress.drain ** 1.7);
  const segments = 96;
  const half = Math.PI * radius / segments;
  const body = Array.from({ length: segments }, (_, i) => gateBearing + i * turn / segments)
    .filter(front).sort((a,b) => Math.cos(a-yaw) - Math.cos(b-yaw));

  for (const bearing of body) {
    const index = Math.round((bearing - gateBearing) * segments / turn);
    face(bearing, -half, half + .015, sea, -.034, shades[index % shades.length]);
    for (let row = 1; row <= 9; row++) {
      const top = -.46 * row;
      face(bearing, -half, half, top-.028, top, dark);
      face(bearing, row % 2 ? -.006 : -half, row % 2 ? .025 : -half+.03, top-.45, top, dark);
    }
    face(bearing, -half, half + .016, sea, Math.min(-.36, sea + .33), night ? '#2a5659' : '#597e72');
    face(bearing, -half, half + .016, -.60,-.47, lip, .044);
    face(bearing, -half, half + .016, -.33, -.05, dark, .035);
    face(bearing, -half, half + .016, -.16, -.035, lip, .06);
    if(index%6===0 && index!==0){
      face(bearing,-.18,.18,sea,-.41,lip,.13);
      face(bearing,-.23,.23,-1.12,-.79,'#938576',.18);
      face(bearing,-.27,.27,-.83,-.69,lip,.18);
      face(bearing,-.22,.22,-4.26,-4.13,dark,.17);
    }else if(index%3===1){
      face(bearing,-.14,.14,-2.65,-1.56,dark,.06);
      face(bearing,-.21,.21,-1.61,-1.51,lip,.09);
    }
    const damp = noise(index+351);
    face(bearing,.32,.32+.07*damp,-3.15-.90*damp,-1.39,night?'#254549':'#5a726b',.017);
  }

  const mouth = (bearing: number, halfWidth: number, base: number, spring: number, opening: number, main=false) => {
    if (!front(bearing) || spring + halfWidth <= sea) return;
    const arch = (r: number) => {
      const foot = Math.max(sea, base);
      return [nod(bearing-r/radius, foot, .085), ...Array.from({length:17},(_,i) => {
        const a = Math.PI - Math.PI*i/16;
        return nod(bearing + r * Math.cos(a) / radius, Math.max(sea, spring + r * Math.sin(a)), .085);
      }), nod(bearing+r/radius, foot, .085)];
    };
    polygon(arch(halfWidth + .17), lip);
    polygon(arch(halfWidth), '#152c36');
    if(main){
      for(const sign of [-1,1]){
        const x=sign*(halfWidth+.45);
        face(bearing,x-.13,x+.13,-3.05,-2.50,dark,.11);
        face(bearing,x-.079,x+.079,-2.89,-2.56,night?'#f5d388':'#ebbd7e',.13);
        face(bearing,x-.16,x+.16,-2.55,-2.44,lip,.14);
      }
      if(opening>.15){
        const back=halfWidth*.61;
        const floorY=Math.max(base,sea);
        polygon([nod(bearing-halfWidth/radius,floorY,.11),nod(bearing+halfWidth/radius,floorY,.11),
          nod(bearing+back/radius,floorY+.71,.11),nod(bearing-back/radius,floorY+.71,.11)],'#4a6466');
        for(const sign of [-1,1]){
          const x=sign*halfWidth*.65;
          face(bearing,x-.025,x+.025,base+.67,spring+.15,'#547376',.105);
          face(bearing,x-.048,x+.048,spring-.33,spring-.19,'#97cec5',.11);
        }
      }
    }
    const gateTop = spring + halfWidth;
    const gateBottom = Math.max(sea, base + (gateTop - base) * opening);
    for (let rib = -3; rib <= 3; rib++) {
      const side = halfWidth * rib / 3.6;
      face(bearing, side-.030, side+.030, gateBottom, spring+Math.sqrt(halfWidth**2-side**2)-.05, '#687971', .10);
    }
    for(let i=1;i<8;i++){
      const a=i*Math.PI/8, q=nod(bearing+Math.cos(a)*halfWidth/radius,spring+Math.sin(a)*halfWidth,.091);
      const p=nod(bearing+Math.cos(a)*(halfWidth+.17)/radius,spring+Math.sin(a)*(halfWidth+.17),.091);
      if(spring+Math.sin(a)*halfWidth<sea)continue;
      ctx.beginPath();ctx.moveTo(q.x,q.y);ctx.lineTo(p.x,p.y);ctx.strokeStyle=dark;ctx.lineWidth=Math.max(.6,size*.035);ctx.stroke();
    }
  };
  mouth(gateBearing, 1.29, -4.85, -2.36, Math.max(0, (fortress.drain - .80) * 5),true);
  for (let outlet = 0; outlet < 8; outlet++) {
    const bearing = gateBearing + (outlet + .5) * turn / 8;
    mouth(bearing, .56, -2.30, -1.97, .60 * flow);
    if (flow < .015 || sea >= -1.85) continue;
    const span = (1.1 + 3.30 * flow) * Math.sqrt(Math.min(1,(Math.abs(sea)-1.79)/3.59));
    const width = .50 * Math.sqrt(flow);
    const shot = (t: number, offset: number) => {
      const spread = offset * (.78 + t * .72);
      return project(radial(bearing + spread / radius, radius + .08 + span*t), -1.86 - (-1.86-sea)*t*t);
    };
    for (let strip=0;strip<6;strip++) {
      const a = width*(strip/3-1), b = width*((strip+1)/3-1);
      const points = Array.from({length:10},(_,i) => shot(i/9,a));
      points.push(...Array.from({length:10},(_,i) => shot(1-i/9,b)));
      polygon(points, [water,'#68b8bd','#bbdfd4','#85c4cd','#66aeb8','#d1e9de'][strip]);
    }
    for (let jet=0;jet<12;jet++) {
      const t = (pan * (.58+jet%3*.046) + jet*.127 + outlet*.31) % 1;
      const offset = Math.sin(jet*9.14)*width;
      const a=shot(t,offset), b=shot(Math.max(0,t-.095),offset);
      ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.strokeStyle='#e1fbf1c2';ctx.lineWidth=Math.max(.6,size*.028);ctx.stroke();
    }
    const impact = radial(bearing, radius+span+.08);
    const end=project(impact,sea);
    for (let i=0;i<3;i++) {
      const age=(pan*.74+i/3)%1, w=(.43+1.02*age)*size*flow;
      ctx.beginPath(); ctx.ellipse(end.x,end.y,Math.max(.01,w),Math.max(.01,w*flatten),0,0,turn);
      ctx.lineWidth=Math.max(.65,size*.041);ctx.strokeStyle='rgba(194,239,226,'+(.70*(1-age))+')';ctx.stroke();
    }
  }
}
