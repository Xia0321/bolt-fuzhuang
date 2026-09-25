import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  // 本地开发时注册接口转发到注册服务（node deploy/account-gw/server.mjs）
  server: {
    proxy: {
      '/api': 'http://localhost:8100',
    },
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
});
