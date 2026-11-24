import {
  gateFinishes,
  gatehouseFabric,
  gateLightwells,
  gatePointerVertices,
  type GateFace,
  type GateVertex,
} from './fortress-palace-gatehouse';
import type { RasterPaint } from './fortress-raster-space';

const cache = new WeakMap<
  CanvasRenderingContext2D,
  { canvas: HTMLCanvasElement; x: number; y: number; gain: number }
>();

function pigment(face: GateFace) {
  const base = parseInt(gateFinishes[face.finish].slice(1), 16);
  const [a, b, c] = face.vertices,
    dx = b[0] - a[0],
    dz = b[1] - a[1],
    dh = b[2] - a[2],
    ex = c[0] - a[0],
    ez = c[1] - a[1],
    eh = c[2] - a[2];
  const nx = Math.abs(dh * ez - dz * eh),
    ny = Math.abs(dz * ex - dx * ez),
    nz = Math.abs(dx * eh - dh * ex),
    length = Math.hypot(nx, ny, nz) || 1;
  const light =
    face.finish === 'light' || face.finish === 'opal'
      ? 1.16
      : face.tint * (0.68 + (0.19 * nx + 0.05 * ny + 0.31 * nz) / length);
  const channel = (shift: number) => Math.min(255, Math.max(0, Math.round(((base >> shift) & 255) * light)));
  return `rgb(${channel(16)},${channel(8)},${channel(0)})`;
}

function indexMasonry() {
  const corners: GateVertex[] = [];
  const ids = new Map<string, number>();
  const panels = gatehouseFabric().map((face) => ({
    color: pigment(face),
    detail: face.detail,
    indices: face.vertices.map((vertex) => {
      const key = vertex.map((value) => Math.round(value * 1000)).join('/');
      let id = ids.get(key);
      if (id === undefined) {
        id = corners.length;
        ids.set(key, id);
        corners.push(vertex);
      }
      return id;
    }),
  }));
  return {
    corners,
    panels,
    compact: panels.filter((face) => !face.detail),
    x: new Float32Array(corners.length),
    y: new Float32Array(corners.length),
    clip: new Uint8Array(corners.length),
  };
}
let masonry: ReturnType<typeof indexMasonry> | undefined;

export function drawPalaceGatehouse(paint: RasterPaint, load = 0.78) {
  const { ctx, point } = paint,
    width = ctx.canvas.width,
    height = ctx.canvas.height;
  const origin = point(8.5, 0, 7.13),
    near = point(8.5, 13, 7.13),
    gain = near.y - origin.y;
  const old = cache.get(ctx);
  if (
    old &&
    old.canvas.width === width &&
    old.canvas.height === height &&
    old.x === origin.x &&
    old.y === origin.y &&
    old.gain === gain
  ) {
    ctx.drawImage(old.canvas, 0, 0);
    paint.face(gatePointerVertices(load), '#e4c48d');
    return;
  }
  const sheet = old?.canvas ?? document.createElement('canvas');
  if (sheet.width !== width) sheet.width = width;
  if (sheet.height !== height) sheet.height = height;
  const ink = sheet.getContext('2d')!;
  ink.clearRect(0, 0, width, height);
  const mesh = (masonry ??= indexMasonry());
  for (let i = 0; i < mesh.corners.length; i++) {
    const p = point(...mesh.corners[i]);
    mesh.x[i] = p.x;
    mesh.y[i] = p.y;
    mesh.clip[i] = (p.x < -0.5 ? 1 : p.x > width + 0.5 ? 2 : 0) | (p.y < -0.5 ? 4 : p.y > height + 0.5 ? 8 : 0);
  }
  for (const panel of width < 550 ? mesh.compact : mesh.panels) {
    const indices = panel.indices;
    let outside = mesh.clip[indices[0]];
    for (let i = 1; outside && i < indices.length; i++) outside &= mesh.clip[indices[i]];
    if (outside) continue;
    ink.beginPath();
    const first = indices[0];
    ink.moveTo(mesh.x[first], mesh.y[first]);
    for (let i = 1; i < indices.length; i++) {
      const id = indices[i];
      ink.lineTo(mesh.x[id], mesh.y[id]);
    }
    ink.closePath();
    ink.fillStyle = panel.color;
    ink.fill();
  }
  for (const well of gateLightwells) {
    for (let i = 0; i < 3; i++) {
      const off = (i - 1) * 0.195;
      const top = point(well.x + off, well.z + 0.27, well.h + 0.48);
      const base = point(well.waterX + off * 2.3, well.waterZ, well.waterHeight);
      const left = point(well.waterX + off * 2.3 - 0.4, well.waterZ, well.waterHeight);
      const width = Math.abs(left.x - base.x),
        dy = base.y - top.y;
      const fade = ink.createLinearGradient(top.x, top.y, base.x, base.y);
      fade.addColorStop(0, 'rgba(200,231,212,0)');
      fade.addColorStop(0.19, 'rgba(200,231,212,.068)');
      fade.addColorStop(0.68, 'rgba(178,218,204,.04)');
      fade.addColorStop(1, 'rgba(178,218,204,0)');
      ink.fillStyle = fade;
      ink.beginPath();
      ink.moveTo(top.x - 1, top.y);
      ink.lineTo(top.x + 1, top.y);
      ink.lineTo(base.x + width, top.y + dy);
      ink.lineTo(base.x - width, top.y + dy);
      ink.closePath();
      ink.fill();
    }
  }
  cache.set(ctx, { canvas: sheet, x: origin.x, y: origin.y, gain });
  ctx.drawImage(sheet, 0, 0);
  paint.face(gatePointerVertices(load), '#e4c48d');
}
