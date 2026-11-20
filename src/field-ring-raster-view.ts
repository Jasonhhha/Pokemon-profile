import { drawFieldActor } from './field-actors';
import { paintRingPlan, ringPlanExtent, ringSeaColor } from './field-city-chart';
import { cityParcels, cityTerraces, cityTransit } from './field-city-layout';
import { TILE } from './field-layout';
import { companionPosition, type FieldView } from './field-renderer';
import { ringAngle, ringCoordinates, ringOverviewCamera, ringPosition, ringStreetRow, ringXDelta } from './field-ring-coordinates';

type Point = { x: number; y: number };
type World = { x: number; z: number };
type Volume = { footprint: World[]; bottom: number; top: number };
const roofs = ['#687d85', '#668b92', '#926d60', '#647c91'];
const walls = ['#caad85', '#b8c5b8', '#b17c67', '#9baead'];
const terraceWalls = ['#a16b55', '#ad7a60', '#b2856a', '#965b4b', '#b19676'];

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
  terrain.width = terrain.height = 840;
  const worldScale = terrain.width / (ringPlanExtent * 2);
  paintRingPlan(atlas, terrain.width / 2, terrain.height / 2, worldScale, true);

  let angle = .16;
  let pitch = .82;
  let height = 1.7;
  let x = 0, z = 0, span = 22.9;
  let previous = 0;
  let orbitChangedAt = -Infinity;
  let orbitOffset = 0;
  let orbitTilt = 0;

  function resize(w: number, h: number) {
    if (w <= 0 || h <= 0) return;
    const ratio = Math.min(1, 690 / w, 480 / h);
    const width = Math.max(1, Math.round(w * ratio)), height = Math.max(1, Math.round(h * ratio));
    if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
  }

  function project(world: World, y = 0): Point {
    const scale = canvas.height / span;
    const dx = world.x - x, dz = world.z - z;
    return {
      x: canvas.width * .5 + (dx * Math.cos(angle) - dz * Math.sin(angle)) * scale,
      y: canvas.height * .5 + ((dx * Math.sin(angle) + dz * Math.cos(angle)) * Math.sin(pitch) - (y - height) * Math.cos(pitch)) * scale,
    };
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
      shape([foot[index], foot[next], leading[next], leading[index]], index % 2 ? shade : wall);
      if (detail && foot[index].y + foot[next].y > baseDepth) {
        const left = corners[index], right = corners[next];
        const width = Math.hypot(left.x - right.x, left.z - right.z);
        const openings = Math.max(2, Math.floor(width / .63));
        for (let row = floor + .49; row < ceiling - .37; row += .85) {
          for (let pane = 1; pane <= openings; pane++) {
            const portion = pane / (openings + 1);
            const point = project({ x: left.x + (right.x - left.x) * portion, z: left.z + (right.z - left.z) * portion }, row);
            const unit = canvas.height / span;
            target.fillStyle = '#364e59';
            target.fillRect(point.x - unit * .125, point.y - unit * .15, unit * .25, unit * .30);
            target.fillStyle = (row + pane) % 4 < 1.23 ? '#d6b888' : '#759b9c';
            target.fillRect(point.x - unit * .092, point.y - unit * .094, unit * .185, unit * .20);
          }
        }
      }
    }
    shape(leading, roof);
    target.strokeStyle = '#24394495';
    target.lineWidth = .8;
    target.stroke();
  }

  function building(x: number, z: number, width: number, depth: number, roof: number, wall: string, shade: string, cap: string, ridge = 0) {
    const footprint = [[x + .15, z + .13], [x + width - .16, z + .13], [x + width - .16, z + depth - .13], [x + .15, z + depth - .13]]
      .map(([column, row]) => ringPosition(column, row));
    const crest = [ringPosition(x + .15, z + depth / 2), ringPosition(x + width - .16, z + depth / 2)];
    return {
      point: ringPosition(x + width / 2, z + depth / 2),
      volume: { footprint, bottom: 0, top: roof + ridge },
      draw() {
        extrude(footprint, 0, roof, wall, shade, cap, true);
        if (!ridge) return;
        const [a, b, c, d] = footprint.map(point => project(point, roof));
        const [left, right] = crest.map(point => project(point, roof + ridge));
        shape([a, b, right, left], '#5d6d75');
        shape([left, right, c, d], '#3d4a55');
        shape([a, left, d], wall);
        shape([right, b, c], shade);
      },
    };
  }

  const layers = [
    ...cityParcels.map(({ x, z, width, depth, finish, stories }) =>
      building(x, z, width, depth, .67 + stories * .86, walls[finish], '#7d7772', roofs[finish])),
    ...cityTerraces.flatMap(lot => {
      const bay = lot.width / lot.homes;
      return Array.from({ length: lot.homes }, (_, index) => building(lot.x + bay * index, lot.z, bay, lot.depth,
        1.56 + (index % 3) * .115, terraceWalls[(index + lot.x) % terraceWalls.length], '#87665a', '#536372', .34));
    }),
  ];
  const cylindrical = (radius: number) => Array.from({ length: 12 }, (_, side) => ({ x: Math.cos(side * Math.PI / 6) * radius, z: Math.sin(side * Math.PI / 6) * radius }));
  const caisson = cylindrical(2.37), shaft = cylindrical(.88), crown = cylindrical(1.08);
  const occluders = [
    ...layers.map(layer => layer.volume),
    { footprint: shaft, bottom: .12, top: 8.38 },
    { footprint: crown, bottom: 7.93, top: 9.21 },
  ];
  const spire = { point: { x: 0, z: 0 }, draw() {
    extrude(caisson, -.58, .12, '#a59c85', '#766f62', '#c2bfa6');
    extrude(shaft, .12, 8.38, '#c8baa0', '#9e9386', '#cdbb95', true);
    extrude(crown, 7.93, 9.21, '#628586', '#42656f', '#537784');
    const top = project({x:0,z:0}, 10.33);
    const unit = canvas.height / span;
    target.beginPath();
    target.arc(top.x, top.y, unit * .26, 0, Math.PI * 2);
    target.strokeStyle = '#edc487';
    target.lineWidth = 1.4;
    target.stroke();
  } };

  function sprite(image: HTMLCanvasElement, position: World, bob: number, flip: boolean) {
    const point = project(position, bob);
    const scale = canvas.height / span;
    const w = Math.min(scale * 1.1, scale * .92 * image.width / image.height);
    const h = w * image.height / image.width;
    const soil = project(position);
    target.fillStyle = '#223b4277';
    target.beginPath();
    target.ellipse(soil.x, soil.y, w * .46, scale * .09, 0, 0, Math.PI * 2);
    target.fill();
    target.save();
    target.translate(point.x, point.y);
    if (flip) target.scale(-1, 1);
    target.drawImage(image, -w/2, -h, w, h);
    target.restore();
  }

  function draw(time: number, view: FieldView) {
    const calm = reduced.matches;
    const step = view.step;
    const progress = step ? Math.min(1, Math.max(0, (time - step.startedAt) / step.duration)) : 0;
    const px = (step ? step.from.x + ringXDelta(step.from.x, step.to.x) * progress : view.location.x) + .5;
    const row = step ? step.from.y + (step.to.y - step.from.y) * progress : view.location.y;
    const pz = ringStreetRow(row);
    const now = ringPosition(px, pz);
    const overview = view.overview;
    const camera = overview ? { x: 0, z: 0 } : ringPosition(px + .37, pz - 1.37);
    const tour = overview ? ringOverviewCamera(canvas.width / canvas.height, canvas.clientWidth < 545, view.orbitTilt) : undefined;
    const yaw = overview ? .16 + view.orbitOffset + (calm ? 0 : time / 35000) : ringAngle(px) + .28;
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
    height += ((tour?.elevation ?? .67) - height) * delta;
    pitch += ((tour?.pitch ?? .805) - pitch) * delta;
    span += ((tour?.span ?? 9.7) - span) * delta;
    const size = canvas.height / span;

    target.fillStyle = ringSeaColor;
    target.fillRect(0,0,canvas.width,canvas.height);
    const origin = project({x:0,z:0});
    target.save();
    const flatten = Math.sin(pitch);
    target.setTransform(Math.cos(angle) * size, Math.sin(angle) * size * flatten, -Math.sin(angle) * size,
      Math.cos(angle) * size * flatten, origin.x, origin.y);
    target.imageSmoothingEnabled = true;
    target.drawImage(terrain, -ringPlanExtent, -ringPlanExtent, ringPlanExtent * 2, ringPlanExtent * 2);
    target.restore();
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
      mark(view.rustle.x + .5, view.rustle.y + .5, pulse, '#f4edd3');
    }
    for (const gate of view.map.exits) mark(gate.x + .5, gate.y + .29, .21, '#dec29a');

    const visible = [...layers, spire];
    const trainX = calm ? 12.4 : (time / 850 + 11.7) % 40;
    for (let sector = 0; sector < 40; sector++) {
      const center = ringPosition(sector + .5, cityTransit.railZ);
      visible.push({ point: center, draw() {
        const ring = [[sector, cityTransit.railZ - 1.01], [sector + 1.015, cityTransit.railZ - 1.01],
          [sector + 1.015, cityTransit.railZ + 1.01], [sector, cityTransit.railZ + 1.01]].map(([x,z]) => ringPosition(x,z));
        extrude(ring, cityTransit.railHeight - .22, cityTransit.railHeight, '#405762', '#3e4b58', '#7a9195');
      } });
    }
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
        target.save();
        target.translate(p.x, p.y);
        target.scale(size / TILE, size / TILE);
        drawFieldActor(target, role, direction, idle, 0, 0);
        target.restore();
      } });
    };
    appendActor('player', now, view.facing, step && !calm ? progress < .5 ? 1 : 2 : 0);
    for (const npc of view.map.npcs) {
      appendActor(npc.style, ringPosition(npc.x + .5, npc.y + .875), npc === view.activeNpc && view.activeNpcFacing ? view.activeNpcFacing : 'down');
      if (npc.event === 'guide' && view.sylveon) {
        const point = ringPosition(npc.x + 1.2, npc.y + .95);
        visible.push({point,draw:()=>sprite(view.sylveon!,point,calm ? 0 : .018 * Math.sin(time / 380),false)});
      }
    }
    if (view.companionImage) {
      const pet = companionPosition(view, progress);
      const point = ringPosition(pet.x + .5, ringStreetRow(pet.y));
      const lift = (view.companionId === 'drifloon' ? .29 : 0) + (calm ? 0 : Math.abs(Math.sin(time / 91)) * (step ? .12 : .023));
      visible.push({point,draw:()=>sprite(view.companionImage!,point,lift,view.facing==='right')});
    }
    visible.sort((a, b)=>project(a.point).y-project(b.point).y).forEach(item=>item.draw());
    if (view.night) {
      target.fillStyle = '#172c5572';
      target.fillRect(0,0,canvas.width,canvas.height);
    }
  }

  function projectPoint(x: number, y: number) {
    return { ...project(ringPosition(x / TILE, y / TILE)), scale: canvas.height / (span * TILE) };
  }

  function pointInWorld(px: number, py: number) {
    if (occluders.some(volume => covers(volume, px, py))) return;
    const scale = canvas.height / span;
    const rx = (px - canvas.width * .5) / scale;
    const rz = ((py - canvas.height * .5) / scale - height * Math.cos(pitch)) / Math.sin(pitch);
    const point = ringCoordinates(x + rx * Math.cos(angle) + rz * Math.sin(angle), z - rx * Math.sin(angle) + rz * Math.cos(angle));
    return { x: point.x * TILE, y: point.z * TILE };
  }

  return {
    draw, resize, projectPoint, pointInWorld,
    resetCamera: () => { previous = 0; },
    getCamera: () => ({ x, y:z, depth: 0, scale: canvas.height / (span * TILE), width: canvas.width, height: canvas.height }),
  };
}
