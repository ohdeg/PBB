import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { vevenoApi } from '../api/vevenoApi';
import { HobbyLandingLayout } from '../components/HobbyLandingLayout';
import { useAuthStore } from '../stores/authStore';

const HUB_PATH = '/hobbies/veveno/hub';

function formatUsageNote(ownerCount: number, storeCount: number): string | undefined {
  if (ownerCount <= 0 || storeCount <= 0) {
    return undefined;
  }
  return `${ownerCount}명의 사장님이 ${storeCount}개의 가게 운영에 활용 중이에요`;
}

/** 공개 소개 랜딩 — 앱 허브는 /hobbies/veveno/hub */
export function VevenoLandingPage() {
  const navigate = useNavigate();
  const accessToken = useAuthStore((state) => state.accessToken);
  const [usageNote, setUsageNote] = useState<string | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    void vevenoApi
      .stats()
      .then((res) => {
        if (cancelled) return;
        setUsageNote(formatUsageNote(res.data.ownerCount, res.data.storeCount));
      })
      .catch(() => {
        if (!cancelled) {
          setUsageNote(undefined);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

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
      lead={`메뉴, 재고, 근무 관리를 이 노트 하나에.
사장님과 직원이 같은 화면을 보며 매장의 하루를 함께 완성해 보세요.`}
      promoBanner={usageNote}
      promoEyebrow="지금 Veveno"
      marqueeItems={['메뉴', '재고', '근무', '도구', '가게 노트', 'Veveno']}
      blockTone="cream"
      blockTitle="가게 일을 조금 더 편하게"
      blockSubhead="메뉴 · 재고 · 근무"
      blockBody="만드는 법과 부족한 재고, 누가 언제 오는지까지 한곳에서 이어 가세요."
      productImage="/hobbies/veveno-product.png?v=angle"
      productImageDark="/hobbies/veveno-product-dark.png?v=angle"
      features={[
        {
          title: '만드는 법을 살짝 적어 두기',
          body: '아무리 바빠도 변함없는 맛. 핵심 레시피를 등록하고 마음 편히 일하세요.',
        },
        {
          title: '무엇이 부족한지 보기',
          body: '재고 현황을 한눈에 파악하고, 필요할 때 즉시 재고를 수정하세요.',
        },
        {
          title: '스케줄 관리하기',
          body: '정규 근무부터 대타·추가 근무까지, 달력으로 보면서 관리하세요.',
        },
        {
          title: '가게에서 바로 쓰는 작은 도구',
          body: '단위·농도 계산부터 타이머까지, 다른 앱 없이 한곳에서 해결하세요.',
        },
      ]}
      startLabel="가게 열기"
      onStart={handleStart}
      secondaryAction={{
        label: '사장님으로 써보기',
        to: '/hobbies/veveno/stores/demo',
      }}
      note="로그인 없이 이 기기에서 사장·직원 화면을 바꿔 가며 써볼 수 있어요."
    />
  );
}
