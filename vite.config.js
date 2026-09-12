import { execSync } from 'node:child_process';

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

/**
 * Which build this is, printed at the bottom of the profile screen.
 *
 * With three people on three phones, "did my fix reach you?" is otherwise
 * unanswerable — you end up asking someone to describe what they see. Vercel
 * hands the commit over in an environment variable; a local build asks git.
 */
const buildId =
  process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7)
  || (() => {
    try {
      return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
        .toString()
        .trim();
    } catch {
      return 'dev';
    }
  })();

export default defineConfig({
  define: {
    __BUILD_ID__: JSON.stringify(buildId),
  },
  plugins: [
    react(),
    VitePWA({
      // Not 'autoUpdate': that hands the moment of the swap to the browser,
      // which picks the next navigation — and in a standalone app there may
      // not be one for days. 'prompt' leaves the waiting worker for lib/pwa.js
      // to install, which does it as soon as it is safe. See that file.
      registerType: 'prompt',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'רשימת קניות',
        short_name: 'קניות',
        description: 'רשימת קניות משותפת למשפחה',
        theme_color: '#2864ef',
        background_color: '#eff6ff',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        lang: 'he',
        dir: 'rtl',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // The list itself is live data — never serve it from the SW cache.
        // Only the shell is precached, so a cold start is instant but the
        // items always come from Supabase (or react-query's memory cache).
        navigateFallbackDenylist: [/^\/auth\//],
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
      },
    }),
  ],
  server: {
    port: 5174,
  },
  build: {
    target: 'es2020',
    sourcemap: false,
    rollupOptions: {
      output: {
        // Split the libraries out from our own code, because these two change
        // at completely different rates. Everything used to live in one 600 kB
        // bundle, so fixing a typo in a Hebrew string re-downloaded React,
        // Supabase and framer-motion along with it — on someone's phone, on
        // cellular, every single deploy. Split, a normal deploy costs the app
        // chunk and nothing else; these three keep their hashes and stay in
        // the service worker's cache untouched.
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-supabase': ['@supabase/supabase-js'],
          'vendor-motion': ['framer-motion'],
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.js',
    css: false,
  },
});
