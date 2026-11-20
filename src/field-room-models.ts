import {
  BoxGeometry, CanvasTexture, Color, CylinderGeometry, ExtrudeGeometry, Float32BufferAttribute, Group, Mesh, MeshBasicMaterial,
  MeshStandardMaterial, PlaneGeometry, RepeatWrapping, Shape, ShapeGeometry, SphereGeometry, SRGBColorSpace, Vector3,
  type BufferGeometry, type ColorRepresentation,
} from 'three';
import type { RoomId } from './field-layout';
import { plans } from './field-rooms';

const box = new BoxGeometry(1, 1, 1);
const drum = new CylinderGeometry(1, 1, 1, 16);
const pot = new CylinderGeometry(.56, .40, 1, 14);
const bulb = new SphereGeometry(1, 14, 9);
const materials = new Map<ColorRepresentation, MeshStandardMaterial>();
const colors = {
  home: { wall: 0xd2b399, wainscot: 0xa17357, edge: 0x675148, floor: 0xac7b59, rug: 0x9c5950, trim: 0xf4c69b, furniture: 0x866048 },
  lab: { wall: 0xc3cdc2, wainscot: 0x52746c, edge: 0x3f5f59, floor: 0xa4ada0, rug: 0x547e72, trim: 0xc3d5ae, furniture: 0x708a7e },
  tower: { wall: 0xa9a7c1, wainscot: 0x606b87, edge: 0x4c4d68, floor: 0x8b7f8e, rug: 0x6a648f, trim: 0xe4c987, furniture: 0x65718e },
};

function paint(color: ColorRepresentation) {
  let material = materials.get(color);
  if (!material) {
    material = new MeshStandardMaterial({ color, roughness: .82 });
    materials.set(color, material);
  }
  return material;
}

function mesh(root: Group, x: number, y: number, z: number, w: number, h: number, d: number,
  material: ColorRepresentation | MeshStandardMaterial, geometry: BufferGeometry = box, shadow = true) {
  const part = new Mesh(geometry, material instanceof MeshStandardMaterial ? material : paint(material));
  part.position.set(x, y, z);
  part.scale.set(w, h, d);
  part.castShadow = shadow;
  part.receiveShadow = true;
  root.add(part);
  return part;
}

function patterned(size: number, draw: (ctx: CanvasRenderingContext2D) => void) {
  const image = document.createElement('canvas');
  image.width = image.height = size;
  draw(image.getContext('2d')!);
  const map = new CanvasTexture(image);
  map.colorSpace = SRGBColorSpace;
  map.anisotropy = 4;
  return map;
}

function noise(x: number, y: number, salt = 0) {
  const mixed = Math.imul(x + 281 + salt, 7121291) ^ Math.imul(y + 619, 2167243);
  return ((Math.imul(mixed ^ (mixed >>> 13), 531847) >>> 0) % 4096) / 4096;
}

