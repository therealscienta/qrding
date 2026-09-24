<script lang="ts" generics="T extends string">
	let {
		value = $bindable(),
		options,
		name,
		legend
	}: { value: T; options: { value: T; label: string }[]; name: string; legend: string } = $props();
</script>

<fieldset>
	<legend class="mb-2 block text-sm font-medium text-blue-500">{legend}</legend>
	<div class="inline-flex overflow-hidden rounded-md border border-gray-600">
		{#each options as option (option.value)}
			<label
				class="cursor-pointer px-3 py-1.5 text-sm text-gray-300 transition-colors not-first:border-l not-first:border-gray-600 hover:bg-gray-800 has-checked:bg-blue-600 has-checked:text-white has-focus-visible:ring-2 has-focus-visible:ring-blue-300 has-focus-visible:ring-inset"
			>
				<input type="radio" {name} value={option.value} bind:group={value} class="sr-only" />
				{option.label}
			</label>
		{/each}
	</div>
</fieldset>
