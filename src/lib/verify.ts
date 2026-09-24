import type jsQR from 'jsqr';

export type Decoder = typeof jsQR;

export interface RgbaImage {
	data: Uint8ClampedArray;
	width: number;
	height: number;
}

/**
 * True when a test decoder reads `expected` back from the image. Inverted codes are not
 * attempted, because many phone scanners can't read them either.
 */
export function readsBack(decode: Decoder, image: RgbaImage, expected: string): boolean {
	const result = decode(image.data, image.width, image.height, { inversionAttempts: 'dontInvert' });
	return result?.data === expected;
}

let decoder: Promise<Decoder> | null = null;

/** Loads jsQR on first use, so it stays out of the initial bundle. */
export function loadDecoder(): Promise<Decoder> {
	decoder ??= import('jsqr').then((m) => m.default);
	return decoder;
}
