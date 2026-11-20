import { TILE, type FieldArea, type FieldMap, type RoomId } from './field-layout';
import { box, polygon, type Point } from './field-pixels';
import { noise, textureGround, type GroundMaterial } from './field-texture';

export type { RoomId } from './field-layout';
type Destination = 'about' | 'projects' | 'contact';
type FurnitureKind = 'bookshelf' | 'archive' | 'stove' | 'settee' | 'plant' | 'workbench' | 'server' | 'samples' | 'telescope' | 'radio' | 'batteries';
type Fixture = { kind: FurnitureKind; x: number; y: number; width: number; depth?: number };
type RoomPlan = {
  name: string;
  english: string;
  area: FieldArea;
  left: number;
  right: number;
  exterior: { x: number; y: number };
  npc: FieldMap['npcs'][number] & { event: Destination };
  furniture: readonly Fixture[];
};

const width = 24;
const height = 16;
const doorX = 12;
const startY = 13;
const exitY = 14;

export const plans = {
  home: {
    name: '潮汐档案屋',
    english: 'Tidal Archive',
    area: 'harbor',
    left: 4,
    right: 19,
    exterior: { x: 10, y: 10 },
    npc: { event: 'about', x: 12, y: 7, name: '禹浩', style: 'researcher', solid: true },
    furniture: [
      { kind: 'bookshelf', x: 6, y: 5, width: 3 },
      { kind: 'archive', x: 12, y: 6, width: 3 },
      { kind: 'stove', x: 17, y: 5, width: 3 },
      { kind: 'settee', x: 7, y: 10, width: 3 },
      { kind: 'plant', x: 17, y: 10, width: 1 },
    ],
  },
  lab: {
    name: '雾杉观测室',
    english: 'Mistpine Laboratory',
    area: 'grove',
    left: 3,
    right: 20,
    exterior: { x: 10, y: 10 },
    npc: { event: 'projects', x: 14, y: 7, name: '观测站研究员', style: 'researcher', solid: true },
    furniture: [
      { kind: 'bookshelf', x: 5, y: 5, width: 3 },
      { kind: 'server', x: 9, y: 5, width: 2 },
      { kind: 'workbench', x: 14, y: 6, width: 4 },
      { kind: 'samples', x: 8, y: 9, width: 3, depth: 2 },
      { kind: 'server', x: 19, y: 9, width: 2 },
      { kind: 'plant', x: 17, y: 11, width: 1 },
    ],
  },
  tower: {
    name: '风语天文台',
    english: 'Whisper Observatory',
    area: 'summit',
    left: 4,
    right: 19,
    exterior: { x: 12, y: 10 },
    npc: { event: 'contact', x: 10, y: 7, name: '信号站守望员', style: 'keeper', solid: true },
    furniture: [
      { kind: 'radio', x: 9, y: 6, width: 4 },
      { kind: 'telescope', x: 16, y: 7, width: 3, depth: 2 },
      { kind: 'batteries', x: 6, y: 11, width: 2 },
      { kind: 'bookshelf', x: 17, y: 11, width: 3 },
    ],
  },
} as const satisfies Record<RoomId, RoomPlan>;

type Room = Pick<RoomPlan, 'name' | 'english' | 'area' | 'exterior'> & {
  map: FieldMap;
  destination: Destination;
};

function floorAt(plan: RoomPlan, x: number, y: number) {
  if (plan.area === 'summit' && (y === 5 || y === startY) && (x === plan.left || x === plan.right)) return false;
  return y >= 5 && y <= startY && x >= plan.left && x <= plan.right;
}

function makeRoom(plan: RoomPlan): Room {
  const { area, exterior, name, english, npc, furniture } = plan;
  const walkable = Array.from({ length: height }, (_, y) => Array.from({ length: width }, (_, x) => {
    if (x === doorX && y === exitY) return true;
    if (!floorAt(plan, x, y)) return false;
    return !furniture.some(fixture => {
      const left = fixture.x - Math.floor((fixture.width - 1) / 2);
      return x >= left && x < left + fixture.width && y <= fixture.y && y > fixture.y - (fixture.depth ?? 1);
    });
  }));
  return {
    area, exterior, name, english, destination: npc.event,
    map: {
      width, height,
      spawn: { x: doorX, y: startY },
      walkable,
      grass: walkable.map(row => row.map(() => false)),
      npcs: [npc],
      exits: [{ x: doorX, y: exitY, side: 'bottom', to: { area, x: exterior.x, y: exterior.y + 1 } }],
    },
  };
}

export const rooms: Record<RoomId, Room> = {
  home: makeRoom(plans.home),
  lab: makeRoom(plans.lab),
  tower: makeRoom(plans.tower),
};

