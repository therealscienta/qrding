<script lang="ts">
	import { endsBeforeStart, type VEventFields } from '$lib/encoders/vevent';

	let { fields = $bindable() }: { fields: VEventFields } = $props();
</script>

<div class="space-y-4">
	<div>
		<label for="eventTitle" class="mb-2 block text-sm font-medium text-blue-500">Event Title*</label
		>
		<input
			type="text"
			id="eventTitle"
			bind:value={fields.title}
			placeholder="e.g., Team Meeting"
			class="h-10 w-full rounded-md border border-black bg-gray-700 px-4 text-sm text-gray-100 shadow-md focus:ring-2 focus:ring-black focus:outline-none"
			required
		/>
	</div>
	<div>
		<label for="eventDTStart" class="mb-2 block text-sm font-medium text-blue-500"
			>Start Date & Time*</label
		>
		<input
			type="datetime-local"
			id="eventDTStart"
			bind:value={fields.start}
			class="h-10 w-full rounded-md border border-black bg-gray-700 px-4 text-sm text-gray-100 shadow-md focus:ring-2 focus:ring-black focus:outline-none"
			required
		/>
	</div>
	<div>
		<label for="eventDTEnd" class="mb-2 block text-sm font-medium text-blue-500"
			>End Date & Time*</label
		>
		<input
			type="datetime-local"
			id="eventDTEnd"
			bind:value={fields.end}
			class="h-10 w-full rounded-md border border-black bg-gray-700 px-4 text-sm text-gray-100 shadow-md focus:ring-2 focus:ring-black focus:outline-none"
			required
		/>
	</div>
	<div>
		<label for="eventLocation" class="mb-2 block text-sm font-medium text-blue-500">Location</label>
		<input
			type="text"
			id="eventLocation"
			bind:value={fields.location}
			placeholder="e.g., Conference Room 1"
			class="h-10 w-full rounded-md border border-black bg-gray-700 px-4 text-sm text-gray-100 shadow-md focus:ring-2 focus:ring-black focus:outline-none"
		/>
	</div>
	{#if endsBeforeStart(fields)}
		<p class="text-xs text-red-400">The end must be after the start.</p>
	{/if}
	<p class="text-xs text-gray-400">* Mandatory fields. Browser will prompt for YYYY-MM-DDTHH:MM.</p>
</div>
