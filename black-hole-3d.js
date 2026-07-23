import * as THREE from "./vendor/three.module.min.js";

const ABSORPTION_POINT = {
  desktop: { x: 0.69, y: 0.42 },
  mobile: { x: 0.72, y: 0.3 },
};

const IMAGE_FOCUS = new THREE.Vector2(0.697, 0.57);

const VERTEX_SHADER = `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const FRAGMENT_SHADER = `
  precision highp float;

  uniform sampler2D uSceneTexture;
  uniform vec2 uResolution;
  uniform vec2 uImageResolution;
  uniform vec2 uImageFocus;
  uniform float uSceneScale;
  uniform vec2 uCenter;
  uniform vec2 uPointer;
  uniform float uTime;
  uniform float uAbsorb;
  uniform float uTextureReady;
  varying vec2 vUv;

  const float TAU = 6.28318530718;

  float hash21(vec2 point) {
    point = fract(point * vec2(123.34, 456.21));
    point += dot(point, point + 45.32);
    return fract(point.x * point.y);
  }

  float valueNoise(vec2 point) {
    vec2 cell = floor(point);
    vec2 local = fract(point);
    local = local * local * (3.0 - 2.0 * local);
    return mix(
      mix(hash21(cell), hash21(cell + vec2(1.0, 0.0)), local.x),
      mix(hash21(cell + vec2(0.0, 1.0)), hash21(cell + vec2(1.0, 1.0)), local.x),
      local.y
    );
  }

  float fbm(vec2 point) {
    float value = 0.0;
    float amplitude = 0.52;
    mat2 turn = mat2(0.82, -0.57, 0.57, 0.82);

    for (int octave = 0; octave < 4; octave += 1) {
      value += valueNoise(point) * amplitude;
      point = turn * point * 2.03 + 17.17;
      amplitude *= 0.5;
    }

    return value;
  }

  mat2 rotate2d(float angle) {
    float sine = sin(angle);
    float cosine = cos(angle);
    return mat2(cosine, -sine, sine, cosine);
  }

  float narrowThread(float phase, float sharpness) {
    return pow(max(0.0, 1.0 - abs(sin(phase))), sharpness);
  }

  float starLayer(vec2 uv, float scale, float threshold, float seedOffset) {
    vec2 grid = uv * scale;
    vec2 cell = floor(grid);
    vec2 local = fract(grid) - 0.5;
    float seed = hash21(cell + seedOffset);
    float radius = mix(0.035, 0.135, hash21(cell + 9.71));
    float shape = 1.0 - smoothstep(radius * 0.24, radius, length(local));
    float twinkle = 0.62 + 0.38 * sin(uTime * (0.8 + seed * 1.7) + seed * 29.0);
    return step(threshold, seed) * shape * twinkle;
  }

  vec2 sceneTextureUv(vec2 screenUv) {
    float screenAspect = uResolution.x / max(uResolution.y, 1.0);
    float imageAspect = uImageResolution.x / max(uImageResolution.y, 1.0);
    vec2 visibleImageSize = vec2(1.0);

    if (screenAspect > imageAspect) {
      visibleImageSize.y = imageAspect / screenAspect;
    } else {
      visibleImageSize.x = screenAspect / imageAspect;
    }

    return uImageFocus + (screenUv - uCenter) * visibleImageSize * uSceneScale;
  }

  vec3 sampleScene(vec2 screenUv) {
    vec2 textureUv = sceneTextureUv(screenUv);
    float inside = step(0.0, textureUv.x) * step(textureUv.x, 1.0);
    inside *= step(0.0, textureUv.y) * step(textureUv.y, 1.0);
    return texture2D(uSceneTexture, clamp(textureUv, 0.0, 1.0)).rgb * inside * uTextureReady;
  }

  void main() {
    float aspect = uResolution.x / max(uResolution.y, 1.0);
    vec2 pointerShift = (uPointer - 0.5) * vec2(0.018, 0.012);
    vec2 center = uCenter + pointerShift;
    vec2 point = vUv - center;
    vec2 metricPoint = vec2(point.x * aspect, point.y);
    float radius = length(metricPoint);
    float angle = atan(metricPoint.y, metricPoint.x);
    float time = uTime * (0.72 + uAbsorb * 2.4);
    float influence = 1.0 - smoothstep(0.16, 0.98, radius);
    float turbulence = fbm(vec2(angle * 2.6 - time * 0.08, radius * 12.0 + time * 0.045));
    float rotation = sin(time * 0.31 + radius * 16.0) * 0.0036;
    rotation += sin(angle * 5.0 - time * 0.23) * 0.0018;
    rotation += uAbsorb * (0.035 + turbulence * 0.075);
    rotation *= influence;

    float breathing = 1.0 + sin(time * 0.43) * 0.0025 - uAbsorb * influence * 0.025;
    vec2 warpedMetric = rotate2d(rotation) * metricPoint * breathing;
    vec2 warpedUv = center + vec2(warpedMetric.x / aspect, warpedMetric.y);
    vec3 base = sampleScene(warpedUv);

    float echoRotation = rotation - (0.0025 + uAbsorb * 0.018) * influence;
    vec2 echoMetric = rotate2d(echoRotation) * metricPoint * (breathing + 0.0025);
    vec2 echoUv = center + vec2(echoMetric.x / aspect, echoMetric.y);
    vec3 echo = sampleScene(echoUv);
    float baseLuma = dot(base, vec3(0.2126, 0.7152, 0.0722));
    vec3 color = max(base, echo * (0.62 + baseLuma * 0.26));

    float brightMatter = smoothstep(0.055, 0.72, baseLuma);
    float lightPulse = 0.965 + 0.055 * sin(time * 1.2 + angle * 7.0 + turbulence * 5.0);
    color *= mix(1.0, lightPulse + uAbsorb * 0.18, brightMatter);

    float horizon = 0.196 + uAbsorb * 0.008;
    float flowMask = smoothstep(horizon + 0.018, horizon + 0.13, radius);
    flowMask *= 1.0 - smoothstep(0.62, 1.05, radius);
    float thread = narrowThread(angle * 29.0 - log(radius + 0.03) * 22.0 - time * 1.8 + turbulence * 8.0, 27.0);
    float fineThread = narrowThread(angle * 47.0 - radius * 38.0 - time * 2.5 + turbulence * 11.0, 36.0);
    float threadEnergy = flowMask * (thread * 0.075 + fineThread * 0.045) * (1.0 + uAbsorb * 1.8);
    color += vec3(1.0, 0.29, 0.025) * threadEnergy;

    float photonRim = exp(-abs(radius - (horizon + 0.014 + (turbulence - 0.5) * 0.008)) * 105.0);
    float rimFlicker = 0.66 + 0.34 * narrowThread(angle * 17.0 - time * 1.7 + turbulence * 7.0, 8.0);
    color += vec3(1.0, 0.47, 0.08) * photonRim * rimFlicker * (0.08 + uAbsorb * 0.2);

    float polarSparks = starLayer(vec2(angle / TAU + 0.5 + time * 0.002, radius), 176.0, 0.978, 14.3);
    float sparkMask = smoothstep(horizon + 0.025, horizon + 0.12, radius);
    sparkMask *= 1.0 - smoothstep(0.52, 0.94, radius);
    color += vec3(1.0, 0.56, 0.13) * polarSparks * sparkMask * (0.34 + uAbsorb * 0.58);

    float holeMask = 1.0 - smoothstep(horizon - 0.007, horizon + 0.004, radius);
    color *= 1.0 - holeMask;
    color = max(color, vec3(1.0, 0.63, 0.19) * photonRim * 0.035);

    float vignette = 1.0 - smoothstep(0.62, 1.08, length((vUv - 0.5) * vec2(0.78, 1.0)));
    color *= 0.72 + vignette * 0.34;
    gl_FragColor = vec4(color, 1.0);
    #include <colorspace_fragment>
  }
