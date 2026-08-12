import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Static PWA, no backend (slice 1). The PWA manifest and service worker are
// hand-rolled in public/ to keep the dependency surface close to vanilla.
export default defineConfig({
  plugins: [react()],
  build: {
    target: 'es2022',
  },
})
