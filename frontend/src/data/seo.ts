/** 공개 SEO 대상 라우트 + 제외 경로 정책 (CSR 메타 / sitemap 기준) */

import {
  DEFAULT_OG_IMAGE_PATH,
  INDEXABLE_PAGE_SEO,
  SITE_ORIGIN_FALLBACK,
  type IndexablePageSeo,
} from './seoPages';

export {
  DEFAULT_OG_IMAGE_PATH,
  INDEXABLE_PAGE_SEO,
  SITE_ORIGIN_FALLBACK,
  type IndexablePageSeo,
};

export function getSiteOrigin(): string {
  const fromEnv = import.meta.env.VITE_SITE_URL?.replace(/\/$/, '');
  if (fromEnv) {
    return fromEnv;
  }
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }
  return SITE_ORIGIN_FALLBACK;
}

export interface PageSeoDefinition extends IndexablePageSeo {
  /** sitemap / 검색 노출 대상 */
  indexable: true;
}

export interface ResolvedPageSeo {
  title: string | null;
  description: string | null;
  canonicalPath: string;
  robots: string;
  indexable: boolean;
}

function normalizePath(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith('/')) {
    return pathname.slice(0, -1);
  }
  return pathname || '/';
}

export function resolvePageSeo(pathname: string): ResolvedPageSeo {
  const path = normalizePath(pathname);
  const exact = INDEXABLE_PAGE_SEO.find((entry) => entry.path === path);

  if (exact) {
    return {
      title: exact.title,
      description: exact.description,
      canonicalPath: exact.path,
      robots: 'index, follow',
      indexable: true,
    };
  }

  // 검색 비대상: title/description은 페이지 로컬 로직에 맡김 (null = 건드리지 않음)
  return {
    title: null,
    description: null,
    canonicalPath: path,
    robots: 'noindex, nofollow',
    indexable: false,
  };
}
