import {palaceElevation} from './fortress-maze';
import { hallSupport } from './fortress-portals';
import type { FortressInteriorFrame } from './field-fortress-state';
import { loop, noise, type RasterPaint } from './fortress-raster-space';
import { createWetFootfalls, palacePuddles, rippleLife, rippleReach, soleLife } from './fortress-wet-ground';

const tracks = new WeakMap<CanvasRenderingContext2D, ReturnType<typeof createWetFootfalls>>();

export function drawWetGround2D(frame: FortressInteriorFrame, paint: RasterPaint) {
  const { ctx, point, path, face, stroke, scale } = paint;
  const seal = frame.room === 'seal';
  const { width, height } = ctx.canvas;
  for (const [i, pool] of palacePuddles[frame.room].entries()) {
    const { x, z, w, d, outline } = pool;
    const center = point(x, z),
      margin = scale * Math.max(w, d) * 1.5;
    if (center.x < -margin || center.y < -margin || center.x > width + margin || center.y > height + margin) continue;
    const left = point(x - w, z),
      right = point(x + w, z);
    const sheen = ctx.createLinearGradient(left.x, left.y, right.x, right.y);
    sheen.addColorStop(0, seal ? '#698899a8' : '#3b5f668c');
    sheen.addColorStop(0.36, seal ? '#8da9b4bf' : '#567b7ca6');
    sheen.addColorStop(0.6, seal ? '#c7d6d7b3' : '#9ba99b98');
    sheen.addColorStop(1, seal ? '#617f91ad' : '#335661a3');
    face(outline, sheen);
    stroke(outline.slice(2, 18), '#b5cfc48f', 0.019);
    ctx.save();
    path(outline);
    ctx.clip();
    for (let j = 0; j < 4; j++) {
      const dz = (noise(i * 7 + j) - 0.5) * d,
        glint = x - w * 0.16 + j * 0.07;
      stroke(
        [
          [glint, z + dz, 0.028],
          [glint + 0.08 + noise(j + i) * 0.2, z + dz, 0.028],
        ],
        '#c2c7b06c',
        0.017,
      );
    }
    ctx.restore();
  }

  let trail = tracks.get(ctx);
  if (!trail) {
    trail = createWetFootfalls();
    tracks.set(ctx, trail);
  }
  trail.advance(frame);
  const now = frame.now * 0.001;
  for (const mark of trail.marks) {
    const seconds = now - mark.at;
    if (mark.pool) {
      if (seconds < 0 || seconds >= rippleLife) continue;
      const age = seconds / rippleLife,
        front = 0.1 + age * 0.82;
      ctx.save();
      path(mark.pool.outline);
      ctx.clip();
      const wave = (radius: number, strength: number) => {
        const vertices = loop(mark.x, mark.z, radius * rippleReach, radius * rippleReach, 0.034, 24);
        stroke([...vertices, vertices[0]], 'rgba(172,210,200,' + 0.76 * (1 - age) * strength + ')', 0.022);
      };
      wave(front, 1);
      if (age > 0.22) wave(front - 0.18, Math.min(1, (age - 0.22) / 0.19) * 0.4);
      ctx.restore();
    } else if (seconds >= 0 && seconds < soleLife) {
      const c = Math.cos(mark.bearing),
        s = Math.sin(mark.bearing);
      const floor = frame.room === 'sluice' || frame.room === 'seal' ? hallSupport(frame.room, mark.x, mark.z) : palaceElevation(frame.room,mark.x,mark.z);
      const toe = (offset: number, radius: number, length: number) => {
        const vertices = loop(0, offset, radius, length, floor + 0.034, 16);
        for (const v of vertices) {
          const [x, z] = v;
          v[0] = mark.x + c * x - s * z;
          v[1] = mark.z + s * x + c * z;
        }
        face(vertices, 'rgba(22,46,49,' + 0.65 * mark.strength * (1 - seconds / soleLife) + ')');
      };
      toe(-0.035, 0.075, 0.096);
      toe(0.077, 0.058, 0.054);
    }
  }
}
