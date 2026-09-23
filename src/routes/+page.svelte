<script lang="ts">
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
	import { emptyWifi, encodeWifi, wifiFilename } from '$lib/encoders/wifi';
	import { emptyVCard, encodeVCard, vCardFilename } from '$lib/encoders/vcard';
	import { emptyVEvent, encodeVEvent, vEventFilename } from '$lib/encoders/vevent';
	import { emptyUrl, encodeUrl, urlFilename } from '$lib/encoders/url';
	import { emptySms, encodeSms, smsFilename } from '$lib/encoders/sms';
	import { emptyPhone, encodePhone, phoneFilename } from '$lib/encoders/phone';
	import { emptyEmail, encodeEmail, emailFilename } from '$lib/encoders/email';
	import { emptyGeo, encodeGeo, geoFilename } from '$lib/encoders/geo';
	import { toFilenamePart } from '$lib/filename';
	import { scanabilityWarning } from '$lib/color';
	import { canvasSize, drawQrCode } from '$lib/render';

	type Mode = 'text' | 'url' | 'wifi' | 'vcard' | 'calendar' | 'sms' | 'phone' | 'email' | 'geo';

	const modeOptions: { value: Mode; label: string }[] = [
		{ value: 'text', label: 'Text' },
		{ value: 'url', label: 'Link (URL)' },
		{ value: 'wifi', label: 'Wi-Fi Network' },
		{ value: 'vcard', label: 'Contact Card (VCard)' },
		{ value: 'calendar', label: 'Calendar Event' },
		{ value: 'sms', label: 'SMS' },
		{ value: 'phone', label: 'Phone Call' },
		{ value: 'email', label: 'Email' },
		{ value: 'geo', label: 'Location' }
	];

	let selectedModeValue = $state<Mode>('wifi');
	let qrTitle = $state('');

	// Each template keeps its own fields, so switching templates doesn't lose input.
	let text = $state('');
	let wifi = $state(emptyWifi());
	let vcard = $state(emptyVCard());
	let vevent = $state(emptyVEvent());
	let url = $state(emptyUrl());
	let sms = $state(emptySms());
	let phone = $state(emptyPhone());
	let email = $state(emptyEmail());
	let geo = $state(emptyGeo());

	let size = $state(256); // This is the size of the QR code graphic itself
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

	// Logo: decoded once on upload, then reused for every render.
	let logoBitmap = $state.raw<ImageBitmap | null>(null);
	let logoPreviewURL = $state('');
	let logoError = $state('');
	let logoInputRef = $state<HTMLInputElement | null>(null);
	let logoLoadId = 0; // Ignores a slow decode that finishes after a newer upload or a clear

	let canvas = $state<HTMLCanvasElement | null>(null);

	const currentModeLabel = $derived(
		modeOptions.find((opt) => opt.value === selectedModeValue)?.label
	);

	const payload = $derived.by(() => {
		switch (selectedModeValue) {
			case 'text':
				return text;
			case 'wifi':
				return encodeWifi(wifi);
			case 'vcard':
				return encodeVCard(vcard);
			case 'calendar':
				return encodeVEvent(vevent);
			case 'url':
				return encodeUrl(url);
			case 'sms':
				return encodeSms(sms);
			case 'phone':
				return encodePhone(phone);
			case 'email':
				return encodeEmail(email);
			case 'geo':
				return encodeGeo(geo);
		}
	});

	const filenameHint = $derived.by(() => {
		switch (selectedModeValue) {
			case 'text':
				return 'custom-text';
			case 'wifi':
				return wifiFilename(wifi);
			case 'vcard':
				return vCardFilename(vcard);
			case 'calendar':
				return vEventFilename(vevent);
			case 'url':
				return urlFilename(url);
			case 'sms':
				return smsFilename(sms);
			case 'phone':
				return phoneFilename(phone);
			case 'email':
				return emailFilename(email);
			case 'geo':
				return geoFilename(geo);
		}
	});

	// QRCode.create is synchronous and throws when the payload doesn't fit in a QR code.
	const qr = $derived.by(() => {
		if (!payload.trim()) return { code: null, error: '' };
		try {
			return { code: QRCode.create(payload, { errorCorrectionLevel }), error: '' };
		} catch (error) {
			return { code: null, error: error instanceof Error ? error.message : String(error) };
		}
	});

	const colorWarning = $derived(scanabilityWarning(darkColor, lightColor));
	const logoNeedsHigherCorrection = $derived(logoBitmap !== null && errorCorrectionSliderValue < 2);

	// Display size of the preview, matching the canvas drawn by drawQrCode.
	const imageSize = $derived(canvasSize(size, Boolean(qrTitle.trim())));

	$effect(() => {
		if (!canvas || !qr.code) return;
		drawQrCode(canvas, {
			qr: qr.code,
			size,
			title: qrTitle,
			dark: darkColor,
			light: lightColor,
			logo: logoBitmap
		});
	});

	function downloadQRCode() {
		if (!canvas || !qr.code) return;

		const baseFilename = toFilenamePart(qrTitle) || toFilenamePart(filenameHint) || 'qrcode';
		const filename = `${baseFilename}-${size}-${errorCorrectionLevel}${logoBitmap ? '-logo' : ''}-${Date.now()}.png`;

		// The PNG is only encoded here, not on every change.
		canvas.toBlob((blob) => {
			if (!blob) return;
			const url = URL.createObjectURL(blob);
			const link = document.createElement('a');
			link.download = filename;
			link.href = url;
			link.click();
			setTimeout(() => URL.revokeObjectURL(url), 0);
		}, 'image/png');
	}

	function setLogo(bitmap: ImageBitmap | null, previewURL: string) {
		logoBitmap?.close();
		if (logoPreviewURL) URL.revokeObjectURL(logoPreviewURL);
		logoBitmap = bitmap;
		logoPreviewURL = previewURL;
	}

	async function handleLogoUpload(event: Event & { currentTarget: HTMLInputElement }) {
		const file = event.currentTarget.files?.[0];
		const loadId = ++logoLoadId;
		logoError = '';
		if (!file) {
			setLogo(null, '');
			return;
		}
		try {
			const bitmap = await createImageBitmap(file);
			if (loadId !== logoLoadId) {
				bitmap.close();
				return;
			}
			setLogo(bitmap, URL.createObjectURL(file));
			// A logo covers modules in the middle of the code; L/M often can't recover from that.
			if (errorCorrectionSliderValue < 3) errorCorrectionSliderValue = 3;
		} catch {
			if (loadId !== logoLoadId) return;
			setLogo(null, '');
			logoError = 'Could not read that image.';
		}
	}

	function clearLogo() {
		logoLoadId++;
		logoError = '';
		setLogo(null, '');
		if (logoInputRef) {
			logoInputRef.value = ''; // Clear the file input
		}
	}
