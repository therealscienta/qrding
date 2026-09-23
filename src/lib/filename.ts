/** Turns free text into a safe filename part: spaces become '_', other unsafe chars are dropped. */
export function toFilenamePart(value: string) {
	return value
		.trim()
		.replace(/\s+/g, '_')
		.replace(/[^\w-]/g, '');
}
