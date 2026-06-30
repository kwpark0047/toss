import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',      // 새 버전 배포 시 SW 자동 교체
      injectRegister: 'auto',
      includeAssets: ['icons/*.svg', 'icons/*.png', 'offline.html'],
      manifest: false,                 // public/manifest.json 사용

      workbox: {
        // 빌드 결과물 자동 프리캐시
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        globIgnores: ['firebase-messaging-sw.js'],

        // 런타임 캐시 전략
        runtimeCaching: [
          // API — Network Only (캐시 사용 안 함, Render 콜드스타트는 MenuPage retry로 처리)
          // networkTimeoutSeconds 5초는 Render 슬립 시 즉시 캐시 낙오 → offline.html 서빙 버그 유발
          {
            urlPattern: /^https?:\/\/.+\/api\//,
            handler: 'NetworkOnly',
            options: {
              cacheName: 'wemarket-api',
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
          // Unsplash 이미지 (AI 메뉴 생성 프리뷰)
          {
            urlPattern: /^https:\/\/(source\.unsplash\.com|images\.unsplash\.com)\//,
            handler: 'CacheFirst',
            options: {
              cacheName: 'wemarket-unsplash',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24,   // 1일
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

        // SPA 네비게이션 폴백: index.html 서빙 (offline.html 금지)
        // offline.html을 설정하면 SW가 /menu/:id 등 미캐시 경로를 offline.html로 서빙,
        // online 감지 후 '/'로 자동 리다이렉트 → 로그아웃처럼 보이는 버그 유발
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//, /^\/sw\.js$/, /^\/firebase-messaging-sw\.js$/],

        // 기존 sw.js와 충돌 방지
        cleanupOutdatedCaches: true,
        skipWaiting: true,             // autoUpdate: 새 SW 즉시 활성화
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
