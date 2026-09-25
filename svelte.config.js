import adapterNode from '@sveltejs/adapter-node';
import adapterStatic from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

// The Docker image (adapter-node) and the Tauri desktop build (adapter-static, no
// server to run) need different output. `npm run build` defaults to adapter-node;
// `npm run build:tauri` sets TAURI_BUILD=true to switch it, see src-tauri/tauri.conf.json.
// No fallback: the app is a single prerendered route, so index.html already covers it.
const adapter = process.env.TAURI_BUILD === 'true' ? adapterStatic() : adapterNode();

/** @type {import('@sveltejs/kit').Config} */
const config = {
	// Consult https://svelte.dev/docs/kit/integrations
	// for more information about preprocessors
	preprocess: vitePreprocess(),

	kit: {
		// adapter-auto only supports some environments, see https://svelte.dev/docs/kit/adapter-auto for a list.
		// If your environment is not supported, or you settled on a specific environment, switch out the adapter.
		// See https://svelte.dev/docs/kit/adapters for more information about adapters.
		adapter
	}
};

export default config;
