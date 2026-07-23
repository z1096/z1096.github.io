/**
 * Relativistic ray tracing adapted from Eric Bruneton's black_hole_shader.
 * Copyright (c) 2020 Eric Bruneton. BSD-3-Clause license:
 * vendor/ebruneton-black-hole/LICENSE
 */

import { createParticleBlackHoleScene } from "./black-hole-3d.js?v=20260723-cinematic3";

const ASSET_ROOT = "./vendor/ebruneton-black-hole";
const POINTS = { desktop: { x: 0.69, y: 0.42 }, mobile: { x: 0.82, y: 0.2 } };

const VERTEX_SHADER = `#version 300 es
precision highp float;
uniform vec3 camera_size;
uniform vec2 hole_ndc;
layout(location = 0) in vec2 vertex;
out vec3 view_dir;
void main() {
  view_dir = vec3((vertex - hole_ndc) * camera_size.xy, -camera_size.z);
  gl_Position = vec4(vertex, 0.0, 1.0);
}`;

const FRAGMENT_WRAPPER = `
uniform vec4 camera_position;
uniform vec3 p;
uniform vec3 e_tau, e_w, e_h, e_d;
uniform vec4 k_s;
uniform sampler2D ray_deflection_texture;
uniform sampler2D ray_inverse_radius_texture;
uniform sampler2D black_body_texture;
uniform highp sampler3D doppler_texture;
uniform sampler2D noise_texture;
uniform vec3 disc_params;
uniform float exposure;
uniform float absorb_strength;
uniform float scene_time;
uniform vec2 resolution;
uniform vec2 hole_ndc;
in vec3 view_dir;
layout(location = 0) out vec4 frag_color;

float RayTrace(float u, float u_dot, float e_square, float delta, float alpha,
               float u_ic, float u_oc, out float u0, out float phi0,
               out float t0, out float alpha0, out float u1, out float phi1,
               out float t1, out float alpha1) {
  return TraceRay(ray_deflection_texture, ray_inverse_radius_texture, u,
                  u_dot, e_square, delta, alpha, u_ic, u_oc, u0, phi0, t0,
                  alpha0, u1, phi1, t1, alpha1);
}

float Hash31(vec3 p3) {
  p3 = fract(p3 * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

vec3 RotateSky(vec3 dir) {
  float angle = scene_time * (0.018 + absorb_strength * 0.045);
  float sine = sin(angle);
  float cosine = cos(angle);
  return vec3(cosine * dir.x - sine * dir.y,
              sine * dir.x + cosine * dir.y,
              dir.z);
}

vec3 GalaxyColor(vec3 dir) {
  vec3 n = normalize(RotateSky(dir));
  float band = exp(-pow(abs(n.z + 0.12 * sin(n.x * 7.0)), 2.0) * 34.0);
  float dust = Hash31(floor(n * 90.0));
  vec3 nebula = mix(vec3(0.002, 0.003, 0.009), vec3(0.018, 0.006, 0.025), band);
  return nebula * (0.7 + 0.7 * dust);
}

vec3 StarTextureColor(vec3 dir) { return vec3(0.0); }
vec3 StarTextureColor(vec3 dir, float lod, out vec2 sub_position) {
  sub_position = vec2(0.0);
  return vec3(0.0);
}

vec3 StarColor(vec3 dir, float lensing_amplification_factor) {
  vec3 n = normalize(RotateSky(dir));
  vec3 cell = floor(n * 720.0);
  float seed = Hash31(cell);
  float star = smoothstep(0.9935, 1.0, seed);
  float rare = smoothstep(0.9992, 1.0, Hash31(cell + 17.0));
  float twinkle = 0.58 + 0.42 * sin(scene_time * (1.4 + seed * 2.2) + seed * 31.0);
  float amplification = min(5.5, 0.7 + sqrt(max(lensing_amplification_factor, 0.0)) * 0.9);
  vec3 tint = mix(vec3(0.55, 0.72, 1.0), vec3(1.0, 0.72, 0.38), Hash31(cell + 4.0));
  return tint * (star * 1.05 + rare * 4.2) * amplification * twinkle;
}

vec3 Doppler(vec3 rgb, float doppler_factor) {
  return DefaultDoppler(doppler_texture, rgb, doppler_factor);
}

float Noise(vec2 uv) {
  float texture_noise = texture(noise_texture, uv).r;
  float procedural = Hash31(vec3(floor(uv * 220.0), 7.0));
  return mix(0.25, 1.8, mix(texture_noise, procedural, 0.22));
}

vec4 DiscColor(vec2 point, float time, bool top_side, float doppler_factor) {
  vec4 color = DefaultDiscColor(point, time, top_side, doppler_factor,
                                disc_params.z, black_body_texture);
  float underside = top_side ? 1.0 : 0.72;
  return vec4(color.rgb * disc_params.x * underside, color.a * disc_params.y);
}

vec3 FlowingStarlight() {
  vec2 ndc = gl_FragCoord.xy / resolution * 2.0 - 1.0;
  vec2 delta = ndc - hole_ndc;
  delta.x *= resolution.x / resolution.y;
  float radius = length(delta);
  float angle = atan(delta.y, delta.x);
  float orbitMask = smoothstep(0.3, 0.42, radius) *
                    (1.0 - smoothstep(1.35, 1.85, radius));
  float flow = 0.0;
  float blueMix = 0.0;
  for (int i = 0; i < 4; ++i) {
    float layer = float(i);
    float spiral = angle + log(max(radius, 0.08)) * (2.2 + layer * 0.72) -
                   scene_time * (0.16 + layer * 0.045) * (1.0 + absorb_strength * 3.2);
    float laneWave = max(cos(spiral * (5.0 + layer * 1.7) + layer * 2.1), 0.0);
    float beadWave = max(cos(radius * (78.0 + layer * 13.0) -
                             scene_time * (1.6 + layer * 0.42)), 0.0);
    float lane = pow(laneWave, 62.0);
    float bead = pow(beadWave, 72.0);
    float shortTail = pow(laneWave, 82.0) * pow(beadWave, 20.0);
    float flicker = 0.7 + 0.3 * sin(scene_time * (2.0 + layer * 0.37) + layer * 4.0);
    flow += (lane * bead * 8.4 + shortTail * 0.9) * flicker;
    blueMix += lane * bead * mod(layer, 2.0);
  }
  vec3 warm = vec3(1.0, 0.72, 0.34);
  vec3 cool = vec3(0.36, 0.82, 1.35);
  return mix(warm, cool, clamp(blueMix, 0.0, 1.0)) * flow * orbitMask * 1.65;
}

void main() {
  vec3 hdr = SceneColor(camera_position, p, k_s, e_tau, e_w, e_h, e_d, view_dir);
  float energy = max(hdr.r, max(hdr.g, hdr.b));
  hdr += FlowingStarlight() * (1.0 - smoothstep(0.03, 0.38, energy));
  hdr += hdr * smoothstep(0.08, 1.8, energy) * (0.08 + absorb_strength * 0.1);
  vec3 mapped = vec3(1.0) - exp(-hdr * exposure);
  mapped = pow(max(mapped, 0.0), vec3(0.84));
  frag_color = vec4(mapped, 1.0);
}`;

