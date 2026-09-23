// WCAG relative luminance of a #rrggbb color.
function luminance(hex: string) {
	const [r, g, b] = [1, 3, 5].map((i) => {
		const c = parseInt(hex.slice(i, i + 2), 16) / 255;
		return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
	});
	return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string) {
	const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
	return (hi + 0.05) / (lo + 0.05);
}

/**
 * Returns a warning when the colors are likely to be hard to scan: the modules must be darker
 * than the background (many scanners can't read inverted codes) and clearly distinguishable.
 */
export function scanabilityWarning(dark: string, light: string): string | null {
	if (luminance(dark) >= luminance(light)) {
		return 'The dark color is lighter than the background. Many scanners cannot read inverted codes.';
	}
	if (contrastRatio(dark, light) < 3) {
		return 'Low contrast between the colors. The code may not scan reliably.';
	}
	return null;
}
