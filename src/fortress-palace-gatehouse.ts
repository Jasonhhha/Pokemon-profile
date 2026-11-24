/** Structural fabric above the lower arcade in the King's Gate. Coordinates are x, z, elevation. */
export type GateVertex = [number, number, number];
export const gateFinishes = {
  bedrock: '#455455',
  limestone: '#b5b29b',
  ashlar: '#82928c',
  soffit: '#516c70',
  bronze: '#a38962',
  iron: '#384b51',
  verdigris: '#5d9087',
  light: '#e5bf88',
  opal: '#acd3ce',
  smokedGlass: '#75968e',
} as const;
export type GateFinish = keyof typeof gateFinishes;
export type GateFace = { vertices: GateVertex[]; finish: GateFinish; tint: number; detail: boolean; depth: number };
let structure: GateFace[] | undefined;

// At the far edge of each upper gallery a street-level light duct opens into the reservoir.
export const gateLightwells = [-1, 1].map((side) => ({
  side,
  x: 8.5 + side * 4.33,
  z: 7.79,
  h: 8.27,
  waterX: 8.5 + side * 3.8,
  waterZ: 10.34,
  waterHeight: -0.48,
}));

export const gateLoadDial = { x: 8.5, z: 2.36, height: 5.78, radius: 0.835 };
export function gatePointerAngle(load: number) {
  return (Math.max(0, Math.min(1, load)) * 1.4 - 0.7) * Math.PI;
}
export function gatePointerVertices(load: number): GateVertex[] {
  const { x, z, height, radius } = gateLoadDial;
  const a = gatePointerAngle(load),
    sin = Math.sin(a),
    cos = Math.cos(a);
  return [
    [0, 0.84],
    [-0.059, 0.09],
    [-0.049, -0.2],
    [0.049, -0.2],
    [0.059, 0.09],
  ].map(([side, forward]) => [
    x + radius * (sin * forward + cos * side),
    z + 0.11,
    height + radius * (cos * forward - sin * side),
  ]);
}

