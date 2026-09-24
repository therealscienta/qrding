import { describe, expect, it } from 'vitest';
import { parseCsv, toCsvRow } from './csv';

describe('parseCsv', () => {
	it('parses comma-separated rows', () => {
		expect(parseCsv('a,b\n1,2')).toEqual([
			['a', 'b'],
			['1', '2']
		]);
	});

	it('detects semicolons and tabs (spreadsheet exports)', () => {
		expect(parseCsv('a;b\r\n"x;y";2\r\n')).toEqual([
			['a', 'b'],
			['x;y', '2']
		]);
		expect(parseCsv('a\tb\n1\t2')).toEqual([
			['a', 'b'],
			['1', '2']
		]);
	});

	it('handles quotes, escaped quotes and line breaks inside quotes', () => {
		expect(parseCsv('text,n\n"line1\nline2",1\n"say ""hi""",2')).toEqual([
			['text', 'n'],
			['line1\nline2', '1'],
			['say "hi"', '2']
		]);
	});

	it('strips a BOM and drops blank rows', () => {
		expect(parseCsv('\uFEFFa,b\n\n , \n1,2\n\n')).toEqual([
			['a', 'b'],
			['1', '2']
		]);
	});

	it('does not split a plain list whose first line has no delimiter', () => {
		expect(parseCsv('https://a.se\nhttps://b.se/?x=1,2')).toEqual([
			['https://a.se'],
			['https://b.se/?x=1,2']
		]);
	});
});

describe('toCsvRow', () => {
	it('quotes only cells that need it', () => {
		expect(toCsvRow(['plain', 'a,b', 'say "hi"', 'x;y'])).toBe('plain,"a,b","say ""hi""","x;y"');
	});

	it('round-trips through parseCsv', () => {
		const cells = ['a,b', 'line1\nline2', '"quoted"', 'ok'];
		expect(parseCsv(`${toCsvRow(['h1', 'h2', 'h3', 'h4'])}\n${toCsvRow(cells)}`)[1]).toEqual(cells);
	});
});
