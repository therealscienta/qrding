import { describe, expect, it } from 'vitest';
import { csvTemplate, MAX_BATCH_ROWS, parseBatch } from './batch';
import { modes } from './templates';

const parse = (mode: Parameters<typeof parseBatch>[0], text: string) => parseBatch(mode, text, 'M');

describe('parseBatch', () => {
	it('reads a plain list without a header', () => {
		const { items, errors } = parse('url', 'qrding.app\nhttps://example.com/a?x=1,2');
		expect(errors).toEqual([]);
		expect(items.map((i) => [i.row, i.payload, i.filename])).toEqual([
			[1, 'https://qrding.app', '1-link-qrdingapp'],
			[2, 'https://example.com/a?x=1,2', '2-link-examplecom']
		]);
	});

	it('maps header columns by name, in any order and case', () => {
		const { items, ignoredColumns } = parse(
			'url',
			'Caption,URL,Notes,filename\nFront door,qrding.app,x,door\nBack,example.com,,'
		);
		expect(ignoredColumns).toEqual(['notes']);
		expect(items.map((i) => [i.row, i.caption, i.filename])).toEqual([
			[2, 'Front door', '1-door'],
			[3, 'Back', '2-Back']
		]);
	});

	it('trims captions and leaves them empty when the column is missing or blank', () => {
		expect(parse('url', 'url,caption\na.se, Hi \nb.se,').items.map((i) => i.caption)).toEqual([
			'Hi',
			''
		]);
		expect(parse('url', 'a.se').items[0].caption).toBe('');
	});

	it('reports invalid rows with their row number and keeps going', () => {
		const { items, errors } = parse('url', 'url\nqrding.app\nnot a url\n\nexample.com');
		expect(items).toHaveLength(2);
		expect(errors).toEqual([{ row: 3, message: 'needs a valid url' }]);
	});

	it('pads the numbering to the item count', () => {
		const list = Array.from({ length: 12 }, (_, i) => `site${i}.se`).join('\n');
		const { items } = parse('url', list);
		expect(items[0].filename).toBe('01-link-site0se');
		expect(items[11].filename).toBe('12-link-site11se');
	});

	it('coerces Wi-Fi security and hidden values', () => {
		const { items, errors } = parse(
			'wifi',
			'ssid;password;security;hidden\nHome;pw;wpa2;yes\nCafe;;;\nOld;pw;WEP;0\nBad;pw;kerberos;\nBad2;pw;wpa;maybe'
		);
		expect(items.map((i) => i.payload)).toEqual([
			'WIFI:T:WPA;S:Home;P:pw;H:true;;',
			'WIFI:T:nopass;S:Cafe;H:false;;',
			'WIFI:T:WEP;S:Old;P:pw;H:false;;'
		]);
		expect(errors).toEqual([
			{ row: 5, message: 'unknown security "kerberos" (use WPA, WEP or nopass)' },
			{ row: 6, message: 'hidden must be true or false, not "maybe"' }
		]);
	});

	it('accepts spreadsheet date-times for calendar events', () => {
		const { items, errors } = parse(
			'calendar',
			'title,start,end\nMeeting,2026-10-01 10:00,2026-10-01 11:00\nDay,2026-10-01,2026-10-02'
		);
		expect(items[0].payload).toContain('DTSTART:20261001T100000\nDTEND:20261001T110000');
		expect(errors).toEqual([
			{ row: 3, message: 'start must look like 2026-10-01 10:00, not "2026-10-01"' }
		]);
	});

	it('reports rows that are too large for a QR code', () => {
		const { items, errors } = parse('text', `text\n"${'x'.repeat(5000)}"\nsmall`);
		expect(items).toHaveLength(1);
		expect(errors).toEqual([{ row: 2, message: 'too much data for a QR code' }]);
	});

	it(`stops after ${MAX_BATCH_ROWS} rows`, () => {
		const list = Array.from({ length: MAX_BATCH_ROWS + 5 }, (_, i) => `row ${i}`).join('\n');
		const { items, errors } = parse('text', list);
		expect(items).toHaveLength(MAX_BATCH_ROWS);
		expect(errors).toEqual([
			{ row: MAX_BATCH_ROWS + 1, message: `only the first ${MAX_BATCH_ROWS} rows are used` }
		]);
	});

	it.each(modes)('the %s CSV template parses into one valid code', (mode) => {
		const { items, errors } = parse(mode, csvTemplate(mode));
		expect(errors).toEqual([]);
		expect(items).toHaveLength(1);
		expect(items[0].caption).toBe('Scan me');
	});
});
