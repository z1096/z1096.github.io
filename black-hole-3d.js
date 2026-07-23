import * as THREE from "./vendor/three.module.min.js";

const TAU = Math.PI * 2;
const ABSORPTION_POINT = {
  desktop: { x: 0.69, y: 0.42 },
  mobile: { x: 0.82, y: 0.2 },
};

const DISK_VERTEX_SHADER = `
  uniform float uTime;
  uniform float uAbsorb;
  uniform float uSizeScale;
  attribute float aRadius;
  attribute float aAngle;
  attribute float aSpeed;
  attribute float aHeight;
  attribute float aSize;
  attribute float aHeat;
  attribute float aPhase;
  attribute float aLayer;
  varying float vHeat;
  varying float vAlpha;
  varying float vSpriteAngle;

  const float TAU = 6.28318530718;

  void main() {
    float cycle = fract(aPhase + uTime * aSpeed * (0.018 + uAbsorb * 0.11));
    float inward = pow(smoothstep(0.0, 1.0, cycle), 1.28);
    float radius = mix(aRadius, 1.54, inward);
    float angularVelocity = (0.15 + 1.5 / (radius + 0.9)) * aSpeed;
    float angle = aAngle
      - uTime * angularVelocity * (1.0 + uAbsorb * 4.8)
      - inward * (2.8 + uAbsorb * 4.0);
    float turbulence = sin(angle * 3.0 + aPhase * TAU) * (0.028 + aLayer * 0.07);
    float height = aHeight * (1.0 - inward * 0.9) + turbulence * (1.0 - inward);
    vec3 transformed = vec3(cos(angle) * radius, sin(angle) * radius, height);
    vec4 viewPosition = modelViewMatrix * vec4(transformed, 1.0);
    gl_Position = projectionMatrix * viewPosition;
    gl_PointSize = aSize * uSizeScale * (90.0 / max(2.0, -viewPosition.z)) * (1.0 + uAbsorb * 0.46);

    float tangentX = sin(angle);
    float tangentY = -cos(angle) * 0.52;
    vSpriteAngle = atan(tangentY, tangentX) - 0.12;
    vHeat = min(1.0, aHeat + inward * 0.25);
    vAlpha = (0.38 + aHeat * 0.62) * (0.76 + 0.24 * sin(uTime * (1.1 + aSpeed) + aPhase * 31.0));
    vAlpha *= smoothstep(0.0, 0.08, cycle) * (1.0 - smoothstep(0.84, 1.0, cycle));
  }
`;

const RING_VERTEX_SHADER = `
  uniform float uTime;
  uniform float uAbsorb;
  uniform float uSizeScale;
  attribute float aRadius;
  attribute float aAngle;
  attribute float aSpeed;
  attribute float aSize;
  attribute float aHeat;
  attribute float aPhase;
  varying float vHeat;
  varying float vAlpha;
  varying float vSpriteAngle;

  void main() {
    float pulse = sin(aAngle * 9.0 - uTime * 2.2 + aPhase * 1.7);
    float radius = aRadius + pulse * 0.018 - uAbsorb * 0.055;
    float angle = aAngle - uTime * aSpeed * (0.18 + uAbsorb * 1.4);
    vec3 transformed = vec3(cos(angle) * radius, sin(angle) * radius * 1.045, 0.34);
    vec4 viewPosition = modelViewMatrix * vec4(transformed, 1.0);
    gl_Position = projectionMatrix * viewPosition;
    gl_PointSize = aSize * uSizeScale * (94.0 / max(2.0, -viewPosition.z)) * (1.0 + uAbsorb * 0.5);
    vSpriteAngle = angle + 1.5707963;
    vHeat = aHeat;
    float crown = 0.26 + abs(sin(angle)) * 0.74;
    vAlpha = (0.58 + aHeat * 0.42) * crown * (0.78 + pulse * 0.22);
  }
`;

