import process from 'node:process'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: process.env.GITHUB_PAGES ? '/forensic_form/' : '/',
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        'index.html': 'pages.index.html',
      },
      output: {
        entryFileNames: 'assets/app.js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: (assetInfo) => {
          if (assetInfo.names?.some((name) => name.endsWith('.css'))) {
            return 'assets/app.css'
          }

          return 'assets/[name][extname]'
        },
      },
    },
  },
})
