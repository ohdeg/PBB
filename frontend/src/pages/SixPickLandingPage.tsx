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
      lead="몬테카를로·Hot/Cold로 번호를 만들고, 히스토리를 남기며 당첨 세금을 미리 계산해 보는 로또 노트."
      note={
        accessToken
          ? undefined
          : '번호 생성·세금 계산은 비로그인으로도 가능해요. 히스토리 저장만 로그인이 필요해요.'
      }
      logoSrc="/6pick/logo.svg"
      marqueeItems={['몬테카를로', 'Hot/Cold', '히스토리', '세금 계산', '6PICK']}
      blockTone="lilac"
      blockTitle="번호 전략을 가볍게"
      blockSubhead="생성 · 기록 · 계산"
      blockBody="패턴을 반영해 번호를 뽑고, 히스토리와 세금까지 한 흐름으로 이어 보세요."
      productImage="/hobbies/6pick-product.png"
      features={[
        {
          title: '번호 생성',
          body: '몬테카를로 또는 단순 무작위로 6번호를 뽑고 Hot/Cold를 반영해요.',
        },
        {
          title: '히스토리',
          body: '뽑은 번호를 모아 두고, 로그인하면 서버에 저장해 이어 볼 수 있어요.',
        },
        {
          title: '세금 계산',
          body: '당첨 금액 기준으로 실수령·세금을 빠르게 가늠해 봐요.',
        },
        {
          title: '회차·동기화',
          body: '최신 당첨 번호를 참고하고, DEV는 회차·엑셀도 관리할 수 있어요.',
        },
      ]}
      closingCopy="바로 번호를 뽑는 화면으로 이어집니다."
      startLabel="번호 뽑기"
      onStart={() => {
        void navigate(SIXPICK_PLAY);
      }}
    />
  );
}
