export interface PhoneFields {
	phone: string;
}

export const emptyPhone = (): PhoneFields => ({ phone: '' });

/** Strips spaces, dashes, dots and parentheses; keeps a leading + and digits. '' if no digits. */
export function normalizePhone(value: string): string {
	const trimmed = value.trim();
	const digits = trimmed.replace(/\D/g, '');
	if (!digits) return '';
	return trimmed.startsWith('+') ? `+${digits}` : digits;
}

export function encodePhone({ phone }: PhoneFields): string {
	const number = normalizePhone(phone);
	return number ? `tel:${number}` : '';
}

export const phoneFilename = ({ phone }: PhoneFields) =>
	`call-${normalizePhone(phone) || 'number'}`;
