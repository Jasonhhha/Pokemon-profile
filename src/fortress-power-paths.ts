import { sealVolume as cell } from './fortress-portals';

export type PowerPoint = [x: number, elevation: number, z: number];
const { x, y, z, width, height, depth } = cell;
export function collectorArc(t: number, lane = 0): PowerPoint {
  const a = Math.PI * (.015 + .97 * t);
  return [x + width * 1.105 * Math.cos(a), y + .55 + height * 1.055 * Math.sin(a), z - depth * (.23 + lane * .1)];
}
export const powerBranches = ([-1, 1] as const).map(side => {
  const gate = collectorArc(side === 1 ? .052 : .948);
  const shoulder: PowerPoint = [x + side * width * .29, y + height * .45, z - depth * .09];
  const stream: PowerPoint[] = [shoulder, [x + side * width * .55, y + height * .53, z - depth * .14],
    [x + side * width * .84, y + height * .39, z - depth * .23], gate];
  // Both mains follow the raised cheeks before turning into the single exhaust shaft.
  const channel: PowerPoint[] = [[4.90, 1.65, -.75], [4.54, 2.45, -1.31], [3.95, 2.93, -1.64],
    [3.08, 3.17, -1.96], [2.07, 3.30, -2.17], [1.19, 3.40, -2.43], [.83, 3.49, -2.72],
    [.42, 3.56, -2.92], [0, 3.66, -3.10]];
  const upper: PowerPoint[] = [gate, ...channel.map(([r, h, d]): PowerPoint => [x + side * r, h, z + d])];
  return { side, gate, stream, upper };
});

export const outletFlow: PowerPoint[] = [[x, 3.66, z - 3.10], [x, 4.13, z - 3.10],
  [x, 4.62, z - 3.10], [x, 5.46, z - 3.10], [x, 6.31, z - 3.10], [x, 7.28, z - 3.10]];

export function pointOnPowerLine(points: PowerPoint[], fraction: number): PowerPoint {
  const along = Math.min(1, Math.max(0, fraction)) * (points.length - 1);
  const index = Math.min(points.length - 2, Math.floor(along)), f = along - index, a = points[index], b = points[index + 1];
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
}
