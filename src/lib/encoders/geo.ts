export interface GeoFields {
	latitude: string;
	longitude: string;
	label: string;
}

export const emptyGeo = (): GeoFields => ({ latitude: '', longitude: '', label: '' });

function parseCoordinate(value: string, limit: number): number | null {
	const trimmed = value.trim().replace(',', '.');
	if (!/^-?\d+(\.\d+)?$/.test(trimmed)) return null;
	const n = Number(trimmed);
	return Math.abs(n) <= limit ? n : null;
}

/** Parsed coordinates, or null when either is missing or out of range. */
export function parseGeo({ latitude, longitude }: GeoFields) {
	const lat = parseCoordinate(latitude, 90);
	const lng = parseCoordinate(longitude, 180);
	return lat === null || lng === null ? null : { lat, lng };
}

// 6 decimals is ~10 cm, more than any phone GPS gives.
const format = (n: number) => String(Number(n.toFixed(6)));

/**
 * Builds a `geo:` URI (RFC 5870), or '' when the coordinates are invalid. A label is added as
 * `?q=lat,lng(label)`, which Android map apps show as the pin name.
 */
export function encodeGeo(fields: GeoFields): string {
	const coords = parseGeo(fields);
	if (!coords) return '';
	const point = `${format(coords.lat)},${format(coords.lng)}`;
	const label = fields.label.trim();
	return label ? `geo:${point}?q=${point}(${encodeURIComponent(label)})` : `geo:${point}`;
}

export const geoFilename = ({ label }: GeoFields) => `location-${label.trim() || 'pin'}`;
