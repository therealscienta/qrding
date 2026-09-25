import { expect, test } from '@playwright/test';
import { decodedPayload, decodeImage, downloadBytes, open, uploadLogo } from './helpers';

const WIFI = 'WIFI:T:WPA;S:Home;P:;H:false;;';

test.beforeEach(async ({ page }) => {
	await open(page);
	await page.fill('#wifiSSID', 'Home');
	expect(await decodedPayload(page)).toBe(WIFI);
});

test('SVG export is a scannable vector image, also scaled up', async ({ page }) => {
	await page.getByText('SVG (vector)').click();
	await page.fill('#qrTitle', 'Guest & <friends>');
	await expect(page.locator('#pngScale')).toHaveCount(0);
	const [download] = await Promise.all([
		page.waitForEvent('download'),
		page.getByRole('button', { name: 'Export SVG' }).click()
	]);
	expect(download.suggestedFilename()).toMatch(/^Guest__friends-256-M-\d+\.svg$/);
	const svg = await downloadBytes(download);
	const text = new TextDecoder().decode(svg);
	expect(text).toContain('>Guest &amp; &lt;friends&gt;</text>');
	for (const scale of [1, 4]) {
		expect((await decodeImage(page, svg, 'image/svg+xml', scale)).payload).toBe(WIFI);
	}
});

test('high-resolution PNG has the chosen width and 300 DPI', async ({ page }) => {
	await page.locator('#pngScale').selectOption({ label: '4× · 1024 px · 87 mm at 300 DPI' });
	const [download] = await Promise.all([
		page.waitForEvent('download'),
		page.getByRole('button', { name: 'Export PNG' }).click()
	]);
	expect(download.suggestedFilename()).toMatch(/^wifi-Home-1024-M-\d+\.png$/);
	const png = await downloadBytes(download);
	const view = new DataView(png.buffer, png.byteOffset);
	expect(view.getUint32(16)).toBe(1024); // IHDR width
	expect(String.fromCharCode(...png.subarray(37, 41))).toBe('pHYs');
	expect(view.getUint32(41)).toBe(11811); // pixels per meter = 300 DPI
	const decoded = await decodeImage(page, png, 'image/png');
	expect(decoded).toEqual({ payload: WIFI, width: 1024, height: 1024 });
});

test('logos are embedded in PNG and SVG exports, including SVG logos', async ({ page }) => {
	await uploadLogo(page, 'svg');
	expect(await decodedPayload(page)).toBe(WIFI);

	const [png] = await Promise.all([
		page.waitForEvent('download'),
		page.getByRole('button', { name: 'Export PNG' }).click()
	]);
	expect(png.suggestedFilename()).toMatch(/-logo-\d+\.png$/);
	expect((await decodeImage(page, await downloadBytes(png), 'image/png')).payload).toBe(WIFI);

	await page.getByText('SVG (vector)').click();
	const [svg] = await Promise.all([
		page.waitForEvent('download'),
		page.getByRole('button', { name: 'Export SVG' }).click()
	]);
	const svgBytes = await downloadBytes(svg);
	expect(new TextDecoder().decode(svgBytes)).toContain('xlink:href="data:image/svg+xml;base64,');
	expect((await decodeImage(page, svgBytes, 'image/svg+xml', 2)).payload).toBe(WIFI);
});

// Desktop (WebView2) saves downloads without any UI, so this message is the only feedback there.
test('export confirms which file was saved', async ({ page }) => {
	const [download] = await Promise.all([
		page.waitForEvent('download'),
		page.getByRole('button', { name: 'Export PNG' }).click()
	]);
	await expect(page.getByText(`Exported ${download.suggestedFilename()}`)).toBeVisible();
});

test('copy puts a scannable PNG on the clipboard', async ({ page, context }) => {
	await context.grantPermissions(['clipboard-read', 'clipboard-write']);
	await page.getByRole('button', { name: 'Copy image' }).click();
	await expect(page.getByText('Copied to the clipboard')).toBeVisible();
	const payload = await page.evaluate(async () => {
		const [item] = await navigator.clipboard.read();
		const bitmap = await createImageBitmap(await item.getType('image/png'));
		const canvas = document.createElement('canvas');
		canvas.width = bitmap.width;
		canvas.height = bitmap.height;
		const ctx = canvas.getContext('2d')!;
		ctx.drawImage(bitmap, 0, 0);
		return window.jsQR(
			ctx.getImageData(0, 0, bitmap.width, bitmap.height).data,
			bitmap.width,
			bitmap.height
		)?.data;
	});
	expect(payload).toBe(WIFI);
});