const roomColors = {
  home: {
    void: '#20282a', wall: '#b69371', wallLight: '#d1b390', wallDark: '#866a58', trim: '#66534c',
    floor: ['#b38a62', '#bd946e', '#a8805b'], seam: '#906d53', gleam: '#cba47b',
    rug: '#89695b', rugLight: '#c8ab79', rugDark: '#705747',
  },
  lab: {
    void: '#17292d', wall: '#718782', wallLight: '#92a19a', wallDark: '#5d726f', trim: '#455759',
    floor: ['#90a096', '#84958e', '#9aa69a'], seam: '#6a7e79', gleam: '#b4beb1',
    rug: '#547d79', rugLight: '#97b3a1', rugDark: '#456866',
  },
  tower: {
    void: '#202638', wall: '#828392', wallLight: '#a39ba1', wallDark: '#646b85', trim: '#4d5369',
    floor: ['#9693a2', '#878897', '#a59ca9'], seam: '#737589', gleam: '#c0b3bc',
    rug: '#66627b', rugLight: '#c1ac98', rugDark: '#554e68',
  },
};
type RoomColors = typeof roomColors.home;

function surface(w: number, h: number) {
  const image = document.createElement('canvas');
  image.width = w;
  image.height = h;
  const draw = image.getContext('2d')!;
  draw.imageSmoothingEnabled = false;
  return { image, draw };
}

function floorboards(ctx: CanvasRenderingContext2D, plan: RoomPlan, pal: RoomColors) {
  const left = plan.left * TILE;
  const right = (plan.right + 1) * TILE;
  const top = 5 * TILE;
  const bottom = (startY + 1) * TILE;
  box(ctx, pal.floor[0], left, top, right - left, bottom - top);
  const oak = plan.area === 'harbor';
  const band = oak ? 7 : 10;
  const span = oak ? 32 : 21;
  for (let y = top; y < bottom; y += band) {
    const h = Math.min(band, bottom - y);
    const stagger = (Math.floor(y / band) % 2) * Math.floor(span / 2);
    for (let x = left - stagger; x < right; x += span) {
      const tone = noise(x, y, 2);
      const start = Math.max(left, x);
      const w = Math.min(right, x + span) - start;
      box(ctx, pal.floor[Math.floor(tone * 3)], start, y, w, h);
      box(ctx, pal.seam, start, y + h - 1, w);
      if (x >= left) box(ctx, pal.seam, x, y, 1, h);
      box(ctx, pal.gleam, start + 1, y, Math.max(0, w - 2));
      if (oak && w > 9 && tone > .41) {
        box(ctx, '#c49b71', start + 5, y + 2, Math.floor(w * .55));
        if (tone > .7) box(ctx, '#977352', start + 9, y + 4, Math.floor(w * .52));
      }
    }
  }
}

function rug(ctx: CanvasRenderingContext2D, pal: RoomColors, x: number, y: number, w: number, h: number) {
  const ring: Point[] = [[x + 6, y], [x + w - 6, y], [x + w, y + 5], [x + w, y + h - 5], [x + w - 6, y + h], [x + 6, y + h], [x, y + h - 5], [x, y + 5]];
  polygon(ctx, pal.rugDark, ring.map(([px, py]) => [px + 2, py + 3]));
  polygon(ctx, pal.rugLight, ring);
  polygon(ctx, pal.rug, [[x + 7, y + 2], [x + w - 7, y + 2], [x + w - 2, y + 6], [x + w - 2, y + h - 6], [x + w - 7, y + h - 2], [x + 7, y + h - 2], [x + 2, y + h - 6], [x + 2, y + 6]]);
  for (let py = y + 10; py < y + h - 8; py += 12) {
    for (const px of [x + 8, x + w - 9]) {
      polygon(ctx, pal.rugLight, [[px, py - 2], [px + 2, py], [px, py + 2], [px - 2, py]]);
    }
  }
  const centre = x + Math.floor(w / 2);
  const middle = y + Math.floor(h / 2);
  polygon(ctx, pal.rugLight, [[centre, middle - 9], [centre + 9, middle], [centre, middle + 9], [centre - 9, middle]]);
  polygon(ctx, pal.rugDark, [[centre, middle - 6], [centre + 6, middle], [centre, middle + 6], [centre - 6, middle]]);
  box(ctx, pal.rugLight, centre - 1, middle - 1, 3, 3);
}

