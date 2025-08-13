import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Change base to '/<your-repo-name>/' before deploying to GitHub Pages
export default defineConfig({
  plugins: [react()],
  base: '/interview-cards/'
})
