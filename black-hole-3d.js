import * as THREE from "./vendor/three.module.min.js";

const ABSORPTION_POINT = { desktop: { x: 0.52, y: 0.42 }, mobile: { x: 0.62, y: 0.32 } };

export function createBlackHoleScene(canvas) {
  try {
    return new BlackHoleScene(canvas);
  } catch (error) {
    console.warn("Falling back from 3D black hole:", error);
    return {
      getAbsorptionPoint: () => ({
        x: window.innerWidth * 0.52,
        y: window.innerHeight * (window.innerWidth < 720 ? 0.32 : 0.42),
      }),
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
    this.pointer = new THREE.Vector2(0.5, 0.42);
    this.pointerActive = false;
    this.absorbing = false;
    this.absorbStrength = 0;
    this.filaments = [];

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      powerPreference: "high-performance",
    });
    this.renderer.setClearColor(0x030305, 1);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

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
    return {
      x: window.innerWidth * point.x,
      y: window.innerHeight * point.y,
    };
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
    this.root.scale.setScalar(width < 720 ? 0.74 : 1);
  }

  buildStarField() {
    const count = 980;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const palette = [new THREE.Color(0xffdf9a), new THREE.Color(0xff6a1d), new THREE.Color(0x8f1006)];

    for (let index = 0; index < count; index += 1) {
      const radius = 10 + Math.random() * 46;
      const theta = Math.random() * Math.PI * 2;
      const y = (Math.random() - 0.5) * 19;
      const color = palette[Math.floor(Math.random() * palette.length)];
      positions[index * 3] = Math.cos(theta) * radius;
      positions[index * 3 + 1] = y;
      positions[index * 3 + 2] = Math.sin(theta) * radius - 8 - Math.random() * 16;
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
        size: 0.055,
        transparent: true,
        opacity: 0.72,
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
    this.disk = new THREE.Group();
    this.disk.rotation.x = 1.08;
    this.disk.rotation.z = -0.2;
    this.root.add(this.disk);

    this.buildFilaments();
    this.buildGlowShells();
    this.buildEventHorizon();
  }

  buildFilaments() {
    this.buildAccretionTori();

    for (let index = 0; index < 112; index += 1) {
      const band = index / 112;
      const inner = band < 0.45;
      const rx = 2.15 + band * 4.5 + Math.random() * 0.28;
      const ry = 0.78 + band * 1.32 + Math.random() * 0.16;
      const start = Math.PI * (0.48 + Math.random() * 0.44);
      const length = Math.PI * (0.26 + Math.random() * 1.1);
      const geometry = createEllipticalArc(rx, ry, start, length, 72, 0.08 + Math.random() * 0.18);
      const color = new THREE.Color(inner && Math.random() > 0.4 ? 0xfff1b8 : Math.random() > 0.5 ? 0xff7a18 : 0xb01808);
      const material = new THREE.LineBasicMaterial({
        color,
        transparent: true,
        opacity: 0.22 + Math.random() * (inner ? 0.5 : 0.34),
        blending: THREE.AdditiveBlending,
        depthTest: false,
        depthWrite: false,
      });
      const line = new THREE.Line(geometry, material);
      line.renderOrder = 10;
      line.rotation.z = Math.random() * Math.PI * 2;
      line.userData = {
        baseOpacity: material.opacity,
        speed: (Math.random() > 0.25 ? 1 : -1) * (0.04 + Math.random() * 0.14),
        shimmer: 1 + Math.random() * 2.2,
      };
      this.disk.add(line);
      this.filaments.push(line);
    }

    for (let index = 0; index < 14; index += 1) {
      const geometry = createEllipticalArc(3.8 + index * 0.08, 1.1 + index * 0.04, Math.PI * 0.78, Math.PI * 0.42, 64, 0.1);
      const material = new THREE.LineBasicMaterial({
        color: index < 4 ? 0xfff5c8 : 0xff8a18,
        transparent: true,
        opacity: 0.58 - index * 0.024,
        blending: THREE.AdditiveBlending,
        depthTest: false,
        depthWrite: false,
      });
      const flare = new THREE.Line(geometry, material);
      flare.renderOrder = 12;
      flare.position.x = -0.18 - index * 0.012;
      flare.position.y = -0.02 + index * 0.008;
      flare.userData = { baseOpacity: material.opacity, speed: 0.02 + index * 0.006, shimmer: 2.5 };
      this.disk.add(flare);
      this.filaments.push(flare);
    }
  }

  buildAccretionTori() {
    for (let index = 0; index < 9; index += 1) {
      const hot = index < 3;
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(2.25 + index * 0.34, 0.012 + index * 0.003, 10, 220),
        new THREE.MeshBasicMaterial({
          color: hot ? 0xfff0ba : index < 6 ? 0xff7a18 : 0x941006,
          transparent: true,
          opacity: hot ? 0.34 : 0.2,
          blending: THREE.AdditiveBlending,
          depthTest: false,
          depthWrite: false,
          side: THREE.DoubleSide,
        }),
      );
      ring.renderOrder = 8;
      ring.rotation.z = index * 0.16;
      ring.userData = {
        baseOpacity: ring.material.opacity,
        speed: 0.035 + index * 0.012,
        shimmer: 1.4 + index * 0.16,
      };
      this.disk.add(ring);
      this.filaments.push(ring);
    }
  }

  buildGlowShells() {
    const shellGeometry = new THREE.SphereGeometry(1.76, 80, 48);
    this.orangeHalo = new THREE.Mesh(
      shellGeometry,
      new THREE.MeshBasicMaterial({
        color: 0xff3b08,
        transparent: true,
        opacity: 0.2,
        blending: THREE.AdditiveBlending,
        depthTest: false,
        depthWrite: false,
        side: THREE.BackSide,
      }),
    );
    this.orangeHalo.scale.set(1.34, 1.18, 0.82);
    this.orangeHalo.renderOrder = 6;
    this.root.add(this.orangeHalo);

    this.lensRing = new THREE.Mesh(
      new THREE.TorusGeometry(1.95, 0.012, 12, 192),
      new THREE.MeshBasicMaterial({
        color: 0xffd280,
        transparent: true,
        opacity: 0.3,
        blending: THREE.AdditiveBlending,
        depthTest: false,
        depthWrite: false,
      }),
    );
    this.lensRing.rotation.x = 1.18;
    this.lensRing.rotation.z = -0.26;
    this.lensRing.renderOrder = 90;
    this.root.add(this.lensRing);
  }

  buildEventHorizon() {
    this.core = new THREE.Mesh(
      new THREE.SphereGeometry(1.38, 96, 64),
      new THREE.MeshBasicMaterial({
        color: 0x000000,
        transparent: true,
        opacity: 1,
        depthTest: false,
        depthWrite: false,
      }),
    );
    this.core.scale.set(1.2, 1.2, 1.08);
    this.core.renderOrder = 80;
    this.root.add(this.core);

    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(1.48, 0.026, 16, 220),
      new THREE.MeshBasicMaterial({
        color: 0xffc678,
        transparent: true,
        opacity: 0.36,
        blending: THREE.AdditiveBlending,
        depthTest: false,
        depthWrite: false,
      }),
    );
    rim.rotation.x = 1.16;
    rim.rotation.z = -0.2;
    rim.renderOrder = 92;
    this.root.add(rim);
    this.rim = rim;
  }

  animate() {
    const now = performance.now() * 0.001;
    const delta = Math.min(now - this.lastFrame, 0.04);
    this.lastFrame = now;
    this.elapsed += delta;
    const time = this.elapsed;
    const targetAbsorb = this.absorbing ? 1 : 0;
    this.absorbStrength = THREE.MathUtils.damp(this.absorbStrength, targetAbsorb, 3.8, delta);

    const pointerX = this.pointerActive ? (this.pointer.x - 0.5) * 0.18 : 0;
    const pointerY = this.pointerActive ? (0.5 - this.pointer.y) * 0.1 : 0;
    this.root.rotation.y = THREE.MathUtils.damp(this.root.rotation.y, pointerX, 2.8, delta);
    this.root.rotation.x = THREE.MathUtils.damp(this.root.rotation.x, pointerY, 2.8, delta);

    this.disk.rotation.z = -0.2 + time * (0.1 + this.absorbStrength * 0.55);
    this.lensRing.rotation.z = -0.26 - time * (0.18 + this.absorbStrength * 0.8);
    this.rim.rotation.z = -0.2 + time * (0.32 + this.absorbStrength * 1.2);
    this.orangeHalo.scale.setScalar(1 + Math.sin(time * 1.2) * 0.02 + this.absorbStrength * 0.08);
    this.core.scale.setScalar(1.22 + this.absorbStrength * 0.22);
    this.stars.rotation.y += delta * (0.012 + this.absorbStrength * 0.06);

    this.filaments.forEach((line) => {
      line.rotation.z += line.userData.speed * delta * (1 + this.absorbStrength * 5.2);
      line.material.opacity = Math.min(
        0.96,
        line.userData.baseOpacity * (0.72 + Math.sin(time * line.userData.shimmer) * 0.22) + this.absorbStrength * 0.18,
      );
    });

    this.renderer.render(this.scene, this.camera);
    requestAnimationFrame(() => this.animate());
  }
}

function createEllipticalArc(rx, ry, start, length, segments, depth) {
  const points = [];

  for (let index = 0; index <= segments; index += 1) {
    const t = start + (length * index) / segments;
    points.push(new THREE.Vector3(Math.cos(t) * rx, Math.sin(t) * ry, Math.sin(t * 1.7) * depth));
  }

  return new THREE.BufferGeometry().setFromPoints(points);
}