function laboratoryAisle(ctx: CanvasRenderingContext2D, pal: RoomColors) {
  const x = 168;
  const y = 140;
  const w = 64;
  const h = 73;
  polygon(ctx, pal.rugDark, [[x, y], [x + w, y], [x + w + 4, y + 7], [x + w + 4, y + h], [x + 4, y + h], [x, y + h - 6]]);
  box(ctx, pal.rug, x + 3, y + 3, w - 2, h - 6);
  for (let offset = 7; offset < h - 8; offset += 7) {
    box(ctx, '#b4b68c', x + 6, y + offset, 2, 3);
    box(ctx, '#b4b68c', x + w - 2, y + offset, 2, 3);
  }
  const stripe = '#b6c1a6';
  box(ctx, stripe, x + 18, y + 12, 29, 1);
  box(ctx, stripe, x + 15, y + 15, 35, 2);
  box(ctx, stripe, x + 18, y + 19, 29, 1);
  box(ctx, pal.rugLight, x + 19, y + h - 10, 28, 1);
}

function compassFloor(ctx: CanvasRenderingContext2D, pal: RoomColors) {
  const x = 199;
  const y = 175;
  const contour = (r: number, h: number): Point[] => [[x - r, y - 9], [x - r / 2, y - h], [x + r / 2, y - h], [x + r, y - 9], [x + r, y + 9], [x + r / 2, y + h], [x - r / 2, y + h], [x - r, y + 9]];
  polygon(ctx, pal.rugDark, contour(49, 34));
  polygon(ctx, '#b5a195', contour(46, 32));
  polygon(ctx, pal.rug, contour(44, 30));
  polygon(ctx, '#a08f91', contour(35, 23));
  polygon(ctx, '#726c80', contour(32, 21));
  polygon(ctx, '#c5b09b', [[x, y - 26], [x + 6, y - 5], [x + 38, y], [x + 6, y + 4], [x, y + 26], [x - 6, y + 4], [x - 38, y], [x - 6, y - 5]]);
  polygon(ctx, '#888093', [[x, y - 18], [x + 3, y - 3], [x + 31, y], [x + 3, y + 3], [x, y + 19], [x - 3, y + 3], [x - 31, y], [x - 3, y - 3]]);
  box(ctx, '#e1ca9b', x - 1, y - 1, 3, 3);
}

function windowBay(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, mode: RoomId) {
  box(ctx, '#514c4f', x - 3, y - 3, w + 6, h + 7);
  box(ctx, '#aaa18b', x - 2, y - 2, w + 4, h + 5);
  const sky = mode === 'tower' ? '#3c4c70' : mode === 'lab' ? '#649188' : '#72a6ac';
  const terrain = mode === 'tower' ? '#566584' : mode === 'lab' ? '#516d61' : '#438d91';
  const reflection = mode === 'tower' ? '#e5cea4' : '#b8cac0';
  box(ctx, sky, x, y, w, h);
  polygon(ctx, terrain, [[x, y + h - 5], [x + Math.floor(w * .32), y + h - 10], [x + Math.floor(w * .53), y + h - 7], [x + w - 4, y + h - 12], [x + w, y + h - 7], [x + w, y + h], [x, y + h]]);
  box(ctx, reflection, x + 3, y + 3, Math.ceil(w / 3));
  box(ctx, reflection, x + 8, y + 5, 5);
  if (mode === 'tower') {
    box(ctx, '#eadbb7', x + w - 10, y + 4, 2, 2);
    box(ctx, '#eadbb7', x + w - 16, y + 9, 1);
  }
  box(ctx, '#b6aa91', x + Math.floor(w / 2), y, 1, h);
  box(ctx, '#b6aa91', x, y + Math.floor(h / 2), w);
  box(ctx, '#d2bd97', x - 3, y + h, w + 6, 2);
  box(ctx, '#65595a', x - 3, y + h + 2, w + 6);
}

function wallArt(ctx: CanvasRenderingContext2D, id: RoomId, x: number, y: number) {
  if (id === 'home') {
    box(ctx, '#574b4f', x - 13, y - 1, 26, 24);
    box(ctx, '#bc9c6b', x - 12, y, 24, 22);
    box(ctx, '#ecd6a9', x - 10, y + 2, 20, 18);
    box(ctx, '#a3b8a7', x - 9, y + 3, 18, 16);
    polygon(ctx, '#6d6f68', [[x - 7, y + 17], [x - 6, y + 12], [x - 3, y + 10], [x - 3, y + 7], [x + 1, y + 5], [x + 4, y + 8], [x + 4, y + 13], [x + 8, y + 15], [x + 8, y + 18]]);
    box(ctx, '#d6ac87', x - 1, y + 8, 4, 5);
    box(ctx, '#4e5657', x - 8, y + 18, 16);
  } else {
    const w = id === 'lab' ? 41 : 47;
    const edge = '#514e61';
    const paper = id === 'lab' ? '#c2bda1' : '#6d7797';
    box(ctx, edge, x - 1, y - 1, w + 2, 25);
    box(ctx, paper, x, y, w, 23);
    box(ctx, '#acada0', x + 2, y + 2, w - 4);
    if (id === 'lab') {
      for (let col = 0; col < 3; col++) {
        box(ctx, '#718782', x + 3 + 13 * col, y + 5, 8, 9);
        box(ctx, '#a0ad8d', x + 4 + 13 * col, y + 6, 6, 5);
        box(ctx, '#969887', x + 3 + 13 * col, y + 16, 8, 1);
        box(ctx, '#969887', x + 3 + 13 * col, y + 18, 6, 1);
      }
    } else {
      const constellations: Point[] = [[3, 15], [11, 8], [16, 12], [23, 5], [32, 7], [37, 15], [43, 12]];
      polygon(ctx, '#8d91a9', [...constellations.map(([px, py]) => [x + px, y + py] as Point), ...[...constellations].reverse().map(([px, py]) => [x + px, y + py + 1] as Point)]);
      for (const [px, py] of constellations) box(ctx, '#e9d4a9', x + px - 1, y + py - 1, 2, 2);
    }
  }
}

