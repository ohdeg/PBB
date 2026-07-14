export interface HobbyApp {
  id: string;
  name: string;
  subtitle: string;
  description: string;
  category: string;
  path: string | null;
  accent: string;
  available: boolean;
}

export const HOBBY_CATEGORIES = ['스포츠', '라이프', '음악'] as const;

export type HobbyCategory = (typeof HOBBY_CATEGORIES)[number];

export const HOBBY_APPS: HobbyApp[] = [
  {
    id: 'analyze-baseball',
    name: 'Analyze Baseball',
    subtitle: '야구 분석',
    description: '타격·투구·수비 데이터를 읽고 구조적으로 분석하는 워크스페이스',
    category: '스포츠',
    path: '/hobbies/analyze-baseball',
    accent: '#3d9a6a',
    available: true,
  },
  {
    id: 'brew-note',
    name: 'Brew Note',
    subtitle: '커피 레시피',
    description: '원두·추출·테이스팅 노트를 정리하는 홈카페 앱',
    category: '라이프',
    path: '/hobbies/brew-note',
    accent: '#c4a574',
    available: true,
  },
  {
    id: 'score-viewer',
    name: 'Score Viewer',
    subtitle: '악보 뷰어',
    description: '악보를 골라 확대·넘기며 읽는 뷰어',
    category: '음악',
    path: '/hobbies/score-viewer',
    accent: '#6b8fd4',
    available: true,
  },
];

export function getFeaturedHobby(): HobbyApp {
  return HOBBY_APPS.find((app) => app.id === 'analyze-baseball') ?? HOBBY_APPS[0];
}

export function getHobbiesByCategory(category: string): HobbyApp[] {
  return HOBBY_APPS.filter((app) => app.category === category);
}
