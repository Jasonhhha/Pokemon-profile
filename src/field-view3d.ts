import {
  ACESFilmicToneMapping, AdditiveBlending, Box3, CanvasTexture, Color, DirectionalLight, FogExp2, Group, HemisphereLight,
  Mesh, MeshBasicMaterial, OrthographicCamera, PCFShadowMap, Plane, PlaneGeometry, PointLight, Ray, Raycaster,
  RingGeometry, Scene, Sprite, SpriteMaterial, SRGBColorSpace, Vector2, Vector3, WebGLRenderer, type Intersection, type Object3D,
} from 'three';
import { props, TILE, type FieldArea } from './field-layout';
import { updateCityArchitecture } from './field-city-models';
import { buildRingArchitecture } from './field-ring-architecture';
import { buildRingGround } from './field-ring-ground';
import { ringOverviewCamera, ringStreetRow } from './field-ring-coordinates';
import { buildRingTerraces } from './field-ring-terraces';
import { RING_PERIOD, ringAngle, ringCoordinates, ringPosition, ringXDelta } from './field-ring-space';
import { buildCityFerry } from './field-city-ferry';
import { buildCityCrowd } from './field-city-crowd';
import { buildCityLight } from './field-city-light';
import { buildCityReflections } from './field-city-reflections';
import { buildCityStreet, type CityLamp } from './field-city-street';
import { buildRingTransit } from './field-ring-transit';
import { buildFieldDressing } from './field-dressing';
import { createFieldEffects } from './field-effects';
import { createFieldPokemon } from './field-pokemon';
import { buildFieldProp } from './field-models';
import { companionPosition, fieldFadeDuration, type FieldView } from './field-renderer';
import { buildRoomModel } from './field-room-models';
import { buildFieldTerrain } from './field-terrain3d';
import { createTraveler } from './field-travelers';

const outlooks: Record<FieldArea, readonly [number, number, number][]> = {
  harbor: [[5, 12, 5], [36, 12, 5]],
  grove: [[17, 12, 6], [33, 12, 5]],
  summit: [[18, 12, 6], [31, 9, 5]],
};
const alleyAngles = [
  [0, 0], [0, .11], [0, .21], [-.27, .14], [.27, .14], [-.38, .23], [.38, .23],
  [0, .31], [-.56, .25], [.56, .25], [0, .43], [-.36, .47], [.36, .47], [0, .53],
  [-.33, .58], [.33, .58], [0, .665],
] as const;

const atmospheres = {
  harbor: { day: 0x92b8c2, night: 0x273e58, ground: 0xa7a796 },
  grove: { day: 0x8aa597, night: 0x303f51, ground: 0x7b9977 },
  summit: { day: 0x96a9bd, night: 0x3a4567, ground: 0x9a8b9a },
  home: { day: 0x343237, night: 0x343237, ground: 0xc9926c },
  lab: { day: 0x273b40, night: 0x273b40, ground: 0x87aaa2 },
  tower: { day: 0x373746, night: 0x373746, ground: 0x928cb0 },
};

type SceneKey = keyof typeof atmospheres;
type SceneModel = ReturnType<typeof buildFieldTerrain> & {
  lamps?: CityLamp[];
  optics?: ReturnType<typeof buildCityLight>;
  crowd?: ReturnType<typeof buildCityCrowd>;
  reflections?: ReturnType<typeof buildCityReflections>;
  occluders?: { object: Object3D; bounds: Box3 }[];
};

function conversationTexture(active: boolean) {
  const image = document.createElement('canvas');
  image.width = 92;
  image.height = 72;
  const context = image.getContext('2d')!;
  context.fillStyle = active ? '#e8c67e' : '#203c3e';
  context.beginPath();
  context.roundRect(7, 8, 78, 47, 15);
  context.moveTo(37, 52);
  context.lineTo(46, 65);
  context.lineTo(55, 52);
  context.closePath();
  context.fill();
  context.fillStyle = active ? '#293c3c' : '#f0d79d';
  for (const x of [30, 46, 62]) {
    context.beginPath();
    context.arc(x, 31, 3.9, 0, Math.PI * 2);
    context.fill();
  }
  const texture = new CanvasTexture(image);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

function radialTexture(hot: string, soft: string) {
  const image = document.createElement('canvas');
  image.width = image.height = 64;
  const context = image.getContext('2d')!;
  const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, hot);
  gradient.addColorStop(.48, soft);
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 64, 64);
  const texture = new CanvasTexture(image);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

