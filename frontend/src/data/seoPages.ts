/** SEO 공개 라우트 메타 (CSR + prerender 공통 출처, env/window 의존 없음) */

export const SITE_ORIGIN_FALLBACK = 'https://app.pbbstudio.com';

export const DEFAULT_OG_IMAGE_PATH = '/og-default.jpg';

export interface IndexablePageSeo {
  path: string;
  title: string;
  description: string;
}

export const INDEXABLE_PAGE_SEO: readonly IndexablePageSeo[] = [
  {
    path: '/',
    title: "PBB · Play beom's BAG",
    description: "취미 앱을 골라 시작하는 Play beom's BAG",
  },
  {
    path: '/hobbies/ipbt',
    title: 'iPBT · PBB',
    description: '날씨를 보고 오늘 야구가 가능한지 보는 앱',
  },
  {
    path: '/hobbies/lotto',
    title: '6PICK · PBB',
    description:
      '몬테카를로·Hot/Cold로 로또 번호를 만들고 히스토리를 저장하는 앱',
  },
  {
    path: '/hobbies/score-viewer',
    title: 'Score Viewer · PBB',
    description:
      'MusicXML/MXL 악보를 열고 메트로놈·조옮김·자동 스크롤로 연습',
  },
  {
    path: '/hobbies/veveno',
    title: 'Veveno · PBB',
    description: '메뉴·재고·근무를 한곳에 남기는 가벼운 매장 노트',
  },
] as const;
