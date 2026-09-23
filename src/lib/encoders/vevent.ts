export interface VEventFields {
	title: string;
	/** `datetime-local` value: YYYY-MM-DDTHH:MM */
	start: string;
	/** `datetime-local` value: YYYY-MM-DDTHH:MM */
	end: string;
	location: string;
}

export const emptyVEvent = (): VEventFields => ({ title: '', start: '', end: '', location: '' });

// RFC 5545 TEXT escaping.
function escapeText(value: string) {
	return value
		.trim()
		.replace(/\\/g, '\\\\')
		.replace(/;/g, '\\;')
		.replace(/,/g, '\\,')
		.replace(/\r?\n/g, '\\n');
}

// YYYY-MM-DDTHH:MM[:SS] -> YYYYMMDDTHHMMSS (floating local time, i.e. the scanner's time zone).
export function formatDateTime(value: string) {
	const withSeconds = /T\d{2}:\d{2}$/.test(value) ? `${value}:00` : value;
	return withSeconds.replace(/[-:]/g, '');
}

function utcStamp(date: Date) {
	return date
		.toISOString()
		.replace(/[-:]/g, '')
		.replace(/\.\d{3}/, '');
}

/** True when both times are set and the end is before the start. */
export function endsBeforeStart({ start, end }: VEventFields) {
	// datetime-local values have a fixed format, so they compare correctly as strings.
	return Boolean(start && end && end < start);
}

/**
 * Builds a bare VEVENT payload (the de-facto QR calendar format), or '' when a required
 * field is missing or the end is before the start.
 */
export function encodeVEvent(fields: VEventFields, now = new Date()): string {
	const { title, start, end, location } = fields;
	if (!title.trim() || !start || !end || endsBeforeStart(fields)) return '';

	const lines = [
		'BEGIN:VEVENT',
		`UID:qrding-event-${now.getTime()}@qrding.app`,
		`DTSTAMP:${utcStamp(now)}`,
		`SUMMARY:${escapeText(title)}`,
		`DTSTART:${formatDateTime(start)}`,
		`DTEND:${formatDateTime(end)}`
	];
	if (location.trim()) lines.push(`LOCATION:${escapeText(location)}`);
	lines.push('END:VEVENT');
	return lines.join('\n');
}

export const vEventFilename = ({ title }: VEventFields) => `event-${title.trim() || 'event'}`;
