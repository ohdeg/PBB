import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import {
  DEFAULT_OG_IMAGE_PATH,
  getSiteOrigin,
  resolvePageSeo,
} from '../data/seo';

const META_MANAGED = 'data-pbb-seo';

function upsertMeta(
  attr: 'name' | 'property',
  key: string,
  content: string,
): void {
  const selector = `meta[${attr}="${key}"][${META_MANAGED}]`;
  let el = document.head.querySelector<HTMLMetaElement>(selector);
  if (!el) {
    // 기존 index.html 폴백(관리 속성 없음)도 있으면 재사용
    el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
    if (!el) {
      el = document.createElement('meta');
      el.setAttribute(attr, key);
      document.head.appendChild(el);
    }
    el.setAttribute(META_MANAGED, 'true');
  }
  el.content = content;
}

function upsertLink(rel: string, href: string): void {
  const selector = `link[rel="${rel}"][${META_MANAGED}]`;
  let el = document.head.querySelector<HTMLLinkElement>(selector);
  if (!el) {
    el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
    if (!el) {
      el = document.createElement('link');
      el.rel = rel;
      document.head.appendChild(el);
    }
    el.setAttribute(META_MANAGED, 'true');
  }
  el.href = href;
}

/** 라우트 변경 시 title / description / OG / robots / canonical 갱신 */
export function usePageSeo(): void {
  const { pathname } = useLocation();

  useEffect(() => {
    const seo = resolvePageSeo(pathname);
    const origin = getSiteOrigin();
    const canonicalUrl = `${origin}${seo.canonicalPath === '/' ? '/' : seo.canonicalPath}`;
    const ogImage = `${origin}${DEFAULT_OG_IMAGE_PATH}`;

    if (seo.title) {
      document.title = seo.title;
    }

    if (seo.description) {
      upsertMeta('name', 'description', seo.description);
      upsertMeta('property', 'og:description', seo.description);
      upsertMeta('name', 'twitter:description', seo.description);
    }

    if (seo.title) {
      upsertMeta('property', 'og:title', seo.title);
      upsertMeta('name', 'twitter:title', seo.title);
    }

    upsertMeta('name', 'robots', seo.robots);
    upsertMeta('property', 'og:type', 'website');
    upsertMeta('property', 'og:url', canonicalUrl);
    upsertMeta('property', 'og:image', ogImage);
    upsertMeta('property', 'og:locale', 'ko_KR');
    upsertMeta('property', 'og:site_name', "PBB · Play beom's BAG");
    upsertMeta('name', 'twitter:card', 'summary_large_image');
    upsertMeta('name', 'twitter:image', ogImage);
    upsertLink('canonical', canonicalUrl);
  }, [pathname]);
}

/** Router 트리 안에서 한 번만 마운트 */
export function PageSeo(): null {
  usePageSeo();
  return null;
}