function responsivePoint() {
  return matchMedia("(max-width: 720px)").matches ? POINTS.mobile : POINTS.desktop;
}

export function createBlackHoleScene(canvas) {
  let renderer = null;
  const state = { absorbing: false, pointer: null };
  const applyState = () => {
    renderer.setAbsorbing(state.absorbing);
    if (state.pointer) renderer.setPointer(state.pointer.x, state.pointer.y);
    else renderer.clearPointer();
  };

  RelativisticBlackHole.create(canvas).then((instance) => {
    renderer = instance;
    applyState();
  }).catch((error) => {
    console.warn("Relativistic renderer unavailable; using particle fallback.", error);
    renderer = createParticleBlackHoleScene(canvas);
    applyState();
  });

  return {
    getAbsorptionPoint() {
      if (renderer) return renderer.getAbsorptionPoint();
      const point = responsivePoint();
      return { x: innerWidth * point.x, y: innerHeight * point.y };
    },
    setAbsorbing(value) { state.absorbing = value; renderer?.setAbsorbing(value); },
    setPointer(x, y) { state.pointer = { x, y }; renderer?.setPointer(x, y); },
    clearPointer() { state.pointer = null; renderer?.clearPointer(); },
  };
}

class RelativisticBlackHole {
  static async create(canvas) {
    const gl = canvas.getContext("webgl2", { alpha: false, antialias: false, powerPreference: "high-performance" });
    if (!gl) throw new Error("WebGL2 is not supported");
    if (!gl.getExtension("OES_texture_float_linear")) throw new Error("Float texture filtering is not supported");

    const [definitions, functions, model, deflection, inverseRadius, blackBody, doppler, noise] = await Promise.all([
      fetchText(`${ASSET_ROOT}/definitions.glsl`),
      fetchText(`${ASSET_ROOT}/functions.glsl`),
      fetchText(`${ASSET_ROOT}/model.glsl`),
      fetchFloats(`${ASSET_ROOT}/deflection.dat`),
      fetchFloats(`${ASSET_ROOT}/inverse_radius.dat`),
      fetchFloats(`${ASSET_ROOT}/black_body.dat`),
      fetchFloats(`${ASSET_ROOT}/doppler.dat`),
      loadImage(`${ASSET_ROOT}/noise_texture.png`),
    ]);
    return new RelativisticBlackHole(canvas, gl, { definitions, functions, model, deflection, inverseRadius, blackBody, doppler, noise });
  }

