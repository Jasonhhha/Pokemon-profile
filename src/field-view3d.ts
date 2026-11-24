import {
  ACESFilmicToneMapping, AdditiveBlending, Box3, CanvasTexture, Color, DirectionalLight, EqualStencilFunc, FogExp2,
  GreaterDepth, Group, HemisphereLight, IncrementStencilOp, Mesh, MeshBasicMaterial, OrthographicCamera,
  PCFShadowMap, PerspectiveCamera, Plane, PlaneGeometry, PointLight, Ray, Raycaster, ReplaceStencilOp,
  RingGeometry, Scene, Sprite, SpriteMaterial, SRGBColorSpace, Vector2, Vector3, WebGLRenderer,
  type Intersection, type Material, type Object3D,
} from 'three';
import { props, TILE, type FieldArea } from './field-layout';
import { cityLighthouseSite, harborHeight } from './field-city-layout';
import { updateCityArchitecture } from './field-city-models';
import type { SurveyId } from './field-city-walks';
import { buildRingArchitecture } from './field-ring-architecture';
import { buildRingGates } from './field-ring-gates';
import { buildRingGround } from './field-ring-ground';
import { fortressLiftDepth } from './field-fortress-state';
import { buildFortressExterior, fortressPanorama, fortressRadius, fortressShot } from './field-fortress-exterior';
import { frameStreetSubject, harborAerialCamera, harborOverviewYaw, ringStreetLooksOutward, ringStreetRow } from './field-ring-coordinates';
import { buildRingTerraces } from './field-ring-terraces';
import { RING_PERIOD, ringAngle, ringCoordinates, ringPosition, ringRadius, ringXDelta } from './field-ring-space';
import { buildCityFerry } from './field-city-ferry';
import { buildCityCrowd } from './field-city-crowd';
import { buildCityLight } from './field-city-light';
import { buildCityReflections } from './field-city-reflections';
import { buildCityStreet, type CityLamp } from './field-city-street';
import { buildRingTransit } from './field-ring-transit';
import { buildFieldDressing } from './field-dressing';
import { createFieldEffects } from './field-effects';
import { createFieldPokemon, type FieldSpriteLight } from './field-pokemon';
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
  [0, 0], [-.33, .035], [.33, .035], [-.63, .07], [.63, .07], [-.91, .12], [.91, .12],
  [0, .17], [-.44, .21], [.44, .21], [-.75, .25], [.75, .25], [-1.10, .29], [1.10, .29],
  [0, .36], [-.34, .43], [.34, .43], [0, .52], [-.28, .62], [.28, .62], [0, .73],
] as const;
const nearAlleyAngles = [[-.82, .06], [.82, .06], [-1.13, .09], [1.13, .09], [-.5, .15], [.5, .15]] as const;
const steepAlleyAngles = [[-.72, .83], [.72, .83], [-1.12, .83], [1.12, .83], [0, .83]] as const;
const fieldCameraDistance = 34;
type StreetView = { yaw: number; pitch: number; distance: number; inset: number; lateral: number };

function streetDistance(compact: boolean, row: number) {
  if (row >= 23) return compact ? 12.5 : 14.1;
  return compact ? 14.0 : 16.1;
}

function streetCenter(column: number, row: number, compact: boolean, outward: boolean, inset = 0, lateral = 0) {
  const lead = (compact ? .86 : 1.30) + inset;
  const point = ringPosition(column + (outward ? -.18 : .18), row + (outward ? lead : -lead));
  const tangent = ringAngle(column);
  point.x += lateral * Math.cos(tangent);
  point.z -= lateral * Math.sin(tangent);
  return point;
}

function streetPitch(row: number, outward: boolean) {
  return (outward ? .49 : row >= 23 ? .56 : .64) + .16 * Math.min(1, Math.max(0, (8.4 - row) / 3.9));
}

const atmospheres = {
  harbor: { day: 0x93aeb9, night: 0x213754, ground: 0xa79680 },
  grove: { day: 0x8aa597, night: 0x303f51, ground: 0x7b9977 },
  summit: { day: 0x96a9bd, night: 0x3a4567, ground: 0x9a8b9a },
  home: { day: 0x343237, night: 0x343237, ground: 0xc9926c },
  lab: { day: 0x273b40, night: 0x273b40, ground: 0x87aaa2 },
  tower: { day: 0x373746, night: 0x373746, ground: 0x928cb0 },
};

