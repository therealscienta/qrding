// Browser-only: renders a parsed batch into a ZIP or a printable sheet, checking every code.
import type { BatchError, BatchItem } from './batch';
import { canvasToPngBytes, measureTitle, renderCanvas, type Logo } from './export';
import { buildSvg, svgDataUrl } from './svg';
import { loadDecoder, readsBack } from './verify';

export interface BatchStyle {
	size: number;
	dark: string;
	light: string;
	logo: Logo | null;
	format: 'png' | 'svg';
	pngScale: number;
}

export interface BatchProgress {
	done: number;
	total: number;
}

const nextFrame = () => new Promise((resolve) => setTimeout(resolve));

const svgFor = (item: BatchItem, style: BatchStyle) =>
	buildSvg({
		qr: item.qr,
		size: style.size,
		title: item.caption,
		dark: style.dark,
		light: style.light,
		logo: style.logo && {
			href: style.logo.dataUrl,
			width: style.logo.bitmap.width,
			height: style.logo.bitmap.height
		},
		titleWidth: measureTitle(item.caption)
	});

/**
 * Runs `each` for every item after rendering it at 1× and reading it back, yielding to the
 * browser between items so progress stays visible. Returns the rows that failed the check.
 */
async function forEachChecked(
	items: BatchItem[],
	style: BatchStyle,
	onProgress: (p: BatchProgress) => void,
	each: (item: BatchItem, preview: HTMLCanvasElement) => Promise<void> | void
): Promise<BatchError[]> {
	const decode = await loadDecoder();
	const preview = document.createElement('canvas');
	const failures: BatchError[] = [];
	for (const [i, item] of items.entries()) {
		renderCanvas(
			{
				qr: item.qr,
				size: style.size,
				title: item.caption,
				dark: style.dark,
				light: style.light,
				logo: style.logo?.bitmap ?? null
			},
			preview
		);
		const ctx = preview.getContext('2d');
		const image = ctx?.getImageData(0, 0, preview.width, preview.height);
		if (!image || !readsBack(decode, image, item.payload)) {
			failures.push({ row: item.row, message: 'failed the scan check' });
		}
		await each(item, preview);
		onProgress({ done: i + 1, total: items.length });
		await nextFrame();
	}
	return failures;
}

/** A ZIP with one PNG or SVG per item, named after the item's numbered filename. */
export async function exportZip(
	items: BatchItem[],
	style: BatchStyle,
	onProgress: (p: BatchProgress) => void
): Promise<{ zip: Blob; failures: BatchError[] }> {
	const { zipSync, strToU8 } = await import('fflate');
	const files: Record<string, [Uint8Array, { level: 0 | 6 }]> = {};
	const hiRes = document.createElement('canvas');
	const failures = await forEachChecked(items, style, onProgress, async (item, preview) => {
		if (style.format === 'svg') {
			files[`${item.filename}.svg`] = [strToU8(svgFor(item, style)), { level: 6 }];
			return;
		}
		const canvas =
			style.pngScale === 1
				? preview
				: renderCanvas(
						{
							qr: item.qr,
							size: style.size,
							title: item.caption,
							dark: style.dark,
							light: style.light,
							logo: style.logo?.bitmap ?? null,
							scale: style.pngScale
						},
						hiRes
					);
		// PNGs are already compressed; storing them keeps zipping fast.
		files[`${item.filename}.png`] = [await canvasToPngBytes(canvas), { level: 0 }];
	});
	const zipped = zipSync(files);
	return { zip: new Blob([zipped], { type: 'application/zip' }), failures };
}

/** SVG data URLs for the print sheet (vector, so they print sharply at any size). */
export async function sheetImages(
	items: BatchItem[],
	style: BatchStyle,
	onProgress: (p: BatchProgress) => void
): Promise<{ images: { key: string; src: string }[]; failures: BatchError[] }> {
	const images: { key: string; src: string }[] = [];
	const failures = await forEachChecked(items, style, onProgress, (item) => {
		images.push({ key: item.filename, src: svgDataUrl(svgFor(item, style)) });
	});
	return { images, failures };
}
