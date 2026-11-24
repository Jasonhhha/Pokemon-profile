import {
  AdditiveBlending,
  CanvasTexture,
  Color,
  DirectionalLight,
  FogExp2,
  Group,
  HemisphereLight,
  Mesh,
  MeshBasicMaterial,
  PCFShadowMap,
  PerspectiveCamera,
  Plane,
  PlaneGeometry,
  PointLight,
  Raycaster,
  Scene,
  Sprite,
  SpriteMaterial,
  SRGBColorSpace,
  Texture,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three';
import { createTraveler } from './field-travelers';
import { createFieldPokemon } from './field-pokemon';
import { fortressMaps, type FortressRoom, type FortressInteriorFrame } from './field-fortress-state';
import { buildFortressStonework } from './fortress-stonework';
import { createKyuremActor } from './fortress-kyurem';
import { createIcePrison } from './fortress-ice-prison';
import { isMazeRoom, mazeFieldMap } from './fortress-maze';
import { buildMazeRoom3D } from './fortress-maze-3d';
import { buildFortressWater } from './fortress-water';

function radialTexture(shadow: boolean) {
  const sheet = document.createElement('canvas');
  sheet.width = sheet.height = 64;
  const pen = sheet.getContext('2d')!;
  const gradient = pen.createRadialGradient(32, 32, 0, 32, 32, 32);
  if (shadow) {
    gradient.addColorStop(0, 'rgba(5,13,16,.86)');
    gradient.addColorStop(0.3, 'rgba(5,13,16,.68)');
    gradient.addColorStop(1, 'rgba(5,13,16,0)');
  } else {
    gradient.addColorStop(0, 'rgba(255,244,196,.9)');
    gradient.addColorStop(0.11, 'rgba(255,226,156,.5)');
    gradient.addColorStop(0.46, 'rgba(255,177,97,.13)');
    gradient.addColorStop(1, 'rgba(255,147,65,0)');
  }
  pen.fillStyle = gradient;
  pen.fillRect(0, 0, 64, 64);
  const texture = new CanvasTexture(sheet);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

function buildRoom(room: FortressRoom, glow: Texture) {
  if (isMazeRoom(room)) return buildMazeRoom3D(room, glow);
  const scene = new Scene();
  const seal = room === 'seal';
  const ambient = seal ? 0x172934 : 0x152320;
  scene.background = new Color(ambient);
  scene.fog = new FogExp2(ambient, seal ? 0.037 : 0.039);
  const stone = buildFortressStonework(room);
  const water = buildFortressWater(room, stone.puddles);
  scene.add(stone.group, water.group);
  scene.add(new HemisphereLight(seal ? 0xcce6f0 : 0xcbd7c9, seal ? 0x657a88 : 0x45534b, seal ? 1.2 : 0.84));
  const key = new DirectionalLight(seal ? 0xf1eddc : 0xffdfa9, seal ? 1.7 : 1.51);
  key.position.set(2.8, 12.8, 13.3);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  Object.assign(key.shadow.camera, { left: -12, right: 12, top: 13, bottom: -13, near: 0.75, far: 38 });
  key.shadow.normalBias = 0.029;
  key.shadow.bias = -0.00024;
  key.shadow.camera.updateProjectionMatrix();
  key.target.position.set(9, 0, 5);
  scene.add(key, key.target);
  const rim = new DirectionalLight(seal ? 0xa8d6ee : 0x8aaea0, seal ? 1.19 : 0.84);
  rim.position.set(14, 8, -4);
  rim.target.position.set(7, 0, 11);
  scene.add(rim, rim.target);
  const glowMaterial = new SpriteMaterial({
    map: glow,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    opacity: 0.79,
  });
  for (const lamp of stone.lamps) {
    const bloom = new Sprite(glowMaterial);
    bloom.position.set(...lamp);
    bloom.scale.setScalar(1.45);
    scene.add(bloom);
  }
  const point = new PointLight(seal ? 0x82e4e4 : 0xecac64, seal ? 36 : 25, 13, 2);
  point.position.set(7.8, 3.25, seal ? 6.7 : 7);
  scene.add(point);
  const near = new PointLight(0xffc681, 22, 12, 2);
  near.position.set(seal ? 11.2 : 4.7, seal ? 2.8 : 3.45, seal ? 15 : 14.5);
  scene.add(near);
  const lampLight = new PointLight(0xffb66d, seal ? 92 : 25, 13, 2);
  lampLight.position.set(seal ? 8.9 : 4.8, seal ? 3.9 : 2.85, seal ? -2.65 : 12.3);
  scene.add(lampLight);
  if (!seal) {
    const stairLamp = new PointLight(0xf2b873, 27, 8, 2);
    stairLamp.position.set(8.4, 0.75, -0.86);
    scene.add(stairLamp);
  }
  const monster = seal ? createKyuremActor() : undefined;
  const prison = seal ? createIcePrison() : undefined;
  const muzzle = new Vector3(),
    eyes = new Vector3();
  if (prison) scene.add(prison.root);
  if (monster) scene.add(monster.root);
  return {
    scene,
    surfaceAt(_x: number, _z: number) {
      return 0;
    },
    update(t: number, w: number, h: number, frame: FortressInteriorFrame) {
      const resonance = frame.resonance ?? 0;
      stone.update(resonance, t, frame.x, frame.y, frame.liftUnlocked);
      point.intensity = (seal ? 39 : 19) + resonance * (seal ? 15 : 9);
      water.update(t, w, h, frame);
      if (monster && prison) {
        monster.update(t, frame.roarAge ?? Infinity, frame.reduced, frame);
        prison.update(t, frame, h, monster.muzzle(muzzle), monster.footprints, monster.eyes(eyes));
      }
    },
    dispose() {
      key.shadow.dispose();
      water.dispose();
      stone.dispose();
      glowMaterial.dispose();
      monster?.dispose();
      prison?.dispose();
    },
  };
}

export function createFortressInterior3D(canvas: HTMLCanvasElement) {
  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFShadowMap;
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.setPixelRatio(1);
  const shadowMap = radialTexture(true);
  const glow = radialTexture(false);
  const traveler = createTraveler('player');
  traveler.model.traverse(child => {
    if (child instanceof Mesh) child.castShadow = true;
  });
  const friends = createFieldPokemon(shadowMap);
  const companion = friends.actor('piplup');
  const actorShadowGeometry = new PlaneGeometry(1.16, 0.88).rotateX(-Math.PI / 2);
  const actorShadowMaterial = new MeshBasicMaterial({ map: shadowMap, transparent: true, depthWrite: false });
  const actorShadow = new Mesh(actorShadowGeometry, actorShadowMaterial);
  const camera = new PerspectiveCamera(44, 1, 0.1, 78);
  const ray = new Raycaster();
  const mouse = new Vector2();
  const target = new Vector3();
  const floor = new Plane(new Vector3(0, 1, 0), 0);
  const rooms = new Map<FortressRoom, ReturnType<typeof buildRoom>>();
  let width = 0,
    height = 0;
  let active: FortressRoom | undefined;
  let shortcutOpen = false;
  let lastFrame = -Infinity;
  let closeBlend = 0;
  let entryTime = -Infinity;
  let entryX = 0,
    entryZ = 0;
  let disposed = false;
  return {
    draw(frame: FortressInteriorFrame) {
      if (disposed || !canvas.width || !canvas.height) return;
      if (width !== canvas.width || height !== canvas.height) {
        width = canvas.width;
        height = canvas.height;
        renderer.setSize(width, height, false);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
      }
      let room = rooms.get(frame.room);
      if (!room) {
        room = buildRoom(frame.room, glow);
        rooms.set(frame.room, room);
      }
      const entering = active !== frame.room;
      if (entering) {
        room.scene.add(traveler.model, companion.root, actorShadow);
        companion.reset();
        active = frame.room;
        entryTime = frame.now;
        entryX = frame.x;
        entryZ = frame.y;
      }
      const isSeal = frame.room === 'seal';
      shortcutOpen = frame.shortcutOpen;
      const requested = Number(isSeal && frame.inspecting);
      const elapsed = frame.now - lastFrame;
      if (entering || frame.reduced || elapsed < 0 || elapsed > 260) closeBlend = requested;
      else closeBlend += (requested - closeBlend) * (1 - Math.exp(-elapsed / 105));
      lastFrame = frame.now;
      if (
        frame.reduced ||
        frame.inspecting ||
        frame.gaitPhase !== undefined ||
        Math.hypot(frame.x - entryX, frame.y - entryZ) > 0.1
      )
        entryTime = -Infinity;
      const progress = Math.min(1, Math.max(0, (frame.now - entryTime) / 1000));
      const entry = 1 - progress * progress * (3 - 2 * progress);
      if (isMazeRoom(frame.room)) {
        const fit = Math.max(1, 1.1 / camera.aspect);
        const margin = Math.min(5.8, 3.55 * camera.aspect);
        const focusX = Math.max(margin, Math.min(23 - margin, frame.x));
        const focusZ = Math.max(4.52, Math.min(18.85, frame.y - 1.9));
        camera.position.set(focusX + 1.15 * fit, 0.2 + 7.85 * fit, focusZ + 8.5 * fit);
        camera.lookAt(focusX, 0.2, focusZ);
      } else {
        const focusX = isSeal ? 8.5 + (frame.x - 8.5) * 0.32 * (1 - closeBlend) : frame.x;
        const wideZ = isSeal ? 6.35 + (frame.y - 6.35) * 0.6 : frame.y - 3.89;
        const focusZ = wideZ + (6.64 - wideZ) * closeBlend - entry * 0.58;
        const fit = Math.max(1, (isSeal ? 1.49 : 1.2) / camera.aspect);
        const eyeZ = isSeal ? 12.65 - 0.6 * closeBlend : 11.0;
        const eyeY = isSeal ? 8.6 - 1.7 * closeBlend : 5.83;
        let shakeX = 0,
          shakeY = 0;
        const since = (frame.roarAge ?? Infinity) - 0.78;
        if (isSeal && !frame.reduced && since >= 0 && since < 0.74) {
          const impulse = 0.074 * Math.sin((Math.min(1, since / 0.045) * Math.PI) / 2) * Math.exp(-since * 7.1);
          shakeX = impulse * Math.sin(since * 42);
          shakeY = impulse * 0.56 * Math.sin(since * 51);
        }
        camera.position.set(
          focusX + (isSeal ? 1.12 + 0.12 * closeBlend : 0.48) + shakeX,
          (eyeY + entry * 0.77) * fit + shakeY,
          focusZ + (eyeZ + entry * 1.34) * fit,
        );
        camera.lookAt(
          focusX + shakeX * 0.61,
          (isSeal ? 1.11 + 0.46 * closeBlend : 0.71) + entry * 0.47 + shakeY * 0.61,
          focusZ,
        );
      }
      camera.updateMatrixWorld();
      const time = frame.reduced ? 1.75 : frame.now / 1000;
      room.update(time, width, height, frame);
      const support = room.surfaceAt(frame.x, frame.y);
      traveler.model.position.set(frame.x, support, frame.y);
      actorShadow.position.set(frame.x, support + 0.02, frame.y);
      traveler.pose({ time: frame.now, facing: frame.facing, phase: frame.gaitPhase, reduced: frame.reduced });
      companion.update(frame.companionImage, {
        x: frame.companionX ?? frame.x,
        z: frame.companionY ?? frame.y + 0.72,
        lookX: frame.x,
        lookZ: frame.y,
        time: frame.now,
        reduced: frame.reduced,
        night: 0.25,
        camera,
        guided: true,
        id: frame.companionId,
      });
      companion.root.position.y = room.surfaceAt(companion.root.position.x, companion.root.position.z);
      renderer.render(room.scene, camera);
    },
    projectPoint(worldX: number, worldY: number) {
      target.set(worldX, 0, worldY).project(camera);
      return { x: ((target.x + 1) * width) / 2, y: ((1 - target.y) * height) / 2 };
    },
    pointInWorld(px: number, py: number) {
      if (!active || !width || !height) return;
      mouse.set((px / width) * 2 - 1, 1 - (py / height) * 2);
      ray.setFromCamera(mouse, camera);
      if (!ray.ray.intersectPlane(floor, target)) return;
      const map = isMazeRoom(active) ? mazeFieldMap(active, shortcutOpen) : fortressMaps[active];
      const tileX = Math.floor(target.x),
        tileY = Math.floor(target.z);
      const walkable = map.walkable[tileY]?.[tileX];
      const room = rooms.get(active);
      if (room && 'landmarkAt' in room) {
        const sign = room.landmarkAt(ray);
        if (sign && (!walkable || Math.abs(Math.floor(sign.x) - tileX) + Math.abs(Math.floor(sign.y) - tileY) >= 2))
          return sign;
      }
      if (walkable) return { x: target.x, y: target.z };
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const room of rooms.values()) room.dispose();
      rooms.clear();
      traveler.dispose();
      companion.dispose();
      friends.dispose();
      actorShadowGeometry.dispose();
      actorShadowMaterial.dispose();
      shadowMap.dispose();
      glow.dispose();
      renderer.dispose();
    },
  };
}
