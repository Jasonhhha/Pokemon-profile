import {
  BoxGeometry, CylinderGeometry, DoubleSide, Group, Mesh, MeshStandardMaterial, RingGeometry,
  type Material,
} from 'three';
import { cityTransit, cityViaductPiers } from './field-city-layout';
import { buildCityCarriages } from './field-city-transit';
import { batchStaticMeshes } from './field-mesh-batch';
import { RING_PERIOD, ringAngle, ringPosition, ringRadius } from './field-ring-space';

const dark = new MeshStandardMaterial({ color: 0x304b56, roughness: .68, metalness: .28, side: DoubleSide });
const upper = new MeshStandardMaterial({ color: 0x718287, roughness: .65, metalness: .23 });
const steel = new MeshStandardMaterial({ color: 0xadb6ae, roughness: .40, metalness: .42 });
const brass = new MeshStandardMaterial({ color: 0xc09a68, roughness: .45, metalness: .41 });
const column = new MeshStandardMaterial({ color: 0xb9aa91, roughness: .88 });
const coping = new MeshStandardMaterial({ color: 0xd8c7a5, roughness: .78 });
const tile = new BoxGeometry(1, 1, 1);
const cylinder = new CylinderGeometry(1, 1, 1, 12);

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

function structure() {
  const base = new Group();
  const { railZ, railHeight } = cityTransit;
  const radius = ringRadius(railZ);
  ribbon(base, railHeight - .146, radius, 1.12, dark);
  ribbon(base, railHeight, radius, .995, upper);
  for (const side of [-1, 1]) {
    fascia(base, radius + side * .549, railHeight - .193, .305, dark);
    ribbon(base, railHeight - .084, radius + side * .512, .062, brass);
    ribbon(base, railHeight + .05, radius + side * .208, .055, steel);
    fascia(base, radius + side * .49, railHeight + .163, .031, steel);
  }
  for (let i = 0; i < 156; i++) {
    const x = i / 156 * RING_PERIOD;
    const theta = ringAngle(x);
    const center = ringPosition(x, railZ);
    piece(base, center, railHeight + .017, [.071, .047, .80], dark, theta);
    if (i % 2) continue;
    for (const side of [-1, 1]) {
      const stanchion = ringPosition(x, railZ + side * 1.02);
      piece(base, stanchion, railHeight + .070, [.032, .211, .045], dark, theta);
    }
  }
  for (const x of [1.18, 4.65, ...cityViaductPiers, 36.10, 39.1]) {
    const point = ringPosition(x, railZ);
    const yaw = ringAngle(x);
    piece(base, point, -.34, [.34, .99, .33], column, yaw, true);
    piece(base, point, .14, [.36, .20, .37], coping, yaw, true);
    piece(base, point, railHeight * .5, [.155, railHeight - .32, .157], dark, yaw, true);
    piece(base, point, railHeight - .40, [.275, .21, .31], brass, yaw, true);
    piece(base, point, railHeight - .24, [.65, .155, .72], dark, yaw);
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
  group.add(rail, ...train.cars);
  return {
    group, structure: rail,
    update(time: number, night: number) {
      const cycle = time ? (time / 1000 + 1.17) % 44 : 2.9;
      const index = stops.findIndex(stop => stop.at > cycle);
      const [from, to] = [stops[index - 1], stops[index]];
      const phase = (cycle - from.at) / (to.at - from.at);
      const edge = .14;
      const ease = phase < edge ? phase * phase / (2 * edge)
        : phase > 1 - edge ? 1 - edge - (1 - phase) ** 2 / (2 * edge) : phase - edge * .50;
      const center = from.x + (to.x - from.x) * ease / (1 - edge);
      const gauge = ringRadius(cityTransit.railZ) * Math.PI * 2 / RING_PERIOD;
      for (const [index, car] of train.cars.entries()) {
        const x = center + (index ? 1.47 : -1.47) / gauge;
        const point = ringPosition(x, cityTransit.railZ);
        car.position.set(point.x, cityTransit.railHeight + .03, point.z);
        car.rotation.set(time ? Math.sin(x * 10) * .009 : 0, ringAngle(x), 0);
      }
      train.lighting(night);
    },
  };
}
