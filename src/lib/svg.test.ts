import { describe, expect, it } from 'vitest';
import QRCode from 'qrcode';
import jsQR from 'jsqr';
import { buildSvg } from './svg';
import { readsBack } from './verify';

const base = { size: 256, title: '', dark: '#000000', light: '#ffffff', logo: null };

// Rasterizes the SVG's module path (M x y h w v h h -w z per run) by sampling pixel centres.
function rasterizeSvgPath(svg: string, scale = 1) {
	const width = Math.round(Number(/ width="([\d.]+)"/.exec(svg)![1]) * scale);
	const height = Math.round(Number(/ height="([\d.]+)"/.exec(svg)![1]) * scale);
	const data = new Uint8ClampedArray(width * height * 4).fill(255);
	const d = /<path fill="[^"]+" d="([^"]+)"/.exec(svg)![1];
	for (const [, x, y, w, h] of d.matchAll(/M([\d.]+) ([\d.]+)h([\d.]+)v([\d.]+)h-[\d.]+z/g)) {
		const [x0, y0] = [Number(x) * scale, Number(y) * scale];
		const [x1, y1] = [x0 + Number(w) * scale, y0 + Number(h) * scale];
		for (let py = Math.ceil(y0 - 0.5); py < y1 - 0.5; py++) {
			for (let px = Math.ceil(x0 - 0.5); px < x1 - 0.5; px++) {
				data.fill(0, (py * width + px) * 4, (py * width + px) * 4 + 3);
			}
		}
	}
	return { data, width, height };
}

describe('buildSvg', () => {
	const payload = 'https://qrding.app/svg';
	const qr = QRCode.create(payload, { errorCorrectionLevel: 'M' });

	it.each([1, 3.5])('produces module geometry that decodes when rendered at %sx', (scale) => {
		const svg = buildSvg({ ...base, qr });
		expect(readsBack(jsQR, rasterizeSvgPath(svg, scale), payload)).toBe(true);
	});

	it('is a standalone SVG with the requested size and colors', () => {
		const svg = buildSvg({ ...base, qr, dark: '#1e3a8a', light: '#fefce8' });
		expect(svg).toMatch(/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
		expect(svg).toContain('width="256" height="256" viewBox="0 0 256 256"');
		expect(svg).toContain('<rect width="100%" height="100%" fill="#fefce8"/>');
		expect(svg).toContain('<path fill="#1e3a8a" d="M');
		expect(svg.endsWith('</svg>')).toBe(true);
	});

	it('escapes the title and condenses it only when it is too wide', () => {
		const fits = buildSvg({ ...base, qr, title: 'Tom & <Jerry> "x"', titleWidth: 50 });
		expect(fits).toContain('>Tom &amp; &lt;Jerry&gt; &quot;x&quot;</text>');
		expect(fits).not.toContain('textLength');
		expect(fits).toContain('height="286"'); // 256 + 30 px title strip

		const tooWide = buildSvg({ ...base, qr, title: 'Long', titleWidth: 1000 });
		expect(tooWide).toMatch(/textLength="[\d.]+" lengthAdjust="spacingAndGlyphs"/);
	});

	it('embeds the logo over a clearing box', () => {
		const logo = { href: 'data:image/png;base64,AAAA', width: 100, height: 50 };
		const svg = buildSvg({ ...base, qr, logo });
		expect(svg).toContain('xlink:href="data:image/png;base64,AAAA"');
		expect(svg).toMatch(
			/<rect x="[\d.]+" y="[\d.]+" width="[\d.]+" height="[\d.]+" fill="#ffffff"\/><image /
		);
	});
});
