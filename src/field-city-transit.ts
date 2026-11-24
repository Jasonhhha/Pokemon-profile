import {
  BoxGeometry, CanvasTexture, Color, CylinderGeometry, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial,
  SphereGeometry, SRGBColorSpace, type BufferGeometry, type Material,
} from 'three';
import { batchStaticMeshes } from './field-mesh-batch';
import { cityTransit, cityViaductPiers } from './field-city-layout';

const iron = new MeshStandardMaterial({ color: 0x3e5358, roughness: .75, metalness: .37 });
const darkIron = new MeshStandardMaterial({ color: 0x2a3d46, roughness: .76, metalness: .32 });
const steel = new MeshStandardMaterial({ color: 0x9caaab, metalness: .54, roughness: .39 });
const rivet = new MeshStandardMaterial({ color: 0xb18b63, roughness: .47, metalness: .52 });
const limestone = new MeshStandardMaterial({ color: 0xb4a690, roughness: .84 });
const stoneEdge = new MeshStandardMaterial({ color: 0xd9c9ad, roughness: .82 });
const scarlet = new MeshStandardMaterial({ color: 0xb96e54, roughness: .52, metalness: .25 });
const canopy = new MeshStandardMaterial({ color: 0xdfcdb0, roughness: .66, metalness: .31 });
const enamel = new MeshStandardMaterial({ color: 0x335b64, roughness: .43, metalness: .43 });
const trim = new MeshStandardMaterial({ color: 0xe1b67b, roughness: .41, metalness: .37 });
const darkGlass = new MeshStandardMaterial({ color: 0x243747, metalness: .49, roughness: .19 });
const lightGlass = new MeshStandardMaterial({ color: 0x5d96a0, metalness: .22, roughness: .28, emissive: 0xe1aa63, emissiveIntensity: 0 });
const lightFront = new MeshStandardMaterial({ color: 0xf4d29a, emissive: 0xffcf81, emissiveIntensity: .4, roughness: .35 });

const cube = new BoxGeometry(1, 1, 1);
const round = new CylinderGeometry(1, 1, 1, 10);
const cap = new SphereGeometry(1, 12, 8);
export const ringCarriageDimensions = { bogieOffset: .63, wheelRadius: .116, axleHeight: .127, halfGauge: .208 } as const;
type Palette = Material;
type Point = readonly [number, number, number];

function part(root: Group, geometry: BufferGeometry, paint: Palette, [x, y, z]: Point, scale: Point, roll = 0, pitch = 0) {
  const mesh = new Mesh(geometry, paint);
  mesh.position.set(x, y, z);
  mesh.scale.set(...scale);
  mesh.rotation.set(pitch, 0, roll);
  root.add(mesh);
  return mesh;
}

function box(root: Group, material: Palette, x: number, y: number, z: number, w: number, h: number, d: number, roll = 0) {
  return part(root, cube, material, [x, y, z], [w, h, d], roll);
}

function support(root: Group, x: number, height: number, z: number) {
  box(root, limestone, x, .10, z, .89, .20, .79);
  box(root, stoneEdge, x, .23, z, .72, .14, .67);
  box(root, darkIron, x, height / 2 + .08, z, .245, height - .29, .255);
  box(root, iron, x - .15, height / 2 + .08, z, .071, height - .37, .33);
  box(root, iron, x + .15, height / 2 + .08, z, .071, height - .37, .33);
  box(root, darkIron, x, height - .29, z, .68, .19, 1.14);
  for (const side of [-1, 1]) {
    box(root, iron, x + side * .34, height - .43, z, .82, .121, .18, side * .54);
    box(root, steel, x + side * .33, height - .23, z + .035, .98, .056, .23, side * .23);
    box(root, rivet, x + side * .19, .34, z + .242, .06, .06, .05);
  }
  for (const level of [.69, 1.16, 1.63, 2.1, 2.57, 3.04, 3.51]) {
    for (const sign of [-1, 1]) part(root, round, rivet, [x + sign * .148, level, z + .168], [.020, .016, .020], 0, Math.PI / 2);
  }
}