  constructor(canvas, gl, assets) {
    this.canvas = canvas;
    this.gl = gl;
    this.lastTime = performance.now() * 0.001;
    this.orbitTime = 0;
    this.viewTime = 0;
    this.absorbing = false;
    this.absorbStrength = 0;
    this.pointer = { x: 0.5, y: 0.5 };
    this.pointerActive = false;
    this.viewOffset = { x: 0, y: 0 };
    this.reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.program = createProgram(gl, VERTEX_SHADER, fragmentShader(assets));
    this.uniforms = uniforms(gl, this.program, [
      "camera_size", "hole_ndc", "camera_position", "p", "k_s", "e_tau", "e_w", "e_h", "e_d",
      "ray_deflection_texture", "ray_inverse_radius_texture", "black_body_texture", "doppler_texture",
      "noise_texture", "disc_params", "exposure", "absorb_strength", "scene_time", "resolution",
    ]);
    this.quad = createQuad(gl);
    this.textures = createTextures(gl, assets);
    this.resize = this.resize.bind(this);
    this.render = this.render.bind(this);
    addEventListener("resize", this.resize);
    this.resize();
    requestAnimationFrame(this.render);
  }

  getAbsorptionPoint() {
    const point = this.currentPoint();
    return { x: innerWidth * point.x, y: innerHeight * point.y };
  }
  setAbsorbing(value) { this.absorbing = value; }
  setPointer(x, y) { this.pointer = { x, y }; this.pointerActive = true; }
  clearPointer() { this.pointerActive = false; }

  currentPoint() {
    const point = responsivePoint();
    if (!this.pointerActive) return point;
    return { x: point.x + (this.pointer.x - 0.5) * 0.018, y: point.y + (this.pointer.y - 0.5) * 0.012 };
  }

  resize() {
    const quality = innerWidth < 760 ? 0.8 : 0.68;
    this.canvas.width = Math.max(1, Math.floor(innerWidth * quality));
    this.canvas.height = Math.max(1, Math.floor(innerHeight * quality));
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
  }

  render(milliseconds) {
    const now = milliseconds * 0.001;
    const delta = Math.min(0.05, Math.max(0, now - this.lastTime));
    this.lastTime = now;
    this.absorbStrength += ((this.absorbing ? 1 : 0) - this.absorbStrength) * Math.min(1, delta * 3.8);
    const pointerX = this.pointerActive ? this.pointer.x - 0.5 : 0;
    const pointerY = this.pointerActive ? this.pointer.y - 0.5 : 0;
    const viewEase = Math.min(1, delta * 2.4);
    this.viewOffset.x += (pointerX - this.viewOffset.x) * viewEase;
    this.viewOffset.y += (pointerY - this.viewOffset.y) * viewEase;
    const motionScale = this.reducedMotion ? 0.55 : 1;
    this.orbitTime += delta * (1 + this.absorbStrength * 5.5) * motionScale;
    this.viewTime += delta * motionScale;
    this.draw();
    requestAnimationFrame(this.render);
  }

