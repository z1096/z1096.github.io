# Black Hole Fast Load Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show a black-hole silhouette at first paint and reduce blocking lookup data from 3.70 MB to below 0.80 MB.

**Architecture:** A deterministic Node script resamples the upstream float lookup tables into new optimized assets. The page displays a CSS placeholder until either the relativistic renderer or particle fallback reports its first rendered frame, then cross-fades to the canvas.

**Tech Stack:** Static HTML/CSS, JavaScript ES modules, Node.js built-ins, WebGL2, GitHub Pages.

## Global Constraints

- Keep the existing relativistic shader model and absorption interaction.
- Preserve the original upstream assets and BSD-3-Clause license.
- Add no runtime dependencies or service worker.
- Support desktop and 390x844 mobile layouts.

---

### Task 1: Optimized Lookup Generator

**Files:**
- Create: `scripts/optimize-black-hole-assets.mjs`
- Create: `scripts/verify-black-hole-assets.mjs`
- Modify: `package.json`
- Create: `vendor/ebruneton-black-hole/deflection-256.dat`
- Create: `vendor/ebruneton-black-hole/doppler-32.dat`

**Interfaces:**
- Produces `deflection-256.dat` as header `[256,256]` plus RG32F pixels.
- Produces `doppler-32.dat` as header `[32,16,32]` plus RGB32F voxels.

- [ ] Write verification script that requires both optimized files, dimensions, exact byte sizes, and total lookup bytes below 800000.
- [ ] Run `node scripts/verify-black-hole-assets.mjs` and confirm it fails because the optimized files do not exist.
- [ ] Implement deterministic bilinear 2D and trilinear 3D resampling using Node built-ins.
- [ ] Generate the assets and run the verification script until it passes.
- [ ] Add `assets:optimize`, `assets:verify`, and extend `check` with asset verification.

### Task 2: First-Paint Placeholder And Ready Signal

**Files:**
- Modify: `index.html`
- Modify: `styles.css`
- Modify: `black-hole-relativistic.js`
- Modify: `black-hole-3d.js`

**Interfaces:**
- Placeholder element: `#black-hole-placeholder`.
- Ready state: `document.documentElement.classList.contains("black-hole-ready")`.
- Renderers call `markReady()` only after their first successful draw.

- [ ] Add a static verification script assertion for placeholder markup, ready-state CSS, and ready calls; run it and confirm failure.
- [ ] Add the responsive CSS placeholder and canvas opacity transition.
- [ ] Mark readiness after the first relativistic and particle frames.
- [ ] Ensure fallback failures leave the placeholder visible.
- [ ] Run static verification until it passes.

### Task 3: Runtime Asset Integration

**Files:**
- Modify: `black-hole-relativistic.js`
- Modify: `main.js`
- Modify: `index.html`

**Interfaces:**
- Relativistic renderer fetches `deflection-256.dat` and `doppler-32.dat`.
- Doppler texture upload dimensions are `32x16x32`.

- [ ] Extend static verification to assert optimized URLs and Doppler dimensions; confirm failure.
- [ ] Point fetches and texture upload to optimized assets.
- [ ] Update cache query versions.
- [ ] Run `npm run check` and `git diff --check`.

### Task 4: Browser Verification And Delivery

**Files:**
- Modify only if browser verification exposes a defect.

**Interfaces:**
- Placeholder is visible before ready state.
- Canvas is visible after ready state.
- Absorption enters and resets the `absorbing` state.

- [ ] Test a cache-busting local load and inspect console errors.
- [ ] Verify desktop and 390x844 mobile screenshots.
- [ ] Verify canvas resolution drops during absorption and restores afterward.
- [ ] Run all checks, inspect the exact staged file list, commit, push, and verify GitHub Pages.
