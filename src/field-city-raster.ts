import { cityParcels, cityStreet, cityTransit, cityViaductPiers, type CityParcel } from './field-city-layout';
import { TILE, tileAt } from './field-layout';
import { box, polygon } from './field-pixels';

type Foreground = { image: HTMLCanvasElement; x: number; y: number; depth: number };
const finishes = [
  { top: '#7b8586', rim: '#baa98e', front: '#c6ad8f', flank: '#927e6e', dark: '#695f56', highlight: '#e5c9a3' },
  { top: '#5b8b8b', rim: '#98a699', front: '#a2b4a7', flank: '#69847e', dark: '#4c6768', highlight: '#c9cfb6' },
  { top: '#846968', rim: '#975d52', front: '#b38774', flank: '#825e59', dark: '#5f4d4f', highlight: '#d8a992' },
  { top: '#6f8996', rim: '#8195a3', front: '#95a7ab', flank: '#586d79', dark: '#435864', highlight: '#c3d2ca' },
];
const px = (tile: number) => Math.round(tile * TILE);

export function drawRasterCityGround(ctx: CanvasRenderingContext2D) {
  for (let z = 0; z < 24; z++) {
    for (let x = 0; x < 40; x++) {
      const ground = tileAt('harbor', x, z);
      if (ground !== 'lawn' || z > 18 && x < 12) continue;
      const color = ['#9c9c84', '#9b9a89', '#a3a28d'][(x * 13 + z * 7) % 3];
      box(ctx, color, px(x), px(z), TILE, TILE);
      box(ctx, '#838777', px(x), px(z) + 15, TILE, 1);
      box(ctx, '#b2ad95', px(x) + ((x + z) % 2) * 6, px(z) + 7, 10, 1);
    }
  }
  const { west, east, north, south, crossings, railNorth, railSouth } = cityStreet;
  const from = px(west), end = px(east), top = px(north), bottom = px(south);
  box(ctx, '#687780', from, top + 7, end - from, bottom - top - 13);
  for (const y of [top + 3, bottom - 8]) {
    box(ctx, '#b8ad94', from, y, end - from, 5);
    box(ctx, '#d6c6a4', from, y, end - from, 1);
    for (let x = from + 3; x < end - 6; x += 12) box(ctx, '#a79984', x, y + 2, 1, 3);
  }
  for (const rail of [railNorth, railSouth]) {
    box(ctx, '#4d626a', from, px(rail), end - from, 2);
    box(ctx, '#c2ac85', from, px(rail) + 1, end - from, 1);
  }
  for (const crossing of crossings) {
    for (let i = 0; i < 5; i++) box(ctx, '#c8c5ad', px(crossing) - 2, top + 8 + i * 7, 5, 3);
  }
  for (const [x, z] of [[6.92, 13.88], [9.12, 14.01], [13.21, 14.17], [21.74, 14.2]]) {
    box(ctx, '#49565b', px(x) - 2, px(z), 5, 2);
    box(ctx, '#935f41', px(x) - 7, px(z) - 1, 14, 3);
    box(ctx, '#c18d5c', px(x) - 7, px(z) - 3, 14, 2);
  }
  for (const lot of cityParcels) {
    polygon(ctx, '#3a4f5555', [[px(lot.x) + 4, px(lot.z + lot.depth) - 11], [px(lot.x + lot.width) - 6, px(lot.z + lot.depth) - 10],
      [px(lot.x + lot.width) + 6, px(lot.z + lot.depth) + 9], [px(lot.x) + 15, px(lot.z + lot.depth) + 8]]);
  }
  const fountainX = px(24.1), fountainY = px(15.35);
  polygon(ctx, '#766c67', [[fountainX - 14, fountainY], [fountainX - 8, fountainY - 7], [fountainX + 7, fountainY - 7],
    [fountainX + 14, fountainY], [fountainX + 7, fountainY + 7], [fountainX - 8, fountainY + 7]]);
  box(ctx, '#43949a', fountainX - 8, fountainY - 3, 16, 6);
  box(ctx, '#c8b08b', fountainX - 2, fountainY - 8, 4, 10);
  box(ctx, '#d5e1bc', fountainX - 1, fountainY - 11, 2, 3);
}

