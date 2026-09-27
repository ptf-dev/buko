import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      // index.html is the app (also used by the native builds); landing.html is the marketing site.
      input: { app: 'index.html', landing: 'landing.html' },
    },
  },
  test: {
    environment: 'node',
  },
})
