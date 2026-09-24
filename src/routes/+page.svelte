<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { Select } from 'bits-ui';
	import { Button } from 'bits-ui';
	import { Slider } from 'bits-ui';
	import QRCode from 'qrcode';
	import type { QRCodeErrorCorrectionLevel } from 'qrcode';
	import TextForm from '$lib/qr_code_templates/TextForm.svelte';
	import WifiForm from '$lib/qr_code_templates/WifiForm.svelte';
	import VCardForm from '$lib/qr_code_templates/VCardForm.svelte';
	import CalendarEventForm from '$lib/qr_code_templates/CalendarEventForm.svelte';
	import UrlForm from '$lib/qr_code_templates/UrlForm.svelte';
	import SmsForm from '$lib/qr_code_templates/SmsForm.svelte';
	import PhoneForm from '$lib/qr_code_templates/PhoneForm.svelte';
	import EmailForm from '$lib/qr_code_templates/EmailForm.svelte';
	import GeoForm from '$lib/qr_code_templates/GeoForm.svelte';
	import SegmentedControl from '$lib/components/SegmentedControl.svelte';
	import BatchInput from '$lib/components/BatchInput.svelte';
	import { emptyFields, encodeFor, filenameFor, modes, templates, type Mode } from '$lib/templates';
	import { batchColumns, csvTemplate, parseBatch, type BatchError } from '$lib/batch';
	import { exportZip, sheetImages, type BatchProgress, type BatchStyle } from '$lib/batchExport';
	import {
		canCopyImages,
		canvasToPng,
		copyPng,
		downloadBlob,
		loadLogo,
		measureTitle,
		mmAtPrintDpi,
		PRINT_DPI,
		renderCanvas,
		type Logo
	} from '$lib/export';
	import { toFilenamePart } from '$lib/filename';
	import { scanabilityWarning } from '$lib/color';
	import { canvasLayout, drawQrCode, type RenderOptions } from '$lib/render';
	import { buildSvg } from '$lib/svg';
	import { loadDecoder, readsBack } from '$lib/verify';

	const modeOptions = modes.map((mode) => ({ value: mode, label: templates[mode].label }));

	let selectedModeValue = $state<Mode>('wifi');
	let generation = $state<'single' | 'batch'>('single');
	let qrTitle = $state('');

	// Each template keeps its own fields, so switching templates doesn't lose input.
	const fields = $state(emptyFields());
	let csvText = $state('');

	let size = $state(256); // Image width in px: the code plus its quiet zone
	let darkColor = $state('#000000');
	let lightColor = $state('#ffffff');

	// Error Correction Level
	let errorCorrectionSliderValue = $state(1); // 0: L, 1: M, 2: Q, 3: H. Default to M (15%)
	const errorCorrectionLevels: QRCodeErrorCorrectionLevel[] = ['L', 'M', 'Q', 'H'];
	const errorCorrectionLabels = ['L (7%)', 'M (15%)', 'Q (25%)', 'H (30%)'];

	let errorCorrectionLevel = $derived(errorCorrectionLevels[errorCorrectionSliderValue]);
	let currentErrorCorrectionDisplayLabel = $derived(
		errorCorrectionLabels[errorCorrectionSliderValue]
	);

	// Logo: decoded once on upload, then reused for every render and export.
	let logo = $state.raw<Logo | null>(null);
	let logoError = $state('');
	let logoInputRef = $state<HTMLInputElement | null>(null);
	let logoLoadId = 0; // Ignores a slow decode that finishes after a newer upload or a clear

	// Export
	let format = $state<'png' | 'svg'>('png');
	let pngScale = $state(1);
	const PNG_SCALES = [1, 2, 4, 8];
	let canCopy = $state(false);
	let copyStatus = $state<{ ok: boolean; message: string } | null>(null);
	let copyStatusTimer: ReturnType<typeof setTimeout> | undefined;

	// Batch
	let printWidthMm = $state(30);
	let batchProgress = $state<BatchProgress | null>(null);
	let batchReport = $state<{ message: string; failures: BatchError[] } | null>(null);
	let sheet = $state<{ key: string; src: string }[]>([]);

	let canvas = $state<HTMLCanvasElement | null>(null);

	onMount(() => {
		canCopy = canCopyImages();
	});

	const isBatch = $derived(generation === 'batch');
	const currentModeLabel = $derived(templates[selectedModeValue].label);

	const payload = $derived(encodeFor(selectedModeValue, fields[selectedModeValue]));
	const filenameHint = $derived(filenameFor(selectedModeValue, fields[selectedModeValue]));

	const batch = $derived(
		isBatch ? parseBatch(selectedModeValue, csvText, errorCorrectionLevel) : null
	);
	// Rows without a caption use the title field as a default caption.
	const batchItems = $derived(
		batch?.items.map((item) => ({ ...item, caption: item.caption || qrTitle.trim() })) ?? []
	);

	// What the preview shows: the single code, or the first code of the batch.
	// QRCode.create is synchronous and throws when the payload doesn't fit in a QR code.
	const preview = $derived.by(() => {
		if (isBatch) {
			const item = batchItems[0];
			return {
				payload: item?.payload ?? '',
				title: item?.caption ?? '',
				code: item?.qr ?? null,
				error: ''
			};
		}
		if (!payload.trim()) return { payload, title: qrTitle, code: null, error: '' };
		try {
			const code = QRCode.create(payload, { errorCorrectionLevel });
			return { payload, title: qrTitle, code, error: '' };
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			return { payload, title: qrTitle, code: null, error: message };
		}
	});

	const colorWarning = $derived(scanabilityWarning(darkColor, lightColor));
	const logoNeedsHigherCorrection = $derived(logo !== null && errorCorrectionSliderValue < 2);

	// Display size of the preview, matching the canvas drawn by drawQrCode.
	// Before there's a code, assume the smallest QR version (21 modules) for the placeholder.
	const imageSize = $derived(
		canvasLayout(size, preview.code?.modules.size ?? 21, Boolean(preview.title.trim()))
	);

	const pngScaleOptions = $derived(
		PNG_SCALES.map((scale) => ({
			value: scale,
			label: `${scale}× · ${size * scale} px · ${Math.round(mmAtPrintDpi(size * scale))} mm at ${PRINT_DPI} DPI`
		}))
	);

	// Result of reading the rendered image back with a test decoder.
	let scanCheck = $state<'checking' | 'ok' | 'fail'>('checking');

	$effect(() => {
		if (!canvas || !preview.code) return;
		drawQrCode(canvas, {
			qr: preview.code,
			size,
			title: preview.title,
			dark: darkColor,
			light: lightColor,
			logo: logo?.bitmap ?? null
		});

		// Decoding takes tens of ms, so wait until typing or dragging pauses.
		const target = canvas;
		const expected = preview.payload;
		let cancelled = false;
		scanCheck = 'checking';
		const timer = setTimeout(async () => {
			const decode = await loadDecoder();
			if (cancelled) return;
			const ctx = target.getContext('2d');
			if (!ctx) return;
			const image = ctx.getImageData(0, 0, target.width, target.height);
			scanCheck = readsBack(decode, image, expected) ? 'ok' : 'fail';
		}, 300);
		return () => {
			cancelled = true;
			clearTimeout(timer);
		};
	});

	function renderOptions(scale: number): RenderOptions | null {
		if (!preview.code) return null;
		return {
			qr: preview.code,
			size,
			title: preview.title,
			dark: darkColor,
			light: lightColor,
			logo: logo?.bitmap ?? null,
			scale
		};
	}

	function exportFilename(extension: string, widthPx: number) {
		const baseFilename = toFilenamePart(qrTitle) || toFilenamePart(filenameHint) || 'qrcode';
		return `${baseFilename}-${widthPx}-${errorCorrectionLevel}${logo ? '-logo' : ''}-${Date.now()}.${extension}`;
	}

	async function downloadQRCode() {
		const opts = renderOptions(pngScale);
		if (!opts) return;
		if (format === 'svg') {
			const svg = buildSvg({
				...opts,
				logo: logo && { href: logo.dataUrl, width: logo.bitmap.width, height: logo.bitmap.height },
				titleWidth: measureTitle(opts.title)
			});
			downloadBlob(new Blob([svg], { type: 'image/svg+xml' }), exportFilename('svg', size));
		} else {
			// The PNG is only encoded here, not on every change.
			const png = await canvasToPng(renderCanvas(opts));
			downloadBlob(png, exportFilename('png', size * pngScale));
		}
	}

	function showCopyStatus(ok: boolean, message: string) {
		copyStatus = { ok, message };
		clearTimeout(copyStatusTimer);
		copyStatusTimer = setTimeout(() => (copyStatus = null), 3000);
	}

	function copyImage() {
		const opts = renderOptions(pngScale);
		if (!opts) return;
		copyPng(canvasToPng(renderCanvas(opts))).then(
			() => showCopyStatus(true, 'Copied to the clipboard'),
			(error) =>
				showCopyStatus(false, `Couldn't copy: ${error instanceof Error ? error.message : error}`)
		);
	}

	function downloadCsvTemplate() {
		const blob = new Blob([csvTemplate(selectedModeValue)], { type: 'text/csv' });
		downloadBlob(blob, `qrding-${selectedModeValue}-template.csv`);
	}

	const batchStyle = (): BatchStyle => ({
		size,
		dark: darkColor,
		light: lightColor,
		logo,
		format,
		pngScale
	});

	const failureSummary = (failures: BatchError[]) =>
		failures.length ? ` ${failures.length} failed the scan check.` : ' All passed the scan check.';

	async function runBatch(task: () => Promise<string>) {
		if (batchProgress || !batchItems.length) return;
		batchReport = null;
		batchProgress = { done: 0, total: batchItems.length };
		try {
			await task();
		} catch (error) {
			batchReport = {
				message: `Export failed: ${error instanceof Error ? error.message : error}`,
				failures: []
			};
		} finally {
			batchProgress = null;
		}
	}

	const downloadZip = () =>
		runBatch(async () => {
			const { zip, failures } = await exportZip(
				batchItems,
				batchStyle(),
				(p) => (batchProgress = p)
			);
			downloadBlob(zip, `qrding-${selectedModeValue}-${batchItems.length}-codes.zip`);
			const message = `Downloaded ${batchItems.length} ${format.toUpperCase()} files.${failureSummary(failures)}`;
			batchReport = { message, failures };
			return message;
		});

	const printSheet = () =>
		runBatch(async () => {
			const { images, failures } = await sheetImages(
				batchItems,
				batchStyle(),
				(p) => (batchProgress = p)
			);
			sheet = images;
			await tick();
			const sheetImgs = document.querySelectorAll<HTMLImageElement>(
				'[data-testid="print-sheet"] img'
			);
			await Promise.all([...sheetImgs].map((img) => img.decode().catch(() => undefined)));
			const message = `Opened the print dialog for ${images.length} codes.${failureSummary(failures)}`;
			batchReport = { message, failures };
			window.print();
			return message;
		});

	function setLogo(next: Logo | null) {
		logo?.bitmap.close();
		if (logo) URL.revokeObjectURL(logo.previewUrl);
		logo = next;
	}

	async function handleLogoUpload(event: Event & { currentTarget: HTMLInputElement }) {
		const file = event.currentTarget.files?.[0];
		const loadId = ++logoLoadId;
		logoError = '';
		if (!file) {
			setLogo(null);
			return;
		}
		try {
			const loaded = await loadLogo(file);
			if (loadId !== logoLoadId) {
				loaded.bitmap.close();
				URL.revokeObjectURL(loaded.previewUrl);
				return;
			}
			setLogo(loaded);
			// A logo covers modules in the middle of the code; L/M often can't recover from that.
			if (errorCorrectionSliderValue < 3) errorCorrectionSliderValue = 3;
		} catch {
			if (loadId !== logoLoadId) return;
			setLogo(null);
			logoError = 'Could not read that image.';
		}
	}

	function clearLogo() {
		logoLoadId++;
		logoError = '';
		setLogo(null);
		if (logoInputRef) {
			logoInputRef.value = ''; // Clear the file input
		}
	}
