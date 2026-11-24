import { expect, test } from '@playwright/test';
import type { FortressInteriorFrame } from '../src/field-fortress-state';
import { migratePalaceLocation, migratePalaceTrail, mazeFloors, catacombLift, palaceWidth } from '../src/fortress-maze';
import { knownWalkway, surveyedCells } from '../src/fortress-survey';
import { createWetFootfalls, palacePuddles, puddleUV } from '../src/fortress-wet-ground';

test('the survey records the face of a pier while its masonry hides the opposite pavement', () => {
  const id = (x: number, y: number) => y * palaceWidth + x;
  for (const room of ['aqueduct', 'catacomb'] as const) {
    const left = id(12, 6),
      pier = id(13, 6),
      right = id(14, 6);
    expect(surveyedCells(room, [left], false).has(pier)).toBe(true);
    expect(surveyedCells(room, [left], false).has(right)).toBe(false);
    expect(surveyedCells(room, [right], false).has(left)).toBe(false);
  }
  expect(knownWalkway('aqueduct', { x: 24, y: 43 }, { x: 73, y: 42 }, [id(24, 43)], true)).toBeUndefined();
});

test('previous entrances, machinery and visited tiles migrate to their counterpart inside the palace', () => {
  expect(migratePalaceLocation({ area: 'harbor', fortressRoom: 'catacomb', x: 3, y: 6 }, undefined)).toMatchObject(
    catacombLift,
  );
  expect(migratePalaceLocation({ area: 'harbor', fortressRoom: 'aqueduct', x: 18, y: 3 }, undefined)).toMatchObject(
    mazeFloors.aqueduct.down,
  );
  const migrated = migratePalaceTrail({ aqueduct: [19 * 23 + 4, 3 * 23 + 18], catacomb: [6 * 23 + 3] }, undefined) as {
    aqueduct: number[];
    catacomb: number[];
  };
  expect(migrated.aqueduct).toEqual([43 * palaceWidth + 24, 5 * palaceWidth + 24]);
  const current = { area: 'harbor', fortressRoom: 'catacomb', x: 9, y: 10 } as const;
  expect(migratePalaceLocation(current, 2)).toEqual(current);
  expect(migratePalaceTrail(migrated, 2)).toEqual(migrated);
});

test('each sole disturbs water only inside its shoreline and tracks it onto the stone', () => {
  const trail = createWetFootfalls(),
    pool = palacePuddles.sluice[0];
  const frame: FortressInteriorFrame = {
    room: 'sluice',
    x: 0,
    y: 0,
    facing: 'up',
    stride: 0,
    now: 0,
    reduced: false,
    inspecting: false,
    resonance: 0,
    shortcutOpen: false,
    liftUnlocked: false,
    gateAge: Infinity,
    roarAge: Infinity,
  };
  const step = (foot: number, fraction: number, contactX: number, contactZ: number, time: number) =>
    trail.advance({
      ...frame,
      now: time,
      x: contactX - (foot ? 0.103 : -0.103),
      y: contactZ - (fraction - 0.43),
      gaitPhase: (foot + fraction) / 2,
    });
  const first = step(0, 0.69, pool.x, pool.z, 1000);
  expect(first?.pool).toBe(pool);
  expect(puddleUV(pool, first!.x, first!.z).map(Math.abs)).toEqual([0, 0]);
  expect(step(0, 0.81, pool.x, pool.z, 1040)).toBeUndefined();
  expect(step(1, 0.73, pool.x, pool.z + 1, 1190)).toBeUndefined();
  const print = step(0, 0.71, pool.x, pool.z + 1.5, 1360);
  expect(print?.pool).toBeUndefined();
  expect(print?.strength).toBeGreaterThan(0.9);
  expect(step(1, 0.62, pool.x, pool.z, 1540)?.pool).toBe(pool);
  expect(step(0, 0.82, pool.x, pool.z + 1.7, 1720)!.strength).toBeLessThan(print!.strength);
  trail.advance({ ...frame, now: 1860, reduced: true });
  expect(trail.marks).toHaveLength(0);
  // The furthest indented edge is dry even inside the old approximation ellipse.
  const edge = pool.outline[16];
  const dry = step(1, 0.68, pool.x + 1.03 * (edge[0] - pool.x), pool.z + 1.03 * (edge[1] - pool.z), 2000);
  expect(dry).toBeUndefined();
});

