<script lang="ts">
	import { isValidEmail, type EmailFields } from '$lib/encoders/email';

	let { fields = $bindable() }: { fields: EmailFields } = $props();

	const invalid = $derived(fields.to.trim() !== '' && !isValidEmail(fields.to));
</script>

<div class="space-y-4">
	<div>
		<label for="emailTo" class="mb-2 block text-sm font-medium text-blue-500">To*</label>
		<input
			type="email"
			id="emailTo"
			bind:value={fields.to}
			placeholder="name@example.com"
			autocomplete="email"
			class="h-10 w-full rounded-md border border-black bg-gray-700 px-4 text-sm text-gray-100 shadow-md focus:ring-2 focus:ring-black focus:outline-none"
			required
		/>
		{#if invalid}
			<p class="mt-1 text-xs text-red-400">That doesn't look like a valid email address.</p>
		{/if}
	</div>
	<div>
		<label for="emailSubject" class="mb-2 block text-sm font-medium text-blue-500">Subject</label>
		<input
			type="text"
			id="emailSubject"
			bind:value={fields.subject}
			class="h-10 w-full rounded-md border border-black bg-gray-700 px-4 text-sm text-gray-100 shadow-md focus:ring-2 focus:ring-black focus:outline-none"
		/>
	</div>
	<div>
		<label for="emailBody" class="mb-2 block text-sm font-medium text-blue-500">Body</label>
		<textarea
			id="emailBody"
			bind:value={fields.body}
			rows={3}
			class="w-full resize-none rounded-md border border-black bg-gray-700 px-4 py-3 text-sm text-gray-100 shadow-md focus:ring-2 focus:ring-black focus:outline-none"
		></textarea>
	</div>
</div>
