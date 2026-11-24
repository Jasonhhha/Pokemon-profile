import { CircleGeometry, ShaderMaterial, UnsignedByteType } from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';

// Only the central glazed ice returns a recognisable image. Frost near the retaining ring scatters it.
export function createIceReflection() {
  const shape = new CircleGeometry(4.88, 96);
  const mirror = new Reflector(shape, {
    textureWidth: 336,
    textureHeight: 216,
    multisample: 0,
    clipBias: 0.0015,
    color: 0xffffff,
    shader: {
      name: 'GlacialReflection',
      uniforms: { color: { value: null }, tDiffuse: { value: null }, textureMatrix: { value: null } },
      vertexShader: `uniform mat4 textureMatrix;varying vec4 captureUV;varying vec2 sheet;varying vec3 worldPt;
        void main(){sheet=position.xy;worldPt=(modelMatrix*vec4(position,1.)).xyz;captureUV=textureMatrix*vec4(position,1.);
        gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      fragmentShader: `uniform sampler2D tDiffuse;varying vec4 captureUV;varying vec2 sheet;varying vec3 worldPt;
        float hash(vec2 x){return fract(sin(dot(x,vec2(91.71,23.64)))*41357.84);}
        float noise2(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.),f.x),f.y);}
        void main(){
          vec2 uv=captureUV.xy/captureUV.w;float field=noise2(sheet*.76),frost=smoothstep(.29,.81,field+.15*noise2(sheet*3.1));
          float rim=1.-smoothstep(4.01,4.84,length(sheet));
          float shear=.00060+.00125*frost;uv+=shear*vec2(sin(sheet.x*13.+field*7.),sin(sheet.y*8.-field*6.));
          vec2 blur=vec2(.0014+.0027*frost,.0025+.0036*frost);
          vec3 reflection=texture2D(tDiffuse,uv).rgb*.36;
          reflection+=.16*(texture2D(tDiffuse,uv+blur).rgb+texture2D(tDiffuse,uv-blur).rgb);
          reflection+=.16*(texture2D(tDiffuse,uv+vec2(blur.x,-blur.y)).rgb+texture2D(tDiffuse,uv+vec2(-blur.x,blur.y)).rgb);
          vec3 view=normalize(cameraPosition-worldPt);float grazing=pow(1.-abs(view.y),1.8);
          float opacity=rim*(.11+.28*(1.-frost)+.14*grazing);
          gl_FragColor=vec4(reflection*vec3(.76,.90,.96),opacity);
          #include <colorspace_fragment>
        }`,
    },
  });
  // The reflection is low contrast and contains no HDR lights. An eight-bit buffer also works on mobile GPUs.
  mirror.getRenderTarget().texture.type = UnsignedByteType;
  mirror.rotation.x = -Math.PI / 2;
  mirror.position.set(8.5, -0.615, 6.5);
  mirror.renderOrder = 1;
  const finish = mirror.material as ShaderMaterial;
  finish.transparent = true;
  finish.depthWrite = false;
  return {
    mesh: mirror,
    dispose() {
      mirror.dispose();
      shape.dispose();
    },
  };
}
