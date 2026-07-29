import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { imagetools } from 'vite-imagetools';
import { visualizer } from 'rollup-plugin-visualizer';
import { VitePWA } from 'vite-plugin-pwa';
import criticalCss from 'vite-plugin-critical-css';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.js',
    css: true,
  },

  plugins: [
    react(),
    imagetools({
      defaultDirectives: (url) => {
        return new URLSearchParams({
          format: 'avif;webp;jpeg',
          as: 'picture',
        });
      },
    }),
    visualizer({
      filename: 'bundle-analysis.html',
      open: false,
      gzipSize: true,
      brotliSize: true,
    }),
    criticalCss({
      include: ['/'],
      minify: true,
      height: 800,
      width: 1280,
    }),
    VitePWA({
      registerType: 'autoUpdate', // 새 버전 배포 시 SW 자동 교체
      injectRegister: 'auto',
      includeAssets: ['icons/*.svg', 'icons/*.png', 'offline.html'],
      manifest: false, // public/manifest.json 사용

      workbox: {
        importScripts: ['/sw-sync.js'],
        // 빌드 결과물 자동 프리캐시
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        globIgnores: ['firebase-messaging-sw.js'],

        // 런타임 캐시 전략
        runtimeCaching: [
          // API — Network First with Stale-While-Revalidate fallback for better perceived performance
          // Use NetworkFirst for critical API, with stale-while-revalidate behavior
          {
            urlPattern: /^https?:\/\/.+\/api\//,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'wemarket-api',
              networkTimeoutSeconds: 3,
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24, // 1 day
              },
            },
          },
          // API — Stale-While-Revalidate for non-critical GET requests (search, listings)
          {
            urlPattern: ({ url }) =>
              url.pathname.startsWith('/api/') &&
              (url.searchParams.has('list') ||
                url.searchParams.has('search') ||
                url.pathname.includes('/list')),
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'wemarket-api-stale',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24, // 1 day
              },
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
                maxAgeSeconds: 60 * 60 * 24, // 1일
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
        skipWaiting: true, // 새 SW 설치 즉시 activate (waiting 건너뜀)
        clientsClaim: true, // activate 후 모든 탭을 즉시 제어
      },

      devOptions: {
        enabled: true,
        type: 'module',
      },
    }),
  ],

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
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
          'vendor-react': ['react', 'react-dom', 'react-router'],
          'vendor-icons': ['lucide-react'],
          'vendor-utils': ['axios', 'socket.io-client'],
          // framer-motion 은 랜딩/메뉴(초기 경로)에서 실제로 쓰이므로 초기 청크에 둔다.
          'vendor-motion': ['framer-motion'],
          // [M-5] recharts/xlsx 는 대시보드·일괄등록 전용으로 이미 라우트 분할되어 있다.
          //   별도 manualChunk 로 강제하면 entry 가 해당 모듈까지 끌어와 초기 로드가
          //   무거워지므로(modulepreload 주입), 여기서는 제외하고 Rollup 자동 분할에 맡긴다.
        },
      },
    },
    chunkSizeWarningLimit: 500,
  },
});