function roomShell(ctx: CanvasRenderingContext2D, id: RoomId, plan: RoomPlan, pal: RoomColors) {
  const left = plan.left * TILE;
  const right = (plan.right + 1) * TILE;
  const top = 5 * TILE;
  const bottom = (startY + 1) * TILE;
  box(ctx, pal.void, 0, 0, width * TILE, height * TILE);
  polygon(ctx, '#15202553', [[left - 17, top - 46], [right + 14, top - 45], [right + 20, bottom + 19], [left - 15, bottom + 19]]);
  ctx.save();
  if (id === 'tower') {
    ctx.beginPath();
    const cutaway: Point[] = [[left + 18, top - 43], [right - 18, top - 43], [right + 9, top - 12], [right + 9, bottom - 28], [right - 15, bottom + 7], [left + 15, bottom + 7], [left - 9, bottom - 28], [left - 9, top - 12]];
    cutaway.forEach(([px, py]) => ctx.lineTo(px, py));
    ctx.closePath();
    ctx.clip();
  }
  floorboards(ctx, plan, pal);
  box(ctx, pal.trim, left - 8, top - 43, right - left + 16, 45);
  box(ctx, pal.wall, left - 6, top - 41, right - left + 12, 37);
  box(ctx, pal.wallLight, left - 6, top - 41, right - left + 12, 3);
  box(ctx, pal.wallDark, left - 6, top - 10, right - left + 12, 7);
  box(ctx, pal.trim, left - 2, top - 4, right - left + 4, 4);
  box(ctx, pal.wallLight, left, top - 4, right - left, 1);
  for (let x = left + 8; x < right - 3; x += 11) {
    if (id === 'home') {
      box(ctx, '#bfa083', x, top - 36, 1, 24);
      box(ctx, '#aa886d', x + 2, top - 15, 1, 4);
    } else {
      box(ctx, pal.wallLight, x, top - 32, 7, 1);
      box(ctx, pal.wallDark, x + 4, top - 15, 1, 4);
    }
  }
  polygon(ctx, pal.trim, [[left - 8, top - 43], [left, top - 10], [left, bottom], [left - 9, bottom + 6]]);
  polygon(ctx, pal.wallDark, [[left - 7, top - 37], [left - 1, top - 11], [left - 1, bottom - 1], [left - 7, bottom + 5]]);
  polygon(ctx, pal.trim, [[right + 8, top - 43], [right, top - 10], [right, bottom], [right + 9, bottom + 6]]);
  polygon(ctx, pal.wallDark, [[right + 7, top - 37], [right + 1, top - 11], [right + 1, bottom - 1], [right + 7, bottom + 5]]);
  box(ctx, '#21222630', left, top, right - left, 4);
  box(ctx, '#19222525', left, top, 6, bottom - top);
  box(ctx, '#19222538', right - 8, top, 8, bottom - top);

  if (id === 'home') {
    windowBay(ctx, left + 62, 48, 29, 21, id);
    wallArt(ctx, id, 194, 47);
    windowBay(ctx, right - 64, 48, 26, 21, id);
    rug(ctx, pal, 159, 134, 78, 76);
  } else if (id === 'lab') {
    windowBay(ctx, left + 95, 47, 36, 22, id);
    wallArt(ctx, id, 260, 48);
    laboratoryAisle(ctx, pal);
  } else {
    wallArt(ctx, id, left + 35, 48);
    windowBay(ctx, 170, 44, 41, 25, id);
    windowBay(ctx, 226, 44, 41, 25, id);
    compassFloor(ctx, pal);
    polygon(ctx, pal.trim, [[left - 10, bottom - 32], [left + 18, bottom + 7], [left + 24, bottom + 7], [left - 8, bottom - 37]]);
    polygon(ctx, pal.trim, [[right + 10, bottom - 32], [right - 18, bottom + 7], [right - 24, bottom + 7], [right + 8, bottom - 37]]);
  }
  ctx.restore();

  const door = doorX * TILE;
  const sillLeft = id === 'tower' ? left + 15 : left - 9;
  const sillRight = id === 'tower' ? right - 15 : right + 9;
  box(ctx, pal.trim, sillLeft, bottom, door - sillLeft, 7);
  box(ctx, pal.trim, door + TILE, bottom, sillRight - door - TILE, 7);
  box(ctx, pal.wallLight, sillLeft + 1, bottom, door - sillLeft - 2, 2);
  box(ctx, pal.wallLight, door + TILE, bottom, sillRight - door - TILE - 1, 2);
  box(ctx, pal.wallDark, door - 1, bottom - 1, TILE + 2, 14);
  box(ctx, pal.rugLight, door + 1, bottom, TILE - 2, 11);
  for (let y = bottom + 2; y < bottom + 12; y += 4) box(ctx, pal.seam, door + 1, y, TILE - 2);
  box(ctx, '#e4ca95', door + 5, bottom + 5, 6, 2);
}

