import { expect, test } from '@playwright/test';
import { decodedPayload, open, pickTemplate, uploadLogo } from './helpers';

test.beforeEach(async ({ page }) => {
	await open(page);
});

test('has a title and shows the placeholder until there is input', async ({ page }) => {
	await expect(page).toHaveTitle(/QRding/);
	await expect(page.getByText('QR code will appear here')).toBeVisible();
	await expect(page.getByRole('button', { name: 'Download PNG' })).toHaveCount(0);
});

test.describe('templates encode the expected payload', () => {
	test('Wi-Fi', async ({ page }) => {
		await page.fill('#wifiSSID', 'My;Net');
		await page.fill('#wifiPassword', 'p@ss,1');
		expect(await decodedPayload(page)).toBe('WIFI:T:WPA;S:My\\;Net;P:p@ss\\,1;H:false;;');
	});

	test('Text', async ({ page }) => {
		await pickTemplate(page, 'Text');
		await page.fill('#customText', 'Hej från QRding');
		expect(await decodedPayload(page)).toBe('Hej från QRding');
	});

	test('Link', async ({ page }) => {
		await pickTemplate(page, 'Link (URL)');
		await page.fill('#urlInput', 'not a url');
		await expect(page.getByText("doesn't look like a valid URL")).toBeVisible();
		await page.fill('#urlInput', 'qrding.app/test');
		expect(await decodedPayload(page)).toBe('https://qrding.app/test');
	});

	test('Contact card', async ({ page }) => {
		await pickTemplate(page, 'Contact Card (VCard)');
		await page.fill('#vCardName', 'Jane Doe');
		await page.fill('#vCardEmail', 'jane@example.com');
		expect(await decodedPayload(page)).toBe(
			'BEGIN:VCARD\nVERSION:3.0\nN:Doe;Jane;;;\nFN:Jane Doe\nEMAIL:jane@example.com\nEND:VCARD'
		);
	});

	test('Calendar event', async ({ page }) => {
		await pickTemplate(page, 'Calendar Event');
		await page.fill('#eventTitle', 'Team, sync');
		await page.fill('#eventDTStart', '2026-10-01T10:00');
		await page.fill('#eventDTEnd', '2026-10-01T09:00');
		await expect(page.getByText('The end must be after the start.')).toBeVisible();
		await page.fill('#eventDTEnd', '2026-10-01T11:00');
		const payload = await decodedPayload(page);
		expect(payload).toMatch(/^BEGIN:VEVENT\n/);
		expect(payload).toContain('\nSUMMARY:Team\\, sync\n');
		expect(payload).toContain('\nDTSTART:20261001T100000\nDTEND:20261001T110000\n');
	});

	test('SMS', async ({ page }) => {
		await pickTemplate(page, 'SMS');
		await page.fill('#smsPhone', '+46 70 123 45 67');
		await page.fill('#smsMessage', 'Meet at 10:30');
		expect(await decodedPayload(page)).toBe('SMSTO:+46701234567:Meet at 10:30');
	});

	test('Phone call', async ({ page }) => {
		await pickTemplate(page, 'Phone Call');
		await page.fill('#phoneNumber', '070-123 45 67');
		expect(await decodedPayload(page)).toBe('tel:0701234567');
	});

	test('Email', async ({ page }) => {
		await pickTemplate(page, 'Email');
		await page.fill('#emailTo', 'a@b.se');
		await page.fill('#emailSubject', 'Hi & bye');
		expect(await decodedPayload(page)).toBe('mailto:a@b.se?subject=Hi%20%26%20bye');
	});

	test('Location', async ({ page, context }) => {
		await pickTemplate(page, 'Location');
		await page.fill('#geoLatitude', '95');
		await page.fill('#geoLongitude', '18');
		await expect(page.getByText('Latitude must be between')).toBeVisible();

		await context.grantPermissions(['geolocation']);
		await context.setGeolocation({ latitude: 57.7089, longitude: 11.9746 });
		await page.getByRole('button', { name: 'Use my location' }).click();
		await expect(page.locator('#geoLatitude')).toHaveValue('57.708900');
		await page.fill('#geoLabel', 'Kontoret');
		expect(await decodedPayload(page)).toBe('geo:57.7089,11.9746?q=57.7089,11.9746(Kontoret)');
	});
});

test('switching templates keeps what was typed', async ({ page }) => {
	await page.fill('#wifiSSID', 'KeepMe');
	await pickTemplate(page, 'Text');
	await pickTemplate(page, 'Wi-Fi Network');
	await expect(page.locator('#wifiSSID')).toHaveValue('KeepMe');
});

test('image includes a 4-module quiet zone and the requested width', async ({ page }) => {
	await page.fill('#wifiSSID', 'Home');
	await decodedPayload(page);
	const edges = await page.evaluate(() => {
		const canvas = document.querySelector('canvas')!;
		const { data, width } = canvas
			.getContext('2d')!
			.getImageData(0, 0, canvas.width, canvas.height);
		// Leftmost column that contains a dark pixel, i.e. where the code starts.
		let firstDark = -1;
		for (let x = 0; x < width && firstDark < 0; x++) {
			for (let y = 0; y < canvas.height; y++) {
				if (data[(y * width + x) * 4] < 128) {
					firstDark = x;
					break;
				}
			}
		}
		return { width, firstDark };
	});
	expect(edges.width).toBe(256);
	// The code has at least 21 modules plus 8 quiet-zone cells, so 4 cells ≥ 4 * 256 / 37 px.
	expect(edges.firstDark).toBeGreaterThanOrEqual(Math.floor((4 * 256) / 37));
});

test('color picker stays mounted while changing color, and warns on inverted colors', async ({
	page
}) => {
	await page.fill('#wifiSSID', 'Home');
	await decodedPayload(page);
	const picker = page.locator('input[type=color]').first();
	const handle = await picker.elementHandle();
	await picker.fill('#ffffff');
	await expect(page.getByText(/inverted codes/)).toBeVisible();
	await expect(page.getByTestId('scan-check')).toHaveAttribute('data-state', 'fail');
	expect(await handle!.evaluate((el) => el.isConnected)).toBe(true);

	await picker.fill('#1e3a8a');
	expect(await decodedPayload(page)).toBe('WIFI:T:WPA;S:Home;P:;H:false;;');
});

test('logo raises error correction, still scans, and clears cleanly', async ({ page }) => {
	await page.fill('#wifiSSID', 'Home');
	await uploadLogo(page);
	await expect(page.getByText('H (30%)')).toBeVisible();
	expect(await decodedPayload(page)).toBe('WIFI:T:WPA;S:Home;P:;H:false;;');
	await expect(page.getByRole('img', { name: 'Generated QR Code and logo' })).toBeVisible();

	await page.getByRole('button', { name: 'Clear Logo' }).click();
	await expect(page.getByRole('img', { name: 'Generated QR Code', exact: true })).toBeVisible();
});

test('download uses a sanitized filename', async ({ page }) => {
	await page.fill('#wifiSSID', 'My Network');
	await decodedPayload(page);
	const [download] = await Promise.all([
		page.waitForEvent('download'),
		page.getByRole('button', { name: 'Download PNG' }).click()
	]);
	expect(download.suggestedFilename()).toMatch(/^wifi-My_Network-256-M-\d+\.png$/);
});

test('content too large for a QR code shows an error', async ({ page }) => {
	await pickTemplate(page, 'Text');
	await page.locator('#customText').fill('x'.repeat(5000));
	await expect(page.getByText("Can't create a QR code")).toBeVisible();
});
