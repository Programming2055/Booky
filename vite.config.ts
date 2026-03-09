import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/Booky/',  // GitHub Pages base path
  server: {
    port: 5073,
  },
})
