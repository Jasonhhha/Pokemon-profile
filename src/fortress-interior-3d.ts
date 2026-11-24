import {
  AdditiveBlending,
  Bone,
  CanvasTexture,
  Color,
  DirectionalLight,
  FogExp2,
  Group,
  HemisphereLight,
  Material,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PCFShadowMap,
  PerspectiveCamera,
  Plane,
  PlaneGeometry,
  PointLight,
  Quaternion,
  Raycaster,
  Scene,
  SkinnedMesh,
  Sprite,
  SpriteMaterial,
  SRGBColorSpace,
  Texture,
  TextureLoader,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createTraveler } from './field-travelers';
import { createFieldPokemon } from './field-pokemon';
import { fortressMaps, type FortressRoom, type FortressInteriorFrame } from './field-fortress-state';
import { buildFortressStonework } from './fortress-stonework';
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

function releaseModel(scene: Group) {
  const geometries = new Set<Mesh['geometry']>();
  const materials = new Set<Material>();
  const textures = new Set<Texture>();
  const rigs = new Set<SkinnedMesh['skeleton']>();
  scene.traverse(child => {
    if (!(child instanceof Mesh)) return;
    geometries.add(child.geometry);
    for (const material of Array.isArray(child.material) ? child.material : [child.material]) materials.add(material);
    if (child instanceof SkinnedMesh) rigs.add(child.skeleton);
  });
  for (const material of materials) {
    for (const value of Object.values(material)) if (value instanceof Texture) textures.add(value);
    material.dispose();
  }
  for (const geometry of geometries) geometry.dispose();
  for (const texture of textures) {
    texture.dispose();
    const bitmap = texture.source.data;
    if (typeof ImageBitmap !== 'undefined' && bitmap instanceof ImageBitmap) bitmap.close();
  }
  for (const rig of rigs) rig.dispose();
}

function createKyogre() {
  const root = new Group();
  const creature = new Group();
  root.add(creature);
  const base = import.meta.env.BASE_URL + 'assets/';
  const plateMaterial = new SpriteMaterial({ transparent: true, depthWrite: false });
  const plate = new Sprite(plateMaterial);
  plate.scale.set(8.9, 8.9, 1);
  plate.position.set(8.5, -0.7, 6.5);
  plate.visible = false;
  root.add(plate);
  let model: Group | undefined;
  let disposed = false;
  const plateTexture = new TextureLoader().load(base + 'kyogre.png', texture => {
    if (disposed) return;
    texture.colorSpace = SRGBColorSpace;
    plateMaterial.map = texture;
    plateMaterial.needsUpdate = true;
    plate.visible = !model;
  });
  type Motion = { bone: Bone; rest: Quaternion; axis: Vector3; strength: number; offset: number; speed: number };
  const motions: Motion[] = [];
  const seaClock = { value: 0 };
  const swing = new Quaternion();
  new GLTFLoader().load(
    base + 'kyogre.glb',
    ({ scene }) => {
      if (disposed) {
        releaseModel(scene);
        return;
      }
      scene.updateMatrixWorld(true);
      scene.traverse(object => {
        if (object instanceof Mesh) {
          object.frustumCulled = false;
          const skin = object.material;
          if (skin instanceof MeshStandardMaterial) {
            // These three white masks are exported as overlays for the original game's glow pass.
            // At rest the markings are the red lines on the underlying diffuse textures.
            if (/^Material_(49|50|51)$/.test(skin.name)) object.visible = false;
            skin.roughness = 0.53;
            skin.onBeforeCompile = shader => {
              shader.uniforms.vaultClock = seaClock;
              shader.vertexShader =
                'varying vec3 seaPosition;\n' +
                shader.vertexShader.replace(
                  '#include <project_vertex>',
                  '#include <project_vertex>\n seaPosition=(modelMatrix*vec4(transformed,1.)).xyz;',
                );
              shader.fragmentShader =
                'varying vec3 seaPosition; uniform float vaultClock;\n' +
                shader.fragmentShader.replace(
                  '#include <color_fragment>',
                  `
              #include <color_fragment>
              float depth=1.-smoothstep(-1.62,-.52,seaPosition.y);
              float s=sin(seaPosition.x*3.27+sin(seaPosition.z*2.51+vaultClock*.80)+vaultClock*.6);
              float r=sin(seaPosition.z*3.91-seaPosition.x*.72-vaultClock*.78);
              float lace=1.-smoothstep(.045,.21,abs(s+r));
              diffuseColor.rgb*=mix(vec3(1.),vec3(.72,.89,.93),depth);
              diffuseColor.rgb+=vec3(.024,.059,.043)*lace*(.22+.78*depth);
            `,
                );
            };
            object.castShadow = object.visible;
            object.receiveShadow = true;
          }
        }
        if (!(object instanceof Bone)) return;
        const name = object.name.replace(/_\d+$/, '');
        let strength = 0,
          offset = 0,
          speed = 0.94;
        const axis = new Vector3(0, 0, 1);
        if (/^[LR](Arm|ForeArm)$/.test(name)) {
          strength = (name.startsWith('L') ? 1 : -1) * (name.includes('Fore') ? 0.074 : 0.092);
          offset = name.includes('Fore') ? -0.6 : 0;
        } else if (/^Tail[123]$/.test(name)) {
          axis.set(1, 0, 0);
          const segment = Number(name.at(-1));
          strength = 0.075 + segment * 0.018;
          offset = -segment * 0.55;
          speed = 1.02;
        } else if (name === 'Jaw') {
          axis.set(1, 0, 0);
          strength = 0.025;
          speed = 0.6;
        }
        if (strength) {
          axis.applyQuaternion(object.getWorldQuaternion(new Quaternion()).invert());
          motions.push({ bone: object, rest: object.quaternion.clone(), axis, strength, offset, speed });
        }
      });
      creature.add(scene);
      model = scene;
      plate.visible = false;
    },
    undefined,
    () => {
      /* The local HOME portrait remains available if WebGL image decoding fails. */
    },
  );
  creature.scale.setScalar(0.6);
  return {
    root,
    update(t: number) {
      seaClock.value = t;
      creature.position.set(
        8.5 + 0.065 * Math.sin(t * 0.43),
        -1.16 + 0.085 * Math.sin(t * 0.8),
        6.25 + 0.06 * Math.sin(t * 0.53),
      );
      creature.rotation.set(
        0.055 + 0.025 * Math.sin(t * 0.61),
        -0.62 + 0.042 * Math.sin(t * 0.33),
        -0.025 + 0.025 * Math.sin(t * 0.61),
      );
      plate.position.y = -0.7 + 0.06 * Math.sin(t * 0.8);
      for (const motion of motions) {
        swing.setFromAxisAngle(motion.axis, Math.sin(t * motion.speed + motion.offset) * motion.strength);
        motion.bone.quaternion.copy(motion.rest).multiply(swing);
      }
    },
    dispose() {
      disposed = true;
      if (model) releaseModel(model);
      plateTexture.dispose();
      plateMaterial.dispose();
    },
  };
}

