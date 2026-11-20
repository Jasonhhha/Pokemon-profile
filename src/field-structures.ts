import { box, polygon, type Point } from './field-pixels';
import { noise } from './field-texture';
import type { FieldArea, Prop } from './field-layout';

const roofColors = [
  ['#613c44', '#8a464b', '#b96057', '#d77a67', '#efa185'],
  ['#623f4a', '#904f54', '#c37165', '#e0957c', '#f4b38f'],
  ['#344e5c', '#47666d', '#648987', '#7fa6a0', '#a2bbb0'],
  ['#3d514a', '#607062', '#82917a', '#a0a789', '#c5c3a0'],
];

function windowPane(ctx: CanvasRenderingContext2D, x: number, y: number, wide = false) {
  const w = wide ? 17 : 12;
  box(ctx, '#65554d', x - 2, y - 2, w + 4, 15);
  box(ctx, '#f2d59f', x - 1, y - 1, w + 2, 13);
  box(ctx, '#43535b', x, y, w, 11);
  box(ctx, '#79a9a6', x + 1, y + 1, w - 2, 7);
  box(ctx, '#b6d3bb', x + 2, y + 2, 3, 5);
  box(ctx, '#f0d9aa', x + Math.floor(w / 2), y, 1, 10);
  box(ctx, '#ddc493', x - 3, y + 11, w + 6, 2);
}

