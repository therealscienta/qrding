import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { open } from './helpers';

test('no WCAG 2 A/AA violations with the placeholder shown', async ({ page }) => {
	await open(page);
	const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
	expect(results.violations).toEqual([]);
});

test('no WCAG 2 A/AA violations with a code, its export controls and scan check visible', async ({
	page
}) => {
	await open(page);
	await page.fill('#wifiSSID', 'Home');
	await expect(page.getByTestId('scan-check')).toHaveAttribute('data-state', 'ok');
	const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
	expect(results.violations).toEqual([]);
});
