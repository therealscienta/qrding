import { expect, test } from '@playwright/test';
import { unzipSync } from 'fflate';
import { decodeImage, downloadBytes, open, pickTemplate } from './helpers';

const CSV = [
	'url;caption;filename',
	'qrding.app/a;Front door;door',
	'not a url;;',
	'example.com/b;;',
	'https://example.com/c?x=1,2;Back;'
].join('\n');

test.beforeEach(async ({ page }) => {
	await open(page);
	await pickTemplate(page, 'Link (URL)');
	await page.getByText('Batch (CSV)').click();
});

async function loadCsv(page: import('@playwright/test').Page, csv = CSV) {
	await page.locator('#csvFile').setInputFiles({
		name: 'codes.csv',
		mimeType: 'text/csv',
		buffer: Buffer.from(csv)
	});
	await expect(page.getByTestId('batch-summary')).toHaveText('3 codes ready · 1 row skipped');
}

test('shows the columns, a template and per-row errors', async ({ page }) => {
	await expect(page.getByText('url, caption, filename')).toBeVisible();
	const [template] = await Promise.all([
		page.waitForEvent('download'),
		page.getByRole('button', { name: 'Export CSV template' }).click()
	]);
	expect(template.suggestedFilename()).toBe('qrding-url-template.csv');
	expect(new TextDecoder().decode(await downloadBytes(template))).toBe(
		'url,caption,filename\nhttps://qrding.app,Scan me,\n'
	);

	await loadCsv(page);
	await expect(page.getByText('Row 3: needs a valid url')).toBeVisible();
	// The preview shows the first row, with its caption.
	await expect(
		page.getByRole('img', { name: 'Generated QR Code with title: Front door' })
	).toBeVisible();
	await expect(page.getByTestId('scan-check')).toHaveAttribute('data-state', 'ok');
});

test('downloads a ZIP of numbered, scannable PNGs at the chosen size', async ({ page }) => {
	await loadCsv(page);
	await page.fill('#qrTitle', 'Scan me');
	await page.locator('#pngScale').selectOption({ label: '2× · 512 px · 43 mm at 300 DPI' });
	const [download] = await Promise.all([
		page.waitForEvent('download'),
		page.getByRole('button', { name: 'Export ZIP (3)' }).click()
	]);
	expect(download.suggestedFilename()).toBe('qrding-url-3-codes.zip');
	await expect(page.getByTestId('batch-status')).toHaveText(
		'Exported 3 PNG files. All passed the scan check.'
	);

	const files = unzipSync(await downloadBytes(download));
	expect(Object.keys(files).sort()).toEqual(['1-door.png', '2-link-examplecom.png', '3-Back.png']);
	const expected: Record<string, string> = {
		'1-door.png': 'https://qrding.app/a',
		'2-link-examplecom.png': 'https://example.com/b',
		'3-Back.png': 'https://example.com/c?x=1,2'
	};
	for (const [name, bytes] of Object.entries(files)) {
		const decoded = await decodeImage(page, bytes, 'image/png');
		expect(decoded.payload).toBe(expected[name]);
		expect(decoded.width).toBe(512);
	}
});

test('downloads SVGs when SVG is selected', async ({ page }) => {
	await loadCsv(page);
	await page.getByText('SVG (vector)').click();
	const [download] = await Promise.all([
		page.waitForEvent('download'),
		page.getByRole('button', { name: 'Export ZIP (3)' }).click()
	]);
	const files = unzipSync(await downloadBytes(download));
	expect(Object.keys(files).sort()).toEqual(['1-door.svg', '2-link-examplecom.svg', '3-Back.svg']);
	const decoded = await decodeImage(page, files['3-Back.svg'], 'image/svg+xml', 2);
	expect(decoded.payload).toBe('https://example.com/c?x=1,2');
});

test('prints a sheet with only the codes', async ({ page }) => {
	await loadCsv(page);
	await page.evaluate(() => {
		(window as unknown as { printed: number }).printed = 0;
		window.print = () => {
			(window as unknown as { printed: number }).printed++;
		};
	});
	await page.fill('input[type=number]', '40');
	await page.getByRole('button', { name: 'Print sheet' }).click();
	await expect(page.getByTestId('batch-status')).toHaveText(
		'Opened the print dialog for 3 codes. All passed the scan check.'
	);
	expect(await page.evaluate(() => (window as unknown as { printed: number }).printed)).toBe(1);

	const sheet = page.getByTestId('print-sheet');
	await expect(sheet).toBeHidden();
	await page.emulateMedia({ media: 'print' });
	await expect(sheet).toBeVisible();
	await expect(page.locator('#template')).toBeHidden();
	const images = sheet.locator('img');
	await expect(images).toHaveCount(3);
	// 40 mm at 96 CSS px per inch.
	expect((await images.first().boundingBox())!.width).toBeCloseTo((40 / 25.4) * 96, 0);
});
