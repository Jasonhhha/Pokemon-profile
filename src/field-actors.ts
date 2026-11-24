import { box, polygon } from './field-pixels';

const actorColors = {
  player: { hat: '#e4e0b2', cap: '#a9ad90', coat: '#dd8c50', seam: '#a45c3f', detail: '#f6cc69', hair: '#493c47', pants: '#4b6570', skin: '#eac496' },
  guide: { hat: '#c18b66', cap: '#876149', coat: '#628f80', seam: '#4b675b', detail: '#e4c495', hair: '#694f46', pants: '#50636a', skin: '#e1ba90' },
  researcher: { hat: '#5a4e59', cap: '#423e52', coat: '#628b96', seam: '#4c6177', detail: '#d9dfc1', hair: '#594650', pants: '#596075', skin: '#edc193' },
  keeper: { hat: '#93b1a2', cap: '#628f8a', coat: '#6d8191', seam: '#505a76', detail: '#f1db9b', hair: '#46535e', pants: '#536575', skin: '#c99178' },
  healer: { hat: '#e9d0b5', cap: '#c79990', coat: '#e6dec3', seam: '#abaaa1', detail: '#b27f7b', hair: '#9b685f', pants: '#6e5973', skin: '#efc59a' },
  trial: { hat: '#e2dfc9', cap: '#344b59', coat: '#4d6874', seam: '#364954', detail: '#dcb67f', hair: '#4f495f', pants: '#485667', skin: '#d5a8a0' },
  spar: { hat: '#644959', cap: '#4d4252', coat: '#77677c', seam: '#5a536c', detail: '#edc592', hair: '#513d47', pants: '#4e5669', skin: '#cda089' },
};

type Direction = 'up' | 'down' | 'left' | 'right';

