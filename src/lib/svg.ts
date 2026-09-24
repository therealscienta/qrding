import type { QRCode } from 'qrcode';
import { canvasLayout, logoPlacement, moduleRects, TITLE_FONT_FAMILY } from './render';

export interface SvgLogo {
	/** Data URL of the original file, so vector logos stay vector. */
	href: string;
	/** Size used for placement; the same values as the PNG logo so both exports match. */
	width: number;
	height: number;
}

export interface SvgOptions {
	qr: QRCode;
	size: number;
	title: string;
	dark: string;
	light: string;
	logo: SvgLogo | null;
	/** Title width at the 1× font size (canvas measureText); longer titles are condensed like the PNG. */
	titleWidth?: number;
}

const XML_ESCAPES: Record<string, string> = {
	'&': '&amp;',
	'<': '&lt;',
	'>': '&gt;',
	'"': '&quot;',
	"'": '&apos;'
};
const escapeXml = (value: string) => value.replace(/[&<>"']/g, (c) => XML_ESCAPES[c]);

// Three decimals keeps the file small while staying far below a device pixel at any print size.
const num = (value: number) => String(Math.round(value * 1000) / 1000);

/** Builds a standalone SVG with the same layout as the PNG (quiet zone, title, logo). */
export function buildSvg(opts: SvgOptions): string {
	const title = opts.title.trim();
	const layout = canvasLayout(opts.size, opts.qr.modules.size, Boolean(title), { snap: false });
	const path = [...moduleRects(opts.qr, layout)]
		.map((r) => `M${num(r.x)} ${num(r.y)}h${num(r.width)}v${num(r.height)}h${num(-r.width)}z`)
		.join('');

	const parts = [
		`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"` +
			` width="${num(layout.width)}" height="${num(layout.height)}"` +
			` viewBox="0 0 ${num(layout.width)} ${num(layout.height)}" shape-rendering="crispEdges">`,
		`<rect width="100%" height="100%" fill="${escapeXml(opts.light)}"/>`,
		`<path fill="${escapeXml(opts.dark)}" d="${path}"/>`
	];

	if (title) {
		const maxWidth = layout.codeEnd - layout.codeStart;
		const condense =
			opts.titleWidth !== undefined && opts.titleWidth > maxWidth
				? ` textLength="${num(maxWidth)}" lengthAdjust="spacingAndGlyphs"`
				: '';
		parts.push(
			`<text x="${num(layout.width / 2)}" y="${num(layout.titleBaseline)}"` +
				` font-family="${TITLE_FONT_FAMILY}" font-size="${num(layout.fontSize)}"` +
				` text-anchor="middle" fill="${escapeXml(opts.dark)}"${condense}>${escapeXml(title)}</text>`
		);
	}

	if (opts.logo) {
		const { image, background } = logoPlacement(layout, opts.logo.width, opts.logo.height);
		parts.push(
			`<rect x="${num(background.x)}" y="${num(background.y)}" width="${num(background.width)}"` +
				` height="${num(background.height)}" fill="${escapeXml(opts.light)}"/>`,
			// xlink:href rather than href: older editors and label apps only understand the former.
			`<image x="${num(image.x)}" y="${num(image.y)}" width="${num(image.width)}"` +
				` height="${num(image.height)}" preserveAspectRatio="xMidYMid meet"` +
				` xlink:href="${escapeXml(opts.logo.href)}"/>`
		);
	}

	parts.push('</svg>');
	return parts.join('');
}

/** A data URL for showing an SVG in an <img>. */
export const svgDataUrl = (svg: string) =>
	`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
