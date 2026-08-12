import { useNavigate } from 'react-router-dom';
import { HobbyLandingLayout } from '../components/HobbyLandingLayout';
import { useAuthStore } from '../stores/authStore';

const HUB_PATH = '/hobbies/veveno/hub';

/** 공개 소개 랜딩 — 앱 허브는 /hobbies/veveno/hub */
export function VevenoLandingPage() {
  const navigate = useNavigate();
  const accessToken = useAuthStore((state) => state.accessToken);

  const handleStart = () => {
    if (accessToken) {
      void navigate(HUB_PATH);
      return;
    }
    void navigate('/login', { state: { from: HUB_PATH } });
  };

  return (
    <HobbyLandingLayout
      eyebrow="라이프 · 가게 노트"
      title="Veveno"
      lead="메뉴, 재고, 근무를 한곳에 모아 두는 작은 노트예요. 사장님과 직원이 같은 화면을 보면서, 하루를 맞춰 가시면 좋을 것 같아요."
      marqueeItems={['메뉴', '재고', '근무', '도구', '가게 노트', 'Veveno']}
      blockTone="cream"
      blockTitle="가게 일을 조금 더 편하게"
      blockSubhead="메뉴 · 재고 · 근무"
      blockBody="만드는 법과 부족한 재고, 누가 언제 오는지까지 한곳에서 이어 가세요."
      productImage="/hobbies/veveno-product.png"
      features={[
        {
          title: '만드는 법을 살짝 적어 두기',
          body: '메뉴마다 레시피를 남겨 두면, 바쁠 때도 조금 더 마음이 놓여요.',
        },
        {
          title: '무엇이 부족한지 먼저 보기',
          body: '재고를 한눈에 두고, 필요할 때만 근무 중에 숫자를 고쳐 보시면 좋습니다.',
        },
        {
          title: '누가 언제 오는지 맞추기',
          body: '정규 근무부터 대타·추가까지, 달력으로 보면서 서로 맞춰 가시면 됩니다.',
        },
        {
          title: '가게에서 바로 쓰는 작은 도구',
          body: '단위를 바꾸거나 타이머를 맞춰 둘 때, 다른 앱을 따로 찾지 않아도 돼요.',
        },
      ]}
      closingCopy="준비되셨다면 시작해 보세요. 들어가시면 가게를 만들거나 찾아 보실 수 있어요."
      onStart={handleStart}
    />
  );
}
