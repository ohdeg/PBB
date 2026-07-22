/** 공개 SEO 대상 라우트 + 제외 경로 정책 (CSR 메타 / sitemap 기준) */

export const SITE_ORIGIN_FALLBACK = 'https://app.pbbstudio.com';

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

export interface PageSeoDefinition {
  path: string;
  title: string;
  description: string;
  /** sitemap / 검색 노출 대상 */
  indexable: true;
}

/** SEO 포함 (sitemap + index) */
export const INDEXABLE_PAGE_SEO: readonly PageSeoDefinition[] = [
  {
    path: '/',
    title: "PBB · Play beom's BAG",
    description: "취미 앱을 골라 시작하는 Play beom's BAG",
    indexable: true,
  },
  {
    path: '/hobbies/ipbt',
    title: 'iPBT · PBB',
    description: '날씨를 보고 오늘 야구가 가능한지 보는 앱',
    indexable: true,
  },
  {
    path: '/hobbies/lotto',
    title: '6PICK · PBB',
    description:
      '몬테카를로·Hot/Cold로 로또 번호를 만들고 히스토리를 저장하는 앱',
    indexable: true,
  },
  {
    path: '/hobbies/score-viewer',
    title: 'Score Viewer · PBB',
    description:
      'MusicXML/MXL 악보를 열고 메트로놈·조옮김·자동 스크롤로 연습',
    indexable: true,
  },
] as const;

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

export const DEFAULT_OG_IMAGE_PATH = '/og-default.jpg';
