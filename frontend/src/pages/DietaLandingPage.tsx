import { useAuthStore } from '../stores/authStore';
import { useNavigate } from 'react-router-dom';
import { HobbyLandingLayout } from '../components/HobbyLandingLayout';

const HOME = '/hobbies/dieta/home';

/** 공개 소개 랜딩 — 앱 홈은 /hobbies/dieta/home */
export function DietaLandingPage() {
  const navigate = useNavigate();
  const loggedIn = useAuthStore(s => Boolean(s.accessToken));

  return (
    <HobbyLandingLayout
      eyebrow="라이프 · 체중 코칭"
      title="Dieta"
      lead="식사와 체중을 기록하고, 한 주씩 돌아보세요. 내 리듬에 맞춰 목표를 조절하는 코칭 노트."
      marqueeItems={['체중', '섭취', '활동', '주간 체크인', 'Dieta']}
      blockTone="mint"
      blockTitle="한 주씩 부드럽게"
      blockSubhead="목표 · 기록 · 리듬"
      blockBody="하루 식사량과 체중 변화, 활동 갭을 맞춰 가며 코칭을 이어 가세요."
      productImage="/hobbies/dieta-product-ui.png"
      productImageDark="/hobbies/dieta-product-ui-dark.png"
      features={[
        {
          title: '맞춤형 하루 식사량 코칭',
          body: '감량부터 증량까지, 목표만 설정하면 내게 딱 맞는 하루 권장 식사량을 계산해 드려요.',
        },
        {
          title: '한눈에 보는 체중 변화',
          body: '매일 꾸준히, 혹은 매주 한 번씩. 편할 때 체중을 기록하고 변하는 내 모습을 그래프로 확인하세요.',
        },
        {
          title: '간편한 끼니별 식단 기록',
          body: '아침, 점심, 저녁, 간식까지. 오늘 먹은 메뉴를 기록하면 하루의 영양소를 한 번에 분석해 드려요.',
        },
        {
          title: '남은 목표, 운동으로 채우기',
          body: '오늘 활동량이 조금 부족한가요? 목표 달성을 위해 몇 걸음, 몇 분의 운동이 더 필요한지 바로 알려드려요.',
        },
      ]}
      startLabel={loggedIn ? '오늘 보기' : 'Dieta 시작하기'}
      onStart={() => {
        void navigate(HOME);
      }}
    />
  );
}
