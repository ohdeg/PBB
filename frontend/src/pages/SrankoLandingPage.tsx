import { useNavigate } from 'react-router-dom';
import { HobbyLandingLayout } from '../components/HobbyLandingLayout';
import { SRANKO_CLOSET, SRANKO_COMMUNITY } from '../features/sranko/paths';
import { useAuthStore } from '../stores/authStore';

export function SrankoLandingPage() {
  const navigate = useNavigate();
  const accessToken = useAuthStore((s) => s.accessToken);

  const handleStart = () => {
    if (accessToken) {
      void navigate(SRANKO_CLOSET);
      return;
    }
    void navigate('/login', { state: { from: SRANKO_CLOSET } });
  };

  return (
    <HobbyLandingLayout
      eyebrow="라이프 · 디지털 옷장"
      title="슈란코"
      lead="옷과 치수를 디지털 옷장에 두고, 룩을 조합해 보관하고, 스타일 커뮤니티에 공유하세요."
      marqueeItems={['옷장', '룩', '입어보기', '커뮤니티', '슈란코']}
      blockTone="coral"
      blockTitle="옷을 모아, 룩으로"
      blockSubhead="옷장 · 피팅 · 공유"
      blockBody="사진으로 옷을 채우고, 룩을 만들고, 커뮤니티에 스타일을 남겨 보세요."
      productImage="/hobbies/sranko-product.png"
      features={[
        {
          title: '사진으로 옷장 채우기',
          body: '업로드하면 분류·배경제거를 도와 주고, 치수와 함께 보관해요.',
        },
        {
          title: '룩 합성',
          body: '상의·하의·아우터·신발을 골라 한 장의 룩으로 저장해요.',
        },
        {
          title: '입어보기',
          body: '옷장 그리드에서 옷을 고르고, 기본 마네킹으로 가상 피팅을 미리 봅니다.',
        },
        {
          title: '스타일 공유',
          body: '커뮤니티에 올리고 MY STYLE로 내 게시만 모아 볼 수 있어요.',
        },
      ]}
      closingCopy="옷장에서 옷을 보고 입어볼 수 있어요."
      startLabel="옷장 열기"
      onStart={handleStart}
      secondaryAction={{ label: '커뮤니티 둘러보기', to: SRANKO_COMMUNITY }}
    />
  );
}
