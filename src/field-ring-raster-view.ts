import { drawFieldActor } from './field-actors';
import { paintRingPlan, ringPlanExtent, ringSeaColor } from './field-city-chart';
import type { SurveyId } from './field-city-walks';
import { bastionRadius, drawBastionSea, drawRasterBastion } from './fortress-exterior-2d';
import { fortressLiftDepth } from './field-fortress-state';
import { creatureGaits, type FieldCreature } from './field-creature-motion';
import {
  cityAlleyBarriers, cityCourtyards, cityForecourts, cityFountainSite, cityGateSites, cityLighthouseSite, cityParcels, cityStreet, cityTerraces,
  cityTransit, cityViaductPiers, harborHeight, ringBreakwaterSpans, type CityCourtyard,
} from './field-city-layout';
import { props, TILE, tileAt } from './field-layout';
import { companionPosition, type FieldView } from './field-renderer';
import {
  frameStreetSubject, harborOverviewYaw, RING_PERIOD, ringAngle, ringCoordinates, ringOverviewCamera, ringPosition, ringRadius,
  ringStreetLooksOutward, ringStreetRow, ringXDelta,
} from './field-ring-coordinates';

type Point = { x: number; y: number };
type World = { x: number; z: number };
type Volume = { footprint: World[]; bottom: number; top: number };
type WorldPoint = readonly [World, number];
type Face = { point: (fraction: number) => World; span: number; parts: number };
type BuildingPlan = {
  x: number; z: number; width: number; depth: number; eave: number; ridge: number;
  wall: string; finish: number; style: 'wharf' | 'shops' | 'garden' | 'civic';
  front: 'inner' | 'outer' | 'east' | 'west'; floors: number; name: string; landmark?: string;
};
type RasterLayer = {
  point: World;
  radius?: number;
  top?: number;
  volume?: Volume;
  picks?: readonly WorldPoint[][];
  entrance?: readonly WorldPoint[];
  survey?: SurveyId;
  draw: () => void;
};
const stoneTrim = '#dfc9a3';
const roofTypes = [['#566b75', '#3a4c59'], ['#546d6e', '#364c55'], ['#666a6e', '#414953']] as const;
const civicWalls = ['#c3a27a', '#a6705b', '#baa07c', '#9d6e56'];
const brickWalls = ['#a15d48', '#8b594a', '#b58062', '#a26250', '#b89672'];
const gardenWalls = ['#bfa281', '#d1b68d', '#b9a58b', '#c1a17a'];
const shopColors = ['#263e47', '#315450', '#534151', '#4d4e3d'];
const civicNames: Record<string, string> = { archive: 'HARBOUR ARCHIVE', clinic: 'HARBOUR CLINIC', market: 'SALT EXCHANGE', station: 'TIDEPORT STATION', warehouse: 'QUAY WORKS' };
const barrierFinishes = {
  brick: [.85, '#956d58', '#765647', '#c5a281'],
  hedge: [.61, '#68846a', '#47644f', '#879b73'],
  iron: [.82, '#626961', '#374b4b', '#919384'],
  stone: [.62, '#a59884', '#817a69', '#c5b6a0'],
} as const;

const pigments = new Map<string, string>();

function tone(color: string, strength: number, blue = 1) {
  const key = `${color}:${strength}:${blue}`;
  const saved = pigments.get(key);
  if (saved) return saved;
  const ink = Number.parseInt(color.slice(1), 16);
  const channel = (shift: number, cast = 1) => Math.min(255, Math.round((ink >> shift & 255) * strength * cast));
  const value = `#${(channel(16) * 65536 + channel(8) * 256 + channel(0, blue)).toString(16).padStart(6, '0')}`;
  pigments.set(key, value);
  return value;
}

