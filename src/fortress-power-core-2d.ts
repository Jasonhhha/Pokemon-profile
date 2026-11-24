import { drawPressureThrone } from './fortress-pressure-throne-2d';
import type { FortressInteriorFrame } from './field-fortress-state';
import { nominalPower } from './fortress-power';
import { collectorArc, outletFlow, pointOnPowerLine, powerBranches, type PowerPoint } from './fortress-power-paths';
import type { RasterPaint, Screen, Vertex } from './fortress-raster-space';
const vertex = ([x,y,z]: PowerPoint): Vertex => [x,z,y];
const arc = Array.from({ length: 49 }, (_, i) => collectorArc(i / 48));
const rail = Array.from({ length: 49 }, (_, i) => collectorArc(i / 48, 1));

export function drawPowerCore(frame: FortressInteriorFrame, paint: RasterPaint, crystals?: readonly Screen[]) {
  const { stroke, plate, ctx } = paint, power = frame.power ?? nominalPower;
  const conductor = (points: PowerPoint[], level: number, width: number, start: number, span: number, crystal?: Screen) => {
    const origin = paint.point(...vertex(points[0]));
    const dx = crystal ? crystal.x - origin.x : 0, dy = crystal ? crystal.y - origin.y : 0;
    const segment = (from: number, to: number, ink: string, weight: number) => {
      const samples = Math.max(2, Math.ceil((to - from) * (points.length - 1) * (crystal ? 3 : 1)));
      ctx.beginPath();
      for (let i = 0; i <= samples; i++) {
        const t = from + (to - from) * i / samples;
        const p = paint.point(...vertex(pointOnPowerLine(points, t)));
        const falloff = (1 - t) ** 2, x = p.x + dx * falloff, y = p.y + dy * falloff;
        if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
      }
      ctx.strokeStyle = ink; ctx.lineWidth = Math.max(.65, paint.scale * weight); ctx.stroke();
    };
    segment(0, 1, `rgba(93,225,208,${.14 + level * .80})`, width);
    if (!frame.reduced) {
      const t = (power.phase - start + 1) % 1 / span;
      if (t <= 1) segment(Math.max(0, t - .10), t, `rgba(221,255,225,${level * .90})`, width * 1.55);
    }
  };
  ctx.save(); ctx.lineJoin='round'; ctx.lineCap='round';
  drawPressureThrone(frame, paint);
  conductor(outletFlow, power.bus, .115, .80, .20);
  stroke(rail.map(vertex),'#27373e',.24); stroke(arc.map(vertex),'#504734',.32); stroke(arc.map(vertex),'#b39362',.18);
  for (let i=0;i<=24;i++) stroke([vertex(collectorArc(i/24)),vertex(collectorArc(i/24,1))],i%3?'#455253':'#c1bea4',i%3?.082:.17);
  for(const t of [.10,.26,.42,.58,.74,.90]) {
    stroke([vertex(collectorArc(t-.016)),vertex(collectorArc(t+.016))],'#343d40',.40);
    for(const d of [-.013,.013])stroke([vertex(collectorArc(t+d)),vertex(collectorArc(t+d,1))],'#b1976a',.11);
  }
  conductor(arc,power.bus,.061,.42,.55);
  for (const [index, { gate, stream, upper }] of powerBranches.entries()) {
    const [x,y,z]=gate;
    plate(x-.24,z-.22,.48,.44,-.58,y+.29,'#a3855e','#4b4b45','#343e40');
    for(let i=0;i<5;i++) {
      const h=-.3+i*.32;plate(x-.31,z-.29,.62,.58,h,h+.12,'#b7ad91',i%2?'#898a7a':'#977246','#525b58');
    }
    stroke(upper.map(vertex),'#26373b',.36);stroke(upper.map(vertex),'#756955',.26);
    conductor(upper,power.bus,.083,.42,.38);
    for(const t of [.12,.29,.47,.63,.77]){
      const [px,py,pz]=pointOnPowerLine(upper,t);plate(px-.22,pz-.18,.44,.36,py-.05,py+.05,'#b08c5a','#846b4b','#6a604d');
    }
    conductor(stream, power.source, .070, 0, .42, crystals?.[index]);
  }
  ctx.restore();
}
