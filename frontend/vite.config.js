import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'node:fs/promises';
import { imagetools } from 'vite-imagetools';
import { visualizer } from 'rollup-plugin-visualizer';
import { VitePWA } from 'vite-plugin-pwa';

const isTest = process.env.VITEST === 'true';
const BUILD_TIMESTAMP = Date.now();

export default defineConfig({
  define: {
    __BUILD_TIMESTAMP__: JSON.stringify(BUILD_TIMESTAMP),
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.js',
    css: true,
    include: ['src/**/*.{test,spec}.{js,jsx,ts,tsx}'],
    exclude: ['src/test/debug.test.jsx'],
    fileParallelism: false,
  },

  plugins: [
    react(),
    // HTML template transform: inject build timestamp into index.html
    {
      name: 'html-transform',
      transformIndexHtml(html) {
        return html.replace('__BUILD_TIMESTAMP__', JSON.stringify(BUILD_TIMESTAMP));
      },
    },
    ...(isTest
      ? []
      : [
          imagetools({
            defaultDirectives: (_url) => {
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
          VitePWA({
            registerType: 'prompt', // 열린 주문 화면은 사용자가 업데이트할 때까지 유지
            injectRegister: 'auto',
            includeAssets: ['icons/*.svg', 'icons/*.png', 'offline.html'],
            manifest: false, // public/manifest.json 사용

            workbox: {
              importScripts: ['/sw-sync.js'],
              // 빌드 결과물 자동 프리캐시
              globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
              globIgnores: ['firebase-messaging-sw.js'],
              manifestTransforms: [
                async (entries) => {
                  // Cache the shell, not every admin page on the customer's first QR visit.
                  const html = await fs.readFile(
                    path.resolve(__dirname, 'dist/index.html'),
                    'utf8'
                  );
                  const shellScripts = new Set(
                    [...html.matchAll(/(?:src|href)="\/?(assets\/[^"\s]+\.js)"/g)].map(
                      (match) => match[1]
                    )
                  );
                  return {
                    manifest: entries.filter(
                      (entry) => !entry.url.endsWith('.js') || shellScripts.has(entry.url)
                    ),
                    warnings: [],
                  };
                },
              ],

              // 런타임 캐시 전략
              runtimeCaching: [
                {
                  urlPattern: ({ url, sameOrigin }) =>
                    sameOrigin && url.pathname.startsWith('/assets/'),
                  handler: 'CacheFirst',
                  options: {
                    cacheName: 'wemarket-assets',
                    expiration: { maxEntries: 160, maxAgeSeconds: 60 * 60 * 24 * 14 },
                    cacheableResponse: { statuses: [200] },
                  },
                },
                // Same-origin API only. The production API lives on Render, so cross-origin
                // requests must bypass Workbox entirely to avoid CORS/no-response loops.
                {
                  urlPattern: ({ url, sameOrigin }) =>
                    sameOrigin &&
                    url.pathname.startsWith('/api/') &&
                    !url.pathname.startsWith('/api/health'),
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
                // Same-origin non-critical API only (search, listings)
                {
                  urlPattern: ({ url, sameOrigin }) =>
                    sameOrigin &&
                    url.pathname.startsWith('/api/') &&
                    !url.pathname.startsWith('/api/health') &&
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
              skipWaiting: false,
              clientsClaim: true, // activate 후 모든 탭을 즉시 제어
            },

            devOptions: {
              enabled: true,
              type: 'module',
            },
          }),
        ]),
  ],

  resolve: {
    alias: [
      { find: '@', replacement: path.resolve(__dirname, './src') },
      // Both entry points must share the same ESM router and React contexts.
      {
        find: /^react-router-dom$/,
        replacement: path.resolve(
          __dirname,
          './node_modules/react-router/dist/development/index.mjs'
        ),
      },
      {
        find: /^react-router$/,
        replacement: path.resolve(
          __dirname,
          './node_modules/react-router/dist/development/index.mjs'
        ),
      },
    ],
    dedupe: ['react', 'react-dom', 'react-router', 'react-router-dom'],
  },

  server: {
    host: true,
    port: 5173,
  },

  build: {
    outDir: 'dist',
    cssCodeSplit: true,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router'],
          'vendor-icons': ['lucide-react'],
          'vendor-utils': ['axios', 'socket.io-client'],
          // [M-5] framer-motion은 admin/대시보드 전용 → lazy chunk로 분리
          // [M-5] firebase는 인증/푸시 전용 → 별도 chunk
          'vendor-firebase': ['firebase/app', 'firebase/messaging', 'firebase/analytics'],
          // [M-5] recharts/xlsx는 대시보드·일괄등록 전용 → 라우트 분할로 처리
          //   별도 manualChunk로 강제하면 entry가 해당 모듈까지 끌어와 초기 로드가 무겁게 됨
        },
      },
    },
    chunkSizeWarningLimit: 400,
  },
});
