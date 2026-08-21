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
      productImage="/hobbies/sranko-product.png?v=angle"
      productImageDark="/hobbies/sranko-product-dark.png?v=angle"
      features={[
        {
          title: '사진 한 장으로 내 옷장 완성',
          body: '옷 사진을 올리면 배경을 지우고 종류별로 자동 분류해 드려요. 상세한 치수와 함께 깔끔하게 보관해 보세요.',
        },
        {
          title: '나만의 코디 만들기',
          body: '원하는 상·하의와 아우터, 신발을 매치해 보고 마음에 드는 스타일을 한 장의 룩으로 저장해 보세요.',
        },
        {
          title: '입어보기',
          body: '옷장 그리드에서 옷을 고르고, 기본 마네킹으로 가상 피팅을 미리 봅니다.',
        },
        {
          title: '나만의 스타일 공유하기',
          body: '완성된 코디를 커뮤니티에 자랑해 보세요. 내가 올린 스타일은 \'MY STYLE\'에서 나만의 룩북처럼 모아볼 수 있어요.',
        },
      ]}
      startLabel="옷장 열기"
      onStart={handleStart}
      secondaryAction={{ label: '커뮤니티 둘러보기', to: SRANKO_COMMUNITY }}
    />
  );
}
