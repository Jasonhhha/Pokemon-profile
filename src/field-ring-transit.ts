import {
  BoxGeometry, Color, CylinderGeometry, DoubleSide, Group, InstancedMesh, Mesh, MeshBasicMaterial, MeshStandardMaterial, Object3D, RingGeometry, Vector3,
  type Material,
} from 'three';
import { railFeed } from './fortress-power';
import { cityTransit, cityViaductPiers } from './field-city-layout';
import { buildCityCarriages, ringCarriageDimensions } from './field-city-transit';
import { batchStaticMeshes } from './field-mesh-batch';
import { RING_PERIOD, ringAngle, ringPosition, ringRadius } from './field-ring-space';

const dark = new MeshStandardMaterial({ color: 0x30494d, roughness: .68, metalness: .28, side: DoubleSide });
const upper = new MeshStandardMaterial({ color: 0x697a7b, roughness: .69, metalness: .23 });
const steel = new MeshStandardMaterial({ color: 0xa1aaa6, roughness: .42, metalness: .47 });
const brass = new MeshStandardMaterial({ color: 0xb18c5f, roughness: .51, metalness: .40 });
const paintedIron = new MeshStandardMaterial({ color: 0x4b675d, roughness: .59, metalness: .32 });
const mortar = new MeshStandardMaterial({ color: 0x92816c, roughness: .91 });
const column = new MeshStandardMaterial({ color: 0xb9aa91, roughness: .88 });
const coping = new MeshStandardMaterial({ color: 0xd8c7a5, roughness: .78 });
const tile = new BoxGeometry(1, 1, 1);
const cylinder = new CylinderGeometry(1, 1, 1, 12);
const railhead = .05;
const feedColumns = Array.from({ length: RING_PERIOD / 4 }, (_, i) => i * 4 + .5);
const up = new Vector3(0, 1, 0);
const arrow = new Vector3();

function ribbon(root: Group, at: number, radius: number, width: number, material: Material) {
  const geometry = new RingGeometry(radius - width / 2, radius + width / 2, 160);
  geometry.rotateX(-Math.PI / 2);
  const plane = new Mesh(geometry, material);
  plane.position.y = at;
  root.add(plane);
}

function fascia(root: Group, radius: number, y: number, height: number, material: Material) {
  const geometry = new CylinderGeometry(radius, radius, height, 160, 1, true);
  const shell = new Mesh(geometry, material);
  shell.position.y = y;
  root.add(shell);
}

function piece(group: Group, position: { x: number; z: number }, y: number, scales: [number, number, number], material: Material, yaw = 0, round = false) {
  const mesh = new Mesh(round ? cylinder : tile, material);
  mesh.position.set(position.x, y, position.z);
  mesh.scale.set(...scales);
  mesh.rotation.y = yaw;
  group.add(mesh);
  return mesh;
}

function strut(group: Group, a: Vector3, b: Vector3, width: number, depth: number, finish: Material) {
  arrow.copy(b).sub(a);
  const length = arrow.length();
  const member = new Mesh(tile, finish);
  member.position.copy(a).addScaledVector(arrow, .5);
  member.quaternion.setFromUnitVectors(up, arrow.normalize());
  member.scale.set(width, length + .012, depth);
  group.add(member);
}

function spanBraces(base: Group, posts: number[]) {
  const { railZ, railHeight } = cityTransit;
  const archPoint = (start: number, end: number, progress: number, side: number, y: number) => {
    const inset = Math.sin(Math.PI * progress) * .53 + .37;
    const point = ringPosition(start + (end - start) * progress, railZ + side * inset);
    return new Vector3(point.x, y, point.z);
  };
  for (let index = 0; index < posts.length; index++) {
    const start = posts[index], end = posts.at(index + 1) ?? posts[0] + RING_PERIOD;
    for (const side of [-1, 1]) {
      const points = Array.from({ length: 11 }, (_, step) => {
        const progress = step / 10;
        return archPoint(start, end, progress, side, railHeight - 1.02 + .65 * Math.sin(Math.PI * progress));
      });
      for (let j = 1; j < points.length; j++) strut(base, points[j - 1], points[j], .071, .061, paintedIron);
      for (const at of [2, 4, 6, 8]) {
        const foot = points[at];
        const head = archPoint(start, end, at / 10, side, railHeight - .215);
        strut(base, foot, head, .034, .039, dark);
        piece(base, foot, foot.y, [.062, .038, .065], brass, 0, true);
      }
    }
  }
}