  draw() {
    const { gl } = this;
    const u = this.uniforms;
    const { width, height } = this.canvas;
    const point = this.currentPoint();
    const fov = 50 - this.absorbStrength * 4;
    const focal = height / (2 * Math.tan((fov * Math.PI) / 360));
    const theta = 1.4 + Math.sin(this.viewTime * 0.35) * 0.13 - this.viewOffset.y * 0.18;
    const phi = this.viewTime * 0.035 + this.viewOffset.x * 0.16;
    const radius = 18.5 + Math.sin(this.viewTime * 0.24) * 0.9;
    const sinTheta = Math.sin(theta);
    const cosTheta = Math.cos(theta);
    const sinPhi = Math.sin(phi);
    const cosPhi = Math.cos(phi);
    const roll = Math.sin(this.viewTime * 0.4) * 0.14 + this.viewOffset.x * 0.16;
    const sinRoll = Math.sin(roll);
    const cosRoll = Math.cos(roll);
    const rolledWx = -cosRoll * sinPhi - sinRoll * cosTheta * cosPhi;
    const rolledWy = cosRoll * cosPhi - sinRoll * cosTheta * sinPhi;
    const rolledWz = sinRoll * sinTheta;
    const rolledHx = -cosRoll * cosTheta * cosPhi + sinRoll * sinPhi;
    const rolledHy = -cosRoll * cosTheta * sinPhi - sinRoll * cosPhi;
    const rolledHz = cosRoll * sinTheta;
    gl.useProgram(this.program);
    gl.bindVertexArray(this.quad);
    gl.uniform3f(u.camera_size, width / 2, height / 2, focal);
    gl.uniform2f(u.hole_ndc, point.x * 2 - 1, 1 - point.y * 2);
    gl.uniform4f(u.camera_position, this.orbitTime * 3, radius, theta, phi);
    gl.uniform3f(u.p, radius * sinTheta * cosPhi, radius * sinTheta * sinPhi, radius * cosTheta);
    gl.uniform4f(u.k_s, 1 / Math.sqrt(1 - 1 / radius), 0, 0, 0);
    gl.uniform3f(u.e_tau, 0, 0, 0);
    gl.uniform3f(u.e_w, rolledWx, rolledWy, rolledWz);
    gl.uniform3f(u.e_h, rolledHx, rolledHy, rolledHz);
    gl.uniform3f(u.e_d, sinTheta * cosPhi, sinTheta * sinPhi, cosTheta);
    gl.uniform3f(u.disc_params, 0.008 + this.absorbStrength * 0.004, 0.45, 2750);
    gl.uniform1f(u.exposure, 0.038 + this.absorbStrength * 0.018);
    gl.uniform1f(u.absorb_strength, this.absorbStrength);
    gl.uniform1f(u.scene_time, this.viewTime);
    gl.uniform2f(u.resolution, width, height);
    bind(gl, this.textures.deflection, 0, u.ray_deflection_texture, gl.TEXTURE_2D);
    bind(gl, this.textures.inverseRadius, 1, u.ray_inverse_radius_texture, gl.TEXTURE_2D);
    bind(gl, this.textures.blackBody, 2, u.black_body_texture, gl.TEXTURE_2D);
    bind(gl, this.textures.doppler, 3, u.doppler_texture, gl.TEXTURE_3D);
    bind(gl, this.textures.noise, 4, u.noise_texture, gl.TEXTURE_2D);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
}

function fragmentShader(a) {
  const header = `#version 300 es
precision highp float;
#define IN(x) const in x
#define OUT(x) out x
const float pi = ${Math.PI};
const float rad = 1.0;
const int RAY_DEFLECTION_TEXTURE_WIDTH = ${a.deflection[0]};
const int RAY_DEFLECTION_TEXTURE_HEIGHT = ${a.deflection[1]};
const int RAY_INVERSE_RADIUS_TEXTURE_WIDTH = ${a.inverseRadius[0]};
const int RAY_INVERSE_RADIUS_TEXTURE_HEIGHT = ${a.inverseRadius[1]};
const float STARS_CUBE_MAP_SIZE = 1024.0;
const float MAX_FOOTPRINT_SIZE = 4.0;
const float MAX_FOOTPRINT_LOD = 0.0;
${discConstants()}`;
  return `${header}\n${a.definitions}\n${a.functions}\n${a.model}\n${FRAGMENT_WRAPPER}`;
}

function discConstants() {
  const rings = [
    [0.300, 0.333, 0.18, 0.247], [0.257, 0.286, 1.03, 0.231], [0.225, 0.250, 2.21, 0.216],
    [0.200, 0.222, 3.32, 0.204], [0.180, 0.200, 4.70, 0.193], [0.164, 0.182, 5.56, 0.184],
    [0.150, 0.167, 0.71, 0.176], [0.138, 0.154, 1.76, 0.169], [0.128, 0.143, 2.86, 0.162],
    [0.119, 0.133, 3.94, 0.156], [0.111, 0.125, 5.11, 0.151], [0.104, 0.118, 6.02, 0.146],
  ];
  const values = rings.map((ring) => `vec4(${ring.join(", ")})`).join(",\n");
  return `const float INNER_DISC_R = 3.0;
const float OUTER_DISC_R = 12.0;
const int NUM_DISC_PARTICLES = ${rings.length};
const vec4 DISC_PARTICLE_PARAMS[${rings.length}] = vec4[${rings.length}](${values});`;
}

async function fetchText(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Unable to load ${url}`);
  return response.text();
}
async function fetchFloats(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Unable to load ${url}`);
  return new Float32Array(await response.arrayBuffer());
}
function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Unable to load ${url}`));
    image.src = url;
  });
}
function shader(gl, type, source) {
  const value = gl.createShader(type);
  gl.shaderSource(value, source);
  gl.compileShader(value);
  if (!gl.getShaderParameter(value, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(value) || "Shader compilation failed");
  return value;
}
function createProgram(gl, vertexSource, fragmentSource) {
  const program = gl.createProgram();
  gl.attachShader(program, shader(gl, gl.VERTEX_SHADER, vertexSource));
  gl.attachShader(program, shader(gl, gl.FRAGMENT_SHADER, fragmentSource));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) || "Shader link failed");
  return program;
}
function uniforms(gl, program, names) {
  return Object.fromEntries(names.map((name) => [name, gl.getUniformLocation(program, name)]));
}
function createQuad(gl) {
  const vao = gl.createVertexArray();
  const buffer = gl.createBuffer();
  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  return vao;
}
function floatTexture2D(gl, data, components) {
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const format = components === 2 ? gl.RG : gl.RGB;
  const internal = components === 2 ? gl.RG32F : gl.RGB32F;
  gl.texImage2D(gl.TEXTURE_2D, 0, internal, components === 2 ? data[0] : 128, components === 2 ? data[1] : 1,
    0, format, gl.FLOAT, components === 2 ? data.subarray(2) : data);
  return texture;
}
function createTextures(gl, a) {
  const doppler = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_3D, doppler);
  for (const parameter of [gl.TEXTURE_MIN_FILTER, gl.TEXTURE_MAG_FILTER]) gl.texParameteri(gl.TEXTURE_3D, parameter, gl.LINEAR);
  for (const parameter of [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T, gl.TEXTURE_WRAP_R]) gl.texParameteri(gl.TEXTURE_3D, parameter, gl.CLAMP_TO_EDGE);
  gl.texImage3D(gl.TEXTURE_3D, 0, gl.RGB32F, 64, 32, 64, 0, gl.RGB, gl.FLOAT, a.doppler);
  const noise = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, noise);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, gl.RED, gl.UNSIGNED_BYTE, a.noise);
  gl.generateMipmap(gl.TEXTURE_2D);
  return {
    deflection: floatTexture2D(gl, a.deflection, 2),
    inverseRadius: floatTexture2D(gl, a.inverseRadius, 2),
    blackBody: floatTexture2D(gl, a.blackBody, 3), doppler, noise,
  };
}
function bind(gl, texture, unit, location, target) {
  gl.activeTexture(gl.TEXTURE0 + unit);
  gl.bindTexture(target, texture);
  gl.uniform1i(location, unit);
}