function viaduct() {
  const group = new Group();
  const { fromX, toX, railZ, railHeight } = cityTransit;
  const mid = (fromX + toX) / 2;
  const length = toX - fromX;
  box(group, darkIron, mid, railHeight - .24, railZ, length, .32, .89);
  box(group, iron, mid, railHeight - .083, railZ, length, .17, 1.02);
  for (const sign of [-1, 1]) {
    const side = railZ + sign * .50;
    box(group, steel, mid, railHeight - .045, side, length, .067, .033);
    box(group, rivet, mid, railHeight - .249, side, length - .14, .042, .034);
    box(group, darkIron, mid, railHeight + .142, railZ + sign * .48, length, .035, .03);
    box(group, steel, mid, railHeight + .038, railZ + sign * .209, length, .049, .055);
    for (let x = fromX + .12; x <= toX - .10; x += .46) {
      box(group, iron, x, railHeight + .053, railZ + sign * .483, .024, .207, .029);
      box(group, darkIron, x, railHeight - .25, railZ + sign * .492, .049, .24, .032);
    }
  }
  for (let x = fromX + .12; x < toX; x += .23) box(group, darkIron, x, railHeight + .023, railZ, .055, .039, .78);
  const stationLink = 29.55;
  box(group, darkIron, stationLink, railHeight - .139, railZ + .61, 2.8, .218, .47);
  box(group, steel, stationLink, railHeight - .026, railZ + .638, 2.86, .059, .44);
  box(group, rivet, stationLink, railHeight + .008, railZ + .457, 2.78, .018, .08);
  for (const side of [-1, 1]) {
    const edge = stationLink + side * 1.40;
    for (const z of [railZ + .49, railZ + .81]) box(group, iron, edge, railHeight + .20, z, .038, .41, .040);
    box(group, rivet, edge, railHeight + .41, railZ + .65, .057, .048, .42);
  }
  for (const x of cityViaductPiers) support(group, x, railHeight, railZ);
  return batchStaticMeshes(group, true);
}

function destinationPlate() {
  const image = document.createElement('canvas');
  image.width = 320;
  image.height = 96;
  const ctx = image.getContext('2d')!;
  ctx.fillStyle = '#203c42';
  ctx.fillRect(0, 0, 320, 96);
  ctx.strokeStyle = '#b9a581';
  ctx.lineWidth = 4;
  ctx.strokeRect(5, 5, 310, 86);
  ctx.font = '800 44px system-ui';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#fae4ab';
  ctx.fillText('T1 · CENTRAL', 160, 50);
  const map = new CanvasTexture(image);
  map.colorSpace = SRGBColorSpace;
  map.anisotropy = 4;
  return new MeshBasicMaterial({ map, toneMapped: false });
}

function bogie(group: Group, x: number, halfGauge: number) {
  const { axleHeight, wheelRadius } = ringCarriageDimensions;
  box(group, iron, x, .17, 0, .63, .24, .61);
  for (const offset of [-.19, .19]) {
    const axleX = x + offset;
    part(group, round, steel, [axleX, axleHeight, 0], [.034, halfGauge * 2 + .04, .034], 0, Math.PI / 2);
    for (const sign of [-1, 1]) {
      part(group, round, darkIron, [axleX, axleHeight, sign * halfGauge], [wheelRadius, .092, wheelRadius], 0, Math.PI / 2);
      part(group, round, steel, [axleX, axleHeight, sign * (halfGauge + .050)], [.05, .018, .05], 0, Math.PI / 2);
    }
  }
}

function carriage(root: Group, offset: number, destination: Palette, fixedBogies = true) {
  const group = new Group();
  group.position.x = offset;
  root.add(group);
  box(group, darkIron, 0, .18, 0, 2.46, .31, .64);
  box(group, enamel, 0, .478, 0, 2.68, .56, .75);
  box(group, scarlet, 0, .361, 0, 2.72, .189, .766);
  box(group, trim, 0, .461, 0, 2.68, .038, .782);
  box(group, canopy, 0, .777, 0, 2.82, .14, .80);
  box(group, steel, 0, .871, 0, 2.47, .058, .61);
  box(group, darkIron, -.27, .934, 0, .42, .092, .29);
  box(group, iron, .44, .94, 0, .46, .105, .29);
  if (fixedBogies) for (const x of [-.56, .7]) bogie(group, x, .236);
  for (const sign of [-1, 1]) {
    for (const x of [-.99, -.64, -.28, .15, .48, .83, 1.10]) {
      const door = x === .15;
      box(group, darkGlass, x, .588, sign * .386, door ? .276 : .288, door ? .379 : .249, .030);
      box(group, lightGlass, x, .614, sign * .404, door ? .181 : .237, door ? .226 : .185, .010);
      box(group, steel, x, .521, sign * .407, door ? .21 : .265, .021, .014);
      box(group, darkGlass, x + .066, .615, sign * .410, .020, .175, .005);
      if (door) box(group, trim, x + .084, .462, sign * .412, .047, .020, .018);
    }
    const board = box(group, destination, .65, .353, sign * .397, .58, .124, .014);
    if (sign < 0) board.rotation.y = Math.PI;
  }
  for (const sign of [-1, 1]) {
    const roundedFront = box(group, enamel, sign * 1.367, .516, 0, .17, .504, .64);
    roundedFront.rotation.z = -sign * .095;
    box(group, darkGlass, sign * 1.444, .631, 0, .031, .221, .476);
    box(group, lightGlass, sign * 1.465, .639, 0, .018, .165, .384);
    box(group, iron, sign * 1.476, .641, 0, .017, .188, .029);
    for (const lightZ of [-.193, .193]) {
      part(group, cap, lightFront, [sign * 1.46, .371, lightZ], [.037, .052, .065]);
    }
    box(group, darkIron, sign * 1.461, .199, 0, .08, .100, .28);
  }
}

