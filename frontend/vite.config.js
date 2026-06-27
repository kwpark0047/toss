import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',          // 업데이트 시 사용자에게 확인 요청
      injectRegister: 'auto',
      includeAssets: ['icons/*.svg', 'icons/*.png', 'offline.html'],
      manifest: false,                 // public/manifest.json 사용

      workbox: {
        // 빌드 결과물 자동 프리캐시
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        globIgnores: ['firebase-messaging-sw.js'],

        // 런타임 캐시 전략
        runtimeCaching: [
          // API — Network First (실시간 데이터 우선, 오프라인 시 캐시)
          {
            urlPattern: /^https?:\/\/.+\/api\//,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'wemarket-api',
              networkTimeoutSeconds: 5,
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 5,     // 5분
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // 메뉴 이미지 / 업로드 파일 — Cache First
          {
            urlPattern: /\/uploads\//,
            handler: 'CacheFirst',
            options: {
              cacheName: 'wemarket-uploads',
              expiration: {
                maxEntries: 200,
                maxAgeSeconds: 60 * 60 * 24 * 7, // 7일
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // Supabase Storage 이미지
          {
            urlPattern: /supabase\.co\/storage/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'wemarket-supabase-storage',
              expiration: {
                maxEntries: 200,
                maxAgeSeconds: 60 * 60 * 24 * 7,
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // Google Fonts / 외부 폰트
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'wemarket-fonts',
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],

        // 오프라인 폴백
        navigateFallback: '/offline.html',
        navigateFallbackDenylist: [/^\/api\//, /^\/sw\.js$/],

        // 기존 sw.js와 충돌 방지
        cleanupOutdatedCaches: true,
        skipWaiting: false,            // prompt 모드에서는 false
        clientsClaim: true,
      },

      devOptions: {
        enabled: true,
        type: 'module',
      },
    }),
  ],

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },

  server: {
    host: true,
    port: 5173,
  },

  build: {
    outDir: 'dist',
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-icons': ['lucide-react'],
          'vendor-utils': ['axios', 'socket.io-client'],
        },
      },
    },
    chunkSizeWarningLimit: 500,
  },
})
