# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

QRding is a self-hosted QR code generator (WiFi, vCard, calendar event, free text) built with SvelteKit 2 + Svelte 5 (runes), Tailwind CSS v4 and bits-ui. Live demo: https://qrding.app. The README's roadmap (saving codes, scan-triggered automations/webhooks) is not implemented yet.

## Commands

```bash
npm ci                 # install (Node 24, matching the Dockerfile)
npm run dev            # Vite dev server
npm run build          # production build via adapter-node -> ./build
npm run preview        # serve the production build
node build             # run the built server (port 3000, as in Docker)
npm run check          # svelte-kit sync + svelte-check (type checking)
npm run lint           # prettier --check . && eslint .
npm run format         # prettier --write .
npm test               # vitest run (unit tests)
npx vitest run -t 'encodeWifi'   # run a single describe/test by name
```

Unit tests (Vitest) live next to the code as `*.test.ts` and cover the pure modules in `src/lib`; UI changes still need checking in the running app. Lint, check and tests pass with zero errors and warnings, and CI (`.github/workflows/ci.yml`) runs them plus a build and a Docker build on every push to `main` and on every PR. Keep them passing.

Docker: `docker build -t qrding .` builds a multi-stage `node:24-alpine` image. The runtime stage contains only `build/` and `package.json`, strips npm/yarn/corepack (the base image's reported CVEs are in their bundled deps), runs as `node` and exposes 3000. `docker-compose.yaml` pulls `ghcr.io/rishikanthc/qrding:latest`; uncomment `build: .` to build locally.

All packages are `devDependencies` on purpose. adapter-node bundles devDependencies into `build/` and leaves `dependencies` as runtime imports, so an empty `dependencies` is what lets the image ship without `node_modules`. Add new packages with `npm i -D`.

TypeScript is pinned to `~6.0`, because Kit, svelte-check and typescript-eslint don't support 7 yet.

Prettier config: tabs, single quotes, no trailing commas, print width 100, with the Svelte and Tailwind class-sorting plugins.

## Architecture

Everything runs in the browser; there is no server code (no hooks, endpoints or database). `src/routes/+page.ts` sets `prerender = true`, so adapter-node serves the page as static HTML.

- `src/lib/encoders/*.ts` (wifi, vcard, vevent, url, sms, phone, email, geo): pure functions that turn a template's fields into the exact QR payload (`WIFI:…;;`, vCard 3.0, a bare `BEGIN:VEVENT`, `https://…`, `SMSTO:`, `tel:`, `mailto:`, `geo:`) plus a filename hint. Each owns its format's escaping. An empty string means "not enough input" and makes the page show the placeholder.
- `src/lib/qr_code_templates/*Form.svelte`: dumb forms. Each takes one `$bindable()` fields object (`TextForm` takes `text`) and only binds inputs to it.
- `src/routes/+page.svelte`: owns one `$state` fields object per template, so switching templates keeps input. It derives `payload` and `filenameHint` from the selected template, and holds the shared options (title, size, error correction, colors, logo).
- `src/lib/render.ts`: `drawQrCode` draws onto the preview `<canvas>`, which is also the download source.
- `src/lib/color.ts` (contrast / inverted-color warning) and `src/lib/filename.ts`.

To add a template: write an encoder plus tests in `src/lib/encoders/`, a form bound to its fields type, a `$state` object and `payload`/`filenameHint` cases in `+page.svelte`, an entry in `modeOptions`, and a branch in the `{#if selectedModeValue === …}` chain.

### Rendering

`QRCode.create` (sync; it throws when the payload doesn't fit, which the page shows as an error) is a `$derived` value. A single `$effect` then calls `drawQrCode`, which:

1. Sizes the canvas using `canvasSize()`. The preview box uses the same function, so the two stay in sync.
2. Fills the canvas with the light color and draws the modules as rects on integer pixel edges.
3. Draws the optional title above the code, condensed with `fillText`'s `maxWidth`.
4. Centers the optional logo over a light clearing box.

The whole render is synchronous, so there is nothing to cancel or race. Don't reintroduce async steps in the render path.

- **Logo:** decoded once with `createImageBitmap` on upload. `logoLoadId` discards a decode that finishes after a newer upload or a clear. Uploading raises error correction to H, and a warning shows if the user lowers it below Q.
- **Download:** the PNG is only encoded at download time (`canvas.toBlob`).
- **Color pickers:** they and the canvas stay mounted while the code is valid. Unmounting a color input mid-change closes the browser's native picker.
- **Constants:** layout sizes and padding are the `CANVAS_*` / `LOGO_*` constants in `render.ts`.

## Conventions

- All components use `<script lang="ts">`.
- Use Svelte 5 runes (`$state`, `$derived`, `$effect`, `$props`, `$bindable`) and `onclick`-style event attributes, not `on:` directives.
- Every `<label>` must be tied to its control with `for`/`id`; svelte-check warns otherwise. For bits-ui sliders, use a `<span id>` plus `aria-labelledby` on `Slider.Thumb`.
- UI primitives (Select, Slider, Button) come from `bits-ui` v2, styled with Tailwind utility classes. The app uses a dark theme: `bg-gray-900`, blue labels and a lime accent `#d9ff7a`.
- Tailwind v4 is configured CSS-first. Custom color scales are defined in `@theme` in `src/app.css` (there is no `tailwind.config`). Note that `gray-900` is overridden to pure black. The Megrim logo font is a 1.5 KB woff2 subset of just the glyphs in "QRding" (declared and preloaded in `src/app.css` / `src/app.html`). Regenerate it from `static/fonts/Megrim-Regular.ttf` with the `pyftsubset` command in `app.css` if the logo text changes.
