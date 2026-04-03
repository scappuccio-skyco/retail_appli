import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  build: {
    outDir: 'build', // Keep same output dir as CRA for Vercel compatibility
  },
  server: {
    port: 3000,
  },
  // Treat .js files as JSX (project uses .js extension for React components)
  optimizeDeps: {
    esbuildOptions: {
      loader: { '.js': 'jsx' },
    },
  },
  esbuild: {
    loader: 'jsx',
    include: /src\/.*\.js$/,
    exclude: [],
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/setupTests.js'],
    include: ['src/**/*.test.{js,jsx}'],
    css: false,
    // Pass 8GB heap to fork workers so React 19 + jsdom initialisation doesn't OOM
    forks: {
      execArgv: ['--max-old-space-size=8192'],
    },
  },
});
