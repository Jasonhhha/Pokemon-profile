import {
  CanvasTexture, Color, Group, LinearMipmapLinearFilter, Mesh, MeshBasicMaterial, NearestFilter,
  PlaneGeometry, SRGBColorSpace, Vector3, type Camera, type Texture,
} from 'three';
import { creatureGaits, type FieldCreature } from './field-creature-motion';

export type FieldSpriteLight = { shade: number; lamplight: number };

export function createFieldPokemon(shadowMap: Texture) {
  const geometry = new PlaneGeometry(1, 1, 10, 13);
  geometry.translate(0, .50, 0);
  const footprint = new PlaneGeometry(1, 1);
  footprint.rotateX(-Math.PI / 2);
  const textures = new Map<HTMLCanvasElement, CanvasTexture>();
  const sky = new Color(0xb2c8ec);
  const shadeColor = new Color(0xabc2d9);
  const lampColor = new Color(0xffcf93);
  const right = new Vector3();
  const planeNormal = new Vector3();

  function textureFor(image: HTMLCanvasElement) {
    let texture = textures.get(image);
    if (!texture) {
      texture = new CanvasTexture(image);
      texture.colorSpace = SRGBColorSpace;
      texture.magFilter = NearestFilter;
      texture.minFilter = LinearMipmapLinearFilter;
      textures.set(image, texture);
    }
    return texture;
  }

  function actor(defaultId: FieldCreature) {
    const root = new Group();
    const shadow = new Mesh(footprint, new MeshBasicMaterial({
      map: shadowMap, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, toneMapped: false,
    }));
    shadow.position.y = .035;
    root.add(shadow);

    const flex = {
      uBreedLean: { value: 0 }, uStride: { value: 0 }, uBreath: { value: 0 }, uFacing: { value: 1 },
      uLeg: { value: .38 }, uTailGlint: { value: 0 },
    };
    const paint = new MeshBasicMaterial({ transparent: true, depthWrite: false, alphaTest: .108, toneMapped: false });
    paint.onBeforeCompile = shader => {
      Object.assign(shader.uniforms, flex);
      shader.vertexShader = `
        uniform float uBreedLean;
        uniform float uStride;
        uniform float uBreath;
        uniform float uFacing;
        uniform float uLeg;
        ${shader.vertexShader}
      `.replace('#include <uv_vertex>', `
        #include <uv_vertex>
        #ifdef USE_MAP
          vMapUv.x = .5 + (vMapUv.x - .5) * uFacing;
        #endif
      `).replace('#include <begin_vertex>', `
        #include <begin_vertex>
        float body = smoothstep(.08, .96, uv.y);
        float feet = 1.0 - smoothstep(.07, uLeg, uv.y);
        float flank = uv.x * 2.0 - 1.0;
        transformed.x += body * body * uBreedLean + feet * uStride * flank * .30;
        transformed.y += body * uBreath + feet * abs(flank) * uStride * flank * .27;
      `);
      shader.fragmentShader = `
        uniform float uTailGlint;
        ${shader.fragmentShader}
      `.replace('#include <map_fragment>', `
        #include <map_fragment>
        #ifdef USE_MAP
          float star = smoothstep(.76,.94,vMapUv.x) * smoothstep(.31,.42,vMapUv.y) * (1.0-smoothstep(.64,.78,vMapUv.y));
          float amber = clamp(diffuseColor.r - diffuseColor.b * 1.7, 0.0, 1.0);
          diffuseColor.rgb += vec3(.81,.52,.16) * star * amber * uTailGlint;
        #endif
      `);
    };
    paint.customProgramCacheKey = () => 'field-companion-warp';
    const sprite = new Mesh(geometry, paint);
    sprite.frustumCulled = false;
    root.add(sprite);
    let timeLast = 0;
    let x = 0;
    let z = 0;
    let targetX = 0;
    let targetZ = 0;
    let heading = creatureGaits[defaultId].sourceFacing;
    let headingTarget = heading;
    let energy = 0;
    let passingLift = 0;
    let steps = .11;
    let gaitAngle = 0;
    let ready = false;
    let shade = 0;
    let lamplight = 0;

    function update(image: HTMLCanvasElement | undefined, position: {
      x: number; z: number; lookX: number; lookZ: number; time: number; reduced: boolean; night: number;
      camera: Camera; id?: FieldCreature; guided?: boolean; sprint?: boolean; passing?: number;
      lighting?: FieldSpriteLight;
    }) {
      root.visible = Boolean(image);
      if (!image) return;
      const { time, reduced, camera, night, lookX, lookZ } = position;
      const profile = creatureGaits[position.id ?? defaultId];
      const map = textureFor(image);
      if (paint.map !== map) {
        paint.map = map;
        paint.needsUpdate = true;
      }

      const elapsed = Math.min(65, Math.max(0, time - timeLast));
      const fresh = !ready || time - timeLast > 320;
      const snap = fresh || reduced;
      const changeX = position.x - targetX;
      const changeZ = position.z - targetZ;
      const carry = Math.hypot(changeX, changeZ);
      const distance = Math.hypot(position.x - x, position.z - z);
      const speed = !snap && elapsed > 0 ? carry / elapsed * 1000 : 0;
      const intensity = Math.min(1, speed * .145 + Math.min(.32, distance * .28));
      const follow = snap ? 1 : 1 - Math.exp(-elapsed / (position.guided ? 67 : position.passing ? 24 : 39));
      const advance = distance * follow;
      x += (position.x - x) * follow;
      z += (position.z - z) * follow;
      targetX = position.x;
      targetZ = position.z;
      timeLast = time;
      ready = true;
      energy = snap ? 0 : energy + (intensity - energy) * (1 - Math.exp(-elapsed / (intensity > energy ? 35 : 68)));
      if (advance > .004 && !snap) {
        steps += Math.min(.22, advance) * profile.pace * .54;
        gaitAngle = steps * Math.PI * 2;
      }

      right.set(1, 0, 0).applyQuaternion(camera.quaternion);
      const turn = right.x * (carry > .025 ? changeX : lookX - x) + right.z * (carry > .025 ? changeZ : lookZ - z);
      if (Math.abs(turn) > (carry > .025 ? .015 : .16)) {
        headingTarget = Math.sign(turn) * profile.sourceFacing;
      }
      heading = snap ? headingTarget : heading + (headingTarget - heading) * (1 - Math.exp(-elapsed / 55));
      const facing = heading === 0 ? headingTarget : Math.sign(heading);
      const angle = gaitAngle;
      const idle = time / (position.guided ? 960 : 760 + (2.1 - profile.pace) * 155) + (position.guided ? .62 : 0);
      const floating = profile.airborne > 0;
      const fly = !reduced && (floating || position.id === 'starly' && position.sprint);
      const baseline = floating ? profile.airborne : 0;
      const loft = reduced ? 0 : Math.sin(idle * (floating ? 1.16 : 1.82)) * (floating ? .152 : .020);
      const climb = (position.passing ?? 0) * (floating ? .60 : fly ? .19 : 0);
      const liftEase = 1 - Math.exp(-elapsed / (climb > passingLift ? 20 : 75));
      passingLift = snap ? 0 : passingLift + (climb - passingLift) * liftEase;
      const airborne = baseline + (fly && !floating ? energy * .138 : 0) + loft + passingLift;
      const lift = Math.abs(Math.sin(angle)) ** 1.42 * energy * profile.bounce * (position.sprint ? 1.34 : 1);

      root.position.set(x, 0, z);
      sprite.position.y = .054 + Math.max(-.017, airborne + lift);
      sprite.quaternion.copy(camera.quaternion);
      if (position.lighting) {
        planeNormal.set(0, 0, 1).applyQuaternion(camera.quaternion);
        sprite.rotateX(Math.asin(Math.min(1, Math.max(-1, planeNormal.y))) * .24);
      }
      sprite.rotateZ(reduced ? 0 : Math.sin(angle) * profile.sway * energy +
        Math.sin(idle) * (floating ? .078 : .020) + (headingTarget - heading) * -.045);
      const width = profile.height * image.width / image.height;
      const shrink = Math.abs(heading);
      const compression = Math.cos(angle * 2) * .043 * energy;
      sprite.scale.set(width * (.62 + .38 * shrink) * (1 + compression), profile.height * (1 - compression), 1);
      flex.uFacing.value = facing;
      flex.uLeg.value = profile.leg;
      flex.uTailGlint.value = position.id === 'shinx' ? night * (reduced ? .88 : .78 + Math.sin(idle * 2.2) * .16) : 0;
      flex.uBreedLean.value = reduced ? 0 : profile.flex * (Math.sin(idle * 1.34) * .025 + Math.sin(angle + .6) * .041 * energy);
      flex.uStride.value = (Math.sin(angle) || 0) * .115 * energy * profile.flex;
      flex.uBreath.value = reduced ? 0 : Math.sin(idle * 1.83) * (floating ? .014 : .021);
      const lightEase = snap ? 1 : 1 - Math.exp(-elapsed / 92);
      shade += ((position.lighting?.shade ?? 0) - shade) * lightEase;
      lamplight += ((position.lighting?.lamplight ?? 0) - lamplight) * lightEase;
      paint.color.setHex(0xffffff).lerp(sky, night * .78);
      if (position.lighting) {
        paint.color.lerp(shadeColor, shade * (1 - night) * .68);
        paint.color.lerp(lampColor, lamplight * night * .56);
        paint.color.multiplyScalar(1 - .245 * shade * (1 - night) - night * (.43 - lamplight * .31));
      }

      const shadowHeight = Math.max(0, airborne) + lift;
      shadow.scale.set(Math.max(.64, width * 1.23) * (1 + shadowHeight * .37), 1, .65 + shadowHeight * .43);
      shadow.material.opacity = 1 / (1 + shadowHeight * 2.0);
    }

    return { root, update, reset: () => { ready = false; energy = 0; }, dispose() { paint.dispose(); shadow.material.dispose(); } };
  }

  return {
    actor,
    dispose() {
      for (const texture of textures.values()) texture.dispose();
      geometry.dispose();
      footprint.dispose();
    },
  };
}