function structure() {
  const base = new Group();
  const { railZ, railHeight } = cityTransit;
  const radius = ringRadius(railZ);
  for (const side of [-1, 1]) {
    ribbon(base, railHeight - .146, radius + side * .404, .221, dark);
    ribbon(base, railHeight - .033, radius + side * .405, .183, upper);
    fascia(base, radius + side * .549, railHeight - .193, .305, dark);
    ribbon(base, railHeight - .084, radius + side * .512, .062, brass);
    ribbon(base, railHeight + railhead, radius + side * ringCarriageDimensions.halfGauge, .055, steel);
    fascia(base, radius + side * ringCarriageDimensions.halfGauge, railHeight + .016, .052, dark);
    fascia(base, radius + side * .49, railHeight + .163, .031, steel);
  }
  for (let i = 0; i < 156; i++) {
    const x = i / 156 * RING_PERIOD;
    const theta = ringAngle(x);
    const center = ringPosition(x, railZ);
    piece(base, center, railHeight + .006, [.083, .060, .94], dark, theta);
    if (i % 2) continue;
    for (const side of [-1, 1]) {
      const stanchion = ringPosition(x, railZ + side * 1.02);
      piece(base, stanchion, railHeight + .070, [.032, .211, .045], dark, theta);
    }
  }
  const piers = [1.18, 4.65, ...cityViaductPiers, 36.10, 39.1];
  for (const x of piers) {
    const point = ringPosition(x, railZ);
    const yaw = ringAngle(x);
    piece(base, point, -.34, [.34, .99, .33], column, yaw, true);
    piece(base, point, -.047, [.363, .073, .355], mortar, yaw, true);
    piece(base, point, .14, [.36, .20, .37], coping, yaw, true);
    piece(base, point, .274, [.25, .153, .244], column, yaw, true);
    piece(base, point, .39, [.197, .087, .193], paintedIron, yaw, true);
    piece(base, point, railHeight * .50, [.164, railHeight - .35, .161], paintedIron, yaw, true);
    piece(base, point, railHeight - 1.04, [.209, .088, .204], dark, yaw, true);
    piece(base, point, railHeight - .54, [.227, .115, .23], paintedIron, yaw, true);
    piece(base, point, railHeight - .40, [.275, .183, .31], brass, yaw, true);
    piece(base, point, railHeight - .24, [.65, .155, .72], dark, yaw);
    for (const side of [-1, 1]) {
      const foot = ringPosition(x, railZ + side * .22);
      const head = ringPosition(x, railZ + side * .94);
      strut(base, new Vector3(foot.x, railHeight - .91, foot.z), new Vector3(head.x, railHeight - .31, head.z), .14, .12, paintedIron);
    }
  }
  spanBraces(base, piers);
  for (const x of feedColumns) {
    const bearing = ringAngle(x), point = ringPosition(x, railZ + 1.24);
    piece(base, point, railHeight - .16, [.59, .30, .14], dark, bearing);
    piece(base, ringPosition(x, railZ + 1.38), railHeight - .16, [.49, .22, .048], brass, bearing);
  }

  const station = ringPosition(29.55, railZ + 1.18);
  const stationHeading = ringAngle(29.55);
  piece(base, station, railHeight - .083, [2.70, .177, .45], dark, stationHeading);
  piece(base, station, railHeight + .014, [2.70, .060, .48], steel, stationHeading);
  for (const [at, side] of [[28.16, -1], [30.94, 1]]) {
    const rail = ringPosition(at, railZ + .98);
    piece(base, rail, railHeight + .18, [.054, .38, .07], dark, ringAngle(at));
    piece(base, ringPosition(at, railZ + 1.40), railHeight + .18, [.054, .38, .067], dark, ringAngle(at));
    piece(base, ringPosition(at, railZ + 1.19), railHeight + .38, [.064, .053, .372], brass, ringAngle(at) + side * .035);
  }

  const output = batchStaticMeshes(base, true);
  output.name = 'Elevated ring railway';
  return output;
}

const stops = [
  { at: 0, x: 11.4 }, { at: 18.5, x: 29.55 }, { at: 21.3, x: 29.55 }, { at: 44.0, x: 51.4 },
];

