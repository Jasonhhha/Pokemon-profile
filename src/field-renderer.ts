import { drawFieldActor, drawGrassCover, drawMapEffects, makeMapArt, TILE, type FieldMap } from './field-art';
import { props, type FieldArea, type FieldLocation, type RoomId } from './field-layout';
import { drawRoomEffects, makeRoomArt } from './field-rooms';
import { ringStreetRow, ringXDelta, wrapRingX } from './field-ring-coordinates';
import type { Direction, WalkStep } from './field';
import type { CreatureId } from './creatures';

type Point = { x: number; y: number };
type SceneArt = ReturnType<typeof makeMapArt> & { padding: number };

export type FieldView = {
  location: FieldLocation;
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
  fadedAt: number;
};

export const fieldFadeDuration = 240;

const offsets: Record<Direction, Point> = {
  up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 },
};

const outlooks: Record<FieldArea, { x: number; y: number; radius: number }[]> = {
  harbor: [{ x: 5, y: 12, radius: 5 }, { x: 36, y: 12, radius: 5 }],
  grove: [{ x: 17, y: 12, radius: 6 }, { x: 33, y: 12, radius: 5 }],
  summit: [{ x: 18, y: 12, radius: 6 }, { x: 31, y: 9, radius: 5 }],
};

export const feetX = (x: number) => x * TILE + TILE / 2;
export const feetY = (y: number) => y * TILE + TILE - 2;

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
  const across = map.wrapX ? ringXDelta(previous.x, location.x) : location.x - previous.x;
  const along = location.y - previous.y;
  const x = previous.x + across * progress;
  const y = previous.y + along * progress;
  const origin = trail ?? tileUnderFeet(previous.x, previous.y);
  const passing = step && origin.x === step.to.x && origin.y === step.to.y;
  if (!passing) return { x, y, passing: 0 };

  const roomBeside = (dx: number, dy: number) => [origin, location].every(point => {
    const column = map.wrapX ? wrapRingX(point.x + dx) : point.x + dx;
    return freeTile({ x: column, y: point.y + dy });
  });
  const dodge = Math.sin(progress * Math.PI) ** 1.15;
  // The companion keeps to the pavement as it yields to a trainer doubling back.
  if (across) {
    const openOutside = roomBeside(0, 1);
    const outside = map.wrapX ? (companionId === 'drifloon' ? 1.08 : .93) : .54;
    const side = openOutside ? outside : roomBeside(0, -1) ? -.70 : -.58;
    return { x, y: y + side * dodge, passing: dodge };
  }
  const side = roomBeside(1, 0) || !roomBeside(-1, 0) ? 1 : -1;
  return { x: x + (map.wrapX ? .39 : .45) * dodge * side, y, passing: dodge };
}