function floorMaterial(room: RoomId, width: number) {
  const color = new Color(colors[room].floor);
  const size = 384;
  const map = patterned(size, ctx => {
    const oak = room === 'home';
    const rows = oak ? 9 : 6;
    const cols = room === 'lab' ? 6 : 3;
    const board = size / cols;
    const height = size / rows;
    ctx.fillStyle = color.clone().multiplyScalar(.81).getStyle();
    ctx.fillRect(0, 0, size, size);
    for (let row = 0; row < rows; row++) {
      const y = row * height;
      const offset = oak ? [0, .47, .75, .22][row % 4] : room === 'tower' ? (row % 2) * .5 : 0;
      for (let col = -1; col < cols; col++) {
        const x = (col + offset) * board;
        const shade = room === 'lab' ? .91 + noise(col, row, 19) * .15 : .79 + noise(col, row, 19) * .33;
        ctx.fillStyle = color.clone().multiplyScalar(shade).getStyle();
        ctx.fillRect(x + 1, y + 1, board - 1.8, height - 1.8);
        ctx.fillStyle = oak ? 'rgba(257,241,202,.22)' : 'rgba(237,245,225,.15)';
        ctx.fillRect(x + 2.4, y + 1.3, board - 4, .85);
        ctx.fillRect(x + 1, y + 1.3, .80, height - 4);
      }
      for (let stripe = 0; stripe < (oak ? 34 : 17); stripe++) {
        const factor = noise(row, stripe, 9);
        const length = 6 + noise(row, stripe, 14) * (oak ? 68 : 19);
        const left = noise(row, stripe, 31) * size;
        const top = y + 3 + factor * (height - 6);
        ctx.strokeStyle = factor > .44 ? 'rgba(250,236,201,.16)' : 'rgba(56,49,51,.11)';
        ctx.lineWidth = oak && stripe % 4 === 0 ? 1.1 : .55;
        ctx.beginPath();
        ctx.moveTo(left, top);
        ctx.quadraticCurveTo(left + length * .45, top + (oak ? .7 : 2.5), left + length, top + (room === 'tower' ? 2.7 : 0));
        ctx.stroke();
      }
    }
    if (room !== 'home') {
      for (let fleck = 0; fleck < 1250; fleck++) {
        const x = noise(fleck, 2, 3) * size;
        const y = noise(fleck, 4, 31) * size;
        ctx.fillStyle = fleck % 3 ? 'rgba(224,227,217,.15)' : 'rgba(70,76,81,.14)';
        ctx.fillRect(x, y, fleck % 4 ? .86 : 1.4, .70);
      }
    }
  });
  map.wrapS = map.wrapT = RepeatWrapping;
  map.repeat.set(width / (room === 'lab' ? 3.9 : 5.65), room === 'home' ? 2.45 : 1.90);
  return new MeshStandardMaterial({ map, roughness: room === 'tower' ? .87 : .94 });
}

function ring(ctx: CanvasRenderingContext2D, radius: number, width: number) {
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.lineWidth = width;
  ctx.stroke();
}

function runnerMap(room: RoomId) {
  const { rug, trim } = colors[room];
  const map = patterned(512, ctx => {
    const base = new Color(rug);
    const stitch = new Color(trim).getStyle();
    ctx.fillStyle = base.clone().multiplyScalar(.78).getStyle();
    ctx.fillRect(0, 0, 512, 512);
    ctx.fillStyle = base.getStyle();
    ctx.fillRect(13, 13, 486, 486);
    ctx.strokeStyle = stitch;
    if (room === 'lab') {
      ctx.lineWidth = 5.5;
      ctx.strokeRect(24, 22, 464, 466);
      ctx.strokeStyle = 'rgba(225,216,152,.8)';
      for (let y = 52; y < 477; y += 27) {
        for (const x of [37, 459]) {
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x + 13, y - 11);
          ctx.stroke();
        }
      }
      for (const y of [83, 111, 397, 425]) {
        ctx.beginPath();
        ctx.moveTo(161, y);
        ctx.lineTo(351, y);
        ctx.stroke();
      }
      ctx.fillStyle = 'rgba(194,217,160,.27)';
      for (let y = 150; y <= 355; y += 41) for (let x = 91; x <= 411; x += 40) ctx.fillRect(x, y, 8, 3);
    } else {
      for (const border of [18, 30, 55]) {
        ctx.lineWidth = border === 30 ? 2.7 : 1.25;
        ctx.strokeRect(border, border, 512 - 2 * border, 512 - 2 * border);
      }
      for (const edge of [0, 1, 2, 3]) {
        ctx.save();
        ctx.translate(256, 256);
        ctx.rotate(edge * Math.PI / 2);
        for (let x = -182; x <= 182; x += 28) {
          ctx.beginPath();
          ctx.moveTo(x - 11, -200);
          ctx.lineTo(x, -221);
          ctx.lineTo(x + 11, -200);
          ctx.lineTo(x, -189);
          ctx.closePath();
          ctx.stroke();
        }
        ctx.restore();
      }
      ctx.translate(256, 256);
      ctx.globalAlpha = .84;
      ring(ctx, 143, 2.25);
      ring(ctx, 131, 1.4);
      for (let i = 0; i < 8; i++) {
        ctx.rotate(Math.PI / 4);
        const long = i % 2 === 0;
        const rise = long ? 123 : 102;
        ctx.beginPath();
        ctx.moveTo(0, -rise);
        ctx.lineTo(24, -22);
        ctx.lineTo(0, -8);
        ctx.lineTo(-24, -22);
        ctx.closePath();
        ctx.stroke();
        ctx.fillStyle = long ? 'rgba(245,212,147,.26)' : 'rgba(237,197,144,.12)';
        ctx.fill();
      }
      ring(ctx, 11, 2);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    }
    ctx.globalAlpha = room === 'lab' ? .075 : .13;
    for (let y = 0; y < 512; y += 3) {
      ctx.fillStyle = y % 2 ? '#fff9d9' : '#332e38';
      ctx.fillRect(0, y, 512, 1);
    }
  });
  return new MeshStandardMaterial({ map, roughness: .98 });
}

