import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Forward /api calls to the FastAPI backend so the browser only ever
    // talks to the Vite dev server during development.
    proxy: {
      '/api': 'http://localhost:8000',
    },
  },
})