function floorLight(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, tint: string) {
  const light = ctx.createRadialGradient(x, y, 1, x, y, radius);
  light.addColorStop(0, tint);
  light.addColorStop(1, 'transparent');
  ctx.fillStyle = light;
  ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
}

function bench(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, alloy = false) {
  const frame = alloy ? '#465a5f' : '#634d48';
  const light = alloy ? '#bcc2ad' : '#d5b086';
  const mid = alloy ? '#889a90' : '#ac805d';
  const face = alloy ? '#657d77' : '#947059';
  const left = x - Math.floor(w / 2);
  const right = left + w;
  polygon(ctx, frame, [[left, y - 16], [left + 5, y - 20], [right, y - 20], [right + 3, y - 17], [right + 3, y - 2], [right - 2, y + 2], [left, y + 2]]);
  polygon(ctx, mid, [[left + 1, y - 16], [left + 6, y - 19], [right - 1, y - 19], [right + 1, y - 17], [right - 3, y - 14], [left + 1, y - 14]]);
  box(ctx, light, left + 3, y - 16, w - 5);
  box(ctx, face, left + 2, y - 13, w - 4, 12);
  box(ctx, mid, left + 4, y - 12, w - 8, 2);
  for (let dr = left + 8; dr < right - 7; dr += 12) {
    box(ctx, frame, dr, y - 8, 1, 6);
    box(ctx, light, dr - 7, y - 7, 4, 1);
  }
  box(ctx, frame, left + 4, y - 2, 3, 3);
  box(ctx, frame, right - 8, y - 2, 3, 3);
}

function bookshelf(ctx: CanvasRenderingContext2D, x: number, y: number, width: number) {
  const left = x - Math.floor(width / 2);
  const right = left + width;
  polygon(ctx, '#4e484b', [[left - 1, y - 33], [left + 4, y - 38], [right + 4, y - 38], [right + 4, y - 4], [right, y + 1], [left - 1, y + 1]]);
  box(ctx, '#9d856b', left + 2, y - 34, width - 3, 32);
  box(ctx, '#b69979', left + 3, y - 35, width - 3, 1);
  polygon(ctx, '#78675a', [[right, y - 32], [right + 3, y - 37], [right + 3, y - 5], [right, y - 1]]);
  const bindings = ['#a66253', '#638884', '#b9a27a', '#746c85', '#8a9171', '#8b7a57'];
  for (let row = 0; row < 3; row++) {
    const top = y - 30 + row * 10;
    box(ctx, '#5d534c', left + 3, top - 1, width - 6, 8);
    box(ctx, '#c3a47c', left + 3, top + 7, width - 6, 1);
    for (let px = left + 4; px < right - 5; px += 4) {
      const value = noise(px, row, 2);
      const h = 4 + Math.floor(value * 3);
      box(ctx, bindings[Math.floor(noise(px, row, 6) * bindings.length)], px, top + 6 - h, 3, h);
      box(ctx, '#c4b393', px, top + 5 - h, 2);
    }
  }
}

