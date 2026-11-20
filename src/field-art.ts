import { maps, TILE, height, width, harborside, summitEdge, onCauseway, props, tileAt, type FieldArea, type Prop, type Tile } from './field-layout';
import { drawCausewayRelief, drawCausewayTile, makeCausewayRails } from './field-causeway';
import { box, polygon, type Point } from './field-pixels';
import { drawProp } from './field-structures';
import { noise, textureGround, type GroundMaterial } from './field-texture';
import { drawRasterCityGround, drawRasterCityRail, makeRasterCityBuildings } from './field-city-raster';
import { cityParcels } from './field-city-layout';

export { maps, TILE, type FieldArea, type FieldEvent, type FieldLocation, type FieldMap, type RoomId } from './field-layout';
export { drawFieldActor } from './field-actors';


const groundByTile: Record<Tile, GroundMaterial> = {
  lawn: 'meadow', path: 'dirt', grass: 'thicket', shore: 'sand', shelf: 'shallows',
  water: 'water', dock: 'wood', stone: 'pavers', quay: 'pavers', drop: 'drop',
};

const palettes = {
  harbor: { lawn: '#91a764', lawnLight: '#aabd77', lawnDark: '#728957', grass: '#628846', grassDark: '#3e7146', grassLight: '#a1bc61', path: '#ccb17d', pathLight: '#dec491', pathDark: '#ab956d', stone: '#b0a994', stoneLight: '#c7bea1', stoneDark: '#8b8778', water: '#227c8a', waterDark: '#236f80', shelf: '#4bb4a4', foam: '#bae2c6' },
  grove: { lawn: '#5e805e', lawnLight: '#799969', lawnDark: '#4f7357', grass: '#497451', grassDark: '#365e49', grassLight: '#82a063', path: '#b29a72', pathLight: '#c1ad83', pathDark: '#8d7f64', stone: '#7c8e7c', stoneLight: '#a2ac94', stoneDark: '#64796b', water: '#365d70', waterDark: '#324f61', shelf: '#588e8d', foam: '#a6c9ad' },
  summit: { lawn: '#918c9f', lawnLight: '#aaa3b1', lawnDark: '#7b7a90', grass: '#7a8b89', grassDark: '#637688', grassLight: '#b3bd96', path: '#baaa9f', pathLight: '#dbcbba', pathDark: '#978c99', stone: '#9e9daf', stoneLight: '#c3babe', stoneDark: '#74778e', water: '#536e8b', waterDark: '#405c79', shelf: '#82a4a8', foam: '#beccd0' },
};
type Palette = typeof palettes.harbor;

function canvas(w: number, h: number) {
  const image = document.createElement('canvas');
  image.width = w;
  image.height = h;
  const ctx = image.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  return { image, ctx };
}

function tuft(ctx: CanvasRenderingContext2D, x: number, y: number, dark: string, light: string, scale = 1) {
  box(ctx, dark, x, y + 1, scale, scale * 2);
  box(ctx, dark, x + scale, y + 3, 4 * scale, scale);
  box(ctx, dark, x + scale * 4, y + 1, scale, scale * 3);
  box(ctx, light, x + scale * 2, y, scale, scale * 3);
  box(ctx, light, x + scale * 3, y + 2, scale, scale);
}

function tileEdge(ctx: CanvasRenderingContext2D, x: number, y: number, side: number, color: string, accent?: string) {
  const edges = [[x, y, 16, 2], [x + 14, y, 2, 16], [x, y + 14, 16, 2], [x, y, 2, 16]];
  const [ex, ey, w, h] = edges[side];
  box(ctx, color, ex, ey, w, h);
  if (accent) box(ctx, accent, ex + (side === 3 ? 2 : 0), ey + (side === 0 ? 2 : 0), w === 16 ? 16 : 1, h === 16 ? 16 : 1);
}

