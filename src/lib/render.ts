import type { QRCode } from 'qrcode';

// The QR spec requires a light margin ("quiet zone") of 4 modules on every side; scanners use it
// to find the code. It scales with the module size, so it's part of the module grid, not fixed px.
export const QUIET_ZONE_MODULES = 4;
export const TITLE_FONT_SIZE = 20; // Font size for the title at 1×
export const TITLE_PADDING = 5; // Vertical padding above and below the title text (each side) at 1×
export const TITLE_FONT_FAMILY = 'Arial, Helvetica, sans-serif';
export const LOGO_MAX_PERCENTAGE_OF_QR = 0.25; // Logo max size relative to the code (e.g., 0.25 = 25%)
export const LOGO_BACKGROUND_PADDING = 4; // Padding around the logo for its background clearing box at 1×
// Title baseline below the top of its line, as a fraction of the font size (Arial's ascent is ~0.9 em).
// PNG and SVG both use this alphabetic baseline so they place the title identically.
const TITLE_BASELINE = 0.9;

export const titleFont = (fontSize: number) => `${fontSize}px ${TITLE_FONT_FAMILY}`;

export interface Rect {
	x: number;
	y: number;
	width: number;
	height: number;
}

export interface Layout {
	/** Output scale: 1 for the preview, >1 for high-resolution PNG exports. */
	scale: number;
	width: number;
	height: number;
	titleHeight: number;
	fontSize: number;
	/** y of the title's alphabetic baseline. */
	titleBaseline: number;
	/** Start and end of the code (without quiet zone) along each axis of the code square. */
	codeStart: number;
	codeEnd: number;
	/** Pixel position of grid line `i` (0 = outer edge of the quiet zone). */
	edge: (i: number) => number;
}

/**
 * Layout of the rendered image: `size * scale` px wide (code plus quiet zone), with the optional
 * title strip on top. The code and quiet zone form one grid of `moduleCount + 8` cells per side.
 * `snap` puts cell edges on whole pixels (raster output, no anti-aliased seams); SVG uses exact
 * edges so modules stay equal when the vector is scaled up.
 */
export function canvasLayout(
	size: number,
	moduleCount: number,
	hasTitle: boolean,
	{ scale = 1, snap = true }: { scale?: number; snap?: boolean } = {}
): Layout {
	const width = size * scale;
	const cells = moduleCount + QUIET_ZONE_MODULES * 2;
	const edge = snap
		? (i: number) => Math.round((i * width) / cells)
		: (i: number) => (i * width) / cells;
	const fontSize = TITLE_FONT_SIZE * scale;
	const titleHeight = hasTitle ? fontSize + TITLE_PADDING * 2 * scale : 0;
	return {
		scale,
		width,
		height: titleHeight + width,
		titleHeight,
		fontSize,
		titleBaseline: TITLE_PADDING * scale + fontSize * TITLE_BASELINE,
		codeStart: edge(QUIET_ZONE_MODULES),
		codeEnd: edge(QUIET_ZONE_MODULES + moduleCount),
		edge
	};
}

/** Rectangles covering the dark modules, one per horizontal run, in image coordinates. */
export function* moduleRects(qr: QRCode, layout: Layout): Generator<Rect> {
	const { size: count, data } = qr.modules;
	const { edge, titleHeight } = layout;
	for (let row = 0; row < count; row++) {
		const y = edge(row + QUIET_ZONE_MODULES);
		const height = edge(row + QUIET_ZONE_MODULES + 1) - y;
		let col = 0;
		while (col < count) {
			if (!data[row * count + col]) {
				col++;
				continue;
			}
			const start = col;
			while (col < count && data[row * count + col]) col++;
			const x = edge(start + QUIET_ZONE_MODULES);
			yield { x, y: titleHeight + y, width: edge(col + QUIET_ZONE_MODULES) - x, height };
		}
	}
}

/**
 * Where to draw a logo of the given natural size: centred on the code, at most
 * LOGO_MAX_PERCENTAGE_OF_QR of the code width, and never larger than its natural size × scale.
 */
export function logoPlacement(layout: Layout, naturalWidth: number, naturalHeight: number) {
	const maxDim = (layout.codeEnd - layout.codeStart) * LOGO_MAX_PERCENTAGE_OF_QR;
	const scale = Math.min(layout.scale, maxDim / naturalWidth, maxDim / naturalHeight);
	const width = naturalWidth * scale;
	const height = naturalHeight * scale;
	const centerX = (layout.codeStart + layout.codeEnd) / 2;
	const centerY = layout.titleHeight + centerX;
	const pad = LOGO_BACKGROUND_PADDING * layout.scale;
	const image: Rect = { x: centerX - width / 2, y: centerY - height / 2, width, height };
	const background: Rect = {
		x: image.x - pad,
		y: image.y - pad,
		width: width + pad * 2,
		height: height + pad * 2
	};
	return { image, background };
}

export interface RenderOptions {
	qr: QRCode;
	size: number;
	title: string;
	dark: string;
	light: string;
	logo: ImageBitmap | null;
	/** Output scale for high-resolution exports; the preview uses 1. */
	scale?: number;
}

/**
 * Draws the QR code (with quiet zone, optional title above and logo in the centre) onto `canvas`,
 * resizing the canvas to fit. Synchronous, so there is nothing to cancel or race.
 */
export function drawQrCode(canvas: HTMLCanvasElement, opts: RenderOptions) {
	const { qr, dark, light, logo } = opts;
	const title = opts.title.trim();
	const ctx = canvas.getContext('2d');
	if (!ctx) throw new Error('Canvas 2D context unavailable.');

	const layout = canvasLayout(opts.size, qr.modules.size, Boolean(title), { scale: opts.scale });
	canvas.width = layout.width;
	canvas.height = layout.height;

	ctx.fillStyle = light;
	ctx.fillRect(0, 0, layout.width, layout.height);

	ctx.fillStyle = dark;
	ctx.beginPath();
	for (const r of moduleRects(qr, layout)) ctx.rect(r.x, r.y, r.width, r.height);
	ctx.fill();

	if (title) {
		ctx.font = titleFont(layout.fontSize);
		ctx.textAlign = 'center';
		ctx.textBaseline = 'alphabetic';
		// maxWidth condenses long titles instead of letting them run off the edges.
		ctx.fillText(title, layout.width / 2, layout.titleBaseline, layout.codeEnd - layout.codeStart);
	}

	if (logo) {
		const { image, background } = logoPlacement(layout, logo.width, logo.height);
		ctx.fillStyle = light;
		ctx.fillRect(background.x, background.y, background.width, background.height);
		ctx.drawImage(logo, image.x, image.y, image.width, image.height);
	}
}
