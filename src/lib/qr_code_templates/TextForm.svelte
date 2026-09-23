<script lang="ts">
	let { text = $bindable() }: { text: string } = $props();
</script>

<div class="bg-gray-900">
	<label for="customText" class="mb-2 block text-sm font-medium text-blue-500">Your Text</label>
	<textarea
		id="customText"
		bind:value={text}
		placeholder="Enter any text you want to encode"
		rows={4}
		class="w-full resize-none rounded-lg border border-gray-600 px-4 py-3 text-sm text-gray-100 focus:ring-2 focus:ring-black focus:outline-none"
	></textarea>
</div>