function paving(ctx: CanvasRenderingContext2D, area: FieldArea, tx: number, ty: number, neighbors: Tile[]) {
  const x = tx * TILE;
  const y = ty * TILE;
  const p = palettes[area];
  const quay = area === 'harbor';
  const seam = quay ? '#948879' : p.stoneDark;
  const edge = quay ? '#d2c4a6' : p.stoneLight;
  box(ctx, p.stone, x, y, 16, 16);
  for (let row = 0; row < 2; row++) {
    const top = y + row * 8;
    const shift = 3 + (tx * 4 + ty * 3 + row * 7) % 10;
    const value = noise(tx, ty, row);
    const tone = value > .65 ? (quay ? '#bbad99' : '#aaa2b0') : value > .34 ? p.stone : (quay ? '#a69a86' : '#9694a6');
    box(ctx, tone, x, top, 16, 8);
    box(ctx, seam, x, top + 7, 16);
    box(ctx, seam, x + shift, top, 1, 7);
    if (shift > 7) box(ctx, edge, x + 1, top, shift - 2);
    box(ctx, edge, x + shift + 1, top, Math.min(5, 15 - shift));
    if (value > .72) box(ctx, seam, x + (shift + 10) % 14, top + 2, 2);
  }
  neighbors.forEach((value, side) => {
    if (groundByTile[value] !== 'pavers') {
      tileEdge(ctx, x, y, side, side === 0 || side === 3 ? edge : seam);
      if (side === 2) box(ctx, quay ? '#b3a18a' : p.stone, x, y + 13, 16);
    }
  });
}

function fern(ctx: CanvasRenderingContext2D, x: number, y: number, deep: string, soft: string) {
  box(ctx, deep, x, y - 6, 1, 7);
  for (let row = 0; row < 3; row++) {
    const span = 2 + row;
    box(ctx, deep, x - span, y - 5 + row * 2, 2 * span + 1);
    box(ctx, soft, x - span, y - 6 + row * 2, span);
    box(ctx, soft, x + span - 2, y - 4 + row * 2, 2);
  }
}

