import { loadCreatureSprite, loadSprite } from './creature-art';
import type { CreatureId } from './creatures';
import { maps, TILE, type FieldMap } from './field-art';
import type { FieldArea, FieldEvent, FieldLocation, RoomId } from './field-art';
import { rooms } from './field-rooms';
import { cityObstacles } from './field-city-layout';
import { cityStops, surveyAt, surveyStops, type CityStop, type SurveyId } from './field-city-walks';
import { fortressDial, fortressLiftStops, fortressMapAt, fortressMaps, fortressOrder, fortressPier, fortressRooms, fortressSequence, kyuremTiming, openFortress, sleepingFortress, type FortressView, type RoarPhase } from './field-fortress-state';
import { isMazeRoom, mazeFloors, type MazePoint, type MazeRoom } from './fortress-maze';
import { knownWalkway } from './fortress-survey';
import { ringRadius, ringStreetLooksOutward, ringStreetRow, ringXDelta, wrapRingX } from './field-ring-coordinates';
import { tileAt } from './field-layout';
import type { Footing } from './sound';
import { createFieldPresentation, streetAxisMinSpan } from './field-presentation';
import { fieldFadeDuration } from './field-renderer';

export type { FieldArea, FieldEvent, FieldLocation, RoomId } from './field-art';
export type Direction = 'up' | 'down' | 'left' | 'right';
export type EncounterKind = 'grass' | 'rustle';

export const fieldAreas = {
  harbor: { name: '潮汐环城', english: 'TIDEPORT RING', description: '沿环城大道探索街区，在外环绿廊寻找野生宝可梦。' },
  grove: { name: '雾杉小径', english: 'MISTPINE TRAIL', description: '沿林间小径寻找研究员，继续向东前往高地。' },
  summit: { name: '风语高地', english: 'WHISPER HEIGHTS', description: '拜访山上的信号站，接受守望员的试炼。' },
} as const satisfies Record<FieldArea, { name: string; english: string; description: string }>;

interface FieldOptions {
  parent: HTMLElement;
  initial?: FieldLocation;
  guideMet?: boolean;
  fortressOpened: boolean;
  tideDialAwake: boolean;
  onDialAwake: () => void;
  shortcuts: readonly MazeRoom[];
  onShortcut: (room: MazeRoom) => void;
  onLiftTravel: (active: boolean) => void;
  onRoarPhase: (phase: RoarPhase) => void;
  onCryStop: () => void;
  fortressStartedAt?: number;
  onFortressSave: (started: number | null) => void;
  onFortressView: (view: FortressView, inspecting: boolean) => void;
  onLocation: (location: FieldLocation) => void;
  onHint: (hint: string) => void;
  onEvent: (event: FieldEvent) => void;
  onEncounter: (area: FieldArea, kind: EncounterKind) => void;
  onSurvey: (id: SurveyId) => void;
  onReady?: () => void;
  onOverview?: (active: boolean) => void;
  onSound?: (sound: 'step' | 'interact' | 'area' | 'encounter' | 'hoist' | 'discharge' | 'seal' | 'tideDial' | 'kyuremCry' | 'wardImpact' | 'bridge' | 'iceGate', surface?: Footing) => void;
}

export interface FieldControls {
  move: (direction: Direction) => void;
  hold: (direction: Direction | null) => void;
  interact: () => void;
  setPaused: (paused: boolean) => void;
  setCompanion: (creature: CreatureId | null) => void;
  setRunning: (running: boolean) => void;
  setNight: (night: boolean) => void;
  setOverview: (active: boolean) => void;
  setBeaconLit: (lit: boolean) => void;
  setCovered: (covered: boolean) => void;
  travel: (area: FieldArea) => void;
  walkToStop: (stop: CityStop) => boolean;
  approachFortress: () => void;
  approachTideDial: () => void;
  walkRecorded: (point: MazePoint, walked: readonly number[]) => boolean;
  callKyurem: () => boolean;
  rideFortressLift: () => void;
  replayFortress: () => void;
  leaveRoom: () => void;
  getLocation: () => FieldLocation;
  destroy: () => void;
}

type TilePoint = { x: number; y: number };
type Actor = FieldMap['npcs'][number];
export type WalkStep = { from: TilePoint; to: TilePoint; startedAt: number; duration: number; running: boolean };
type Rustle = TilePoint & { expires: number };

const offsets: Record<Direction, TilePoint> = {
  up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 },
};
const opposite: Record<Direction, Direction> = { up: 'down', down: 'up', left: 'right', right: 'left' };
const stepDirections = Object.keys(offsets) as Direction[];
const keys: Record<string, Direction | undefined> = {
  ArrowUp: 'up', w: 'up', ArrowDown: 'down', s: 'down', ArrowLeft: 'left', a: 'left', ArrowRight: 'right', d: 'right',
};
const walkDuration = 158;
const runDuration = 91;

const roomEntrances = { about: 'home', projects: 'lab', contact: 'tower' } as const;

const horizontalDelta = (from: number, to: number, wrap = false) => wrap ? ringXDelta(from, to) : to - from;
const neighbor = (point: TilePoint, direction: Direction, wrap = false): TilePoint => {
  const x = point.x + offsets[direction].x;
  return { x: wrap ? wrapRingX(x) : x, y: point.y + offsets[direction].y };
};
const distance = (a: TilePoint, b: TilePoint, wrap = false) => Math.abs(horizontalDelta(a.x, b.x, wrap)) + Math.abs(a.y - b.y);
const sameTile = (a: TilePoint, b: TilePoint) => a.x === b.x && a.y === b.y;
const directionTo = (from: TilePoint, to: TilePoint, wrap = false): Direction => from.x !== to.x
  ? horizontalDelta(from.x, to.x, wrap) > 0 ? 'right' : 'left'
  : to.y > from.y ? 'down' : 'up';