function atlasTile(ctx: CanvasRenderingContext2D, scale: number, from: number, to: number, inner: number, outer: number, color: string) {
  const start = Math.PI / 2 - ringAngle(from), end = Math.PI / 2 - ringAngle(to);
  ctx.beginPath();
  ctx.arc(0, 0, outer * scale, start, end, true);
  ctx.arc(0, 0, inner * scale, end, start);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

function waterTile(x: number, y: number) {
  if (y < 0 || y >= harborHeight) return true;
  const kind = tileAt('harbor', (x + RING_PERIOD) % RING_PERIOD, y);
  return kind === 'water' || kind === 'shelf' || kind === 'drop';
}

function textureTerrain(ctx: CanvasRenderingContext2D, scale: number) {
  ctx.save();
  ctx.translate(ctx.canvas.width / 2, ctx.canvas.height / 2);
  const stone = ['#57473622', '#ede4c743', '#6d675733', '#e9d9b63f'];
  for (let ring = 0; ring < 31; ring++) {
    const radius = 1.01 + ring * .87;
    for (let streak = 0; streak < Math.max(10, ring * 2.1); streak++) {
      const phase = (streak * 17.617 + ring * 7.291) % RING_PERIOD;
      const length = .13 + ((streak * 17 + ring * 13) % 21) / (radius + 13);
      const row = Math.floor((radius - ringRadius(0)) / .48);
      if (!waterTile(Math.floor(phase), row) || !waterTile(Math.floor((phase + length) % RING_PERIOD), row)) continue;
      atlasTile(ctx, scale, phase, phase + length, radius, radius + (streak % 4 === 2 ? .044 : .025),
        ['#9ed1d126', '#8ac2cc28', '#224b621f', '#85c2c133'][streak % 4]);
    }
  }
  for (let row = 0; row < harborHeight; row++) for (let col = 0; col < RING_PERIOD; col++) {
    if (waterTile(col, row)) continue;
    const tile = tileAt('harbor', col, row);
    const inner = ringRadius(row), outer = ringRadius(row + 1);
    if (tile !== 'grass' && tile !== 'lawn') {
      const boulevard = row >= 11 && row <= 13;
      const courses = tile === 'dock' ? 5 : 3;
      const bricks = tile === 'dock' ? 2 : Math.ceil(inner / 3.5);
      for (let course = 0; course < courses; course++) {
        const depth = (outer - inner) / courses;
        for (let index = 0; index <= bricks; index++) {
          const offset = course % 2 ? .45 : 0;
          const start = col + Math.max(0, (index - offset) / bricks);
          const end = col + Math.min(1, (index + 1 - offset) / bricks);
          if (end - start < .023) continue;
          const from = inner + course * depth;
          const indexColor = (col * 31 + row * 17 + course * 7 + index * 13) % stone.length;
          atlasTile(ctx, scale, start + .009, end - .009, from + .012, from + depth - .014,
            boulevard && tile !== 'dock' ? ['#505c6948', '#98aaac3e', '#59676b47', '#b4c5bc25'][indexColor] : stone[indexColor]);
        }
      }
    } else {
      for (let sprig = 0; sprig < 13; sprig++) {
        const point = ringPosition(col + ((sprig * 83 + row * 13) % 97 + 1) / 99, row + ((sprig * 19 + col * 5) % 91 + 4) / 99);
        ctx.fillStyle = sprig % 3 ? '#315c3b69' : '#d9d2a98a';
        ctx.fillRect(point.x * scale, point.z * scale, sprig % 3 ? 1.1 : 2.4, 1.4);
      }
    }
    for (const direction of [-1, 1]) {
      if (!waterTile(col, row + direction)) continue;
      const edge = direction < 0 ? inner : outer;
      atlasTile(ctx, scale, col, col + 1.002, edge - .045, edge + .062, '#d4c8a9');
      atlasTile(ctx, scale, col, col + 1.002, edge + direction * .10 - .027, edge + direction * .10 + .04, '#233f4c89');
      atlasTile(ctx, scale, col, col + 1.002, edge + direction * .20 - .030, edge + direction * .20 + .020, '#8ec1b865');
    }
  }
  for (const court of cityForecourts) {
    const inner = ringRadius(court.z + .17), outer = ringRadius(court.z + court.depth - .14);
    for (const row of [inner, outer]) atlasTile(ctx, scale, court.x + .12, court.x + court.width - .12, row - .022, row + .022, '#815e4777');
  }
  for (const crossing of cityStreet.crossings) for (let stripe = 0; stripe < 6; stripe++) {
    const at = crossing - .31 + stripe * .126;
    atlasTile(ctx, scale, at, at + .043, ringRadius(12.55) - .40, ringRadius(12.55) + .40, '#eadcc0');
  }
  ctx.restore();
}

function contains(points: Point[], x: number, y: number) {
  let inside = false;
  for (let index = 0, previous = points.length - 1; index < points.length; previous = index++) {
    const a = points[previous], b = points[index];
    if ((a.y > y) !== (b.y > y) && x < a.x + (b.x - a.x) * (y - a.y) / (b.y - a.y)) inside = !inside;
  }
  return inside;
}

export function createRingRasterView(canvas: HTMLCanvasElement, reduced: MediaQueryList) {
  const target = canvas.getContext('2d', { alpha: false })!;
  const terrain = document.createElement('canvas');
  const atlas = terrain.getContext('2d')!;
  terrain.width = terrain.height = 1440;
  const worldScale = terrain.width / (ringPlanExtent * 2);
  paintRingPlan(atlas, terrain.width / 2, terrain.height / 2, worldScale, true);
  textureTerrain(atlas, worldScale);

  let angle = .16;
  let pitch = .82;
  let height = 1.7;
  let x = 0, z = 0, span = 22.9;
  let previous = 0;
  let orbitChangedAt = -Infinity;
  let orbitOffset = 0;
  let orbitTilt = 0;
  let street = false;
  let night = false;
  let pumpElapsed: number | undefined;
  let sine = Math.sin(angle), cosine = Math.cos(angle);
  let flatten = Math.sin(pitch), lift = Math.cos(pitch);
  let paintedLayers: RasterLayer[] = [];
  const nightSprites = new WeakMap<HTMLCanvasElement, HTMLCanvasElement>();

  function resize(w: number, h: number) {
    if (w <= 0 || h <= 0) return;
    const ratio = Math.min(1, 690 / w, 480 / h);
    const width = Math.max(1, Math.round(w * ratio)), height = Math.max(1, Math.round(h * ratio));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
      paintedLayers = [];
    }
  }

  function project(world: World, y = 0): Point {
    const scale = canvas.height / span;
    const dx = world.x - x, dz = world.z - z;
    return {
      x: canvas.width * .5 + (dx * cosine - dz * sine) * scale,
      y: canvas.height * .5 + ((dx * sine + dz * cosine) * flatten - (y - height) * lift) * scale,
    };
  }

  function paint(points: readonly WorldPoint[], day: string, glow = false) {
    shape(points.map(([point, altitude]) => project(point, altitude)),
      night && !glow ? tone(day, .51, 1.38) : day);
  }

  function shape(points: Point[], color: string) {
    target.beginPath();
    for (const [index, point] of points.entries()) {
      if (index) target.lineTo(point.x, point.y);
      else target.moveTo(point.x, point.y);
    }
    target.closePath();
    target.fillStyle = color;
    target.fill();
  }

  function covers({ footprint, bottom, top }: Volume, x: number, y: number) {
    const floor = footprint.map(point => project(point, bottom));
    const roof = footprint.map(point => project(point, top));
    if (contains(roof, x, y)) return true;
    return floor.some((point, index) => {
      const next = (index + 1) % floor.length;
      return contains([point, floor[next], roof[next], roof[index]], x, y);
    });
  }

  function extrude(corners: World[], floor: number, ceiling: number, wall: string, shade: string, roof: string, detail = false) {
    const foot = corners.map(point => project(point, floor));
    const leading = corners.map(point => project(point, ceiling));
    const baseDepth = foot.reduce((sum, point) => sum + point.y, 0) * 2 / foot.length;
    const edges = foot.map((_, index) => ({ index, depth: foot[index].y + foot[(index + 1) % foot.length].y }))
      .sort((a, b) => a.depth - b.depth);
    for (const { index } of edges) {
      const next = (index + 1) % foot.length;
      const color = index % 2 ? shade : wall;
      shape([foot[index], foot[next], leading[next], leading[index]], night ? tone(color, .52, 1.40) : color);
      if (detail && foot[index].y + foot[next].y > baseDepth) {
        const left = corners[index], right = corners[next];
        const width = Math.hypot(left.x - right.x, left.z - right.z);
        const openings = Math.max(2, Math.floor(width / .63));
        for (let row = floor + .49; row < ceiling - .37; row += .85) {
          for (let pane = 1; pane <= openings; pane++) {
            const portion = pane / (openings + 1);
            const point = project({ x: left.x + (right.x - left.x) * portion, z: left.z + (right.z - left.z) * portion }, row);
            const unit = canvas.height / span;
            target.fillStyle = night ? '#233343' : '#364e59';
            target.fillRect(point.x - unit * .125, point.y - unit * .15, unit * .25, unit * .30);
            target.fillStyle = (row + pane) % 4 < 1.23 ? '#d6b888' : night ? '#364a52' : '#759b9c';
            target.fillRect(point.x - unit * .092, point.y - unit * .094, unit * .185, unit * .20);
          }
        }
      }
    }
    shape(leading, night ? tone(roof, .52, 1.40) : roof);
    target.strokeStyle = '#24394495';
    target.lineWidth = .8;
    target.stroke();
  }

  function band(face: Face, from: number, to: number, floor: number, top: number, color: string, glow = false, segments = 1) {
    for (let segment = 0; segment < segments; segment++) {
      const start = face.point(from + (to - from) * segment / segments);
      const end = face.point(from + (to - from) * (segment + 1) / segments);
      paint([[start, floor], [end, floor], [end, top], [start, top]], color, glow);
    }
  }

  function textOnFace(face: Face, name: string, bottom: number, top: number, start: number, end: number) {
    let left = project(face.point(start), (bottom + top) / 2), right = project(face.point(end), (bottom + top) / 2);
    if (left.x > right.x) [left, right] = [right, left];
    const width = Math.hypot(right.x - left.x, right.y - left.y);
    if (width < 26) return;
    const font = Math.min(13, Math.max(4, (top - bottom) * canvas.height / span * lift * .83), width / (name.length * .55));
    target.save();
    target.translate((left.x + right.x) / 2, (left.y + right.y) / 2);
    target.rotate(Math.atan2(right.y - left.y, right.x - left.x));
    target.font = `700 ${font}px Georgia, serif`;
    target.textAlign = 'center';
    target.textBaseline = 'middle';
    target.fillStyle = night ? '#e5b67d' : '#e8c99a';
    target.fillText(name, 0, 0, width);
    target.restore();
  }

  function sash(face: Face, at: number, width: number, floor: number, top: number, lit: boolean, reveal: string, main = false) {
    const left = at - width / 2, right = at + width / 2;
    band(face, left, right, floor, top, reveal);
    band(face, left + width * .08, right - width * .08, floor + .038, top - .042, '#314550');
    const glass = night && lit ? '#d5a568' : lit ? '#b29d72' : '#587b80';
    band(face, left + width * .17, right - width * .16, floor + .072, top - .085, glass, night && lit);
    band(face, at - width * .026, at + width * .027, floor + .066, top - .063, reveal);
    if (main) band(face, left, right, floor + (top - floor) * .54, floor + (top - floor) * .54 + .021, reveal);
    band(face, left - width * .07, right + width * .07, floor - .028, floor + .023, tone(reveal, .87));
  }

  function storefront(face: Face, color: string, name: string, width: number, salt: number) {
    const from = .5 - width * .5, to = .5 + width * .5;
    const useDoor = name !== 'QUAY WORKS';
    band(face, from, to, .12, .98, color, false, face.parts);
    for (const side of [-1, 1]) {
      const middle = .5 + side * width * .298;
      const half = width * .142;
      band(face, middle - half, middle + half, .267, .761, '#273943');
      const display = night ? '#d7ae71' : '#6d9190';
      band(face, middle - half * .91, middle + half * .91, .296, .742, display, night);
      if (street && face.span > 1.5) for (let shelf = 0; shelf < 2; shelf++) {
        for (let object = 0; object < 4; object++) {
          const at = middle - half * .76 + object * half * .42;
          const tall = (object + salt + shelf) % 3 * .035;
          band(face, at, at + half * .29, .347 + shelf * .17, .437 + shelf * .17 + tall,
            ['#916752', '#c0a276', '#525e60', '#d2b697'][(object + shelf * 3 + salt + 40) % 4]);
        }
        band(face, middle - half, middle + half, .328 + shelf * .176, .356 + shelf * .176, '#3c4850');
      }
      for (const fraction of [-.94, 0, .94]) {
        const at = middle + fraction * half;
        band(face, at - width * .007, at + width * .007, .27, .78, color);
      }
    }
    if (useDoor) {
      band(face, .5 - width * .125, .5 + width * .125, .031, .93, '#263b42');
      band(face, .5 - width * .092, .5 + width * .092, .33, .835, night ? '#c49864' : '#668480', night);
      band(face, .494, .506, .32, .852, color);
      band(face, .5-width*.103, .5+width*.103, .055, .251, color);
    }
    band(face, from - .007, to + .007, .814, 1.015, '#303943', false, face.parts);
    band(face, from, to, .813, .836, '#c5a577', false, face.parts);
    if (street) textOnFace(face, name, .831, 1.014, from + .064, to - .064);
    band(face, from-.018, to+.018, 1.014, 1.059, '#bca380', false, face.parts);
    band(face, from, to, .042, .110, '#d3bb93', false, face.parts);
    if (!street || (!name.includes('TEA') && !name.includes('SALT') && !name.includes('CLINIC'))) return;
    const edge = (u: number): [World, World] => {
      const base = face.point(u), step = face.point(u + .0005);
      const dx = step.x-base.x, dz = step.z-base.z;
      const scale = .184 / Math.hypot(dx,dz);
      return [base, { x: base.x+dz*scale, z: base.z-dx*scale }];
    };
    const stripes = Math.max(7, Math.round(face.span*width*4));
    for (let stripe = 0; stripe < stripes; stripe++) {
      const [left, leftTop] = edge(from + stripe / stripes * width);
      const [right, rightTop] = edge(from + (stripe + 1) / stripes * width);
      const cloth = name.includes('SALT') ? '#607e7b' : '#946a61';
      paint([[left, .795], [right, .795], [rightTop, .697], [leftTop, .697]], stripe % 2 ? cloth : '#d2c1a4');
      paint([[leftTop, .697], [rightTop, .697], [rightTop, .642], [leftTop, .642]], stripe % 2 ? tone(cloth,.83) : '#a99b83');
    }
  }

  function building({
    x: column, z: row, width, depth, eave, ridge: ridgeHeight, wall, finish, style, front, floors, name, landmark = '',
  }: BuildingPlan): RasterLayer {
    const x0 = column + Math.min(.052, width * .052), x1 = column + width - Math.min(.052, width * .052);
    const z0 = row + .21, z1 = row + depth - .21;
    const ring = (u: number, v: number) => ringPosition(x0 + (x1 - x0) * u, z0 + (z1 - z0) * v);
    const around = Math.max(2, Math.ceil(width * 3));
    const arc = Array.from({ length: around + 1 }, (_, segment) => segment / around);
    const along = (v: number) => arc.map(u => ring(u, v));
    const footprint = [...along(0), ...along(1).reverse()];
    const walls: Face[] = [
      { point: u => ring(u, 0), span: (x1 - x0) * ringRadius(z0) * Math.PI * .05, parts: around },
      { point: v => ring(1, v), span: (z1 - z0) * .48, parts: 1 },
      { point: u => ring(1 - u, 1), span: (x1 - x0) * ringRadius(z1) * Math.PI * .05, parts: around },
      { point: v => ring(0, 1 - v), span: (z1 - z0) * .48, parts: 1 },
    ];
    const frontIndex = { inner: 0, east: 1, outer: 2, west: 3 }[front];
    const [roofColor, darkRoof] = roofTypes[finish % roofTypes.length];
    const radial = front === 'east' || front === 'west';
    const roofAt = (u: number, v: number) => radial ? ring(v, u) : ring(u, v);
    const top = eave + ridgeHeight;
    const point = ring(.5, .5);
    const shadow = footprint.map(p => ({ x:p.x + .58 + top * .12, z:p.z - .35 - top * .10 }));
    paintAtlasFootprint(shadow);
    const spans = radial ? Math.ceil(depth * 1.6) : around;
    const roofAtHeight = (v: number) => eave + (1 - Math.abs(v * 2 - 1)) * ridgeHeight;
    const roofPicks: WorldPoint[][] = [];
    for (let index = 0; index < spans; index++) {
      const a = index / spans, b = (index + 1) / spans;
      for (const [start,end] of [[0,.5],[.5,1]]) roofPicks.push([
        [roofAt(a,start),roofAtHeight(start)],[roofAt(b,start),roofAtHeight(start)],
        [roofAt(b,end),roofAtHeight(end)],[roofAt(a,end),roofAtHeight(end)],
      ]);
    }
    const gables = ridgeHeight ? [0, 1].map((edge): WorldPoint[] =>
      [[roofAt(edge, 0), eave], [roofAt(edge, .5), top], [roofAt(edge, 1), eave]]) : [];
    const shadowWall = tone(wall, .79, 1.042);
    const paintWall = (face: Face, color: string, primary: boolean) => {
      band(face, 0, 1, 0, eave, color, false, face.parts);
      const faceTrim = style === 'garden' || style === 'civic' ? stoneTrim : '#c0a18a';
      const quoins = Math.min(.09, .16 / face.span);
      band(face, 0, 1, .02, .15, tone(color, .78), false, face.parts);
      band(face, 0, 1, eave-.14, eave-.069, tone(color, .74), false, face.parts);
      band(face, 0, 1, eave-.083, eave-.021, faceTrim, false, face.parts);
      const bays = style === 'civic' ? Math.min(9, Math.max(3, Math.round(face.span / 1.06))) : face.span > 1.55 ? 2 : 1;
      const shop = primary && (!!name || style === 'shops');
      const begin = shop ? 1 : 0;
      for (let level = begin; level < floors; level++) {
        const base = .29 + level * (eave - .17) / floors;
        for (let bay = 0; bay < bays; bay++) {
          const center = (bay + .5) / bays;
          if (primary && !shop && !level && bay === Math.floor(bays / 2) && style !== 'civic') continue;
          const main = center > .21 && center < .79;
          sash(face, center, Math.min(.57 / bays, .56 / face.span), base, base + .49, (bay + level * 3 + finish) % 4 === 0, faceTrim, main);
        }
      }
      if (shop) {
        storefront(face, shopColors[finish % shopColors.length], name || 'GENERAL STORES', style === 'civic' ? .63 : .93, finish);
      } else if (primary) {
        const at = .5, aperture = Math.min(.32, .62 / face.span);
        band(face, at-aperture*.61, at+aperture*.61, .025, .81, faceTrim);
        band(face, at-aperture*.48, at+aperture*.48, .052, .735, shopColors[finish % shopColors.length]);
        band(face, at-aperture*.36, at+aperture*.38, .152, .401, tone(shopColors[finish % shopColors.length], .87));
        band(face, at+.034, at+.058, .374, .411, '#d3a86c');
        band(face, at-aperture*.74, at+aperture*.74, .004, .091, '#c1a887');
      }
      if (!street) return;
      if (primary && ['archive', 'clinic', 'station'].includes(landmark)) {
        const trim = landmark === 'clinic' ? '#c1a08a' : stoneTrim;
        const edge = .75 / face.span;
        for (const side of [-1, 1]) {
          const at = .5 + side * edge;
          const width = Math.min(.044, .19 / face.span);
          band(face, at-width/2, at+width/2, .089, 1.072, trim);
          band(face, at-width*.72, at+width*.72, .011, .104, '#b7a389');
          band(face, at-width*.67, at+width*.67, 1.024, 1.125, '#d7c09c');
        }
        const from = .5-edge*1.18, to=.5+edge*1.18;
        if (landmark === 'archive' || landmark === 'station') {
          paint([[face.point(from),1.17],[face.point(.5),1.49],[face.point(to),1.17]], '#dcc39d');
          paint([[face.point(from+.016),1.181],[face.point(.5),1.414],[face.point(to-.016),1.181]], tone(color,.85));
          band(face, from, to, 1.122, 1.175, '#e1c9a6');
        } else {
          band(face, from, to, 1.091, 1.166, '#ddd1b4');
          band(face, .463, .537, 1.25, 1.50, '#415f60');
          band(face, .484, .516, 1.29, 1.457, '#ddd7bf');
          band(face, .476, .524, 1.355, 1.401, '#ddd7bf');
        }
      }
      for (let line = 1; line < floors; line++) {
        const course = .07 + line * (eave - .12) / floors;
        band(face, .04, .96, course, course+.027, tone(color, .87), false, face.parts);
      }
      if (style === 'civic' || style === 'garden' || primary && finish % 3 === 0) {
        for (let course = 0, y = .17; y < eave-.16; y += .192, course++) {
          const a = quoins * (course % 2 ? .64 : 1);
          band(face, 0, a, y, y + .145, tone(faceTrim, course % 2 ? .86 : .93));
          band(face, 1-a, 1, y, y + .145, tone(faceTrim, course % 2 ? .86 : .93));
        }
      }
      band(face, .04, .057, .16, eave-.135, tone(color, .69));
    };
    return {
      point,
      radius: Math.hypot(width * ringRadius(row + depth) * Math.PI / 40, depth * .24) + .7,
      top: top + .64,
      volume: { footprint, bottom: 0, top: eave },
      picks: [...roofPicks, ...gables],
      entrance: landmark === 'archive' ? [
        [walls[frontIndex].point(.421), .04], [walls[frontIndex].point(.579), .04],
        [walls[frontIndex].point(.579), .962], [walls[frontIndex].point(.421), .962],
      ] : undefined,
      draw() {
        for (const [index, face] of walls.entries()) {
          const a = face.point(.28), b = face.point(.72);
          if ((b.z-a.z) * sine - (b.x-a.x) * cosine < -.005) continue;
          const primary = index === frontIndex;
          paintWall(face, index === 0 || index === 3 ? shadowWall : wall, primary);
        }
        for (const [index, gable] of gables.entries()) paint(gable, index ? shadowWall : tone(wall, .94));
        for (const [index, roof] of roofPicks.entries()) {
          paint(roof, index % 2 ? roofColor : darkRoof);
        }
        const roofFace: Face = { point: t => roofAt(t,.5), span: width, parts: spans };
        band(roofFace, 0, 1, top-.018, top+.023, '#899393', false, spans);
        if (street && ridgeHeight) for (const side of [.20, .39, .61, .80]) {
          const shingle: Face = { point: (u) => roofAt(u, side), span: width, parts: spans };
          const at = roofAtHeight(side) + .014;
          band(shingle, .008, .992, at-.021, at+.012, side > .5 ? '#839396' : '#61757c', false, spans);
        }
        const chimneyAt = landmark === 'station' ? .54 : (.213 + (finish % 3) * .178);
        const middle = roofAt(chimneyAt, .50);
        const chimney = [
          roofAt(chimneyAt - .045, .40), roofAt(chimneyAt + .045, .40), roofAt(chimneyAt + .045, .60), roofAt(chimneyAt - .045, .60),
        ];
        if (ridgeHeight || landmark === 'station') {
          extrude(chimney, top-.049, top+.30, tone(wall, .73), '#694d47', '#bb9c79');
          if (landmark === 'station') {
            const p = project(middle, top+.245);
            const size = canvas.height / span;
            target.fillStyle = night ? '#d7b784' : '#e6d7af';
            target.beginPath();
            target.ellipse(p.x, p.y, size * .129, size * .104, 0, 0, Math.PI*2);
            target.fill();
            target.strokeStyle = '#3a464a';
            target.lineWidth = 1;
            target.beginPath();
            target.moveTo(p.x, p.y-size*.044);
            target.lineTo(p.x, p.y);
            target.lineTo(p.x+size*.047,p.y+size*.015);
            target.stroke();
          }
        }
      },
    };
  }

  function paintAtlasFootprint(points: World[]) {
    atlas.save();
    atlas.translate(terrain.width / 2, terrain.height / 2);
    atlas.beginPath();
    for (const [index, p] of points.entries()) {
      if (index) atlas.lineTo(p.x * worldScale, p.z * worldScale);
      else atlas.moveTo(p.x * worldScale, p.z * worldScale);
    }
    atlas.closePath();
    atlas.fillStyle = '#37382b32';
    atlas.fill();
    atlas.restore();
  }

  function wallBlock(x: number, z: number, width: number, depth: number, finish: keyof typeof barrierFinishes) {
    const [top, wall, shade, cap] = barrierFinishes[finish];
    const steps = Math.ceil(width);
    const arc = Array.from({ length: steps + 1 }, (_, index) => x + .14 + (width - .28) * index / steps);
    const footprint = [
      ...arc.map(column => ringPosition(column, z + .16)),
      ...arc.reverse().map(column => ringPosition(column, z + depth - .16)),
    ];
    const railing: WorldPoint[][] = [];
    if (finish === 'iron') for (const [index, a] of footprint.entries()) {
      const b = footprint[(index + 1) % footprint.length];
      const length = Math.hypot(a.x - b.x, a.z - b.z);
      const segment = (portion: number): World => ({ x: a.x + (b.x-a.x)*portion, z: a.z + (b.z-a.z)*portion });
      const strip = (from: number, to: number, floor: number, ceiling: number) => {
        const start = segment(from), end = segment(to);
        railing.push([[start, floor], [end, floor], [end, ceiling], [start, ceiling]]);
      };
      strip(0, 1, .207, .25);
      strip(0, 1, top - .111, top - .066);
      const balusters = Math.max(2, Math.round(length / .21));
      const half = Math.min(.15, .024 / length);
      for (let pole = 0; pole < balusters; pole++) {
        const at = (pole + .5) / balusters;
        strip(at - half, at + half, .15, top);
      }
    }
    return {
      point: ringPosition(x + width / 2, z + depth / 2),
      radius: Math.hypot(width * ringRadius(z + depth) * Math.PI / 40, depth * .24) + .21,
      top,
      volume: { footprint, bottom: 0, top: finish === 'iron' ? .157 : top },
      picks: railing,
      draw() {
        if (finish === 'iron') {
          extrude(footprint, 0, .157, '#a59884', '#817a69', '#b2a287');
          for (const rail of railing) paint(rail, '#425558');
          return;
        }
        if (finish !== 'hedge') {
          extrude(footprint, 0, top, wall, shade, cap);
          if (street) extrude(footprint, top - .113, top - .034, tone(wall,.93), tone(shade,.93), cap);
          return;
        }
        extrude(footprint, 0, .154, '#968a75', '#7b7967', '#b4a98b');
        const upper = Math.max(6, Math.ceil(width * 9));
        const greenery = ['#5b795b', '#547052', '#63815d', '#789267'];
        const size = canvas.height / span * (width > depth ? .19 : .17);
        for (let index = 0; index < upper; index++) {
          const u = (index + .5) / upper;
          const column = x + .15 + (width - .3) * u;
          for (const row of [z + .28, z + depth - .34]) {
            const point = project(ringPosition(column, row), .311 + (index % 4) * .026);
            target.beginPath();
            target.ellipse(point.x, point.y, size * (.84 + index % 3 * .12), size * .62, -.08, 0, Math.PI * 2);
            const color = greenery[(index * 7 + Math.floor(row * 19)) % greenery.length];
            target.fillStyle = night ? tone(color,.52,1.28) : color;
            target.fill();
          }
        }
      },
    };
  }

  function courtLandmark({ feature, kind }: CityCourtyard): RasterLayer {
    const column = feature.x + feature.width / 2;
    const point = ringPosition(column, feature.z + feature.depth / 2);
    const angle = ringAngle(column);
    const across = Math.cos(angle), along = Math.sin(angle);
    const at = (x: number, z: number): World => ({ x: point.x + x * across + z * along, z: point.z - x * along + z * across });
    const profile = (x: number, z: number, width: number, depth: number) => [at(x - width / 2, z - depth / 2),
      at(x + width / 2, z - depth / 2), at(x + width / 2, z + depth / 2), at(x - width / 2, z + depth / 2)];
    const oval = (x: number, z: number, radius: number, narrow: number) => Array.from({ length: 16 }, (_, index) => {
      const theta = index * Math.PI / 8;
      return at(x + Math.cos(theta) * radius, z + Math.sin(theta) * narrow);
    });
    const stone = ['#b9a68b', '#8e806e', '#d2c0a2'] as const;
    const stoneBase = ['#8f8577', '#746e64', '#b6ac99'] as const;
    const iron = ['#415957', '#2e4148', '#677871'] as const;
    const picks: WorldPoint[][] = [];
    const solids: (() => void)[] = [];
    function solid(corners: World[], bottom: number, top: number, colors: readonly [string, string, string] = stone) {
      const cap = corners.map((corner): WorldPoint => [corner, top]);
      picks.push(cap);
      for (const [index, corner] of corners.entries()) {
        const next = corners[(index + 1) % corners.length];
        picks.push([[corner, bottom], [next, bottom], [next, top], [corner, top]]);
      }
      solids.push(() => extrude(corners, bottom, top, ...colors));
    }
    function line(points: readonly WorldPoint[], color: string, width: number, illuminated = false) {
      target.save();
      target.beginPath();
      for (const [index, [world, y]] of points.entries()) {
        const p = project(world, y);
        if (index) target.lineTo(p.x, p.y);
        else target.moveTo(p.x, p.y);
      }
      target.strokeStyle = night && !illuminated ? tone(color, .56, 1.31) : color;
      target.lineWidth = Math.max(.70, width * canvas.height / span);
      target.lineJoin = target.lineCap = 'round';
      target.stroke();
      target.restore();
    }
    const crossSection = (centerX: number, centerY: number, z: number, radius: number) => Array.from({ length: 18 }, (_, index): WorldPoint => {
      const theta = index * Math.PI / 9;
      return [at(centerX + Math.cos(theta) * radius, z), centerY + Math.sin(theta) * radius];
    });
    const paintSolids = () => solids.forEach(draw => draw());
    if (kind === 'garden') {
      solid(oval(0, 0, .597, .393), 0, .104, stoneBase);
      solid(oval(0, 0, .533, .327), .104, .297);
      solid(oval(0, 0, .583, .375), .297, .365);
      const earth = oval(0, 0, .511, .313).map((p): WorldPoint => [p, .366]);
      for (const x of [-.94, .94]) {
        for (const foot of [-.29, .29]) solid(profile(x + foot, 0, .134, .243), 0, .279);
        solid(profile(x, 0, .83, .339), .277, .364);
      }
      const fronds = Array.from({ length: 24 }, (_, index) => {
        const theta = index * 2.399, reach = .09 + (index % 5) * .057;
        const x = Math.cos(theta) * reach, z = Math.sin(theta) * reach * .592;
        const spread = .048 + (index * 3 % 8) * .006;
        return { point: at(x, z), color: ['#618363', '#79926a', '#57795d', '#89a176'][index % 4], face: [
          [at(x * .61, z * .55), .364], [at(x - spread, z), .512],
          [at(x + Math.cos(theta) * .17, z + Math.sin(theta) * .093), .568 + spread],
          [at(x + spread, z), .487],
        ] as WorldPoint[] };
      });
      picks.push(...fronds.map(frond => frond.face));
      return { point, radius: 1.53, top: .72, picks, draw() {
        paintSolids();
        paint(earth, '#594a3d');
        fronds.slice().sort((a, b) => depthAt(a.point) - depthAt(b.point)).forEach(frond => paint(frond.face, frond.color));
      } };
    }
    if (kind === 'market') {
      solid(profile(0, 0, .67, .421), 0, .088, stoneBase);
      solid(profile(0, 0, .612, .351), .088, .153);
      solid(profile(0, 0, .522, .312), .153, .209);
      solid(profile(0, 0, .402, .273), .209, .505);
      solid(profile(0, 0, .467, .317), .496, .554);
      solid(profile(0, 0, .326, .246), .554, .591);
      const foot = profile(0, 0, .335, .295), top = profile(0, 0, .171, .139), finial = profile(0, 0, .075, .064);
      const sides = foot.map((p, index): WorldPoint[] => [[p, .591], [foot[(index + 1) % 4], .591], [top[(index + 1) % 4], 1.763], [top[index], 1.763]]);
      const cap = top.map((p, index): WorldPoint[] => [[p, 1.763], [top[(index + 1) % 4], 1.763], [finial[(index + 1) % 4], 1.897], [finial[index], 1.897]]);
      picks.push(...sides, ...cap);
      return { point, radius: .60, top: 1.897, picks, draw() {
        paintSolids();
        for (const [index, face] of sides.entries()) {
          if (depthAt(face[0][0]) + depthAt(face[1][0]) < depthAt(point) * 2) continue;
          paint(face, index % 2 ? '#b8a387' : '#d5bb94');
          paint(cap[index], index % 2 ? '#536b63' : '#71847a');
        }
        for (const z of [-.140, .140]) {
          if (depthAt(at(0, z)) < depthAt(point)) continue;
          paint([[at(-.094, z), .307], [at(.094, z), .307], [at(.094, z), .424], [at(-.094, z), .424]], '#a58a62');
          for (const y of [.338, .362, .384]) line([[at(-.058, z), y], [at(.058, z), y]], '#dfc294', .009);
        }
      } };
    }
    if (kind === 'station') {
      solid(oval(0, 0, .21, .19), 0, .076, stoneBase);
      solid(oval(0, 0, .173, .155), .076, .133);
      solid(oval(0, 0, .135, .121), .133, .259, iron);
      solid(oval(0, 0, .055, .05), .254, 1.386, iron);
      solid(profile(.55, -.015, .339, .273), 0, .108, stoneBase);
      solid(profile(.55, -.015, .290, .224), .108, .402, iron);
      solid(profile(.55, -.015, .329, .255), .402, .445, iron);
      solid(oval(0, 0, .060, .053), 1.860, 1.941, ['#a08262', '#756956', '#d2ad7b']);
      const disk = [-.076, .076].map(z => crossSection(0, 1.624, z, .25));
      const sides = disk[0].map((p, index): WorldPoint[] => [p, disk[0][(index + 1) % 18], disk[1][(index + 1) % 18], disk[1][index]]);
      picks.push(...disk, ...sides);
      return { point, radius: .88, top: 1.947, picks, draw() {
        paintSolids();
        const facing = depthAt(at(0, .08)) > depthAt(point) ? 1 : -1;
        paint(disk[facing > 0 ? 0 : 1], '#303f44');
        for (const face of sides) paint(face, '#485a58');
        paint(disk[facing > 0 ? 1 : 0], '#344b50');
        paint(crossSection(0, 1.624, facing * .087, .225), '#9a8057');
        paint(crossSection(0, 1.624, facing * .094, .183), night ? '#b5a07b' : '#e2cba1', true);
        for (let hour = 0; hour < 12; hour++) {
          const dial = hour * Math.PI / 6;
          const index = (r: number): WorldPoint => [at(Math.sin(dial) * r * facing, facing * .102), 1.624 + Math.cos(dial) * r];
          line([index(hour % 3 === 0 ? .131 : .148), index(.166)], '#39494b', .012, true);
        }
        const now = new Date();
        const minute = now.getMinutes() * Math.PI / 30;
        const hour = (now.getHours() % 12 + now.getMinutes() / 60) * Math.PI / 6;
        const hub: WorldPoint = [at(0, facing * .107), 1.624];
        const hand = (angle: number, reach: number): WorldPoint =>
          [at(Math.sin(angle) * reach * facing, facing * .107), 1.624 + Math.cos(angle) * reach];
        line([hub, hand(hour, .103)], '#39494b', .018, true);
        line([hub, hand(minute, .157)], '#8b4d40', .012, true);
      } };
    }

    solid(profile(-.45, 0, 1.16, .473), 0, .107, stoneBase);
    solid(profile(-.45, 0, .994, .414), .107, .351);
    const basin = profile(-.45, 0, .833, .291).map((p): WorldPoint => [p, .371]);
    solids.push(() => paint(basin, '#638f92'));
    for (const z of [-.181, .181]) {
      for (let block = 0; block < 4; block++) solid(profile(-.793 + block * .229, z, .223, .068), .351, .447);
    }
    for (const end of [-.935, .035]) solid(profile(end, 0, .074, .398), .350, .446);
    solid(oval(.47, 0, .181, .167), 0, .112, stoneBase);
    solid(oval(.47, 0, .096, .094), .112, .519, iron);
    solid(oval(.47, 0, .152, .137), .499, .582, iron);
    const wheelX = .46, wheelY = .647, wheelZ = .147;
    const pipeProfile = [[.463, .560], [.261, .647], [-.182, .683], [-.220, .647]];
    const pipe = pipeProfile.map(([x, y]): WorldPoint => [at(x, 0), y]);
    for (let segment = 1; segment < pipeProfile.length; segment++) {
      const [ax, ay] = pipeProfile[segment - 1], [bx, by] = pipeProfile[segment];
      const width = .044 / Math.hypot(bx - ax, by - ay);
      const dx = (by - ay) * width, dy = (ax - bx) * width;
      picks.push([[at(ax + dx, 0), ay + dy], [at(bx + dx, 0), by + dy],
        [at(bx - dx, 0), by - dy], [at(ax - dx, 0), ay - dy]]);
    }
    const wheel = crossSection(wheelX, wheelY, wheelZ, .215);
    const wheelOuter = crossSection(wheelX, wheelY, wheelZ, .235);
    const wheelInner = crossSection(wheelX, wheelY, wheelZ, .195);
    const hub = crossSection(wheelX, wheelY, wheelZ, .047);
    for (let index = 0; index < wheelOuter.length; index++) {
      const next = (index + 1) % wheelOuter.length;
      picks.push([wheelOuter[index], wheelOuter[next], wheelInner[next], wheelInner[index]]);
    }
    picks.push(hub);
    for (let spoke = 0; spoke < 6; spoke++) {
      const direction = spoke * Math.PI / 3;
      const x = Math.cos(direction), y = Math.sin(direction);
      picks.push([[at(wheelX - y * .017, wheelZ), wheelY + x * .017],
        [at(wheelX + x * .2 - y * .017, wheelZ), wheelY + y * .2 + x * .017],
        [at(wheelX + x * .2 + y * .017, wheelZ), wheelY + y * .2 - x * .017],
        [at(wheelX + y * .017, wheelZ), wheelY - x * .017]]);
    }
    return { point, radius: 1.15, top: .898, picks, draw() {
      paintSolids();
      line(pipe, '#a48154', .087);
      line([...wheel, wheel[0]], '#31494d', .032);
      const time = pumpElapsed ?? 0;
      const turn = Math.min(1, time / 2.12);
      const spin = -4 * Math.PI * turn * turn * (3 - 2 * turn);
      for (let spoke = 0; spoke < 6; spoke++) {
        const direction = spin + spoke * Math.PI / 3;
        line([[at(wheelX, wheelZ), wheelY],
          [at(wheelX + Math.cos(direction) * .20, wheelZ), wheelY + Math.sin(direction) * .20]], '#b98f62', .022);
      }
      paint(hub, '#a48154');
      if (pumpElapsed === undefined) return;
      const start = Math.max(0, Math.min(1, (time - .24) / .24));
      const drain = Math.max(0, Math.min(1, (time - 2.08) / .27));
      const top = .647 - .273 * drain * drain, bottom = .647 - .273 * start * start;
      if (top - bottom > .002) line([[at(-.22, 0), top], [at(-.22, 0), bottom]], night ? '#9dcccf' : '#bedbd3', .024, true);
      for (const first of [.48, .83]) {
        const pulse = Math.floor((Math.min(time, 2.32) - first) / .7);
        const age = time - first - pulse * .7;
        if (pulse < 0 || age >= .7) continue;
        const radius = .018 + .108 * age / .7;
        const crest = oval(-.220, 0, radius, radius * .82).map((p): WorldPoint => [p, .375]);
        line([...crest, crest[0]], '#c0d8d0', .010, true);
      }
    } };
  }

  function gate(column: number, row: number, id: typeof cityGateSites[number]['id']): RasterLayer {
    const centerAngle = ringAngle(column + .5);
    const point = ringPosition(column + .5, row + .5);
    const tangent = { x: Math.cos(centerAngle), z: -Math.sin(centerAngle) };
    const normal = { x: Math.sin(centerAngle), z: Math.cos(centerAngle) };
    const local = (x: number, z: number) => ({ x: point.x + tangent.x * x + normal.x * z, z: point.z + tangent.z * x + normal.z * z });
    const half = ringRadius(row + .5) * Math.sin(Math.PI / RING_PERIOD);
    const spring = 1.31;
    const rise = Math.min(1.34, half * (id === 'west-lock' ? .73 : .83));
    const through = .25, cornice = spring + rise + .29;
    const brick = id === 'fern-court' ? '#b79b77' : '#a6745e';
    const feet = [-1, 1].map(side => {
      const middle = side * (half + .121);
      return [
        local(middle - .162, -through), local(middle + .162, -through),
        local(middle + .162, through), local(middle - .162, through),
      ];
    });
    const visibleArch = [-through, through].map(depth => {
      const cuts: WorldPoint[][] = [];
      const curve = (i: number) => {
        const a = i * Math.PI / 12;
        return [local(Math.cos(a) * half, depth), spring + Math.sin(a) * rise] as const;
      };
      for (let i = 0; i < 12; i++) {
        const a = curve(i), b = curve(i + 1);
        cuts.push([a, b, [b[0], cornice], [a[0], cornice]]);
      }
      const tan: Face = { point: t => local((t - .5) * (half + .28) * 2, depth), parts: 1, span: (half + .28) * 2 };
      return { cuts, depth, tan };
    });
    const picks: WorldPoint[][] = visibleArch.flatMap(face => face.cuts);
    return {
      point, radius: half + .4, top: cornice + .135, picks: [
        ...picks,
        ...feet.flatMap(foot => foot.map((p, i): WorldPoint[] => {
          const next = foot[(i + 1) % foot.length];
          return [[p, 0], [next, 0], [next, spring], [p, spring]];
        })),
      ],
      draw() {
        for (const foot of feet) {
          extrude(foot, 0, spring + .17, '#bfa683', '#9e8974', '#dbc19a');
          extrude(foot, .025, .146, '#b9a587', '#9f8d73', '#d6c9a5');
        }
        const faces = [...visibleArch].sort((a, b) => depthAt(local(0,a.depth)) - depthAt(local(0,b.depth)));
        for (const { cuts,depth,tan } of faces) {
          for (const [i, cut] of cuts.entries()) {
            paint(cut, tone(brick, .93 + (i % 3) * .064));
            const [a,b] = cut;
            paint([a,b,[b[0],b[1]+.127],[a[0],a[1]+.127]], i % 3 === 0 ? '#d1b390' : '#e2c39d');
          }
          for (const side of [0,1]) {
            const limit = .28 / tan.span;
            band(tan, side ? 1-limit : 0, side ? 1 : limit, spring+.025, cornice, brick);
          }
          band(tan, 0, 1, cornice-.066, cornice+.044, '#cdb48d');
          if (street) {
            const sign = id === 'west-lock' ? 'WEST LOCK' : id === 'fern-court' ? 'FERN COURT' : 'SALT MARKET';
            const nameplate: Face = { ...tan, point: t => local((t-.5)*tan.span, depth * 1.023) };
            band(nameplate, .39, .61, cornice-.170, cornice-.039, '#3d4c4a');
            textOnFace(nameplate, sign, cornice-.155, cornice-.033, .40, .60);
          }
        }
        paint([[local(-half-.30,-through-.06),cornice+.06],[local(half+.30,-through-.06),cornice+.06],
          [local(half+.30,through+.06),cornice+.06],[local(-half-.30,through+.06),cornice+.06]], '#d9c5a0');
      },
    };
  }

  function depthAt(point: World) {
    return point.x * sine + point.z * cosine;
  }

  const terracedNames: Record<string, string> = {
    'sailmakers-yard': 'SAIL & TWINE', 'sailmakers-turn': 'MAST HOUSE', 'salt-market-arcade': 'SALT MERCHANT',
    'salt-market-corner': 'CHANDLER', 'capstan-lane': 'CAPSTAN WORKS',
  };
  const layers: RasterLayer[] = [
    ...cityParcels.map(({ x, z, width, depth, finish, stories, kind }) => building({
      x, z, width, depth,
      eave: .47 + stories * .76,
      ridge: kind === 'station' ? .62 : kind === 'archive' ? .39 : .22,
      wall: civicWalls[finish],
      finish: kind === 'clinic' ? 1 : finish,
      style: 'civic', front: 'outer', floors: stories, name: civicNames[kind] ?? '', landmark: kind,
    })),
    ...cityTerraces.flatMap(lot => {
      const bay = lot.width / lot.homes;
      return Array.from({ length: lot.homes }, (_, index) => {
        const address = (lot.address?.first ?? 1) - 1 + index;
        const finish = (lot.x * 7 + lot.z + address * 13) % 12;
        const outer = lot.z >= 29;
        const style = lot.style;
        const palette = style === 'garden' ? gardenWalls : brickWalls;
        const name = terracedNames[lot.id] ?? (style === 'shops' ? ['MALT & CO.', 'HARBOUR TEA', 'PARKER BOOKS'][address % 3] : '');
        return building({
          x: lot.x + bay * index, z: lot.z, width: bay, depth: lot.depth,
          eave: (outer ? 2.43 : 1.75) + (address % 3) * .093,
          ridge: .27 + finish % 4 * .081,
          wall: palette[finish % palette.length], finish, style, front: lot.sideFront ?? lot.facing, floors: outer ? 3 : 2, name,
        });
      });
    }),
    ...cityAlleyBarriers.map(({ x, z, width, depth, kind }) => wallBlock(x, z, width, depth, kind)),
    ...cityCourtyards.map(court => ({ ...courtLandmark(court), survey: court.kind })),
    ...cityGateSites.map(({x,z,id})=>gate(x,z,id)),
  ];
  const cylindrical = (radius: number, center = { x: 0, z: 0 }) => Array.from({ length: 12 }, (_, side) => ({
    x: center.x + Math.cos(side * Math.PI / 6) * radius,
    z: center.z + Math.sin(side * Math.PI / 6) * radius,
  }));
  const caisson = cylindrical(2.37), shaft = cylindrical(.88), crown = cylindrical(1.08);
  const observationDeck = cylindrical(2.11);
  const beaconPoint = ringPosition(cityLighthouseSite.x, cityLighthouseSite.z);
  const beaconFooting = cylindrical(.65, beaconPoint);
  const beaconBase = cylindrical(.49, beaconPoint), beaconTower = cylindrical(.37, beaconPoint);
  const beaconBalcony = cylindrical(.48, beaconPoint), beaconGlass = cylindrical(.30, beaconPoint);
  const beaconVolume = { footprint: beaconTower, bottom: 0, top: 3.22 };
  const fountainColumn = cityFountainSite.x + cityFountainSite.width / 2;
  const fountainRow = cityFountainSite.z + cityFountainSite.depth / 2;
  const fountainPoint = ringPosition(fountainColumn, fountainRow);
  const fountainAngle = ringAngle(fountainColumn);
  const fountainTangent = { x: Math.cos(fountainAngle), z: -Math.sin(fountainAngle) };
  const fountainNormal = { x: Math.sin(fountainAngle), z: Math.cos(fountainAngle) };
  const fountainOval = (major: number, minor: number) => Array.from({ length: 20 }, (_, index) => {
    const u = Math.cos(index * Math.PI / 10) * major, v = Math.sin(index * Math.PI / 10) * minor;
    return { x: fountainPoint.x + fountainTangent.x * u + fountainNormal.x * v,
      z: fountainPoint.z + fountainTangent.z * u + fountainNormal.z * v };
  });
  const fountainRim = fountainOval(1.39, .36), fountainBowl = fountainOval(1.23, .263);
  const fountainStone = fountainOval(.215, .135), fountainTop = fountainOval(.27, .152);
  const fountainRipples = [fountainOval(.78,.185), fountainOval(.53,.124)];
  const fountainVolume = { footprint: fountainRim, bottom: 0, top: .246 };
  const occluders = [
    ...layers.flatMap(layer => layer.volume ? [layer.volume] : []),
    { footprint: shaft, bottom: .12, top: 8.38 },
    { footprint: crown, bottom: 7.93, top: 9.21 },
    beaconVolume,
    fountainVolume,
  ];
  const structurePicks = layers.flatMap(layer => layer.picks ? [layer.picks] : []);
  function belt(footprint: World[], floor: number, top: number, color: string) {
    for (const [index, a] of footprint.entries()) {
      const b = footprint[(index + 1) % footprint.length];
      if ((b.z - a.z) * sine - (b.x - a.x) * cosine < 0) continue;
      paint([[a, floor], [b, floor], [b, top], [a, top]], tone(color, .84 + index % 4 * .055));
    }
  }

  const spire: RasterLayer = { radius: 2.5, top: 10.33, point: { x: 0, z: 0 }, draw() {
    extrude(caisson, -.58, .12, '#a59c85', '#766f62', '#c2bfa6');
    extrude(observationDeck, .10, .28, '#b7b099', '#807e70', '#c7bd9d');
    extrude(shaft, .12, 8.38, '#c8baa0', '#9e9386', '#cdbb95', street);
    for (const level of [2.05, 4.45, 6.63, 7.88]) belt(shaft, level, level + .108, '#d8c5a2');
    extrude(crown, 7.93, 9.21, '#628586', '#42656f', '#537784');
    const top = project({x:0,z:0}, 10.33);
    const unit = canvas.height / span;
    const turret = project({x:0,z:0}, 9.15);
    target.strokeStyle = '#967650';
    target.lineWidth = Math.max(1,unit*.045);
    target.beginPath();
    target.moveTo(turret.x,turret.y);
    target.lineTo(top.x,top.y+unit*.26);
    target.stroke();
    target.beginPath();
    target.arc(top.x, top.y, unit * .26, 0, Math.PI * 2);
    target.fillStyle = night ? '#e6b36a' : '#baa071';
    target.fill();
    target.strokeStyle = '#edc487';
    target.lineWidth = 1.4;
    target.stroke();
  } };

  const beacon: RasterLayer = { point: beaconPoint, radius: .58, top: 3.26, draw() {
    extrude(beaconFooting, -.60, -.019, '#a09a8a', '#706f6a', '#b6ab92');
    extrude(beaconBase, 0, .188, '#bfb194', '#9d997d', '#ccc09f');
    for (let level = 0; level < 5; level++) {
      const color = level % 2 ? '#b7715a' : '#dfcba4';
      extrude(beaconTower, .188 + level*.423, .188 + (level+1)*.423, color, tone(color,.79), color);
    }
    extrude(beaconBalcony, 2.28, 2.43, '#535d5c', '#3d4d51', '#a6a28b');
    extrude(beaconGlass, 2.44, 2.95, '#e7bf7f', '#847858', '#4e5b5b');
    const glow = project(beaconPoint, 2.72);
    const size = canvas.height / span;
    if (night) {
      const beam = target.createRadialGradient(glow.x,glow.y,size*.03,glow.x,glow.y,size*.64);
      beam.addColorStop(0, '#ffe2a6b5');
      beam.addColorStop(.27, '#ffcc7667');
      beam.addColorStop(1, '#fcb86c00');
      target.fillStyle = beam;
      target.fillRect(glow.x-size*.65,glow.y-size*.65,size*1.3,size*1.3);
    }
    const peak: WorldPoint = [beaconPoint, 3.24];
    for (let side = 0; side < beaconBalcony.length; side++) {
      const next = (side + 1) % beaconBalcony.length;
      paint([[beaconBalcony[side],2.93],[beaconBalcony[next],2.93],peak],
        ['#b1795c','#a16251','#8c594e'][side%3]);
    }
  } };

  const fountain: RasterLayer = { point: fountainPoint, radius: 1.46, top: .82, draw() {
    extrude(fountainRim, 0, .245, '#b4a489', '#8f8f7d', '#d4c2a1');
    paint(fountainBowl.map(p => [p,.248] as const), night ? '#4b7b8b' : '#658f96', true);
    for (const ripple of fountainRipples) {
      target.beginPath();
      for (const [index, p] of ripple.entries()) {
        const outline = project(p,.252);
        if (index) target.lineTo(outline.x,outline.y);
        else target.moveTo(outline.x,outline.y);
      }
      target.closePath();
      target.strokeStyle = night ? '#9bbbc490' : '#b3d1ca93';
      target.lineWidth = Math.max(.8, canvas.height/span*.018);
      target.stroke();
    }
    extrude(fountainStone,.246,.526,'#b6a78e','#959182','#cfb999');
    extrude(fountainTop,.51,.577,'#cbbb9d','#a59981','#e3cda5');
    const jet = project(fountainPoint,.79), source = project(fountainPoint,.566);
    target.strokeStyle = night ? '#bcd2ca' : '#e7e2ca';
    target.lineWidth = Math.max(.8,canvas.height/span*.031);
    target.beginPath();
    target.moveTo(jet.x,jet.y);
    target.lineTo(source.x,source.y);
    target.stroke();
  } };

  const boats: RasterLayer[] = props.harbor.filter(prop => prop.kind === 'boat').map(prop => {
    const point = ringPosition(prop.x + .5, prop.y + .82);
    const bearing = ringAngle(prop.x + .5);
    const transform = (x: number, z: number): World => ({
      x: point.x + x*Math.sin(bearing) + z*Math.cos(bearing),
      z: point.z + x*Math.cos(bearing) - z*Math.sin(bearing),
    });
    const hull = [transform(-.96,0),transform(-.61,-.25),transform(.59,-.27),
      transform(.99,.03),transform(.61,.24),transform(-.73,.26)];
    const timber = [transform(-.81,0),transform(-.58,-.17),transform(.53,-.18),
      transform(.84,.035),transform(.51,.166),transform(-.64,.167)];
    return { point,radius:1.19,top:1.46,draw() {
      extrude(hull,-.555,-.32,'#7b6c58','#534f4a','#b39a71');
      paint(timber.map(p=>[p,-.313] as const),'#566360');
      for (const at of [-.39,.36]) paint([[transform(at-.04,-.166),-.290],[transform(at+.045,-.166),-.290],
        [transform(at+.045,.167),-.29],[transform(at-.04,.167),-.290]],'#9c805e');
      if (!prop.variant) return;
      const bottom = project(point,-.300), high = project(point,1.23);
      target.strokeStyle = night ? '#60524e' : '#785f49';
      target.lineWidth = Math.max(1,canvas.height/span*.040);
      target.beginPath(); target.moveTo(bottom.x,bottom.y); target.lineTo(high.x,high.y); target.stroke();
      paint([[point,1.18],[transform(.06,.028),-.048],[transform(.80,.085),-.078]],'#d7cbb0');
      paint([[point,.82],[transform(.055,.025),.435],[transform(.48,.072),.385]],'#b37961');
    } };
  });

  const lanterns: RasterLayer[] = [
    [6.63, 11.23], [8.21, 13.76], [11.68, 11.22], [15.59, 13.76], [18.74, 11.22], [21.58, 13.76], [26.34, 11.22],
    [31.23, 13.76], [35.28, 11.32], [37.81, 12.38], [4.73, 27.36], [9.51, 28.28], [12.27, 31.26], [14.22, 33.14],
    [20.44, 33.88], [22.22, 34.37], [24.80, 34.32], [27.26, 29.17], [30.82, 27.13], [34.26, 35.74], [35.29, 41.49],
  ].map(([column, row]) => {
    const point = ringPosition(column, row);
    return { point, radius: .46, top: 1.81, draw() {
      const foot = project(point), head = project(point, 1.57), cap = project(point, 1.72);
      const size = canvas.height / span;
      if (night) {
        const light = target.createRadialGradient(head.x, head.y, .015 * size, head.x, head.y, size * .48);
        light.addColorStop(0, '#ffca7b53');
        light.addColorStop(1, '#ffac5d00');
        target.fillStyle = light;
        target.fillRect(head.x-size*.49,head.y-size*.49,size*.98,size*.98);
      }
      target.strokeStyle = night ? '#253242' : '#394544';
      target.lineWidth = Math.max(.85, size * .048);
      target.beginPath();
      target.moveTo(foot.x, foot.y);
      target.lineTo(head.x, head.y);
      target.stroke();
      target.fillStyle = night ? '#ffca7e' : '#d7c49b';
      target.fillRect(head.x-size*.085,head.y-size*.067,size*.17,size*.152);
      shape([{x:head.x-size*.119,y:head.y-size*.06},{x:cap.x,y:cap.y-size*.028},
        {x:head.x+size*.119,y:head.y-size*.06}],night ? '#36444a' : '#394544');
    } };
  });

  const seawalls: RasterLayer[] = [];
  for (let row = 0; row < harborHeight; row++) for (let column = 0; column < RING_PERIOD; column++) {
    if (waterTile(column, row)) continue;
    const edges: [number, number, Face['point']][] = [
      [0, -1, t => ringPosition(column+t, row)],
      [1, 0, t => ringPosition(column+1, row+t)],
      [0, 1, t => ringPosition(column+1-t, row+1)],
      [-1, 0, t => ringPosition(column, row+1-t)],
    ];
    for (const [dx, dz, at] of edges) {
      if (!waterTile(column + dx, row + dz)) continue;
      const a = at(0), b = at(1);
      const length = Math.hypot(a.x-b.x,a.z-b.z);
      const side: Face = { point: at, span: length, parts: Math.max(1, Math.ceil(length * 1.5)) };
      seawalls.push({
        point: at(.5), radius: length/2+.25, top: .10, draw() {
          if ((b.z-a.z)*sine - (b.x-a.x)*cosine < 0) return;
          band(side, 0, 1, -.60, .018, '#838a7b', false, side.parts);
          band(side, 0, 1, -.605, -.373, '#64776d', false, side.parts);
          band(side, 0, 1, -.062, .025, '#cbbf9e', false, side.parts);
          if (street) for (const y of [-.162,-.361]) {
            band(side, .002, .998, y, y+.020, '#777c72', false, side.parts);
          }
        },
      });
    }
  }

  for (const [from, to] of ringBreakwaterSpans) {
    const row = harborHeight + .31;
    const sections = Math.ceil((to - from) * 2);
    const footprint = (start: number, end: number, inner: number, outer: number) =>
      [ringPosition(start, inner), ringPosition(end, inner), ringPosition(end, outer), ringPosition(start, outer)];
    for (let index = 0; index < sections; index++) {
      const start = from + (to-from)*index/sections, end = from + (to-from)*(index+1)/sections;
      const slab = footprint(start,end,row,row+.66);
      const ledge = footprint(start+.006,end-.006,row+.52,row+.705);
      seawalls.push({ point: ringPosition((start+end)/2,row+.33), radius: 1.28, top: .14, draw() {
        extrude(slab,-.628,.025,tone('#92927f',.88+index%4*.046),'#70796d','#b5a78c');
        extrude(ledge,.02,.123,'#afa185','#8d8a73','#c0b196');
      } });
    }
    const marker = footprint(from+.083,from+.153,row+.24,row+.59);
    seawalls.push({ point:ringPosition(from+.12,row+.41),radius:.32,top:.72,draw() {
      extrude(marker,.078,.225,'#a6977b','#827b6d','#b5a38c');
      extrude(marker,.225,.52,'#b57c62','#8e665a','#c59275');
      extrude(marker,.52,.612,'#ddc7a7','#b5a18c','#dbc9b0');
      extrude(marker,.612,.725,'#465454','#3b494d','#9c8767');
    } });
  }

  const rail: RasterLayer[] = [];
  for (let sector = 0; sector < RING_PERIOD; sector++) {
    const center = ringPosition(sector + .5, cityTransit.railZ);
    const bed = [[sector,cityTransit.railZ-1.01],[sector+1.015,cityTransit.railZ-1.01],
      [sector+1.015,cityTransit.railZ+1.01],[sector,cityTransit.railZ+1.01]].map(([x,z])=>ringPosition(x,z));
    const tracks = [-.315,.315].map(offset=>[ringPosition(sector,cityTransit.railZ+offset),ringPosition(sector+1.02,cityTransit.railZ+offset)]);
    rail.push({ point: center, radius: 1.1, top: cityTransit.railHeight + .15, draw() {
      extrude(bed,cityTransit.railHeight-.225,cityTransit.railHeight,'#4b625e','#3d5555','#8b918a');
      for (const track of tracks) {
        const [left,right]=track.map(p=>project(p,cityTransit.railHeight+.021));
        target.strokeStyle = night ? '#5a6867' : '#455d5c';
        target.lineWidth = Math.max(1,canvas.height/span*.030);
        target.beginPath();
        target.moveTo(left.x,left.y);
        target.lineTo(right.x,right.y);
        target.stroke();
      }
    } });
  }
  for (const column of cityViaductPiers) {
    const midpoint = ringPosition(column, cityTransit.railZ);
    const footprint = [[column-.15,cityTransit.railZ-.32],[column+.15,cityTransit.railZ-.32],
      [column+.15,cityTransit.railZ+.32],[column-.15,cityTransit.railZ+.32]].map(([x,z])=>ringPosition(x,z));
    rail.push({ point: midpoint, radius: .51, top: cityTransit.railHeight-.12, draw() {
      extrude(footprint,0,.51,'#b29e80','#857e70','#c2aa89');
      extrude(footprint,.51,cityTransit.railHeight-.19,'#526866','#405652','#859c94');
    } });
  }

  const grass: RasterLayer[] = [];
  for (let row = 0; row < harborHeight; row++) for (let col = 0; col < RING_PERIOD; col++) {
    if (tileAt('harbor', col, row) !== 'grass') continue;
    const stalks: { blade: WorldPoint[]; color: string }[] = [];
    for (let tuft = 0; tuft < 7; tuft++) {
      const across = col + .09 + ((tuft * 43 + row * 19 + col * 7) % 83) / 100;
      const near = row + .17 + ((tuft * 19 + row * 13 + col * 23) % 65) / 100;
      for (let blade = -1; blade <= 1; blade++) {
        const width = .11 / ringRadius(near);
        const height = .19 + ((row + col + tuft * 17 + blade * 19) % 11) * .014;
        stalks.push({
          blade: [
            [ringPosition(across-width, near), .008],
            [ringPosition(across+width, near+.038), .008],
            [ringPosition(across+width*blade*2.9, near-.15*blade), height],
          ],
          color: ['#557757', '#709166', '#88a475'][(tuft + blade + 3) % 3],
        });
      }
    }
    grass.push({ point: ringPosition(col+.5,row+.5), radius: .91, top: .34, draw() {
      if (street) for (const stalk of stalks) paint(stalk.blade, stalk.color);
    } });
  }
  const architecture = [...seawalls, ...layers, spire, beacon, fountain, ...boats, ...lanterns, ...rail, ...grass];

  function sprite(image: HTMLCanvasElement, position: World, id: FieldCreature, time: number, flip: boolean, stride = 0, passing = 0) {
    const profile = creatureGaits[id];
    const phase = time / (profile.airborne ? 665 : 420);
    const idle = time ? Math.sin(phase) : 0;
    const bob = .055 + profile.airborne + idle * (profile.airborne ? .115 : .019) +
      Math.abs(stride) * profile.bounce + passing * profile.airborne;
    const point = project(position, bob);
    const scale = canvas.height / span;
    const w = Math.min(scale * 1.2, scale * profile.height * image.width / image.height);
    const h = w * image.height / image.width;
    const soil = project(position);
    target.save();
    target.globalAlpha = 1 / (1 + bob * 1.8);
    target.fillStyle = '#223b428f';
    target.beginPath();
    target.ellipse(soil.x, soil.y, w * (.44 + bob * .16), scale * (.082 + bob * .052), 0, 0, Math.PI * 2);
    target.fill();
    target.globalAlpha = 1;
    target.translate(point.x, point.y);
    target.rotate((stride * .75 + idle * (profile.airborne ? .42 : .12)) * profile.sway);
    const squash = Math.abs(stride) * .046;
    target.scale((flip ? -1 : 1) * (1 + squash), 1 - squash);
    let art = image;
    if (night) {
      let tinted = nightSprites.get(image);
      if (!tinted) {
        tinted = document.createElement('canvas');
        tinted.width = image.width;
        tinted.height = image.height;
        const paint = tinted.getContext('2d')!;
        paint.drawImage(image, 0, 0);
        paint.globalCompositeOperation = 'source-atop';
        paint.fillStyle = '#26345149';
        paint.fillRect(0, 0, image.width, image.height);
        nightSprites.set(image, tinted);
      }
      art = tinted;
    }
    target.drawImage(art, -w / 2, -h, w, h);
    target.restore();
  }

  function actorDirection(facing: FieldView['facing'], column: number, row: number): FieldView['facing'] {
    const horizontal = facing === 'left' || facing === 'right';
    const sign = facing === 'left' || facing === 'up' ? -1 : 1;
    const origin = project(ringPosition(column, row));
    const ahead = project(ringPosition(column + (horizontal ? sign * .17 : 0), row + (horizontal ? 0 : sign * .35)));
    if (horizontal) return ahead.x < origin.x ? 'left' : 'right';
    return ahead.y < origin.y ? 'up' : 'down';
  }

  function ferry(time: number, calm: boolean, drop: number): RasterLayer {
    const column = calm ? 5.86 : (4.5 + time / 2925) % RING_PERIOD;
    const point = ringPosition(column, harborHeight + 4.02);
    const bearing = ringAngle(column);
    const tangent = { x: Math.cos(bearing), z: -Math.sin(bearing) };
    const outward = { x: Math.sin(bearing), z: Math.cos(bearing) };
    const drift = 14.2 * drop / fortressLiftDepth;
    point.x += outward.x * drift;
    point.z += outward.z * drift;
    const at = (along: number, across: number) => ({
      x: point.x + along * tangent.x + across * outward.x,
      z: point.z + along * tangent.z + across * outward.z,
    });
    return { point, radius: 2.42, top: 1.04, draw() {
      target.save();
      target.translate(0, drop * lift * canvas.height / span);
      for (const side of [-1, 1]) paint([
        [at(-3.45, side * .91), -.560], [at(-3.22, side * .86), -.560],
        [at(-1.74, side * .25), -.560], [at(-1.68, side * .28), -.560],
      ], night ? '#4c6a72' : '#689caa', true);
      const hull = [at(-1.78,-.38), at(-1.42,-.55), at(1.19,-.52), at(1.85,0), at(1.25,.52), at(-1.51,.47)];
      extrude(hull, -.591, -.152, '#486e72', '#304f58', '#a69073');
      const deck = [at(-1.24,-.397), at(.69,-.45), at(.69,.45), at(-1.24,.397)];
      extrude(deck, -.151, .58, '#c0b090', '#9c9b8b', '#e1d0a8');
      extrude(deck, .58, .68, '#648383', '#57716e', '#a2a396');
      for (const sign of [-1, 1]) {
        const leading = sign === 1;
        const face: Face = {
          point: t => at((leading ? 1 - t : t) * 1.91 - 1.24, .408 * sign), span: 1.91, parts: 1,
        };
        const p = face.point(.23), q = face.point(.77);
        if ((q.z - p.z) * sine - (q.x - p.x) * cosine < 0) continue;
        for (let pane = 0; pane < 5; pane++) {
          const start = .082 + pane * .179;
          band(face, start, start + .125, .125, .434, night ? '#dfb57a' : '#567a80', night);
        }
      }
      const stack = [at(-.77,-.08), at(-.59,-.08), at(-.59,.082), at(-.77,.082)];
      extrude(stack, .675, 1.016, '#a87762', '#8d6759', '#ac9b80');
      target.restore();
    } };
  }

  function visibleInFrame(layer: RasterLayer, scale: number, lowerBy = 0) {
    if (!layer.radius || !layer.top) return true;
    const pad = layer.radius * scale;
    const floor = project(layer.point, -lowerBy), roof = project(layer.point, layer.top - lowerBy);
    return floor.x + pad > 0 && floor.x - pad < canvas.width && floor.y + pad > 0 && roof.y - pad < canvas.height;
  }

  function draw(time: number, view: FieldView) {
    const calm = reduced.matches;
    pumpElapsed = view.pumpElapsed;
    const step = view.step;
    const progress = step ? Math.min(1, Math.max(0, (time - step.startedAt) / step.duration)) : 0;
    const px = (step ? step.from.x + ringXDelta(step.from.x, step.to.x) * progress : view.location.x) + .5;
    const row = step ? step.from.y + (step.to.y - step.from.y) * progress : view.location.y;
    const pz = ringStreetRow(row);
    const now = ringPosition(px, pz);
    const fortress = view.fortress;
    const cinematic = fortress.cinematic;
    const gateProgress = cinematic ? Math.min(1, Math.max(0, (fortress.drain - .61) / .34)) : 0;
    const gateZoom = gateProgress * gateProgress * (3 - 2 * gateProgress);
    const relief = cinematic ? Math.sin(Math.PI * Math.min(1, Math.max(0, (fortress.drain - .17) / .58))) ** 2 : 0;
    const overview = view.overview || cinematic;
    street = !overview;
    const outward = ringStreetLooksOutward(view.location.x, view.location.y);
    const focus = overview ? undefined : view.surveyFocus;
    const camera = focus ? ringPosition(focus.position.x, focus.position.y) : overview ? { x: 0, z: 0 }
      : ringPosition(px + (outward ? -.25 : .37), pz + (outward ? 1.31 : -1.37));
    if (cinematic) {
      const west = ringPosition(3.5, harborHeight + .6);
      const approach = gateZoom + .32 * relief * (1 - gateZoom);
      camera.x = west.x * approach;
      camera.z = west.z * approach;
    }
    const aspect = canvas.width / canvas.height;
    const tour = overview ? ringOverviewCamera(aspect, canvas.clientWidth < 545, view.orbitTilt) : undefined;
    const rustle = street && !focus ? view.rustle : undefined;
    const reveal = rustle && Math.abs(ringXDelta(px, rustle.x + .5)) + Math.abs(pz - rustle.y - .5) < 7.8
      ? ringPosition(rustle.x + .5, rustle.y + .5) : undefined;
    if (reveal) {
      camera.x += (reveal.x - camera.x) * .24;
      camera.z += (reveal.z - camera.z) * .24;
    }
    const yaw = cinematic ? ringAngle(3.5) - (.39 - fortress.lift * .20) * (1 - gateZoom)
      : focus ? ringAngle(focus.position.x) + (focus.id === 'station' ? Math.PI - .28 : .29)
      : overview ? harborOverviewYaw + view.orbitOffset + (calm ? 0 : Math.sin(time / 8300) * .09)
        : ringAngle(px) + (outward ? Math.PI - .26 : .28);
    if (overview && (view.orbitOffset !== orbitOffset || view.orbitTilt !== orbitTilt)) orbitChangedAt = time;
    orbitOffset = view.orbitOffset;
    orbitTilt = view.orbitTilt;
    const dragging = overview && time - orbitChangedAt < 180;
    const delta = calm || !previous ? 1 : 1 - Math.exp(-Math.min(68, time - previous) / (dragging ? 72 : 141));
    previous = time;
    const turn = Math.atan2(Math.sin(yaw - angle), Math.cos(yaw - angle));
    angle += turn * delta;
    x += (camera.x - x) * delta;
    z += (camera.z - z) * delta;
    const closeHeight = focus?.id === 'station' || focus?.id === 'market' ? .50 : .18;
    const rise = fortress.lift;
    const wide = Math.max(30 + 13.5 * rise, (62 + 12 * rise) / aspect);
    const fortressSpan = wide * (1 - gateZoom) * (1 - .22 * relief) + 13.4 * gateZoom;
    const cutHeight = (.6 - fortressLiftDepth * rise * .40 - 2.0 * relief) * (1 - gateZoom) - 2.8 * gateZoom;
    const highTide = !cinematic && view.overview ? rise : 0;
    const tourHeight = (tour?.elevation ?? .67) - fortressLiftDepth * highTide * .43;
    const tourPitch = (tour?.pitch ?? .805) - .23 * highTide;
    const tourSpan = highTide ? Math.max(tour?.span ?? 0, 61, 75 / aspect) : tour?.span ?? 9.7;
    height += ((cinematic ? cutHeight : focus ? closeHeight : tourHeight) - height) * delta;
    pitch += ((cinematic ? .38 - .19 * rise + .065 * gateZoom : focus ? (focus.id === 'garden' ? .82 : .60) : tourPitch) - pitch) * delta;
    span += ((cinematic ? fortressSpan : focus ? (canvas.clientWidth < 545 ? 3.85 : 3.65) : tourSpan) - span) * delta;
    if (reveal) {
      const markerSpan = frameStreetSubject(reveal.x - x, reveal.z - z, -height, angle, pitch, aspect);
      const playerSpan = frameStreetSubject(now.x - x, now.z - z, .70 - height, angle, pitch, aspect);
      span = Math.max(span, markerSpan, playerSpan);
    }
    sine = Math.sin(angle);
    cosine = Math.cos(angle);
    flatten = Math.sin(pitch);
    lift = Math.cos(pitch);
    night = view.night;
    const size = canvas.height / span;

    target.fillStyle = night ? '#1e3a54' : ringSeaColor;
    target.fillRect(0,0,canvas.width,canvas.height);
    const origin = project({x:0,z:0});
    const screenX = Math.max(origin.x, canvas.width-origin.x) / (bastionRadius*size);
    const screenY = Math.max(origin.y, canvas.height-origin.y) / (bastionRadius*size*flatten);
    const exposedCoast = fortress.lift > .005 && screenX*screenX + screenY*screenY > 1;
    const waterDrop = fortress.lift * fortressLiftDepth;
    const ship = ferry(time, calm, waterDrop);
    const farFerry = fortress.lift > .005 && depthAt(ship.point) < 0;
    if (exposedCoast) {
      drawBastionSea(target, project, size, fortress.lift, calm ? 0 : time, night);
      if (farFerry) ship.draw();
      drawRasterBastion(target, project, angle, size, flatten, fortress, calm ? 0 : time, night, view.resonance);
    }
    target.save();
    target.setTransform(cosine * size, sine * size * flatten, -sine * size,
      cosine * size * flatten, origin.x, origin.y);
    target.imageSmoothingEnabled = true;
    if (fortress.lift > .005) {
      target.beginPath();
      target.arc(0, 0, bastionRadius, 0, Math.PI * 2);
      target.clip();
    }
    target.drawImage(terrain, -ringPlanExtent, -ringPlanExtent, ringPlanExtent * 2, ringPlanExtent * 2);
    target.restore();
    if (night) {
      target.save();
      if (exposedCoast) {
        target.beginPath();
        target.ellipse(origin.x,origin.y,bastionRadius*size,bastionRadius*size*flatten,0,0,Math.PI*2);
        target.clip();
      }
      target.fillStyle = '#111b3c82';
      target.fillRect(0, 0, canvas.width, canvas.height);
      target.restore();
    }
    target.imageSmoothingEnabled = false;

    const mark = (column: number, row: number, radius: number, color: string) => {
      const point = project(ringPosition(column, row));
      target.beginPath();
      target.ellipse(point.x, point.y, radius * size, radius * size * flatten, 0, 0, Math.PI * 2);
      target.strokeStyle = color;
      target.lineWidth = Math.max(1, .052 * size);
      target.stroke();
    };
    for (const point of view.path.slice(0, 12)) mark(point.x + .5, point.y + .5, .061, '#efdeb9');
    const destination = view.path.at(-1);
    if (destination) mark(destination.x + .5, destination.y + .5, .31, '#ffdea2');
    if (view.rustle) {
      const pulse = calm ? .28 : .28 + .055 * Math.sin(time / 195);
      const col = view.rustle.x + .5, row = view.rustle.y + .5;
      mark(col, row, pulse + .058, night ? '#bdc68b8a' : '#4a615b9a');
      mark(col, row, pulse, night ? '#f9d791' : '#f4edd3');
    }
    for (const gate of view.map.exits) mark(gate.x + .5, gate.y + .29, .21, '#dec29a');

    const visible = architecture.filter(layer => visibleInFrame(layer, size)
      && (!focus || depthAt(layer.point) - depthAt(camera) < 4.0));
    const control = ringPosition(3.96, 11.60);
    visible.push({ point: control, radius: .55, top: 1, draw() {
      const foot = project(control), hub = project(control, .70);
      target.fillStyle = night ? '#354950' : '#61716b';
      target.fillRect(foot.x-size*.24, foot.y-size*.08, size*.48, size*.105);
      target.fillStyle = night ? '#40575b' : '#485f5e';
      target.fillRect(foot.x-size*.10, hub.y, size*.20, Math.max(1,foot.y-hub.y));
      if(view.resonance>.01){
        const aura=target.createRadialGradient(hub.x,hub.y,0,hub.x,hub.y,size*.41);
        aura.addColorStop(0,'rgba(138,244,207,'+(.65*view.resonance)+')');aura.addColorStop(1,'transparent');
        target.fillStyle=aura;
        target.fillRect(hub.x-size*.41,hub.y-size*.41,size*.82,size*.82);
        target.fillStyle='rgba(180,255,221,'+view.resonance+')';
        target.fillRect(foot.x-size*.037,hub.y+.045*size,size*.074,Math.max(1,foot.y-hub.y));
      }
      target.beginPath();
      target.ellipse(hub.x,hub.y,size*.22,size*.18,-.19,0,Math.PI*2);
      target.lineWidth=Math.max(1,size*.052);
      target.strokeStyle=view.resonance>.30?'#c2f6d8':fortress.phase==='open'?'#98c8ac':'#dfb477';
      target.stroke();
      for(let i=0;i<6;i++){
        const a = i*Math.PI/3+.30+fortress.lift*1.8;
        target.beginPath();
        target.moveTo(hub.x,hub.y);
        target.lineTo(hub.x+Math.cos(a)*size*.204,hub.y+Math.sin(a)*size*.164);
        target.lineWidth=Math.max(.56,size*.027);
        target.stroke();
      }
    }});
    if (!farFerry && visibleInFrame(ship, size, waterDrop)) visible.push(ship);
    const trainX = calm ? 12.4 : (time / 850 + 11.7) % RING_PERIOD;
    for (const shift of [-.9, 1.0]) {
      const midpoint = trainX + shift;
      visible.push({ point: ringPosition(midpoint, cityTransit.railZ), draw() {
        const body = [[midpoint-.86,cityTransit.railZ-.65], [midpoint+.84,cityTransit.railZ-.65],
          [midpoint+.84,cityTransit.railZ+.65], [midpoint-.86,cityTransit.railZ+.65]].map(([x,z])=>ringPosition(x,z));
        extrude(body, cityTransit.railHeight, cityTransit.railHeight+.72, '#588384', '#a8755c', '#d3cbb0');
      } });
    }
    const appendActor = (role: FieldView['map']['npcs'][number]['style'] | 'player', position: World, direction: FieldView['facing'], idle = 0) => {
      visible.push({ point: position, draw() {
        const p = project(position);
        target.fillStyle = '#263d4450';
        target.beginPath();
        target.ellipse(p.x, p.y - size * .033, size * .252, size * .082, 0, 0, Math.PI * 2);
        target.fill();
        target.save();
        target.translate(p.x, p.y);
        target.scale(size / TILE, size / TILE);
        drawFieldActor(target, role, direction, idle, 0, 0);
        target.restore();
      } });
    };
    const facing = actorDirection(view.facing, px, pz);
    appendActor('player', now, facing, step && !calm ? progress < .5 ? 1 : 2 : 0);
    for (const npc of view.map.npcs) {
      const column = npc.x + .5, row = npc.y + .875;
      const pose = npc === view.activeNpc && view.activeNpcFacing ? actorDirection(view.activeNpcFacing, column, row) : 'down';
      appendActor(npc.style, ringPosition(column, row), pose);
      if (npc.event === 'guide' && view.sylveon) {
        const art = view.sylveon;
        const point = ringPosition(npc.x + 1.2, npc.y + .95);
        visible.push({ point, radius: .65, top: 1.22, draw: () => sprite(art, point, 'sylveon', calm ? 0 : time, false) });
      }
    }
    if (view.companionImage) {
      const art = view.companionImage;
      const id = view.companionId ?? 'piplup';
      const pet = companionPosition(view, progress);
      const point = ringPosition(pet.x + .5, ringStreetRow(pet.y));
      const offset = project(now).x - project(point).x;
      const orientation = Math.abs(offset) > size * .10 ? Math.sign(offset) : facing === 'right' ? 1 : -1;
      const flip = orientation * creatureGaits[id].sourceFacing < 0;
      const stride = step && !calm ? Math.sin(progress * Math.PI) * ((step.from.x + step.from.y) % 2 ? -1 : 1) * (step.running ? 1.27 : 1) : 0;
      visible.push({ point, draw: () => sprite(art, point, id, calm ? 0 : time, flip, stride, calm ? 0 : pet.passing) });
    }
    paintedLayers = visible.sort((a, b) => depthAt(a.point) - depthAt(b.point));
    paintedLayers.forEach(item => item.draw());
  }

  function projectPoint(x: number, y: number) {
    return { ...project(ringPosition(x / TILE, y / TILE)), scale: canvas.height / (span * TILE) };
  }

  function hitsFace(face: readonly WorldPoint[], x: number, y: number) {
    return contains(face.map(([point, altitude]) => project(point, altitude)), x, y);
  }

  function layerCovers(layer: RasterLayer, x: number, y: number) {
    return (layer.volume !== undefined && covers(layer.volume, x, y)) || layer.picks?.some(face => hitsFace(face, x, y));
  }

  function hitSurvey(x: number, y: number): SurveyId | undefined {
    if (!street) return;
    for (let index = paintedLayers.length - 1; index >= 0; index--) {
      const layer = paintedLayers[index];
      if (!layer.survey || !layerCovers(layer, x, y)) continue;
      for (let front = index + 1; front < paintedLayers.length; front++) {
        if (layerCovers(paintedLayers[front], x, y)) return;
      }
      return layer.survey;
    }
  }

  function pointInWorld(px: number, py: number) {
    if (occluders.some(volume => covers(volume, px, py)) ||
      structurePicks.some(faces => faces.some(face => hitsFace(face, px, py)))) return;
    const scale = canvas.height / span;
    const rx = (px - canvas.width * .5) / scale;
    const rz = ((py - canvas.height * .5) / scale - height * lift) / flatten;
    const point = ringCoordinates(x + rx * cosine + rz * sine, z - rx * sine + rz * cosine);
    return { x: point.x * TILE, y: point.z * TILE };
  }

  function hitActor(x: number, y: number, actors: FieldView['map']['npcs'], doorway: (actor: FieldView['map']['npcs'][number]) => boolean) {
    const size = canvas.height / (span * TILE);
    const inFront = (point: World) => {
      const depth = depthAt(point);
      return !architecture.some(layer => depthAt(layer.point) > depth && layerCovers(layer, x, y));
    };
    const nearby = actors.map(actor => ({ actor, point: ringPosition(actor.x + .5, actor.y + .875) }))
      .sort((a, b) => depthAt(b.point) - depthAt(a.point));
    for (const { actor, point } of nearby) {
      const feet = project(point);
      const px = Math.abs((x - feet.x) / size), py = (feet.y - y) / size;
      if (px <= (py < 5 ? 5.5 : 7.25) && py >= 1.2 && py <= 23.1 && inFront(point)) return actor;
      if (actor.event === 'about' && doorway(actor)) {
        const layer = layers.find(layer => layer.entrance);
        const polygon = layer?.entrance?.map(([point, altitude]) => project(point, altitude));
        const face = layer?.entrance;
        if (polygon && face && polygon[1].x < polygon[0].x && contains(polygon, x, y) && inFront(face[0][0])) return actor;
      }
    }
  }

  return {
    draw, resize, projectPoint, pointInWorld, hitActor, hitSurvey,
    resetCamera: () => { previous = 0; },
    hasStreetFrame: () => street && canvas.width > 0 && canvas.height > 0,
    getCamera: () => ({ x, y:z, depth: 0, scale: canvas.height / (span * TILE), width: canvas.width, height: canvas.height }),
  };
}