function drawTile(ctx: CanvasRenderingContext2D, area: FieldArea, tile: Tile, tx: number, ty: number) {
  const x = tx * TILE;
  const y = ty * TILE;
  const p = palettes[area];
  const neighbors = [tileAt(area, tx, ty - 1), tileAt(area, tx + 1, ty), tileAt(area, tx, ty + 1), tileAt(area, tx - 1, ty)];
  const variation = noise(tx, ty);
  if (area === 'harbor' && onCauseway(tx, ty)) {
    drawCausewayTile(ctx, tx, ty);
  } else if (tile === 'drop') {
    const band = Math.floor((ty + .5) * 2);
    box(ctx, ['#616f90', '#667495', '#6f83a0', '#7890a6'][(band + 2 * (tx % 2)) % 4], x, y, 16, 16);
  } else if (tile === 'lawn') {
    box(ctx, p.lawn, x, y, 16, 16);
    if (variation > .3) {
      const shift = Math.floor(noise(tx, ty, 22) * 10);
      const rise = Math.floor(noise(tx, ty, 31) * 10);
      tuft(ctx, x + shift, y + rise, p.lawnDark, p.lawnLight);
      if (variation > .63) box(ctx, p.lawnLight, x + 11 - shift, y + (rise + 7) % 14, 2);
      if (variation > .94) box(ctx, area === 'harbor' ? '#dfcf8a' : p.stoneLight, x + 7, y + 12, 2);
    }
    if (area === 'grove' && variation < .18) {
      box(ctx, '#a8a96f', x + 8, y + 5, 2);
      box(ctx, '#63794f', x + 7, y + 6, 4);
      box(ctx, '#65895a', x + 2, y + 10, 3);
    }
    if (area === 'grove' && variation > .88) fern(ctx, x + 6, y + 11, '#405f49', '#789862');
  } else if (tile === 'grass') {
    box(ctx, p.grass, x, y, 16, 16);
    box(ctx, p.grassDark, x + 1 + Math.floor(variation * 5), y + 12 + Math.floor(variation * 3), 8);
    tuft(ctx, x + (variation < .5 ? 1 : 5), y + Math.floor(variation * 5), p.grassDark, p.grassLight, 2);
    tuft(ctx, x + (variation < .5 ? 8 : 2), y + 7 + Math.floor(variation * 3), p.grassDark, p.grassLight);
    if (variation < .5) tuft(ctx, x + 11, y + 2, p.grassDark, p.grassLight);
    if (variation > .83) box(ctx, '#d4c78e', x + 11, y + 8, 2);
    neighbors.forEach((value, side) => { if (value !== 'grass') tileEdge(ctx, x, y, side, p.lawnDark); });
  } else if (tile === 'quay' || tile === 'stone') {
    paving(ctx, area, tx, ty, neighbors);
  } else if (tile === 'path') {
    box(ctx, p.path, x, y, 16, 16);
    neighbors.forEach((value, side) => {
      if (value === 'lawn' || value === 'grass' || value === 'shelf') {
        tileEdge(ctx, x, y, side, p.pathDark, side === 0 || side === 3 ? p.pathLight : undefined);
        const relief = 3 + Math.floor(noise(tx, ty, side + 12) * 8);
        if (side === 0) box(ctx, p.lawn, x + relief, y, 4);
        if (side === 2) box(ctx, p.lawnDark, x + relief, y + 15, 4);
        if (side === 1) box(ctx, p.lawn, x + 15, y + relief, 1, 4);
        if (side === 3) box(ctx, p.lawnDark, x, y + relief, 1, 4);
      }
    });
    if (variation > .2) {
      const shift = Math.floor(variation * 9);
      box(ctx, p.pathLight, x + shift + 1, y + 6, 3);
      box(ctx, p.pathDark, x + shift + 2, y + 7, 2);
      if (variation > .65) box(ctx, p.pathLight, x + 4, y + 11, 2);
      if (area === 'grove' && variation > .79) box(ctx, '#779463', x + 3, y + 10, 4);
    }
  } else if (tile === 'dock') {
    box(ctx, '#9d6c4e', x, y, 16, 16);
    box(ctx, '#be9260', x + 1, y, 14, 16);
    box(ctx, '#dbaf73', x + 1, y + 1, 1, 14);
    box(ctx, '#ad7d55', x + 10, y + 3, 1, 6);
    box(ctx, '#ad7d55', x + 6, y + 8, 1, 5);
    box(ctx, '#967052', x + 2, y + 3, 1);
    box(ctx, '#967052', x + 13, y + 12, 1);
    if (variation > .7) box(ctx, '#caa16b', x + 8, y + 4, 1, 6);
    if (ty === 11 || ty === 13) {
      const post = ty === 11 ? y + 1 : y + 11;
      box(ctx, '#705541', x, post, 16, 2);
      box(ctx, '#e0b77b', x, post, 16);
      if (!(tx % 2)) {
        box(ctx, '#604b3b', x + 11, post - 2, 4, 7);
        box(ctx, '#e8bd82', x + 11, post - 2, 3, 2);
      }
    }
  } else if (tile === 'shore') {
    box(ctx, '#d0ba84', x, y, 16, 16);
    box(ctx, '#a99970', x + 14, y, 2, 16);
    box(ctx, '#a3ad88', x, y, 3, 16);
    box(ctx, '#e1c895', x + 2, y, 3, 16);
    box(ctx, '#c3ac7c', x + 7, y + 5, 2, 2);
    if (variation > .45) box(ctx, '#f2dbad', x + 8, y + 12, 3);
    if (neighbors[0] === 'shelf' || neighbors[0] === 'water') tileEdge(ctx, x, y, 0, '#e4d3a1');
    if (neighbors[2] === 'shelf' || neighbors[2] === 'water') tileEdge(ctx, x, y, 2, '#e4d3a1');
  } else {
    const shelf = tile === 'shelf';
    box(ctx, shelf ? p.shelf : p.water, x, y, 16, 16);
    if (variation > .22) {
      const shift = Math.floor(variation * 8);
      box(ctx, shelf ? p.foam : p.waterDark, x + shift, y + 2 + (shift * 3 % 7), 3 + Math.floor(variation * 6));
      if (variation > .72) box(ctx, shelf ? p.foam : p.waterDark, x + (9 - shift), y + 11 + shift % 4, 6);
    }
    if (shelf) neighbors.forEach((value, side) => {
      if (value === 'shore') tileEdge(ctx, x, y, side, p.foam);
      if (value === 'water' && side === 3) box(ctx, area === 'harbor' ? '#4da79b' : '#578486', x, y, 2, TILE);
    });
  }
}