const intersect = (point: TilePoint, map: FieldMap) => Number.isInteger(point.x) && Number.isInteger(point.y)
  && map.walkable[point.y]?.[point.x] === true;
const walkable = (point: TilePoint, map: FieldMap) => intersect(point, map) && !map.npcs.some(npc => npc.solid && sameTile(npc, point));
const locationMap = (location: FieldLocation, shortcuts: readonly MazeRoom[]) => location.fortressRoom ? fortressMapAt(location.fortressRoom, shortcuts) : location.room ? rooms[location.room].map : maps[location.area];

function findPath(start: TilePoint, targets: TilePoint[], map: FieldMap, preferPavement = false): TilePoint[] | undefined {
  if (!targets.length) return;
  const index = (point: TilePoint) => point.y * map.width + point.x;
  const goals = new Set(targets.map(index));
  // Any simple route takes fewer steps than there are tiles. One grass tile
  // therefore costs more than the longest pavement detour when using the atlas.
  const grassCost = preferPavement ? map.width * map.height : 0;
  const frontier: TilePoint[][] = [[start]];
  const previous = new Map<number, { parent?: TilePoint; cost: number }>([[index(start), { cost: 0 }]]);
  for (let cost = 0; cost < frontier.length; cost++) {
    const bucket = frontier[cost];
    if (!bucket) continue;
    for (const point of bucket) {
      const key = index(point);
      if (previous.get(key)!.cost !== cost) continue;
      if (goals.has(key)) {
        const path: TilePoint[] = [];
        let current = point;
        for (let parent = previous.get(key)?.parent; parent; parent = previous.get(index(current))?.parent) {
          path.push(current);
          current = parent;
        }
        return path.reverse();
      }
      for (const direction of stepDirections) {
        const next = neighbor(point, direction, map.wrapX);
        if (!walkable(next, map)) continue;
        const nextKey = index(next);
        const nextCost = cost + 1 + (map.grass[next.y][next.x] ? grassCost : 0);
        if ((previous.get(nextKey)?.cost ?? Infinity) <= nextCost) continue;
        if (!goals.has(nextKey) && map.exits.some(exit => sameTile(exit, next))) continue;
        previous.set(nextKey, { parent: point, cost: nextCost });
        (frontier[nextCost] ??= []).push(next);
      }
    }
  }
}

export function planCityWalk(start: FieldLocation, stop: CityStop) {
  if (start.area !== 'harbor' || start.room || start.fortressRoom) return;
  const map = maps.harbor;
  return findPath(start, stop.approaches, map, true);
}

function initialLocation(initial: FieldLocation | undefined, shortcuts: readonly MazeRoom[]): FieldLocation {
  if (initial && Object.hasOwn(maps, initial.area)) {
    const validRoom = !initial.room || Object.hasOwn(rooms, initial.room) && rooms[initial.room].area === initial.area;
    if (validRoom && walkable(initial, locationMap(initial, shortcuts))) return { ...initial };
    if (initial.area === 'harbor' && !initial.room && cityObstacles.some(([x, y, w, h]) =>
      initial.x >= x && initial.x < x + w && initial.y >= y && initial.y < y + h)) {
      const map = maps.harbor;
      const possible: TilePoint[] = [];
      for (let offset = -6; offset <= 6; offset++) {
        for (let side = -6; side <= 6; side++) {
          const point = { x: initial.x + side, y: initial.y + offset };
          if (walkable(point, map)) possible.push(point);
        }
      }
      const closest = possible.sort((a, b) => distance(initial, a) - distance(initial, b) || Math.abs(a.y - 12) - Math.abs(b.y - 12))[0];
      if (closest) return { area: 'harbor', ...closest };
    }
    return { area: initial.area, ...maps[initial.area].spawn };
  }
  return { area: 'harbor', ...maps.harbor.spawn };
}