export function buildRingTransit() {
  const group = new Group();
  const rail = structure();
  const train = buildCityCarriages();
  const { railZ, railHeight } = cityTransit;
  const gaugeMaterial = new MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
  const gauges = new InstancedMesh(new BoxGeometry(.40, .135, .042), gaugeMaterial, feedColumns.length);
  const transform = new Object3D(), coldGlass = new Color(0x253b39), liveGlass = new Color(0xa7fff0), gaugeColor = new Color();
  gauges.name = 'Glazed supply indicators on the ring viaduct';
  feedColumns.forEach((column, i) => {
    const point = ringPosition(column, railZ + 1.44);
    transform.position.set(point.x, railHeight - .16, point.z);
    transform.rotation.y = ringAngle(column);
    transform.updateMatrix();
    gauges.setMatrixAt(i, transform.matrix);
  });
  group.add(gauges);
  const { axleHeight, bogieOffset, wheelRadius } = ringCarriageDimensions;
  const radius = ringRadius(railZ);
  const anglePerColumn = Math.PI * 2 / RING_PERIOD;
  const bogieAngle = Math.asin(bogieOffset / radius);
  const carRadius = radius * Math.cos(bogieAngle);
  const bufferReach = 1.50;
  const gap = .154;
  const halfCouplingAngle = Math.atan(bufferReach / carRadius) + Math.asin(gap / (2 * Math.hypot(carRadius, bufferReach)));
  const separation = halfCouplingAngle / anglePerColumn;
  const drawbarRadius = carRadius * Math.cos(halfCouplingAngle) + bufferReach * Math.sin(halfCouplingAngle);
  const carHeight = railHeight + railhead - axleHeight + wheelRadius;
  group.add(rail, ...train.cars);
  for (const { bogies } of train.assemblies) {
    for (const [index, bogie] of bogies.entries()) {
      const side = index ? 1 : -1;
      bogie.position.x = side * bogieOffset;
      bogie.rotation.y = side * bogieAngle;
    }
  }
  const coupler = new Group();
  piece(coupler, { x: 0, z: 0 }, 0, [gap + .045, .055, .082], dark);
  piece(coupler, { x: 0, z: 0 }, .009, [.093, .074, .089], paintedIron);
  piece(coupler, { x: 0, z: 0 }, .053, [.034, .025, .034], brass, 0, true);
  group.add(coupler);
  return {
    group, structure: rail,
    update(time: number, night: number, supply = .73, gridPhase = .45) {
      feedColumns.forEach((column, i) => {
        const current = railFeed(gridPhase, column / RING_PERIOD, supply, time === 0);
        gaugeColor.copy(coldGlass).lerp(liveGlass, current);
        gauges.setColorAt(i, gaugeColor);
      });
      gauges.instanceColor!.needsUpdate = true;
      const cycle = time ? (time / 1000 + 1.17) % 44 : 2.9;
      const index = stops.findIndex(stop => stop.at > cycle);
      const [from, to] = [stops[index - 1], stops[index]];
      const phase = (cycle - from.at) / (to.at - from.at);
      const edge = .14;
      const ease = phase < edge ? phase * phase / (2 * edge)
        : phase > 1 - edge ? 1 - edge - (1 - phase) ** 2 / (2 * edge) : phase - edge * .50;
      const center = from.x + (to.x - from.x) * ease / (1 - edge);
      const speed = time && to.x !== from.x ? Math.min(1, phase / edge, (1 - phase) / edge) : 0;
      for (const [index, { model, body }] of train.assemblies.entries()) {
        const angle = ringAngle(center + (index ? separation : -separation));
        // The chassis follows the chord between the two rail-aligned bogies.
        model.position.set(Math.sin(angle) * carRadius, carHeight, Math.cos(angle) * carRadius);
        model.rotation.y = angle;
        body.rotation.x = -.019 * speed ** 2;
      }
      const heading = ringAngle(center);
      coupler.position.set(Math.sin(heading) * drawbarRadius, carHeight + .199, Math.cos(heading) * drawbarRadius);
      coupler.rotation.y = heading;
      train.lighting(night, supply);
    },
    dispose() {
      train.dispose();
      gauges.dispose(); gauges.geometry.dispose(); gaugeMaterial.dispose();
      rail.traverse(object => { if (object instanceof Mesh) object.geometry.dispose(); });
    },
  };
}