const ledgeColors = {
  harbor: ['#b1ba79', '#d4c6a5', '#9b8e76', '#7f7568', '#5e6158'],
  grove: ['#98a379', '#9da186', '#737b68', '#53685d', '#41554e'],
  summit: ['#cabec2', '#aaa6b8', '#817f99', '#696f8b', '#515d79'],
};

function wall(ctx: CanvasRenderingContext2D, area: FieldArea, contour: Point[], depth: number) {
  const [grass, cap, light, middle, dark] = ledgeColors[area];
  const bottom: Point[] = contour.map(([x, y]) => [x + 3, y + depth]);
  polygon(ctx, dark, [...contour, ...[...bottom].reverse()]);
  for (let index = 1; index < contour.length; index++) {
    const [left, top] = contour[index - 1];
    const [right, end] = contour[index];
    const [farX, farY] = bottom[index];
    const [nearX, nearY] = bottom[index - 1];
    const span = right - left;
    const at = (x: number) => Math.round(top + (end - top) * (x - left) / span);
    polygon(ctx, end < top ? light : middle, [[left + 1, top + 2], [right, end + 2], [farX - 1, farY - 2], [nearX - 1, nearY - 2]]);
    polygon(ctx, light, [[left, top + 1], [right, end + 1], [farX - 2, farY - Math.floor(depth * .46)], [nearX - 2, nearY - Math.floor(depth * .46)]]);
    polygon(ctx, cap, [[left, top - 1], [right, end - 1], [right + 1, end + 3], [left + 1, top + 3]]);
    polygon(ctx, grass, [[left, top - 2], [right, end - 2], [right, end], [left, top]]);
    for (let offset = 5; offset < span - 3; offset += 6 + Math.floor(noise(left, offset) * 7)) {
      const x = left + offset;
      const y = at(x);
      const run = 3 + Math.floor(noise(x, y) * 7);
      const lip = 4 + Math.floor(noise(y, x) * Math.max(4, depth - 8));
      box(ctx, cap, x, y + 4, run, 1);
      box(ctx, middle, x + 2, y + lip, run, 1);
      if (depth > 12) {
        box(ctx, dark, x + 4, y + lip + 2, 2, Math.floor(depth / 4));
        box(ctx, light, x + 6, y + lip + 3, 2, Math.floor(depth / 5));
      }
    }
  }
}

function inlaidRosette(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, colors: [outline: string, rim: string, centre: string]) {
  const [outline, rim, centre] = colors;
  const low = Math.floor(radius * .48);
  const ring: Point[] = [[x - radius, y], [x - low, y - low], [x + low, y - low], [x + radius, y], [x + low, y + low], [x - low, y + low]];
  polygon(ctx, outline, ring);
  polygon(ctx, rim, ring.map(([px, py]) => [x + Math.round((px - x) * .93), y + Math.round((py - y) * .85)]));
  polygon(ctx, centre, ring.map(([px, py]) => [x + Math.round((px - x) * .86), y + Math.round((py - y) * .73)]));
  polygon(ctx, outline, [[x, y - low + 1], [x + 3, y - 2], [x + radius - 4, y], [x + 3, y + 2], [x, y + low - 1], [x - 3, y + 2], [x - radius + 4, y], [x - 3, y - 2]]);
  polygon(ctx, rim, [[x, y - low + 2], [x + 2, y - 1], [x + radius - 7, y], [x + 1, y + 1], [x, y + low - 2], [x - 1, y + 1], [x - radius + 7, y], [x - 2, y - 1]]);
  box(ctx, centre, x, y - 1, 1, 2);
}

