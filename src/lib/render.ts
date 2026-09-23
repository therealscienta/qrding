import type { QRCode } from 'qrcode';

export const CANVAS_QR_PADDING = 10; // Padding around the QR code graphic on the canvas
export const CANVAS_TITLE_FONT_SIZE = 20; // Font size for the title
export const CANVAS_TITLE_AREA_VERTICAL_PADDING = 5; // Vertical padding above and below the title text (each side)
export const LOGO_MAX_PERCENTAGE_OF_QR = 0.25; // Logo max size relative to QR code (e.g., 0.25 = 25%)
export const LOGO_BACKGROUND_PADDING = 4; // Padding around the logo for its background clearing box

const titleAreaHeight = (hasTitle: boolean) =>
	hasTitle ? CANVAS_TITLE_FONT_SIZE + CANVAS_TITLE_AREA_VERTICAL_PADDING * 2 : 0;

/** Pixel size of the rendered image for a QR graphic of `size` px. */
export function canvasSize(size: number, hasTitle: boolean) {
	return {
		width: size + CANVAS_QR_PADDING * 2,
		height: size + CANVAS_QR_PADDING * 2 + titleAreaHeight(hasTitle)
	};
}

export interface RenderOptions {
	qr: QRCode;
	size: number;
	title: string;
	dark: string;
	light: string;
	logo: ImageBitmap | null;
}

/**
 * Draws the QR code (with optional title above and logo in the centre) onto `canvas`,
 * resizing the canvas to fit. Synchronous, so there is nothing to cancel or race.
 */
export function drawQrCode(canvas: HTMLCanvasElement, opts: RenderOptions) {
	const { qr, size, dark, light, logo } = opts;
	const title = opts.title.trim();
	const ctx = canvas.getContext('2d');
	if (!ctx) throw new Error('Canvas 2D context unavailable.');

	const { width, height } = canvasSize(size, Boolean(title));
	canvas.width = width;
	canvas.height = height;

	ctx.fillStyle = light;
	ctx.fillRect(0, 0, width, height);

	// Modules are drawn on integer pixel edges so there are no anti-aliased seams between them.
	const qrX = CANVAS_QR_PADDING;
	const qrY = CANVAS_QR_PADDING + titleAreaHeight(Boolean(title));
	const count = qr.modules.size;
	const edge = (i: number) => Math.round((i * size) / count);
	ctx.fillStyle = dark;
	ctx.beginPath();
	for (let row = 0; row < count; row++) {
		for (let col = 0; col < count; col++) {
			if (qr.modules.data[row * count + col]) {
				const x = edge(col);
				const y = edge(row);
				ctx.rect(qrX + x, qrY + y, edge(col + 1) - x, edge(row + 1) - y);
			}
		}
	}
	ctx.fill();

	if (title) {
		ctx.font = `${CANVAS_TITLE_FONT_SIZE}px Arial`;
		ctx.textAlign = 'center';
		ctx.textBaseline = 'top';
		// maxWidth condenses long titles instead of letting them run off the edges.
		ctx.fillText(
			title,
			width / 2,
			CANVAS_TITLE_AREA_VERTICAL_PADDING,
			width - CANVAS_QR_PADDING * 2
		);
	}

	if (logo) {
		// Scale to fit within the max size, keeping the aspect ratio; never upscale.
		const maxDim = size * LOGO_MAX_PERCENTAGE_OF_QR;
		const scale = Math.min(1, maxDim / logo.width, maxDim / logo.height);
		const logoWidth = logo.width * scale;
		const logoHeight = logo.height * scale;
		const centerX = qrX + size / 2;
		const centerY = qrY + size / 2;

		ctx.fillStyle = light;
		ctx.fillRect(
			centerX - logoWidth / 2 - LOGO_BACKGROUND_PADDING,
			centerY - logoHeight / 2 - LOGO_BACKGROUND_PADDING,
			logoWidth + LOGO_BACKGROUND_PADDING * 2,
			logoHeight + LOGO_BACKGROUND_PADDING * 2
		);
		ctx.drawImage(logo, centerX - logoWidth / 2, centerY - logoHeight / 2, logoWidth, logoHeight);
	}
}
