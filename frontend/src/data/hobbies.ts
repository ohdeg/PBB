export interface HobbyApp {
  id: string;
  name: string;
  subtitle: string;
  description: string;
  category: string;
  path: string | null;
  accent: string;
  available: boolean;
  /** 앱 아이콘 이미지 (없으면 이름 첫 글자) */
  iconSrc?: string;
}

export const HOBBY_CATEGORIES = ['스포츠', '라이프', '음악'] as const;

export type HobbyCategory = (typeof HOBBY_CATEGORIES)[number];

export const HOBBY_APPS: HobbyApp[] = [
  {
    id: 'ipbt',
    name: 'iPBT',
    subtitle: '오늘 야구 경기가 있을까?',
    description: '날씨를 보고 야구가 가능한지 보는 앱',
    category: '스포츠',
    path: '/hobbies/ipbt',
    accent: '#34c759',
    available: true,
  },
  {
    id: 'veveno',
    name: 'Veveno',
    subtitle: '가게 노트',
    description: '메뉴·재고·근무를 한곳에 남기는 가벼운 매장 노트',
    category: '라이프',
    path: '/hobbies/veveno',
    accent: '#c4a484',
    available: true,
  },
    {
    id: 'lotto',
    name: '6PICK',
    subtitle: '로또 번호',
    description: '몬테카를로·Hot/Cold로 번호를 만들고 히스토리를 저장하는 앱',
    category: '라이프',
    path: '/hobbies/lotto',
    accent: '#af52de',
    available: true,
    iconSrc: '/6pick/logo.svg',
  },
  {
    id: 'score-viewer',
    name: 'Score Viewer',
    subtitle: '악보 뷰어',
    description: 'MusicXML/MXL 악보를 열고 메트로놈·조옮김·자동 스크롤로 연습',
    category: '음악',
    path: '/hobbies/score-viewer',
    accent: '#5e5ce6',
    available: true,
  },
];

export function getFeaturedHobby(): HobbyApp {
  return HOBBY_APPS.find((app) => app.id === 'ipbt') ?? HOBBY_APPS[0];
}

export function getHobbyById(id: string): HobbyApp | undefined {
  const resolvedId =
    id === 'analyze-baseball'
      ? 'ipbt'
      : id === 'brew-note'
        ? 'veveno'
        : id;
  return HOBBY_APPS.find((app) => app.id === resolvedId);
}

export function getHobbiesByCategory(category: string): HobbyApp[] {
  return HOBBY_APPS.filter((app) => app.category === category);
}
