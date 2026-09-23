import { normalizePhone } from './phone';

export interface SmsFields {
	phone: string;
	message: string;
}

export const emptySms = (): SmsFields => ({ phone: '', message: '' });

/** Builds an `SMSTO:` payload, or '' when the phone number is missing. */
export function encodeSms({ phone, message }: SmsFields): string {
	const number = normalizePhone(phone);
	if (!number) return '';
	// Scanners split on the first two colons only, so the message may contain colons.
	return `SMSTO:${number}:${message}`;
}

export const smsFilename = ({ phone }: SmsFields) => `sms-${normalizePhone(phone) || 'message'}`;
