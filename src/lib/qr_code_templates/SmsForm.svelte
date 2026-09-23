<script lang="ts">
	import type { SmsFields } from '$lib/encoders/sms';

	let { fields = $bindable() }: { fields: SmsFields } = $props();
</script>

<div class="space-y-4">
	<div>
		<label for="smsPhone" class="mb-2 block text-sm font-medium text-blue-500">Phone Number*</label>
		<input
			type="tel"
			id="smsPhone"
			bind:value={fields.phone}
			placeholder="+46 70 123 45 67"
			autocomplete="tel"
			class="h-10 w-full rounded-md border border-black bg-gray-700 px-4 text-sm text-gray-100 shadow-md focus:ring-2 focus:ring-black focus:outline-none"
			required
		/>
	</div>
	<div>
		<label for="smsMessage" class="mb-2 block text-sm font-medium text-blue-500">Message</label>
		<textarea
			id="smsMessage"
			bind:value={fields.message}
			placeholder="Pre-filled message text"
			rows={3}
			class="w-full resize-none rounded-md border border-black bg-gray-700 px-4 py-3 text-sm text-gray-100 shadow-md focus:ring-2 focus:ring-black focus:outline-none"
		></textarea>
	</div>
</div>
