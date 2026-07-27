# Black Hole Fast Load Design

## Goal

Make the black hole visible immediately and reduce the time before the full
relativistic renderer produces its first frame, without changing the homepage
interaction or overall visual composition.

## Root Cause

The renderer blocks on `Promise.all` until all shader sources, images, and
3.76 MB of floating-point lookup data have downloaded. It then creates GPU
textures and compiles the full fragment shader before drawing anything. The
largest blocking resources are the 512x512 ray-deflection table (2.11 MB) and
the 64x32x64 Doppler table (1.57 MB).

## Design

### Immediate Placeholder

Add a CSS-only black-hole placeholder behind the WebGL canvas. It uses a dark
event horizon, a narrow amber disc, and a lensing arc positioned at the same
responsive absorption point as the renderer. It is visible from first paint,
requires no network request, and does not receive pointer events.

The placeholder remains visible while WebGL resources load. After the first
real frame is drawn, the renderer adds a ready class to the document. CSS then
cross-fades the placeholder out and the canvas in over a short transition.

### Smaller Lookup Tables

Generate and vendor two reduced lookup tables:

- Ray deflection: 512x512 to 256x256, bilinear resampling, RG32F.
- Doppler color: 64x32x64 to 32x16x32, trilinear-compatible sampling, RGB32F.

The inverse-radius and black-body tables remain unchanged because they are
small. The renderer reads texture dimensions from the files and uploads the
smaller Doppler texture with its new dimensions. Expected blocking lookup data
decreases from about 3.70 MB to about 0.74 MB.

### Loading State And Failure Handling

The canvas starts transparent. The renderer marks itself ready only after a
successful draw. If WebGL2, resource loading, or shader compilation fails, the
existing Three.js fallback starts and marks the scene ready after its first
frame. The CSS placeholder therefore remains visible until either renderer is
actually producing output.

### Cache Behavior

Update module and stylesheet query versions so GitHub Pages clients fetch the
new loader and assets. The lookup assets use new filenames, allowing long-lived
browser caching without conflicting with the original files.

## Scope

Included:

- Optimized lookup data and a reproducible Node generation script.
- CSS placeholder and cross-fade state.
- First-frame readiness signaling for both renderers.
- Desktop and mobile visual checks.

Excluded:

- Service workers or offline caching.
- Replacing the relativistic shader model.
- Changing absorption timing or homepage content.
- Deleting the original licensed upstream lookup files in this change.

## Verification

1. Run the lookup generator and verify exact output dimensions and byte sizes.
2. Run `npm run check` and `git diff --check`.
3. Load with a cache-busting URL and confirm the placeholder is visible before
   the renderer-ready class appears.
4. Confirm the optimized renderer compiles without console errors.
5. Compare desktop and 390x844 mobile screenshots for framing and artifacts.
6. Verify click absorption still enters and resets the `absorbing` state.
7. Verify WebGL canvas resolution still drops during absorption and restores.
