import type { FortressInteriorFrame } from './field-fortress-state';
import type { Screen, RasterPaint, Vertex } from './fortress-raster-space';
import { nominalPower } from './fortress-power';
import { sealVolume } from './fortress-portals';
import { createGovernorDrive, governorPose, pressAxis, pressureThroneGeometry, thronePalette, type ThroneFace } from './fortress-pressure-throne';
import type { PowerPoint } from './fortress-power-paths';

const tones = Object.fromEntries(Object.entries(thronePalette).map(([key, hex]) => {
  const rgb = parseInt(hex.slice(1), 16);
  return [key, [rgb >> 16, (rgb >> 8) & 255, rgb & 255]];
}));
const drives = new WeakMap<CanvasRenderingContext2D, ReturnType<typeof createGovernorDrive>>();
let heelReflections: ThroneFace[] | undefined;
const iceBoundary = Array.from({ length: 55 }, (_, i): Vertex => {
  const angle = Math.PI * 2 * i / 54;
  return [sealVolume.x + 4.87 * Math.cos(angle), sealVolume.z + 4.87 * Math.sin(angle), -.61];
});
type Panel = { points: Screen[]; color: string; depth: number };

export function drawPressureThrone(frame: FortressInteriorFrame, paint: RasterPaint) {
  const { ctx, point } = paint;
  const { pressureCheeks, lowerGovernor, upperGovernor } = pressureThroneGeometry();
  heelReflections ??= pressureCheeks.filter(({ center, normal, finish }) => center[1] > -.43 && center[1] < 2.12 &&
  center[2] > sealVolume.z - .74 && normal[2] > .55 && (finish === 'bronze' || finish === 'patina' || finish === 'basalt'));
  const power = frame.power ?? nominalPower;
  let drive = drives.get(ctx);
  if (!drive) { drive = createGovernorDrive(); drives.set(ctx, drive); }
  const motion = drive(frame.now, power.bus, frame.reduced);
  const panels: Panel[] = [];
  const project = ([x, h, z]: PowerPoint) => point(x, z, h);
  // Frost scatters the reflected faces beyond each iron heel. The bridge deck stays dry.
  ctx.save();
  paint.path(iceBoundary); ctx.closePath(); ctx.clip();
  for (const side of [-1, 1]) {
    paint.groundGlow(sealVolume.x + side * 4.46, sealVolume.z + .60, .80, .88, '#1b34436b', -.61);
    paint.groundGlow(sealVolume.x + side * 4.71, sealVolume.z - 1.10, .87, 1.05, '#17333f81', -.61);
  }
  for (const facet of heelReflections) {
    ctx.globalAlpha = .13 * Math.max(.22, 1 - (facet.center[1] + .62) / 3.1);
    paint.face(facet.points.map(([x, h, z]) => [x, z, -1.24 - h]), thronePalette[facet.finish]);
  }
  ctx.restore();
  const eyePitch = frame.inspecting ? .57 : .91, eyeYaw = frame.inspecting ? -.13 : .075;
  const depth = ([x, h, z]: PowerPoint) => z + x * eyeYaw + h * eyePitch;
  function surface(face: ThroneFace, transform?: (v: PowerPoint) => PowerPoint, sin = 0, cos = 1) {
    const world = transform ? face.points.map(transform) : face.points;
    const points = world.map(project);
    const [a, b, c] = points;
    if ((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x) >= -.015) return;
    const [nx, ny, nz] = face.normal;
    const x = nx * cos + nz * sin, z = nz * cos - nx * sin;
    const light = .74 + Math.max(0, -.32 * x + .79 * ny + .45 * z) * .44;
    const [r, g, blue] = tones[face.finish];
    panels.push({ points, color: `rgb(${Math.round(r * light)},${Math.round(g * light)},${Math.round(blue * light)})`,
      depth: depth(transform ? transform(face.center) : face.center) });
  }
  for (const shell of pressureCheeks) surface(shell);
  for (const ring of [lowerGovernor, upperGovernor]) {
    const pose = governorPose(motion.phase, motion.lift, ring === upperGovernor);
    const c = Math.cos(pose.angle), s = Math.sin(pose.angle);
    const transform = ([x, h, z]: PowerPoint): PowerPoint => [pressAxis.x + x * c + z * s, pose.elevation + h, pressAxis.z + z * c - x * s];
    for (const part of ring) surface(part, transform, s, c);
  }
  panels.sort((a, b) => a.depth - b.depth);
  for (const panel of panels) {
    ctx.beginPath();
    panel.points.forEach((vertex, i) => i ? ctx.lineTo(vertex.x, vertex.y) : ctx.moveTo(vertex.x, vertex.y));
    ctx.closePath(); ctx.fillStyle = panel.color; ctx.fill();
  }
}
