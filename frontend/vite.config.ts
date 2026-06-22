import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: process.env.BASE_PATH || '/',
  server: {
    port: 3000,
    host: '0.0.0.0',
    allowedHosts: true,
    proxy: {
      '/demo/api': {
        target: 'http://backend:3001',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/demo/, ''),
      },
      '/demo/socket.io': {
        target: 'http://backend:3001',
        changeOrigin: true,
        ws: true,
        rewrite: (path) => path.replace(/^\/demo/, ''),
      },
    },
  },
})