function facade(lot: CityParcel): Foreground {
  const finish = finishes[lot.finish];
  const wide = px(lot.width) - 13;
  const wall = lot.stories * 9 + 7;
  const f = document.createElement('canvas');
  f.width = wide + 20;
  f.height = wall + 36;
  const d = f.getContext('2d')!;
  d.imageSmoothingEnabled = false;
  const start = 5, end = start + wide, bottom = f.height - 4, roof = bottom - wall, ridge = roof - 14;
  polygon(d, finish.flank, [[end, roof], [end + 10, ridge + 2], [end + 10, bottom - 9], [end, bottom], [end, roof]]);
  polygon(d, finish.top, [[start, roof], [start + 13, ridge], [end + 12, ridge], [end, roof]]);
  box(d, finish.dark, start - 1, roof, wide + 1, wall);
  box(d, finish.front, start + 1, roof + 2, wide - 2, wall - 3);
  box(d, finish.highlight, start - 1, roof + 3, wide + 2, 2);
  polygon(d, finish.rim, [[start - 2, roof + 1], [start + 11, ridge - 1], [end + 12, ridge - 1], [end + 12, ridge + 2],
    [start + 13, ridge + 2], [start + 1, roof + 4]]);
  box(d, finish.flank, start + 2, bottom - 10, wide - 4, 10);
  box(d, finish.rim, start + 1, bottom - 12, wide - 2, 2);

  const bays = Math.max(4, Math.round(wide / 12));
  const span = (wide - 9) / bays;
  for (let row = 0; row < lot.stories; row++) {
    const y = roof + 5 + row * 9;
    for (let bay = 0; bay < bays; bay++) {
      const x = Math.round(start + 5 + span * bay + span / 2);
      box(d, finish.dark, x - 3, y, 7, 7);
      box(d, ['#3c656f', '#597985', '#c5a778'][(bay + row * 7 + lot.finish * 4) % 3], x - 2, y + 1, 5, 4);
      box(d, finish.highlight, x - 3, y + 6, 7, 1);
    }
    box(d, finish.flank, end + 2, y - 3, 6, 1);
    box(d, '#55747c', end + 4, y, 3, 3);
  }
  if (lot.stories >= 3) {
    box(d, finish.dark, start + wide * .34, ridge - 7, wide * .31, 8);
    box(d, finish.rim, start + wide * .34 - 1, ridge - 8, wide * .31 + 2, 2);
    box(d, finish.top, start + wide * .42, ridge - 10, wide * .14, 3);
  }
  const center = Math.round((start + end) / 2);
  box(d, finish.highlight, center - 7, bottom - 14, 14, 3);
  box(d, '#46636b', center - 5, bottom - 11, 10, 10);
  box(d, '#8eabb0', center - 4, bottom - 10, 3, 7);
  box(d, '#b49b79', center - 8, bottom - 1, 16, 2);
  if (lot.kind === 'station') {
    box(d, '#3a5966', start - 2, bottom - 20, wide + 5, 5);
    box(d, '#aebca9', start - 2, bottom - 20, wide + 5, 1);
    box(d, '#ebd0a1', center - 3, bottom - 26, 6, 5);
  } else if (lot.kind === 'clinic') {
    box(d, '#dbd0ab', center - 8, bottom - 21, 16, 6);
    box(d, '#a86750', center - 3, bottom - 18, 6, 1);
    box(d, '#a86750', center - 1, bottom - 20, 2, 5);
  } else if (lot.kind === 'market') {
    box(d, '#a1725d', start - 1, bottom - 15, wide + 2, 4);
    for (let stripe = start; stripe <= end; stripe += 6) box(d, '#d6bd96', stripe, bottom - 15, 3, 4);
  }
  const worldBottom = px(lot.z + lot.depth) - 2;
  return { image: f, x: px(lot.x) + 3, y: worldBottom - bottom, depth: worldBottom };
}

export const makeRasterCityBuildings = () => cityParcels.map(facade);

export function drawRasterCityRail(ctx: CanvasRenderingContext2D, time = 0, reduced = false) {
  const { railZ, fromX, toX } = cityTransit;
  const deck = px(railZ) - 35;
  const from = px(fromX), span = px(toX) - from;
  for (const x of cityViaductPiers) {
    box(ctx, '#b6a68e', px(x) - 4, deck + 42, 9, 5);
    box(ctx, '#495c62', px(x) - 2, deck + 5, 5, 39);
    box(ctx, '#809398', px(x) - 1, deck + 5, 1, 37);
  }
  box(ctx, '#455960', from, deck, span, 8);
  box(ctx, '#a88d68', from, deck + 5, span, 1);
  box(ctx, '#859da0', from, deck, span, 2);
  for (let x = from + 2; x < from + span - 2; x += 5) box(ctx, '#294951', x, deck + 3, 2, 3);
  const fraction = reduced ? .15 : (1 + Math.sin(time / 4750 - 1.1)) / 2;
  const trainX = from + 5 + Math.round((span - 110) * fraction);
  for (const [other, color] of [[0, '#567a7d'], [41, '#568486']] as const) {
    box(ctx, '#c9bba0', trainX + other, deck - 12, 39, 3);
    box(ctx, color, trainX + other + 1, deck - 9, 37, 9);
    for (let window = 5; window < 36; window += 6) box(ctx, '#2f5364', trainX + other + window, deck - 8, 4, 4);
    box(ctx, '#ba7661', trainX + other + 1, deck - 2, 37, 2);
  }
}
