import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';
import { VitePWA } from 'vite-plugin-pwa';

// GitHub Pages 주소가 https://<user>.github.io/<repo>/ 이므로 base는 '/<repo>/'.
// 다른 경로에 올릴 때는 BASE_PATH 환경변수로 바꾼다. (예: BASE_PATH=/ npm run build)
const base = process.env.BASE_PATH ?? '/toeic/';

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: '회독 TOEIC',
        short_name: '회독 TOEIC',
        description: '회독식 토익 영단어 암기',
        lang: 'ko',
        start_url: '.',
        scope: '.',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#f5f6f8',
        theme_color: '#4f46e5',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // 단어 데이터(약 1.1MB)와 한글 폰트까지 모두 미리 저장해서 오프라인에서도 동작
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,json}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        navigateFallback: 'index.html',
      },
    }),
  ],
  test: {
    include: ['src/**/*.test.ts'],
  },
});
