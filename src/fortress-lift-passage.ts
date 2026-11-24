type Passage = { fraction: number; down: boolean };
const smooth = (x: number) => {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
};

export function drawLiftPassage(ctx: CanvasRenderingContext2D, passage: Passage, reduced: boolean) {
  const { width: w, height: h } = ctx.canvas, p = passage.fraction;
  const cover = smooth(p / .30) * smooth((1 - p) / .32);
  ctx.save();
  ctx.globalAlpha = cover;
  ctx.fillStyle = '#17292b';
  ctx.fillRect(0, 0, w, h);
  if (!reduced) {
    const step = h / 4.6;
    const offset = smooth(p) * 6.4 * step * (passage.down ? -1 : 1);
    for (let i = -8; i < 15; i++) {
      const y = i * step + offset;
      if (y < -step || y > h) continue;
      ctx.fillStyle = i % 2 ? '#273a39' : '#2b3c39';
      ctx.fillRect(0, y + 2, w, step - 4);
      ctx.fillStyle = '#1c2e30';
      for (let j = -1; j < 5; j++) ctx.fillRect((j + (i % 2) * .5) * w * .24, y, 3, step);
      ctx.fillStyle = '#719a8b';
      ctx.fillRect(w * .149, y + step * .38, w * .018, Math.max(1, h * .005));
    }
    for (const x of [w * .11, w * .87]) {
      ctx.fillStyle = '#101e22'; ctx.fillRect(x, 0, w * .019, h);
      ctx.fillStyle = '#907b52'; ctx.fillRect(x + w * .003, 0, w * .005, h);
    }
    const lantern = ctx.createLinearGradient(0,0,w,0);
    lantern.addColorStop(0,'#061319b8');lantern.addColorStop(.32,'#06131900');lantern.addColorStop(.68,'#06131900');lantern.addColorStop(1,'#061319b8');
    ctx.fillStyle = lantern; ctx.fillRect(0,0,w,h);
  }
  ctx.restore();
}