export function drawFieldActor(ctx: CanvasRenderingContext2D, style: keyof typeof actorColors, direction: Direction, frame: number, x: number, y: number) {
  const colors = actorColors[style];
  const { hair, pants, skin, hat, cap, coat, seam, detail } = colors;
  const outline = '#38394a';
  const step = frame === 1 ? 1 : frame === 2 ? -1 : 0;
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y));
  polygon(ctx, '#32484e3d', [[-6, -3], [5, -4], [12, 0], [15, 3], [11, 5], [4, 4], [-5, 2]]);
  box(ctx, '#283e4757', -5, -2, 11, 2);
  if (direction === 'left') ctx.scale(-1, 1);
  const side = direction === 'right' || direction === 'left';
  const back = direction === 'up';

  // Feet and coat edges have separate occlusion to keep each step visible at 1×.
  box(ctx, outline, -5, -6 - step, 5, 5);
  box(ctx, outline, 1, -6 + step, 5, 5);
  box(ctx, pants, -4, -6 - step, 3, 3);
  box(ctx, pants, 1, -6 + step, 3, 3);
  box(ctx, '#a19678', -4, -2 - step, 2);
  box(ctx, '#a19678', 2, -2 + step, 2);
  const bodyY = frame ? -1 : 0;
  ctx.translate(0, bodyY);
  polygon(ctx, outline, [[-5, -14], [4, -14], [7, -11], [7, -7], [5, -5], [-5, -5], [-7, -7], [-7, -11]]);
  if (style === 'trial') {
    polygon(ctx, outline, [[-5, -16], [4, -16], [8, -9], [8, -5], [-8, -5], [-8, -9]]);
    polygon(ctx, seam, [[-4, -15], [3, -15], [7, -8], [7, -6], [-7, -6], [-7, -8]]);
  }
  box(ctx, coat, -5, -13, 10, 7);
  box(ctx, seam, 3, -12, 2, 5);
  box(ctx, skin, -6, -9 + step, 2, 3);
  box(ctx, skin, 5, -9 - step, 2, 3);
  if (back) {
    box(ctx, style === 'player' ? '#3e5760' : seam, -4, -12, 8, 6);
    box(ctx, style === 'player' ? '#819b90' : detail, -3, -11, 6, 4);
    box(ctx, style === 'player' ? '#c1b192' : '#988378', -3, -8, 6);
  } else if (side) {
    box(ctx, seam, -5, -12, 4, 6);
    box(ctx, detail, 2, -12, 3, 2);
    box(ctx, skin, -2, -8 + step, 2, 3);
  } else {
    box(ctx, detail, -3, -12, 6, 2);
    box(ctx, seam, 0, -10, 1, 4);
    if (style === 'healer') box(ctx, detail, 2, -9, 2, 2);
    if (style === 'player') {
      box(ctx, '#efb579', -3, -8, 2, 2);
      box(ctx, '#657e75', 4, -8, 2, 3);
    }
  }
  if (style === 'guide') {
    polygon(ctx, outline, [[-7, -21], [1, -23], [6, -19], [7, -9 - step], [5, -8 - step], [-6, -8 + step], [-8, -10 + step]]);
    polygon(ctx, hair, [[-6, -20], [1, -22], [5, -19], [6, -9 - step], [3, -11], [-5, -9 + step], [-7, -11 + step]]);
    box(ctx, cap, -7, -15, 2, 4 + step);
    box(ctx, cap, 5, -14, 1, 4 - step);
    if (!back) box(ctx, detail, 4, -11, 2, 2);
  }

  polygon(ctx, outline, [[-5, -22], [4, -22], [7, -19], [7, -14], [4, -11], [-5, -11], [-7, -14], [-7, -19]]);
  box(ctx, hair, -6, -19, 12, 5);
  box(ctx, back ? hair : skin, -4, -16, 9, 4);
  if (back) box(ctx, cap, -4, -17, 8, 2);
  else if (side) {
    box(ctx, hair, -5, -17, 3, 4);
    box(ctx, skin, 4, -16, 2, 3);
    box(ctx, outline, 3, -16, 1, 2);
  } else {
    box(ctx, outline, -2, -16, 1, 2);
    box(ctx, outline, 2, -16, 1, 2);
    box(ctx, '#df9e88', -4, -14, 2);
    box(ctx, '#df9e88', 3, -14, 2);
    box(ctx, '#fff0be', -1, -13, 3);
  }

  const brim = side ? 8 : 7;
  box(ctx, outline, -6, -21, 12, 4);
  box(ctx, hat, -4, -22, 8, 4);
  box(ctx, hat, -5, -20, 10, 3);
  box(ctx, cap, -5, -18, 10);
  box(ctx, cap, 4, -20, 2, 3);
  if (style === 'guide') {
    box(ctx, cap, -5, -20, 7, 2);
    box(ctx, hat, -4, -21, 6);
    if (!back) {
      box(ctx, hair, -5, -18, 4, 2);
      box(ctx, '#e0aa87', 3, -19, 2);
    }
  } else if (style === 'researcher') {
    box(ctx, hair, -5, -22, 4, 2);
    box(ctx, cap, -4, -18, 5, 1);
    if (!back && !side) {
      box(ctx, hair, -4, -17, 3);
      box(ctx, hair, 1, -17, 3);
      box(ctx, '#918784', -1, -16, 2);
    }
  } else if (style === 'trial') {
    box(ctx, outline, -7, -23, 14, 5);
    box(ctx, hat, -6, -23, 12, 3);
    box(ctx, cap, -6, -20, 12, 2);
    if (!back) {
      box(ctx, detail, side ? 3 : -1, -21, 2, 2);
      box(ctx, outline, side ? 0 : -5, -18, side ? 8 : 10);
      if (!side) for (const row of [-10, -8]) {
        box(ctx, detail, -2, row, 1);
        box(ctx, detail, 2, row, 1);
      }
    }
  } else if (style === 'spar') {
    box(ctx, hair, -2, -23, 4, 2);
    box(ctx, detail, -6, -18, 12, 2);
    if (side || back) box(ctx, '#b08469', -7, -16, 2, 3);
    box(ctx, '#a8a594', -4, -10, 2, 3);
  } else if (!back) {
    box(ctx, outline, -brim, -17, brim * 2, 1);
    box(ctx, hat, -brim + 1, -18, brim * 2 - 2);
  }
  if (style === 'player') {
    box(ctx, '#f3e8ba', -3, -21, 5);
    box(ctx, '#6c9692', side ? 3 : -1, -20, 3, 2);
  }
  if (style === 'healer') box(ctx, '#bf837c', side ? 3 : -1, -21, 2, 2);
  ctx.restore();
}