const LENS_BELT_VERTEX_SHADER = `
  uniform float uTime;
  uniform float uAbsorb;
  uniform float uSizeScale;
  attribute float aRadius;
  attribute float aAngle;
  attribute float aSpeed;
  attribute float aHeight;
  attribute float aSize;
  attribute float aHeat;
  attribute float aPhase;
  attribute float aLayer;
  varying float vHeat;
  varying float vAlpha;
  varying float vSpriteAngle;

  void main() {
    float cycle = fract(aPhase + uTime * aSpeed * (0.014 + uAbsorb * 0.1));
    float inward = pow(smoothstep(0.0, 1.0, cycle), 1.32);
    float radius = mix(aRadius, 1.42, inward);
    float angularVelocity = (0.16 + 1.65 / (radius + 0.82)) * aSpeed;
    float angle = aAngle
      - uTime * angularVelocity * (1.0 + uAbsorb * 5.2)
      - inward * (2.5 + uAbsorb * 4.8);
    float vertical = sin(angle) * radius * (0.014 + aLayer * 0.006);
    vertical += aHeight * (1.0 - inward * 0.82);
    vec3 transformed = vec3(cos(angle) * radius, vertical, 0.48);
    vec4 viewPosition = modelViewMatrix * vec4(transformed, 1.0);
    gl_Position = projectionMatrix * viewPosition;
    gl_PointSize = aSize * uSizeScale * (96.0 / max(2.0, -viewPosition.z)) * (1.0 + uAbsorb * 0.56);

    vSpriteAngle = 0.0;
    vHeat = min(1.0, aHeat + inward * 0.18);
    vAlpha = (0.56 + aHeat * 0.44) * (0.78 + 0.22 * sin(uTime * 1.8 + aPhase * 37.0));
    vAlpha *= smoothstep(0.0, 0.06, cycle) * (1.0 - smoothstep(0.88, 1.0, cycle));
  }
`;

const PARTICLE_FRAGMENT_SHADER = `
  uniform float uOpacity;
  uniform float uGlowMix;
  uniform float uStreak;
  varying float vHeat;
  varying float vAlpha;
  varying float vSpriteAngle;

  void main() {
    vec2 local = gl_PointCoord - vec2(0.5);
    float sine = sin(-vSpriteAngle);
    float cosine = cos(-vSpriteAngle);
    vec2 aligned = mat2(cosine, -sine, sine, cosine) * local;
    float distanceToCenter = length(vec2(aligned.x / uStreak, aligned.y) * 2.0);
    float edge = 1.0 - smoothstep(0.28, 1.0, distanceToCenter);
    float core = 1.0 - smoothstep(0.0, 0.3, distanceToCenter);
    float glow = exp(-distanceToCenter * distanceToCenter * 3.4) * edge;
    float shape = mix(core + glow * 0.34, glow, uGlowMix);
    float alpha = shape * vAlpha * uOpacity;
    if (alpha < 0.004) discard;

    vec3 ember = vec3(0.72, 0.018, 0.001);
    vec3 orange = vec3(1.0, 0.16, 0.008);
    vec3 amber = vec3(1.0, 0.36, 0.035);
    vec3 whiteHot = vec3(1.0, 0.96, 0.84);
    vec3 lensWhite = vec3(0.91, 0.94, 1.0);
    vec3 color = mix(ember, orange, smoothstep(0.0, 0.48, vHeat));
    color = mix(color, amber, smoothstep(0.28, 0.78, vHeat));
    color = mix(color, whiteHot, smoothstep(0.72, 0.94, vHeat));
    color = mix(color, lensWhite, smoothstep(0.95, 1.0, vHeat) * 0.68);
    color *= 0.86 + core * (1.0 - uGlowMix) * 1.3;

    gl_FragColor = vec4(color, alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

const STAR_VERTEX_SHADER = `
  uniform float uTime;
  attribute float aSize;
  attribute float aPhase;
  attribute float aWarm;
  varying float vAlpha;
  varying float vWarm;

  void main() {
    vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * viewPosition;
    gl_PointSize = aSize * (64.0 / max(3.0, -viewPosition.z));
    vAlpha = 0.46 + 0.36 * sin(uTime * (0.35 + aWarm) + aPhase * 29.0);
    vWarm = aWarm;
  }
`;

const STAR_FRAGMENT_SHADER = `
  varying float vAlpha;
  varying float vWarm;

  void main() {
    float distanceToCenter = length(gl_PointCoord - vec2(0.5));
    float alpha = (1.0 - smoothstep(0.08, 0.5, distanceToCenter)) * vAlpha;
    vec3 color = mix(vec3(0.76, 0.82, 0.94), vec3(1.0, 0.48, 0.11), vWarm);
    gl_FragColor = vec4(color, alpha);
    #include <colorspace_fragment>
  }
