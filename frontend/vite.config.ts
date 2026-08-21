import fs from 'node:fs';
import path from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { prerenderSeoPlugin } from './vite-plugin-prerender-seo.ts';

const FAVICON_PNG = path.resolve(__dirname, 'public/pbb-favicon.png');
const FAVICON_URLS = new Set([
  '/favicon.ico',
  '/favicon.svg',
  '/favicon.png',
  '/vite.svg',
]);

/** Chrome keeps Vite's old /favicon.svg on the tab; serve PBB bytes and inline the icon. */
function pbbFaviconPlugin(): Plugin {
  const png = () => fs.readFileSync(FAVICON_PNG);
  return {
    name: 'pbb-favicon',
    transformIndexHtml(html) {
      const href = `data:image/png;base64,${png().toString('base64')}`;
      const tag = `<link rel="icon" type="image/png" href="${href}" />`;
      const stripped = html.replace(/<link rel="icon"[^>]*>\s*/g, '');
      return stripped.replace('<head>', `<head>\n    ${tag}`);
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url?.split('?')[0] ?? '';
        if (!FAVICON_URLS.has(url)) {
          next();
          return;
        }
        const body = png();
        res.statusCode = 200;
        res.setHeader('Content-Type', 'image/png');
        res.setHeader('Cache-Control', 'no-store');
        res.setHeader('Content-Length', String(body.length));
        res.end(body);
      });
    },
  };
}

export default defineConfig({
  plugins: [pbbFaviconPlugin(), react(), tailwindcss(), prerenderSeoPlugin()],
  server: { host: true },
});
