import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],

  server: {
    port: 5173,
    proxy: {
      // Any request starting with /api is forwarded to the FastAPI server.
      // This means fetch('/api/data/top10_africa_gdp') in React will hit
      // http://127.0.0.1:8000/api/data/top10_africa_gdp during development.
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },

  build: {
    outDir: 'dist',       // FastAPI serves this folder in production
    sourcemap: true,
  },
})
