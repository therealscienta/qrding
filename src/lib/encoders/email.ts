export interface EmailFields {
	to: string;
	subject: string;
	body: string;
}

export const emptyEmail = (): EmailFields => ({ to: '', subject: '', body: '' });

export const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

/** Builds a `mailto:` payload, or '' when the address is missing or invalid. */
export function encodeEmail({ to, subject, body }: EmailFields): string {
	if (!isValidEmail(to)) return '';
	const params = [
		subject.trim() && `subject=${encodeURIComponent(subject.trim())}`,
		body.trim() && `body=${encodeURIComponent(body.trim())}`
	].filter(Boolean);
	return `mailto:${to.trim()}${params.length ? `?${params.join('&')}` : ''}`;
}

export const emailFilename = ({ to }: EmailFields) => `email-${to.trim() || 'message'}`;
