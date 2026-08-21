import { Link } from 'react-router-dom';
import { HobbyProductShot } from './HobbyProductShot';
import type { HobbyBlockTone } from '../data/hobbies';

export interface HobbyLandingFeature {
  title: string;
  body: string;
}

export interface HobbyLandingLayoutProps {
  eyebrow: string;
  title: string;
  lead: string;
  /** 히어로 하단 보조 안내 */
  note?: string;
  /** 기능 목록 아래·클로징 위 광고형 배너 */
  promoBanner?: string;
  /** 배너 상단 작은 라벨 */
  promoEyebrow?: string;
  marqueeItems: string[];
  blockTone: HobbyBlockTone;
  blockTitle: string;
  blockSubhead: string;
  blockBody: string;
  productImage?: string;
  productImageDark?: string;
  features: HobbyLandingFeature[];
  closingCopy: string;
  onStart: () => void;
  /** 히어로·블록 프라이머리 CTA. 기본 시작하기 */
  startLabel?: string;
  secondaryAction?: { label: string; to: string };
  logoSrc?: string;
}

/** 홈(figma)과 같은 리듬의 취미 앱 소개 랜딩 */
export function HobbyLandingLayout({
  eyebrow,
  title,
  lead,
  note,
  promoBanner,
  promoEyebrow = '지금',
  marqueeItems,
  blockTone,
  blockTitle,
  blockSubhead,
  blockBody,
  productImage,
  productImageDark,
  features,
  closingCopy,
  onStart,
  startLabel = '시작하기',
  secondaryAction,
  logoSrc,
}: HobbyLandingLayoutProps) {
  const inverse = blockTone === 'navy';
  const marquee = [...marqueeItems, ...marqueeItems];

  return (
    <main className="hobby-landing figma-home">
      <section className="figma-hero" aria-label={`${title} 소개`}>
        <p className="figma-eyebrow">{eyebrow}</p>
        <div className="hobby-landing__title-row">
          {logoSrc ? (
            <img
              src={logoSrc}
              alt=""
              width={56}
              height={56}
              className="hobby-landing__logo"
            />
          ) : null}
          <h1 className="figma-hero__title hobby-landing__title">{title}</h1>
        </div>
        <p className="figma-hero__lead">{lead}</p>
        {note ? <p className="hobby-landing__note">{note}</p> : null}
        <div className="figma-hero__actions">
          <button
            type="button"
            className="figma-pill figma-pill--primary"
            onClick={onStart}
          >
            {startLabel}
          </button>
          {secondaryAction ? (
            <Link to={secondaryAction.to} className="figma-pill figma-pill--secondary">
              {secondaryAction.label}
            </Link>
          ) : (
            <Link to="/" className="figma-pill figma-pill--secondary">
              홈으로
            </Link>
          )}
        </div>
      </section>

      <div className="figma-marquee" aria-hidden="true">
        <div className="figma-marquee__track">
          {marquee.map((item, i) => (
            <span key={`${item}-${i}`} className="figma-marquee__item">
              {item}
            </span>
          ))}
        </div>
      </div>

      <section id="features" className="hobby-landing__apps figma-apps" aria-label="앱 하이라이트">
        <article
          className={`figma-block figma-block--${blockTone} figma-block--featured`}
        >
          <div className="figma-block__copy">
            <p className="figma-eyebrow">{eyebrow}</p>
            <h2 className="figma-block__title">{blockTitle}</h2>
            <p className="figma-block__subhead">{blockSubhead}</p>
            <p className="figma-block__body">{blockBody}</p>
            <div className="figma-block__actions">
              <button
                type="button"
                className={`figma-pill ${inverse ? 'figma-pill--secondary' : 'figma-pill--primary'}`}
                onClick={onStart}
              >
                {startLabel}
              </button>
              <a
                href="#feature-list"
                className={`figma-link${inverse ? ' figma-link--inverse' : ''}`}
              >
                할 수 있는 일
              </a>
            </div>
          </div>
          <div className="figma-block__media" aria-hidden="true">
            <HobbyProductShot
              light={productImage}
              dark={productImageDark}
              fallback={title.slice(0, 1)}
            />
          </div>
        </article>
      </section>

      {promoBanner ? (
        <aside className="hobby-landing__promo" aria-label="사용 현황">
          <p className="hobby-landing__promo-eyebrow">{promoEyebrow}</p>
          <p className="hobby-landing__promo-copy">{promoBanner}</p>
        </aside>
      ) : null}

      <section
        id="feature-list"
        className="hobby-landing__features"
        aria-label="기능 소개"
      >
        <p className="figma-eyebrow">할 수 있는 일</p>
        <h2 className="hobby-landing__features-title">이 앱에서</h2>
        <div className="hobby-landing__feature-grid">
          {features.map((feature) => (
            <article key={feature.title} className="hobby-landing__feature-card">
              <strong>{feature.title}</strong>
              <p>{feature.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="hobby-landing__closing" aria-label="시작 유도">
        <p className="hobby-landing__closing-copy">{closingCopy}</p>
        <button
          type="button"
          className="figma-pill figma-pill--primary"
          onClick={onStart}
        >
          {startLabel}
        </button>
      </section>
    </main>
  );
}
