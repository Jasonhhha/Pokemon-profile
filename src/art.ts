import type { RegionId } from './world';

export const WORLD_WIDTH = 896;
export const WORLD_HEIGHT = 608;
export const TILE = 32;

const trainer = [
  '.....kkkkkk.....', '....krrrrrrk....', '...krrrrrrrrk...', '...kwwwwrrrrrk..',
  '..kwwwwwrrrrrrk.', '..kkkkkkkkkkkk..', '...khsssshhk....', '...ksksksksk....',
  '....ksssssk.....', '....kksskk......', '...kbwrrwbk.....', '..ksbwrrwbsk....',
  '..ksbbrrbbsk....', '...kbbbbbbk.....', '....kddddk......', '....kdkkdk......',
  '...kkk..kkk.....', '...kkk..kkk.....',
];
const colors: Record<string, string> = { k: '#293f49', r: '#db4d55', w: '#fff8e6', h: '#594545', s: '#f5c48d', b: '#4486ab', d: '#374858' };

export function drawTrainer(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number, direction = 'down', step = 0) {
  const rows = direction === 'up' ? trainer.map((row, i) => i > 5 && i < 10 ? row.replaceAll('s', 'h').replaceAll('k', 'h') : row) : trainer;
  rows.forEach((row, ry) => [...row].forEach((cell, rx) => {
    if (!colors[cell]) return;
    ctx.fillStyle = colors[cell];
    ctx.fillRect(x + rx * scale, y + (ry + (ry > 14 ? rx < 8 ? step : -step : 0)) * scale, scale, scale);
  }));
}
export type WaterArea = { x: number; y: number; w: number; h: number };
export type WorldArt = { canvas: HTMLCanvasElement; grid: number[][]; water: WaterArea[]; lamps: { x: number; y: number }[] };

