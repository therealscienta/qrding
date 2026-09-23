export interface VCardFields {
	name: string;
	phone: string;
	email: string;
	org: string;
	title: string;
	street: string;
	city: string;
	region: string;
	zip: string;
	country: string;
	website: string;
	note: string;
}

export const emptyVCard = (): VCardFields => ({
	name: '',
	phone: '',
	email: '',
	org: '',
	title: '',
	street: '',
	city: '',
	region: '',
	zip: '',
	country: '',
	website: '',
	note: ''
});

// vCard 3.0 TEXT escaping.
function escapeVCard(value: string) {
	return value
		.trim()
		.replace(/\\/g, '\\\\')
		.replace(/,/g, '\\,')
		.replace(/;/g, '\\;')
		.replace(/\r?\n/g, '\\n');
}

// N is "Family;Given;Additional;Prefix;Suffix". The form has a single name field, so the
// last word is treated as the family name and the rest as given names.
function structuredName(fullName: string) {
	const parts = fullName.trim().split(/\s+/);
	const family = parts.pop() ?? '';
	return `${escapeVCard(family)};${escapeVCard(parts.join(' '))};;;`;
}

/** Builds a vCard 3.0 payload, or '' when the name is missing. */
export function encodeVCard(fields: VCardFields): string {
	if (!fields.name.trim()) return '';

	const e = Object.fromEntries(
		Object.entries(fields).map(([key, value]) => [key, escapeVCard(value)])
	) as unknown as VCardFields;

	const lines = ['BEGIN:VCARD', 'VERSION:3.0', `N:${structuredName(fields.name)}`, `FN:${e.name}`];
	if (e.org) lines.push(`ORG:${e.org}`);
	if (e.title) lines.push(`TITLE:${e.title}`);
	if (e.phone) lines.push(`TEL;TYPE=CELL:${e.phone}`);
	if (e.email) lines.push(`EMAIL:${e.email}`);
	if (e.street || e.city || e.region || e.zip || e.country) {
		lines.push(`ADR;TYPE=HOME:;;${e.street};${e.city};${e.region};${e.zip};${e.country}`);
	}
	if (e.website) lines.push(`URL:${e.website}`);
	if (e.note) lines.push(`NOTE:${e.note}`);
	lines.push('END:VCARD');
	return lines.join('\n');
}

export const vCardFilename = ({ name }: VCardFields) => `contact-${name.trim() || 'details'}`;
