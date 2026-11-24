import type { RoomId } from './field-layout';

function polygon(ctx: CanvasRenderingContext2D, color: string, points: readonly [number, number][]) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(...points[0]);
  for (let i = 1; i < points.length; i++) ctx.lineTo(...points[i]);
  ctx.closePath();
  ctx.fill();
}

/** The archive looks out on the wharf, the market across the roofs, and the signal room over the viaduct. */
export function paintCityWindow(ctx: CanvasRenderingContext2D, room: RoomId, night: boolean, x: number, y: number, width: number, height: number) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, width, height);
  ctx.clip();
  ctx.translate(x, y);
  ctx.scale(width / 256, height / 256);
  const sky = ctx.createLinearGradient(0, 0, 0, 190);
  sky.addColorStop(0, night ? '#293c61' : '#7fa8b2');
  sky.addColorStop(1, night ? '#858397' : '#ded1a9');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, 256, 256);
  if (night) {
    ctx.fillStyle = '#e8dcb7';
    for (let i = 0; i < 26; i++) ctx.fillRect((i * 163 + 29) % 251, (i * 43 + i * i * 3) % 112 + 7, i % 4 ? 1.3 : 2.1, 1.4);
    ctx.beginPath();
    ctx.arc(197, 42, 8.5, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillStyle = '#e7dfc6a3';
    for (const [cx, cy, rx] of [[45,45,43], [175,71,34], [235,30,23]]) {
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, 5, 0, 0, 2 * Math.PI);
      ctx.fill();
    }
  }
  const distant = night ? '#4a566c' : '#869c99';
  for (let bay = 0; bay < 12; bay++) {
    const left = bay * 23 - 6, top = 123 + (bay * 29) % 21;
    ctx.fillStyle = distant;
    ctx.fillRect(left, top, 24, 64);
    polygon(ctx, distant, [[left-2,top],[left+10,top-10],[left+25,top]]);
    ctx.fillRect(left + 16, top - 9, 3, 10);
  }
  const stone = night ? '#647073' : '#c5b797';
  const roof = night ? '#3e4e5b' : '#687e7a';
  const clockX = room === 'home' ? 65 : room === 'lab' ? 172 : 105;
  ctx.fillStyle = stone;
  ctx.fillRect(clockX - 10, 87, 20, 63);
  ctx.fillRect(clockX - 13, 83, 26, 6);
  polygon(ctx, roof, [[clockX-14,83],[clockX-9,70],[clockX-3,67],[clockX,60],[clockX+3,67],[clockX+9,70],[clockX+14,83]]);
  ctx.fillStyle = roof;
  ctx.fillRect(clockX - .8, 52, 1.6, 12);
  ctx.fillStyle = night ? '#f1c777' : '#eee0b6';
  ctx.beginPath();
  ctx.arc(clockX, 96, 5, 0, 2 * Math.PI);
  ctx.fill();
  ctx.fillStyle = '#58656b';
  ctx.fillRect(clockX, 92, 1, 4);
  ctx.fillRect(clockX - 2, 96, 3, 1);
  if (room === 'lab') {
    for (let bay = 0; bay < 6; bay++) {
      const left = bay * 49 - 8, top = 155 + (bay * 13) % 24;
      ctx.fillStyle = night ? '#59545b' : bay % 2 ? '#aa826b' : '#b5a78b';
      ctx.fillRect(left, top, 50, 105);
      polygon(ctx, roof, [[left-2,top],[left+11,top-19],[left+34,top-19],[left+51,top]]);
      ctx.fillStyle = night ? '#555564' : '#947564';
      ctx.fillRect(left + 28, top - 30, 6, 18);
      for (let level = 0; level < 3; level++) for (let col = 0; col < 3; col++) {
        ctx.fillStyle = night && (bay + col + level) % 3 ? '#d7b579' : '#526c71';
        ctx.fillRect(left + 5 + col * 14, top + 10 + level * 22, 6, 12);
      }
    }
  } else {
    const water = ctx.createLinearGradient(0, 155, 0, 256);
    water.addColorStop(0, night ? '#566d79' : '#9cb7a5');
    water.addColorStop(1, night ? '#334d63' : '#5a8f8e');
    ctx.fillStyle = water;
    ctx.fillRect(0, 156, 256, 100);
    ctx.fillStyle = night ? '#79878d' : '#bed0ba';
    for (let i = 0; i < 31; i++) ctx.fillRect((i * 73) % 245, 163 + (i * 19) % 86, 3 + i % 8, 1);
    if (room === 'tower') {
      ctx.fillStyle = night ? '#475458' : '#77857e';
      ctx.fillRect(0, 139, 256, 7);
      ctx.fillRect(0, 134, 256, 2);
      for (let pier = 0; pier < 6; pier++) {
        const left = pier * 52 - 8;
        ctx.fillRect(left, 145, 6, 36);
        polygon(ctx, night ? '#586361' : '#8e9787', [[left,145],[left+20,145],[left+6,159],[left,159]]);
      }
    } else {
      polygon(ctx, roof, [[138,196],[169,194],[162,202],[144,202]]);
      polygon(ctx, night ? '#bebbaa' : '#eee0bc', [[153,164],[153,193],[139,193]]);
    }
  }
  ctx.restore();
}
