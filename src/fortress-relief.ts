import { CanvasTexture, MeshStandardMaterial, PlaneGeometry, SRGBColorSpace } from 'three';

// A shallow carved shell and a band of water. One height field supplies both the stone pigment and the relief.
export function createWaterRelief() {
  const size = 256,
    carving = document.createElement('canvas');
  carving.width = carving.height = size;
  const brush = carving.getContext('2d')!;
  brush.fillStyle = '#828282';
  brush.fillRect(0, 0, size, size);
  brush.lineCap = 'round';
  brush.lineJoin = 'round';
  const trace = (draw: (pen: CanvasRenderingContext2D) => void, width: number) => {
    brush.beginPath();
    draw(brush);
    brush.strokeStyle = '#404040';
    brush.lineWidth = width + 3.4;
    brush.stroke();
    brush.strokeStyle = '#ababab';
    brush.lineWidth = width;
    brush.stroke();
  };
  for (const margin of [9, 16])
    trace(p => p.rect(margin, margin, size - margin * 2, size - margin * 2), margin === 9 ? 4 : 2);
  trace(p => {
    p.moveTo(36, 184);
    p.quadraticCurveTo(33, 65, 128, 37);
    p.quadraticCurveTo(223, 65, 220, 184);
  }, 4.6);
  for (let i = 0; i <= 12; i++) {
    const a = -Math.PI * 0.92 + (Math.PI * 0.84 * i) / 12;
    const x = 128 + Math.cos(a) * 83,
      y = 164 + Math.sin(a) * 98;
    trace(
      p => {
        p.moveTo(128, 174);
        p.quadraticCurveTo(128 + (x - 128) * 0.42 + (i - 6) * 2, 139 + (i % 2) * 5, x, y);
      },
      i % 2 ? 2.7 : 4.2,
    );
  }
  trace(p => p.arc(128, 174, 14, Math.PI, 0), 3.8);
  for (const y of [195, 213])
    trace(p => {
      p.moveTo(28, y);
      for (let i = 0; i < 5; i++) {
        p.bezierCurveTo(40 + i * 40, y - 12, 52 + i * 40, y - 12, 58 + i * 40, y);
        p.quadraticCurveTo(63 + i * 40, y + 6, 68 + i * 40, y);
      }
    }, 3.5);
  for (const x of [31, 225]) for (const y of [31, 225]) trace(p => p.arc(x, y, 4, 0, Math.PI * 2), 1.8);
  const height = brush.getImageData(0, 0, size, size);
  const stone = document.createElement('canvas');
  stone.width = stone.height = size;
  const ctx = stone.getContext('2d')!,
    color = ctx.createImageData(size, size);
  let seed = 573;
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) | 0;
      const n = (seed >>> 0) / 4294967296 - 0.5;
      const i = (y * size + x) * 4,
        h = height.data[i];
      const cut = (h - 127) * 0.67,
        north = x > 0 && y > 0 ? height.data[i - size * 4 - 4] : h;
      const edge = (h - north) * 0.49;
      const mottling = 5 * Math.sin(x * 0.096 + Math.sin(y * 0.051)) + 3 * Math.cos(y * 0.104 + x * 0.073);
      const moss = 5 * Math.max(0, Math.sin(x * 0.043 - y * 0.035));
      const tone = 167 + cut + edge + 17 * n + mottling;
      color.data[i] = tone + 9 - moss;
      color.data[i + 1] = tone + 4;
      color.data[i + 2] = tone - 12 - moss;
      color.data[i + 3] = 255;
    }
  ctx.putImageData(color, 0, 0);
  const diffuse = new CanvasTexture(stone),
    bump = new CanvasTexture(carving);
  diffuse.colorSpace = SRGBColorSpace;
  const geometry = new PlaneGeometry(1, 1, 74, 83);
  const points = geometry.attributes.position,
    uv = geometry.attributes.uv;
  for (let i = 0; i < points.count; i++) {
    const x = Math.round(uv.getX(i) * (size - 1)),
      y = Math.round((1 - uv.getY(i)) * (size - 1));
    points.setZ(i, (height.data[(y * size + x) * 4] - 128) * 0.0006);
  }
  geometry.computeVertexNormals();
  const material = new MeshStandardMaterial({ map: diffuse, bumpMap: bump, bumpScale: 0.035, roughness: 0.72 });
  return {
    material,
    geometry,
    dispose() {
      material.dispose();
      diffuse.dispose();
      bump.dispose();
    },
  };
}
