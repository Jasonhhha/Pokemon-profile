import { causeway, tidalInlet, TILE, width } from './field-layout';
import { box, polygon, type Point } from './field-pixels';
import { noise } from './field-texture';

const deckLeft = causeway.left * TILE;
const deckRight = (causeway.right + 1) * TILE;
const deckTop = causeway.top * TILE;
const deckBottom = (causeway.bottom + 1) * TILE;

export function drawCausewayTile(ctx: CanvasRenderingContext2D, tx: number, ty: number) {
  const x = tx * TILE;
  const y = ty * TILE;
  const edge = ty === causeway.top || ty === causeway.bottom;
  box(ctx, edge ? '#b6a994' : '#c4b18d', x, y, TILE, TILE);
  for (let course = 0; course < 2; course++) {
    const top = y + course * 8;
    const joint = 3 + (tx * 5 + course * 7 + ty * 2) % 10;
    const shaded = noise(tx, ty, course);
    if (shaded < .4) box(ctx, '#aaa18b', x + joint + 1, top, TILE - joint - 1, 7);
    if (shaded > .68) box(ctx, '#cfbd9d', x, top, joint, 7);
    box(ctx, '#988976', x + joint, top, 1, 7);
    box(ctx, '#978b78', x, top + 7, TILE);
    box(ctx, '#d6c4a3', x + 1, top + 1, joint - 1);
    box(ctx, '#d6c4a3', x + joint + 1, top + 1, Math.min(5, 15 - joint));
  }
  if (ty === causeway.top) {
    box(ctx, '#788174', x, y, TILE, 2);
    box(ctx, '#a5a18a', x, y + 2, TILE);
  }
  if (ty === causeway.bottom) {
    box(ctx, '#a29b85', x, y + 13, TILE);
    box(ctx, '#726f60', x, y + 14, TILE, 2);
  }
}

function quayBank(ctx: CanvasRenderingContext2D, x: number, top: number, waterSide: 1 | -1) {
  const start = waterSide > 0 ? x : x - 6;
  box(ctx, '#499a94', start + waterSide, top, 7, TILE);
  box(ctx, '#606f61', start, top, 6, TILE);
  box(ctx, '#9c9278', start + 1, top, 4, TILE);
  box(ctx, '#c4b393', waterSide > 0 ? x - 1 : x - 2, top, 3, TILE);
  for (let i = 0; i < TILE; i += 5) {
    box(ctx, '#777760', start + 1, top + i, 5);
    if (i < 12) box(ctx, '#a9a185', start + 2, top + i + 1, 3);
  }
}

function bankCorner(ctx: CanvasRenderingContext2D, previous: number, current: number, y: number) {
  const at = Math.min(previous, current);
  const w = Math.abs(previous - current) + 1;
  box(ctx, '#666f63', at, y - 2, w, 5);
  box(ctx, '#ad9f81', at, y - 2, w, 2);
  box(ctx, '#d0bd98', at + 1, y - 2, w - 2);
}

function pier(ctx: CanvasRenderingContext2D, x: number, top: number) {
  polygon(ctx, '#315b6178', [[x - 14, top], [x + 12, top - 2], [x + 22, top + 11], [x + 15, top + 20], [x - 16, top + 17]]);
  polygon(ctx, '#5a675e', [[x - 11, top - 1], [x + 10, top - 1], [x + 13, top + 13], [x + 9, top + 17], [x - 10, top + 17], [x - 13, top + 14]]);
  box(ctx, '#a1977d', x - 10, top + 1, 19, 13);
  box(ctx, '#b9aa89', x - 10, top + 2, 6, 10);
  box(ctx, '#817f6d', x + 6, top + 2, 4, 12);
  box(ctx, '#787e6e', x - 10, top + 6, 20);
  box(ctx, '#777c6d', x - 11, top + 12, 22);
  box(ctx, '#916f58', x - 2, top + 7, 1, 5);
  box(ctx, '#7db0a4', x - 13, top + 15, 25);
  box(ctx, '#69a69d', x - 14, top + 17, 23);
}

export function drawCausewayRelief(ctx: CanvasRenderingContext2D) {
  for (let row = 0; row < tidalInlet.length; row++) {
    if (row >= causeway.top && row <= causeway.bottom) continue;
    const [left, right] = tidalInlet[row];
    const y = row * TILE;
    quayBank(ctx, left * TILE, y, 1);
    if (right < width - 1) quayBank(ctx, (right + 1) * TILE, y, -1);
    if (!row || row === causeway.bottom + 1) continue;
    const [oldLeft, oldRight] = tidalInlet[row - 1];
    if (oldLeft !== left) bankCorner(ctx, oldLeft * TILE, left * TILE, y);
    if (oldRight !== right && oldRight < width - 1 && right < width - 1) bankCorner(ctx, (oldRight + 1) * TILE, (right + 1) * TILE, y);
  }

  const shadow: Point[] = [[deckLeft + 11, deckBottom - 1], [deckRight - 2, deckBottom - 1], [deckRight + 6, deckBottom + 11], [deckRight - 2, deckBottom + 21], [deckLeft + 16, deckBottom + 18]];
  polygon(ctx, '#305d5e68', shadow);
  for (const x of [545, 575, 605]) pier(ctx, x, deckBottom + 1);
  box(ctx, '#57685f', deckLeft, deckBottom - 1, deckRight - deckLeft, 7);
  box(ctx, '#a49277', deckLeft + 1, deckBottom, deckRight - deckLeft - 2, 5);
  box(ctx, '#c5b598', deckLeft + 1, deckBottom, deckRight - deckLeft - 2);
  for (let x = deckLeft + 6; x < deckRight - 3; x += 9) {
    box(ctx, '#877e69', x, deckBottom + 1, 1, 4);
    box(ctx, '#b0a183', x + 2, deckBottom + 2, 4);
  }

  for (const [x, y] of [[579, 103], [601, 148], [565, 249], [602, 271], [550, 316], [591, 341]]) {
    box(ctx, '#81b8ad', x - 6, y + 1, 10);
    box(ctx, '#4a7773', x - 3, y - 5, 6, 6);
    box(ctx, '#ba865e', x - 2, y - 5, 4, 5);
    box(ctx, '#dcc392', x - 2, y - 5, 4);
  }
}

export function makeCausewayRails() {
  const width = deckRight - deckLeft;
  return [deckTop + 3, deckBottom - 2].map((depth, index) => {
    const image = document.createElement('canvas');
    image.width = width;
    image.height = 18;
    const ctx = image.getContext('2d')!;
    const bottom = 15;
    box(ctx, '#5d6054', 2, bottom - 7, width - 4, 3);
    box(ctx, index === 0 ? '#b5a58a' : '#c7b697', 2, bottom - 7, width - 4);
    box(ctx, '#6a6c5e', 2, bottom - 3, width - 4, 2);
    for (let x = 3; x < width - 3; x += 13) {
      box(ctx, '#65685b', x, bottom - 8, 4, 9);
      box(ctx, '#a79d81', x + 1, bottom - 8, 2, 8);
      box(ctx, '#d5c39c', x - 1, bottom - 9, 6, 2);
      box(ctx, '#938872', x - 1, bottom, 6, 2);
    }
    return { image, x: deckLeft, y: depth - bottom, depth };
  });
}