`;

export function createBlackHoleScene(canvas) {
  try {
    return new DynamicBlackHoleScene(canvas);
  } catch (error) {
    console.warn("Falling back from the dynamic black hole:", error);
    return createFallbackScene();
  }
}

class DynamicBlackHoleScene {
  constructor(canvas) {
    this.canvas = canvas;
    this.lastFrame = performance.now() * 0.001;
    this.elapsed = 0;
    this.absorbing = false;
    this.absorbStrength = 0;
    this.pointerTarget = new THREE.Vector2(0.5, 0.5);
    this.pointerCurrent = new THREE.Vector2(0.5, 0.5);

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: false,
      antialias: false,
      powerPreference: "high-performance",
    });
    this.renderer.setClearColor(0x000000, 1);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.uniforms = {
      uSceneTexture: { value: null },
      uResolution: { value: new THREE.Vector2(1, 1) },
      uImageResolution: { value: new THREE.Vector2(1680, 944) },
      uImageFocus: { value: IMAGE_FOCUS },
      uSceneScale: { value: 1 },
      uCenter: { value: new THREE.Vector2() },
      uPointer: { value: this.pointerCurrent },
      uTime: { value: 0 },
      uAbsorb: { value: 0 },
      uTextureReady: { value: 0 },
    };

    this.material = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    });
    this.screen = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material);
    this.screen.frustumCulled = false;
    this.scene.add(this.screen);

    this.loadTexture();
    this.resize();
    this.animate();
    window.addEventListener("resize", () => this.resize());
  }

  loadTexture() {
    const texture = new THREE.TextureLoader().load(
      "./assets/black-hole-reference.jpg",
      (loadedTexture) => {
        loadedTexture.colorSpace = THREE.SRGBColorSpace;
        loadedTexture.minFilter = THREE.LinearMipmapLinearFilter;
        loadedTexture.magFilter = THREE.LinearFilter;
        loadedTexture.anisotropy = Math.min(4, this.renderer.capabilities.getMaxAnisotropy());
        this.uniforms.uImageResolution.value.set(loadedTexture.image.width, loadedTexture.image.height);
        this.uniforms.uTextureReady.value = 1;
      },
      undefined,
      (error) => console.warn("Unable to load the black hole texture:", error),
    );
    this.uniforms.uSceneTexture.value = texture;
  }

  getAbsorptionPoint() {
    const point = getResponsivePoint();
    return { x: window.innerWidth * point.x, y: window.innerHeight * point.y };
  }

  setAbsorbing(value) {
    this.absorbing = value;
  }

  setPointer(x, y) {
    this.pointerTarget.set(x, 1 - y);
  }

  clearPointer() {
    this.pointerTarget.set(0.5, 0.5);
  }

  resize() {
    const width = Math.max(window.innerWidth, 1);
    const height = Math.max(window.innerHeight, 1);
    const point = getResponsivePoint();
    this.renderer.setSize(width, height, false);
    this.uniforms.uResolution.value.set(width, height);
    this.uniforms.uCenter.value.set(point.x, 1 - point.y);
    this.uniforms.uSceneScale.value = width < 720 ? 1.32 : 1;
  }

  animate() {
    const now = performance.now() * 0.001;
    const delta = Math.min(now - this.lastFrame, 0.04);
    this.lastFrame = now;
    this.elapsed += delta;
    this.absorbStrength = THREE.MathUtils.damp(this.absorbStrength, this.absorbing ? 1 : 0, 4.2, delta);
    this.pointerCurrent.x = THREE.MathUtils.damp(this.pointerCurrent.x, this.pointerTarget.x, 2.6, delta);
    this.pointerCurrent.y = THREE.MathUtils.damp(this.pointerCurrent.y, this.pointerTarget.y, 2.6, delta);
    this.uniforms.uTime.value = this.elapsed;
    this.uniforms.uAbsorb.value = this.absorbStrength;
    this.renderer.render(this.scene, this.camera);
    requestAnimationFrame(() => this.animate());
  }
}

function getResponsivePoint() {
  return window.innerWidth < 720 ? ABSORPTION_POINT.mobile : ABSORPTION_POINT.desktop;
}

function createFallbackScene() {
  return {
    getAbsorptionPoint: () => {
      const point = getResponsivePoint();
      return { x: window.innerWidth * point.x, y: window.innerHeight * point.y };
    },
    setAbsorbing: () => {},
    setPointer: () => {},
    clearPointer: () => {},
  };
}
