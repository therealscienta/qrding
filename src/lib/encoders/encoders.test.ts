import { describe, expect, it } from 'vitest';
import { emptyWifi, encodeWifi, wifiFilename } from './wifi';
import { emptyVCard, encodeVCard } from './vcard';
import { emptyVEvent, encodeVEvent, endsBeforeStart, formatDateTime } from './vevent';
import { toFilenamePart } from '../filename';
import { contrastRatio, scanabilityWarning } from '../color';

describe('encodeWifi', () => {
	it('returns empty without an SSID', () => {
		expect(encodeWifi(emptyWifi())).toBe('');
		expect(encodeWifi({ ...emptyWifi(), ssid: '   ' })).toBe('');
	});

	it('builds a WPA payload', () => {
		expect(encodeWifi({ ssid: 'Home', password: 'secret', security: 'WPA', hidden: false })).toBe(
			'WIFI:T:WPA;S:Home;P:secret;H:false;;'
		);
	});

	it('escapes special characters in SSID and password', () => {
		expect(encodeWifi({ ssid: 'a;b,c', password: 'p"a:s\\s', security: 'WPA', hidden: true })).toBe(
			'WIFI:T:WPA;S:a\\;b\\,c;P:p\\"a\\:s\\\\s;H:true;;'
		);
	});

	it('omits the password for open networks', () => {
		expect(
			encodeWifi({ ssid: 'Cafe', password: 'ignored', security: 'nopass', hidden: false })
		).toBe('WIFI:T:nopass;S:Cafe;H:false;;');
	});
});

describe('encodeVCard', () => {
	it('returns empty without a name', () => {
		expect(encodeVCard(emptyVCard())).toBe('');
	});

	it('splits the name into family and given names', () => {
		const card = encodeVCard({ ...emptyVCard(), name: 'Jane Q Doe' });
		expect(card).toBe(
			['BEGIN:VCARD', 'VERSION:3.0', 'N:Doe;Jane Q;;;', 'FN:Jane Q Doe', 'END:VCARD'].join('\n')
		);
	});

	it('handles a single-word name', () => {
		expect(encodeVCard({ ...emptyVCard(), name: 'Cher' })).toContain('\nN:Cher;;;;\n');
	});

	it('escapes values and includes the address', () => {
		const card = encodeVCard({
			...emptyVCard(),
			name: 'Doe, Inc',
			org: 'A;B',
			note: 'line1\nline2',
			street: '1 Main St',
			country: 'SE'
		});
		expect(card).toContain('FN:Doe\\, Inc');
		expect(card).toContain('ORG:A\\;B');
		expect(card).toContain('NOTE:line1\\nline2');
		expect(card).toContain('ADR;TYPE=HOME:;;1 Main St;;;;SE');
	});
});

describe('encodeVEvent', () => {
	const now = new Date('2026-09-23T12:34:56.789Z');
	const event = {
		title: 'Team, sync; weekly',
		start: '2026-10-01T10:00',
		end: '2026-10-01T11:00',
		location: 'Room 1'
	};

	it('returns empty when required fields are missing', () => {
		expect(encodeVEvent(emptyVEvent(), now)).toBe('');
		expect(encodeVEvent({ ...event, end: '' }, now)).toBe('');
	});

	it('builds an escaped VEVENT', () => {
		expect(encodeVEvent(event, now)).toBe(
			[
				'BEGIN:VEVENT',
				`UID:qrding-event-${now.getTime()}@qrding.app`,
				'DTSTAMP:20260923T123456Z',
				'SUMMARY:Team\\, sync\\; weekly',
				'DTSTART:20261001T100000',
				'DTEND:20261001T110000',
				'LOCATION:Room 1',
				'END:VEVENT'
			].join('\n')
		);
	});

	it('rejects an end before the start', () => {
		const backwards = { ...event, end: '2026-10-01T09:00' };
		expect(endsBeforeStart(backwards)).toBe(true);
		expect(encodeVEvent(backwards, now)).toBe('');
	});

	it('formats date-times', () => {
		expect(formatDateTime('2026-10-01T10:00')).toBe('20261001T100000');
		expect(formatDateTime('2026-10-01T10:00:30')).toBe('20261001T100030');
		expect(formatDateTime('2026-10-01')).toBe('20261001');
	});
});

describe('toFilenamePart', () => {
	it('keeps word characters and turns spaces into underscores', () => {
		expect(toFilenamePart(wifiFilename({ ...emptyWifi(), ssid: 'MyNetwork' }))).toBe(
			'wifi-MyNetwork'
		);
		expect(toFilenamePart('Team Meeting')).toBe('Team_Meeting');
		expect(toFilenamePart(' Café & Bar! ')).toBe('Caf__Bar');
	});
});

describe('scanabilityWarning', () => {
	it('accepts dark on light', () => {
		expect(scanabilityWarning('#000000', '#ffffff')).toBeNull();
		expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21);
	});

	it('warns about inverted colors', () => {
		expect(scanabilityWarning('#ffffff', '#000000')).toMatch(/inverted/);
	});

	it('warns about low contrast', () => {
		expect(scanabilityWarning('#777777', '#999999')).toMatch(/contrast/);
	});
});
