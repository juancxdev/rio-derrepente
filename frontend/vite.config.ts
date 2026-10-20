import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '..', '');
  const apiPort = env.API_HOST_PORT || '12001';

  return {
    plugins: [react()],
    server: {
      proxy: {
        '/api': `http://localhost:${apiPort}`,
        '/health': `http://localhost:${apiPort}`,
      },
    },
    test: { environment: 'jsdom' },
  };
});
