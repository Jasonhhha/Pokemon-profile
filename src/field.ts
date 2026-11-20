import { loadCreatureSprite, loadSprite } from './creature-art';
import type { CreatureId } from './creatures';
import { maps, TILE, type FieldMap } from './field-art';
import type { FieldArea, FieldEvent, FieldLocation, RoomId } from './field-art';
import { rooms } from './field-rooms';
import { cityObstacles } from './field-city-layout';
import { ringXDelta, wrapRingX } from './field-ring-coordinates';
import { tileAt } from './field-layout';
import type { Footing } from './sound';
import { createFieldPresentation } from './field-presentation';
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
  onLocation: (location: FieldLocation) => void;
  onHint: (hint: string) => void;
  onEvent: (event: FieldEvent) => void;
  onEncounter: (area: FieldArea, kind: EncounterKind) => void;
  onReady?: () => void;
  onOverview?: (active: boolean) => void;
  onSound?: (sound: 'step' | 'interact' | 'area' | 'encounter', surface?: Footing) => void;
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
const mapAt = (location: FieldLocation) => location.room ? rooms[location.room].map : maps[location.area];

function findPath(start: TilePoint, targets: TilePoint[], map: FieldMap): TilePoint[] | undefined {
  if (!targets.length) return;
  const queue = [start];
  const index = (point: TilePoint) => point.y * map.width + point.x;
  const goals = new Set(targets.map(index));
  const previous = new Map<number, TilePoint | null>([[index(start), null]]);
  for (let head = 0; head < queue.length; head++) {
    const point = queue[head];
    if (goals.has(index(point))) {
      const path: TilePoint[] = [];
      let current = point;
      let parent = previous.get(index(current));
      while (parent) {
        path.unshift(current);
        current = parent;
        parent = previous.get(index(current));
      }
      return path;
    }
    for (const direction of stepDirections) {
      const next = neighbor(point, direction, map.wrapX);
      if (walkable(next, map) && !previous.has(index(next))) {
        if (map.exits.some(exit => sameTile(exit, next)) && !goals.has(index(next))) continue;
        previous.set(index(next), point);
        queue.push(next);
      }
    }
  }
}

function initialLocation(initial?: FieldLocation): FieldLocation {
  if (initial && Object.hasOwn(maps, initial.area)) {
    const validRoom = !initial.room || Object.hasOwn(rooms, initial.room) && rooms[initial.room].area === initial.area;
    if (validRoom && walkable(initial, mapAt(initial))) return { ...initial };
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
  let location = initialLocation(options.initial);
  let facing: Direction = 'down';
  let held: Direction | null = null;
  let queued: Direction | null = null;
  let path: TilePoint[] = [];
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
  let overview = location.area === 'harbor' && !location.room;
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

  function refreshHint() {
    if (overview) return hint('拖动环视 · 点击街道进入');
    const actor = nearby();
    if (actor) {
      const room = entrance(actor.event);
      return hint(room ? `进入${rooms[room].name}` : `与${actor.name}交谈`);
    }
    const map = mapAt(location);
    if (location.room) return hint('与室内人物交谈，或从南侧门口离开。');
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
  }

  function clearInput() {
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
    setOverview(false);
    stopRouting();
    queued = null;
    interactQueued = false;
    step = undefined;
    trail = undefined;
    location = { ...to };
    renderer.resetCamera();
    grassSteps = 0;
    strides = 0;
    rustle = undefined;
    fadedAt = time;
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
    step = { from: location, to: target, startedAt: time, duration: sprint ? runDuration : walkDuration, running: sprint };
  }

  function searchGrass(map: FieldMap, time: number) {
    if (rustle || location.room || ++strides < 12) return;
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
      const actor = nearby();
      if (actor) {
        talk(actor);
        return;
      }
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
    if (paused) return;
    if (step) {
      interactQueued = true;
      return;
    }
    const actor = nearby();
    if (actor) talk(actor);
    else refreshHint();
  }

  function move(direction: Direction) {
    if (paused) return;
    setOverview(false);
    stopRouting();
    if (step || performance.now() - fadedAt < (reducedMotion.matches ? 0 : fieldFadeDuration)) queued = direction;
    else beginStep(direction, performance.now());
  }

  function hold(direction: Direction | null) {
    if (paused) return;
    held = direction;
    if (direction) move(direction);
  }

  function route(targets: TilePoint[], callback?: () => void) {
    const map = mapAt(location);
    const next = findPath(step?.to ?? location, targets.filter(point => walkable(point, map)), map);
    if (!next) return false;
    setOverview(false);
    clearInput();
    path = next;
    onArrival = callback;
    if (!step && path.length === 0) {
      onArrival = undefined;
      callback?.();
    }
    return true;
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
    const point = renderer.pointInWorld(screenX, screenY);
    if (!point || !route([{ x: Math.floor(point.x / TILE), y: Math.floor(point.y / TILE) }])) hint('这里无法通行，请沿路探索');
  }

  function pointerDown(event: PointerEvent) {
    if (event.button !== 0 || !event.isPrimary || paused || !reducedMotion.matches && performance.now() - fadedAt < fieldFadeDuration) return;
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
    if (paused || event.ctrlKey || event.metaKey || event.altKey || event.target !== parent) return;
    shiftPressed = event.shiftKey;
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    const direction = keys[key];
    if (direction) {
      event.preventDefault();
      if (!event.repeat && !pressed.has(key)) {
        pressed.set(key, direction);
        move(direction);
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
    if (document.hidden) clearInput();
    else renderer.resetCamera();
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
      location, map, overview, orbitOffset, orbitTilt, facing, step, trail, rustle, path, activeNpc,
      activeNpcFacing: activeNpc && !sameTile(activeNpc, location) ? directionTo(activeNpc, location, map.wrapX) : undefined,
      companionImage: companion ? creatureArt.get(companion) : undefined, companionId: companion ?? undefined, sylveon, night, beaconLit, fadedAt,
    });
  }

  function landStep(time: number) {
    if (!step || time - step.startedAt < step.duration * .43 || lastFootfall === step.startedAt) return;
    lastFootfall = step.startedAt;
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
    if (rustle && time >= rustle.expires) {
      rustle = undefined;
      refreshHint();
    }
    if (!paused) {
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
    move, hold, interact,
    setPaused(value) {
      paused = value;
      if (value) {
        clearOrbitGesture();
        stopRouting();
        clearInput();
        step = undefined;
      }
    },
    setCompanion,
    setRunning(value) { running = value; },
    setNight(value) { night = value; },
    setOverview(value) { if (!paused && location.area === 'harbor' && !location.room) setOverview(value); },
    setBeaconLit(value) { beaconLit = value; },
    setCovered(value) {
      if (covered && !value) renderer.resetCamera();
      covered = value;
    },
    travel(area) {
      if (paused || (!location.room && area === location.area && sameTile(location, maps[area].spawn))) return;
      clearInput();
      switchArea({ area, ...maps[area].spawn }, performance.now());
    },
    leaveRoom() {
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
  options.onLocation({ ...location });
  void loadSprite(`${import.meta.env.BASE_URL}assets/sylveon.png`).then(image => {
    if (!wasDestroyed) sylveon = image;
  }).catch(() => {});
  refreshHint();
  draw(performance.now());
  frame = requestAnimationFrame(tick);
  return controls;
}