export function makeWorld(region: RegionId = 'twinleaf'): WorldArt {
  const canvas = document.createElement('canvas');
  canvas.width = WORLD_WIDTH; canvas.height = WORLD_HEIGHT;
  const c = canvas.getContext('2d')!;
  c.imageSmoothingEnabled = false;
  const grid = Array.from({ length: 19 }, () => Array<number>(28).fill(0));
  const water: WaterArea[] = [], lamps: { x: number; y: number }[] = [];
  let seed = 2447;
  const random = () => { seed = seed * 16807 % 2147483647; return (seed - 1) / 2147483646; };
  const rect = (x: number, y: number, w: number, h: number, color: string) => {
    c.fillStyle = color; c.fillRect(Math.round(x / 2) * 2, Math.round(y / 2) * 2, w, h);
  };
  // Art and collision footprints share coordinates, including the walkable dock and stairs.
  const solid = (x: number, y: number, w: number, h: number, value = 1) => {
    for (let ty = 0; ty < 19; ty++) for (let tx = 0; tx < 28; tx++) {
      if (tx * TILE + 16 >= x && tx * TILE + 16 < x + w && ty * TILE + 16 >= y && ty * TILE + 16 < y + h) grid[ty][tx] = value;
    }
  };
  const snow = region === 'coronet';
  rect(0, 0, 896, 608, snow ? '#dfebe6' : '#83bb79');
  for (let y = 0; y < 608; y += 16) for (let x = 0; x < 896; x += 16) {
    const n = random();
    if (n < .46) continue;
    const xx = x + Math.floor(random() * 6) * 2, yy = y + Math.floor(random() * 6) * 2;
    rect(xx, yy, 4, 2, snow ? '#c3d7d5' : '#6eaa69');
    if (n > .75) { rect(xx + 2, yy - 2, 2, 4, snow ? '#c3d7d5' : '#6eaa69'); rect(xx + 6, yy + 4, 4, 2, snow ? '#f6faf0' : '#a1ce89'); }
  }
  const path = (x: number, y: number, w: number, h: number, stone = false) => {
    rect(x - 4, y - 4, w + 8, h + 8, stone ? '#a8babc' : '#61955f');
    rect(x - 2, y - 2, w + 4, h + 4, stone ? '#d5dcd4' : '#c9d3a0');
    rect(x, y, w, h, stone ? '#b9c8c5' : '#e2d7a2');
    for (let yy = y + 4; yy < y + h - 4; yy += stone ? 16 : 12) for (let xx = x + 4; xx < x + w - 6; xx += stone ? 32 : 18) {
      if (stone) { rect(xx, yy + 10, 26, 2, '#9faeae'); rect(xx + 24, yy, 2, 10, '#e3e9df'); }
      else if (random() > .48) { rect(xx, yy, 4, 2, '#c3bb88'); rect(xx + 4, yy + 2, 2, 2, '#f0e6b8'); }
    }
  };
  const tree = (x: number, y: number, frosted = snow) => {
    rect(x + 8, y + 68, 48, 10, frosted ? '#b1c8c6' : '#629b66');
    rect(x + 26, y + 52, 12, 26, '#536155'); rect(x + 28, y + 56, 4, 18, '#b1916b');
    for (const [dx, dy, w, h] of [[24, 0, 16, 16], [16, 10, 32, 18], [8, 24, 48, 20], [0, 42, 64, 20], [8, 62, 48, 8]]) {
      rect(x + dx + 2, y + dy, w - 4, h, '#2c6051'); rect(x + dx, y + dy + 4, w, h - 8, '#2c6051');
      rect(x + dx + 4, y + dy + 2, w - 8, h - 6, '#428763');
      rect(x + dx + 6, y + dy + 2, Math.max(4, w / 2 - 6), 4, '#68a374');
      rect(x + dx + 4, y + dy + 6, Math.max(4, w / 2 - 8), 4, '#55966b');
      for (let leaf = 6; leaf < w - 6; leaf += 10) {
        const ly = leaf % 3 * 2;
        rect(x + dx + leaf, y + dy + 8 + ly, 4, 2, '#72a978');
        rect(x + dx + leaf + 2, y + dy + 10 + ly, 2, 4, '#347455');
      }
      if (frosted) { rect(x + dx + 4, y + dy, w - 8, 4, '#eff5e9'); rect(x + dx + 4, y + dy + 4, Math.max(8, w / 2), 4, '#d5e5dc'); }
    }
    rect(x + 20, y + 32, 4, 6, '#8dbb82'); rect(x + 10, y + 52, 6, 4, '#81b57a');
    solid(x + 4, y + 32, 56, 44);
  };
  const flowers = (x: number, y: number, cols: number, rows = 2) => {
    rect(x - 4, y + 4, cols * 16 + 6, rows * 16 + 4, '#70a66b');
    for (let row = 0; row < rows; row++) for (let col = 0; col < cols; col++) {
      const xx = x + col * 16, yy = y + row * 16, pink = (row + col) % 3 !== 0;
      rect(xx + 4, yy + 8, 2, 6, '#367c54'); rect(xx, yy + 10, 4, 2, '#438f5a');
      rect(xx + 2, yy, 6, 10, pink ? '#d77085' : '#f3e6ab'); rect(xx, yy + 2, 10, 6, pink ? '#f394a0' : '#fff2c4'); rect(xx + 4, yy + 4, 2, 2, '#fff8df');
    }
  };
  const tallGrass = (x: number, y: number, w: number, h: number) => {
    rect(x, y, w, h, '#599663');
    for (let yy = y; yy < y + h; yy += 16) for (let xx = x; xx < x + w; xx += 16) {
      rect(xx + 2, yy + 10, 12, 4, '#366e4e'); rect(xx + 2, yy + 2, 2, 10, '#8dc47b'); rect(xx + 6, yy + 6, 4, 8, '#72b275'); rect(xx + 12, yy, 2, 12, '#a3ce80');
    }
  };
  const rock = (x: number, y: number, w = 40) => {
    rect(x + 4, y + 12, w, 22, '#617b7c'); rect(x + 10, y + 4, w - 12, 30, '#8da6a2'); rect(x + 14, y, w - 24, 6, '#c9d4c6');
    rect(x + 8, y + 10, 12, 6, '#b7c6ba'); rect(x + w - 12, y + 16, 8, 16, '#738e8c');
    rect(x + 14, y + 20, 8, 2, '#728e8c'); rect(x + 20, y + 22, 2, 8, '#728e8c'); rect(x + 10, y + 30, 8, 2, '#a6b9ae');
    if (snow) rect(x + 10, y + 2, w - 14, 6, '#f6f7ec');
    solid(x + 4, y + 8, w, 28);
  };
  const lake = (x: number, y: number, w: number, h: number) => {
    rect(x + 16, y - 10, w - 32, h + 20, '#4e8970'); rect(x - 10, y + 16, w + 20, h - 32, '#4e8970');
    rect(x + 8, y - 4, w - 16, h + 8, '#bdd4a0'); rect(x - 4, y + 8, w + 8, h - 16, '#d9dfab');
    rect(x, y + 16, w, h - 32, '#31889b'); rect(x + 16, y, w - 32, h, '#31889b');
    rect(x + 16, y + 8, w - 32, h - 16, '#439fab'); rect(x + 8, y + 20, w - 16, h - 40, '#439fab');
    rect(x + 32, y + 30, w - 64, h - 60, '#4ba9b1');
    for (let yy = y + 26; yy < y + h - 18; yy += 22) for (let xx = x + 22; xx < x + w - 24; xx += 38) {
      rect(xx, yy, 12, 2, '#76c2c3'); rect(xx + 8, yy - 2, 10, 2, '#88cfca');
    }
    rect(x + 16, y + 6, w - 32, 2, '#a9ded1'); rect(x + 4, y + 20, 2, h - 40, '#b9e3cf');
    water.push({ x: x + 24, y: y + 24, w: w - 48, h: h - 48 }); solid(x, y, w, h);
  };
  const fence = (x: number, y: number, width: number) => {
    rect(x, y + 8, width, 4, '#8a825e'); rect(x, y + 18, width, 4, '#b3a985');
    for (let xx = x; xx <= x + width; xx += 24) { rect(xx, y, 6, 28, '#6b745a'); rect(xx, y, 4, 24, '#f1edd4'); rect(xx, y - 2, 4, 2, '#ffffff'); }
    solid(x, y, width, 24);
  };
  const lamp = (x: number, y: number) => {
    rect(x - 6, y + 34, 14, 6, '#5b7167'); rect(x - 2, y, 4, 36, '#526965');
    rect(x - 8, y - 18, 16, 20, '#45615e'); rect(x - 4, y - 14, 8, 12, '#fce8a6'); rect(x - 10, y - 20, 20, 4, '#365853');
    lamps.push({ x, y: y - 8 }); solid(x - 8, y + 24, 16, 16);
  };
  const building = (x: number, y: number, w: number, lab = false) => {
    const roof = lab ? ['#395e72', '#6195a8', '#83b6bf'] : ['#88494d', '#c96565', '#e8907d'];
    rect(x + 6, y + 132, w + 6, 18, '#5c9564'); rect(x + 10, y + 56, w - 20, 88, '#5a6f65'); rect(x + 14, y + 56, w - 28, 80, '#f4ebce');
    rect(x + 14, y + 70, w - 28, 12, '#c6c9b2'); rect(x + 14, y + 130, w - 28, 8, '#bab9a2');
    for (let yy = y + 86; yy < y + 130; yy += 12) rect(x + 14, yy, w - 28, 2, '#dedac0');
    for (const xx of [x + 26, x + w - 56]) {
      rect(xx - 4, y + 86, 36, 38, '#79958c'); rect(xx, y + 88, 28, 30, '#41859c');
      rect(xx + 2, y + 90, 10, 12, '#a4d5d6'); rect(xx + 18, y + 92, 6, 6, '#80b9c2'); rect(xx + 12, y + 88, 4, 30, '#f4f0db'); rect(xx, y + 102, 28, 4, '#f4f0db');
      rect(xx - 4, y + 120, 36, 4, '#f7efd6'); rect(xx - 2, y + 124, 32, 4, '#9d9f88');
      rect(xx, y + 118, 28, 4, '#527655');
      for (let petal = 2; petal < 26; petal += 8) { rect(xx + petal, y + 114, 4, 4, lab ? '#a1cce2' : '#ec8b98'); rect(xx + petal, y + 114, 2, 2, '#fff1c1'); }
    }
    const dx = x + w / 2 - 16;
    rect(dx - 4, y + 94, 40, 44, '#b59577'); rect(dx, y + 98, 32, 40, '#395b62'); rect(dx + 4, y + 102, 24, 20, '#6493a0'); rect(dx + 22, y + 126, 4, 4, '#f8d88c');
    rect(dx - 6, y + 138, 44, 6, '#dce2cc'); rect(dx - 10, y + 144, 52, 4, '#acb49e');
    for (let row = 0; row < 8; row++) {
      const inset = (7 - row) * 6;
      rect(x + inset - 2, y + row * 8, w - inset * 2 + 4, 10, roof[0]);
      rect(x + inset + 2, y + row * 8, w - inset * 2 - 4, 4, roof[2]); rect(x + inset + 2, y + row * 8 + 4, w - inset * 2 - 4, 3, roof[1]);
      for (let xx = x + inset + 12 + row % 2 * 12; xx < x + w - inset; xx += 24) rect(xx, y + row * 8, 2, 6, roof[0]);
    }
    rect(x - 4, y + 66, w + 8, 6, roof[0]); rect(x - 2, y + 72, w + 4, 4, '#f8f2da');
    rect(x + 48, y - 4, w - 96, 4, roof[0]); rect(x + 50, y - 6, w - 100, 2, roof[2]);
    if (lab) { rect(x + w - 42, y - 28, 4, 26, '#5c7879'); rect(x + w - 54, y - 26, 28, 2, '#5c7879'); rect(x + w / 2 - 14, y + 78, 28, 12, '#adc5ba'); rect(x + w / 2 - 2, y + 80, 4, 8, '#5c8d88'); }
    else { rect(x + w - 46, y - 12, 18, 28, '#9b6058'); rect(x + w - 48, y - 16, 22, 6, '#d6977f'); }
    solid(x, y, w, 138);
  };
  const cave = (x: number, y: number, w = 80) => {
    rect(x - 12, y + 16, w + 24, 48, '#667e83'); rect(x, y, w, 64, '#91a7a7'); rect(x + 12, y - 8, w - 24, 16, '#b6c6bf');
    rect(x + 12, y + 16, w - 24, 48, '#304e57'); rect(x + 22, y + 8, w - 44, 56, '#304e57');
    rect(x + 20, y + 26, w - 40, 38, '#223c48'); rect(x + 4, y + 8, 12, 8, '#d2dad0'); rect(x - 4, y + 40, 8, 18, '#9cadaa');
    rect(x + 10, y + 4, 8, 2, '#718b90'); rect(x + 18, y + 6, 2, 8, '#718b90');
    rect(x + w - 14, y + 18, 8, 2, '#617f86'); rect(x + w - 8, y + 20, 2, 12, '#617f86');
    rect(x + w - 12, y + 32, 6, 2, '#617f86'); rect(x + 4, y + 36, 4, 2, '#cad7cd');
    rect(x + 14, y + 60, w - 28, 4, '#a5b3a5'); solid(x - 12, y - 8, w + 24, 68);
  };

  if (region === 'twinleaf') {
    path(96, 324, 704, 64); path(432, 96, 64, 512); path(240, 260, 64, 96); path(624, 260, 64, 96); path(496, 384, 120, 64);
    rect(380, 128, 168, 144, '#a5c488'); rect(384, 132, 160, 136, '#bcd69a'); path(432, 126, 64, 148);
    rect(430, 184, 70, 60, '#5c8279'); rect(426, 192, 78, 44, '#d4dec9'); rect(434, 182, 62, 64, '#d4dec9');
    rect(438, 190, 54, 48, '#69a7b0'); rect(444, 196, 42, 36, '#418b9b'); rect(458, 198, 12, 24, '#dcebdd'); rect(454, 192, 20, 6, '#f9f8e5'); solid(426, 182, 78, 64);
    // Twinleaf is the starter village: one home, a central plaza and open route.
    building(176, 144, 184);
    flowers(560, 170, 4, 3); flowers(616, 242, 2, 2);
    fence(176, 304, 48); fence(320, 304, 56); fence(552, 304, 56); fence(704, 304, 64);
    flowers(154, 250, 1, 3); flowers(374, 258, 2); flowers(526, 260, 1, 3); flowers(780, 254, 2);
    flowers(370, 164, 2, 3); flowers(514, 164, 2, 3); tallGrass(144, 416, 160, 96); flowers(332, 426, 3, 3);
    lake(716, 416, 112, 104);
    for (let x = 562; x < 670; x += 28) { rect(x, 466, 22, 24, '#b2bda3'); rect(x + 2, 468, 18, 4, '#e2e6c9'); }
    for (const [x, y] of [[108, 196], [78, 406], [314, 476], [592, 474], [762, 120], [62, 128]]) tree(x, y);
    lamp(404, 294); lamp(718, 340);
  } else if (region === 'verity') {
    path(96, 416, 704, 64); path(128, 128, 64, 352); path(704, 128, 64, 352); path(416, 448, 64, 160);
    lake(224, 128, 448, 256);
    // A compact field station belongs beside the lake, not in Twinleaf Town.
    building(606, 320, 190, true);
    rect(408, 204, 120, 98, '#337e87'); rect(416, 200, 104, 84, '#c5d5a4'); rect(428, 194, 80, 80, '#80a87a'); cave(434, 208, 64);
    rect(462, 354, 68, 78, '#5c6554'); rect(466, 352, 60, 76, '#c3a777');
    for (let yy = 354; yy < 428; yy += 10) { rect(466, yy, 60, 2, '#876e54'); rect(470, yy + 2, 52, 2, '#e1c596'); }
    rect(460, 350, 6, 88, '#f0d4a3'); rect(526, 350, 6, 88, '#f0d4a3'); solid(464, 352, 64, 80, 0);
    for (const [x, y] of [[60, 124], [62, 200], [54, 330], [78, 460], [748, 160], [782, 250], [740, 470], [310, 486], [562, 472]]) tree(x, y);
    flowers(190, 470, 5, 2); flowers(600, 486, 4, 2); tallGrass(106, 272, 90, 80);
    rock(624, 476); rock(686, 362, 24); lamp(564, 408);
    rect(136, 394, 74, 8, '#7b6c53'); rect(136, 376, 74, 14, '#c3a475'); rect(142, 376, 4, 40, '#5f6955'); rect(200, 376, 4, 40, '#5f6955'); solid(136, 376, 74, 40);
  } else {
    // Mt. Coronet summit: a high alpine plateau above the cloud line.
    rect(0, 0, 896, 608, '#b9d2d6');
    rect(0, 0, 896, 210, '#86b4c0');
    for (let i = 0; i < 18; i++) {
      const cx = (i * 97) % 896; const cy = 78 + (i % 4) * 28;
      rect(cx, cy, 150, 22, '#dce9e7'); rect(cx + 22, cy - 10, 92, 14, '#e8f1ec');
    }
    // Distant peaks frame the summit platform.
    for (const [x, y, w, h] of [[24, 122, 190, 116], [170, 96, 230, 142], [368, 66, 260, 172], [596, 108, 250, 132]] as const) {
      rect(x, y + h - 12, w, 12, '#78949d'); rect(x + 18, y + 18, w - 36, h - 20, '#91adb1');
      rect(x + w / 2 - 24, y, 48, 18, '#f6f7ed'); rect(x + w / 2 - 54, y + 18, 108, 12, '#e6f0e9');
    }
    // Snow rim and broad stone summit.
    path(104, 264, 688, 278, true); path(404, 168, 88, 116, true);
    rect(148, 286, 600, 224, '#8ba4a8'); rect(164, 302, 568, 192, '#b8c9c7');
    for (let yy = 318; yy < 486; yy += 28) for (let xx = 178; xx < 720; xx += 52) {
      rect(xx, yy, 34, 3, '#91abad'); rect(xx + 8, yy + 8, 20, 2, '#dce5dc');
    }
    rect(120, 276, 656, 14, '#f1f5eb'); rect(142, 290, 612, 8, '#d4e4dc');
    // Peak shrine and signal beacon.
    cave(408, 184, 80);
    rect(430, 112, 44, 64, '#5d777c'); rect(434, 108, 36, 8, '#eef5e9'); rect(438, 122, 28, 42, '#c5d8d2');
    rect(444, 132, 16, 24, '#507d84'); rect(447, 136, 10, 16, '#b8e0df');
    rect(392, 168, 80, 8, '#dbe9df'); rect(400, 176, 64, 6, '#9eb8b8'); solid(424, 112, 56, 72, 1);
    // Wind worn ridges and summit markers.
    for (const [x, y] of [[188, 334], [648, 342], [238, 432], [594, 444], [344, 372], [514, 398]]) rock(x, y, 34);
    lamp(250, 300); lamp(642, 300);
    solid(430, 112, 56, 72, 1);
  }
  for (let x = -20; x < 896; x += 54) tree(x, -26);
  for (let x = -42; x < 896; x += 60) tree(x, 20);
  for (let y = 86; y < 550; y += 62) { tree(-30, y); tree(850, y); }
  for (let x = -18; x < 896; x += 58) if (x < 360 || x > 510) tree(x, 548);
  solid(0, 0, 896, 80); solid(0, 0, 48, 608); solid(848, 0, 48, 608); solid(0, 592, 896, 16);
  return { canvas, grid, water, lamps };
}

