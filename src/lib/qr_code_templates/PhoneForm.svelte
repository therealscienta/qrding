<script lang="ts">
	import type { PhoneFields } from '$lib/encoders/phone';

	let { fields = $bindable() }: { fields: PhoneFields } = $props();
</script>

<div class="space-y-2">
	<label for="phoneNumber" class="mb-2 block text-sm font-medium text-blue-500">Phone Number*</label
	>
	<input
		type="tel"
		id="phoneNumber"
		bind:value={fields.phone}
		placeholder="+46 70 123 45 67"
		autocomplete="tel"
		class="h-10 w-full rounded-md border border-black bg-gray-700 px-4 text-sm text-gray-100 shadow-md focus:ring-2 focus:ring-black focus:outline-none"
		required
	/>
	<p class="text-xs text-gray-400">
		Include the country code (e.g. +46) so it works from any country.
	</p>
</div>