test('the upper landing is picked at its actual height, including the front face of a stair', async () => {
  const { palaceFloorRay, palaceLandmarkRay } = await import('../src/fortress-palace-picking');
  const { palaceElevation } = await import('../src/fortress-maze');
  for (const floor of ['aqueduct', 'catacomb'] as const) {
    for (let z = 5.25; z < 44; z += 0.5) {
      const h = palaceElevation(floor, 24.5, z),
        hit = palaceFloorRay(floor, { x: 24.5, y: h + 7, z: z + 7 }, { x: 0, y: -1, z: -1 });
      expect(hit?.x).toBeCloseTo(24.5);
      expect(hit?.y).toBeCloseTo(z);
    }
    const z = 10,
      riser = (palaceElevation(floor, 24.5, z - 0.01) + palaceElevation(floor, 24.5, z + 0.01)) / 2;
    const hit = palaceFloorRay(floor, { x: 24.5, y: riser + 0.09, z: z + 0.2 }, { x: 0, y: -0.45, z: -1 });
    expect(hit?.y).toBeCloseTo(z - 0.001, 3);
    const machine = mazeFloors[floor].instrument,
      station = mazeFloors[floor].switch;
    expect(palaceLandmarkRay(floor, { x: machine.x + 0.5, y: 2.9, z: machine.y + 0.5 }, { x: 0, y: -1, z: 0 })).toEqual(
      { x: station.x + 0.5, y: station.y + 0.5 },
    );
    // The visible pavement through the empty middle of the portal belongs to a real tile behind it.
    const alt = palaceElevation(floor, 24.5, 43.7);
    expect(palaceLandmarkRay(floor, { x: 24.5, y: alt + 1.1, z: 45.7 }, { x: 0, y: 0, z: -1 })).toBeUndefined();
  }
});

test('viewing terraces carry the traveller, while a half-drained channel continues landing after its valve closes', async () => {
  const { hallSupport, viewingSteps, pickPalacePortal } = await import('../src/fortress-portals');
  for (const step of viewingSteps) {
    const h = hallSupport('sluice', step.x, 11.5),
      hit = pickPalacePortal('sluice', { x: step.x, y: h + 6, z: 11.5 }, { x: 0, y: -1, z: 0 }, true);
    expect(h).toBeCloseTo(step.top, 6);
    expect(hit).toEqual({ x: step.x, y: 11.5 });
  }
  expect(hallSupport('sluice', 3.5, 12.5)).toBe(0);
  const { discharge, spillwayLevels, spillwayFall, valveDelay } = await import('../src/fortress-spillway-flow');
  for (const tier of spillwayLevels) {
    const fall = spillwayFall(tier, -25);
    expect(fall.flight).toBeCloseTo(Math.sqrt((2 * (tier.y - tier.next)) / 9.81));
    for (let outlet = 0; outlet < valveDelay.length; outlet++) {
      const dry = tier.empties + valveDelay[outlet] + fall.flight * 0.3;
      expect(discharge(tier, outlet, dry)).toBe(0);
      expect(discharge(tier, outlet, dry - fall.flight)).toBeGreaterThan(0);
    }
  }
});

test('frost particles leave separate soles inside an ice tile and clear during motion reduction', async () => {
  const { createFrostCloud } = await import('../src/fortress-frost-contact');
  const cloud = createFrostCloud();
  const frame: FortressInteriorFrame = {
    room: 'catacomb',
    x: 9.5,
    y: 18.53,
    facing: 'up',
    stride: 1,
    gaitPhase: 0.25,
    now: 1000,
    reduced: false,
    inspecting: false,
    resonance: 1,
    shortcutOpen: false,
    liftUnlocked: true,
    gateAge: Infinity,
    roarAge: Infinity,
  };
  cloud.advance(frame);
  expect(cloud.particles).toHaveLength(3);
  expect(cloud.particles[0].x).toBeLessThan(frame.x);
  cloud.advance({ ...frame, now: 1060, gaitPhase: 0.4 });
  expect(cloud.particles).toHaveLength(3);
  cloud.advance({ ...frame, now: 1160, gaitPhase: 0.77 });
  expect(cloud.particles).toHaveLength(6);
  expect(cloud.particles[3].x).toBeGreaterThan(frame.x);
  cloud.advance({ ...frame, now: 1180, reduced: true });
  expect(cloud.particles).toHaveLength(0);
  cloud.advance({ ...frame, now: 1220, y: 24.4 });
  expect(cloud.particles).toHaveLength(0);
});