function cottage(ctx: CanvasRenderingContext2D, x: number, y: number, variant: number, station = false) {
  const clinic = variant === 1 && !station;
  const observatory = variant === 1 && station;
  const [edge, shadow, mid, bright, shine] = roofColors[clinic ? 2 : observatory ? 3 : variant];
  const white = station ? '#d6d3b7' : '#f1ddae';
  const plaster = station ? '#b7b59e' : '#d4bb8f';
  const mortar = station ? '#a2a58e' : '#b89c77';
  const underEaves = station ? '#827f76' : '#9a7861';
  const beam = '#624c48';
  const dark = '#504854';
  const side = x + 24;
  const facade = x - 34;

  if (observatory) {
    // A copper observation drum gives the trail's lodge a separate roof silhouette.
    const annex = x + 32;
    polygon(ctx, '#344841', [[annex - 12, y - 32], [annex - 13, y - 60], [annex - 9, y - 67], [annex, y - 72], [annex + 8, y - 68], [annex + 14, y - 60], [annex + 14, y - 30], [annex + 8, y - 27], [annex - 7, y - 27]]);
    polygon(ctx, '#a6ae8f', [[annex - 10, y - 56], [annex + 11, y - 56], [annex + 12, y - 32], [annex + 6, y - 29], [annex - 6, y - 29], [annex - 11, y - 32]]);
    box(ctx, '#6e7873', annex - 10, y - 54, 21, 3);
    box(ctx, '#667069', annex + 6, y - 51, 5, 17);
    box(ctx, '#c2bea2', annex - 9, y - 50, 12, 9);
    box(ctx, '#4f6467', annex - 7, y - 48, 12, 5);
    box(ctx, '#80a5a1', annex - 6, y - 48, 5, 3);
    polygon(ctx, '#718778', [[annex - 12, y - 58], [annex - 8, y - 66], [annex, y - 71], [annex + 7, y - 66], [annex + 12, y - 58]]);
    polygon(ctx, '#baccaa', [[annex - 10, y - 59], [annex - 7, y - 65], [annex, y - 69], [annex + 1, y - 60]]);
    box(ctx, '#acc2a3', annex - 10, y - 59, 21);
  }

  polygon(ctx, dark, [[side - 2, y - 30], [x + 40, y - 36], [x + 40, y - 8], [side, y], [side - 2, y - 2]]);
  polygon(ctx, station ? '#879185' : '#a58d72', [[side + 1, y - 28], [x + 38, y - 34], [x + 38, y - 9], [side + 1, y - 2]]);
  polygon(ctx, underEaves, [[side, y - 30], [x + 39, y - 35], [x + 39, y - 29], [side, y - 23]]);
  for (let row = 0; row < 3; row++) {
    const ry = y - 18 + row * 5;
    polygon(ctx, '#8d7b70', [[side + 1, ry], [x + 38, ry - 6], [x + 38, ry - 5], [side + 1, ry + 1]]);
  }
  polygon(ctx, beam, [[x + 29, y - 19], [x + 36, y - 22], [x + 36, y - 13], [x + 29, y - 10]]);
  polygon(ctx, '#41565c', [[x + 30, y - 18], [x + 35, y - 20], [x + 35, y - 14], [x + 30, y - 12]]);
  polygon(ctx, '#7e9996', [[x + 30, y - 17], [x + 34, y - 19], [x + 34, y - 16], [x + 30, y - 14]]);

  box(ctx, beam, facade - 1, y - 30, 60, 30);
  box(ctx, plaster, facade + 1, y - 28, 56, 25);
  box(ctx, underEaves, facade + 1, y - 27, 56, 7);
  box(ctx, white, facade + 1, y - 21, 55, 14);
  box(ctx, '#bba283', facade + 1, y - 7, 56, 4);
  for (let row = 0; row < 4; row++) {
    const ry = y - 20 + row * 5;
    box(ctx, mortar, facade + 1, ry, 56, 1);
    for (let bx = facade + 6 + row % 2 * 6; bx < side - 4; bx += 12) {
      box(ctx, mortar, bx, ry + 1, 1, 4);
      if (noise(bx, ry) > .67) box(ctx, '#e4d3aa', bx + 1, ry + 1, 5);
    }
  }
  box(ctx, '#8f7160', facade + 1, y - 26, 3, 23);
  box(ctx, '#8f7160', side - 2, y - 24, 2, 22);
  box(ctx, '#807368', facade - 3, y - 4, 63, 5);
  box(ctx, '#b6a48b', facade - 2, y - 4, 61, 1);

  const door = x - 2;
  box(ctx, beam, door - 8, y - 24, 16, 23);
  box(ctx, clinic ? '#799688' : '#b17f60', door - 6, y - 21, 12, 19);
  box(ctx, '#53636b', door - 4, y - 19, 8, 8);
  box(ctx, clinic ? '#b1c1aa' : '#84a6a0', door - 3, y - 18, 6, 5);
  box(ctx, '#eedca1', door + 3, y - 8, 2);
  box(ctx, '#d0bba1', door - 9, y - 1, 19, 2);
  box(ctx, '#aa997e', door - 11, y + 1, 23, 2);

  windowPane(ctx, x - 26, y - 18, false);
  windowPane(ctx, x + 9, y - 18, false);
  if (clinic) {
    box(ctx, '#51494c', side + 3, y - 29, 12, 12);
    box(ctx, '#f0ddb4', side + 4, y - 28, 10, 10);
    box(ctx, '#a76c5e', side + 8, y - 26, 2, 6);
    box(ctx, '#a76c5e', side + 6, y - 24, 6, 2);
  } else {
    for (const [wx, flower] of [[x - 27, '#f9a28a'], [x + 8, '#ffe2a1']] as const) {
      box(ctx, '#65754b', wx, y - 8, 14, 2);
      box(ctx, '#906a52', wx, y - 6, 14, 3);
      box(ctx, '#af8760', wx, y - 6, 13);
      for (let i = 0; i < 12; i += 4) box(ctx, flower, wx + i + 1, y - 9 - (i % 3), 2, 2);
    }
  }

  const roof: Point[] = [[x - 40, y - 29], [x - 37, y - 37], [x - 27, y - 53], [x - 18, y - 62], [x + 21, y - 62], [x + 31, y - 55], [x + 42, y - 41], [x + 43, y - 34], [x + 27, y - 26], [x - 39, y - 25]];
  polygon(ctx, edge, roof);
  polygon(ctx, mid, [[x - 38, y - 29], [x - 26, y - 52], [x - 17, y - 59], [x + 20, y - 59], [x + 25, y - 29]]);
  polygon(ctx, bright, [[x - 34, y - 31], [x - 21, y - 56], [x - 16, y - 59], [x + 8, y - 59], [x + 14, y - 31]]);
  polygon(ctx, shadow, [[x + 20, y - 59], [x + 30, y - 53], [x + 40, y - 40], [x + 41, y - 34], [x + 26, y - 27], [x + 23, y - 42]]);
  polygon(ctx, mid, [[x + 22, y - 58], [x + 31, y - 51], [x + 39, y - 39], [x + 27, y - 34]]);
  for (let row = 0; row < 6; row++) {
    const ry = y - 56 + row * 4;
    const left = x - 20 - 3 * row;
    const right = x + 22 + Math.floor(row / 2);
    box(ctx, shadow, left, ry + 3, right - left);
    for (let bx = left + (row % 2) * 3; bx < right - 6; bx += 8) {
      const value = noise(bx, ry);
      if (value < .79) box(ctx, shine, bx + 2, ry, 3 + Math.floor(value * 3));
      box(ctx, value > .74 ? shadow : mid, bx, ry + 1, 1, 2);
    }
  }
  for (const [bx, by, w] of [[24, -53, 5], [26, -49, 6], [25, -44, 11], [28, -40, 11], [29, -35, 7]]) box(ctx, edge, x + bx, y + by, w);
  box(ctx, shine, x - 17, y - 60, 37);
  box(ctx, shadow, x - 37, y - 29, 64, 2);
  box(ctx, shine, x - 37, y - 31, 64);
  box(ctx, '#59494a', x + 10, y - 64, 9, 15);
  box(ctx, '#af9285', x + 11, y - 63, 5, 12);
  box(ctx, '#574747', x + 9, y - 65, 12, 3);
  box(ctx, '#cab29f', x + 10, y - 65, 10);
  if (station) {
    polygon(ctx, '#45545c', [[x - 14, y - 54], [x - 19, y - 62], [x, y - 70], [x + 3, y - 63], [x - 1, y - 57], [x - 7, y - 54]]);
    polygon(ctx, '#d0d4bc', [[x - 17, y - 62], [x, y - 69], [x + 1, y - 66], [x - 2, y - 61], [x - 8, y - 58]]);
    box(ctx, '#65767e', x - 9, y - 57, 3, 7);
    box(ctx, '#897c72', x - 11, y - 50, 7, 2);
  } else if (clinic) {
    box(ctx, '#575451', x - 15, y - 48, 26, 13);
    box(ctx, '#b9dad1', x - 14, y - 47, 24, 10);
    box(ctx, '#608079', x - 14, y - 38, 24);
    box(ctx, '#d87761', x - 4, y - 46, 3, 7);
    box(ctx, '#d87761', x - 6, y - 44, 7, 3);
  } else {
    polygon(ctx, '#794748', [[x - 18, y - 32], [x - 8, y - 47], [x + 4, y - 33]]);
    polygon(ctx, shine, [[x - 16, y - 33], [x - 8, y - 45], [x + 2, y - 33]]);
    box(ctx, '#4a6164', x - 12, y - 40, 7, 6);
    box(ctx, '#95b5aa', x - 11, y - 39, 5, 3);
  }
}