function pottedPalm(ctx: CanvasRenderingContext2D, x: number, y: number) {
  polygon(ctx, '#4e514d', [[x - 6, y - 9], [x + 7, y - 9], [x + 5, y + 1], [x - 4, y + 1]]);
  polygon(ctx, '#ac785d', [[x - 5, y - 7], [x + 6, y - 7], [x + 4, y - 1], [x - 3, y - 1]]);
  box(ctx, '#ce9570', x - 6, y - 9, 13, 2);
  box(ctx, '#536e56', x, y - 28, 1, 20);
  const fronds: Point[][] = [
    [[x, y - 12], [x - 13, y - 23], [x - 7, y - 22], [x - 1, y - 18]],
    [[x, y - 13], [x + 3, y - 21], [x + 12, y - 25], [x + 7, y - 17]],
    [[x, y - 17], [x - 9, y - 28], [x - 5, y - 27], [x + 1, y - 22]],
    [[x + 1, y - 17], [x + 4, y - 29], [x + 7, y - 25], [x + 5, y - 19]],
  ];
  for (const frond of fronds) polygon(ctx, '#52775b', frond);
  box(ctx, '#9da57a', x - 9, y - 23, 3);
  box(ctx, '#a7aa76', x + 7, y - 21, 3);
  box(ctx, '#97a778', x - 7, y - 26, 4);
}

function archive(ctx: CanvasRenderingContext2D, x: number, y: number, w: number) {
  bench(ctx, x, y, w);
  const left = x - Math.floor(w / 2);
  box(ctx, '#5a5249', left + 5, y - 30, 24, 11);
  box(ctx, '#c09a74', left + 6, y - 29, 22, 8);
  box(ctx, '#e4cca4', left + 7, y - 29, 20, 1);
  box(ctx, '#785b4f', left + 9, y - 25, 15, 2);
  polygon(ctx, '#e7d5aa', [[x - 1, y - 19], [x + 5, y - 26], [x + 14, y - 26], [x + 15, y - 22], [x + 11, y - 18], [x + 4, y - 18]]);
  box(ctx, '#ad9678', x + 3, y - 21, 7, 1);
  box(ctx, '#65786b', x + 15, y - 21, 5, 3);
  polygon(ctx, '#f1d7a9', [[x + 16, y - 22], [x + 19, y - 34], [x + 22, y - 35], [x + 20, y - 27]]);
}

function hearth(ctx: CanvasRenderingContext2D, x: number, y: number, w: number) {
  const left = x - Math.floor(w / 2);
  const right = left + w;
  polygon(ctx, '#564a47', [[left, y - 35], [left + 5, y - 39], [right, y - 39], [right + 3, y - 35], [right + 3, y - 4], [right, y + 1], [left, y + 1]]);
  box(ctx, '#9c7865', left + 2, y - 34, w - 2, 31);
  box(ctx, '#ca9e80', left + 2, y - 34, w - 2, 2);
  for (let row = 0; row < 3; row++) {
    const top = y - 30 + row * 7;
    box(ctx, '#785f56', left + 2, top + 5, w - 2);
    for (let px = left + 4 + (row % 2) * 5; px < right - 3; px += 10) box(ctx, '#785f56', px, top, 1, 5);
  }
  box(ctx, '#caa384', left - 1, y - 30, w + 3, 3);
  box(ctx, '#5e4946', x - 10, y - 23, 20, 20);
  box(ctx, '#3a333a', x - 8, y - 19, 16, 15);
  box(ctx, '#674b43', x - 8, y - 7, 16, 4);
  polygon(ctx, '#ca7854', [[x - 6, y - 5], [x - 5, y - 13], [x - 2, y - 10], [x + 2, y - 16], [x + 4, y - 12], [x + 7, y - 7], [x + 5, y - 4]]);
  polygon(ctx, '#e7ba73', [[x - 3, y - 5], [x, y - 11], [x + 3, y - 9], [x + 4, y - 5]]);
  box(ctx, '#b89a7d', left, y - 3, w + 1, 3);
}

function settee(ctx: CanvasRenderingContext2D, x: number, y: number, w: number) {
  const left = x - Math.floor(w / 2);
  const right = left + w;
  polygon(ctx, '#5a454b', [[left, y - 22], [left + 4, y - 26], [right, y - 26], [right + 3, y - 21], [right + 3, y - 2], [left, y + 1]]);
  box(ctx, '#a37263', left + 2, y - 21, w - 1, 15);
  box(ctx, '#bf8772', left + 3, y - 24, w - 3, 8);
  box(ctx, '#d09b83', left + 4, y - 24, w - 5);
  box(ctx, '#8b5e57', left + 2, y - 11, w, 6);
  box(ctx, '#cb967d', left + 3, y - 12, w - 2, 3);
  box(ctx, '#dfbc8f', left + 8, y - 21, 9, 7);
  box(ctx, '#a58a73', left + 9, y - 20, 7, 1);
  box(ctx, '#7f6c67', right - 12, y - 20, 7, 7);
  box(ctx, '#a89a82', right - 11, y - 19, 6, 1);
}

