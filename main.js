const canvas = document.querySelector("#signal-canvas");
const ctx = canvas.getContext("2d");
const pointer = { x: 0.5, y: 0.42, active: false };
const stars = [];
const sparks = [];
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
    hue: Math.random() > 0.58 ? "126, 215, 255" : Math.random() > 0.5 ? "255, 202, 106" : "185, 140, 255",
    stretch: 0.48 + Math.random() * 0.2,
    wobble: Math.random() * Math.PI * 2,
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
}

function drawSpace(center, time) {
  const wash = ctx.createRadialGradient(center.x, center.y, 20, center.x, center.y, Math.max(width, height) * 0.86);
  wash.addColorStop(0, "rgba(0, 0, 0, 0.98)");
  wash.addColorStop(0.24, "rgba(14, 9, 20, 0.72)");
  wash.addColorStop(0.58, "rgba(4, 4, 10, 0.86)");
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
  const diskWidth = Math.max(280, 540 * diskScale);
  const diskHeight = Math.max(92, 166 * diskScale);

  ctx.save();
  ctx.translate(center.x, center.y);
  ctx.rotate(-0.12 + Math.sin(time * 0.00024) * 0.025);
  ctx.scale(1, 0.38);
  ctx.lineCap = "round";

  const glow = 28 + pull * 36;
  ctx.shadowBlur = glow;
  ctx.shadowColor = "rgba(255, 202, 106, 0.88)";
  ctx.lineWidth = 38 + pull * 20;
  ctx.strokeStyle = "rgba(255, 202, 106, 0.25)";
  ctx.beginPath();
  ctx.ellipse(0, 0, diskWidth * 0.42, diskHeight * 0.62, 0, Math.PI * 0.08, Math.PI * 1.08);
  ctx.stroke();

  ctx.shadowColor = "rgba(255, 107, 159, 0.78)";
  ctx.lineWidth = 22 + pull * 16;
  ctx.strokeStyle = "rgba(255, 107, 159, 0.46)";
  ctx.beginPath();
  ctx.ellipse(0, 0, diskWidth * 0.46, diskHeight * 0.72, 0, Math.PI * 1.02, Math.PI * 1.94);
  ctx.stroke();

  ctx.shadowColor = "rgba(126, 215, 255, 0.8)";
  ctx.lineWidth = 14 + pull * 12;
  ctx.strokeStyle = "rgba(126, 215, 255, 0.58)";
  ctx.beginPath();
  ctx.ellipse(0, 0, diskWidth * 0.52, diskHeight * 0.84, 0, Math.PI * 1.96, Math.PI * 2.42);
  ctx.stroke();

  ctx.restore();

  ctx.save();
  ctx.translate(center.x, center.y);
  ctx.rotate(time * 0.00032);
  ctx.strokeStyle = `rgba(255, 255, 255, ${0.08 + pull * 0.12})`;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.ellipse(0, 0, diskWidth * 0.32, diskHeight * 0.24, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawEventHorizon(center, time, pull) {
  const radius = Math.max(72, Math.min(width, height) * 0.11);
  const inner = ctx.createRadialGradient(center.x, center.y, 0, center.x, center.y, radius * 2.1);
  inner.addColorStop(0, "rgba(0, 0, 0, 1)");
  inner.addColorStop(0.48, "rgba(0, 0, 0, 1)");
  inner.addColorStop(0.62, `rgba(126, 215, 255, ${0.22 + pull * 0.32})`);
  inner.addColorStop(0.74, `rgba(255, 202, 106, ${0.18 + pull * 0.28})`);
  inner.addColorStop(1, "rgba(0, 0, 0, 0)");

  ctx.fillStyle = inner;
  ctx.beginPath();
  ctx.arc(center.x, center.y, radius * (1.82 + pull * 0.16), 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.translate(center.x, center.y);
  ctx.rotate(time * 0.0013);
  ctx.strokeStyle = `rgba(126, 215, 255, ${0.4 + pull * 0.32})`;
  ctx.shadowBlur = 28 + pull * 42;
  ctx.shadowColor = "rgba(126, 215, 255, 0.9)";
  ctx.lineWidth = 2 + pull * 2.5;
  ctx.beginPath();
  ctx.arc(0, 0, radius * (1.11 + pull * 0.08), Math.PI * 0.08, Math.PI * 1.48);
  ctx.stroke();

  ctx.strokeStyle = `rgba(255, 202, 106, ${0.42 + pull * 0.36})`;
  ctx.shadowColor = "rgba(255, 202, 106, 0.86)";
  ctx.beginPath();
  ctx.arc(0, 0, radius * (1.2 + pull * 0.1), Math.PI * 1.56, Math.PI * 2.22);
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
