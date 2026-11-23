import { BoxGeometry, CanvasTexture, ExtrudeGeometry, Group, Mesh, MeshStandardMaterial, PlaneGeometry, Shape, SRGBColorSpace } from 'three';
import { cityGateSites } from './field-city-layout';
import { batchStaticMeshes } from './field-mesh-batch';
import { ringAngle, ringPosition, ringRadius } from './field-ring-space';

const sandstone = new MeshStandardMaterial({ color: 0xb5a180, roughness: .91 });
const limestone = new MeshStandardMaterial({ color: 0xd5bf9b, roughness: .88 });
const wornStone = new MeshStandardMaterial({ color: 0xaa987e, roughness: .92 });
const brick = new MeshStandardMaterial({ color: 0xa06d57, roughness: .92 });
const redBrick = [0x996553, 0xa7725b, 0x925e4c, 0xac7a61, 0xa3725d].map(color =>
  new MeshStandardMaterial({ color, roughness: .93 }));
const goldenStone = [0xbca380, 0xaf9876, 0xc1aa86, 0xb7a07d].map(color =>
  new MeshStandardMaterial({ color, roughness: .9 }));
const iron = new MeshStandardMaterial({ color: 0x364a50, metalness: .26, roughness: .73 });
const brass = new MeshStandardMaterial({ color: 0xa9814c, metalness: .33, roughness: .55 });
const block = new BoxGeometry(1, 1, 1);

const architecture = {
  'west-lock': { name: 'West Lock carriage arch', plaque: '西闸仓巷', material: brick, civic: false },
  'fern-court': { name: 'Fern Court limestone arch', plaque: '蕨园内院', material: sandstone, civic: true },
  'salt-market': { name: 'Salt Market passage arch', plaque: '盐市窄巷', material: brick, civic: true },
};

function paintedPlaque(label: string) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 68;
  const ink = canvas.getContext('2d')!;
  const enamel = ink.createLinearGradient(0, 0, 0, 68);
  enamel.addColorStop(0, '#344e4c');
  enamel.addColorStop(1, '#1f3237');
  ink.fillStyle = enamel;
  ink.fillRect(0, 0, 256, 68);
  ink.strokeStyle = '#aa8855';
  ink.lineWidth = 2.5;
  ink.strokeRect(3.5, 3.5, 249, 61);
  ink.strokeStyle = '#695839';
  ink.lineWidth = 1;
  ink.strokeRect(8.5, 8.5, 239, 51);
  ink.font = '600 36px "PingFang SC", "Microsoft Yahei", sans-serif';
  ink.textAlign = 'center';
  ink.textBaseline = 'middle';
  ink.fillStyle = '#ead9ab';
  ink.fillText(label, 128, 35);
  const map = new CanvasTexture(canvas);
  map.colorSpace = SRGBColorSpace;
  map.anisotropy = 3;
  return new MeshStandardMaterial({ map, roughness: .66, metalness: .16, emissive: 0x9b7f54, emissiveIntensity: .11 });
}

