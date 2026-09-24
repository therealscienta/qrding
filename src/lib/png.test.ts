import { describe, expect, it } from 'vitest';
import { crc32, pngSize, readDpi, withDpi } from './png';

const bytes = (s: string) => new TextEncoder().encode(s);

function chunk(type: string, data: Uint8Array) {
	const out = new Uint8Array(12 + data.length);
	const view = new DataView(out.buffer);
	view.setUint32(0, data.length);
	out.set(bytes(type), 4);
	out.set(data, 8);
	view.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
	return out;
}

function png(...chunks: Uint8Array[]) {
	const parts = [new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), ...chunks];
	const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
	let offset = 0;
	for (const p of parts) {
		out.set(p, offset);
		offset += p.length;
	}
	return out;
}

const ihdr = () => {
	const data = new Uint8Array(13);
	new DataView(data.buffer).setUint32(0, 1024);
	new DataView(data.buffer).setUint32(4, 1054);
	return chunk('IHDR', data);
};

describe('png', () => {
	it('computes PNG chunk CRCs', () => {
		expect(crc32(bytes('IEND'))).toBe(0xae426082);
	});

	it('adds a pHYs chunk right after IHDR', () => {
		const out = withDpi(png(ihdr(), chunk('IEND', new Uint8Array())), 300);
		expect(readDpi(out)).toBe(300);
		expect(String.fromCharCode(...out.subarray(37, 41))).toBe('pHYs');
		expect(pngSize(out)).toEqual({ width: 1024, height: 1054 });
		// The pHYs CRC is valid.
		const view = new DataView(out.buffer);
		expect(view.getUint32(50)).toBe(crc32(out.subarray(37, 50)));
	});

	it('replaces an existing pHYs chunk', () => {
		const once = withDpi(png(ihdr(), chunk('IEND', new Uint8Array())), 72);
		const twice = withDpi(once, 300);
		expect(readDpi(twice)).toBe(300);
		expect(twice.length).toBe(once.length);
	});

	it('rejects data that is not a PNG', () => {
		expect(() => withDpi(bytes('GIF89a....'), 300)).toThrow('Not a PNG');
	});
});
