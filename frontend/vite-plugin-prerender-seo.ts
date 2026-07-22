import fs from 'node:fs';
import path from 'node:path';
import type { Plugin } from 'vite';
import {
  DEFAULT_OG_IMAGE_PATH,
  INDEXABLE_PAGE_SEO,
  SITE_ORIGIN_FALLBACK,
} from './src/data/seoPages.ts';

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function replaceMetaByName(html: string, name: string, content: string): string {
  const re = new RegExp(
    `(<meta\\b[^>]*\\bname="${name}"[^>]*\\bcontent=")[^"]*(")`,
    'i',
  );
  if (re.test(html)) {
    return html.replace(re, `$1${escapeHtml(content)}$2`);
  }
  return html.replace(
    '</head>',
    `    <meta name="${name}" content="${escapeHtml(content)}" />\n  </head>`,
  );
}

function replaceMetaByProperty(
  html: string,
  property: string,
  content: string,
): string {
  const re = new RegExp(
    `(<meta\\b[^>]*\\bproperty="${property}"[^>]*\\bcontent=")[^"]*(")`,
    'i',
  );
  if (re.test(html)) {
    return html.replace(re, `$1${escapeHtml(content)}$2`);
  }
  return html.replace(
    '</head>',
    `    <meta property="${property}" content="${escapeHtml(content)}" />\n  </head>`,
  );
}

function replaceTitle(html: string, title: string): string {
  return html.replace(
    /<title>[^<]*<\/title>/i,
    `<title>${escapeHtml(title)}</title>`,
  );
}

function replaceCanonical(html: string, href: string): string {
  const re = /(<link\s+[^>]*rel="canonical"[^>]*href=")[^"]*(")/i;
  if (re.test(html)) {
    return html.replace(re, `$1${escapeHtml(href)}$2`);
  }
  return html.replace(
    '</head>',
    `    <link rel="canonical" href="${escapeHtml(href)}" />\n  </head>`,
  );
}

function applyPageSeo(
  template: string,
  page: (typeof INDEXABLE_PAGE_SEO)[number],
  origin: string,
): string {
  const canonicalUrl =
    page.path === '/' ? `${origin}/` : `${origin}${page.path}`;
  const ogImage = `${origin}${DEFAULT_OG_IMAGE_PATH}`;

  let html = template;
  html = replaceTitle(html, page.title);
  html = replaceMetaByName(html, 'description', page.description);
  html = replaceMetaByName(html, 'robots', 'index, follow');
  html = replaceCanonical(html, canonicalUrl);
  html = replaceMetaByProperty(html, 'og:title', page.title);
  html = replaceMetaByProperty(html, 'og:description', page.description);
  html = replaceMetaByProperty(html, 'og:url', canonicalUrl);
  html = replaceMetaByProperty(html, 'og:image', ogImage);
  html = replaceMetaByName(html, 'twitter:title', page.title);
  html = replaceMetaByName(html, 'twitter:description', page.description);
  html = replaceMetaByName(html, 'twitter:image', ogImage);
  return html;
}

function outputPathForRoute(outDir: string, routePath: string): string {
  if (routePath === '/') {
    return path.join(outDir, 'index.html');
  }
  const segments = routePath.replace(/^\//, '').split('/');
  return path.join(outDir, ...segments, 'index.html');
}

/**
 * 빌드 산출 `dist/index.html`을 복제해 공개 SEO 경로별 `<head>` 메타를 심는다.
 * Cloudflare Pages는 실제 파일이 있으면 SPA `_redirects`보다 우선한다.
 */
export function prerenderSeoPlugin(): Plugin {
  let outDir = 'dist';

  return {
    name: 'pbb-prerender-seo',
    apply: 'build',
    configResolved(config) {
      outDir = path.resolve(config.root, config.build.outDir);
    },
    closeBundle() {
      const templatePath = path.join(outDir, 'index.html');
      if (!fs.existsSync(templatePath)) {
        console.warn('[prerender-seo] dist/index.html 없음 — 건너뜀');
        return;
      }

      const origin = (
        process.env.VITE_SITE_URL?.replace(/\/$/, '') || SITE_ORIGIN_FALLBACK
      ).replace(/\/$/, '');
      const template = fs.readFileSync(templatePath, 'utf8');

      for (const page of INDEXABLE_PAGE_SEO) {
        const html = applyPageSeo(template, page, origin);
        const target = outputPathForRoute(outDir, page.path);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, html, 'utf8');
        console.info(`[prerender-seo] ${page.path} → ${path.relative(outDir, target)}`);
      }
    },
  };
}