</script>

<svelte:head>
	<title>QRding – QR code generator</title>
	<meta
		name="description"
		content="Generate QR codes for Wi-Fi credentials, contact cards, calendar events and text, right in your browser."
	/>
</svelte:head>

<div class="flex min-h-screen items-center justify-center bg-gray-900 p-4 md:p-6 lg:p-8">
	<div class="fixed top-0 left-0 bg-gray-900 p-4 font-[Megrim] text-4xl text-blue-400">QRding</div>
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

				<!-- QR Code Title Input -->
				<div>
					<label for="qrTitle" class="mb-2 block text-sm font-medium text-blue-500"
						>QR Code Title (Optional)</label
					>
					<input
						type="text"
						id="qrTitle"
						bind:value={qrTitle}
						class="block w-full rounded-md border-gray-600 bg-gray-700 p-2.5 text-sm text-white placeholder-gray-400 shadow-sm focus:border-blue-500 focus:ring-blue-500"
						placeholder="Enter title (displays on image)"
					/>
				</div>

				<!-- Input Fields based on Mode -->
				{#if selectedModeValue === 'wifi'}
					<WifiForm bind:fields={wifi} />
				{:else if selectedModeValue === 'text'}
					<TextForm bind:text />
				{:else if selectedModeValue === 'vcard'}
					<VCardForm bind:fields={vcard} />
				{:else if selectedModeValue === 'calendar'}
					<CalendarEventForm bind:fields={vevent} />
				{:else if selectedModeValue === 'url'}
					<UrlForm bind:fields={url} />
				{:else if selectedModeValue === 'sms'}
					<SmsForm bind:fields={sms} />
				{:else if selectedModeValue === 'phone'}
					<PhoneForm bind:fields={phone} />
				{:else if selectedModeValue === 'email'}
					<EmailForm bind:fields={email} />
				{:else if selectedModeValue === 'geo'}
					<GeoForm bind:fields={geo} />
				{/if}

				<!-- Size Slider -->
				<div class="space-y-3">
					<div class="flex items-center justify-between">
						<span id="sizeLabel" class="text-sm font-medium text-blue-600">QR Size</span>
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
					{#if logoPreviewURL}
						<div class="mt-2 flex items-center gap-2">
							<img
								src={logoPreviewURL}
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
				<!-- QR Code Display Area: the canvas is the preview and the download source -->
				<div
					class="mx-auto rounded-lg border border-gray-600 bg-gray-800 p-4 shadow-lg"
					class:hidden={!qr.code}
					role="img"
					aria-label="Generated QR Code{qrTitle.trim()
						? ' with title: ' + qrTitle.trim()
						: ''}{logoBitmap ? ' and logo' : ''}"
					style="width: {imageSize.width + 32}px; height: {imageSize.height + 32}px;"
				>
					<canvas
						bind:this={canvas}
						class="block"
						style="width: {imageSize.width}px; height: {imageSize.height}px;"
					></canvas>
				</div>
				{#if !qr.code}
					<div
						class="mx-auto flex flex-col items-center justify-center rounded-lg border border-dashed border-gray-700 p-4 text-center"
						style="width: {imageSize.width + 32}px; height: {imageSize.height + 32}px;"
					>
						{#if qr.error}
							<p class="text-sm text-red-400">Can't create a QR code: {qr.error}</p>
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
							<p class="text-sm text-gray-500">QR code will appear here</p>
							<p class="text-xs text-gray-600">Configure options to generate</p>
						{/if}
					</div>
				{/if}

				<!-- Color Pickers and Download Button (only if QR code is visible) -->
				{#if qr.code}
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
					{#if colorWarning}
						<p class="max-w-xs text-center text-xs text-yellow-400">{colorWarning}</p>
					{/if}

					<Button.Root
						onclick={downloadQRCode}
						class="h-10 cursor-pointer rounded-lg bg-[#d9ff7a] px-6 text-sm font-medium text-gray-800 transition-colors hover:bg-[#bede68] data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50"
					>
						Download Image
					</Button.Root>
				{/if}
			</div>
		</div>
	</div>
</div>

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