type SceneKey = keyof typeof atmospheres;
type SceneModel = Omit<ReturnType<typeof buildFieldTerrain>, 'update'> & {
  update: (time: number, night: number, pumpElapsed?: number, fortress?: FieldView['fortress'], resonance?: number) => void;
  lamps?: CityLamp[];
  optics?: ReturnType<typeof buildCityLight>;
  crowd?: ReturnType<typeof buildCityCrowd>;
  reflections?: ReturnType<typeof buildCityReflections>;
  dispose?: () => void;
  occluders?: { object: Object3D; bounds: Box3 }[];
};
type SpriteShade = { x: number; z: number; at: number; shaded: number };

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

function hiddenTraveler(model: Group) {
  const silhouette = new MeshBasicMaterial({
    color: 0xd7ece6, transparent: true, toneMapped: false, fog: false,
    depthWrite: false, depthFunc: GreaterDepth,
    stencilWrite: true, stencilFunc: EqualStencilFunc, stencilRef: 0, stencilZPass: IncrementStencilOp,
  });
  const parts: Mesh[] = [];
  model.traverse(object => { if (object instanceof Mesh) parts.push(object); });
  const markedMaterials = new Map<Material, Material>();
  const overlays: Mesh[] = [];
  for (const part of parts) {
    if (Array.isArray(part.material)) continue;
    let marked = markedMaterials.get(part.material);
    if (!marked) {
      marked = part.material.clone();
      marked.stencilRef = 1;
      marked.stencilZPass = ReplaceStencilOp;
      markedMaterials.set(part.material, marked);
    }
    part.material = marked;
    // World geometry must fill the depth buffer before the visible body marks its pixels.
    part.renderOrder = 5;
    const overlay = new Mesh(part.geometry, silhouette);
    overlay.visible = false;
    overlay.renderOrder = 18;
    part.add(overlay);
    overlays.push(overlay);
  }
  let visible = false;
  return {
    show(opacity: number) {
      silhouette.opacity = opacity * .55;
      const active = opacity > .06;
      if (visible === active) return;
      visible = active;
      overlays.forEach(part => { part.visible = active; });
      markedMaterials.forEach(material => { material.stencilWrite = active; });
    },
    dispose() {
      silhouette.dispose();
      markedMaterials.forEach(material => material.dispose());
    },
  };
}

