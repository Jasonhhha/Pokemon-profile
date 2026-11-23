import {
  cityAlleys, cityAlleyBarriers, cityCourtyards, cityForecourts, cityFountainSite, cityGateSites, cityParcels, cityStreet,
  cityTerraceFrontages, cityTerraces, cityTransit, harborHeight, ringBreakwaterSpans,
} from './field-city-layout';
import { maps, tileAt, type FieldLocation, type Tile } from './field-layout';
import { RING_PERIOD, ringAngle, ringPosition, ringRadius } from './field-ring-coordinates';
import type { StreetPoint } from './field-city-walks';

export const cityChartSize = { width: 560, height: 410 };
export const ringPlanExtent = ringRadius(harborHeight + 4.4);
export const ringSeaColor = '#2d7189';

const surveyInk: Record<Tile, string> = {
  lawn: '#355a5a', path: '#4c6666', grass: '#53735e', shore: '#63767a', shelf: '#31576a', water: '#203d52',
  dock: '#987d5d', stone: '#6a7577', quay: '#75858a', drop: '#1e3b50',
};
const landscapeInk: Record<Tile, string> = {
  lawn: '#9caf87', path: '#c9c0a4', grass: '#80a372', shore: '#d2c7a5', shelf: '#5ea9a8', water: '#347f8c',
  dock: '#b99661', stone: '#bbbcb1', quay: '#c4c5b6', drop: '#347f8c',
};
const surveyRoof = ['#829098', '#688b89', '#a08e78', '#6f8a97'];
const courtInk = {
  wharf: ['#746963', '#b6aa91'],
  garden: ['#537263', '#91a080'],
  market: ['#836b63', '#b59a83'],
  station: ['#666f79', '#a4aaa5'],
} as const;
const barrierInk = {
  brick: ['#3d4650', '#9e806c'],
  hedge: ['#334e43', '#748665'],
  iron: ['#324550', '#797f7b'],
  stone: ['#495257', '#a2998a'],
} as const;

function polarArc(ctx: CanvasRenderingContext2D, cx: number, cy: number, scale: number, start: number, end: number, inner: number, outer: number) {
  ctx.beginPath();
  const from = Math.PI / 2 - ringAngle(start);
  const to = Math.PI / 2 - ringAngle(end);
  ctx.arc(cx, cy, outer * scale, from, to, true);
  if (inner > 0) ctx.arc(cx, cy, inner * scale, to, from, false);
  else ctx.lineTo(cx, cy);
  ctx.closePath();
}

