import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Proxy requests starting with /api to the backend server
      '/api': {
        target: 'http://127.0.0.1:8080', // Changed port to 8080
        changeOrigin: true, // Recommended for virtual hosted sites
        rewrite: (path) => path.replace(/^\/api/, ''), // Remove /api prefix
      },
    },
  },
})