function harborRelief(ctx: CanvasRenderingContext2D) {
  for (let y = 1; y < height - 1; y++) {
    const x = harborside[y] * TILE;
    const top = y * TILE;
    if (y >= 11 && y <= 13) continue;
    for (let course = 0; course < 4; course++) {
      const offset = course * 4;
      const stain = noise(y, course, 24);
      box(ctx, '#6f7360', x - 9, top + offset, 10, 4);
      box(ctx, stain > .55 ? '#b2aa89' : '#a69e81', x - 8, top + offset, 8, 3);
      box(ctx, '#bbb597', x - 7, top + offset, 7);
      if (stain > .65) box(ctx, '#797b63', x - 6 + Math.floor(stain * 4), top + offset + 1, 1, 2);
    }
    box(ctx, '#d5c8a5', x - 2, top, 3, TILE);
    box(ctx, '#9dac64', x + 1, top, 2, TILE);
    if (harborside[y - 1] !== harborside[y]) {
      const prior = harborside[y - 1] * TILE;
      const start = Math.min(x, prior) - 3;
      box(ctx, '#a89e80', start, top - 1, 18, 5);
      box(ctx, '#ded0a5', start, top - 2, 19, 2);
    }
  }
  wall(ctx, 'harbor', [[103, 90], [141, 85], [202, 85], [218, 92], [295, 89], [323, 95], [360, 95]], 12);
  wall(ctx, 'harbor', [[380, 86], [401, 80], [460, 80], [489, 86], [525, 90], [556, 90]], 15);
  wall(ctx, 'harbor', [[124, 295], [140, 291], [196, 293], [223, 300], [263, 299]], 9);
  inlaidRosette(ctx, 164, 199, 19, ['#8a796d', '#d6c6a7', '#b3a590']);

  // Pilings continue beneath the deck at the low-water line.
  box(ctx, '#765947', 16, 221, 96, 5);
  box(ctx, '#c99e67', 17, 221, 94, 1);
  for (let x = 20; x < 105; x += 16) {
    box(ctx, '#2e696c', x - 1, 223, 8, 12);
    box(ctx, '#a4cdbb', x - 2, 236, 10);
    box(ctx, '#725745', x, 223, 5, 11);
    box(ctx, '#ac855b', x, 223, 2, 10);
  }
  for (const [left, top, span] of [[10, 168, 24], [9, 260, 21], [28, 275, 17], [36, 129, 27], [44, 265, 9], [21, 285, 27], [50, 238, 24]]) {
    box(ctx, '#73b8af', left, top, span, 1);
    box(ctx, '#429ea0', left + 6, top + 1, span - 4, 1);
  }
}

function groveRelief(ctx: CanvasRenderingContext2D) {
  wall(ctx, 'grove', [[0, 108], [39, 108], [61, 100], [112, 100], [134, 89], [198, 89], [220, 94]], 17);
  wall(ctx, 'grove', [[264, 111], [284, 103], [312, 103], [340, 101], [366, 109], [419, 109], [435, 119]], 11);
  wall(ctx, 'grove', [[472, 91], [505, 87], [535, 87], [569, 100], [616, 100], [640, 94]], 18);
  wall(ctx, 'grove', [[0, 307], [38, 295], [65, 295], [83, 303], [107, 302], [132, 317], [162, 319]], 12);
  wall(ctx, 'grove', [[210, 311], [243, 304], [270, 306], [290, 298], [322, 305], [355, 317]], 13);
  inlaidRosette(ctx, 232, 170, 12, ['#6f7254', '#a89a6a', '#837f56']);
  for (const [x, y, w] of [[280, 127, 16], [289, 133, 25], [309, 153, 16], [347, 133, 24], [365, 146, 21], [378, 145, 13], [389, 134, 12]]) {
    box(ctx, '#6d9a94', x, y, w, 1);
    box(ctx, '#416474', x + 4, y + 1, w - 4, 1);
    box(ctx, '#688b82', x + 1, y + 4, w - 3, 1);
  }
  for (const [x, y] of [[314, 111], [355, 120], [392, 113], [424, 131]]) {
    polygon(ctx, '#354e625e', [[x - 8, y], [x + 12, y + 4], [x + 4, y + 10], [x + 8, y + 13], [x, y + 17], [x - 10, y + 8]]);
    box(ctx, '#496b745a', x - 5, y + 10, 10);
  }
}

