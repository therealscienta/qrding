export interface UrlFields {
	url: string;
}

export const emptyUrl = (): UrlFields => ({ url: '' });

/** Adds https:// when no scheme is given; returns '' when the result isn't a valid URL. */
export function normalizeUrl(value: string): string {
	const trimmed = value.trim();
	if (!trimmed) return '';
	// A colon followed by a digit is a port (example.com:8080), not a scheme.
	const hasScheme = /^[a-z][a-z\d+.-]*:(?!\d)/i.test(trimmed);
	const withScheme = hasScheme ? trimmed : `https://${trimmed}`;
	try {
		const url = new URL(withScheme);
		// "https://foo" parses fine; require a dot or localhost so typos don't pass silently.
		if (
			/^https?:$/.test(url.protocol) &&
			!url.hostname.includes('.') &&
			url.hostname !== 'localhost'
		) {
			return '';
		}
		return withScheme;
	} catch {
		return '';
	}
}

export const encodeUrl = ({ url }: UrlFields) => normalizeUrl(url);

export function urlFilename({ url }: UrlFields) {
	const normalized = normalizeUrl(url);
	return `link-${normalized ? new URL(normalized).hostname : 'url'}`;
}
