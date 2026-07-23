import * as THREE from "./vendor/three.module.min.js";

const TAU = Math.PI * 2;
const ABSORPTION_POINT = { desktop: { x: 0.64, y: 0.4 }, mobile: { x: 0.62, y: 0.29 } };

const DISK_VERTEX_SHADER = `
  varying vec2 vDiskPosition;

  void main() {
    vDiskPosition = position.xy;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const DISK_FRAGMENT_SHADER = `
  uniform float uTime;
  uniform float uAbsorb;
  uniform float uInner;
  uniform float uOuter;
  uniform float uOpacity;
  uniform float uPhase;
  uniform float uSpeed;
  varying vec2 vDiskPosition;

  float hash(vec2 point) {
    return fract(sin(dot(point, vec2(127.1, 311.7))) * 43758.5453);
  }

  float noise(vec2 point) {
    vec2 cell = floor(point);
    vec2 local = fract(point);
    local = local * local * (3.0 - 2.0 * local);
    return mix(
      mix(hash(cell), hash(cell + vec2(1.0, 0.0)), local.x),
      mix(hash(cell + vec2(0.0, 1.0)), hash(cell + vec2(1.0, 1.0)), local.x),
      local.y
    );
  }

  void main() {
    float radius = length(vDiskPosition);
    float angle = atan(vDiskPosition.y, vDiskPosition.x);
    float time = uTime * uSpeed * (1.0 + uAbsorb * 4.2);
    float turbulence = noise(vec2(angle * 3.2 + uPhase, radius * 2.4 - time));
    float coarse = abs(sin(angle * 8.0 - radius * 3.7 - time + turbulence * 3.4));
    float fine = abs(sin(angle * 23.0 - radius * 8.5 - time * 1.7 + turbulence * 5.0));
    float spiral = pow(max(0.0, 1.0 - coarse), 7.0);
    float filament = pow(max(0.0, 1.0 - fine), 15.0);
    float innerMask = smoothstep(uInner, uInner + 0.22, radius);
    float outerMask = 1.0 - smoothstep(uOuter - 1.15, uOuter, radius);
    float radialMask = innerMask * outerMask;
    float innerHeat = 1.0 - smoothstep(uInner + 0.06, uInner + 1.75, radius);
    float mottling = 0.58 + noise(vec2(radius * 5.0, angle * 7.0 - time)) * 0.62;

    vec3 ember = vec3(0.18, 0.006, 0.001);
    vec3 orange = vec3(1.0, 0.13, 0.012);
    vec3 gold = vec3(1.0, 0.52, 0.075);
    vec3 whiteHot = vec3(1.0, 0.93, 0.67);
    vec3 color = mix(ember, orange, smoothstep(0.08, 0.82, spiral + innerHeat * 0.65));
    color = mix(color, gold, clamp(innerHeat * 0.88 + filament * 0.34, 0.0, 1.0));
    color = mix(color, whiteHot, pow(innerHeat, 3.0) * (0.36 + filament * 0.64));

    float energy = 0.14 + spiral * 1.35 + filament * 1.7 + innerHeat * 0.72;
    float alpha = radialMask * mottling * (0.026 + spiral * 0.33 + filament * 0.26 + innerHeat * 0.17);
    alpha *= uOpacity * (1.0 + uAbsorb * 0.42);
    if (alpha < 0.006) discard;

    gl_FragColor = vec4(color * energy, alpha);
  }
