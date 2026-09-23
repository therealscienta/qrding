<script lang="ts">
	import { Select } from 'bits-ui';
	import type { WifiFields, WifiSecurity } from '$lib/encoders/wifi';

	let { fields = $bindable() }: { fields: WifiFields } = $props();

	const securityOptions: { value: WifiSecurity; label: string }[] = [
		{ value: 'WPA', label: 'WPA/WPA2/WPA3' },
		{ value: 'WEP', label: 'WEP' },
		{ value: 'nopass', label: 'Open (No Password)' }
	];

	const currentWifiSecurityLabel = $derived(
		securityOptions.find((opt) => opt.value === fields.security)?.label
	);
	const isOpen = $derived(fields.security === 'nopass');
</script>

<div class="space-y-4">
	<div>
		<label for="wifiSSID" class="mb-2 block text-sm font-medium text-blue-500"
			>Network Name (SSID)*</label
		>
		<input
			type="text"
			id="wifiSSID"
			bind:value={fields.ssid}
			placeholder="YourWiFiNetwork"
			class="h-10 w-full rounded-sm bg-gray-700 px-4 text-sm text-gray-100 shadow-md focus:ring-2 focus:ring-black focus:outline-none"
			required
		/>
	</div>
	<div>
		<label for="wifiPassword" class="mb-2 block text-sm font-medium text-blue-500"
			>Password {isOpen ? '(Not Needed for Open Network)' : ''}</label
		>
		<input
			type="password"
			id="wifiPassword"
			bind:value={fields.password}
			placeholder={isOpen ? '' : 'YourNetworkPassword'}
			autocomplete="off"
			class="h-10 w-full rounded-sm border border-black bg-gray-700 px-4 text-sm text-gray-100 focus:ring-2 focus:ring-black focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
			disabled={isOpen}
		/>
	</div>
	<div>
		<label for="wifiSecurity" class="mb-2 block text-sm font-medium text-blue-500"
			>Security Type</label
		>
		<Select.Root type="single" bind:value={fields.security}>
			<Select.Trigger
				id="wifiSecurity"
				class="flex h-10 w-full items-center justify-between rounded-sm border border-black bg-gray-700 px-4 py-2 text-sm whitespace-nowrap text-gray-100 shadow-md focus:ring-2 focus:ring-black focus:outline-none"
			>
				<span>{currentWifiSecurityLabel}</span>
				<svg width="16" height="16" viewBox="0 0 16 16" fill="none" class="opacity-50">
					<path
						d="M4 6L8 10L12 6"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
					/>
				</svg>
			</Select.Trigger>
			<Select.Portal>
				<Select.Content
					class="z-50 w-(--bits-select-anchor-width) overflow-hidden rounded-lg border border-black bg-gray-700 text-gray-200 shadow-lg"
					sideOffset={10}
				>
					<Select.Viewport class="p-1">
						{#each securityOptions as option (option.value)}
							<Select.Item
								value={option.value}
								label={option.label}
								class="cursor-pointer rounded px-4 py-2 text-sm data-[highlighted]:bg-gray-800"
							>
								{option.label}
							</Select.Item>
						{/each}
					</Select.Viewport>
				</Select.Content>
			</Select.Portal>
		</Select.Root>
	</div>
	<div class="flex items-center space-x-3">
		<input
			type="checkbox"
			id="wifiHidden"
			bind:checked={fields.hidden}
			class="h-4 w-4 rounded border-gray-300 text-gray-100 accent-black focus:ring-black"
		/>
		<label for="wifiHidden" class="text-sm font-medium text-gray-100">Hidden Network</label>
	</div>
	<p class="text-xs text-gray-600">* SSID is required to generate a functional Wi-Fi QR code.</p>
</div>
