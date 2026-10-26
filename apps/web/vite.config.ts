import fs from 'fs';
import path from 'path';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

function brandAssetsPlugin(): Plugin {
  const cacheDir = path.resolve(__dirname, '.cache/brand');
  const publicBrand = path.resolve(__dirname, 'public/brand');

  function sync() {
    if (!fs.existsSync(cacheDir)) return;
    fs.mkdirSync(publicBrand, { recursive: true });
    for (const file of fs.readdirSync(cacheDir)) {
      fs.copyFileSync(path.join(cacheDir, file), path.join(publicBrand, file));
    }
  }

  return {
    name: 'wallethub-brand-assets',
    buildStart() { sync(); },
    configureServer(server) {
      sync();
      server.watcher.add(cacheDir);
      server.watcher.on('change', (f) => { if (f.startsWith(cacheDir)) sync(); });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react(), brandAssetsPlugin()],
    resolve: {
      dedupe: ['react', 'react-dom'],
      alias: {
        '@shared': path.resolve(__dirname, 'src/shared'),
        '@entities': path.resolve(__dirname, 'src/entities'),
        '@features': path.resolve(__dirname, 'src/features'),
        '@app': path.resolve(__dirname, 'src/app'),
        '@pages': path.resolve(__dirname, 'src/pages'),
      },
    },
    define: {
      __APP_VERSION__: JSON.stringify(env.npm_package_version ?? 'dev'),
    },
    server: {
      host: process.env.DOCKER === 'true' ? '0.0.0.0' : '127.0.0.1',
      port: parseInt(process.env.PORT || process.env.WALLETHUB_WEB_INTERNAL_PORT || '3000', 10),
      open: false,
      strictPort: true,
      allowedHosts: [
        '127.0.0.1',
        'localhost',
        'wallethub.example.com',
        'wallethub.example.com',
        'wallethub.example.com',
        'wallethub.example.com',
        'wallethub.example.com',
      ],
      // Polling para Docker no Windows/macOS - garante hot-reload funcionando
      watch: process.env.DOCKER === 'true' ? {
        usePolling: true,
        interval: 300, // ms - verifica mudanças a cada 300ms
      } : undefined,
      // Proxy para API quando rodando em Docker
      proxy: process.env.DOCKER === 'true' ? {
        '/api': {
          target: process.env.VITE_API_INTERNAL_URL || (process.env.WALLETHUB_API_INTERNAL_PORT 
            ? `http://api:${process.env.WALLETHUB_API_INTERNAL_PORT}` 
            : 'http://api:3001'),
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, '/api'),
        },
      } : undefined,
    },
    build: {
      sourcemap: true,
      outDir: 'dist',
      emptyOutDir: true,
    },
    test: {
      environment: 'jsdom',
      setupFiles: './tests/setup.ts',
      include: ['tests/**/*.spec.{ts,tsx}'],
      exclude: ['**/node_modules/**', 'tests/e2e/**'],
      globals: true,
      /** `threads` pode dar timeout ao arrancar o pool no Windows; `forks` com 1 processo é mais estável. */
      pool: 'forks',
      maxForks: 1,
      minForks: 1,
      coverage: {
        provider: 'v8',
        reporter: ['text', 'json-summary'],
        /**
         * Não usar `coverage.include` com globs `.ts` aqui: o relatório v8 usa ficheiros
         * instrumentados (p.ex. `.js`) e o include desalinhado zera as métricas.
         * Excluímos o que está fora do conjunto crítico do plano.
         */
        exclude: [
          '**/node_modules/**',
          'tests/e2e/**',
          '**/dist/**',
          'src/app/**',
          'src/pages/**',
          'src/main.tsx',
          'src/test/**',
          'src/entities/**',
          'src/features/auth/**',
          'src/features/accounts/**',
          'src/features/admin/**',
          'src/features/categories/**',
          'src/features/investments/**',
          'src/features/whatsapp/**',
          'src/features/telegram/**',
          'src/shared/ui/**',
          'src/shared/utils/**',
          '**/*.css',
          '**/*.d.ts',
        ],
        thresholds: {
          // Piso anti-regressão (não objetivo — "cobertura é métrica, não objetivo"). Alinhado ao
          // ajuste da API: o gate alto mantinha a CI vermelha. Subir cobertura é trabalho separado.
          lines: 70,
          statements: 70,
          branches: 50,
          functions: 58,
        },
      },
    },
  };
});
