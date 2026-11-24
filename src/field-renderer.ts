import { drawFieldActor } from './field-actors';
import { TILE, type FieldLocation, type FieldMap, type RoomId } from './field-layout';
import { drawRoomEffects, makeRoomArt } from './field-rooms';
import { RING_PERIOD, ringRadius, ringStreetRow, ringXDelta, wrapRingX } from './field-ring-coordinates';
import type { Direction, WalkStep } from './field';
import type { CreatureId } from './creatures';
import type { CityStop } from './field-city-walks';
import type { FortressView } from './field-fortress-state';
import type { GridReading } from './fortress-power';
import type { WardSurvey } from './fortress-ward-service';

type Point = { x: number; y: number };
type SceneArt = ReturnType<typeof makeRoomArt>;

export type FieldView = {
  location: FieldLocation;
  fortress: FortressView;
  inspectingSeal: boolean;
  resonance: number;
  power?: GridReading;
  shortcutOpen: boolean;
  liftUnlocked: boolean;
  liftPassage?: { down: boolean; fraction: number };
  gateAge: number;
  roarAge: number;
  ward?: WardSurvey;
  wardAdjustmentAge?: number;
  wardSettledAge?: number;
  overview: boolean;
  orbitOffset: number;
  orbitTilt: number;
  map: FieldMap;
  facing: Direction;
  step?: WalkStep;
  trail?: Point;
  rustle?: Point;
  path: readonly Point[];
  activeNpc?: FieldMap['npcs'][number];
  activeNpcFacing?: Direction;
  companionImage?: HTMLCanvasElement;
  companionId?: CreatureId;
  sylveon?: HTMLCanvasElement;
  night: boolean;
  beaconLit: boolean;
  pumpElapsed?: number;
  surveyFocus?: CityStop;
  fadedAt: number;
};

export const fieldFadeDuration = 240;

const offsets: Record<Direction, Point> = {
  up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 },
};

export const feetX = (x: number) => x * TILE + TILE / 2;
export const feetY = (y: number) => y * TILE + TILE - 2;

function ringWalkLength(from: Point, to: Point) {
  const inner = ringRadius(ringStreetRow(from.y)), outer = ringRadius(ringStreetRow(to.y));
  const across = ringXDelta(from.x, to.x) * (Math.PI * (inner + outer)) / RING_PERIOD;
  return Math.hypot(across, outer - inner);
}

function ringWalkPosition(from: Point, to: Point, fraction: number): Point {
  return {
    x: from.x + ringXDelta(from.x, to.x) * fraction,
    y: from.y + (to.y - from.y) * fraction,
  };
}

export function companionPosition({ location, trail, step, map, companionId }: FieldView, progress: number) {
  const tileUnderFeet = (x: number, y: number) => {
    const column = Math.floor(x + .5);
    return { x: map.wrapX ? wrapRingX(column) : column, y: Math.floor(map.wrapX ? ringStreetRow(y) : y + .875) };
  };
  const freeTile = ({ x, y }: Point) => map.walkable[y]?.[x] && !map.npcs.some(npc => npc.solid && npc.x === x && npc.y === y);
  const startingPoint = () => {
    for (const [dx, dy] of [[-.78, .04], [.78, .04], [0, -.88], [0, .71]]) {
      const point = { x: location.x + dx, y: location.y + dy };
      if (freeTile(tileUnderFeet(point.x, point.y))) return point;
    }
    return { x: location.x - .32, y: location.y - .38 };
  };
  const previous = trail ?? startingPoint();
  const origin = trail ?? tileUnderFeet(previous.x, previous.y);
  const passing = step && origin.x === step.to.x && origin.y === step.to.y;
  let point: Point;
  if (map.wrapX) {
    const spacing = companionId === 'drifloon' ? 1.34 : 1.05;
    const previousLength = ringWalkLength(previous, location);
    const tail = Math.min(spacing, previousLength);
    const start = ringWalkPosition(previous, location, 1 - tail / Math.max(.001, previousLength));
    if (!step) return { ...start, passing: 0 };
    const nextLength = ringWalkLength(location, step.to);
    const lead = Math.max(0, nextLength - spacing);
    const end = ringWalkPosition(location, step.to, lead / Math.max(.001, nextLength));
    if (passing) {
      point = ringWalkPosition(start, end, progress);
    } else {
      // Follow both street segments so starts, corners, and stops share the same resting spot.
      const distance = (tail + lead) * progress;
      point = distance <= tail
        ? ringWalkPosition(start, location, distance / Math.max(.001, tail))
        : ringWalkPosition(location, end, (distance - tail) / lead);
    }
  } else {
    point = { x: previous.x + (location.x - previous.x) * progress, y: previous.y + (location.y - previous.y) * progress };
  }
  if (!passing) return { ...point, passing: 0 };

  const roomBeside = (dx: number, dy: number) => [origin, location].every(point => {
    const column = map.wrapX ? wrapRingX(point.x + dx) : point.x + dx;
    return freeTile({ x: column, y: point.y + dy });
  });
  const dodge = Math.sin(progress * Math.PI) ** 1.15;
  // The companion keeps to the pavement as it yields to a trainer doubling back.
  if (origin.x !== location.x || !map.wrapX && previous.x !== location.x) {
    const openOutside = roomBeside(0, 1);
    const outside = map.wrapX ? (companionId === 'drifloon' ? 1.08 : .93) : .54;
    const side = openOutside ? outside : roomBeside(0, -1) ? -.70 : map.wrapX ? -.39 : -.58;
    return { x: point.x, y: point.y + side * dodge, passing: dodge };
  }
  const side = roomBeside(1, 0) || !roomBeside(-1, 0) ? 1 : -1;
  return { x: point.x + (map.wrapX ? .39 : .45) * dodge * side, y: point.y, passing: dodge };
}