const treeColors = {
  harbor: ['#31564c', '#3d6c51', '#52804f', '#6e9954', '#91b468'],
  grove: ['#304e51', '#3b6257', '#508269', '#699a72', '#89b091'],
  summit: ['#53596d', '#627881', '#789695', '#9bada7', '#c3c5bb'],
};

function oak(ctx: CanvasRenderingContext2D, x: number, y: number, area: FieldArea, variant: number) {
  const [edge, deep, mid, bright, light] = treeColors[area];
  const dx = variant - 1;
  polygon(ctx, '#2447372a', [[x - 14, y - 4], [x + 15, y - 4], [x + 18, y - 1], [x + 15, y + 3], [x - 14, y + 3], [x - 18, y]]);
  box(ctx, '#654e46', x - 4, y - 15, 8, 15);
  box(ctx, '#977354', x - 3, y - 12, 3, 10);
  polygon(ctx, edge, [[x - 18, y - 13], [x - 20, y - 23], [x - 17, y - 29], [x - 13, y - 32], [x - 8, y - 33], [x - 5, y - 38 + dx], [x + 3, y - 41 + dx], [x + 11, y - 38], [x + 17, y - 32], [x + 17, y - 28], [x + 21, y - 24], [x + 21, y - 14], [x + 17, y - 10], [x + 8, y - 9], [x + 3, y - 7], [x - 5, y - 9], [x - 12, y - 8]]);
  polygon(ctx, deep, [[x - 17, y - 14], [x - 19, y - 22], [x - 16, y - 28], [x - 8, y - 31], [x - 3, y - 37], [x + 5, y - 39], [x + 12, y - 35], [x + 16, y - 27], [x + 19, y - 22], [x + 19, y - 16], [x + 15, y - 11], [x + 7, y - 11], [x + 1, y - 9], [x - 6, y - 11], [x - 12, y - 10]]);
  polygon(ctx, mid, [[x - 17, y - 15], [x - 17, y - 24], [x - 11, y - 29], [x - 5, y - 29], [x - 3, y - 35], [x + 4, y - 38], [x + 10, y - 35], [x + 13, y - 29], [x + 15, y - 24], [x + 12, y - 18], [x + 5, y - 15], [x - 4, y - 17], [x - 11, y - 13]]);
  polygon(ctx, bright, [[x - 15, y - 21], [x - 13, y - 26], [x - 8, y - 28], [x - 4, y - 27], [x - 1, y - 34], [x + 5, y - 36], [x + 9, y - 33], [x + 7, y - 28], [x + 11, y - 25], [x + 6, y - 20], [x - 1, y - 22], [x - 7, y - 17], [x - 12, y - 17]]);
  for (const [ox, oy, w] of [[-13, -23, 5], [-9, -26, 4], [-4, -20, 4], [0, -33, 5], [3, -35, 3], [4, -26, 4], [9, -31, 2], [-9, -17, 4], [11, -21, 3]]) {
    box(ctx, light, x + ox + dx, y + oy, w);
    box(ctx, bright, x + ox + dx + 1, y + oy + 1, w - 1);
  }
}