export function paintRingPlan(ctx: CanvasRenderingContext2D, cx: number, cy: number, scale: number, terrain = false) {
  const ink = terrain ? landscapeInk : surveyInk;
  const margin = ringPlanExtent * scale;
  const gradient = ctx.createRadialGradient(cx - margin * .13, cy - margin * .15, margin * .27, cx, cy, margin * (terrain ? 1 : 1.22));
  gradient.addColorStop(0, terrain ? '#36919a' : '#274a5c');
  if (terrain) gradient.addColorStop(.74, '#327e8d');
  gradient.addColorStop(1, terrain ? `${ringSeaColor}00` : '#162f42');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  for (let z = 0; z < maps.harbor.height; z++) {
    const inner = ringRadius(z);
    const outer = ringRadius(z + 1);
    for (let x = 0; x < RING_PERIOD; x++) {
      const tile = tileAt('harbor', x, z);
      if (tile === 'water' || tile === 'drop') continue;
      polarArc(ctx, cx, cy, scale, x - .001, x + 1.003, inner, outer + .004);
      ctx.fillStyle = ink[tile];
      ctx.fill();
    }
  }
  for (const lane of cityAlleys) {
    polarArc(ctx, cx, cy, scale, lane.x + .08, lane.x + lane.width - .08,
      ringRadius(lane.z + .12), ringRadius(lane.z + lane.depth - .12));
    ctx.fillStyle = terrain ? '#c0b39b' : '#667c7b';
    ctx.fill();
  }
  for (const court of cityForecourts) {
    polarArc(ctx, cx, cy, scale, court.x + .10, court.x + court.width - .10,
      ringRadius(court.z + .12), ringRadius(court.z + court.depth - .12));
    ctx.fillStyle = terrain ? '#bba28a' : '#976d5b';
    ctx.fill();
  }
  for (const court of cityCourtyards) {
    polarArc(ctx, cx, cy, scale, court.x + .08, court.x + court.width - .08,
      ringRadius(court.z + .13), ringRadius(court.z + court.depth - .13));
    ctx.fillStyle = courtInk[court.kind][terrain ? 1 : 0];
    ctx.fill();
    const { x, z, width, depth } = court.feature;
    polarArc(ctx, cx, cy, scale, x + .19, x + width - .19, ringRadius(z + .16), ringRadius(z + depth - .16));
    ctx.fillStyle = terrain ? '#777c6b' : '#334749';
    ctx.fill();
  }
  for (const barrier of cityAlleyBarriers) {
    const { x, z, width, depth, kind } = barrier;
    polarArc(ctx, cx, cy, scale, x + .11, x + width - .11,
      ringRadius(z + .16), ringRadius(z + depth - .16));
    ctx.fillStyle = barrierInk[kind][terrain ? 1 : 0];
    ctx.fill();
  }
  const paved = (radius: number, fill: string, width: number, dash: number[] = []) => {
    ctx.strokeStyle = fill;
    ctx.lineWidth = width * scale;
    ctx.setLineDash(dash.map(unit => unit * scale));
    ctx.beginPath();
    ctx.arc(cx, cy, radius * scale, 0, 2 * Math.PI);
    ctx.stroke();
    ctx.setLineDash([]);
  };
  const street = ringRadius(12.55);
  paved(street, terrain ? '#778a91' : '#586c75', .92);
  paved(street - .50, terrain ? '#eee0b9' : '#a69b80', .014);
  paved(street + .50, terrain ? '#eee0b9' : '#a69b80', .014);
  paved(street, terrain ? '#dbca8c' : '#c4b489', .018, [.16, .25]);
  if (!terrain) paved(ringRadius(cityTransit.railZ), '#d8bf86', .022, [.13, .18]);
  if (terrain) {
    ctx.fillStyle = '#eee0c0';
    for (const crossing of cityStreet.crossings) for (let stripe = 0; stripe < 6; stripe++) {
      const col = crossing - .31 + stripe * .126;
      polarArc(ctx, cx, cy, scale, col, col + .043, street - .40, street + .40);
      ctx.fill();
    }
    for (let z = 0; z < maps.harbor.height; z++) for (let x = 0; x < RING_PERIOD; x++) {
      if (tileAt('harbor', x, z) !== 'grass') continue;
      for (let seed = 0; seed < 7; seed++) {
        const p = ringPosition(x + (seed + .5) / 7, z + .17 + (seed * 19 % 23) / 35);
        ctx.fillStyle = seed % 2 ? '#688d70' : '#a3b58a';
        ctx.beginPath();
        ctx.arc(cx + p.x * scale, cy + p.z * scale, (.045 + seed % 3 * .009) * scale, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  if (!terrain) {
    const column = cityFountainSite.x + cityFountainSite.width / 2;
    const row = cityFountainSite.z + cityFountainSite.depth / 2;
    const basin = ringPosition(column, row);
    ctx.beginPath();
    ctx.ellipse(cx + basin.x * scale, cy + basin.z * scale, 1.39 * scale, .36 * scale, -ringAngle(column), 0, Math.PI * 2);
    ctx.fillStyle = '#6d9397';
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = '#beb39a';
    ctx.stroke();
    for (const [from, to] of ringBreakwaterSpans) {
      polarArc(ctx, cx, cy, scale, from, to, ringRadius(harborHeight + .33), ringRadius(harborHeight + .965));
      ctx.fillStyle = '#8c9994';
      ctx.fill();
    }
  }
}

export function cityChartPoint(x: number, z: number) {
  const { width, height } = cityChartSize;
  const scale = (height - 48) / (ringPlanExtent * 2);
  const position = ringPosition(x, z);
  return [width / 2 + position.x * scale, height / 2 + position.z * scale] as const;
}

export function drawCityChart(ctx: CanvasRenderingContext2D, location?: FieldLocation, walk?: { path?: StreetPoint[] }) {
  const { width, height } = cityChartSize;
  const cx = width * .5, cy = height * .50;
  const scale = (height - 48) / (ringPlanExtent * 2);
  const point = cityChartPoint;
  paintRingPlan(ctx, cx, cy, scale);

  for (const lot of cityParcels) {
    polarArc(ctx, cx, cy, scale, lot.x + .19, lot.x + lot.width - .19, ringRadius(lot.z + .16), ringRadius(lot.z + lot.depth - .16));
    ctx.fillStyle = surveyRoof[lot.finish % surveyRoof.length];
    ctx.fill();
    ctx.strokeStyle = lot.kind === 'archive' || lot.kind === 'station' ? '#efd09a' : '#baced164';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  for (const lot of cityTerraces) {
    const bay = lot.width / lot.homes;
    for (let unit = 0; unit < lot.homes; unit++) {
      const start = lot.x + unit * bay;
      polarArc(ctx, cx, cy, scale, start + .052, start + bay - .052,
        ringRadius(lot.z + .29), ringRadius(lot.z + lot.depth - .25));
      ctx.fillStyle = unit % 3 === 0 ? '#8f7770' : '#7b7e85';
      ctx.fill();
    }
    ctx.fillStyle = '#d3b58a';
    for (const front of cityTerraceFrontages(lot)) {
      if (lot.sideFront) {
        const edge = lot.sideFront === 'east' ? lot.x + lot.width : lot.x;
        polarArc(ctx, cx, cy, scale, edge - .055, edge + .055,
          ringRadius(front.z + .14), ringRadius(front.z + .86));
      } else {
        const edge = lot.facing === 'inner' ? lot.z : lot.z + lot.depth;
        polarArc(ctx, cx, cy, scale, front.x + .34, front.x + .66,
          ringRadius(edge - .09), ringRadius(edge + .09));
      }
      ctx.fill();
    }
  }

  ctx.fillStyle = '#8ca9ad';
  ctx.beginPath();
  ctx.arc(cx,cy,scale * 2.06,0,Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = '#edce91';
  ctx.stroke();
  ctx.fillStyle = '#e5cb9a';
  ctx.beginPath();
  ctx.arc(cx,cy,scale * .89,0,Math.PI * 2);
  ctx.stroke();
  for (const actor of maps.harbor.npcs) {
    const [x, y] = point(actor.x + .5, actor.y + .56);
    ctx.fillStyle = '#f1c088';
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const gate of maps.harbor.exits) {
    const [x, y] = point(gate.x + .5, gate.y + .56);
    ctx.strokeStyle = '#bce1e2';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.fillStyle = '#ceaa7a';
  for (const { x, z } of cityGateSites) {
    for (const side of [x + .04, x + .74]) {
      polarArc(ctx, cx, cy, scale, side, side + .22, ringRadius(z + .23), ringRadius(z + .77));
      ctx.fill();
    }
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '700 17px system-ui, sans-serif';
  ctx.fillStyle = '#f1e6cf';
  ctx.fillText('潮汐塔', cx, cy + 1);
  const labels = [[4.15, 12.5, '西栈桥'], [11.05, 14.6, '档案馆'], [22.85, 17.3, '外环绿廊'],
    [29.8, 10.35, '中央车站'], [37.65, 18, '东渡口'], ...cityCourtyards.map(court => [
      court.x + court.width / 2, court.z + court.depth / 2, court.label,
    ] as const)] as const;
  for (const [mapX, mapZ, text] of walk ? [] : labels) {
    const [x, y] = point(mapX, mapZ);
    const w = ctx.measureText(text).width + 13;
    ctx.fillStyle = '#203743c9';
    ctx.fillRect(x-w/2, y-11.5, w, 23);
    ctx.fillStyle = '#f0d9b2';
    ctx.fillText(text,x,y+.6);
  }
  ctx.textAlign = 'left';
  ctx.font = '600 14px system-ui, sans-serif';
  for (const court of walk ? [] : cityForecourts) {
    const [x, y] = point(court.x + court.width / 2, court.z + court.depth / 2);
    const [labelX, labelY] = court.id === 'sailmakers-forecourt' ? [369, 346] : [466, 179];
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(labelX - 14, labelY);
    ctx.lineTo(labelX, labelY);
    ctx.lineWidth = 1;
    ctx.strokeStyle = '#d3b58acc';
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x, y, 2.15, 0, Math.PI * 2);
    ctx.fillStyle = '#e7cba0';
    ctx.fill();
    ctx.fillText(court.label, labelX + 3, labelY);
  }
  ctx.strokeStyle = '#bad4ce35';
  ctx.strokeRect(17.5,17.5,width-35,height-35);
  ctx.fillStyle = '#b4cbce';
  ctx.textAlign = 'center';
  ctx.font = '700 13px ui-monospace, monospace';
  ctx.fillText('N', width - 36, 33);
  ctx.beginPath();
  ctx.moveTo(width - 36, 44);
  ctx.lineTo(width - 41, 55);
  ctx.lineTo(width - 31, 55);
  ctx.closePath();
  ctx.fill();

  ctx.textAlign = 'left';
  ctx.font = '600 13px system-ui, sans-serif';
  const key = [['#667c7b', '巷道'], ['#537263', '院落'], ['#3d4650', '围墙'], ['#ceaa7a', '拱门']];
  for (const [index, [color, name]] of key.entries()) {
    const y = height - 79 + index * 17;
    ctx.fillStyle = color;
    ctx.fillRect(33, y - 3, 12, 6);
    ctx.fillStyle = '#bdcfd0';
    ctx.fillText(name, 51, y);
  }

  if (walk?.path?.length && location) {
    ctx.beginPath();
    ctx.moveTo(...point(location.x + .5, location.y + .5));
    for (const tile of walk.path) ctx.lineTo(...point(tile.x + .5, tile.y + .5));
    ctx.save();
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.lineWidth = 5.6;
    ctx.strokeStyle = '#202c33';
    ctx.stroke();
    ctx.lineWidth = 2.8;
    ctx.strokeStyle = '#f7d189';
    ctx.stroke();
    ctx.restore();
  }
  if (location) {
    const [x,y] = point(location.x + .5, location.y + .54);
    ctx.beginPath();
    ctx.arc(x, y, 8.1, 0, Math.PI * 2);
    ctx.fillStyle = '#17282ce8';
    ctx.fill();
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = '#dfefad';
    ctx.stroke();
    ctx.fillStyle = '#e8fca8';
    ctx.fillRect(x - 4.1, y - 1.05, 8.2, 2.1);
    ctx.fillRect(x - 1.05, y - 4.1, 2.1, 8.2);
  }
}