export function createFieldRenderer(canvas: HTMLCanvasElement, reducedMotion: MediaQueryList) {
  const display = canvas.getContext('2d', { alpha: false });
  const scene = document.createElement('canvas');
  const context = scene.getContext('2d', { alpha: false });
  if (!display || !context) throw new Error('无法初始化地图画布');
  const mapArt = new Map<string, SceneArt>();
  const pixels = new WeakMap<HTMLCanvasElement, Uint8ClampedArray>();
  const actorImages = new Map<string, HTMLCanvasElement>();
  let visibleProps: SceneArt['foreground'] = [];
  let currentView: FieldView | undefined;
  let markerOffset = 0;
  let camera = { x: 0, y: 0, scale: 1, depth: 0 };
  let cameraTime = 0;
  let cameraAim = { x: 0, y: 0 };

  function resize(width: number, height: number) {
    const aspect = width > 0 && height > 0 ? width / height : 16 / 9;
    const targetHeight = width < 540 ? 171 : 192;
    const viewWidth = Math.round(Math.min(356, Math.max(176, targetHeight * aspect)));
    const viewHeight = Math.round(Math.max(100, viewWidth / aspect));
    if (canvas.width === viewWidth && canvas.height === viewHeight) return;
    canvas.width = viewWidth;
    canvas.height = viewHeight;
    scene.width = viewWidth + 2 * Math.ceil(viewWidth * .12);
    scene.height = viewHeight;
    cameraTime = 0;
  }

  function artFor(room: RoomId, night: boolean) {
    const key = room + (night ? '-night' : '-day');
    let art = mapArt.get(key);
    if (!art) {
      art = makeRoomArt(room, night);
      mapArt.set(key, art);
    }
    return art;
  }

  function moveCamera(playerX: number, playerY: number, time: number, { map, facing, step }: FieldView) {
    const scale = .92;
    const viewWidth = canvas.width / scale;
    const viewHeight = canvas.height / scale;
    const lead = step && !reducedMotion.matches ? offsets[facing] : { x: 0, y: 0 };
    const clamp = (value: number, visible: number, limit: number) => visible > limit ? (limit - visible) / 2 : Math.max(0, Math.min(limit - visible, value));
    const goalX = clamp(playerX - viewWidth * .5 + lead.x * 10, viewWidth, map.width * TILE);
    const goalY = clamp(playerY - viewHeight * .91 + lead.y * 7, viewHeight, map.height * TILE);
    const delta = Math.min(48, Math.max(0, time - cameraTime));
    const ease = !cameraTime || reducedMotion.matches ? 1 : 1 - Math.exp(-delta / 78);
    cameraAim.x += (goalX - cameraAim.x) * ease;
    cameraAim.y += (goalY - cameraAim.y) * ease;
    camera = { x: Math.round(cameraAim.x * scale) / scale, y: Math.round(cameraAim.y * scale) / scale, scale, depth: 0 };
    cameraTime = time;
  }

  function projectPoint(x: number, y: number) {
    return { x: (x - camera.x) * camera.scale, y: (y - camera.y) * camera.scale, scale: camera.scale };
  }

  function drawPokemon(context: CanvasRenderingContext2D, image: HTMLCanvasElement, x: number, y: number,
    mirror: boolean, lift: number, lean = 0, squeeze = 0) {
    const scale = Math.min(17 / image.width, 15 / image.height);
    const width = Math.round(image.width * scale);
    const height = Math.round(image.height * scale);
    const opacity = .40 - Math.min(.20, Math.max(0, lift) * .035);
    context.fillStyle = `rgba(19, 44, 40, ${opacity})`;
    context.fillRect(x - 4, y - 1, 8, 2);
    context.save();
    context.translate(x, y - lift);
    if (mirror) context.scale(-1, 1);
    context.rotate(lean);
    context.scale(1 + squeeze, 1 - squeeze);
    context.drawImage(image, -Math.round(width / 2), -height, width, height);
    context.restore();
  }

  function draw(time: number, view: FieldView) {
    currentView = view;
    markerOffset = reducedMotion.matches ? 0 : Math.floor(time / 440) % 2;
    if (!context || !display || !view.location.room) return;
    const { location, map, facing, step, path, activeNpc, activeNpcFacing, companionImage, fadedAt } = view;
    const art = artFor(view.location.room, view.night);
    const progress = step ? Math.max(0, Math.min(1, (time - step.startedAt) / step.duration)) : 0;
    const x = step ? step.from.x + (step.to.x - step.from.x) * progress : location.x;
    const y = step ? step.from.y + (step.to.y - step.from.y) * progress : location.y;
    const playerX = Math.round(feetX(x));
    const playerY = Math.round(feetY(y));
    const idle = reducedMotion.matches || !step ? 0 : progress < .5 ? 1 : 2;
    moveCamera(playerX, playerY, time, view);
    context.imageSmoothingEnabled = false;
    context.fillStyle = '#131e28';
    context.fillRect(0, 0, scene.width, scene.height);
    context.save();
    context.translate((scene.width - canvas.width) / 2, 0);
    context.scale(camera.scale, camera.scale);
    context.translate(-camera.x, -camera.y);
    context.drawImage(art.base, 0, 0);
    const door = map.exits[0];
    if (door) {
      context.fillStyle = '#d6bb82';
      context.fillRect(feetX(door.x) - 3, feetY(door.y) - 9, 7, 2);
      context.fillRect(feetX(door.x) - 1, feetY(door.y) - 7, 3, 2);
    }
    const destination = path.at(-1);
    if (destination) {
      context.fillStyle = '#f5e2b2b0';
      for (let i = 1; i < Math.min(path.length - 1, 13); i += 2) {
        const point = path[i];
        context.fillRect(feetX(point.x) - 1, point.y * TILE + TILE / 2, 3, 2);
      }
      const cursorX = feetX(destination.x);
      const cursorY = destination.y * TILE + TILE / 2;
      context.fillStyle = '#fff0b9';
      context.fillRect(cursorX - 1, cursorY - 4, 3, 9);
      context.fillRect(cursorX - 4, cursorY - 1, 9, 3);
      context.fillStyle = '#37564e';
      context.fillRect(cursorX, cursorY, 1, 1);
    }
    context.restore();
    display.imageSmoothingEnabled = false;
    display.drawImage(scene, (scene.width - canvas.width) / 2, 0, canvas.width, canvas.height, 0, 0, canvas.width, canvas.height);

    const margin = (scene.width - canvas.width) / (2 * camera.scale);
    const left = camera.x - margin;
    const right = left + scene.width / camera.scale;
    const top = camera.y;
    const bottom = top + scene.height / camera.scale;
    type Layer = { x: number; depth: number; draw: (surface: CanvasRenderingContext2D) => void };
    visibleProps = art.foreground.filter(prop => prop.x < right && prop.x + prop.image.width > left && prop.y < bottom && prop.y + prop.image.height > top);
    const layers: Layer[] = visibleProps.map(prop => ({
      x: prop.x + prop.image.width / 2, depth: prop.depth, draw: surface => surface.drawImage(prop.image, prop.x, prop.y),
    }));
    for (const npc of map.npcs) {
      const nx = feetX(npc.x);
      const ny = feetY(npc.y);
      const near = npc === activeNpc;
      layers.push({ x: nx, depth: ny, draw: context => {
        drawFieldActor(context, npc.style, near ? activeNpcFacing ?? 'down' : 'down', 0, nx, ny);
        const top = ny - 27 - markerOffset;
        context.fillStyle = near ? '#ebbf68' : '#244544';
        context.fillRect(nx - 4, top + 1, 9, 6);
        context.fillRect(nx - 3, top, 7, 8);
        context.fillRect(nx - 1, top + 8, 2, 2);
        context.fillStyle = near ? '#273c3b' : '#f5d985';
        context.fillRect(nx - 2, top + 3, 1, 2);
        context.fillRect(nx, top + 3, 1, 2);
        context.fillRect(nx + 2, top + 3, 1, 2);
      } });

    }
    if (companionImage) {
      const pet = companionPosition(view, progress);
      const petX = Math.round(feetX(pet.x));
      const petY = Math.round(feetY(pet.y));
      const calm = reducedMotion.matches;
      const floating = view.companionId === 'drifloon';
      const gait = step && !calm ? Math.sin((progress + ((step.from.x + step.from.y) % 2)) * Math.PI) : 0;
      const idleSway = calm ? 0 : Math.sin(time / 390) * .031;
      const lift = floating ? 4 + (calm ? 0 : 1.5 * Math.sin(time / 430)) : Math.abs(gait) * (step?.running ? 2.7 : 1.57);
      layers.push({ x: petX, depth: petY, draw: context => {
        drawPokemon(context, companionImage, petX, petY, facing === 'right', lift, idleSway + gait * .10, -.04 * Math.abs(gait));
      } });
    }
    layers.push({ x: playerX, depth: playerY, draw: context => {
      drawFieldActor(context, 'player', facing, idle, playerX, playerY);
    } });
    for (const layer of layers.sort((a, b) => a.depth - b.depth)) {
      const point = projectPoint(layer.x, layer.depth);
      display.save();
      display.translate(Math.round(point.x), Math.round(point.y));
      display.scale(point.scale, point.scale);
      display.translate(-layer.x, -layer.depth);
      layer.draw(display);
      display.restore();
    }
    if (location.room) {
      display.save();
      display.scale(camera.scale, camera.scale);
      display.translate(-camera.x, -camera.y);
      drawRoomEffects(display, location.room, time, reducedMotion.matches);
      display.restore();
    }
    const elapsed = time - fadedAt;
    if (!reducedMotion.matches && elapsed < fieldFadeDuration) {
      display.fillStyle = `rgba(14, 28, 31, ${1 - elapsed / fieldFadeDuration})`;
      display.fillRect(0, 0, canvas.width, canvas.height);
    }
  }

  function opaquePixel(image: HTMLCanvasElement, x: number, y: number) {
    if (x < 0 || y < 0 || x >= image.width || y >= image.height) return false;
    let sample = pixels.get(image);
    if (!sample) {
      sample = image.getContext('2d')!.getImageData(0, 0, image.width, image.height).data;
      pixels.set(image, sample);
    }
    return sample[4 * (Math.floor(y) * image.width + Math.floor(x)) + 3] >= 140;
  }

  function propCovers(x: number, y: number, depth: number) {
    return visibleProps.some(prop => {
      if (prop.depth <= depth) return false;
      const anchor = projectPoint(prop.x + prop.image.width / 2, prop.depth);
      return opaquePixel(prop.image, (x - Math.round(anchor.x)) / anchor.scale + prop.image.width / 2,
        (y - Math.round(anchor.y)) / anchor.scale + prop.depth - prop.y);
    });
  }

  function hitActor(x: number, y: number, candidates: FieldMap['npcs'], doorway: (actor: FieldMap['npcs'][number]) => boolean) {
    if (!currentView) return;
    for (const actor of candidates) {
      const nx = feetX(actor.x), ny = feetY(actor.y);
      const anchor = projectPoint(nx, ny);
      const dx = (x - Math.round(anchor.x)) / anchor.scale, dy = (y - Math.round(anchor.y)) / anchor.scale;
      const active = currentView.activeNpc === actor;
      const marker = Math.abs(dx) <= 4 && dy >= -27 - markerOffset && dy < -17 - markerOffset;
      const facing = active ? currentView.activeNpcFacing ?? 'down' : 'down';
      const key = actor.style + '-' + facing;
      let image = actorImages.get(key);
      if (!image) {
        image = document.createElement('canvas');
        image.width = 32;
        image.height = 38;
        drawFieldActor(image.getContext('2d')!, actor.style, facing, 0, 16, 32);
        actorImages.set(key, image);
      }
      if ((marker || opaquePixel(image, dx + 16, dy + 32)) && !propCovers(x, y, ny)) return actor;
      if (!doorway(actor)) continue;
      const doorFoot = ny - TILE + 1;
      const front = projectPoint(nx, doorFoot);
      const doorX = (x - Math.round(front.x)) / front.scale, doorY = (y - Math.round(front.y)) / front.scale;
      if (doorX >= -10 && doorX < 6 && doorY >= -24 && doorY <= 2 && !propCovers(x, y, doorFoot)) return actor;
    }
  }

  function pointInWorld(screenX: number, screenY: number) {
    if (propCovers(screenX, screenY, -Infinity)) return;
    return { x: screenX / camera.scale + camera.x, y: screenY / camera.scale + camera.y };
  }

  return {
    draw,
    resize,
    projectPoint,
    pointInWorld,
    hitActor,
    resetCamera: () => { cameraTime = 0; },
    getCamera: () => ({ ...camera, width: canvas.width, height: canvas.height }),
  };
}
