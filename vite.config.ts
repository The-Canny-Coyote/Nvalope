import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

/**
 * PWA / WASM: Heavy deps (pdf.js, Tesseract, workers) load as separate chunks. The import worker uses
 * dynamic `import()` for OCR. Do not add all `*.wasm` to precache: large ONNX assets (e.g. transformers)
 * exceed Workbox limits; WebLLM model assets stay runtime-cached via jsdelivr. Import-worker chunks are JS + pdf.worker.
 */
export default defineConfig(({ mode }) => ({
  worker: {
    format: 'es',
  },
  define: mode === 'production' ? { 'import.meta.env.VITE_BUILD_EPOCH': JSON.stringify(Date.now()) } : undefined,
  build: {
    modulePreload: { polyfill: false },
    outDir: 'dist',
    emptyOutDir: true,
    copyPublicDir: true,
    rollupOptions: {
      output: {
        compact: true,
      },
    },
    minify: 'esbuild',
    esbuild: {
      legalComments: 'none',
      drop: mode === 'production' ? ['debugger'] : [],
    },
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        cleanupOutdatedCaches: true,
        // WebLLM and other large deps produce chunks > 2 MiB; allow precache up to 8 MiB per file
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
        // Cache WebLLM model assets and other CDN deps for offline usage
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/cdn\.jsdelivr\.net\/.*/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'nvalope-cdn-assets',
              expiration: { maxEntries: 80, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      manifest: {
        name: 'Nvalope — Budget App',
        short_name: 'Nvalope',
        description:
          'A free, privacy-focused, offline-capable envelope budgeting PWA. No ads or tracking. All data stays on your device. Fully offline after first load.',
        start_url: '/',
        display: 'standalone',
        orientation: 'any',
        theme_color: '#0f172a',
        background_color: '#0a0e0d',
        icons: [
          { src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: '/favicon.svg', sizes: '192x192', type: 'image/svg+xml', purpose: 'maskable' },
          { src: '/favicon.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'maskable' },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/app/**/*.{ts,tsx}'],
      exclude: ['src/app/components/ui/**', 'src/**/*.test.{ts,tsx}', 'src/**/*.spec.{ts,tsx}', 'src/test/**'],
    },
  },
}))