export function createFieldView3d(canvas: HTMLCanvasElement, reducedMotion: MediaQueryList) {
  const surface = document.createElement('canvas');
  const context = surface.getContext('webgl2', { alpha: false, antialias: true, depth: true, stencil: true });
  const displayContext = canvas.getContext('2d', { alpha: false });
  if (!context || !displayContext) return;
  const display = displayContext;

  const stencil = context.getParameter(context.STENCIL_BITS) > 0;
  const renderer = new WebGLRenderer({ canvas: surface, context, alpha: false, antialias: true, stencil });
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
  const streetCamera = new OrthographicCamera(-1, 1, 1, -1, .1, 115);
  const harborCamera = new PerspectiveCamera(35, 1, .25, 280);
  let camera: OrthographicCamera | PerspectiveCamera = streetCamera;
  const ambient = new HemisphereLight(0xe2f4ff, 0xb2a576, 2.05);
  scene.add(ambient);
  const sun = new DirectionalLight(0xffe0af, 2.2);
  sun.castShadow = true;
  const shadowCamera = sun.shadow.camera;
  shadowCamera.left = shadowCamera.bottom = -21;
  shadowCamera.right = shadowCamera.top = 21;
  shadowCamera.near = .5;
  shadowCamera.far = 88;
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
  const aerialDay = new Color(0x9dbbcd);
  const aerialNight = new Color(0x24395c);
  const eveningSun = new Color(0xffb272);
  const horizonTint = new Color();
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
  const silhouette = stencil ? hiddenTraveler(hero.model) : undefined;
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
  let locals: { npc: FieldView['map']['npcs'][number]; traveler: ReturnType<typeof createTraveler>; marker: Sprite; pickBounds: Box3 }[] = [];
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
  let previousFortressShot = false;
  let previousOrbitOffset = 0;
  let previousOrbitTilt = 0;
  let renderCost = 4;
  let darkness = 0;
  let cssWidth = 0;
  let cssHeight = 0;
  let width = 0;
  let height = 0;
  let depth = 0;
  let aerialAmount = 0;
  let aimX = 0;
  let aimZ = 0;
  let span = 12;
  let viewYaw = .26;
  let viewPitch = .70;
  let viewElevation = 0;
  let viewDistance = fieldCameraDistance;
  let shadowX = NaN;
  let shadowZ = NaN;
  let shadowExtent = 21;
  let needsFrame = true;

  const raycaster = new Raycaster();
  const pointer = new Vector2();
  const projected = new Vector3();
  const ground = new Plane(new Vector3(0, 1, 0), 0);
  const planeHit = new Vector3();
  const obstacle = new Box3();
  const actorHit = new Vector3();
  const cameraLine = new Ray();
  const lightLine = new Ray();
  const shadowCaster = new Raycaster();
  const hits: Intersection[] = [];
  const cameraProbe = new Vector3();
  const alleyView = new Map<number, StreetView>();
  let pinVisibility = 0;
  const companionShade: SpriteShade = { x: 0, z: 0, at: -Infinity, shaded: 0 };
  const guideShade: SpriteShade = { x: 0, z: 0, at: -Infinity, shaded: 0 };

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

  function hiddenFrom(origin: Vector3, x: number, z: number, elevation = 1.02) {
    cameraLine.origin.copy(origin);
    cameraLine.direction.set(x, elevation, z).sub(origin);
    const range = cameraLine.direction.length();
    cameraLine.direction.divideScalar(range);
    return cityBlocksRay(cameraLine, range - .045);
  }

  function spriteLight(point: { x: number; z: number }, time: number, memory: SpriteShade): FieldSpriteLight {
    const moved = Math.hypot(point.x - memory.x, point.z - memory.z);
    if (darkness < .96 && (time - memory.at > 110 || moved > .47)) {
      lightLine.origin.set(point.x, .51, point.z);
      lightLine.direction.copy(sun.position).sub(sun.target.position).normalize();
      memory.shaded = Number(cityBlocksRay(lightLine, 30));
      memory.x = point.x;
      memory.z = point.z;
      memory.at = time;
    }
    let lamplight = 0;
    for (const light of localLights) {
      if (light.intensity < .07) continue;
      const distance = Math.hypot(light.position.x - point.x, light.position.y - .54, light.position.z - point.z);
      lamplight = Math.max(lamplight, Math.max(0, 1 - distance / 4.25) ** 1.4 * 1.55);
    }
    return { shade: memory.shaded, lamplight: Math.min(1, lamplight) };
  }

  function alleyCamera(column: number, row: number, compact: boolean, farSubject: boolean) {
    const tile = (row * RING_PERIOD + column) * 4 + Number(compact) * 2 + Number(farSubject);
    const cached = alleyView.get(tile);
    if (cached) return cached;
    const streetRow = ringStreetRow(row);
    const outward = ringStreetLooksOutward(column, row);
    const yaw = ringAngle(column + .5) + (outward ? Math.PI - .26 : .27);
    const pitch = streetPitch(streetRow, outward);
    const { x, z } = ringPosition(column + .5, streetRow);
    const radius = streetDistance(compact, row);
    let partial: StreetView | undefined;
    function choose(angles: readonly (readonly [number, number])[], distance: number, inset = 0, lateral = 0) {
      const center = streetCenter(column + .5, streetRow, compact, outward, inset, lateral);
      for (const [yawBias, pitchBias] of angles) {
        const look = yaw + yawBias, tilt = Math.min(1.45, pitch + pitchBias);
        const flat = distance * Math.cos(tilt);
        cameraProbe.set(center.x + flat * Math.sin(look), .78 + distance * Math.sin(tilt), center.z + flat * Math.cos(look));
        if (lateral && cache.get('harbor')?.occluders?.some(({ object, bounds }) =>
          (object.userData.parcel || object.userData.buildingIds) && bounds.containsPoint(cameraProbe))) continue;
        const shot = { yaw: yawBias, pitch: tilt - pitch, distance, inset, lateral };
        const headVisible = !hiddenFrom(cameraProbe, x, z, 1.32);
        if (headVisible && !hiddenFrom(cameraProbe, x, z, .15)) {
          if (!lateral) return shot;
          const sideX = Math.cos(look) * .22, sideZ = -Math.sin(look) * .22;
          if (!hiddenFrom(cameraProbe, x + sideX, z + sideZ, .81) &&
            !hiddenFrom(cameraProbe, x - sideX, z - sideZ, .81)) return shot;
        }
        if (!lateral && !partial && headVisible) partial = shot;
      }
    }
    const civic = column >= 12 && column <= 13 && row >= 11 && row <= 13;
    const salt = column >= 23 && column <= 24 && row >= 34 && row <= 35;
    const close = !farSubject && (civic || salt);
    const fallbackPitch = stencil && row <= 6 ? 1.05 : 1.445;
    const result = (close ? choose([[civic ? .57 : -.57, .44 - pitch]], compact ? 6.6 : 7.45, 0, civic ? -1.19 : 1.19) : undefined)
      ?? choose(alleyAngles.slice(0, 7), radius)
      ?? (row > 22 ? choose(nearAlleyAngles, radius * .73, 1.42) : undefined)
      ?? choose(alleyAngles.slice(7), radius)
      ?? (row > 22 ? choose(steepAlleyAngles, radius) : undefined)
      ?? partial
      ?? { yaw: 0, pitch: fallbackPitch - pitch, distance: radius, inset: 0, lateral: 0 };
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
        const gateways = buildRingGates();
        const opaque = structures.children.filter(object => object.userData.parcel || object.name === 'ring-observatory');
        opaque.push(...terraces.group.children, ...gateways.gates);
        structures.add(terraces.group, ...gateways.gates);
        let lighthouse: Object3D | undefined;
        const street = buildCityStreet(true);
        const transit = buildRingTransit();
        opaque.push(transit.structure, ...street.occluders);
        const ferry = buildCityFerry();
        const fortressExterior = buildFortressExterior();
        let fortressShadowStep = 0;
        const optics = buildCityLight(street.lamps, true);
        const crowd = buildCityCrowd(shadowMap);
        ground.group.add(structures, street.group, transit.group, ferry.group, optics.group, crowd.group, fortressExterior.group);
        for (const prop of props.harbor) {
          if (prop.kind !== 'beacon' && prop.kind !== 'boat') continue;
          const object = buildFieldProp(prop, area);
          const point = prop.kind === 'beacon' ? ringPosition(cityLighthouseSite.x, cityLighthouseSite.z) : ringPosition(prop.x + .5, prop.y + .82);
          object.position.set(point.x, 0, point.z);
          object.rotation.y = ringAngle(prop.x + .5);
          ground.group.add(object);
          if (prop.kind === 'beacon') {
            object.scale.set(cityLighthouseSite.widthScale, 1, cityLighthouseSite.widthScale);
            opaque.push(object);
            lighthouse = object;
          }
        }
        ground.group.updateMatrixWorld(true);
        const occluders = opaque.map(object => ({ object, bounds: new Box3().setFromObject(object) }));
        const reflections = buildCityReflections(structures, lighthouse);
        ground.group.add(reflections.group);
        model = {
          group: ground.group,
          lamps: street.lamps,
          optics, crowd, occluders, reflections,
          dispose() { ferry.dispose(); gateways.dispose(); transit.dispose(); fortressExterior.dispose(); },
          update(time, night, pumpElapsed, fortress, resonance) {
            const seaDrop = (fortress?.lift ?? 0) * fortressLiftDepth;
            const displacement = fortress?.cinematic ? Math.min(1,seaDrop*.17) * (1 - fortress.drain) : 0;
            ground.update(time, night, aerialAmount, seaDrop, displacement);
            fortressExterior.update(fortress, time, night, aerialAmount > .40, resonance);
            const shadowStep = seaDrop ? 1 + Math.round(Math.max(0, (fortress?.drain ?? 0) - .80) * 20) : 0;
            if (shadowStep !== fortressShadowStep) renderer.shadowMap.needsUpdate = true;
            fortressShadowStep = shadowStep;
            street.update(time, night, pumpElapsed);
            transit.update(time, night);
            ferry.update(time, night, Math.min(1, seaDrop / (fortressLiftDepth * .84)) * 14.2);
            ferry.group.position.y = -seaDrop;
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
      renderer.shadowMap.needsUpdate = true;
      effects.reset();
      companionShade.at = guideShade.at = -Infinity;
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
        const pickBounds = new Box3(new Vector3(npcPoint.x - .61, 0, npcPoint.z - .61),
          new Vector3(npcPoint.x + .61, 2.33, npcPoint.z + .61));
        return { npc, traveler, marker, pickBounds };
      });
      lamps.length = 0;
      if (!room) {
        const positions = props[area].filter(prop => prop.kind === 'beacon' || prop.kind === 'lamp' && area !== 'harbor').map(prop => ({
          beacon: prop.kind === 'beacon',
          ...(area === 'harbor' && prop.kind === 'beacon'
            ? ringPosition(cityLighthouseSite.x, cityLighthouseSite.z) : pointAt(prop.x + .5, prop.y + 1.02)),
          height: prop.kind === 'beacon' ? area === 'summit' ? 2.85 : cityLighthouseSite.lampHeight : 1.53,
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
    const fortress = polar && view.fortress?.cinematic ? fortressShot(view.fortress, width / height, reducedMotion.matches) : undefined;
    if (Boolean(fortress) !== previousFortressShot) previousTime = 0;
    previousFortressShot = Boolean(fortress);
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
    const tour = polar && view.fortress?.phase === 'open'
      ? fortressPanorama(aspect, view.orbitTilt) : harborAerialCamera(aspect, mobile, view.orbitTilt);
    const outward = polar && ringStreetLooksOutward(view.location.x, view.location.y);
    const focus = polar && !panorama && !fortress ? view.surveyFocus : undefined;
    const rustle = polar && !panorama && !focus && !fortress ? view.rustle : undefined;
    const reveal = rustle && Math.abs(ringXDelta(x, rustle.x + .5)) + Math.abs(z - rustle.y - .5) < 7.8
      ? ringPosition(rustle.x + .5, rustle.y + .5) : undefined;
    aerialAmount += ((panorama || fortress ? 1 : 0) - aerialAmount) * lens;
    if (!polar || aerialAmount < .012) aerialAmount = 0;
    const alley = polar ? Math.min(1, Math.max(0, (8.0 - z) / 3.7)) : 0;
    let yaw = panorama ? harborOverviewYaw + view.orbitOffset + (calm ? 0 : Math.sin(time / 8300) * .09)
      : polar ? ringAngle(x) + (outward ? Math.PI - .26 : .27) - .08 * depth : room ? .12 : .33 - .16 * depth;
    let pitch = panorama ? tour.pitch
      : polar ? streetPitch(z, outward) - .045 * depth : room ? .92 : .79 - .08 * depth;
    const bias = !panorama && polar && !focus && !fortress ? alleyCamera(view.location.x, view.location.y, mobile, Boolean(reveal)) : undefined;
    if (bias) {
      yaw += bias.yaw;
      pitch += bias.pitch;
    }
    if (focus) {
      yaw = ringAngle(focus.position.x) + (focus.id === 'station' ? Math.PI - .28 : .29);
      pitch = focus.id === 'garden' ? .82 : .60;
    }
    if (fortress) {
      yaw = fortress.yaw;
      pitch = fortress.pitch;
    }
    const turn = Math.atan2(Math.sin(yaw - viewYaw), Math.cos(yaw - viewYaw));
    viewYaw += turn * lens;
    const turning = polar && !panorama && !fortress && !calm && lens < 1 ? Math.min(.45, Math.max(0, (Math.abs(turn) - 1.05) * .26)) : 0;
    viewPitch += (Math.min(1.45, pitch + turning) - viewPitch) * lens;
    const center = fortress ? fortress.center : panorama ? { x: Math.sin(viewYaw) * tour.advance, z: Math.cos(viewYaw) * tour.advance } : polar
      ? streetCenter(x, z, mobile, outward, bias?.inset, bias?.lateral)
      : room ? { x: x * .42 + 12.1 * .58, z: z * .26 + 8.85 * .74 }
      : { x: x - 1.03, z: z - (mobile ? 1.61 : 2.48) };
    if (focus) {
      const subject = ringPosition(focus.position.x, focus.position.y);
      center.x = subject.x;
      center.z = subject.z;
    } else if (reveal) {
      center.x += (reveal.x - center.x) * .24;
      center.z += (reveal.z - center.z) * .24;
    }
    aimX += (center.x - aimX) * pan;
    aimZ += (center.z - aimZ) * pan;

    const goalSpan = fortress ? fortress.span : focus ? (mobile ? 3.85 : 3.65) : panorama ? tour.span
      : polar ? (mobile ? 7.45 : 8.56) + 1.70 * depth + .62 * alley
      : room ? (mobile ? 10.7 : 12.0)
      : (mobile ? 10.45 : aspect > 2.6 ? 10.8 : 12.85) + depth * 2.92;
    const elevation = fortress ? fortress.center.y : focus ? (focus.id === 'station' || focus.id === 'market' ? .50 : .18) : panorama ? tour.elevation : polar ? .78 : 0;
    span += (goalSpan - span) * lens;
    viewElevation += (elevation - viewElevation) * lens;
    const distance = fortress ? fortress.distance : focus ? 5.2 : panorama ? tour.distance : bias?.distance ?? fieldCameraDistance;
    viewDistance += (distance - viewDistance) * lens;
    const radius = viewDistance;
    if (reveal) {
      const feet = ringPosition(x, z);
      const markerSpan = frameStreetSubject(reveal.x - aimX, reveal.z - aimZ, .30 - viewElevation, viewYaw, viewPitch, aspect, radius);
      const playerSpan = frameStreetSubject(feet.x - aimX, feet.z - aimZ, .70 - viewElevation, viewYaw, viewPitch, aspect, radius);
      span = Math.max(span, markerSpan, playerSpan);
    }
    camera = polar ? harborCamera : streetCamera;
    camera.position.set(aimX + radius * Math.cos(viewPitch) * Math.sin(viewYaw),
      viewElevation + radius * Math.sin(viewPitch), aimZ + radius * Math.cos(viewPitch) * Math.cos(viewYaw));
    camera.lookAt(aimX, viewElevation, aimZ);
    if (polar) {
      harborCamera.aspect = aspect;
      harborCamera.fov = Math.atan(span / (2 * radius)) * 360 / Math.PI;
      harborCamera.near = Math.max(.25, radius * .032);
      harborCamera.far = radius + 230;
    } else {
      streetCamera.left = -span * aspect / 2;
      streetCamera.right = span * aspect / 2;
      streetCamera.top = span / 2;
      streetCamera.bottom = -span / 2;
    }
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();

    const entireCity = polar && aerialAmount > .42;
    const grid = polar ? 6 : 5;
    const viewportX = entireCity ? 0 : Math.round(aimX / grid) * grid;
    const viewportZ = entireCity ? 0 : Math.round(aimZ / grid) * grid;
    const extent = entireCity ? ringRadius(harborHeight + 2) * (view.fortress?.lift ? 1.58 : 1.21) : polar ? (mobile ? 12.4 : 14.8) : 21;
    if (viewportX !== shadowX || viewportZ !== shadowZ || extent !== shadowExtent) {
      shadowX = viewportX;
      shadowZ = viewportZ;
      shadowExtent = extent;
      shadowCamera.left = shadowCamera.bottom = -extent;
      shadowCamera.right = shadowCamera.top = extent;
      shadowCamera.updateProjectionMatrix();
      sun.position.set(shadowX - (polar ? 19.4 : 12), polar ? 19.2 : 24, shadowZ + (polar ? 20.8 : -7));
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
    const frameTime = Math.min(70, Math.max(0, time - lastRender));
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
    const twilight = polar ? 1 - Math.exp(-frameTime / 235) : .14;
    darkness = sceneChanged || reducedMotion.matches ? target : darkness + (target - darkness) * twilight;
    aim(view, x, z, time);
    const sky = atmospheres[sceneKey];
    haze.color.setHex(sky.day).lerp(shadows[sceneKey], darkness);
    haze.color.lerp(horizonTint.copy(aerialDay).lerp(aerialNight, darkness), aerialAmount);
    const city = polar;
    const streetHaze = .253 + darkness * .073;
    const aerialHaze = .245 + darkness * .093;
    haze.density = location.room ? .002 : city ? (streetHaze + (aerialHaze - streetHaze) * aerialAmount) / viewDistance : .0105;
    ambient.color.setHex(city ? 0xd4e5ff : 0xe7f3ff).lerp(nightSky, darkness);
    ambient.groundColor.setHex(sky.ground);
    ambient.intensity = city ? 1.06 + darkness * .28 : 1.72 - darkness * .25;
    sun.color.setHex(city ? 0xffd5a6 : 0xffe3b8).lerp(nightLight, darkness);
    if (city) sun.color.lerp(eveningSun, darkness * (1 - darkness) * 1.27);
    sun.intensity = (city ? 3.0 : 2.26) - darkness * (city ? 2.53 : 1.73);
    sun.shadow.intensity = city ? .93 - darkness * .15 : .76;
    renderer.toneMappingExposure = (city ? 1.02 : 1.045) - darkness * .21;
    renderer.setClearColor(haze.color);
    scene.environmentIntensity = city ? .31 - darkness * .22 : 1;
    for (const [index, { sprite, beacon }] of lamps.entries()) {
      const activeBeacon = beacon && (location.area !== 'summit' || view.beaconLit);
      const flicker = city && !reduced ? .96 + .04 * Math.sin(time * .0071 + index * 2.62) : 1;
      sprite.material.opacity = activeBeacon ? Math.max(.24, darkness * .87) : beacon ? 0 : darkness * (city ? .76 * flicker : .81);
      sprite.visible = sprite.material.opacity > .04;
    }
    const nearbyLights = darkness > .015 && !location.room
      ? lamps.filter(({ sprite, beacon }) => sprite.visible && !beacon).sort((a, b) =>
        Math.hypot(a.sprite.position.x - heroPosition.x, a.sprite.position.z - heroPosition.z) -
        Math.hypot(b.sprite.position.x - heroPosition.x, b.sprite.position.z - heroPosition.z))
      : [];
    localLights.forEach((light, index) => {
      const lamp = nearbyLights[index];
      light.intensity = lamp ? darkness * (city ? 7.4 : 8.4) : 0;
      if (lamp) {
        light.position.copy(lamp.sprite.position);
        if (city) light.position.y -= .34;
      }
    });
    model.update(reduced ? 0 : time, darkness, view.pumpElapsed, view.fortress, view.resonance);
    const cityWideShot = view.overview || previousFortressShot;
    model.crowd?.update(time, x, z, reduced, cssWidth < 545, cityWideShot);
    effects.update(time, view, heroPosition.x, heroPosition.z, progress, darkness, width / cssWidth, reduced);
    const obscured = model.occluders && !cityWideShot &&
      hiddenFrom(camera.position, heroPosition.x, heroPosition.z) ? 1 : 0;
    pinVisibility = reduced ? obscured : pinVisibility + (obscured - pinVisibility) * .27;
    silhouette?.show(cityWideShot ? 0 : pinVisibility);
    pin.visible = !cityWideShot && !silhouette && pinVisibility > .06;
    pin.material.opacity = pinVisibility * .9;
    const guide = location.room ? undefined : view.map.npcs.find(npc => npc.event === 'guide');
    const visibleTarget = activeNpc ? pointAt(activeNpc.x + .5, activeNpc.y + .875) : heroPosition;
    if (guide) {
      const watching = Math.hypot(polar ? ringXDelta(x, guide.x) : x - guide.x, z - guide.y) < 2.5;
      const guideTarget = watching ? heroPosition : pointAt(guide.x + .55, guide.y + .88);
      const position = pointAt(guide.x + 1.23, guide.y + .98);
      sylveon.update(view.sylveon, {
        ...position, time, reduced, camera, night: darkness, lookX: guideTarget.x, lookZ: guideTarget.z, guided: true,
        lighting: polar ? spriteLight(position, time, guideShade) : undefined,
      });
    } else {
      sylveon.root.visible = false;
    }
    const pet = companionPosition(view, progress);
    const petPoint = pointAt(pet.x + .5, polar ? ringStreetRow(pet.y) : pet.y + .875);
    partner.update(companionImage, {
      ...petPoint, camera, time, reduced, night: darkness, passing: pet.passing,
      lookX: visibleTarget.x, lookZ: visibleTarget.z, id: view.companionId, sprint: step?.running,
      lighting: polar && companionImage ? spriteLight(petPoint, time, companionShade) : undefined,
    });
    model.reflections?.update(renderer, camera, time, darkness, {
      mobile: cssWidth < 550, reducedMotion: reduced, enabled: renderCost < 16 || !step,
      basinRadius: view.fortress?.lift ? fortressRadius - .02 : undefined,
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

  function hitSurvey(x: number, y: number): SurveyId | undefined {
    if (key !== 'harbor' || previousOverview || !width || !height) return;
    const ray = screenRay(x, y);
    let nearest: SurveyId | undefined;
    let distance = camera.far;
    for (const { object, bounds } of cache.get(key)?.occluders ?? []) {
      const survey = object.userData.survey as SurveyId | undefined;
      if (!survey || !ray.intersectsBox(bounds)) continue;
      hits.length = 0;
      const hit = raycaster.intersectObject(object, true, hits)[0];
      if (hit && hit.distance < distance) {
        nearest = survey;
        distance = hit.distance;
      }
    }
    if (nearest && !cityBlocksRay(ray, distance - .025)) return nearest;
  }

  function hitActor(x: number, y: number, candidates: FieldView['map']['npcs'], doorway: (actor: FieldView['map']['npcs'][number]) => boolean) {
    const ray = screenRay(x, y);
    const radius = cssWidth < 550 ? .49 : .42;
    let nearest: FieldView['map']['npcs'][number] | undefined;
    let best = Infinity;
    for (const { npc: actor, traveler, marker, pickBounds } of locals) {
      if (!candidates.includes(actor)) continue;
      const center = pointAt(actor.x + .5, actor.y + .875);
      let inside: Vector3 | null = null;
      if (key === 'harbor') {
        if (ray.intersectsBox(pickBounds)) {
          // Mobile target padding should not turn the cobbles in front of a person into a doorway.
          hits.length = 0;
          raycaster.intersectObject(traveler.model, true, hits);
          if (marker.visible) raycaster.intersectObject(marker, false, hits);
          inside = hits[0]?.point ?? null;
        }
      } else {
        obstacle.min.set(center.x - radius, .02, center.z - radius);
        obstacle.max.set(center.x + radius, 2.11, center.z + radius);
        inside = ray.intersectBox(obstacle, actorHit);
      }
      let entry: string | undefined;
      if (!inside && doorway(actor)) {
        const door = pointAt(actor.x + .5, actor.y - .075);
        obstacle.min.set(door.x - .60, .08, door.z - .32);
        obstacle.max.set(door.x + .60, 2.30, door.z + .32);
        inside = ray.intersectBox(obstacle, actorHit);
        if (actor.event === 'about') entry = 'archive';
      }
      if (!inside) continue;
      const depth = ray.origin.distanceTo(inside);
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
    silhouette?.dispose();
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
    cache.forEach(model => { model.optics?.dispose(); model.crowd?.dispose(); model.reflections?.dispose(); model.dispose?.(); });
    renderer.dispose();
    renderer.forceContextLoss();
    world.clear();
    scene.clear();
    cache.clear();
  }

  return {
    surface, draw, resize, projectPoint, pointInWorld, hitSurvey, hitActor, destroy,
    resetCamera: () => { previousTime = 0; needsFrame = true; },
    hasStreetFrame: () => key === 'harbor' && !previousOverview && !previousFortressShot && width > 0 && height > 0,
    getCamera: () => ({ x: aimX * TILE, y: aimZ * TILE, scale: height / (span * TILE), depth, width, height }),
  };
}
