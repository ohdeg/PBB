import { Link } from 'react-router-dom';
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
  marqueeItems: string[];
  blockTone: HobbyBlockTone;
  blockTitle: string;
  blockSubhead: string;
  blockBody: string;
  productImage?: string;
  features: HobbyLandingFeature[];
  closingCopy: string;
  onStart: () => void;
  secondaryAction?: { label: string; to: string };
  logoSrc?: string;
}

/** 홈(figma)과 같은 리듬의 취미 앱 소개 랜딩 */
export function HobbyLandingLayout({
  eyebrow,
  title,
  lead,
  note,
  marqueeItems,
  blockTone,
  blockTitle,
  blockSubhead,
  blockBody,
  productImage,
  features,
  closingCopy,
  onStart,
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
            시작하기
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
          className={`figma-block figma-block--${blockTone} figma-block--featured${inverse ? ' figma-block--inverse' : ''}`}
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
                시작하기
              </button>
              <a
                href="#feature-list"
                className={`figma-link${inverse ? ' figma-link--inverse' : ''}`}
              >
                기능 보기
              </a>
            </div>
          </div>
          <div className="figma-block__media" aria-hidden="true">
            {productImage ? (
              <img
                src={productImage}
                alt=""
                width={320}
                height={320}
                draggable={false}
              />
            ) : (
              <span className="figma-block__fallback">{title.slice(0, 1)}</span>
            )}
          </div>
        </article>
      </section>

      <section
        id="feature-list"
        className="hobby-landing__features"
        aria-label="기능 소개"
      >
        <p className="figma-eyebrow">Features</p>
        <h2 className="hobby-landing__features-title">이런 걸 할 수 있어요</h2>
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
          시작하기
        </button>
      </section>
    </main>
  );
}
