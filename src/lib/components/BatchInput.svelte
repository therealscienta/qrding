<script lang="ts">
	import type { BatchResult } from '$lib/batch';

	let {
		csvText = $bindable(),
		columns,
		example,
		result,
		onDownloadTemplate
	}: {
		csvText: string;
		columns: string[];
		example: string;
		result: BatchResult | null;
		onDownloadTemplate: () => void;
	} = $props();

	const MAX_SHOWN_ERRORS = 8;
	let fileError = $state('');

	async function handleFile(event: Event & { currentTarget: HTMLInputElement }) {
		const file = event.currentTarget.files?.[0];
		if (!file) return;
		try {
			csvText = await file.text();
			fileError = '';
		} catch {
			fileError = 'Could not read that file.';
		}
	}

	const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

	const summary = $derived(
		result
			? `${plural(result.items.length, 'code')} ready` +
					(result.errors.length ? ` · ${plural(result.errors.length, 'row')} skipped` : '')
			: ''
	);
</script>

<div class="space-y-3">
	<p class="text-xs text-gray-400">
		One code per row. Columns: <code class="text-gray-200">{columns.join(', ')}</code>. The first
		row can be a header; without one, columns are read in this order.
		<code class="text-gray-200">caption</code> is shown above the code and
		<code class="text-gray-200">filename</code> names its file.
	</p>
	<button
		type="button"
		onclick={onDownloadTemplate}
		class="text-xs text-blue-400 underline hover:text-blue-300"
	>
		Export CSV template
	</button>
	<div>
		<label for="csvFile" class="mb-2 block text-sm font-medium text-blue-500">CSV file</label>
		<input
			id="csvFile"
			type="file"
			accept=".csv,.tsv,.txt,text/csv,text/plain"
			onchange={handleFile}
			class="block w-full text-sm text-gray-400 file:mr-4 file:rounded-md file:border-0 file:bg-blue-600 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-blue-700"
		/>
		{#if fileError}
			<p class="mt-1 text-xs text-red-400">{fileError}</p>
		{/if}
	</div>
	<div>
		<label for="csvText" class="mb-2 block text-sm font-medium text-blue-500">…or paste rows</label>
		<textarea
			id="csvText"
			bind:value={csvText}
			rows={6}
			spellcheck="false"
			placeholder={example}
			class="w-full resize-y rounded-md border border-black bg-gray-700 px-3 py-2 font-mono text-xs text-gray-100 shadow-md focus:ring-2 focus:ring-black focus:outline-none"
		></textarea>
	</div>
	{#if result && csvText.trim()}
		<p class="text-sm text-gray-200" data-testid="batch-summary">{summary}</p>
		{#if result.ignoredColumns.length}
			<p class="text-xs text-yellow-400">Ignored columns: {result.ignoredColumns.join(', ')}</p>
		{/if}
		{#if result.errors.length}
			<ul class="space-y-0.5 text-xs text-red-400">
				{#each result.errors.slice(0, MAX_SHOWN_ERRORS) as error (error.row)}
					<li>Row {error.row}: {error.message}</li>
				{/each}
				{#if result.errors.length > MAX_SHOWN_ERRORS}
					<li>…and {result.errors.length - MAX_SHOWN_ERRORS} more</li>
				{/if}
			</ul>
		{/if}
	{/if}
</div>
