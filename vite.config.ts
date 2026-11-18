import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/proxy/services': {
        target: `http://127.0.0.1:${process.env.MOCK_PORT || 3001}`,
      },
    },
  },
  resolve: {
    alias: {
      '@sber-site/sbercraft-nova-kit': fileURLToPath(
        new URL('./src/shared/vendor/sbercraft-nova-kit', import.meta.url),
      ),
      '@sber-site/malachite-kit': fileURLToPath(
        new URL('./src/shared/vendor/malachite-kit', import.meta.url),
      ),
    },
  },
});
