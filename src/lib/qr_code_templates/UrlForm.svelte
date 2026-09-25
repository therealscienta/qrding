<script lang="ts">
	import { normalizeUrl, type UrlFields } from '$lib/encoders/url';

	let { fields = $bindable() }: { fields: UrlFields } = $props();

	const invalid = $derived(fields.url.trim() !== '' && !normalizeUrl(fields.url));
</script>

<div class="space-y-2">
	<label for="urlInput" class="mb-2 block text-sm font-medium text-blue-500">URL*</label>
	<input
		type="url"
		id="urlInput"
		bind:value={fields.url}
		placeholder="https://example.com"
		inputmode="url"
		autocomplete="url"
		class="h-10 w-full rounded-md border border-black bg-gray-700 px-4 text-sm text-gray-100 shadow-md focus:ring-2 focus:ring-black focus:outline-none"
		required
	/>
	{#if invalid}
		<p class="text-xs text-red-400">That doesn't look like a valid URL.</p>
	{:else}
		<p class="text-xs text-gray-400">https:// is added if you leave it out.</p>
	{/if}
</div>