function visibilityTexture() {
  const image = document.createElement('canvas');
  image.width = 72;
  image.height = 72;
  const context = image.getContext('2d')!;
  context.beginPath();
  context.moveTo(36, 10);
  context.lineTo(62, 31);
  context.lineTo(36, 62);
  context.lineTo(10, 31);
  context.closePath();
  context.strokeStyle = '#203741';
  context.lineJoin = 'round';
  context.lineWidth = 9;
  context.stroke();
  context.fillStyle = '#efcf99';
  context.fill();
  context.beginPath();
  context.moveTo(36, 22);
  context.lineTo(48, 32);
  context.lineTo(36, 48);
  context.lineTo(24, 32);
  context.closePath();
  context.fillStyle = '#39515b';
  context.fill();
  const texture = new CanvasTexture(image);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

export function createFieldView3d(canvas: HTMLCanvasElement, reducedMotion: MediaQueryList) {
  const surface = document.createElement('canvas');
  const context = surface.getContext('webgl2', { alpha: false, antialias: true, depth: true });
  const displayContext = canvas.getContext('2d', { alpha: false });
  if (!context || !displayContext) return;
  const display = displayContext;

  const renderer = new WebGLRenderer({ canvas: surface, context, alpha: false, antialias: true });
  renderer.setClearColor(0x70979b);
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.07;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFShadowMap;
  renderer.shadowMap.autoUpdate = false;

  const scene = new Scene();
  const haze = new FogExp2(0x80acaf, .011);
  scene.fog = haze;
  const camera = new OrthographicCamera(-1, 1, 1, -1, .1, 115);
  const ambient = new HemisphereLight(0xe2f4ff, 0xb2a576, 2.05);
  scene.add(ambient);
  const sun = new DirectionalLight(0xffe0af, 2.2);
  sun.castShadow = true;
  const shadowCamera = sun.shadow.camera;
  shadowCamera.left = shadowCamera.bottom = -21;
  shadowCamera.right = shadowCamera.top = 21;
  shadowCamera.near = .5;
  shadowCamera.far = 78;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -.00018;
  sun.shadow.normalBias = .021;
  sun.shadow.intensity = .76;
  sun.shadow.radius = 2;
  scene.add(sun, sun.target);

  const world = new Group();
  const travelers = new Group();
  const effects = createFieldEffects();
  scene.add(world, travelers, effects.group);

  const nightSky = new Color(0x98b2fa);
  const nightLight = new Color(0xb5c8f6);
  const shadows = Object.fromEntries(Object.entries(atmospheres).map(([key, palette]) => [key, new Color(palette.night)])) as Record<SceneKey, Color>;
  const shadowMap = radialTexture('rgba(15,24,22,.48)', 'rgba(20,30,27,.25)');
  const shadowGeometry = new PlaneGeometry(1, 1);
  const shadowMaterial = new MeshBasicMaterial({ map: shadowMap, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, toneMapped: false });
  function contact(parent: Group, x = 0, z = 0, wide = .9, deep = .69) {
    const mesh = new Mesh(shadowGeometry, shadowMaterial);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(x, .028, z);
    mesh.scale.set(wide, deep, 1);
    parent.add(mesh);
  }

  const hero = createTraveler('player');
  const player = new Group();
  player.add(hero.model);
  contact(player);
  const pinMap = visibilityTexture();
  const pin = new Sprite(new SpriteMaterial({ map: pinMap, transparent: true, depthWrite: false, depthTest: false, toneMapped: false }));
  pin.scale.set(.45, .45, 1);
  pin.position.y = 1.92;
  pin.renderOrder = 20;
  pin.visible = false;
  player.add(pin);
  travelers.add(player);

  const pokemon = createFieldPokemon(shadowMap);
  const partner = pokemon.actor('piplup');
  const sylveon = pokemon.actor('sylveon');
  travelers.add(partner.root, sylveon.root);

  const dots = new Group();
  const arrows = new Group();
  scene.add(arrows);
  const markerGeometry = new PlaneGeometry(.47, .115);
  markerGeometry.rotateX(-Math.PI / 2);
  const markerMaterial = new MeshBasicMaterial({ color: 0xe0c694, toneMapped: false });
  const conversationMaps = [conversationTexture(false), conversationTexture(true)];
  const conversationMaterials = conversationMaps.map(map => new SpriteMaterial({ map, transparent: true, depthWrite: false, toneMapped: false }));
  const ringSurface = new RingGeometry(.34, .41, 32);
  ringSurface.rotateX(-Math.PI / 2);
  const ring = new Mesh(ringSurface, new MeshBasicMaterial({ color: 0xf4ead2, transparent: true, opacity: .82, depthWrite: false, toneMapped: false }));
  const dotGeometry = new PlaneGeometry(.105, .105);
  dotGeometry.rotateX(-Math.PI / 2);
  dotGeometry.rotateY(Math.PI / 4);
  const dotMaterial = new MeshBasicMaterial({ color: 0xf6dfac, transparent: true, opacity: .73, depthWrite: false, toneMapped: false });
  const pathDots = Array.from({ length: 12 }, () => new Mesh(dotGeometry, dotMaterial));
  const destination = new Mesh(ringSurface, ring.material);
  destination.scale.setScalar(.67);
  dots.add(ring, destination, ...pathDots);
  scene.add(dots);

  const actors = new Group();
  travelers.add(actors);
  let locals: { npc: FieldView['map']['npcs'][number]; traveler: ReturnType<typeof createTraveler>; marker: Sprite }[] = [];
  const cache = new Map<SceneKey, SceneModel>();
  const glow = radialTexture('rgba(255,222,152,.8)', 'rgba(255,179,79,.27)');
  const lamps: { sprite: Sprite; beacon: boolean }[] = [];
  const localLights = Array.from({ length: 3 }, () => new PointLight(0xffbf72, 0, 4.7, 2));
  scene.add(...localLights);
  let key: SceneKey | undefined;
  let previousTime = 0;
  let lastRender = -100;
  let lastActivity = -Infinity;
  let orbitChangedAt = -Infinity;
  let previousOverview = false;
  let previousOrbitOffset = 0;
  let previousOrbitTilt = 0;
  let renderCost = 4;
  let darkness = 0;
  let cssWidth = 0;
  let cssHeight = 0;
  let width = 0;
  let height = 0;
  let depth = 0;
  let aimX = 0;
  let aimZ = 0;
  let span = 12;
  let viewYaw = .26;
  let viewPitch = .70;
  let viewElevation = 0;
  let shadowX = NaN;
  let shadowZ = NaN;
  let needsFrame = true;

  const raycaster = new Raycaster();
  const pointer = new Vector2();
  const projected = new Vector3();
  const ground = new Plane(new Vector3(0, 1, 0), 0);
  const planeHit = new Vector3();
  const obstacle = new Box3();
  const actorHit = new Vector3();
  const cameraLine = new Ray();
  const shadowCaster = new Raycaster();
  const hits: Intersection[] = [];
  const viewDirection = new Vector3();
  const alleyView = new Map<number, { yaw: number; pitch: number }>();
  let pinVisibility = 0;

  function pointAt(x: number, z: number, polar = key === 'harbor') {
    return polar ? ringPosition(x, z) : { x, z };
  }

  function screenRay(x: number, y: number) {
    pointer.set(x / width * 2 - 1, 1 - y / height * 2);
    raycaster.setFromCamera(pointer, camera);
    return raycaster.ray;
  }

  function cityBlocksRay(ray: Ray, distance: number, exceptParcel?: string) {
    const occluders = key && cache.get(key)?.occluders;
    if (!occluders?.length) return false;
    shadowCaster.ray.copy(ray);
    shadowCaster.far = distance;
    return occluders.some(({ object, bounds }) => {
      if (exceptParcel && object.userData.parcel === exceptParcel) return false;
      if (!ray.intersectBox(bounds, projected) || ray.origin.distanceTo(projected) >= distance) return false;
      hits.length = 0;
      return shadowCaster.intersectObject(object, true, hits).length > 0;
    });
  }

  function hiddenFrom(x: number, z: number, direction: Vector3, elevation = 1.02) {
    const range = 16;
    cameraLine.set(actorHit.set(x, elevation, z).addScaledVector(direction, -range), direction);
    return cityBlocksRay(cameraLine, range - .04);
  }

  function alleyCamera(column: number, row: number, yaw: number, pitch: number) {
    const tile = row * RING_PERIOD + column;
    const cached = alleyView.get(tile);
    if (cached) return cached;
    const { x, z } = ringPosition(column + .5, ringStreetRow(row));
    let visible: { yaw: number; pitch: number } | undefined;
    for (const [yawBias, pitchBias] of alleyAngles) {
      const look = yaw + yawBias, tilt = Math.min(1.47, pitch + pitchBias);
      viewDirection.set(-Math.sin(look) * Math.cos(tilt), -Math.sin(tilt), -Math.cos(look) * Math.cos(tilt));
      const angle = { yaw: yawBias, pitch: tilt - pitch };
      if (!hiddenFrom(x, z, viewDirection, .26)) {
        visible = angle;
        break;
      }
      if (!visible && !hiddenFrom(x, z, viewDirection)) visible = angle;
    }
    const result = visible ?? { yaw: 0, pitch: 0 };
    alleyView.set(tile, result);
    return result;
  }

  function source(view: FieldView): SceneModel {
    const { area, room } = view.location;
    const sceneKey = room ?? area;
    let model = cache.get(sceneKey);
    if (!model) {
      if (room) {
        model = { group: buildRoomModel(room), update: () => {} };
      } else if (area === 'harbor') {
        const ground = buildRingGround();
        const structures = buildRingArchitecture();
        const terraces = buildRingTerraces();
        const opaque = structures.children.filter(object => object.userData.parcel || object.name === 'ring-observatory');
        opaque.push(...terraces.group.children);
        structures.add(terraces.group);
        let lighthouse: Object3D | undefined;
        const street = buildCityStreet(true);
        const transit = buildRingTransit();
        opaque.push(transit.structure);
        const ferry = buildCityFerry(true);
        const optics = buildCityLight(street.lamps, true);
        const crowd = buildCityCrowd(shadowMap, true);
        ground.group.add(structures, street.group, transit.group, ferry.group, optics.group, crowd.group);
        for (const prop of props.harbor) {
          if (prop.kind !== 'beacon' && prop.kind !== 'boat') continue;
          const object = buildFieldProp(prop, area);
          const point = ringPosition(prop.x + .5, prop.y + .82);
          object.position.set(point.x, 0, point.z);
          object.rotation.y = ringAngle(prop.x + .5);
          ground.group.add(object);
          if (prop.kind === 'beacon') { opaque.push(object); lighthouse = object; }
        }
        ground.group.updateMatrixWorld(true);
        const occluders = opaque.map(object => ({ object, bounds: new Box3().setFromObject(object) }));
        const reflections = buildCityReflections(structures, lighthouse, true);
        ground.group.add(reflections.group);
        model = {
          group: ground.group,
          lamps: street.lamps,
          optics, crowd, occluders, reflections,
          update(time, night) {
            ground.update(time, night);
            street.update(time, night);
            transit.update(time, night);
            ferry.update(time, night);
            optics.update(night, time);
            updateCityArchitecture(night);
            structures.userData.update?.(time, night);
            terraces.update(time, night);
          },
        };
      } else {
        model = buildFieldTerrain(area);
        model.group.add(buildFieldDressing(area));
        for (const prop of props[area]) {
          const object = buildFieldProp(prop, area);
          object.position.set(prop.x + .5, 0, prop.y + .82);
          model.group.add(object);
        }
      }
      cache.set(sceneKey, model);
    }
    if (key !== sceneKey) {
      key = sceneKey;
      effects.reset();
      pinVisibility = 0;
      partner.reset();
      sylveon.reset();
      world.clear();
      world.add(model.group);
      scene.environment = model.optics?.skylight ?? null;
      for (const { sprite } of lamps) sprite.material.dispose();
      for (const { traveler } of locals) traveler.dispose();
      actors.clear();
      arrows.clear();
      for (const exit of view.map.exits) {
        const arrow = new Group();
        const offset = exit.side === 'left' ? .95 : exit.side === 'right' ? -.95 : 0;
        const mapX = exit.x + .5 + offset;
        const marker = pointAt(mapX, exit.y + (exit.side === 'bottom' ? .44 : .66));
        arrow.position.set(marker.x, .076, marker.z);
        arrow.rotation.y = (key === 'harbor' ? ringAngle(mapX) : 0) +
          (exit.side === 'left' ? -Math.PI / 2 : exit.side === 'right' ? Math.PI / 2 : 0);
        for (const sign of [-1, 1]) {
          const wedge = new Mesh(markerGeometry, markerMaterial);
          wedge.position.x = sign * .145;
          wedge.rotation.y = sign * Math.PI / 5;
          arrow.add(wedge);
        }
        arrows.add(arrow);
      }
      locals = view.map.npcs.map(npc => {
        const traveler = createTraveler(npc.style);
        const base = new Group();
        const npcPoint = pointAt(npc.x + .5, npc.y + .875);
        base.position.set(npcPoint.x, 0, npcPoint.z);
        base.rotation.y = key === 'harbor' ? ringAngle(npc.x + .5) : 0;
        const marker = new Sprite(conversationMaterials[0]);
        marker.scale.set(.58, .455, 1);
        marker.position.set(0, 1.99, .03);
        base.add(traveler.model, marker);
        contact(base);
        actors.add(base);
        return { npc, traveler, marker };
      });
      lamps.length = 0;
      if (!room) {
        const positions = props[area].filter(prop => prop.kind === 'beacon' || prop.kind === 'lamp' && area !== 'harbor').map(prop => ({
          beacon: prop.kind === 'beacon',
          ...pointAt(prop.x + .5, prop.y + 1.02),
          height: prop.kind === 'beacon' ? area === 'summit' ? 2.85 : 3.15 : 1.53,
        }));
        for (const position of model.lamps ?? []) positions.push({ ...position, beacon: false });
        for (const { x, z, height, beacon } of positions) {
          const material = new SpriteMaterial({ map: glow, transparent: true, depthWrite: false, toneMapped: false, blending: AdditiveBlending });
          const sprite = new Sprite(material);
          const size = beacon ? 2.32 : 1.28;
          sprite.scale.set(size, size, 1);
          sprite.position.set(x, height, z);
          actors.add(sprite);
          lamps.push({ sprite, beacon });
        }
      }
      previousTime = 0;
      shadowX = NaN;
      renderer.shadowMap.needsUpdate = true;
    }
    return model;
  }

  function resize(nextWidth: number, nextHeight: number) {
    if (nextWidth <= 0 || nextHeight <= 0 || cssWidth === nextWidth && cssHeight === nextHeight) return;
    cssWidth = nextWidth;
    cssHeight = nextHeight;
    const smallScreen = cssWidth < 550;
    const ratio = Math.min(devicePixelRatio || 1, smallScreen ? 1.5 : 1.7, 1760 / cssWidth, 1040 / cssHeight);
    width = Math.max(1, Math.round(cssWidth * ratio));
    height = Math.max(1, Math.round(cssHeight * ratio));
    canvas.width = width;
    canvas.height = height;
    renderer.setSize(width, height, false);
    const shadowResolution = smallScreen ? 1536 : 2048;
    if (sun.shadow.mapSize.x !== shadowResolution) {
      sun.shadow.map?.dispose();
      sun.shadow.map = null;
      sun.shadow.mapSize.set(shadowResolution, shadowResolution);
      renderer.shadowMap.needsUpdate = true;
    }
    needsFrame = true;
  }

  function aim(view: FieldView, x: number, z: number, time: number) {
    const { room, area } = view.location;
    const polar = area === 'harbor' && !room;
    const panorama = polar && view.overview;
    const lookout = room ? 0 : outlooks[area].reduce((strength, [pointX, pointY, radius]) => {
      const across = polar ? ringXDelta(pointX, x - .5) : x - .5 - pointX;
      return Math.max(strength, 1 - Math.hypot(across, z - .875 - pointY) / radius);
    }, 0);
    const calm = reducedMotion.matches;
    const elapsed = previousTime ? Math.min(60, Math.max(0, time - previousTime)) : 0;
    const dragging = panorama && time - orbitChangedAt < 180;
    const pan = calm || !previousTime ? 1 : 1 - Math.exp(-elapsed / (panorama ? 177 : 103));
    const lens = calm || !previousTime ? 1 : 1 - Math.exp(-elapsed / (dragging ? 72 : polar ? 197 : 225));
    previousTime = time;
    depth += ((calm ? 0 : lookout) - depth) * lens;
    const mobile = cssWidth < 545;
    const aspect = width / height;
    const tour = panorama ? ringOverviewCamera(aspect, mobile, view.orbitTilt) : undefined;
    const alley = polar ? Math.min(1, Math.max(0, (8.0 - z) / 3.7)) : 0;
    const center = panorama ? { x: 0, z: 0 } : polar
      ? ringPosition(x + .37, z - (mobile ? 1.02 : 1.47))
      : room ? { x: x * .42 + 12.1 * .58, z: z * .26 + 8.85 * .74 }
      : { x: x - 1.03, z: z - (mobile ? 1.61 : 2.48) };
    aimX += (center.x - aimX) * pan;
    aimZ += (center.z - aimZ) * pan;

    const goalSpan = tour ? tour.span
      : polar ? (mobile ? 8.82 : 9.47) + 1.9 * depth + .73 * alley
      : room ? (mobile ? 10.7 : 12.0)
      : (mobile ? 10.45 : aspect > 2.6 ? 10.8 : 12.85) + depth * 2.92;
    let yaw = panorama ? .16 + view.orbitOffset + (calm ? 0 : time / 35000)
      : polar ? ringAngle(x) + .28 - .14 * depth : room ? .12 : .33 - .16 * depth;
    let pitch = tour ? tour.pitch
      : polar ? .805 + .075 * alley - .080 * depth : room ? .92 : .79 - .08 * depth;
    if (!panorama && polar && (alley > 0 || view.location.y >= 16)) {
      const bias = alleyCamera(view.location.x, view.location.y, yaw, pitch);
      yaw += bias.yaw;
      pitch += bias.pitch;
    }
    const elevation = tour ? tour.elevation : polar ? .67 - .37 * alley : 0;
    span += (goalSpan - span) * lens;
    const turn = Math.atan2(Math.sin(yaw - viewYaw), Math.cos(yaw - viewYaw));
    viewYaw += turn * lens;
    viewPitch += (pitch - viewPitch) * lens;
    viewElevation += (elevation - viewElevation) * lens;
    const radius = panorama ? 43 : 34;
    camera.position.set(aimX + radius * Math.cos(viewPitch) * Math.sin(viewYaw),
      viewElevation + radius * Math.sin(viewPitch), aimZ + radius * Math.cos(viewPitch) * Math.cos(viewYaw));
    camera.lookAt(aimX, viewElevation, aimZ);
    camera.left = -span * aspect / 2;
    camera.right = span * aspect / 2;
    camera.top = span / 2;
    camera.bottom = -span / 2;
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();

    const viewportX = polar ? 0 : Math.round(aimX / 5) * 5;
    const viewportZ = polar ? 0 : Math.round(aimZ / 5) * 5;
    if (viewportX !== shadowX || viewportZ !== shadowZ) {
      shadowX = viewportX;
      shadowZ = viewportZ;
      sun.position.set(shadowX - (polar ? 15 : 12), polar ? 21 : 24, shadowZ + (polar ? 12 : -7));
      sun.target.position.set(shadowX, 0, shadowZ);
      renderer.shadowMap.needsUpdate = true;
    }
  }

  function draw(time: number, view: FieldView) {
    if (!width || !height) return;
    const sceneKey = view.location.room ?? view.location.area;
    const sceneChanged = sceneKey !== key;
    if (view.overview && (view.orbitOffset !== previousOrbitOffset || view.orbitTilt !== previousOrbitTilt)) orbitChangedAt = time;
    if (view.step || view.overview !== previousOverview || orbitChangedAt === time) lastActivity = time;
    previousOverview = view.overview;
    previousOrbitOffset = view.orbitOffset;
    previousOrbitTilt = view.orbitTilt;
    const responsive = time - lastActivity < 260 && renderCost < 12.5 && !reducedMotion.matches;
    if (!needsFrame && !sceneChanged && time - lastRender < (responsive ? 14 : 28)) return;
    const drawStarted = performance.now();
    lastRender = time;
    needsFrame = false;
    const model = source(view);
    const { location, step, activeNpc, activeNpcFacing, companionImage, path, rustle } = view;
    const progress = step ? Math.min(1, Math.max(0, (time - step.startedAt) / step.duration)) : 0;
    const polar = location.area === 'harbor' && !location.room;
    const x = (step ? step.from.x + (polar ? ringXDelta(step.from.x, step.to.x) : step.to.x - step.from.x) * progress : location.x) + .5;
    const row = step ? step.from.y + (step.to.y - step.from.y) * progress : location.y;
    const z = polar ? ringStreetRow(row) : row + .875;
    const heroPosition = pointAt(x, z);
    player.position.set(heroPosition.x, 0, heroPosition.z);
    player.rotation.y = polar ? ringAngle(x) : 0;
    const reduced = reducedMotion.matches;
    const gait = step ? (((step.from.x + step.from.y) & 1) + progress) / 2 : undefined;
    hero.pose({ facing: view.facing, time, phase: gait, running: step?.running, reduced });
    for (const { npc, traveler, marker } of locals) {
      const near = npc === activeNpc;
      traveler.pose({ facing: near && activeNpcFacing ? activeNpcFacing : 'down', time, reduced, focus: near });
      marker.visible = near || Boolean(location.room) || ['guide', 'trial', 'spar'].includes(npc.event);
      marker.material = conversationMaterials[near ? 1 : 0];
      marker.position.y = 1.99 + (reducedMotion.matches ? 0 : .045 * Math.sin(time / 365));
    }

    ring.visible = Boolean(rustle);
    if (rustle) {
      const pulse = reducedMotion.matches ? .94 : 1 + .14 * Math.sin(time / 230);
      ring.scale.set(pulse, pulse, pulse);
      const point = pointAt(rustle.x + .5, rustle.y + .5);
      ring.position.set(point.x, .30, point.z);
    }
    const pathEnd = path.at(-1);
    destination.visible = Boolean(pathEnd);
    if (pathEnd) {
      const point = pointAt(pathEnd.x + .5, pathEnd.y + .5);
      destination.position.set(point.x, .078, point.z);
    }
    pathDots.forEach((dot, index) => {
      dot.visible = index < path.length;
      if (dot.visible) {
        const point = pointAt(path[index].x + .5, path[index].y + .5);
        dot.position.set(point.x, .055, point.z);
      }
    });

    const target = !location.room && view.night ? 1 : 0;
    darkness = sceneChanged || reducedMotion.matches ? target : darkness + (target - darkness) * .14;
    const sky = atmospheres[sceneKey];
    haze.color.setHex(sky.day).lerp(shadows[sceneKey], darkness);
    const city = polar;
    haze.density = location.room ? .002 : city ? .0088 + darkness * .0017 : .0105;
    ambient.color.setHex(0xe7f3ff).lerp(nightSky, darkness);
    ambient.groundColor.setHex(sky.ground);
    ambient.intensity = city ? 1.37 + darkness * .02 : 1.72 - darkness * .25;
    sun.color.setHex(city ? 0xffdfba : 0xffe3b8).lerp(nightLight, darkness);
    sun.intensity = (city ? 2.62 : 2.26) - darkness * (city ? 2.12 : 1.73);
    sun.shadow.intensity = city ? .83 - darkness * .07 : .76;
    renderer.toneMappingExposure = 1.045 - darkness * .21;
    renderer.setClearColor(haze.color);
    scene.environmentIntensity = city ? .31 - darkness * .22 : 1;
    for (const { sprite, beacon } of lamps) {
      const activeBeacon = beacon && (location.area !== 'summit' || view.beaconLit);
      sprite.material.opacity = activeBeacon ? Math.max(.24, darkness * .87) : beacon ? 0 : darkness * .81;
      sprite.visible = sprite.material.opacity > .04;
    }
    const nearbyLights = darkness > .015 && !location.room
      ? lamps.filter(({ sprite, beacon }) => sprite.visible && !beacon).sort((a, b) =>
        Math.hypot(a.sprite.position.x - heroPosition.x, a.sprite.position.z - heroPosition.z) -
        Math.hypot(b.sprite.position.x - heroPosition.x, b.sprite.position.z - heroPosition.z))
      : [];
    localLights.forEach((light, index) => {
      const lamp = nearbyLights[index];
      light.intensity = lamp ? darkness * (city ? 11.5 : 8.4) : 0;
      if (lamp) light.position.copy(lamp.sprite.position);
    });
    model.update(reduced ? 0 : time, darkness);
    model.crowd?.update(time, x, z, reduced, cssWidth < 545, view.overview);
    effects.update(time, view, heroPosition.x, heroPosition.z, progress, darkness, width / cssWidth, reduced);
    aim(view, x, z, time);
    const obscured = model.occluders && !view.overview &&
      hiddenFrom(heroPosition.x, heroPosition.z, camera.getWorldDirection(viewDirection)) ? 1 : 0;
    pinVisibility = reduced ? obscured : pinVisibility + (obscured - pinVisibility) * .27;
    pin.visible = pinVisibility > .06;
    pin.material.opacity = pinVisibility * .9;
    const guide = location.room ? undefined : view.map.npcs.find(npc => npc.event === 'guide');
    const visibleTarget = activeNpc ? pointAt(activeNpc.x + .5, activeNpc.y + .875) : heroPosition;
    if (guide) {
      const watching = Math.hypot(polar ? ringXDelta(x, guide.x) : x - guide.x, z - guide.y) < 2.5;
      const guideTarget = watching ? heroPosition : pointAt(guide.x + .55, guide.y + .88);
      const position = pointAt(guide.x + 1.23, guide.y + .98);
      sylveon.update(view.sylveon, {
        ...position, time, reduced, camera, night: darkness, lookX: guideTarget.x, lookZ: guideTarget.z, guided: true,
      });
    } else {
      sylveon.root.visible = false;
    }
    const pet = companionPosition(view, progress);
    partner.update(companionImage, {
      ...pointAt(pet.x + .5, polar ? ringStreetRow(pet.y) : pet.y + .875), camera, time, reduced, night: darkness, passing: pet.passing,
      lookX: visibleTarget.x, lookZ: visibleTarget.z, id: view.companionId, sprint: step?.running,
    });
    model.reflections?.update(renderer, camera, time, darkness, {
      mobile: cssWidth < 550, reducedMotion: reduced, enabled: renderCost < 16 || !step,
    });
    renderer.render(scene, camera);
    display.drawImage(surface, 0, 0);
    const sinceFade = time - view.fadedAt;
    if (!reducedMotion.matches && sinceFade < fieldFadeDuration) {
      display.fillStyle = `rgba(22, 32, 37, ${Math.max(0, 1 - sinceFade / fieldFadeDuration)})`;
      display.fillRect(0, 0, width, height);
    }
    if (!sceneChanged) renderCost += (performance.now() - drawStarted - renderCost) * .11;
  }

  function projectPoint(x: number, y: number) {
    const point = pointAt(x / TILE, y / TILE);
    projected.set(point.x, 0, point.z).project(camera);
    return { x: (projected.x + 1) * width / 2, y: (1 - projected.y) * height / 2, scale: height / (span * TILE) };
  }

  function pointInWorld(x: number, y: number) {
    const ray = screenRay(x, y);
    if (!ray.intersectPlane(ground, planeHit) || cityBlocksRay(ray, ray.origin.distanceTo(planeHit) - .02)) return;
    const point = key === 'harbor' ? ringCoordinates(planeHit.x, planeHit.z) : { x: planeHit.x, z: planeHit.z };
    return { x: point.x * TILE, y: point.z * TILE };
  }

  function hitActor(x: number, y: number, candidates: FieldView['map']['npcs'], doorway: (actor: FieldView['map']['npcs'][number]) => boolean) {
    const ray = screenRay(x, y);
    const radius = cssWidth < 550 ? .49 : .42;
    let nearest: FieldView['map']['npcs'][number] | undefined;
    let best = Infinity;
    for (const actor of candidates) {
      const center = pointAt(actor.x + .5, actor.y + .875);
      obstacle.min.set(center.x - radius, .02, center.z - radius);
      obstacle.max.set(center.x + radius, 2.11, center.z + radius);
      let inside = ray.intersectBox(obstacle, actorHit);
      let entry: string | undefined;
      if (!inside && doorway(actor)) {
        const door = pointAt(actor.x + .5, actor.y - .075);
        obstacle.min.set(door.x - .60, .08, door.z - .32);
        obstacle.max.set(door.x + .60, 2.30, door.z + .32);
        inside = ray.intersectBox(obstacle, actorHit);
        if (actor.event === 'about') entry = 'archive';
      }
      if (!inside) continue;
      const depth = ray.origin.distanceTo(actorHit);
      if (depth < best && !cityBlocksRay(ray, depth - .033, entry)) {
        best = depth;
        nearest = actor;
      }
    }
    return nearest;
  }

  function destroy() {
    pokemon.dispose();
    shadowMap.dispose();
    pinMap.dispose();
    pin.material.dispose();
    glow.dispose();
    for (const { sprite } of lamps) sprite.material.dispose();
    partner.dispose();
    sylveon.dispose();
    hero.dispose();
    effects.dispose();
    for (const { traveler } of locals) traveler.dispose();
    conversationMaps.forEach(texture => texture.dispose());
    conversationMaterials.forEach(material => material.dispose());
    markerGeometry.dispose();
    markerMaterial.dispose();
    shadowGeometry.dispose();
    shadowMaterial.dispose();
    ringSurface.dispose();
    ring.material.dispose();
    dotGeometry.dispose();
    dotMaterial.dispose();
    cache.forEach(model => { model.optics?.dispose(); model.crowd?.dispose(); model.reflections?.dispose(); });
    renderer.dispose();
    renderer.forceContextLoss();
    cache.clear();
  }

  return {
    surface, draw, resize, projectPoint, pointInWorld, hitActor, destroy,
    resetCamera: () => { previousTime = 0; needsFrame = true; },
    getCamera: () => ({ x: aimX * TILE, y: aimZ * TILE, scale: height / (span * TILE), depth, width, height }),
  };
}