export function buildCityCarriages() {
  const destination = destinationPlate();
  const { halfGauge, axleHeight, wheelRadius } = ringCarriageDimensions;
  const assemblies = [0, 1].map(() => {
    const source = new Group();
    carriage(source, 0, destination, false);
    const body = batchStaticMeshes(source, false);
    const bogies = [-1, 1].map(() => {
      const frame = new Group();
      bogie(frame, 0, halfGauge);
      for (const side of [-1, 1]) {
        box(frame, darkIron, 0, .176, side * .310, .491, .070, .047);
        box(frame, steel, 0, .210, side * .331, .170, .028, .019);
        box(frame, rivet, 0, .169, side * .339, .084, .033, .014);
        for (const x of [-.19, .19]) {
          part(frame, round, steel, [x, axleHeight, side * (halfGauge - .039)],
            [wheelRadius + .011, .010, wheelRadius + .011], 0, Math.PI / 2);
          box(frame, darkIron, x, .237, side * .315, .12, .106, .085);
        }
      }
      return batchStaticMeshes(frame, false);
    });
    const model = new Group();
    model.add(body, ...bogies);
    return { model, body, bogies };
  });
  const cars = assemblies.map(({ model }) => model);
  const shellLight = new Color(0x5d96a0);
  const windowLight = new Color(0xa49a73);
  const warm = new Color(0xffcf81);
  return {
    cars, assemblies,
    lighting(night: number, supply = .73) {
      const current = Math.min(1.30, supply / .73);
      lightGlass.color.copy(shellLight).lerp(windowLight, night * .76 * current);
      lightGlass.emissiveIntensity = night * .52 * current;
      lightFront.emissive.copy(warm);
      lightFront.emissiveIntensity = .18 + (.12 + night * .89) * current;
    },
    dispose() {
      cars.forEach(car => car.traverse(object => { if (object instanceof Mesh) object.geometry.dispose(); }));
      destination.map?.dispose();
      destination.dispose();
    },
  };
}

const itinerary = [
  { time: 0, x: 10.13 }, { time: 7.9, x: 19.25 }, { time: 11.2, x: 19.25 }, { time: 19, x: 29.7 },
  { time: 22.2, x: 29.7 }, { time: 34, x: 10.13 }, { time: 37.2, x: 10.13 },
];

export function buildCityTransit() {
  const group = new Group();
  const structure = viaduct();
  structure.name = 'City elevated rail';
  group.add(structure);
  const vehicle = new Group();
  const destination = destinationPlate();
  const railcars = new Group();
  carriage(railcars, -1.56, destination);
  carriage(railcars, 1.56, destination);
  box(railcars, darkIron, 0, .294, 0, .38, .183, .24);
  vehicle.add(batchStaticMeshes(railcars, false));
  group.add(vehicle);
  const shellLight = new Color(0x5d96a0);
  const windowLight = new Color(0xa49a73);
  const warm = new Color(0xffcf81);

  return {
    group, structure,
    update(time: number, night: number) {
      const duration = itinerary.at(-1)!.time;
      const cycle = (time ? time / 1000 + 1.9 : 2.52) % duration;
      const index = itinerary.findIndex(stop => stop.time > cycle);
      const [from, to] = [itinerary[index - 1], itinerary[index]];
      const progress = (cycle - from.time) / (to.time - from.time);
      const ease = progress * progress * (3 - 2 * progress);
      const x = from.x + (to.x - from.x) * ease;
      const moving = from.x !== to.x;
      vehicle.position.set(x, cityTransit.railHeight + .006 + (time && moving ? .009 * Math.sin(x * 10) : 0), cityTransit.railZ);
      lightGlass.color.copy(shellLight).lerp(windowLight, night * .76);
      lightGlass.emissiveIntensity = night * .45;
      lightFront.emissive.copy(warm);
      lightFront.emissiveIntensity = .30 + night * .89;
    },
  };
}