`;

export function createBlackHoleScene(canvas) {
  try {
    return new ParticleBlackHoleScene(canvas);
  } catch (error) {
    console.warn("Falling back from the particle black hole:", error);
    return createFallbackScene();
  }
}

class ParticleBlackHoleScene {
  constructor(canvas) {
    this.canvas = canvas;
    this.lastFrame = performance.now() * 0.001;
    this.elapsed = 0;
    this.absorbing = false;
    this.absorbStrength = 0;
    this.pointer = new THREE.Vector2(0.5, 0.5);
    this.pointerActive = false;
    this.shaderMaterials = [];
    this.random = createSeededRandom(1096);

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: false,
      antialias: false,
      powerPreference: "high-performance",
    });
    this.renderer.setClearColor(0x010102, 1);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.65));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(42, 1, 0.1, 120);
    this.camera.position.set(0, 0, 14);

    this.root = new THREE.Group();
    this.scene.add(this.root);

    this.buildStars();
    this.buildAccretionDisk();
    this.buildEventHorizon();
    this.buildPhotonRing();
    this.buildLensingBelt();
    this.resize();
    this.animate();

    window.addEventListener("resize", () => this.resize());
  }

  getAbsorptionPoint() {
    const point = getResponsivePoint();
    return { x: window.innerWidth * point.x, y: window.innerHeight * point.y };
  }

  setAbsorbing(value) {
    this.absorbing = value;
  }

  setPointer(x, y) {
    this.pointer.set(x, y);
    this.pointerActive = true;
  }

  clearPointer() {
    this.pointerActive = false;
  }

  resize() {
    const width = Math.max(window.innerWidth, 1);
    const height = Math.max(window.innerHeight, 1);
    const aspect = width / height;
    const point = getResponsivePoint();
    this.renderer.setSize(width, height, false);
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();

    const visibleHeight = 2 * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)) * this.camera.position.z;
    const visibleWidth = visibleHeight * aspect;
    this.root.position.set((point.x - 0.5) * visibleWidth, (0.5 - point.y) * visibleHeight, 0);
    this.root.scale.setScalar(width < 720 ? 0.55 : 1.13);
  }

  buildStars() {
    const count = 1050;
    const positions = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const phases = new Float32Array(count);
    const warmth = new Float32Array(count);

    for (let index = 0; index < count; index += 1) {
      positions[index * 3] = (this.random() - 0.5) * 48;
      positions[index * 3 + 1] = (this.random() - 0.5) * 28;
      positions[index * 3 + 2] = -5 - this.random() * 36;
      sizes[index] = 0.42 + Math.pow(this.random(), 5) * 2.1;
      phases[index] = this.random();
      warmth[index] = this.random() > 0.93 ? this.random() * 0.65 : 0;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
    geometry.setAttribute("aPhase", new THREE.BufferAttribute(phases, 1));
    geometry.setAttribute("aWarm", new THREE.BufferAttribute(warmth, 1));

    this.starMaterial = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 } },
      vertexShader: STAR_VERTEX_SHADER,
      fragmentShader: STAR_FRAGMENT_SHADER,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    });
    this.stars = new THREE.Points(geometry, this.starMaterial);
    this.stars.frustumCulled = false;
    this.stars.renderOrder = 1;
    this.scene.add(this.stars);
  }

  buildAccretionDisk() {
    const count = 24000;
    const geometry = createParticleGeometry(count);
    const strands = 156;

    for (let index = 0; index < count; index += 1) {
      const outer = this.random() > 0.76;
      const radius = outer
        ? 5.2 + Math.pow(this.random(), 0.74) * 5.6
        : 1.82 + Math.pow(this.random(), 1.55) * 5.5;
      const strand = Math.floor(this.random() * strands);
      const jitter = (this.random() + this.random() + this.random() - 1.5) * (outer ? 0.12 : 0.055);
      const angle = (strand / strands) * TAU - radius * 0.8 + jitter;
      const heat = Math.min(1, Math.max(0, 1 - (radius - 1.82) / 6.2) * 0.82 + this.random() * 0.2);
      const heightSpread = 0.018 + Math.max(0, 5.2 - radius) * 0.025;

      geometry.attributes.aRadius.array[index] = radius;
      geometry.attributes.aAngle.array[index] = angle;
      geometry.attributes.aSpeed.array[index] = 0.58 + this.random() * 0.76;
      geometry.attributes.aHeight.array[index] = (this.random() + this.random() - 1) * heightSpread;
      geometry.attributes.aSize.array[index] = 0.22 + Math.pow(this.random(), 5) * 1.7 + heat * 0.22;
      geometry.attributes.aHeat.array[index] = heat;
      geometry.attributes.aPhase.array[index] = this.random();
      geometry.attributes.aLayer.array[index] = outer ? 1 : 0;
    }

    const layers = [
      { sizeScale: 3.5, opacity: 0.025, glowMix: 1, streak: 2.2, renderOrder: 8 },
      { sizeScale: 1, opacity: 0.42, glowMix: 0.14, streak: 4.2, renderOrder: 9 },
    ];

    this.disk = new THREE.Group();
    this.disk.rotation.x = 1.545;
    this.disk.rotation.z = -0.012;
    this.root.add(this.disk);

    layers.forEach((layer) => {
      const material = createParticleMaterial(DISK_VERTEX_SHADER, layer);
      this.shaderMaterials.push(material);
      const particles = new THREE.Points(geometry, material);
      particles.frustumCulled = false;
      particles.renderOrder = layer.renderOrder;
      this.disk.add(particles);
    });
  }

  buildEventHorizon() {
    this.core = new THREE.Mesh(
      new THREE.SphereGeometry(1.58, 80, 56),
      new THREE.MeshBasicMaterial({
        color: 0x000000,
        transparent: true,
        opacity: 1,
        depthTest: false,
        depthWrite: false,
        toneMapped: false,
      }),
    );
    this.core.position.z = 0.26;
    this.core.renderOrder = 80;
    this.root.add(this.core);
  }

  buildPhotonRing() {
    const count = 22000;
    const geometry = createParticleGeometry(count);

    for (let index = 0; index < count; index += 1) {
      const innerTrace = this.random() < 0.24;
      const angle = this.random() * TAU;
      const radius = innerTrace
        ? 1.62 + Math.pow(this.random(), 2.2) * 0.16
        : 1.76 + Math.pow(this.random(), 1.8) * 0.57;
      const heat = 0.88 + this.random() * 0.12;

      geometry.attributes.aRadius.array[index] = radius;
      geometry.attributes.aAngle.array[index] = angle;
      geometry.attributes.aSpeed.array[index] = 0.35 + this.random() * 0.42;
      geometry.attributes.aHeight.array[index] = (this.random() + this.random() - 1) * 0.08;
      geometry.attributes.aSize.array[index] = 0.1 + Math.pow(this.random(), 5) * 0.62;
      geometry.attributes.aHeat.array[index] = heat;
      geometry.attributes.aPhase.array[index] = this.random();
      geometry.attributes.aLayer.array[index] = 0;
    }

    const layers = [
      { sizeScale: 14, opacity: 0.018, glowMix: 1, streak: 5, renderOrder: 90 },
      { sizeScale: 5.2, opacity: 0.05, glowMix: 0.62, streak: 6.2, renderOrder: 91 },
      { sizeScale: 1.2, opacity: 0.34, glowMix: 0.06, streak: 8, renderOrder: 92 },
    ];

    layers.forEach((layer) => {
      const material = createParticleMaterial(RING_VERTEX_SHADER, layer);
      this.shaderMaterials.push(material);
      const particles = new THREE.Points(geometry, material);
      particles.frustumCulled = false;
      particles.renderOrder = layer.renderOrder;
      this.root.add(particles);
    });
  }

  buildLensingBelt() {
    const count = 9500;
    const geometry = createParticleGeometry(count);

    for (let index = 0; index < count; index += 1) {
      const radius = 1.52 + Math.pow(this.random(), 1.5) * 7.2;
      const heat = 0.82 + Math.max(0, 1 - (radius - 1.52) / 7.2) * 0.18;

      geometry.attributes.aRadius.array[index] = radius;
      geometry.attributes.aAngle.array[index] = this.random() * TAU;
      geometry.attributes.aSpeed.array[index] = 0.72 + this.random() * 0.7;
      geometry.attributes.aHeight.array[index] = (this.random() + this.random() - 1) * (0.012 + radius * 0.0035);
      geometry.attributes.aSize.array[index] = 0.16 + Math.pow(this.random(), 4) * 1.05 + heat * 0.14;
      geometry.attributes.aHeat.array[index] = heat;
      geometry.attributes.aPhase.array[index] = this.random();
      geometry.attributes.aLayer.array[index] = this.random();
    }

    const layers = [
      { sizeScale: 6, opacity: 0.02, glowMix: 1, streak: 5.2, renderOrder: 96 },
      { sizeScale: 2.2, opacity: 0.08, glowMix: 0.64, streak: 6.2, renderOrder: 97 },
      { sizeScale: 1, opacity: 0.66, glowMix: 0.04, streak: 7.5, renderOrder: 98 },
    ];

    layers.forEach((layer) => {
      const material = createParticleMaterial(LENS_BELT_VERTEX_SHADER, layer);
      this.shaderMaterials.push(material);
      const particles = new THREE.Points(geometry, material);
      particles.frustumCulled = false;
      particles.renderOrder = layer.renderOrder;
      this.root.add(particles);
    });
  }

  animate() {
    const now = performance.now() * 0.001;
    const delta = Math.min(now - this.lastFrame, 0.04);
    this.lastFrame = now;
    this.elapsed += delta;
    this.absorbStrength = THREE.MathUtils.damp(this.absorbStrength, this.absorbing ? 1 : 0, 4.2, delta);

    const pointerX = this.pointerActive ? (this.pointer.x - 0.5) * 0.15 : 0;
    const pointerY = this.pointerActive ? (0.5 - this.pointer.y) * 0.08 : 0;
    this.root.rotation.y = THREE.MathUtils.damp(this.root.rotation.y, pointerX, 2.7, delta);
    this.root.rotation.x = THREE.MathUtils.damp(this.root.rotation.x, pointerY, 2.7, delta);
    this.disk.rotation.z = -0.012;
    this.stars.rotation.y += delta * (0.004 + this.absorbStrength * 0.025);
    this.starMaterial.uniforms.uTime.value = this.elapsed;

    this.shaderMaterials.forEach((material) => {
      material.uniforms.uTime.value = this.elapsed;
      material.uniforms.uAbsorb.value = this.absorbStrength;
    });

    const coreScale = 1 + this.absorbStrength * 0.045;
    this.core.scale.setScalar(coreScale);
    this.renderer.render(this.scene, this.camera);
    requestAnimationFrame(() => this.animate());
  }
}

function createParticleGeometry(count) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(count * 3), 3));
  geometry.setAttribute("aRadius", new THREE.BufferAttribute(new Float32Array(count), 1));
  geometry.setAttribute("aAngle", new THREE.BufferAttribute(new Float32Array(count), 1));
  geometry.setAttribute("aSpeed", new THREE.BufferAttribute(new Float32Array(count), 1));
  geometry.setAttribute("aHeight", new THREE.BufferAttribute(new Float32Array(count), 1));
  geometry.setAttribute("aSize", new THREE.BufferAttribute(new Float32Array(count), 1));
  geometry.setAttribute("aHeat", new THREE.BufferAttribute(new Float32Array(count), 1));
  geometry.setAttribute("aPhase", new THREE.BufferAttribute(new Float32Array(count), 1));
  geometry.setAttribute("aLayer", new THREE.BufferAttribute(new Float32Array(count), 1));
  return geometry;
}

function createParticleMaterial(vertexShader, layer) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uAbsorb: { value: 0 },
      uSizeScale: { value: layer.sizeScale },
      uOpacity: { value: layer.opacity },
      uGlowMix: { value: layer.glowMix },
      uStreak: { value: layer.streak },
    },
    vertexShader,
    fragmentShader: PARTICLE_FRAGMENT_SHADER,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthTest: false,
    depthWrite: false,
    toneMapped: true,
  });
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

function createSeededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}