`;

const GLOW_VERTEX_SHADER = `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const GLOW_FRAGMENT_SHADER = `
  uniform float uTime;
  uniform float uAbsorb;
  varying vec2 vUv;

  float hash(vec2 point) {
    return fract(sin(dot(point, vec2(41.3, 289.1))) * 45758.5453);
  }

  float noise(vec2 point) {
    vec2 cell = floor(point);
    vec2 local = fract(point);
    local = local * local * (3.0 - 2.0 * local);
    return mix(
      mix(hash(cell), hash(cell + vec2(1.0, 0.0)), local.x),
      mix(hash(cell + vec2(0.0, 1.0)), hash(cell + vec2(1.0, 1.0)), local.x),
      local.y
    );
  }

  void main() {
    vec2 point = vUv * 2.0 - 1.0;
    point.x *= 1.28;
    float radius = length(point);
    float angle = atan(point.y, point.x);
    float drift = uTime * (0.08 + uAbsorb * 0.4);
    float distortion = noise(vec2(angle * 4.0 - drift, radius * 8.0 + drift)) - 0.5;
    float horizonGlow = exp(-abs(radius - 0.34 + distortion * 0.022) * 18.0);
    float wideHalo = exp(-radius * 2.45) * (1.0 - smoothstep(0.0, 0.25, radius));
    float outerHaze = exp(-radius * 1.72) * smoothstep(0.22, 0.42, radius);
    float rayPattern = pow(max(0.0, sin(angle * 17.0 - radius * 22.0 + drift * 7.0)), 18.0);
    float rays = rayPattern * outerHaze * (0.3 + noise(vec2(angle * 9.0, drift)) * 0.7);
    float lopsided = 0.68 + 0.32 * cos(angle + 0.75);

    vec3 ember = vec3(0.42, 0.015, 0.002);
    vec3 orange = vec3(1.0, 0.16, 0.018);
    vec3 gold = vec3(1.0, 0.58, 0.12);
    vec3 color = mix(ember, orange, clamp(outerHaze * 1.4 + rays, 0.0, 1.0));
    color = mix(color, gold, horizonGlow * 0.72);
    float alpha = (wideHalo * 0.1 + outerHaze * 0.16 * lopsided + horizonGlow * 0.22 + rays * 0.22);
    alpha *= 0.9 + uAbsorb * 0.62;
    if (alpha < 0.004) discard;

    gl_FragColor = vec4(color * (0.76 + horizonGlow * 1.25 + rays), alpha);
  }
`;

const PARTICLE_VERTEX_SHADER = `
  uniform float uTime;
  uniform float uAbsorb;
  uniform float uSizeScale;
  attribute float aRadius;
  attribute float aAngle;
  attribute float aSpeed;
  attribute float aSize;
  attribute float aHeight;
  attribute float aPhase;
  attribute float aHeat;
  varying float vHeat;
  varying float vAlpha;

  void main() {
    float cycle = fract(aPhase + uTime * aSpeed * (0.018 + uAbsorb * 0.11));
    float pull = smoothstep(0.0, 1.0, cycle) * uAbsorb;
    float radius = mix(aRadius, max(1.72, aRadius * 0.28), pull);
    float angle = aAngle + uTime * aSpeed * (0.26 + uAbsorb * 1.7) + pull * 5.8;
    vec3 transformed = vec3(
      cos(angle) * radius,
      sin(angle) * radius,
      aHeight + sin(angle * 2.0 + aPhase * 12.0) * 0.09
    );
    vec4 viewPosition = modelViewMatrix * vec4(transformed, 1.0);
    gl_Position = projectionMatrix * viewPosition;
    float pulse = 0.74 + sin(uTime * (1.8 + aSpeed) + aPhase * 6.2831853) * 0.26;
    gl_PointSize = aSize * uSizeScale * (94.0 / max(1.0, -viewPosition.z)) * (1.0 + uAbsorb * 0.42);
    vHeat = aHeat;
    vAlpha = (0.44 + aHeat * 0.5) * (1.0 - pull * 0.42) * pulse;
  }
`;

const PARTICLE_FRAGMENT_SHADER = `
  uniform float uOpacity;
  uniform float uBloomMix;
  varying float vHeat;
  varying float vAlpha;

  void main() {
    float distanceToCenter = length(gl_PointCoord - vec2(0.5));
    float edgeMask = 1.0 - smoothstep(0.34, 0.5, distanceToCenter);
    float hotCore = 1.0 - smoothstep(0.035, 0.2, distanceToCenter);
    float softGlow = exp(-distanceToCenter * distanceToCenter * 8.5) * edgeMask;
    float particleShape = mix(hotCore + softGlow * 0.34, softGlow, uBloomMix);
    float alpha = particleShape * vAlpha * uOpacity;
    vec3 ember = vec3(0.95, 0.08, 0.005);
    vec3 gold = vec3(1.0, 0.56, 0.09);
    vec3 whiteHot = vec3(1.0, 0.94, 0.7);
    vec3 color = mix(ember, gold, vHeat);
    color = mix(color, whiteHot, pow(vHeat, 3.0) * 0.72);
    gl_FragColor = vec4(color * (1.0 + hotCore * (1.0 - uBloomMix) * 0.75), alpha);
  }
`;

