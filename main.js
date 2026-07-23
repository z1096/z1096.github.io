import { createBlackHoleScene } from "./black-hole-3d.js?v=20260723-redesign3";

const canvas = document.querySelector("#signal-canvas");
const blackHole = createBlackHoleScene(canvas);
const sinkSelectors = [
  ".brand",
  ".nav-links",
  ".hero-copy",
  ".hero-status > div",
  ".section-heading",
  ".project-card",
  ".site-footer > *",
];

let absorbing = false;
let resetTimer = 0;

function blackHoleCenter() {
  return blackHole.getAbsorptionPoint();
}

function resetAbsorption() {
  absorbing = false;
  blackHole.setAbsorbing(false);
  document.body.classList.remove("absorbing");
  document.querySelectorAll(".sinkable").forEach((element) => {
    element.style.removeProperty("--sink-pre-x");
    element.style.removeProperty("--sink-pre-y");
    element.style.removeProperty("--sink-mid-x");
    element.style.removeProperty("--sink-mid-y");
    element.style.removeProperty("--sink-near-x");
    element.style.removeProperty("--sink-near-y");
    element.style.removeProperty("--sink-x");
    element.style.removeProperty("--sink-y");
    element.style.removeProperty("--sink-rotate-pre");
    element.style.removeProperty("--sink-rotate-mid");
    element.style.removeProperty("--sink-rotate-near");
    element.style.removeProperty("--sink-rotate-late");
    element.style.removeProperty("--sink-rotate");
    element.style.removeProperty("--sink-tilt-mid");
    element.style.removeProperty("--sink-tilt-near");
    element.style.removeProperty("--sink-tilt");
    element.style.removeProperty("--sink-delay");
  });
}

function markSinkTargets(center) {
  const elements = sinkSelectors.flatMap((selector) => Array.from(document.querySelectorAll(selector)));

  elements.forEach((element, index) => {
    const rect = element.getBoundingClientRect();
    const elementCenterX = rect.left + rect.width / 2;
    const elementCenterY = rect.top + rect.height / 2;
    const dx = center.x - elementCenterX;
    const dy = center.y - elementCenterY;
    const distance = Math.hypot(dx, dy);
    const side = elementCenterX < center.x ? -1 : 1;
    const curve = side * Math.min(150, 32 + distance * 0.1);
    const lift = Math.min(70, 18 + distance * 0.04);
    const delay = Math.min(220, index * 12 + distance * 0.08);
    const spin = side * (108 + Math.random() * 168);
    const tilt = side * (6 + Math.random() * 10);

    element.classList.add("sinkable");
    element.style.setProperty("--sink-pre-x", `${-dx * 0.035}px`);
    element.style.setProperty("--sink-pre-y", `${-dy * 0.025 - 8}px`);
    element.style.setProperty("--sink-mid-x", `${dx * 0.42 + curve}px`);
    element.style.setProperty("--sink-mid-y", `${dy * 0.38 - lift}px`);
    element.style.setProperty("--sink-near-x", `${dx * 0.82 + curve * 0.24}px`);
    element.style.setProperty("--sink-near-y", `${dy * 0.78 - lift * 0.24}px`);
    element.style.setProperty("--sink-x", `${dx}px`);
    element.style.setProperty("--sink-y", `${dy}px`);
    element.style.setProperty("--sink-rotate-pre", `${spin * -0.035}deg`);
    element.style.setProperty("--sink-rotate-mid", `${spin * 0.22}deg`);
    element.style.setProperty("--sink-rotate-near", `${spin * 0.64}deg`);
    element.style.setProperty("--sink-rotate-late", `${spin * 0.9}deg`);
    element.style.setProperty("--sink-rotate", `${spin}deg`);
    element.style.setProperty("--sink-tilt-mid", `${tilt * 0.62}deg`);
    element.style.setProperty("--sink-tilt-near", `${tilt * -0.35}deg`);
    element.style.setProperty("--sink-tilt", `${tilt}deg`);
    element.style.setProperty("--sink-delay", `${delay}ms`);
  });
}

function triggerAbsorption(after) {
  if (absorbing) return;

  window.clearTimeout(resetTimer);
  const center = blackHoleCenter();
  absorbing = true;
  blackHole.setAbsorbing(true);
  markSinkTargets(center);
  document.body.classList.add("absorbing");

  if (after) {
    resetTimer = window.setTimeout(after, 2050);
    return;
  }

  resetTimer = window.setTimeout(resetAbsorption, 3000);
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

window.addEventListener("pointermove", (event) => {
  blackHole.setPointer(event.clientX / Math.max(window.innerWidth, 1), event.clientY / Math.max(window.innerHeight, 1));
});
window.addEventListener("pointerleave", () => {
  blackHole.clearPointer();
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
