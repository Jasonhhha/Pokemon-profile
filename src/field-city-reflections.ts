import {
  Box3, Color, DirectionalLight, Frustum, Group, HemisphereLight, LinearFilter,
  Matrix4, Mesh, PlaneGeometry, Scene, ShaderMaterial, UniformsLib, UniformsUtils,
  Vector2, Vector3, WebGLRenderTarget, type Camera, type Object3D, type WebGLRenderer,
} from 'three';
import { harborHeight } from './field-city-layout';
import { tileAt } from './field-layout';
import { RING_PERIOD, ringPosition, ringRadius } from './field-ring-coordinates';

type ReflectionOptions = { enabled?: boolean; reducedMotion?: boolean; mobile?: boolean };

const waterLine = -.58;

function harborWaterBounds() {
  const lagoon = ringRadius(0);
  const bounds = [new Box3(new Vector3(-lagoon, -.63, -lagoon), new Vector3(lagoon, -.53, lagoon))];
  const vertex = new Vector3();

  function addArc(column: number, from: number, to: number) {
    const sector = new Box3();
    for (const x of [column, column + .5, column + 1]) {
      for (const z of [from, to]) {
        const point = ringPosition(x, z);
        sector.expandByPoint(vertex.set(point.x, waterLine, point.z));
      }
    }
    bounds.push(sector.expandByScalar(.07));
  }

  for (let x = 0; x < RING_PERIOD; x++) {
    let start: number | undefined;
    for (let z = 0; z <= harborHeight; z++) {
      const tile = tileAt('harbor', x, z);
      const water = tile === 'water' || tile === 'shelf' || tile === 'drop' || tile === 'dock';
      if (water) start ??= z;
      else if (start !== undefined) {
        addArc(x, start, z);
        start = undefined;
      }
    }
    addArc(x, start ?? harborHeight, harborHeight + 5.5);
  }
  return bounds;
}

function reflectedObject(object: Object3D) {
  object.updateWorldMatrix(true, true);
  const copy = object.clone(true);
  copy.matrixAutoUpdate = false;
  copy.matrix.copy(object.matrixWorld);
  copy.matrixWorldNeedsUpdate = true;
  copy.traverse(part => {
    part.castShadow = false;
    part.receiveShadow = false;
  });
  return copy;
}

const vertex = `
  #include <fog_pars_vertex>
  uniform mat4 captureProjection;
  varying vec4 reflectedPoint;
  varying vec3 waterPoint;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vec4 mvPosition = viewMatrix * world;
    waterPoint = world.xyz;
    reflectedPoint = captureProjection * world;
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`;

const fragment = `
  #include <fog_pars_fragment>
  uniform sampler2D reflectedColor;
  uniform vec2 pixelSize;
  uniform float clock;
  uniform float darkness;
  varying vec4 reflectedPoint;
  varying vec3 waterPoint;
  void main() {
    vec2 uv = reflectedPoint.xy / reflectedPoint.w * .5 + .5;
    vec2 p = waterPoint.xz;
    float swell = dot(p, vec2(.79, -1.77)) - clock * 1.08 + sin(p.y * .46 + p.x * .61) * .71;
    float ripple = dot(p, vec2(.41, -5.86)) + clock * 1.91 + sin(p.x * 2.19 + p.y * .38) * .74;
    float chop = dot(p, vec2(-3.24, 9.36)) - clock * 2.67 + sin(p.x * 3.73 + p.y * .23) * .48;
    vec2 shift = vec2(
      sin(ripple) * .0082 + sin(swell) * .0072 + sin(chop) * .0023,
      sin(swell) * .0021 + cos(ripple) * .00165
    );
    vec2 point = uv + shift;
    vec2 limit = min(point, 1.0 - point);
    float edge = smoothstep(.006, .038, min(limit.x, limit.y));
    if (edge < .002) discard;

    vec2 spread = pixelSize * vec2(1.62, .90);
    vec4 sampleColor = texture2D(reflectedColor, point) * .40;
    sampleColor += texture2D(reflectedColor, point + vec2(spread.x, 0.0)) * .18;
    sampleColor += texture2D(reflectedColor, point - vec2(spread.x, 0.0)) * .18;
    sampleColor += texture2D(reflectedColor, point + vec2(0.0, spread.y)) * .12;
    sampleColor += texture2D(reflectedColor, point - vec2(0.0, spread.y)) * .12;
    if (sampleColor.a < .017) discard;

    vec3 source = sampleColor.rgb / max(sampleColor.a, .017);
    float luma = dot(source, vec3(.24, .65, .11));
    float warmth = smoothstep(.049, .31, source.r - source.b) * smoothstep(.13, .49, luma);
    float fresnel = 1.0 - clamp(normalize(cameraPosition - waterPoint).y, 0.0, 1.0);
    float brokenWater = .54 + .46 * smoothstep(-.85, .64, sin(ripple + sin(chop) * .38));
    vec3 daylight = mix(vec3(.032, .149, .169), source * vec3(.51, .73, .80), .50);
    vec3 evening = mix(vec3(.013, .075, .112), source * vec3(.29, .48, .68), .54);
    evening += warmth * vec3(.56, .234, .045);
    float opacity = mix(.15 + fresnel * .16, .105 + fresnel * .15, darkness);
    opacity += warmth * darkness * (.26 + .06 * sin(swell));
    gl_FragColor = vec4(mix(daylight, evening, darkness), opacity * edge * sampleColor.a * brokenWater);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    #include <fog_fragment>
  }
`;

function materiallyMoved(prior: Matrix4, next: Matrix4) {
  return prior.elements.some((value, index) => Math.abs(value - next.elements[index]) > .0025);
}

