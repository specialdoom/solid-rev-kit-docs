import path from 'path';
import { defineConfig } from 'vite';
import solidPlugin from 'vite-plugin-solid';

export default defineConfig({
	plugins: [solidPlugin()],
	build: {
		target: 'esnext',
		outDir: 'public',
		emptyOutDir: false,
	}
});
