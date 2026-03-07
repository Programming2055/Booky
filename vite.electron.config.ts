import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Vite config used when building for the Electron desktop app.
// Uses a relative base path ('./') so that assets are resolved correctly
// when loaded via Electron's file:// protocol.
export default defineConfig({
  plugins: [react()],
  base: './',
  server: {
    port: 5073,
  },
})