function pine(ctx: CanvasRenderingContext2D, x: number, y: number, area: FieldArea, variant: number) {
  const [edge, deep, mid, bright, light] = treeColors[area];
  const top = y - 46 - variant * 3;
  polygon(ctx, '#243d412a', [[x - 10, y - 4], [x + 13, y - 4], [x + 17, y - 1], [x + 12, y + 3], [x - 11, y + 3], [x - 15, y]]);
  box(ctx, '#564e54', x - 4, y - 16, 8, 16);
  box(ctx, '#9e8365', x - 2, y - 13, 3, 12);
  const levels = [{ w: 18, top: top + 19, bottom: y - 7 }, { w: 15, top: top + 9, bottom: y - 16 }, { w: 11, top, bottom: y - 26 }];
  for (const { w, top: ty, bottom } of levels) {
    polygon(ctx, edge, [[x, ty], [x + 4, ty + 6], [x + w, bottom - 5], [x + w, bottom - 2], [x + 7, bottom - 1], [x + 3, bottom + 1], [x - 3, bottom], [x - 9, bottom - 2], [x - w, bottom - 1], [x - w, bottom - 4], [x - 4, ty + 6]]);
    polygon(ctx, deep, [[x, ty + 2], [x + w - 1, bottom - 4], [x + 5, bottom - 3], [x + 2, bottom - 1], [x - 7, bottom - 3], [x - w + 2, bottom - 3]]);
    polygon(ctx, mid, [[x, ty + 3], [x + 7, bottom - 5], [x + 2, bottom - 3], [x - 6, bottom - 5], [x - w + 3, bottom - 4]]);
    polygon(ctx, bright, [[x, ty + 5], [x + 2, ty + 9], [x - 2, bottom - 7], [x - w + 6, bottom - 6]]);
    box(ctx, light, x - 5, bottom - 8, 4);
    box(ctx, bright, x + 3, bottom - 8, 5);
    box(ctx, bright, x - w + 4, bottom - 5, 4);
    if (area === 'summit') {
      box(ctx, '#c5c7c5', x - 5, bottom - 9, 7);
      box(ctx, '#b4c4c7', x - 10, bottom - 7, 4);
    }
  }
}

