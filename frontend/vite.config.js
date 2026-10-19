import path from 'path'
import { fileURLToPath } from 'url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [
    react(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    // Pure modules only (adapter, API client, polling); no DOM needed.
    environment: 'node',
    include: ['src/**/*.test.js'],
  },
  server: {
    proxy: {
      // Backend routes have no /api prefix: /api/me → http://localhost:8000/me (see src/services/apiConfig.js).
      '/api': { target: 'http://localhost:8000', rewrite: (p) => p.replace(/^\/api/, '') },
    },
  },
})
