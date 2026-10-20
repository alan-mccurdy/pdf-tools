import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: '/pdf-tools/',

  // Build optimizations for Core Web Vitals
  build: {
    // Target modern browsers for smaller bundles
    target: 'es2022',
    minify: 'esbuild',
    cssMinify: true,

    // Chunk splitting strategy
    rollupOptions: {
      output: {
        // Manual chunks for better caching - use function form for compatibility
        manualChunks: (id: string) => {
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router')) {
              return 'vendor-react'
            }
            if (id.includes('react-helmet-async')) {
              return 'vendor-helmet'
            }
            if (id.includes('pdf-lib')) {
              return 'vendor-pdf-lib'
            }
            if (id.includes('docx')) {
              return 'vendor-docx'
            }
            if (id.includes('jszip')) {
              return 'vendor-zip'
            }
            if (id.includes('pdfjs-dist')) {
              return 'pdfjs'
            }
            if (id.includes('tesseract.js')) {
              return 'tesseract'
            }
            // Other vendor modules
            return 'vendor'
          }
        },

        // Chunk file naming for caching
        chunkFileNames: 'assets/js/[name]-[hash].js',
        entryFileNames: 'assets/js/[name]-[hash].js',
        assetFileNames: (assetInfo) => {
          const name = assetInfo.name || ''
          const info = name.split('.')
          const ext = info[info.length - 1]
          if (/\.(png|jpe?g|gif|svg|webp|avif)$/.test(name)) {
            return `assets/images/[name]-[hash].${ext}`
          }
          if (/\.(woff2?|ttf|eot)$/.test(name)) {
            return `assets/fonts/[name]-[hash].${ext}`
          }
          return `assets/[ext]/[name]-[hash].${ext}`
        },
      },
    },

    // Increase chunk size warning limit (we have heavy libs)
    chunkSizeWarningLimit: 1000,

    // Source maps for debugging (disable in production if needed)
    sourcemap: false,

    // Module preload polyfill
    modulePreload: {
      polyfill: true,
    },

    // CSS code splitting
    cssCodeSplit: true,

    // Report compressed sizes
    reportCompressedSize: true,
  },

  // Optimize dependencies
  optimizeDeps: {
    // Pre-bundle these for faster dev server startup
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      'react-helmet-async',
      'pdf-lib',
      'docx',
      'jszip',
    ],
    // Exclude heavy libs from pre-bundling (they'll be lazy-loaded)
    exclude: ['pdfjs-dist', 'tesseract.js'],
  },

  // Experimental: enable CSS @import inlining
  css: {
    devSourcemap: true,
  },

  // Server config for development
  server: {
    headers: {
      // Enable caching for static assets in dev
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  },

  // Define globals
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version || '0.0.0'),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
})