function summitRelief(ctx: CanvasRenderingContext2D) {
  const contour: Point[] = [[0, summitEdge[0] * TILE]];
  for (let x = 1; x < summitEdge.length; x++) {
    if (summitEdge[x] === summitEdge[x - 1]) continue;
    contour.push([(x - 1) * TILE + 8, summitEdge[x - 1] * TILE], [x * TILE + 7, summitEdge[x] * TILE]);
  }
  contour.push([width * TILE, summitEdge.at(-1)! * TILE]);
  ctx.save();
  ctx.beginPath();
  for (const [x, y] of contour) ctx.lineTo(x, y - 2);
  ctx.lineTo(ctx.canvas.width, ctx.canvas.height);
  ctx.lineTo(0, ctx.canvas.height);
  ctx.closePath();
  ctx.clip();
  const haze = ctx.createLinearGradient(0, 220, 0, 384);
  haze.addColorStop(0, '#8da2bc');
  haze.addColorStop(.65, '#718da9');
  haze.addColorStop(1, '#bac3cf');
  ctx.fillStyle = haze;
  ctx.fillRect(0, 218, ctx.canvas.width, 168);
  polygon(ctx, '#71849f', [[0, 357], [43, 331], [80, 336], [118, 315], [190, 343], [248, 307], [295, 314], [350, 278], [372, 285], [416, 253], [456, 281], [525, 300], [568, 268], [624, 243], [640, 258], [640, 384], [0, 384]]);
  polygon(ctx, '#8493ac', [[168, 384], [264, 354], [323, 375], [383, 350], [421, 357], [502, 309], [548, 318], [640, 285], [640, 384]]);
  for (const [x, y, span] of [[12, 366, 75], [114, 350, 87], [286, 339, 75], [392, 317, 70], [485, 315, 98], [553, 285, 91], [619, 305, 42]]) {
    polygon(ctx, '#b9c3d0', [[x, y], [x + 10, y - 3], [x + 29, y - 3], [x + 42, y - 6], [x + span - 14, y - 5], [x + span, y - 1], [x + span - 9, y + 3], [x + 12, y + 3]]);
    box(ctx, '#c9cdd6', x + 7, y - 1, span - 21);
  }
  ctx.restore();
  wall(ctx, 'summit', contour, 21);
  wall(ctx, 'summit', [[0, 129], [32, 121], [76, 106], [112, 106], [144, 114], [166, 111]], 18);
  wall(ctx, 'summit', [[232, 120], [265, 107], [301, 111], [324, 95], [371, 95], [411, 104]], 19);
  wall(ctx, 'summit', [[538, 98], [575, 97], [600, 105], [640, 105]], 19);
  wall(ctx, 'summit', [[113, 329], [151, 319], [187, 324], [221, 323], [242, 326]], 11);
  inlaidRosette(ctx, 504, 164, 24, ['#766f87', '#c8b7a9', '#a59aad']);
}

function terrainRelief(ctx: CanvasRenderingContext2D, area: FieldArea) {
  if (area === 'harbor') {
    harborRelief(ctx);
    drawCausewayRelief(ctx);
  }
  else if (area === 'grove') groveRelief(ctx);
  else summitRelief(ctx);
}

function propShadow(ctx: CanvasRenderingContext2D, x: number, y: number, prop: Prop, area: FieldArea) {
  const shade = area === 'grove' ? '#233a3b52' : area === 'summit' ? '#4956754d' : '#3a494648';
  const lighter = area === 'grove' ? '#253d412c' : area === 'summit' ? '#3845642c' : '#31404826';
  const kind = prop.kind;
  if (kind === 'cottage' || kind === 'station') {
    polygon(ctx, lighter, [[x - 36, y - 22], [x + 26, y - 31], [x + 56, y - 18], [x + 69, y - 4], [x + 64, y + 14], [x + 25, y + 23], [x - 21, y + 15], [x - 38, y + 2]]);
    polygon(ctx, shade, [[x - 32, y - 23], [x + 23, y - 29], [x + 47, y - 18], [x + 61, y - 4], [x + 55, y + 11], [x + 28, y + 16], [x - 22, y + 12], [x - 34, y + 1]]);
  } else if (kind === 'oak' || kind === 'pine') {
    const length = kind === 'oak' ? 27 : 33;
    polygon(ctx, lighter, [[x - 11, y - 2], [x + 4, y - 6], [x + 11, y - 2], [x + length + 7, y + 5], [x + length, y + 12], [x + 14, y + 12], [x + 9, y + 7], [x - 8, y + 5]]);
    polygon(ctx, shade, [[x - 5, y - 2], [x + 8, y - 3], [x + 13, y + 1], [x + length + 2, y + 4], [x + length - 2, y + 10], [x + 19, y + 10], [x + 7, y + 4], [x - 5, y + 2]]);
  } else if (kind === 'beacon' || kind === 'lamp') {
    const w = kind === 'beacon' ? 10 : 2;
    const length = kind === 'beacon' ? 32 : 16;
    polygon(ctx, shade, [[x - w, y - 2], [x, y - 5], [x + length + w, y + 9], [x + length - 2, y + 11], [x - w, y + 2]]);
  }
}

