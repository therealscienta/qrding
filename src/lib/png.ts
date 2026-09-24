const CRC_TABLE = (() => {
	const table = new Uint32Array(256);
	for (let n = 0; n < 256; n++) {
		let c = n;
		for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
		table[n] = c >>> 0;
	}
	return table;
})();

/** CRC-32 as used by PNG chunks. */
export function crc32(bytes: Uint8Array): number {
	let c = 0xffffffff;
	for (const b of bytes) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
	return (c ^ 0xffffffff) >>> 0;
}

const SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const INCH_IN_METERS = 0.0254;

interface Chunk {
	type: string;
	start: number;
	end: number;
}

function* chunks(png: Uint8Array): Generator<Chunk> {
	if (!SIGNATURE.every((b, i) => png[i] === b)) throw new Error('Not a PNG file.');
	const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
	let offset = 8;
	while (offset + 12 <= png.length) {
		const length = view.getUint32(offset);
		const type = String.fromCharCode(...png.subarray(offset + 4, offset + 8));
		const end = offset + 12 + length;
		yield { type, start: offset, end };
		offset = end;
	}
}

/**
 * Returns a copy of `png` with a pHYs chunk declaring `dpi`, replacing any existing one, so
 * documents and label software place the image at its intended physical size.
 */
export function withDpi(png: Uint8Array, dpi: number): Uint8Array<ArrayBuffer> {
	const pixelsPerMeter = Math.round(dpi / INCH_IN_METERS);
	const phys = new Uint8Array(21);
	const view = new DataView(phys.buffer);
	view.setUint32(0, 9); // data length
	phys.set([0x70, 0x48, 0x59, 0x73], 4); // "pHYs"
	view.setUint32(8, pixelsPerMeter);
	view.setUint32(12, pixelsPerMeter);
	phys[16] = 1; // unit: meter
	view.setUint32(17, crc32(phys.subarray(4, 17)));

	const parts: Uint8Array[] = [png.subarray(0, 8)];
	for (const chunk of chunks(png)) {
		if (chunk.type !== 'pHYs') parts.push(png.subarray(chunk.start, chunk.end));
		// pHYs must come before the image data; right after the header is always valid.
		if (chunk.type === 'IHDR') parts.push(phys);
	}
	const out = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
	let offset = 0;
	for (const part of parts) {
		out.set(part, offset);
		offset += part.length;
	}
	return out;
}

/** The DPI declared by the PNG's pHYs chunk, or null when it has none. */
export function readDpi(png: Uint8Array): number | null {
	const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
	for (const chunk of chunks(png)) {
		if (chunk.type === 'pHYs' && png[chunk.start + 16] === 1) {
			return Math.round(view.getUint32(chunk.start + 8) * INCH_IN_METERS);
		}
	}
	return null;
}

/** Width and height from the PNG header. */
export function pngSize(png: Uint8Array) {
	const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
	return { width: view.getUint32(16), height: view.getUint32(20) };
}
