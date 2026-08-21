export type HobbyBlockTone =
  | 'lilac'
  | 'cream'
  | 'mint'
  | 'coral'
  | 'navy';

export interface HobbyApp {
  id: string;
  name: string;
  subtitle: string;
  description: string;
  category: string;
  /** 소개 랜딩·내비 기본 경로 */
  path: string | null;
  /** 홈「열기」— 앱 메인 진입 (없으면 path와 동일 → 소개 링크 숨김) */
  startPath?: string;
  accent: string;
  available: boolean;
  /** 홈 color-block 파스텔 톤 */
  blockTone?: HobbyBlockTone;
  /** 앱 아이콘 이미지 (없으면 이름 첫 글자) */
  iconSrc?: string;
  /** 홈 타일·히어로용 제품 컷 (없으면 iconSrc → 이니셜) */
  productImage?: string;
  /** 최초 공개일 (ISO date) */
  addedAt: string;
  /** 최근 업데이트일 (ISO date) — 홈 featured 폴백 정렬 */
  updatedAt: string;
}

export const HOBBY_CATEGORIES = ['라이프', '음악'] as const;

export type HobbyCategory = (typeof HOBBY_CATEGORIES)[number];

export const HOBBY_APPS: HobbyApp[] = [
  {
    id: 'veveno',
    name: 'Veveno',
    subtitle: '가게 노트',
    description: '메뉴·재고·근무를 한곳에 남기는 가벼운 매장 노트',
    category: '라이프',
    path: '/hobbies/veveno',
    startPath: '/hobbies/veveno/hub',
    accent: '#c4a484',
    blockTone: 'cream',
    available: true,
    productImage: '/hobbies/veveno-product.png',
    addedAt: '2026-06-01',
    updatedAt: '2026-08-05',
  },
  {
    id: '6pick',
    name: '6PICK',
    subtitle: '로또 번호',
    description: '몬테카를로·Hot/Cold로 번호를 만들고 히스토리를 저장하는 앱',
    category: '라이프',
    path: '/hobbies/6pick',
    startPath: '/hobbies/6pick/play',
    accent: '#af52de',
    blockTone: 'lilac',
    available: true,
    iconSrc: '/6pick/logo.svg',
    productImage: '/hobbies/6pick-product.png',
    addedAt: '2026-05-20',
    updatedAt: '2026-07-28',
  },
  {
    id: 'score-viewer',
    name: 'Score Viewer',
    subtitle: '악보 뷰어',
    description: 'MusicXML/MXL 악보를 열고 메트로놈·조옮김·자동 스크롤로 연습',
    category: '음악',
    path: '/hobbies/score-viewer',
    startPath: '/hobbies/score-viewer/library',
    accent: '#5e5ce6',
    blockTone: 'navy',
    available: true,
    productImage: '/hobbies/score-viewer-product.png',
    addedAt: '2026-04-10',
    updatedAt: '2026-08-01',
  },
  {
    id: 'dieta',
    name: 'Dieta',
    subtitle: '체중 코칭',
    description: '체중·섭취·활동량으로 한 주씩 부드럽게 조절하는 코칭 노트',
    category: '라이프',
    path: '/hobbies/dieta',
    startPath: '/hobbies/dieta/home',
    accent: '#1f7a64',
    blockTone: 'mint',
    available: true,
    productImage: '/hobbies/dieta-product.png',
    addedAt: '2026-07-01',
    updatedAt: '2026-08-08',
  },
  {
    id: 'sranko',
    name: 'Sranko',
    subtitle: '디지털 옷장',
    description: '옷·치수·룩을 모으고 스타일 커뮤니티에 공유하는 옷장 앱',
    category: '라이프',
    path: '/hobbies/sranko',
    startPath: '/hobbies/sranko/closet',
    accent: '#3d5a80',
    blockTone: 'coral',
    available: true,
    productImage: '/hobbies/sranko-product.png',
    addedAt: '2026-08-05',
    updatedAt: '2026-08-09',
  },
];

/** 홈 미디어: 제품컷 → 아이콘 → null */
export function getHobbyMediaSrc(app: HobbyApp): string | undefined {
  return app.productImage ?? app.iconSrc;
}

function hobbyRecencyMs(app: HobbyApp): number {
  const updated = Date.parse(app.updatedAt);
  const added = Date.parse(app.addedAt);
  return Math.max(
    Number.isFinite(updated) ? updated : 0,
    Number.isFinite(added) ? added : 0,
  );
}

export function sortHobbiesByRecency(apps: HobbyApp[]): HobbyApp[] {
  return [...apps].sort((a, b) => hobbyRecencyMs(b) - hobbyRecencyMs(a));
}

/** 최근 업데이트/추가순 공개 앱 */
export function getRecentHobbies(limit = 5): HobbyApp[] {
  return sortHobbiesByRecency(HOBBY_APPS.filter((app) => app.available)).slice(
    0,
    limit,
  );
}

export function getFeaturedHobby(): HobbyApp {
  return getRecentHobbies(1)[0] ?? HOBBY_APPS[0];
}

export function getHobbyById(id: string): HobbyApp | undefined {
  const resolvedId =
    id === 'brew-note' ? 'veveno' : id === 'lotto' ? '6pick' : id;
  return HOBBY_APPS.find((app) => app.id === resolvedId);
}

export function getHobbiesByCategory(category: string): HobbyApp[] {
  return HOBBY_APPS.filter((app) => app.category === category);
}

/** 상단 탭용 — 공개 가능한 취미만 */
export function getNavHobbies(): HobbyApp[] {
  return HOBBY_APPS.filter((app) => app.available && Boolean(app.path));
}
