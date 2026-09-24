# TODO

Remaining improvements for QRding, last reviewed 2026-09-23. Suggested order: the bugs (1–2) first, then 3 and 5, then 8–9.

Not planned: features that store information, such as remembering settings or inputs, dynamic QR codes (server-side redirect targets and scan counts), or saving and browsing generated codes.

## Bugs

- [ ] **1. The preview is too wide for phones.** The preview box has a fixed inline pixel width (image size + 32 px) in `src/routes/+page.svelte`. On a 390 px-wide phone, image sizes of 352 px and up make the page scroll sideways. Scale the preview down to the available width (for example `max-width: 100%` with `aspect-ratio`, and the canvas at `width: 100%; height: auto`). The exported file size must not change.
- [ ] **2. Some text is hard to read.** On the black background (`gray-900` is overridden to black in `src/app.css`), these colours are below the 4.5:1 contrast that WCAG AA requires (computed from the theme's OKLCH values):

  | Colour          | Used for                                             | Contrast |
  | --------------- | ---------------------------------------------------- | -------- |
  | `text-gray-600` | 9 hint texts, e.g. "\* SSID is required…"            | 2.7:1    |
  | `text-gray-500` | "QR code will appear here", "Checking scannability…" | 4.2:1    |
  | `text-blue-600` | 6 labels, e.g. "Image Size", "Error Correction"      | 3.3:1    |

  Change those colours and add an automated accessibility check (`@axe-core/playwright`) to the e2e tests. It would also flag that the "QRding" logo is a plain `div`; make it the page's `<h1>`.

## Features

- [ ] **3. Show the raw payload and capacity.** Show the exact encoded text, the code's size in modules (QR version), and how close it is to the maximum capacity at the chosen error correction level.
- [ ] **4. Design options.** A logo size slider (fixed at 25% of the code today, `LOGO_MAX_PERCENTAGE_OF_QR` in `src/lib/render.ts`), a round clear area behind the logo, and the caption above or below the code. Keep PNG and SVG output identical: `drawQrCode` and `buildSvg` share `canvasLayout` and `logoPlacement`.
- [ ] **5. Printing options.**
  - Batch print sheet: A4/Letter page size, cut marks or borders, and the caption below the code.
  - Exported PNGs: a DPI choice (203/300/600). Exports are always tagged 300 DPI (`PRINT_DPI` in `src/lib/export.ts`), but many thermal label printers are 203 DPI.
- [ ] **6. Offline / installable app (PWA).** A web app manifest plus a service worker (`src/service-worker.ts`) that caches only the app's own files. It must not store user data.
- [ ] **7. More templates.** Follow "To add a template" in `CLAUDE.md`.
  - Swish payment
  - EPC/SEPA bank transfer (the `BCD` format read by European banking apps)
  - WhatsApp chat link (`https://wa.me/<number>?text=…`)
  - MeCard, a compact contact format that gives a smaller code than vCard
  - An option to wrap calendar events in a full `VCALENDAR`, which some Android scanners handle better than a bare `VEVENT`

## Hosting and security

- [ ] **8. Security headers.** None are set today.
  - Add a Content Security Policy with `kit.csp` in `svelte.config.js`. The page is prerendered, so Kit emits it as a `<meta>` tag.
  - A `<meta>` CSP can't carry `frame-ancestors`, and prerendered pages bypass `hooks.server.ts`. So send `frame-ancestors` (or `X-Frame-Options`), `X-Content-Type-Options: nosniff` and `Referrer-Policy` as HTTP headers from a reverse proxy, or from the web server once item 9 is done.
- [ ] **9. Serve as a static site.** The app has no server code, so `adapter-static` behind Caddy or nginx would remove the Node runtime. The image would shrink from about 244 MB to a few tens of MB, and the remaining low-severity `cookie` advisories (in Kit's server code) would no longer apply. Set the headers from item 8 in the web server config.
- [ ] **10. Ops basics.**
  - A `HEALTHCHECK` in the Dockerfile and `docker-compose.yaml`.
  - Dependabot or Renovate for dependency updates.
  - A workflow that publishes the image to GHCR once the new repository exists. Then point `docker-compose.yaml` and the README at that image instead of `ghcr.io/rishikanthc/qrding`.

## Cleanup

- [ ] **11. Leftovers.**
  - The `magenta`, `magnum` and `purple` colour scales in `src/app.css` are unused.
  - `static/fonts/Megrim-Regular.ttf` is still served but unused (the app loads the 1.5 KB subset `Megrim-QRding.woff2`). Move it out of `static/` and keep it only as the source for regenerating the subset; update the `pyftsubset` command in `src/app.css` to the new path.
  - `bits-ui` is only used for Select, Slider and Button, so native elements could shrink the bundle. Measure the bundle size difference first.
