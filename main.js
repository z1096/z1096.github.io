const canvas = document.querySelector("#signal-canvas");
const ctx = canvas.getContext("2d");
const pointer = { x: 0.5, y: 0.42, active: false };
const stars = [];
const sparks = [];
const filaments = [];
const sinkSelectors = [
  ".brand",
  ".nav-links",
  ".hero-copy",
  ".hero-status > div",
  ".section-heading",
  ".project-card",
  ".site-footer > *",
];

let width = 0;
let height = 0;
let pixelRatio = 1;
let lastFrame = performance.now();
let absorbing = false;
let absorbStart = 0;
let resetTimer = 0;

function blackHoleCenter() {
  return {
    x: width * 0.5,
    y: height * (width < 720 ? 0.34 : 0.42),
  };
}

function makeStar(radiusMultiplier = 1) {
  const maxRadius = Math.max(width, height) * 0.74;
  return {
    angle: Math.random() * Math.PI * 2,
    radius: (50 + Math.random() * maxRadius) * radiusMultiplier,
    spin: 0.00005 + Math.random() * 0.00018,
    size: 0.7 + Math.random() * 2.2,
    alpha: 0.38 + Math.random() * 0.62,
    hue: Math.random() > 0.7 ? "255, 226, 150" : Math.random() > 0.46 ? "255, 101, 24" : "170, 20, 8",
    stretch: 0.48 + Math.random() * 0.2,
    wobble: Math.random() * Math.PI * 2,
  };
}

function makeFilament(index) {
  const band = index / 34;
  return {
    start: Math.PI * (0.56 + Math.random() * 0.24),
    length: Math.PI * (0.78 + Math.random() * 0.82),
    radiusX: 185 + band * 420 + Math.random() * 44,
    radiusY: 76 + band * 174 + Math.random() * 22,
    width: 1.2 + Math.random() * 5.8 + (1 - band) * 2.8,
    alpha: 0.16 + Math.random() * 0.48,
    speed: (Math.random() > 0.35 ? 1 : -1) * (0.00014 + Math.random() * 0.00034),
    phase: Math.random() * Math.PI * 2,
    heat: Math.random(),
  };
}

function resetCanvas() {
  pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  width = window.innerWidth;
  height = window.innerHeight;
  canvas.width = Math.floor(width * pixelRatio);
  canvas.height = Math.floor(height * pixelRatio);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

  const count = Math.max(130, Math.min(280, Math.floor((width * height) / 6200)));
  stars.length = 0;

  for (let index = 0; index < count; index += 1) {
    stars.push(makeStar());
  }

  filaments.length = 0;
  for (let index = 0; index < 34; index += 1) {
    filaments.push(makeFilament(index));
  }
}

