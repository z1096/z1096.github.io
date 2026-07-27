import { readFile } from "node:fs/promises";

async function source(name) {
  return readFile(new URL(`../${name}`, import.meta.url), "utf8");
}

function requirePattern(contents, pattern, message) {
  if (!pattern.test(contents)) throw new Error(message);
}

const [html, css, relativistic, particle] = await Promise.all([
  source("index.html"),
  source("styles.css"),
  source("black-hole-relativistic.js"),
  source("black-hole-3d.js"),
]);

requirePattern(html, /id=["']black-hole-placeholder["']/, "Missing first-paint black-hole placeholder");
requirePattern(css, /#black-hole-placeholder/, "Missing placeholder styling");
requirePattern(css, /\.black-hole-ready[^}]*#signal-canvas/s, "Missing ready-state canvas transition");
requirePattern(css, /\.black-hole-ready[^}]*#black-hole-placeholder/s, "Missing ready-state placeholder transition");
requirePattern(relativistic, /gl\.drawArrays[\s\S]*markReady\(\)/, "Relativistic renderer must mark ready after drawing");
requirePattern(particle, /renderer\.render[\s\S]*markReady\(\)/, "Particle fallback must mark ready after rendering");
requirePattern(relativistic, /deflection-256\.dat/, "Relativistic renderer must use the optimized deflection lookup");
requirePattern(relativistic, /doppler-32\.dat/, "Relativistic renderer must use the optimized Doppler lookup");
requirePattern(relativistic, /a\.doppler\.subarray\(0, 3\)/, "Doppler dimensions must come from the optimized asset header");
requirePattern(relativistic, /a\.doppler\.subarray\(3\)/, "Doppler texture upload must skip the asset header");

console.log("Verified black-hole first-paint and first-frame contracts");
