/** Local demo dev server. Not part of `sanity build` and never deployed. */
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  plugins: [react()],
  server: {
    port: 3334,
    strictPort: true,
    host: '127.0.0.1',
    // Allow ../admin-tracker and ../../docs/launch-checklist.md.
    fs: { allow: [fileURLToPath(new URL('../..', import.meta.url))] },
  },
});