export function buildCityReflections(staticBuildings: Group, harborBeacon?: Object3D) {
  // Reflect the static meshes across the water plane and use the unchanged field camera.
  const pool = new Scene();
  const inverse = new Group();
  inverse.position.y = waterLine * 2;
  inverse.scale.y = -1;
  inverse.add(reflectedObject(staticBuildings));
  if (harborBeacon) inverse.add(reflectedObject(harborBeacon));
  pool.add(inverse);
  const ambient = new HemisphereLight(0xe6f3ff, 0xafad9a, 1.4);
  ambient.position.y = -1;
  const key = new DirectionalLight(0xffdfbb, 1.8);
  key.position.set(-11, -27, 9);
  pool.add(ambient, key);

  const target = new WebGLRenderTarget(1, 1, {
    depthBuffer: true, stencilBuffer: false, minFilter: LinearFilter, magFilter: LinearFilter,
  });
  target.texture.name = 'Planar harbor architecture';
  target.texture.generateMipmaps = false;
  const previousProjection = new Matrix4();
  const uniforms = {
    ...UniformsUtils.clone(UniformsLib.fog),
    captureProjection: { value: previousProjection },
    reflectedColor: { value: target.texture },
    pixelSize: { value: new Vector2(1, 1) },
    clock: { value: 0 },
    darkness: { value: 0 },
  };
  const ringWaterExtent = ringRadius(harborHeight + 5.5);
  const sheet = new Mesh(new PlaneGeometry(ringWaterExtent * 2, ringWaterExtent * 2), new ShaderMaterial({
    uniforms, vertexShader: vertex, fragmentShader: fragment, fog: true, transparent: true, depthWrite: false,
  }));
  sheet.name = 'Rippling city reflections';
  sheet.rotation.x = -Math.PI / 2;
  sheet.position.y = waterLine + .014;
  const waterBounds = harborWaterBounds();
  sheet.renderOrder = 0;
  const group = new Group();
  group.name = 'Harbor reflection surface';
  group.visible = false;
  group.add(sheet);

  const viewProjection = new Matrix4();
  const frustum = new Frustum();
  const drawingBuffer = new Vector2();
  const savedClear = new Color();
  const skyDay = new Color('#e6f3ff');
  const skyNight = new Color('#7a9dc9');
  const sunDay = new Color('#ffdfbb');
  const sunNight = new Color('#a3bcf2');
  let lastTime = -Infinity;
  let lastDarkness = -1;
  let visibleSince: number | undefined;
  let captured = false;

  function capture(renderer: WebGLRenderer, camera: Camera) {
    const formerTarget = renderer.getRenderTarget();
    const formerCubeFace = renderer.getActiveCubeFace();
    const formerMipmap = renderer.getActiveMipmapLevel();
    renderer.getClearColor(savedClear);
    const formerAlpha = renderer.getClearAlpha();
    const formerAutoClear = renderer.autoClear;
    const formerShadows = renderer.shadowMap.enabled;
    const formerXr = renderer.xr.enabled;
    try {
      renderer.xr.enabled = false;
      renderer.shadowMap.enabled = false;
      renderer.autoClear = false;
      renderer.setRenderTarget(target);
      renderer.setClearColor(0, 0);
      renderer.clear(true, true, false);
      renderer.render(pool, camera);
    } finally {
      renderer.setRenderTarget(formerTarget, formerCubeFace, formerMipmap);
      renderer.setClearColor(savedClear, formerAlpha);
      renderer.autoClear = formerAutoClear;
      renderer.shadowMap.enabled = formerShadows;
      renderer.xr.enabled = formerXr;
    }
  }

  return {
    group,
    update(renderer: WebGLRenderer, camera: Camera, time: number, darkness: number, options: ReflectionOptions = {}) {
      if (options.enabled === false || renderer.getContext().isContextLost()) {
        group.visible = false;
        return;
      }
      viewProjection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
      frustum.setFromProjectionMatrix(viewProjection);
      if (!waterBounds.some(bounds => frustum.intersectsBox(bounds))) {
        group.visible = false;
        return;
      }
      // Give the field its first frames before compiling the secondary scene.
      visibleSince ??= time;
      if (time - visibleSince < 210) return;
      uniforms.clock.value = options.reducedMotion ? 0 : time / 1000;
      uniforms.darkness.value = darkness;
      renderer.getDrawingBufferSize(drawingBuffer);
      const maximumWidth = options.mobile ? 216 : 340;
      const maximumHeight = options.mobile ? 160 : 205;
      const ratio = Math.min(.48, maximumWidth / drawingBuffer.x, maximumHeight / drawingBuffer.y);
      const width = Math.max(32, Math.round(drawingBuffer.x * ratio));
      const height = Math.max(24, Math.round(drawingBuffer.y * ratio));
      if (target.width !== width || target.height !== height) {
        target.setSize(width, height);
        uniforms.pixelSize.value.set(1 / width, 1 / height);
        captured = false;
      }
      const interval = options.mobile ? 138 : 98;
      const expired = time - lastTime >= interval || time < lastTime;
      const dirty = materiallyMoved(previousProjection, viewProjection) || Math.abs(lastDarkness - darkness) > .026;
      if (!captured || expired && dirty) {
        ambient.color.copy(skyDay).lerp(skyNight, darkness);
        ambient.intensity = 1.4 - darkness * .69;
        key.color.copy(sunDay).lerp(sunNight, darkness);
        key.intensity = 1.8 - darkness * 1.53;
        capture(renderer, camera);
        previousProjection.copy(viewProjection);
        captured = true;
        lastTime = time;
        lastDarkness = darkness;
      }
      group.visible = captured;
    },
    dispose() {
      // Clones share geometry and materials with the main scene.
      pool.clear();
      sheet.geometry.dispose();
      sheet.material.dispose();
      target.dispose();
      group.clear();
    },
  };
}