type Foreground = { image: HTMLCanvasElement; x: number; y: number; depth: number };

export function makeMapArt(area: FieldArea): { base: HTMLCanvasElement; foreground: Foreground[] } {
  const { image: base, ctx } = canvas(width * TILE, height * TILE);
  const tiles = Array.from({ length: height }, (_, y) => Array.from({ length: width }, (_, x) => tileAt(area, x, y)));
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) drawTile(ctx, area, tiles[y][x], x, y);
  terrainRelief(ctx, area);
  textureGround(ctx, area, tiles.map(row => row.map(tile => groundByTile[tile])), TILE);
  if (area === 'harbor') drawRasterCityGround(ctx);
  const visibleProps = props[area].filter(({ x, y, kind }) => tiles[y][x] !== 'drop' && (area !== 'harbor' ||
    kind !== 'cottage' && kind !== 'station' && !cityParcels.some(lot =>
      x >= lot.x && x < lot.x + lot.width && y >= lot.z && y < lot.z + lot.depth)));
  for (const prop of visibleProps) propShadow(ctx, prop.x * TILE + 8, prop.y * TILE + 15, prop, area);
  const foreground = visibleProps.flatMap(prop => {
    const left = prop.x * TILE + 8;
    const bottom = prop.y * TILE + 15;
    const kind = prop.kind;
    if (kind === 'flowers' || kind === 'boat') {
      drawProp(ctx, area, prop, left, bottom);
      return [];
    }
    const w = kind === 'cottage' || kind === 'station' ? 96 : kind === 'fence' ? 72 : 60;
    const h = kind === 'station' ? 81 : kind === 'cottage' ? 76 : 62;
    const center = kind === 'fence' ? 8 : w / 2;
    const foot = h - 5;
    const { image, ctx: sprite } = canvas(w, h);
    drawProp(sprite, area, prop, center, foot);
    return [{ image, x: left - center, y: bottom - foot, depth: bottom }];
  });
  if (area === 'harbor') foreground.push(...makeRasterCityBuildings(), ...makeCausewayRails());
  return { base, foreground };
}

const effects = Object.fromEntries((['harbor', 'grove', 'summit'] as const).map(area => [
  area,
  Array.from({ length: height }, (_, y) => Array.from({ length: width }, (_, x) => ({ x, y, tile: tileAt(area, x, y) }))).flat().filter(({ x, y, tile }) => {
    if (tile === 'shelf' || tile === 'water') return noise(x, y, 9) > .38;
    return tile === 'grass' && noise(x, y, 9) > .74;
  }),
])) as Record<FieldArea, { x: number; y: number; tile: Tile }[]>;

function windOnWater(ctx: CanvasRenderingContext2D, time: number) {
  for (let row = 4; row < height - 1; row++) {
    if (row >= 10 && row <= 14) continue;
    const coast = harborside[row] * TILE;
    const depth = Math.sin(time / 760 + row * .88);
    const x = coast - 16 - Math.floor((depth + 1) * 3);
    const y = row * TILE + Math.floor(noise(row, 22) * 6);
    ctx.globalAlpha = .28 + .21 * (depth + 1) / 2;
    box(ctx, '#d0eed5', x, y, 1, 10);
    box(ctx, '#bfd9c6', x + 1, y + 2, 1, 3);
    box(ctx, '#d0eed5', x - 2, y + 7, 2, 1);
  }
}

