import type { FortressInteriorFrame } from './field-fortress-state';
import type { Layer, Projection, RasterPaint } from './fortress-raster-space';
import { riserCrest, riserOutput, riserSites, type RiserRoom } from './fortress-risers';

export function addRiserLayers(layers: Layer[], frame: FortressInteriorFrame, room: RiserRoom, cam: Projection, p: RasterPaint) {
  const site = riserSites[room], z = site.z, power = riserOutput(frame, room);
  for (const side of [-1, 1]) {
    const x = site.center + side * site.spread;
    const base = cam.point(x, z, .1);
    if (base.x < -p.scale || base.x > p.ctx.canvas.width + p.scale || z > frame.y + 7) continue;
    layers.push({ z: room === 'sluice' ? z : cam.depth(x, z), draw() {
      p.plate(x - .55, z - .55, 1.1, 1.1, -.88, .41, '#66807c', '#43595b', '#2e4045');
      p.stroke([[x,z,.36], [x,z,site.height]], '#38474b', .58);
      p.stroke([[x,z,.4], [x,z,site.height]], `rgb(${31+Math.round(34*power)} ${65+Math.round(100*power)} ${71+Math.round(83*power)})`, .36);
      for (const dx of [-.275,.275]) p.stroke([[x+dx,z,.4],[x+dx,z,site.height]],'#8d8064',.067);
      for (let h=.85; h<site.height; h+=.75) {
        p.stroke([[x-.345,z,h],[x+.345,z,h]], '#736b58', .13);
        const crest = riserCrest(frame.power?.phase ?? .45, room, h, frame.reduced);
        p.stroke([[x-.25,z,h+.12],[x+.25,z,h+.12]],`rgba(165,249,227,${.11+power*(.18+.7*crest)})`,.086);
      }
      p.plate(x-.51,z-.51,1.02,1.02,site.height-.2,site.height+.2,'#647b78','#4c5d5d','#38494b');
    } });
  }
}
