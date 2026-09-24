# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

QRding is a self-hosted QR code generator (text, link, Wi-Fi, vCard, calendar event, SMS, phone, email, location; single codes or CSV batches; PNG/SVG export and a print sheet) built with SvelteKit 2 + Svelte 5 (runes), Tailwind CSS v4 and bits-ui. Live demo: https://qrding.app. The README's roadmap (saving codes, scan-triggered automations/webhooks) is not implemented yet.

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
npm run test:e2e       # Playwright browser tests (builds + previews on :4173)
npx playwright test -g 'Location'   # a single e2e test by name
```

Unit tests (Vitest) live next to the code as `src/**/*.test.ts` and cover the pure modules in `src/lib`. Browser tests (Playwright, `tests/*.spec.ts`) drive every template and decode the canvas with jsQR to assert the exact payload; add one for each new template. First run needs `npx playwright install chromium`. Lint, check, unit and e2e tests pass with zero errors and warnings, and CI (`.github/workflows/ci.yml`) runs them plus a build and a Docker build on every push to `main` and on every PR. Keep them passing.

Docker: `docker build -t qrding .` builds a multi-stage `node:24-alpine` image. The runtime stage contains only `build/` and `package.json`, strips npm/yarn/corepack (the base image's reported CVEs are in their bundled deps), runs as `node` and exposes 3000. `docker-compose.yaml` pulls `ghcr.io/rishikanthc/qrding:latest`; uncomment `build: .` to build locally.

All packages are `devDependencies` on purpose. adapter-node bundles devDependencies into `build/` and leaves `dependencies` as runtime imports, so an empty `dependencies` is what lets the image ship without `node_modules`. Add new packages with `npm i -D`.

TypeScript is pinned to `~6.0`, because Kit, svelte-check and typescript-eslint don't support 7 yet.

Prettier config: tabs, single quotes, no trailing commas, print width 100, with the Svelte and Tailwind class-sorting plugins.

## Architecture

Everything runs in the browser; there is no server code (no hooks, endpoints or database). `src/routes/+page.ts` sets `prerender = true`, so adapter-node serves the page as static HTML. Because of that, browser-only APIs (`navigator`, `ClipboardItem`, `document`) must only run in `onMount`, effects or event handlers, never at module or component top level.

- `src/lib/encoders/*.ts`: pure functions that turn a template's fields into the exact QR payload (`WIFI:…;;`, vCard 3.0, a bare `BEGIN:VEVENT`, `https://…`, `SMSTO:`, `tel:`, `mailto:`, `geo:`) plus a filename hint. Each owns its format's escaping. An empty string means "not enough input".
- `src/lib/templates.ts`: the template registry. `FieldsByMode` maps each mode to its fields type, and `templates` holds, per mode:
  - the label, `empty`, `encode` and `filename`;
  - for batch mode, the CSV `columns`, a `requirement` message, an `example` row and `fromRow`. `fromRow` coerces CSV text and throws readable errors, e.g. Wi-Fi security/hidden and spreadsheet date-times.

  Use `encodeFor` / `filenameFor` / `fieldsFromRow` to call a template with a `Mode` variable; they keep the mode and fields types correlated.

- `src/lib/qr_code_templates/*Form.svelte`: dumb forms. Each takes one `$bindable()` fields object and only binds inputs to it.
- `src/routes/+page.svelte`: owns `fields` (one object per mode, from `emptyFields()`, so switching templates keeps input) and the shared options (title, size, error correction, colors, logo, export format and PNG scale). `preview` is either the single code or the first batch row. `src/lib/components/` holds `SegmentedControl` (radio group) and `BatchInput` (CSV upload/paste and parse summary).
- Batch mode:
  - `src/lib/csv.ts` parses RFC 4180 CSV and detects `,` `;` or tab from the first line. A first line with no delimiter means one field per line, so URL lists with commas aren't split.
  - `src/lib/batch.ts` (pure) maps rows to `BatchItem`s. A header is detected by known column names; without one, columns are read in the template's order. It adds `caption` and `filename` columns, creates each `QRCode` (reporting rows that are too large), and numbers the file names.
  - `src/lib/batchExport.ts` (browser) renders the items into a ZIP (fflate, lazy-loaded; PNGs stored, SVGs deflated) or into SVG images for the print sheet. It reads every code back with the scan check and reports the failing rows.
- Export (`src/lib/export.ts`, browser):
  - PNGs are rendered at `scale` × `size` and tagged 300 DPI via a `pHYs` chunk (`src/lib/png.ts`), so "mm at 300 DPI" holds when placed in documents or label software.
  - `copyPng` builds its `ClipboardItem` synchronously from a promise, which Safari requires.
  - `loadLogo` rasterizes SVG logos through an `<img>` because `createImageBitmap` can't decode SVG, and keeps the original file as a data URL for SVG export.
- `src/lib/svg.ts`: `buildSvg` uses the same layout as the PNG with exact (unsnapped) edges, one `<path>` for all modules, the title as `<text>` (condensed with `textLength` when `measureTitle` says it's too wide), and the logo as `<image xlink:href>`.
- `src/lib/color.ts` (contrast / inverted-color warning), `src/lib/filename.ts`, `src/lib/verify.ts` (jsQR read-back).

To add a template:

1. Write an encoder plus tests in `src/lib/encoders/`.
2. Register it in `FieldsByMode`, `templates` and `emptyFields()`. The unit test that parses each template's CSV example then covers its batch mapping.
3. Add a form bound to its fields type and a branch in the page's `{#if selectedModeValue === …}` chain.
4. Add an e2e test that decodes the payload.

### Rendering

`QRCode.create` (sync; it throws when the payload doesn't fit, which the page shows as an error) is a `$derived` value. A single `$effect` then calls `drawQrCode`:

1. `canvasLayout(size, modules, hasTitle, { scale, snap })` computes the layout.
   - `size` is the full 1× image width. The code and a 4-module quiet zone (required by the QR spec, and asserted by tests) form one grid of `modules + 8` cells, so the margin scales with the module size.
   - `scale` multiplies everything (title font, padding, logo) for high-resolution exports.
   - `snap` rounds cell edges to whole pixels for raster output. SVG turns it off so modules stay equal when scaled.
   - The preview box uses the same function, so the two stay in sync.
2. The canvas is filled with the light color, and `moduleRects()` (one rect per horizontal run) draws the modules. Unit tests rasterize the same rects, and the SVG path, and decode them.
3. The optional title sits above the quiet zone on an alphabetic baseline shared with the SVG, condensed with `fillText`'s `maxWidth`.
4. The optional logo is placed by `logoPlacement()` (shared with SVG): centred over a light clearing box, at most 25% of the code, never upscaled beyond `scale`.

The whole render is synchronous, so there is nothing to cancel or race. Don't reintroduce async steps in the render path.

- **Logo:** decoded once on upload (`loadLogo`). `logoLoadId` discards a decode that finishes after a newer upload or a clear. Uploading raises error correction to H, and a warning shows if the user lowers it below Q.
- **Scan check:** 300 ms after the last change, the canvas is decoded with jsQR (lazy-loaded, `src/lib/verify.ts`, with inversion disabled like most phone scanners). The result shows as ✓ or ⚠ under the code (`data-testid="scan-check"`, `data-state`). Batch exports run the same check per code.
- **Download/copy:** files are only encoded on click. `downloadBlob` revokes its object URL after 10 s, because revoking immediately can cancel downloads.
- **Print sheet:** the app root has `print:hidden`, and the sheet (`data-testid="print-sheet"`, `hidden print:grid`, codes sized in mm) is the only thing printed. `@page` margins are in `app.css`.
- **Color pickers:** they and the canvas stay mounted while the code is valid. Unmounting a color input mid-change closes the browser's native picker.
- **Constants:** layout sizes and padding are the `TITLE_*` / `LOGO_*` / `QUIET_ZONE_MODULES` constants in `render.ts`.

## Conventions

- All components use `<script lang="ts">`.
- Use Svelte 5 runes (`$state`, `$derived`, `$effect`, `$props`, `$bindable`) and `onclick`-style event attributes, not `on:` directives.
- Every `<label>` must be tied to its control with `for`/`id`; svelte-check warns otherwise. For bits-ui sliders, use a `<span id>` plus `aria-labelledby` on `Slider.Thumb`.
- UI primitives (Select, Slider, Button) come from `bits-ui` v2, styled with Tailwind utility classes. The app uses a dark theme: `bg-gray-900`, blue labels and a lime accent `#d9ff7a`.
- Tailwind v4 is configured CSS-first. Custom color scales are defined in `@theme` in `src/app.css` (there is no `tailwind.config`). Note that `gray-900` is overridden to pure black. The Megrim logo font is a 1.5 KB woff2 subset of just the glyphs in "QRding" (declared and preloaded in `src/app.css` / `src/app.html`). Regenerate it from `static/fonts/Megrim-Regular.ttf` with the `pyftsubset` command in `app.css` if the logo text changes.