function driftingMist(ctx: CanvasRenderingContext2D, area: 'grove' | 'summit', time: number) {
  const bands = area === 'grove' ? 9 : 17;
  for (let index = 0; index < bands; index++) {
    const place = noise(index, 7, 10);
    const origin = (Math.floor(time * (.003 + place * .004)) + index * 79) % 730 - 30;
    const rise = Math.round(Math.sin(time / 1800 + index) * 3);
    const top = area === 'grove' ? 110 + Math.floor(place * 204) + rise : 271 + Math.floor(place * 113) + rise;
    const length = Math.floor(23 + noise(index, 22) * 53);
    for (let segment = 0; segment < length; segment += 8) {
      const x = origin + segment;
      if (area === 'summit' && top < (summitEdge[Math.floor(x / TILE)] ?? height) * TILE + 23) continue;
      const tint = Math.sin(segment / length * Math.PI);
      ctx.globalAlpha = area === 'grove' ? tint * .12 : tint * .45;
      box(ctx, area === 'grove' ? '#cbdbc0' : '#d7dadd', x, top, 8, 1);
      ctx.globalAlpha *= .6;
      box(ctx, area === 'grove' ? '#dce4c9' : '#e6e5e4', x + 3, top + 1, 8, 1);
    }
  }
}

export function drawMapEffects(ctx: CanvasRenderingContext2D, area: FieldArea, time: number, reduceMotion = false) {
  if (area === 'harbor') drawRasterCityRail(ctx, time, reduceMotion);
  if (reduceMotion) return;
  const p = palettes[area];
  const tick = Math.floor(time / 165);
  ctx.save();
  if (area === 'harbor') windOnWater(ctx, time);
  else driftingMist(ctx, area, time);
  for (const { x, y, tile } of effects[area]) {
    const index = Math.floor(noise(x, y, 6) * 17);
    if (tile === 'grass') {
      if ((tick + index) % 7 < 3) {
        ctx.globalAlpha = .55;
        box(ctx, p.grassLight, x * TILE + 6 + (index % 3), y * TILE + 2, 1, 3);
      }
      continue;
    }
    const phase = (tick + index) % 16;
    if (phase > 12) continue;
    const left = x * TILE + phase % 6;
    const top = y * TILE + 3 + index % 10;
    ctx.globalAlpha = .13 + Math.min(phase, 12 - phase) * .047;
    box(ctx, p.foam, left, top, 3 + phase % 6);
    if (phase > 3 && phase < 10) box(ctx, p.foam, left + 4, top - 1, 5);
  }

  const airColors = { harbor: '#fbdf9a', grove: '#d3e1b7', summit: '#eeedf3' };
  for (let i = 0; i < 26; i++) {
    const seed = noise(i, 12);
    const x = (Math.floor(time * (.012 + seed * .016)) + Math.floor(noise(i, 4) * 640)) % 640;
    const y = (Math.floor(noise(i, 7) * 384) + Math.round(Math.sin(time / 880 + i) * 7)) % 384;
    if (area === 'harbor' && x < 98) continue;
    ctx.globalAlpha = area === 'summit' ? .48 : .36;
    box(ctx, airColors[area], x, y, i % 4 === 0 ? 2 : 1);
  }
  ctx.restore();
}

export function drawGrassCover(ctx: CanvasRenderingContext2D, area: FieldArea, x: number, y: number, time: number, reduceMotion = false) {
  const tx = Math.floor(x / TILE);
  const ty = Math.floor(y / TILE);
  if (!maps[area].grass[ty]?.[tx]) return;
  const p = palettes[area];
  const wind = reduceMotion ? 0 : Math.floor(time / 105) % 2;
  box(ctx, p.grassDark, x - 8, y - 1, 15);
  tuft(ctx, x - 7, y - 4 - wind, p.grassDark, p.grassLight);
  tuft(ctx, x - 2 + wind, y - 4, p.grassDark, p.grassLight);
  tuft(ctx, x + 3, y - 3 - wind, p.grassDark, p.grassLight);
}
