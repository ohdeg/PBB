import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { Link } from 'react-router-dom';

const SWIPE_THRESHOLD_PX = 40;

export interface SrankoImageCarouselProps {
  urls: string[];
  /** card = feed aspect; detail = large preview; compose = write form preview */
  variant?: 'card' | 'detail' | 'compose';
  alt?: string;
  className?: string;
  /** Feed cards: tapping the photo opens detail (nav/dots still stop propagation). */
  linkTo?: string;
  /** When set, show remove buttons per slide (compose). */
  onRemoveAt?: (index: number) => void;
}

export function SrankoImageCarousel({
  urls,
  variant = 'detail',
  alt = '',
  className,
  linkTo,
  onRemoveAt,
}: SrankoImageCarouselProps) {
  const [index, setIndex] = useState(0);
  const dragStartX = useRef<number | null>(null);
  const dragging = useRef(false);
  const didSwipe = useRef(false);

  useEffect(() => {
    setIndex((current) => {
      if (urls.length === 0) {
        return 0;
      }
      return Math.min(current, urls.length - 1);
    });
  }, [urls.length]);

  const go = useCallback(
    (next: number) => {
      if (urls.length <= 1) {
        return;
      }
      const wrapped = ((next % urls.length) + urls.length) % urls.length;
      setIndex(wrapped);
    },
    [urls.length],
  );

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (urls.length <= 1) {
      return;
    }
    dragging.current = true;
    didSwipe.current = false;
    dragStartX.current = e.clientX;
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragging.current || dragStartX.current == null) {
      return;
    }
    const delta = e.clientX - dragStartX.current;
    dragging.current = false;
    dragStartX.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }
    if (Math.abs(delta) < SWIPE_THRESHOLD_PX) {
      return;
    }
    didSwipe.current = true;
    e.preventDefault();
    e.stopPropagation();
    go(delta < 0 ? index + 1 : index - 1);
  };

  if (urls.length === 0) {
    return null;
  }

  const rootClass = [
    'sranko-carousel',
    `sranko-carousel--${variant}`,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={rootClass}
      role="region"
      aria-roledescription="carousel"
      aria-label="게시 이미지"
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerCancel={() => {
        dragging.current = false;
        dragStartX.current = null;
      }}
    >
      <div className="sranko-carousel__viewport">
        <div
          className="sranko-carousel__track"
          style={{ transform: `translateX(-${index * 100}%)` }}
        >
          {urls.map((url, i) => {
            const img = (
              <img
                src={url}
                alt={alt || (urls.length > 1 ? `${i + 1} / ${urls.length}` : '')}
                draggable={false}
              />
            );
            return (
              <div key={`${url}-${i}`} className="sranko-carousel__slide">
                {linkTo ? (
                  <Link
                    to={linkTo}
                    className="sranko-carousel__img-link"
                    onClick={(e) => {
                      if (didSwipe.current) {
                        e.preventDefault();
                        didSwipe.current = false;
                      }
                    }}
                  >
                    {img}
                  </Link>
                ) : (
                  img
                )}
                {onRemoveAt ? (
                  <button
                    type="button"
                    className="sranko-carousel__remove"
                    aria-label={`${i + 1}번 이미지 삭제`}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onRemoveAt(i);
                    }}
                    onPointerDown={(e) => e.stopPropagation()}
                  >
                    ×
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      {urls.length > 1 ? (
        <>
          <button
            type="button"
            className="sranko-carousel__nav sranko-carousel__nav--prev"
            aria-label="이전 이미지"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              go(index - 1);
            }}
            onPointerDown={(e) => e.stopPropagation()}
          >
            ‹
          </button>
          <button
            type="button"
            className="sranko-carousel__nav sranko-carousel__nav--next"
            aria-label="다음 이미지"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              go(index + 1);
            }}
            onPointerDown={(e) => e.stopPropagation()}
          >
            ›
          </button>
          <div className="sranko-carousel__dots" role="tablist" aria-label="이미지 위치">
            {urls.map((_, i) => (
              <button
                key={i}
                type="button"
                role="tab"
                aria-selected={i === index}
                className={
                  i === index
                    ? 'sranko-carousel__dot is-active'
                    : 'sranko-carousel__dot'
                }
                aria-label={`${i + 1}번째 이미지`}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIndex(i);
                }}
                onPointerDown={(e) => e.stopPropagation()}
              />
            ))}
          </div>
          <span className="sranko-carousel__count" aria-hidden>
            {index + 1}/{urls.length}
          </span>
        </>
      ) : null}
    </div>
  );
}

/** Prefer imageUrls; fall back to legacy imageUrl. */
export function postImageUrls(post: { imageUrls?: string[] | null; imageUrl: string }): string[] {
  if (post.imageUrls && post.imageUrls.length > 0) {
    return post.imageUrls;
  }
  return post.imageUrl ? [post.imageUrl] : [];
}
