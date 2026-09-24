import { describe, expect, it } from 'vitest';
import QRCode from 'qrcode';
import jsQR from 'jsqr';
import {
	canvasLayout,
	logoPlacement,
	moduleRects,
	QUIET_ZONE_MODULES,
	type Layout
} from './render';
import { readsBack, type RgbaImage } from './verify';

// Rasterizes the module rects the same way drawQrCode fills them, without needing a canvas.
function rasterize(payload: string, size: number, dark = [0, 0, 0], light = [255, 255, 255]) {
	const qr = QRCode.create(payload, { errorCorrectionLevel: 'M' });
	const layout = canvasLayout(size, qr.modules.size, false);
	const { width, height } = layout;
	const data = new Uint8ClampedArray(width * height * 4);
	const paint = (x: number, y: number, [r, g, b]: number[]) => {
		data.set([r, g, b, 255], (y * width + x) * 4);
	};
	for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) paint(x, y, light);
	for (const rect of moduleRects(qr, layout)) {
		for (let y = rect.y; y < rect.y + rect.height; y++) {
			for (let x = rect.x; x < rect.x + rect.width; x++) paint(x, y, dark);
		}
	}
	return { qr, image: { data, width, height } satisfies RgbaImage };
}

describe('canvasLayout', () => {
	it('reserves a 4-module quiet zone inside the requested size', () => {
		const layout = canvasLayout(290, 21, false); // 29 cells of 10 px
		expect(layout.width).toBe(290);
		expect(layout.codeStart).toBe(QUIET_ZONE_MODULES * 10);
		expect(layout.codeEnd).toBe(290 - QUIET_ZONE_MODULES * 10);
	});

	it('adds the title strip on top', () => {
		const layout = canvasLayout(290, 21, true);
		expect(layout.height).toBe(290 + layout.titleHeight);
		expect(layout.titleHeight).toBe(30);
	});

	it('scales everything for high-resolution exports', () => {
		const layout = canvasLayout(256, 25, true, { scale: 4 });
		expect(layout.width).toBe(1024);
		expect(layout.fontSize).toBe(80);
		expect(layout.titleHeight).toBe(120);
		expect(layout.height).toBe(1144);
	});

	it('uses exact (unsnapped) edges for vector output', () => {
		const layout = canvasLayout(256, 21, false, { snap: false });
		expect(layout.edge(1)).toBeCloseTo(256 / 29, 10);
	});
});

describe('moduleRects', () => {
	const qr = QRCode.create('https://qrding.app', { errorCorrectionLevel: 'M' });

	it('keeps every module out of the quiet zone', () => {
		const layout = canvasLayout(256, qr.modules.size, false);
		for (const r of moduleRects(qr, layout)) {
			expect(r.x).toBeGreaterThanOrEqual(layout.codeStart);
			expect(r.y).toBeGreaterThanOrEqual(layout.codeStart);
			expect(r.x + r.width).toBeLessThanOrEqual(layout.codeEnd);
			expect(r.y + r.height).toBeLessThanOrEqual(layout.codeEnd);
		}
	});

	it('merges horizontal runs of dark modules', () => {
		const layout = canvasLayout(256, qr.modules.size, false);
		const rects = [...moduleRects(qr, layout)];
		const darkModules = qr.modules.data.reduce((n, v) => n + v, 0);
		expect(rects.length).toBeLessThan(darkModules);
	});
});

describe('logoPlacement', () => {
	const layout: Layout = canvasLayout(290, 21, true); // code from 40 to 250, title 30 px

	it('centres the logo on the code and caps it at 25% of the code width', () => {
		const { image, background } = logoPlacement(layout, 1000, 500);
		expect(image.width).toBeCloseTo(210 * 0.25);
		expect(image.height).toBeCloseTo(210 * 0.125);
		expect(image.x + image.width / 2).toBeCloseTo(145);
		expect(image.y + image.height / 2).toBeCloseTo(30 + 145);
		expect(background.width).toBeCloseTo(image.width + 8);
	});

	it('does not upscale small logos beyond the export scale', () => {
		expect(logoPlacement(layout, 20, 20).image.width).toBe(20);
		expect(logoPlacement(canvasLayout(290, 21, false, { scale: 2 }), 20, 20).image.width).toBe(40);
	});
});

describe('readsBack', () => {
	it.each([128, 256, 512])('decodes a rendered code at %ipx', (size) => {
		const payload = 'WIFI:T:WPA;S:Home;P:secret;H:false;;';
		expect(readsBack(jsQR, rasterize(payload, size).image, payload)).toBe(true);
	});

	it('decodes non-ASCII text', () => {
		const payload = 'Åsa Öberg – café';
		expect(readsBack(jsQR, rasterize(payload, 256).image, payload)).toBe(true);
	});

	it('fails for a different payload and for inverted colors', () => {
		const { image } = rasterize('hello', 256);
		expect(readsBack(jsQR, image, 'other')).toBe(false);
		const inverted = rasterize('hello', 256, [255, 255, 255], [0, 0, 0]).image;
		expect(readsBack(jsQR, inverted, 'hello')).toBe(false);
	});
});