function rock(ctx: CanvasRenderingContext2D, x: number, y: number, area: FieldArea, variant: number) {
  const [a, b, c, d] = area === 'summit' ? ['#616680', '#82869c', '#a7a5b4', '#c4bcc7'] : ['#4d665b', '#6f8071', '#87988b', '#b0b4a0'];
  const w = 9 + variant * 3;
  const h = 9 + variant * 2;
  polygon(ctx, a, [[x - w, y - 4], [x - w + 3, y - h], [x - 4, y - h - 2], [x + 4, y - h - 2], [x + w - 2, y - 8], [x + w + 1, y - 3], [x + w, y + 1], [x - 4, y + 2], [x - w + 1, y]]);
  polygon(ctx, b, [[x - w + 1, y - 4], [x - w + 3, y - h], [x + 4, y - h - 1], [x + w - 1, y - 7], [x + w - 1, y - 1], [x - 3, y + 1]]);
  polygon(ctx, c, [[x - w + 2, y - 6], [x - w + 5, y - h], [x + 4, y - h - 1], [x + w - 3, y - 8], [x + 4, y - 5], [x - 3, y - 5], [x - 7, y - 3]]);
  box(ctx, d, x - 6, y - h, 8);
  box(ctx, b, x, y - 8, 3);
  box(ctx, a, x + 4, y - 6, 2, 3);
  box(ctx, c, x - 6, y - 4, 6);
  box(ctx, a, x - 2, y - 2, 5);
  if (variant > 0) {
    polygon(ctx, a, [[x - 12, y - 1], [x - 7, y - 2], [x - 5, y + 2], [x - 13, y + 2]]);
    box(ctx, b, x - 11, y, 4);
    box(ctx, c, x - 9, y - 1, 2);
  }
  if (area === 'grove') {
    box(ctx, '#8b9b70', x - 6, y - h + 2, 4, 2);
    box(ctx, '#a6aa76', x - 6, y - h + 2, 3);
  }
}

function beacon(ctx: CanvasRenderingContext2D, x: number, y: number, variant: number) {
  const trim = variant ? '#4e586e' : '#6c504d';
  const wall = variant ? '#b0b1c2' : '#ead5a8';
  const stripe = variant ? '#827f9d' : '#c26e5f';
  box(ctx, '#253d453e', x - 14, y - 1, 30, 5);
  polygon(ctx, trim, [[x - 12, y], [x - 10, y - 28], [x - 12, y - 31], [x - 12, y - 42], [x - 14, y - 43], [x - 14, y - 46], [x, y - 55], [x + 14, y - 46], [x + 14, y - 43], [x + 12, y - 42], [x + 12, y - 31], [x + 10, y - 28], [x + 12, y]]);
  polygon(ctx, wall, [[x - 10, y - 1], [x - 9, y - 28], [x + 9, y - 28], [x + 10, y - 1]]);
  box(ctx, stripe, x - 9, y - 12, 19, 6);
  box(ctx, stripe, x - 9, y - 24, 18, 5);
  box(ctx, '#837565', x + 6, y - 28, 3, 27);
  box(ctx, '#534e50', x - 3, y - 10, 7, 10);
  box(ctx, '#938060', x - 2, y - 8, 4, 8);
  box(ctx, '#92a895', x - 10, y - 41, 20, 10);
  box(ctx, variant ? '#727e91' : '#ffe8a0', x - 6, y - 40, 12, 8);
  box(ctx, variant ? '#9197a8' : '#fff8ba', x - 2, y - 39, 6, 6);
  box(ctx, trim, x - 7, y - 42, 2, 11);
  box(ctx, trim, x + 6, y - 42, 2, 11);
  box(ctx, '#e6c9a0', x - 12, y - 31, 24);
  polygon(ctx, stripe, [[x - 12, y - 45], [x, y - 53], [x + 11, y - 45]]);
  polygon(ctx, '#e1a286', [[x - 10, y - 46], [x, y - 52], [x + 3, y - 46]]);
  box(ctx, '#b8a371', x, y - 57, 2, 4);
}

function flowers(ctx: CanvasRenderingContext2D, x: number, y: number, variant: number) {
  const shades = [['#f5ad96', '#dc7c73'], ['#f2e3a6', '#d4bf7a'], ['#efe8c9', '#c1ceac']][variant % 3];
  for (let index = 0; index < 5; index++) {
    const dx = x - 7 + index * 3;
    const dy = y - 2 - index % 3 * 3;
    box(ctx, '#54805c', dx, dy - 3, 1, 4);
    box(ctx, shades[1], dx - 1, dy - 4, 3, 2);
    box(ctx, shades[0], dx - 1, dy - 5, 2);
    box(ctx, '#f8e4a5', dx, dy - 4, 1);
  }
}