export function createField(options: FieldOptions): FieldControls {
  const { parent } = options;
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  parent.append(canvas);

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const renderer = createFieldPresentation(canvas, reducedMotion, options.onReady);
  const creatureArt = new Map<CreatureId, HTMLCanvasElement>();
  const pendingArt = new Set<CreatureId>();
  const pressed = new Map<string, Direction>();
  const shortcuts = [...options.shortcuts];
  const mapAt = (where: FieldLocation) => locationMap(where, shortcuts);
  let location = initialLocation(options.initial, shortcuts);
  let liftRide: { down: boolean; started: number; duration: number; changed: boolean } | undefined;
  let gateStarted = -Infinity;
  let roarStarted = -Infinity;
  let nextRoar = performance.now() + 3800;
  let roarPhase: RoarPhase = 'quiet';
  let lastCall = -Infinity;
  let started = options.fortressOpened ? undefined : options.fortressStartedAt;
  let fortress: FortressView = options.fortressOpened ? openFortress : sleepingFortress;
  let inspectingSeal = false;
  let dialAwake = options.tideDialAwake;
  let dialStarted = -Infinity;
  let lastProgress = -1;
  let facing: Direction = 'down';
  let held: Direction | null = null;
  let queued: Direction | null = null;
  let streetInput: { screen: Direction; travel: Direction; at: number } | undefined;
  let path: TilePoint[] = [];
  let walkingTo: CityStop | undefined;
  let onArrival: (() => void) | undefined;
  let step: WalkStep | undefined;
  let lastFootfall = -Infinity;
  let trail: TilePoint | undefined;
  let companion: CreatureId | null = null;
  let sylveon: HTMLCanvasElement | undefined;
  let running = false;
  let shiftPressed = false;
  let night = false;
  let beaconLit = false;
  let interactQueued = false;
  let fadedAt = -fieldFadeDuration;
  let pumpStarted = -Infinity;
  let surveyFocus: CityStop | undefined;
  let paused = false;
  let grassSteps = 0;
  let encounterAfter = 3;
  let strides = 0;
  let rustle: Rustle | undefined;
  let frame = 0;
  let lastHint = '';
  let wasDestroyed = false;
  let onScreen = true;
  let covered = false;
  let guideMet = options.guideMet ?? false;
  let overview = location.area === 'harbor' && !location.room && !location.fortressRoom && started === undefined;
  let orbitOffset = 0;
  let orbitTilt = 0;
  let orbitGesture: { id: number; startX: number; startY: number; offset: number; tilt: number; moved: boolean } | undefined;

  function hint(message: string) {
    if (lastHint === message) return;
    lastHint = message;
    options.onHint(message);
  }

  function nearby(): Actor | undefined {
    const { npcs, wrapX } = mapAt(location);
    return npcs.find(npc => sameTile(npc, neighbor(location, facing, wrapX))) ?? npcs.find(npc => distance(npc, location, wrapX) <= 1);
  }

  function entrance(event: FieldEvent): RoomId | undefined {
    if (!location.room && Object.hasOwn(roomEntrances, event)) {
      const room = roomEntrances[event as keyof typeof roomEntrances];
      if (rooms[room].area === location.area) return room;
    }
  }

  function atWinch() {
    return location.area === 'harbor' && !location.room && !location.fortressRoom && distance(location, fortressPier, true) <= 1;
  }

  function updateFortress() {
    if (started === undefined) return;
    const next = fortressSequence(Math.max(0, Date.now() - started), reducedMotion.matches);
    const stageChanged = fortress.phase !== next.phase || fortress.cinematic !== next.cinematic;
    if (stageChanged && next.phase === 'draining') options.onSound?.('discharge');
    if (stageChanged && next.phase === 'open') options.onSound?.('area');
    fortress = next;
    const progress = Math.round((next.phase === 'rising' ? next.lift : next.drain) * 25);
    if (stageChanged || progress !== lastProgress) {
      lastProgress = progress;
      options.onFortressView(next, inspectingSeal);
      refreshHint();
    }
    if (!next.cinematic) {
      started = undefined;
      options.onFortressSave(null);
      renderer.resetCamera();
    }
  }

  function launchFortress() {
    setOverview(false);
    stopRouting();
    clearInput();
    step = undefined;
    started = Date.now();
    options.onFortressSave(started);
    updateFortress();
    renderer.resetCamera();
    options.onSound?.('hoist');
  }

  function ascend() {
    const floor = location.fortressRoom;
    if (!floor) return;
    const previous = fortressOrder[fortressOrder.indexOf(floor) - 1];
    facing = 'down';
    switchArea(previous ? { area: 'harbor', fortressRoom: previous, ...fortressRooms[previous].down }
      : { area: 'harbor', ...fortressPier }, performance.now());
  }

  function descend() {
    const floor = location.fortressRoom;
    if (!floor) return;
    const next = fortressOrder[fortressOrder.indexOf(floor) + 1];
    if (!next) return;
    facing = 'up';
    switchArea({ area: 'harbor', fortressRoom: next, ...fortressMapAt(next, shortcuts).spawn }, performance.now());
  }

  function atLift() {
    const floor = location.fortressRoom;
    return (floor === 'sluice' || floor === 'catacomb') && distance(location, fortressLiftStops[floor]) <= 1;
  }

  function startLift() {
    const floor = location.fortressRoom;
    if (paused || liftRide || !atLift() || !shortcuts.includes('catacomb') || floor !== 'sluice' && floor !== 'catacomb') return;
    const platform = fortressLiftStops[floor];
    if (step || !sameTile(location, platform)) {
      route([platform], startLift);
      return;
    }
    clearInput();
    stopRouting();
    liftRide = { down: floor === 'sluice', started: performance.now(), duration: reducedMotion.matches ? 290 : 1460, changed: false };
    options.onLiftTravel(true);
    options.onSound?.('bridge');
    refreshHint();
  }

  function updateLift(time: number) {
    if (!liftRide) return;
    const p = (time - liftRide.started) / liftRide.duration;
    if (p >= .50 && !liftRide.changed) {
      liftRide.changed = true;
      const floor = liftRide.down ? 'catacomb' : 'sluice';
      switchArea({ area: 'harbor', fortressRoom: floor, ...fortressLiftStops[floor] }, time);
    }
    if (p >= 1) {
      liftRide = undefined;
      options.onLiftTravel(false);
      refreshHint();
    }
  }

  function quietSeal(time: number) {
    if (roarPhase !== 'quiet') options.onRoarPhase('quiet');
    if (Number.isFinite(roarStarted)) options.onCryStop();
    roarPhase = 'quiet';
    roarStarted = -Infinity;
    lastCall = -Infinity;
    nextRoar = time + 3800;
  }

  function startRoar(time: number) {
    roarPhase = 'breath';
    roarStarted = time;
    nextRoar = time + (inspectingSeal ? 14800 : 17400);
    options.onRoarPhase('breath');
  }

  function updateRoar(time: number) {
    if (location.fortressRoom !== 'seal' || paused || !onScreen || covered || document.hidden) return;
    if (time >= nextRoar) startRoar(time);
    if (!Number.isFinite(roarStarted)) return;
    const age = (time - roarStarted) / 1000;
    const phase = age < kyuremTiming.voice ? 'breath' : age < kyuremTiming.impact ? 'roar' : age < kyuremTiming.decay ? 'impact' : 'quiet';
    if (phase === roarPhase) return;
    // A slow frame can span the onset and the impact together.
    if (roarPhase === 'breath' && age < 1.1) options.onSound?.('kyuremCry');
    if (phase === 'impact' && age < 1.45) options.onSound?.('wardImpact');
    roarPhase = phase;
    options.onRoarPhase(phase);
    if (phase === 'quiet') roarStarted = -Infinity;
  }

  function refreshHint() {
    if (fortress.cinematic) return hint(fortress.phase === 'rising' ? '升降机启动 · 堡体上浮' : fortress.phase === 'draining' ? '八向泄水 · 等待闸门开启' : '水位已降 · 闸门开启');
    if (liftRide) return hint(liftRide.down ? '铜索放长 · 正在下行至陵廊' : '铜索收紧 · 正在上行至水殿');
    if (atLift()) return hint(shortcuts.includes('catacomb') ? '互动 · 乘升降台穿过中层水渠' : '古升降台停靠 · 深处的轮锁尚未开启');
    if (inspectingSeal) return hint('观测冰核能量罩 · 再次互动返回观测桥');
    if (isMazeRoom(location.fortressRoom)) {
      const room = location.fortressRoom, plan = mazeFloors[room];
      if (distance(location, plan.switch) <= 1) return hint(shortcuts.includes(room) ? plan.gateName + '已开启' : '互动 · 操作' + plan.switchName);
      if (distance(location, plan.down) <= 1) return hint('互动 · 沿下行阶梯进入' + fortressRooms[fortressOrder[fortressOrder.indexOf(room) + 1]].name);
      if (distance(location, plan.up) <= 1) return hint(room === 'aqueduct' ? '从西岸桥头探入水渠 · 在此互动可返回水殿' : '循石棺间的冰脉寻找下层 · 在此互动可返回水渠');
      if (distance(location, plan.gate) <= 1 && !shortcuts.includes(room)) return hint(plan.gateName + '关闭 · 机关在另一侧');
      const landmark = plan.landmarks.find(point => distance(location, point) <= 2);
      if (landmark) return hint(landmark.name + ' · 已记入本层行迹图');
      return hint(room === 'aqueduct' ? '在水渠间寻找下行阶梯 · M 查看行迹' : '沿冰脉寻找封印殿入口 · M 查看行迹');
    }
    if (location.fortressRoom === 'sluice') {
      if (distance(location, fortressDial) <= 1) return hint(dialAwake ? '青铜潮盘已对齐 · 水流沿着石槽汇入下层' : '互动 · 转动嵌在石道里的青铜潮盘');
      if (distance(location, { x: 8, y: 3 }) <= 1) return hint('互动 · 下行至回流水渠');
      if (distance(location, { x: 8, y: 17 }) <= 1) return hint('向北穿过柱廊 · 在此互动可返回西栈桥');
      return hint('沿湿石通道向北，尽头的阶梯通往回流水渠');
    }
    if (location.fortressRoom === 'seal') {
      if (distance(location, { x: 8, y: 11 }) <= 1) return hint('互动 · 观察能量罩中的酋雷姆');
      if (distance(location, { x: 8, y: 18 }) <= 1) return hint('向北走上观测桥 · 在此互动可返回陵廊');
      return hint('向北沿观测桥靠近封印 · 留意能量罩上的波纹');
    }
    if (overview) return hint('拖动环视 · 点击街道进入');
    if (walkingTo) return hint(`步行前往${walkingTo.name} · 手动移动可中断`);
    if (atWinch()) return hint(fortress.phase === 'open' ? '互动 · 进入潜航堡垒' : '互动 · 转动西栈桥升降轮');
    const actor = nearby();
    if (actor) {
      const room = entrance(actor.event);
      return hint(room ? `进入${rooms[room].name}` : `与${actor.name}交谈`);
    }
    const map = mapAt(location);
    if (location.room) return hint('与室内人物交谈，或从南侧门口离开。');
    const stop = location.area === 'harbor' && surveyAt(location);
    if (stop) return hint(`观察${stop.subject} · 互动记录街区手记`);
    const guide = map.npcs.find(npc => npc.event === 'guide');
    if (guide && !guideMet && distance(guide, location, map.wrapX) === 2) return hint(`沿环城大道去找${guide.name}`);
    const exit = map.exits.find(gate => (gate.side === 'bottom' ? 'down' : gate.side) === facing && distance(gate, location, map.wrapX) <= 3);
    if (exit) return hint(exit.side === 'bottom' ? `沿渡口栈桥前往${fieldAreas[exit.to.area].name}` :
      `继续向${exit.side === 'left' ? '西' : '东'}前进，抵达${fieldAreas[exit.to.area].name}`);
    if (rustle && distance(location, rustle, map.wrapX) <= 7) return hint('附近有一簇草在晃动，走进去看看。');
    if (map.grass[location.y]?.[location.x]) return hint('高草中有动静，继续探索');
    hint(fieldAreas[location.area].description);
  }

  function stopRouting() {
    path = [];
    onArrival = undefined;
    walkingTo = undefined;
  }

  function clearInput() {
    streetInput = undefined;
    pressed.clear();
    shiftPressed = false;
    held = null;
    queued = null;
    interactQueued = false;
  }

  function setOverview(value: boolean) {
    if (overview === value) return;
    overview = value;
    if (value) {
      clearInput();
      stopRouting();
    } else {
      clearOrbitGesture();
    }
    refreshHint();
    options.onOverview?.(value);
  }

  function switchArea(to: FieldLocation, time: number) {
    clearInput();
    if (inspectingSeal) { inspectingSeal = false; options.onFortressView(fortress, false); }
    setOverview(false);
    stopRouting();
    queued = null;
    interactQueued = false;
    step = undefined;
    trail = undefined;
    quietSeal(time);
    gateStarted = -Infinity;
    location = { ...to };
    renderer.resetCamera();
    grassSteps = 0;
    strides = 0;
    rustle = undefined;
    fadedAt = time;
    pumpStarted = -Infinity;
    options.onSound?.('area');
    options.onLocation({ ...location });
    refreshHint();
  }

  function beginStep(direction: Direction, time: number) {
    facing = direction;
    const map = mapAt(location);
    const target = neighbor(location, direction, map.wrapX);
    if (!walkable(target, map)) {
      refreshHint();
      return;
    }
    const sprint = running || shiftPressed;
    const baseline = sprint ? runDuration : walkDuration;
    const acrossQuay = map.wrapX && target.x !== location.x && location.y > 18;
    const distance = acrossQuay ? Math.min(1.46, Math.sqrt(ringRadius(ringStreetRow(location.y)) / ringRadius(12))) : 1;
    step = { from: location, to: target, startedAt: time, duration: baseline * distance, running: sprint };
  }

  function searchGrass(map: FieldMap, time: number) {
    if (rustle || location.room || location.fortressRoom || ++strides < 12) return;
    strides = 0;
    const candidates: TilePoint[] = [];
    for (let y = Math.max(0, location.y - 7); y <= Math.min(map.height - 1, location.y + 7); y++) {
      for (let column = location.x - 7; column <= location.x + 7; column++) {
        const x = map.wrapX ? wrapRingX(column) : column;
        if (!map.grass[y]?.[x]) continue;
        const point = { x, y };
        const range = distance(location, point, map.wrapX);
        if (range >= 3 && range <= 7 && walkable(point, map)) candidates.push(point);
      }
    }
    const target = findPath(location, candidates, map)?.at(-1);
    if (target) rustle = { ...target, expires: time + 18_000 };
  }

  function encounter(kind: EncounterKind) {
    grassSteps = 0;
    encounterAfter = 4 + Math.floor(Math.random() * 5);
    if (kind === 'rustle') rustle = undefined;
    stopRouting();
    clearInput();
    options.onSound?.('encounter');
    options.onEncounter(location.area, kind);
  }

  function finishStep(time: number) {
    if (!step) return;
    trail = step.from;
    location = { ...location, ...step.to };
    step = undefined;
    const map = mapAt(location);
    const exit = map.exits.find(gate => sameTile(gate, location));
    if (exit) {
      switchArea(exit.to, time);
      return;
    }
    options.onLocation({ ...location });
    const grass = map.grass[location.y]?.[location.x];
    if (rustle && time < rustle.expires && sameTile(rustle, location)) {
      encounter('rustle');
      return;
    }
    if (grass && ++grassSteps >= encounterAfter) {
      encounter('grass');
      return;
    }
    if (!grass) searchGrass(map, time);
    refreshHint();
    if (interactQueued) {
      interactQueued = false;
      if (interactNearby()) return;
    }
    if (!path.length && onArrival) {
      const callback = onArrival;
      onArrival = undefined;
      callback();
    }
  }

  function talk(actor: Actor) {
    const { wrapX } = mapAt(location);
    if (paused || distance(actor, location, wrapX) > 1) return;
    setOverview(false);
    if (actor.event === 'guide') guideMet = true;
    facing = sameTile(location, actor) ? facing : directionTo(location, actor, wrapX);
    stopRouting();
    clearInput();
    refreshHint();
    options.onSound?.('interact');
    const room = entrance(actor.event);
    if (room) {
      facing = 'up';
      switchArea({ area: location.area, room, ...rooms[room].map.spawn }, performance.now());
      return;
    }
    options.onEvent(actor.event);
  }

  function interact() {
    if (paused || liftRide || fortress.cinematic) return;
    if (step) {
      interactQueued = true;
      return;
    }
    if (!interactNearby()) refreshHint();
  }

  function soundTideDial() {
    if (paused || location.fortressRoom !== 'sluice' || distance(location, fortressDial) > 1) return;
    stopRouting();
    clearInput();
    if (!dialAwake) {
      dialAwake = true;
      dialStarted = performance.now();
      options.onDialAwake();
    }
    options.onSound?.('tideDial');
    refreshHint();
  }

  function approachTideDial() {
    if (paused || location.fortressRoom !== 'sluice') return;
    if (!step && distance(location, fortressDial) <= 1) soundTideDial();
    else route([fortressDial], soundTideDial);
  }

  function interactNearby() {
    const floor = location.fortressRoom;
    if (floor) {
      const stairs = fortressRooms[floor];
      if (atLift() && shortcuts.includes('catacomb')) { startLift(); return true; }
      if (isMazeRoom(floor) && distance(location, mazeFloors[floor].switch) <= 1) {
        if (!shortcuts.includes(floor)) {
          shortcuts.push(floor);
          gateStarted = performance.now();
          options.onShortcut(floor);
          options.onSound?.(floor === 'aqueduct' ? 'bridge' : 'iceGate');
        }
        stopRouting();
        clearInput();
        refreshHint();
      } else if (floor === 'sluice' && distance(location, fortressDial) <= 1) {
        soundTideDial();
      } else if (floor === 'seal' && (inspectingSeal || distance(location, stairs.down) <= 1)) {
        inspectingSeal = !inspectingSeal;
        facing = 'up';
        stopRouting();
        clearInput();
        if (inspectingSeal) {
          options.onSound?.('seal');
          startRoar(performance.now());
        } else quietSeal(performance.now());
        options.onFortressView(fortress, inspectingSeal);
        refreshHint();
      } else if (distance(location, stairs.down) <= 1) {
        descend();
      } else if (distance(location, stairs.up) <= 1) {
        ascend();
      } else return false;
      return true;
    }
    if (atWinch()) {
      if (fortress.phase === 'open') {
        facing = 'up';
        switchArea({ area: 'harbor', fortressRoom: 'sluice', ...fortressMaps.sluice.spawn }, performance.now());
      } else launchFortress();
      return true;
    }
    const actor = nearby();
    if (actor) { talk(actor); return true; }
    const site = location.area === 'harbor' && !location.room && surveyAt(location);
    if (!site) return false;
    setOverview(false);
    surveyFocus = site;
    renderer.resetCamera();
    const dx = site.position.x - (location.x + .5);
    const dy = site.position.y - (location.y + .5);
    facing = Math.abs(dx) >= Math.abs(dy) ? dx > 0 ? 'right' : 'left' : dy > 0 ? 'down' : 'up';
    stopRouting();
    clearInput();
    refreshHint();
    if (site.survey === 'wharf') pumpStarted = performance.now();
    options.onSound?.('interact');
    options.onSurvey(site.survey);
    return true;
  }

  function move(direction: Direction) {
    if (paused || liftRide || fortress.cinematic || inspectingSeal) return;
    setOverview(false);
    stopRouting();
    if (step || performance.now() - fadedAt < (reducedMotion.matches ? 0 : fieldFadeDuration)) queued = direction;
    else beginStep(direction, performance.now());
  }

  function streetDirection(direction: Direction): Direction {
    if (overview || location.area !== 'harbor' || location.room || location.fortressRoom) return direction;
    const axis = direction === 'left' || direction === 'right' ? 'x' : 'y';
    const projection = renderer.streetAxisProjection(location.x, location.y, axis);
    const flipped = projection !== undefined && Math.abs(projection) > .0008
      ? projection < 0 : renderer.lastUsableAxis(axis) ?? ringStreetLooksOutward(location.x, location.y);
    const time = performance.now();
    // A repeated tap can straddle the least legible part of a camera turn.
    const repeat = streetInput?.screen === direction && time - streetInput.at < 410 ? streetInput : undefined;
    const travel = repeat && projection !== undefined && Math.abs(projection) < streetAxisMinSpan
      ? repeat.travel : flipped ? opposite[direction] : direction;
    streetInput = { screen: direction, travel, at: time };
    return travel;
  }

  function hold(direction: Direction | null) {
    if (paused) return;
    held = direction && streetDirection(direction);
    if (held) move(held);
  }

  function startRoute(next: TilePoint[], callback?: () => void, stop?: CityStop) {
    setOverview(false);
    clearInput();
    walkingTo = stop;
    path = next;
    onArrival = callback;
    refreshHint();
    if (!step && path.length === 0) {
      onArrival = undefined;
      callback?.();
    }
    return true;
  }

  function route(targets: TilePoint[], callback?: () => void) {
    const map = mapAt(location);
    const next = findPath(step?.to ?? location, targets.filter(point => walkable(point, map)), map);
    return next !== undefined && startRoute(next, callback);
  }

  function walkToStop(stop: CityStop, inspect = false) {
    if (paused || liftRide || fortress.cinematic) return false;
    const next = planCityWalk({ ...location, ...step?.to }, stop);
    return next !== undefined && startRoute(next, () => {
      walkingTo = undefined;
      if (!inspect || !interactNearby()) refreshHint();
    }, stop);
  }

  function tapField(event: PointerEvent) {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const screenX = (event.clientX - rect.left) * canvas.width / rect.width;
    const screenY = (event.clientY - rect.top) * canvas.height / rect.height;
    const actor = renderer.hitActor(screenX, screenY, mapAt(location).npcs, npc => Boolean(entrance(npc.event)));
    if (actor) {
      route(stepDirections.map(direction => neighbor(actor, direction, mapAt(location).wrapX)), () => talk(actor));
      return;
    }
    if (location.area === 'harbor' && !location.room && !location.fortressRoom) {
      const survey = renderer.hitSurvey(screenX, screenY);
      if (survey) {
        const stop = surveyStops.find(candidate => candidate.survey === survey);
        if (stop && walkToStop(stop, true)) return;
      }
    }
    const point = renderer.pointInWorld(screenX, screenY);
    if (point && (location.fortressRoom === 'sluice' || location.fortressRoom === 'catacomb')) {
      const stop = fortressLiftStops[location.fortressRoom];
      if (Math.floor(point.x / TILE) === stop.x && Math.floor(point.y / TILE) === stop.y && shortcuts.includes('catacomb')) {
        route([stop], startLift);
        return;
      }
    }
    if (point && isMazeRoom(location.fortressRoom)) {
      const tile = { x: Math.floor(point.x / TILE), y: Math.floor(point.y / TILE) };
      const plan = mazeFloors[location.fortressRoom];
      if ([plan.switch, plan.up, plan.down].some(landmark => sameTile(tile, landmark))) {
        route([tile], interact);
        return;
      }
    }
    if (point && location.fortressRoom === 'sluice' && Math.floor(point.x / TILE) === fortressDial.x && Math.floor(point.y / TILE) === fortressDial.y) {
      approachTideDial();
      return;
    }
    if (!point || !route([{ x: Math.floor(point.x / TILE), y: Math.floor(point.y / TILE) }])) hint('这里无法通行，请沿路探索');
  }

  function pointerDown(event: PointerEvent) {
    if (event.button !== 0 || !event.isPrimary || paused || liftRide || fortress.cinematic || inspectingSeal || !reducedMotion.matches && performance.now() - fadedAt < fieldFadeDuration) return;
    parent.focus({ preventScroll: true });
    if (!overview) return tapField(event);
    orbitGesture = { id: event.pointerId, startX: event.clientX, startY: event.clientY, offset: orbitOffset, tilt: orbitTilt, moved: false };
    canvas.setPointerCapture(event.pointerId);
  }

  function pointerMove(event: PointerEvent) {
    if (!orbitGesture || event.pointerId !== orbitGesture.id) return;
    const dx = event.clientX - orbitGesture.startX;
    const dy = event.clientY - orbitGesture.startY;
    orbitGesture.moved ||= Math.hypot(dx, dy) >= 6;
    if (orbitGesture.moved) {
      orbitOffset = (orbitGesture.offset - dx * Math.PI * 1.35 / Math.max(240, canvas.clientWidth)) % (Math.PI * 2);
      orbitTilt = Math.max(-.25, Math.min(.32, orbitGesture.tilt + dy * .83 / Math.max(180, canvas.clientHeight)));
      refreshHint();
    }
  }

  function clearOrbitGesture() {
    if (!orbitGesture) return;
    const { id } = orbitGesture;
    orbitGesture = undefined;
    if (canvas.hasPointerCapture(id)) canvas.releasePointerCapture(id);
  }

  function pointerEnd(event: PointerEvent) {
    if (!orbitGesture || event.pointerId !== orbitGesture.id) return;
    const tap = !orbitGesture.moved && event.type === 'pointerup';
    clearOrbitGesture();
    if (tap && overview && !paused) tapField(event);
  }

  function keyDown(event: KeyboardEvent) {
    if (paused || liftRide || fortress.cinematic || event.ctrlKey || event.metaKey || event.altKey || event.target !== parent) return;
    shiftPressed = event.shiftKey;
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    const direction = keys[key];
    if (direction) {
      event.preventDefault();
      if (!event.repeat && !pressed.has(key)) {
        const travel = streetDirection(direction);
        pressed.set(key, travel);
        move(travel);
      }
    } else if (key === 'e' || key === ' ' || key === 'Enter') {
      event.preventDefault();
      if (!event.repeat) interact();
    }
  }

  function keyUp(event: KeyboardEvent) {
    if (event.key === 'Shift') shiftPressed = false;
    pressed.delete(event.key.length === 1 ? event.key.toLowerCase() : event.key);
  }

  function visibilityChanged() {
    if (document.hidden) {
      clearInput();
      if (location.fortressRoom === 'seal') quietSeal(performance.now());
    } else renderer.resetCamera();
  }

  function resize() {
    const { width, height } = parent.getBoundingClientRect();
    renderer.resize(width, height);
  }

  function setCompanion(id: CreatureId | null) {
    companion = id;
    if (!id || creatureArt.has(id) || pendingArt.has(id)) return;
    pendingArt.add(id);
    void loadCreatureSprite(id).then(sprite => {
      if (!wasDestroyed) creatureArt.set(id, sprite);
    }).catch(() => {}).finally(() => { pendingArt.delete(id); });
  }

  function draw(time: number) {
    const activeNpc = nearby();
    const map = mapAt(location);
    renderer.draw(time, {
      location, map, overview, orbitOffset, orbitTilt, facing, step, trail, rustle, path, activeNpc, surveyFocus, fortress, inspectingSeal,
      liftUnlocked: shortcuts.includes('catacomb'),
      liftPassage: liftRide ? { down: liftRide.down, fraction: Math.min(1, Math.max(0, (time - liftRide.started) / liftRide.duration)) } : undefined,
      shortcutOpen: isMazeRoom(location.fortressRoom) && shortcuts.includes(location.fortressRoom),
      gateAge: (time - gateStarted) / 1000, roarAge: (time - roarStarted) / 1000,
      resonance: dialAwake ? reducedMotion.matches ? 1 : Math.min(1, Math.max(0, (time - dialStarted) / 2700)) : 0,
      pumpElapsed: time - pumpStarted < 3600 ? (reducedMotion.matches ? 1 : Math.max(0, time - pumpStarted) / 1000) : undefined,
      activeNpcFacing: activeNpc && !sameTile(activeNpc, location) ? directionTo(activeNpc, location, map.wrapX) : undefined,
      companionImage: companion ? creatureArt.get(companion) : undefined, companionId: companion ?? undefined, sylveon, night, beaconLit, fadedAt,
    });
  }

  function landStep(time: number) {
    if (!step || time - step.startedAt < step.duration * .43 || lastFootfall === step.startedAt) return;
    lastFootfall = step.startedAt;
    if (isMazeRoom(location.fortressRoom)) {
      const room = location.fortressRoom, tile = mazeFloors[room].tiles[step.to.y][step.to.x];
      const surface: Footing = tile === 'bridge' ? 'timber' : tile === 'grate' || tile === 'gate' ? 'iron' : tile === 'ice' ? 'ice' : room === 'aqueduct' ? 'wet' : 'stone';
      options.onSound?.('step', surface);
      return;
    }
    if (location.fortressRoom) { options.onSound?.('step', location.fortressRoom === 'seal' ? 'ice' : 'wet'); return; }
    if (location.room) {
      options.onSound?.('step', location.room === 'home' ? 'timber' : 'tile');
      return;
    }
    const tile = tileAt(location.area, step.to.x, step.to.y);
    const footing: Footing = tile === 'dock' ? 'timber' :
      tile === 'grass' || tile === 'lawn' ? 'grass' : tile === 'path' || tile === 'shore' ? 'earth' : 'stone';
    options.onSound?.('step', footing);
  }

  function tick(time: number) {
    if (wasDestroyed) return;
    updateFortress();
    updateRoar(time);
    updateLift(time);
    if (rustle && time >= rustle.expires) {
      rustle = undefined;
      refreshHint();
    }
    if (!paused && !liftRide && !fortress.cinematic && !inspectingSeal) {
      landStep(time);
      if (step && time - step.startedAt >= step.duration) finishStep(time);
      if (!step && time - fadedAt >= (reducedMotion.matches ? 0 : fieldFadeDuration)) {
        const manual = queued ?? held ?? Array.from(pressed.values()).at(-1);
        queued = null;
        if (manual) beginStep(manual, time);
        else {
          const next = path.shift();
          if (next) beginStep(directionTo(location, next, mapAt(location).wrapX), time);
        }
      }
    }
    if (onScreen && !covered) draw(time);
    frame = requestAnimationFrame(tick);
  }

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(parent);
  const intersection = new IntersectionObserver(([entry]) => {
    onScreen = entry.isIntersecting;
    if (!onScreen && location.fortressRoom === 'seal') quietSeal(performance.now());
    if (onScreen) renderer.resetCamera();
  }, { rootMargin: '70px' });
  intersection.observe(parent);
  resize();
  parent.addEventListener('keydown', keyDown);
  parent.addEventListener('blur', clearInput);
  window.addEventListener('keyup', keyUp);
  window.addEventListener('blur', clearInput);
  document.addEventListener('visibilitychange', visibilityChanged);
  canvas.addEventListener('pointerdown', pointerDown);
  canvas.addEventListener('pointermove', pointerMove);
  canvas.addEventListener('pointerup', pointerEnd);
  canvas.addEventListener('pointercancel', pointerEnd);
  canvas.addEventListener('lostpointercapture', pointerEnd);
  const controls: FieldControls = {
    move: direction => move(streetDirection(direction)), hold, interact,
    setPaused(value) {
      if (value && !paused && location.fortressRoom === 'seal') quietSeal(performance.now());
      paused = value;
      if (!value && surveyFocus) {
        surveyFocus = undefined;
        renderer.resetCamera();
      }
      if (value) {
        clearOrbitGesture();
        stopRouting();
        clearInput();
        step = undefined;
        refreshHint();
      }
    },
    setCompanion,
    setRunning(value) { running = value; },
    setNight(value) { night = value; },
    setOverview(value) { if (!paused && !fortress.cinematic && location.area === 'harbor' && !location.room && !location.fortressRoom) setOverview(value); },
    setBeaconLit(value) { beaconLit = value; },
    setCovered(value) {
      if (covered && !value) renderer.resetCamera();
      covered = value;
    },
    walkToStop,
    rideFortressLift: startLift,
    approachTideDial,
    walkRecorded(point, walked) {
      const floor = location.fortressRoom;
      if (paused || !isMazeRoom(floor)) return false;
      const source = step?.to ?? location;
      const known = knownWalkway(floor, source, point, walked, shortcuts.includes(floor));
      if (!known) return false;
      const path = findPath(source, [point], known);
      return path !== undefined && startRoute(path);
    },
    callKyurem() {
      if (paused || location.fortressRoom !== 'seal' || !inspectingSeal) return false;
      const time = performance.now();
      if (time - lastCall < kyuremTiming.decay * 1000) return false;
      lastCall = time;
      options.onCryStop();
      startRoar(time);
      return true;
    },
    approachFortress() {
      if (paused || liftRide || fortress.cinematic || location.area !== 'harbor' || location.room) return;
      if (location.fortressRoom) {
        if (isMazeRoom(location.fortressRoom)) { interact(); return; }
        const point = fortressRooms[location.fortressRoom].down;
        if (inspectingSeal || distance(location, point) <= 1) interact();
        else route([point], interact);
      } else if (atWinch()) interact();
      else walkToStop(cityStops.find(stop => stop.id === 'fortress')!);
    },
    replayFortress() {
      if (atWinch() && !paused && !fortress.cinematic && fortress.phase === 'open') launchFortress();
    },
    travel(area) {
      if (paused || liftRide || fortress.cinematic || (!location.room && !location.fortressRoom && area === location.area && sameTile(location, maps[area].spawn))) return;
      clearInput();
      switchArea({ area, ...maps[area].spawn }, performance.now());
    },
    leaveRoom() {
      if (liftRide) return;
      if (!paused && location.fortressRoom) {
        const floor = location.fortressRoom;
        if (!isMazeRoom(floor) || distance(location, fortressRooms[floor].up) <= 1 && !step) return ascend();
        route([fortressRooms[floor].up], ascend);
        return;
      }
      if (paused || !location.room) return;
      const gate = rooms[location.room].map.exits[0];
      clearInput();
      facing = 'down';
      switchArea(gate.to, performance.now());
    },
    getLocation: () => ({ ...location }),
    destroy() {
      wasDestroyed = true;
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      intersection.disconnect();
      parent.removeEventListener('keydown', keyDown);
      parent.removeEventListener('blur', clearInput);
      window.removeEventListener('keyup', keyUp);
      window.removeEventListener('blur', clearInput);
      document.removeEventListener('visibilitychange', visibilityChanged);
      canvas.removeEventListener('pointerdown', pointerDown);
      canvas.removeEventListener('pointermove', pointerMove);
      canvas.removeEventListener('pointerup', pointerEnd);
      canvas.removeEventListener('pointercancel', pointerEnd);
      canvas.removeEventListener('lostpointercapture', pointerEnd);
      renderer.destroy();
      canvas.remove();
      if (import.meta.env.DEV && debugWindow.__field === diagnostics) delete debugWindow.__field;
    },
  };
  const diagnostics = {
    getLocation: controls.getLocation,
    getMap: () => mapAt(location),
    getCamera: renderer.getCamera,
    projectPoint: renderer.projectPoint,
    getRustle: () => rustle ? { x: rustle.x, y: rustle.y } : null,
    isMoving: () => Boolean(step),
  };
  const debugWindow = window as Window & { __field?: typeof diagnostics };
  if (import.meta.env.DEV) debugWindow.__field = diagnostics;
  options.onOverview?.(overview);
  updateFortress();
  options.onFortressView(fortress, inspectingSeal);
  options.onLocation({ ...location });
  void loadSprite(`${import.meta.env.BASE_URL}assets/sylveon.png`).then(image => {
    if (!wasDestroyed) sylveon = image;
  }).catch(() => {});
  refreshHint();
  draw(performance.now());
  frame = requestAnimationFrame(tick);
  return controls;
}