function display(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, wave = false) {
  box(ctx, '#485358', x, y, w, 15);
  box(ctx, '#9aafa4', x + 1, y + 1, w - 2, 12);
  box(ctx, '#465c62', x + 2, y + 2, w - 4, 9);
  box(ctx, '#719c97', x + 3, y + 3, w - 6, 1);
  if (wave) {
    for (let index = 3; index < w - 3; index++) {
      const rise = Math.round(Math.sin(index * 1.6) * 2 + Math.cos(index * .6) * 1.5);
      box(ctx, '#b4c091', x + index, y + 7 + rise, 1, 1);
    }
  } else {
    box(ctx, '#86ae95', x + 4, y + 5, Math.floor(w * .4), 2);
    box(ctx, '#6f9d87', x + 4, y + 8, Math.floor(w * .3), 1);
  }
  box(ctx, '#e1c782', x + w - 4, y + 11, 2, 1);
}

function instruments(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, radio: boolean) {
  bench(ctx, x, y, w, true);
  const left = x - Math.floor(w / 2);
  display(ctx, left + 6, y - 33, 19, true);
  display(ctx, left + 26, y - 31, 15, false);
  if (radio) {
    box(ctx, '#495459', left + 44, y - 32, 13, 13);
    box(ctx, '#9b9581', left + 45, y - 31, 11, 11);
    box(ctx, '#c4ad7c', left + 46, y - 29, 8, 1);
    box(ctx, '#615a55', left + 50, y - 34, 1, 10);
    box(ctx, '#615a55', left + 55, y - 40, 1, 8);
    polygon(ctx, '#757b73', [[left + 55, y - 40], [left + 55, y - 38], [left + 44, y - 36], [left + 44, y - 38]]);
  } else {
    box(ctx, '#78918b', left + 44, y - 28, 13, 10);
    box(ctx, '#b6c1a9', left + 45, y - 27, 11, 5);
    box(ctx, '#48786e', left + 47, y - 26, 6, 2);
    box(ctx, '#b1cbbc', left + 48, y - 34, 4, 7);
    box(ctx, '#e8dd8c', left + 49, y - 34, 2, 3);
    box(ctx, '#81958c', left + 45, y - 19, 13, 1);
  }
}

function equipmentRack(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, batteries: boolean) {
  const left = x - Math.floor(w / 2);
  const h = batteries ? 23 : 38;
  polygon(ctx, '#404e59', [[left, y - h + 4], [left + 6, y - h], [left + w + 3, y - h], [left + w + 3, y - 4], [left + w - 2, y + 1], [left, y + 1]]);
  box(ctx, batteries ? '#827e91' : '#6f8682', left + 2, y - h + 5, w - 4, h - 7);
  box(ctx, '#abaeaa', left + 4, y - h + 6, w - 7);
  for (let shelf = 0; shelf < (batteries ? 2 : 4); shelf++) {
    const top = y - h + 9 + shelf * 7;
    box(ctx, '#414e5b', left + 4, top, w - 8, 4);
    box(ctx, batteries ? '#be8e68' : '#b8cf95', left + 7 + shelf % 2, top + 1, 2);
    if (!batteries) box(ctx, '#799e8b', left + 13, top + 1, w - 18, 1);
  }
}

function sampleCabinet(ctx: CanvasRenderingContext2D, x: number, y: number, w: number) {
  bench(ctx, x, y, w, true);
  const left = x - Math.floor(w / 2);
  for (let index = 0; index < 4; index++) {
    const px = left + 5 + index * 9;
    const top = y - 34 + (index % 2) * 3;
    box(ctx, '#536f71', px, top, 7, 13);
    box(ctx, ['#afbeb2', '#b4b783', '#89ac9b', '#d2a581'][index], px + 1, top + 1, 5, 10);
    box(ctx, '#d1cfb2', px + 1, top + 1, 5);
    box(ctx, '#6f8678', px + 2, top + 6, 3, 3);
    box(ctx, '#d8d1ac', px + 2, top + 2, 1, 5);
  }
}

function telescope(ctx: CanvasRenderingContext2D, x: number, y: number) {
  polygon(ctx, '#55566e', [[x, y - 30], [x + 7, y - 29], [x + 18, y - 2], [x + 16, y], [x + 5, y - 19], [x - 2, y + 2], [x - 5, y + 2], [x - 3, y - 9], [x - 15, y - 2], [x - 17, y - 4]]);
  polygon(ctx, '#a99583', [[x + 2, y - 25], [x + 6, y - 25], [x + 17, y - 2], [x + 16, y - 1], [x + 4, y - 19], [x - 3, y], [x - 4, y], [x - 1, y - 21]]);
  polygon(ctx, '#414b64', [[x - 16, y - 26], [x - 18, y - 34], [x + 12, y - 48], [x + 19, y - 46], [x + 22, y - 38], [x + 18, y - 33], [x - 12, y - 21]]);
  polygon(ctx, '#8a8ba0', [[x - 16, y - 33], [x + 12, y - 47], [x + 18, y - 45], [x + 19, y - 40], [x - 14, y - 26]]);
  polygon(ctx, '#b9a58d', [[x - 1, y - 40], [x + 3, y - 42], [x + 8, y - 32], [x + 3, y - 30]]);
  polygon(ctx, '#c6b39b', [[x + 10, y - 47], [x + 13, y - 49], [x + 20, y - 46], [x + 22, y - 39], [x + 19, y - 37], [x + 16, y - 44]]);
  box(ctx, '#596980', x + 18, y - 44, 3, 5);
  box(ctx, '#a3bbbc', x + 19, y - 43, 1, 3);
}

