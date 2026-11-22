import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
export default defineConfig({
    plugins: [react()],
    resolve: { tsconfigPaths: true },
    server: {
        proxy: {
            '/proxy/services': {
                target: `http://127.0.0.1:${process.env.MOCK_PORT || 3001}`,
            },
        },
    },
});