function smallProp(ctx: CanvasRenderingContext2D, x: number, y: number, prop: Prop) {
  const variant = prop.variant ?? 0;
  if (prop.kind === 'lamp') {
    box(ctx, '#2f4d453b', x - 3, y - 1, 9, 4);
    box(ctx, '#526055', x - 1, y - 21, 3, 21);
    box(ctx, '#b19763', x - 1, y - 16, 1, 14);
    box(ctx, '#514c47', x - 4, y - 23, 9, 9);
    box(ctx, '#f3d589', x - 3, y - 22, 7, 6);
    box(ctx, '#ffedab', x - 2, y - 21, 4, 4);
    box(ctx, '#786554', x - 3, y - 25, 7, 2);
  } else if (prop.kind === 'fence') {
    box(ctx, '#5b583e', x - 7, y - 11, (variant + 1) * 16, 3);
    box(ctx, '#8f7a57', x - 7, y - 7, (variant + 1) * 16, 3);
    box(ctx, '#c9ab78', x - 7, y - 10, (variant + 1) * 16);
    for (let i = -7; i < (variant + 1) * 16 - 6; i += 8) {
      box(ctx, '#726246', x + i, y - 13, 3, 14);
      box(ctx, '#c8a976', x + i, y - 13, 2, 12);
    }
  } else if (prop.kind === 'banner') {
    box(ctx, '#5f574d', x - 1, y - 26, 3, 24);
    box(ctx, '#b6956d', x - 1, y - 24, 1, 20);
    polygon(ctx, '#885b54', [[x + 1, y - 25], [x + 16, y - 24], [x + 11, y - 20], [x + 15, y - 17], [x + 1, y - 18]]);
    polygon(ctx, '#c68568', [[x + 2, y - 24], [x + 14, y - 24], [x + 10, y - 20], [x + 13, y - 18], [x + 2, y - 19]]);
    box(ctx, '#e4b881', x + 5, y - 23, 2, 3);
  } else if (prop.kind === 'crate') {
    for (let i = 0; i < 2; i++) {
      const left = x - 9 + 8 * i;
      const bottom = y - (variant + 2) * i;
      box(ctx, '#644f42', left, bottom - 10, 9, 11);
      box(ctx, '#ad845d', left + 1, bottom - 9, 7, 8);
      box(ctx, '#e2b77a', left + 1, bottom - 9, 7, 2);
      box(ctx, '#8a6851', left + 1, bottom - 4, 7);
      box(ctx, '#b99169', left + 4, bottom - 7, 2, 6);
    }
  } else if (prop.kind === 'winch') {
    polygon(ctx, '#798475', [[x - 11, y], [x - 10, y - 6], [x + 5, y - 8], [x + 11, y - 4], [x + 10, y + 2], [x - 8, y + 2]]);
    box(ctx, '#624f46', x - 2, y - 20, 5, 20);
    box(ctx, '#a78b6a', x - 1, y - 19, 2, 18);
    box(ctx, '#d7af76', x - 2, y - 20, 4);
    polygon(ctx, '#5f5d56', [[x - 8, y - 12], [x + 7, y - 12], [x + 7, y - 8], [x - 8, y - 8]]);
    box(ctx, '#ccb17e', x - 8, y - 11, 13, 2);
    polygon(ctx, '#977e51', [[x - 7, y - 11], [x - 5, y - 11], [x - 1, y - 3], [x - 3, y - 3]]);
    box(ctx, '#d9b67e', x - 9, y - 5, 8, 3);
    box(ctx, '#b39a6a', x - 10, y - 4, 10);
    box(ctx, '#88745b', x + 3, y - 8, 5, 6);
    box(ctx, '#bbad7e', x + 3, y - 7, 5);
  } else if (prop.kind === 'sign') {
    const direction = variant ? -1 : 1;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(direction, 1);
    box(ctx, '#645447', -2, -22, 4, 23);
    box(ctx, '#9b7955', -1, -21, 1, 21);
    polygon(ctx, '#4e483f', [[-10, -19], [6, -19], [12, -15], [12, -13], [7, -9], [-10, -9]]);
    polygon(ctx, '#807157', [[-9, -18], [6, -18], [11, -15], [10, -13], [6, -10], [-9, -10]]);
    box(ctx, '#a99269', -8, -17, 14);
    box(ctx, '#e5d0a2', -6, -15, 9, 2);
    box(ctx, '#ead6a7', 4, -16, 2, 4);
    box(ctx, '#ead6a7', 6, -15, 2, 2);
    ctx.restore();
  } else if (prop.kind === 'boat') {
    const edge = '#315c5d';
    polygon(ctx, '#6db4aa', [[x - 23, y - 2], [x - 15, y - 9], [x + 13, y - 9], [x + 25, y - 1], [x + 18, y + 4], [x - 16, y + 4]]);
    polygon(ctx, edge, [[x - 22, y - 2], [x - 14, y - 13], [x + 13, y - 12], [x + 22, y - 5], [x + 17, y + 1], [x - 15, y + 1]]);
    polygon(ctx, variant ? '#b4bc9d' : '#80564a', [[x - 20, y - 3], [x - 13, y - 11], [x + 12, y - 11], [x + 19, y - 5], [x + 14, y], [x - 14, y]]);
    polygon(ctx, variant ? '#728a80' : '#b48760', [[x - 17, y - 4], [x - 12, y - 9], [x + 12, y - 9], [x + 15, y - 5], [x + 11, y - 2], [x - 12, y - 2]]);
    box(ctx, '#dfc397', x - 9, y - 9, 2, 7);
    box(ctx, '#dfc397', x + 7, y - 9, 2, 7);
    if (!variant) {
      box(ctx, '#755d50', x - 2, y - 24, 2, 21);
      polygon(ctx, '#f1d8a2', [[x - 1, y - 23], [x + 7, y - 20], [x + 12, y - 9], [x - 1, y - 9]]);
      polygon(ctx, '#c78069', [[x, y - 16], [x + 9, y - 15], [x + 10, y - 13], [x, y - 13]]);
      box(ctx, '#eaa082', x, y - 24, 5, 2);
    }
  } else if (prop.kind === 'arch') {
    for (const column of [x - 19, x + 13]) {
      polygon(ctx, '#525d76', [[column - 3, y - 23], [column + 3, y - 28], [column + 12, y - 28], [column + 12, y - 5], [column + 8, y + 3], [column - 3, y + 3]]);
      polygon(ctx, '#82819a', [[column + 6, y - 24], [column + 11, y - 28], [column + 11, y - 5], [column + 7, y + 1]]);
      box(ctx, '#aaa4b6', column - 2, y - 22, 9, 23);
      box(ctx, '#c4b9c2', column - 2, y - 22, 2, 22);
      box(ctx, '#817d96', column - 3, y - 2, 11, 3);
      box(ctx, '#c2b4bd', column - 3, y - 3, 11);
      for (let i = 0; i < 3; i++) {
        const top = y - 9 - 6 * i;
        box(ctx, '#837d96', column - 2, top, 8);
        box(ctx, '#cbc1c7', column - 1, top + 1, 7);
      }
    }
    polygon(ctx, '#616781', [[x - 25, y - 25], [x - 19, y - 29], [x - 12, y - 31], [x + 17, y - 30], [x + 27, y - 28], [x + 26, y - 24], [x + 16, y - 20], [x - 25, y - 20]]);
    polygon(ctx, '#c7becb', [[x - 24, y - 26], [x - 18, y - 28], [x - 9, y - 30], [x + 17, y - 29], [x + 25, y - 28], [x + 16, y - 24], [x - 24, y - 24]]);
    box(ctx, '#a5a0b3', x - 23, y - 24, 42, 3);
    box(ctx, '#e3d2bf', x - 20, y - 25, 34);
    polygon(ctx, '#d5bd88', [[x - 1, y - 29], [x + 4, y - 25], [x + 1, y - 22], [x - 4, y - 25]]);
    box(ctx, '#9a8589', x + 1, y - 30, 1, 6);
  }
}

export function drawProp(ctx: CanvasRenderingContext2D, area: FieldArea, prop: Prop, x: number, y: number) {
  const variant = prop.variant ?? 0;
  switch (prop.kind) {
    case 'cottage': cottage(ctx, x, y, variant); break;
    case 'station': cottage(ctx, x, y, variant, true); break;
    case 'pine': pine(ctx, x, y, area, variant); break;
    case 'oak': oak(ctx, x, y, area, variant); break;
    case 'rock': rock(ctx, x, y, area, variant); break;
    case 'beacon': beacon(ctx, x, y, variant); break;
    case 'flowers': flowers(ctx, x, y, variant); break;
    default: smallProp(ctx, x, y, prop);
  }
}
