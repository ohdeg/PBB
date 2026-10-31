import config from './vite.config';

// Reproducible build/browser checks without reading actual environment files.
export default {
  ...config,
  envDir: false,
  cacheDir: '/tmp/pbb-dieta-vite-cache',
  define: { 'import.meta.env.VITE_API_BASE_URL': JSON.stringify('http://127.0.0.1:5181') },
  build: { outDir: '/tmp/pbb-dieta-ui-build', emptyOutDir: true },
};