</script>

<svelte:head>
	<title>QRding – QR code generator</title>
	<meta
		name="description"
		content="Generate QR codes for Wi-Fi credentials, contact cards, calendar events, links and more, right in your browser."
	/>
</svelte:head>

<div
	class="relative flex min-h-screen items-center justify-center bg-gray-900 px-4 pt-20 pb-4 md:px-6 md:pb-6 lg:px-8 lg:pb-8 print:hidden"
>
	<!-- In the top padding and scrolls with the page, so it never covers the controls -->
	<div class="absolute top-0 left-0 p-4 font-[Megrim] text-4xl text-blue-400">QRding</div>
	<div class="w-full max-w-[1080px] bg-gray-900">
		<div class="flex flex-col items-center gap-8 lg:flex-row lg:items-center">
			<!-- Left Section -->
			<div class="w-full max-w-md space-y-6 lg:w-[350px] lg:flex-none">
				<!-- Mode Selector -->
				<div>
					<label for="template" class="mb-2 block text-sm font-medium text-blue-500">Template</label
					>
					<Select.Root type="single" bind:value={selectedModeValue}>
						<Select.Trigger
							id="template"
							class="flex h-10 w-full items-center justify-between rounded-md bg-[#d9ff7a] px-4 text-sm font-medium shadow-sm transition-colors hover:bg-[#bede68]"
						>
							<span>{currentModeLabel}</span>
							<svg width="16" height="16" viewBox="0 0 16 16" fill="none">
								<path
									d="M4 6L8 10L12 6"
									stroke="currentColor"
									stroke-width="2"
									stroke-linecap="round"
									stroke-linejoin="round"
								/>
							</svg>
						</Select.Trigger>
						<Select.Portal>
							<Select.Content
								class="z-50 overflow-hidden rounded-lg border border-black bg-gray-700 text-gray-200 shadow-lg"
								sideOffset={10}
							>
								<Select.Viewport class="p-1">
									{#each modeOptions as option (option.value)}
										<Select.Item
											value={option.value}
											class="cursor-pointer rounded px-4 py-2 text-sm hover:bg-gray-100 data-[highlighted]:bg-gray-800"
										>
											{option.label}
										</Select.Item>
									{/each}
								</Select.Viewport>
							</Select.Content>
						</Select.Portal>
					</Select.Root>
				</div>

				<SegmentedControl
					legend="Codes"
					name="generation"
					bind:value={generation}
					options={[
						{ value: 'single', label: 'Single code' },
						{ value: 'batch', label: 'Batch (CSV)' }
					]}
				/>

				<!-- QR Code Title Input -->
				<div>
					<label for="qrTitle" class="mb-2 block text-sm font-medium text-blue-500"
						>{isBatch ? 'Default Caption (Optional)' : 'QR Code Title (Optional)'}</label
					>
					<input
						type="text"
						id="qrTitle"
						bind:value={qrTitle}
						class="block w-full rounded-md border-gray-600 bg-gray-700 p-2.5 text-sm text-white placeholder-gray-400 shadow-sm focus:border-blue-500 focus:ring-blue-500"
						placeholder={isBatch
							? 'Used for rows without a caption'
							: 'Enter title (displays on image)'}
					/>
				</div>

				<!-- Input Fields based on Mode -->
				{#if isBatch}
					<BatchInput
						bind:csvText
						columns={batchColumns(selectedModeValue)}
						example={csvTemplate(selectedModeValue)}
						result={batch}
						onDownloadTemplate={downloadCsvTemplate}
					/>
				{:else if selectedModeValue === 'wifi'}
					<WifiForm bind:fields={fields.wifi} />
				{:else if selectedModeValue === 'text'}
					<TextForm bind:fields={fields.text} />
				{:else if selectedModeValue === 'vcard'}
					<VCardForm bind:fields={fields.vcard} />
				{:else if selectedModeValue === 'calendar'}
					<CalendarEventForm bind:fields={fields.calendar} />
				{:else if selectedModeValue === 'url'}
					<UrlForm bind:fields={fields.url} />
				{:else if selectedModeValue === 'sms'}
					<SmsForm bind:fields={fields.sms} />
				{:else if selectedModeValue === 'phone'}
					<PhoneForm bind:fields={fields.phone} />
				{:else if selectedModeValue === 'email'}
					<EmailForm bind:fields={fields.email} />
				{:else if selectedModeValue === 'geo'}
					<GeoForm bind:fields={fields.geo} />
				{/if}

				<!-- Size Slider -->
				<div class="space-y-3">
					<div class="flex items-center justify-between">
						<span id="sizeLabel" class="text-sm font-medium text-blue-600">Image Size</span>
						<span class="text-sm font-medium text-blue-400">{size}px</span>
					</div>
					<Slider.Root
						bind:value={size}
						min={128}
						max={512}
						step={32}
						type="single"
						class="relative flex h-5 w-full touch-none items-center select-none"
					>
						<span
							class="relative h-2 w-full grow cursor-pointer overflow-hidden rounded-full bg-gray-600"
						>
							<Slider.Range class="absolute h-full bg-blue-500" />
						</span>
						<Slider.Thumb
							index={0}
							aria-labelledby="sizeLabel"
							class="block h-4 w-4 cursor-pointer rounded-full border-2 border-black bg-white shadow-sm transition-shadow hover:shadow-md focus:ring-2 focus:ring-black focus:ring-offset-2 focus:outline-none"
						/>
					</Slider.Root>
				</div>

				<!-- Error Correction Level Slider -->
				<div class="space-y-3">
					<div class="flex items-center justify-between">
						<span id="errorCorrectionLabel" class="text-sm font-medium text-blue-600"
							>Error Correction</span
						>
						<span class="text-sm font-medium text-blue-400"
							>{currentErrorCorrectionDisplayLabel}</span
						>
					</div>
					<Slider.Root
						bind:value={errorCorrectionSliderValue}
						min={0}
						max={3}
						step={1}
						type="single"
						class="relative flex h-5 w-full touch-none items-center select-none"
					>
						<span
							class="relative h-2 w-full grow cursor-pointer overflow-hidden rounded-full bg-gray-600"
						>
							<Slider.Range class="absolute h-full bg-blue-500" />
						</span>
						<Slider.Thumb
							index={0}
							aria-labelledby="errorCorrectionLabel"
							class="block h-4 w-4 cursor-pointer rounded-full border-2 border-black bg-white shadow-sm transition-shadow hover:shadow-md focus:ring-2 focus:ring-black focus:ring-offset-2 focus:outline-none"
						/>
					</Slider.Root>
					{#if logoNeedsHigherCorrection}
						<p class="text-xs text-yellow-400">
							With a logo, use Q or H. Lower levels may make the code unscannable.
						</p>
					{/if}
				</div>

				<!-- Logo Upload -->
				<div class="space-y-3">
					<label for="logoInput" class="mb-2 block text-sm font-medium text-blue-500"
						>Logo (Optional)</label
					>
					<input
						id="logoInput"
						bind:this={logoInputRef}
						type="file"
						accept="image/*"
						onchange={handleLogoUpload}
						class="block w-full text-sm text-gray-400 file:mr-4 file:rounded-md file:border-0 file:bg-blue-600 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-blue-700"
					/>
					{#if logoError}
						<p class="text-xs text-red-400">{logoError}</p>
					{/if}
					{#if logo}
						<div class="mt-2 flex items-center gap-2">
							<img
								src={logo.previewUrl}
								alt="Logo preview"
								class="h-10 w-10 rounded border border-gray-600 object-contain"
							/>
							<Button.Root
								onclick={clearLogo}
								class="rounded bg-red-600 px-3 py-1 text-xs text-white hover:bg-red-700"
								>Clear Logo</Button.Root
							>
						</div>
					{/if}
				</div>
			</div>

			<!-- Right Section: QR Code Display and Actions -->
			<div
				class="mx-auto flex w-full max-w-[584px] flex-col items-center justify-center space-y-6 lg:w-auto lg:flex-none"
			>
				<!-- QR Code Display Area: the canvas is the preview (and, in batch mode, shows the first row) -->
				<div
					class="mx-auto rounded-lg border border-gray-600 bg-gray-800 p-4 shadow-lg"
					class:hidden={!preview.code}
					role="img"
					aria-label="Generated QR Code{preview.title.trim()
						? ' with title: ' + preview.title.trim()
						: ''}{logo ? ' and logo' : ''}"
					style="width: {imageSize.width + 32}px; height: {imageSize.height + 32}px;"
				>
					<canvas
						bind:this={canvas}
						class="block"
						style="width: {imageSize.width}px; height: {imageSize.height}px;"
					></canvas>
				</div>
				{#if !preview.code}
					<div
						class="mx-auto flex flex-col items-center justify-center rounded-lg border border-dashed border-gray-700 p-4 text-center"
						style="width: {imageSize.width + 32}px; height: {imageSize.height + 32}px;"
					>
						{#if preview.error}
							<p class="text-sm text-red-400">Can't create a QR code: {preview.error}</p>
							<p class="text-xs text-gray-600">
								Shorten the content or lower the error correction.
							</p>
						{:else}
							<svg
								class="mb-2 h-12 w-12 text-gray-600"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
								stroke-width="1"
							>
								<path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
								<path stroke-linecap="round" stroke-linejoin="round" d="M7 7h10v10H7z" />
							</svg>
							<p class="text-sm text-gray-500">
								{isBatch
									? 'The first code of the batch will appear here'
									: 'QR code will appear here'}
							</p>
							<p class="text-xs text-gray-600">
								{isBatch ? 'Add rows to generate codes' : 'Configure options to generate'}
							</p>
						{/if}
					</div>
				{/if}

				<!-- Colors, scan check and export (only if QR code is visible) -->
				{#if preview.code}
					<div
						class="qr-color-inputs flex flex-wrap items-center justify-center gap-4"
						style="max-width: {imageSize.width + 32}px;"
					>
						<label class="flex items-center text-sm text-blue-500">
							<span class="mr-2">Dark Color:</span>
							<input
								type="color"
								bind:value={darkColor}
								class="h-8 w-8 cursor-pointer rounded border border-blue-600 bg-gray-700 p-0"
							/>
						</label>
						<label class="flex items-center text-sm text-blue-500">
							<span class="mr-2">Light Color:</span>
							<input
								type="color"
								bind:value={lightColor}
								class="h-8 w-8 cursor-pointer rounded border border-blue-600 bg-gray-700 p-0"
							/>
						</label>
					</div>
					<p
						class="text-center text-xs"
						class:text-green-400={scanCheck === 'ok'}
						class:text-red-400={scanCheck === 'fail'}
						class:text-gray-500={scanCheck === 'checking'}
						data-testid="scan-check"
						data-state={scanCheck}
						aria-live="polite"
					>
						{#if scanCheck === 'ok'}
							✓ Verified: a test scanner reads this code correctly.
						{:else if scanCheck === 'fail'}
							⚠ A test scanner couldn't read this code. Try higher contrast, a smaller logo or
							higher error correction.
						{:else}
							Checking scannability…
						{/if}
					</p>
					{#if colorWarning}
						<p class="max-w-xs text-center text-xs text-yellow-400">{colorWarning}</p>
					{/if}

					<div class="flex w-full max-w-sm flex-col items-center gap-4">
						<div class="flex flex-wrap items-end justify-center gap-4">
							<SegmentedControl
								legend="Format"
								name="format"
								bind:value={format}
								options={[
									{ value: 'png', label: 'PNG' },
									{ value: 'svg', label: 'SVG (vector)' }
								]}
							/>
							{#if format === 'png'}
								<div>
									<label for="pngScale" class="mb-2 block text-sm font-medium text-blue-500"
										>PNG size</label
									>
									<select
										id="pngScale"
										bind:value={pngScale}
										class="h-9 rounded-md border border-gray-600 bg-gray-700 px-2 text-sm text-gray-100"
									>
										{#each pngScaleOptions as option (option.value)}
											<option value={option.value}>{option.label}</option>
										{/each}
									</select>
								</div>
							{/if}
						</div>

						{#if isBatch}
							<div class="flex flex-wrap items-center justify-center gap-3">
								<Button.Root
									onclick={downloadZip}
									disabled={batchProgress !== null}
									class="h-10 cursor-pointer rounded-lg bg-[#d9ff7a] px-6 text-sm font-medium text-gray-800 transition-colors hover:bg-[#bede68] data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50"
								>
									Download ZIP ({batchItems.length})
								</Button.Root>
								<Button.Root
									onclick={printSheet}
									disabled={batchProgress !== null}
									class="h-10 cursor-pointer rounded-lg border border-[#d9ff7a] px-4 text-sm font-medium text-[#d9ff7a] transition-colors hover:bg-gray-800 data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50"
								>
									Print sheet
								</Button.Root>
								<label class="flex items-center gap-2 text-sm text-blue-500">
									Code width
									<input
										type="number"
										min="10"
										max="200"
										bind:value={printWidthMm}
										class="h-9 w-16 rounded-md border border-gray-600 bg-gray-700 px-2 text-sm text-gray-100"
									/>
									mm
								</label>
							</div>
							<div class="text-center text-xs" aria-live="polite" data-testid="batch-status">
								{#if batchProgress}
									<p class="text-gray-400">
										Rendering and checking {batchProgress.done}/{batchProgress.total}…
									</p>
								{:else if batchReport}
									<p
										class:text-green-400={!batchReport.failures.length}
										class:text-yellow-400={batchReport.failures.length > 0}
									>
										{batchReport.message}
									</p>
									{#if batchReport.failures.length}
										<p class="text-red-400">
											Rows that failed: {batchReport.failures.map((f) => f.row).join(', ')}
										</p>
									{/if}
								{/if}
							</div>
						{:else}
							<div class="flex flex-wrap items-center justify-center gap-3">
								<Button.Root
									onclick={downloadQRCode}
									class="h-10 cursor-pointer rounded-lg bg-[#d9ff7a] px-6 text-sm font-medium text-gray-800 transition-colors hover:bg-[#bede68] data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50"
								>
									Download {format.toUpperCase()}
								</Button.Root>
								{#if canCopy}
									<Button.Root
										onclick={copyImage}
										class="h-10 cursor-pointer rounded-lg border border-[#d9ff7a] px-4 text-sm font-medium text-[#d9ff7a] transition-colors hover:bg-gray-800"
									>
										Copy image
									</Button.Root>
								{/if}
							</div>
							<p
								class="min-h-4 text-center text-xs"
								class:text-green-400={copyStatus?.ok}
								class:text-red-400={copyStatus && !copyStatus.ok}
								aria-live="polite"
							>
								{copyStatus?.message ?? ''}
							</p>
						{/if}
					</div>
				{/if}
			</div>
		</div>
	</div>
</div>

<!-- Print sheet: hidden on screen, the only thing printed. SVGs keep the codes sharp. -->
{#if sheet.length}
	<div
		data-testid="print-sheet"
		class="hidden print:grid"
		style="grid-template-columns: repeat(auto-fill, {printWidthMm}mm); gap: 6mm;"
	>
		{#each sheet as image (image.key)}
			<img src={image.src} alt="" class="break-inside-avoid" style="width: {printWidthMm}mm;" />
		{/each}
	</div>
{/if}

<style>
	/* Make color input clickable area cover the preview box better */
	input[type='color']::-webkit-color-swatch-wrapper {
		padding: 0;
	}
	input[type='color']::-webkit-color-swatch {
		border: none;
		border-radius: 0.25rem; /* Match rounded */
	}
	input[type='color']::-moz-color-swatch {
		border: none;
		border-radius: 0.25rem; /* Match rounded */
	}
</style>
