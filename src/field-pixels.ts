export type Point = [x: number, y: number];

export function box(ctx: CanvasRenderingContext2D, color: string, x: number, y: number, w: number, h = 1) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

// Draw diagonal contours on the pixel grid without introducing translucent edge pixels.
export function polygon(ctx: CanvasRenderingContext2D, color: string, points: Point[]) {
  const min = Math.min(...points.map(([, y]) => y));
  const max = Math.max(...points.map(([, y]) => y));
  ctx.fillStyle = color;
  for (let y = min; y < max; y++) {
    const scan = y + .5;
    const intersections = points.flatMap(([x1, y1], index) => {
      const [x2, y2] = points[(index + 1) % points.length];
      if (scan < Math.min(y1, y2) || scan >= Math.max(y1, y2)) return [];
      return [x1 + (scan - y1) * (x2 - x1) / (y2 - y1)];
    }).sort((a, b) => a - b);
    for (let index = 0; index < intersections.length; index += 2) {
      const start = Math.round(intersections[index]);
      const end = Math.round(intersections[index + 1]);
      ctx.fillRect(start, y, end - start, 1);
    }
  }
}
