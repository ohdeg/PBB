import { useNavigate } from 'react-router-dom';
import { HobbyLandingLayout } from '../components/HobbyLandingLayout';
import { useAuthStore } from '../stores/authStore';

export const SIXPICK_LANDING = '/hobbies/6pick';
export const SIXPICK_PLAY = '/hobbies/6pick/play';

/** 공개 소개 랜딩 — 앱 본문은 /hobbies/6pick/play */
export function SixPickLandingPage() {
  const navigate = useNavigate();
  const accessToken = useAuthStore((s) => s.accessToken);

  return (
    <HobbyLandingLayout
      eyebrow="라이프 · 로또 번호"
      title="6PICK"
      lead="스마트한 통계로 번호를 뽑고, 당첨 실수령액까지 한 번에 확인하는 똑똑한 로또 노트"
      note={
        accessToken
          ? undefined
          : '번호 생성·세금 계산은 비로그인으로도 가능해요. 히스토리 저장만 로그인이 필요해요.'
      }
      marqueeItems={['몬테카를로', 'Hot/Cold', '히스토리', '세금 계산', '6PICK']}
      blockTone="lilac"
      blockTitle="번호 전략을 가볍게"
      blockSubhead="생성 · 기록 · 계산"
      blockBody="패턴을 반영해 번호를 뽑고, 히스토리와 세금까지 한 흐름으로 이어 보세요."
      productImage="/hobbies/6pick-product.png?v=angle"
      productImageDark="/hobbies/6pick-product-dark.png?v=angle"
      features={[
        {
          title: '스마트 번호 생성',
          body: '단순 랜덤은 물론, 정밀한 확률 분석(몬테카를로)으로 6개의 번호를 추천해 드려요. 최근 당첨 패턴(Hot/Cold)까지 꼼꼼하게 반영했습니다.',
        },
        {
          title: '번호 보관함',
          body: '생성된 번호를 잊지 않게 보관하세요. 로그인하여 내 번호 기록을 안전하게 동기화할 수 있습니다.',
        },
        {
          title: '당첨금 세금 계산',
          body: '당첨 금액에 따른 정확한 세금과 실수령액을 빠르게 계산해 보세요.',
        },
        {
          title: '당첨 번호 업데이트',
          body: '매주 최신 당첨 번호를 빠르게 참고하세요.',
        },
      ]}
      startLabel="번호 뽑기"
      onStart={() => {
        void navigate(SIXPICK_PLAY);
      }}
    />
  );
}
