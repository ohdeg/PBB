import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { vevenoApi } from '../api/vevenoApi';
import { HobbyLandingLayout } from '../components/HobbyLandingLayout';
import { VevenoLangSwitch } from '../components/veveno/VevenoLangSwitch';
import { useTranslation } from '../features/veveno/i18n/LanguageContext';
import { useAuthStore } from '../stores/authStore';

const HUB_PATH = '/hobbies/veveno/hub';

/** 공개 소개 랜딩 — 앱 허브는 /hobbies/veveno/hub */
export function VevenoLandingPage() {
  const navigate = useNavigate();
  const t = useTranslation();
  const accessToken = useAuthStore((state) => state.accessToken);
  const [usageNote, setUsageNote] = useState<string | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    void vevenoApi
      .stats()
      .then((res) => {
        if (cancelled) return;
        const { ownerCount, storeCount } = res.data;
        if (ownerCount <= 0 || storeCount <= 0) {
          setUsageNote(undefined);
          return;
        }
        setUsageNote(t('landing.promo', { ownerCount, storeCount }));
      })
      .catch(() => {
        if (!cancelled) {
          setUsageNote(undefined);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [t]);

  const handleStart = () => {
    if (accessToken) {
      void navigate(HUB_PATH);
      return;
    }
    void navigate('/login', { state: { from: HUB_PATH } });
  };

  return (
    <HobbyLandingLayout
      eyebrow={t('landing.eyebrow')}
      title="Veveno"
      lead={t('landing.lead')}
      promoBanner={usageNote}
      promoEyebrow={t('landing.promoEyebrow')}
      marqueeItems={[
        t('landing.marquee0'),
        t('landing.marquee1'),
        t('landing.marquee2'),
        t('landing.marquee3'),
        t('landing.marquee4'),
        t('landing.marquee5'),
      ]}
      blockTone="cream"
      blockTitle={t('landing.blockTitle')}
      blockSubhead={t('landing.blockSubhead')}
      blockBody={t('landing.blockBody')}
      productImage="/hobbies/veveno-product.png?v=angle"
      productImageDark="/hobbies/veveno-product-dark.png?v=angle"
      features={[
        { title: t('landing.feature1Title'), body: t('landing.feature1Body') },
        { title: t('landing.feature2Title'), body: t('landing.feature2Body') },
        { title: t('landing.feature3Title'), body: t('landing.feature3Body') },
        { title: t('landing.feature4Title'), body: t('landing.feature4Body') },
      ]}
      startLabel={t('landing.start')}
      onStart={handleStart}
      secondaryAction={{
        label: t('landing.demo'),
        to: '/hobbies/veveno/stores/demo',
      }}
      note={t('landing.note')}
      headerExtra={<VevenoLangSwitch />}
      homeLabel={t('landing.home')}
      featuresEyebrow={t('landing.featuresEyebrow')}
      featuresTitle={t('landing.featuresTitle')}
      featuresAria={t('landing.featuresAria')}
      promoAria={t('landing.promoAria')}
      heroAria={t('landing.heroAria', { title: 'Veveno' })}
    />
  );
}