export function drawYixuan(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number) {
  // A readable 20x24 front-facing feminine trainer with distinct hair, face,
  // bow, blouse, skirt, arms and shoes.
  ctx.imageSmoothingEnabled = false;
  const px = (left: number, top: number, width: number, height: number, color: string) => {
    ctx.fillStyle = color;
    ctx.fillRect(x + left * scale, y + top * scale, width * scale, height * scale);
  };
  const outline = '#4b3448';
  const hairDark = '#b9578d';
  const hair = '#dc82b2';
  const hairLight = '#f2afd0';
  const skin = '#f3b99f';
  const skinLight = '#ffd9bd';
  const dress = '#f095ba';
  const dressLight = '#ffc0d7';
  const cream = '#fff1e7';
  const shoe = '#704b6e';
  const eye = '#513447';

  // Back hair and long side locks.
  px(6, 0, 8, 1, outline); px(4, 1, 12, 1, outline); px(2, 2, 16, 2, outline);
  px(1, 4, 18, 7, outline); px(0, 6, 3, 11, outline); px(17, 6, 3, 11, outline);
  px(6, 1, 8, 1, hair); px(4, 2, 12, 4, hair); px(3, 4, 14, 5, hair);
  px(1, 6, 2, 10, hairDark); px(17, 6, 2, 11, hairDark);
  px(4, 2, 4, 1, hairLight); px(12, 2, 4, 1, hairLight);
  px(2, 9, 1, 5, hair); px(17, 10, 1, 5, hair);

  // Pink bow and face.
  px(1, 2, 3, 3, dress); px(2, 3, 2, 2, dressLight); px(16, 2, 3, 3, dress); px(16, 3, 2, 2, dressLight); px(9, 3, 2, 2, dress);
  px(5, 5, 10, 8, outline); px(6, 6, 8, 6, skin); px(7, 6, 6, 1, skinLight);
  px(6, 5, 3, 2, hairDark); px(11, 5, 3, 2, hairDark);
  px(7, 8, 1, 1, eye); px(12, 8, 1, 1, eye); px(6, 9, 2, 1, '#df8195'); px(12, 9, 2, 1, '#df8195'); px(9, 10, 2, 1, '#bd6680');

  // Blouse, arms, skirt and shoes.
  px(9, 12, 2, 1, skin); px(6, 11, 8, 5, outline); px(7, 12, 6, 4, cream);
  px(7, 12, 6, 1, dressLight); px(4, 12, 3, 5, outline); px(13, 12, 3, 5, outline);
  px(5, 13, 2, 3, dress); px(13, 13, 2, 3, dress); px(5, 16, 2, 1, skin); px(13, 16, 2, 1, skin);
  px(5, 15, 10, 6, outline); px(6, 16, 8, 4, dress); px(5, 18, 10, 2, dressLight); px(7, 15, 6, 1, hairLight);
  px(7, 20, 3, 3, outline); px(11, 20, 3, 3, outline); px(8, 20, 1, 2, skin); px(12, 20, 1, 2, skin);
  px(6, 23, 4, 1, shoe); px(11, 23, 4, 1, shoe); px(15, 14, 3, 5, outline); px(16, 15, 1, 3, dress);
}