export function buildRingGates() {
  const labels: ReturnType<typeof paintedPlaque>[] = [];
  const gates = cityGateSites.map(({ id, x: column, z: row }) => {
    const { name, plaque, material, civic } = architecture[id];
    const center = ringPosition(column + .5, row + .5);
    const halfSpan = ringRadius(row + .5) * Math.sin(ringAngle(column + 1) - ringAngle(column + .5));
    const spring = 1.31;
    const rise = Math.min(1.40, halfSpan * (civic ? .83 : .73));
    const crown = spring + rise + (civic ? .415 : .32);
    const thickness = .43;
    const outer = halfSpan + .28;
    const source = new Group();
    const sculpted: ExtrudeGeometry[] = [];
    const bricks = material === brick ? redBrick : goldenStone;
    const label = paintedPlaque(plaque);
    labels.push(label);
    const faceSign = new PlaneGeometry(.641, .146);

    function course(paint: MeshStandardMaterial, x: number, y: number, z: number, width: number, height: number, depth: number) {
      const mesh = new Mesh(block, paint);
      mesh.position.set(x, y, z);
      mesh.scale.set(width, height, depth);
      source.add(mesh);
    }

    function relief(paint: MeshStandardMaterial, outline: Shape, z: number, depth: number) {
      const geometry = new ExtrudeGeometry(outline, { depth, bevelEnabled: false });
      sculpted.push(geometry);
      const mesh = new Mesh(geometry, paint);
      mesh.position.z = z;
      source.add(mesh);
    }

    const arch = new Shape();
    arch.moveTo(-outer, crown);
    arch.lineTo(outer, crown);
    arch.lineTo(outer, spring);
    for (let step = 0; step <= 24; step++) {
      const angle = step * Math.PI / 24;
      arch.lineTo(Math.cos(angle) * halfSpan, spring + Math.sin(angle) * rise);
    }
    arch.lineTo(-outer, spring);
    arch.closePath();
    relief(material, arch, -thickness * .5, thickness);

    for (const side of [-1, 1]) {
      const pier = side * (halfSpan + .14);
      course(sandstone, pier, spring * .5, 0, .28, spring, thickness);
      course(wornStone, pier, .095, 0, .36, .19, thickness + .08);
      course(sandstone, pier, .203, 0, .321, .048, thickness + .043);
      course(limestone, pier, spring - .125, 0, .310, .052, thickness + .056);
      course(limestone, pier, spring - .05, 0, .34, .11, thickness + .10);
      for (let seam = .34; seam < spring - .16; seam += .185) {
        course(wornStone, pier, seam, 0, .286, .011, thickness + .002);
      }
    }

    for (const face of [-1, 1]) {
      const bed = material === brick ? .087 : .133;
      const bond = material === brick ? .23 : .31;
      for (let level = 0; spring + (level + 1) * bed < crown - .045; level++) {
        const archEdge = (halfSpan + .193) * Math.sqrt(Math.max(0, 1 - (level * bed / (rise + .197)) ** 2));
        for (let cell = -Math.ceil(outer / bond) - 1; cell <= Math.ceil(outer / bond); cell++) {
          const from = (cell + (level % 2) * .48) * bond;
          const to = from + bond - .011;
          for (const [left, right] of [[-outer + .007, -archEdge], [archEdge, outer - .007]]) {
            const a = Math.max(left, from), b = Math.min(right, to);
            if (b - a < .024) continue;
            const paint = bricks[(Math.abs(cell * 7 + level * 13 + column + face * 19)) % bricks.length];
            course(paint, (a + b) / 2, spring + (level + .5) * bed, face * (thickness * .5 + .009), b - a, bed - .008, .017);
          }
        }
      }
      for (let stone = 0; stone < 11; stone++) {
        const start = stone * Math.PI / 11 + .012;
        const end = (stone + 1) * Math.PI / 11 - .012;
        const bevel = stone === 5 ? .235 : .168;
        const voussoir = new Shape();
        const points = [[start, 0], [end, 0], [end, bevel], [start, bevel]];
        points.forEach(([angle, offset], index) => {
          const x = Math.cos(angle) * (halfSpan + offset);
          const y = spring + Math.sin(angle) * (rise + offset);
          if (index) voussoir.lineTo(x, y);
          else voussoir.moveTo(x, y);
        });
        voussoir.closePath();
        relief(stone % 4 === 2 ? sandstone : limestone, voussoir,
          face > 0 ? thickness * .5 - .008 : -thickness * .5 - .051, .059);
      }
      const plaqueAt = spring + rise + (civic ? .329 : .266);
      course(wornStone, 0, plaqueAt, face * (thickness * .5 + .017), .756, .208, .062);
      course(iron, 0, plaqueAt, face * (thickness * .5 + .051), .710, .173, .022);
      const enamel = new Mesh(faceSign, label);
      enamel.position.set(0, plaqueAt, face * (thickness * .5 + .068));
      enamel.rotation.y = face > 0 ? 0 : Math.PI;
      source.add(enamel);
      for (const x of [-.335, .335]) course(brass, x, plaqueAt, face * (thickness * .5 + .071), .021, .021, .021);
    }
    course(wornStone, 0, crown - .016, 0, outer * 2 + .070, .055, thickness + .076);
    course(sandstone, 0, crown + .026, 0, outer * 2 + .118, .039, thickness + .112);
    course(limestone, 0, crown + .068, 0, outer * 2 + .151, .054, thickness + .157);
    for (const end of [-1, 1]) {
      course(wornStone, end * (outer - .11), crown + .096, 0, .283, .087, thickness + .148);
      course(limestone, end * (outer - .11), crown + .151, 0, .317, .047, thickness + .19);
    }

    const passage = batchStaticMeshes(source, true);
    sculpted.forEach(geometry => geometry.dispose());
    faceSign.dispose();
    passage.name = name;
    passage.rotation.y = ringAngle(column + .5);
    passage.position.set(center.x, 0, center.z);
    return passage;
  });
  return {
    gates,
    dispose() {
      for (const label of labels) { label.map?.dispose(); label.dispose(); }
      for (const gate of gates) gate.traverse(object => { if (object instanceof Mesh) object.geometry.dispose(); });
    },
  };
}
