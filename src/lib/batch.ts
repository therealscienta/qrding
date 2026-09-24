import QRCode from 'qrcode';
import type { QRCode as QRCodeData, QRCodeErrorCorrectionLevel } from 'qrcode';
import { parseCsv, toCsvRow } from './csv';
import { toFilenamePart } from './filename';
import {
	encodeFor,
	fieldsFromRow,
	filenameFor,
	templates,
	type CsvRecord,
	type Mode
} from './templates';

export const MAX_BATCH_ROWS = 1000;

/** Columns every template accepts on top of its own: text above the code, and the file name. */
export const EXTRA_COLUMNS = ['caption', 'filename'] as const;

export interface BatchItem {
	/** Spreadsheet row number (the header is row 1). */
	row: number;
	payload: string;
	caption: string;
	/** Numbered, sanitized file name without extension, e.g. "03-link-qrding.app". */
	filename: string;
	qr: QRCodeData;
}

export interface BatchError {
	row: number;
	message: string;
}

export interface BatchResult {
	items: BatchItem[];
	errors: BatchError[];
	/** Header columns that aren't used by this template. */
	ignoredColumns: string[];
}

export const batchColumns = (mode: Mode): string[] => [
	...templates[mode].columns,
	...EXTRA_COLUMNS
];

/** A CSV with the header row and one example row, for users to fill in. */
export function csvTemplate(mode: Mode): string {
	const columns = batchColumns(mode);
	const example: Record<string, string> = { ...templates[mode].example, caption: 'Scan me' };
	return `${toCsvRow(columns)}\n${toCsvRow(columns.map((c) => example[c] ?? ''))}\n`;
}

/**
 * Turns CSV text into codes for `mode`. The first row is a header when it contains a known
 * column name; otherwise columns are taken in the template's order (so a plain list of URLs
 * works). Invalid rows are reported instead of stopping the batch.
 */
export function parseBatch(
	mode: Mode,
	text: string,
	errorCorrectionLevel: QRCodeErrorCorrectionLevel
): BatchResult {
	const rows = parseCsv(text);
	const columns = batchColumns(mode);
	const first = rows[0]?.map((cell) => cell.trim().toLowerCase()) ?? [];
	const hasHeader = first.some((cell) => columns.includes(cell));
	const header = hasHeader ? first : columns;
	const dataRows = hasHeader ? rows.slice(1) : rows;
	const firstRowNumber = hasHeader ? 2 : 1;

	const items: BatchItem[] = [];
	const errors: BatchError[] = [];
	for (const [index, cells] of dataRows.entries()) {
		const row = index + firstRowNumber;
		if (index >= MAX_BATCH_ROWS) {
			errors.push({ row, message: `only the first ${MAX_BATCH_ROWS} rows are used` });
			break;
		}
		const record: CsvRecord = {};
		header.forEach((name, i) => {
			if (columns.includes(name) && cells[i] !== undefined) record[name] = cells[i];
		});
		try {
			const fields = fieldsFromRow(mode, record);
			const payload = encodeFor(mode, fields);
			if (!payload.trim()) {
				errors.push({ row, message: templates[mode].requirement });
				continue;
			}
			let qr: QRCodeData;
			try {
				qr = QRCode.create(payload, { errorCorrectionLevel });
			} catch {
				errors.push({ row, message: 'too much data for a QR code' });
				continue;
			}
			const caption = record.caption?.trim() ?? '';
			const filename =
				toFilenamePart(record.filename ?? '') ||
				toFilenamePart(caption) ||
				toFilenamePart(filenameFor(mode, fields)) ||
				'qrcode';
			items.push({ row, payload, caption, filename, qr });
		} catch (error) {
			errors.push({ row, message: error instanceof Error ? error.message : String(error) });
		}
	}

	// Number the files so they sort in CSV order and names never collide.
	const digits = String(items.length).length;
	for (const [i, item] of items.entries()) {
		item.filename = `${String(i + 1).padStart(digits, '0')}-${item.filename}`;
	}

	const ignoredColumns = hasHeader ? first.filter((c) => c && !columns.includes(c)) : [];
	return { items, errors, ignoredColumns };
}
