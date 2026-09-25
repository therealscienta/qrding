<script lang="ts">
	import type { VCardFields } from '$lib/encoders/vcard';

	let { fields = $bindable() }: { fields: VCardFields } = $props();
</script>

<div class="space-y-4">
	<p class="text-xs text-gray-400">Enter contact details. Full Name is required.</p>
	<div>
		<label for="vCardName" class="mb-2 block text-sm font-medium text-blue-500">Full Name*</label>
		<input
			type="text"
			id="vCardName"
			bind:value={fields.name}
			placeholder="John Doe"
			class="h-10 w-full rounded-md border border-black bg-gray-700 px-4 text-sm text-gray-100 shadow-md focus:ring-2 focus:ring-blue-700 focus:outline-none"
			required
		/>
	</div>
	<div>
		<label for="vCardPhone" class="mb-2 block text-sm font-medium text-blue-500">Phone Number</label
		>
		<input
			type="tel"
			id="vCardPhone"
			bind:value={fields.phone}
			placeholder="+1234567890"
			class="h-10 w-full rounded-md border border-black bg-gray-700 px-4 text-sm text-gray-100 shadow-md focus:ring-2 focus:ring-black focus:outline-none"
		/>
	</div>
	<div>
		<label for="vCardEmail" class="mb-2 block text-sm font-medium text-blue-500"
			>Email Address</label
		>
		<input
			type="email"
			id="vCardEmail"
			bind:value={fields.email}
			placeholder="john.doe@example.com"
			class="h-10 w-full rounded-md border border-black bg-gray-700 px-4 text-sm text-gray-100 shadow-md focus:ring-2 focus:ring-black focus:outline-none"
		/>
	</div>
	<div>
		<label for="vCardOrg" class="mb-2 block text-sm font-medium text-blue-500">Organization</label>
		<input
			type="text"
			id="vCardOrg"
			bind:value={fields.org}
			placeholder="ACME Corp"
			class="h-10 w-full rounded-md border border-black bg-gray-700 px-4 text-sm text-gray-100 shadow-md focus:ring-2 focus:ring-black focus:outline-none"
		/>
	</div>
	<div>
		<label for="vCardTitle" class="mb-2 block text-sm font-medium text-blue-500">Job Title</label>
		<input
			type="text"
			id="vCardTitle"
			bind:value={fields.title}
			placeholder="Software Engineer"
			class="h-10 w-full rounded-md border border-black bg-gray-700 px-4 text-sm text-gray-100 shadow-md focus:ring-2 focus:ring-black focus:outline-none"
		/>
	</div>
	<!-- Address Fields -->
	<div class="pt-2">
		<label for="vCardStreet" class="mb-2 block text-sm font-medium text-blue-500">Address</label>
		<input
			type="text"
			id="vCardStreet"
			bind:value={fields.street}
			placeholder="Street Address (e.g., 123 Main St)"
			class="mb-2 h-10 w-full rounded-lg border border-black bg-gray-700 px-4 text-sm text-gray-100 focus:ring-2 focus:ring-black focus:outline-none"
		/>
		<input
			type="text"
			bind:value={fields.city}
			placeholder="City (e.g., Anytown)"
			class="mb-2 h-10 w-full rounded-md border border-black bg-gray-700 px-4 text-sm text-gray-100 shadow-md focus:ring-2 focus:ring-black focus:outline-none"
		/>
		<div class="grid grid-cols-2 gap-x-2">
			<input
				type="text"
				bind:value={fields.region}
				placeholder="State/Province"
				class="h-10 w-full rounded-md border border-black bg-gray-700 px-4 text-sm text-gray-100 shadow-md focus:ring-2 focus:ring-black focus:outline-none"
			/>
			<input
				type="text"
				bind:value={fields.zip}
				placeholder="Zip/Postal Code"
				class="h-10 w-full rounded-md border border-black bg-gray-700 px-4 text-sm text-gray-100 shadow-md focus:ring-2 focus:ring-black focus:outline-none"
			/>
		</div>
		<input
			type="text"
			bind:value={fields.country}
			placeholder="Country (e.g., USA)"
			class="mt-2 h-10 w-full rounded-md border border-black bg-gray-700 px-4 text-sm text-gray-100 shadow-md focus:ring-2 focus:ring-black focus:outline-none"
		/>
	</div>
	<div>
		<label for="vCardWebsite" class="mb-2 block text-sm font-medium text-blue-500">Website</label>
		<input
			type="url"
			id="vCardWebsite"
			bind:value={fields.website}
			placeholder="https://example.com"
			class="h-10 w-full rounded-md border border-black bg-gray-700 px-4 text-sm text-gray-100 shadow-md focus:ring-2 focus:ring-black focus:outline-none"
		/>
	</div>
	<div>
		<label for="vCardNote" class="mb-2 block text-sm font-medium text-blue-500">Note</label>
		<textarea
			id="vCardNote"
			bind:value={fields.note}
			placeholder="Additional notes"
			rows={3}
			class="w-full resize-none rounded-md border border-black bg-gray-700 px-4 py-3 text-sm text-gray-100 shadow-md focus:ring-2 focus:ring-black focus:outline-none"
		></textarea>
	</div>
</div>