function buildRoom(room: FortressRoom, glow: Texture) {
  const scene = new Scene();
  const seal = room === 'seal';
  const ambient = seal ? 0x172d37 : 0x192c32;
  scene.background = new Color(ambient);
  scene.fog = new FogExp2(ambient, seal ? 0.023 : 0.032);
  const stone = buildFortressStonework(room);
  const water = buildFortressWater(room, stone.puddles);
  scene.add(stone.group, water.group);
  scene.add(new HemisphereLight(0xc3dfe5, 0x47555b, 1.0));
  const key = new DirectionalLight(0xffdaa3, 1.55);
  key.position.set(2.8, 12.8, 13.3);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  Object.assign(key.shadow.camera, { left: -12, right: 12, top: 13, bottom: -13, near: 0.75, far: 38 });
  key.shadow.normalBias = 0.029;
  key.shadow.bias = -0.00024;
  key.shadow.camera.updateProjectionMatrix();
  key.target.position.set(9, 0, 5);
  scene.add(key, key.target);
  const rim = new DirectionalLight(0x88bec4, 1.1);
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
  near.position.set(seal ? 11.2 : 3, 2.8, seal ? 15 : 13.2);
  scene.add(near);
  const monster = seal ? createKyogre() : undefined;
  if (monster) scene.add(monster.root);
  return {
    scene,
    update(t: number, w: number, h: number, frame: FortressInteriorFrame) {
      water.update(t, w, h, frame);
      monster?.update(t);
    },
    dispose() {
      key.shadow.dispose();
      water.dispose();
      stone.dispose();
      glowMaterial.dispose();
      monster?.dispose();
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
  let lastFrame = -Infinity;
  let closeBlend = 0;
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
      }
      const isSeal = frame.room === 'seal';
      const requested = Number(isSeal && frame.inspecting);
      const elapsed = frame.now - lastFrame;
      if (entering || frame.reduced || elapsed < 0 || elapsed > 260) closeBlend = requested;
      else closeBlend += (requested - closeBlend) * (1 - Math.exp(-elapsed / 105));
      lastFrame = frame.now;
      const focusX = isSeal ? 8.5 + (frame.x - 8.5) * 0.32 * (1 - closeBlend) : 8.5 + (frame.x - 8.5) * 0.68;
      const wideZ = isSeal ? 6.35 + (frame.y - 6.35) * 0.6 : frame.y - 2.85;
      const focusZ = wideZ + (5.9 - wideZ) * closeBlend;
      const fit = Math.max(1, (isSeal ? 1.49 : 1.2) / camera.aspect);
      const eyeZ = isSeal ? 11.4 - 0.3 * closeBlend : 8.9;
      const eyeY = isSeal ? 9.7 - 3.1 * closeBlend : 7.3;
      camera.position.set(focusX + (isSeal ? 1.15 - 3.25 * closeBlend : 1.65), eyeY * fit, focusZ + eyeZ * fit);
      camera.lookAt(focusX, 0.29 - 0.84 * closeBlend, focusZ);
      camera.updateMatrixWorld();
      const time = frame.reduced ? 1.75 : frame.now / 1000;
      room.update(time, width, height, frame);
      traveler.model.position.set(frame.x, 0, frame.y);
      actorShadow.position.set(frame.x, 0.02, frame.y);
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
      if (!fortressMaps[active].walkable[Math.floor(target.z)]?.[Math.floor(target.x)]) return;
      return { x: target.x, y: target.z };
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
