import { expect, type Download, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const jsQRPath = fileURLToPath(new URL('../node_modules/jsqr/dist/jsQR.js', import.meta.url));

declare global {
	interface Window {
		jsQR: typeof import('jsqr').default;
	}
}

export async function open(page: Page) {
	await page.goto('/');
	await page.addScriptTag({ path: jsQRPath });
}

export async function pickTemplate(page: Page, name: string) {
	await page.locator('#template').click();
	await page.getByRole('option', { name, exact: true }).click();
}

/** Waits for the in-app scan check to pass, then decodes the preview canvas independently. */
export async function decodedPayload(page: Page) {
	await expect(page.getByTestId('scan-check')).toHaveAttribute('data-state', 'ok');
	return page.evaluate(() => {
		const canvas = document.querySelector('canvas')!;
		const { data, width, height } = canvas
			.getContext('2d')!
			.getImageData(0, 0, canvas.width, canvas.height);
		return window.jsQR(data, width, height)?.data ?? null;
	});
}

/** Decodes an image file (PNG or SVG bytes) in the page, drawn at `scale` × its natural size. */
export async function decodeImage(page: Page, bytes: Uint8Array, mime: string, scale = 1) {
	return page.evaluate(
		async ({ base64, mime, scale }) => {
			const img = new Image();
			img.src = `data:${mime};base64,${base64}`;
			await img.decode();
			const width = Math.round(img.naturalWidth * scale);
			const height = Math.round(img.naturalHeight * scale);
			const canvas = document.createElement('canvas');
			canvas.width = width;
			canvas.height = height;
			const ctx = canvas.getContext('2d')!;
			ctx.drawImage(img, 0, 0, width, height);
			const result = window.jsQR(ctx.getImageData(0, 0, width, height).data, width, height);
			return { payload: result?.data ?? null, width: img.naturalWidth, height: img.naturalHeight };
		},
		{ base64: Buffer.from(bytes).toString('base64'), mime, scale }
	);
}

export async function downloadBytes(download: Download) {
	return new Uint8Array(await readFile(await download.path()));
}

/** Uploads a generated image as the logo: a PNG by default, or an SVG without intrinsic size. */
export async function uploadLogo(page: Page, kind: 'png' | 'svg' = 'png') {
	await page.evaluate(async (kind) => {
		let file: File;
		if (kind === 'svg') {
			const svg =
				'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle cx="5" cy="5" r="5" fill="#e11d48"/></svg>';
			file = new File([svg], 'logo.svg', { type: 'image/svg+xml' });
		} else {
			const c = document.createElement('canvas');
			c.width = 300;
			c.height = 200;
			const ctx = c.getContext('2d')!;
			ctx.fillStyle = '#e11d48';
			ctx.fillRect(0, 0, 300, 200);
			const blob = await new Promise<Blob>((resolve) => c.toBlob((b) => resolve(b!), 'image/png'));
			file = new File([blob], 'logo.png', { type: 'image/png' });
		}
		const input = document.getElementById('logoInput') as HTMLInputElement;
		const dt = new DataTransfer();
		dt.items.add(file);
		input.files = dt.files;
		input.dispatchEvent(new Event('change', { bubbles: true }));
	}, kind);
	await expect(page.getByAltText('Logo preview')).toBeVisible();
}
