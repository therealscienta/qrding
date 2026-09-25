<script lang="ts">
	import { parseGeo, type GeoFields } from '$lib/encoders/geo';

	let { fields = $bindable() }: { fields: GeoFields } = $props();

	let locating = $state(false);
	let locateError = $state('');

	const invalid = $derived(
		(fields.latitude.trim() !== '' || fields.longitude.trim() !== '') && !parseGeo(fields)
	);

	function useMyLocation() {
		if (!navigator.geolocation) {
			locateError = 'Your browser does not support location.';
			return;
		}
		locating = true;
		locateError = '';
		navigator.geolocation.getCurrentPosition(
			(position) => {
				fields.latitude = position.coords.latitude.toFixed(6);
				fields.longitude = position.coords.longitude.toFixed(6);
				locating = false;
			},
			(error) => {
				locateError = error.message || 'Could not get your location.';
				locating = false;
			},
			{ enableHighAccuracy: true, timeout: 10000 }
		);
	}
</script>

<div class="space-y-4">
	<div class="grid grid-cols-2 gap-x-2">
		<div>
			<label for="geoLatitude" class="mb-2 block text-sm font-medium text-blue-500">Latitude*</label
			>
			<input
				type="text"
				id="geoLatitude"
				bind:value={fields.latitude}
				placeholder="59.3293"
				inputmode="decimal"
				class="h-10 w-full rounded-md border border-black bg-gray-700 px-4 text-sm text-gray-100 shadow-md focus:ring-2 focus:ring-black focus:outline-none"
				required
			/>
		</div>
		<div>
			<label for="geoLongitude" class="mb-2 block text-sm font-medium text-blue-500"
				>Longitude*</label
			>
			<input
				type="text"
				id="geoLongitude"
				bind:value={fields.longitude}
				placeholder="18.0686"
				inputmode="decimal"
				class="h-10 w-full rounded-md border border-black bg-gray-700 px-4 text-sm text-gray-100 shadow-md focus:ring-2 focus:ring-black focus:outline-none"
				required
			/>
		</div>
	</div>
	{#if invalid}
		<p class="text-xs text-red-400">
			Latitude must be between -90 and 90, longitude between -180 and 180.
		</p>
	{/if}
	<button
		type="button"
		onclick={useMyLocation}
		disabled={locating}
		class="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-wait disabled:opacity-50"
	>
		{locating ? 'Locating…' : 'Use my location'}
	</button>
	{#if locateError}
		<p class="text-xs text-red-400">{locateError}</p>
	{/if}
	<div>
		<label for="geoLabel" class="mb-2 block text-sm font-medium text-blue-500">Label</label>
		<input
			type="text"
			id="geoLabel"
			bind:value={fields.label}
			placeholder="e.g., Main entrance"
			class="h-10 w-full rounded-md border border-black bg-gray-700 px-4 text-sm text-gray-100 shadow-md focus:ring-2 focus:ring-black focus:outline-none"
		/>
		<p class="mt-1 text-xs text-gray-400">Shown as the pin name in Android map apps.</p>
	</div>
</div>
