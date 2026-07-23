# Z1096 Lab

Personal GitHub Pages homepage for `https://z1096.github.io/`.

## Repository Name

The repository must be named `z1096.github.io` to publish the user homepage at the root GitHub Pages URL.

## Local Preview

```bash
python3 -m http.server 4173 --bind 127.0.0.1
```

Then open `http://127.0.0.1:4173/`.

## Tech

- Static HTML/CSS/JavaScript
- Relativistic WebGL2 ray tracing with a Three.js particle fallback
- CSS transforms for the click-to-absorb page module animation

## Check

```bash
npm run check
```

## Deploy

Push the `main` branch to GitHub and enable Pages from:

- Source: Deploy from a branch
- Branch: `main`
- Folder: `/ (root)`

The project is static and has no build step. The browser loads the vendored Three.js module from `vendor/`.

The relativistic shader is adapted from
[`ebruneton/black_hole_shader`](https://github.com/ebruneton/black_hole_shader)
under its BSD-3-Clause license. See `vendor/ebruneton-black-hole/LICENSE`.
