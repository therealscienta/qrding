import { describe, expect, it } from 'vitest';
import { emptyUrl, encodeUrl, normalizeUrl, urlFilename } from './url';
import { encodePhone, normalizePhone } from './phone';
import { encodeSms } from './sms';
import { encodeEmail, isValidEmail } from './email';
import { emptyGeo, encodeGeo, parseGeo } from './geo';

describe('url', () => {
	it('adds https when the scheme is missing', () => {
		expect(normalizeUrl('qrding.app/path?x=1')).toBe('https://qrding.app/path?x=1');
		expect(normalizeUrl('  http://example.com ')).toBe('http://example.com');
	});

	it('keeps other schemes', () => {
		expect(normalizeUrl('myapp://product/1234')).toBe('myapp://product/1234');
	});

	it('rejects empty and invalid input', () => {
		expect(encodeUrl(emptyUrl())).toBe('');
		expect(normalizeUrl('not a url')).toBe('');
		expect(normalizeUrl('localhost:3000')).toBe('https://localhost:3000');
		expect(normalizeUrl('example.com:8080/x')).toBe('https://example.com:8080/x');
		expect(normalizeUrl('https://nodot')).toBe('');
	});

	it('uses the host for the filename', () => {
		expect(urlFilename({ url: 'qrding.app/x' })).toBe('link-qrding.app');
	});
});

describe('phone and sms', () => {
	it('normalizes phone numbers', () => {
		expect(normalizePhone(' +46 (70) 123-45.67 ')).toBe('+46701234567');
		expect(normalizePhone('070-123 45 67')).toBe('0701234567');
		expect(normalizePhone('abc')).toBe('');
	});

	it('builds tel: and SMSTO: payloads', () => {
		expect(encodePhone({ phone: '+46 70 123 45 67' })).toBe('tel:+46701234567');
		expect(encodePhone({ phone: '' })).toBe('');
		expect(encodeSms({ phone: '+46 70 123', message: 'Meet at 10:30' })).toBe(
			'SMSTO:+4670123:Meet at 10:30'
		);
		expect(encodeSms({ phone: '', message: 'hi' })).toBe('');
	});
});

describe('email', () => {
	it('validates addresses', () => {
		expect(isValidEmail('a@b.se')).toBe(true);
		expect(isValidEmail('a@b')).toBe(false);
	});

	it('builds mailto with encoded subject and body', () => {
		expect(encodeEmail({ to: 'a@b.se', subject: '', body: '' })).toBe('mailto:a@b.se');
		expect(encodeEmail({ to: 'a@b.se', subject: 'Hi & bye', body: 'Line 1\nLine 2' })).toBe(
			'mailto:a@b.se?subject=Hi%20%26%20bye&body=Line%201%0ALine%202'
		);
		expect(encodeEmail({ to: 'nope', subject: 'x', body: '' })).toBe('');
	});
});

describe('geo', () => {
	it('parses and range-checks coordinates', () => {
		expect(parseGeo({ ...emptyGeo(), latitude: '59,3293', longitude: '18.0686' })).toEqual({
			lat: 59.3293,
			lng: 18.0686
		});
		expect(parseGeo({ ...emptyGeo(), latitude: '91', longitude: '0' })).toBeNull();
		expect(parseGeo({ ...emptyGeo(), latitude: '1e3', longitude: '0' })).toBeNull();
	});

	it('builds geo URIs with an optional label', () => {
		expect(encodeGeo({ latitude: '59.32930012', longitude: '18.0686', label: '' })).toBe(
			'geo:59.3293,18.0686'
		);
		expect(encodeGeo({ latitude: '59.3293', longitude: '18.0686', label: 'Café (north)' })).toBe(
			'geo:59.3293,18.0686?q=59.3293,18.0686(Caf%C3%A9%20(north))'
		);
		expect(encodeGeo(emptyGeo())).toBe('');
	});
});