function drawFixture(ctx: CanvasRenderingContext2D, fixture: Fixture, x: number, y: number) {
  const span = fixture.width * TILE - 7;
  switch (fixture.kind) {
    case 'bookshelf': bookshelf(ctx, x, y, span); break;
    case 'archive': archive(ctx, x, y, span); break;
    case 'stove': hearth(ctx, x, y, span); break;
    case 'settee': settee(ctx, x, y, span); break;
    case 'plant': pottedPalm(ctx, x, y); break;
    case 'server': equipmentRack(ctx, x, y, span, false); break;
    case 'batteries': equipmentRack(ctx, x, y, span, true); break;
    case 'workbench': instruments(ctx, x, y, span, false); break;
    case 'radio': instruments(ctx, x, y, span, true); break;
    case 'samples': sampleCabinet(ctx, x, y, span); break;
    case 'telescope': telescope(ctx, x, y);
  }
}

export function makeRoomArt(id: RoomId) {
  const plan = plans[id];
  const { image: base, draw: ctx } = surface(width * TILE, height * TILE);
  roomShell(ctx, id, plan, roomColors[id]);
  const materials = Array.from({ length: height }, (_, y) => Array.from({ length: width }, (_, x): GroundMaterial => {
    if (floorAt(plan, x, y)) return id === 'home' ? 'wood' : 'pavers';
    return y >= 2 && y <= 4 && x >= plan.left && x <= plan.right ? 'pavers' : 'void';
  }));
  textureGround(ctx, plan.area, materials, TILE);
  if (id === 'home') {
    floorLight(ctx, 276, 113, 35, '#f2b35c52');
    floorLight(ctx, 191, 127, 55, '#f6d4861a');
  } else if (id === 'lab') {
    floorLight(ctx, 226, 124, 62, '#aed9be3b');
  } else {
    floorLight(ctx, 215, 105, 67, '#bdc8e332');
    floorLight(ctx, 154, 137, 59, '#e0b78f20');
  }
  const foreground = plan.furniture.map(furniture => {
    const worldX = furniture.x * TILE + TILE / 2;
    const worldY = furniture.y * TILE + TILE - 1;
    const shadow = furniture.width * TILE / 2 - 2;
    polygon(ctx, '#313a434b', [[worldX - shadow, worldY - 4], [worldX + shadow, worldY - 8], [worldX + shadow + 8, worldY + 4], [worldX + shadow + 1, worldY + 9], [worldX - shadow + 4, worldY + 6]]);
    const w = furniture.width * TILE + 22;
    const h = 62;
    const x = w / 2;
    const y = h - 6;
    const { image, draw } = surface(w, h);
    drawFixture(draw, furniture, x, y);
    return { image, x: worldX - x, y: worldY - y, depth: worldY };
  });
  return { base, foreground };
}

export function drawRoomEffects(ctx: CanvasRenderingContext2D, id: RoomId, time: number, reduceMotion = false) {
  if (reduceMotion) return;
  ctx.save();
  if (id === 'home') {
    const sway = Math.round(Math.sin(time / 310));
    ctx.globalAlpha = .65 + Math.sin(time / 420) * .2;
    polygon(ctx, '#f1c67a', [[275, 90], [278 + sway, 84 - sway], [282, 86], [284, 90]]);
    box(ctx, '#eebf7b', 281, 81 + sway, 1);
  } else if (id === 'lab') {
    const scan = Math.floor(time / 180) % 7;
    ctx.globalAlpha = .27;
    box(ctx, '#d2dfae', 213, 81 + scan, 13);
    ctx.globalAlpha = .4 + Math.sin(time / 610) * .21;
    box(ctx, '#dde9a1', 161, 64, 2, 1);
  } else {
    const pulse = Math.sin(time / 620);
    ctx.globalAlpha = .48 + pulse * .28;
    box(ctx, '#f0dcab', 189, 51, 1, 2);
    ctx.globalAlpha = .47 - pulse * .18;
    box(ctx, '#e7d7b7', 251, 56, 1);
    box(ctx, '#e0c788', 172, 91, 2);
  }
  ctx.restore();
}
