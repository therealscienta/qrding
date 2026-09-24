import { emptyText, encodeText, textFilename, type TextFields } from './encoders/text';
import { emptyUrl, encodeUrl, urlFilename, type UrlFields } from './encoders/url';
import {
	emptyWifi,
	encodeWifi,
	wifiFilename,
	type WifiFields,
	type WifiSecurity
} from './encoders/wifi';
import { emptyVCard, encodeVCard, vCardFilename, type VCardFields } from './encoders/vcard';
import { emptyVEvent, encodeVEvent, vEventFilename, type VEventFields } from './encoders/vevent';
import { emptySms, encodeSms, smsFilename, type SmsFields } from './encoders/sms';
import { emptyPhone, encodePhone, phoneFilename, type PhoneFields } from './encoders/phone';
import { emptyEmail, encodeEmail, emailFilename, type EmailFields } from './encoders/email';
import { emptyGeo, encodeGeo, geoFilename, type GeoFields } from './encoders/geo';

export interface FieldsByMode {
	text: TextFields;
	url: UrlFields;
	wifi: WifiFields;
	vcard: VCardFields;
	calendar: VEventFields;
	sms: SmsFields;
	phone: PhoneFields;
	email: EmailFields;
	geo: GeoFields;
}

export type Mode = keyof FieldsByMode;

/** A CSV row keyed by (lower-case) column name. */
export type CsvRecord = Partial<Record<string, string>>;

export interface Template<F> {
	label: string;
	empty: () => F;
	encode: (fields: F) => string;
	filename: (fields: F) => string;
	/** Batch CSV columns, in the order used when the CSV has no header row. */
	columns: readonly (keyof F & string)[];
	/** Shown for a batch row that can't be encoded. */
	requirement: string;
	/** Example row for the downloadable CSV template. */
	example: Partial<Record<keyof F & string, string>>;
	/** Builds fields from a CSV row. Throws an Error with a readable message for invalid values. */
	fromRow: (row: CsvRecord) => F;
}

// Copies the row's values for every string field of the template.
function stringFields<F extends object>(empty: F, row: CsvRecord): F {
	const fields = { ...(empty as Record<string, unknown>) };
	for (const [key, value] of Object.entries(empty)) {
		const cell = row[key.toLowerCase()];
		if (typeof value === 'string' && cell !== undefined) fields[key] = cell;
	}
	return fields as F;
}

function parseSecurity(value: string | undefined, hasPassword: boolean): WifiSecurity {
	const v = (value ?? '').trim().toLowerCase();
	if (!v) return hasPassword ? 'WPA' : 'nopass';
	if (/^(wpa|wpa2|wpa3|wpa\/wpa2|wpa2\/wpa3|wpa\/wpa2\/wpa3|wpa-psk|wpa2-psk|sae)$/.test(v)) {
		return 'WPA';
	}
	if (v === 'wep') return 'WEP';
	if (/^(nopass|none|open)$/.test(v)) return 'nopass';
	throw new Error(`unknown security "${value}" (use WPA, WEP or nopass)`);
}

function parseBoolean(value: string | undefined, column: string): boolean {
	const v = (value ?? '').trim().toLowerCase();
	if (/^(true|yes|y|1|x|ja)$/.test(v)) return true;
	if (/^(false|no|n|0|nej)?$/.test(v)) return false;
	throw new Error(`${column} must be true or false, not "${value}"`);
}

// Spreadsheets write "2026-10-01 10:00"; the encoder expects the datetime-local "T" form.
function parseDateTime(value: string | undefined, column: string): string {
	const v = (value ?? '').trim();
	if (!v) return '';
	const match = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}(?::\d{2})?)$/.exec(v);
	if (!match) throw new Error(`${column} must look like 2026-10-01 10:00, not "${value}"`);
	return `${match[1]}T${match[2]}`;
}

