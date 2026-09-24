const DELIMITERS = [',', ';', '\t'];

// Picks the delimiter that occurs most in the first line (outside quotes). Returns '' when the
// first line has none, so a plain list (one URL per line, which may contain commas) isn't split.
function detectDelimiter(text: string): string {
	const counts = new Map(DELIMITERS.map((d) => [d, 0]));
	let quoted = false;
	for (const c of text) {
		if (c === '"') quoted = !quoted;
		else if (!quoted && (c === '\n' || c === '\r')) break;
		else if (!quoted && counts.has(c)) counts.set(c, counts.get(c)! + 1);
	}
	let best = '';
	let bestCount = 0;
	for (const [d, count] of counts) {
		if (count > bestCount) [best, bestCount] = [d, count];
	}
	return best;
}

/**
 * Parses CSV with RFC 4180 quoting ("a, b", "say ""hi""", line breaks inside quotes). The
 * delimiter (comma, semicolon or tab) is detected from the first line. Blank rows are dropped.
 */
export function parseCsv(input: string): string[][] {
	const text = input.replace(/^\uFEFF/, '');
	const delimiter = detectDelimiter(text);
	const rows: string[][] = [];
	let row: string[] = [];
	let field = '';
	let quoted = false;

	for (let i = 0; i < text.length; i++) {
		const c = text[i];
		if (quoted) {
			if (c !== '"') field += c;
			else if (text[i + 1] === '"') {
				field += '"';
				i++;
			} else quoted = false;
		} else if (c === '"' && field === '') {
			quoted = true;
		} else if (c === delimiter) {
			row.push(field);
			field = '';
		} else if (c === '\n' || c === '\r') {
			if (c === '\r' && text[i + 1] === '\n') i++;
			row.push(field);
			rows.push(row);
			row = [];
			field = '';
		} else {
			field += c;
		}
	}
	if (field !== '' || row.length) {
		row.push(field);
		rows.push(row);
	}
	return rows.filter((r) => r.some((cell) => cell.trim() !== ''));
}

/** Formats one CSV row, quoting cells that need it. */
export function toCsvRow(cells: string[]): string {
	return cells
		.map((cell) => (/[",;\t\r\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell))
		.join(',');
}
