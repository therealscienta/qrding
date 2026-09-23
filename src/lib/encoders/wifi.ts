export type WifiSecurity = 'WPA' | 'WEP' | 'nopass';

export interface WifiFields {
	ssid: string;
	password: string;
	security: WifiSecurity;
	hidden: boolean;
}

export const emptyWifi = (): WifiFields => ({
	ssid: '',
	password: '',
	security: 'WPA',
	hidden: false
});

// Backslash, semicolon, comma, double quote and colon must be escaped in WIFI: payloads.
function escapeWifi(value: string) {
	return value.replace(/([\\;,":])/g, '\\$1');
}

/** Builds a `WIFI:` payload, or '' when the SSID is missing. */
export function encodeWifi({ ssid, password, security, hidden }: WifiFields): string {
	if (!ssid.trim()) return '';

	let wifiString = `WIFI:T:${security};S:${escapeWifi(ssid)};`;
	if (security !== 'nopass') {
		wifiString += `P:${escapeWifi(password)};`;
	}
	wifiString += `H:${hidden ? 'true' : 'false'};;`;
	return wifiString;
}

export const wifiFilename = ({ ssid }: WifiFields) => `wifi-${ssid || 'network'}`;
