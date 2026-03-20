import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'https://stockmarket-3z4v.onrender.com',
        changeOrigin: true,
      },
    },
  },
})