/** All templates, in the order shown in the template picker. */
export const templates: { [M in Mode]: Template<FieldsByMode[M]> } = {
	text: {
		label: 'Text',
		empty: emptyText,
		encode: encodeText,
		filename: textFilename,
		columns: ['text'],
		requirement: 'the text is empty',
		example: { text: 'Hello from QRding' },
		fromRow: (row) => stringFields(emptyText(), row)
	},
	url: {
		label: 'Link (URL)',
		empty: emptyUrl,
		encode: encodeUrl,
		filename: urlFilename,
		columns: ['url'],
		requirement: 'needs a valid url',
		example: { url: 'https://qrding.app' },
		fromRow: (row) => stringFields(emptyUrl(), row)
	},
	wifi: {
		label: 'Wi-Fi Network',
		empty: emptyWifi,
		encode: encodeWifi,
		filename: wifiFilename,
		columns: ['ssid', 'password', 'security', 'hidden'],
		requirement: 'needs an ssid',
		example: { ssid: 'Home', password: 'secret', security: 'WPA', hidden: 'false' },
		fromRow: (row) => ({
			...stringFields(emptyWifi(), row),
			security: parseSecurity(row.security, Boolean(row.password?.trim())),
			hidden: parseBoolean(row.hidden, 'hidden')
		})
	},
	vcard: {
		label: 'Contact Card (VCard)',
		empty: emptyVCard,
		encode: encodeVCard,
		filename: vCardFilename,
		columns: [
			'name',
			'phone',
			'email',
			'org',
			'title',
			'street',
			'city',
			'region',
			'zip',
			'country',
			'website',
			'note'
		],
		requirement: 'needs a name',
		example: { name: 'Jane Doe', phone: '+46701234567', email: 'jane@example.com', org: 'ACME' },
		fromRow: (row) => stringFields(emptyVCard(), row)
	},
	calendar: {
		label: 'Calendar Event',
		empty: emptyVEvent,
		encode: (fields) => encodeVEvent(fields),
		filename: vEventFilename,
		columns: ['title', 'start', 'end', 'location'],
		requirement: 'needs a title, start and end (end after start)',
		example: {
			title: 'Team meeting',
			start: '2026-10-01 10:00',
			end: '2026-10-01 11:00',
			location: 'Room 1'
		},
		fromRow: (row) => ({
			...stringFields(emptyVEvent(), row),
			start: parseDateTime(row.start, 'start'),
			end: parseDateTime(row.end, 'end')
		})
	},
	sms: {
		label: 'SMS',
		empty: emptySms,
		encode: encodeSms,
		filename: smsFilename,
		columns: ['phone', 'message'],
		requirement: 'needs a phone number',
		example: { phone: '+46701234567', message: 'Hello!' },
		fromRow: (row) => stringFields(emptySms(), row)
	},
	phone: {
		label: 'Phone Call',
		empty: emptyPhone,
		encode: encodePhone,
		filename: phoneFilename,
		columns: ['phone'],
		requirement: 'needs a phone number',
		example: { phone: '+46701234567' },
		fromRow: (row) => stringFields(emptyPhone(), row)
	},
	email: {
		label: 'Email',
		empty: emptyEmail,
		encode: encodeEmail,
		filename: emailFilename,
		columns: ['to', 'subject', 'body'],
		requirement: "needs a valid address in 'to'",
		example: { to: 'hello@example.com', subject: 'Hi' },
		fromRow: (row) => stringFields(emptyEmail(), row)
	},
	geo: {
		label: 'Location',
		empty: emptyGeo,
		encode: encodeGeo,
		filename: geoFilename,
		columns: ['latitude', 'longitude', 'label'],
		requirement: 'needs a valid latitude and longitude',
		example: { latitude: '59.3293', longitude: '18.0686', label: 'Stockholm' },
		fromRow: (row) => stringFields(emptyGeo(), row)
	}
};

export const modes = Object.keys(templates) as Mode[];

export const emptyFields = (): FieldsByMode => ({
	text: emptyText(),
	url: emptyUrl(),
	wifi: emptyWifi(),
	vcard: emptyVCard(),
	calendar: emptyVEvent(),
	sms: emptySms(),
	phone: emptyPhone(),
	email: emptyEmail(),
	geo: emptyGeo()
});

export function encodeFor<M extends Mode>(mode: M, fields: FieldsByMode[M]): string {
	return templates[mode].encode(fields);
}

export function filenameFor<M extends Mode>(mode: M, fields: FieldsByMode[M]): string {
	return templates[mode].filename(fields);
}

export function fieldsFromRow<M extends Mode>(mode: M, row: CsvRecord): FieldsByMode[M] {
	return templates[mode].fromRow(row);
}
