const canvas = document.querySelector("#signal-canvas");
const ctx = canvas.getContext("2d");
const pointer = { x: 0.5, y: 0.5, active: false };
const dots = [];
let width = 0;
let height = 0;
let pixelRatio = 1;

function resetCanvas() {
  pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  width = window.innerWidth;
  height = window.innerHeight;
  canvas.width = Math.floor(width * pixelRatio);
  canvas.height = Math.floor(height * pixelRatio);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

  const count = Math.max(44, Math.min(92, Math.floor((width * height) / 18000)));
  dots.length = 0;

  for (let index = 0; index < count; index += 1) {
    dots.push({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.24,
      vy: (Math.random() - 0.5) * 0.24,
      r: 1.4 + Math.random() * 2.6,
      hue: Math.random() > 0.62 ? "104, 216, 214" : "115, 211, 108",
    });
  }
}

function drawGrid() {
  ctx.strokeStyle = "rgba(243, 240, 232, 0.035)";
  ctx.lineWidth = 1;

  for (let x = 0; x < width; x += 48) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }

  for (let y = 0; y < height; y += 48) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
}

function tick() {
  ctx.clearRect(0, 0, width, height);
  drawGrid();

  const px = pointer.x * width;
  const py = pointer.y * height;

  dots.forEach((dot, index) => {
    dot.x += dot.vx;
    dot.y += dot.vy;

    if (dot.x < -20) dot.x = width + 20;
    if (dot.x > width + 20) dot.x = -20;
    if (dot.y < -20) dot.y = height + 20;
    if (dot.y > height + 20) dot.y = -20;

    for (let next = index + 1; next < dots.length; next += 1) {
      const other = dots[next];
      const dx = dot.x - other.x;
      const dy = dot.y - other.y;
      const distance = Math.hypot(dx, dy);

      if (distance < 132) {
        ctx.strokeStyle = `rgba(${dot.hue}, ${0.13 * (1 - distance / 132)})`;
        ctx.beginPath();
        ctx.moveTo(dot.x, dot.y);
        ctx.lineTo(other.x, other.y);
        ctx.stroke();
      }
    }

    const pointerDistance = Math.hypot(dot.x - px, dot.y - py);
    if (pointer.active && pointerDistance < 180) {
      ctx.strokeStyle = `rgba(255, 122, 102, ${0.22 * (1 - pointerDistance / 180)})`;
      ctx.beginPath();
      ctx.moveTo(dot.x, dot.y);
      ctx.lineTo(px, py);
      ctx.stroke();
    }

    ctx.fillStyle = `rgba(${dot.hue}, 0.68)`;
    ctx.beginPath();
    ctx.arc(dot.x, dot.y, dot.r, 0, Math.PI * 2);
    ctx.fill();
  });

  requestAnimationFrame(tick);
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

resetCanvas();
tick();
