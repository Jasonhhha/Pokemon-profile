import { palaceOverlook } from './palace-overlook';
import {palaceView} from './fortress-palace-camera';
import { buildPalaceGatehouse } from './fortress-palace-gatehouse-3d';
import { buildPalaceRisers } from './fortress-risers-3d';
import { palaceFloorRay } from './fortress-palace-picking';
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
import { isMazeRoom, palaceElevation } from './fortress-maze';
import { buildMazeRoom3D } from './fortress-maze-3d';
import { buildFortressWater } from './fortress-water';
import { hallSupport, pickPalacePortal } from './fortress-portals';

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
  const ambient = seal ? 0x172934 : 0x23373b;
  scene.background = new Color(ambient);
  scene.fog = new FogExp2(ambient, seal ? 0.037 : 0.024);
  const stone = buildFortressStonework(room);
  const water = buildFortressWater(room);
  scene.add(stone.group, water.group);
  const gatehouse = room === 'sluice' ? buildPalaceGatehouse() : undefined;
  if (gatehouse) scene.add(gatehouse.group);
  scene.add(new HemisphereLight(seal ? 0xcce6f0 : 0xcbd7c9, seal ? 0x657a88 : 0x45534b, seal ? 1.2 : 1.04));
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
  const rim = new DirectionalLight(seal ? 0xa8d6ee : 0xa8c7bd, seal ? 1.19 : 1.04);
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
    for (const x of [5.45, 11.55]) {
      const galleryLamp = new PointLight(0xffd39c, 21, 11, 2);
      galleryLamp.position.set(x, 6.9, 9.3);
      scene.add(galleryLamp);
    }
  }
  const monster = seal ? createKyuremActor() : undefined;
  const prison = seal ? createIcePrison() : undefined;
  const muzzle = new Vector3(),
    eyes = new Vector3();
  if (prison) scene.add(prison.root);
  if (monster) scene.add(monster.root);
  return {
    scene,
    landmarkAt(ray: Raycaster) { return prison?.landmarkAt(ray); },
    handwheel(frame: FortressInteriorFrame) { return prison?.handwheel(frame); },
    surfaceAt(x: number, z: number) {
      return hallSupport(room, x, z);
    },
    update(t: number, w: number, h: number, frame: FortressInteriorFrame) {
      const resonance = frame.resonance ?? 0;
      gatehouse?.update(frame.power?.bus ?? .78);
      stone.update(resonance, t, frame.x, frame.y, frame.liftUnlocked,frame.power?.bus,frame.power?.phase);
      point.intensity = (seal ? 24 + (frame.power?.source ?? .82) * 19 : 14+(frame.power?.bus??.78)*7) + resonance * (seal ? 15 : 9);
      water.update(t, w, h, frame);
      if (monster && prison) {
        monster.update(t, frame.roarAge ?? Infinity, frame.reduced, frame);
        prison.update(t, frame, h, monster.muzzle(muzzle), monster.footprints, monster.eyes(eyes), monster.crystals);
      }
    },
    dispose() {
      key.shadow.dispose();
      water.dispose();
      stone.dispose();
      gatehouse?.dispose();
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
  const camera = new PerspectiveCamera(44, 1, 0.1, 240);
  const ray = new Raycaster();
  const mouse = new Vector2();
  const target = new Vector3();
  const floor = new Plane(new Vector3(0, 1, 0), 0);
  const risers = new Map<FortressRoom, ReturnType<typeof buildPalaceRisers>>();
  const rooms = new Map<FortressRoom, ReturnType<typeof buildRoom>>();
  let width = 0,
    height = 0;
  let active: FortressRoom | undefined;
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
        if (frame.room !== 'seal') {
          const pair = buildPalaceRisers(frame.room);
          risers.set(frame.room, pair);
          room.scene.add(pair.group);
        }
      }
      const entering = active !== frame.room;
      if (entering) {
        camera.fov = frame.room === 'sluice' ? 53 : 44;
        camera.updateProjectionMatrix();
        room.scene.add(traveler.model, companion.root, actorShadow);
        companion.reset();
        active = frame.room;
        entryTime = frame.now;
        entryX = frame.x;
        entryZ = frame.y;
      }
      const isSeal = frame.room === 'seal';
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
        const reveal=entryZ>40 && Math.abs(entryX-24.5)<3 ? entry : 0;
        const view=palaceView(frame.room,frame.x,frame.y,camera.aspect,reveal);
        camera.position.set(...view.eye);camera.lookAt(...view.aim);
      } else {
        const dx = frame.x - 8.5;
        const sideWeight = isSeal ? Math.min(1, Math.max(0, (Math.abs(dx) - 1.05) / 3.6)) : 0;
        const wing = sideWeight * sideWeight * (3 - 2 * sideWeight) * (1 - closeBlend);
        const focusX = isSeal ? 8.5 + dx * (0.32 + 0.54 * wing) * (1 - closeBlend) : frame.x;
        // The outer landing is behind the processional view. Ease the camera back before the return steps leave the screen.
        const south = Math.max(0, Math.min(1, (frame.y - 12.55) / 4.1));
        const approach = south * south * (3 - 2 * south);
        const wideZ = isSeal ? 6.35 + (frame.y - 6.35) * (0.6 + 0.33 * wing) - 0.65 * wing : frame.y - 5.65 + .96 * approach;
        const focusZ = wideZ + (6.64 - wideZ) * closeBlend - entry * 0.58;
        const fit = Math.max(1, (isSeal ? 1.49 - 0.35 * wing : 1.2) / camera.aspect);
        const eyeZ = isSeal ? 12.65 - 0.6 * closeBlend - 4.0 * wing : 16.25 + 5.3 * approach;
        const eyeY = isSeal ? 8.6 - 1.7 * closeBlend + 0.87 * wing : 6.13 + .58 * approach;
        let shakeX = 0,
          shakeY = 0;
        const since = (frame.roarAge ?? Infinity) - 0.78;
        if (isSeal && !frame.reduced && since >= 0 && since < 0.74) {
          const impulse = 0.074 * Math.sin((Math.min(1, since / 0.045) * Math.PI) / 2) * Math.exp(-since * 7.1);
          shakeX = impulse * Math.sin(since * 42);
          shakeY = impulse * 0.56 * Math.sin(since * 51);
        }
        camera.position.set(
          focusX + (isSeal ? 1.12 + 0.12 * closeBlend + (Math.sign(dx)*.70-1.12)*wing : 0.48) + shakeX,
          (eyeY + entry * 0.77) * fit + shakeY,
          focusZ + (eyeZ + entry * 1.34) * fit,
        );
        camera.lookAt(
          focusX + shakeX * 0.61,
          (isSeal ? 1.11 + 0.46 * closeBlend : 2.64 + 1.00 * approach) + entry * 0.65 + shakeY * 0.61,
          focusZ,
        );
      }
      if (frame.palaceView && isMazeRoom(frame.room)) {
        const overlook = palaceOverlook(frame.palaceView, camera.aspect);
        camera.position.set(...overlook.eye);
        camera.lookAt(...overlook.aim);
      }
      camera.updateMatrixWorld();
      const time = frame.reduced ? 1.75 : frame.now / 1000;
      room.update(time, width, height, frame);
      risers.get(frame.room)?.update(frame);
      const support = room.surfaceAt(frame.x, frame.y);
      traveler.model.position.set(frame.x, support, frame.y);
      actorShadow.position.set(frame.x, support + 0.02, frame.y);
      traveler.pose({
        time: frame.now,
        facing: frame.facing,
        phase: frame.gaitPhase,
        reduced: frame.reduced,
        handwheel: 'handwheel' in room ? room.handwheel(frame) : undefined,
      });
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
      const y=active ? (isMazeRoom(active)?palaceElevation(active,worldX,worldY):hallSupport(active,worldX,worldY)) : 0;
      target.set(worldX, y, worldY).project(camera);
      return { x: ((target.x + 1) * width) / 2, y: ((1 - target.y) * height) / 2 };
    },
    pointInWorld(px: number, py: number) {
      if (!active || !width || !height) return;
      mouse.set((px / width) * 2 - 1, 1 - (py / height) * 2);
      ray.setFromCamera(mouse, camera);
      const sign = rooms.get(active)?.landmarkAt(ray);
      if (sign) return sign;
      if (isMazeRoom(active)) return palaceFloorRay(active,ray.ray.origin,ray.ray.direction);
      const grounded = ray.ray.intersectPlane(floor, target);
      const walkable = grounded && fortressMaps[active].walkable[Math.floor(target.z)]?.[Math.floor(target.x)];
      const entrance = pickPalacePortal(active, ray.ray.origin, ray.ray.direction, Boolean(walkable));
      if (entrance) return entrance;
      if (walkable) return { x: target.x, y: target.z };
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const pair of risers.values()) pair.dispose();
      risers.clear();
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