function drawSpace(center, time) {
  const wash = ctx.createRadialGradient(center.x, center.y, 20, center.x, center.y, Math.max(width, height) * 0.86);
  wash.addColorStop(0, "rgba(0, 0, 0, 0.98)");
  wash.addColorStop(0.22, "rgba(28, 5, 2, 0.64)");
  wash.addColorStop(0.5, "rgba(8, 2, 4, 0.88)");
  wash.addColorStop(1, "rgba(3, 3, 5, 1)");

  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.translate(center.x, center.y);
  ctx.rotate(time * 0.000018);
  ctx.strokeStyle = "rgba(126, 215, 255, 0.035)";
  ctx.lineWidth = 1;

  for (let radius = 120; radius < Math.max(width, height) * 0.82; radius += 92) {
    ctx.beginPath();
    ctx.ellipse(0, 0, radius, radius * 0.54, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.restore();
}

function drawStars(center, delta, time, pull) {
  stars.forEach((star) => {
    const previousAngle = star.angle;
    const previousRadius = star.radius;
    const speed = star.spin * delta * (1 + pull * 28);
    star.angle += speed;
    star.radius -= pull * delta * (0.018 * star.radius + 0.72);

    if (star.radius < 18) {
      Object.assign(star, makeStar(1.05));
      return;
    }

    const wobble = Math.sin(time * 0.001 + star.wobble) * 8;
    const x = center.x + Math.cos(star.angle) * (star.radius + wobble);
    const y = center.y + Math.sin(star.angle) * star.radius * star.stretch;
    const prevX = center.x + Math.cos(previousAngle) * previousRadius;
    const prevY = center.y + Math.sin(previousAngle) * previousRadius * star.stretch;
    const streakAlpha = Math.min(0.7, 0.08 + pull * 0.62);

    if (pull > 0.04 || star.radius < 260) {
      ctx.strokeStyle = `rgba(${star.hue}, ${streakAlpha})`;
      ctx.lineWidth = star.size * (1 + pull * 1.8);
      ctx.beginPath();
      ctx.moveTo(prevX, prevY);
      ctx.lineTo(x, y);
      ctx.stroke();
    }

    ctx.fillStyle = `rgba(${star.hue}, ${star.alpha})`;
    ctx.beginPath();
    ctx.arc(x, y, star.size * (1 + pull * 0.45), 0, Math.PI * 2);
    ctx.fill();
  });
}

function drawAccretionDisk(center, time, pull) {
  const diskScale = Math.min(width, height) / 760;
  const diskWidth = Math.max(330, 680 * diskScale);
  const diskHeight = Math.max(118, 236 * diskScale);

  ctx.save();
  ctx.translate(center.x, center.y);
  ctx.rotate(-0.18 + Math.sin(time * 0.00024) * 0.025);
  ctx.scale(1, 0.48);
  ctx.lineCap = "round";
  ctx.globalCompositeOperation = "lighter";

  const flameGradient = ctx.createLinearGradient(-diskWidth * 0.58, 0, diskWidth * 0.46, 0);
  flameGradient.addColorStop(0, `rgba(255, 255, 236, ${0.9 + pull * 0.08})`);
  flameGradient.addColorStop(0.18, `rgba(255, 221, 92, ${0.78 + pull * 0.16})`);
  flameGradient.addColorStop(0.44, `rgba(255, 89, 18, ${0.54 + pull * 0.18})`);
  flameGradient.addColorStop(0.72, `rgba(150, 18, 8, ${0.26 + pull * 0.18})`);
  flameGradient.addColorStop(1, "rgba(48, 0, 0, 0)");

  ctx.shadowBlur = 54 + pull * 62;
  ctx.shadowColor = "rgba(255, 126, 16, 0.92)";
  ctx.lineWidth = 42 + pull * 34;
  ctx.strokeStyle = flameGradient;
  ctx.beginPath();
  ctx.ellipse(0, 0, diskWidth * 0.45, diskHeight * 0.72, 0, Math.PI * 0.68, Math.PI * 1.42);
  ctx.stroke();

  ctx.shadowBlur = 30 + pull * 30;
  ctx.lineWidth = 24 + pull * 22;
  ctx.strokeStyle = "rgba(255, 246, 196, 0.76)";
  ctx.beginPath();
  ctx.ellipse(-diskWidth * 0.05, -diskHeight * 0.03, diskWidth * 0.34, diskHeight * 0.58, 0, Math.PI * 0.78, Math.PI * 1.34);
  ctx.stroke();

  filaments.forEach((filament, index) => {
    const spin = time * filament.speed * (1 + pull * 5.5) + filament.phase;
    const arcStart = filament.start + spin;
    const arcEnd = arcStart + filament.length * (1 + pull * 0.48);
    const orbitGradient = ctx.createLinearGradient(-filament.radiusX, 0, filament.radiusX, 0);
    const hot = filament.heat > 0.54;
    const alpha = Math.min(0.95, filament.alpha + pull * 0.34);

    orbitGradient.addColorStop(0, hot ? `rgba(255, 247, 212, ${alpha})` : `rgba(255, 176, 44, ${alpha * 0.85})`);
    orbitGradient.addColorStop(0.22, `rgba(255, 102, 15, ${alpha})`);
    orbitGradient.addColorStop(0.54, `rgba(176, 26, 8, ${alpha * 0.58})`);
    orbitGradient.addColorStop(0.82, `rgba(86, 2, 2, ${alpha * 0.32})`);
    orbitGradient.addColorStop(1, "rgba(0, 0, 0, 0)");

    ctx.shadowBlur = 12 + filament.width * 6 + pull * 24;
    ctx.shadowColor = hot ? "rgba(255, 212, 76, 0.84)" : "rgba(255, 58, 12, 0.72)";
    ctx.lineWidth = filament.width * (1 + pull * 1.15);
    ctx.strokeStyle = orbitGradient;
    ctx.beginPath();
    ctx.ellipse(
      Math.sin(index * 1.7 + time * 0.00031) * 8,
      Math.cos(index * 1.3 + time * 0.00027) * 8,
      filament.radiusX * (0.58 + diskScale * 0.48),
      filament.radiusY * (0.62 + diskScale * 0.42),
      0,
      arcStart,
      arcEnd,
    );
    ctx.stroke();
  });

  ctx.restore();

  ctx.save();
  ctx.translate(center.x, center.y);
  ctx.rotate(-0.18 + time * 0.00042);
  ctx.scale(1, 0.48);
  ctx.globalCompositeOperation = "lighter";
  ctx.strokeStyle = `rgba(255, 221, 96, ${0.16 + pull * 0.24})`;
  ctx.shadowBlur = 18 + pull * 22;
  ctx.shadowColor = "rgba(255, 90, 16, 0.76)";
  ctx.lineWidth = 2.4 + pull * 2.2;
  ctx.beginPath();
  ctx.ellipse(0, 0, diskWidth * 0.34, diskHeight * 0.31, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = `rgba(255, 50, 20, ${0.18 + pull * 0.22})`;
  ctx.lineWidth = 1.1 + pull * 1.4;
  ctx.beginPath();
  ctx.ellipse(0, 0, diskWidth * 0.52, diskHeight * 0.5, 0, Math.PI * 1.66, Math.PI * 2.54);
  ctx.stroke();
  ctx.restore();
}

function drawEventHorizon(center, time, pull) {
  const radius = Math.max(72, Math.min(width, height) * 0.11);
  const inner = ctx.createRadialGradient(center.x, center.y, 0, center.x, center.y, radius * 2.1);
  inner.addColorStop(0, "rgba(0, 0, 0, 1)");
  inner.addColorStop(0.48, "rgba(0, 0, 0, 1)");
  inner.addColorStop(0.61, `rgba(255, 234, 173, ${0.22 + pull * 0.24})`);
  inner.addColorStop(0.72, `rgba(255, 80, 12, ${0.28 + pull * 0.32})`);
  inner.addColorStop(0.86, `rgba(105, 8, 4, ${0.24 + pull * 0.24})`);
  inner.addColorStop(1, "rgba(0, 0, 0, 0)");

  ctx.fillStyle = inner;
  ctx.beginPath();
  ctx.arc(center.x, center.y, radius * (1.82 + pull * 0.16), 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.translate(center.x, center.y);
  ctx.rotate(-0.16 + time * 0.0013);
  ctx.scale(1, 0.52);
  ctx.globalCompositeOperation = "lighter";
  ctx.strokeStyle = `rgba(255, 235, 184, ${0.54 + pull * 0.34})`;
  ctx.shadowBlur = 34 + pull * 48;
  ctx.shadowColor = "rgba(255, 182, 42, 0.92)";
  ctx.lineWidth = 3 + pull * 3.4;
  ctx.beginPath();
  ctx.ellipse(0, 0, radius * (1.2 + pull * 0.12), radius * (0.72 + pull * 0.08), 0, Math.PI * 0.7, Math.PI * 1.46);
  ctx.stroke();

  ctx.strokeStyle = `rgba(255, 70, 18, ${0.44 + pull * 0.38})`;
  ctx.shadowColor = "rgba(255, 54, 8, 0.86)";
  ctx.lineWidth = 2.2 + pull * 2.8;
  ctx.beginPath();
  ctx.ellipse(0, 0, radius * (1.36 + pull * 0.16), radius * (0.82 + pull * 0.1), 0, Math.PI * 1.48, Math.PI * 2.28);
  ctx.stroke();
  ctx.restore();

  ctx.fillStyle = "rgba(0, 0, 0, 0.98)";
  ctx.shadowBlur = 34 + pull * 24;
  ctx.shadowColor = "rgba(0, 0, 0, 1)";
  ctx.beginPath();
  ctx.arc(center.x, center.y, radius * (0.88 + pull * 0.12), 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
}

function createAbsorbSparks(center) {
  sparks.length = 0;

  for (let index = 0; index < 84; index += 1) {
    sparks.push({
      angle: Math.random() * Math.PI * 2,
      radius: 30 + Math.random() * Math.max(width, height) * 0.72,
      speed: 0.018 + Math.random() * 0.04,
      size: 1 + Math.random() * 3.6,
      hue: index % 3 === 0 ? "255, 202, 106" : index % 3 === 1 ? "126, 215, 255" : "255, 107, 159",
      x: center.x,
      y: center.y,
    });
  }
}

function drawSparks(center, delta, pull) {
  if (!absorbing) return;

  sparks.forEach((spark) => {
    spark.angle += spark.speed * delta;
    spark.radius *= 1 - Math.min(0.16, 0.003 + pull * 0.03);
    spark.x = center.x + Math.cos(spark.angle) * spark.radius;
    spark.y = center.y + Math.sin(spark.angle) * spark.radius * 0.58;

    ctx.fillStyle = `rgba(${spark.hue}, ${Math.min(1, 0.2 + pull)})`;
    ctx.beginPath();
    ctx.arc(spark.x, spark.y, spark.size * (1 + pull), 0, Math.PI * 2);
    ctx.fill();
  });
}

function drawPointerLens(center) {
  if (!pointer.active || absorbing) return;

  const px = pointer.x * width;
  const py = pointer.y * height;
  const distance = Math.hypot(px - center.x, py - center.y);
  const alpha = Math.max(0, 1 - distance / Math.max(width, height));

  ctx.strokeStyle = `rgba(255, 255, 255, ${0.06 * alpha})`;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(px, py);
  ctx.lineTo(center.x, center.y);
  ctx.stroke();
}

function tick(time = performance.now()) {
  const delta = Math.min(42, time - lastFrame);
  lastFrame = time;
  const center = blackHoleCenter();
  const elapsed = absorbing ? time - absorbStart : 0;
  const pull = absorbing ? Math.min(1, elapsed / 1450) : 0;

  drawSpace(center, time);
  drawStars(center, delta, time, pull);
  drawAccretionDisk(center, time, pull);
  drawSparks(center, delta, pull);
  drawEventHorizon(center, time, pull);
  drawPointerLens(center);

  requestAnimationFrame(tick);
}

function resetAbsorption() {
  absorbing = false;
  document.body.classList.remove("absorbing");
  document.querySelectorAll(".sinkable").forEach((element) => {
    element.style.removeProperty("--sink-x");
    element.style.removeProperty("--sink-y");
    element.style.removeProperty("--sink-rotate");
    element.style.removeProperty("--sink-delay");
  });
}

function markSinkTargets(center) {
  const elements = sinkSelectors.flatMap((selector) => Array.from(document.querySelectorAll(selector)));

  elements.forEach((element, index) => {
    const rect = element.getBoundingClientRect();
    const elementCenterX = rect.left + rect.width / 2;
    const elementCenterY = rect.top + rect.height / 2;
    const distance = Math.hypot(center.x - elementCenterX, center.y - elementCenterY);
    const delay = Math.min(300, index * 22 + Math.random() * 70);
    const spin = (distance > 420 ? 1 : -1) * (300 + Math.random() * 680);

    element.classList.add("sinkable");
    element.style.setProperty("--sink-x", `${center.x - elementCenterX}px`);
    element.style.setProperty("--sink-y", `${center.y - elementCenterY}px`);
    element.style.setProperty("--sink-rotate", `${spin}deg`);
    element.style.setProperty("--sink-delay", `${delay}ms`);
  });
}

function triggerAbsorption(after) {
  if (absorbing) return;

  window.clearTimeout(resetTimer);
  const center = blackHoleCenter();
  absorbing = true;
  absorbStart = performance.now();
  markSinkTargets(center);
  createAbsorbSparks(center);
  document.body.classList.add("absorbing");

  if (after) {
    resetTimer = window.setTimeout(after, 1580);
    return;
  }

  resetTimer = window.setTimeout(resetAbsorption, 2350);
}

function navigateAfterAbsorption(link) {
  const href = link.getAttribute("href");
  if (!href || href === "#") return;

  triggerAbsorption(() => {
    if (href.startsWith("#")) {
      resetAbsorption();
      document.querySelector(href)?.scrollIntoView({ behavior: "smooth" });
      return;
    }

    window.location.href = link.href;
  });
}

window.addEventListener("resize", resetCanvas);
window.addEventListener("pointermove", (event) => {
  pointer.x = event.clientX / Math.max(width, 1);
  pointer.y = event.clientY / Math.max(height, 1);
  pointer.active = true;
});
window.addEventListener("pointerleave", () => {
  pointer.active = false;
});

document.addEventListener("click", (event) => {
  if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

  const target = event.target instanceof Element ? event.target : null;
  const link = target?.closest("a");
  if (link) {
    event.preventDefault();
    navigateAfterAbsorption(link);
    return;
  }

  triggerAbsorption();
});

resetCanvas();
tick();