const roomWindows = new Map<RoomId, MeshStandardMaterial>();

function windowScene(room: RoomId) {
  const cached = roomWindows.get(room);
  if (cached) return cached;
  const size = 256;
  const map = patterned(size, ctx => {
    const sky = ctx.createLinearGradient(0, 0, 0, 182);
    const stops = room === 'tower' ? ['#2c466c', '#8f8ead'] : room === 'lab' ? ['#8eacaa', '#ced0ae'] : ['#76a5ad', '#dccca1'];
    sky.addColorStop(0, stops[0]);
    sky.addColorStop(1, stops[1]);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, size, size);
    if (room === 'tower') {
      for (let n = 0; n < 60; n++) {
        const x = noise(n, 2, 31) * size;
        const y = noise(n, 4, 56) * 171;
        ctx.fillStyle = n % 4 ? 'rgba(232,222,190,.82)' : 'rgba(245,223,159,.94)';
        const pixel = n % 7 === 0 ? 2.5 : 1.2;
        ctx.fillRect(x, y, pixel, pixel);
      }
      ctx.fillStyle = '#e8d4af';
      ctx.beginPath();
      ctx.arc(189, 55, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#5e6d93';
      ctx.beginPath();
      ctx.arc(194, 52, 10.7, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = room === 'lab' ? 'rgba(233,231,199,.19)' : 'rgba(243,232,199,.55)';
      for (const [x, y, w, h] of [[49, 48, 38, 7], [127, 64, 55, 5], [201, 29, 29, 5], [235, 84, 56, 7]]) {
        ctx.beginPath();
        ctx.ellipse(x, y, w, h, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    if (room === 'home') {
      const ocean = ctx.createLinearGradient(0, 100, 0, 260);
      ocean.addColorStop(0, '#adc2ad');
      ocean.addColorStop(1, '#488a94');
      ctx.fillStyle = ocean;
      ctx.fillRect(0, 124, 256, 132);
      ctx.fillStyle = '#71928a';
      ctx.beginPath();
      ctx.moveTo(0, 124);
      for (const [x, y] of [[21, 105], [43, 90], [63, 101], [80, 108], [104, 106], [133, 125], [160, 127], [179, 121], [207, 118], [231, 128], [256, 129]]) ctx.lineTo(x, y);
      ctx.lineTo(256, 144);
      ctx.lineTo(0, 140);
      ctx.fill();
      for (let i = 0; i < 47; i++) {
        ctx.fillStyle = i % 3 ? 'rgba(226,228,196,.31)' : 'rgba(45,111,124,.19)';
        ctx.fillRect(noise(i, 6, 4) * 256, 146 + noise(i, 11, 3) * 110, 10 + noise(i, 8, 2) * 38, i % 3 ? 1.1 : 2.1);
      }
    } else {
      const peaks = room === 'tower' ? ['#6b7196', '#505e82', '#3a5370'] : ['#a0ad91', '#849b80', '#6a8a79'];
      for (let layer = 0; layer < peaks.length; layer++) {
        const low = 125 + layer * 37;
        ctx.fillStyle = peaks[layer];
        ctx.beginPath();
        ctx.moveTo(0, low);
        for (let x = 0; x <= 256; x += 17) ctx.lineTo(x, low + Math.sin(x / (layer + 21) + layer) * 13 - noise(x, layer, 55) * (room === 'tower' ? 32 : 16));
        ctx.lineTo(260, 256);
        ctx.lineTo(0, 256);
        ctx.fill();
      }
      if (room === 'lab') for (let n = 0; n < 32; n++) {
        const x = noise(n, 2, 31) * size;
        const y = 176 + noise(n, 4, 56) * 69;
        const h = 15 + noise(n, 2, 3) * 33;
        ctx.fillStyle = n % 3 ? '#638573' : '#7b9880';
        ctx.beginPath();
        ctx.moveTo(x, y - h);
        ctx.lineTo(x + h * .36, y);
        ctx.lineTo(x - h * .36, y);
        ctx.fill();
      }
    }
  });
  const material = new MeshStandardMaterial({ map, emissive: room === 'tower' ? 0x2a3f6b : 0x519293, emissiveMap: map, emissiveIntensity: .46, roughness: .39 });
  roomWindows.set(room, material);
  return material;
}

function windowFrame(root: Group, x: number, z: number, width: number, room: RoomId) {
  const { edge, trim } = colors[room];
  const y = room === 'tower' ? 1.70 : 1.65;
  const h = room === 'tower' ? 1.40 : 1.30;
  mesh(root, x, y, z, width + .18, h + .19, .113, edge);
  mesh(root, x, y, z + .056, width - .099, h - .065, .046, windowScene(room));
  const grid = room === 'home' ? [0] : room === 'tower' ? [-.235, .235] : [-.31, 0, .31];
  for (const offset of grid) mesh(root, x + width * offset, y, z + .09, .045, h + .04, .062, trim);
  mesh(root, x, y - h * .11, z + .089, width, .047, .065, trim);
  mesh(root, x, y - h / 2 - .060, z + .13, width + .265, .094, .27, trim);
  mesh(root, x, y + h / 2 + .095, z + .047, width + .22, .056, .12, trim);
  if (room === 'home') {
    for (const side of [-1, 1]) {
      const drape = mesh(root, x + side * width * .429, y + .02, z + .14, .19, h + .16, .12, 0xa65f53);
      drape.rotation.z = side * .09;
      mesh(root, x + side * width * .426, y - .31, z + .213, .21, .043, .025, 0xc9a46e);
    }
    mesh(root, x, y + h * .56, z + .184, width + .29, .031, .041, 0x846449);
  }
}

function cabinet(root: Group, x: number, z: number, w: number, h: number, room: RoomId, books: boolean) {
  const { furniture, edge, trim } = colors[room];
  mesh(root, x, h / 2, z - .37, w, h, .15, edge);
  for (const offset of [-.48, .48]) mesh(root, x + offset * w, h / 2, z, .13, h, .79, furniture);
  for (const fraction of [.05, .36, .68, .99]) mesh(root, x, h * fraction, z, w, .092, .85, furniture);
  if (books) {
    const bindings = [0x7e4141, 0xa18e55, 0x476b71, 0x887184, 0xc29b70, 0x526555];
    for (let shelf = 0; shelf < 3; shelf++) for (let index = 0; index < 12; index++) {
      const spine = h * (.21 + .047 * Math.sin(shelf * 15 + index * 2.3));
      const side = x + (index / 11 - .5) * (w - .44);
      const level = h * (.05 + shelf * .315) + .04;
      const color = bindings[(index + shelf * 3) % bindings.length];
      mesh(root, side, level + spine / 2, z + .09, .107 + (index % 4) * .018, spine, .31, color);
      if (index % 3) mesh(root, side, level + spine * .2, z + .251, .08, .018, .01, trim, box, false);
    }
  } else {
    for (const side of [-1, 1]) {
      mesh(root, x + side * w * .23, h / 2, z + .375, w * .44, h * .89, .09, furniture);
      mesh(root, x + side * .12, h * .66, z + .438, .067, .24, .05, trim);
    }
  }
}

function counter(root: Group, x: number, z: number, w: number, d: number, room: RoomId) {
  const { furniture, edge, trim } = colors[room];
  for (const side of [-1, 1]) {
    for (const depth of [-1, 1]) mesh(root, x + side * (w / 2 - .16), .48, z + depth * (d / 2 - .13), .12, .94, .12, edge);
    mesh(root, x + side * w * .25, .78, z + d * .31, w * .43, .23, .11, furniture);
    mesh(root, x + side * w * .25, .79, z + d * .39, .15, .035, .053, trim);
  }
  mesh(root, x, .95, z, w, .13, d, furniture);
  mesh(root, x, 1.025, z, w - .07, .035, d - .065, trim);
}

function monitor(root: Group, x: number, y: number, z: number, width = .62) {
  const shell = 0x344a52;
  const face = new MeshStandardMaterial({ color: 0x77c8bd, emissive: 0x357f7c, emissiveIntensity: .54, roughness: .30 });
  mesh(root, x, y + .06, z, .31, .12, .26, shell);
  mesh(root, x, y + .32, z, width, .49, .11, shell);
  mesh(root, x, y + .32, z + .062, width - .09, .37, .019, face);
  for (let i = 0; i < 4; i++) mesh(root, x - width * .18, y + .24 + i * .046, z + .074, .13 + i % 2 * .10, .015, .009, 0xd0e2a3, box, false);
}

function plant(root: Group, x: number, z: number, height: number) {
  mesh(root, x, height + .22, z, .78, .46, .78, 0xb37961, pot);
  mesh(root, x, height + .44, z, .41, .042, .41, 0x635447, drum);
  for (let i = 0; i < 9; i++) {
    const a = i * 2.399;
    const leaf = mesh(root, x + Math.sin(a) * .19, height + .73 + i % 3 * .116, z + Math.cos(a) * .18, .12, .283, .075, i % 2 ? 0x739156 : 0x54816a, bulb);
    leaf.rotation.set(.8 * Math.cos(a), a, -.58 * Math.sin(a));
  }
}

export function buildRoomModel(room: RoomId) {
  const plan = plans[room];
  const style = colors[room];
  const root = new Group();
  const wide = plan.right - plan.left + 1;
  const mid = plan.left + wide / 2;
  mesh(root, mid, -.46, 9.49, wide + .36, .88, 9.34, style.edge);
  mesh(root, mid, -.076, 9.5, wide, .15, 9, floorMaterial(room, wide));
  mesh(root, 12.5, -.16, 14.35, 1.14, .29, 1.25, style.trim);
  mesh(root, 12.5, .012, 13.93, 1.29, .055, .14, style.edge);

  mesh(root, mid, 1.3, 4.88, wide + .14, 2.60, .30, style.wall);
  for (const [level, height, color] of [[.43, .86, style.wainscot], [.90, .10, style.trim], [.105, .16, style.edge], [2.61, .12, style.trim]]) {
    mesh(root, mid, level, 5.02, wide + .16, height, .14, color);
  }
  for (let i = 0; i < wide; i++) mesh(root, plan.left + i + .18, .47, 5.106, .043, .62, .018, style.edge, box, false);
  for (const wall of [plan.left - .09, plan.right + 1.09]) {
    mesh(root, wall, 1.19, 6.48, .23, 2.38, 3.24, style.wall);
    mesh(root, wall, .20, 10.9, .20, .40, 6.08, style.edge);
    mesh(root, wall, .44, 10.9, .27, .092, 6.08, style.trim);
  }
  for (const x of [mid - 5.3, mid, mid + 5.3]) windowFrame(root, x, 5.055, x === mid ? 2.33 : 1.95, room);
  const lightMap = patterned(128, ctx => {
    const gradient = ctx.createLinearGradient(0, 107, 17, 12);
    gradient.addColorStop(0, 'rgba(255,248,222,0)');
    gradient.addColorStop(.30, 'rgba(255,248,222,.09)');
    gradient.addColorStop(.83, 'rgba(255,248,222,.29)');
    gradient.addColorStop(1, 'rgba(255,248,222,0)');
    ctx.fillStyle = gradient;
    for (const [x, y, w, h] of [[17, 22, 36, 45], [63, 22, 37, 45], [17, 73, 36, 38], [63, 73, 37, 38]]) ctx.fillRect(x, y, w, h);
  });
  const windowLight = new Mesh(new PlaneGeometry(2.25, 3.2), new MeshBasicMaterial({
    color: room === 'tower' ? 0x959dfc : room === 'lab' ? 0xcceec9 : 0xffdaa9,
    map: lightMap, transparent: true, depthWrite: false, toneMapped: false,
  }));
  windowLight.rotation.set(-Math.PI / 2, 0, -.25);
  windowLight.position.set(mid + 1.34, .013, 6.78);
  root.add(windowLight);

  mesh(root, 12.5, .009, 10.7, room === 'lab' ? 4.0 : 5.2, .018, 4.11, runnerMap(room), box, false);
  for (const fixture of plan.furniture) {
    const x = fixture.x - Math.floor((fixture.width - 1) / 2) + fixture.width / 2;
    const d = 'depth' in fixture ? fixture.depth : 1;
    const z = fixture.y + 1 - d / 2;
    const w = fixture.width - .32;
    switch (fixture.kind) {
      case 'bookshelf':
        cabinet(root, x, z, w, 1.83, room, true);
        break;
      case 'archive':
        cabinet(root, x, z, w, 1.06, room, false);
        mesh(root, x - .30, 1.123, z, .46, .086, .34, 0x927b5f);
        mesh(root, x + .05, 1.115, z - .11, .46, .061, .37, 0xd8bd8a).rotation.y = .14;
        break;
      case 'settee':
        for (const side of [-1, 1]) {
          mesh(root, x + side * 1.18, .26, z, .12, .50, .76, style.edge);
          mesh(root, x + side * 1.21, .64, z, .19, .23, .83, style.furniture);
        }
        mesh(root, x, .50, z + .05, w, .27, .75, 0x9a685c);
        mesh(root, x, .76, z - .29, w, .53, .19, 0x9a685c);
        for (const side of [-1, 1]) mesh(root, x + side * .64, .79, z - .14, .35, .30, .17, style.trim, bulb).rotation.z = side * .25;
        break;
      case 'stove':
        mesh(root, x, .54, z, 1.35, 1.05, .81, 0x514944);
        mesh(root, x, .60, z + .416, .57, .44, .04, 0x342f36);
        mesh(root, x, .57, z + .445, .34, .14, .02, new MeshStandardMaterial({ color: 0xe48652, emissive: 0xab4e25, emissiveIntensity: .7 }));
        mesh(root, x, 1.72, z - .21, .18, 1.43, .18, 0x514944, drum);
        mesh(root, x, 1.10, z, 1.46, .13, .90, style.edge);
        break;
      case 'server':
      case 'batteries':
        cabinet(root, x, z, w, 1.32, room, false);
        for (let column = -1; column <= 1; column++) {
          for (let row = 0; row < 4; row++) mesh(root, x + column * .41, .33 + row * .17, z + .443, .27, .053, .021, row % 3 ? 0x3e5a5b : 0xd2cb85);
        }
        break;
      case 'workbench':
      case 'radio':
      case 'samples':
        counter(root, x, z, w, d - .19, room);
        if (fixture.kind === 'samples') {
          for (let i = -1; i <= 1; i++) {
            mesh(root, x + i * .59, 1.16, z - .11, .154, .23, .154, 0x81a9a3, drum);
            mesh(root, x + i * .59, 1.29, z - .11, .159, .046, .159, style.edge, drum);
          }
        } else {
          monitor(root, x - .46, 1.04, z - .15, .83);
          if (fixture.kind === 'workbench') monitor(root, x + .43, 1.04, z - .14);
          else {
            mesh(root, x + .62, 1.30, z, .67, .50, .48, style.edge);
            mesh(root, x + .62, 1.34, z + .246, .49, .17, .016, style.trim);
            mesh(root, x + .8, 1.76, z, .021, .56, .021, style.trim).rotation.z = -.26;
          }
        }
        break;
      case 'telescope': {
        for (const angle of [0, 2.094, 4.188]) {
          const leg = new Group();
          leg.position.set(x, .72, z);
          leg.rotation.y = angle;
          mesh(leg, .33, -.32, 0, .105, .96, .10, style.trim).rotation.z = .64;
          root.add(leg);
        }
        const scope = new Group();
        scope.position.set(x, 1.57, z);
        scope.rotation.set(-.44, -.62, 1.57);
        mesh(scope, 0, .15, 0, .33, 1.38, .32, 0x96a5b2, drum);
        for (const shaft of [-.58, .79]) mesh(scope, 0, shaft, 0, .38, .15, .36, style.edge, drum);
        mesh(scope, 0, .87, 0, .319, .032, .311, 0x75aab7, drum);
        root.add(scope);
        break;
      }
      case 'plant':
        plant(root, x, z, 0);
        break;
    }
  }
  return root;
}
