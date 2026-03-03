import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3006,
    // Proxy REMOVIDO - Usando conexão direta com o backend (VITE_API_BASE_URL)
  },
});