export function createBlackHoleScene(canvas) {
  try {
    return new BlackHoleScene(canvas);
  } catch (error) {
    console.warn("Falling back from 3D black hole:", error);
    return {
      getAbsorptionPoint: () => {
        const point = window.innerWidth < 720 ? ABSORPTION_POINT.mobile : ABSORPTION_POINT.desktop;
        return { x: window.innerWidth * point.x, y: window.innerHeight * point.y };
      },
      setAbsorbing: () => {},
      setPointer: () => {},
      clearPointer: () => {},
    };
  }
}

class BlackHoleScene {
  constructor(canvas) {
    this.canvas = canvas;
    this.lastFrame = performance.now() * 0.001;
    this.elapsed = 0;
    this.pointer = new THREE.Vector2(0.5, 0.4);
    this.pointerActive = false;
    this.absorbing = false;
    this.absorbStrength = 0;
    this.filaments = [];
    this.lensElements = [];
    this.shaderMaterials = [];
    this.random = createSeededRandom(1096);

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      powerPreference: "high-performance",
    });
    this.renderer.setClearColor(0x020203, 1);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.18;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(42, 1, 0.1, 120);
    this.camera.position.set(0, 0, 14);

    this.root = new THREE.Group();
    this.scene.add(this.root);

    this.buildStarField();
    this.buildBlackHole();
    this.resize();
    this.animate();

    window.addEventListener("resize", () => this.resize());
  }

  getAbsorptionPoint() {
    const point = window.innerWidth < 720 ? ABSORPTION_POINT.mobile : ABSORPTION_POINT.desktop;
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
    const width = window.innerWidth;
    const height = window.innerHeight;
    const aspect = width / Math.max(height, 1);
    this.renderer.setSize(width, height, false);
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();

    const point = width < 720 ? ABSORPTION_POINT.mobile : ABSORPTION_POINT.desktop;
    const visibleHeight = 2 * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)) * this.camera.position.z;
    const visibleWidth = visibleHeight * aspect;
    this.root.position.set((point.x - 0.5) * visibleWidth, (0.5 - point.y) * visibleHeight, 0);
    this.root.scale.setScalar(width < 720 ? 0.64 : 0.84);
  }

  buildStarField() {
    const count = 1180;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const palette = [new THREE.Color(0xffe8bd), new THREE.Color(0xff8a2d), new THREE.Color(0x721006)];

    for (let index = 0; index < count; index += 1) {
      const radius = 9 + this.random() * 48;
      const theta = this.random() * TAU;
      const y = (this.random() - 0.5) * 20;
      const color = palette[Math.floor(this.random() * palette.length)];
      positions[index * 3] = Math.cos(theta) * radius;
      positions[index * 3 + 1] = y;
      positions[index * 3 + 2] = Math.sin(theta) * radius - 10 - this.random() * 18;
      colors[index * 3] = color.r;
      colors[index * 3 + 1] = color.g;
      colors[index * 3 + 2] = color.b;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

    this.stars = new THREE.Points(
      geometry,
      new THREE.PointsMaterial({
        size: 0.046,
        transparent: true,
        opacity: 0.68,
        vertexColors: true,
        blending: THREE.AdditiveBlending,
        depthTest: false,
        depthWrite: false,
      }),
    );
    this.stars.renderOrder = 1;
    this.scene.add(this.stars);
  }

  buildBlackHole() {
    this.buildVolumetricGlow();

    this.disk = new THREE.Group();
    this.disk.rotation.x = 1.02;
    this.disk.rotation.z = -0.14;
    this.root.add(this.disk);

    this.buildAccretionDisk();
    this.buildFlowFilaments();
    this.buildHotCrescent();
    this.buildInfallTrails();
    this.buildDiskParticles();
    this.buildEventHorizon();
    this.buildLensingCrown();
  }

  buildVolumetricGlow() {
    const material = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uAbsorb: { value: 0 } },
      vertexShader: GLOW_VERTEX_SHADER,
      fragmentShader: GLOW_FRAGMENT_SHADER,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthTest: false,
      depthWrite: false,
      toneMapped: true,
    });
    this.shaderMaterials.push(material);

    this.volumeGlow = new THREE.Mesh(new THREE.PlaneGeometry(13.8, 8.8), material);
    this.volumeGlow.position.z = -0.72;
    this.volumeGlow.rotation.z = -0.12;
    this.volumeGlow.renderOrder = 3;
    this.root.add(this.volumeGlow);
  }

  buildAccretionDisk() {
    const layers = [
      { inner: 1.66, outer: 7.8, opacity: 0.64, phase: 0.2, speed: 0.34, z: -0.05 },
      { inner: 1.58, outer: 4.45, opacity: 1.08, phase: 2.8, speed: 0.48, z: 0.04 },
    ];

    layers.forEach((layer, index) => {
      const material = new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uAbsorb: { value: 0 },
          uInner: { value: layer.inner },
          uOuter: { value: layer.outer },
          uOpacity: { value: layer.opacity },
          uPhase: { value: layer.phase },
          uSpeed: { value: layer.speed },
        },
        vertexShader: DISK_VERTEX_SHADER,
        fragmentShader: DISK_FRAGMENT_SHADER,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthTest: false,
        depthWrite: false,
        side: THREE.DoubleSide,
        toneMapped: true,
      });
      this.shaderMaterials.push(material);

      const ring = new THREE.Mesh(new THREE.RingGeometry(layer.inner, layer.outer, 320, 4), material);
      ring.position.z = layer.z;
      ring.rotation.z = index * 0.34;
      ring.renderOrder = 7 + index;
      this.disk.add(ring);
    });
  }

  buildFlowFilaments() {
    const palette = [0xffe7a1, 0xffad38, 0xff5a0b, 0x9c1205];

    for (let index = 0; index < 66; index += 1) {
      const radius = 1.82 + Math.pow(this.random(), 1.35) * 5.7;
      const shrink = 0.04 + this.random() * (radius > 5 ? 0.75 : 0.32);
      const start = this.random() * TAU;
      const length = 0.65 + this.random() * 4.7;
      const height = (this.random() - 0.5) * 0.34;
      const points = [];

      for (let step = 0; step <= 54; step += 1) {
        const progress = step / 54;
        const angle = start + progress * length;
        const localRadius = radius - shrink * progress;
        const depth = height + Math.sin(progress * Math.PI) * (this.random() - 0.5) * 0.08;
        points.push(new THREE.Vector3(Math.cos(angle) * localRadius, Math.sin(angle) * localRadius, depth));
      }

      const material = new THREE.LineBasicMaterial({
        color: palette[Math.floor(this.random() * palette.length)],
        transparent: true,
        opacity: 0.08 + this.random() * (radius < 3.4 ? 0.5 : 0.21),
        blending: THREE.AdditiveBlending,
        depthTest: false,
        depthWrite: false,
        toneMapped: true,
      });
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), material);
      line.renderOrder = 12;
      line.userData = {
        baseOpacity: material.opacity,
        speed: (this.random() > 0.22 ? 1 : -1) * (0.018 + this.random() * 0.075),
        shimmer: 0.8 + this.random() * 2.6,
      };
      this.disk.add(line);
      this.filaments.push(line);
    }
  }

  buildHotCrescent() {
    for (let index = 0; index < 13; index += 1) {
      const radius = 1.72 + index * 0.075;
      const start = Math.PI * (0.58 + this.random() * 0.12);
      const sweep = Math.PI * (0.52 + this.random() * 0.2);
      const points = [];

      for (let step = 0; step <= 72; step += 1) {
        const progress = step / 72;
        const angle = start + sweep * progress;
        const localRadius = radius - progress * (0.06 + index * 0.006);
        points.push(
          new THREE.Vector3(
            Math.cos(angle) * localRadius,
            Math.sin(angle) * localRadius,
            0.1 + Math.sin(progress * Math.PI) * 0.035,
          ),
        );
      }

      const material = new THREE.MeshBasicMaterial({
        color: index < 4 ? 0xfff1c2 : index < 9 ? 0xffb13c : 0xff5a0c,
        transparent: true,
        opacity: 0.62 - index * 0.027,
        blending: THREE.AdditiveBlending,
        depthTest: false,
        depthWrite: false,
        toneMapped: true,
      });
      const curve = new THREE.CatmullRomCurve3(points, false, "centripetal");
      const ribbon = new THREE.Mesh(
        new THREE.TubeGeometry(curve, 112, 0.015 + (12 - index) * 0.0015, 5, false),
        material,
      );
      ribbon.renderOrder = 18;
      ribbon.userData = {
        baseOpacity: material.opacity,
        speed: 0.008 + index * 0.0012,
        shimmer: 1.5 + index * 0.12,
      };
      this.disk.add(ribbon);
      this.filaments.push(ribbon);
    }
  }

  buildInfallTrails() {
    for (let index = 0; index < 28; index += 1) {
      const outerRadius = 6.2 + this.random() * 5.2;
      const innerRadius = 2.05 + this.random() * 2.2;
      const start = this.random() * TAU;
      const sweep = 0.34 + this.random() * 1.35;
      const points = [];

      for (let step = 0; step <= 44; step += 1) {
        const progress = step / 44;
        const eased = progress * progress * (3 - 2 * progress);
        const radius = THREE.MathUtils.lerp(outerRadius, innerRadius, eased);
        const angle = start + sweep * eased;
        const height = (this.random() - 0.5) * 0.24 * (1 - progress);
        points.push(new THREE.Vector3(Math.cos(angle) * radius, Math.sin(angle) * radius, height));
      }

      const material = new THREE.LineBasicMaterial({
        color: this.random() > 0.74 ? 0xffd88c : this.random() > 0.42 ? 0xff6a14 : 0x7d0c04,
        transparent: true,
        opacity: 0.065 + this.random() * 0.16,
        blending: THREE.AdditiveBlending,
        depthTest: false,
        depthWrite: false,
      });
      const trail = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), material);
      trail.renderOrder = 11;
      trail.userData = {
        baseOpacity: material.opacity,
        speed: 0.012 + this.random() * 0.032,
        shimmer: 0.7 + this.random() * 1.5,
      };
      this.disk.add(trail);
      this.filaments.push(trail);
    }
  }

  buildDiskParticles() {
    const count = 760;
    const geometry = new THREE.BufferGeometry();
    const radii = new Float32Array(count);
    const angles = new Float32Array(count);
    const speeds = new Float32Array(count);
    const sizes = new Float32Array(count);
    const heights = new Float32Array(count);
    const phases = new Float32Array(count);
    const heats = new Float32Array(count);
    const placeholders = new Float32Array(count * 3);

    for (let index = 0; index < count; index += 1) {
      radii[index] = 1.78 + Math.pow(this.random(), 1.72) * 7.4;
      angles[index] = this.random() * TAU;
      speeds[index] = 0.35 + this.random() * 1.15;
      sizes[index] = 0.36 + Math.pow(this.random(), 2.35) * 2.6;
      heights[index] = (this.random() - 0.5) * 0.42;
      phases[index] = this.random();
      heats[index] = Math.max(0, 1 - (radii[index] - 1.78) / 7.4) * 0.72 + this.random() * 0.28;
    }

    geometry.setAttribute("position", new THREE.BufferAttribute(placeholders, 3));
    geometry.setAttribute("aRadius", new THREE.BufferAttribute(radii, 1));
    geometry.setAttribute("aAngle", new THREE.BufferAttribute(angles, 1));
    geometry.setAttribute("aSpeed", new THREE.BufferAttribute(speeds, 1));
    geometry.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
    geometry.setAttribute("aHeight", new THREE.BufferAttribute(heights, 1));
    geometry.setAttribute("aPhase", new THREE.BufferAttribute(phases, 1));
    geometry.setAttribute("aHeat", new THREE.BufferAttribute(heats, 1));

    const layers = [
      { sizeScale: 4.15, opacity: 0.24, bloomMix: 1, renderOrder: 15 },
      { sizeScale: 1.08, opacity: 1, bloomMix: 0.18, renderOrder: 16 },
    ];

    this.diskParticleLayers = layers.map((layer) => {
      const material = new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uAbsorb: { value: 0 },
          uSizeScale: { value: layer.sizeScale },
          uOpacity: { value: layer.opacity },
          uBloomMix: { value: layer.bloomMix },
        },
        vertexShader: PARTICLE_VERTEX_SHADER,
        fragmentShader: PARTICLE_FRAGMENT_SHADER,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthTest: false,
        depthWrite: false,
        toneMapped: true,
      });
      this.shaderMaterials.push(material);

      const particles = new THREE.Points(geometry, material);
      particles.frustumCulled = false;
      particles.renderOrder = layer.renderOrder;
      this.disk.add(particles);
      return particles;
    });
  }

  buildEventHorizon() {
    this.core = new THREE.Mesh(
      new THREE.SphereGeometry(1.5, 96, 64),
      new THREE.MeshBasicMaterial({
        color: 0x000000,
        transparent: true,
        opacity: 1,
        depthTest: false,
        depthWrite: false,
        toneMapped: false,
      }),
    );
    this.core.scale.set(1.08, 1.08, 0.96);
    this.core.position.z = 0.16;
    this.core.renderOrder = 80;
    this.root.add(this.core);
  }

  buildLensingCrown() {
    for (let index = 0; index < 9; index += 1) {
      const radius = 1.61 + index * 0.037;
      const start = -0.2 - index * 0.012;
      const end = Math.PI + 0.24 + index * 0.018;
      const points = [];

      for (let step = 0; step <= 96; step += 1) {
        const progress = step / 96;
        const angle = THREE.MathUtils.lerp(start, end, progress);
        points.push(new THREE.Vector3(Math.cos(angle) * radius, Math.sin(angle) * radius * 1.05, 0.36 + Math.sin(progress * Math.PI) * 0.06));
      }

      const material = new THREE.MeshBasicMaterial({
        color: index < 3 ? 0xffefba : index < 6 ? 0xffa62f : 0xff4b0a,
        transparent: true,
        opacity: 0.46 - index * 0.035,
        blending: THREE.AdditiveBlending,
        depthTest: false,
        depthWrite: false,
        toneMapped: true,
      });
      const curve = new THREE.CatmullRomCurve3(points, false, "centripetal");
      const crown = new THREE.Mesh(new THREE.TubeGeometry(curve, 128, 0.011 + (8 - index) * 0.0015, 5, false), material);
      crown.rotation.z = -0.06;
      crown.renderOrder = 92 + index;
      crown.userData = { baseOpacity: material.opacity, shimmer: 1.2 + index * 0.21 };
      this.root.add(crown);
      this.lensElements.push(crown);
    }

    this.rim = new THREE.Mesh(
      new THREE.TorusGeometry(1.61, 0.018, 12, 256),
      new THREE.MeshBasicMaterial({
        color: 0xffc76b,
        transparent: true,
        opacity: 0.2,
        blending: THREE.AdditiveBlending,
        depthTest: false,
        depthWrite: false,
      }),
    );
    this.rim.scale.y = 1.04;
    this.rim.rotation.z = -0.06;
    this.rim.renderOrder = 104;
    this.root.add(this.rim);
  }

  animate() {
    const now = performance.now() * 0.001;
    const delta = Math.min(now - this.lastFrame, 0.04);
    this.lastFrame = now;
    this.elapsed += delta;
    const time = this.elapsed;
    const targetAbsorb = this.absorbing ? 1 : 0;
    this.absorbStrength = THREE.MathUtils.damp(this.absorbStrength, targetAbsorb, 3.8, delta);

    const pointerX = this.pointerActive ? (this.pointer.x - 0.5) * 0.16 : 0;
    const pointerY = this.pointerActive ? (0.5 - this.pointer.y) * 0.09 : 0;
    this.root.rotation.y = THREE.MathUtils.damp(this.root.rotation.y, pointerX, 2.8, delta);
    this.root.rotation.x = THREE.MathUtils.damp(this.root.rotation.x, pointerY, 2.8, delta);

    this.disk.rotation.z = -0.14 + time * (0.028 + this.absorbStrength * 0.24);
    this.stars.rotation.y += delta * (0.009 + this.absorbStrength * 0.07);
    this.volumeGlow.scale.setScalar(1 + Math.sin(time * 0.82) * 0.014 + this.absorbStrength * 0.08);
    const coreScale = 1.08 + this.absorbStrength * 0.045;
    const lensScale = 1 + this.absorbStrength * 0.08;
    this.core.scale.set(coreScale, coreScale, 0.96 + this.absorbStrength * 0.04);
    this.rim.scale.set(lensScale, 1.04 * lensScale, lensScale);
    this.rim.rotation.z = -0.06 - time * (0.026 + this.absorbStrength * 0.24);

    this.shaderMaterials.forEach((material) => {
      material.uniforms.uTime.value = time;
      material.uniforms.uAbsorb.value = this.absorbStrength;
    });

    this.filaments.forEach((line) => {
      line.rotation.z += line.userData.speed * delta * (1 + this.absorbStrength * 6.2);
      line.material.opacity = Math.min(
        0.94,
        line.userData.baseOpacity * (0.76 + Math.sin(time * line.userData.shimmer) * 0.2) + this.absorbStrength * 0.12,
      );
    });

    this.lensElements.forEach((element) => {
      element.scale.setScalar(lensScale);
      element.material.opacity = Math.min(
        0.72,
        element.userData.baseOpacity * (0.82 + Math.sin(time * element.userData.shimmer) * 0.14) + this.absorbStrength * 0.1,
      );
    });

    this.renderer.render(this.scene, this.camera);
    requestAnimationFrame(() => this.animate());
  }
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
