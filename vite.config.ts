import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	test: {
		// Browser tests in tests/ are run by Playwright, not Vitest.
		include: ['src/**/*.test.ts']
	}
});
