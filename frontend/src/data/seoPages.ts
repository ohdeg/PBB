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
    path: '/hobbies/6pick',
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
  {
    path: '/hobbies/dieta',
    title: 'Dieta · PBB',
    description: '체중·섭취·활동량으로 한 주씩 부드럽게 조절하는 코칭 노트',
  },
  {
    path: '/hobbies/sranko',
    title: '슈란코 · PBB',
    description: '옷·치수·룩을 모으고 스타일 커뮤니티에 공유하는 디지털 옷장',
  },
] as const;
