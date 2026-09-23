import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');

  return {
    plugins: [react()],

    base: env.VITE_BASE_PATH
      ? `${env.VITE_BASE_PATH.replace(/\/$/, '')}/`
      : '/',

    server: {
      port: 5173,
      host: true,
    },
  };
});