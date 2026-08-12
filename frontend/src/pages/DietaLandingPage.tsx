import { useNavigate } from 'react-router-dom';
import { HobbyLandingLayout } from '../components/HobbyLandingLayout';

const HOME = '/hobbies/dieta/home';

/** 공개 소개 랜딩 — 앱 홈은 /hobbies/dieta/home */
export function DietaLandingPage() {
  const navigate = useNavigate();

  return (
    <HobbyLandingLayout
      eyebrow="라이프 · 체중 코칭"
      title="Dieta"
      lead="체중과 평소 리듬을 기준으로, 키토플루를 피하며 한 주씩 부드럽게 조절하는 코칭 노트."
      marqueeItems={['체중', '섭취', '활동', '주간 체크인', 'Dieta']}
      blockTone="mint"
      blockTitle="한 주씩 부드럽게"
      blockSubhead="목표 · 기록 · 리듬"
      blockBody="하루 식사량과 체중 변화, 활동 갭을 맞춰 가며 코칭을 이어 가세요."
      productImage="/hobbies/dieta-product.png"
      features={[
        {
          title: '내 목표에 맞는 하루 식사량',
          body: '감량·증량 목표를 정하면, 매일 얼마나 먹으면 좋을지 알려 줘요.',
        },
        {
          title: '체중 변화를 한눈에',
          body: '원하면 매일, 아니면 주간 체크인 때 체중을 남기고 변화를 따라가 볼 수 있어요.',
        },
        {
          title: '먹은 걸 끼니별로 쌓아 두기',
          body: '아침·점심·저녁·간식으로 적어 두고, 하루가 끝나면 한 번에 분석해요.',
        },
        {
          title: '이번 주 갭을 걸음·운동으로',
          body: '활동이 더 필요할 때, 몇 보·몇 분이면 되는지 바로 보여 줘요.',
        },
      ]}
      closingCopy="준비되면 시작해 보세요. 홈(또는 온보딩)으로 이어집니다."
      onStart={() => {
        void navigate(HOME);
      }}
    />
  );
}
