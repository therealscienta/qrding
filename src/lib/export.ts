// Browser-only helpers for turning a rendered code into files, clipboard data and logos.
import { drawQrCode, TITLE_FONT_SIZE, titleFont, type RenderOptions } from './render';
import { withDpi } from './png';

/** DPI written into exported PNGs, so documents and label software print them at the stated size. */
export const PRINT_DPI = 300;

/** Width in mm of `px` pixels at PRINT_DPI. */
export const mmAtPrintDpi = (px: number) => (px / PRINT_DPI) * 25.4;

/** Draws onto `canvas` (or a new one) and returns it. */
export function renderCanvas(opts: RenderOptions, canvas = document.createElement('canvas')) {
	drawQrCode(canvas, opts);
	return canvas;
}

/** Encodes the canvas as PNG bytes tagged with PRINT_DPI. */
export async function canvasToPngBytes(
	canvas: HTMLCanvasElement
): Promise<Uint8Array<ArrayBuffer>> {
	const blob = await new Promise<Blob>((resolve, reject) =>
		canvas.toBlob(
			(b) => (b ? resolve(b) : reject(new Error('Could not encode the PNG.'))),
			'image/png'
		)
	);
	return withDpi(new Uint8Array(await blob.arrayBuffer()), PRINT_DPI);
}

export async function canvasToPng(canvas: HTMLCanvasElement): Promise<Blob> {
	return new Blob([await canvasToPngBytes(canvas)], { type: 'image/png' });
}

export function downloadBlob(blob: Blob, filename: string) {
	const url = URL.createObjectURL(blob);
	const link = document.createElement('a');
	link.download = filename;
	link.href = url;
	link.click();
	// Revoking right away can cancel the download in some browsers.
	setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Image copy needs the async Clipboard API with ClipboardItem, and a secure context. */
export const canCopyImages = () =>
	typeof ClipboardItem !== 'undefined' && typeof navigator.clipboard?.write === 'function';

/**
 * Copies a PNG to the clipboard. Takes a promise and builds the ClipboardItem synchronously, which
 * Safari requires to treat the copy as part of the user's click.
 */
export function copyPng(png: Promise<Blob>): Promise<void> {
	return navigator.clipboard.write([new ClipboardItem({ 'image/png': png })]);
}

let measureCtx: CanvasRenderingContext2D | null = null;

/** Width of the title at the 1× font size, as drawn on the canvas (used to fit SVG titles). */
export function measureTitle(title: string): number {
	measureCtx ??= document.createElement('canvas').getContext('2d');
	if (!measureCtx) return 0;
	measureCtx.font = titleFont(TITLE_FONT_SIZE);
	return measureCtx.measureText(title.trim()).width;
}

export interface Logo {
	bitmap: ImageBitmap;
	/** The original file as a data URL, embedded as-is in SVG exports. */
	dataUrl: string;
	/** Object URL for the thumbnail; revoke it when the logo is replaced. */
	previewUrl: string;
}

// Vector logos have no fixed resolution; rasterize them large enough for 8× exports.
const SVG_LOGO_RASTER_SIZE = 1024;

async function rasterizeSvgLogo(file: File): Promise<ImageBitmap> {
	const url = URL.createObjectURL(file);
	try {
		const img = new Image();
		img.src = url;
		await img.decode();
		// SVGs without width/height report no (or a default) intrinsic size; keep their aspect ratio
		// when there is one, otherwise draw into a square (the SVG letterboxes itself).
		const aspect = img.naturalWidth && img.naturalHeight ? img.naturalWidth / img.naturalHeight : 1;
		const width = aspect >= 1 ? SVG_LOGO_RASTER_SIZE : Math.round(SVG_LOGO_RASTER_SIZE * aspect);
		const height = aspect >= 1 ? Math.round(SVG_LOGO_RASTER_SIZE / aspect) : SVG_LOGO_RASTER_SIZE;
		const canvas = document.createElement('canvas');
		canvas.width = width;
		canvas.height = height;
		canvas.getContext('2d')?.drawImage(img, 0, 0, width, height);
		return await createImageBitmap(canvas);
	} finally {
		URL.revokeObjectURL(url);
	}
}

const readAsDataUrl = (file: File) =>
	new Promise<string>((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(reader.result as string);
		reader.onerror = () => reject(reader.error);
		reader.readAsDataURL(file);
	});

/** Decodes an uploaded logo. createImageBitmap can't decode SVG files, so those go through an <img>. */
export async function loadLogo(file: File): Promise<Logo> {
	const isSvg = file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg');
	const [bitmap, dataUrl] = await Promise.all([
		isSvg ? rasterizeSvgLogo(file) : createImageBitmap(file),
		readAsDataUrl(file)
	]);
	return { bitmap, dataUrl, previewUrl: URL.createObjectURL(file) };
}