export function createFieldRenderer(canvas: HTMLCanvasElement, reducedMotion: MediaQueryList) {
  const display = canvas.getContext('2d', { alpha: false });
  const scene = document.createElement('canvas');
  const context = scene.getContext('2d', { alpha: false });
  const lightMap = document.createElement('canvas');
  const light = lightMap.getContext('2d');
  if (!display || !context || !light) throw new Error('无法初始化地图画布');
  const mapArt = new Map<FieldArea | RoomId, SceneArt>();
  let camera = { x: 0, y: 0, scale: 1, depth: 0 };
  let cameraTime = 0;
  let cameraAim = { x: 0, y: 0 };
  let darkness = 0;

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
    lightMap.width = viewWidth;
    lightMap.height = viewHeight;
    cameraTime = 0;
  }

  function artFor({ area, room }: FieldLocation) {
    const key = room ?? area;
    let art = mapArt.get(key);
    if (!art) {
      if (room) art = { ...makeRoomArt(room), padding: 0 };
      else {
        const world = makeMapArt(area);
        const { width, height } = world.base;
        const padding = TILE * 4;
        const base = document.createElement('canvas');
        base.width = width + 2 * padding;
        base.height = height;
        const extended = base.getContext('2d')!;
        // Build the border once at native resolution so the tilted camera can
        // sample beyond the collision grid without showing raster seams.
        extended.setTransform(-1, 0, 0, 1, padding, 0);
        extended.drawImage(world.base, 0, 0, padding, height, 0, 0, padding, height);
        extended.setTransform(-1, 0, 0, 1, padding + width * 2, 0);
        extended.drawImage(world.base, width - padding, 0, padding, height, width - padding, 0, padding, height);
        extended.setTransform(1, 0, 0, 1, 0, 0);
        extended.drawImage(world.base, padding, 0);
        art = { ...world, base, padding };
      }
      mapArt.set(key, art);
    }
    return art;
  }

  function moveCamera(tileX: number, tileY: number, playerX: number, playerY: number, time: number, view: FieldView) {
    const { location, map, facing, step } = view;
    const gentle = reducedMotion.matches;
    const delta = cameraTime ? Math.min(48, Math.max(0, time - cameraTime)) : 0;
    const point = location.room ? 0 : outlooks[location.area].reduce((maximum, view) => Math.max(maximum, 1 - Math.hypot(tileX - view.x, tileY - view.y) / view.radius), 0);
    const targetScale = location.room ? .92 : gentle ? 1 : 1 - .20 * point;
    const easeLens = gentle || !cameraTime ? 1 : 1 - Math.exp(-delta / 230);
    const scale = camera.scale + (targetScale - camera.scale) * easeLens;
    const depth = camera.depth + ((gentle ? 0 : point) - camera.depth) * easeLens;
    const viewWidth = canvas.width / scale;
    const viewHeight = canvas.height / scale;
    const lead = step && !gentle ? offsets[facing] : { x: 0, y: 0 };
    const anchorX = !location.room && location.area === 'harbor' ? (canvas.width < 235 ? .64 : .56) : .5;
    const clamp = (value: number, visible: number, limit: number) => visible > limit ? (limit - visible) / 2 : Math.max(0, Math.min(limit - visible, value));
    const goalX = clamp(playerX - viewWidth * anchorX + lead.x * 10, viewWidth, map.width * TILE);
    const anchorY = location.room ? .91 : location.area === 'harbor' ? .67 : .61;
    const goalY = clamp(playerY - viewHeight * anchorY + lead.y * 7, viewHeight, map.height * TILE);
    const easePan = gentle || !cameraTime ? 1 : 1 - Math.exp(-delta / 78);
    cameraAim = {
      x: cameraAim.x + (goalX - cameraAim.x) * easePan,
      y: cameraAim.y + (goalY - cameraAim.y) * easePan,
    };
    camera = {
      x: Math.round(clamp(cameraAim.x, viewWidth, map.width * TILE) * scale) / scale,
      y: Math.round(clamp(cameraAim.y, viewHeight, map.height * TILE) * scale) / scale,
      scale,
      depth,
    };
    cameraTime = time;
  }

  // A shallow perspective at lookouts leaves gameplay on the same collision grid.
  // Both the raster pass and pointer input use this destination-to-source mapping.
  function sceneRow(row: number, amount: number) {
    return { spread: 1 + amount * (.18 - .30 * row), depth: row + amount * .16 * row * (1 - row) };
  }

  function projectionDepth() {
    return camera.depth < .015 ? 0 : camera.depth;
  }

  // Project an upright sprite by its ground position, so pitch affects its scale
  // and placement without bending its silhouette the way a terrain raster bends.
  function projectPoint(x: number, y: number) {
    const amount = projectionDepth();
    const depth = (y - camera.y) * camera.scale / canvas.height;
    const pitch = .16 * amount;
    // Near the scene boundary, extend the edge slope so clipped tall props
    // keep the same orientation instead of extrapolating past the lens.
    let row = depth;
    if (depth < 0) row = depth / (1 + pitch);
    else if (depth > 1) row = 1 + (depth - 1) / (1 - pitch);
    else row = 2 * depth / (1 + pitch + Math.sqrt((1 + pitch) ** 2 - 4 * pitch * depth));
    const { spread } = sceneRow(Math.min(1, Math.max(0, row)), amount);
    const scaledX = (x - camera.x) * camera.scale;
    return { x: canvas.width / 2 + (scaledX - canvas.width / 2) / spread, y: row * canvas.height, scale: camera.scale / spread };
  }

  function projectScene() {
    if (!display) return;
    const { width, height } = canvas;
    display.imageSmoothingEnabled = false;
    if (camera.depth < .015) {
      display.drawImage(scene, (scene.width - width) / 2, 0, width, height, 0, 0, width, height);
      return;
    }
    for (let y = 0; y < height; y += 3) {
      const bandHeight = Math.min(3, height - y);
      const sample = sceneRow((y + bandHeight / 2) / height, camera.depth);
      const from = sceneRow(y / height, camera.depth).depth * height;
      const to = sceneRow((y + bandHeight) / height, camera.depth).depth * height;
      const spread = width * sample.spread;
      display.drawImage(scene, (scene.width - spread) / 2, from, spread, to - from, 0, y, width, bandHeight);
    }
  }

  function drawLighting(time: number, playerX: number, playerY: number, { location, night, beaconLit }: FieldView) {
    if (!light || !display || location.room) return;
    const target = night ? 1 : 0;
    darkness = reducedMotion.matches ? target : darkness + (target - darkness) * .12;
    if (darkness < .012) return;
    const visible = props[location.area].filter(prop => prop.kind === 'lamp' || (prop.kind === 'beacon' && (location.area !== 'summit' || beaconLit)));
    const bulbs = visible.map(prop => {
      const base = projectPoint(feetX(prop.x), feetY(prop.y));
      const beacon = prop.kind === 'beacon';
      return { x: base.x, y: base.y - (beacon ? 38 : 19) * base.scale, radius: (beacon ? 54 : 29) * base.scale };
    }).filter(bulb => bulb.x + bulb.radius > 0 && bulb.x - bulb.radius < canvas.width && bulb.y + bulb.radius > 0 && bulb.y - bulb.radius < canvas.height);

    light.clearRect(0, 0, canvas.width, canvas.height);
    light.fillStyle = '#182440';
    light.globalAlpha = darkness * .61;
    light.fillRect(0, 0, canvas.width, canvas.height);
    light.globalAlpha = 1;
    light.globalCompositeOperation = 'destination-out';
    for (const bulb of bulbs) {
      const glow = light.createRadialGradient(bulb.x, bulb.y, 1, bulb.x, bulb.y, bulb.radius);
      glow.addColorStop(0, '#fff');
      glow.addColorStop(.35, '#fffd');
      glow.addColorStop(1, '#fff0');
      light.fillStyle = glow;
      light.fillRect(bulb.x - bulb.radius, bulb.y - bulb.radius, bulb.radius * 2, bulb.radius * 2);
    }
    const { x: footX, y: footY } = projectPoint(playerX, playerY);
    const glow = light.createRadialGradient(footX, footY, 0, footX, footY, 22);
    glow.addColorStop(0, '#fff4');
    glow.addColorStop(1, '#fff0');
    light.fillStyle = glow;
    light.fillRect(footX - 22, footY - 22, 44, 44);
    light.globalCompositeOperation = 'source-over';
    display.drawImage(lightMap, 0, 0);

    const pulse = reducedMotion.matches ? 1 : .94 + .06 * Math.sin(time / 390);
    for (const bulb of bulbs) {
      const tint = display.createRadialGradient(bulb.x, bulb.y, 0, bulb.x, bulb.y, bulb.radius);
      tint.addColorStop(0, `rgba(255, 208, 123, ${darkness * pulse * .53})`);
      tint.addColorStop(.23, `rgba(255, 193, 104, ${darkness * pulse * .27})`);
      tint.addColorStop(1, '#ffc26800');
      display.fillStyle = tint;
      display.fillRect(bulb.x - bulb.radius, bulb.y - bulb.radius, bulb.radius * 2, bulb.radius * 2);
    }
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
    if (!context || !display) return;
    const { location, map, facing, step, rustle, path, activeNpc, activeNpcFacing, companionImage, sylveon, beaconLit, fadedAt } = view;
    const art = artFor(location);
    const progress = step ? Math.max(0, Math.min(1, (time - step.startedAt) / step.duration)) : 0;
    const x = step ? step.from.x + (step.to.x - step.from.x) * progress : location.x;
    const y = step ? step.from.y + (step.to.y - step.from.y) * progress : location.y;
    const playerX = Math.round(feetX(x));
    const playerY = Math.round(feetY(y));
    const idle = reducedMotion.matches || !step ? 0 : progress < .5 ? 1 : 2;
    moveCamera(x, y, playerX, playerY, time, view);
    context.imageSmoothingEnabled = false;
    context.fillStyle = location.room ? '#131e28' : '#18333c';
    context.fillRect(0, 0, scene.width, scene.height);
    context.save();
    context.translate((scene.width - canvas.width) / 2, 0);
    context.scale(camera.scale, camera.scale);
    context.translate(-camera.x, -camera.y);
    context.drawImage(art.base, -art.padding, 0);
    if (!location.room) drawMapEffects(context, location.area, time, reducedMotion.matches);
    if (rustle) {
      const x = feetX(rustle.x);
      const y = feetY(rustle.y) - 8;
      const spread = reducedMotion.matches ? 4 : 3 + Math.floor((1 + Math.sin(time / 122)) * 2);
      context.fillStyle = '#446649';
      context.fillRect(x - 6, y - 7, 13, 9);
      context.fillStyle = '#e6f5b9';
      context.fillRect(x - spread, y - 5, 2, 3);
      context.fillRect(x + spread, y - 5, 2, 3);
      context.fillRect(x - 1, y - 9, 2, 4);
      context.fillStyle = '#a3d778';
      context.fillRect(x - 4, y - 2, 10, 2);
    }

    for (const exit of map.exits) {
      if (exit.side === 'bottom') {
        const exitX = feetX(exit.x);
        const exitY = feetY(exit.y) - 5;
        context.fillStyle = '#e9cb9a';
        context.fillRect(exitX - 4, exitY - 2, 9, 1);
        context.fillRect(exitX - 3, exitY - 1, 7, 1);
        context.fillRect(exitX - 2, exitY, 5, 1);
        context.fillRect(exitX - 1, exitY + 1, 3, 1);
        continue;
      }
      const toward = exit.side === 'left' ? -1 : 1;
      const markerX = feetX(exit.x) - toward * 15;
      const markerY = feetY(exit.y) - 2;
      for (let offset = 0; offset < 3; offset++) {
        const x = markerX - toward * (2 - offset);
        context.fillStyle = '#948063';
        context.fillRect(x, markerY - 3 + offset, 1, 8 - offset * 2);
        context.fillStyle = '#f8dda7';
        context.fillRect(x, markerY - 2 + offset, 1, 6 - offset * 2);
      }
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
    projectScene();

    const margin = (scene.width - canvas.width) / (2 * camera.scale);
    const left = camera.x - margin;
    const right = left + scene.width / camera.scale;
    const top = camera.y;
    const bottom = top + scene.height / camera.scale;
    type Layer = { x: number; depth: number; draw: (surface: CanvasRenderingContext2D) => void };
    const layers: Layer[] = art.foreground
      .filter(prop => prop.x < right && prop.x + prop.image.width > left && prop.y < bottom && prop.y + prop.image.height > top)
      .map(prop => ({ x: prop.x + prop.image.width / 2, depth: prop.depth, draw: surface => surface.drawImage(prop.image, prop.x, prop.y) }));
    for (const npc of map.npcs) {
      const nx = feetX(npc.x);
      const ny = feetY(npc.y);
      const near = npc === activeNpc;
      layers.push({ x: nx, depth: ny, draw: context => {
        drawFieldActor(context, npc.style, near ? activeNpcFacing ?? 'down' : 'down', 0, nx, ny);
        const marked = near || Boolean(location.room) || npc.event === 'guide' || npc.event === 'trial' || npc.event === 'spar';
        if (!marked) return;
        const top = ny - 27 - (reducedMotion.matches ? 0 : Math.floor(time / 440) % 2);
        context.fillStyle = near ? '#ebbf68' : '#244544';
        context.fillRect(nx - 4, top + 1, 9, 6);
        context.fillRect(nx - 3, top, 7, 8);
        context.fillRect(nx - 1, top + 8, 2, 2);
        context.fillStyle = near ? '#273c3b' : '#f5d985';
        context.fillRect(nx - 2, top + 3, 1, 2);
        context.fillRect(nx, top + 3, 1, 2);
        context.fillRect(nx + 2, top + 3, 1, 2);
      } });
      if (npc.event === 'guide' && sylveon) {
        const image = sylveon;
        const petX = nx + 13;
        const petY = ny + 2;
        const calm = reducedMotion.matches;
        const sway = calm ? 0 : Math.sin(time / 420) * .036;
        layers.push({ x: petX, depth: petY, draw: surface => drawPokemon(surface, image, petX, petY, false, 0, sway) });
      }
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
        if (!location.room) drawGrassCover(context, location.area, petX, petY, time, reducedMotion.matches);
      } });
    }
    layers.push({ x: playerX, depth: playerY, draw: context => {
      drawFieldActor(context, 'player', facing, idle, playerX, playerY);
      if (!location.room) drawGrassCover(context, location.area, playerX, playerY, time, reducedMotion.matches);
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
    if (!location.room && location.area === 'summit' && beaconLit) {
      const tower = projectPoint(feetX(32), feetY(7));
      const beaconX = tower.x;
      const beaconY = tower.y - 36 * tower.scale;
      const brightness = reducedMotion.matches ? .78 : .64 + .18 * Math.sin(time / 450);
      const radius = 21 * tower.scale;
      const glow = display.createRadialGradient(beaconX, beaconY, 1, beaconX, beaconY, radius);
      glow.addColorStop(0, `rgba(255, 232, 154, ${brightness})`);
      glow.addColorStop(.33, 'rgba(255, 214, 124, .36)');
      glow.addColorStop(1, 'rgba(255, 200, 95, 0)');
      display.fillStyle = glow;
      display.fillRect(beaconX - radius, beaconY - radius, radius * 2, radius * 2);
      display.fillStyle = '#ffe9a7';
      display.fillRect(Math.round(beaconX - 1.5 * tower.scale), Math.round(beaconY - tower.scale), Math.max(2, Math.round(3 * tower.scale)), Math.max(2, Math.round(2 * tower.scale)));
    }
    drawLighting(time, playerX, playerY, view);

    const elapsed = time - fadedAt;
    if (!reducedMotion.matches && elapsed < fieldFadeDuration) {
      display.fillStyle = `rgba(14, 28, 31, ${1 - elapsed / fieldFadeDuration})`;
      display.fillRect(0, 0, canvas.width, canvas.height);
    }
  }

  function pointInWorld(screenX: number, screenY: number) {
    const { spread, depth } = sceneRow(screenY / canvas.height, projectionDepth());
    const col = screenX / canvas.width - .5;
    return {
      x: (.5 + col * spread) * canvas.width / camera.scale + camera.x,
      y: depth * canvas.height / camera.scale + camera.y,
    };
  }

  return {
    draw,
    resize,
    projectPoint,
    pointInWorld,
    resetCamera: () => { cameraTime = 0; },
    getCamera: () => ({ ...camera, width: canvas.width, height: canvas.height }),
  };
}