export function gatehouseFabric(): GateFace[] {
  if (structure) return structure;
  const shapes: GateFace[] = [];
  const axis = 8.5;
  const face = (finish: GateFinish, vertices: GateVertex[], tint = 1, detail = false) => {
    const depth = vertices.reduce((sum, [x, z, h]) => sum + z + x * 0.08 + h * 0.37, 0) / vertices.length;
    shapes.push({ finish, vertices, tint, depth, detail });
  };
  function solid(lower: GateVertex[], upper: GateVertex[], finish: GateFinish, tint = 1, detail = false) {
    face(finish, lower.slice().reverse(), tint * 0.77, detail);
    face(finish, upper, tint * 1.07, detail);
    for (let i = 0; i < lower.length; i++) {
      const j = (i + 1) % lower.length;
      face(finish, [lower[i], lower[j], upper[j], upper[i]], tint, detail);
    }
  }
  function bar(
    x1: number,
    z1: number,
    x2: number,
    z2: number,
    bottom: number,
    height: number,
    width: number,
    finish: GateFinish,
    detail = false,
  ) {
    const len = Math.hypot(x2 - x1, z2 - z1);
    const dx = ((z2 - z1) * width) / (2 * len),
      dz = ((x1 - x2) * width) / (2 * len);
    const ring = (h: number): GateVertex[] => [
      [x1 - dx, z1 - dz, h],
      [x2 - dx, z2 - dz, h],
      [x2 + dx, z2 + dz, h],
      [x1 + dx, z1 + dz, h],
    ];
    solid(ring(bottom), ring(bottom + height), finish, 1, detail);
  }
  function block(
    x: number,
    z: number,
    width: number,
    depth: number,
    y: number,
    h: number,
    finish: GateFinish,
    detail = false,
  ) {
    bar(x - width / 2, z, x + width / 2, z, y, h, depth, finish, detail);
  }
  function shaft(
    x: number,
    z: number,
    y: number,
    h: number,
    foot: number,
    head: number,
    finish: GateFinish,
    detail = false,
  ) {
    const section = (r: number, level: number): GateVertex[] =>
      Array.from({ length: 10 }, (_, i) => {
        const a = ((i + 0.5) * Math.PI) / 5;
        return [x + Math.cos(a) * r, z + Math.sin(a) * r, level];
      });
    solid(section(foot, y), section(head, y + h), finish, 1, detail);
  }
  function arch(
    x: number,
    z: number,
    alongZ: boolean,
    span: number,
    spring: number,
    rise: number,
    band: number,
    top: number,
    width: number,
    lower: boolean,
  ) {
    const local = (u: number, v: number, h: number): GateVertex => (alongZ ? [x + v, z + u, h] : [x + u, z + v, h]);
    const shape = (angle: number, radius: number, v: number, extrude: number): GateVertex =>
      local(Math.cos(angle) * radius, v, spring + Math.sin(angle) * (rise + extrude));
    const radius = span / 2,
      depth = width / 2;
    for (let n = 0; n < 12; n++) {
      const a = (n * Math.PI) / 12,
        b = ((n + 1) * Math.PI) / 12;
      for (const side of [-1, 1]) {
        const v = side * depth;
        const outerA = shape(a, radius, v, band),
          outerB = shape(b, radius, v, band);
        face(
          'ashlar',
          [outerA, outerB, local(Math.cos(b) * radius, v, top), local(Math.cos(a) * radius, v, top)],
          0.85 + (n % 3) * 0.035,
        );
        if (!lower) {
          const innerA = shape(a, radius - 0.15, v + side * 0.026, 0),
            innerB = shape(b, radius - 0.15, v + side * 0.026, 0);
          face(n === 5 || n === 6 ? 'limestone' : 'ashlar', [innerA, innerB, outerB, outerA], 0.86 + (n % 3) * 0.055);
        }
      }
      face(
        'soffit',
        [
          shape(a, radius, -depth, band),
          shape(b, radius, -depth, band),
          shape(b, radius, depth, band),
          shape(a, radius, depth, band),
        ],
        0.75,
      );
    }
  }

  function spandrelVent(x: number, z: number, h: number) {
    const at = (r: number, a: number, depth: number): GateVertex => [
      x + Math.sin(a) * r,
      z + depth,
      h + Math.cos(a) * r,
    ];
    const count = 12;
    for (let i = 0; i < count; i++) {
      const a = (i * 2 * Math.PI) / count,
        b = ((i + 1) * 2 * Math.PI) / count;
      face('bedrock', [at(0, a, 0.003), at(0.26, a, 0.003), at(0.26, b, 0.003)]);
      face(i % 3 ? 'limestone' : 'bronze', [
        at(0.25, a, 0.02),
        at(0.25, b, 0.02),
        at(0.36, b, 0.045),
        at(0.36, a, 0.045),
      ]);
      face('ashlar', [at(0.36, a, 0.045), at(0.36, b, 0.045), at(0.36, b, -0.022), at(0.36, a, -0.022)]);
    }
    for (const dy of [-0.12, 0, 0.12]) {
      const half = Math.sqrt(0.235 * 0.235 - dy * dy);
      block(x, z + 0.022, 2 * half, 0.043, h + dy, 0.043, 'verdigris', true);
    }
  }
  // The wall above each original arch closes its haunch. Its cornice supports the second order.
  const bays = [-16.5, -11.5, -6.5, -1.5, 3.5, 8.5, 13.5, 18.5];
  const deck = 7.13,
    upperSpring = 9.04,
    crest = 10.58;
  for (const side of [-1, 1]) {
    const col = axis + side * 3.05;
    const outer = col + side * 1.5;
    for (let bay = 0; bay < bays.length - 1; bay++) {
      const z = bays[bay],
        mid = z + 2.5;
      arch(col, mid, true, 5, 4.18, 2.5, 0.24, 6.99, 0.66, true);
      bar(col, z, col, z + 5, 6.97, 0.17, 0.92, 'limestone');
      bar((col + outer) / 2, z, (col + outer) / 2, z + 5, deck, 0.24, 1.91, 'bedrock');
      bar(col - side * 0.25, z, col - side * 0.25, z + 5, deck + 0.035, 0.085, 0.16, 'bronze', true);
      arch(col, mid, true, 5, upperSpring, 1.13, 0.2, crest, 0.49, false);
      bar(col, z, col, z + 5, crest, 0.2, 0.84, 'limestone');
      bar(col, z, col, z + 5, crest + 0.2, 0.26, 1.14, 'bedrock');
      // The space between the two orders is a real maintenance gallery with an open guardrail.
      for (const t of [0.2, 0.5, 0.8])
        block(col - side * 0.34, z + t * 5, 0.078, 0.078, deck + 0.22, 0.53, 'iron', true);
      bar(col - side * 0.34, z, col - side * 0.34, z + 5, deck + 0.73, 0.065, 0.075, 'bronze');
    }
    for (const z of bays) {
      block(col, z, 0.86, 0.89, deck + 0.19, 0.18, 'limestone');
      shaft(col, z, deck + 0.37, 0.14, 0.38, 0.36, 'bronze');
      shaft(col, z, deck + 0.5, 1.17, 0.31, 0.265, 'limestone');
      shaft(col, z, deck + 1.67, 0.135, 0.28, 0.33, 'verdigris');
      shaft(col, z, deck + 1.805, 0.165, 0.33, 0.418, 'limestone');
      block(col, z, 0.91, 0.87, upperSpring - 0.025, 0.13, 'ashlar');
      // Iron sole plates and stone corbels transfer the load into the older piers.
      block(col, z, 0.97, 0.86, crest + 0.43, 0.12, 'bronze');
      block(col, z, 1.14, 1.03, crest + 0.55, 0.28, 'ashlar');
      block(col, z, 1.32, 1.16, crest + 0.83, 0.18, 'iron');
    }
  }

  // Transverse galleries carry the thrust sideways into the retaining wall, across the original side arches.
  // Their piers stand on the non-walkable outer line; all new spans clear the raised side landings.
  for (const side of [-1, 1]) {
    const inner = axis + side * 3.05,
      outer = axis + side * 7.95,
      end = axis + side * 12.85;
    for (const z of [-11.5, -1.5, 8.5, 18.5]) {
      for (const [left, right] of [
        [inner, outer],
        [outer, end],
      ]) {
        const mid = (left + right) / 2,
          span = Math.abs(right - left);
        arch(mid, z, false, span, 3.84, span * 0.5, 0.34, 6.92, 0.76, true);
        if (z >= -1.5) for (const sign of [-1, 1]) spandrelVent(mid + sign * span * 0.36, z + 0.39, 6.25);
        block(mid, z, span + 0.08, 1.07, 6.91, 0.24, 'limestone');
        block(mid, z, span + 0.17, 1.33, 7.15, 0.23, 'bedrock');
        block(mid, z + 0.54, span, 0.105, 7.18, 0.083, 'bronze');
        for (const offset of [-1, 1]) {
          const cx = mid + offset * span * 0.245;
          arch(cx, z, false, span * 0.5, 8.99, 1.05, 0.17, 10.53, 0.5, false);
        }
        shaft(mid, z, 7.38, 0.18, 0.39, 0.37, 'ashlar');
        shaft(mid, z, 7.56, 1.23, 0.26, 0.23, 'limestone');
        shaft(mid, z, 8.79, 0.23, 0.24, 0.37, 'verdigris');
        block(mid, z, 0.79, 0.68, 8.99, 0.13, 'limestone');
        bar(left, z - 0.38, right, z - 0.38, 7.92, 0.078, 0.08, 'bronze');
        block(mid, z, span + 0.09, 1.26, 10.53, 0.45, 'bedrock');
      }
      for (const x of [outer, end]) {
        block(x, z, 1.2, 1.27, 7.33, 0.19, 'limestone');
        shaft(x, z, 7.52, 1.27, 0.37, 0.329, 'limestone');
        shaft(x, z, 8.78, 0.23, 0.34, 0.49, 'limestone');
        block(x, z, 1.16, 0.96, 8.99, 0.18, 'ashlar');
      }
    }
  }

  // A transverse bearing bridge above the actual B2 staircase ties the two side galleries together.
  for (const z of [-11.5, -1.5]) {
    arch(axis, z, false, 6.1, 4.18, 3.05, 0.22, 7.64, 0.83, true);
    block(axis, z, 6.9, 1.31, 7.64, 0.23, 'limestone');
    block(axis, z, 6.84, 1.44, 7.87, 0.13, 'bronze');
    for (let bay = 0; bay < 3; bay++) {
      const x = axis + (bay - 1) * 1.99;
      arch(x, z, false, 1.99, 8.99, 0.78, 0.195, 10.28, 0.67, false);
    }
    for (const dx of [-2.985, -0.995, 0.995, 2.985]) {
      block(axis + dx, z, 0.53, 0.75, 7.99, 0.14, 'limestone');
      shaft(axis + dx, z, 8.13, 0.75, 0.22, 0.195, 'verdigris');
      block(axis + dx, z, 0.53, 0.7, 8.88, 0.18, 'limestone');
    }
    block(axis, z, 6.99, 1.19, 10.27, 0.2, 'limestone');
    block(axis, z, 6.83, 1.36, 10.46, 0.56, 'ashlar');
    block(axis, z, 7.1, 1.46, 11.02, 0.12, 'bronze');
  }

  // Broad fans of masonry close the roof above the galleries. The lit slot stays open above the stair.
  for (const side of [-1, 1]) {
    for (const z of [-14, -9, -4, 1, 6, 11, 16]) {
      block(axis + side * 6.61, z, 6.92, 5.02, 11.02, 0.48, 'bedrock');
      bar(axis + side * 3.12, z - 2.19, axis + side * 9.95, z - 2.19, 10.56, 0.49, 0.51, 'ashlar');
      bar(axis + side * 3.15, z - 2.19, axis + side * 9.93, z - 2.19, 10.51, 0.085, 0.65, 'bronze', true);
    }
  }
  for (const z of [3.5, 8.5, 13.5]) {
    const archPoint = (a: number, near: number, offset: number): GateVertex => [
      axis + 3.11 * Math.cos(a),
      z + near,
      10.87 + 1.76 * Math.sin(a) + offset,
    ];
    for (let slice = 0; slice < 12; slice++) {
      const a = (slice * Math.PI) / 12,
        b = ((slice + 1) * Math.PI) / 12;
      face(
        'soffit',
        [archPoint(a, 0, 0), archPoint(b, 0, 0), archPoint(b, 5, 0), archPoint(a, 5, 0)],
        0.91 + (slice % 2) * 0.045,
      );
      face('ashlar', [
        archPoint(a, 0, -0.13),
        archPoint(b, 0, -0.13),
        archPoint(b, 0.33, -0.13),
        archPoint(a, 0.33, -0.13),
      ]);
      face('limestone', [
        archPoint(a, 0.33, -0.13),
        archPoint(b, 0.33, -0.13),
        archPoint(b, 0.33, 0),
        archPoint(a, 0.33, 0),
      ]);
    }
  }

  // The city's bearing load is read from a large bronze register on the crosshead above the north stair.
  for (const side of [-1, 1]) {
    const x = axis + side * 2.58;
    block(x, 1.19, 1.12, 1.29, -0.55, 4.61, 'ashlar');
    block(x, 1.22, 1.27, 1.43, -0.36, 0.47, 'bedrock');
    for (const y of [0.2, 2.84, 3.55]) block(x, 1.24, 1.23, 1.42, y, 0.145, 'limestone');
    for (const rib of [-0.31, 0.31]) shaft(x + rib, 1.9, 0.55, 2.9, 0.102, 0.095, 'verdigris');
    block(x, 1.2, 1.45, 1.62, 3.91, 0.32, 'limestone');
  }
  arch(axis, 1.33, false, 4.66, 2.9, 1.58, 0.26, 5.48, 1.16, false);
  block(axis, 1.33, 5.77, 1.54, 5.46, 0.23, 'limestone');
  block(axis, 1.53, 5.37, 1.26, 5.69, 0.94, 'ashlar');
  const { x: gaugeX, z: gaugeZ, height: gaugeY, radius: dialR } = gateLoadDial;
  const dialPoint = (r: number, angle: number, depth: number): GateVertex => [
    gaugeX + r * Math.sin(angle),
    gaugeZ + depth,
    gaugeY + r * Math.cos(angle),
  ];
  const segments = 40;
  for (let step = 0; step < segments; step++) {
    const a = (step * 2 * Math.PI) / segments,
      b = ((step + 1) * 2 * Math.PI) / segments;
    face('bedrock', [dialPoint(0, a, 0), dialPoint(dialR * 0.91, a, 0), dialPoint(dialR * 0.91, b, 0)]);
    face('bronze', [
      dialPoint(dialR * 0.85, a, 0.045),
      dialPoint(dialR * 0.85, b, 0.045),
      dialPoint(dialR, a, 0.015),
    ]);
    face('bronze', [dialPoint(dialR * 0.85, b, 0.045), dialPoint(dialR, b, 0.015), dialPoint(dialR, a, 0.015)]);
    face('ashlar', [
      dialPoint(dialR, a, 0.015),
      dialPoint(dialR, b, 0.015),
      dialPoint(dialR, b, -0.27),
      dialPoint(dialR, a, -0.27),
    ]);
  }
  for (let tick = 0; tick <= 22; tick++) {
    const a = ((tick / 22) * 1.46 - 0.73) * Math.PI,
      r = dialR * (tick % 3 ? 0.76 : 0.63);
    face(tick >= 17 ? 'verdigris' : 'limestone', [
      dialPoint(r, a - 0.018, 0.05),
      dialPoint(r, a + 0.018, 0.05),
      dialPoint(dialR * 0.82, a + 0.021, 0.05),
      dialPoint(dialR * 0.82, a - 0.021, 0.05),
    ]);
  }
  for (const offset of [-1, 1]) {
    for (const lane of [0, 1]) {
      const left = axis + offset * (1.04 + lane * 0.57);
      block(left, 2.25, 0.47, 0.12, 5.84, 0.26, 'verdigris');
      block(left, 2.32, 0.32, 0.085, 5.98, 0.066, 'bronze');
    }
    block(axis + offset * 2.4, 2.2, 0.104, 0.18, 5.66, 0.79, 'bronze');
  }
  block(axis, 1.53, 5.72, 1.43, 6.57, 0.2, 'limestone');
  block(axis, 1.53, 5.9, 1.57, 6.77, 0.11, 'bronze');

  // The curved foundation is seen from below. Each wedge rests on the cross girders and side masonry.
  const centreZ = -6.5;
  const count = 32;
  const ringPoint = (angle: number, r: number, height: number): GateVertex => [
    axis + Math.cos(angle) * r,
    centreZ + Math.sin(angle) * r,
    height,
  ];
  for (let i = 0; i < count; i++) {
    const a = (i * 2 * Math.PI) / count + 0.006,
      b = ((i + 1) * 2 * Math.PI) / count - 0.006;
    for (const [ri, ro, h, rise, finish] of [
      [5.95, 8.12, 11.13, 0.21, 'iron'],
      [5.83, 8.27, 11.34, 0.25, 'limestone'],
      [6.05, 8.1, 11.59, 1.04, 'ashlar'],
      [5.85, 8.28, 12.63, 0.18, 'bronze'],
      [5.75, 8.42, 12.81, 0.83, 'bedrock'],
    ] as const) {
      const course = (y: number) => [
        ringPoint(a, ri, y),
        ringPoint(b, ri, y),
        ringPoint(b, ro, y),
        ringPoint(a, ro, y),
      ];
      solid(course(h), course(h + rise), finish, 0.85 + (i % 4) * 0.038);
    }
    if (i % 2 === 0) {
      const angle = (a + b) / 2;
      const [x, z] = ringPoint(angle, 7.02, 0),
        [ox, oz] = ringPoint(angle, 10.92, 0);
      bar(x, z, ox, oz, 12.15, 0.86, 0.55, 'bedrock');
      bar(x, z, ox, oz, 13.01, 0.145, 0.71, 'bronze', true);
    }
  }
  // The city foundation meets rock and masonry overhead. A ribbed cover of smoked glass
  // between the bearing ring and the crown admits daylight without opening the hall to the sky.
  for (let i = 0; i < 24; i++) {
    const a = (i * 2 * Math.PI) / 24 + 0.013,
      b = ((i + 1) * 2 * Math.PI) / 24 - 0.013;
    const oval = (r: number, t: number, h: number): GateVertex => [
      axis + Math.cos(t) * r,
      centreZ + Math.sin(t) * r,
      h,
    ];
    face(
      i % 4 === 1 ? 'ashlar' : 'smokedGlass',
      [oval(1.1, a, 13.38), oval(5.73, a, 13.38), oval(5.73, b, 13.38), oval(1.1, b, 13.38)],
      0.91 + (i % 4) * 0.025,
    );
    const [ix, iz] = oval(1.0, a, 0),
      [ox, oz] = oval(5.94, a, 0);
    bar(ix, iz, ox, oz, 13.27, 0.14, 0.13, 'iron');
    for (const r of [2.1, 4.18]) {
      const [x1, z1] = oval(r, a, 0),
        [x2, z2] = oval(r, b, 0);
      bar(x1, z1, x2, z2, 13.23, 0.11, 0.12, 'bronze');
    }
  }
  shaft(axis, centreZ, 13.06, 0.34, 1.16, 1.0, 'bedrock');
  shaft(axis, centreZ, 13.0, 0.09, 1.13, 1.16, 'bronze');
  // The crown is inset into the soffit. A narrow opening remains above the real drum.
  for (const z of [-21, -16, -11, -6, -1, 4, 9, 14, 19, 24, 29]) {
    for (let lane = 0; lane < 12; lane++) {
      const left = axis + (lane - 6) * 4.1,
        right = left + 4.1,
        mid = (left + right) / 2;
      if (Math.abs(mid - axis) < 6.3 && Math.abs(z + 2.5 - centreZ) < 8.1) continue;
      const vault = (x: number, depth: number): GateVertex => [
        x,
        depth,
        12.65 + 3.1 * Math.cos(((x - axis) * Math.PI) / 49.2),
      ];
      face(
        'soffit',
        [vault(left, z), vault(right, z), vault(right, z + 5), vault(left, z + 5)],
        0.68 + ((lane + Math.round(z)) % 3) * 0.034,
      );
      if ((lane + 1) % 3 === 0) {
        const h = vault(right, z)[2];
        bar(right, z, right, z + 5, h - 0.24, 0.26, 0.33, 'bedrock');
      }
    }
  }

  // The curve of the city can also be read from directly below: a low bronze maintenance gallery
  // follows the outer wall, spanning across the forked capitals over the entrance.
  const sweep = 28,
    galleryZ = 5.4;
  for (let i = 0; i < sweep; i++) {
    const a = (i * Math.PI * 2) / sweep,
      b = ((i + 1) * Math.PI * 2) / sweep;
    const pt = (angle: number, r: number, h: number): GateVertex => [
      axis + Math.cos(angle) * r,
      galleryZ + Math.sin(angle) * r,
      h,
    ];
    for (const [inner, outer, level, h, finish] of [
      [8.3, 9.28, 7.28, 0.22, 'bedrock'],
      [8.23, 9.36, 7.5, 0.14, 'limestone'],
      [8.29, 9.27, 7.64, 0.12, 'bronze'],
    ] as const) {
      const course = (height: number) => [
        pt(a, inner, height),
        pt(b, inner, height),
        pt(b, outer, height),
        pt(a, outer, height),
      ];
      solid(course(level), course(level + h), finish, 0.93 + (i % 3) * 0.025);
    }
    const [x1, z1] = pt(a, 8.38, 0),
      [x2, z2] = pt(b, 8.38, 0);
    bar(x1, z1, x2, z2, 8.3, 0.079, 0.084, 'bronze');
    block(x1, z1, 0.104, 0.104, 7.75, 0.58, 'iron');
  }
  for (const x of [5.45, 11.55])
    for (const z of [-1.5, 8.5, 13.5]) {
      block(x, z, 0.97, 1.0, 6.57, 0.15, 'limestone');
      shaft(x, z + 0.57, 6.66, 0.1, 0.2, 0.22, 'bronze');
      shaft(x, z + 0.57, 6.76, 0.22, 0.15, 0.13, 'light');
      shaft(x, z + 0.57, 6.98, 0.065, 0.22, 0.18, 'bronze');
    }
  for (const well of gateLightwells) {
    const { x, z, h } = well;
    block(x, z, 0.81, 0.34, h - 0.28, 1.58, 'bedrock');
    block(x, z + 0.19, 0.585, 0.087, h - 0.11, 1.17, 'opal');
    block(x, z + 0.19, 0.87, 0.23, h - 0.24, 0.14, 'limestone');
    for (const dx of [-0.2, 0, 0.2]) block(x + dx, z + 0.253, 0.045, 0.043, h - 0.12, 1.2, 'bronze');
    for (const level of [0.17, 0.64]) block(x, z + 0.252, 0.61, 0.043, h + level, 0.035, 'bronze');
    block(x, z + 0.18, 0.97, 0.22, h + 1.12, 0.13, 'limestone');
  }
  // Recessed slots on the north abutment admit a little warm light from the city works above.
  for (let bay = -3; bay <= 3; bay++) {
    const x = axis + bay * 2.38;
    block(x, -17.42, 2.39, 1.27, 9.4, 3.45, 'bedrock');
    block(x, -16.75, 1.39, 0.18, 10.3, 1.62, 'iron');
    for (const offset of [-0.42, 0, 0.42]) block(x + offset, -16.64, 0.2, 0.075, 10.5, 1.23, 'light');
    block(x, -16.67, 1.78, 0.35, 10.11, 0.18, 'limestone');
    block(x, -16.65, 1.69, 0.37, 11.94, 0.17, 'bronze');
  }
  structure = shapes.sort((a, b) => a.depth - b.depth);
  return structure;
}
